package br.com.metaro.portal.modules.quality.checklist;

import br.com.metaro.portal.modules.quality.checklist.service.ChecklistRecordTitle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "TEST_POSTGRES_URL", matches = ".+")
class ChecklistListingPostgresqlMigrationTests {
    @Test
    void backfillsFrozenTitlesUsingSqlWithTheSameSemanticsAsTheApplication() throws Exception {
        String schema = "checklist_migration_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(System.getenv("TEST_POSTGRES_URL"),
                System.getenv().getOrDefault("TEST_POSTGRES_USER", "postgres"),
                System.getenv().getOrDefault("TEST_POSTGRES_PASSWORD", ""))) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("CREATE SCHEMA " + schema);
                statement.execute("SET LOCAL search_path TO " + schema);
                statement.execute("CREATE TABLE tb_checklist_flow (id BIGINT PRIMARY KEY, plan_json TEXT, serial_number TEXT, order_number TEXT, client_name TEXT, commercial_item TEXT, salesperson TEXT)");
                statement.execute("CREATE TABLE tb_checklist_record (id BIGINT PRIMARY KEY, flow_id BIGINT, template_id BIGINT, answers_json TEXT, created_at TIMESTAMP, updated_at TIMESTAMP, status TEXT)");
                String plan = """
                    [{"template":{"id":7,"name":"Original","title":"Pedido %pedido / %1.1 / {q} / %serie / %data / {desconhecido}","sections":[{"questions":[{"id":"q","fields":[{"id":"f"}]}]}]}}]
                    """;
                String answers = """
                    {"q":{"fields":{"f":"A$1\\\\B %pedido"}}}
                    """;
                try (var insert = connection.prepareStatement("INSERT INTO tb_checklist_flow VALUES (1, ?, NULL, '900', 'Cliente', 'Item', 'Vendedor')")) {
                    insert.setString(1, plan); insert.executeUpdate();
                }
                try (var insert = connection.prepareStatement("INSERT INTO tb_checklist_record VALUES (?, 1, 7, ?, '2026-11-12 12:00:00', CURRENT_TIMESTAMP, ?)")) {
                    for (int id = 1; id <= 251; id++) {
                        insert.setInt(1, id); insert.setString(2, answers);
                        insert.setString(3, id == 251 ? "JUSTIFIED" : "IN_PROGRESS"); insert.addBatch();
                    }
                    insert.executeBatch();
                }
                for (String file : new String[] { "db/migration/V26__checklist_listing_and_departments.sql",
                        "db/postgresql/V26.1__backfill_checklist_listing_titles.sql" }) {
                    statement.execute(new ClassPathResource(file).getContentAsString(StandardCharsets.UTF_8));
                }
                try (var rows = statement.executeQuery("SELECT id, listing_title FROM tb_checklist_record ORDER BY id")) {
                    int count = 0;
                    while (rows.next()) {
                        long id = rows.getLong(1);
                        assertThat(rows.getString(2)).isEqualTo(ChecklistRecordTitle.render(plan, 7,
                                id == 251 ? "{}" : answers, Instant.parse("2026-11-12T12:00:00Z"), id,
                                null, "900", "Cliente", "Item", "Vendedor"));
                        count++;
                    }
                    assertThat(count).isEqualTo(251);
                }
            } finally {
                // The schema, fixtures and migration effects are all isolated in this transaction.
                connection.rollback();
            }
        }
    }
}
