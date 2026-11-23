package br.com.metaro.portal.core.services;

import br.com.metaro.portal.core.controller.AuthController;
import br.com.metaro.portal.core.controller.InfoController;
import br.com.metaro.portal.core.controller.RequestMailConfigController;
import br.com.metaro.portal.core.dto.request.RequestMailConfigUpdateDto;
import br.com.metaro.portal.integration.bunny.BunnyConfigController;
import br.com.metaro.portal.integration.bunny.dto.BunnyConfigUpdateDto;
import br.com.metaro.portal.integration.focco.FoccoConfigController;
import br.com.metaro.portal.integration.focco.dto.FoccoConfigUpdateDto;
import br.com.metaro.portal.modules.general.rawMaterials.controller.RawMaterialsController;
import br.com.metaro.portal.modules.general.rawMaterials.dto.RawMaterialHistoryRetentionDto;
import br.com.metaro.portal.util.email.EmailLogController;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SystemParamsAuthorizationTests {
    private static final String SYSTEM_PARAMS_ROLE = "'ROLE_SYSTEM_PARAMS'";

    @Test
    void grantsSystemParamsRoleToEveryEndpointUsedByTheParametersPage() throws NoSuchMethodException {
        List<Method> protectedMethods = List.of(
                AuthController.class.getMethod("activeSessions"),
                AuthController.class.getMethod("disconnectSession", String.class),
                InfoController.class.getMethod("clearCache"),
                EmailLogController.class.getMethod("list", Pageable.class),
                FoccoConfigController.class.getMethod("getConfig"),
                FoccoConfigController.class.getMethod("updateConfig", FoccoConfigUpdateDto.class),
                BunnyConfigController.class.getMethod("getConfig"),
                BunnyConfigController.class.getMethod("updateConfig", BunnyConfigUpdateDto.class),
                RequestMailConfigController.class.getMethod("getConfig"),
                RequestMailConfigController.class.getMethod("updateConfig", RequestMailConfigUpdateDto.class),
                RawMaterialsController.class.getMethod("retention"),
                RawMaterialsController.class.getMethod("retention", RawMaterialHistoryRetentionDto.class)
        );

        assertThat(protectedMethods)
                .allSatisfy(method -> assertThat(method.getAnnotation(PreAuthorize.class))
                        .as("@PreAuthorize de %s", method)
                        .isNotNull()
                        .extracting(PreAuthorize::value)
                        .asString()
                        .contains(SYSTEM_PARAMS_ROLE));
    }

    @Test
    void keepsUserWideDisconnectionRestrictedToGlobalAdministrators() throws NoSuchMethodException {
        PreAuthorize authorization = AuthController.class
                .getMethod("disconnectSession", Long.class)
                .getAnnotation(PreAuthorize.class);

        assertThat(authorization).isNotNull();
        assertThat(authorization.value()).contains("'ROLE_ADMIN'").doesNotContain(SYSTEM_PARAMS_ROLE);
    }
}
