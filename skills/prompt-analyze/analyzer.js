#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ───────────────────────────────────────────────────────────────

const BUILT_IN_COMMANDS = new Set([
  '/help', '/commit', '/review', '/insights', '/init', '/clear', '/compact',
  '/cost', '/login', '/logout', '/status', '/doctor', '/config', '/bug',
  '/terminal-setup', '/mcp', '/permissions', '/memory',
]);

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parses a prompts.md file produced by the capture hook.
 *
 * Session header format:   ## Session: abc123 | 07:15 AM
 * Prompt header format:    ### Prompt 1 | 07:15 AM | [prompt]
 * Prompt body ends at:     next ---, ###, or ##
 *
 * @param {string} content - raw file content
 * @returns {{ prompts: object[], sessions: object[] }}
 */
function parsePromptsFile(content) {
  const lines = content.split('\n');

  const sessions = [];
  const prompts = [];

  let currentSessionId = null;
  let currentSessionTime = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Session header: ## Session: abc123 | 07:15 AM
    const sessionMatch = line.match(/^## Session:\s+(\S+)\s+\|\s+(.+)$/);
    if (sessionMatch) {
      currentSessionId = sessionMatch[1];
      currentSessionTime = sessionMatch[2].trim();
      sessions.push({ sessionId: currentSessionId, startTime: currentSessionTime });
      i++;
      continue;
    }

    // Prompt header: ### Prompt 1 | 07:15 AM | [prompt]
    const promptMatch = line.match(/^### Prompt (\d+)\s+\|\s+(\d+:\d+\s+[AP]M)\s+\|\s+(\[\S+\])$/);
    if (promptMatch) {
      const promptNumber = parseInt(promptMatch[1], 10);
      const timeStr = promptMatch[2].trim();
      const type = promptMatch[3]; // [prompt] or [slash-command]

      // Collect body lines until --- or ### or ##
      i++;
      const bodyLines = [];
      while (i < lines.length) {
        const bodyLine = lines[i];
        if (bodyLine.startsWith('---') || bodyLine.startsWith('### ') || bodyLine.startsWith('## ')) {
          break;
        }
        bodyLines.push(bodyLine);
        i++;
      }

      // Trim trailing blank lines from body
      while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
        bodyLines.pop();
      }

      const body = bodyLines.join('\n').trim();

      prompts.push({
        promptNumber,
        sessionId: currentSessionId,
        time: timeStr,
        type,           // '[prompt]' or '[slash-command]'
        body,
      });
      continue;
    }

    i++;
  }

  return { prompts, sessions };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Computes char-length stats (avg/min/max/median) and total word count.
 * Slash commands are excluded from word count but included in length stats.
 *
 * @param {object[]} prompts
 * @returns {object}
 */
function computeStats(prompts) {
  if (prompts.length === 0) {
    return {
      avgPromptLength: 0,
      minPromptLength: 0,
      maxPromptLength: 0,
      medianPromptLength: 0,
      totalWords: 0,
    };
  }

  const lengths = prompts.map((p) => p.body.length);
  const sorted = [...lengths].sort((a, b) => a - b);

  const sum = lengths.reduce((acc, l) => acc + l, 0);
  const avg = Math.round(sum / lengths.length);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];

  // Total words only for non-slash-command prompts
  const totalWords = prompts
    .filter((p) => p.type !== '[slash-command]')
    .reduce((acc, p) => {
      const words = p.body.trim().split(/\s+/).filter(Boolean);
      return acc + words.length;
    }, 0);

  return { avgPromptLength: avg, minPromptLength: min, maxPromptLength: max, medianPromptLength: median, totalWords };
}

// ─── Slash command analysis ───────────────────────────────────────────────────

/**
 * Counts and categorizes slash commands.
 *
 * @param {object[]} prompts
 * @returns {{ count: number, commands: object[] }}
 */
function analyzeSlashCommands(prompts) {
  const slashPrompts = prompts.filter((p) => p.type === '[slash-command]');
  const counts = {};

  for (const p of slashPrompts) {
    // Body is the raw command text, e.g. "/commit"
    const cmd = p.body.trim().split(/\s+/)[0]; // first token is the command name
    counts[cmd] = (counts[cmd] || 0) + 1;
  }

  const commands = Object.entries(counts).map(([name, count]) => ({
    name,
    type: BUILT_IN_COMMANDS.has(name) ? 'built-in' : 'custom',
    count,
  }));

  return { count: slashPrompts.length, commands };
}

