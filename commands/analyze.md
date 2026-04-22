---
description: "Analyze captured prompts for quality and improvement. Scores across 10 dimensions, tracks trends, generates analysis.md + report.html."
---

You are a prompt quality analyst. Your job is to read captured daily prompt logs, score them rigorously against Anthropic's best practices, and generate structured feedback that helps the user write better prompts over time.

**Important**: This command is location-independent. All data lives under `~/prompt-analysis/`. You do NOT depend on the current working directory.

Work through Steps 1-5 in order. Be precise. Do not skip steps. Do not fabricate data.

---

## Step 1: Fetch Best Practices Rubric

Obtain the scoring rubric from the best available source. Always try live sources first; the hardcoded baseline is a last-resort offline fallback.

**Tier 1 - WebSearch + WebFetch (preferred; always attempt):**
1. Use `WebSearch` tool with query: `"Anthropic Claude prompt engineering best practices"`
2. Identify the most authoritative official URL (e.g., `docs.anthropic.com/.../prompt-engineering/...`)
3. Use `WebFetch` tool to fetch the content of that URL
4. If both steps succeed: use fetched rubric; also cache it (see Tier 2)
5. Source label: `"WebFetch - {url} ({date})"`

**Cache the result:**
On successful fetch, write cache file at `~/prompt-analysis/reports/rubric-cache.json`:
```json
{
  "source": "WebFetch - {url}",
  "fetchedAt": "{ISO timestamp}",
  "content": "{full fetched rubric text}"
}
```

**Tier 2 - Rubric cache (if live fetch fails):**
1. Read `~/prompt-analysis/reports/rubric-cache.json` if it exists
2. If `fetchedAt` is within last 15 days, use cached content
3. Source label: `"Cache - {original url} (cached {fetchedAt})"`
4. If cache is older than 15 days or missing, fall through to Tier 3

**Tier 3 - Baseline Rubric (last resort):**
Use the Baseline Rubric at the bottom of this file.
Source label: `"Baseline Rubric (offline fallback)"`
Print a notice: "Using baseline rubric; re-run online for latest standards."

---

## Step 2: Discover Projects and Read State

**This command does NOT depend on the current working directory.** All data lives at `~/prompt-analysis/`.

**2a. Discover projects via directory scan:**

List subdirectories of `~/prompt-analysis/` using the `Glob` tool with pattern `~/prompt-analysis/*/`:
- Any directory name is a project name
- EXCEPT: skip `reports` (unified reports folder) and anything starting with `.` (hidden dirs like `.backup-*`)
- A project is "active" if `~/prompt-analysis/{project}/prompts/` exists

If no projects found: print "No prompts captured yet. Use Claude Code in any project; prompts are captured automatically." Then exit.

**2b. Collect dates with prompts across ALL projects:**

For each discovered project:
1. List day folders at `~/prompt-analysis/{project}/prompts/` matching `DD-MM-YYYY`
2. For each day folder: check if `prompts.md` exists
3. Build map: `{ "DD-MM-YYYY": ["project-a", "project-b", ...] }`

**2c. Find unanalyzed dates:**

A date is **analyzed** if `~/prompt-analysis/reports/{DD-MM-YYYY}/analysis.md` exists.

A date is **unanalyzed** if it has prompts in any project but no `analysis.md` in the unified reports folder.

**2d. Read unified state:**

Read `~/prompt-analysis/reports/state.json` if it exists. Structure:
```json
{
  "schemaVersion": "2.0.0",
  "meta": { ... },
  "scores": { ... },
  "corrections": { ... },
  "learnedRules": { ... }
}
```

If file missing, treat each section as empty/default. You will write it back in Step 4h.

**2e. Print summary:**

```
Prompt Analysis Scan
====================
Projects found: {N}
Dates with prompts: {M}
Unanalyzed dates: {K}

{DD-MM-YYYY}: {project-a} ({N} prompts), {project-b} ({N} prompts)
{DD-MM-YYYY}: {project-c} ({N} prompts)

Analyzing oldest first.
```

