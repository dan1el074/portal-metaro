package br.com.metaro.portal.modules.quality.checklist;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.RoleRepository;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistMemorandoDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistRecordCreateDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistRecordDto;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistCategory;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistFlow;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistIntegration;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistTemplate;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistCategoryRepository;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistFlowRepository;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistTemplateRepository;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistMemorandoService;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistRecordService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
@TestPropertySource(properties = {
    "external.datasource.jdbc-url=jdbc:h2:mem:checklist-memorandos",
    "external.datasource.driver-class-name=org.h2.Driver",
    "external.datasource.username=sa", "external.datasource.password="
})
class ChecklistMemorandoIntegrationTests {
    @Autowired private ChecklistMemorandoService service;
    @Autowired private MemorandoRepository documents;
    @Autowired private UserRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private ChecklistRecordService records;
    @Autowired private ChecklistCategoryRepository categories;
    @Autowired private ChecklistTemplateRepository templates;
    @Autowired private ChecklistFlowRepository flows;
    @Autowired private EntityManager entityManager;
    @MockBean private UserService authentication;
    private User reader;
    private User other;
    private ChecklistFlow flow;

    @BeforeEach
    void setup() {
        List<User> existing = users.findAll();
        reader = existing.getFirst(); other = existing.get(1);
        role("ROLE_MEMORANDO");
        flow = new ChecklistFlow(); flow.setOrderNumber("688");
        flow.setCommercialItem("60310 - PA DOCA MOVEL (DM)");
    }

    @Test
    void matchesTheExactOrderAndAnyItemCodeIgnoringDescriptionsAndDuplicates() {
        Memorando match = document(688L, MemorandoStatus.PUBLISH, other,
                "60297 - Outro item", "60310 - Descrição diferente", "60310 - Repetido");
        document(689L, MemorandoStatus.PUBLISH, other, "60310 - Outro pedido");
        document(688L, MemorandoStatus.PUBLISH, other, "6031 - Prefixo", "160310 - Sufixo", "60297 - 60310 na descrição");
        assertThat(service.findRelated(flow, reader)).extracting(ChecklistMemorandoDto::getId).containsExactly(match.getId());
    }

    @Test
    void normalizesSpacesAndLeadingZeros() {
        flow.setOrderNumber(" 00688 "); flow.setCommercialItem(" 0060310 - Descrição ");
        Memorando match = document(688L, MemorandoStatus.APPROVED, other, "60310 - Item");
        assertThat(service.findRelated(flow, reader)).extracting(ChecklistMemorandoDto::getId).containsExactly(match.getId());
    }

    @Test
    void onlyShowsDraftsToTheirAuthorOrAnAdministratorAndKeepsAllPublishedStatuses() {
        Memorando hidden = document(688L, MemorandoStatus.CREATED, other, "60310 - Item");
        Memorando own = document(688L, MemorandoStatus.CREATED, reader, "60310 - Item");
        Memorando canceled = document(688L, MemorandoStatus.CANCELED, other, "60310 - Item");
        assertThat(service.findRelated(flow, reader)).extracting(ChecklistMemorandoDto::getId)
                .containsExactly(canceled.getId(), own.getId());
        role("ROLE_ADMIN");
        assertThat(service.findRelated(flow, reader)).extracting(ChecklistMemorandoDto::getId)
                .containsExactly(canceled.getId(), own.getId(), hidden.getId());
    }

    @Test
    void doesNotExposeDocumentsWithoutMemorandoAccess() {
        document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item"); role("ROLE_CHECKLIST_ADMIN");
        assertThat(service.findRelated(flow, reader)).isEmpty();
    }

    @Test
    void returnsEmptyForMissingInvalidOrOversizedKeys() {
        document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item");
        for (String order : new String[] { null, "", "PE", "688.0", "9223372036854775808" }) {
            flow.setOrderNumber(order); assertThat(service.findRelated(flow, reader)).isEmpty();
        }
        flow.setOrderNumber("688");
        for (String item : new String[] { null, "", "-", "Descrição 60310", "60310A - Item" }) {
            flow.setCommercialItem(item); assertThat(service.findRelated(flow, reader)).isEmpty();
        }
    }

    @Test
    void handlesMissingItemsAndReturnsNewestDocumentsFirst() {
        document(688L, MemorandoStatus.PUBLISH, other, (String[]) null);
        Memorando first = document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item");
        Memorando last = document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item");
        first.setCreateAt(Instant.parse("2026-01-01T12:00:00Z"));
        assertThat(service.findRelated(flow, reader)).extracting(ChecklistMemorandoDto::getId)
                .containsExactly(last.getId(), first.getId());
    }

