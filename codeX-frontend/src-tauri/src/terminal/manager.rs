use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use portable_pty::PtySize;
use tauri::{AppHandle, Emitter};

use super::pty::create_pty;
use super::session::{TerminalSession, TerminalSessionInfo};

#[derive(Clone)]
pub struct TerminalManager {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_session(
        &self,
        app_handle: AppHandle,
        id: String,
        title: Option<String>,
        shell: &str,
        cwd: &str,
        cols: u16,
        rows: u16,
    ) -> Result<TerminalSessionInfo, String> {
        let spawned = create_pty(shell, cwd, cols, rows, None)?;
        let reader = spawned
            .pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;
        let writer = spawned
            .pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to obtain PTY writer: {}", e))?;

        let session_title = title.unwrap_or_else(|| {
            std::path::Path::new(shell)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("terminal")
                .to_string()
        });

        let session_info = TerminalSessionInfo {
            id: id.clone(),
            title: session_title.clone(),
            shell: shell.to_string(),
            cwd: cwd.to_string(),
        };

        let session = TerminalSession {
            id: id.clone(),
            title: session_title,
            shell: shell.to_string(),
            cwd: cwd.to_string(),
            master: spawned.pair.master,
            writer,
            child: spawned.child,
        };

        {
            let mut map = self.sessions.lock().unwrap();
            map.insert(id.clone(), session);
        }

        // Spawn async reader thread for non-blocking stream
        let event_name = format!("terminal-output-{}", id);
        let exit_event_name = format!("terminal-exit-{}", id);
        let sessions_clone = self.sessions.clone();
        let session_id = id.clone();

        thread::spawn(move || {
            let mut mut_reader = reader;
            let mut buf = [0u8; 4096];
            loop {
                match mut_reader.read(&mut buf) {
                    Ok(0) => break, // EOF reached
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        if let Err(e) = app_handle.emit(&event_name, text) {
                            log::debug!("Error emitting terminal output event: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        log::debug!("PTY reader read error: {}", e);
                        break;
                    }
                }
            }

            // Cleanup session on exit
            let mut code = 0;
            if let Ok(mut map) = sessions_clone.lock() {
                if let Some(mut sess) = map.remove(&session_id) {
                    if let Ok(status) = sess.child.wait() {
                        code = status.exit_code();
                    }
                }
            }

            let _ = app_handle.emit(&exit_event_name, code);
        });

        Ok(session_info)
    }

    pub fn write_session(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let mut map = self.sessions.lock().unwrap();
        let session = map
            .get_mut(id)
            .ok_or_else(|| format!("Terminal session '{}' not found", id))?;

        session
            .writer
            .write_all(data)
            .map_err(|e| format!("Failed to write to terminal: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush terminal: {}", e))?;
        Ok(())
    }

    pub fn resize_session(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let map = self.sessions.lock().unwrap();
        let session = map
            .get(id)
            .ok_or_else(|| format!("Terminal session '{}' not found", id))?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize terminal: {}", e))?;
        Ok(())
    }

    pub fn close_session(&self, id: &str) -> Result<(), String> {
        let mut map = self.sessions.lock().unwrap();
        if let Some(mut session) = map.remove(id) {
            let _ = session.child.kill();
        }
        Ok(())
    }

    pub fn list_sessions(&self) -> Vec<TerminalSessionInfo> {
        let map = self.sessions.lock().unwrap();
        map.values()
            .map(|s| TerminalSessionInfo {
                id: s.id.clone(),
                title: s.title.clone(),
                shell: s.shell.clone(),
                cwd: s.cwd.clone(),
            })
            .collect()
    }

    pub fn rename_session(&self, id: &str, new_title: String) -> Result<(), String> {
        let mut map = self.sessions.lock().unwrap();
        let session = map
            .get_mut(id)
            .ok_or_else(|| format!("Terminal session '{}' not found", id))?;
        session.title = new_title;
        Ok(())
    }

    pub fn terminate_all(&self) {
        let mut map = self.sessions.lock().unwrap();
        for (_, mut session) in map.drain() {
            let _ = session.child.kill();
        }
    }
}
