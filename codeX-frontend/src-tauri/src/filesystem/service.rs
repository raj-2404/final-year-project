use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "type")]
    pub entry_type: String, // "file" or "folder"
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
}

const IGNORED_NAMES: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".DS_Store",
    "Thumbs.db",
];

pub fn pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Open Project Folder")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

pub fn pick_file() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Open File")
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

pub fn save_file_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new().set_title("Save File");
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

pub fn read_file(path_str: &str) -> Result<String, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }

    let metadata = fs::metadata(path).map_err(|e| format!("Unable to read metadata: {}", e))?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("File exceeds 10MB limit and cannot be safely loaded in editor".to_string());
    }

    fs::read_to_string(path).map_err(|e| format!("Failed to read file (may be binary): {}", e))
}

pub fn write_file(path_str: &str, content: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(path, content).map_err(|e| format!("Failed to save file: {}", e))
}

pub fn create_file(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    if path.exists() {
        return Err("File already exists".to_string());
    }

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(path, "").map_err(|e| format!("Failed to create file: {}", e))
}

pub fn create_folder(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    if path.exists() {
        return Err("Folder already exists".to_string());
    }

    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))
}

pub fn rename(old_path_str: &str, new_path_str: &str) -> Result<(), String> {
    let old_path = Path::new(old_path_str);
    let new_path = Path::new(new_path_str);

    if !old_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    fs::rename(old_path, new_path).map_err(|e| format!("Failed to rename: {}", e))
}

pub fn delete(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Ok(());
    }

    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory: {}", e))
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to remove file: {}", e))
    }
}

pub fn exists(path_str: &str) -> bool {
    Path::new(path_str).exists()
}

pub fn list_directory_flat(
    root_path_str: &str,
    max_depth: usize,
) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(root_path_str);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Directory not found: {}", root_path_str));
    }

    let root_folder_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Project")
        .to_string();

    let mut entries = Vec::new();

    // Add root entry
    entries.push(FileEntry {
        id: "folder-root".to_string(),
        name: root_folder_name,
        path: root.to_string_lossy().to_string(),
        parent_id: None,
        entry_type: "folder".to_string(),
        size: None,
        children: None,
    });

    traverse_dir(root, "folder-root", 0, max_depth, &mut entries)?;

    Ok(entries)
}

fn traverse_dir(
    dir: &Path,
    parent_id: &str,
    current_depth: usize,
    max_depth: usize,
    out: &mut Vec<FileEntry>,
) -> Result<(), String> {
    if current_depth >= max_depth {
        return Ok(());
    }

    let read_dir = fs::read_dir(dir).map_err(|e| format!("Unable to read dir {}: {}", dir.display(), e))?;

    let mut dir_entries: Vec<PathBuf> = read_dir
        .filter_map(|res| res.ok().map(|e| e.path()))
        .collect();

    // Sort folders first, then files alphabetically
    dir_entries.sort_by(|a, b| {
        let a_is_dir = a.is_dir();
        let b_is_dir = b.is_dir();
        if a_is_dir != b_is_dir {
            b_is_dir.cmp(&a_is_dir)
        } else {
            a.file_name().cmp(&b.file_name())
        }
    });

    for path in dir_entries {
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if IGNORED_NAMES.contains(&name.as_str()) {
            continue;
        }

        let is_dir = path.is_dir();
        let path_str = path.to_string_lossy().to_string();
        let id = format!("{}-{}", if is_dir { "folder" } else { "file" }, path_str);

        if is_dir {
            out.push(FileEntry {
                id: id.clone(),
                name,
                path: path_str,
                parent_id: Some(parent_id.to_string()),
                entry_type: "folder".to_string(),
                size: None,
                children: None,
            });

            traverse_dir(&path, &id, current_depth + 1, max_depth, out)?;
        } else {
            let size = fs::metadata(&path).ok().map(|m| m.len());
            out.push(FileEntry {
                id,
                name,
                path: path_str,
                parent_id: Some(parent_id.to_string()),
                entry_type: "file".to_string(),
                size,
                children: None,
            });
        }
    }

    Ok(())
}
