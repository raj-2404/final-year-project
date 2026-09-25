use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

struct ManagedLspProcess {
    child: Option<Child>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
}

#[derive(Clone)]
pub struct LspManager {
    processes: Arc<Mutex<HashMap<String, ManagedLspProcess>>>,
}

impl LspManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Checks if a binary is present in the system PATH.
    pub fn check_binary(&self, name: &str) -> bool {
        if name.is_empty() || name.contains(' ') || name.contains(';') || name.contains('&') || name.contains('|') {
            return false;
        }

        #[cfg(target_os = "windows")]
        let check_cmd = "where";
        #[cfg(not(target_os = "windows"))]
        let check_cmd = "which";

        match Command::new(check_cmd).arg(name).output() {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    /// Starts a local language server process with piped stdio.
    pub fn start_server(
        &self,
        app_handle: AppHandle,
        id: String,
        executable: String,
        args: Vec<String>,
        cwd: String,
    ) -> Result<(), String> {
        self.stop_server(&id).ok();

        // Security check: executable must be a valid command name or absolute path
        if executable.is_empty() || executable.contains(';') || executable.contains('&') || executable.contains('|') {
            return Err("Invalid executable name or command injection character detected".to_string());
        }

        let mut cmd = Command::new(&executable);
        cmd.args(&args);
        if !cwd.is_empty() {
            cmd.current_dir(&cwd);
        }

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Inherit current environment variables
        for (k, v) in std::env::vars() {
            cmd.env(k, v);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn language server '{}': {}", executable, e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let stdin_arc = Arc::new(Mutex::new(stdin));

        {
            let mut map = self.processes.lock().unwrap();
            map.insert(
                id.clone(),
                ManagedLspProcess {
                    child: Some(child),
                    stdin: stdin_arc,
                },
            );
        }

        let proc_id = id.clone();
        let app_clone = app_handle.clone();
        let procs_clone = self.processes.clone();

        // 1. Stdout reader thread (LSP JSON-RPC response & notification stream)
        if let Some(mut out) = stdout {
            let p_id = proc_id.clone();
            let app = app_clone.clone();

            thread::spawn(move || {
                let mut buffer = [0u8; 8192];
                loop {
                    match out.read(&mut buffer) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                            let _ = app.emit(&format!("lsp-stdout-{}", p_id), text);
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // 2. Stderr reader thread (Server logs / warnings)
        if let Some(mut err) = stderr {
            let p_id = proc_id.clone();
            let app = app_clone.clone();

            thread::spawn(move || {
                let mut buffer = [0u8; 4096];
                loop {
                    match err.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                            let _ = app.emit(&format!("lsp-stderr-{}", p_id), text);
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // 3. Process exit monitor thread
        thread::spawn(move || {
            loop {
                thread::sleep(std::time::Duration::from_millis(500));
                let mut map = procs_clone.lock().unwrap();
                if let Some(p) = map.get_mut(&proc_id) {
                    if let Some(ref mut ch) = p.child {
                        match ch.try_wait() {
                            Ok(Some(status)) => {
                                let exit_code = status.code().unwrap_or(0);
                                let _ = app_clone.emit(
                                    &format!("lsp-exit-{}", proc_id),
                                    serde_json::json!({ "id": proc_id, "exitCode": exit_code }),
                                );
                                break;
                            }
                            Ok(None) => {}
                            Err(_) => break,
                        }
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        });

        Ok(())
    }

    /// Writes data into the stdin of the language server process.
    pub fn write_to_server(&self, id: &str, data: &str) -> Result<(), String> {
        let map = self.processes.lock().unwrap();
        if let Some(p) = map.get(id) {
            let mut stdin_guard = p.stdin.lock().unwrap();
            if let Some(ref mut stdin) = *stdin_guard {
                stdin
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("Failed to write to language server '{}': {}", id, e))?;
                stdin
                    .flush()
                    .map_err(|e| format!("Failed to flush to language server '{}': {}", id, e))?;
                return Ok(());
            }
        }
        Err(format!("Language server '{}' is not running or stdin is unavailable", id))
    }

    /// Stops a running language server process.
    pub fn stop_server(&self, id: &str) -> Result<(), String> {
        let mut map = self.processes.lock().unwrap();
        if let Some(mut p) = map.remove(id) {
            if let Some(mut child) = p.child.take() {
                let _ = child.kill();
            }
        }
        Ok(())
    }

    /// Terminates all active language servers upon application exit.
    pub fn terminate_all(&self) {
        let mut map = self.processes.lock().unwrap();
        for (_, p) in map.iter_mut() {
            if let Some(mut child) = p.child.take() {
                let _ = child.kill();
            }
        }
        map.clear();
    }
}
