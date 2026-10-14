package br.com.metaro.portal.modules.general.stepFlow.dto;

import br.com.metaro.portal.modules.general.stepFlow.entities.*;
import br.com.metaro.portal.util.picture.Picture;
import br.com.metaro.portal.util.video.Video;
import br.com.metaro.portal.util.video.VideoStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
public class OrderDto {
    private Long id;
    private String number;
    private String status;
    private String client;
    private String cnpj;
    private String phone;
    private String seller;
    private LocalDate startDate;
    private LocalDate dueDate;
    private String address;
    private List<OrderStepDto> steps;
    private List<OrderItemDto> items;
    private Double subtotal;
    private Double discount;
    private Double shipment;
    private String carrier;
    private List<OrderVolumeDto> volumes;
    private Double total;
    private List<ImageDto> pictures;
    private List<StepFlowVideoDto> videos;
    private String currentStep;
    private String nextStep;

    public OrderDto(Order entity) {
        id = entity.getId();
        number = entity.getDisplayNumber();
        status = entity.getStatus().toString();
        client = entity.getClient();
        cnpj = entity.getCnpj();
        phone = entity.getPhone();
        seller = entity.getSeller();
        startDate = entity.getStartDate();
        dueDate = entity.getDueDate();
        address = entity.getAddress();
        subtotal = entity.getSubtotal();
        discount = entity.getDiscount();
        shipment = entity.getShipment();
        carrier = entity.getCarrier();
        volumes = entity.getVolumes().stream().map(OrderVolumeDto::new).toList();
        total = entity.getTotal();
        currentStep = entity.getCurrentStep().toString();
        steps = new ArrayList<>();
        items = new ArrayList<>();
        pictures = new ArrayList<>();
        videos = new ArrayList<>();
        nextStep = "";

        if (entity.getStatus().equals(OrderStatus.IN_PROGRESS)
                && entity.getDueDate() != null
                && entity.getDueDate().isBefore(LocalDate.now())) {
            status = OrderStatus.LATE.toString();
        }

        if (!entity.getCurrentStep().equals(StepType.SHIPPING)) {
            nextStep = StepType.values()[entity.getCurrentStep().ordinal() + 1].toString();
        }

        for (OrderStep orderStep: entity.getSteps()) {
            steps.add(new OrderStepDto(orderStep));
        }

        for (OrderItem orderItem: entity.getItems()) {
            items.add(new OrderItemDto(orderItem));
        }

        for (OrderStep orderStep : entity.getSteps()) {
            boolean isCurrentStep = orderStep.getStep().equals(entity.getCurrentStep());

            for (Picture picture : orderStep.getPictures()) {
                pictures.add(new ImageDto(picture, isCurrentStep));
            }

            for (Video video : orderStep.getVideos()) {
                if (!video.getStatus().equals(VideoStatus.READY)) continue;
                videos.add(new StepFlowVideoDto(video, isCurrentStep));
            }
        }
    }
}
