use crate::filesystem::service::FileEntry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_readonly: bool,
    pub modified_ms: u64,
    pub created_ms: u64,
}

#[derive(Clone)]
pub struct WorkspaceManager {
    roots: Arc<RwLock<Vec<PathBuf>>>,
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            roots: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Sets the list of active workspace roots for path-containment validation.
    pub fn set_active_roots(&self, root_paths: Vec<String>) -> Result<(), String> {
        let mut canon_roots = Vec::new();
        for r in root_paths {
            let p = Path::new(&r);
            if p.exists() {
                if let Ok(canon) = p.canonicalize() {
                    canon_roots.push(canon);
                } else {
                    canon_roots.push(p.to_path_buf());
                }
            } else {
                canon_roots.push(p.to_path_buf());
            }
        }

        let mut lock = self.roots.write().map_err(|e| e.to_string())?;
        *lock = canon_roots;
        Ok(())
    }

    /// Adds a folder root to active workspace
    pub fn add_root(&self, path_str: &str) -> Result<(), String> {
        let p = Path::new(path_str);
        let canon = if p.exists() {
            p.canonicalize().unwrap_or_else(|_| p.to_path_buf())
        } else {
            p.to_path_buf()
        };

        let mut lock = self.roots.write().map_err(|e| e.to_string())?;
        if !lock.contains(&canon) {
            lock.push(canon.clone());
        }
        if !lock.contains(&p.to_path_buf()) {
            lock.push(p.to_path_buf());
        }
        Ok(())
    }

    /// Removes a folder root from active workspace
    pub fn remove_root(&self, path_str: &str) -> Result<(), String> {
        let p = Path::new(path_str);
        let canon = if p.exists() {
            p.canonicalize().unwrap_or_else(|_| p.to_path_buf())
        } else {
            p.to_path_buf()
        };

        let mut lock = self.roots.write().map_err(|e| e.to_string())?;
        lock.retain(|r| r != &canon && r != p);
        Ok(())
    }

    /// Gets active workspace roots
    pub fn get_roots(&self) -> Vec<String> {
        let lock = self.roots.read().unwrap();
        lock.iter().map(|p| p.to_string_lossy().replace('\\', "/")).collect()
    }

    /// Validates path containment within at least one workspace root.
    /// Strictly rejects traversal (..) and accesses to outside system files.
    pub fn validate_path(&self, path_str: &str, for_creation: bool) -> Result<PathBuf, String> {
        let path = Path::new(path_str);

        // Disallow relative parent navigation
        if path_str.contains("..") {
            return Err("Security error: Path traversal (..) is not permitted.".to_string());
        }

        let target_buf = if path.exists() {
            path.canonicalize().map_err(|e| format!("Failed to canonicalize path: {}", e))?
        } else if for_creation {
            if let Some(parent) = path.parent() {
                if parent.exists() {
                    let parent_canon = parent.canonicalize().map_err(|e| format!("Failed to canonicalize parent: {}", e))?;
                    let file_name = path.file_name().ok_or_else(|| "Invalid target file name".to_string())?;
                    parent_canon.join(file_name)
                } else {
                    path.to_path_buf()
                }
            } else {
                path.to_path_buf()
            }
        } else {
            return Err(format!("File does not exist: {}", path_str));
        };

        let roots = self.roots.read().map_err(|e| e.to_string())?;

        // If roots are set, verify containment
        if !roots.is_empty() {
            let contained = roots.iter().any(|root| {
                target_buf.starts_with(root)
                    || path.starts_with(root)
                    || target_buf.to_string_lossy().replace("/private", "").starts_with(&root.to_string_lossy().replace("/private", ""))
                    || path.to_string_lossy().replace("/private", "").starts_with(&root.to_string_lossy().replace("/private", ""))
            });
            if !contained {
                return Err(format!(
                    "Security check failed: Path '{}' is outside the opened workspace roots.",
                    path_str
                ));
            }
        }

        // Additional sanity checks for critical OS directories
        let target_str = target_buf.to_string_lossy().replace('\\', "/");
        if target_str.starts_with("/etc")
            || target_str.starts_with("/System")
            || target_str.starts_with("/private")
            || target_str.starts_with("C:/Windows")
            || target_str.starts_with("C:/Program Files")
        {
            return Err("Security check failed: Access to system directory is forbidden.".to_string());
        }

        Ok(target_buf)
    }