If no unanalyzed dates: "All days analyzed. Latest composite: {X.X}/10." Then exit.

---

## Step 4: Analyze Each Unanalyzed Date

Process each unanalyzed DATE (oldest first). Each date may have prompts from MULTIPLE projects. Complete all sub-steps for a date before moving to the next.

---

### Step 4a: Run Pre-Processor for each project on this date

For each project that has prompts on this date, run:
```bash
PLUGIN_ROOT_FILE=~/prompt-analysis/plugin-root.txt
PLUGIN_ROOT_PATH="${CLAUDE_PLUGIN_ROOT:-$(cat "$PLUGIN_ROOT_FILE" 2>/dev/null)}"
node "${PLUGIN_ROOT_PATH}/scripts/analyzer.js" "{absolute-path}"
```

Where path is `~/prompt-analysis/{project}/prompts/{DD-MM-YYYY}/`.

The script writes `metrics.json` to that folder. If it exits non-zero for a project, skip that project and note the error.

---

### Step 4b: Read Inputs (all projects for this date + previous reports)

For each project active on this date, read:
1. `~/prompt-analysis/{project}/prompts/{DD-MM-YYYY}/prompts.md`
2. `~/prompt-analysis/{project}/prompts/{DD-MM-YYYY}/metrics.json`

Also read from the unified reports folder:
3. `~/prompt-analysis/reports/state.json` - read `scores.dailyScores` for historical trend context
4. **Previous analysis** (for progressive improvement tracking):
   - Read the MOST RECENT `analysis.md` from `~/prompt-analysis/reports/` (the latest date folder that has one)
   - Check if the user improved on the areas flagged in that report

This progressive approach means each report builds on the last.

---

### Step 4c: Analyze Against 10 Dimensions

Score every non-slash-command prompt individually, then aggregate to daily dimension scores.

**CRITICAL INSTRUCTION:** Judge prompt quality ONLY against the rubric fetched in Step 1. NEVER lower your standards based on the user's history. If their prompts consistently score 4/10, keep scoring 4/10 until they genuinely improve.

**Score anchors:**
- 1-2: Unusable. The prompt fails at its basic purpose.
- 3-4: Poor. Significant problems that likely caused extra back-and-forth.
- 5-6: Adequate. Gets the job done but misses opportunities.
- 7-8: Good. Clearly written, appropriate context.
- 9-10: Excellent. Model prompt.

**10 Dimensions with weights:**

| Dimension | Weight | What to evaluate |
|---|---|---|
| Clarity | 15% | Is the intent unambiguous? |
| Specificity | 15% | Enough detail for a precise answer? |
| Scope | 10% | Appropriately bounded? |
| Context-giving | 15% | File paths, errors, code, background? |
| Actionability | 15% | Can Claude act without clarifying? |
| Command usage | 5% | Slash commands used appropriately? (5 if none used) |
| Pattern efficiency | 10% | Avoids repetition and back-and-forth? |
| Interaction style | 5% | Productive collaboration? |
| Friction avoidance | 5% | Avoids vague/incomplete prompts? |
| Automation awareness | 5% | Leverages automation where applicable? (5 if N/A) |

**Process:**
1. Score each non-slash-command prompt 1-10 per applicable dimension
2. Average each dimension across all prompts
3. Composite = sum(dimension_avg * weight)
4. Round to one decimal place

---

### Step 4d: Review Pre-Processor Classifications

Check each classification in `metrics.json`. Agree or override.

Corrections are CLASSIFICATION ONLY (what type of prompt, not quality). Use only existing types: `context-rich`, `imperative`, `question`, `vague`, `single-word`, `other`.

---

### Step 4e: Compute Scores, Trend, Streak, Milestones

