# Claude Prompt Analyzer

**Current version: 1.1.0**

A self-improving prompt quality analysis system for Claude Code. Automatically captures your prompts and analyzes them to help you write better prompts every day.

## Features

- **Auto-capture**: Every prompt you type in Claude Code is logged to day-wise markdown files
- **On-demand analysis**: Run `/prompt-analyze` to get detailed feedback on your prompt quality
- **10-dimension scoring**: Clarity, specificity, scope, context-giving, actionability, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness
- **Day-over-day tracking**: Scores, trends, streaks, and milestones
- **Self-improving**: Classification accuracy improves over time based on LLM feedback
- **Centralized storage**: All prompts stored in `~/prompt-analysis/`, organized by project
- **Version-aware**: Deploy script detects and shows version changes on update
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
Capture Hook (automatic) --> ~/prompt-analysis/<project>/<user>/<date>/prompts.md
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

## Centralized Output

All data is stored in your home directory under `~/prompt-analysis/`, organized by project:

```
~/prompt-analysis/
  projects.json               # Maps project names to their full paths
  <project-name>/
    <username>/
      meta.json               # Analysis state
      scores.json             # Rolling scores + trends
      corrections.json        # Classification feedback loop
      learned-rules.json      # User-specific patterns
      DD-MM-YYYY/
        prompts.md            # Raw captures
        metrics.json          # Pre-processed stats
        analysis.md           # LLM analysis
        report.html           # Visual dashboard
```

This makes it easy to review prompts across all projects from one location.

## Updating

When a new version is available, pull the latest changes and re-run the deploy script:

```bash
cd claude-prompt-analyzer
git pull
node scripts/deploy.js
```

The deploy script will show the version change (e.g., `Updating v1.0.0 -> v1.1.0`) and overwrite deployed files. Existing captured data is never touched.

## Uninstall

```bash
node scripts/deploy.js --uninstall
```

Removes hook and skill files. Existing captures in `~/prompt-analysis/` are untouched.

## Prerequisites

Before running `deploy.js`, ensure the following are set up:

1. **Node.js >= 16** - [Download](https://nodejs.org/)
   ```bash
   node --version   # must be v16+
   ```

2. **Git** with `user.name` configured
   ```bash
   git --version
   git config --global user.name "Your Name"   # if not already set
   ```

3. **Claude Code** installed and initialized
   - The `~/.claude/` directory must exist (created on first Claude Code run)
   - Install: https://docs.anthropic.com/en/docs/claude-code

The deploy script checks all three and will error or warn if anything is missing.
