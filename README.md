<h1 align="center">Claude Prompt Analyzer</h1>

<p align="center">
  <img src="assets/claude-jumping.svg" alt="Claude jumping mascot" width="120" height="100">
</p>

<p align="center">
  <strong>A Claude Code tool that makes you measurably better at prompting.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-blue" alt="v1.1.0">
  <img src="https://img.shields.io/badge/platform-Claude%20Code-orange" alt="Claude Code">
  <img src="https://img.shields.io/badge/dependencies-zero-brightgreen" alt="zero dependencies">
</p>

> **Note:** This is the frozen v1.1 release branch. The latest version is [v2.0.0](https://github.com/sahaarijit/claude-prompt-analyzer).

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## Features

- **Auto-capture** — Every prompt you type is silently logged. No setup, no opt-in per project.
- **10-dimension scoring** — Clarity, specificity, context-giving, actionability, scope, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness.
- **Day-over-day progress** — Composite scores, streaks, and milestones tracked automatically.
- **Centralized storage** — All data in `~/prompt-analysis/` — outside your repos, survives repo changes.
- **Self-improving classification** — Classification accuracy improves over time from LLM feedback.
- **One-command setup** — Deploy script installs everything in one step.

---

<p align="center">
  <img src="assets/claude-jumping.svg" alt="divider" width="60" height="50">
</p>

## Installation

**Prerequisites:** Node.js >= 16, Claude Code

Clone the repository and run the deploy script:

```bash
git clone https://github.com/sahaarijit/claude-prompt-analyzer.git
cd claude-prompt-analyzer
git checkout v1.1
node scripts/deploy.js
```

Then restart Claude Code.

### Upgrade from v1.0

```bash
git pull
node scripts/deploy.js
```

The deploy script detects your current version and shows the version change (`1.0.0 → 1.1.0`).

### Uninstall

Delete the installed files from `~/.claude/`:
```bash
rm ~/.claude/hooks/capture-prompts.js
rm -rf ~/.claude/skills/prompt-analyze/
```
And remove the hook entry from `~/.claude/settings.json` manually.

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
    C --> D["You run /prompt-analyze"]
    D --> E["Pre-processor computes\nmetrics & classifications"]
    E --> F["LLM scores against\n10-dimension rubric"]
    F --> G["Scores stored per day\n(history, streaks, milestones)"]
    F --> H["Report displayed\nin Claude Code"]
```

