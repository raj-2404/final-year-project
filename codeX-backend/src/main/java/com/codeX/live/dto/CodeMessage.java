package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodeMessage {
    private String roomCode;
    private String fileId;
    private String code;
    private String senderId;
}
