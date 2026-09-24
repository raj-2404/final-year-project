package com.codeX.live.websocket;

import com.codeX.live.dto.PresenceMessage;
import com.codeX.live.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;
    private final RoomService roomService;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        if (sessionId != null) {
            roomService.registerUserLeave(sessionId).ifPresent(entry -> {
                String roomCode = entry.getKey();
                int count = entry.getValue();

                log.info("Session {} left room {}, remaining participants: {}", sessionId, roomCode, count);

                PresenceMessage presence = PresenceMessage.builder()
                        .roomCode(roomCode)
                        .type("LEAVE")
                        .usersCount(count)
                        .senderId(sessionId)
                        .build();

                messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/presence", presence);
            });
        }
    }
}
