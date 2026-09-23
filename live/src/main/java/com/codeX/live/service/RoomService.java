package com.codeX.live.service;

import com.codeX.live.dto.CreateRoomRequest;
import com.codeX.live.dto.RoomDto;
import com.codeX.live.entity.Room;
import com.codeX.live.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private static final String CHAR_LIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    public static final String DEFAULT_FILE_TREE = "["
            + "{\"id\":\"folder-src\",\"name\":\"src\",\"type\":\"folder\",\"parentId\":null},"
            + "{\"id\":\"file-main-py\",\"name\":\"main.py\",\"type\":\"file\",\"parentId\":\"folder-src\",\"language\":\"python\",\"content\":\"# Welcome to CodeLive Collaborative Workspace\\ndef main():\\n    print('Hello, Collaborative World!')\\n\\nif __name__ == '__main__':\\n    main()\\n\"},"
            + "{\"id\":\"file-index-js\",\"name\":\"index.js\",\"type\":\"file\",\"parentId\":\"folder-src\",\"language\":\"javascript\",\"content\":\"// Real-time collaborative JavaScript\\nconsole.log('Connected to shared workspace');\\n\"},"
            + "{\"id\":\"file-readme\",\"name\":\"README.md\",\"type\":\"file\",\"parentId\":null,\"language\":\"markdown\",\"content\":\"# Collaborative Project Workspace\\n\\nAll folders, files, and edits are synchronized in real time across all connected participants.\\n\"}"
            + "]";

    // In-memory active presence tracking
    // roomCode -> Set of sessionIds
    private final Map<String, Set<String>> roomSessions = new ConcurrentHashMap<>();
    // sessionId -> roomCode
    private final Map<String, String> sessionToRoom = new ConcurrentHashMap<>();

    public String generateRoomCode() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(CHAR_LIST.charAt(RANDOM.nextInt(CHAR_LIST.length())));
        }
        return sb.toString();
    }

    @Transactional
    public RoomDto createOrGetRoom(CreateRoomRequest request, String createdBy) {
        String code = request.getRoomCode();
        if (code == null || code.trim().isEmpty()) {
            code = generateRoomCode();
            while (roomRepository.existsByRoomCode(code)) {
                code = generateRoomCode();
            }
        } else {
            code = code.trim();
        }

        final String finalCode = code;
        Room room = roomRepository.findByRoomCode(finalCode).orElseGet(() -> {
            Room newRoom = Room.builder()
                    .roomCode(finalCode)
                    .title(request.getTitle() != null && !request.getTitle().trim().isEmpty() ? request.getTitle().trim() : "Untitled")
                    .language(request.getLanguage() != null && !request.getLanguage().trim().isEmpty() ? request.getLanguage().trim() : "javascript")
                    .codeContent(DEFAULT_FILE_TREE)
                    .createdBy(createdBy != null ? createdBy : "Anonymous")
                    .build();
            return roomRepository.save(newRoom);
        });

        if (room.getCodeContent() == null || room.getCodeContent().trim().isEmpty()) {
            room.setCodeContent(DEFAULT_FILE_TREE);
            room = roomRepository.save(room);
        }

        return toDto(room);
    }

    public Optional<RoomDto> getRoom(String roomCode) {
        return roomRepository.findByRoomCode(roomCode).map(this::toDto);
    }

    public boolean exists(String roomCode) {
        return roomRepository.existsByRoomCode(roomCode);
    }

    @Transactional
    public void updateCode(String roomCode, String codeContent) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setCodeContent(codeContent);
            roomRepository.save(room);
        });
    }

    @Transactional
    public void updateLanguage(String roomCode, String language) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setLanguage(language);
            roomRepository.save(room);
        });
    }

    @Transactional
    public void updateTitle(String roomCode, String title) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setTitle(title);
            roomRepository.save(room);
        });
    }

    // Active Presence Management
    public int registerUserJoin(String roomCode, String sessionId) {
        sessionToRoom.put(sessionId, roomCode);
        roomSessions.computeIfAbsent(roomCode, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        return getParticipantsCount(roomCode);
    }

    public Optional<Map.Entry<String, Integer>> registerUserLeave(String sessionId) {
        String roomCode = sessionToRoom.remove(sessionId);
        if (roomCode != null) {
            Set<String> sessions = roomSessions.get(roomCode);
            if (sessions != null) {
                sessions.remove(sessionId);
                int count = sessions.size();
                if (count == 0) {
                    roomSessions.remove(roomCode);
                }
                return Optional.of(Map.entry(roomCode, count));
            }
        }
        return Optional.empty();
    }

    public int getParticipantsCount(String roomCode) {
        Set<String> sessions = roomSessions.get(roomCode);
        return sessions != null ? sessions.size() : 0;
    }

    public RoomDto toDto(Room room) {
        return RoomDto.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .title(room.getTitle())
                .language(room.getLanguage())
                .codeContent(room.getCodeContent())
                .createdBy(room.getCreatedBy())
                .participantsCount(getParticipantsCount(room.getRoomCode()))
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
