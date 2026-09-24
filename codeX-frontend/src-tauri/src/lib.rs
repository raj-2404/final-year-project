pub mod platform;

#[tauri::command]
fn get_desktop_info() -> serde_json::Value {
    serde_json::json!({
        "platform": platform::get_platform_name(),
        "app_name": "CodeX",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_desktop_info])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CodeX desktop application");
}
