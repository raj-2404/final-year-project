package com.codeX.live.service;

import com.codeX.live.dto.CreateRoomRequest;
import com.codeX.live.dto.RoomDto;
import com.codeX.live.entity.Room;
import com.codeX.live.entity.User;
import com.codeX.live.repository.RoomRepository;
import com.codeX.live.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final DiskSyncService diskSyncService;

    private static final String CHAR_LIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    public static final String EMPTY_FILE_TREE = "[]";

    private final Map<String, Set<String>> roomSessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToRoom = new ConcurrentHashMap<>();

    public RoomService(
            RoomRepository roomRepository,
            UserRepository userRepository,
            @Lazy DiskSyncService diskSyncService
    ) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.diskSyncService = diskSyncService;
    }

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
        User owner = null;
        if (createdBy != null && !createdBy.isEmpty()) {
            owner = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(createdBy, createdBy).orElse(null);
        }

        final User finalOwner = owner;
        Room room = roomRepository.findByRoomCode(finalCode).orElseGet(() -> {
            String initialContent = request.getInitialTreeJson() != null && !request.getInitialTreeJson().trim().isEmpty()
                    ? request.getInitialTreeJson().trim()
                    : EMPTY_FILE_TREE;

            String visibility = "PUBLIC".equalsIgnoreCase(request.getVisibility()) ? "PUBLIC" : "PRIVATE";

            Room newRoom = Room.builder()
                    .roomCode(finalCode)
                    .title(request.getTitle() != null && !request.getTitle().trim().isEmpty() ? request.getTitle().trim() : "Untitled Folder")
                    .language(request.getLanguage() != null && !request.getLanguage().trim().isEmpty() ? request.getLanguage().trim() : "plaintext")
                    .codeContent(initialContent)
                    .createdBy(createdBy != null ? createdBy : "Anonymous")
                    .visibility(visibility)
                    .owner(finalOwner)
                    .build();
            return roomRepository.save(newRoom);
        });

        if (room.getCodeContent() == null || room.getCodeContent().trim().isEmpty()) {
            room.setCodeContent(EMPTY_FILE_TREE);
            room = roomRepository.save(room);
        }

        if (room.getOwner() == null && finalOwner != null) {
            room.setOwner(finalOwner);
            room = roomRepository.save(room);
        }

        // Initialize real physical folder on PC disk!
        if (diskSyncService != null) {
            Path diskDir = diskSyncService.initWorkspaceOnDisk(room);
            if (diskDir != null && (room.getDiskPath() == null || !room.getDiskPath().equals(diskDir.toAbsolutePath().toString()))) {
                room.setDiskPath(diskDir.toAbsolutePath().toString());
                room = roomRepository.save(room);
            }
        }

        return toDto(room);
    }

    public Optional<RoomDto> getRoom(String roomCode) {
        return roomRepository.findByRoomCode(roomCode).map(r -> {
            // Ensure disk directory exists on load
            if (diskSyncService != null) {
                Path diskDir = diskSyncService.initWorkspaceOnDisk(r);
                if (diskDir != null && r.getDiskPath() == null) {
                    r.setDiskPath(diskDir.toAbsolutePath().toString());
                    roomRepository.save(r);
                }
            }
            return toDto(r);
        });
    }

    public boolean exists(String roomCode) {
        return roomRepository.existsByRoomCode(roomCode);
    }

    public List<RoomDto> getMyRooms(String identifier) {
        if (identifier == null) return Collections.emptyList();
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier);
        if (userOpt.isEmpty()) return Collections.emptyList();

        return roomRepository.findByOwnerIdOrderByUpdatedAtDesc(userOpt.get().getId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<RoomDto> getTeamRooms(String identifier) {
        if (identifier == null) return Collections.emptyList();
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier);
        if (userOpt.isEmpty()) return Collections.emptyList();

        return roomRepository.findTeamPublicRooms(userOpt.get().getId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public RoomDto updateVisibility(String roomCode, String visibility, String identifier) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (identifier != null) {
            User user = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier).orElse(null);
            if (user != null && room.getOwner() != null && !room.getOwner().getId().equals(user.getId())) {
                throw new RuntimeException("Only the workspace owner can modify visibility");
            }
        }

        room.setVisibility("PUBLIC".equalsIgnoreCase(visibility) ? "PUBLIC" : "PRIVATE");
        room = roomRepository.save(room);
        return toDto(room);
    }

    @Transactional
    public void updateCode(String roomCode, String codeContent) {
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setCodeContent(codeContent);
            roomRepository.save(room);

            // Write to physical PC disk
            if (diskSyncService != null) {
                diskSyncService.syncVirtualTreeToDisk(roomCode, codeContent);
            }
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
        User owner = room.getOwner();
        return RoomDto.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .title(room.getTitle())
                .language(room.getLanguage())
                .codeContent(room.getCodeContent())
                .visibility(room.getVisibility() != null ? room.getVisibility() : "PRIVATE")
                .diskPath(room.getDiskPath())
                .ownerId(owner != null ? owner.getId() : null)
                .ownerUsername(owner != null ? owner.getUsername() : null)
                .ownerName(owner != null ? owner.getName() : null)
                .createdBy(room.getCreatedBy())
                .participantsCount(getParticipantsCount(room.getRoomCode()))
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
