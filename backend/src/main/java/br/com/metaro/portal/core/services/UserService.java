package br.com.metaro.portal.core.services;

import br.com.metaro.portal.core.dto.notification.PendingIssuesDto;
import br.com.metaro.portal.core.dto.role.RoleDto;
import br.com.metaro.portal.core.dto.user.*;
import br.com.metaro.portal.core.entities.NotificationType;
import br.com.metaro.portal.core.entities.Role;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.PositionRepository;
import br.com.metaro.portal.core.repositories.RoleRepository;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.core.repositories.projections.*;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.modules.general.memorando.repository.projections.MemorandoPendingProjection;
import br.com.metaro.portal.util.picture.Picture;
import br.com.metaro.portal.util.picture.PictureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class UserService implements UserDetailsService {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PositionRepository positionRepository;
    @Autowired
    private PictureService pictureService;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private MemorandoRepository memorandoRepository;

    @Transactional(readOnly = true)
    public List<UserMinDto> findAll() {
        return userRepository.findAllMin();
    }

    @Transactional(readOnly = true)
    public List<UserGroupDto> listByPositionName() {
        Map<String, List<UserSummaryMinDto>> groups = new LinkedHashMap<>();

        for (UserGroupProjection row : userRepository.findAllGrouped()) {
            groups.computeIfAbsent(row.getPosition(), k -> new ArrayList<>())
                    .add(new UserSummaryMinDto(row.getId(), row.getName()));
        }

        return groups.entrySet().stream()
                .map(entry -> new UserGroupDto(entry.getKey(), entry.getValue())).toList();
    }

    @Transactional(readOnly = true)
    public UserEditDto findById(Long id) {
        UserEditProjection projection = userRepository.findEditById(id)
                .orElseThrow(() -> new RuntimeException("Erro ao buscar usuário por ID"));

        return new UserEditDto(
                projection.getId(),
                projection.getPictureId(),
                projection.getName(),
                projection.getPositionId(),
                projection.getEmail(),
                projection.getBirthDate(),
                projection.getUsername(),
                roleRepository.findRoleIds(id),
                projection.getActivated(),
                projection.getSupportToken()
        );
    }

    @Transactional(readOnly = true)
    public MeDto getMe() {
        String username = authenticatedUsername();
        MeProjection me = userRepository.findMeProjectionByUsername(username).orElseThrow(ResourceNotFoundException::new);
        List<RoleProjection> roles = roleRepository.findRoleProjectionsByUsername(username);

        if (roles.stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getAuthority()))) {
            roles = roleRepository.findAllAdminRoles();
        }

        MeDto dto = new MeDto(me);
        roles.forEach(role -> dto.getRoles().add(new RoleDto(role)));
        List<NotificationMinProjection> notifications = userRepository.findNotificationsByUsername(username);

        List<Long> memorandoIds = notifications.stream()
                .filter(n -> n.getType() == NotificationType.MEMORANDO)
                .map(NotificationMinProjection::getReferenceId)
                .distinct()
                .toList();

        Map<Long, MemorandoPendingProjection> memorandos = Collections.emptyMap();

        if (!memorandoIds.isEmpty()) {
            memorandos = memorandoRepository.findPendingByIds(memorandoIds)
                    .stream()
                    .collect(Collectors.toMap(MemorandoPendingProjection::getId, Function.identity()));
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy").withZone(ZoneId.systemDefault());
        Long count = 1L;

        for (NotificationMinProjection notification : notifications) {
            if (notification.getType() != NotificationType.MEMORANDO) continue;

            MemorandoPendingProjection memorando = memorandos.get(notification.getReferenceId());

            if (memorando == null) continue;

            String urgency = Duration.between(memorando.getCreateAt(), Instant.now())
                    .toHours() >= 24 ? "urgent" : "pending";

            dto.getPendingIssues().add(
                new PendingIssuesDto(
                    count++,
                    "Memorando %d/%s".formatted(memorando.getNumber(),formatter.format(memorando.getCreateAt())),
                    "Falta sua assinatura!",
                    urgency
                )
            );
        }

        return dto;
    }

    @Transactional(readOnly = true)
    public UserConfigDto getConfig() {
        return userRepository.findConfigByUsername(authenticatedUsername())
                .map(UserConfigDto::new)
                .orElseThrow(ResourceNotFoundException::new);
    }

    @CacheEvict(cacheNames = "homeInfo", allEntries = true)
    @Transactional
    public UserMinDto insert(UserInsertDto dto) throws IOException {
        User user = new User();
        rulesForInsert(dto, user);
        user = userRepository.save(user);
        return new UserMinDto(user);
    }

    @CacheEvict(cacheNames = "homeInfo", allEntries = true)
    @Transactional
    public List<UserMinDto> update(Long id, UserInsertDto dto, String resetPicture) throws IOException {
        User user = userRepository.getReferenceById(id);
        Picture pictureToDelete = rulesForUpdate(dto, user, resetPicture);

        user = userRepository.save(user);
        userRepository.flush();

        if (pictureToDelete != null) pictureService.deleteCheckingReferences(pictureToDelete.getId(), user.getId());
        return findAll();
    }

    @Transactional
    public UserConfigDto updateConfig(UserConfigInsertDto dto, String resetPicture) throws IOException {
        User user = authenticate();
        Picture pictureToDelete = rulesForUpdateConfig(dto, user, resetPicture);

        user = userRepository.save(user);
        userRepository.flush();

        if (pictureToDelete != null) pictureService.deleteCheckingReferences(pictureToDelete.getId(), user.getId());

        return new UserConfigDto(user);
    }

    @CacheEvict(cacheNames = "homeInfo", allEntries = true)
    @Transactional
    public void deactivateUser(Long id) {
        if (!userRepository.existsById(id)) throw new ResourceNotFoundException();

        User me = authenticate();
        if (me.getId().equals(id)) throw new UnprocessableEntityException("Um usuário não pode se desativar!");

        User user = userRepository.getReferenceById(id);
        user.setActivated(false);
        userRepository.save(user);
    }

    private Picture rulesForUpdate(UserInsertDto dto, User entity, String resetPicture) throws IOException {
        entity.setName(dto.getName());
        entity.setPosition(positionRepository.getReferenceById(Long.valueOf(dto.getPosition())));
        entity.setBirthDate(dto.getBirthDate());
        entity.setEmail(dto.getEmail());
        entity.setUsername(dto.getUsername().toLowerCase().trim());
        entity.setActivated(dto.getActivated().equals("true"));
        entity.setUpdateAt(Instant.now());
        entity.setRoles(new HashSet<>());
        entity.setSupportToken(null);

        if (dto.getSupportToken() != null && !dto.getSupportToken().equals("null")) {
            entity.setSupportToken(dto.getSupportToken());
        }

        if (dto.getPassword() != null) {
            String newPassword = passwordEncoder.encode(dto.getPassword());
            entity.setPassword(newPassword);
        }

        List<Long> rolesList = new ArrayList<>();
        if (dto.getRoles() != null && !dto.getRoles().isBlank()) {
            rolesList.addAll(
                    Arrays.stream(dto.getRoles().split(",")).map(String::trim).map(Long::valueOf).toList()
            );
        }

        if (!rolesList.contains(2L)) rolesList.add(1L);

        for (Long roleId : rolesList) {
            Role role = roleRepository.findById(roleId).orElseThrow(ResourceNotFoundException::new);
            validateRoleIsActivated(role);
            addRoleWithAncestors(entity, role);
        }

        Picture pictureToDelete = null;

        if (resetPicture != null && resetPicture.equals("true")) {
            pictureToDelete = entity.getPicture();
            entity.setPicture(null);
            return pictureToDelete;
        }

        if (dto.getPicture() != null) {
            List<MultipartFile> fileList = new ArrayList<>();
            fileList.add(dto.getPicture());
            Picture picture = pictureService.saveProfileImages(fileList).get(0);

            pictureToDelete = entity.getPicture();
            entity.setPicture(picture);
        }

        return pictureToDelete;
    }

    private Picture rulesForUpdateConfig(UserConfigInsertDto dto, User entity, String resetPicture) throws IOException {
        entity.setName(dto.getName());
        entity.setEmail(dto.getEmail());
        entity.setBirthDate(dto.getBirthDate());
        entity.setUpdateAt(Instant.now());

        if (dto.getPassword() != null) {
            entity.setPassword(passwordEncoder.encode(dto.getPassword()));
        }

        Picture pictureToDelete = null;

        if (resetPicture != null && resetPicture.equals("true")) {
            pictureToDelete = entity.getPicture();
            entity.setPicture(null);
            return pictureToDelete;
        }

        if (dto.getPicture() != null) {
            List<MultipartFile> fileList = new ArrayList<>();
            fileList.add(dto.getPicture());
            Picture picture = pictureService.saveProfileImages(fileList).getFirst();

            pictureToDelete = entity.getPicture();
            entity.setPicture(picture);
        }

        return pictureToDelete;
    }

    private void rulesForInsert(UserInsertDto dto, User entity) throws IOException {
        entity.setName(dto.getName());
        entity.setPosition(positionRepository.getReferenceById(Long.valueOf(dto.getPosition())));
        entity.setBirthDate(dto.getBirthDate());
        entity.setEmail(dto.getEmail());
        entity.setUsername(dto.getUsername().toLowerCase().trim());
        entity.setActivated(dto.getActivated().equals("true"));
        entity.setCreatedAt(Instant.now());
        entity.setUpdateAt(Instant.now());
        entity.setRoles(new HashSet<>());

        String newPassword = passwordEncoder.encode(dto.getPassword());
        entity.setPassword(newPassword);

        if (dto.getSupportToken() != null) {
            entity.setSupportToken(dto.getSupportToken());
        }

        if (dto.getPicture() != null)  {
            List<MultipartFile> fileList = new ArrayList<>();
            fileList.add(dto.getPicture());
            entity.setPicture(pictureService.saveProfileImages(fileList).get(0));
        }

        List<Long> rolesList = new ArrayList<>();
        if (dto.getRoles() != null && !dto.getRoles().isBlank()) {
            rolesList.addAll(
                    Arrays.stream(dto.getRoles().split(",")).map(String::trim).map(Long::valueOf).toList()
            );
        }
        rolesList.add(1L);

        for (Long roleId : rolesList) {
            Role role = roleRepository.findById(roleId).orElseThrow(ResourceNotFoundException::new);
            validateRoleIsActivated(role);
            addRoleWithAncestors(entity, role);
        }
    }

    private void validateRoleIsActivated(Role role) {
        if (!role.isActivated()) {
            throw new UnprocessableEntityException(
                    "A permissão %s está desativada e não pode ser atribuída a um usuário!".formatted(role.getAuthority())
            );
        }
    }

    private void addRoleWithAncestors(User user, Role role) {
        Role currentRole = role;

        while (currentRole != null) {
            user.addRole(currentRole);
            currentRole = currentRole.getFather();
        }
    }

    public User authenticate() {
        return userRepository.findMeByUsername(authenticatedUsername())
                .orElseThrow(() -> new UsernameNotFoundException("\"username\" não encontrado"));
    }

    private String authenticatedUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Jwt jwtPrincipal = (Jwt) authentication.getPrincipal();
        return jwtPrincipal.getClaim("username");
    }

    @Override
    public UserDetails loadUserByUsername(String userName) {
        List<UserDetailsProjection> projections = userRepository.searchUserAndRolesByUsername(userName);

        if (projections.isEmpty()) throw new UsernameNotFoundException("Username not found");

        User user = new User();
        user.setUsername(userName);
        user.setPassword(projections.getFirst().getPassword());

        for (UserDetailsProjection projection : projections) {
            user.addRole(new Role(
                projection.getRoleId(),
                projection.getAuthority(),
                projection.getTitle(),
                projection.getTitleUrl(),
                projection.getParent(),
                projection.getParentUrl()
            ));
        }

        return user;
    }
}
