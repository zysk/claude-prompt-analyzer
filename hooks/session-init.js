#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config ---

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const LEGACY_HOOK = path.join(CLAUDE_DIR, 'hooks', 'capture-prompts.js');
const LEGACY_SKILL_DIR = path.join(CLAUDE_DIR, 'skills', 'prompt-analyze');
const LEGACY_VERSION_FILE = path.join(CLAUDE_DIR, 'prompt-analyzer-version.json');
const LEGACY_HOOK_COMMAND = 'node ~/.claude/hooks/capture-prompts.js';
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const PROMPT_ANALYSIS_ROOT = path.join(HOME, 'prompt-analysis');

const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA || null; // confirmed env var injected by Claude Code into hook processes
const PLUGIN_ROOT = path.resolve(__dirname, '..'); // __dirname beats process.env.CLAUDE_PLUGIN_ROOT: same value, no dependency on env injection
const SUPPORTED_FROM_VERSIONS = new Set(['1.2.0', '1.3.0']);

// --- Helpers ---

function readJsonSafe(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function hasLegacyHookInSettings() {
  const settings = readJsonSafe(SETTINGS_PATH, {});
  const ups = (settings.hooks && settings.hooks.UserPromptSubmit) || [];
  if (!Array.isArray(ups)) return false;
  return ups.some(
    (entry) =>
      Array.isArray(entry.hooks) &&
      entry.hooks.some((h) => h.command === LEGACY_HOOK_COMMAND)
  );
}

function detectLegacy() {
  return (
    fs.existsSync(LEGACY_VERSION_FILE) ||
    fs.existsSync(LEGACY_HOOK) ||
    fs.existsSync(LEGACY_SKILL_DIR) ||
    hasLegacyHookInSettings()
  );
}

// --- Legacy cleanup (one-shot; gated by cleanup-done.json marker) ---

function cleanupLegacy() {
  if (!PLUGIN_DATA) return;

  const cleanupMarker = path.join(PLUGIN_DATA, 'cleanup-done.json');
  if (fs.existsSync(cleanupMarker)) return;

  const itemsRemoved = [];

  // Backup settings.json before any destructive edit
  const backupDir = path.join(PLUGIN_DATA, 'legacy-backup');
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(SETTINGS_PATH)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(SETTINGS_PATH, path.join(backupDir, `settings-${ts}.json`));
  }

  // Remove legacy hook entry from settings.json (string-exact match only)
  if (fs.existsSync(SETTINGS_PATH)) {
    const settings = readJsonSafe(SETTINGS_PATH, {});
    if (Array.isArray(settings.hooks && settings.hooks.UserPromptSubmit)) {
      const before = JSON.stringify(settings);
      settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit
        .map((entry) => {
          if (!Array.isArray(entry.hooks)) return entry;
          entry.hooks = entry.hooks.filter((h) => h.command !== LEGACY_HOOK_COMMAND);
          return entry;
        })
        .filter((entry) => {
          if (!Array.isArray(entry.hooks) || entry.hooks.length > 0) return true;
          return Object.keys(entry).some((k) => k !== 'matcher' && k !== 'hooks');
        });
      if (JSON.stringify(settings) !== before) {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
        itemsRemoved.push('settings.json hook entry');
      }
    }
  }

  // Remove legacy files
  if (fs.existsSync(LEGACY_HOOK)) {
    fs.rmSync(LEGACY_HOOK);
    itemsRemoved.push('~/.claude/hooks/capture-prompts.js');
  }
  if (fs.existsSync(LEGACY_SKILL_DIR)) {
    fs.rmSync(LEGACY_SKILL_DIR, { recursive: true, force: true });
    itemsRemoved.push('~/.claude/skills/prompt-analyze/');
  }
  if (fs.existsSync(LEGACY_VERSION_FILE)) {
    fs.rmSync(LEGACY_VERSION_FILE);
    itemsRemoved.push('~/.claude/prompt-analyzer-version.json');
  }

  // Write cleanup-done marker to prevent re-run on subsequent sessions
  const pluginJson = readJsonSafe(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), {});
  fs.writeFileSync(
    cleanupMarker,
    JSON.stringify({
      version: pluginJson.version || 'unknown',
      cleanedAt: new Date().toISOString(),
      itemsRemoved,
    }, null, 2),
    'utf8'
  );
}

// --- Version diff + migration (Path C) ---

async function runVersionDiff(wasLegacy, priorVersion = null) {
  if (!PLUGIN_DATA) {
    process.stderr.write('[prompt-analyzer] session-init: CLAUDE_PLUGIN_DATA not set; skipping migration check.\n');
    return;
  }

  const pluginJson = readJsonSafe(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), {});
  const bundled = pluginJson.version;
  if (!bundled) return;

  const storedPath = path.join(PLUGIN_DATA, 'installed-version.txt');
  const stored = fs.existsSync(storedPath) ? fs.readFileSync(storedPath, 'utf8').trim() : '';

  if (bundled === stored) return; // already current; fast path

  const fromVersion = stored || priorVersion;

  let shouldPin = false;

  if (fromVersion && SUPPORTED_FROM_VERSIONS.has(fromVersion)) {
    try {
      const { runMigrations } = require(
        path.join(PLUGIN_ROOT, 'scripts', 'migrations', 'index.js')
      );
      await runMigrations(PROMPT_ANALYSIS_ROOT, fromVersion, bundled, (msg) =>
        process.stderr.write(msg + '\n')
      );
      shouldPin = true;
    } catch (err) {
      process.stderr.write(`[prompt-analyzer] Migration error: ${err.message}\n`);
    }
  } else {
    if (fromVersion || wasLegacy) {
      const label = fromVersion || 'unknown';
      process.stderr.write(
        `[prompt-analyzer] Migration from v${label} not supported; ` +
        `~/prompt-analysis/ data preserved. Run /prompt-analyzer:analyze to start fresh tracking.\n`
      );
    }
    shouldPin = true;
  }

  if (shouldPin) {
    fs.writeFileSync(storedPath, bundled, 'utf8');
  }
}

// --- Entry point (must always exit 0) ---

async function main() {
  try {
    const isLegacy = detectLegacy();
    const legacyVersionData = readJsonSafe(LEGACY_VERSION_FILE, null);
    const priorVersion = (legacyVersionData && legacyVersionData.version) || null;
    if (isLegacy) {
      cleanupLegacy();
    }
    await runVersionDiff(isLegacy, priorVersion);
    // Write plugin root path so skills can locate analyzer.js if CLAUDE_PLUGIN_ROOT is not exported as a shell env var
    try {
      fs.mkdirSync(PROMPT_ANALYSIS_ROOT, { recursive: true });
      fs.writeFileSync(path.join(PROMPT_ANALYSIS_ROOT, 'plugin-root.txt'), PLUGIN_ROOT, 'utf8');
    } catch {}
  } catch (err) {
    process.stderr.write(`[prompt-analyzer] session-init error: ${err.message}\n`);
  }
  process.exit(0);
}

main();
