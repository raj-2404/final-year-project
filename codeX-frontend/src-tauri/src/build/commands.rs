use std::collections::HashMap;
use tauri::{AppHandle, State};
use super::BuildManager;

#[tauri::command]
pub fn build_check_binary(build_state: State<'_, BuildManager>, name: String) -> bool {
    build_state.check_binary(&name)
}

#[tauri::command]
pub fn build_start(
    app: AppHandle,
    build_state: State<'_, BuildManager>,
    id: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    build_state.start_process(app, id, executable, args, cwd, env)
}

#[tauri::command]
pub fn build_write(build_state: State<'_, BuildManager>, id: String, data: String) -> Result<(), String> {
    build_state.write_to_process(&id, &data)
}

#[tauri::command]
pub fn build_stop(build_state: State<'_, BuildManager>, id: String) -> Result<(), String> {
    build_state.stop_process(&id)
}

#[tauri::command]
pub fn build_kill(build_state: State<'_, BuildManager>, id: String) -> Result<(), String> {
    build_state.kill_process(&id)
}
