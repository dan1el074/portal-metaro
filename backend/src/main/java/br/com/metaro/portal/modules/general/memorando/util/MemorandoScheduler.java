package br.com.metaro.portal.modules.general.memorando.util;

import br.com.metaro.portal.core.entities.NotificationType;
import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.NotificationService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.util.email.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.Set;

@Component
@Slf4j
public class MemorandoScheduler {
    @Autowired
    private MemorandoRepository memorandoRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private EmailService emailService;

    @Transactional
    public void executeSchedule(Long memorandoId, Long myId) {
        try {
            Memorando entity = memorandoRepository
                    .findByIdWithDepartments(memorandoId)
                    .orElseThrow(ResourceNotFoundException::new);

            entity.getFromDepartments().forEach(department -> {
                department.getUsers().size();
            });

            notifyAllDepartmentUsers(entity, myId);
        } catch (Exception e) {
            log.error("Falha ao executar notificações do memorando {}", memorandoId, e);
        }
    }

    private void notifyAllDepartmentUsers(Memorando entity, Long myId) throws Exception {
        Set<String> recipientEmails = new LinkedHashSet<>();
        for (Position department : entity.getFromDepartments()) {
            for (User user : department.getUsers()) {
                if (!user.getId().equals(myId)) {
                    notificationService.create("Memorando nº %d, com seu setor envolvido, foi finalizado!"
                                    .formatted(entity.getNumber()), "/general/memorando/%d".formatted(entity.getId()),
                            true, NotificationType.MEMORANDO_FINISH, entity.getId(), null, user);
                }

                recipientEmails.add(user.getEmail());
            }
        }

        DateTimeFormatter fullDateFormattter = DateTimeFormatter.ofPattern("dd/MM/yyyy '·' HH:mm")
                .withZone(ZoneId.systemDefault());
        DateTimeFormatter yearFormattter = DateTimeFormatter.ofPattern("yyyy")
                .withZone(ZoneId.systemDefault());

        String formatedDate = fullDateFormattter.format(Instant.now());
        String year = yearFormattter.format(entity.getCreateAt());

        try {
            emailService.sendHtmlEmailBcc(recipientEmails, "Memorando %d/%s finalizado"
                        .formatted(entity.getNumber(), year), """
                            <html lang="pt-BR">
                              <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                                <title>Relatório BI – Indicadores Operacionais</title>
                                <style>
                                  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
                                  body, table, td, a {
                                    -webkit-text-size-adjust: 100%%;
                                    -ms-text-size-adjust: 100%%;
                                  }
                                  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
                                  body { margin: 0; padding: 0; background-color: #f0f4f9; font-family: 'IBM Plex Sans', Arial, sans-serif; }
                                  .wrapper {
                                    width: 100%%;
                                    background-color: #f0f4f9;
                                    padding: 32px 0;
                                  }
                                  .container {
                                    max-width: 680px;
                                    margin: 0 auto;
                                    background-color: #ffffff;
                                    border-radius: 8px;
                                    overflow: hidden;
                                    border: 1px solid #d0dde8;
                                  }
                                  .header {
                                    background-color: #0f4f8a;
                                    padding: 28px 36px;
                                  }
                                  .header-subtitle {
                                    margin-top: 6px;
                                    color: #93bde0;
                                    font-size: 13px;
                                    font-weight: 400;
                                  }
                                  .title-band {
                                    background-color: #1565a8;
                                    padding: 16px 36px;
                                    border-bottom: 3px solid #0f4f8a;
                                  }
                                  .report-title {
                                    color: #ffffff;
                                    font-size: 17px;
                                    font-weight: 600;
                                    margin: 0;
                                  }
                                  .report-period {
                                    color: #aacceb;
                                    font-size: 12px;
                                    font-weight: 400;
                                    margin-top: 3px;
                                  }
                                  .main-section {
                                    padding: 28px 36px 20px;
                                    border-bottom: 1px solid #e1eaf3;
                                  }
                                  .text {
                                    font-size: 15px;
                                    line-height: 1.7;
                                    margin: 0 0 18px;
                                  }
                                  .info-card {
                                    margin: 28px 0;
                                    background-color: #f4f8fd;
                                    border: 1px solid #d0dde8;
                                    border-radius: 8px;
                                    overflow: hidden;
                                  }
                                  .info-header {
                                    background-color: #e8f1fa;
                                    padding: 14px 20px;
                                    border-bottom: 1px solid #d0dde8;
                                    font-size: 12px;
                                    font-weight: 600;
                                    color: #1565a8;
                                    text-transform: uppercase;
                                    letter-spacing: 0.8px;
                                  }
                                  .info-body {
                                    padding: 24px 20px;
                                  }
                                  .info-row {
                                    margin-bottom: 18px;
                                  }
                                  .info-label {
                                    display: block;
                                    font-size: 11px;
                                    color: #557799;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                    margin-bottom: 5px;
                                    letter-spacing: 0.5px;
                                  }
                                  .info-value {
                                    font-size: 17px;
                                    font-weight: 600;
                                    color: #0f4f8a;
                                  }
                                  .badge {
                                    display: inline-block;
                                    padding: 7px 14px;
                                    border-radius: 999px;
                                    background-color: #d4efdf;
                                    color: #1a5c35;
                                    font-size: 12px;
                                    font-weight: 600;
                                  }
                                  .button-wrapper {
                                    margin-top: 34px;
                                    text-align: center;
                                  }
                                  .button {
                                    display: inline-block;
                                    background-color: #1565a8;
                                    color: #ffffff !important;
                                    text-decoration: none;
                                    padding: 14px 26px;
                                    border-radius: 6px;
                                    font-size: 14px;
                                    font-weight: 600;
                                  }
                                  .main-grid {
                                    display: grid;
                                    grid-template-columns: repeat(3, 1fr);
                                    gap: 12px;
                                  }
                                  .main-card {
                                    background-color: #f4f8fd;
                                    border: 1px solid #d0dde8;
                                    border-radius: 6px;
                                    padding: 14px 16px;
                                    text-align: center;
                                  }
                                  .main-label {
                                    font-size: 11px;
                                    color: #557799;
                                    font-weight: 500;
                                    margin-bottom: 6px;
                                  }
                                  .main-value {
                                    font-size: 24px;
                                    font-weight: 600;
                                    color: #0f4f8a;
                                    line-height: 1;
                                  }
                                  .main-unit {
                                    font-size: 11px;
                                    color: #557799;
                                    margin-top: 4px;
                                  }
                                  .main-delta {
                                    font-size: 11px;
                                    font-weight: 600;
                                    margin-top: 5px;
                                  }
                                  .main-delta.up { color: #1a7a3f; }
                                  .main-delta.down { color: #c0392b; }
                                  .main-delta.neutral { color: #557799; }
                                  .footer {
                                    background-color: #0f4f8a;
                                    padding: 20px 36px;
                                    text-align: center;
                                  }
                                  .footer-top {
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    border-bottom: 1px solid #1e6eb5;
                                    padding-bottom: 14px;
                                    margin-bottom: 14px;
                                  }
                                  .footer-brand {
                                    color: #93bde0;
                                    font-size: 13px;
                                    font-weight: 500;
                                  }
                                  .footer-timestamp {
                                    color: #6699bb;
                                    font-size: 11px;
                                  }
                                  .footer-note {
                                    color: #6699bb;
                                    font-size: 11px;
                                    line-height: 1.6;
                                  }
                                  .divider {
                                    height: 3px;
                                    background: linear-gradient(90deg, #0f4f8a 0%%, #3b9edd 50%%, #0f4f8a 100%%);
                                  }
                                  @media only screen and (max-width: 620px) {
                                    .container { border-radius: 0; }
                                    .header, .main-section, .table-section, .footer, .title-band { padding-left: 20px; padding-right: 20px; }
                                    .main-grid { grid-template-columns: repeat(2, 1fr); }
                                  }
                                </style>
                              </head>
                              <body>
                                <div class="wrapper">
                                  <div class="container">
                                    <div class="header">
                                      <table width="100%%" cellpadding="0" cellspacing="0">
                                        <tr>
                                          <td>
                                            <img src="https://www.metaro.com.br/images/full-white-logo.svg" width="130" alt="Portal Metaro" style="display:block;border:0;outline:none;text-decoration:none;max-width:100%%;height:auto;" >
                                            <div class="header-subtitle">Memorando · Notificação Automática</div>
                                          </td>
                                          <td align="right" valign="middle">
                                            <div style="width:42px; height:42px; border-radius:8px; background:#1565a8; text-align:center; line-height:42px; color:#ffffff; font-size:22px; font-weight:bold;">
                                              ✓
                                            </div>
                                          </td>
                                        </tr>
                                      </table>
                                    </div>
                                    <div class="title-band">
                                      <div class="report-title">Memorando Finalizado com Sucesso</div>
                                      <div class="report-period">%s</div>
                                    </div>
                                    <div class="main-section">
                                      <p class="text">Olá,</p>
                                      <p class="text">
                                        Informamos que o <strong>memorando %d/%s</strong> foi finalizado com sucesso, estamos notificando você porque faz parte de uma das áreas envolvidas.
                                      </p>
                                      <div class="info-card">
                                        <div class="info-header">Dados do Memorando</div>
                                        <div class="info-body">
                                          <div class="info-row">
                                            <span class="info-label">Número</span>
                                            <span class="info-value">%d/%s</span>
                                          </div>
                                          <div class="info-row">
                                            <span class="info-label">Status</span>
                                            <span class="badge">APROVADO</span>
                                          </div>
                                          <div class="info-row">
                                            <span class="info-label">Título</span>
                                            <span class="info-value">%s</span>
                                          </div>
                                          <div class="info-row">
                                            <span class="info-label">Pedido</span>
                                            <span class="info-value">%d</span>
                                          </div>
                                          <div class="info-row" style="margin-bottom:0;">
                                            <span class="info-label">Cliente</span>
                                            <span class="info-value">%s</span>
                                          </div>
                                        </div>
                                      </div>
                                      <p class="text">
                                        Caso necessário, acesse o portal para consultar os detalhes, histórico e assinaturas relacionados ao memorando.
                                      </p>
                                      <div class="button-wrapper">
                                        <a href="http://portal.metaro.com.br" class="button">Acessar Portal</a>
                                      </div>
                                    </div>
                                    <div class="divider"></div>
                                    <div class="footer">
                                      <table width="100%%" cellpadding="0" cellspacing="0">
                                        <tr>
                                          <td align="left">
                                            <span class="footer-brand">Portal Metaro</span>
                                          </td>
                                          <td align="right">
                                            <span class="footer-timestamp">%s</span>
                                          </td>
                                        </tr>
                                      </table>
                                      <div style="border-top: 1px solid #1e6eb5; margin: 14px 0;"></div>
                                      <div class="footer-note">
                                        Este e-mail é gerado automaticamente, não responda!<br>
                                        Em caso de dúvidas, entre em contato com um administrador: ti@metaro.com.br
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </body>
                            </html>
                        """.formatted(formatedDate, entity.getNumber(), year, entity.getNumber(), year,
                            entity.getTitle(), entity.getRequest(), entity.getClient(), formatedDate), "Memorando");
        } catch (Exception exception) {
            log.error("Não foi possível enviar o memorando {}", entity.getId(), exception);
        }
    }
}
