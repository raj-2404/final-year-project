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
