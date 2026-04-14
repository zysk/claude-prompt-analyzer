#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constants ───────────────────────────────────────────────────────────────

const VERSION = '1.1.0';

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

      const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
      const charCount = body.length;

      prompts.push({
        promptNumber,
        sessionId: currentSessionId,
        time: timeStr,
        type,
        body,
        wordCount,
        charCount,
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

// ─── Classification helpers ────────────────────────────────────────────────────

const IMPERATIVE_VERBS = new Set([
  'create', 'fix', 'add', 'update', 'remove', 'build', 'implement', 'write',
  'run', 'check', 'delete', 'move', 'rename', 'refactor', 'test', 'debug',
  'deploy', 'install', 'configure', 'set', 'make', 'change', 'modify',
  'replace', 'merge', 'revert', 'reset', 'clean', 'format', 'lint', 'upgrade',
  'downgrade', 'migrate', 'convert', 'extract', 'split', 'combine', 'wrap',
  'unwrap',
]);

const QUESTION_STARTERS = new Set([
  'who', 'what', 'why', 'how', 'where', 'when', 'can', 'does', 'is', 'are',
  'will', 'would', 'could', 'should', 'do',
]);

/**
 * Returns true when `text` contains 2+ context signals:
 * file path, code block, line number reference, or error keyword.
 *
 * @param {string} text - original prompt body
 * @returns {boolean}
 */
function hasContextSignals(text) {
  const signals = [
    /[\w./\\-]+\.\w{1,6}(:\d+)?/.test(text),                // file path
    /```/.test(text),                                          // code block
    /(?::\d+|line\s+\d+)/i.test(text),                       // line number
    /\b(?:errors?|exceptions?|undefined|null|failed|crash|traceback|stacktrace|typeerror|syntaxerror|referenceerror|cannot|unable)\b/i.test(text), // error keywords
  ];
  return signals.filter(Boolean).length >= 2;
}

/**
 * Checks learned-rules.json patterns against the current prompt.
 * Returns a classification object if a rule matches, or null.
 *
 * @param {object[]} learnedRules
 * @param {object} prompt
 * @param {object|null} prevPrompt
 * @returns {{ suggested: string, confidence: string, reason: string, source: string }|null}
 */
function applyLearnedRules(learnedRules, prompt, prevPrompt) {
  if (!Array.isArray(learnedRules) || learnedRules.length === 0) return null;

  const text = prompt.body;
  const lowerText = text.toLowerCase();

  for (const rule of learnedRules) {
    if (!rule.pattern || !rule.classification) continue;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(text)) {
        return {
          suggested: rule.classification,
          confidence: rule.confidence || 'medium',
          reason: rule.reason || `Matched learned rule: ${rule.pattern}`,
          source: 'learned-rule',
        };
      }
    } catch (_e) {
      // Invalid regex in learned rules — skip silently
    }
  }

  return null;
}

/**
 * Adjusts a base confidence level using historical accuracy for a rule type.
 *
 * @param {'high'|'medium'|'low'} baseConfidence
 * @param {string} ruleType
 * @param {object} ruleAccuracy - map of ruleType → accuracy number (0-1)
 * @returns {'high'|'medium'|'low'}
 */
function getAdjustedConfidence(baseConfidence, ruleType, ruleAccuracy) {
  if (!ruleAccuracy || typeof ruleAccuracy !== 'object') return baseConfidence;
  const accuracy = ruleAccuracy[ruleType];
  if (typeof accuracy !== 'number') return baseConfidence;
  if (accuracy > 0.85) return 'high';
  if (accuracy >= 0.60) return 'medium';
  return 'low';
}

/**
 * Heuristic classification of a single prompt.
 *
 * @param {string} text - original body
 * @param {string} lowerText - lowercase body
 * @param {object} prompt
 * @param {object|null} prevPrompt
 * @param {object} ruleAccuracy - map of ruleType → accuracy from corrections.json
 * @returns {{ suggested: string, confidence: string, reason: string, source: string }}
 */
function heuristicClassify(text, lowerText, prompt, prevPrompt, ruleAccuracy) {
  const wordCount = prompt.wordCount;
  const charCount = prompt.charCount;
  const contextRich = hasContextSignals(text);

  // 1. Single-word
  if (wordCount === 1) {
    return {
      suggested: 'single-word',
      confidence: getAdjustedConfidence('high', 'single-word', ruleAccuracy),
      reason: 'Prompt contains exactly one word',
      source: 'heuristic',
    };
  }

  // 2. Context-rich
  if (contextRich) {
    return {
      suggested: 'context-rich',
      confidence: getAdjustedConfidence('high', 'context-rich', ruleAccuracy),
      reason: 'Contains 2+ context signals (file path, code block, line number, or error keyword)',
      source: 'heuristic',
    };
  }

  // 3. Question
  const firstWord = lowerText.trim().split(/\s+/)[0].replace(/[^a-z]/g, '');
  if (text.trim().endsWith('?') || QUESTION_STARTERS.has(firstWord)) {
    return {
      suggested: 'question',
      confidence: getAdjustedConfidence('high', 'question', ruleAccuracy),
      reason: text.trim().endsWith('?')
        ? 'Prompt ends with a question mark'
        : `Prompt starts with question word "${firstWord}"`,
      source: 'heuristic',
    };
  }

  // 4. Imperative
  if (IMPERATIVE_VERBS.has(firstWord)) {
    const baseConf = contextRich ? 'high' : 'medium';
    return {
      suggested: 'imperative',
      confidence: getAdjustedConfidence(baseConf, 'imperative', ruleAccuracy),
      reason: `Prompt starts with imperative verb "${firstWord}"`,
      source: 'heuristic',
    };
  }

  // 5. Vague
  if (charCount < 20 && !contextRich && wordCount > 1) {
    return {
      suggested: 'vague',
      confidence: getAdjustedConfidence('low', 'vague', ruleAccuracy),
      reason: 'Short prompt (< 20 chars) with no context signals; may be a follow-up',
      source: 'heuristic',
    };
  }

  // 6. Other
  return {
    suggested: 'other',
    confidence: getAdjustedConfidence('low', 'other', ruleAccuracy),
    reason: 'Does not match any heuristic pattern',
    source: 'heuristic',
  };
}

// ─── Classification ────────────────────────────────────────────────────────────

/**
 * Classifies each non-slash-command prompt by intent category.
 * Checks learned-rules.json first; falls back to heuristic rules.
 * Adjusts confidence using corrections.json accuracy data if present.
 *
 * @param {object[]} prompts
 * @param {string} correctionsPath - absolute path to corrections.json
 * @param {string} learnedRulesPath - absolute path to learned-rules.json
 * @returns {object[]}
 */
function classifyPrompts(prompts, correctionsPath, learnedRulesPath) {
  // Load optional self-improvement data
  let learnedRules = [];
  if (learnedRulesPath && fs.existsSync(learnedRulesPath)) {
    try {
      learnedRules = JSON.parse(fs.readFileSync(learnedRulesPath, 'utf8'));
    } catch (_e) {
      // Malformed file — proceed without learned rules
    }
  }

  let ruleAccuracy = null;
  if (correctionsPath && fs.existsSync(correctionsPath)) {
    try {
      const corrections = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
      ruleAccuracy = corrections.ruleAccuracy || null;
    } catch (_e) {
      // Malformed file — proceed without accuracy adjustments
    }
  }

  const classifications = [];
  const nonSlashPrompts = prompts.filter((p) => p.type !== '[slash-command]');

  for (let idx = 0; idx < nonSlashPrompts.length; idx++) {
    const prompt = nonSlashPrompts[idx];
    const prevPrompt = idx > 0 ? nonSlashPrompts[idx - 1] : null;
    const text = prompt.body;
    const lowerText = text.toLowerCase();

    // Try learned rules first
    const learnedResult = applyLearnedRules(learnedRules, prompt, prevPrompt);

    if (learnedResult) {
      classifications.push({
        promptNumber: prompt.promptNumber,
        suggested: learnedResult.suggested,
        confidence: learnedResult.confidence,
        reason: learnedResult.reason,
        source: learnedResult.source,
      });
    } else {
      const result = heuristicClassify(text, lowerText, prompt, prevPrompt, ruleAccuracy);
      classifications.push({
        promptNumber: prompt.promptNumber,
        suggested: result.suggested,
        confidence: result.confidence,
        reason: result.reason,
        source: result.source,
      });
    }
  }

  return classifications;
}

// ─── Pattern detection helpers ─────────────────────────────────────────────────

/**
 * Normalizes text for similarity comparison:
 * lowercase, strip non-alphanumeric, collapse spaces.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeForComparison(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Jaccard similarity between two strings as word sets.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0-1
 */
function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionCount++;
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionCount;
}

/**
 * Groups prompts with Jaccard similarity > 0.8 into repetition clusters.
 *
 * @param {object[]} prompts - non-slash-command prompts only
 * @returns {Array<{ pattern: string, count: number, promptNumbers: number[] }>}
 */
function detectRepetitions(prompts) {
  const normalized = prompts.map((p) => normalizeForComparison(p.body));
  const visited = new Set();
  const repetitions = [];

  for (let i = 0; i < prompts.length; i++) {
    if (visited.has(i)) continue;

    const group = [i];
    for (let j = i + 1; j < prompts.length; j++) {
      if (visited.has(j)) continue;
      if (jaccardSimilarity(normalized[i], normalized[j]) > 0.8) {
        group.push(j);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      visited.add(i);
      repetitions.push({
        pattern: prompts[i].body.slice(0, 80), // representative sample
        count: group.length,
        promptNumbers: group.map((idx) => prompts[idx].promptNumber),
      });
    }
  }

  return repetitions;
}

// ─── Pattern detection ─────────────────────────────────────────────────────────

/**
 * Detects behavioral patterns across all non-slash-command prompts.
 *
 * @param {object[]} prompts
 * @returns {object}
 */
function detectPatterns(prompts) {
  const nonSlash = prompts.filter((p) => p.type !== '[slash-command]');

  let singleWordPrompts = 0;
  let questionPrompts = 0;
  let imperativePrompts = 0;
  let contextRichPrompts = 0;
  let vaguePrompts = 0;

  for (const p of nonSlash) {
    const lowerText = p.body.toLowerCase();
    const firstWord = lowerText.trim().split(/\s+/)[0].replace(/[^a-z]/g, '');
    const contextRich = hasContextSignals(p.body);

    if (p.wordCount === 1) {
      singleWordPrompts++;
    } else if (contextRich) {
      contextRichPrompts++;
    } else if (p.body.trim().endsWith('?') || QUESTION_STARTERS.has(firstWord)) {
      questionPrompts++;
    } else if (IMPERATIVE_VERBS.has(firstWord)) {
      imperativePrompts++;
    } else if (p.charCount < 20 && !contextRich && p.wordCount > 1) {
      vaguePrompts++;
    }
  }

  const repetitions = detectRepetitions(nonSlash);

  return {
    singleWordPrompts,
    questionPrompts,
    imperativePrompts,
    contextRichPrompts,
    vaguePrompts,
    repetitions,
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

  const userFolder = path.dirname(dayFolder);
  const correctionsPath = path.join(userFolder, 'corrections.json');
  const learnedRulesPath = path.join(userFolder, 'learned-rules.json');

  const slashAnalysis = analyzeSlashCommands(prompts);
  const stats = computeStats(prompts);
  const classifications = classifyPrompts(prompts, correctionsPath, learnedRulesPath);
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
