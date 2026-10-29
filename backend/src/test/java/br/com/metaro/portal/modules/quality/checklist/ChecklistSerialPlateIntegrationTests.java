package br.com.metaro.portal.modules.quality.checklist;

import br.com.metaro.portal.core.entities.*;
import br.com.metaro.portal.core.repositories.*;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.integration.focco.FoccoPlateClient;
import br.com.metaro.portal.integration.focco.dto.FoccoPlateLineDto;
import br.com.metaro.portal.modules.pcp.serialplates.dto.*;
import br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlate;
import br.com.metaro.portal.modules.pcp.serialplates.repository.SerialPlateRepository;
import br.com.metaro.portal.modules.pcp.serialplates.service.SerialPlateService;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import br.com.metaro.portal.modules.quality.checklist.service.*;
import br.com.metaro.portal.modules.general.stepFlow.entities.*;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.util.erp.*;
import br.com.metaro.portal.util.erp.dto.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
@TestPropertySource(properties = {
    "external.datasource.jdbc-url=jdbc:h2:mem:checklist-serial-external",
    "external.datasource.driver-class-name=org.h2.Driver",
    "external.datasource.username=sa", "external.datasource.password="
})
class ChecklistSerialPlateIntegrationTests {
    @Autowired private ChecklistRecordService records;
    @Autowired private ChecklistSerialPlateService serials;
    @Autowired private ChecklistStepFlowService steps;
    @Autowired private SerialPlateService plates;
    @Autowired private SerialPlateRepository plateRepository;
    @Autowired private ChecklistFlowRepository flowRepository;
    @Autowired private ChecklistRecordRepository recordRepository;
    @Autowired private ChecklistCategoryRepository categories;
    @Autowired private ChecklistTemplateRepository templates;
    @Autowired private ChecklistStepBindingRepository bindings;
    @Autowired private OrderRepository orders;
    @Autowired private br.com.metaro.portal.modules.general.stepFlow.service.StepFlowService stepFlowService;
    @Autowired private UserRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private EntityManager entityManager;
    @MockBean private UserService userService;
    @MockBean private ErpOrderQueryService erp;
    @MockBean private FoccoPlateClient focco;
    private User actor;
    private ChecklistTemplate template;

    @BeforeEach
    void setup() {
        actor = users.findAll().getFirst();
        actor.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_CHECKLIST_ADMIN")).toList()));
        when(userService.authenticate()).thenReturn(actor);
        ChecklistCategory category = new ChecklistCategory();
        category.setName("Integração " + UUID.randomUUID()); category.setIntegration(ChecklistIntegration.PRODUCTION);
        category.setActive(true); category.setDocumentTitle("Produção"); category.setFieldsJson("[]");
        category.setSerialRequired(true); category.setErpRequired(true); category.setDepartments(false);
        category.setCreatedAt(Instant.now()); category.setUpdatedAt(Instant.now());
        categories.save(category);
        template = new ChecklistTemplate(); template.setName("Inspeção"); template.setCategory(category);
        template.setTitleExpression("Inspeção"); template.setSectionsJson("[]");
        template.setCreatedAt(Instant.now()); template.setUpdatedAt(Instant.now());
        templates.save(template);
        when(erp.findProductionOrderByNumber(900, ErpSource.FOCCO)).thenReturn(Optional.of(erpOrder(900, "Antigo")));
        when(erp.findProductionOrderByNumber(901, ErpSource.FOCCO)).thenReturn(Optional.of(erpOrder(901, "Novo")));
    }

    private ErpOrderDto erpOrder(int number, String client) {
        ErpOrderDto dto = new ErpOrderDto(number, client, "CNPJ-" + number, "", "Vendedor " + number, null, null, "", 0d, 0d, 0d);
        dto.addItem(new ErpOrderItemDto("MESA", "Mesa", 0d, "UN", 3, 0));
        return dto;
    }

    private SerialPlate plate(long serial, boolean pe) {
        SerialPlate plate = new SerialPlate(); plate.setSerial(serial); plate.setOf("OF-1");
        plate.setManufactured("2026-10"); plate.setUpdated(Instant.now()); plate.setDescription("Modelo A");
        plate.setReadyStock(pe);
        if (!pe) { plate.setOrder("900"); plate.setOrderItem("original"); plate.setClient("Antigo"); }
        return plateRepository.saveAndFlush(plate);
    }

    private ChecklistRecordCreateDto input(String serial, boolean pe) {
        ChecklistRecordCreateDto dto = new ChecklistRecordCreateDto(); dto.setTemplateId(template.getId());
        dto.setSerial(serial); dto.setReadyStock(pe);
        if (!pe) { dto.setOrder("900"); dto.setItem("MESA"); }
        return dto;
    }

    private ChecklistRecordDto finish(ChecklistRecordDto record) {
        return records.saveRecord(record.getId(), record, true);
    }

