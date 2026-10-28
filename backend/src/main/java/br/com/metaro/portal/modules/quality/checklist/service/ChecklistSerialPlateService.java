package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlate;
import br.com.metaro.portal.modules.pcp.serialplates.repository.SerialPlateRepository;
import br.com.metaro.portal.modules.pcp.serialplates.dto.SerialPlateRelocationDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistSerialOptionDto;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import br.com.metaro.portal.util.erp.ErpOrderQueryService;
import br.com.metaro.portal.util.erp.ErpSource;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChecklistSerialPlateService {
    private final SerialPlateRepository plateRepository;
    private final ChecklistFlowRepository flowRepository;
    private final ChecklistRecordRepository recordRepository;
    private final ChecklistAuditRepository auditRepository;
    private final ChecklistStepBindingRepository bindingRepository;
    private final ChecklistStepFlowService stepFlowService;
    private final ChecklistMapper mapper;
    private final ErpOrderQueryService erp;

    @Transactional(readOnly = true)
    public List<ChecklistSerialOptionDto> listAvailable(String order, boolean readyStock) {
        if (!readyStock && (order == null || !order.matches("[0-9]{1,15}"))) return List.of();
        return plateRepository.findAvailableForChecklist(readyStock ? "" : canonicalOrder(order), readyStock).stream()
                .map(plate -> new ChecklistSerialOptionDto(plate.getSerial().toString(), plate.getDescription())).toList();
    }

    // The plate lock serializes reservations with PCP mutations; the unique FK also protects the database.
    @Transactional
    public void assignSerial(ChecklistFlow flow, String value, boolean readyStock) {
        Long serial;
        try {
            serial = Long.valueOf(value);
        } catch (NumberFormatException exception) {
            throw invalid("Selecione um número de série cadastrado em Nº Série/Plaquetas.");
        }
        SerialPlate plate = plateRepository.findLockedBySerial(serial)
                .orElseThrow(() -> invalid("Número de série não encontrado em Nº Série/Plaquetas."));
        ChecklistFlow reserved = findActiveFlow(serial).orElse(null);
        if (reserved != null && !Objects.equals(reserved.getId(), flow.getId())) {
            throw invalid("Este número de série já foi utilizado em outro fluxo de checklist. Atualize a lista.");
        }
        if (!eligible(plate, flow.getOrderNumber(), readyStock)) {
            throw invalid("O número de série não está disponível para este pedido ou para Pronta Entrega.");
        }
        flow.setSerialPlateId(serial);
        flow.setSerialNumber(serial.toString());
        flow.setNormalizedSerial(serial.toString());
        flow.setReadyStock(readyStock);
        flow.setSerialWaived(false);
        if (readyStock) flow.setCommercialItem(plate.getDescription());
        flow.setErpDataJson(mapper.write(equipmentData(plate, plate.getDescription())));
    }

    @Transactional(readOnly = true)
    public Optional<ChecklistFlow> findActiveFlow(Long serial) {
        return flowRepository.findBySerialPlateIdAndCancelledFalse(serial)
                .or(() -> flowRepository.findByNormalizedSerial(serial.toString()).filter(flow -> !flow.isCancelled()));
    }

    @Transactional(readOnly = true)
    public Optional<SerialPlateRelocationDto> relocationImpact(Long serial, String newOrder) {
        return findActiveFlow(serial).filter(flow -> !canonicalOrder(flow.getOrderNumber()).equals(canonicalOrder(newOrder)))
                .map(flow -> new SerialPlateRelocationDto(serial.toString(), newOrder,
                        bindingRepository.findByFlowId(flow.getId()).stream().map(binding -> binding.getOrder().getDisplayNumber()).toList()))
                .filter(impact -> !impact.getStepFlows().isEmpty());
    }

    @Transactional
    public void synchronizePlate(SerialPlate plate, String itemLabel, User actor, boolean confirmed) {
        ChecklistFlow flow = findActiveFlow(plate.getSerial()).orElse(null);
        if (flow == null) return;
        String newOrder = plate.getReadyStock() ? "" : canonicalOrder(plate.getOrder());
        boolean orderChanged = !canonicalOrder(flow.getOrderNumber()).equals(newOrder);
        if (!plate.getReadyStock() && (newOrder.isBlank() || plate.getOrderItem().isBlank() || plate.getClient().isBlank())) {
            throw invalid("A série possui checklist vinculado. Informe pedido, cliente e item válidos ou marque Pronta Entrega.");
        }
        if (orderChanged && !bindingRepository.findByFlowId(flow.getId()).isEmpty()) {
            if (!confirmed) throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Confirme a realocação: o equipamento será removido do Fluxo de Etapas antigo e os fluxos abertos serão encaminhados ao PCP.");
            stepFlowService.relocateEquipment(flow, newOrder, actor);
        }
        Map<String, String> before = identification(flow);
        Map<String, String> oldEquipment = mapper.read(flow.getErpDataJson(), new TypeReference<>() {});
        String label = itemLabel != null ? itemLabel : oldEquipment.getOrDefault("Item do pedido", plate.getDescription());
        Map<String, String> equipment = equipmentData(plate, label);
        flow.setSerialPlateId(plate.getSerial());
        flow.setReadyStock(plate.getReadyStock());
        flow.setOrderNumber(newOrder.isBlank() ? null : newOrder);
        flow.setClientName(plate.getReadyStock() ? null : plate.getClient());
        if (orderChanged || plate.getReadyStock() || itemLabel != null) {
            ErpOrderDto order = newOrder.isBlank() ? null : findOrder(newOrder);
            flow.setClientId(order == null ? null : order.getCnpj());
            flow.setSalesperson(order == null ? null : order.getSalesperson());
            if (order != null) flow.setCommercialItem(resolveCommercialItem(order, plate, label));
        }
        if (plate.getReadyStock()) flow.setCommercialItem(plate.getDescription());
        flow.setErpDataJson(mapper.write(equipment));
        Map<String, String> after = identification(flow);
        List<String> changes = new ArrayList<>();
        after.forEach((field, value) -> {
            if (!Objects.equals(before.get(field), value)) changes.add(field + ": " + display(before.get(field)) + " → " + display(value));
        });
        equipment.forEach((field, value) -> {
            if (!Objects.equals(oldEquipment.get(field), value)) changes.add(field + ": " + display(oldEquipment.get(field)) + " → " + display(value));
        });
        if (!changes.isEmpty()) {
            flow.setUpdatedAt(Instant.now());
            flowRepository.save(flow);
            for (ChecklistRecord record : recordRepository.findByFlowId(flow.getId())) {
                ChecklistAudit audit = new ChecklistAudit();
                audit.setRecord(record);
                audit.setActor(actor);
                audit.setActorName(actor.getName());
                audit.setAction("SERIAL_PLATE_UPDATED");
                audit.setDetails("Atualização por Nº Série/Plaquetas (PCP), série " + plate.getSerial() + ". " + String.join("; ", changes));
                audit.setCreatedAt(flow.getUpdatedAt());
                auditRepository.save(audit);
            }
        }
    }

    private ErpOrderDto findOrder(String number) {
        try {
            return erp.findProductionOrderByNumber(Integer.parseInt(number), ErpSource.FOCCO)
                    .orElseThrow(() -> invalid("Pedido não encontrado no ERP."));
        } catch (NumberFormatException exception) {
            throw invalid("Número de pedido inválido para integração com o checklist.");
        }
    }

    private String resolveCommercialItem(ErpOrderDto order, SerialPlate plate, String label) {
        var matches = order.getItems().stream().filter(item ->
                label.equalsIgnoreCase(item.getCode() + " - " + item.getDescription())
                || label.equalsIgnoreCase(item.getDescription() + " - " + plate.getDescription())
                || plate.getDescription().equalsIgnoreCase(item.getDescription())).toList();
        if (matches.isEmpty() && order.getItems().size() == 1) matches = order.getItems();
        if (matches.size() != 1) throw invalid("Não foi possível identificar unicamente o item comercial do checklist no ERP. Verifique as descrições do pedido e da plaqueta.");
        var item = matches.getFirst();
        return item.getCode() + " - " + item.getDescription();
    }

    private Map<String, String> identification(ChecklistFlow flow) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("Pedido", Objects.toString(flow.getOrderNumber(), ""));
        data.put("Cliente", Objects.toString(flow.getClientName(), ""));
        data.put("Documento do cliente", Objects.toString(flow.getClientId(), ""));
        data.put("Item", Objects.toString(flow.getCommercialItem(), ""));
        data.put("Vendedor", Objects.toString(flow.getSalesperson(), ""));
        data.put("Pronta Entrega", flow.isReadyStock() ? "Sim" : "Não");
        return data;
    }

    private Map<String, String> equipmentData(SerialPlate plate, String itemLabel) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("Item do pedido", Objects.toString(itemLabel, ""));
        data.put("Modelo", plate.getDescription());
        data.put("Capacidade", Objects.toString(plate.getCapacity(), ""));
        data.put("Voltagem", plate.getVoltage());
        data.put("Peso", Objects.toString(plate.getWeight(), ""));
        return data;
    }

    private boolean eligible(SerialPlate plate, String order, boolean readyStock) {
        return readyStock ? plate.getReadyStock() : !plate.getReadyStock()
                && !plate.getOrder().isBlank() && !plate.getOrderItem().isBlank() && !plate.getClient().isBlank()
                && canonicalOrder(plate.getOrder()).equals(canonicalOrder(order));
    }

    private String canonicalOrder(String value) {
        return value == null || value.isBlank() ? "" : value.trim().replaceFirst("^0+(?!$)", "");
    }

    private String display(String value) {
        return value == null || value.isBlank() ? "(vazio)" : value;
    }

    private UnprocessableEntityException invalid(String message) {
        return new UnprocessableEntityException(message);
    }
}
