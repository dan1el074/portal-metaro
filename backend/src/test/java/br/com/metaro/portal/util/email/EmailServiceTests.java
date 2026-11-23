package br.com.metaro.portal.util.email;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailServiceTests {
    private JavaMailSender mailSender;
    private EmailLogService emailLogService;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        mailSender = mock(JavaMailSender.class);
        emailLogService = mock(EmailLogService.class);
        emailService = new EmailService(mailSender, emailLogService);
        ReflectionTestUtils.setField(emailService, "mailFrom", "portal@metaro.com.br");
    }

    @Test
    void sendsOneMessageWithRecipientsInBlindCopy() throws Exception {
        MimeMessage message = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(message);

        emailService.sendHtmlEmailBcc(
                List.of("one@example.com", "two@example.com", "one@example.com"),
                "Assunto",
                "<p>Conteúdo</p>",
                "Teste"
        );

        verify(mailSender).send(message);
        assertThat(message.getRecipients(Message.RecipientType.TO))
                .extracting(address -> ((InternetAddress) address).getAddress())
                .containsExactly("portal@metaro.com.br");
        assertThat(message.getRecipients(Message.RecipientType.BCC))
                .extracting(address -> ((InternetAddress) address).getAddress())
                .containsExactly("one@example.com", "two@example.com");
        assertThat(message.getRecipients(Message.RecipientType.CC)).isNull();
        verify(emailLogService).record(
                "one@example.com, two@example.com",
                "Assunto",
                "Teste",
                EmailStatus.SENT,
                null
        );
    }

    @Test
    void doesNotSendWhenThereAreNoValidRecipients() throws Exception {
        emailService.sendHtmlEmailBcc(List.of("", "  "), "Assunto", "<p>Conteúdo</p>", "Teste");

        verify(mailSender, never()).createMimeMessage();
    }
}
