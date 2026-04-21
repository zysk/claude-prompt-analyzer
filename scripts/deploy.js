#!/usr/bin/env node
'use strict';

/**
 * deploy.js - One-command setup/uninstall for Prompt Analyzer
 *
 * Usage:
 *   node scripts/deploy.js             # Install
 *   node scripts/deploy.js --uninstall # Uninstall
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { runMigrations } = require('./migrations');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = '1.3.0';

const HOOK_COMMAND = 'node ~/.claude/hooks/capture-prompts.js';
const HOOK_ENTRY = {
  type: 'command',
  command: HOOK_COMMAND,
  statusMessage: 'Capturing prompt...',
};

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const VERSION_FILE = path.join(CLAUDE_DIR, 'prompt-analyzer-version.json');
const PROMPT_ANALYSIS_ROOT = path.join(HOME, 'prompt-analysis');

// Source paths (relative to repo root, resolved at runtime)
const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCES = {
  hook: path.join(REPO_ROOT, 'hooks', 'capture-prompts.js'),
  skill: path.join(REPO_ROOT, 'skills', 'prompt-analyze', 'SKILL.md'),
  analyzer: path.join(REPO_ROOT, 'skills', 'prompt-analyze', 'analyzer.js'),
};

// Destination paths
const DESTS = {
  hook: path.join(CLAUDE_DIR, 'hooks', 'capture-prompts.js'),
  skill: path.join(CLAUDE_DIR, 'skills', 'prompt-analyze', 'SKILL.md'),
  analyzer: path.join(CLAUDE_DIR, 'skills', 'prompt-analyze', 'analyzer.js'),
};

const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function print(msg) {
  process.stdout.write(msg + '\n');
}

function ok(msg) {
  print(`  [OK] ${msg}`);
}

function warn(msg) {
  print(`  [WARN] ${msg}`);
}

function fail(msg) {
  print(`  [FAIL] ${msg}`);
  process.exit(1);
}

function section(title) {
  print('');
  print(title);
  print('');
}

function banner(msg) {
  print('================================');
  print(`  ${msg}`);
  print('================================');
}

function getDeployedVersion() {
  if (!fs.existsSync(VERSION_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeVersion() {
  const data = {
    version: VERSION,
    deployedAt: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function checkVersion() {
  const deployed = getDeployedVersion();
  if (!deployed) {
    print(`  Installing v${VERSION}`);
  } else if (deployed.version === VERSION) {
    print(`  Already at v${VERSION} (deployed ${deployed.deployedAt}). Re-deploying files.`);
  } else {
    print(`  Updating v${deployed.version} -> v${VERSION}`);
  }
}

async function runDataMigrations() {
  const deployed = getDeployedVersion();
  const fromVersion = deployed ? deployed.version : '1.0.0';

  if (!fs.existsSync(PROMPT_ANALYSIS_ROOT)) {
    // First-time user; no data to migrate
    return;
  }

  if (fromVersion === VERSION) {
    // Already at target version
    return;
  }

  section(`Migrating data v${fromVersion} -> v${VERSION}...`);

  try {
    const result = await runMigrations(
      PROMPT_ANALYSIS_ROOT,
      fromVersion,
      VERSION,
      (msg) => print(`  ${msg}`),
    );
    if (result.ran) {
      ok(`Data migration complete (${result.chain.length} step(s))`);
    } else if (result.reason === 'already-current') {
      ok('Data already at target schema');
    } else if (result.reason === 'no-data') {
      ok('No existing data to migrate');
    }
  } catch (err) {
    print('');
    fail(`Data migration failed: ${err.message}\n  Deploy aborted. Your data was restored from backup.`);
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function rmFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
}

function rmDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Prerequisites check
// ---------------------------------------------------------------------------

function checkPrerequisites() {
  section('Checking prerequisites...');

  // Node.js version
  const nodeVer = process.versions.node;
  const [major] = nodeVer.split('.').map(Number);
  if (major < 16) {
    fail(`Node.js >= 16 required; found ${nodeVer}`);
  }
  ok(`Node.js ${nodeVer}`);

  // Git installed
  try {
    execSync('git --version', { stdio: 'pipe' });
    ok('Git installed');
  } catch {
    fail('Git not found; install Git and try again');
  }

  // Git user.name (warn only)
  try {
    const gitUser = execSync('git config user.name', { stdio: 'pipe' })
      .toString()
      .trim();
    if (gitUser) {
      ok(`Git user: ${gitUser}`);
    } else {
      warn('git config user.name is empty; consider setting it');
    }
  } catch {
    warn('git config user.name not set; consider setting it');
  }

  // ~/.claude/ exists
  if (!fs.existsSync(CLAUDE_DIR)) {
    fail(`Claude config directory not found: ${CLAUDE_DIR}\n  Install Claude Code first.`);
  }
  ok(`Claude config: ${CLAUDE_DIR}`);
}

// ---------------------------------------------------------------------------
// File copy
// ---------------------------------------------------------------------------

function copyFiles() {
  section('Copying files...');

  // Verify sources exist before copying
  for (const [key, src] of Object.entries(SOURCES)) {
    if (!fs.existsSync(src)) {
      fail(`Source file not found: ${src}`);
    }
  }

  copyFile(SOURCES.hook, DESTS.hook);
  ok(`capture-prompts.js -> ~/.claude/hooks/capture-prompts.js`);

  copyFile(SOURCES.skill, DESTS.skill);
  ok(`SKILL.md -> ~/.claude/skills/prompt-analyze/SKILL.md`);

  copyFile(SOURCES.analyzer, DESTS.analyzer);
  ok(`analyzer.js -> ~/.claude/skills/prompt-analyze/analyzer.js`);
}

// ---------------------------------------------------------------------------
// settings.json helpers
// ---------------------------------------------------------------------------

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { hooks: { UserPromptSubmit: [] } };
  }
  const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Returns true if the capture-prompts hook command is already present
 * anywhere inside hooks.UserPromptSubmit[].hooks[].
 */