// ─── Time distribution ────────────────────────────────────────────────────────

/**
 * Parses "07:15 AM" / "02:30 PM" into 24h hour integer.
 *
 * @param {string} timeStr
 * @returns {number} 0-23
 */
function parseHour(timeStr) {
  const match = timeStr.match(/^(\d+):(\d+)\s+(AM|PM)$/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour;
}

/**
 * Counts prompts by time-of-day bucket.
 * morning: hour < 12, afternoon: 12 <= hour < 17, evening: hour >= 17
 *
 * @param {object[]} prompts
 * @returns {{ morning: number, afternoon: number, evening: number }}
 */
function computeTimeDistribution(prompts) {
  const dist = { morning: 0, afternoon: 0, evening: 0 };

  for (const p of prompts) {
    const hour = parseHour(p.time);
    if (hour < 12) dist.morning++;
    else if (hour < 17) dist.afternoon++;
    else dist.evening++;
  }

  return dist;
}

// ─── Session breakdown ────────────────────────────────────────────────────────

/**
 * Builds per-session stats: prompt count and time range.
 *
 * @param {object[]} prompts
 * @param {object[]} sessions
 * @returns {object[]}
 */
function buildSessionBreakdown(prompts, sessions) {
  return sessions.map((session) => {
    const sessionPrompts = prompts.filter((p) => p.sessionId === session.sessionId);
    const promptCount = sessionPrompts.length;

    let duration = session.startTime;
    if (sessionPrompts.length > 0) {
      const times = sessionPrompts.map((p) => p.time);
      const first = times[0];
      const last = times[times.length - 1];
      duration = first === last ? first : `${first}-${last}`;
    }

    return {
      sessionId: session.sessionId,
      promptCount,
      duration,
    };
  });
}

// ─── Stubs (Task 3) ───────────────────────────────────────────────────────────

/**
 * Stub: classifies prompts by intent category.
 * Task 3 will implement this.
 *
 * @param {object[]} _prompts
 * @returns {object[]}
 */
function classifyPrompts(_prompts) {
  return [];
}

/**
 * Stub: detects behavioral patterns in the prompt stream.
 * Task 3 will implement this.
 *
 * @param {object[]} _prompts
 * @returns {object}
 */
function detectPatterns(_prompts) {
  return {
    singleWordPrompts: 0,
    veryShortPrompts: 0,
    repeatedPrompts: 0,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const dayFolderArg = process.argv[2];
  if (!dayFolderArg) {
    console.error('Usage: node analyzer.js <day-folder-path>');
    process.exit(1);
  }

  // Resolve to absolute path (handles both Windows and POSIX)
  const dayFolder = path.resolve(dayFolderArg);
  const promptsFile = path.join(dayFolder, 'prompts.md');
  const metricsFile = path.join(dayFolder, 'metrics.json');

  if (!fs.existsSync(promptsFile)) {
    console.error(`prompts.md not found at: ${promptsFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(promptsFile, 'utf8');
  const { prompts, sessions } = parsePromptsFile(content);

  // Derive date and username from folder structure: .../username/dd-mm-yyyy
  const parts = dayFolder.replace(/\\/g, '/').split('/');
  const date = parts[parts.length - 1];
  const username = parts[parts.length - 2];

  const slashAnalysis = analyzeSlashCommands(prompts);
  const stats = computeStats(prompts);
  const classifications = classifyPrompts(prompts);
  const patterns = detectPatterns(prompts);
  const timeDistribution = computeTimeDistribution(prompts);
  const sessionBreakdown = buildSessionBreakdown(prompts, sessions);

  const metrics = {
    date,
    username,
    sessionCount: sessions.length,
    promptCount: prompts.length,
    slashCommandCount: slashAnalysis.count,
    slashCommands: slashAnalysis.commands,
    stats,
    classifications,
    patterns,
    timeDistribution,
    sessionBreakdown,
  };

  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2), 'utf8');
  console.log(`metrics.json written to: ${metricsFile}`);
}

main();
