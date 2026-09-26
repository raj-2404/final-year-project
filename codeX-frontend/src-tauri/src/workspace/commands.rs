use super::discovery::{detect_project_info, ProjectInfo};
use super::manager::{FileMetadata, WorkspaceManager};
use crate::filesystem::service::{self, FileEntry};
use crate::filesystem::watcher::FileWatcher;
use crate::platform;
use std::path::Path;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn ws_open_folder() -> Option<String> {
    service::pick_folder()
}

#[tauri::command]
pub fn ws_open_workspace_file() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Open CodeX Workspace File")
        .add_filter("CodeX Workspace", &["codex-workspace", "code-workspace", "json"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ws_save_workspace_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new()
        .set_title("Save CodeX Workspace")
        .add_filter("CodeX Workspace", &["codex-workspace"]);
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ws_set_active_roots(
    roots: Vec<String>,
    state: State<'_, WorkspaceManager>,
) -> Result<(), String> {
    state.set_active_roots(roots)
}

#[tauri::command]
pub fn ws_add_root(root: String, state: State<'_, WorkspaceManager>) -> Result<(), String> {
    state.add_root(&root)
}

#[tauri::command]
pub fn ws_remove_root(root: String, state: State<'_, WorkspaceManager>) -> Result<(), String> {
    state.remove_root(&root)
}

#[tauri::command]
pub fn ws_get_roots(state: State<'_, WorkspaceManager>) -> Result<Vec<String>, String> {
    Ok(state.get_roots())
}

#[tauri::command]
pub fn ws_list_directory(
    path: String,
    shallow: Option<bool>,
    max_depth: Option<usize>,
    state: State<'_, WorkspaceManager>,
) -> Result<Vec<FileEntry>, String> {
    if shallow.unwrap_or(false) {
        state.read_directory_shallow(&path)
    } else {
        // Flat traversal with depth limit
        let validated = state.validate_path(&path, false)?;
        service::list_directory_flat(&validated.to_string_lossy(), max_depth.unwrap_or(6))
    }
}

#[tauri::command]
pub fn ws_get_file_metadata(
    path: String,
    state: State<'_, WorkspaceManager>,
) -> Result<FileMetadata, String> {
    state.get_metadata(&path)
}

#[tauri::command]
pub fn ws_create_file(path: String, state: State<'_, WorkspaceManager>) -> Result<(), String> {
    state.create_file(&path)
}

#[tauri::command]
pub fn ws_create_folder(path: String, state: State<'_, WorkspaceManager>) -> Result<(), String> {
    state.create_folder(&path)
}

#[tauri::command]
pub fn ws_rename(
    old_path: String,
    new_path: String,
    state: State<'_, WorkspaceManager>,
) -> Result<(), String> {
    state.rename(&old_path, &new_path)
}

#[tauri::command]
pub fn ws_move(
    source_path: String,
    target_dir: String,
    state: State<'_, WorkspaceManager>,
) -> Result<String, String> {
    state.move_path(&source_path, &target_dir)
}

#[tauri::command]
pub fn ws_delete(path: String, state: State<'_, WorkspaceManager>) -> Result<(), String> {
    state.delete(&path)
}

#[tauri::command]
pub fn ws_read_file(path: String, state: State<'_, WorkspaceManager>) -> Result<String, String> {
    state.read_file(&path)
}

#[tauri::command]
pub fn ws_write_file(
    path: String,
    content: String,
    state: State<'_, WorkspaceManager>,
) -> Result<(), String> {
    state.write_file(&path, &content)
}

#[tauri::command]
pub fn ws_reveal(path: String, state: State<'_, WorkspaceManager>) -> Result<(), String> {
    let p = state.validate_path(&path, false)?;
    platform::reveal_in_file_manager(Path::new(&p))
}

#[tauri::command]
pub fn ws_detect_project(path: String) -> Result<ProjectInfo, String> {
    detect_project_info(&path)
}

#[tauri::command]
pub fn ws_watch(
    app: AppHandle,
    roots: Vec<String>,
    watcher: State<'_, FileWatcher>,
) -> Result<(), String> {
    watcher.watch_roots(app, roots)
}

#[tauri::command]
pub fn ws_unwatch(watcher: State<'_, FileWatcher>) -> Result<(), String> {
    watcher.unwatch();
    Ok(())
}
