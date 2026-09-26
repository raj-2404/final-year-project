package com.codeX.live.controller;

import com.codeX.live.dto.CodeMessage;
import com.codeX.live.dto.LanguageMessage;
import com.codeX.live.dto.PresenceMessage;
import com.codeX.live.dto.TitleMessage;
import com.codeX.live.dto.TreeMessage;
import com.codeX.live.service.DiskSyncService;
import com.codeX.live.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
@Slf4j
public class CollaborationController {

    private final RoomService roomService;
    private final DiskSyncService diskSyncService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/room/{roomCode}/join")
    public void handleUserJoin(
            @DestinationVariable String roomCode,
            @Payload PresenceMessage message,
            StompHeaderAccessor headerAccessor
    ) {
        String sessionId = headerAccessor.getSessionId();
        int count = roomService.registerUserJoin(roomCode, sessionId);

        log.info("User {} joined room {}, total: {}", message.getSenderName(), roomCode, count);

        // Broadcast current folder tree snapshot so joining user immediately sees all files/folders
        try {
            String treeJson = roomService.getRoomTreeJson(roomCode);
            if (treeJson != null && treeJson.trim().startsWith("[")) {
                messagingTemplate.convertAndSend(
                        "/topic/room/" + roomCode + "/tree",
                        TreeMessage.builder()
                                .roomCode(roomCode)
                                .type("SYNC")
                                .fileTreeJson(treeJson)
                                .senderId("system-sync")
                                .senderName("System Sync")
                                .build()
                );
            }
        } catch (Exception e) {
            log.warn("Could not broadcast tree sync on join for room {}: {}", roomCode, e.getMessage());
        }

        PresenceMessage presence = PresenceMessage.builder()
                .roomCode(roomCode)
                .type("JOIN")
                .usersCount(count)
                .senderId(sessionId)
                .senderName(message.getSenderName() != null ? message.getSenderName() : "Anonymous")
                .build();
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/presence", presence);
    }

    @MessageMapping("/room/{roomCode}/code")
    public void handleCodeChange(
            @DestinationVariable String roomCode,
            @Payload CodeMessage message
    ) {
        // Safely update file content inside virtual file tree without overwriting tree or crashing DB
        if ((message.getFileId() != null || message.getFilePath() != null || message.getFileName() != null) && message.getCode() != null) {
            roomService.updateFileInTree(roomCode, message.getFileId(), message.getFilePath(), message.getFileName(), message.getCode());
        }
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/code", message);
    }

    @MessageMapping("/room/{roomCode}/language")
    public void handleLanguageChange(
            @DestinationVariable String roomCode,
            @Payload LanguageMessage message
    ) {
        roomService.updateLanguage(roomCode, message.getLanguage());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/language", message);
    }

    @MessageMapping("/room/{roomCode}/title")
    public void handleTitleChange(
            @DestinationVariable String roomCode,
            @Payload TitleMessage message
    ) {
        roomService.updateTitle(roomCode, message.getTitle());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/title", message);
    }

    @MessageMapping("/room/{roomCode}/tree")
    public void handleTreeChange(
            @DestinationVariable String roomCode,
            @Payload TreeMessage message
    ) {
        if (message.getFileTreeJson() != null && message.getFileTreeJson().trim().startsWith("[")) {
            roomService.updateTree(roomCode, message.getFileTreeJson());
        }
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/tree", message);
    }

    @MessageMapping("/room/{roomCode}/tree/sync")
    public void handleTreeSyncRequest(
            @DestinationVariable String roomCode,
            @Payload TreeMessage message
    ) {
        String treeJson = roomService.getRoomTreeJson(roomCode);
        TreeMessage sync = TreeMessage.builder()
                .roomCode(roomCode)
                .type("SYNC")
                .fileTreeJson(treeJson != null && treeJson.trim().startsWith("[") ? treeJson : "[]")
                .senderId("system-sync")
                .senderName("System Sync")
                .build();
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/tree", sync);
    }
}