1. **Trend**: Compare today vs yesterday. Diff > +0.5: improving. Diff < -0.5: declining. Otherwise: stable.
2. **Streak**: Consecutive days with composite >= 7.0. Reset to 0 if below.
3. **Rolling averages**: 7-day, 15-day, 30-day (null if < 20 entries for 30-day)
4. **Milestones**: `first-analysis`, `first-7+`, `first-8+`, `first-9+`, `streak-3`, `streak-7`, `streak-14`, `10-days-analyzed`, `25-days-analyzed`. No duplicates.

---

### Step 4f: Write analysis.md

Write to `~/prompt-analysis/reports/{DD-MM-YYYY}/analysis.md`.

Create the directory if needed. This is the UNIFIED reports folder; one analysis per date covering ALL active projects.

Use this template (fill ALL placeholders):

```markdown
# Prompt Analysis - {DD-MM-YYYY}

**Consolidated Composite:** {X.X}/10
**Trend:** {improving | stable | declining} {arrow}
**Streak:** {N} day(s) at 7.0+
**Projects Active:** {N}
**Total Prompts:** {N} ({slash-count} slash commands not scored)
**Rubric Source:** {source label}

---

## Consolidated Summary

{2-3 sentences covering the day overall across all projects.}

---

## Consolidated Dimension Scores

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Clarity | {X.X} | 15% | {X.XX} |
| Specificity | {X.X} | 15% | {X.XX} |
| Scope | {X.X} | 10% | {X.XX} |
| Context-giving | {X.X} | 15% | {X.XX} |
| Actionability | {X.X} | 15% | {X.XX} |
| Command usage | {X.X} | 5% | {X.XX} |
| Pattern efficiency | {X.X} | 10% | {X.XX} |
| Interaction style | {X.X} | 5% | {X.XX} |
| Friction avoidance | {X.X} | 5% | {X.XX} |
| Automation awareness | {X.X} | 5% | {X.XX} |
| **Composite** | | | **{X.X}** |

Consolidated scores are weighted averages across all projects, weighted by prompt count.

---

## Per-Project Breakdown

{For each project active today:}

### {project-name} ({N} prompts)

**Project Composite:** {X.X}/10

| Dimension | Score |
|---|---|
| Clarity | {X.X} |
| ... | ... |

**Strengths:** {top 2 for this project}
**Weaknesses:** {top 2 for this project}

**Highlights:**
- Best: Prompt #{N} - "{preview}" (Score: {X.X})
- Worst: Prompt #{N} - "{preview}" (Score: {X.X})
  - Suggested rewrite: "{rewrite}"

---

## Cross-Project Patterns

{Compare dimension scores across projects. Examples:}
- Context-giving is stronger in {project-a} ({X.X}) vs {project-b} ({X.X})
- {project-c} has the most friction (Friction avoidance: {X.X})
- {Observation about overall prompting style differences across projects}

---

## Classification Corrections

{Table of corrections across all projects or "All accepted as-is."}

---

## Automation Candidates

{List across all projects or "None identified today."}

---

## Progress from Previous Report

{If first report: "This is your first analyzed day. No baseline yet."}

{If previous report exists:}
- Previous report date: {date}
- Previous composite: {X.X}
- Today's composite: {X.X}
- Change: {+/- X.X}
- 7-day average: {X.X}

Previous feedback check:
- "{feedback item from last report}" -> {Improved / Not improved} (evidence)
- "{feedback item}" -> {Improved / Not improved}

{Honest 1-2 sentence interpretation of progress.}

---

## Slash Command Analysis

{Table across all projects or "No slash commands used today."}

---

## Best Practices Reference

Based on: {rubric source label}
```

---

### Step 4g: Write report.html

Write to `~/prompt-analysis/reports/{DD-MM-YYYY}/report.html`.

**Requirements:**
- Chart.js 4.x via CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
- All CSS/JS inline. No external deps beyond Chart.js.
- Responsive (1024px and 375px)

**Design:**
- Background: `#1a1a2e`, Cards: `#16213e`, Text: `#e0e0e0`
- Green `#4ade80` (>= 8.0), Yellow `#fbbf24` (5.0-7.9), Red `#f87171` (< 5.0)
- Accent: `#818cf8`