    @Test
    void filtersOnlyByOrderAndReservesSeriesUntilCancellation() {
        plate(900001, false); SerialPlate otherItem = plate(900002, false); otherItem.setOrderItem("different-item");
        plate(900003, true); SerialPlate incomplete = plate(900004, false); incomplete.setClient("");
        assertThat(serials.listAvailable("900", false)).extracting(ChecklistSerialOptionDto::getSerial).containsExactly("900001", "900002");
        assertThat(serials.listAvailable("", true)).extracting(ChecklistSerialOptionDto::getSerial).containsExactly("900003");
        ChecklistRecordDto record = records.createRecord(input("900001", false));
        assertThat(serials.listAvailable("900", false)).extracting(ChecklistSerialOptionDto::getSerial).doesNotContain("900001");
        ChecklistReasonDto reason = new ChecklistReasonDto(); reason.setReason("Cancelamento de teste");
        records.cancelFlow(record.getId(), reason);
        entityManager.flush();
        assertThat(serials.listAvailable("900", false)).extracting(ChecklistSerialOptionDto::getSerial).contains("900001");
        records.createRecord(input("900001", false));
    }

    @Test
    void deletingDraftReleasesSeries() throws Exception {
        plate(900001, true);
        ChecklistRecordDto record = records.createRecord(input("900001", true));
        records.deleteDraft(record.getId()); entityManager.flush();
        assertThat(serials.listAvailable("", true)).extracting(ChecklistSerialOptionDto::getSerial).contains("900001");
    }

    @Test
    void kitCanBeFinishedWithoutSeriesByChecklistAdministrator() {
        template.setName("KIT");
        ChecklistRecordDto record = records.createRecord(input(null, false));
        assertThat(finish(record).getStatus()).isEqualTo("FINISHED");
        assertThat(records.getFlow(record.getFlowId()).isSerialWaived()).isFalse();
    }

    @Test
    void checklistAdministratorCannotBypassSeriesWithConfirmationFlag() {
        ChecklistRecordCreateDto dto = input(null, true); dto.setConfirmWithoutSerial(true);
        assertThatThrownBy(() -> records.createRecord(dto)).hasMessageContaining("ROLE_ADMIN");
    }

    @Test
    void portalAdministratorMustExplicitlyConfirmWaiver() {
        actor.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_ADMIN")).toList()));
        assertThatThrownBy(() -> records.createRecord(input(null, true))).hasMessageContaining("ROLE_ADMIN");
    }

    @Test
    void confirmedWaiverSurvivesFinishingAndAppearsInStepCandidates() {
        actor.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_ADMIN")).toList()));
        ChecklistRecordCreateDto dto = input(null, false); dto.setConfirmWithoutSerial(true);
        ChecklistRecordDto record = records.createRecord(dto);
        assertThat(finish(record).getStatus()).isEqualTo("FINISHED");
        assertThat(records.getFlow(record.getFlowId()).isSerialWaived()).isTrue();
        assertThat(records.getRecord(record.getId()).getLogs()).anyMatch(log -> log.getAction().equals("SERIAL_WAIVED"));
        assertThat(steps.listAvailableEquipment("900")).anyMatch(equipment -> equipment.getFlowId().equals(record.getFlowId()) && equipment.getSerial() == null);
        steps.assertOrderCanStart("900");
    }

