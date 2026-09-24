package com.codeX.live.service;

import com.codeX.live.dto.TerminalOutputMessage;
import com.codeX.live.entity.Room;
import com.codeX.live.repository.RoomRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class TerminalService {

    private final SimpMessagingTemplate messagingTemplate;
    private final RoomRepository roomRepository;
    private final DiskSyncService diskSyncService;

    // roomCode -> TerminalSession
    private final Map<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    public TerminalService(
            SimpMessagingTemplate messagingTemplate,
            RoomRepository roomRepository,
            @Lazy DiskSyncService diskSyncService
    ) {
        this.messagingTemplate = messagingTemplate;
        this.roomRepository = roomRepository;
        this.diskSyncService = diskSyncService;
    }

    public static class TerminalSession {
        Process process;
        OutputStream outputStream;
        InputStream inputStream;
        final StringBuilder history = new StringBuilder();
        volatile boolean allowTeammateInput = true; // Collaborative by default: all members can type!
        String hostUsername;
        String startedBy;
        Thread readerThread;
        String roomCode;
        String workDir;
    }

    /**
     * Checks if a terminal process is currently active and alive for the room.
     */
    public boolean isRunning(String roomCode) {
        TerminalSession session = sessions.get(roomCode);
        return session != null && session.process != null && session.process.isAlive();
    }

    /**
     * Starts a live terminal shell session for the workspace. Can be initiated by ANY room member.
     */
    public synchronized TerminalSession startSession(String roomCode, String username) {
        TerminalSession existing = sessions.get(roomCode);
        if (existing != null && existing.process != null && existing.process.isAlive()) {
            return existing;
        }

        // Clean up any stale/dead session
        if (existing != null) {
            cleanupSession(existing);
            sessions.remove(roomCode);
        }

        Room room = roomRepository.findByRoomCodeWithOwner(roomCode)
                .or(() -> roomRepository.findByRoomCode(roomCode))
                .orElse(null);
        if (room == null) {
            log.warn("Cannot start terminal: Room {} not found", roomCode);
            return null;
        }

        TerminalSession session = new TerminalSession();
        session.roomCode = roomCode;
        String hostUser = username;
        try {
            if (room.getOwner() != null) {
                hostUser = room.getOwner().getUsername();
            }
        } catch (Exception ignored) {}
        session.hostUsername = hostUser != null ? hostUser : "Developer";
        session.startedBy = username != null ? username : "Developer";
        session.allowTeammateInput = true; // Fully interactive for all members

        // Resolve working directory on host machine
        File workDir = resolveWorkDir(room);
        session.workDir = workDir.getAbsolutePath();

        try {
            ProcessBuilder pb = new ProcessBuilder();
            String os = System.getProperty("os.name").toLowerCase();
            Map<String, String> env = pb.environment();
            String currentPath = env.getOrDefault("PATH", "");
            env.put("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + currentPath);
            env.put("TERM", "xterm-256color");
            env.put("COLORTERM", "truecolor");
            env.put("LANG", "en_US.UTF-8");
            env.put("LC_ALL", "en_US.UTF-8");

            if (os.contains("mac") || os.contains("darwin")) {
                pb.command("python3", "-u", "-c", "import pty; pty.spawn(['/bin/zsh'])");
            } else if (os.contains("win")) {
                pb.command("powershell.exe", "-NoLogo");
            } else {
                pb.command("python3", "-u", "-c", "import pty; pty.spawn(['/bin/bash'])");
            }

            pb.directory(workDir);
            pb.redirectErrorStream(true); // Merge stderr into stdout

            Process process = pb.start();
            session.process = process;
            session.outputStream = process.getOutputStream();
            session.inputStream = process.getInputStream();

            String banner = "\r\n\u001b[1;36mCodeX Live Collaborative Terminal\u001b[0m\r\n"
                    + "\u001b[90mDirectory: " + workDir.getAbsolutePath() + "\u001b[0m\r\n"
                    + "\u001b[32m✔ Active session started by @" + session.startedBy + " • Shared with all room members\u001b[0m\r\n\r\n";

            synchronized (session.history) {
                session.history.setLength(0);
                session.history.append(banner);
            }

            // Background reader thread streaming shell bytes to WebSockets
            TerminalSession finalSession = session;
            session.readerThread = new Thread(() -> streamTerminalOutput(finalSession), "CodeX-Term-" + roomCode);
            session.readerThread.setDaemon(true);
            session.readerThread.start();

            // Send initial newline so shell displays the prompt
            try {
                session.outputStream.write("\n".getBytes(StandardCharsets.UTF_8));
                session.outputStream.flush();
            } catch (Exception ignored) {}

            sessions.put(roomCode, session);
            log.info("Started native shell for workspace [{}] in dir: {} by user @{}", roomCode, workDir.getAbsolutePath(), username);

            // Broadcast terminal STARTED event to all room members
            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomCode + "/terminal/output",
                    TerminalOutputMessage.builder()
                            .roomCode(roomCode)
                            .data(banner)
                            .type("STARTED")
                            .running(true)
                            .startedBy(session.startedBy)
                            .allowTeammateInput(true)
                            .hostUsername(session.hostUsername)
                            .build()
            );

            return session;
        } catch (Exception e) {
            log.error("Failed to spawn native terminal shell for room {}", roomCode, e);
            return null;
        }
    }

    /**
     * Stops/terminates the active terminal process. Can be initiated by any member.
     */
    public synchronized boolean stopSession(String roomCode, String username) {
        TerminalSession session = sessions.remove(roomCode);
        if (session != null) {
            cleanupSession(session);

            String stopNotice = "\r\n\u001b[33m[CodeX Terminal] Session stopped by @" + (username != null ? username : "user") + ".\u001b[0m\r\n";
            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomCode + "/terminal/output",
                    TerminalOutputMessage.builder()
                            .roomCode(roomCode)
                            .data(stopNotice)
                            .type("STOPPED")
                            .running(false)
                            .startedBy(username)
                            .allowTeammateInput(true)
                            .hostUsername(session.hostUsername)
                            .build()
            );
            return true;
        }
        return false;
    }

    /**
     * Backward-compatible alias for obtaining an active session.
     */
    public synchronized TerminalSession getOrCreateSession(String roomCode, String username) {
        TerminalSession session = sessions.get(roomCode);
        if (session != null && session.process != null && session.process.isAlive()) {
            return session;
        }
        return startSession(roomCode, username);
    }

    private File resolveWorkDir(Room room) {
        if (room.getDiskPath() != null) {
            File f = new File(room.getDiskPath());
            if (f.exists() && f.isDirectory()) {
                return f;
            }
        }

        if (diskSyncService != null) {
            Path p = diskSyncService.initWorkspaceOnDisk(room);
            if (p != null && Files.exists(p)) {
                return p.toFile();
            }
        }

        return new File(System.getProperty("user.home"));
    }

    private void streamTerminalOutput(TerminalSession session) {
        byte[] buffer = new byte[2048];
        try {
            int read;
            while ((read = session.inputStream.read(buffer)) != -1) {
                String output = new String(buffer, 0, read, StandardCharsets.UTF_8);

                synchronized (session.history) {
                    if (session.history.length() > 25000) {
                        session.history.delete(0, 5000); // Ring buffer
                    }
                    session.history.append(output);
                }

                // Broadcast live to all connected teammates in the room
                messagingTemplate.convertAndSend(
                        "/topic/room/" + session.roomCode + "/terminal/output",
                        TerminalOutputMessage.builder()
                                .roomCode(session.roomCode)
                                .data(output)
                                .type("OUTPUT")
                                .running(true)
                                .allowTeammateInput(session.allowTeammateInput)
                                .hostUsername(session.hostUsername)
                                .startedBy(session.startedBy)
                                .build()
                );
            }
        } catch (IOException e) {
            log.info("Terminal session for room {} closed", session.roomCode);
        } finally {
            sessions.remove(session.roomCode);
            cleanupSession(session);
            messagingTemplate.convertAndSend(
                    "/topic/room/" + session.roomCode + "/terminal/output",
                    TerminalOutputMessage.builder()
                            .roomCode(session.roomCode)
                            .data("\r\n\u001b[33m[CodeX Terminal] Shell process exited.\u001b[0m\r\n")
                            .type("STOPPED")
                            .running(false)
                            .allowTeammateInput(true)
                            .hostUsername(session.hostUsername)
                            .build()
            );
        }
    }

    /**
     * Sends input characters/commands from the browser into the real shell process.
     * All room participants have write access!
     */
    public boolean writeInput(String roomCode, String data, String senderUsername) {
        TerminalSession session = sessions.get(roomCode);
        if (session == null || session.process == null || !session.process.isAlive()) {
            log.info("[Terminal] Auto-starting session for room {} on input from @{}", roomCode, senderUsername);
            session = startSession(roomCode, senderUsername);
        }

        if (session == null || session.outputStream == null) {
            log.warn("[Terminal] Failed to write input for room {}: session or outputStream is null", roomCode);
            return false;
        }

        // Check if explicitly locked by host
        boolean isHost = senderUsername != null && (senderUsername.equalsIgnoreCase(session.hostUsername) || senderUsername.equalsIgnoreCase(session.startedBy));
        if (!isHost && !session.allowTeammateInput) {
            log.warn("[Terminal] Input rejected for room {}: locked by host @{}", roomCode, session.hostUsername);
            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomCode + "/terminal/output",
                    TerminalOutputMessage.builder()
                            .roomCode(roomCode)
                            .data("\r\n\u001b[33m[CodeX Live] Terminal input is temporarily locked by host @" + session.hostUsername + ".\u001b[0m\r\n")
                            .type("OUTPUT")
                            .running(true)
                            .allowTeammateInput(session.allowTeammateInput)
                            .hostUsername(session.hostUsername)
                            .build()
            );
            return false;
        }

        try {
            byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
            session.outputStream.write(bytes);
            session.outputStream.flush();
            log.info("[Terminal] Wrote {} bytes to shell for room {} from @{}", bytes.length, roomCode, senderUsername);
            return true;
        } catch (IOException e) {
            log.warn("Failed to write to terminal for room {}: {}", roomCode, e.getMessage());
            return false;
        }
    }

    /**
     * Host toggles permission to allow or disallow teammate input.
     */
    public boolean setPermission(String roomCode, boolean allowTeammateInput, String requestedBy) {
        TerminalSession session = sessions.get(roomCode);
        if (session == null) return false;

        session.allowTeammateInput = allowTeammateInput;

        String statusNotice = allowTeammateInput
                ? "\r\n\u001b[32m[CodeX Live] Interactive terminal access open to all team members.\u001b[0m\r\n"
                : "\r\n\u001b[33m[CodeX Live] Terminal switched to Read-Only mode by host.\u001b[0m\r\n";

        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/terminal/output",
                TerminalOutputMessage.builder()
                        .roomCode(roomCode)
                        .data(statusNotice)
                        .type("STATUS")
                        .running(true)
                        .allowTeammateInput(session.allowTeammateInput)
                        .hostUsername(session.hostUsername)
                        .build()
        );

        return true;
    }

    /**
     * Initializes terminal state for late joiners or newly opened terminal panels.
     */
    public TerminalOutputMessage getTerminalState(String roomCode, String username) {
        TerminalSession session = sessions.get(roomCode);
        boolean isRunning = session != null && session.process != null && session.process.isAlive();

        if (!isRunning) {
            return TerminalOutputMessage.builder()
                    .roomCode(roomCode)
                    .data("")
                    .type("INIT")
                    .running(false)
                    .allowTeammateInput(true)
                    .build();
        }

        String initialData;
        synchronized (session.history) {
            if (session.history.length() == 0) {
                String banner = "\r\n\u001b[1;36mCodeX Live Collaborative Terminal\u001b[0m\r\n"
                        + "\u001b[90mDirectory: " + (session.workDir != null ? session.workDir : "~/Desktop/CodeXProjects") + "\u001b[0m\r\n"
                        + "\u001b[32m✔ Active session • Ready for commands\u001b[0m\r\n\r\n";
                session.history.append(banner);
            }
            initialData = session.history.toString();
        }

        return TerminalOutputMessage.builder()
                .roomCode(roomCode)
                .data(initialData)
                .type("INIT")
                .running(true)
                .allowTeammateInput(session.allowTeammateInput)
                .hostUsername(session.hostUsername)
                .startedBy(session.startedBy)
                .build();
    }

    private void cleanupSession(TerminalSession session) {
        try {
            if (session.outputStream != null) session.outputStream.close();
        } catch (Exception ignored) {}
        try {
            if (session.inputStream != null) session.inputStream.close();
        } catch (Exception ignored) {}
        try {
            if (session.process != null && session.process.isAlive()) {
                session.process.destroyForcibly();
            }
        } catch (Exception ignored) {}
    }

    @PreDestroy
    public void cleanup() {
        for (TerminalSession session : sessions.values()) {
            cleanupSession(session);
        }
        sessions.clear();
    }
}
