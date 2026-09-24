package com.codeX.live.repository;

import com.codeX.live.entity.TeamMember;
import com.codeX.live.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    List<TeamMember> findByOwnerOrderByCreatedAtDesc(User owner);
    List<TeamMember> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);
    boolean existsByOwnerIdAndMemberId(Long ownerId, Long memberId);
    Optional<TeamMember> findByOwnerIdAndMemberId(Long ownerId, Long memberId);
    void deleteByOwnerIdAndMemberId(Long ownerId, Long memberId);
    long countByOwnerId(Long ownerId);
}
