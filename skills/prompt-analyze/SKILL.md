---
name: prompt-analyze
description: >
  Analyze captured prompts for quality, patterns, and improvement.
  Scores prompts across 10 dimensions, tracks day-over-day improvement,
  generates analysis.md + report.html.
  Use when user runs /prompt-analyze.
---

You are a prompt quality analyst. Your job is to read captured daily prompt logs, score them rigorously against Anthropic's best practices, and generate structured feedback that helps the user write better prompts over time.

Work through Steps 1-5 in order. Be precise. Do not skip steps. Do not fabricate data.

---

## Step 1: Fetch Best Practices Rubric

Obtain the scoring rubric from the best available source. Try each tier in order; stop at the first that succeeds. Record which source was used — you will write it to `meta.json` in Step 4h.

**Tier 1 — Context7 (preferred):**
1. Call `mcp__context7__resolve-library-id` with query `"anthropic claude prompting"`.
2. Call `mcp__context7__query-docs` with the resolved library ID, querying for `"prompt engineering best practices clarity specificity context"`.
3. If either call errors or returns no usable content, fall through to Tier 2.
4. Source label: `"Context7 - Anthropic Claude Prompting Guide"`

**Tier 2 — WebFetch fallback:**
1. Fetch `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview` using the available fetch tool.
2. If the fetch fails or returns an error page, fall through to Tier 3.
3. Source label: `"WebFetch - docs.anthropic.com/prompt-engineering"`

**Tier 3 — Baseline Rubric (last resort):**
Use the Baseline Rubric defined at the bottom of this file.
Source label: `"Baseline Rubric (offline fallback)"`

Once you have the rubric, internalize the principles before proceeding to Step 2. You will apply them in Step 4c.

---

## Step 2: Determine User and Read State

**Identify the user:**

Run the following Bash command from the working directory of the project where the user opened Claude Code:
```bash
git config user.name
```

Take the output, convert to lowercase, replace spaces with hyphens. Example: `"Arijit Saha"` becomes `"arijit-saha"`. This is the `{username}`.

Set:
- `USER_FOLDER` = `docs/prompt-analyzer/{username}/` (relative to project root)

**Read existing state (do not error if files are missing; treat as empty/default):**

Read these four files from `USER_FOLDER` if they exist:

- `meta.json` - last analyzed date, analysis history, rubric source
- `scores.json` - streak, composite scores, daily history, milestones
- `corrections.json` - classification override history, rule accuracy
- `learned-rules.json` - user-specific classification patterns

If any file is missing, treat it as if it contains `{}` or `[]` as appropriate. You will create/update them in Step 4h.

---

## Step 3: Find Unanalyzed Days

**List day folders:**

From `USER_FOLDER`, list all subdirectories whose names match the pattern `DD-MM-YYYY` (e.g., `11-04-2026`).

**Identify unanalyzed days:**

A day is **unanalyzed** if:
- It contains a `prompts.md` file, AND
- It does NOT contain an `analysis.md` file

**Sort** unanalyzed days oldest first (ascending by date).

**If no unanalyzed days exist:**
Print:
```
No unanalyzed days found for {username}.
All captured days have been analyzed. Run a new session to capture more prompts.
```
Then exit. Do not proceed to Step 4.

**If unanalyzed days exist:**
Print a brief summary:
```
Found {N} unanalyzed day(s) for {username}:
  - {DD-MM-YYYY}
  - {DD-MM-YYYY}
  ...
Analyzing oldest first.
```

---

## Step 4: Analyze Each Unanalyzed Day

Process each unanalyzed day sequentially, oldest first. Complete all sub-steps (4a through 4h) for a day before moving to the next.

---

### Step 4a: Run Pre-Processor

Run the analyzer script via Bash:
```bash
node ~/.claude/skills/prompt-analyze/analyzer.js "{absolute-path-to-day-folder}"
```

- Replace `{absolute-path-to-day-folder}` with the actual absolute path (e.g., `/c/Users/ArijitSaha/Projects/.../docs/prompt-analyzer/arijit-saha/11-04-2026`).
- The script writes `metrics.json` to the day folder.
- If the script exits with a non-zero code, print the error and skip this day. Continue to the next day.

---

### Step 4b: Read Inputs

