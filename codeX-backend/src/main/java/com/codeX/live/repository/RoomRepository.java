package com.codeX.live.repository;

import com.codeX.live.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByRoomCode(String roomCode);

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.owner WHERE r.roomCode = :roomCode")
    Optional<Room> findByRoomCodeWithOwner(@Param("roomCode") String roomCode);

    boolean existsByRoomCode(String roomCode);

    List<Room> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    @Query("SELECT r FROM Room r WHERE r.visibility = 'PUBLIC' AND r.owner.id IN " +
           "(SELECT tm.member.id FROM TeamMember tm WHERE tm.owner.id = :userId) " +
           "ORDER BY r.updatedAt DESC")
    List<Room> findTeamPublicRooms(@Param("userId") Long userId);
}
