package com.codeX.live.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "rooms")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_code", nullable = false, unique = true, length = 32)
    private String roomCode;

    @Column(nullable = false, length = 255)
    @Builder.Default
    private String title = "Untitled";

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String language = "plaintext";

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String codeContent = "[]";

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(length = 20, nullable = false)
    @Builder.Default
    private String visibility = "PRIVATE"; // "PUBLIC" (Team visible) or "PRIVATE"

    @Column(name = "disk_path", length = 500)
    private String diskPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
