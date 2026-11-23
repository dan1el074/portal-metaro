package br.com.metaro.portal.modules.general.memorando.service;

import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class MemorandoPublicationHistoryTests {
    private final MemorandoPublicationHistoryService history = new MemorandoPublicationHistoryService(new ObjectMapper());

    @Test
    void describesOnlyChangedFieldsAndDoesNotIncludeTheDescriptionText() {
        Memorando entity = document(); history.capture(entity);
        entity.setTitle("Componente elétrico teste."); entity.setDescription("Descrição nova e extensa."); entity.setReason("Motivo teste.");
        assertThat(history.publicationMessage(entity, true)).isEqualTo("""
                Republicou o documento nº 406/2026
                Título: Componente elétrico -> Componente elétrico teste.
                Descrição alterada.
                Motivo: Manter o padrão de montagem -> Motivo teste.""");
    }

    @Test
    void keepsFirstPublicationAndUnchangedRepublicationAsSingleEntries() {
        Memorando entity = document(); history.capture(entity);
        assertThat(history.publicationMessage(entity, false)).isEqualTo("Publicou o documento nº 406/2026");
        assertThat(history.publicationMessage(entity, true)).isEqualTo("Republicou o documento nº 406/2026");
    }

    @Test
    void includesChangedOrderClientItemsAndDepartments() {
        Memorando entity = document(); history.capture(entity);
        entity.setRequest(752L); entity.setClient("Outro cliente"); entity.setItems(List.of("Item novo"));
        Position position = new Position(); position.setId(2L); position.setName("Qualidade"); entity.setFromDepartments(List.of(position));
        assertThat(history.publicationMessage(entity, true)).contains("Pedido: 751 -> 752", "Cliente: Cliente -> Outro cliente",
                "Itens: Item original -> Item novo", "Departamentos: PCP -> Qualidade");
    }

    @Test
    void comparesEachRepublicationAgainstItsOwnPublishedVersion() {
        Memorando entity = document(); history.capture(entity);
        entity.setTitle("Primeira revisão"); history.capture(entity);
        entity.setTitle("Segunda revisão");
        assertThat(history.publicationMessage(entity, true)).contains("Título: Primeira revisão -> Segunda revisão")
                .doesNotContain("Componente elétrico");
    }

    private Memorando document() {
        Memorando entity = new Memorando(); entity.setNumber(406L); entity.setRequest(751L); entity.setClient("Cliente");
        entity.setCreateAt(Instant.parse("2026-11-16T12:00:00Z")); entity.setTitle("Componente elétrico");
        entity.setDescription("Descrição original extensa"); entity.setReason("Manter o padrão de montagem");
        entity.setItems(new ArrayList<>(List.of("Item original")));
        Position position = new Position(); position.setId(1L); position.setName("PCP"); entity.setFromDepartments(List.of(position));
        return entity;
    }
}
