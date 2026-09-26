use std::process::Command;

pub fn run_git_cmd(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute git: {}. Please ensure git is installed and in PATH.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let err_msg = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("Git command exited with code {:?}", output.status.code())
        };
        return Err(err_msg);
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn run_git_bytes(repo_path: &str, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute git: {}. Please ensure git is installed and in PATH.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(stderr);
    }

    Ok(output.stdout)
}
