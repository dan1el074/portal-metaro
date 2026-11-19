package br.com.metaro.portal.modules.quality.checklist;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.RoleRepository;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistRecordCreateDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistRecordDto;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistListingService;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistRecordService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = {
    "external.datasource.jdbc-url=jdbc:h2:mem:checklist-delegation",
    "external.datasource.driver-class-name=org.h2.Driver",
    "external.datasource.username=sa", "external.datasource.password="
})
class ChecklistDelegationIntegrationTests {
    private static final java.util.concurrent.atomic.AtomicLong TEST_NAMES = new java.util.concurrent.atomic.AtomicLong();
    @Autowired private ChecklistRecordService service;
    @Autowired private MockMvc mvc;
    @Autowired private ChecklistListingService listing;
    @Autowired private ChecklistRecordRepository records;
    @Autowired private ChecklistCategoryRepository categories;
    @Autowired private ChecklistTemplateRepository templates;
    @Autowired private UserRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private EntityManager entityManager;
    @MockBean private UserService authentication;
    private User creator;
    private User operator;
    private ChecklistCategory category;
    private ChecklistRecordDto record;

    @BeforeEach
    void setup() {
        List<User> existing = users.findAll(); creator = existing.getFirst(); operator = existing.get(1);
        role(creator, "ROLE_CHECKLIST_ADMIN"); role(operator, "ROLE_CHECKLIST_OPERATOR");
        creator.setActivated(true); operator.setActivated(true);
        when(authentication.authenticate()).thenReturn(creator);
        category = new ChecklistCategory(); category.setName("Delegação " + TEST_NAMES.incrementAndGet());
        category.setIntegration(ChecklistIntegration.NONE); category.setActive(true); category.setDocumentTitle("Inspeção");
        category.setFieldsJson("[]"); category.setCreatedAt(Instant.now()); category.setUpdatedAt(Instant.now());
        category.setOperators(new HashSet<>(Set.of(creator, operator))); categories.saveAndFlush(category);
        ChecklistTemplate template = new ChecklistTemplate(); template.setCategory(category); template.setName("Teste");
        template.setTitleExpression("Teste"); template.setSectionsJson("[]");
        template.setCreatedAt(Instant.now()); template.setUpdatedAt(Instant.now()); templates.saveAndFlush(template);
        ChecklistRecordCreateDto input = new ChecklistRecordCreateDto(); input.setTemplateId(template.getId());
        record = service.createRecord(input);
    }

