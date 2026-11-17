package br.com.metaro.portal.modules.general.memorando.service;

import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.PositionRepository;
import br.com.metaro.portal.core.repositories.RoleRepository;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.core.services.NotificationService;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoInsertDto;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoLogRepository;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.modules.general.memorando.util.MemorandoScheduler;
import br.com.metaro.portal.util.erp.ErpSource;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
@TestPropertySource(properties = {
    "external.datasource.jdbc-url=jdbc:h2:mem:memorando-republication",
    "external.datasource.driver-class-name=org.h2.Driver",
    "external.datasource.username=sa", "external.datasource.password="
})
class MemorandoRepublicationIntegrationTests {
    @Autowired private MemorandoService service;
    @Autowired private MemorandoRepository documents;
    @Autowired private MemorandoLogRepository logs;
    @Autowired private UserRepository users;
    @Autowired private PositionRepository positions;
    @Autowired private RoleRepository roles;
    @Autowired private EntityManager entityManager;
    @MockBean private UserService authentication;
    @MockBean private NotificationService notifications;
    @MockBean private MemorandoScheduler scheduler;
    private User author;
    private Position origin;
    private Position recipient;

    @BeforeEach
    void setup() {
        List<User> existing = users.findAll(); author = existing.getFirst();
        author.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_ADMIN")).toList()));
        origin = department("Origem", author); recipient = department("Destino", existing.get(1));
        author.setPosition(origin); when(authentication.authenticate()).thenReturn(author);
    }

    @Test
    void comparesWithThePublishedVersionAcrossIntermediateDraftSavesAndPersistsLongHistory() {
        Memorando entity = document(); documents.saveAndFlush(entity);
        service.returnMemorandoToDraft(entity.getId());
        String baseline = entity.getPublishedSnapshotJson();
        service.updateMemorando(entity.getId(), input("Título intermediário", "Descrição intermediária", "Motivo intermediário", MemorandoStatus.CREATED));
        assertThat(entity.getPublishedSnapshotJson()).isEqualTo(baseline);
        entityManager.flush(); entityManager.clear();
        String reason = "Motivo atualizado ".repeat(40).trim();
        service.updateMemorando(entity.getId(), input("Título final", "Descrição nova", reason, MemorandoStatus.PUBLISH));
        entityManager.flush(); entityManager.clear();
        List<String> entries = logs.findAll().stream().filter(log -> log.getMemorando().getId().equals(entity.getId())).map(log -> log.getContent()).toList();
        assertThat(entries.stream().filter(content -> content.startsWith("Republicou"))).containsExactly(
                "Republicou o documento nº 406/2026\nTítulo: Componente elétrico -> Título final\nDescrição alterada.\nMotivo: Motivo original -> " + reason);
        assertThat(entries).noneMatch(content -> content.startsWith("Publicou"));
        assertThat(documents.findById(entity.getId()).orElseThrow().getNumber()).isEqualTo(406L);
    }

    @Test
    void keepsTheFirstPublicationMessageUnchanged() {
        Memorando entity = document(); entity.setNumber(null); entity.setCreateAt(null); entity.setStatus(MemorandoStatus.CREATED);
        documents.saveAndFlush(entity);
        service.updateMemorando(entity.getId(), input(entity.getTitle(), entity.getDescription(), entity.getReason(), MemorandoStatus.PUBLISH));
        entityManager.flush(); entityManager.clear();
        assertThat(logs.findAll().stream().filter(log -> log.getMemorando().getId().equals(entity.getId())).map(log -> log.getContent()))
                .anyMatch(content -> content.startsWith("Publicou o documento nº "))
                .noneMatch(content -> content.startsWith("Republicou"));
    }

    private Position department(String name, User manager) {
        Position department = new Position(); department.setName(name); department.setActivated(true);
        department.setManangers(new HashSet<>(Set.of(manager))); return positions.saveAndFlush(department);
    }

    private Memorando document() {
        Memorando entity = new Memorando(); entity.setNumber(406L); entity.setCreateAt(Instant.parse("2026-11-16T12:00:00Z"));
        entity.setRequest(751L); entity.setClient("Cliente"); entity.setItems(new ArrayList<>(List.of("Item")));
        entity.setTitle("Componente elétrico"); entity.setDescription("Descrição original"); entity.setReason("Motivo original");
        entity.setStatus(MemorandoStatus.PUBLISH); entity.setCreatedBy(author);
        entity.setFromDepartments(new ArrayList<>(List.of(origin, recipient))); entity.setLogs(new ArrayList<>());
        return entity;
    }

    private MemorandoInsertDto input(String title, String description, String reason, MemorandoStatus status) {
        return new MemorandoInsertDto(751L, ErpSource.PROBUS, "Cliente", List.of("Item"), title, description, reason,
                status, List.of(origin.getId(), recipient.getId()));
    }
}
