#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config ---

const PROMPT_ANALYSIS_ROOT = path.join(os.homedir(), 'prompt-analysis');

// --- Helpers ---

function getDateFolder(now) {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getTimeString(now) {
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function detectPromptType(prompt) {
  const trimmed = prompt.trim();
  if (trimmed.startsWith('/')) {
    return '[slash-command]';
  }
  return '[prompt]';
}

function getPromptNumber(content) {
  const matches = content.match(/^### Prompt \d+/gm);
  return matches ? matches.length + 1 : 1;
}

function getLastSessionId(content) {
  const matches = content.match(/^## Session: (\S+)/gm);
  if (!matches || matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1];
  const idMatch = lastMatch.match(/^## Session: (\S+)/);
  return idMatch ? idMatch[1] : null;
}

/**
 * Derive project name from the Claude Code session root, not the current cwd.
 *
 * CLAUDE_PROJECT_DIR is set by Claude Code to the directory where the session
 * was started. If the user cd's into a subfolder mid-session, cwd changes but
 * CLAUDE_PROJECT_DIR stays stable. Falls back to cwd if env var is missing.
 */
function getProjectName(cwd) {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || cwd;
  const normalized = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  return path.basename(normalized);
}

// --- Main ---

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const inputData = Buffer.concat(chunks).toString('utf8');

  let parsed;
  try {
    parsed = JSON.parse(inputData);
  } catch {
    process.exit(0);
  }

  const { prompt, session_id: sessionId, cwd } = parsed;

  if (!prompt || !cwd) {
    process.exit(0);
  }

  const now = new Date();
  const dateFolder = getDateFolder(now);
  const timeStr = getTimeString(now);
  const projectName = getProjectName(cwd);

  const dayFolder = path.join(PROMPT_ANALYSIS_ROOT, projectName, 'prompts', dateFolder);
  const promptsFile = path.join(dayFolder, 'prompts.md');

  fs.mkdirSync(dayFolder, { recursive: true });

  let existingContent = '';
  if (fs.existsSync(promptsFile)) {
    existingContent = fs.readFileSync(promptsFile, 'utf8');
  }

  const promptNumber = getPromptNumber(existingContent);
  const promptType = detectPromptType(prompt);
  const lastSession = getLastSessionId(existingContent);
  const isNewSession = lastSession !== sessionId;

  let entry = '';

  if (!existingContent) {
    entry += `# Prompts - ${dateFolder}\n\n`;
  }

  if (isNewSession) {
    entry += `## Session: ${sessionId} | ${timeStr}\n\n`;
  }

  entry += `### Prompt ${promptNumber} | ${timeStr} | ${promptType}\n`;
  entry += `${prompt}\n\n`;
  entry += `---\n\n`;

  fs.appendFileSync(promptsFile, entry, 'utf8');
  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
