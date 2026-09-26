use super::process::run_git_cmd;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub root: String,
    pub branch: String,
    pub is_detached: bool,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<GitFileChange>,
    pub unstaged: Vec<GitFileChange>,
    pub untracked: Vec<GitFileChange>,
    pub conflicts: Vec<GitFileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitInfo {
    pub hash: String,
    pub author: String,
    pub email: String,
    pub date: String,
    pub message: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStashInfo {
    pub index: usize,
    pub message: String,
    pub hash: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitConflictStage {
    pub base: String,
    pub ours: String,
    pub theirs: String,
    pub file_path: String,
}

/// Discovers Git repositories in the given workspace root.
/// Checks the root itself and immediate subdirectories.
pub fn discover_repositories(workspace_root: &str) -> Result<Vec<String>, String> {
    let mut repos = Vec::new();
    let root_path = Path::new(workspace_root);

    if !root_path.exists() {
        return Ok(repos);
    }

    // Check if workspace root is inside or is a git repo
    if let Ok(top_level) = run_git_cmd(workspace_root, &["rev-parse", "--show-toplevel"]) {
        let clean_top = top_level.trim().replace('\\', "/");
        if !clean_top.is_empty() && !repos.contains(&clean_top) {
            repos.push(clean_top);
        }
    }

    // Check subdirectories (depth 1 and 2)
    if let Ok(entries) = std::fs::read_dir(root_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
                    continue;
                }
                let git_dir = path.join(".git");
                if git_dir.exists() {
                    let clean = path.to_string_lossy().replace('\\', "/");
                    if !repos.contains(&clean) {
                        repos.push(clean);
                    }
                } else {
                    // Check 1 level deeper
                    if let Ok(sub_entries) = std::fs::read_dir(&path) {
                        for sub_entry in sub_entries.flatten() {
                            let sub_path = sub_entry.path();
                            if sub_path.is_dir() {
                                let sub_name = sub_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                if sub_name.starts_with('.') || sub_name == "node_modules" || sub_name == "target" {
                                    continue;
                                }
                                if sub_path.join(".git").exists() {
                                    let clean = sub_path.to_string_lossy().replace('\\', "/");
                                    if !repos.contains(&clean) {
                                        repos.push(clean);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(repos)
}

/// Retrieves comprehensive repository status
pub fn get_status(repo_path: &str) -> Result<GitStatusResult, String> {
    let check = run_git_cmd(repo_path, &["rev-parse", "--is-inside-work-tree"]);
    if check.is_err() {
        return Ok(GitStatusResult {
            is_repo: false,
            root: String::new(),
            branch: String::new(),
            is_detached: false,
            ahead: 0,
            behind: 0,
            staged: Vec::new(),
            unstaged: Vec::new(),
            untracked: Vec::new(),
            conflicts: Vec::new(),
        });
    }

    let root = run_git_cmd(repo_path, &["rev-parse", "--show-toplevel"])
        .unwrap_or_else(|_| repo_path.to_string())
        .trim()
        .replace('\\', "/");

    let output = run_git_cmd(repo_path, &["status", "--porcelain=v1", "-b", "-u"])?;

    let mut branch = "HEAD".to_string();
    let mut is_detached = false;
    let mut ahead = 0;
    let mut behind = 0;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicts = Vec::new();

    for line in output.lines() {
        if line.starts_with("##") {
            let branch_line = line[2..].trim();
            if branch_line.starts_with("HEAD (no branch)") || branch_line.starts_with("No commits yet on ") {
                is_detached = branch_line.starts_with("HEAD (no branch)");
                if let Some(rest) = branch_line.strip_prefix("No commits yet on ") {
                    branch = rest.to_string();
                } else {
                    branch = "HEAD (detached)".to_string();
                }
            } else {
                // Example: main...origin/main [ahead 1, behind 2]
                let first_part = branch_line.split("...").next().unwrap_or(branch_line);
                branch = first_part.split(' ').next().unwrap_or("HEAD").to_string();

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
            }
            continue;
        }

        if line.len() < 3 {
            continue;
        }

        let x = &line[0..1];
        let y = &line[1..2];
        let remainder = line[3..].trim();

        // Check for conflicts: DD, AU, UD, UA, DU, AA, UU
        let is_conflict = matches!(
            (x, y),
            ("D", "D") | ("A", "U") | ("U", "D") | ("U", "A") | ("D", "U") | ("A", "A") | ("U", "U")
        );

        if is_conflict {
            conflicts.push(GitFileChange {
                path: remainder.to_string(),
                status: format!("{}{}", x, y),
                staged: false,
                unstaged: true,
                old_path: None,
            });
            continue;
        }

        // Untracked
        if x == "?" && y == "?" {
            untracked.push(GitFileChange {
                path: remainder.to_string(),
                status: "U".to_string(),
                staged: false,
                unstaged: true,
                old_path: None,
            });
            continue;
        }

        // Handle renames/copies: e.g. R  old.txt -> new.txt
        let (file_path, old_path) = if remainder.contains(" -> ") {
            let mut parts = remainder.split(" -> ");
            let old_p = parts.next().map(|s| s.to_string());
            let new_p = parts.next().unwrap_or(remainder).to_string();
            (new_p, old_p)
        } else {
            (remainder.to_string(), None)
        };

        // Staged changes
        if x != " " && x != "?" && x != "!" {
            staged.push(GitFileChange {
                path: file_path.clone(),
                status: x.to_string(),
                staged: true,
                unstaged: false,
                old_path: old_path.clone(),
            });
        }

        // Unstaged changes
        if y != " " && y != "?" && y != "!" {
            unstaged.push(GitFileChange {
                path: file_path,
                status: y.to_string(),
                staged: false,
                unstaged: true,
                old_path,
            });
        }
    }

    Ok(GitStatusResult {
        is_repo: true,
        root,
        branch,
        is_detached,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        conflicts,
    })
}

/// Gets branch list with metadata
pub fn get_branches(repo_path: &str) -> Result<Vec<GitBranchInfo>, String> {
    let out = run_git_cmd(
        repo_path,
        &[
            "branch",
            "-a",
            "--format=%(HEAD)|%(refname:short)|%(upstream:short)|%(upstream:track)",
        ],
    )?;

    let mut branches = Vec::new();
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 2 {
            continue;
        }
        let is_current = parts[0].trim() == "*";
        let name = parts[1].trim().to_string();
        let is_remote = name.starts_with("origin/") || name.starts_with("remotes/");
        let upstream = if parts.len() > 2 && !parts[2].trim().is_empty() {
            Some(parts[2].trim().to_string())
        } else {
            None
        };

        let mut ahead = 0;
        let mut behind = 0;
        if parts.len() > 3 {
            let track = parts[3].trim();
            if track.contains("ahead ") {
                if let Some(sub) = track.split("ahead ").nth(1) {
                    if let Some(num_str) = sub.split(|c| c == ']' || c == ',').next() {
                        ahead = num_str.trim().parse().unwrap_or(0);
                    }
                }
            }
            if track.contains("behind ") {
                if let Some(sub) = track.split("behind ").nth(1) {
                    if let Some(num_str) = sub.split(']').next() {
                        behind = num_str.trim().parse().unwrap_or(0);
                    }
                }
            }
        }

        branches.push(GitBranchInfo {
            name,
            is_current,
            is_remote,
            upstream,
            ahead,
            behind,
        });
    }

    Ok(branches)
}

/// Create a new branch
pub fn create_branch(repo_path: &str, name: &str, checkout_branch: bool) -> Result<String, String> {
    if checkout_branch {
        run_git_cmd(repo_path, &["checkout", "-b", name])
    } else {
        run_git_cmd(repo_path, &["branch", name])
    }
}

/// Delete a branch
pub fn delete_branch(repo_path: &str, name: &str, force: bool) -> Result<String, String> {
    let flag = if force { "-D" } else { "-d" };
    run_git_cmd(repo_path, &["branch", flag, name])
}

/// Rename current or specified branch
pub fn rename_branch(repo_path: &str, old_name: &str, new_name: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["branch", "-m", old_name, new_name])
}

/// Checkout branch or revision
pub fn checkout(repo_path: &str, branch: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["checkout", branch])
}

/// Stage files
pub fn stage(repo_path: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["add", "--"];
    for p in &paths {
        args.push(p);
    }
    run_git_cmd(repo_path, &args)?;
    Ok(())
}

/// Unstage files
pub fn unstage(repo_path: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args = vec!["restore", "--staged", "--"];
    for p in &paths {
        args.push(p);
    }
    if run_git_cmd(repo_path, &args).is_err() {
        let mut reset_args = vec!["reset", "HEAD", "--"];
        for p in &paths {
            reset_args.push(p);
        }
        run_git_cmd(repo_path, &reset_args)?;
    }
    Ok(())
}

/// Discard working tree changes for a file safely
pub fn discard(repo_path: &str, path: &str) -> Result<String, String> {
    // Attempt git restore --worktree -- <path>
    let res = run_git_cmd(repo_path, &["restore", "--worktree", "--", path]);
    if res.is_err() {
        // Fallback to git checkout -- <path>
        run_git_cmd(repo_path, &["checkout", "--", path])
    } else {
        res
    }
}

/// Commit staged changes
pub fn commit(repo_path: &str, message: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["commit", "-m", message])
}

/// Diff changes
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

/// Show arbitrary git object/revision (e.g. HEAD:file.txt, :1:file.txt, commit_hash)
pub fn show(repo_path: &str, spec: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["show", spec])
}

/// Get commit log, optionally for a specific file
pub fn log(repo_path: &str, max_count: usize, file_path: Option<String>) -> Result<Vec<GitCommitInfo>, String> {
    let count_arg = format!("-n{}", max_count);
    let mut args = vec![
        "log",
        &count_arg,
        "--format=%H|%an|%ae|%ad|%s",
        "--date=iso",
        "--name-only",
    ];

    if let Some(ref path) = file_path {
        args.push("--");
        args.push(path);
    }

    let out = run_git_cmd(repo_path, &args)?;
    let mut commits = Vec::new();
    let mut current_commit: Option<GitCommitInfo> = None;

    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if line.contains('|') {
            let parts: Vec<&str> = line.splitn(5, '|').collect();
            if parts.len() == 5 && parts[0].len() == 40 {
                if let Some(commit) = current_commit.take() {
                    commits.push(commit);
                }
                current_commit = Some(GitCommitInfo {
                    hash: parts[0].to_string(),
                    author: parts[1].to_string(),
                    email: parts[2].to_string(),
                    date: parts[3].to_string(),
                    message: parts[4].to_string(),
                    files: Vec::new(),
                });
                continue;
            }
        }

        if let Some(ref mut commit) = current_commit {
            commit.files.push(line.to_string());
        }
    }

    if let Some(commit) = current_commit {
        commits.push(commit);
    }

    Ok(commits)
}

/// Remote fetch
pub fn fetch(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["fetch", "--all", "--prune"])
}

/// Remote pull
pub fn pull(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["pull"])
}

