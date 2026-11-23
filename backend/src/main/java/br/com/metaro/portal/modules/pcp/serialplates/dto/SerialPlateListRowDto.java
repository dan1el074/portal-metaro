package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.Getter;
import java.time.Instant;

@Getter
public class SerialPlateListRowDto {
    private final String serial;
    private final String of;
    private final String order;
    private final Boolean readyStock;
    private final String client;
    private final String description;
    private final String provider;
    private final String status;
    private final String notes;
    private final Instant updated;

    public SerialPlateListRowDto(Long serial, String of, String order, Boolean readyStock, String client,
                                 String description, String provider, String status, String notes, Instant updated) {
        this.serial = serial.toString();
        this.of = of;
        this.order = order;
        this.readyStock = readyStock;
        this.client = client;
        this.description = description;
        this.provider = provider;
        this.status = status;
        this.notes = notes;
        this.updated = updated;
    }
}
