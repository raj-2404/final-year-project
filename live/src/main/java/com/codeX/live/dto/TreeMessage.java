package com.codeX.live.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TreeMessage {
    private String roomCode;
    private String type; // "TREE_UPDATE", "FILE_CREATE", "FILE_DELETE", "FILE_RENAME", "SYNC"
    private String fileTreeJson;
    private String activeFileId;
    private String senderId;
    private String senderName;
}