    @Test
    void justifiedChecklistHasBlankFormKeepsRevisionAndCanBeReopened() {
        template.setSectionsJson("[{\"id\":\"s\",\"name\":\"Inspeção\",\"options\":[\"OK\",\"NOK\"],\"questions\":[{\"id\":\"q\",\"label\":\"Conferir\",\"fields\":[{\"id\":\"extra\",\"label\":\"Campo\",\"type\":\"text\",\"defaultValue\":\"Padrão\",\"options\":[]}]}]}]");
        templates.saveAndFlush(template);
        ChecklistTemplate successor = new ChecklistTemplate(); successor.setName("Próximo"); successor.setCategory(template.getCategory());
        successor.setTitleExpression("Próximo"); successor.setSectionsJson("[]"); successor.setPredecessor(template);
        successor.setCreatedAt(Instant.now()); successor.setUpdatedAt(Instant.now()); templates.saveAndFlush(successor);
        plate(900001, true);
        ChecklistRecordDto record = records.createRecord(input("900001", true));
        var entity = recordRepository.findById(record.getId()).orElseThrow();
        entity.setAnswersJson("{\"q\":{\"value\":\"OK\",\"description\":\"Preenchido antes\",\"fields\":{\"extra\":\"Valor anterior\"},\"problems\":[]}}");
        entity.setDepartmentsJson("[\"PCP\"]"); recordRepository.saveAndFlush(entity);
        ChecklistReasonDto reason = new ChecklistReasonDto(); reason.setReason("Não se aplica");
        records.skipChecklist(record.getId(), reason);
        ChecklistRecordDto justified = records.getRecord(record.getId());
        assertThat(justified.getStatus()).isEqualTo("JUSTIFIED");
        assertThat(justified.getAnswers().get("q").getValue()).isNull();
        assertThat(justified.getAnswers().get("q").getFields()).containsEntry("extra", "");
        assertThat(justified.getAnswers().get("q").getProblems()).isEmpty();
        assertThat(justified.getDepartments()).isEmpty();
        assertThat(justified.getRevisions()).hasSize(1);
        assertThat(justified.getRevisions().getFirst().getRecord().toString()).contains("Valor anterior");
        assertThat(records.getFlow(record.getFlowId()).getSkipped()).containsEntry(template.getId().toString(), "Não se aplica");
        ChecklistRecord next = recordRepository.findByFlowIdAndTemplateId(record.getFlowId(), successor.getId()).orElseThrow();
        reason.setReason("Revisar a necessidade");
        ChecklistRecordDto reopened = records.reopenRecord(record.getId(), reason);
        assertThat(reopened.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(reopened.getAnswers().get("q").getFields()).containsEntry("extra", "");
        assertThat(records.getFlow(record.getFlowId()).getSkipped()).doesNotContainKey(template.getId().toString());
        assertThatThrownBy(() -> records.saveRecord(next.getId(), records.getRecord(next.getId()), true)).hasMessageContaining("checklist anterior");
        assertThat(reopened.getLogs()).anyMatch(log -> log.getAction().equals("REOPENED") && log.getDetails().contains("Revisar a necessidade"));
    }

    @Test
    void skippedLegacyDataIsHiddenAndRetainedInRevisionWhenReopening() {
        plate(900001, true); ChecklistRecordDto record = records.createRecord(input("900001", true));
        ChecklistRecord entity = recordRepository.findById(record.getId()).orElseThrow();
        entity.setStatus(ChecklistStatus.JUSTIFIED); entity.setFieldsJson("{\"old\":\"Valor legado\"}"); recordRepository.saveAndFlush(entity);
        assertThat(records.getRecord(record.getId()).getFields()).doesNotContainKey("old");
        ChecklistReasonDto reason = new ChecklistReasonDto(); reason.setReason("Reabrir legado");
        ChecklistRecordDto reopened = records.reopenRecord(record.getId(), reason);
        assertThat(reopened.getFields()).doesNotContainKey("old");
        assertThat(reopened.getRevisions().getFirst().getRecord().toString()).contains("Valor legado");
    }

    @Test
    void justifyingArchivesEvidenceAssociationsWhileKeepingRevisionMedia() {
        plate(900001, true); ChecklistRecordDto record = records.createRecord(input("900001", true));
        var picture = new br.com.metaro.portal.util.picture.Picture(); picture.setName("Antes"); entityManager.persist(picture);
        ChecklistEvidence evidence = new ChecklistEvidence(); evidence.setRecord(recordRepository.findById(record.getId()).orElseThrow());
        evidence.setProblemId(ChecklistEvidenceService.GENERAL_EVIDENCE_ID); evidence.setPicture(picture);
        evidence.setOriginalName("Antes.png"); evidence.setContentType("image/png"); evidence.setCreatedBy(actor); evidence.setCreatedAt(Instant.now());
        entityManager.persist(evidence); entityManager.flush();
        assertThat(records.getRecord(record.getId()).getMedia()).hasSize(1);
        ChecklistReasonDto reason = new ChecklistReasonDto(); reason.setReason("Dispensa de inspeção"); records.skipChecklist(record.getId(), reason);
        ChecklistRecordDto justified = records.getRecord(record.getId());
        assertThat(justified.getMedia()).isEmpty();
        assertThat(justified.getRevisions().getFirst().getRecord().toString()).contains("Antes.png");
        assertThat(entityManager.find(br.com.metaro.portal.util.picture.Picture.class, picture.getId())).isNotNull();
        reason.setReason("Nova inspeção");
        assertThat(records.reopenRecord(record.getId(), reason).getMedia()).isEmpty();
    }

    @Test
    void pcpOrderChangesAreAuditedInEveryExistingChecklistOfTheFlow() {
        ChecklistTemplate successor = new ChecklistTemplate(); successor.setName("Inspeção seguinte"); successor.setCategory(template.getCategory());
        successor.setTitleExpression("Seguinte"); successor.setSectionsJson("[]"); successor.setPredecessor(template); successor.setAutomatic(true);
        successor.setCreatedAt(Instant.now()); successor.setUpdatedAt(Instant.now()); templates.saveAndFlush(successor);
        SerialPlate plate = plate(900001, false); ChecklistRecordDto root = finish(records.createRecord(input("900001", false)));
        assertThat(recordRepository.findByFlowId(root.getFlowId())).hasSize(2);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        for (ChecklistRecord record : recordRepository.findByFlowId(root.getFlowId())) {
            assertThat(records.getRecord(record.getId()).getLogs()).anyMatch(log -> log.getAction().equals("SERIAL_PLATE_UPDATED")
                    && log.getDetails().contains("900 → 901") && log.getDetails().contains("PCP"));
        }
    }

    @Test
    void historicalStepFlowLinksRemainAfterRelocationAndRebinding() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order previous = bind(record, OrderStatus.COMPLETED, StepType.SHIPPING);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        var history = steps.listLinkedStepFlows(record.getFlowId());
        assertThat(history).hasSize(1); assertThat(history.getFirst().getId()).isEqualTo(previous.getId());
        assertThat(history.getFirst().isLinked()).isFalse();
        Order current = emptyOrder(); current.setNumber(901); orders.saveAndFlush(current);
        steps.createBindings(current, List.of(record.getFlowId()));
        history = steps.listLinkedStepFlows(record.getFlowId());
        assertThat(history).hasSize(2);
        assertThat(history).anyMatch(item -> item.getId().equals(previous.getId()) && !item.isLinked());
        assertThat(history).anyMatch(item -> item.getId().equals(current.getId()) && item.isLinked());
        ChecklistStepBindingDto selection = new ChecklistStepBindingDto(); selection.setFlowIds(List.of());
        steps.replaceBindings(current.getId(), selection);
        assertThat(steps.listLinkedStepFlows(record.getFlowId())).hasSize(2).allMatch(item -> !item.isLinked());
        assertThat(bindings.findByFlowId(record.getFlowId())).isEmpty();
    }