    @Test
    void requiresConfirmationForAMemorandoCreatedAfterTheChecklistWasOpened() {
        ChecklistRecordDto record = checklist();
        assertThat(records.listRelatedMemorandos(record.getId())).isEmpty();
        document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item novo");
        assertThatThrownBy(() -> records.saveRecord(record.getId(), record, true))
                .isInstanceOf(UnprocessableEntityException.class).hasMessageContaining("Essa ação será registrada");
        assertThat(records.getRecord(record.getId()).getStatus()).isEqualTo("DRAFT");
    }

    @ParameterizedTest
    @EnumSource(value = MemorandoStatus.class, names = { "CREATED", "PUBLISH", "CANCELED" })
    void persistsTheExplicitDecisionAndCurrentMemorandoReferences(MemorandoStatus status) {
        ChecklistRecordDto record = checklist();
        Memorando memorando = document(688L, status, other, "60310 - Item");
        record.setConfirmOpenMemorandos(true);
        records.saveRecord(record.getId(), record, true);
        entityManager.flush(); entityManager.clear();
        ChecklistRecordDto saved = records.getRecord(record.getId());
        assertThat(saved.getStatus()).isEqualTo("FINISHED");
        assertThat(saved.getLogs()).filteredOn(log -> log.getAction().equals("FINISHED_WITH_OPEN_MEMORANDOS"))
                .singleElement().satisfies(log -> {
                    assertThat(log.getActor()).isEqualTo(reader.getName());
                    assertThat(log.getDetails()).contains("optou por continuar", "Pedido: 688", "Item: 60310", "#" + memorando.getId());
                });
    }

    @Test
    void recognizesApprovalAfterOpeningAndDoesNotRecordAnOverrideWhenNoneIsNeeded() {
        ChecklistRecordDto record = checklist();
        Memorando memorando = document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item");
        assertThat(records.listRelatedMemorandos(record.getId())).hasSize(1);
        memorando.setStatus(MemorandoStatus.APPROVED); documents.saveAndFlush(memorando);
        record.setConfirmOpenMemorandos(true);
        ChecklistRecordDto saved = records.saveRecord(record.getId(), record, true);
        assertThat(saved.getStatus()).isEqualTo("FINISHED");
        assertThat(saved.getLogs()).noneMatch(log -> log.getAction().equals("FINISHED_WITH_OPEN_MEMORANDOS"));
    }

    @Test
    void draftSavesDoNotRequireConfirmationOrRecordAnOverride() {
        ChecklistRecordDto record = checklist();
        document(688L, MemorandoStatus.PUBLISH, other, "60310 - Item");
        record.setConfirmOpenMemorandos(true);
        ChecklistRecordDto saved = records.saveRecord(record.getId(), record, false);
        assertThat(saved.getStatus()).isEqualTo("DRAFT");
        assertThat(saved.getLogs()).noneMatch(log -> log.getAction().equals("FINISHED_WITH_OPEN_MEMORANDOS"));
    }

    private ChecklistRecordDto checklist() {
        role("ROLE_ADMIN"); when(authentication.authenticate()).thenReturn(reader);
        ChecklistCategory category = new ChecklistCategory(); category.setName("Memorandos " + UUID.randomUUID());
        category.setIntegration(ChecklistIntegration.NONE); category.setActive(true); category.setFieldsJson("[]"); category.setDocumentTitle("Inspeção");
        category.setCreatedAt(Instant.now()); category.setUpdatedAt(Instant.now()); categories.saveAndFlush(category);
        ChecklistTemplate template = new ChecklistTemplate(); template.setCategory(category); template.setName("Inspeção");
        template.setTitleExpression("Inspeção"); template.setSectionsJson("[]");
        template.setCreatedAt(Instant.now()); template.setUpdatedAt(Instant.now()); templates.saveAndFlush(template);
        ChecklistRecordCreateDto input = new ChecklistRecordCreateDto(); input.setTemplateId(template.getId());
        ChecklistRecordDto record = records.createRecord(input);
        ChecklistFlow savedFlow = flows.findById(record.getFlowId()).orElseThrow();
        savedFlow.setOrderNumber("688"); savedFlow.setCommercialItem("60310 - PA DOCA MOVEL (DM)");
        flows.saveAndFlush(savedFlow);
        return records.getRecord(record.getId());
    }

    private void role(String authority) {
        reader.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals(authority)).toList()));
        assertThat(reader.hasRole(authority)).isTrue();
    }

    private Memorando document(Long order, MemorandoStatus status, User author, String... items) {
        Memorando document = new Memorando(); document.setRequest(order); document.setStatus(status);
        document.setCreatedBy(author); document.setItems(items == null ? null : List.of(items));
        document.setTitle("Memorando relacionado"); document.setNumber(406L);
        document.setCreateAt(Instant.parse("2026-11-16T12:00:00Z"));
        return documents.saveAndFlush(document);
    }
}
