package br.com.metaro.portal.modules.pcp.serialplates;

import br.com.metaro.portal.core.entities.*;
import br.com.metaro.portal.core.repositories.*;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.integration.focco.FoccoPlateClient;
import br.com.metaro.portal.integration.focco.dto.FoccoPlateLineDto;
import br.com.metaro.portal.modules.pcp.serialplates.dto.*;
import br.com.metaro.portal.modules.pcp.serialplates.repository.*;
import br.com.metaro.portal.modules.pcp.serialplates.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "external.datasource.jdbc-url=jdbc:h2:mem:serial-plates-external",
    "external.datasource.driver-class-name=org.h2.Driver",
    "external.datasource.username=sa", "external.datasource.password="
})
class SerialPlateIntegrationTests {
    @Autowired private SerialPlateService service;
    @Autowired private SerialPlateErpService erp;
    @Autowired private SerialPlateRepository repository;
    @Autowired private SerialPlateLogRepository logs;
    @Autowired private ParamRepository params;
    @Autowired private UserRepository users;
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @MockBean private UserService userService;
    @MockBean private FoccoPlateClient focco;

    @BeforeEach
    void resetData() {
        logs.deleteAll();
        repository.deleteAll();
        Param sequence = params.findByName("serialPlatesCount").orElseThrow();
        sequence.setContent("18917"); params.saveAndFlush(sequence);
        when(userService.authenticate()).thenReturn(users.findAll().getFirst());
    }

    private SerialPlateCreateDto draft(int quantity) {
        SerialPlateCreateDto dto = new SerialPlateCreateDto();
        dto.setQuantity(BigDecimal.valueOf(quantity)); dto.setOf("8301"); return dto;
    }

    private List<SerialPlateDto> createAndRead(SerialPlateCreateDto input) {
        int count = service.createPlates(input);
        long last = repository.findMaximumSerial();
        return java.util.stream.LongStream.rangeClosed(last - count + 1, last).mapToObj(service::getPlate).toList();
    }

    @Test
    void createsAndUpdatesTheSelectedConfigurationOfTheSameItemCode() throws Exception {
        FoccoPlateLineDto first = mapper.readValue("""
                {"order_number":900,"client":"Cliente","item_code":"60289","description":"Equipamento",
                 "model":"Modelo A","capacity":"6 TON","voltage":"220V","weight":"300 KG"}
                """, FoccoPlateLineDto.class);
        FoccoPlateLineDto second = mapper.readValue("""
                {"order_number":900,"client":"Cliente","item_code":"60289","description":"Equipamento",
                 "model":"Modelo B","capacity":"8 TON","voltage":"380V","weight":"500 KG"}
                """, FoccoPlateLineDto.class);
        when(focco.findPlateOrder(900)).thenReturn(List.of(first, second, first));
        var items = erp.findOrder("900").getItems();
        assertThat(items).hasSize(2);
        assertThat(items.get(0).getSelectionKey()).isNotEqualTo(items.get(1).getSelectionKey());
        var input = draft(1); input.setOrder("900"); input.setOrderItemCode("60289");
        assertThatThrownBy(() -> service.createPlates(input)).hasMessageContaining("Selecione a configuração");
        input.setOrderItemKey(items.get(1).getSelectionKey());
        when(focco.findPlateOrder(900)).thenReturn(List.of(second, first));
        var created = createAndRead(input);
        assertThat(created.getFirst().getOrderItemCode()).isEqualTo("60289");
        assertThat(created.getFirst().getDescription()).isEqualTo("Modelo B");
        assertThat(created.getFirst().getCapacity()).isEqualByComparingTo("8");
        assertThat(created.getFirst().getVoltage()).isEqualTo("380V");
        assertThat(created.getFirst().getWeight()).isEqualByComparingTo("500");
        var patch = new SerialPlatePatchDto(); patch.setOrder("900"); patch.setOrderItemCode("60289");
        patch.setOrderItemKey(items.getFirst().getSelectionKey());
        var updated = service.updatePlates(mutation(created, patch, "order", "orderItemCode"));
        assertThat(updated.getFirst().getDescription()).isEqualTo("Modelo A");
        assertThat(updated.getFirst().getVoltage()).isEqualTo("220V");
        patch.setOrderItemKey(UUID.randomUUID().toString());
        assertThatThrownBy(() -> service.updatePlates(mutation(updated, patch, "order", "orderItemCode")))
                .hasMessageContaining("Consulte o ERP novamente");
    }

