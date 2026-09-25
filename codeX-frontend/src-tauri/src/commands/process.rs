use crate::process::{ProcessInfo, ProcessManager};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn proc_start(
    app: AppHandle,
    proc_state: State<'_, ProcessManager>,
    id: String,
    name: String,
    command: String,
    cwd: String,
) -> Result<ProcessInfo, String> {
    proc_state.start_process(app, id, name, command, cwd)
}

#[tauri::command]
pub fn proc_stop(proc_state: State<'_, ProcessManager>, id: String) -> Result<(), String> {
    proc_state.stop_process(&id)
}

#[tauri::command]
pub fn proc_restart(
    app: AppHandle,
    proc_state: State<'_, ProcessManager>,
    id: String,
    name: String,
    command: String,
    cwd: String,
) -> Result<ProcessInfo, String> {
    proc_state.stop_process(&id).ok();
    proc_state.start_process(app, id, name, command, cwd)
}

#[tauri::command]
pub fn proc_list(proc_state: State<'_, ProcessManager>) -> Vec<ProcessInfo> {
    proc_state.list_processes()
}
