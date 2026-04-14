#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- Config ---

const PROMPT_ANALYSIS_ROOT = path.join(os.homedir(), 'prompt-analysis');
const PROJECTS_FILE = path.join(PROMPT_ANALYSIS_ROOT, 'projects.json');

// --- Helpers ---

function getGitUsername(cwd) {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8', cwd }).trim();
    return sanitizeUsername(name);
  } catch {
    return 'unknown-user';
  }
}

function sanitizeUsername(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

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

function getProjectName(cwd) {
  const normalizedCwd = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  const baseName = path.basename(normalizedCwd);

  // Read or create projects.json
  let projects = {};
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    } catch { /* ignore parse errors */ }
  }

  // Check if this cwd already has a mapping
  for (const [name, cwdPath] of Object.entries(projects)) {
    if (cwdPath.replace(/\\/g, '/') === normalizedCwd) {
      return name;
    }
  }

  // No existing mapping; find a unique name
  let projectName = baseName;
  let counter = 2;
  while (projects[projectName] && projects[projectName].replace(/\\/g, '/') !== normalizedCwd) {
    projectName = `${baseName}-${counter}`;
    counter++;
  }

  // Save mapping
  projects[projectName] = normalizedCwd;
  fs.mkdirSync(PROMPT_ANALYSIS_ROOT, { recursive: true });
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');

  return projectName;
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
  const username = getGitUsername(cwd);
  const dateFolder = getDateFolder(now);
  const timeStr = getTimeString(now);
  const projectName = getProjectName(cwd);

  const dayFolder = path.join(PROMPT_ANALYSIS_ROOT, projectName, username, dateFolder);
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
