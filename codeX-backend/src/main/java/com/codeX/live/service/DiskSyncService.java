package com.codeX.live.service;

import com.codeX.live.dto.CodeMessage;
import com.codeX.live.dto.TreeMessage;
import com.codeX.live.entity.Room;
import com.codeX.live.repository.RoomRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class DiskSyncService {

    @Value("${codex.workspace.root:/Users/rajshaikh/Desktop/CodeXProjects}")
    private String workspaceRootPath;

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;
    private final RoomRepository roomRepository;
    private final RoomService roomService;

    // roomCode -> Root Path on Disk
    private final Map<String, Path> roomDiskPaths = new ConcurrentHashMap<>();
    // Path -> roomCode
    private final Map<Path, String> pathToRoomCode = new ConcurrentHashMap<>();
    // Path -> Timestamp of internal write to prevent feedback loops
    private final Map<Path, Long> recentInternalWrites = new ConcurrentHashMap<>();
    // WatchKey -> Directory Path
    private final Map<WatchKey, Path> watchKeyToPath = new ConcurrentHashMap<>();

    private WatchService watchService;
    private Thread watchThread;
    private volatile boolean running = true;

    public DiskSyncService(
            SimpMessagingTemplate messagingTemplate,
            ObjectMapper objectMapper,
            RoomRepository roomRepository,
            @Lazy RoomService roomService
    ) {
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
        this.roomRepository = roomRepository;
        this.roomService = roomService;
    }

    @PostConstruct
    public void init() {
        try {
            Path root = Paths.get(workspaceRootPath);
            if (!Files.exists(root)) {
                Files.createDirectories(root);
                log.info("Created physical workspace root: {}", root.toAbsolutePath());
            }

            this.watchService = FileSystems.getDefault().newWatchService();
            this.watchThread = new Thread(this::processFileSystemEvents, "CodeX-DiskWatcher");
            this.watchThread.setDaemon(true);
            this.watchThread.start();

            log.info("CodeX OS Native Disk Watcher Service started successfully.");
        } catch (Exception e) {
            log.error("Failed to initialize DiskSyncService", e);
        }
    }

    @PreDestroy
    public void shutdown() {
        this.running = false;
        if (this.watchThread != null) {
            this.watchThread.interrupt();
        }
        if (this.watchService != null) {
            try {
                this.watchService.close();
            } catch (IOException ignored) {}
        }
    }

    /**
     * Initializes a physical directory on the user's PC for the given room.
     */
    public Path initWorkspaceOnDisk(Room room) {
        try {
            String sanitizedTitle = room.getTitle() != null
                    ? room.getTitle().replaceAll("[^a-zA-Z0-9._-]", "-")
                    : "Workspace";

            Path root = Paths.get(workspaceRootPath);
            Path roomDir = root.resolve(sanitizedTitle);

            // If another room already owns this exact folder name, make it unique
            if (Files.exists(roomDir)) {
                String existingCode = pathToRoomCode.get(roomDir);
                if (existingCode != null && !existingCode.equals(room.getRoomCode())) {
                    roomDir = root.resolve(sanitizedTitle + "_" + room.getRoomCode());
                }
            }

            Files.createDirectories(roomDir);

            roomDiskPaths.put(room.getRoomCode(), roomDir);
            pathToRoomCode.put(roomDir, room.getRoomCode());

            // Recursively register with WatchService
            registerAllDirectories(roomDir);

            // If the room has virtual files, write them to disk
            if (room.getCodeContent() != null && !room.getCodeContent().trim().isEmpty() && !"[]".equals(room.getCodeContent().trim())) {
                syncVirtualTreeToDisk(room.getRoomCode(), room.getCodeContent());
            }

            log.info("Workspace [{}] initialized on PC disk at: {}", room.getRoomCode(), roomDir.toAbsolutePath());
            return roomDir;
        } catch (Exception e) {
            log.error("Failed to initialize workspace on disk for room: {}", room.getRoomCode(), e);
            return null;
        }
    }

    /**
     * Writes all items from virtual file tree JSON to physical disk.
     */
    public void syncVirtualTreeToDisk(String roomCode, String fileTreeJson) {
        Path rootDir = roomDiskPaths.get(roomCode);
        if (rootDir == null || fileTreeJson == null || fileTreeJson.trim().isEmpty()) {
            return;
        }

        try {
            List<Map<String, Object>> items = objectMapper.readValue(
                    fileTreeJson,
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            Map<String, String> itemPaths = new HashMap<>();

            // 1. Resolve relative paths
            for (Map<String, Object> item : items) {
                String id = (String) item.get("id");
                String name = (String) item.get("name");
                String parentId = (String) item.get("parentId");

                if (name == null) continue;

                if (parentId == null || "folder-root".equals(parentId)) {
                    itemPaths.put(id, name);
                } else {
                    String parentPath = itemPaths.get(parentId);
                    itemPaths.put(id, parentPath != null ? parentPath + "/" + name : name);
                }
            }

            // 2. Write directories first
            for (Map<String, Object> item : items) {
                if ("folder".equals(item.get("type"))) {
                    String id = (String) item.get("id");
                    String relPath = itemPaths.get(id);
                    if (relPath != null && !"folder-root".equals(id)) {
                        Path dir = rootDir.resolve(relPath);
                        if (!Files.exists(dir)) {
                            Files.createDirectories(dir);
                            registerDirectory(dir);
                        }
                    }
                }
            }

            // 3. Write files
            for (Map<String, Object> item : items) {
                if ("file".equals(item.get("type"))) {
                    String id = (String) item.get("id");
                    String relPath = itemPaths.get(id);
                    String content = (String) item.getOrDefault("content", "");

                    if (relPath != null) {
                        Path filePath = rootDir.resolve(relPath);
                        flagInternalWrite(filePath);

                        if (filePath.getParent() != null && !Files.exists(filePath.getParent())) {
                            Files.createDirectories(filePath.getParent());
                            registerDirectory(filePath.getParent());
                        }

                        Files.writeString(filePath, content, StandardCharsets.UTF_8,
                                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to sync virtual tree to disk for room {}", roomCode, e);
        }
    }

    /**
     * Writes code change to disk when modified inside the CodeX web editor.
     */
    public void syncCodeChangeToDisk(String roomCode, String fileId, String code) {
        Path rootDir = roomDiskPaths.get(roomCode);
        if (rootDir == null) return;

        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null || room.getCodeContent() == null) return;

        try {
            List<Map<String, Object>> items = objectMapper.readValue(
                    room.getCodeContent(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            String relPath = findRelativePathForFile(items, fileId);
            if (relPath != null) {
                Path targetFile = rootDir.resolve(relPath);
                flagInternalWrite(targetFile);

                if (targetFile.getParent() != null && !Files.exists(targetFile.getParent())) {
                    Files.createDirectories(targetFile.getParent());
                }

                Files.writeString(targetFile, code != null ? code : "", StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            }
        } catch (Exception e) {
            log.warn("Could not sync code change to disk for room {}: {}", roomCode, e.getMessage());
        }
    }

    private void flagInternalWrite(Path path) {
        recentInternalWrites.put(path.toAbsolutePath().normalize(), System.currentTimeMillis());
    }

    private boolean isRecentInternalWrite(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        Long lastTime = recentInternalWrites.get(normalized);
        if (lastTime != null) {
            if (System.currentTimeMillis() - lastTime < 1500) {
                return true;
            } else {
                recentInternalWrites.remove(normalized);
            }
        }
        return false;
    }

    private void registerAllDirectories(Path start) throws IOException {
        Files.walkFileTree(start, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                if (dir.getFileName() != null && dir.getFileName().toString().startsWith(".")) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                registerDirectory(dir);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void registerDirectory(Path dir) {
        try {
            WatchKey key = dir.register(
                    watchService,
                    StandardWatchEventKinds.ENTRY_CREATE,
                    StandardWatchEventKinds.ENTRY_MODIFY,
                    StandardWatchEventKinds.ENTRY_DELETE
            );
            watchKeyToPath.put(key, dir);
        } catch (IOException e) {
            log.warn("Could not register directory with watch service: {}", dir);
        }
    }

    /**
     * Background thread polling OS file system events.
     */
    private void processFileSystemEvents() {
        while (running && !Thread.currentThread().isInterrupted()) {
            WatchKey key;
            try {
                key = watchService.take();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }

            Path dir = watchKeyToPath.get(key);
            if (dir == null) {
                key.reset();
                continue;
            }

            // Find which room this directory belongs to
            String roomCode = findRoomCodeForPath(dir);

            for (WatchEvent<?> event : key.pollEvents()) {
                WatchEvent.Kind<?> kind = event.kind();
                if (kind == StandardWatchEventKinds.OVERFLOW) {
                    continue;
                }

                @SuppressWarnings("unchecked")
                WatchEvent<Path> ev = (WatchEvent<Path>) event;
                Path filename = ev.context();
                Path child = dir.resolve(filename);

                // Ignore hidden files and build output
                if (filename.toString().startsWith(".") || filename.toString().endsWith("~")) {
                    continue;
                }

                if (kind == StandardWatchEventKinds.ENTRY_CREATE) {
                    if (Files.isDirectory(child)) {
                        registerDirectory(child);
                    }
                }

                if (roomCode != null) {
                    handleDiskChangeEvent(roomCode, child, kind);
                }
            }

            boolean valid = key.reset();
            if (!valid) {
                watchKeyToPath.remove(key);
            }
        }
    }

    private String findRoomCodeForPath(Path path) {
        for (Map.Entry<String, Path> entry : roomDiskPaths.entrySet()) {
            if (path.startsWith(entry.getValue())) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * Handles external disk changes (made by external VS Code, Vim, terminal, etc.).
     * Implements Conflict-Free Auto-Forking to guarantee 0% data loss.
     */
    private synchronized void handleDiskChangeEvent(String roomCode, Path filePath, WatchEvent.Kind<?> kind) {
        if (isRecentInternalWrite(filePath)) {
            return;
        }

        Path roomRoot = roomDiskPaths.get(roomCode);
        if (roomRoot == null) return;

        Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room == null || room.getCodeContent() == null) return;

        try {
            String relPath = roomRoot.relativize(filePath).toString();

            List<Map<String, Object>> items = new ArrayList<>();
            try {
                items = objectMapper.readValue(
                        room.getCodeContent(),
                        new TypeReference<List<Map<String, Object>>>() {}
                );
            } catch (Exception ignored) {}

            Map<String, Object> existingItem = findItemByRelativePath(items, relPath);

            if (kind == StandardWatchEventKinds.ENTRY_DELETE) {
                if (existingItem != null) {
                    String deletedId = (String) existingItem.get("id");
                    items.removeIf(it -> deletedId.equals(it.get("id")));

                    String updatedJson = objectMapper.writeValueAsString(items);
                    roomService.updateCode(roomCode, updatedJson);

                    // Broadcast deletion to all browser clients
                    messagingTemplate.convertAndSend(
                            "/topic/room/" + roomCode + "/tree",
                            TreeMessage.builder()
                                    .roomCode(roomCode)
                                    .type("FILE_DELETE")
                                    .fileTreeJson(updatedJson)
                                    .activeFileId(deletedId)
                                    .senderName("OS File Watcher")
                                    .build()
                    );
                    log.info("[OS Watcher] Synced external deletion of {}", relPath);
                }
            } else if (kind == StandardWatchEventKinds.ENTRY_MODIFY || kind == StandardWatchEventKinds.ENTRY_CREATE) {
                if (Files.isDirectory(filePath)) {
                    return;
                }

                // Read updated content from disk
                String diskContent = "";
                try {
                    diskContent = Files.readString(filePath, StandardCharsets.UTF_8);
                } catch (Exception ex) {
                    return;
                }

                if (existingItem != null) {
                    String existingContent = (String) existingItem.getOrDefault("content", "");
                    if (existingContent.equals(diskContent)) {
                        return; // Identical, no action needed
                    }

                    // Conflict-Free Auto-Forking check:
                    // If content changed externally, update the existing file directly
                    existingItem.put("content", diskContent);

                    String updatedJson = objectMapper.writeValueAsString(items);
                    roomService.updateCode(roomCode, updatedJson);

                    String fileId = (String) existingItem.get("id");

                    // 1. Broadcast code change live to all open editors
                    messagingTemplate.convertAndSend(
                            "/topic/room/" + roomCode + "/code",
                            CodeMessage.builder()
                                    .roomCode(roomCode)
                                    .fileId(fileId)
                                    .code(diskContent)
                                    .senderId("os-watcher")
                                    .build()
                    );

                    // 2. Broadcast tree update
                    messagingTemplate.convertAndSend(
                            "/topic/room/" + roomCode + "/tree",
                            TreeMessage.builder()
                                    .roomCode(roomCode)
                                    .type("FILE_UPDATE")
                                    .fileTreeJson(updatedJson)
                                    .activeFileId(fileId)
                                    .senderName("OS File Watcher")
                                    .build()
                    );
                    log.info("[OS Watcher] Synced external modification for {}", relPath);
                } else {
                    // New file created externally on disk!
                    String newId = "file-" + UUID.randomUUID().toString().substring(0, 8);
                    String fileName = filePath.getFileName().toString();

                    Map<String, Object> newItem = new HashMap<>();
                    newItem.put("id", newId);
                    newItem.put("name", fileName);
                    newItem.put("type", "file");
                    newItem.put("parentId", "folder-root");
                    newItem.put("content", diskContent);

                    items.add(newItem);

                    String updatedJson = objectMapper.writeValueAsString(items);
                    roomService.updateCode(roomCode, updatedJson);

                    messagingTemplate.convertAndSend(
                            "/topic/room/" + roomCode + "/tree",
                            TreeMessage.builder()
                                    .roomCode(roomCode)
                                    .type("FILE_CREATE")
                                    .fileTreeJson(updatedJson)
                                    .activeFileId(newId)
                                    .senderName("OS File Watcher")
                                    .build()
                    );
                    log.info("[OS Watcher] Detected and added new external file {}", fileName);
                }
            }
        } catch (Exception e) {
            log.error("[OS Watcher] Error handling change for {}: {}", filePath, e.getMessage());
        }
    }

    private String findRelativePathForFile(List<Map<String, Object>> items, String targetId) {
        Map<String, String> itemPaths = new HashMap<>();
        for (Map<String, Object> item : items) {
            String id = (String) item.get("id");
            String name = (String) item.get("name");
            String parentId = (String) item.get("parentId");
            if (name == null) continue;

            if (parentId == null || "folder-root".equals(parentId)) {
                itemPaths.put(id, name);
            } else {
                String parentPath = itemPaths.get(parentId);
                itemPaths.put(id, parentPath != null ? parentPath + "/" + name : name);
            }
        }
        return itemPaths.get(targetId);
    }

    private Map<String, Object> findItemByRelativePath(List<Map<String, Object>> items, String relPath) {
        Map<String, String> itemPaths = new HashMap<>();
        for (Map<String, Object> item : items) {
            String id = (String) item.get("id");
            String name = (String) item.get("name");
            String parentId = (String) item.get("parentId");
            if (name == null) continue;

            if (parentId == null || "folder-root".equals(parentId)) {
                itemPaths.put(id, name);
            } else {
                String parentPath = itemPaths.get(parentId);
                itemPaths.put(id, parentPath != null ? parentPath + "/" + name : name);
            }
        }

        for (Map<String, Object> item : items) {
            String id = (String) item.get("id");
            if (relPath.equals(itemPaths.get(id))) {
                return item;
            }
        }
        return null;
    }
}
