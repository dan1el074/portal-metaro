package br.com.metaro.portal.util.email;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import lombok.RequiredArgsConstructor;

import java.util.Collection;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class EmailService {
    private final JavaMailSender mailSender;
    private final EmailLogService emailLogService;

    @Value("${spring.mail.username}")
    private String mailFrom;

    public void sendHtmlEmail(String para, String assunto, String html, String module) throws Exception {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);

            helper.setTo(para);
            helper.setSubject(assunto);
            helper.setText(EmailCssInliner.inline(html), true);
            helper.setFrom(new InternetAddress(mailFrom, "Portal Metaro"));

            mailSender.send(message);
        } catch (Exception exception) {
            emailLogService.record(para, assunto, module, EmailStatus.ERROR, exception);
            throw exception;
        }
        emailLogService.record(para, assunto, module, EmailStatus.SENT, null);
    }

    public void sendHtmlEmailBcc(Collection<String> bcc, String subject, String html, String module) throws Exception {
        String[] recipients = bcc == null ? new String[0] : bcc.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(StringUtils::hasText)
                .distinct()
                .toArray(String[]::new);

        if (recipients.length == 0) return;

        String recipientLog = String.join(", ", recipients);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);

            helper.setTo(mailFrom);
            helper.setBcc(recipients);
            helper.setSubject(subject);
            helper.setText(EmailCssInliner.inline(html), true);
            helper.setFrom(new InternetAddress(mailFrom, "Portal Metaro"));

            mailSender.send(message);
        } catch (Exception exception) {
            emailLogService.record(recipientLog, subject, module, EmailStatus.ERROR, exception);
            throw exception;
        }
        emailLogService.record(recipientLog, subject, module, EmailStatus.SENT, null);
    }

    public void sendPlainTextEmail(String to, String cc, String subject, String text, String module) throws Exception {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            helper.setTo(to);
            if (StringUtils.hasText(cc)) helper.setCc(cc);
            helper.setSubject(subject);
            helper.setText(text, false);
            helper.setFrom(new InternetAddress(mailFrom, "Portal Metaro"));

            mailSender.send(message);
        } catch (Exception exception) {
            emailLogService.record(to, subject, module, EmailStatus.ERROR, exception);
            throw exception;
        }
        emailLogService.record(to, subject, module, EmailStatus.SENT, null);
    }
}
