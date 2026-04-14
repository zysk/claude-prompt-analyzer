---
name: prompt-analyze
description: >
  Analyze captured prompts for quality, patterns, and improvement.
  Scores prompts across 10 dimensions, tracks day-over-day improvement,
  generates analysis.md + report.html. Can be run from any project.
  Use when user runs /prompt-analyze.
---

You are a prompt quality analyst. Your job is to read captured daily prompt logs, score them rigorously against Anthropic's best practices, and generate structured feedback that helps the user write better prompts over time.

**Important**: This skill is location-independent. All data lives under `~/prompt-analysis/`. You do NOT depend on the current working directory.

Work through Steps 1-5 in order. Be precise. Do not skip steps. Do not fabricate data.

---

## Step 1: Fetch Best Practices Rubric

Obtain the scoring rubric from the best available source. Try each tier in order; stop at the first that succeeds.

**Tier 1 - Context7 (preferred):**
1. Call `mcp__context7__resolve-library-id` with query `"anthropic claude prompting"`.
2. Call `mcp__context7__query-docs` with the resolved library ID, querying for `"prompt engineering best practices clarity specificity context"`.
3. If either call errors or returns no usable content, fall through to Tier 2.
4. Source label: `"Context7 - Anthropic Claude Prompting Guide"`

**Tier 2 - WebFetch fallback:**
1. Fetch `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview` using the available fetch tool.
2. If the fetch fails or returns an error page, fall through to Tier 3.
3. Source label: `"WebFetch - docs.anthropic.com/prompt-engineering"`

**Tier 3 - Baseline Rubric (last resort):**
Use the Baseline Rubric defined at the bottom of this file.
Source label: `"Baseline Rubric (offline fallback)"`

---

## Step 2: Discover Projects and Read State

**This skill does NOT depend on the current working directory.** All data lives at `~/prompt-analysis/`.

**2a. Read projects.json:**

Read the file at `~/prompt-analysis/projects.json` using the Read tool. This file maps project names to their source paths. Example:
```json
{
  "claude-prompt-analyzer": "C:/Users/ArijitSaha/Projects/office/my-stuff/claude-prompt-analyzer",
  "coderepo-react-node-melodio": "C:/Users/ArijitSaha/Projects/office/zysk-projects/hackerrank/coderepo/melodio/coderepo-react-node-melodio"
}
```

If the file doesn't exist or is empty, print: "No prompts captured yet. Use Claude Code in any project; prompts are captured automatically." Then exit.

**2b. Scan for unanalyzed days across ALL projects:**

For each project in `projects.json`:
1. List day folders at `~/prompt-analysis/{project}/prompts/` matching `DD-MM-YYYY`
2. For each day folder: check if `prompts.md` exists
3. Check if a corresponding `~/prompt-analysis/{project}/reports/{DD-MM-YYYY}/analysis.md` exists
4. If prompts.md exists but analysis.md does NOT: this day is unanalyzed

**2c. Read state files for each project with unanalyzed days:**

For each project that has unanalyzed days, read these files from `~/prompt-analysis/{project}/reports/` if they exist:
- `meta.json`
- `scores.json`
- `corrections.json`
- `learned-rules.json`

If any file is missing, treat as empty/default.

**2d. Print summary:**

```
Prompt Analysis Scan
====================
Projects found: {N}

{project-name}: {M} unanalyzed day(s)
  - {DD-MM-YYYY}
  - {DD-MM-YYYY}

{project-name}: all days analyzed

Analyzing {total} day(s) across {N} project(s)...
```

If no unanalyzed days across any project: "All days analyzed across all projects. Latest scores: ..." Then exit.

---

## Step 3: (merged into Step 2)

Step 3 is now part of Step 2. Proceed to Step 4.

---

## Step 4: Analyze Each Unanalyzed Day

Process each project, then each unanalyzed day within it (oldest first). Complete all sub-steps for a day before moving to the next.

---

### Step 4a: Run Pre-Processor

Run via Bash:
```bash
node ~/.claude/skills/prompt-analyze/analyzer.js "{absolute-path-to-prompts-day-folder}"
```

The path is `~/prompt-analysis/{project}/prompts/{DD-MM-YYYY}/`.

The script writes `metrics.json` to that folder. If it exits non-zero, print the error and skip this day.

---

### Step 4b: Read Inputs (including previous reports for progressive analysis)