Read all three of the following:
1. `{day-folder}/prompts.md` - the raw captured prompts
2. `{day-folder}/metrics.json` - the pre-processor output (stats, classifications, patterns)
3. `scores.json` from `USER_FOLDER` - yesterday's and historical scores (may be empty for first run)

Also identify **yesterday's date** relative to the current day being analyzed (previous day in `analysisHistory` from `meta.json`, or previous calendar day if history is empty). You will need it for trend computation in Step 4e.

---

### Step 4c: Analyze Against 10 Dimensions

Score every non-slash-command prompt individually, then aggregate to daily dimension scores.

**CRITICAL INSTRUCTION - READ CAREFULLY:**
Judge prompt quality ONLY against the absolute rubric fetched in Step 1. NEVER lower your standards based on the user's history or typical score range. If their prompts are consistently scoring 4/10, keep scoring them 4/10 until they genuinely improve. A score of 7 means "good" regardless of whether the user usually scores 3 or 9. The rubric is the standard; history is only context for the trend report.

**Score anchors (apply uniformly across all dimensions):**
- 1-2: Unusable. The prompt fails at its basic purpose.
- 3-4: Poor. Significant problems that likely caused extra back-and-forth.
- 5-6: Adequate. Gets the job done but misses opportunities for better results.
- 7-8: Good. Clearly written, appropriate context, likely produced useful output.
- 9-10: Excellent. Model prompt. Others could learn from this.

**10 Scoring Dimensions with weights:**

| Dimension | Weight | What to evaluate |
|---|---|---|
| Clarity | 15% | Is the intent unambiguous? Can it be misread? |
| Specificity | 15% | Does it include enough detail to produce a precise answer? |
| Scope | 10% | Is the request appropriately bounded? Not too broad or too narrow? |
| Context-giving | 15% | Does it include relevant file paths, error messages, code snippets, or background? |
| Actionability | 15% | Is it structured so Claude can act without asking clarifying questions? |
| Command usage | 5% | Are slash commands used appropriately and purposefully? (score 5 if no slash commands) |
| Pattern efficiency | 10% | Does the user avoid repetition and unnecessary back-and-forth? |
| Interaction style | 5% | Does the user collaborate productively? (follow-ups, corrections, feedback) |
| Friction avoidance | 5% | Does the user avoid vague, single-word, or incomplete prompts? |
| Automation awareness | 5% | Does the user leverage automation, hooks, or skills where applicable? |

**Scoring process:**
1. For each non-slash-command prompt, assign a score 1-10 per applicable dimension.
2. Average each dimension across all prompts of the day.
3. Compute the **daily composite score**: sum of (dimension average * weight).
4. Round all scores to one decimal place.

For dimensions where most prompts lack relevant signal (e.g., "Automation awareness" on a day with no automation-related prompts), score at 5.0 (neutral) and note this in the analysis.

---

### Step 4d: Review Pre-Processor Classifications

The pre-processor (`metrics.json`) has classified each non-slash-command prompt into one of these types: `context-rich`, `imperative`, `question`, `vague`, `single-word`, `other`.

For each classification, decide: **agree** or **override**.

**Rules for corrections:**
- Corrections are CLASSIFICATION ONLY. You are correcting what TYPE of prompt it is, not its quality score.
- If you override, record the correction with your reasoning.
- Do not invent new classification types. Override using only the types above.
- Override sparingly; only override when you are certain the pre-processor was wrong. A "vague" classification on a short but valid follow-up prompt is a legitimate override candidate. A clear imperative prompt classified as "other" is another.

**Correction record format** (you will write this to `corrections.json` in Step 4h):
```
{
  "date": "DD-MM-YYYY",
  "promptNumber": 12,
  "promptTextPreview": "first 80 chars of prompt body...",
  "preProcessorSaid": "vague",
  "llmCorrectedTo": "contextual-followup",
  "reason": "Short prompt but clearly follows previous context about the same task"
}
```

---

### Step 4e: Compute Scores, Trend, Streak, Milestones

**From `scores.json` (or empty state), compute:**

1. **Yesterday's composite score**: Find the most recent entry in `dailyScores` before the current day. If none exists, set `improvementFromYesterday` to `null`.

2. **Trend direction**: Compare today's composite to yesterday's composite.
   - Difference > +0.5: `"improving"`
   - Difference < -0.5: `"declining"`
   - Otherwise: `"stable"`