function hookExists(settings) {
  const ups = settings.hooks && settings.hooks.UserPromptSubmit;
  if (!Array.isArray(ups)) return false;
  return ups.some(
    (entry) =>
      Array.isArray(entry.hooks) &&
      entry.hooks.some((h) => h.command === HOOK_COMMAND),
  );
}

// ---------------------------------------------------------------------------
// Update settings.json (install)
// ---------------------------------------------------------------------------

function updateSettings() {
  section('Updating settings.json...');

  const settings = readSettings();

  if (hookExists(settings)) {
    ok('Hook already configured (skipping)');
    return;
  }

  // Ensure the hooks.UserPromptSubmit structure exists
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!Array.isArray(settings.hooks.UserPromptSubmit)) {
    settings.hooks.UserPromptSubmit = [];
  }

  const ups = settings.hooks.UserPromptSubmit;

  // Find the first entry with matcher: "" (catch-all); if none, create one
  let targetEntry = ups.find((e) => e.matcher === '');
  if (!targetEntry) {
    targetEntry = { matcher: '', hooks: [] };
    ups.push(targetEntry);
  }

  if (!Array.isArray(targetEntry.hooks)) {
    targetEntry.hooks = [];
  }

  targetEntry.hooks.push(HOOK_ENTRY);
  writeSettings(settings);

  ok('Hook added to settings.json');
}

// ---------------------------------------------------------------------------
// Verify installation
// ---------------------------------------------------------------------------

function verifyInstall() {
  section('Verifying installation...');

  let allGood = true;

  for (const [label, dest] of [
    ['capture-prompts.js', DESTS.hook],
    ['SKILL.md', DESTS.skill],
    ['analyzer.js', DESTS.analyzer],
  ]) {
    if (fs.existsSync(dest)) {
      ok(`${label} exists`);
    } else {
      print(`  [FAIL] ${label} missing at ${dest}`);
      allGood = false;
    }
  }

  const settings = readSettings();
  if (hookExists(settings)) {
    ok('Hook entry in settings.json');
  } else {
    print('  [FAIL] Hook entry missing from settings.json');
    allGood = false;
  }

  if (!allGood) {
    print('');
    fail('Installation verification failed; see errors above');
  }
}

// ---------------------------------------------------------------------------
// Print success
// ---------------------------------------------------------------------------

function printSuccess() {
  print('');
  banner('Setup complete!');

  print('');
  print(`  Version: ${VERSION}`);
  print('  Your prompts will be automatically captured in any project.');
  print('  Run /prompt-analyze anytime to get feedback.');
  print('');
  print('  Captured prompts: ~/prompt-analysis/<project>/prompts/<date>/');
  print('  Analysis reports: ~/prompt-analysis/reports/<date>/');
  print('');
  print('  To update: pull latest repo changes, run this script again.');
  print('');
}

// ---------------------------------------------------------------------------
// Uninstall flow
// ---------------------------------------------------------------------------

function uninstall() {
  banner('Prompt Analyzer - Uninstall');

  section('Removing files...');

  rmFile(DESTS.hook);
  ok('Removed capture-prompts.js');

  rmDir(path.join(CLAUDE_DIR, 'skills', 'prompt-analyze'));
  ok('Removed skills/prompt-analyze/');

  rmFile(VERSION_FILE);
  ok('Removed version file');

  section('Updating settings.json...');

  if (!fs.existsSync(SETTINGS_PATH)) {
    ok('settings.json not found; nothing to update');
  } else {
    const settings = readSettings();

    if (!settings.hooks || !Array.isArray(settings.hooks.UserPromptSubmit)) {
      ok('No UserPromptSubmit hooks found; nothing to update');
    } else {
      let modified = false;

      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit
        .map((entry) => {
          if (!Array.isArray(entry.hooks)) return entry;
          const before = entry.hooks.length;
          entry.hooks = entry.hooks.filter((h) => h.command !== HOOK_COMMAND);
          if (entry.hooks.length !== before) modified = true;
          return entry;
        })
        .filter((entry) => {
          // Remove empty UserPromptSubmit entries only if they have no hooks
          // and no other meaningful keys beyond matcher
          if (!Array.isArray(entry.hooks) || entry.hooks.length > 0) return true;
          const keys = Object.keys(entry).filter((k) => k !== 'matcher' && k !== 'hooks');
          return keys.length > 0;
        });

      if (modified) {
        writeSettings(settings);
        ok('Hook entry removed from settings.json');
      } else {
        ok('Hook entry not found in settings.json; nothing to update');
      }
    }
  }

  print('');
  print('Prompt Analyzer uninstalled. Existing captures in projects are untouched.');
  print('');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isUninstall = args.includes('--uninstall');

  if (isUninstall) {
    uninstall();
    return;
  }

  banner('Prompt Analyzer for Claude Code');
  checkVersion();
  checkPrerequisites();
  await runDataMigrations();
  copyFiles();
  updateSettings();
  verifyInstall();
  writeVersion();
  printSuccess();
}

main().catch((err) => {
  print('');
  print(`  [FAIL] ${err.message}`);
  process.exit(1);
});
