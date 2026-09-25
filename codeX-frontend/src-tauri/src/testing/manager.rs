use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

use super::process::TestProcess;

#[derive(Clone)]
pub struct TestManager {
    processes: Arc<Mutex<HashMap<String, TestProcess>>>,
}

impl TestManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Checks if a test runner or executable exists in system PATH.
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

    /// Starts a local test execution process.
    pub fn start_process(
        &self,
        app_handle: AppHandle,
        id: String,
        executable: String,
        args: Vec<String>,
        cwd: String,
        env: Option<HashMap<String, String>>,
    ) -> Result<(), String> {
        self.stop_process(&id).ok();

        // 1. Basic security validation
        let trimmed_exe = executable.trim();
        if trimmed_exe.is_empty() || trimmed_exe.contains(';') || trimmed_exe.contains('&') || trimmed_exe.contains('|') {
            return Err("Invalid executable name or command injection character detected".to_string());
        }

        // 2. Validate working directory if provided
        if !cwd.is_empty() {
            let path = Path::new(&cwd);
            if !path.exists() || !path.is_dir() {
                return Err(format!("Working directory does not exist or is not a directory: {}", cwd));
            }
        }

        let mut cmd = Command::new(trimmed_exe);
        cmd.args(&args);
        if !cwd.is_empty() {
            cmd.current_dir(&cwd);
        }

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Inherit environment variables
        for (k, v) in std::env::vars() {
            cmd.env(k, v);
        }

        // Apply custom environment variables if any
        if let Some(extra_env) = env {
            for (k, v) in extra_env {
                cmd.env(k, v);
            }
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn test process '{}': {}", trimmed_exe, e))?;

        let stdin = child.stdin.take();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let stdin_arc = Arc::new(Mutex::new(stdin));

        {
            let mut map = self.processes.lock().unwrap();
            map.insert(
                id.clone(),
                TestProcess {
                    child: Some(child),
                    stdin: stdin_arc,
                },
            );
        }

        let proc_id = id.clone();
        let app_clone = app_handle.clone();
        let procs_clone = self.processes.clone();

        // 3. Stdout streaming reader thread
        if let Some(mut out) = stdout {
            let p_id = proc_id.clone();
            let app = app_clone.clone();

            thread::spawn(move || {
                let mut buffer = [0u8; 8192];
                loop {
                    match out.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                            let _ = app.emit(&format!("test-stdout-{}", p_id), text);
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // 4. Stderr streaming reader thread
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
                            let _ = app.emit(&format!("test-stderr-{}", p_id), text);
                        }
                        Err(_) => break,
                    }
                }
            });
        }

        // 5. Process exit monitor thread
        thread::spawn(move || {
            loop {
                thread::sleep(std::time::Duration::from_millis(200));
                let mut map = procs_clone.lock().unwrap();
                if let Some(proc) = map.get_mut(&proc_id) {
                    if let Some(ref mut child) = proc.child {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                let exit_code = status.code().unwrap_or(0);
                                let _ = app_clone.emit(
                                    &format!("test-exit-{}", proc_id),
                                    serde_json::json!({
                                        "exitCode": exit_code,
                                        "success": status.success()
                                    }),
                                );
                                proc.child = None;
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

    /// Writes data to process stdin.
    pub fn write_to_process(&self, id: &str, data: &str) -> Result<(), String> {
        let map = self.processes.lock().unwrap();
        if let Some(proc) = map.get(id) {
            let mut stdin_guard = proc.stdin.lock().unwrap();
            if let Some(ref mut stdin) = *stdin_guard {
                stdin
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("Failed to write to test process stdin: {}", e))?;
                stdin.flush().map_err(|e| format!("Failed to flush test process stdin: {}", e))?;
                Ok(())
            } else {
                Err("Test process stdin not available".to_string())
            }
        } else {
            Err(format!("Test process '{}' not found", id))
        }
    }

    /// Gracefully stops a test process.
    pub fn stop_process(&self, id: &str) -> Result<(), String> {
        let mut map = self.processes.lock().unwrap();
        if let Some(mut proc) = map.remove(id) {
            if let Some(ref mut child) = proc.child {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        Ok(())
    }

    /// Forcefully kills a test process.
    pub fn kill_process(&self, id: &str) -> Result<(), String> {
        self.stop_process(id)
    }

    /// Terminates all running test processes on CodeX shutdown.
    pub fn terminate_all(&self) {
        let mut map = self.processes.lock().unwrap();
        for (_, mut proc) in map.drain() {
            if let Some(ref mut child) = proc.child {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
