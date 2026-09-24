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
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
@Slf4j
public class CollaborationController {

    private final RoomService roomService;
    private final DiskSyncService diskSyncService;

    @MessageMapping("/room/{roomCode}/join")
    @SendTo("/topic/room/{roomCode}/presence")
    public PresenceMessage handleUserJoin(
            @DestinationVariable String roomCode,
            @Payload PresenceMessage message,
            StompHeaderAccessor headerAccessor
    ) {
        String sessionId = headerAccessor.getSessionId();
        int count = roomService.registerUserJoin(roomCode, sessionId);

        log.info("User {} joined room {}, total: {}", message.getSenderName(), roomCode, count);

        return PresenceMessage.builder()
                .roomCode(roomCode)
                .type("JOIN")
                .usersCount(count)
                .senderId(sessionId)
                .senderName(message.getSenderName() != null ? message.getSenderName() : "Anonymous")
                .build();
    }

    @MessageMapping("/room/{roomCode}/code")
    @SendTo("/topic/room/{roomCode}/code")
    public CodeMessage handleCodeChange(
            @DestinationVariable String roomCode,
            @Payload CodeMessage message
    ) {
        roomService.updateCode(roomCode, message.getCode());
        if (diskSyncService != null && message.getFileId() != null) {
            diskSyncService.syncCodeChangeToDisk(roomCode, message.getFileId(), message.getCode());
        }
        return message;
    }

    @MessageMapping("/room/{roomCode}/language")
    @SendTo("/topic/room/{roomCode}/language")
    public LanguageMessage handleLanguageChange(
            @DestinationVariable String roomCode,
            @Payload LanguageMessage message
    ) {
        roomService.updateLanguage(roomCode, message.getLanguage());
        return message;
    }

    @MessageMapping("/room/{roomCode}/title")
    @SendTo("/topic/room/{roomCode}/title")
    public TitleMessage handleTitleChange(
            @DestinationVariable String roomCode,
            @Payload TitleMessage message
    ) {
        roomService.updateTitle(roomCode, message.getTitle());
        return message;
    }

    @MessageMapping("/room/{roomCode}/tree")
    @SendTo("/topic/room/{roomCode}/tree")
    public TreeMessage handleTreeChange(
            @DestinationVariable String roomCode,
            @Payload TreeMessage message
    ) {
        if (message.getFileTreeJson() != null && !message.getFileTreeJson().trim().isEmpty()) {
            roomService.updateCode(roomCode, message.getFileTreeJson());
            if (diskSyncService != null) {
                diskSyncService.syncVirtualTreeToDisk(roomCode, message.getFileTreeJson());
            }
        }
        return message;
    }
}
