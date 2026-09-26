/**
 * Workspace Subsystem Public API (Level 3H)
 */

import { workspaceManager } from './workspaceManager.js';
import { workspaceFiles } from './workspaceFiles.js';
import { workspaceEvents } from './workspaceEvents.js';
import { WorkspaceEventType } from './workspaceTypes.js';

export * from './workspaceTypes.js';
export * from './workspaceSettings.js';
export * from './workspaceEvents.js';
export * from './workspaceStorage.js';
export * from './workspaceModel.js';
export * from './workspaceDiscovery.js';
export * from './workspaceFolders.js';
export * from './workspaceFiles.js';
export * from './workspaceState.js';
export * from './workspaceManager.js';

// Central Workspace Public API operations
export async function openWorkspace(filePath) {
  return await workspaceManager.openWorkspace(filePath);
}

export async function openFolder(folderPath) {
  return await workspaceManager.openFolder(folderPath);
}

export async function closeWorkspace() {
  return await workspaceManager.closeWorkspace();
}

export async function reloadWorkspace() {
  return await workspaceManager.reloadWorkspace();
}

export async function addWorkspaceFolder(folderPath) {
  return await workspaceManager.addWorkspaceFolder(folderPath);
}

export async function removeWorkspaceFolder(folderPath) {
  return await workspaceManager.removeWorkspaceFolder(folderPath);
}

export function getWorkspace() {
  return workspaceManager.getWorkspace();
}

export function getWorkspaceFolders() {
  return workspaceManager.getWorkspaceFolders();
}

export function getActiveWorkspaceFolder() {
  return workspaceManager.getActiveWorkspaceFolder();
}

export function getProjectContext(folderPath) {
  return workspaceManager.getProjectContext(folderPath);
}

export function getFileProjectContext(filePath) {
  return workspaceManager.getFileProjectContext(filePath);
}

export async function createFile(filePath) {
  return await workspaceFiles.createFile(filePath);
}

export async function createFolder(folderPath) {
  return await workspaceFiles.createFolder(folderPath);
}

export async function renamePath(oldPath, newPath) {
  return await workspaceFiles.rename(oldPath, newPath);
}

export async function movePath(sourcePath, targetDir) {
  return await workspaceFiles.move(sourcePath, targetDir);
}

export async function deletePath(path) {
  return await workspaceFiles.delete(path);
}

export async function revealPath(path) {
  return await workspaceFiles.revealInFileManager(path);
}

export function refreshExplorer() {
  workspaceEvents.emit(WorkspaceEventType.FILE_CHANGED, { kind: 'refresh', paths: [] });
}

export function getRecentWorkspaces() {
  return workspaceManager.getRecentWorkspaces();
}
