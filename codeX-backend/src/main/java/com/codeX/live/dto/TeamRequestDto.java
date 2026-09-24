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
public class TeamRequestDto {
    private Long id;
    private Long senderId;
    private String senderUsername;
    private String senderName;
    private String senderEmail;

    private Long receiverId;
    private String receiverUsername;
    private String receiverName;
    private String receiverEmail;

    private String status;
    private Instant createdAt;
}