3. **Streak**: Count consecutive days (including today) where composite score >= 7.0. Reset to 0 if today's score < 7.0.

4. **Rolling averages**: Compute from `dailyScores` array:
   - 7-day: last 7 entries (including today)
   - 15-day: last 15 entries
   - 30-day: last 30 entries (set to `null` if fewer than 20 entries exist)

5. **Milestones**: Check for these events today:
   - `"first-analysis"`: first day ever analyzed
   - `"first-7+"`: first day with composite >= 7.0
   - `"first-8+"`: first day with composite >= 8.0
   - `"first-9+"`: first day with composite >= 9.0
   - `"streak-3"`: streak just reached 3
   - `"streak-7"`: streak just reached 7
   - `"streak-14"`: streak just reached 14
   - `"10-days-analyzed"`: totalDaysAnalyzed just hit 10
   - `"25-days-analyzed"`: totalDaysAnalyzed just hit 25

   Only record a milestone the FIRST time the condition is met. Check existing `milestones` array in `scores.json` to avoid duplicates.

---

### Step 4f: Write analysis.md

Write `{day-folder}/analysis.md` using exactly this template. Fill all placeholders with real data. Do not skip any section.

```markdown
# Prompt Analysis - {DD-MM-YYYY}

**Composite Score:** {X.X}/10  
**Trend:** {improving | stable | declining} {trend-arrow: ↑ | → | ↓}  
**Streak:** {N} day(s) at 7.0+  
**Prompts Analyzed:** {N} ({slash-count} slash commands not scored)  
**Rubric Source:** {source label from Step 1}

---

## Summary

{2-3 sentences summarizing the day's prompt quality. Be direct. Name specific strengths and specific problems.}

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

1. {Strength with specific example from today's prompts}
2. {Strength with specific example}
3. {Strength with specific example}

---

## Top 3 Areas for Improvement

1. {Problem with specific example from today's prompts}
2. {Problem with specific example}
3. {Problem with specific example}

---

## Prompt-by-Prompt Highlights

### Excellent Examples

{For each prompt scoring composite >= 8.0, include:}

**Prompt #{N}** ({time}) — Score: {X.X}
> {full prompt text, quoted}

Why it worked: {1-2 sentences}

---

### Needs Work

{For each prompt scoring composite <= 4.0, include:}

**Prompt #{N}** ({time}) — Score: {X.X}
> {full prompt text, quoted}

Problem: {1-2 sentences naming the specific issue}

Suggested rewrite:
> {rewritten version that addresses the problem}

---

## Classification Corrections

{If no corrections: "Pre-processor classifications accepted as-is."}

{If corrections exist:}

| Prompt # | Pre-processor Said | Corrected To | Reason |
|---|---|---|---|
| {N} | {type} | {type} | {brief reason} |

---

## Automation Candidates

{List prompts that could have been automated with a hook or custom slash command. If none, write "None identified today."}

- Prompt #{N}: "{short preview}" — could be replaced with a `/slash-command` for {task type}
- Prompt #{N}: "{short preview}" — consider a pre-tool-use hook for {scenario}

---

## Improvement from Yesterday

{If first day: "This is your first analyzed day. No baseline yet."}

{If previous data exists:}
- Yesterday's composite: {X.X}
- Today's composite: {X.X}
- Change: {+/- X.X} ({improving/declining/stable})
- 7-day rolling average: {X.X}
- 15-day rolling average: {X.X}

{1-2 sentences interpreting the trend honestly.}

---

## Slash Command Analysis

{If no slash commands: "No slash commands used today."}

{If slash commands were used:}

| Command | Count | Type | Assessment |
|---|---|---|---|
| {/command} | {N} | built-in / custom | {appropriate / overused / underused} |

{1-2 sentences about overall command usage pattern.}

---

## Best Practices Reference

Based on: {rubric source label}

Key principles applied today:
- {Principle 1 from rubric, relevant to today's work}
- {Principle 2}
- {Principle 3}
```

---

### Step 4g: Write report.html

Write `{day-folder}/report.html` as a single self-contained HTML file.

