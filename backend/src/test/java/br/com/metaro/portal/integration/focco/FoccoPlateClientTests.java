package br.com.metaro.portal.integration.focco;

import br.com.metaro.portal.integration.focco.dto.FoccoCredentialsDto;
import org.junit.jupiter.api.Test;
import br.com.metaro.portal.modules.pcp.serialplates.service.SerialPlateErpService;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class FoccoPlateClientTests {
    @Test
    void sendsServerCredentialsAndReadsPlateFields() {
        FoccoConfigService config = mock(FoccoConfigService.class);
        when(config.getCredentials()).thenReturn(new FoccoCredentialsDto("https://focco.example", "test-key", "test-token"));
        FoccoPlateClient client = new FoccoPlateClient(config, "/FoccoIntegrador/api/v1/Exportacao/portal_plaquetas");
        MockRestServiceServer server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(client, "restTemplate")).build();
        server.expect(requestTo("https://focco.example/FoccoIntegrador/api/v1/Exportacao/portal_plaquetas?Chave=test-key&order_number=900"))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
            .andRespond(withSuccess("{\"succeeded\":true,\"value\":[{\"order_number\":900,\"client\":\"Cliente\",\"description\":\"Mesa\",\"model\":\"PA MEB\",\"capacity\":\"1,5 TON\",\"weight\":null,\"voltage\":\"220v TRI\"}]}", MediaType.APPLICATION_JSON));
        var lines = client.findPlateOrder(900);
        assertThat(lines.getFirst().getOrderNumber()).isEqualTo(900);
        assertThat(lines.getFirst().getCapacity()).isEqualTo("1,5 TON");
        assertThat(lines.getFirst().getWeight()).isNull();
        server.verify();
    }

    @Test
    void importsTheProvidedOrderWithTextCapacityAndDistinctNumericWeights() {
        FoccoConfigService config = mock(FoccoConfigService.class);
        when(config.getCredentials()).thenReturn(new FoccoCredentialsDto("https://focco.example", "test-key", "test-token"));
        FoccoPlateClient client = new FoccoPlateClient(config, "/plates");
        MockRestServiceServer server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(client, "restTemplate")).build();
        server.expect(anything()).andRespond(withSuccess("""
            {"succeeded":true,"value":[
              {"order_number":751,"client":"91735 - B7 & OTILIA EMPREENDIMENTOS LTDA","description":"PA NIVELADORA DE DOCA EMBUTIDA (NDE)","model":"NDE 902020","voltage":"380V TRIF.","capacity":"9 TON","weight":1.0},
              {"order_number":751,"client":"91735 - B7 & OTILIA EMPREENDIMENTOS LTDA","description":"PA NIVELADORA DE DOCA EMBUTIDA (NDE)","model":"NDE 902020","voltage":"380V TRIF.","capacity":"9 TON","weight":180.0}
            ]}
            """, MediaType.APPLICATION_JSON));
        var order = new SerialPlateErpService(client).findOrder("751");
        assertThat(order.getItems()).hasSize(2);
        assertThat(order.getItems().getFirst().getCapacity()).isEqualByComparingTo("9");
        assertThat(order.getItems().getFirst().getWeight()).isEqualByComparingTo("1");
        assertThat(order.getItems().getLast().getWeight()).isEqualByComparingTo("180");
        server.verify();
    }

    @Test
    void rejectsUpstreamFailureWithoutLeakingErrorDetails() {
        FoccoConfigService config = mock(FoccoConfigService.class);
        when(config.getCredentials()).thenReturn(new FoccoCredentialsDto("https://focco.example", "test-key", "test-token"));
        FoccoPlateClient client = new FoccoPlateClient(config, "/plates");
        MockRestServiceServer server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(client, "restTemplate")).build();
        server.expect(anything()).andRespond(withSuccess("{\"succeeded\":false,\"failed\":true,\"errorMessage\":\"sensitive upstream details\"}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.findPlateOrder(900)).isInstanceOf(FoccoIntegrationException.class).hasMessageNotContaining("sensitive");
        server.verify();
    }
}
