use super::manager::{
    self, GitBranchInfo, GitCommitInfo, GitConflictStage, GitStashInfo, GitStatusResult,
};

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<GitStatusResult, String> {
    manager::get_status(&repo_path)
}

#[tauri::command]
pub fn git_branches(repo_path: String) -> Result<Vec<GitBranchInfo>, String> {
    manager::get_branches(&repo_path)
}

#[tauri::command]
pub fn git_branch_create(
    repo_path: String,
    name: String,
    checkout: Option<bool>,
) -> Result<String, String> {
    manager::create_branch(&repo_path, &name, checkout.unwrap_or(false))
}

#[tauri::command]
pub fn git_branch_delete(
    repo_path: String,
    name: String,
    force: Option<bool>,
) -> Result<String, String> {
    manager::delete_branch(&repo_path, &name, force.unwrap_or(false))
}

#[tauri::command]
pub fn git_branch_rename(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<String, String> {
    manager::rename_branch(&repo_path, &old_name, &new_name)
}

#[tauri::command]
pub fn git_checkout(repo_path: String, branch: String) -> Result<String, String> {
    manager::checkout(&repo_path, &branch)
}

#[tauri::command]
pub fn git_stage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    manager::stage(&repo_path, paths)
}

#[tauri::command]
pub fn git_unstage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    manager::unstage(&repo_path, paths)
}

#[tauri::command]
pub fn git_discard(repo_path: String, path: String) -> Result<String, String> {
    manager::discard(&repo_path, &path)
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    manager::commit(&repo_path, &message)
}

#[tauri::command]
pub fn git_diff(
    repo_path: String,
    file_path: Option<String>,
    staged: Option<bool>,
) -> Result<String, String> {
    manager::diff(&repo_path, file_path, staged.unwrap_or(false))
}

#[tauri::command]
pub fn git_show(repo_path: String, spec: String) -> Result<String, String> {
    manager::show(&repo_path, &spec)
}

#[tauri::command]
pub fn git_log(
    repo_path: String,
    max_count: Option<usize>,
    file_path: Option<String>,
) -> Result<Vec<GitCommitInfo>, String> {
    manager::log(&repo_path, max_count.unwrap_or(30), file_path)
}

#[tauri::command]
pub fn git_fetch(repo_path: String) -> Result<String, String> {
    manager::fetch(&repo_path)
}

#[tauri::command]
pub fn git_pull(repo_path: String) -> Result<String, String> {
    manager::pull(&repo_path)
}

#[tauri::command]
pub fn git_push(repo_path: String) -> Result<String, String> {
    manager::push(&repo_path)
}

#[tauri::command]
pub fn git_stash_list(repo_path: String) -> Result<Vec<GitStashInfo>, String> {
    manager::stash_list(&repo_path)
}

#[tauri::command]
pub fn git_stash_save(
    repo_path: String,
    message: Option<String>,
    include_untracked: Option<bool>,
) -> Result<String, String> {
    manager::stash_save(&repo_path, message, include_untracked.unwrap_or(false))
}

#[tauri::command]
pub fn git_stash_apply(repo_path: String, index: Option<usize>) -> Result<String, String> {
    manager::stash_apply(&repo_path, index.unwrap_or(0))
}

#[tauri::command]
pub fn git_stash_pop(repo_path: String, index: Option<usize>) -> Result<String, String> {
    manager::stash_pop(&repo_path, index.unwrap_or(0))
}

#[tauri::command]
pub fn git_stash_drop(repo_path: String, index: Option<usize>) -> Result<String, String> {
    manager::stash_drop(&repo_path, index.unwrap_or(0))
}

#[tauri::command]
pub fn git_merge(repo_path: String, branch: String) -> Result<String, String> {
    manager::merge(&repo_path, &branch)
}

#[tauri::command]
pub fn git_merge_abort(repo_path: String) -> Result<String, String> {
    manager::merge_abort(&repo_path)
}

#[tauri::command]
pub fn git_conflict_stages(repo_path: String, file_path: String) -> Result<GitConflictStage, String> {
    manager::get_conflict_stages(&repo_path, &file_path)
}

#[tauri::command]
pub fn git_discover_repos(workspace_root: String) -> Result<Vec<String>, String> {
    manager::discover_repositories(&workspace_root)
}
