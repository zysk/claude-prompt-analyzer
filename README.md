<h1 align="center">Claude Prompt Analyzer</h1>

<p align="center">
  <img src="assets/claude-jumping.svg" alt="Claude jumping mascot" width="120" height="100">
</p>

<p align="center">
  <strong>A Claude Code plugin that makes you measurably better at prompting.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue" alt="v2.0.0">
  <img src="https://img.shields.io/badge/platform-Claude%20Code-orange" alt="Claude Code">
  <img src="https://img.shields.io/badge/dependencies-zero-brightgreen" alt="zero dependencies">
</p>

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## Features

- **Auto-capture** - Every prompt you type is silently logged. No setup, no opt-in per project.
- **10-dimension scoring** - Clarity, specificity, context-giving, actionability, scope, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness.
- **Day-over-day progress** - Composite scores, streaks, and milestones tracked automatically.
- **Inline dashboard** - Score summary, dimension breakdown, and sparklines in the chat window. No browser needed.
- **Cross-project coverage** - One command covers all active projects with per-project breakdowns.
- **Pattern detection** - Recurring weaknesses flagged every session until they improve.
- **Zero-friction install** - Two commands. Self-configures on first session start.
- **Safe upgrades** - Data auto-migrated on version updates. Backup taken before; rollback on failure.
- **Private by default** - All data in `~/prompt-analysis/` on your machine. Never enters your repos.
- **Anchored to Anthropic's docs** - Scoring rubric sourced from official prompting guidelines; refreshed every 15 days.

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## Installation

> **Requires**: Claude Code (any version that supports plugins)

### Install

Run these two commands inside Claude Code:

```
/plugin marketplace add sahaarijit/claude-prompt-analyzer#main
```

```
/plugin install prompt-analyzer@prompt-analyzer-marketplace
```

Then **restart Claude Code**. The plugin configures itself on the first new session - no further steps.

### Upgrade from v1.x

Run the same two install commands above. Your existing prompt history at `~/prompt-analysis/` is preserved and automatically migrated to the new format. Legacy files from the old manual install (in `~/.claude/`) are cleaned up automatically on first session.

> You do **not** need to manually delete anything.

### Uninstall

If installed at **user level** (default):

```
/plugin uninstall prompt-analyzer@prompt-analyzer-marketplace --scope user
```

If installed at **project level**:

```
/plugin uninstall prompt-analyzer@prompt-analyzer-marketplace
```

> Your data at `~/prompt-analysis/` is **not** deleted. Remove that folder manually if you want a clean slate.

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## How to Use

| Command | What it does |
|---|---|
| `/prompt-analyzer:analyze` | Analyze today's prompts across all projects; shows inline dashboard |
| `/prompt-analyzer:view` | Reopen the latest report without re-running analysis |
| `/prompt-analyzer:view trend` | Show 7-day composite score trend |
| `/prompt-analyzer:view 22-04-2026` | View the report for a specific date (`DD-MM-YYYY`) |

### Example: Running an analysis

```
/prompt-analyzer:analyze
```

```
Day: 22-04-2026 | Projects: 3 | Prompts: 18 | Composite: 7.1/10 ↑ (+0.6 vs yesterday) | Streak: 3 days

Dimensions
  Clarity         ████████░░  8.2     Specificity     ██████░░░░  6.1
  Context-giving  ████████░░  8.0     Actionability   ███████░░░  7.3
  Scope control   ███████░░░  7.1     Command usage   ████████░░  7.8
  Pattern eff.    ██████░░░░  6.4     Interaction     ████████░░  7.9
  Friction avoid  ███████░░░  7.2     Automation aw.  █████░░░░░  5.9

↑ Top improvement this week: context-giving (+1.4 pts)
⚠ Recurring gap: vague prompts - 4 today, 19 this week. Add scope + expected outcome.

Top prompt today (9.1/10):  "Refactor the auth middleware to use..."
Weakest today   (2.8/10):   "fix it"
```

### Example: Viewing past reports

```
/prompt-analyzer:view trend
```

```
7-day trend  Mon ▄ Tue ▅ Wed ▃ Thu ▆ Fri ▇ Sat ▄ Sun █
Composite:   6.1  6.4  5.9  6.8  7.0  6.3  7.1    ↑ +1.0 this week
```

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## How It Works

```mermaid
flowchart TD
    A["You type a prompt in Claude Code"] --> B["Capture Hook fires automatically"]
    B --> C["Prompt saved to ~/prompt-analysis/<project>/"]
    C --> D["You run /prompt-analyzer:analyze"]
    D --> E["Pre-processor computes\nmetrics & classifications"]
    E --> F["LLM scores against\n10-dimension rubric\n(sourced from Anthropic docs)"]
    F --> G["Scores stored locally\n(history, trends, streaks)"]
    F --> H["Inline dashboard\nrenders in Claude Code"]
    H --> I["Revisit anytime with\n/prompt-analyzer:view"]
```

**Storage layout** (all local, all yours):

```
~/prompt-analysis/
  <your-project>/
    prompts/
      22-04-2026/
        prompts.md        ← your raw prompts
        metrics.json      ← pre-computed stats
  reports/
    22-04-2026/
      analysis.md         ← full written report
    state.json            ← scores, history, learned patterns
    rubric-cache.json     ← cached Anthropic rubric (15-day TTL)
```