    /// Reads metadata for a file or folder
    pub fn get_metadata(&self, path_str: &str) -> Result<FileMetadata, String> {
        let path = self.validate_path(path_str, false)?;
        let meta = fs::metadata(&path).map_err(|e| format!("Metadata error: {}", e))?;

        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let created_ms = meta
            .created()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(modified_ms);

        let is_readonly = meta.permissions().readonly();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        Ok(FileMetadata {
            path: path.to_string_lossy().replace('\\', "/"),
            name,
            size: meta.len(),
            is_dir: meta.is_dir(),
            is_file: meta.is_file(),
            is_readonly,
            modified_ms,
            created_ms,
        })
    }

    /// Reads immediate shallow children of a directory for lazy-loading in Explorer
    pub fn read_directory_shallow(&self, path_str: &str) -> Result<Vec<FileEntry>, String> {
        let dir = self.validate_path(path_str, false)?;
        if !dir.is_dir() {
            return Err(format!("Path is not a directory: {}", path_str));
        }

        let read_dir = fs::read_dir(&dir).map_err(|e| format!("Read dir error: {}", e))?;
        let mut entries = Vec::new();

        for item in read_dir.flatten() {
            let p = item.path();
            let name = match p.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            if name == ".git" || name == ".DS_Store" || name == "Thumbs.db" {
                continue;
            }

            let is_dir = p.is_dir();
            let p_str = p.to_string_lossy().replace('\\', "/");
            let id = format!("{}-{}", if is_dir { "folder" } else { "file" }, p_str);
            let size = if !is_dir { fs::metadata(&p).ok().map(|m| m.len()) } else { None };

            entries.push(FileEntry {
                id,
                name,
                path: p_str,
                parent_id: Some(path_str.replace('\\', "/")),
                entry_type: if is_dir { "folder".to_string() } else { "file".to_string() },
                size,
                children: None,
            });
        }

        // Sort folders first, then alphabetically
        entries.sort_by(|a, b| {
            if a.entry_type != b.entry_type {
                if a.entry_type == "folder" {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Greater
                }
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });

        Ok(entries)
    }

    /// Create file safely inside workspace
    pub fn create_file(&self, path_str: &str) -> Result<(), String> {
        let path = self.validate_path(path_str, true)?;
        if path.exists() {
            return Err("File already exists".to_string());
        }

        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
        }

        fs::write(&path, "").map_err(|e| format!("Failed to create file: {}", e))
    }

    /// Create folder safely inside workspace
    pub fn create_folder(&self, path_str: &str) -> Result<(), String> {
        let path = self.validate_path(path_str, true)?;
        if path.exists() {
            return Err("Folder already exists".to_string());
        }

        fs::create_dir_all(&path).map_err(|e| format!("Failed to create folder: {}", e))
    }

    /// Rename file/folder safely inside workspace
    pub fn rename(&self, old_path_str: &str, new_path_str: &str) -> Result<(), String> {
        let old_path = self.validate_path(old_path_str, false)?;
        let new_path = self.validate_path(new_path_str, true)?;

        if new_path.exists() {
            return Err("Target path already exists".to_string());
        }

        fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename: {}", e))
    }

    /// Move file/folder into target directory
    pub fn move_path(&self, source_path_str: &str, target_dir_str: &str) -> Result<String, String> {
        let source_path = self.validate_path(source_path_str, false)?;
        let target_dir = self.validate_path(target_dir_str, false)?;

        if !target_dir.is_dir() {
            return Err("Target path must be an existing directory".to_string());
        }

        let name = source_path
            .file_name()
            .ok_or_else(|| "Invalid source file name".to_string())?;
        let destination = target_dir.join(name);

        if destination.exists() {
            return Err("A file or folder with the same name already exists in target directory".to_string());
        }

        fs::rename(&source_path, &destination).map_err(|e| format!("Failed to move: {}", e))?;
        Ok(destination.to_string_lossy().replace('\\', "/"))
    }

    /// Delete file or folder safely inside workspace
    pub fn delete(&self, path_str: &str) -> Result<(), String> {
        let path = self.validate_path(path_str, false)?;
        if !path.exists() {
            return Ok(());
        }

        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete folder: {}", e))
        } else {
            fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
        }
    }

    /// Read file content safely
    pub fn read_file(&self, path_str: &str) -> Result<String, String> {
        let path = self.validate_path(path_str, false)?;
        let meta = fs::metadata(&path).map_err(|e| format!("Cannot read file: {}", e))?;
        if meta.len() > 10 * 1024 * 1024 {
            return Err("File exceeds 10MB limit and cannot be safely loaded in editor".to_string());
        }

        fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
    }

    /// Write file content safely
    pub fn write_file(&self, path_str: &str, content: &str) -> Result<(), String> {
        let path = self.validate_path(path_str, true)?;
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
        }

        fs::write(&path, content).map_err(|e| format!("Failed to save file: {}", e))
    }
}
