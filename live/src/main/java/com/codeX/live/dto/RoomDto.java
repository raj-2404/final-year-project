package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomDto {
    private Long id;
    private String roomCode;
    private String title;
    private String language;
    private String codeContent;
    private String visibility; // "PUBLIC" or "PRIVATE"
    private Long ownerId;
    private String ownerUsername;
    private String ownerName;
    private String createdBy;
    private int participantsCount;
    private Instant createdAt;
    private Instant updatedAt;
}