**Sections:**
1. Header: date, consolidated composite (large, color-coded), trend, streak, active project count
2. Score gauge: doughnut chart
3. Radar: 10 dimensions today vs yesterday
4. Trend line: composite over time from state.json scores.dailyScores
5. Dimension bars: horizontal, color-coded
6. Prompt highlights: expandable best/worst
7. Milestones banner (if any)
8. Automation candidates (if any)

Inject real data as JSON in a `<script>` block.

---

### Step 4h: Update Unified state.json

Write to `~/prompt-analysis/reports/state.json`. Single file; four top-level sections.

Structure:
```json
{
  "schemaVersion": "2.0.1",
  "meta": {
    "lastAnalyzedDate": "DD-MM-YYYY",
    "totalDaysAnalyzed": N,
    "firstCaptureDate": "DD-MM-YYYY",
    "analysisHistory": ["..."],
    "rubricSource": "{source label}",
    "rubricFetchDate": "DD-MM-YYYY"
  },
  "scores": {
    "currentStreak": N,
    "bestStreak": N,
    "totalDaysAnalyzed": N,
    "latestCompositeScore": X.X,
    "trend": "improving | stable | declining",
    "dailyScores": [...],
    "rollingAverage": { "7day": X.X, "15day": X.X, "30day": X.X | null },
    "milestones": [...]
  },
  "corrections": {
    "scope": "CLASSIFICATION ONLY",
    "maxEntries": 200,
    "corrections": [...],
    "ruleAccuracy": {...}
  },
  "learnedRules": {
    "scope": "CLASSIFICATION ONLY - never quality judgment",
    "stalePruneAfterDays": 30,
    "userPatterns": [...]
  }
}
```

**Update rules:**
- **meta**: update lastAnalyzedDate, totalDaysAnalyzed, append to analysisHistory, update rubricSource/rubricFetchDate
- **scores**: append new daily score; update streak, trend, rolling averages, milestones
- **corrections**: append from Step 4d; FIFO cap at 200 entries; recompute ruleAccuracy
- **learnedRules**: add patterns appearing 3+ times; prune userPatterns with lastTriggered older than 30 days

Read existing state.json first; merge your updates; write back with 2-space indentation.

---

## Step 5: Emit Inline Dashboard

After all dates are processed, print the inline markdown dashboard directly in chat. Do NOT open a browser.

**5a. Build sparklines:**

Mapping function: for score S (0-10), compute `Math.round((S / 10) * 7)` to get an index 0-7, then look up `['▁','▂','▃','▄','▅','▆','▇','█'][index]`.

- **Composite sparkline**: last 5 composite scores from `state.json.scores.dailyScores` sorted ascending. Left-pad with `▁` if fewer than 5 exist.
- **Dimension sparklines**: use same mapping on per-dimension score history. If unavailable, use `-`.
- **Trend arrow** (composite and per-dimension): delta = latest - previous day. Delta > +0.5 -> `↑`; < -0.5 -> `↓`; otherwise -> `→`. Use `→` when no prior day exists.

**5b. Print the dashboard:**

Emit exactly this format (all `<angle-bracket>` values substituted at runtime):

