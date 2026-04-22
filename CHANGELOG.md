# Changelog

All notable changes to Claude Prompt Analyzer are documented here.

---

## [1.3.0] — 2026-04-14

> **Auto-migration and stability.**

### ✨ New Features

- **Auto-migration framework** — version upgrades automatically migrate your data. A backup is taken before each migration; on failure, the original data is fully restored and the upgrade is aborted cleanly.
- **Run from any directory** — `/prompt-analyze` now works regardless of where you are in your terminal. Scans all your tracked projects automatically.
- **Live rubric from Anthropic docs** — the 10-dimension scoring rubric is fetched from official Anthropic prompting guidelines at runtime and cached locally for 15 days.

### 🔧 Improvements

- Stable project detection — if you `cd` into a subfolder mid-session, the project name stays consistent. No duplicate entries, no orphaned data.

---

## [1.2.0] — 2026-04-14

> **Cross-project analysis.**

### ✨ New Features

- **Unified daily reports** — one report per day covering all active projects with per-project breakdowns and cross-project patterns.
- **Project auto-discovery** — no manual registration needed.
- **Progressive reports** — each report references the previous one and checks whether you acted on the feedback.
- **Cross-project patterns** — see which projects have your strongest and weakest prompting habits.

### 🔧 Improvements

- All prompt data centralized at `~/prompt-analysis/` — outside your project repos, never committed.
- Removed per-user subfolder.

---

## [1.1.0] — 2026-04-13

> **Simpler naming, centralized storage.**

### ✨ New Features

- **Centralized prompt storage** — prompts moved to `~/prompt-analysis/`. Data survives repo changes.
- **Version display on deploy** — shows the version change on install/update.

### 🔧 Improvements

- Simplified project names — folder name only, no git username prefix.

---

## [1.0.0] — 2026-04-13

> **Initial release.**

### ✨ New Features

- **Automatic prompt capture** — `UserPromptSubmit` hook logs every prompt to day-organized markdown files.
- **Pre-processor** — classifies and measures prompts deterministically before LLM analysis.
- **`/prompt-analyze` skill** — on-demand LLM analysis scoring across 10 dimensions.
- **Day-over-day score tracking** — composite scores, streaks, milestones.
- **Self-improving classification** — corrections feed back into future sessions.
- **One-command deploy** — deploy script installs everything into `~/.claude/` in one step.
