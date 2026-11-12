package br.com.metaro.portal.modules.quality.checklist;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class ChecklistListingMigrationTests {
    @Test
    void createsListingSchemaAndDefaultsDepartmentsToAllUsingSql() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:checklist-list-" + UUID.randomUUID() + ";MODE=PostgreSQL");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tb_checklist_record (id BIGINT PRIMARY KEY, template_id BIGINT, updated_at TIMESTAMP)");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V26__checklist_listing_and_departments.sql"));
            statement.execute("INSERT INTO tb_checklist_record (id, template_id, listing_title) VALUES (1, 7, 'Pedido 900')");
            try (var rows = statement.executeQuery("SELECT listing_title FROM tb_checklist_record WHERE id = 1")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isEqualTo("Pedido 900");
            }
            try (var rows = statement.executeQuery("SELECT department_ids_json FROM tb_checklist_settings WHERE id = 1")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isNull();
            }
        }
    }
}
