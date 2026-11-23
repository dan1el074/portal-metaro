package br.com.metaro.portal.core.services;

import br.com.metaro.portal.core.dto.request.RequestMailConfigDto;
import br.com.metaro.portal.core.dto.request.RequestMailConfigUpdateDto;
import br.com.metaro.portal.core.entities.Param;
import br.com.metaro.portal.core.repositories.ParamRepository;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RequestMailConfigServiceTests {
    @Test
    void returnsAnEmptyConfigurationWhenTheDatabaseParameterDoesNotExist() {
        ParamRepository repository = mock(ParamRepository.class);
        when(repository.findByName(RequestMailConfigService.RECIPIENT_PARAM)).thenReturn(Optional.empty());
        RequestMailConfigService service = new RequestMailConfigService(repository);

        RequestMailConfigDto config = service.getConfig();

        assertThat(config.getTo()).isEmpty();
    }

    @Test
    void savesTheTrimmedRecipientInTheSystemParametersTable() {
        ParamRepository repository = mock(ParamRepository.class);
        when(repository.findByName(RequestMailConfigService.RECIPIENT_PARAM)).thenReturn(Optional.empty());
        RequestMailConfigService service = new RequestMailConfigService(repository);
        RequestMailConfigUpdateDto update = new RequestMailConfigUpdateDto(" requests@metaro.com.br ");

        RequestMailConfigDto config = service.updateConfig(update);

        ArgumentCaptor<Param> savedParam = ArgumentCaptor.forClass(Param.class);
        verify(repository).save(savedParam.capture());
        assertThat(savedParam.getValue().getName()).isEqualTo(RequestMailConfigService.RECIPIENT_PARAM);
        assertThat(savedParam.getValue().getContent()).isEqualTo("requests@metaro.com.br");
        assertThat(config.getTo()).isEqualTo("requests@metaro.com.br");
    }

    @Test
    void returnsTheRecipientSavedByTheUser() {
        ParamRepository repository = mock(ParamRepository.class);
        Param saved = new Param(1L, RequestMailConfigService.RECIPIENT_PARAM, "database@metaro.com.br");
        when(repository.findByName(RequestMailConfigService.RECIPIENT_PARAM)).thenReturn(Optional.of(saved));
        RequestMailConfigService service = new RequestMailConfigService(repository);

        assertThat(service.getRecipient()).isEqualTo("database@metaro.com.br");
    }

    @Test
    void preventsSendingWhenThereIsNoRecipientInTheDatabase() {
        ParamRepository repository = mock(ParamRepository.class);
        when(repository.findByName(RequestMailConfigService.RECIPIENT_PARAM)).thenReturn(Optional.empty());
        RequestMailConfigService service = new RequestMailConfigService(repository);

        org.assertj.core.api.Assertions.assertThatThrownBy(service::getRecipient)
                .isInstanceOf(UnprocessableEntityException.class)
                .hasMessage("Configure o e-mail destinatário das solicitações de acesso nos parâmetros do sistema.");
    }
}
