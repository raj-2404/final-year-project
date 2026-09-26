use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub root: String,
    pub name: String,
    pub ecosystem: String,
    pub language: String,
    pub package_manager: Option<String>,
    pub build_system: Option<String>,
    pub config_files: Vec<String>,
    pub subprojects: Vec<ProjectInfo>,
}

pub fn detect_project_info(folder_path: &str) -> Result<ProjectInfo, String> {
    let root = Path::new(folder_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Folder does not exist or is not a directory: {}", folder_path));
    }

    let folder_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();

    let mut config_files = Vec::new();
    let mut ecosystem = "generic".to_string();
    let mut language = "plaintext".to_string();
    let mut package_manager = None;
    let mut build_system = None;

    // Check key marker files in root
    let has_file = |name: &str| -> bool {
        let p = root.join(name);
        p.exists() && p.is_file()
    };

    let check_marker = |name: &str, configs: &mut Vec<String>| -> bool {
        if has_file(name) {
            configs.push(name.to_string());
            true
        } else {
            false
        }
    };

    // Node / JS / TS
    let has_package_json = check_marker("package.json", &mut config_files);
    let has_tsconfig = check_marker("tsconfig.json", &mut config_files);
    let has_jsconfig = check_marker("jsconfig.json", &mut config_files);
    let has_pnpm = check_marker("pnpm-lock.yaml", &mut config_files) || check_marker("pnpm-workspace.yaml", &mut config_files);
    let has_yarn = check_marker("yarn.lock", &mut config_files);
    let has_bun = check_marker("bun.lockb", &mut config_files) || check_marker("bun.lock", &mut config_files);
    let has_package_lock = check_marker("package-lock.json", &mut config_files);
    let has_vite = check_marker("vite.config.js", &mut config_files) || check_marker("vite.config.ts", &mut config_files);
    let has_next = check_marker("next.config.js", &mut config_files) || check_marker("next.config.mjs", &mut config_files) || check_marker("next.config.ts", &mut config_files);

    // Rust
    let has_cargo = check_marker("Cargo.toml", &mut config_files);
    check_marker("Cargo.lock", &mut config_files);

    // Python
    let has_pyproject = check_marker("pyproject.toml", &mut config_files);
    let has_requirements = check_marker("requirements.txt", &mut config_files);
    let has_pipfile = check_marker("Pipfile", &mut config_files);
    let has_setup_py = check_marker("setup.py", &mut config_files);

    // Go
    let has_go_mod = check_marker("go.mod", &mut config_files);
    check_marker("go.sum", &mut config_files);

    // Java / Kotlin
    let has_pom = check_marker("pom.xml", &mut config_files);
    let has_gradle = check_marker("build.gradle", &mut config_files) || check_marker("build.gradle.kts", &mut config_files);

    // C / C++
    let has_cmake = check_marker("CMakeLists.txt", &mut config_files);
    let has_makefile = check_marker("Makefile", &mut config_files);

    // Git
    if root.join(".git").exists() {
        config_files.push(".git".to_string());
    }

    if has_cargo {
        ecosystem = "rust".to_string();
        language = "rust".to_string();
        package_manager = Some("cargo".to_string());
        build_system = Some("cargo".to_string());
    } else if has_package_json || has_tsconfig || has_jsconfig {
        ecosystem = "node".to_string();
        language = if has_tsconfig { "typescript".to_string() } else { "javascript".to_string() };
        if has_pnpm {
            package_manager = Some("pnpm".to_string());
        } else if has_yarn {
            package_manager = Some("yarn".to_string());
        } else if has_bun {
            package_manager = Some("bun".to_string());
        } else if has_package_lock {
            package_manager = Some("npm".to_string());
        } else {
            package_manager = Some("npm".to_string());
        }

        if has_next {
            build_system = Some("next".to_string());
        } else if has_vite {
            build_system = Some("vite".to_string());
        } else {
            build_system = Some("npm".to_string());
        }
    } else if has_pyproject || has_requirements || has_pipfile || has_setup_py {
        ecosystem = "python".to_string();
        language = "python".to_string();
        if has_pipfile {
            package_manager = Some("pipenv".to_string());
        } else if has_pyproject {
            package_manager = Some("poetry".to_string());
        } else {
            package_manager = Some("pip".to_string());
        }
        build_system = Some("python".to_string());
    } else if has_go_mod {
        ecosystem = "go".to_string();
        language = "go".to_string();
        package_manager = Some("go".to_string());
        build_system = Some("go".to_string());
    } else if has_pom || has_gradle {
        ecosystem = "java".to_string();
        language = "java".to_string();
        if has_pom {
            package_manager = Some("maven".to_string());
            build_system = Some("maven".to_string());
        } else {
            package_manager = Some("gradle".to_string());
            build_system = Some("gradle".to_string());
        }
    } else if has_cmake || has_makefile {
        ecosystem = "c_cpp".to_string();
        language = "cpp".to_string();
        if has_cmake {
            build_system = Some("cmake".to_string());
        } else {
            build_system = Some("make".to_string());
        }
    }

    // Detect immediate subprojects (e.g. monorepo / multi-root subfolders)
    let mut subprojects = Vec::new();
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" || name == "build" {
                    continue;
                }
                // Check if subfolder has marker files
                if path.join("package.json").exists()
                    || path.join("Cargo.toml").exists()
                    || path.join("pyproject.toml").exists()
                    || path.join("go.mod").exists()
                    || path.join("pom.xml").exists()
                    || path.join("CMakeLists.txt").exists()
                {
                    if let Ok(sub) = detect_project_info(&path.to_string_lossy()) {
                        subprojects.push(sub);
                    }
                }
            }
        }
    }

    Ok(ProjectInfo {
        root: root.to_string_lossy().replace('\\', "/"),
        name: folder_name,
        ecosystem,
        language,
        package_manager,
        build_system,
        config_files,
        subprojects,
    })
}
