package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TerminalOutputMessage {
    private String roomCode;
    private String data;
    private String type; // "OUTPUT", "INIT", "STATUS"
    private Boolean allowTeammateInput;
    private String hostUsername;
    private Boolean running;
    private String startedBy;
}
