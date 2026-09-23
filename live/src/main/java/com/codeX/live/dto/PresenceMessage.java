package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresenceMessage {
    private String roomCode;
    private String type; // "JOIN" | "LEAVE"
    private int usersCount;
    private String senderId;
    private String senderName;
}
