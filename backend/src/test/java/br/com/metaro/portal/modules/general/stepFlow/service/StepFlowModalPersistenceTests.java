package br.com.metaro.portal.modules.general.stepFlow.service;

import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.modules.general.stepFlow.entities.*;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = {"STEP_FLOW", "STEP_FLOW_OPERATOR"})
@TestPropertySource(properties = {
    "external.datasource.jdbc-url=jdbc:h2:mem:stepflow-modal-external",
    "external.datasource.driver-class-name=org.h2.Driver",
    "external.datasource.username=sa", "external.datasource.password="
})
class StepFlowModalPersistenceTests {
    @Autowired private MockMvc mvc;
    @Autowired private OrderRepository orders;
    @Autowired private TransactionTemplate transactions;
    @Autowired private ObjectMapper json;
    @MockBean private UserService users;
    private final List<Long> createdOrders = new ArrayList<>();
    private Long orderId;
    private Long itemId;

    @BeforeEach
    void setup() {
        User operator = new User();
        Position department = new Position(); department.setName("Montagem Final"); operator.setPosition(department);
        when(users.authenticate()).thenReturn(operator);
        orderId = createOrder(1, 3);
        itemId = transactions.execute(status -> orders.findById(orderId).orElseThrow().getItems().getFirst().getId());
    }

    @AfterEach
    void cleanup() { transactions.executeWithoutResult(status -> createdOrders.forEach(orders::deleteById)); }

    @Test
    void modalSaveCommitsTheVolumeWithoutSavingTheStepForm() throws Exception {
        mvc.perform(post("/api/step-flow/{id}/volumes", orderId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\":2,\"length\":\"1.20\",\"width\":\"0.80\",\"height\":\"0.50\",\"weight\":\"12.35\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").isNumber());
        mvc.perform(get("/api/step-flow/{id}", orderId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.volumes.length()").value(1))
                .andExpect(jsonPath("$.volumes[0].quantity").value(2))
                .andExpect(jsonPath("$.items[0].producedQuantity").value(3));
        transactions.executeWithoutResult(status -> assertThat(orders.findById(orderId).orElseThrow().getVolumes()).hasSize(1));
    }

    @Test
    void modalSaveCommitsTheQuantityWithoutCommentsImagesOrVolumes() throws Exception {
        mvc.perform(put("/api/step-flow/{orderId}/items/{itemId}/quantity", orderId, itemId)
                .contentType(MediaType.APPLICATION_JSON).content("{\"producedQuantity\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.producedQuantity").value(5));
        mvc.perform(get("/api/step-flow/{id}", orderId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].producedQuantity").value(5))
                .andExpect(jsonPath("$.volumes.length()").value(0))
                .andExpect(jsonPath("$.currentStep").value("Montagem Final"));
    }

    @Test
    void editingAPersistedVolumeUpdatesTheSameRowImmediately() throws Exception {
        var response = mvc.perform(post("/api/step-flow/{id}/volumes", orderId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\":1,\"length\":\"1.20\",\"width\":\"0.80\",\"height\":\"0.50\",\"weight\":\"12.35\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").isNumber()).andReturn();
        long volumeId = json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/step-flow/{orderId}/volumes/{volumeId}", orderId, volumeId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\":2,\"length\":\"1.20\",\"width\":\"0.80\",\"height\":\"0.50\",\"weight\":\"15.00\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(volumeId));
        mvc.perform(get("/api/step-flow/{id}", orderId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.volumes.length()").value(1))
                .andExpect(jsonPath("$.volumes[0].quantity").value(2))
                .andExpect(jsonPath("$.volumes[0].weight").value(15));
    }

    @Test
    void invalidOrUnavailableQuantitiesLeaveThePersistedValueUnchanged() throws Exception {
        mvc.perform(put("/api/step-flow/{orderId}/items/{itemId}/quantity", orderId, itemId)
                .contentType(MediaType.APPLICATION_JSON).content("{\"producedQuantity\":-1}"))
                .andExpect(status().isNotAcceptable());
        createOrder(2, 6);
        mvc.perform(put("/api/step-flow/{orderId}/items/{itemId}/quantity", orderId, itemId)
                .contentType(MediaType.APPLICATION_JSON).content("{\"producedQuantity\":5}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/step-flow/{id}", orderId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].producedQuantity").value(3));
    }

    private Long createOrder(int occurrence, int producedQuantity) {
        Long id = transactions.execute(status -> {
            Order order = new Order(); order.setNumber(98760287); order.setOccurrence(occurrence);
            order.setCurrentStep(StepType.FINAL_ASSEMBLY); order.setStatus(OrderStatus.IN_PROGRESS);
            order.setChecklistIntegration(false); order.setClient("Cliente");
            order.setItems(new ArrayList<>()); order.setSteps(new ArrayList<>()); order.setVolumes(new ArrayList<>());
            for (StepType type : StepType.values()) {
                OrderStep step = new OrderStep(); step.setStep(type);
                step.setStatus(type == StepType.FINAL_ASSEMBLY ? StepStatus.ACTIVE : StepStatus.WAITING);
                order.addStep(step);
            }
            OrderItem item = new OrderItem(); item.setItemCode("60287"); item.setDescription("Equipamento");
            item.setQuantity(10); item.setProducedQuantity(producedQuantity); order.addItem(item);
            return orders.saveAndFlush(order).getId();
        });
        createdOrders.add(id); return id;
    }
}
