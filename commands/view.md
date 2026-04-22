---
description: "Reopen an existing prompt analysis report. Zero LLM cost. Supports: latest, today, yesterday, DD-MM-YYYY, and trend."
---

Reopen an existing analysis report. Do NOT re-run analysis. Do NOT write to state.json or any data file. This command is strictly read-only.

**Invocations:**
- `/prompt-analyzer:view` - most recent date in `~/prompt-analysis/reports/`
- `/prompt-analyzer:view today` - today in DD-MM-YYYY
- `/prompt-analyzer:view yesterday` - yesterday in DD-MM-YYYY
- `/prompt-analyzer:view <DD-MM-YYYY>` - explicit date, e.g., `21-04-2026`
- `/prompt-analyzer:view trend` - 7-day composite history inline; no file link

---

## Step 1: Resolve target date

Run the following, replacing `<ARGUMENT>` with everything after `/prompt-analyzer:view` (empty string for bare invocation).

Note: with `node -e "..." -- arg`, the argument lands at `process.argv[2]` (index 2), not 1.

```bash
node -e "
const fs = require('fs'), path = require('path'), os = require('os');
const arg = (process.argv[2] || '').trim();
const reportsDir = path.join(os.homedir(), 'prompt-analysis', 'reports');
function fmt(d) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return dd + '-' + mm + '-' + d.getFullYear();
}
let target;
if (!arg || arg === 'latest') {
  const dirs = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir)
        .filter(n => /^\d{2}-\d{2}-\d{4}$/.test(n) &&
          fs.existsSync(path.join(reportsDir, n, 'analysis.md')))
        .sort()
    : [];
  target = dirs.length ? dirs[dirs.length - 1] : null;
} else if (arg === 'today') {
  target = fmt(new Date());
} else if (arg === 'yesterday') {
  target = fmt(new Date(Date.now() - 86400000));
} else if (arg === 'trend') {
  target = 'trend';
} else if (/^\d{2}-\d{2}-\d{4}$/.test(arg)) {
  target = arg;
} else {
  target = null;
}
console.log(target || 'NONE');
" -- <ARGUMENT>
```

- Output `NONE`: print `No analysis yet. Run /prompt-analyzer:analyze first.` and stop.
- Output `trend`: proceed to Step 2.
- Anything else: that is `targetDate`; proceed to Step 3.

---

## Step 2: Trend view (only when argument is "trend")

Read `~/prompt-analysis/reports/state.json`. Extract `scores.dailyScores` - last 7 entries sorted ascending.

For each entry, build a 5-score trailing sparkline using the last 5 scores up to that entry; left-pad with `▁` if fewer than 5 available. Map each score with `Math.round((S / 10) * 7)` -> index into `['▁','▂','▃','▄','▅','▆','▇','█']`.

Print:
```
### 📈 7-Day Composite Score Trend

| Date         | Score | Trend       |
|--------------|-------|-------------|
| DD-MM-YYYY   | X.X   | ▁▂▃▄▅ →     |
| ...          | ...   | ...         |

7-day average: X.X/10
```

Then stop - do not proceed to Steps 3-4.

---

## Step 3: Verify report exists for targetDate

```bash
node -e "
const fs = require('fs'), path = require('path'), os = require('os');
const date = '<targetDate>';
const reportDir = path.join(os.homedir(), 'prompt-analysis', 'reports', date);
const mdExists = fs.existsSync(path.join(reportDir, 'analysis.md'));
const htmlExists = fs.existsSync(path.join(reportDir, 'report.html'));
console.log(JSON.stringify({ mdExists, htmlExists, reportDir }));
"
```

If `mdExists` is false, find nearest available dates:
```bash
node -e "
const fs = require('fs'), path = require('path'), os = require('os');
const target = '<targetDate>';
const reportsDir = path.join(os.homedir(), 'prompt-analysis', 'reports');
const dirs = fs.existsSync(reportsDir)
  ? fs.readdirSync(reportsDir)
      .filter(n => /^\d{2}-\d{2}-\d{4}$/.test(n) &&
        fs.existsSync(path.join(reportsDir, n, 'analysis.md')))
      .sort()
  : [];
const before = dirs.filter(d => d < target);
const after  = dirs.filter(d => d > target);
console.log('prev:', before.length ? before[before.length - 1] : 'none');
console.log('next:', after.length  ? after[0]                  : 'none');
"
```
Print: `No report for <targetDate>. Nearest: <prev-date>, <next-date>.` (omit the side that is `none`). Then stop.

---

## Step 4: Read and emit dashboard

Read `~/prompt-analysis/reports/<targetDate>/analysis.md` using the Read tool.

Read `~/prompt-analysis/reports/state.json` to get `scores.dailyScores` for sparklines (last 5 entries up to and including `<targetDate>`).

Emit the same inline dashboard as `/prompt-analyzer:analyze` Step 5b using data from analysis.md:

```
### 📊 Prompt Analysis - <targetDate>

**Composite score**: <composite>/10  <trend-arrow><delta as +0.0 or -0.0>  (<streak>-day streak at 7.0+)

| Dimension            | Score  | 5-day trend         |
|----------------------|--------|---------------------|
| Clarity              | <X>/10 | <sparkline> <arrow> |
| Specificity          | <X>/10 | <sparkline> <arrow> |
| Scope                | <X>/10 | <sparkline> <arrow> |
| Context-giving       | <X>/10 | <sparkline> <arrow> |
| Actionability        | <X>/10 | <sparkline> <arrow> |
| Command usage        | <X>/10 | <sparkline> <arrow> |
| Pattern efficiency   | <X>/10 | <sparkline> <arrow> |
| Interaction style    | <X>/10 | <sparkline> <arrow> |
| Friction avoidance   | <X>/10 | <sparkline> <arrow> |
| Automation awareness | <X>/10 | <sparkline> <arrow> |

**Top win**: <from Strengths section in analysis.md>
**Top gap**: <from Weaknesses section in analysis.md>

Full report: `file:///<absolute path to ~/prompt-analysis/reports/<targetDate>/report.html>`
```

Sparkline + arrow rules: same as analyze Step 5a - `Math.round((S/10)*7)` -> `['▁','▂','▃','▄','▅','▆','▇','█']`; arrow thresholds ±0.5.

If `htmlExists` was false (Step 3), omit the `Full report:` line and print instead:
`(HTML report missing; run /prompt-analyzer:analyze to regenerate)`
