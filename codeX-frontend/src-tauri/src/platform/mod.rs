use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_default: bool,
}

#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "linux")]
pub mod linux;

pub fn get_platform_name() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        macos::platform_name()
    }
    #[cfg(target_os = "windows")]
    {
        windows::platform_name()
    }
    #[cfg(target_os = "linux")]
    {
        linux::platform_name()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "unknown"
    }
}

pub fn get_available_shells() -> Vec<ShellInfo> {
    #[cfg(target_os = "macos")]
    {
        macos::get_available_shells()
    }
    #[cfg(target_os = "windows")]
    {
        windows::get_available_shells()
    }
    #[cfg(target_os = "linux")]
    {
        linux::get_available_shells()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        vec![]
    }
}

pub fn get_default_shell() -> String {
    #[cfg(target_os = "macos")]
    {
        macos::get_default_shell()
    }
    #[cfg(target_os = "windows")]
    {
        windows::get_default_shell()
    }
    #[cfg(target_os = "linux")]
    {
        linux::get_default_shell()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "/bin/sh".to_string()
    }
}

pub fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::reveal_in_file_manager(path)
    }
    #[cfg(target_os = "windows")]
    {
        windows::reveal_in_file_manager(path)
    }
    #[cfg(target_os = "linux")]
    {
        linux::reveal_in_file_manager(path)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("Unsupported operating system for file reveal".to_string())
    }
}
