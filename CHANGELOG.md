# Changelog

All notable changes to Claude Prompt Analyzer are documented here.

---

## [2.0.1] - 2026-04-22

> **Slash-command fix + command-behavior hardening.** Resolves the v2.0.0 issue where commands were not namespaced and removes the interactive friction from the analyze / view flow.

### 🐛 Bug Fixes

- **Slash commands now properly namespaced** - plugin entries moved from the `skills/` directory (which registered them as flat `/analyze` and `/view` names) to the `commands/` directory, following the Claude Code convention used by other plugins. You will now see `/prompt-analyzer:analyze` and `/prompt-analyzer:view` exactly as the docs describe.
- **Invalid `skills` field dropped from `plugin.json`** - the previous `"skills": "./skills/"` string caused Claude Code to silently ignore the entries. The field is no longer present; Claude Code auto-discovers `commands/` on load.
- **Upgrade path from v2.0.0** - session-init now recognizes v2.0.0 as a supported prior version and runs the v2.0 to v2.0.1 migration cleanly.
- **Security-hook friction on HTML write** - the generated HTML no longer uses the HTML-string DOM property. Report scripts now use `textContent`, `createElement`, and embed data via `<script type="application/json">`, satisfying security-oriented PreToolUse hooks.

### 🔧 Improvements

- **Shared pre-processor location** - the `analyzer.js` helper moved from `skills/analyze/analyzer.js` to `scripts/analyzer.js` so it can be referenced from any command without a skill-specific path.
- **Non-interactive execution** - `analyze` and `view` no longer ask the user "which dates?" or "which rubric source?". `analyze` processes every unanalyzed date sequentially, oldest first, on every run. `view` resolves arguments without confirmation prompts.
- **Tighter rubric cache TTL** - the cached rubric at `reports/rubric-cache.json` now expires after **3 days** (down from 15). Live rubric fetch remains the mandatory first tier; cache is the fallback when live fails; baseline is the last resort.
- **Consolidated HTML is the default artifact** - `analyze` now writes a single `reports/consolidated.html` that is refreshed on every run. It reflects scores, trends, streaks, milestones, recurring patterns, and a date index using `state.json` as the source of truth. No more flipping through many per-date HTML files to see overall progress.
- **Per-date HTML is now lazy** - `reports/{DD-MM-YYYY}/report.html` is generated on demand when you run `/prompt-analyzer:view DD-MM-YYYY` for that specific date, and reused after. `analyze` itself no longer writes per-date HTML (it still writes per-date `analysis.md`).
- **Improved README uninstall section** - documents both user- and project-scope uninstall commands with a manual cleanup fallback, including the less-known marketplace cache files.
- **README `How to Use` table expanded** - every `/prompt-analyzer:view` invocation form is now listed with what it does.

### ⚠️ User Action Required

If you installed v2.0.0 and the slash commands never appeared, reinstall from the marketplace:

```
/plugin uninstall prompt-analyzer@prompt-analyzer-marketplace --scope user
/plugin marketplace add zysk/claude-prompt-analyzer#main
/plugin install prompt-analyzer@prompt-analyzer-marketplace
/reload-plugins
```

Your data at `~/prompt-analysis/` is preserved and auto-migrated.

---

## [2.0.0] - 2026-04-22

> **Plugin system conversion.** Claude Prompt Analyzer is now a native Claude Code plugin - installable in two commands, no scripts, no manual file copying.

### ✨ New Features

- **Native plugin install** - two `/plugin` commands replaces the old deploy script. Works on any machine with Claude Code.
- **`/prompt-analyzer:view` skill** - reopen any past report without re-running analysis. Supports `latest`, `trend`, `yesterday`, and specific dates (`DD-MM-YYYY`).
- **7-day trend view** - `/prompt-analyzer:view trend` shows a Unicode sparkline of your composite score across the past week at a glance.
- **Inline chat dashboard** - the analysis result renders fully inside your Claude Code session. No browser, no HTML file to open.
- **Auto-migration on upgrade** - upgrading from v1.2 or v1.3 triggers a silent, safe data migration on your first session. Backup is taken before; if anything fails, it rolls back automatically.
- **Legacy auto-cleanup** - old manual-install files (`~/.claude/hooks/capture-prompts.js`, `~/.claude/skills/prompt-analyze/`) are detected and removed automatically on first session after plugin install.

