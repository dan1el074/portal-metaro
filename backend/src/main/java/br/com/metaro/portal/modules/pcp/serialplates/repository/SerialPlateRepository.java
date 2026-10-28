package br.com.metaro.portal.modules.pcp.serialplates.repository;

import br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlate;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface SerialPlateRepository extends JpaRepository<SerialPlate, Long>, JpaSpecificationExecutor<SerialPlate> {
    @Query("""
        select p from SerialPlate p where
        ((:readyStock = true and p.readyStock = true) or
         (:readyStock = false and p.readyStock = false and p.order = :orderNumber
          and p.client <> '' and p.orderItem <> ''))
        and not exists (select f.id from ChecklistFlow f where f.cancelled = false
          and (f.serialPlateId = p.serial or f.normalizedSerial = cast(p.serial as string)))
        order by p.serial
        """)
    List<SerialPlate> findAvailableForChecklist(String orderNumber, boolean readyStock);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from SerialPlate p where p.serial = :serial")
    Optional<SerialPlate> findLockedBySerial(@Param("serial") Long serial);

    @Query("select max(p.serial) from SerialPlate p")
    Long findMaximumSerial();

    @Query("select p.status, count(p) from SerialPlate p group by p.status")
    List<Object[]> countByStatus();
}
