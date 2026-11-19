package br.com.metaro.portal.modules.pcp.serialplates.repository;

import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistSerialOptionDto;
import br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlate;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface SerialPlateRepository extends JpaRepository<SerialPlate, Long>, JpaSpecificationExecutor<SerialPlate> {
    @Query("""
        select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistSerialOptionDto(cast(p.serial as string), p.description) from SerialPlate p where
        ((:readyStock = true and p.readyStock = true) or
         (:readyStock = false and p.readyStock = false and p.order = :orderNumber
          and p.orderItemCode = :itemCode and p.client <> ''))
        and not exists (select f.id from ChecklistFlow f where f.cancelled = false
          and (f.serialPlateId = p.serial or f.normalizedSerial = cast(p.serial as string)))
        order by p.serial
        """)
    List<ChecklistSerialOptionDto> findAvailableForChecklist(String orderNumber, String itemCode, boolean readyStock);

    @Query("""
        select new br.com.metaro.portal.modules.pcp.serialplates.dto.SerialPlateBatchRowDto(
          cast(p.serial as string), p.version, (p.client <> '' or p.description <> '' or p.voltage <> ''
          or p.capacity is not null or p.weight is not null))
        from SerialPlate p where p.serial in :ids order by p.serial
        """)
    List<br.com.metaro.portal.modules.pcp.serialplates.dto.SerialPlateBatchRowDto> batchRows(List<Long> ids);

    @Query("""
        select new br.com.metaro.portal.modules.pcp.serialplates.dto.SerialPlateReportRowDto(
          cast(p.serial as string), p.description, p.manufactured, p.voltage, p.weight)
        from SerialPlate p where p.serial in :ids order by p.serial
        """)
    List<br.com.metaro.portal.modules.pcp.serialplates.dto.SerialPlateReportRowDto> reportRows(List<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from SerialPlate p where p.serial = :serial")
    Optional<SerialPlate> findLockedBySerial(@Param("serial") Long serial);

    @Query("select max(p.serial) from SerialPlate p")
    Long findMaximumSerial();

    @Query("select p.status, count(p) from SerialPlate p group by p.status")
    List<Object[]> countByStatus();
}
