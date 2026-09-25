use std::path::Path;
use std::process::Command;
use super::ShellInfo;

pub fn platform_name() -> &'static str {
    "windows"
}

pub fn get_available_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    let candidates = [
        ("PowerShell", "powershell.exe"),
        ("PowerShell 7", "pwsh.exe"),
        ("Command Prompt", "cmd.exe"),
        ("Git Bash", r"C:\Program Files\Git\bin\bash.exe"),
    ];

    for (name, path) in candidates {
        let exists = if path.contains('\\') {
            Path::new(path).exists()
        } else {
            which::which(path).is_ok()
        };

        if exists {
            let is_default = name == "PowerShell";
            shells.push(ShellInfo {
                id: name.to_lowercase().replace(' ', "_"),
                name: name.to_string(),
                path: path.to_string(),
                is_default,
            });
        }
    }

    if shells.is_empty() {
        shells.push(ShellInfo {
            id: "cmd".to_string(),
            name: "Command Prompt".to_string(),
            path: "cmd.exe".to_string(),
            is_default: true,
        });
    }

    shells
}

pub fn get_default_shell() -> String {
    if which::which("pwsh.exe").is_ok() {
        "pwsh.exe".to_string()
    } else {
        "powershell.exe".to_string()
    }
}

pub fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    let arg = format!("/select,{}", path.display());
    Command::new("explorer.exe")
        .arg(arg)
        .spawn()
        .map_err(|e| format!("Failed to reveal in Explorer: {}", e))?;
    Ok(())
}
