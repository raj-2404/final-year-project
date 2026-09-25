use crate::lsp::LspManager;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn lsp_check_binary(lsp_state: State<'_, LspManager>, name: String) -> bool {
    lsp_state.check_binary(&name)
}

#[tauri::command]
pub fn lsp_start(
    app: AppHandle,
    lsp_state: State<'_, LspManager>,
    id: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
) -> Result<(), String> {
    lsp_state.start_server(app, id, executable, args, cwd)
}

#[tauri::command]
pub fn lsp_write(lsp_state: State<'_, LspManager>, id: String, data: String) -> Result<(), String> {
    lsp_state.write_to_server(&id, &data)
}

#[tauri::command]
pub fn lsp_stop(lsp_state: State<'_, LspManager>, id: String) -> Result<(), String> {
    lsp_state.stop_server(&id)
}
