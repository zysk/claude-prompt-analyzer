# Changelog

All notable changes to Claude Prompt Analyzer are documented here.
Format inspired by [VS Code release notes](https://code.visualstudio.com/updates).

---

## [1.2.0] — 2026-04-14

> **Cross-project analysis.** Reports now cover all your active projects in one shot.

### ✨ New Features

- **Unified daily reports** — one report per day covering all active projects with per-project breakdowns and cross-project patterns. Previously, each project got its own separate report.
- **Project auto-discovery** — no manual registration needed. The tool discovers your projects automatically by scanning `~/prompt-analysis/`.
- **Progressive reports** — each report references the previous one and checks whether you acted on the feedback. Recurring patterns get flagged until they improve.
- **Cross-project patterns** — see which projects have your strongest and weakest prompting habits.

### 🔧 Improvements

- All prompt data now lives at `~/prompt-analysis/` — centralized, outside your project repos, never committed. Previously data was scattered in `docs/prompt-analyzer/` inside each project.
- Removed per-user subfolder — `~/prompt-analysis/` is already per-user (home directory), so the extra nesting was removed.

---

## [1.1.0] — 2026-04-13

> **Simpler naming, centralized storage.**

### ✨ New Features

- **Centralized prompt storage** — prompts moved from inside project directories to `~/prompt-analysis/`. Data survives repo clones, deletes, and renames.
- **Version display on deploy** — running the deploy/update script shows the version change (e.g., `1.0.0 → 1.1.0`).

### 🔧 Improvements

- Simplified project names — folder name only (e.g., `my-app`), not `username/my-app`.

---

## [1.0.0] — 2026-04-13

> **Initial release.**

### ✨ New Features

- **Automatic prompt capture** — `UserPromptSubmit` hook logs every prompt to day-organized markdown files, per project.
- **Pre-processor** — classifies and measures prompts deterministically before LLM analysis.
- **`/prompt-analyze` skill** — on-demand LLM analysis scoring across 10 dimensions.
- **Day-over-day score tracking** — composite scores, streaks, milestones.
- **Self-improving classification** — corrections feed back into future sessions.
- **One-command deploy** — deploy script installs everything into `~/.claude/` in one step.
