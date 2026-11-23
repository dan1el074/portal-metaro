package br.com.metaro.portal.core.services;

import br.com.metaro.portal.core.dto.request.RequestDto;
import br.com.metaro.portal.util.email.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RequestService {
    private final EmailService emailService;
    private final RequestMailConfigService mailConfigService;

    public void requestNewAccess(RequestDto dto) throws Exception {
        String message = """
                <div style="margin:0; padding:40px 0 0 0">
                     <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse:collapse">
                         <tbody>
                             <tr>
                                <td align="center"><img src="https://metaro.com.br/images/header-email.jpeg" alt="metaro-banner" width="600" height="80" style="display:block"> </td>
                             </tr>
                             <tr>
                                 <td style="padding:23px 0 40px 0; color:#555; font-size:16px; text-align:justify; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif">
                                     <p style="padding:0 0 10px 0">Nova <b>Solicitação de Acesso</b> no Portal Metaro:</p>
                                        <ul style="list-style: none">
                                            <li><b>Nome:</b> %s</li>
                                            <li><b>E-mail:</b> %s</li>
                                        </ul>
                                     </p>
                                     <p style="padding:16px 0 0 0">
                                        Esse e-mail é gerado de forma automática através do <b>Portal Metaro</b>, com uma nova solicitação de acesso.
                                     </p>
                                     <p style="padding:0 0 10px 0">
                                        Caso tenha alguma dúvida, entre em contato pelo número <span style="color: rgb(0, 104, 165); font-family: Arial, &quot;Helvetica Neue&quot;, Helvetica, sans-serif, serif, EmojiFont;">(54) 2106-0260</span>
                                        ou pelo e-mail <span style="color: rgb(0, 104, 165); font-family: Arial, &quot;Helvetica Neue&quot;, Helvetica, sans-serif, serif, EmojiFont;">ti@metaro.com.br</span> para falar com o administrador.
                                     </p>
                                 </td>
                             </tr>
                         </tbody>
                     </table>
                </div>
            """.formatted(dto.getName(), dto.getEmail());
        emailService.sendHtmlEmail(mailConfigService.getRecipient(),
                "Requisição de acesso - %s".formatted(dto.getName()), message,
                "Solicitação de acesso");
    }
}