    @Test
    void consumesThePublishedItemCodeAndPersistsItOnNewSeries() throws Exception {
        FoccoPlateLineDto line = mapper.readValue("""
                {"order_number":900,"client":"Cliente","item_code":"60289",
                 "description":"PA NIVELADORA DE DOCA AVANCADA (NDA)","model":"NDA MG 202020 FIX B"}
                """, FoccoPlateLineDto.class);
        when(focco.findPlateOrder(900)).thenReturn(List.of(line));
        var item = erp.findOrder("900").getItems().getFirst();
        assertThat(item.getItemCode()).isEqualTo("60289");
        var input = draft(5); input.setOrder("900"); input.setOrderItemCode(item.getItemCode());
        var created = createAndRead(input);
        assertThat(created).hasSize(5);
        assertThat(repository.findAll()).allSatisfy(plate -> assertThat(plate.getOrderItemCode()).isEqualTo("60289"));
    }

    @Test
    void keepsIdenticalEquipmentSnapshotsFromDifferentItemCodesDistinctAndStable() {
        FoccoPlateLineDto first = new FoccoPlateLineDto(); first.setItemCode("MESA"); first.setOrderNumber(900L); first.setClient("Cliente");
        first.setDescription("Equipamento"); first.setModel("Modelo"); first.setItemCode("60289");
        FoccoPlateLineDto second = new FoccoPlateLineDto(); second.setItemCode("MESA"); second.setOrderNumber(900L); second.setClient("Cliente");
        second.setDescription("Equipamento"); second.setModel("Modelo"); second.setItemCode("60310");
        when(focco.findPlateOrder(900)).thenReturn(List.of(first, second));
        var items = erp.findOrder("900").getItems();
        assertThat(items).hasSize(2); assertThat(items.getFirst().getItemCode()).isNotEqualTo(items.get(1).getItemCode());
        when(focco.findPlateOrder(900)).thenReturn(List.of(second, first));
        var reordered = erp.findOrder("900").getItems();
        assertThat(reordered.getFirst().getItemCode()).isEqualTo(items.get(1).getItemCode());
        var input = draft(1); input.setOrder("900"); input.setOrderItemCode(reordered.getFirst().getItemCode());
        createAndRead(input);
        assertThat(repository.findAll().getFirst().getOrderItemCode()).isEqualTo("60310");
    }

    @Test
    void requiresAnExplicitItemWhenCreatingPlatesWithAnOrder() {
        var input = draft(1); input.setOrder("900");
        assertThatThrownBy(() -> createAndRead(input)).hasMessageContaining("Selecione um item do pedido");
        input.setOrder(" ");
        assertThat(createAndRead(input)).hasSize(1);
    }

    @Test
    void onlyPortalAdministratorCanCreateWithoutOfAndOperatorsCanLaterUpdateThosePlates() {
        User admin = users.findAll().getFirst();
        Role adminRole = new Role(); adminRole.setId(-1L); adminRole.setAuthority("ROLE_ADMIN");
        admin.setRoles(new HashSet<>(Set.of(adminRole)));
        when(userService.authenticate()).thenReturn(admin);
        SerialPlateCreateDto input = draft(1); input.setOf("   ");
        List<SerialPlateDto> created = createAndRead(input);
        assertThat(created.getFirst().getOf()).isEmpty();

        User operator = new User(); operator.setId(admin.getId()); operator.setName(admin.getName());
        Role checklistAdmin = new Role(); checklistAdmin.setId(-2L); checklistAdmin.setAuthority("ROLE_CHECKLIST_ADMIN");
        operator.setRoles(new HashSet<>(Set.of(checklistAdmin)));
        when(userService.authenticate()).thenReturn(operator);
        assertThatThrownBy(() -> createAndRead(input)).hasMessageContaining("Somente ROLE_ADMIN");
        assertThat(repository.count()).isEqualTo(1);
        SerialPlatePatchDto patch = new SerialPlatePatchDto(); patch.setNotes("Atualizado");
        List<SerialPlateDto> updated = service.updatePlates(mutation(created, patch, "notes"));
        assertThat(updated.getFirst().getOf()).isEmpty();
        patch.setOf("1234");
        List<SerialPlateDto> linked = service.updatePlates(mutation(updated, patch, "of"));
        patch.setOf("");
        assertThatThrownBy(() -> service.updatePlates(mutation(linked, patch, "of"))).hasMessageContaining("ordem de fabricação");
    }

