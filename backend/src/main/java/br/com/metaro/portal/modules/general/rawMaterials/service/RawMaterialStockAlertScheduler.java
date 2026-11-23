package br.com.metaro.portal.modules.general.rawMaterials.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.modules.general.rawMaterials.entities.RawMaterial;
import br.com.metaro.portal.modules.general.rawMaterials.repositories.RawMaterialRepository;
import br.com.metaro.portal.util.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class RawMaterialStockAlertScheduler {
    private static final String PURCHASES_POSITION = "Compras";
    private final RawMaterialRepository materialRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Transactional(readOnly = true)
    public void executeSchedule(Long rawMaterialId) {
        try {
            RawMaterial item = materialRepository.findById(rawMaterialId).orElseThrow();
            List<User> recipients = userRepository.findActiveEmailRecipientsByPositionName(PURCHASES_POSITION);
            String subject = "Estoque abaixo do mínimo: %s - %s".formatted(item.getCode(), item.getName());
            String html = RawMaterialLowStockEmailTemplate.render(item);

            try {
                emailService.sendHtmlEmailBcc(
                        recipients.stream().map(User::getEmail).toList(),
                        subject,
                        html,
                        "Matérias-primas"
                );
            } catch (Exception exception) {
                log.error("Falha ao enviar alerta de estoque do item {}", rawMaterialId, exception);
            }
        } catch (Exception exception) {
            log.error("Falha ao executar alerta de estoque do item {}", rawMaterialId, exception);
        }
    }
}
