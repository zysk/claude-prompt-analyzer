# Claude Prompt Analyzer

**Current version: 1.3.0**

A self-improving prompt quality analysis system for Claude Code. Automatically captures your prompts and analyzes them to help you write better prompts every day.

## Features

- **Auto-capture**: Every prompt you type in Claude Code is logged to day-wise markdown files
- **On-demand analysis**: Run `/prompt-analyze` to get detailed feedback on your prompt quality
- **10-dimension scoring**: Clarity, specificity, scope, context-giving, actionability, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness
- **Day-over-day tracking**: Scores, trends, streaks, and milestones
- **Self-improving**: Classification accuracy improves over time based on LLM feedback
- **Centralized storage**: All prompts stored in `~/prompt-analysis/`, organized by project
- **Run from anywhere**: `/prompt-analyze` works from any directory; scans all projects
- **Progressive reports**: Each report builds on the last; tracks whether you acted on feedback
- **Version-aware**: Deploy script detects and shows version changes on update
- **Auto-migration**: Data migrates safely across versions; backup + rollback on failure
- **Best practices anchored**: Quality standards fetched live from Anthropic docs at runtime (cached 15 days)

## Installation

> **Note:** Exact install command depends on marketplace registration. The formats below reflect the Claude Code plugin system; verify the registered marketplace name before publishing docs.

In Claude Code (once listed in a plugin marketplace):

```
/plugin install prompt-analyzer@<marketplace-name>
```

Or for direct GitHub install (if supported):

```
/plugin install github:sahaarijit/claude-prompt-analyzer
```

Then start a new Claude Code session. The plugin configures itself automatically on first session start.

> **Upgrading from v1.x?** The plugin automatically removes legacy files from `~/.claude/` on the first session after install. Your prompt history at `~/prompt-analysis/` is never deleted.

## Usage

| Command | Description |
|---------|-------------|
| `/prompt-analyzer:analyze` | Analyze captured prompts; shows inline dashboard |
| `/prompt-analyzer:view` | View latest report without re-running analysis |
| `/prompt-analyzer:view trend` | Show 7-day composite score trend |
| `/prompt-analyzer:view <DD-MM-YYYY>` | View report for a specific date |

## Breaking Change (v1.x → v2.0)

`/prompt-analyze` has been renamed to `/prompt-analyzer:analyze`.

## How It Works

```
You type a prompt
       |
       v
Capture Hook (automatic) --> ~/prompt-analysis/<project>/prompts/<date>/prompts.md
       |
You run /prompt-analyze
       |
       v
Pre-Processor --> metrics.json (stats, classifications)
       |
       v
LLM Analysis --> analysis.md + report.html + scores.json
```

## Centralized Output

All data is stored in your home directory under `~/prompt-analysis/`, organized by project:

```
~/prompt-analysis/
  <project-a>/
    prompts/                  # Raw captured data (per project)
      DD-MM-YYYY/
        prompts.md
        metrics.json
  <project-b>/
    prompts/
      DD-MM-YYYY/
        prompts.md
        metrics.json
  reports/                    # Unified analysis output (all projects)
    DD-MM-YYYY/
      analysis.md             # Consolidated report covering all projects
      report.html             # Visual dashboard
    state.json                # Unified state: meta, scores, corrections, learnedRules
    rubric-cache.json         # Cached prompting rubric (15-day TTL)
```

Prompts are captured per-project. Reports are unified; one report per date covering all active projects with per-project breakdowns and cross-project patterns. Projects are auto-discovered via directory scan.

