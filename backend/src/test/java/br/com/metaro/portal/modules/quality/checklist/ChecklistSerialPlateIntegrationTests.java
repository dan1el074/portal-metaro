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
    void reallocatesOnlyAffectedBindingAndSendsOpenOrderToPcpWithAudit() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.BILLING);
        plate(900002, false); ChecklistRecordDto other = finish(records.createRecord(input("900002", false)));
        ChecklistStepBinding untouched = new ChecklistStepBinding(); untouched.setOrder(order);
        untouched.setFlow(flowRepository.findById(other.getFlowId()).orElseThrow()); untouched.setCreatedBy(actor); untouched.setCreatedAt(Instant.now()); bindings.saveAndFlush(untouched);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        assertThat(order.getCurrentStep()).isEqualTo(StepType.PCP); assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
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
    void openOrderInAssemblyAdvancesToPcpWithoutCancellingWhenItLosesLastEquipment() {
        SerialPlate plate = plate(900001, false); ChecklistRecordDto record = finish(records.createRecord(input("900001", false)));
        Order order = bind(record, OrderStatus.IN_PROGRESS, StepType.FINAL_ASSEMBLY);
        plates.updatePlates(relocation(plate, true)); entityManager.flush();
        assertThat(order.getCurrentStep()).isEqualTo(StepType.PCP);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
        assertThat(order.getSteps().getFirst().getStatus()).isEqualTo(StepStatus.DONE);
        assertThat(order.getSteps().get(1).getStatus()).isEqualTo(StepStatus.ACTIVE);
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