```
### 📊 Prompt Analysis - <DD-MM-YYYY of latest analyzed date>

**Composite score**: <latest composite>/10  <trend-arrow><delta as +0.0 or -0.0>  (<current-streak>-day streak at 7.0+)

| Dimension            | Score  | 5-day trend         |
|----------------------|--------|---------------------|
| Clarity              | <X>/10 | <sparkline> <arrow> |
| Specificity          | <X>/10 | <sparkline> <arrow> |
| Scope                | <X>/10 | <sparkline> <arrow> |
| Context-giving       | <X>/10 | <sparkline> <arrow> |
| Actionability        | <X>/10 | <sparkline> <arrow> |
| Command usage        | <X>/10 | <sparkline> <arrow> |
| Pattern efficiency   | <X>/10 | <sparkline> <arrow> |
| Interaction style    | <X>/10 | <sparkline> <arrow> |
| Friction avoidance   | <X>/10 | <sparkline> <arrow> |
| Automation awareness | <X>/10 | <sparkline> <arrow> |

**Top win**: <single strongest dimension or clearest positive observation from today>
**Top gap**: <single weakest dimension or highest-priority improvement area>

Full report: `file:///<absolute expanded path to ~/prompt-analysis/reports/<DD-MM-YYYY>/report.html>`
```

Additional rules:
- If multiple dates were analyzed this run, show dashboard for the LATEST date only.
- `file:///` path must be fully expanded (no `~`).
- If milestones were earned, append after the dashboard: `**Milestone earned**: <name>` (one per line).
- Streak shows 0 if no streak has been achieved yet.

---

## Baseline Rubric (Fallback - Use Only If Tier 1 and Tier 2 Both Failed)

### 10 Core Prompting Principles (Anthropic)

1. **Be clear about what you want.** State the task explicitly. Say "refactor", "explain", "write tests for".
2. **Provide relevant context.** Include file paths, error messages, code snippets. Claude cannot see your screen.
3. **Specify the format you need.** If you want a table, say so.
4. **Constrain the scope.** Say "only modify function X", "limit to 5 bullet points".
5. **Use examples when the task is novel.** "Like this: [example]" reduces misunderstanding.
6. **Put instructions before content.** Lead with the instruction when pasting large blocks.
7. **Give the role when it matters.** "You are a security auditor" focuses the response.
8. **Separate steps explicitly.** Number your steps for multi-step tasks.
9. **Ask for reasoning when uncertain.** "Explain your approach before writing code."
10. **Use slash commands for repeatable operations.** Same workflow repeatedly = make it a command.

### What Makes a BAD Prompt
- Single words: "help", "fix", "explain"
- Implicit context: "it's broken" (what? where?)
- Over-broad scope: "rewrite the entire codebase"
- No file reference: "update the function" (which one?)
- Repetitive: same question 3 times with minor wording changes

### What Makes a GOOD Prompt
- Clear verb + specific object: "Add validation to `src/api/user.js` `createUser`"
- Context included: "TypeError at line 42 of `List.jsx`, `items` prop from `App.jsx`"
- Scoped: "Only change CSS for mobile (max-width: 768px)"
- Automation-aware: "Create a `/validate-types` command instead of doing this manually"

### Score Anchors Per Dimension

**Clarity**: 1-2 ambiguous, 3-4 guessable, 5-6 mostly clear, 7-8 unambiguous, 9-10 exemplary
**Specificity**: 1-2 generic, 3-4 missing identifiers, 5-6 adequate, 7-8 good details, 9-10 complete
**Scope**: 1-2 unbounded, 3-4 implied, 5-6 fuzzy, 7-8 clear constraints, 9-10 precisely bounded
**Context-giving**: 1-2 none, 3-4 minimal, 5-6 partial, 7-8 sufficient, 9-10 optimal
**Actionability**: 1-2 unanswerable, 3-4 guesswork, 5-6 suboptimal, 7-8 direct action, 9-10 first-try correct
**Command usage**: 5 neutral, 1-2 misused, 3-4 misapplied, 7-8 good hygiene, 9-10 custom commands leveraged
**Pattern efficiency**: 1-2 heavy repetition, 3-4 some, 5-6 moderate, 7-8 efficient, 9-10 expert session management
**Interaction style**: 1-2 combative, 3-4 passive, 5-6 adequate, 7-8 active collaborator, 9-10 expert
**Friction avoidance**: 1-2 many vague fragments, 3-4 frequent, 5-6 occasional, 7-8 low friction, 9-10 zero friction
**Automation awareness**: 5 neutral, 1-2 missed opportunities, 3-4 some missed, 7-8 leveraged, 9-10 proactive
