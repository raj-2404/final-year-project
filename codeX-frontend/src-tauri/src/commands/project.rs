use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub name: String,
    pub run: HashMap<String, String>,
}

#[tauri::command]
pub fn project_load_config(project_path: String) -> Result<ProjectConfig, String> {
    let base = Path::new(&project_path);
    let codex_file = base.join(".codex").join("project.json");

    if codex_file.exists() {
        let content = fs::read_to_string(&codex_file)
            .map_err(|e| format!("Failed to read .codex/project.json: {}", e))?;
        let config: ProjectConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid .codex/project.json: {}", e))?;
        return Ok(config);
    }

    // Auto-detect common project setups
    let mut run_map = HashMap::new();
    let project_name = base
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();

    let pkg_json = base.join("package.json");
    if pkg_json.exists() {
        if let Ok(pkg_str) = fs::read_to_string(&pkg_json) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&pkg_str) {
                if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
                    if scripts.contains_key("dev") {
                        run_map.insert("dev".to_string(), "npm run dev".to_string());
                    } else if scripts.contains_key("start") {
                        run_map.insert("start".to_string(), "npm start".to_string());
                    }
                    if scripts.contains_key("build") {
                        run_map.insert("build".to_string(), "npm run build".to_string());
                    }
                }
            }
        }
    }

    let pom_xml = base.join("pom.xml");
    if pom_xml.exists() {
        run_map.insert("backend".to_string(), "./mvnw spring-boot:run".to_string());
    }

    let cargo_toml = base.join("Cargo.toml");
    if cargo_toml.exists() {
        run_map.insert("cargo".to_string(), "cargo run".to_string());
    }

    let py_file = base.join("main.py");
    if py_file.exists() {
        run_map.insert("python".to_string(), "python3 main.py".to_string());
    }

    Ok(ProjectConfig {
        name: project_name,
        run: run_map,
    })
}

#[tauri::command]
pub fn project_save_config(project_path: String, config: ProjectConfig) -> Result<(), String> {
    let dir = Path::new(&project_path).join(".codex");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create .codex directory: {}", e))?;
    }
    let file = dir.join("project.json");
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(file, content).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}
