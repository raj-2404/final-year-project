use std::collections::HashMap;
use tauri::{AppHandle, State};
use super::TestManager;

#[tauri::command]
pub fn test_check_binary(test_state: State<'_, TestManager>, name: String) -> bool {
    test_state.check_binary(&name)
}

#[tauri::command]
pub fn test_start(
    app: AppHandle,
    test_state: State<'_, TestManager>,
    id: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    test_state.start_process(app, id, executable, args, cwd, env)
}

#[tauri::command]
pub fn test_write(test_state: State<'_, TestManager>, id: String, data: String) -> Result<(), String> {
    test_state.write_to_process(&id, &data)
}

#[tauri::command]
pub fn test_stop(test_state: State<'_, TestManager>, id: String) -> Result<(), String> {
    test_state.stop_process(&id)
}

#[tauri::command]
pub fn test_kill(test_state: State<'_, TestManager>, id: String) -> Result<(), String> {
    test_state.kill_process(&id)
}