### 🔧 Improvements

- Plugin version is now tracked automatically. You never need to touch a version file manually.
- Session initialization is safer and more resilient - hook always exits cleanly regardless of what happens during setup.
- Install is fully reproducible across machines - no environment-specific deploy steps.

### ⚠️ Breaking Changes

| Old command (v1.x) | New command (v2.0) |
|---|---|
| `/prompt-analyze` | `/prompt-analyzer:analyze` |
| `/prompt-view` | `/prompt-analyzer:view` |

> **Upgrading from v1.x?** Run the two `/plugin` install commands. Your prompt history is fully preserved. The old commands stop working once the plugin replaces the legacy hooks.

---

## [1.3.0] - 2026-04-14

> **Auto-migration and stability.** This release made the tool safe to update and reliable across directory changes.

### ✨ New Features

- **Auto-migration framework** - version upgrades automatically migrate your data. A backup is taken before each migration; on failure, the original data is fully restored and the upgrade is aborted cleanly.
- **Run from any directory** - `/prompt-analyze` now works regardless of where you are in your terminal. Scans all your tracked projects automatically; no need to be in a project root.
- **Live rubric from Anthropic docs** - the 10-dimension scoring rubric is fetched from official Anthropic prompting guidelines at runtime and cached locally for 15 days. Your scores stay grounded in what Anthropic currently recommends.

### 🔧 Improvements

- Stable project detection - if you `cd` into a subfolder mid-session, the project name stays consistent. No duplicate entries, no orphaned data.

---

## [1.2.0] - 2026-04-14

> **Cross-project analysis.** Reports now cover all your active projects in one shot.

### ✨ New Features

- **Unified daily reports** - one report per day covering all active projects with per-project breakdowns and cross-project patterns. Previously, each project got its own separate report.
- **Project auto-discovery** - no manual registration needed. The tool discovers your projects automatically by scanning `~/prompt-analysis/`.
- **Progressive reports** - each report references the previous one and checks whether you acted on the feedback. Recurring patterns get flagged until they improve.
- **Cross-project patterns** - see which projects have your strongest and weakest prompting habits.

### 🔧 Improvements

- All prompt data now lives at `~/prompt-analysis/` - centralized, outside your project repos, never committed. Previously data was scattered in `docs/prompt-analyzer/` inside each project.
- Removed per-user subfolder - `~/prompt-analysis/` is already per-user (home directory), so the extra nesting was removed.

---

## [1.1.0] - 2026-04-13

> **Simpler naming, centralized storage.** First iteration of the centralized data model.

### ✨ New Features

- **Centralized prompt storage** - prompts moved from inside project directories to `~/prompt-analysis/`. Data survives repo clones, deletes, and renames.
- **Version display on deploy** - running the deploy/update script shows the version change (e.g., `1.0.0 → 1.1.0`) so you always know what you're installing.

### 🔧 Improvements

- Simplified project names - projects are identified by folder name only (e.g., `my-app`), not `username/my-app`. Cleaner folder names, no git dependency for naming.

---

## [1.0.0] - 2026-04-13

> **Initial release.** The three-component system: capture, analyze, report.

### ✨ New Features

- **Automatic prompt capture** - a `UserPromptSubmit` hook silently logs every prompt you type in Claude Code to day-organized markdown files, per project.
- **Pre-processor** - before LLM analysis, each session's prompts are classified and measured deterministically: word count, prompt type (`context-rich`, `imperative`, `question`, `vague`, `single-word`), and basic stats.
- **`/prompt-analyze` skill** - on-demand LLM analysis scores your prompts across 10 dimensions: clarity, specificity, context-giving, actionability, scope control, command usage, pattern efficiency, interaction style, friction avoidance, automation awareness.
- **Day-over-day score tracking** - composite scores stored per day. Track streaks, milestones, and dimension-level trends over time.
- **Self-improving classification** - the LLM can correct classification labels during analysis. Those corrections feed back into future sessions, improving classification accuracy over time.
- **One-command deploy** - a deploy script installs everything into `~/.claude/` in one step. No manual file copying.
