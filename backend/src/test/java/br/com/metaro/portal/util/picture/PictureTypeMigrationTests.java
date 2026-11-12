package br.com.metaro.portal.util.picture;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class PictureTypeMigrationTests {
    @Test
    void upgradesLegacyConstraintAndPreservesExistingPictures() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:picture-types-" + UUID.randomUUID() + ";MODE=PostgreSQL");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tb_picture (id BIGINT PRIMARY KEY, name VARCHAR(255), type VARCHAR(32), "
                    + "CONSTRAINT tb_picture_type_check CHECK (type IN ('EVENT','POST','PROFILE','STEP_FLOW')))");
            statement.execute("INSERT INTO tb_picture VALUES (1, 'existing.jpg', 'POST')");
            assertThatThrownBy(() -> statement.execute("INSERT INTO tb_picture VALUES (2, 'evidence.jpg', 'CHECKLIST')"))
                    .isInstanceOf(SQLException.class);

            statement.execute("CREATE TABLE tb_param (name VARCHAR(255), content TEXT)");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V25__configure_serial_plate_reports_and_checklist_images.sql"));
            for (PictureType type : PictureType.values()) {
                statement.execute("INSERT INTO tb_picture VALUES (" + (type.ordinal() + 2) + ", 'evidence.jpg', '" + type.name() + "')");
            }
            try (var result = statement.executeQuery("SELECT name, type FROM tb_picture WHERE id = 1")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("existing.jpg");
                assertThat(result.getString(2)).isEqualTo("POST");
            }
            assertThatThrownBy(() -> statement.execute("INSERT INTO tb_picture VALUES (99, 'invalid.jpg', 'INVALID')"))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void alsoAppliesToSchemasWithoutTheLegacyConstraint() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:picture-types-new-" + UUID.randomUUID() + ";MODE=PostgreSQL");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tb_picture (id BIGINT PRIMARY KEY, type VARCHAR(32))");
            statement.execute("CREATE TABLE tb_param (name VARCHAR(255), content TEXT)");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V25__configure_serial_plate_reports_and_checklist_images.sql"));
            statement.execute("INSERT INTO tb_picture VALUES (1, 'CHECKLIST')");
            assertThatThrownBy(() -> statement.execute("INSERT INTO tb_picture VALUES (2, 'INVALID')"))
                    .isInstanceOf(SQLException.class);
        }
    }
}
