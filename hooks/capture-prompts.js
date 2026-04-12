#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitUsername() {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
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

function getDateFolder() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getTimeString() {
  const now = new Date();
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

function ensureGitignore(analyzerRoot) {
  const gitignorePath = path.join(analyzerRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const content = [
      '# Prompt Analyzer - Privacy',
      '# Raw prompts and metrics are personal/sensitive',
      '# Analysis files and scores are safe to share',
      '**/prompts.md',
      '**/metrics.json',
      ''
    ].join('\n');
    fs.writeFileSync(gitignorePath, content, 'utf8');
  }
}

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

  const username = getGitUsername();
  const dateFolder = getDateFolder();
  const timeStr = getTimeString();

  const analyzerRoot = path.join(cwd, 'docs', 'prompt-analyzer');
  const dayFolder = path.join(analyzerRoot, username, dateFolder);
  const promptsFile = path.join(dayFolder, 'prompts.md');

  fs.mkdirSync(dayFolder, { recursive: true });
  ensureGitignore(analyzerRoot);

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