/// Remote push
pub fn push(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["push"])
}

/// Stash operations
pub fn stash_list(repo_path: &str) -> Result<Vec<GitStashInfo>, String> {
    let out = run_git_cmd(repo_path, &["stash", "list", "--format=%gd|%H|%cd|%gs", "--date=iso"])?;
    let mut stashes = Vec::new();

    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() == 4 {
            let idx_str = parts[0].replace("stash@{", "").replace('}', "");
            let index = idx_str.trim().parse::<usize>().unwrap_or(0);
            stashes.push(GitStashInfo {
                index,
                hash: parts[1].to_string(),
                date: parts[2].to_string(),
                message: parts[3].to_string(),
            });
        }
    }

    Ok(stashes)
}

pub fn stash_save(repo_path: &str, message: Option<String>, include_untracked: bool) -> Result<String, String> {
    let mut args = vec!["stash", "push"];
    if include_untracked {
        args.push("-u");
    }
    if let Some(ref msg) = message {
        args.push("-m");
        args.push(msg);
    }
    run_git_cmd(repo_path, &args)
}

pub fn stash_apply(repo_path: &str, index: usize) -> Result<String, String> {
    let stash_id = format!("stash@{{{}}}", index);
    run_git_cmd(repo_path, &["stash", "apply", &stash_id])
}

