pub mod commands;
pub mod filesystem;
pub mod git;
pub mod platform;
pub mod process;
pub mod terminal;

use filesystem::FileWatcher;
use process::ProcessManager;
use terminal::TerminalManager;

#[tauri::command]
fn get_desktop_info() -> serde_json::Value {
    serde_json::json!({
        "platform": platform::get_platform_name(),
        "appName": "CodeX",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let terminal_manager = TerminalManager::new();
    let file_watcher = FileWatcher::new();
    let process_manager = ProcessManager::new();

    let term_mgr_exit = terminal_manager.clone();
    let proc_mgr_exit = process_manager.clone();
    let watcher_exit = file_watcher.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .manage(terminal_manager)
        .manage(file_watcher)
        .manage(process_manager)
        .invoke_handler(tauri::generate_handler![
            get_desktop_info,
            // Filesystem commands
            commands::filesystem::fs_pick_folder,
            commands::filesystem::fs_pick_file,
            commands::filesystem::fs_save_file_dialog,
            commands::filesystem::fs_list_directory,
            commands::filesystem::fs_read_file,
            commands::filesystem::fs_write_file,
            commands::filesystem::fs_create_file,
            commands::filesystem::fs_create_folder,
            commands::filesystem::fs_rename,
            commands::filesystem::fs_delete,
            commands::filesystem::fs_exists,
            commands::filesystem::fs_watch,
            commands::filesystem::fs_unwatch,
            commands::filesystem::fs_reveal_in_file_manager,
            // Terminal commands
            commands::terminal::term_get_shells,
            commands::terminal::term_get_default_shell,
            commands::terminal::term_create,
            commands::terminal::term_write,
            commands::terminal::term_resize,
            commands::terminal::term_close,
            commands::terminal::term_rename,
            commands::terminal::term_list,
            // Git commands
            commands::git::git_status,
            commands::git::git_branches,
            commands::git::git_checkout,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_diff,
            commands::git::git_log,
            commands::git::git_fetch,
            commands::git::git_pull,
            commands::git::git_push,
            // Process management commands
            commands::process::proc_start,
            commands::process::proc_stop,
            commands::process::proc_restart,
            commands::process::proc_list,
            // Project commands
            commands::project::project_load_config,
            commands::project::project_save_config,
        ])
        .setup(|_app| {
            log::info!("CodeX desktop native backend initialized");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running CodeX desktop application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                term_mgr_exit.terminate_all();
                proc_mgr_exit.terminate_all();
                watcher_exit.unwatch();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_platform_shells() {
        let default_shell = platform::get_default_shell();
        assert!(!default_shell.is_empty(), "Default shell should not be empty");

        let shells = platform::get_available_shells();
        assert!(!shells.is_empty(), "Available shells should not be empty");
        assert!(
            shells.iter().any(|s| s.is_default),
            "At least one shell should be marked default"
        );
    }

    #[test]
    fn test_filesystem_operations() {
        let temp_dir = std::env::temp_dir().join(format!("codex_fs_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let temp_path = temp_dir.to_str().unwrap();

        // 1. Create file
        let file_path = temp_dir.join("hello.txt");
        let file_str = file_path.to_str().unwrap();
        filesystem::service::create_file(file_str).unwrap();
        assert!(filesystem::service::exists(file_str));

        // 2. Write and Read
        filesystem::service::write_file(file_str, "Hello CodeX!").unwrap();
        let content = filesystem::service::read_file(file_str).unwrap();
        assert_eq!(content, "Hello CodeX!");

        // 3. Create folder
        let sub_dir = temp_dir.join("subfolder");
        let sub_str = sub_dir.to_str().unwrap();
        filesystem::service::create_folder(sub_str).unwrap();
        assert!(filesystem::service::exists(sub_str));

        // 4. List directory
        let entries = filesystem::service::list_directory_flat(temp_path, 3).unwrap();
        assert!(entries.len() >= 2);

        // 5. Rename
        let renamed_path = temp_dir.join("renamed.txt");
        let renamed_str = renamed_path.to_str().unwrap();
        filesystem::service::rename(file_str, renamed_str).unwrap();
        assert!(!filesystem::service::exists(file_str));
        assert!(filesystem::service::exists(renamed_str));

        // 6. Delete
        filesystem::service::delete(renamed_str).unwrap();
        assert!(!filesystem::service::exists(renamed_str));

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_git_operations() {
        let temp_dir = std::env::temp_dir().join(format!("codex_git_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let temp_path = temp_dir.to_str().unwrap();

        let status = git::service::get_status(temp_path).unwrap();
        assert!(!status.is_repo);

        let init_res = std::process::Command::new("git")
            .current_dir(temp_path)
            .args(["init"])
            .output();

        if let Ok(out) = init_res {
            if out.status.success() {
                let _ = std::process::Command::new("git")
                    .current_dir(temp_path)
                    .args(["config", "user.email", "test@codex.dev"])
                    .output();
                let _ = std::process::Command::new("git")
                    .current_dir(temp_path)
                    .args(["config", "user.name", "CodeX Test"])
                    .output();

                let status_repo = git::service::get_status(temp_path).unwrap();
                assert!(status_repo.is_repo);

                let test_file = temp_dir.join("test.txt");
                fs::write(&test_file, "initial").unwrap();

                let status_untracked = git::service::get_status(temp_path).unwrap();
                assert!(!status_untracked.untracked.is_empty());

                git::service::stage(temp_path, vec!["test.txt".to_string()]).unwrap();
                let status_staged = git::service::get_status(temp_path).unwrap();
                assert!(!status_staged.staged.is_empty());

                git::service::commit(temp_path, "Initial commit").unwrap();
                let branches = git::service::get_branches(temp_path).unwrap();
                assert!(!branches.is_empty());

                let log = git::service::log(temp_path, 5).unwrap();
                assert_eq!(log.len(), 1);
                assert_eq!(log[0].message, "Initial commit");

                let diff_output = git::service::diff(temp_path, None, false).unwrap();
                assert_eq!(diff_output.trim(), "");
            }
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_project_config() {
        let temp_dir = std::env::temp_dir().join(format!("codex_proj_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let temp_path = temp_dir.to_str().unwrap();

        let cfg = commands::project::project_load_config(temp_path.to_string()).unwrap();
        assert!(!cfg.name.is_empty());

        let mut run_map = std::collections::HashMap::new();
        run_map.insert("dev".to_string(), "npm run dev".to_string());
        let new_cfg = commands::project::ProjectConfig {
            name: "My Project".to_string(),
            run: run_map,
        };

        commands::project::project_save_config(temp_path.to_string(), new_cfg).unwrap();
        let loaded = commands::project::project_load_config(temp_path.to_string()).unwrap();
        assert_eq!(loaded.name, "My Project");
        assert_eq!(loaded.run.get("dev").unwrap(), "npm run dev");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}

