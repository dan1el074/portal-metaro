package br.com.metaro.portal.modules.general.memorando.dto;

import br.com.metaro.portal.util.erp.ErpSource;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class MemorandoPublicationSnapshotDto {
    private Long request;
    private ErpSource erpSource;
    private String client;
    private List<String> items;
    private String title;
    private String description;
    private String reason;
    private Map<Long, String> departments;
}
