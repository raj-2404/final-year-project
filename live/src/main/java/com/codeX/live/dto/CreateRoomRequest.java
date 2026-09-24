package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoomRequest {
    private String roomCode;
    private String title;
    private String language;
    private String visibility; // "PUBLIC" or "PRIVATE"
    private String initialTreeJson; // Optional custom initial tree (e.g., from PC folder)
}