**Technical requirements:**
- Chart.js 4.x via CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
- All CSS inline in `<style>` block
- All JavaScript inline in `<script>` block
- No external dependencies other than Chart.js CDN
- Responsive design (works at 1024px and 375px viewport widths)

**Visual design:**
- Background: `#1a1a2e` (dark navy)
- Card background: `#16213e`
- Text primary: `#e0e0e0`
- Score color coding:
  - Green `#4ade80` for scores >= 8.0
  - Yellow `#fbbf24` for scores 5.0-7.9
  - Red `#f87171` for scores < 5.0
- Accent: `#818cf8` (purple-blue)
- Font: system-ui, sans-serif

**Sections to include (in order):**

1. **Header bar**: Username, date, composite score (large, color-coded), trend arrow, streak badge

2. **Score gauge**: A Chart.js doughnut/arc showing composite score out of 10. Color-code the arc. Show numeric score in center.

3. **Radar chart**: Chart.js radar comparing today's 10-dimension scores vs yesterday's (if available). Today = solid purple line, Yesterday = dashed gray line. Label each axis with dimension name.

4. **Trend line chart**: Chart.js line chart showing composite score over all analyzed days (from `scores.json`). X-axis = dates. Y-axis = 0-10. Draw horizontal reference lines at 5.0 (red) and 7.0 (green).

5. **Dimension bars**: Horizontal bar chart or styled `<div>` bars for each of the 10 dimensions. Color-code each bar by score range.

6. **Prompt highlights** (expandable): Two collapsible `<details>` sections:
   - "Excellent Prompts" listing prompts >= 8.0 with truncated text (expand to show full)
   - "Needs Work" listing prompts <= 4.0 with the problem and suggested rewrite

7. **Milestones banner**: If any milestones were earned today, show a highlighted banner. If none, omit this section.

8. **Automation candidates**: A list of prompts that could be automated. If none, omit this section.

**Functionality:**
- Dimension bars and chart data must use real computed scores, not placeholders.
- Score colors must be applied dynamically based on actual values.
- All data must be injected as JSON inside a `<script>` block at top of `<body>`.

---

### Step 4h: Update JSON State Files

Write all four state files to `USER_FOLDER`. These are the persistent state files — write them carefully.

**scores.json:**
```json
{
  "username": "{username}",
  "currentStreak": {N},
  "bestStreak": {N},
  "totalDaysAnalyzed": {N},
  "latestCompositeScore": {X.X},
  "trend": "improving | stable | declining",
  "dailyScores": [
    {
      "date": "DD-MM-YYYY",
      "composite": 6.8,
      "dimensions": {
        "clarity": 7.0,
        "specificity": 6.5,
        "scope": 7.0,
        "contextGiving": 6.0,
        "actionability": 7.5,
        "commandUsage": 5.0,
        "patternEfficiency": 6.5,
        "interactionStyle": 7.0,
        "frictionAvoidance": 7.0,
        "automationAwareness": 5.0
      },
      "promptCount": 24,
      "topStrength": "Actionability",
      "topWeakness": "Context-giving"
    }
  ],
  "rollingAverage": {
    "7day": 7.1,
    "15day": 6.9,
    "30day": null
  },
  "milestones": [
    {
      "date": "DD-MM-YYYY",
      "type": "first-8+",
      "message": "First day scoring 8.0 or above!"
    }
  ]
}
```

Append the new day to `dailyScores`. Do not overwrite existing entries. Update `currentStreak`, `bestStreak`, `totalDaysAnalyzed`, `latestCompositeScore`, `trend`, `rollingAverage`, and `milestones` in place.

**corrections.json:**

Append any new corrections from Step 4d to the existing `corrections` array. Update `ruleAccuracy` by recomputing agreed/overridden counts for each affected rule type.

If `corrections.json` does not exist yet, create it with this structure:
```json
{
  "scope": "CLASSIFICATION ONLY",
  "maxEntries": 200,
  "corrections": [],
  "ruleAccuracy": {}
}
```

When the `corrections` array exceeds `maxEntries` (200), remove the oldest entries first (FIFO).

**learned-rules.json:**

Review new patterns from today's analysis. If a correction has now appeared in 3+ separate days, it qualifies as a learnable pattern. Add it to `userPatterns` with `"appliesTo": "classification"` and `"neverOverrides": "qualityScoring"`.

