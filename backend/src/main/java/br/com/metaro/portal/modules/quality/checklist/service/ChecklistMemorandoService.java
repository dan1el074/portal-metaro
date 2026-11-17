package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistMemorandoDto;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistFlow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChecklistMemorandoService {
    private final MemorandoRepository repository;

    @Transactional(readOnly = true)
    public List<ChecklistMemorandoDto> findRelated(ChecklistFlow flow, User user) {
        boolean admin = user.hasRole("ROLE_ADMIN");
        if (!admin && !user.hasRole("ROLE_MEMORANDO")) return List.of();

        BigInteger order = numericValue(flow.getOrderNumber());
        BigInteger itemCode = itemCode(flow.getCommercialItem());
        if (order == null || order.signum() <= 0 || order.bitLength() > 63 || itemCode == null) return List.of();

        return repository.findAccessibleByRequest(order.longValueExact(), admin, user.getId()).stream()
                .filter(memorando -> memorando.getItems() != null && memorando.getItems().stream()
                        .anyMatch(item -> itemCode.equals(itemCode(item))))
                .map(memorando -> new ChecklistMemorandoDto(memorando.getId(), memorando.getNumber(),
                        memorando.getTitle(), memorando.getCreateAt(), memorando.getStatus()))
                .toList();
    }

    private BigInteger itemCode(String item) {
        if (item == null) return null;
        return numericValue(item.split("-", 2)[0]);
    }

    private BigInteger numericValue(String value) {
        if (value == null || !value.trim().matches("[0-9]+")) return null;
        return new BigInteger(value.trim());
    }
}
