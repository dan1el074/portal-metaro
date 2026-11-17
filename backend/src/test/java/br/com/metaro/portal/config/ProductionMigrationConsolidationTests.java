package br.com.metaro.portal.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.*;

class ProductionMigrationConsolidationTests {
    @Test
    void preservesEveryDeployedMigrationIncludingTheOriginalVolumeMigrationAtV17() throws Exception {
        Properties deployed = new Properties();
        try (var input = new ClassPathResource("migrations/production-v17-sha256.properties").getInputStream()) {
            deployed.load(input);
        }
        assertThat(deployed).hasSize(18);
        for (String path : deployed.stringPropertyNames()) {
            String sql = new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8).replace("\r\n", "\n");
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sql.getBytes(StandardCharsets.UTF_8)));
            assertThat(hash).as(path).isEqualTo(deployed.getProperty(path));
        }
    }

    @Test
    void upgradesTheProductionV17BaselineUsingOnlyThreePendingMigrationsWithoutLosingExistingData() throws Exception {
        String url = databaseUrl();
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V1__initial_schema.sql"));
        }
        Flyway checkpoint = Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration")
                .baselineOnMigrate(true).baselineVersion("1").target("17").load();
        checkpoint.migrate();
        Map<String, Integer> checksums = Arrays.stream(checkpoint.info().applied())
                .filter(info -> info.getChecksum() != null)
                .collect(Collectors.toMap(info -> info.getVersion().toString(), MigrationInfo::getChecksum));
        try (Connection connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            statement.execute("INSERT INTO tb_memorando (number, title, description, status) VALUES (406, 'Documento existente', 'Texto original', 'PUBLISH')");
            statement.execute("INSERT INTO tb_picture (name, type) VALUES ('foto existente', 'POST')");
            statement.execute("ALTER TABLE tb_picture ADD CONSTRAINT tb_picture_type_check CHECK (type IN ('EVENT','POST','PROFILE','STEP_FLOW'))");
        }
        Flyway upgrade = flyway(url);
        assertThat(Arrays.stream(upgrade.info().pending()).map(info -> info.getVersion().toString()).toList())
                .containsExactly("18", "19", "20");
        assertThat(upgrade.migrate().migrationsExecuted).isEqualTo(3);
        upgrade.validate();
        for (MigrationInfo applied : upgrade.info().applied()) {
            if (checksums.containsKey(applied.getVersion().toString())) {
                assertThat(applied.getChecksum()).isEqualTo(checksums.get(applied.getVersion().toString()));
            }
        }
        try (Connection connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT number, title, description FROM tb_memorando")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getLong(1)).isEqualTo(406);
                assertThat(rows.getString(2)).isEqualTo("Documento existente"); assertThat(rows.getString(3)).isEqualTo("Texto original");
            }
            try (var rows = statement.executeQuery("SELECT name, type FROM tb_picture")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isEqualTo("foto existente");
                assertThat(rows.getString(2)).isEqualTo("POST");
            }
            statement.execute("INSERT INTO tb_picture (name, type) VALUES ('evidência', 'CHECKLIST')");
            assertThatThrownBy(() -> statement.execute("INSERT INTO tb_picture (type) VALUES ('INVALID')")).isInstanceOf(SQLException.class);
            assertFinalSchema(connection);
        }
        assertThat(upgrade.migrate().migrationsExecuted).isZero();
    }

    @Test
    void createsTheSameFinalSchemaForANewInstallationWithoutObsoleteColumnsOrConversionTables() throws Exception {
        String url = databaseUrl();
        Flyway fresh = flyway(url); fresh.migrate(); fresh.validate();
        assertThat(fresh.info().current().getVersion().toString()).isEqualTo("20");
        try (Connection connection = DriverManager.getConnection(url, "sa", "")) {
            assertFinalSchema(connection);
        }
    }

    private void assertFinalSchema(Connection connection) throws Exception {
        try (var statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeQuery("SELECT order_item FROM tb_serial_plate")).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> statement.executeQuery("SELECT * FROM tb_serial_plate_item_code_pending")).isInstanceOf(SQLException.class);
            try (var rows = statement.executeQuery("SELECT * FROM tb_serial_plate")) { assertThat(rows.next()).isFalse(); }
            try (var rows = statement.executeQuery("SELECT department_ids_json FROM tb_checklist_settings WHERE id = 1")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isNull();
            }
            try (var rows = statement.executeQuery("SELECT COUNT(*) FROM tb_checklist_catalog_entry WHERE type = 'ITEM'")) {
                rows.next(); assertThat(rows.getInt(1)).isEqualTo(89);
            }
            try (var rows = statement.executeQuery("SELECT COUNT(*) FROM tb_checklist_catalog_entry WHERE type = 'DEFECT'")) {
                rows.next(); assertThat(rows.getInt(1)).isEqualTo(52);
            }
            try (var rows = statement.executeQuery("SELECT content FROM tb_param WHERE name = 'serialPlates.reportColumns'")) {
                rows.next(); assertThat(rows.getString(1)).isEqualTo("serial,description,manufactured,voltage,crea,weight");
            }
            statement.execute("INSERT INTO tb_serial_plate (serial, manufacturing_order, order_number, order_item_code, manufactured, updated) VALUES (18918, '8301', '765', '60289', '2026-11', CURRENT_TIMESTAMP)");
            statement.execute("UPDATE tb_serial_plate SET status = 'Devolvido' WHERE serial = 18918");
            assertThatThrownBy(() -> statement.execute("UPDATE tb_serial_plate SET ready_stock = TRUE WHERE serial = 18918")).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> statement.execute("UPDATE tb_serial_plate SET status = 'INVALID' WHERE serial = 18918")).isInstanceOf(SQLException.class);
            statement.execute("INSERT INTO tb_memorando_log (content) VALUES ('" + "Histórico longo ".repeat(50) + "')");
            statement.executeQuery("SELECT listing_title FROM tb_checklist_record").close();
            statement.executeQuery("SELECT optional_predecessor FROM tb_checklist_template").close();
            statement.executeQuery("SELECT media_enabled FROM tb_checklist_category").close();
            statement.executeQuery("SELECT serial_plate_id, lock_version, erp_data_json FROM tb_checklist_flow").close();
            statement.executeQuery("SELECT published_snapshot_json FROM tb_memorando").close();
            statement.executeQuery("SELECT * FROM tb_stepflow_order_volume").close();
        }
    }

    private Flyway flyway(String url) {
        return Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration").load();
    }

    private String databaseUrl() {
        return "jdbc:h2:mem:production-migrations-" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
    }
}