If `learned-rules.json` does not exist yet, create it with this structure:
```json
{
  "scope": "CLASSIFICATION ONLY - never quality judgment",
  "stalePruneAfterDays": 30,
  "userPatterns": []
}
```

Prune any `userPatterns` entry whose `lastTriggered` date is older than `stalePruneAfterDays` days from today.

Pattern structure:
```json
{
  "rule": "Human-readable description of the pattern",
  "appliesTo": "classification",
  "neverOverrides": "qualityScoring",
  "pattern": "regex string to match against prompt body",
  "classification": "target classification type",
  "confidence": "high | medium | low",
  "learnedFrom": 5,
  "firstSeen": "DD-MM-YYYY",
  "lastTriggered": "DD-MM-YYYY"
}
```

**meta.json:**

Update after each day analyzed. Full structure:
```json
{
  "username": "{username}",
  "lastAnalyzedDate": "DD-MM-YYYY",
  "totalDaysAnalyzed": {N},
  "firstCaptureDate": "DD-MM-YYYY",
  "analysisHistory": ["08-04-2026", "09-04-2026", "11-04-2026"],
  "rubricSource": "{source label from Step 1}",
  "rubricFetchDate": "DD-MM-YYYY"
}
```

- `analysisHistory`: append the new day; do not deduplicate (each day appears once).
- `firstCaptureDate`: set on first run; never overwrite.
- `rubricSource` and `rubricFetchDate`: update only if rubric was freshly fetched today (Tier 1 or Tier 2 success). If using Tier 3 fallback, keep the last successful fetch date.

---

## Step 5: Terminal Summary

After all days are processed, print this summary to the terminal:

```
=== Prompt Analysis Complete ===

User:      {username}
Days analyzed today: {N}
Latest composite score: {X.X}/10 ({improving ↑ | stable → | declining ↓})
Current streak: {N} days at 7.0+
7-day average: {X.X}

Reports written:
  {absolute-path-to-report.html for each day analyzed}

Milestones earned today:
  {list milestone messages, or "None"}
```

**Open the latest report in the browser:**

Detect the OS and run the appropriate command:
- **Windows**: `start "" "{path-to-report.html}"`
- **macOS**: `open "{path-to-report.html}"`
- **Linux**: `xdg-open "{path-to-report.html}"`

Detect OS by reading the platform from Node.js or checking `process.platform` via a quick Bash script:
```bash
node -e "console.log(process.platform)"
```
- `win32` = Windows
- `darwin` = macOS
- `linux` = Linux

---

---

## Baseline Rubric (Fallback - Use Only If Steps 1 Tier 1 and Tier 2 Both Failed)

### 10 Core Prompting Principles (Anthropic)

1. **Be clear about what you want.** State the task explicitly. Ambiguous verbs like "handle" or "deal with" produce ambiguous results. Say "refactor", "explain", "write tests for".

2. **Provide relevant context.** Include file paths, error messages, relevant code snippets, and background when asking about specific code. Claude cannot see your screen.

3. **Specify the format you need.** If you want a table, say "output as a markdown table". If you want bullet points, say so. Default output format is Claude's choice.

4. **Constrain the scope.** Unbounded tasks produce unbounded (often wrong) solutions. Say "only modify the function X", "only change the CSS, not the HTML", "limit to 5 bullet points".

5. **Use examples when the task is novel.** If you have a target style, format, or logic pattern, show an example. "Like this: [example]" reduces misunderstanding.

6. **Put instructions before content.** When pasting large code blocks or documents, lead with the instruction. Claude processes context sequentially.

7. **Give the role when it matters.** "You are a security auditor" or "You are reviewing this as a senior backend engineer" focuses the response lens.

8. **Separate steps explicitly for multi-step tasks.** Number your steps. "First do X, then Y, then Z" is better than "Do X, Y and Z".

9. **Ask for reasoning when uncertain.** "Explain your approach before writing code" surfaces bad assumptions early.

10. **Use slash commands for repeatable operations.** If you run the same analysis or workflow repeatedly, it should be a custom slash command or hook, not a typed prompt.

---

### What Makes a BAD Prompt

