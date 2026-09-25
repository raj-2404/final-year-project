use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<GitFileChange>,
    pub unstaged: Vec<GitFileChange>,
    pub untracked: Vec<GitFileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitInfo {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

fn run_git_cmd(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute git: {}. Please ensure git is installed and in PATH.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("Git command exited with code {:?}", output.status.code())
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn get_status(repo_path: &str) -> Result<GitStatusResult, String> {
    // Check if repo
    let check = Command::new("git")
        .current_dir(repo_path)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output();

    if check.is_err() || !check.unwrap().status.success() {
        return Ok(GitStatusResult {
            is_repo: false,
            branch: String::new(),
            ahead: 0,
            behind: 0,
            staged: Vec::new(),
            unstaged: Vec::new(),
            untracked: Vec::new(),
        });
    }

    let output = run_git_cmd(repo_path, &["status", "--porcelain=v1", "-b", "-u"])?;

    let mut branch = "HEAD".to_string();
    let mut ahead = 0;
    let mut behind = 0;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for line in output.lines() {
        if line.starts_with("##") {
            let branch_line = &line[3..].trim();
            // Example: main...origin/main [ahead 1, behind 2]
            if let Some(first_part) = branch_line.split("...").next() {
                branch = first_part.split(' ').next().unwrap_or("HEAD").to_string();
            }

            if branch_line.contains("[ahead ") {
                if let Some(sub) = branch_line.split("[ahead ").nth(1) {
                    if let Some(num_str) = sub.split(|c| c == ']' || c == ',').next() {
                        ahead = num_str.trim().parse().unwrap_or(0);
                    }
                }
            }
            if branch_line.contains("behind ") {
                if let Some(sub) = branch_line.split("behind ").nth(1) {
                    if let Some(num_str) = sub.split(']').next() {
                        behind = num_str.trim().parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }

        if line.len() < 3 {
            continue;
        }

        let staged_code = &line[0..1];
        let worktree_code = &line[1..2];
        let file_path = line[3..].trim().to_string();

        if staged_code == "?" && worktree_code == "?" {
            untracked.push(GitFileChange {
                path: file_path,
                status: "U".to_string(),
                staged: false,
            });
        } else {
            if staged_code != " " && staged_code != "?" {
                staged.push(GitFileChange {
                    path: file_path.clone(),
                    status: staged_code.to_string(),
                    staged: true,
                });
            }
            if worktree_code != " " && worktree_code != "?" {
                unstaged.push(GitFileChange {
                    path: file_path,
                    status: worktree_code.to_string(),
                    staged: false,
                });
            }
        }
    }

    Ok(GitStatusResult {
        is_repo: true,
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
    })
}

pub fn get_branches(repo_path: &str) -> Result<Vec<String>, String> {
    let out = run_git_cmd(repo_path, &["branch", "--format=%(refname:short)"])?;
    Ok(out.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
}

pub fn checkout(repo_path: &str, branch: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["checkout", branch])
}

pub fn stage(repo_path: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["add", "--"];
    for p in &paths {
        args.push(p);
    }
    run_git_cmd(repo_path, &args)?;
    Ok(())
}

pub fn unstage(repo_path: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["restore", "--staged", "--"];
    for p in &paths {
        args.push(p);
    }
    // Try restore --staged first, fallback to reset HEAD
    if run_git_cmd(repo_path, &args).is_err() {
        let mut reset_args = vec!["reset", "HEAD", "--"];
        for p in &paths {
            reset_args.push(p);
        }
        run_git_cmd(repo_path, &reset_args)?;
    }
    Ok(())
}

pub fn commit(repo_path: &str, message: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["commit", "-m", message])
}

pub fn diff(repo_path: &str, file_path: Option<String>, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    if let Some(ref path) = file_path {
        args.push("--");
        args.push(path);
    }
    run_git_cmd(repo_path, &args)
}

pub fn log(repo_path: &str, max_count: usize) -> Result<Vec<GitCommitInfo>, String> {
    let count_arg = format!("-n{}", max_count);
    let out = run_git_cmd(
        repo_path,
        &["log", &count_arg, "--format=%H|%an|%ad|%s", "--date=short"],
    )?;

    let mut commits = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() == 4 {
            commits.push(GitCommitInfo {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                date: parts[2].to_string(),
                message: parts[3].to_string(),
            });
        }
    }
    Ok(commits)
}

pub fn fetch(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["fetch"])
}

pub fn pull(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["pull"])
}

pub fn push(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["push"])
}
