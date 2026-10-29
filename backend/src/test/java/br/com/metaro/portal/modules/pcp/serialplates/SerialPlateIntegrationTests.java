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

    private SerialPlateMutationDto mutation(List<SerialPlateDto> rows, SerialPlatePatchDto patch, String... fields) {
        SerialPlateMutationDto dto = new SerialPlateMutationDto();
        dto.setPatch(patch); dto.setFields(List.of(fields));
        Map<String, Long> versions = new LinkedHashMap<>();
        rows.forEach(row -> versions.put(row.getSerial(), row.getVersion()));
        dto.setVersions(versions); return dto;
    }

    @Test
    void returnedStatusIsPersistedAuditedAndIncludedInFiltersAndSummary() {
        List<SerialPlateDto> rows = service.createPlates(draft(2));
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
        List<SerialPlateDto> rows = service.createPlates(draft(2));
        SerialPlatePatchDto patch = new SerialPlatePatchDto();
        patch.setProvider("Interno"); patch.setStatus("Terceiro");
        assertThatThrownBy(() -> service.updatePlates(mutation(rows, patch, "status", "provider")))
                .hasMessageContaining("Status inválido");
        assertThat(repository.findAll()).allMatch(plate -> plate.getStatus().equals("Criado"));
    }

    @Test
    void legacyStatusSurvivesUnrelatedEditsButCannotBeSelectedAgainAfterChangingIt() {
        SerialPlateDto row = service.createPlates(draft(1)).getFirst();
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
        List<SerialPlateDto> rows = service.createPlates(draft(2));
        assertThat(rows).extracting(SerialPlateDto::getSerial).containsExactly("18918", "18919");
        assertThat(service.getHistory(18918L)).hasSize(1);
        assertThat(params.findByName("serialPlatesCount").orElseThrow().getContent()).isEqualTo("18919");
        Param sequence = params.findByName("serialPlatesCount").orElseThrow();
        sequence.setContent("18917"); params.saveAndFlush(sequence);
        assertThatThrownBy(() -> service.createPlates(draft(1))).hasMessageContaining("sequência");
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test
    void serializesConcurrentAllocations() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Callable<List<SerialPlateDto>> task = () -> { start.await(); return service.createPlates(draft(3)); };
            Future<List<SerialPlateDto>> first = executor.submit(task);
            Future<List<SerialPlateDto>> second = executor.submit(task);
            start.countDown();
            Set<String> serials = new HashSet<>();
            first.get(20, TimeUnit.SECONDS).forEach(row -> serials.add(row.getSerial()));
            second.get(20, TimeUnit.SECONDS).forEach(row -> serials.add(row.getSerial()));
            assertThat(serials).hasSize(6);
        } finally { executor.shutdownNow(); }
    }

    @Test
    void rollsBackEntireBatchAndRejectsStaleEdits() {
        List<SerialPlateDto> rows = service.createPlates(draft(2));
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
        List<SerialPlateDto> rows = service.createPlates(draft(1));
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
        service.createPlates(draft(12));
        var page = service.listPlates(PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "serial")), "8301", "Criado");
        assertThat(page.getTotalElements()).isEqualTo(12);
        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getContent().getFirst().getSerial()).isEqualTo("18929");
        assertThat(service.getSummary().get("total")).isEqualTo(12);
        assertThat(service.getRange("18929", "18918", PageRequest.of(0, 10), "", "")).hasSize(12);
    }

    @Test
    void mapsFoccoModelDecimalAndNullWeightWithStableItems() {
        FoccoPlateLineDto line = new FoccoPlateLineDto();
        line.setOrderNumber(900L); line.setClient("Cliente"); line.setDescription("PA MESA");
        line.setModel("PA MEB MODELO E 101513"); line.setCapacity("1,5 TON"); line.setVoltage("220v TRI");
        when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
        SerialPlateOrderDto order = erp.findOrder("900");
        assertThat(order.getItems().getFirst().getCapacity()).isEqualByComparingTo(new BigDecimal("1.5"));
        assertThat(order.getItems().getFirst().getOrderDescription()).isEqualTo("PA MESA");
        assertThat(order.getItems().getFirst().getDescription()).isEqualTo("PA MEB MODELO E 101513");
        assertThat(order.getItems().getFirst().getWeight()).isNull();
        assertThat(order.getItems().getFirst().getDescription()).isEqualTo(line.getModel());
        SerialPlateCreateDto dto = draft(1); dto.setOrder("900"); dto.setOrderItem(order.getItems().getFirst().getId());
        SerialPlateDto plate = service.createPlates(dto).getFirst();
        assertThat(plate.getClient()).isEqualTo("Cliente");
        assertThatThrownBy(() -> service.prepareReport(selection(plate.getSerial()))).hasMessageContaining("Complete");
    }

    private SerialPlateSelectionDto selection(String serial) {
        SerialPlateSelectionDto dto = new SerialPlateSelectionDto(); dto.setSerials(List.of(serial)); return dto;
    }

    @Test
    void rollbackAlsoRemovesChangesAlreadyAppliedToEarlierBatchRows() {
        List<SerialPlateDto> rows = service.createPlates(draft(2));
        SerialPlatePatchDto provider = new SerialPlatePatchDto(); provider.setProvider("Interno");
        SerialPlateDto first = service.updatePlates(mutation(List.of(rows.getFirst()), provider, "provider")).getFirst();
        SerialPlatePatchDto status = new SerialPlatePatchDto(); status.setStatus("Finalizado");
        assertThatThrownBy(() -> service.updatePlates(mutation(List.of(first, rows.getLast()), status, "status"))).hasMessageContaining("prestador");
        assertThat(service.getPlate(18918L).getStatus()).isEqualTo("Programado");
        assertThat(service.getHistory(18918L)).hasSize(2);
    }

    @Test
    void permitsStatusRegressionAndDoesNotAuditDecimalFormattingOrNoOpSaves() {
        List<SerialPlateDto> rows = service.createPlates(draft(1));
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
        FoccoPlateLineDto line = new FoccoPlateLineDto();
        line.setOrderNumber(900L); line.setClient("Cliente"); line.setDescription("Mesa");
        line.setModel("PA MEB"); line.setVoltage("220v TRI"); line.setCapacity("1,5 TON");
        when(focco.findPlateOrder(900L)).thenReturn(List.of(line));
        SerialPlateOrderDto order = erp.findOrder("900");
        SerialPlateCreateDto draft = draft(1); draft.setOrder("900"); draft.setOrderItem(order.getItems().getFirst().getId());
        SerialPlateDto plate = service.createPlates(draft).getFirst();
        SerialPlateChangeDto linked = service.getHistory(18918L).getFirst().getChanges().stream()
                .filter(change -> change.getField().equals("Item do pedido")).findFirst().orElseThrow();
        assertThat(linked.getAfter()).isEqualTo("Mesa");
        assertThat(mapper.writeValueAsString(service.getHistory(18918L))).doesNotContain(plate.getOrderItem());
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
        service.createPlates(draft(1));
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
            .andExpect(status().isCreated()).andExpect(jsonPath("$[0].serial").value("18918"));
        mvc.perform(get("/api/serial-plates/18918/history")).andExpect(status().isOk()).andExpect(jsonPath("$[0].author").isNotEmpty());
        mvc.perform(delete("/api/serial-plates/18918")).andExpect(status().isMethodNotAllowed());
    }
}
