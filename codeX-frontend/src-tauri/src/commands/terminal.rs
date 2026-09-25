use crate::platform::{self, ShellInfo};
use crate::terminal::{TerminalManager, TerminalSessionInfo};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn term_get_shells() -> Vec<ShellInfo> {
    platform::get_available_shells()
}

#[tauri::command]
pub fn term_get_default_shell() -> String {
    platform::get_default_shell()
}

#[tauri::command]
pub fn term_create(
    app: AppHandle,
    term_state: State<'_, TerminalManager>,
    id: String,
    title: Option<String>,
    shell: Option<String>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSessionInfo, String> {
    let chosen_shell = shell.unwrap_or_else(platform::get_default_shell);
    let chosen_cwd = cwd.unwrap_or_else(|| {
        std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
    });

    term_state.create_session(
        app,
        id,
        title,
        &chosen_shell,
        &chosen_cwd,
        cols.unwrap_or(80),
        rows.unwrap_or(24),
    )
}

#[tauri::command]
pub fn term_write(
    term_state: State<'_, TerminalManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    term_state.write_session(&id, data.as_bytes())
}

#[tauri::command]
pub fn term_resize(
    term_state: State<'_, TerminalManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    term_state.resize_session(&id, cols, rows)
}

#[tauri::command]
pub fn term_close(term_state: State<'_, TerminalManager>, id: String) -> Result<(), String> {
    term_state.close_session(&id)
}

#[tauri::command]
pub fn term_rename(
    term_state: State<'_, TerminalManager>,
    id: String,
    title: String,
) -> Result<(), String> {
    term_state.rename_session(&id, title)
}

#[tauri::command]
pub fn term_list(term_state: State<'_, TerminalManager>) -> Vec<TerminalSessionInfo> {
    term_state.list_sessions()
}

