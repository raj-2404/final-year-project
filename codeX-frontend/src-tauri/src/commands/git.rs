use crate::git::{
    self, GitCommitInfo, GitStatusResult,
};

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<GitStatusResult, String> {
    git::get_status(&repo_path)
}

#[tauri::command]
pub fn git_branches(repo_path: String) -> Result<Vec<String>, String> {
    git::get_branches(&repo_path)
}

#[tauri::command]
pub fn git_checkout(repo_path: String, branch: String) -> Result<String, String> {
    git::checkout(&repo_path, &branch)
}

#[tauri::command]
pub fn git_stage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    git::stage(&repo_path, paths)
}

#[tauri::command]
pub fn git_unstage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    git::unstage(&repo_path, paths)
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    git::commit(&repo_path, &message)
}

#[tauri::command]
pub fn git_diff(
    repo_path: String,
    file_path: Option<String>,
    staged: Option<bool>,
) -> Result<String, String> {
    git::diff(&repo_path, file_path, staged.unwrap_or(false))
}

#[tauri::command]
pub fn git_log(repo_path: String, max_count: Option<usize>) -> Result<Vec<GitCommitInfo>, String> {
    git::log(&repo_path, max_count.unwrap_or(20))
}

#[tauri::command]
pub fn git_fetch(repo_path: String) -> Result<String, String> {
    git::fetch(&repo_path)
}

#[tauri::command]
pub fn git_pull(repo_path: String) -> Result<String, String> {
    git::pull(&repo_path)
}

#[tauri::command]
pub fn git_push(repo_path: String) -> Result<String, String> {
    git::push(&repo_path)
}