    private SerialPlateMutationDto mutation(List<SerialPlateDto> rows, SerialPlatePatchDto patch, String... fields) {
        SerialPlateMutationDto dto = new SerialPlateMutationDto();
        dto.setPatch(patch); dto.setFields(List.of(fields));
        Map<String, Long> versions = new LinkedHashMap<>();
        rows.forEach(row -> versions.put(row.getSerial(), row.getVersion()));
        dto.setVersions(versions); return dto;
    }

    @Test
    void normalizesOptionalLotAndAuditsItWithoutConsultingErp() {
        var rows = createAndRead(draft(1));
        var patch = new SerialPlatePatchDto();
        for (String value : List.of("2", "6", "12", "0002", "0")) {
            patch.setLot(value);
            rows = service.updatePlates(mutation(rows, patch, "lot"));
            assertThat(rows.getFirst().getLot()).isEqualTo(switch (value) {
                case "6" -> "06";
                case "12" -> "12";
                case "0" -> "00";
                default -> "02";
            });
            assertThat(service.getPlate(18918L).getLot()).isEqualTo(rows.getFirst().getLot());
        }
        assertThat(service.getHistory(18918L).getFirst().getChanges())
                .anySatisfy(change -> {
                    assertThat(change.getField()).isEqualTo("Lote");
                    assertThat(change.getAfter()).isEqualTo("00");
                });
        patch.setLot("2.5");
        var current = rows;
        assertThatThrownBy(() -> service.updatePlates(mutation(current, patch, "lot"))).hasMessageContaining("Lote");
        patch.setLot("-1");
        assertThatThrownBy(() -> service.updatePlates(mutation(current, patch, "lot"))).hasMessageContaining("Lote");
        patch.setLot("");
        assertThat(service.updatePlates(mutation(rows, patch, "lot")).getFirst().getLot()).isEmpty();
        verifyNoInteractions(focco);
    }

    @Test
    void preservesIncompleteMigratedRecordsButNeverAllowsAssigningMigratedStatus() {
        var rows = createAndRead(draft(2));
        var migrated = repository.findById(18918L).orElseThrow();
        migrated.setStatus("Migrado"); migrated.setOf(""); migrated.setManufactured("");
        repository.saveAndFlush(migrated);
        rows = List.of(service.getPlate(18918L));
        var patch = new SerialPlatePatchDto(); patch.setLot("6"); patch.setStatus("Migrado");
        rows = service.updatePlates(mutation(rows, patch, "lot", "status"));
        assertThat(rows.getFirst().getStatus()).isEqualTo("Migrado");
        assertThat(rows.getFirst().getLot()).isEqualTo("06");
        assertThat(service.listPlates(PageRequest.of(0, 10), "Migrado", "").getTotalElements()).isEqualTo(1);
        assertThat(service.getSummary()).containsEntry("Migrado", 1L).containsEntry("total", 2L);
        assertThatThrownBy(() -> service.updatePlates(mutation(List.of(service.getPlate(18919L)), patch, "status")))
                .hasMessageContaining("Status");
        patch.setStatus("Criado"); patch.setManufactured("2026-11");
        rows = service.updatePlates(mutation(rows, patch, "status", "manufactured"));
        assertThat(rows.getFirst().getStatus()).isEqualTo("Criado");
        patch.setStatus("Migrado");
        var current = rows;
        assertThatThrownBy(() -> service.updatePlates(mutation(current, patch, "status"))).hasMessageContaining("Status");
    }

