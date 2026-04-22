# Changelog

All notable changes to Claude Prompt Analyzer are documented here.

---

## [2.0.0] — 2026-04-22

> **Plugin system conversion.** Claude Prompt Analyzer is now a native Claude Code plugin — installable in two commands, no scripts, no manual file copying.

### ✨ New Features

- **Native plugin install** — two `/plugin` commands replaces the old deploy script. Works on any machine with Claude Code.
- **`/prompt-analyzer:view` skill** — reopen any past report without re-running analysis. Supports `latest`, `trend`, `yesterday`, and specific dates (`DD-MM-YYYY`).
- **7-day trend view** — `/prompt-analyzer:view trend` shows a Unicode sparkline of your composite score across the past week at a glance.
- **Inline chat dashboard** — the analysis result renders fully inside your Claude Code session. No browser, no HTML file to open.
- **Auto-migration on upgrade** — upgrading from v1.2 or v1.3 triggers a silent, safe data migration on your first session. Backup is taken before; if anything fails, it rolls back automatically.
- **Legacy auto-cleanup** — old manual-install files (`~/.claude/hooks/capture-prompts.js`, `~/.claude/skills/prompt-analyze/`) are detected and removed automatically on first session after plugin install.

### 🔧 Improvements

- Plugin version is now tracked automatically. You never need to touch a version file manually.
- Session initialization is safer and more resilient — hook always exits cleanly regardless of what happens during setup.
- Install is fully reproducible across machines — no environment-specific deploy steps.

### ⚠️ Breaking Changes

| Old command (v1.x) | New command (v2.0) |
|---|---|
| `/prompt-analyze` | `/prompt-analyzer:analyze` |
| `/prompt-view` | `/prompt-analyzer:view` |

> **Upgrading from v1.x?** Run the two `/plugin` install commands. Your prompt history is fully preserved. The old commands stop working once the plugin replaces the legacy hooks.

---

## [1.3.0] — 2026-04-14

> **Auto-migration and stability.** This release made the tool safe to update and reliable across directory changes.

### ✨ New Features

- **Auto-migration framework** — version upgrades automatically migrate your data. A backup is taken before each migration; on failure, the original data is fully restored and the upgrade is aborted cleanly.
- **Run from any directory** — `/prompt-analyze` now works regardless of where you are in your terminal. Scans all your tracked projects automatically; no need to be in a project root.
- **Live rubric from Anthropic docs** — the 10-dimension scoring rubric is fetched from official Anthropic prompting guidelines at runtime and cached locally for 15 days. Your scores stay grounded in what Anthropic currently recommends.

### 🔧 Improvements

- Stable project detection — if you `cd` into a subfolder mid-session, the project name stays consistent. No duplicate entries, no orphaned data.

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

> **Simpler naming, centralized storage.** First iteration of the centralized data model.

### ✨ New Features

- **Centralized prompt storage** — prompts moved from inside project directories to `~/prompt-analysis/`. Data survives repo clones, deletes, and renames.
- **Version display on deploy** — running the deploy/update script shows the version change (e.g., `1.0.0 → 1.1.0`) so you always know what you're installing.

### 🔧 Improvements

- Simplified project names — projects are identified by folder name only (e.g., `my-app`), not `username/my-app`. Cleaner folder names, no git dependency for naming.

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
