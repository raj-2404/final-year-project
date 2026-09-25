use portable_pty::MasterPty;
use serde::{Deserialize, Serialize};
use std::io::Write;

pub struct TerminalSession {
    pub id: String,
    pub title: String,
    pub shell: String,
    pub cwd: String,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionInfo {
    pub id: String,
    pub title: String,
    pub shell: String,
    pub cwd: String,
}
