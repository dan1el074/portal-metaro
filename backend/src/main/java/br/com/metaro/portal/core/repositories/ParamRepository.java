package br.com.metaro.portal.core.repositories;

import br.com.metaro.portal.core.entities.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ParamRepository extends JpaRepository<Param, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Param p where p.name = :name")
    Optional<Param> findLockedByName(@org.springframework.data.repository.query.Param("name") String name);

    Optional<Param> findByName(String name);
}
