package br.com.metaro.portal.modules.pcp.serialplates.repository;

import br.com.metaro.portal.modules.pcp.serialplates.entity.SerialPlateLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SerialPlateLogRepository extends JpaRepository<SerialPlateLog, Long> {
    List<SerialPlateLog> findBySerialOrderByAtDescIdDesc(Long serial);
}