    @Test
    void rejectsSeriesFromAnotherModeOrAlreadyReserved() {
        plate(900001, true);
        assertThatThrownBy(() -> records.createRecord(input("900001", false))).hasMessageContaining("não está disponível");
    }

    @Test
    void rejectsReusingSeriesInIndependentChecklist() {
        plate(900001, true); records.createRecord(input("900001", true));
        assertThatThrownBy(() -> records.createRecord(input("900001", true))).hasMessageContaining("outro fluxo");
    }

    private Order bind(ChecklistRecordDto record, OrderStatus status, StepType current) {
        Order order = new Order(); order.setNumber(900); order.setStatus(status); order.setCurrentStep(current);
        order.setSteps(new ArrayList<>()); order.setItems(new ArrayList<>()); order.setVolumes(new ArrayList<>());
        for (StepType type : StepType.values()) {
            OrderStep step = new OrderStep(); step.setStep(type);
            step.setStatus(status == OrderStatus.COMPLETED || type.ordinal() < current.ordinal() ? StepStatus.DONE : type == current ? StepStatus.ACTIVE : StepStatus.WAITING);
            order.addStep(step);
        }
        OrderItem item = new OrderItem(); item.setItemCode("MESA"); item.setDescription("Mesa"); item.setQuantity(3); item.setProducedQuantity(2);
        order.addItem(item);
        orders.saveAndFlush(order);
        ChecklistStepBinding binding = new ChecklistStepBinding(); binding.setOrder(order);
        binding.setFlow(flowRepository.findById(record.getFlowId()).orElseThrow()); binding.setCreatedBy(actor); binding.setCreatedAt(Instant.now());
        bindings.saveAndFlush(binding);
        return order;
    }

    private SerialPlateMutationDto relocation(SerialPlate plate, boolean confirm) {
        FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setOrderNumber(901L); line.setClient("Novo");
        line.setDescription("Mesa"); line.setModel("Modelo B"); line.setVoltage("380V");
        when(focco.findPlateOrder(901L)).thenReturn(List.of(line));
        SerialPlatePatchDto patch = new SerialPlatePatchDto(); patch.setOrder("901");
        SerialPlateMutationDto dto = new SerialPlateMutationDto(); dto.setPatch(patch);
        dto.setVersions(Map.of(plate.getSerial().toString(), plate.getVersion())); dto.setFields(List.of("order", "orderItem"));
        dto.setConfirmRelocation(confirm);
        // Match the public ERP item fingerprint, exactly as the browser does.
        patch.setOrderItem(new br.com.metaro.portal.modules.pcp.serialplates.service.SerialPlateErpService(focco).findOrder("901").getItems().getFirst().getId());
        return dto;
    }

