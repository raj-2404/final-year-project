package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TerminalInputMessage {
    private String roomCode;
    private String data;
    private String senderUsername;
    private String senderId;
}
