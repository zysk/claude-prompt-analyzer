#!/usr/bin/env node

'use strict';

/**
 * Migration utilities: backup, restore, cleanup.
 * Backups are temporary (deleted after successful migration).
 */

const fs = require('fs');
const path = require('path');

function existsDir(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDirRecursive(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a backup directory at {root}/.backup-{timestamp}/.
 * Returns the backup path.
 */
function createBackup(root) {
  if (!existsDir(root)) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, `.backup-${timestamp}`);

  // Copy everything except any existing .backup-* dirs (avoid recursion)
  fs.mkdirSync(backupDir, { recursive: true });
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.backup-')) continue;
    const srcPath = path.join(root, entry.name);
    const destPath = path.join(backupDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  return backupDir;
}

/**
 * Restore root from a backup directory, then delete the backup.
 */
function restoreFromBackup(root, backupDir) {
  if (!existsDir(backupDir)) {
    throw new Error(`Backup not found: ${backupDir}`);
  }

  // Remove everything in root except .backup-* dirs
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.backup-')) continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      removeDirRecursive(entryPath);
    } else {
      fs.unlinkSync(entryPath);
    }
  }

  // Copy backup contents back
  for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
    const srcPath = path.join(backupDir, entry.name);
    const destPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Delete backup after restore
  removeDirRecursive(backupDir);
}

/**
 * Delete the backup directory (called after successful migration).
 */
function deleteBackup(backupDir) {
  if (backupDir && existsDir(backupDir)) {
    removeDirRecursive(backupDir);
  }
}

module.exports = {
  existsDir,
  createBackup,
  restoreFromBackup,
  deleteBackup,
};
