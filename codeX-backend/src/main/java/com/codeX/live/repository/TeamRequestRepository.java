package com.codeX.live.repository;

import com.codeX.live.entity.TeamRequest;
import com.codeX.live.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRequestRepository extends JpaRepository<TeamRequest, Long> {
    List<TeamRequest> findByReceiverAndStatusOrderByCreatedAtDesc(User receiver, String status);
    List<TeamRequest> findBySenderAndStatusOrderByCreatedAtDesc(User sender, String status);
    Optional<TeamRequest> findBySenderIdAndReceiverId(Long senderId, Long receiverId);
    boolean existsBySenderIdAndReceiverIdAndStatus(Long senderId, Long receiverId, String status);
    long countByReceiverAndStatus(User receiver, String status);
}