    @Test
    void returnedStatusIsPersistedAuditedAndIncludedInFiltersAndSummary() {
        List<SerialPlateDto> rows = createAndRead(draft(2));
        SerialPlatePatchDto patch = new SerialPlatePatchDto();
        patch.setStatus("Devolvido");
        assertThatThrownBy(() -> service.updatePlates(mutation(rows, patch, "status")))
                .hasMessageContaining("prestador");
        patch.setProvider("Interno");
        List<SerialPlateDto> returned = service.updatePlates(mutation(rows, patch, "status", "provider"));
        assertThat(returned).allMatch(row -> row.getStatus().equals("Devolvido"));
        assertThat(service.listPlates(PageRequest.of(0, 10), "", "Devolvido").getTotalElements()).isEqualTo(2);
        assertThat(service.getSummary().keySet()).containsExactly("Criado", "Programado", "Recebido", "Devolvido", "Finalizado", "total");
        assertThat(service.getSummary().get("Devolvido")).isEqualTo(2L);
        assertThat(service.getHistory(18918L)).hasSize(2);
    }

    @Test
    void retiredStatusCannotBeAssignedToAnyPlate() {
        List<SerialPlateDto> rows = createAndRead(draft(2));
        SerialPlatePatchDto patch = new SerialPlatePatchDto();
        patch.setProvider("Interno"); patch.setStatus("Terceiro");
        assertThatThrownBy(() -> service.updatePlates(mutation(rows, patch, "status", "provider")))
                .hasMessageContaining("Status inválido");
        assertThat(repository.findAll()).allMatch(plate -> plate.getStatus().equals("Criado"));
    }

    @Test
    void legacyStatusSurvivesUnrelatedEditsButCannotBeSelectedAgainAfterChangingIt() {
        SerialPlateDto row = createAndRead(draft(1)).getFirst();
        var plate = repository.findById(Long.valueOf(row.getSerial())).orElseThrow();
        plate.setStatus("Terceiro"); plate.setProvider("Interno"); repository.saveAndFlush(plate);
        row = service.getPlate(plate.getSerial());
        SerialPlatePatchDto patch = new SerialPlatePatchDto(); patch.setOf("999"); patch.setStatus("Terceiro");
        row = service.updatePlates(mutation(List.of(row), patch, "of", "status")).getFirst();
        assertThat(row.getOf()).isEqualTo("999"); assertThat(row.getStatus()).isEqualTo("Terceiro");
        patch.setStatus("Devolvido");
        row = service.updatePlates(mutation(List.of(row), patch, "status")).getFirst();
        patch.setStatus("Terceiro");
        SerialPlateMutationDto request = mutation(List.of(row), patch, "status");
        assertThatThrownBy(() -> service.updatePlates(request)).hasMessageContaining("Status inválido");
        assertThat(service.getPlate(plate.getSerial()).getStatus()).isEqualTo("Devolvido");
    }