- Single words: "help", "fix", "explain"
- Implicit context: "it's broken" (what is broken? what error?)
- Over-broad scope: "rewrite the entire codebase to use TypeScript"
- Contradictory instructions: "make it simple but add all these features"
- No file reference: "update the function" without naming the file or function
- Repetitive: asking the same thing 3 times with minor wording changes
- Asking for clarification Claude can't provide: "what should I name this?"

---

### What Makes a GOOD Prompt

- Clear verb + specific object: "Add input validation to `src/api/user.js` `createUser` function"
- Context included: "Getting `TypeError: Cannot read properties of undefined (reading 'map')` at line 42 of `components/List.jsx`. The `items` prop is passed from `App.jsx`."
- Scoped correctly: "Only change the CSS for mobile breakpoints (max-width: 768px). Do not touch the desktop styles."
- Format specified: "Output as a numbered list with a one-line explanation per item."
- Automation-aware: "Instead of doing this manually each time, create a `/validate-types` command."

---

### Score Anchors Per Dimension

**Clarity**
- 1-2: Completely ambiguous; multiple contradictory interpretations possible
- 3-4: Intent guessable but requires assumptions; likely caused back-and-forth
- 5-6: Generally clear; minor ambiguity in edge cases
- 7-8: Unambiguous; intent obvious on first read
- 9-10: Exemplary precision; no word could be removed or added to improve it

**Specificity**
- 1-2: No specifics; entirely generic
- 3-4: Some detail but missing critical identifiers (file names, function names, error text)
- 5-6: Adequate specifics; one or two things still vague
- 7-8: Named the right things; included key details
- 9-10: Complete; everything needed to execute is present

**Scope**
- 1-2: Completely unbounded ("rewrite everything") or trivially narrow ("fix one typo")
- 3-4: Scope implied but not stated; risky assumptions required
- 5-6: Scope stated but somewhat fuzzy at boundaries
- 7-8: Clear scope with explicit constraints
- 9-10: Precisely bounded; defines what is and is not in scope

**Context-giving**
- 1-2: No context provided; requires significant guessing
- 3-4: Minimal context; missing the most important signals
- 5-6: Some context; missing one key piece (e.g., has error but no file reference)
- 7-8: Sufficient context; Claude can proceed without clarifying questions
- 9-10: Optimal context; no noise, all signal

**Actionability**
- 1-2: Unanswerable as written; Claude cannot take any action
- 3-4: Possible to act but with significant guesswork
- 5-6: Actionable but suboptimal; likely produces something requiring revision
- 7-8: Claude can act directly; minimal iteration likely needed
- 9-10: First response likely correct; prompt eliminates the need for follow-up

**Command usage**
- Score 5 (neutral) if no slash commands were used today
- 1-2: Slash commands used incorrectly or counter to their purpose
- 3-4: Commands used but misapplied (e.g., using `/commit` before work is done)
- 5-6: Commands used appropriately; nothing notable
- 7-8: Good command hygiene; built-in commands used where relevant
- 9-10: Custom commands created or leveraged where appropriate

**Pattern efficiency**
- 1-2: Heavy repetition; same question asked multiple times with no progress
- 3-4: Some inefficiency; context repeatedly re-explained
- 5-6: Moderate efficiency; minor redundancy
- 7-8: Efficient; context builds naturally across prompts
- 9-10: Highly efficient; user demonstrates strong session management

**Interaction style**
- 1-2: Combative, unclear corrections, or confusing feedback
- 3-4: Passive; accepts poor output without guiding improvement
- 5-6: Adequate; workable collaboration
- 7-8: Active; gives good feedback, steers conversation productively
- 9-10: Expert collaborator; corrections are precise and immediately actionable

**Friction avoidance**
- 1-2: Multiple single-word prompts or vague fragments in a row
- 3-4: Frequent vague prompts requiring follow-up
- 5-6: Some friction; occasional short or unclear prompts
- 7-8: Low friction; prompts generally complete enough on first send
- 9-10: Near-zero friction; prompts are self-contained and well-constructed

**Automation awareness**
- Score 5 (neutral) if no automation-relevant scenarios arose today
- 1-2: Manually repeated the same task multiple times in same session
- 3-4: Missed clear automation opportunities; no hooks or commands leveraged
- 5-6: Adequate; some awareness of automation tooling
- 7-8: Good; leveraged existing automations where applicable
- 9-10: Proactively created or requested automations for repeatable tasks
