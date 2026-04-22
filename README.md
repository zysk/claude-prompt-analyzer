<h1 align="center">Claude Prompt Analyzer</h1>

<p align="center">
  <img src="assets/claude-jumping.svg" alt="Claude jumping mascot" width="120" height="100">
</p>

<p align="center">
  <strong>A Claude Code tool that makes you measurably better at prompting.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.0-blue" alt="v1.3.0">
  <img src="https://img.shields.io/badge/platform-Claude%20Code-orange" alt="Claude Code">
  <img src="https://img.shields.io/badge/dependencies-zero-brightgreen" alt="zero dependencies">
</p>

> **Note:** This is the frozen v1.3 release branch. The latest version is [v2.0.0](https://github.com/sahaarijit/claude-prompt-analyzer).

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## Features

- **Auto-capture** - Every prompt you type is silently logged. No setup, no opt-in per project.
- **10-dimension scoring** - Clarity, specificity, context-giving, actionability, scope, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness.
- **Cross-project coverage** - One command covers all active projects with per-project breakdowns.
- **Day-over-day progress** - Composite scores, streaks, and milestones tracked automatically.
- **Progressive reports** - Each report checks whether you acted on the previous session's feedback.
- **Run from anywhere** - Works regardless of which directory you're in.
- **Safe upgrades** - Data auto-migrated on version updates. Backup taken before; rollback on failure.
- **Anchored to Anthropic's docs** - Scoring rubric sourced from official prompting guidelines; refreshed every 15 days.
- **Self-improving classification** - Classification accuracy improves over time from LLM feedback.
- **One-command setup** - Deploy script installs everything in one step.

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## Installation

**Prerequisites:** Node.js >= 16, Claude Code

```bash
git clone https://github.com/sahaarijit/claude-prompt-analyzer.git
cd claude-prompt-analyzer
git checkout v1.3
node scripts/deploy.js
```

Then restart Claude Code.

### Upgrade from v1.x

```bash
git pull
node scripts/deploy.js
```

Your prompt history is preserved. Data is auto-migrated to the new format.

### Uninstall

```bash
rm ~/.claude/hooks/capture-prompts.js
rm -rf ~/.claude/skills/prompt-analyze/
```
Remove the hook entry from `~/.claude/settings.json` manually.

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## How to Use

| Command | What it does |
|---|---|
| `/prompt-analyze` | Analyze today's prompts across all projects; shows scored report |

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## How It Works

```mermaid
flowchart TD
    A["You type a prompt in Claude Code"] --> B["Capture Hook fires automatically"]
    B --> C["Prompt saved to ~/prompt-analysis/<project>/"]
    C --> D["You run /prompt-analyze (from anywhere)"]
    D --> E["Pre-processor computes\nmetrics & classifications"]
    E --> F["LLM scores against\n10-dimension rubric\n(sourced from Anthropic docs)"]
    F --> G["Scores stored locally\n(history, trends, streaks)"]
    F --> H["Unified report covers\nall active projects"]
```