Read ALL of the following:
1. `~/prompt-analysis/{project}/prompts/{DD-MM-YYYY}/prompts.md` - today's raw prompts
2. `~/prompt-analysis/{project}/prompts/{DD-MM-YYYY}/metrics.json` - pre-processor output
3. `~/prompt-analysis/{project}/reports/scores.json` - historical scores
4. **Previous analysis** (for progressive improvement tracking):
   - Read the MOST RECENT `analysis.md` from `~/prompt-analysis/{project}/reports/` (the latest date folder that has one)
   - This gives you context on what feedback was given last time
   - Check if the user improved on the areas flagged in that report

This progressive approach means each report builds on the last. You track whether the user acted on previous feedback.

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

Write to `~/prompt-analysis/{project}/reports/{DD-MM-YYYY}/analysis.md`.

Create the `reports/{DD-MM-YYYY}/` directory if needed.

Use this template (fill ALL placeholders):

```markdown
# Prompt Analysis - {DD-MM-YYYY}
# Project: {project-name}

**Composite Score:** {X.X}/10
**Trend:** {improving | stable | declining} {arrow}
**Streak:** {N} day(s) at 7.0+
**Prompts Analyzed:** {N} ({slash-count} slash commands not scored)
**Rubric Source:** {source label}

---

## Summary

{2-3 sentences. Be direct. Name specific strengths and problems.}

---

## Dimension Scores

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

---

## Top 3 Strengths

1. {Strength with specific example}
2. {Strength with specific example}
3. {Strength with specific example}

---

## Top 3 Areas for Improvement

1. {Problem with specific example}
2. {Problem with specific example}
3. {Problem with specific example}

---

## Prompt-by-Prompt Highlights

### Excellent Examples

{Prompts scoring >= 8.0 with "Why it worked" explanation}

### Needs Work

{Prompts scoring <= 4.0 with "Problem" and "Suggested rewrite"}

---

## Classification Corrections

{Table of corrections or "Pre-processor classifications accepted as-is."}

---

## Automation Candidates

{List or "None identified today."}

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

{Table or "No slash commands used today."}

---

## Best Practices Reference

Based on: {rubric source label}
```

---

### Step 4g: Write report.html

Write to `~/prompt-analysis/{project}/reports/{DD-MM-YYYY}/report.html`.

**Requirements:**
- Chart.js 4.x via CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
- All CSS/JS inline. No external deps beyond Chart.js.
- Responsive (1024px and 375px)

**Design:**
- Background: `#1a1a2e`, Cards: `#16213e`, Text: `#e0e0e0`
- Green `#4ade80` (>= 8.0), Yellow `#fbbf24` (5.0-7.9), Red `#f87171` (< 5.0)
- Accent: `#818cf8`

**Sections:**
1. Header: project name, date, composite (large, color-coded), trend, streak
2. Score gauge: doughnut chart
3. Radar: 10 dimensions today vs yesterday
4. Trend line: composite over time from scores.json
5. Dimension bars: horizontal, color-coded
6. Prompt highlights: expandable best/worst
7. Milestones banner (if any)
8. Automation candidates (if any)

Inject real data as JSON in a `<script>` block.

---

### Step 4h: Update State Files

Write all four to `~/prompt-analysis/{project}/reports/`:

**scores.json:** Append new daily score. Update streak, trend, rolling averages, milestones.

**corrections.json:** Append corrections from 4d. FIFO at 200 entries. Recompute ruleAccuracy.

**learned-rules.json:** Add patterns from corrections appearing 3+ times. Prune stale (30 days). Scope: CLASSIFICATION ONLY.

**meta.json:** Update lastAnalyzedDate, totalDaysAnalyzed, analysisHistory, rubricSource/Date.

---

## Step 5: Terminal Summary

After all projects/days processed:

```
=== Prompt Analysis Complete ===

{For each project analyzed:}
Project: {name}
  Days analyzed: {N}
  Latest composite: {X.X}/10 ({trend})
  Streak: {N} days
  Reports: ~/prompt-analysis/{project}/reports/{date}/

Milestones earned today:
  {list or "None"}
```

Open the latest report.html in browser:
```bash
node -e "const p=process.platform;const cmd=p==='win32'?'start \"\"':p==='darwin'?'open':'xdg-open';require('child_process').execSync(cmd+' \"PATH\"')"
```
Replace `PATH` with the actual absolute path to the latest report.html.

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
