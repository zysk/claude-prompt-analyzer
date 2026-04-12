# Claude Prompt Analyzer

A self-improving prompt quality analysis system for Claude Code. Automatically captures your prompts and analyzes them to help you write better prompts every day.

## Features

- **Auto-capture**: Every prompt you type in Claude Code is logged to day-wise markdown files
- **On-demand analysis**: Run `/prompt-analyze` to get detailed feedback on your prompt quality
- **10-dimension scoring**: Clarity, specificity, scope, context-giving, actionability, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness
- **Day-over-day tracking**: Scores, trends, streaks, and milestones
- **Self-improving**: Classification accuracy improves over time based on LLM feedback
- **Privacy-conscious**: Raw prompts are gitignored; only analysis results are tracked
- **Multi-user safe**: Each user gets their own scoped folder
- **Best practices anchored**: Quality standards fetched from latest Anthropic docs at runtime

## Quick Start

```bash
git clone <repo-url>
cd claude-prompt-analyzer
node scripts/deploy.js
```

That's it. Your prompts will be captured in every project you work on.

## Usage

1. **Work normally** in Claude Code. Prompts are captured automatically.
2. **Run `/prompt-analyze`** whenever you want feedback.
3. **Review** `analysis.md` for detailed feedback or open `report.html` for visual dashboard.

## How It Works

```
You type a prompt
       |
       v
Capture Hook (automatic) --> docs/prompt-analyzer/<user>/<date>/prompts.md
       |
You run /prompt-analyze
       |
       v
Pre-Processor --> metrics.json (stats, classifications)
       |
       v
LLM Analysis --> analysis.md + report.html + scores.json
```

## Project Structure

```
hooks/
  capture-prompts.js        # Capture hook (UserPromptSubmit)
skills/
  prompt-analyze/
    SKILL.md                # Analysis skill (/prompt-analyze)
    analyzer.js             # Pre-processor (metrics computation)
scripts/
  deploy.js                 # One-command setup/uninstall
```

## Per-Project Output

```
<your-project>/docs/prompt-analyzer/
  .gitignore                # Auto-created; ignores prompts.md + metrics.json
  <username>/
    meta.json               # Analysis state
    scores.json             # Rolling scores + trends
    corrections.json        # Classification feedback loop
    learned-rules.json      # User-specific patterns
    DD-MM-YYYY/
      prompts.md            # Raw captures (gitignored)
      metrics.json          # Pre-processed stats (gitignored)
      analysis.md           # LLM analysis (tracked)
      report.html           # Visual dashboard (tracked)
```

## Uninstall

```bash
node scripts/deploy.js --uninstall
```

Removes hook and skill files. Existing captures in projects are untouched.

## Requirements

- Node.js >= 16
- Git (with `user.name` configured)
- Claude Code
