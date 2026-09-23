package com.codeX.live.controller;

import com.codeX.live.dto.CreateRoomRequest;
import com.codeX.live.dto.RoomDto;
import com.codeX.live.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*", maxAge = 3600)
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @PostMapping
    public ResponseEntity<RoomDto> createRoom(
            @RequestBody(required = false) CreateRoomRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String createdBy = userDetails != null ? userDetails.getUsername() : "Anonymous";
        CreateRoomRequest req = request != null ? request : new CreateRoomRequest();
        RoomDto roomDto = roomService.createOrGetRoom(req, createdBy);
        return ResponseEntity.ok(roomDto);
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<RoomDto> getRoom(@PathVariable String roomCode) {
        return roomService.getRoom(roomCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{roomCode}/check")
    public ResponseEntity<Map<String, Boolean>> checkRoom(@PathVariable String roomCode) {
        boolean exists = roomService.exists(roomCode);
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    @PutMapping("/{roomCode}/code")
    public ResponseEntity<Map<String, Boolean>> updateCode(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> payload
    ) {
        String code = payload.getOrDefault("code", "");
        roomService.updateCode(roomCode, code);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/{roomCode}/language")
    public ResponseEntity<Map<String, Boolean>> updateLanguage(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> payload
    ) {
        String language = payload.getOrDefault("language", "javascript");
        roomService.updateLanguage(roomCode, language);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/{roomCode}/title")
    public ResponseEntity<Map<String, Boolean>> updateTitle(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> payload
    ) {
        String title = payload.getOrDefault("title", "Untitled");
        roomService.updateTitle(roomCode, title);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/{roomCode}/tree")
    public ResponseEntity<Map<String, Boolean>> updateTree(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> payload
    ) {
        String treeJson = payload.getOrDefault("fileTreeJson", "");
        roomService.updateCode(roomCode, treeJson);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
