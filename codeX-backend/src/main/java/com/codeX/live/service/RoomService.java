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
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, String> cachedRoomTrees = new ConcurrentHashMap<>();
    private final Map<String, Long> lastDbPersistTime = new ConcurrentHashMap<>();

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

    public String getRoomTreeJson(String roomCode) {
        if (roomCode == null) return EMPTY_FILE_TREE;
        String cached = cachedRoomTrees.get(roomCode);
        if (cached != null && cached.trim().startsWith("[")) {
            return cached;
        }
        return roomRepository.findByRoomCode(roomCode)
                .map(r -> {
                    String content = r.getCodeContent();
                    if (content != null && content.trim().startsWith("[")) {
                        cachedRoomTrees.put(roomCode, content);
                        return content;
                    }
                    return EMPTY_FILE_TREE;
                })
                .orElse(EMPTY_FILE_TREE);
    }

    @Transactional
    public void updateTree(String roomCode, String fileTreeJson) {
        if (roomCode == null || fileTreeJson == null || !fileTreeJson.trim().startsWith("[")) {
            return;
        }

        try {
            List<Map<String, Object>> newItems = objectMapper.readValue(
                    fileTreeJson,
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            // Merge with existing tree if present, so we never lose existing file content!
            String existingJson = cachedRoomTrees.get(roomCode);
            if (existingJson == null) {
                Room r = roomRepository.findByRoomCode(roomCode).orElse(null);
                if (r != null) existingJson = r.getCodeContent();
            }

            if (existingJson != null && existingJson.trim().startsWith("[")) {
                try {
                    List<Map<String, Object>> existingItems = objectMapper.readValue(
                            existingJson,
                            new TypeReference<List<Map<String, Object>>>() {}
                    );
                    Map<String, String> existingContents = new HashMap<>();
                    for (Map<String, Object> ex : existingItems) {
                        String id = (String) ex.get("id");
                        String c = (String) ex.get("content");
                        if (id != null && c != null && !c.isEmpty()) {
                            existingContents.put(id, c);
                        }
                    }
                    for (Map<String, Object> item : newItems) {
                        String id = (String) item.get("id");
                        Object c = item.get("content");
                        if ((c == null || c.toString().isEmpty()) && existingContents.containsKey(id)) {
                            item.put("content", existingContents.get(id));
                        }
                    }
                } catch (Exception ignored) {}
            }

            fileTreeJson = objectMapper.writeValueAsString(newItems);
        } catch (Exception ignored) {}

        cachedRoomTrees.put(roomCode, fileTreeJson);
        final String finalTreeJson = fileTreeJson;
        roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
            room.setCodeContent(finalTreeJson);
            roomRepository.save(room);

            // Write to physical PC disk
            if (diskSyncService != null) {
                diskSyncService.syncVirtualTreeToDisk(roomCode, finalTreeJson);
            }
        });
    }

    public void updateFileInTree(String roomCode, String fileId, String code) {
        updateFileInTree(roomCode, fileId, null, null, code);
    }

    public void updateFileInTree(String roomCode, String fileId, String filePath, String fileName, String code) {
        if (roomCode == null || code == null) return;

        String currentTreeJson = getRoomTreeJson(roomCode);
        try {
            List<Map<String, Object>> items = objectMapper.readValue(
                    currentTreeJson,
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            boolean found = false;
            for (Map<String, Object> item : items) {
                String id = (String) item.get("id");
                String path = (String) item.get("path");
                String name = (String) item.get("name");

                boolean match = (fileId != null && fileId.equals(id))
                        || (fileId != null && fileId.equals(path))
                        || (filePath != null && filePath.equals(path))
                        || (filePath != null && filePath.equals(id))
                        || (filePath != null && path != null && (path.endsWith(filePath) || filePath.endsWith(path)))
                        || (fileName != null && fileName.equals(name));

                if (match) {
                    item.put("content", code);
                    found = true;
                    break;
                }
            }

            if (found) {
                String updatedJson = objectMapper.writeValueAsString(items);
                cachedRoomTrees.put(roomCode, updatedJson);

                // Debounce DB write: at most once every 3 seconds per room to prevent DB pool exhaustion
                long now = System.currentTimeMillis();
                Long lastPersist = lastDbPersistTime.get(roomCode);
                if (lastPersist == null || (now - lastPersist) > 3000) {
                    lastDbPersistTime.put(roomCode, now);
                    roomRepository.findByRoomCode(roomCode).ifPresent(room -> {
                        room.setCodeContent(updatedJson);
                        roomRepository.save(room);
                    });
                }

                if (diskSyncService != null) {
                    diskSyncService.syncCodeChangeToDisk(roomCode, fileId, code);
                }
            }
        } catch (Exception ignored) {
        }
    }

    @Transactional
    public void updateCode(String roomCode, String codeContent) {
        if (codeContent != null && codeContent.trim().startsWith("[")) {
            updateTree(roomCode, codeContent);
        }
        // If not a JSON tree, ignore to prevent breaking the room's folder structure
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

    public String populateTreeContentFromDisk(String roomCode, String fileTreeJson, String diskPath) {
        if (roomCode == null || fileTreeJson == null || !fileTreeJson.trim().startsWith("[")) {
            return fileTreeJson;
        }

        try {
            List<Map<String, Object>> items = objectMapper.readValue(
                    fileTreeJson,
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            // Map ID to relative path in the virtual tree
            Map<String, String> itemPaths = new HashMap<>();
            for (Map<String, Object> item : items) {
                String id = (String) item.get("id");
                String name = (String) item.get("name");
                String parentId = (String) item.get("parentId");
                if (name == null || id == null) continue;

                if (parentId == null || "folder-root".equals(parentId)) {
                    itemPaths.put(id, name);
                } else {
                    String parentPath = itemPaths.get(parentId);
                    itemPaths.put(id, parentPath != null ? parentPath + "/" + name : name);
                }
            }

            boolean modified = false;
            for (Map<String, Object> item : items) {
                if (!"file".equals(item.get("type"))) continue;

                Object currentContent = item.get("content");
                if (currentContent != null && !currentContent.toString().isEmpty()) {
                    continue; // Already has content
                }

                String id = (String) item.get("id");
                String itemPath = (String) item.get("path");
                Path foundPath = null;

                // 1. Direct path check
                if (itemPath != null) {
                    try {
                        Path p = Paths.get(itemPath);
                        if (Files.exists(p) && !Files.isDirectory(p) && Files.isReadable(p)) {
                            foundPath = p;
                        }
                    } catch (Exception ignored) {}
                }

                // 2. Resolve relative to room diskPath
                if (foundPath == null && diskPath != null) {
                    try {
                        String rel = itemPaths.get(id);
                        if (rel != null) {
                            Path p = Paths.get(diskPath).resolve(rel);
                            if (Files.exists(p) && !Files.isDirectory(p) && Files.isReadable(p)) {
                                foundPath = p;
                            }
                        }
                        if (foundPath == null) {
                            String name = (String) item.get("name");
                            if (name != null) {
                                Path p = Paths.get(diskPath).resolve(name);
                                if (Files.exists(p) && !Files.isDirectory(p) && Files.isReadable(p)) {
                                    foundPath = p;
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }

                // 3. Resolve relative to diskSyncService path
                if (foundPath == null && diskSyncService != null) {
                    try {
                        Path roomDisk = diskSyncService.getRoomDiskPath(roomCode);
                        if (roomDisk != null) {
                            String rel = itemPaths.get(id);
                            if (rel != null) {
                                Path p = roomDisk.resolve(rel);
                                if (Files.exists(p) && !Files.isDirectory(p) && Files.isReadable(p)) {
                                    foundPath = p;
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }

                if (foundPath != null) {
                    try {
                        long size = Files.size(foundPath);
                        if (size <= 500_000) { // Limit to 500 KB per source file
                            String text = Files.readString(foundPath, StandardCharsets.UTF_8);
                            item.put("content", text);
                            modified = true;
                        }
                    } catch (Exception ignored) {}
                }
            }

            if (modified) {
                String updatedJson = objectMapper.writeValueAsString(items);
                cachedRoomTrees.put(roomCode, updatedJson);

                // Update DB as well so future queries have it
                roomRepository.findByRoomCode(roomCode).ifPresent(r -> {
                    r.setCodeContent(updatedJson);
                    roomRepository.save(r);
                });

                return updatedJson;
            }
        } catch (Exception ignored) {}

        return fileTreeJson;
    }

    public String getFileContent(String roomCode, String fileId, String requestedPath) {
        if (roomCode == null) return null;

        String currentTreeJson = getRoomTreeJson(roomCode);
        try {
            List<Map<String, Object>> items = objectMapper.readValue(
                    currentTreeJson,
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            Map<String, Object> matchedItem = null;
            for (Map<String, Object> item : items) {
                if (fileId != null && fileId.equals(item.get("id"))) {
                    matchedItem = item;
                    break;
                }
                if (requestedPath != null && requestedPath.equals(item.get("path"))) {
                    matchedItem = item;
                    break;
                }
            }

            if (matchedItem != null) {
                Object c = matchedItem.get("content");
                if (c != null && !c.toString().isEmpty()) {
                    return c.toString();
                }
            }
        } catch (Exception ignored) {}

        // Fallback: Populate from disk and re-check
        String diskPath = roomRepository.findByRoomCode(roomCode).map(Room::getDiskPath).orElse(null);
        String updatedTreeJson = populateTreeContentFromDisk(roomCode, currentTreeJson, diskPath);
        try {
            List<Map<String, Object>> items = objectMapper.readValue(
                    updatedTreeJson,
                    new TypeReference<List<Map<String, Object>>>() {}
            );
            for (Map<String, Object> item : items) {
                if (fileId != null && fileId.equals(item.get("id"))) {
                    Object c = item.get("content");
                    if (c != null && !c.toString().isEmpty()) return c.toString();
                }
                if (requestedPath != null && requestedPath.equals(item.get("path"))) {
                    Object c = item.get("content");
                    if (c != null && !c.toString().isEmpty()) return c.toString();
                }
            }
        } catch (Exception ignored) {}

        // Direct path read if path is absolute and readable on backend
        if (requestedPath != null) {
            try {
                Path p = Paths.get(requestedPath);
                if (Files.exists(p) && !Files.isDirectory(p) && Files.isReadable(p) && Files.size(p) <= 1_000_000) {
                    String text = Files.readString(p, StandardCharsets.UTF_8);
                    if (fileId != null) {
                        updateFileInTree(roomCode, fileId, text);
                    }
                    return text;
                }
            } catch (Exception ignored) {}
        }

        return null;
    }

    public RoomDto toDto(Room room) {
        User owner = room.getOwner();
        String currentContent = cachedRoomTrees.getOrDefault(room.getRoomCode(), room.getCodeContent());
        if (currentContent == null || !currentContent.trim().startsWith("[")) {
            currentContent = EMPTY_FILE_TREE;
        } else {
            // Auto-populate file contents from disk if missing
            currentContent = populateTreeContentFromDisk(room.getRoomCode(), currentContent, room.getDiskPath());
        }
        return RoomDto.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .title(room.getTitle())
                .language(room.getLanguage())
                .codeContent(currentContent)
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