    @Test
    void allocatesGlobalNumbersAndRejectsCounterRewind() {
        assertThat(repository.count()).isZero();
        List<SerialPlateDto> rows = createAndRead(draft(2));
        assertThat(rows).extracting(SerialPlateDto::getSerial).containsExactly("18918", "18919");
        assertThat(service.getHistory(18918L)).hasSize(1);
        assertThat(params.findByName("serialPlatesCount").orElseThrow().getContent()).isEqualTo("18919");
        Param sequence = params.findByName("serialPlatesCount").orElseThrow();
        sequence.setContent("18917"); params.saveAndFlush(sequence);
        assertThatThrownBy(() -> createAndRead(draft(1))).hasMessageContaining("sequência");
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test
    void serializesConcurrentAllocations() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Integer> task = () -> { start.await(); return service.createPlates(draft(3)); };
            var first = executor.submit(task);
            var second = executor.submit(task);
            start.countDown();
            assertThat(first.get(20, TimeUnit.SECONDS) + second.get(20, TimeUnit.SECONDS)).isEqualTo(6);
            assertThat(repository.count()).isEqualTo(6);
        } finally { executor.shutdownNow(); }
    }

    @Test
    void rollsBackEntireBatchAndRejectsStaleEdits() {
        List<SerialPlateDto> rows = createAndRead(draft(2));
        SerialPlatePatchDto patch = new SerialPlatePatchDto(); patch.setStatus("Finalizado");
        assertThatThrownBy(() -> service.updatePlates(mutation(rows, patch, "status"))).hasMessageContaining("prestador");
        assertThat(repository.findAll()).allMatch(row -> row.getStatus().equals("Criado"));
        patch.setProvider("Interno");
        List<SerialPlateDto> updated = service.updatePlates(mutation(rows, patch, "status", "provider"));
        assertThat(updated).allMatch(row -> row.getStatus().equals("Finalizado"));
        assertThatThrownBy(() -> service.updatePlates(mutation(rows, patch, "status", "provider"))).hasMessageContaining("alterado");
        SerialPlatePatchDto correction = new SerialPlatePatchDto(); correction.setOf("999");
        service.updatePlates(mutation(updated, correction, "of"));
        assertThat(service.getHistory(18918L)).hasSize(3);
        assertThat(service.getPlate(18918L).getOf()).isEqualTo("999");
    }

    @Test
    void clearsOrderAndClientOnlyOnSavedPeAndKeepsEquipment() {
        List<SerialPlateDto> rows = createAndRead(draft(1));
        SerialPlatePatchDto patch = new SerialPlatePatchDto();
        patch.setClient("Cliente"); patch.setDescription("Modelo"); patch.setReadyStock(true);
        SerialPlateDto updated = service.updatePlates(mutation(rows, patch, "client", "description", "readyStock")).getFirst();
        assertThat(updated.getClient()).isEmpty();
        assertThat(updated.getOrder()).isEmpty();
        assertThat(updated.getDescription()).isEqualTo("Modelo");
        assertThat(service.getHistory(18918L).getFirst().getChanges()).anyMatch(change -> change.getField().equals("Modelo") && change.getBefore().isEmpty());
    }

    @Test
    void paginatesFiltersOrdersAndCountsAllRecords() {
        createAndRead(draft(12));
        var page = service.listPlates(PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "serial")), "8301", "Criado");
        assertThat(page.getTotalElements()).isEqualTo(12);
        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getContent().getFirst().getSerial()).isEqualTo("18929");
        assertThat(service.getSummary().get("total")).isEqualTo(12);
        assertThat(service.getRange("18929", "18918", PageRequest.of(0, 10), "", "")).hasSize(12);
        var tied = PageRequest.of(0, 10, Sort.by("client", "status"));
        assertThat(service.getRange("18922", "18925", tied, "8301", "Criado"))
                .containsExactly("18925", "18924", "18923", "18922");
        assertThat(service.getRange("18925", "18922", tied, "8301", "Criado"))
                .containsExactly("18925", "18924", "18923", "18922");
        assertThat(service.getRange("18925", "18922", tied, "", "Recebido")).containsExactly("18922");
    }

    @Test
    @WithMockUser(roles = "SERIAL_PLATES_CONSULTATION")
    void searchesPartialSerialThroughThePaginatedEndpoint() throws Exception {
        Param sequence = params.findByName("serialPlatesCount").orElseThrow();
        sequence.setContent("18689"); params.saveAndFlush(sequence);
        createAndRead(draft(12));

        mvc.perform(get("/api/serial-plates")
                .param("page", "0").param("size", "10").param("search", "1869")
                .param("status", "").param("sort", "serial,desc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(10))
            .andExpect(jsonPath("$.content.length()").value(10))
            .andExpect(jsonPath("$.content[0].serial").value("18699"))
            .andExpect(jsonPath("$.content[9].serial").value("18690"))
            .andExpect(jsonPath("$.content[0].of").value("8301"))
            .andExpect(jsonPath("$.content[0].readyStock").value(false))
            .andExpect(jsonPath("$.content[0].notes").value(""))
            .andExpect(jsonPath("$.content[0].version").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.content[0].orderItemCode").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.content[0].capacity").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.content[0].weight").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.content[0].voltage").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.content[0].manufactured").doesNotHaveJsonPath());

        mvc.perform(get("/api/serial-plates/18699"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").isNumber())
            .andExpect(jsonPath("$.weight").hasJsonPath())
            .andExpect(jsonPath("$.manufactured").isNotEmpty());
    }

    @Test
    void ignoresInvalidErpCapacityWithoutDiscardingValidWeightOrBlockingCreation() {
        for (String capacity : List.of("inválida", "0 TON", "-9 TON", "1000000000000 TON", "0.0000001 TON")) {
            FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setItemCode("MESA");
            line.setOrderNumber(900L); line.setClient("Cliente"); line.setDescription("Niveladora");
            line.setModel("NDE 902020"); line.setVoltage("380V TRIF.");
            line.setCapacity(capacity); line.setWeight("180.0");
            when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
            SerialPlateOrderDto order = erp.findOrder("900");
            assertThat(order.getItems().getFirst().getCapacity()).isNull();
            assertThat(order.getItems().getFirst().getWeight()).isEqualByComparingTo("180");
            SerialPlateCreateDto input = draft(1); input.setOrder("900"); input.setOrderItemCode(order.getItems().getFirst().getItemCode());
            SerialPlateDto created = createAndRead(input).getFirst();
            assertThat(created.getCapacity()).isNull();
            assertThat(created.getWeight()).isEqualByComparingTo("180");
            assertThat(created.getDescription()).isEqualTo("NDE 902020");
        }
    }

    @Test
    void ignoresInvalidErpWeightAndAllowsBothOptionalMeasurementsToBeBlank() {
        for (String weight : List.of("inválido", "0 KG", "-1 KG", "1000000000000 KG", "0.0000001 KG")) {
            FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setItemCode("MESA");
            line.setOrderNumber(900L); line.setClient("Cliente"); line.setModel("NDE 902020");
            line.setCapacity("9 TON"); line.setWeight(weight);
            when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
            SerialPlateOrderDto order = erp.findOrder("900");
            assertThat(order.getItems().getFirst().getCapacity()).isEqualByComparingTo("9");
            assertThat(order.getItems().getFirst().getWeight()).isNull();
            SerialPlateCreateDto input = draft(1); input.setOrder("900"); input.setOrderItemCode(order.getItems().getFirst().getItemCode());
            SerialPlateDto created = createAndRead(input).getFirst();
            assertThat(created.getCapacity()).isEqualByComparingTo("9");
            assertThat(created.getWeight()).isNull();
        }
        FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setItemCode("MESA");
        line.setOrderNumber(900L); line.setClient("Cliente"); line.setModel("NDE 902020");
        line.setCapacity("N/A"); line.setWeight("N/A");
        when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
        SerialPlateOrderDto order = erp.findOrder("900");
        SerialPlateCreateDto input = draft(1); input.setOrder("900"); input.setOrderItemCode(order.getItems().getFirst().getItemCode());
        SerialPlateDto created = createAndRead(input).getFirst();
        assertThat(created.getCapacity()).isNull(); assertThat(created.getWeight()).isNull();
    }

    @Test
    void mapsFoccoModelDecimalAndNullWeightWithStableItems() {
        FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setItemCode("MESA");
        line.setOrderNumber(900L); line.setClient("Cliente"); line.setDescription("PA MESA");
        line.setModel("PA MEB MODELO E 101513"); line.setCapacity("1,5 TON"); line.setVoltage("220v TRI");
        when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
        SerialPlateOrderDto order = erp.findOrder("900");
        assertThat(order.getItems().getFirst().getCapacity()).isEqualByComparingTo(new BigDecimal("1.5"));
        assertThat(order.getItems().getFirst().getOrderDescription()).isEqualTo("PA MESA");
        assertThat(order.getItems().getFirst().getDescription()).isEqualTo("PA MEB MODELO E 101513");
        assertThat(order.getItems().getFirst().getWeight()).isNull();
        assertThat(order.getItems().getFirst().getDescription()).isEqualTo(line.getModel());
        SerialPlateCreateDto dto = draft(1); dto.setOrder("900"); dto.setOrderItemCode(order.getItems().getFirst().getItemCode());
        SerialPlateDto plate = createAndRead(dto).getFirst();
        assertThat(plate.getClient()).isEqualTo("Cliente");
        assertThatThrownBy(() -> service.prepareReport(selection(plate.getSerial()))).hasMessageContaining("Complete");
    }

    private SerialPlateSelectionDto selection(String serial) {
        SerialPlateSelectionDto dto = new SerialPlateSelectionDto(); dto.setSerials(List.of(serial)); return dto;
    }

    @Test
    void persistsReportColumnsAndOnlyRequiresSelectedFieldsForExport() {
        SerialPlateSettingsDto original = service.getSettings();
        assertThat(original.getReportColumns()).containsExactly("serial", "description", "manufactured", "voltage", "crea", "weight");
        SerialPlateDto plate = createAndRead(draft(1)).getFirst();
        try {
            SerialPlateSettingsDto settings = service.getSettings();
            settings.setReportColumns(List.of("serial")); settings.setCrea("");
            service.updateSettings(settings);
            assertThat(service.getSettings().getReportColumns()).containsExactly("serial");
            assertThat(service.prepareReport(selection(plate.getSerial())).getRecords()).hasSize(1);

            settings.setReportColumns(List.of("serial", "voltage")); service.updateSettings(settings);
            assertThatThrownBy(() -> service.prepareReport(selection(plate.getSerial())))
                    .hasMessageContaining("tensão").hasMessageNotContaining("modelo").hasMessageNotContaining("peso");
            settings.setReportColumns(List.of("crea")); service.updateSettings(settings);
            assertThatThrownBy(() -> service.prepareReport(selection(plate.getSerial()))).hasMessageContaining("CREA");
            for (List<String> invalid : List.of(List.<String>of(), List.of("invalid"), List.of("serial", "serial"))) {
                settings.setReportColumns(invalid);
                assertThatThrownBy(() -> service.updateSettings(settings)).hasMessageContaining("coluna válida");
                assertThat(service.getSettings().getReportColumns()).containsExactly("crea");
            }
        } finally {
            service.updateSettings(original);
        }
    }

    @Test
    void rollbackAlsoRemovesChangesAlreadyAppliedToEarlierBatchRows() {
        List<SerialPlateDto> rows = createAndRead(draft(2));
        SerialPlatePatchDto provider = new SerialPlatePatchDto(); provider.setProvider("Interno");
        SerialPlateDto first = service.updatePlates(mutation(List.of(rows.getFirst()), provider, "provider")).getFirst();
        SerialPlatePatchDto status = new SerialPlatePatchDto(); status.setStatus("Finalizado");
        assertThatThrownBy(() -> service.updatePlates(mutation(List.of(first, rows.getLast()), status, "status"))).hasMessageContaining("prestador");
        assertThat(service.getPlate(18918L).getStatus()).isEqualTo("Programado");
        assertThat(service.getHistory(18918L)).hasSize(2);
    }

    @Test
    void permitsStatusRegressionAndDoesNotAuditDecimalFormattingOrNoOpSaves() {
        List<SerialPlateDto> rows = createAndRead(draft(1));
        SerialPlatePatchDto patch = new SerialPlatePatchDto();
        patch.setProvider("Interno"); patch.setStatus("Finalizado"); patch.setWeight(new BigDecimal("300.0"));
        SerialPlateDto first = service.updatePlates(mutation(rows, patch, "provider", "status", "weight")).getFirst();
        patch.setWeight(new BigDecimal("300.000000"));
        SerialPlateDto same = service.updatePlates(mutation(List.of(first), patch, "provider", "status", "weight")).getFirst();
        assertThat(service.getHistory(18918L)).hasSize(2);
        assertThat(same.getVersion()).isEqualTo(first.getVersion());
        patch.setStatus("Criado");
        SerialPlateDto returned = service.updatePlates(mutation(List.of(same), patch, "status")).getFirst();
        assertThat(returned.getStatus()).isEqualTo("Criado");
    }

    @Test
    void displaysErpItemLabelsAndPreservesTheOriginalNameWhenUnlinked() throws Exception {
        FoccoPlateLineDto line = new FoccoPlateLineDto(); line.setItemCode("MESA");
        line.setOrderNumber(900L); line.setClient("Cliente"); line.setDescription("Mesa");
        line.setModel("PA MEB"); line.setVoltage("220v TRI"); line.setCapacity("1,5 TON");
        when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
        SerialPlateOrderDto order = erp.findOrder("900");
        SerialPlateCreateDto draft = draft(1); draft.setOrder("900"); draft.setOrderItemCode(order.getItems().getFirst().getItemCode());
        SerialPlateDto plate = createAndRead(draft).getFirst();
        SerialPlateChangeDto linked = service.getHistory(18918L).getFirst().getChanges().stream()
                .filter(change -> change.getField().equals("Item do pedido")).findFirst().orElseThrow();
        assertThat(linked.getAfter()).isEqualTo("Mesa");
        assertThat(mapper.writeValueAsString(service.getHistory(18918L))).doesNotContain(plate.getOrderItemCode());
        SerialPlatePatchDto rename = new SerialPlatePatchDto(); rename.setDescription("Modelo ajustado manualmente");
        SerialPlateDto renamed = service.updatePlates(mutation(List.of(plate), rename, "description")).getFirst();
        SerialPlatePatchDto unlink = new SerialPlatePatchDto(); unlink.setReadyStock(true);
        service.updatePlates(mutation(List.of(renamed), unlink, "readyStock"));
        SerialPlateChangeDto removed = service.getHistory(18918L).getFirst().getChanges().stream()
                .filter(change -> change.getField().equals("Item do pedido")).findFirst().orElseThrow();
        assertThat(removed.getBefore()).isEqualTo("Mesa");
        assertThat(removed.getAfter()).isEmpty();
    }

    @Test
    void rendersLegacyItemHashesUsingTheModelRecordedInThatEvent() throws Exception {
        createAndRead(draft(1));
        br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlateLog legacy = new br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlateLog();
        legacy.setSerial(18918L); legacy.setAt(java.time.Instant.now());
        legacy.setUserId(users.findAll().getFirst().getId()); legacy.setAuthor("Operador");
        legacy.setChangesJson(mapper.writeValueAsString(List.of(
                new SerialPlateChangeDto("Item do pedido", "", "b0726d58776c57e496dcb3a65c7615b4641ce223318b1a74c397e99d082a44aa"),
                new SerialPlateChangeDto("Modelo", "", "Modelo antigo")
        )));
        logs.saveAndFlush(legacy);
        SerialPlateChangeDto item = service.getHistory(18918L).getFirst().getChanges().getFirst();
        assertThat(item.getAfter()).isEqualTo("Modelo antigo");
    }

    @Test
    @WithMockUser(roles = "SERIAL_PLATES_CONSULTATION")
    void consultationCanReadButCannotModifyOrExport() throws Exception {
        mvc.perform(get("/api/serial-plates")).andExpect(status().isOk());
        mvc.perform(post("/api/serial-plates").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(draft(1)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/serial-plates/report").contentType(MediaType.APPLICATION_JSON).content("{\"serials\":[\"18918\"]}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/serial-plates/erp/orders/900")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "SERIAL_PLATES_OPERATOR")
    void operatorCreatesAndHistoryComesFromServer() throws Exception {
        mvc.perform(post("/api/serial-plates").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(draft(1))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$").value(1));
        mvc.perform(post("/api/serial-plates/selection").contentType(MediaType.APPLICATION_JSON).content("{\"serials\":[\"18918\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].serial").value("18918"))
                .andExpect(jsonPath("$[0].version").isNumber()).andExpect(jsonPath("$[0].equipmentData").value(false))
                .andExpect(jsonPath("$[0].client").doesNotExist());
        mvc.perform(get("/api/serial-plates/18918/history")).andExpect(status().isOk()).andExpect(jsonPath("$[0].author").isNotEmpty());
        mvc.perform(delete("/api/serial-plates/18918")).andExpect(status().isMethodNotAllowed());
    }
}
