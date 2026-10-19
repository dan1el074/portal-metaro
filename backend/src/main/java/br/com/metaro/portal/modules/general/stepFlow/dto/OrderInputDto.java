package br.com.metaro.portal.modules.general.stepFlow.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class OrderInputDto {
    private String carrier;
    private String shippment;
    private String comment;
    private String cancelled;
    private Integer newStepId;
    private List<OrderItemInputDto> items;
    private MultipartFile[] images;
}
