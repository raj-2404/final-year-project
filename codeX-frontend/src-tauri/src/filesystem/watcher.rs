use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsChangeEvent {
    pub kind: String, // "create", "modify", "remove", "other"
    pub paths: Vec<String>,
}

#[derive(Clone)]
pub struct FileWatcher {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    current_path: Arc<Mutex<Option<String>>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            current_path: Arc::new(Mutex::new(None)),
        }
    }

    pub fn watch(&self, app_handle: AppHandle, path_str: &str) -> Result<(), String> {
        let path = Path::new(path_str);
        if !path.exists() {
            return Err(format!("Cannot watch non-existent path: {}", path_str));
        }

        self.unwatch();

        let app_handle_clone = app_handle.clone();
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let paths: Vec<String> = event
                    .paths
                    .iter()
                    .filter_map(|p| {
                        let s = p.to_string_lossy().to_string();
                        let s_norm = s.replace('\\', "/");
                        if s_norm.contains("/.git/")
                            || s_norm.contains("/node_modules/")
                            || s_norm.contains("/target/")
                            || s_norm.contains("/dist/")
                            || s_norm.contains("/build/")
                            || s_norm.ends_with(".DS_Store")
                        {
                            None
                        } else {
                            Some(s)
                        }
                    })
                    .collect();

                if paths.is_empty() {
                    return;
                }

                let kind = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "remove",
                    _ => "other",
                };

                let payload = FsChangeEvent {
                    kind: kind.to_string(),
                    paths,
                };

                let _ = app_handle_clone.emit("fs-change", payload);
            }
        })
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        let mut w_lock = self.watcher.lock().unwrap();
        *w_lock = Some(watcher);

        let mut p_lock = self.current_path.lock().unwrap();
        *p_lock = Some(path_str.to_string());

        Ok(())
    }

    pub fn unwatch(&self) {
        let mut w_lock = self.watcher.lock().unwrap();
        *w_lock = None;
        let mut p_lock = self.current_path.lock().unwrap();
        *p_lock = None;
    }
}
