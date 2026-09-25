use crate::filesystem::service::{self, FileEntry};
use crate::filesystem::watcher::FileWatcher;
use crate::platform;
use std::path::Path;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn fs_get_default_workspace_dir() -> String {
    service::get_default_workspace_dir()
}

#[tauri::command]
pub fn fs_create_project_folder(project_name: String, parent_path: Option<String>) -> Result<String, String> {
    service::create_project_folder(&project_name, parent_path)
}

#[tauri::command]
pub fn fs_pick_folder() -> Option<String> {
    service::pick_folder()
}

#[tauri::command]
pub fn fs_pick_file() -> Option<String> {
    service::pick_file()
}

#[tauri::command]
pub fn fs_save_file_dialog(default_name: Option<String>) -> Option<String> {
    service::save_file_dialog(default_name)
}

#[tauri::command]
pub fn fs_list_directory(path: String, max_depth: Option<usize>) -> Result<Vec<FileEntry>, String> {
    service::list_directory_flat(&path, max_depth.unwrap_or(6))
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    service::read_file(&path)
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    service::write_file(&path, &content)
}

#[tauri::command]
pub fn fs_create_file(path: String) -> Result<(), String> {
    service::create_file(&path)
}

#[tauri::command]
pub fn fs_create_folder(path: String) -> Result<(), String> {
    service::create_folder(&path)
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    service::rename(&old_path, &new_path)
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), String> {
    service::delete(&path)
}

#[tauri::command]
pub fn fs_exists(path: String) -> bool {
    service::exists(&path)
}

#[tauri::command]
pub fn fs_watch(
    app: AppHandle,
    watcher_state: State<'_, FileWatcher>,
    path: String,
) -> Result<(), String> {
    watcher_state.watch(app, &path)
}

#[tauri::command]
pub fn fs_unwatch(watcher_state: State<'_, FileWatcher>) -> Result<(), String> {
    watcher_state.unwatch();
    Ok(())
}

#[tauri::command]
pub fn fs_reveal_in_file_manager(path: String) -> Result<(), String> {
    platform::reveal_in_file_manager(Path::new(&path))
}
