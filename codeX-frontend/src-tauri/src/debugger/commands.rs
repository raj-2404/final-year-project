use std::collections::HashMap;
use tauri::{AppHandle, State};
use super::DebuggerManager;

#[tauri::command]
pub fn debug_check_binary(debug_state: State<'_, DebuggerManager>, name: String) -> bool {
    debug_state.check_binary(&name)
}

#[tauri::command]
pub fn debug_start(
    app: AppHandle,
    debug_state: State<'_, DebuggerManager>,
    id: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    debug_state.start_adapter(app, id, executable, args, cwd, env)
}

#[tauri::command]
pub fn debug_write(debug_state: State<'_, DebuggerManager>, id: String, data: String) -> Result<(), String> {
    debug_state.write_to_adapter(&id, &data)
}

#[tauri::command]
pub fn debug_stop(debug_state: State<'_, DebuggerManager>, id: String) -> Result<(), String> {
    debug_state.stop_adapter(&id)
}