    @Test
    void reallocationRequiresConfirmationOnServer() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        bind(record, OrderStatus.IN_PROGRESS, StepType.BILLING);
        SerialPlateMutationDto dto = relocation(plate, false);
        assertThat(plates.previewRelocation(dto)).hasSize(1);
        assertThatThrownBy(() -> plates.updatePlates(dto)).hasMessageContaining("Confirme a realocação");
    }

    @Test
    void reallocatesOnlyAffectedBindingAndPreservesOrderStageAndQuantitiesWithAudit() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.BILLING);
        plate(900002, false); ChecklistRecordDto other = finish(records.createRecord(input("900002", false)));
        ChecklistStepBinding untouched = new ChecklistStepBinding(); untouched.setOrder(order);
        untouched.setFlow(flowRepository.findById(other.getFlowId()).orElseThrow()); untouched.setCreatedBy(actor); untouched.setCreatedAt(Instant.now()); bindings.saveAndFlush(untouched);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        assertThat(order.getCurrentStep()).isEqualTo(StepType.BILLING); assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
        assertThat(order.getItems().getFirst().getProducedQuantity()).isEqualTo(2);
        assertThat(order.getSteps().stream().filter(step -> step.getStep() == StepType.PCP).findFirst().orElseThrow().getStatus()).isEqualTo(StepStatus.DONE);
        assertThat(bindings.findByOrderId(order.getId())).extracting(binding -> binding.getFlow().getId()).containsExactly(other.getFlowId());
        assertThat(order.getSteps().stream().filter(step -> step.getStep() == StepType.BILLING).findFirst().orElseThrow().getMessages())
                .anyMatch(message -> message.getMessage().contains("900001") && message.getMessage().contains("901") && message.getMessage().contains("PCP"));
        ChecklistFlowDto updated = records.getFlow(record.getFlowId());
        assertThat(updated.getOrder()).isEqualTo("901"); assertThat(updated.getClient()).isEqualTo("Novo");
        assertThat(updated.getClientId()).isEqualTo("CNPJ-901"); assertThat(updated.getItem()).isEqualTo("MESA - Mesa");
        assertThat(updated.getErpData()).containsEntry("Modelo", "Modelo B").containsEntry("Voltagem", "380V");
        assertThat(records.getRecord(record.getId()).getLogs()).anyMatch(log -> log.getAction().equals("SERIAL_PLATE_UPDATED") && log.getDetails().contains("900 → 901"));
        assertThat(steps.listAvailableEquipment("901")).extracting(ChecklistStepEquipmentDto::getFlowId).contains(record.getFlowId());
    }

    @Test
    void changingOnlyItemKeepsExistingStepAndBinding() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.FREIGHT);
        SerialPlateMutationDto dto = relocation(plate, false);
        FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setOrderNumber(900L); line.setClient("Antigo");
        line.setDescription("Mesa"); line.setModel("Modelo B"); line.setVoltage("380V");
        when(focco.findPlateOrder(900L)).thenReturn(List.of(line)); dto.getPatch().setOrder("900");
        assertThat(plates.previewRelocation(dto)).isEmpty();
        plates.updatePlates(dto); entityManager.flush();
        assertThat(order.getCurrentStep()).isEqualTo(StepType.FREIGHT);
        assertThat(bindings.findByOrderId(order.getId())).hasSize(1);
        assertThat(order.getSteps()).allMatch(step -> step.getMessages().isEmpty());
        assertThat(records.getFlow(record.getFlowId()).getErpData()).containsEntry("Modelo", "Modelo B");
    }

    @Test
    void sellingReadyStockUpdatesChecklistAndMakesItAvailableForNewOrder() {
        SerialPlate plate = plate(900001, true); ChecklistRecordDto record = finish(records.createRecord(input("900001", true)));
        SerialPlateMutationDto dto = relocation(plate, false);
        assertThat(plates.previewRelocation(dto)).isEmpty(); plates.updatePlates(dto); entityManager.flush();
        ChecklistFlowDto flow = records.getFlow(record.getFlowId());
        assertThat(flow.isReadyStock()).isFalse(); assertThat(flow.getOrder()).isEqualTo("901");
        assertThat(flow.getClient()).isEqualTo("Novo"); assertThat(flow.getSerial()).isEqualTo("900001");
        assertThat(steps.listAvailableEquipment("901")).hasSize(1);
    }

    @Test
    void openOrderInAssemblyKeepsStageAndQuantitiesWhenItLosesLastEquipment() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.FINAL_ASSEMBLY);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        assertThat(order.getCurrentStep()).isEqualTo(StepType.FINAL_ASSEMBLY);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
        assertThat(order.getSteps().getFirst().getStatus()).isEqualTo(StepStatus.ACTIVE);
        assertThat(order.getSteps().get(1).getStatus()).isEqualTo(StepStatus.WAITING);
        assertThat(order.getItems().getFirst().getProducedQuantity()).isEqualTo(2);
        assertThat(bindings.findByOrderId(order.getId())).isEmpty();
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void simultaneousCreationsReserveSeriesExactlyOnce() throws Exception {
        plate(900010, true);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        List<Long> created = new ArrayList<>();
        try {
            java.util.concurrent.Callable<ChecklistRecordDto> task = () -> { start.await(); return records.createRecord(input("900010", true)); };
            var first = executor.submit(task); var second = executor.submit(task); start.countDown();
            int conflicts = 0;
            for (var future : List.of(first, second)) {
                try { created.add(future.get(20, java.util.concurrent.TimeUnit.SECONDS).getId()); }
                catch (java.util.concurrent.ExecutionException exception) {
                    assertThat(exception.getCause().getMessage()).contains("outro fluxo"); conflicts++;
                }
            }
            assertThat(created).hasSize(1); assertThat(conflicts).isEqualTo(1);
            assertThat(serials.listAvailable("", true)).extracting(ChecklistSerialOptionDto::getSerial).doesNotContain("900010");
        } finally {
            executor.shutdownNow();
            for (Long id : created) records.deleteDraft(id);
            plateRepository.deleteById(900010L);
            templates.deleteById(template.getId()); categories.deleteById(template.getCategory().getId());
        }
    }

    @Test
    void successorsInheritSameSeriesWithoutReservingItAgain() {
        ChecklistTemplate successor = new ChecklistTemplate(); successor.setCategory(template.getCategory()); successor.setName("Revisão");
        successor.setTitleExpression("Revisão"); successor.setSectionsJson("[]"); successor.setPredecessor(template);
        successor.setCreatedAt(Instant.now()); successor.setUpdatedAt(Instant.now()); templates.save(successor);
        plate(900001, true); ChecklistRecordDto previous = finish(records.createRecord(input("900001", true)));
        ChecklistRecordCreateDto dto = new ChecklistRecordCreateDto(); dto.setTemplateId(successor.getId()); dto.setPredecessorRecordId(previous.getId());
        ChecklistRecordDto next = records.createRecord(dto);
        assertThat(next.getFlowId()).isEqualTo(previous.getFlowId());
        assertThat(records.getFlow(next.getFlowId()).getSerialPlateId()).isEqualTo(900001L);
        assertThat(serials.listAvailable("", true)).isEmpty();
    }

    private Order emptyOrder() {
        Order order = new Order(); order.setNumber(900); order.setOccurrence(Math.toIntExact(orders.countByNumber(900) + 1)); order.setStatus(OrderStatus.IN_PROGRESS); order.setCurrentStep(StepType.FINAL_ASSEMBLY);
        order.setSteps(new ArrayList<>()); order.setItems(new ArrayList<>()); order.setVolumes(new ArrayList<>());
        OrderItem item = new OrderItem(); item.setItemCode("MESA"); item.setDescription("Mesa"); item.setQuantity(3); item.setProducedQuantity(2);
        order.addItem(item);
        return orders.saveAndFlush(order);
    }

    @Test
    void manualQuantitiesAreIndependentOfSelectedChecklistCount() {
        plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        ErpOrderDto dto = erpOrder(900, "Antigo"); dto.getItems().getFirst().addProducedQuantity(2);
        dto.getChecklistFlowIds().add(record.getFlowId()); stepFlowService.create(dto);
        Order created = bindings.findByFlowId(record.getFlowId()).getFirst().getOrder();
        assertThat(created.getItems().getFirst().getProducedQuantity()).isEqualTo(2);
        assertThat(bindings.findByOrderId(created.getId())).hasSize(1);
    }

    @Test
    void createsQuantityOnlyOrderWithoutChecklistsAndCanPassConfiguredRequirements() {
        ErpOrderDto dto = erpOrder(900, "Antigo"); dto.getItems().getFirst().addProducedQuantity(2);
        stepFlowService.create(dto); entityManager.flush();
        Order created = orders.findAll().stream().filter(order -> order.getNumber() == 900).findFirst().orElseThrow();
        assertThat(created.getItems().getFirst().getProducedQuantity()).isEqualTo(2);
        assertThat(bindings.findByOrderId(created.getId())).isEmpty();
        ChecklistStepRequirementDto requirement = new ChecklistStepRequirementDto();
        requirement.setStepType("PCP"); requirement.setCategoryId(template.getCategory().getId()); steps.saveRequirement(requirement);
        assertThat(steps.isStepRequirementSatisfied(created.getId(), StepType.PCP)).isTrue();
        steps.assertStepCanFinish(created.getId(), StepType.PCP);
    }

    @Test
    void removingBindingMakesChecklistAvailableWithoutChangingQuantities() {
        plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order original = bind(record, OrderStatus.IN_PROGRESS, StepType.FINAL_ASSEMBLY);
        ChecklistStepBindingDto empty = new ChecklistStepBindingDto(); steps.replaceBindings(original.getId(), empty); entityManager.flush();
        Order target = emptyOrder(); steps.createBindings(target, List.of(record.getFlowId())); entityManager.flush();
        assertThat(bindings.findByOrderId(original.getId())).isEmpty();
        assertThat(bindings.findByOrderId(target.getId())).hasSize(1);
        assertThat(original.getItems().getFirst().getProducedQuantity()).isEqualTo(2);
    }

    @Test
    void cancelledOrderReleasesBindingForAnotherOrder() {
        plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        bind(record, OrderStatus.CANCELLED, StepType.PCP);
        Order target = emptyOrder(); steps.createBindings(target, List.of(record.getFlowId())); entityManager.flush();
        assertThat(bindings.findByOrderId(target.getId())).hasSize(1);
    }

    @Test
    void completedOrderStillReservesChecklistUntilBindingIsRemoved() {
        plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        bind(record, OrderStatus.COMPLETED, StepType.SHIPPING);
        Order target = emptyOrder();
        assertThatThrownBy(() -> steps.createBindings(target, List.of(record.getFlowId()))).hasMessageContaining("outro Fluxo de etapas");
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void simultaneousBindingsToDifferentOrdersHaveOnlyOneWinner() throws Exception {
        plate(900011, false); ChecklistRecordDto record = finish(records.createRecord(input("900011", false)));
        Order firstOrder = emptyOrder(); Order secondOrder = emptyOrder();
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            java.util.concurrent.Callable<Boolean> first = () -> { start.await(); steps.createBindings(firstOrder, List.of(record.getFlowId())); return true; };
            java.util.concurrent.Callable<Boolean> second = () -> { start.await(); steps.createBindings(secondOrder, List.of(record.getFlowId())); return true; };
            var firstResult = executor.submit(first); var secondResult = executor.submit(second); start.countDown();
            int winners = 0; int conflicts = 0;
            for (var result : List.of(firstResult, secondResult)) {
                try { if (result.get(20, java.util.concurrent.TimeUnit.SECONDS)) winners++; }
                catch (java.util.concurrent.ExecutionException exception) {
                    assertThat(exception.getCause().getMessage()).contains("outro Fluxo de etapas"); conflicts++;
                }
            }
            assertThat(winners).isEqualTo(1); assertThat(conflicts).isEqualTo(1);
            assertThat(bindings.findByFlowId(record.getFlowId())).hasSize(1);
        } finally {
            executor.shutdownNow();
            bindings.deleteAll(bindings.findByFlowId(record.getFlowId()));
            orders.deleteById(firstOrder.getId()); orders.deleteById(secondOrder.getId());
            recordRepository.deleteById(record.getId()); flowRepository.deleteById(record.getFlowId());
            plateRepository.deleteById(900011L); templates.deleteById(template.getId()); categories.deleteById(template.getCategory().getId());
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void quantitiesAndChecklistChangesSaveTogetherAndInvalidCapacityRollsBackEverything() throws Exception {
        actor.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_ADMIN")).toList()));
        List<ChecklistRecordDto> created = new ArrayList<>();
        Order order = null;
        try {
            for (long serial = 900020; serial < 900023; serial++) {
                plate(serial, false); created.add(finish(records.createRecord(input(Long.toString(serial), false))));
            }
            order = bind(created.getFirst(), OrderStatus.IN_PROGRESS, StepType.FINAL_ASSEMBLY);
            var invalid = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto();
            var item = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderItemInputDto();
            item.setId(order.getItems().getFirst().getId()); item.setProducedQuantity(1);
            invalid.setItems(List.of(item)); invalid.setComment("Não deve ser salvo");
            invalid.setChecklistFlowIds(List.of(created.get(0).getFlowId(), created.get(1).getFlowId()));
            Long orderId = order.getId();
            assertThatThrownBy(() -> stepFlowService.update(orderId, invalid)).hasMessageContaining("quantidade de itens a produzir");
            assertThat(stepFlowService.findById(orderId).getItems().getFirst().getProducedQuantity()).isEqualTo(2);
            assertThat(stepFlowService.findById(orderId).getSteps().getFirst().getMessages()).isEmpty();
            assertThat(bindings.countByOrderId(orderId)).isEqualTo(1);
            var valid = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto();
            item.setProducedQuantity(3); valid.setItems(List.of(item));
            valid.setChecklistFlowIds(created.stream().map(ChecklistRecordDto::getFlowId).toList());
            stepFlowService.update(orderId, valid);
            assertThat(stepFlowService.findById(orderId).getItems().getFirst().getProducedQuantity()).isEqualTo(3);
            assertThat(bindings.countByOrderId(orderId)).isEqualTo(3);
        } finally {
            if (order != null) {
                bindings.deleteAll(bindings.findByOrderId(order.getId())); orders.deleteById(order.getId());
            }
            for (ChecklistRecordDto record : created) {
                recordRepository.deleteById(record.getId()); flowRepository.deleteById(record.getFlowId());
            }
            for (long serial = 900020; serial < 900023; serial++) plateRepository.deleteById(serial);
            templates.deleteById(template.getId()); categories.deleteById(template.getCategory().getId());
        }
    }

    @Test
    void administratorCanSaveBindingsAndAdvanceFromFinalAssemblyAtomically() throws Exception {
        actor.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_ADMIN")).toList()));
        plate(900020, false); ChecklistRecordDto record = finish(records.createRecord(input("900020", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.FINAL_ASSEMBLY);
        plate(900021, false); ChecklistRecordDto other = finish(records.createRecord(input("900021", false)));
        var update = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto();
        update.setChecklistFlowIds(List.of(record.getFlowId(), other.getFlowId())); update.setNewStepId(StepType.PCP.ordinal());
        stepFlowService.update(order.getId(), update);
        assertThat(order.getCurrentStep()).isEqualTo(StepType.PCP);
        assertThat(bindings.findByOrderId(order.getId())).extracting(binding -> binding.getFlow().getId()).containsExactlyInAnyOrder(record.getFlowId(), other.getFlowId());
    }

    @Test
    void checklistBindingsCanOnlyBeManagedDuringFinalAssembly() {
        plate(900020, false); ChecklistRecordDto record = finish(records.createRecord(input("900020", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.PCP);
        for (StepType stage : List.of(StepType.PCP, StepType.FREIGHT, StepType.BILLING, StepType.SHIPPING)) {
            order.setCurrentStep(stage); orders.saveAndFlush(order);
            ChecklistStepBindingDto remove = new ChecklistStepBindingDto(); remove.setFlowIds(List.of());
            assertThatThrownBy(() -> steps.replaceBindings(order.getId(), remove)).hasMessageContaining("Montagem Final");
            var update = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto();
            update.setChecklistFlowIds(List.of()); update.setNewStepId(StepType.FINAL_ASSEMBLY.ordinal());
            assertThatThrownBy(() -> stepFlowService.update(order.getId(), update)).hasMessageContaining("Montagem Final");
            assertThat(order.getCurrentStep()).isEqualTo(stage);
            assertThat(bindings.findByOrderId(order.getId())).hasSize(1);
        }
    }

    @Test
    void replacingBindingsCannotExceedConfiguredProductionQuantity() {
        List<Long> ids = new ArrayList<>();
        for (long serial = 900020; serial < 900023; serial++) {
            plate(serial, false); ids.add(finish(records.createRecord(input(Long.toString(serial), false))).getFlowId());
        }
        Order target = emptyOrder(); ChecklistStepBindingDto dto = new ChecklistStepBindingDto(); dto.setFlowIds(ids);
        assertThatThrownBy(() -> steps.replaceBindings(target.getId(), dto)).hasMessageContaining("quantidade de itens a produzir");
    }

    @Test
    void quantityReductionCannotLeaveMoreExistingBindingsThanProducedItems() {
        actor.setRoles(new HashSet<>(roles.findAll().stream().filter(role -> role.getAuthority().equals("ROLE_ADMIN")).toList()));
        plate(900020, false); ChecklistRecordDto first = finish(records.createRecord(input("900020", false)));
        plate(900021, false); ChecklistRecordDto second = finish(records.createRecord(input("900021", false)));
        Order target = bind(first, OrderStatus.IN_PROGRESS, StepType.FINAL_ASSEMBLY);
        ChecklistStepBindingDto selection = new ChecklistStepBindingDto(); selection.setFlowIds(List.of(first.getFlowId(), second.getFlowId()));
        steps.replaceBindings(target.getId(), selection);
        var dto = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto();
        var item = new br.com.metaro.portal.modules.general.stepFlow.dto.OrderItemInputDto(); item.setId(target.getItems().getFirst().getId()); item.setProducedQuantity(1);
        dto.setItems(List.of(item));
        assertThatThrownBy(() -> stepFlowService.update(target.getId(), dto)).hasMessageContaining("quantidade de itens a produzir");
    }

    @Test
    void creatingBindingsCannotExceedManualProductionQuantity() {
        List<Long> ids = new ArrayList<>();
        for (long serial = 900020; serial < 900023; serial++) {
            plate(serial, false); ids.add(finish(records.createRecord(input(Long.toString(serial), false))).getFlowId());
        }
        Order target = emptyOrder();
        assertThatThrownBy(() -> steps.createBindings(target, ids)).hasMessageContaining("quantidade de itens a produzir");
    }

    @Test
    void ambiguousCommercialCodesDoNotPreventRelocatingSelectedPlateItem() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        bind(record, OrderStatus.IN_PROGRESS, StepType.FREIGHT);
        ErpOrderDto order = erpOrder(901, "Novo"); order.addItem(new ErpOrderItemDto("OUTRA", "Mesa", 0d, "UN", 2, 0));
        when(erp.findProductionOrderByNumber(901, ErpSource.FOCCO)).thenReturn(Optional.of(order));
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        assertThat(records.getFlow(record.getFlowId()).getItem()).isEqualTo(new br.com.metaro.portal.modules.pcp.serialplates.service.SerialPlateErpService(focco).findOrder("901").getItems().getFirst().getLabel());
        assertThat(bindings.findByFlowId(record.getFlowId())).isEmpty();
    }

    @Test
    void completedOrderKeepsStatusAndReceivesMessageOnLastStep() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order order = bind(record, OrderStatus.COMPLETED, StepType.SHIPPING);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.COMPLETED); assertThat(order.getCurrentStep()).isEqualTo(StepType.SHIPPING);
        assertThat(order.getSteps()).allMatch(step -> step.getStatus() == StepStatus.DONE);
        assertThat(order.getSteps().getLast().getMessages()).hasSize(1);
        assertThat(bindings.findByOrderId(order.getId())).isEmpty();
    }
}
