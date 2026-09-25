use std::path::Path;
use std::process::Command;
use super::ShellInfo;

pub fn platform_name() -> &'static str {
    "linux"
}

pub fn get_available_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();
    let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

    let candidates = [
        ("bash", "/bin/bash"),
        ("zsh", "/bin/zsh"),
        ("fish", "/usr/bin/fish"),
        ("sh", "/bin/sh"),
    ];

    for (name, path) in candidates {
        if Path::new(path).exists() {
            let is_default = path == default_shell || (shells.is_empty() && path == "/bin/bash");
            shells.push(ShellInfo {
                id: name.to_string(),
                name: name.to_string(),
                path: path.to_string(),
                is_default,
            });
        }
    }

    if shells.is_empty() {
        shells.push(ShellInfo {
            id: "bash".to_string(),
            name: "bash".to_string(),
            path: default_shell,
            is_default: true,
        });
    }

    shells
}

pub fn get_default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
}

pub fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    let parent = path.parent().unwrap_or(path);
    Command::new("xdg-open")
        .arg(parent)
        .spawn()
        .map_err(|e| format!("Failed to reveal in file manager: {}", e))?;
    Ok(())
}
