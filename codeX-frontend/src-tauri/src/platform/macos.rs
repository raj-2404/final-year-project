use std::path::Path;
use std::process::Command;
use super::ShellInfo;

pub fn platform_name() -> &'static str {
    "macos"
}

pub fn get_available_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();
    let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let candidates = [
        ("zsh", "/bin/zsh"),
        ("bash", "/bin/bash"),
        ("fish", "/opt/homebrew/bin/fish"),
        ("fish (usr)", "/usr/local/bin/fish"),
        ("homebrew zsh", "/opt/homebrew/bin/zsh"),
        ("homebrew bash", "/opt/homebrew/bin/bash"),
    ];

    for (name, path) in candidates {
        if Path::new(path).exists() {
            let is_default = path == default_shell || (shells.is_empty() && path == "/bin/zsh");
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
            id: "zsh".to_string(),
            name: "zsh".to_string(),
            path: default_shell.clone(),
            is_default: true,
        });
    }

    shells
}

pub fn get_default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

pub fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    Ok(())
}
