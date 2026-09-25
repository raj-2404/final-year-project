use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::collections::HashMap;
use std::path::Path;

pub struct SpawnedPty {
    pub pair: PtyPair,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub fn create_pty(
    shell: &str,
    cwd: &str,
    cols: u16,
    rows: u16,
    env_vars: Option<HashMap<String, String>>,
) -> Result<SpawnedPty, String> {
    let pty_system = native_pty_system();
    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(shell);

    if Path::new(cwd).exists() {
        cmd.cwd(cwd);
    } else if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    // Inherit user host environment variables (PATH, HOME, USER, NVM, JAVA_HOME, etc.)
    for (k, v) in std::env::vars() {
        cmd.env(k, v);
    }

    // Modern terminal environment identifiers
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "CodeX");

    if let Some(custom_env) = env_vars {
        for (k, v) in custom_env {
            cmd.env(k, v);
        }
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell '{}': {}", shell, e))?;

    Ok(SpawnedPty { pair, child })
}