    @Test
    void transfersDraftVisibilityInDirectAccessListsCountsAndTodoAndAllowsTheDelegateToSave() {
        service.delegate(record.getId(), operator.getId()); role(creator, "ROLE_CHECKLIST_OPERATOR");
        entityManager.flush();
        assertThat(service.listRecords(PageRequest.of(0, 200)).getContent()).noneMatch(item -> item.getId().equals(record.getId()));
        assertThat(service.listVisibleFlows()).noneMatch(item -> item.getId().equals(record.getFlowId()));
        assertThat(listing.list(PageRequest.of(0, 10), category.getId(), "", "", false, false).getTotalElements()).isZero();
        assertThat(listing.counts(false).getOrDefault(category.getId().toString(), 0L)).isZero();
        when(authentication.authenticate()).thenReturn(operator);
        assertThat(service.listRecords(PageRequest.of(0, 200)).getContent()).anyMatch(item -> item.getId().equals(record.getId()));
        assertThat(service.listVisibleFlows()).anyMatch(item -> item.getId().equals(record.getFlowId()));
        assertThat(service.getFlow(record.getFlowId()).getId()).isEqualTo(record.getFlowId());
        assertThat(listing.list(PageRequest.of(0, 10), category.getId(), "", "", false, true).getTotalElements()).isEqualTo(1);
        assertThat(listing.counts(false).get(category.getId().toString())).isEqualTo(1);
        assertThat(listing.list(PageRequest.of(0, 10), category.getId(), "", "", true, false).getTotalElements()).isZero();
        service.claimRecord(record.getId());
        ChecklistRecordDto saved = service.saveRecord(record.getId(), service.getRecord(record.getId()), false);
        assertThat(saved.getOwnerId()).isEqualTo(operator.getId());
        assertThat(saved.getCreatorId()).isEqualTo(creator.getId());
        assertThat(saved.getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void preventsTheOriginalCreatorFromReadingEditingOrDeletingADelegatedDraft() {
        service.delegate(record.getId(), operator.getId()); role(creator, "ROLE_CHECKLIST_OPERATOR");
        assertThatThrownBy(() -> service.getRecord(record.getId())).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.saveRecord(record.getId(), record, false)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.deleteDraft(record.getId())).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.listRelatedMemorandos(record.getId())).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void keepsUnassignedDraftsVisibleToTheCreatorAndPreservesAdministratorAccess() {
        records.findById(record.getId()).orElseThrow().setOwner(null); entityManager.flush();
        role(creator, "ROLE_CHECKLIST_OPERATOR");
        assertThat(service.getRecord(record.getId()).getId()).isEqualTo(record.getId());
        assertThat(service.listRecords(PageRequest.of(0, 200)).getContent()).anyMatch(item -> item.getId().equals(record.getId()));
        assertThat(listing.list(PageRequest.of(0, 10), category.getId(), "", "", false, false).getTotalElements()).isEqualTo(1);
        when(authentication.authenticate()).thenReturn(operator);
        assertThatThrownBy(() -> service.getRecord(record.getId())).isInstanceOf(ResourceNotFoundException.class);
        role(operator, "ROLE_CHECKLIST_ADMIN");
        assertThat(service.getRecord(record.getId()).getId()).isEqualTo(record.getId());
    }

    @Test
    void supportsRedelegationAndRecordsTheNewOwnerInTheAudit() {
        service.delegate(record.getId(), operator.getId());
        service.delegate(record.getId(), creator.getId()); entityManager.flush(); entityManager.clear();
        ChecklistRecordDto saved = service.getRecord(record.getId());
        assertThat(saved.getOwnerId()).isEqualTo(creator.getId());
        assertThat(saved.getLogs()).filteredOn(log -> log.getAction().equals("DELEGATED")).hasSize(2);
        when(authentication.authenticate()).thenReturn(operator);
        assertThatThrownBy(() -> service.getRecord(record.getId())).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void rejectsInactiveOperatorsAndOperatorsWithoutCategoryAccess() {
        operator.setActivated(false);
        assertThatThrownBy(() -> service.delegate(record.getId(), operator.getId())).isInstanceOf(UnprocessableEntityException.class);
        operator.setActivated(true); category.getOperators().remove(operator); categories.saveAndFlush(category);
        assertThatThrownBy(() -> service.delegate(record.getId(), operator.getId())).isInstanceOf(UnprocessableEntityException.class);
    }

    @Test
    @WithMockUser(roles = "CHECKLIST_ADMIN")
    void savesAccessChangesAcrossCategoriesInOneRequest() throws Exception {
        ChecklistCategory other = new ChecklistCategory();
        other.setName("Outra categoria " + TEST_NAMES.incrementAndGet());
        other.setIntegration(ChecklistIntegration.NONE);
        other.setActive(true);
        other.setDocumentTitle("Inspeção");
        other.setFieldsJson("[]");
        other.setCreatedAt(Instant.now());
        other.setUpdatedAt(Instant.now());
        categories.saveAndFlush(other);

        mvc.perform(patch("/api/checklist/access").contentType(MediaType.APPLICATION_JSON).content("""
                [
                  {"categoryId": %d, "userId": %d, "allowed": false},
                  {"categoryId": %d, "userId": %d, "allowed": true}
                ]
                """.formatted(category.getId(), operator.getId(), other.getId(), operator.getId())))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();

        assertThat(categories.findAllowedCategoryIds(operator.getId())).contains(other.getId()).doesNotContain(category.getId());
        assertThat(categories.findAllowedCategoryIds(creator.getId())).contains(category.getId());

        mvc.perform(patch("/api/checklist/access").contentType(MediaType.APPLICATION_JSON).content("""
                [{"categoryId": %d, "userId": %d}]
                """.formatted(other.getId(), operator.getId())))
                .andExpect(status().isBadRequest());
    }

    private void role(User user, String authority) {
        user.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals(authority)).toList()));
        assertThat(user.hasRole(authority)).isTrue();
    }
}
