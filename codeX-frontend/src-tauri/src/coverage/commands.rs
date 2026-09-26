use std::collections::HashMap;
use tauri::{AppHandle, State};
use super::CoverageManager;

#[tauri::command]
pub fn coverage_check_binary(coverage_state: State<'_, CoverageManager>, name: String) -> bool {
    coverage_state.check_binary(&name)
}

#[tauri::command]
pub fn coverage_start(
    app: AppHandle,
    coverage_state: State<'_, CoverageManager>,
    id: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    coverage_state.start_process(app, id, executable, args, cwd, env)
}

#[tauri::command]
pub fn coverage_write(coverage_state: State<'_, CoverageManager>, id: String, data: String) -> Result<(), String> {
    coverage_state.write_to_process(&id, &data)
}

#[tauri::command]
pub fn coverage_stop(coverage_state: State<'_, CoverageManager>, id: String) -> Result<(), String> {
    coverage_state.stop_process(&id)
}

#[tauri::command]
pub fn coverage_kill(coverage_state: State<'_, CoverageManager>, id: String) -> Result<(), String> {
    coverage_state.kill_process(&id)
}
