package com.codeX.live.controller;

import com.codeX.live.dto.TerminalInputMessage;
import com.codeX.live.dto.TerminalOutputMessage;
import com.codeX.live.dto.TerminalPermissionMessage;
import com.codeX.live.service.TerminalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@RequiredArgsConstructor
@Slf4j
public class TerminalController {

    private final TerminalService terminalService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/room/{roomCode}/terminal/init")
    public void handleTerminalInit(
            @DestinationVariable String roomCode,
            @Payload(required = false) TerminalInputMessage message
    ) {
        String username = (message != null && message.getSenderUsername() != null) ? message.getSenderUsername() : "Developer";
        TerminalOutputMessage state = terminalService.getTerminalState(roomCode, username);
        if (state != null) {
            messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/terminal/output", state);
        }
    }

    @MessageMapping("/room/{roomCode}/terminal/input")
    public void handleTerminalInput(
            @DestinationVariable String roomCode,
            @Payload TerminalInputMessage message
    ) {
        log.info("[Terminal STOMP] Input received for room {}: sender={}, chars={}",
                roomCode,
                message != null ? message.getSenderUsername() : null,
                message != null && message.getData() != null ? message.getData().length() : 0);
        if (message != null && message.getData() != null) {
            terminalService.writeInput(roomCode, message.getData(), message.getSenderUsername());
        }
    }

    @MessageMapping("/room/{roomCode}/terminal/start")
    public void handleTerminalStart(
            @DestinationVariable String roomCode,
            @Payload(required = false) TerminalInputMessage message
    ) {
        String username = (message != null && message.getSenderUsername() != null) ? message.getSenderUsername() : "Developer";
        terminalService.startSession(roomCode, username);
    }

    @MessageMapping("/room/{roomCode}/terminal/stop")
    public void handleTerminalStop(
            @DestinationVariable String roomCode,
            @Payload(required = false) TerminalInputMessage message
    ) {
        String username = (message != null && message.getSenderUsername() != null) ? message.getSenderUsername() : "Developer";
        terminalService.stopSession(roomCode, username);
    }

    @MessageMapping("/room/{roomCode}/terminal/permission")
    public void handleTerminalPermission(
            @DestinationVariable String roomCode,
            @Payload TerminalPermissionMessage message
    ) {
        if (message != null) {
            boolean allow = Boolean.TRUE.equals(message.getAllowTeammateInput());
            terminalService.setPermission(roomCode, allow, message.getRequestedBy());
        }
    }

    @GetMapping("/api/rooms/{roomCode}/terminal/state")
    @ResponseBody
    public ResponseEntity<TerminalOutputMessage> getTerminalState(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : "Developer";
        TerminalOutputMessage state = terminalService.getTerminalState(roomCode, username);
        return ResponseEntity.ok(state);
    }

    @org.springframework.web.bind.annotation.PostMapping("/api/rooms/{roomCode}/terminal/start")
    @ResponseBody
    public ResponseEntity<?> startTerminalRest(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : "Developer";
        terminalService.startSession(roomCode, username);
        return ResponseEntity.ok(java.util.Map.of("status", "STARTED", "running", true));
    }

    @org.springframework.web.bind.annotation.PostMapping("/api/rooms/{roomCode}/terminal/stop")
    @ResponseBody
    public ResponseEntity<?> stopTerminalRest(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = userDetails != null ? userDetails.getUsername() : "Developer";
        terminalService.stopSession(roomCode, username);
        return ResponseEntity.ok(java.util.Map.of("status", "STOPPED", "running", false));
    }

    @org.springframework.web.bind.annotation.PostMapping("/api/rooms/{roomCode}/terminal/input")
    @ResponseBody
    public ResponseEntity<?> inputTerminalRest(
            @PathVariable String roomCode,
            @org.springframework.web.bind.annotation.RequestBody TerminalInputMessage message,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String username = (message != null && message.getSenderUsername() != null)
                ? message.getSenderUsername()
                : (userDetails != null ? userDetails.getUsername() : "Developer");
        if (message != null && message.getData() != null) {
            terminalService.writeInput(roomCode, message.getData(), username);
        }
        return ResponseEntity.ok(java.util.Map.of("status", "OK"));
    }
}
