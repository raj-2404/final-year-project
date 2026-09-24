package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TerminalPermissionMessage {
    private String roomCode;
    private Boolean allowTeammateInput;
    private String requestedBy;
}
