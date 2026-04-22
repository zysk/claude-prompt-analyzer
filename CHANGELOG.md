# Changelog

All notable changes to Claude Prompt Analyzer are documented here.

---

## [1.0.0] — 2026-04-13

> **Initial release.** The three-component system: capture, analyze, report.

### ✨ New Features

- **Automatic prompt capture** — a `UserPromptSubmit` hook silently logs every prompt you type in Claude Code to day-organized markdown files, per project.
- **Pre-processor** — before LLM analysis, each session's prompts are classified and measured deterministically: word count, prompt type (`context-rich`, `imperative`, `question`, `vague`, `single-word`), and basic stats.
- **`/prompt-analyze` skill** — on-demand LLM analysis scores your prompts across 10 dimensions: clarity, specificity, context-giving, actionability, scope control, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness.
- **Day-over-day score tracking** — composite scores stored per day. Track streaks, milestones, and dimension-level trends over time.
- **Self-improving classification** — the LLM can correct classification labels during analysis. Those corrections feed back into future sessions, improving classification accuracy over time.
- **One-command deploy** — a deploy script installs everything into `~/.claude/` in one step. No manual file copying.
