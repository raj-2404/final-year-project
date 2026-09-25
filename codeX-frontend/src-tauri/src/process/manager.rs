use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: String,
    pub name: String,
    pub command: String,
    pub cwd: String,
    pub pid: Option<u32>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub ports: Vec<u16>,
}

struct ManagedChild {
    info: ProcessInfo,
    child: Option<Child>,
}

#[derive(Clone)]
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ManagedChild>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_process(
        &self,
        app_handle: AppHandle,
        id: String,
        name: String,
        command_str: String,
        cwd_str: String,
    ) -> Result<ProcessInfo, String> {
        self.stop_process(&id).ok();

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("cmd.exe");
            c.arg("/c").arg(&command_str);
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
            let mut c = Command::new(shell);
            c.arg("-c").arg(&command_str);
            c
        };

        cmd.current_dir(&cwd_str);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Inherit environment variables
        for (k, v) in std::env::vars() {
            cmd.env(k, v);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start command '{}': {}", command_str, e))?;

        let pid = child.id();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let info = ProcessInfo {
            id: id.clone(),
            name,
            command: command_str,
            cwd: cwd_str,
            pid: Some(pid),
            status: "running".to_string(),
            exit_code: None,
            ports: Vec::new(),
        };

        {
            let mut map = self.processes.lock().unwrap();
            map.insert(
                id.clone(),
                ManagedChild {
                    info: info.clone(),
                    child: Some(child),
                },
            );
        }

        let processes_clone = self.processes.clone();
        let app_handle_clone = app_handle.clone();
        let proc_id = id.clone();

        // Spawn background log reader thread
        thread::spawn(move || {
            let port_regex = Regex::new(r"(?:localhost|127\.0\.0\.1|port\s*:?\s*|http://localhost:)(\d{3,5})").unwrap();

            if let Some(out) = stdout {
                let p_id = proc_id.clone();
                let app = app_handle_clone.clone();
                let procs = processes_clone.clone();
                let regex = port_regex.clone();

                thread::spawn(move || {
                    let reader = BufReader::new(out);
                    for line_res in reader.lines() {
                        if let Ok(line) = line_res {
                            let _ = app.emit(&format!("process-log-{}", p_id), line.clone());

                            // Check for detected local ports
                            if let Some(caps) = regex.captures(&line) {
                                if let Some(matched) = caps.get(1) {
                                    if let Ok(port) = matched.as_str().parse::<u16>() {
                                        let mut map = procs.lock().unwrap();
                                        if let Some(m) = map.get_mut(&p_id) {
                                            if !m.info.ports.contains(&port) {
                                                m.info.ports.push(port);
                                                let _ = app.emit(
                                                    &format!("process-port-{}", p_id),
                                                    serde_json::json!({
                                                        "processId": p_id,
                                                        "port": port,
                                                        "url": format!("http://localhost:{}", port)
                                                    }),
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }

            if let Some(err) = stderr {
                let p_id = proc_id.clone();
                let app = app_handle_clone.clone();
                thread::spawn(move || {
                    let reader = BufReader::new(err);
                    for line in reader.lines().flatten() {
                        let _ = app.emit(&format!("process-log-{}", p_id), line);
                    }
                });
            }

            // Monitor process termination
            loop {
                thread::sleep(std::time::Duration::from_millis(500));
                let mut map = processes_clone.lock().unwrap();
                if let Some(m) = map.get_mut(&proc_id) {
                    if let Some(ref mut ch) = m.child {
                        match ch.try_wait() {
                            Ok(Some(status)) => {
                                m.info.status = if status.success() {
                                    "stopped".to_string()
                                } else {
                                    "failed".to_string()
                                };
                                m.info.exit_code = status.code();
                                let _ = app_handle_clone.emit(
                                    &format!("process-exit-{}", proc_id),
                                    m.info.clone(),
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

        Ok(info)
    }

    pub fn stop_process(&self, id: &str) -> Result<(), String> {
        let mut map = self.processes.lock().unwrap();
        if let Some(m) = map.get_mut(id) {
            if let Some(mut child) = m.child.take() {
                let _ = child.kill();
                m.info.status = "stopped".to_string();
            }
        }
        Ok(())
    }

    pub fn list_processes(&self) -> Vec<ProcessInfo> {
        let map = self.processes.lock().unwrap();
        map.values().map(|m| m.info.clone()).collect()
    }

    pub fn terminate_all(&self) {
        let mut map = self.processes.lock().unwrap();
        for (_, m) in map.iter_mut() {
            if let Some(mut child) = m.child.take() {
                let _ = child.kill();
            }
        }
    }
}