pub fn stash_pop(repo_path: &str, index: usize) -> Result<String, String> {
    let stash_id = format!("stash@{{{}}}", index);
    run_git_cmd(repo_path, &["stash", "pop", &stash_id])
}

pub fn stash_drop(repo_path: &str, index: usize) -> Result<String, String> {
    let stash_id = format!("stash@{{{}}}", index);
    run_git_cmd(repo_path, &["stash", "drop", &stash_id])
}

/// Merge branch
pub fn merge(repo_path: &str, branch: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["merge", branch])
}

pub fn merge_abort(repo_path: &str) -> Result<String, String> {
    run_git_cmd(repo_path, &["merge", "--abort"])
}

/// Retrieves 3-way conflict stages for a file (base=:1, ours=:2, theirs=:3)
pub fn get_conflict_stages(repo_path: &str, file_path: &str) -> Result<GitConflictStage, String> {
    let base_spec = format!(":1:{}", file_path);
    let ours_spec = format!(":2:{}", file_path);
    let theirs_spec = format!(":3:{}", file_path);

    let base = run_git_cmd(repo_path, &["show", &base_spec]).unwrap_or_default();
    let ours = run_git_cmd(repo_path, &["show", &ours_spec]).unwrap_or_default();
    let theirs = run_git_cmd(repo_path, &["show", &theirs_spec]).unwrap_or_default();

    Ok(GitConflictStage {
        base,
        ours,
        theirs,
        file_path: file_path.to_string(),
    })
}
