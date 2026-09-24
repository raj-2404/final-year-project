package com.codeX.live.repository;

import com.codeX.live.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Optional<User> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);

    List<User> findTop10ByUsernameContainingIgnoreCaseOrNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
            String username, String name, String email
    );
}
