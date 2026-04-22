#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ALLOWLIST = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'hooks/hooks.json',
  'hooks/capture-prompts.js',
  'hooks/session-init.js',
  'skills/analyze/SKILL.md',
  'skills/analyze/analyzer.js',
  'skills/view/SKILL.md',
  'scripts/migrations/index.js',
  'scripts/migrations/utils.js',
  'scripts/migrations/v1.2-to-v1.3.js',
  'scripts/migrations/v1.3-to-v2.0.js',
  'README.md',
  'CHANGELOG.md',
  'assets/claude-jumping.svg',
  'LICENSE',
];

function git(args, opts = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `git ${args[0]} failed`);
  }
  return (result.stdout || '').trim();
}

function gitIn(dir, args) {
  return git(args, { cwd: dir });
}

function assert(condition, msg) {
  if (!condition) {
    process.stderr.write(`[FAIL] ${msg}\n`);
    process.exit(1);
  }
}

function print(msg) {
  process.stdout.write(msg + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const isFirstRun = args.includes('--first-run');

  const repoRoot = path.resolve(__dirname, '..');

  // 1. Assert on dev branch
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot });
  assert(branch === 'dev', `Must be on dev branch; currently on: ${branch}`);

  // 2. Assert clean working tree
  const status = git(['status', '--porcelain'], { cwd: repoRoot });
  assert(status === '', 'Working tree must be clean before publishing');

  // 3. Assert dev up-to-date with origin/dev
  git(['fetch', 'origin', 'dev'], { cwd: repoRoot });
  const behind = git(['rev-list', 'HEAD..origin/dev', '--count'], { cwd: repoRoot });
  assert(behind === '0', `dev is ${behind} commit(s) behind origin/dev; pull first`);

  // 4. Read + validate version from plugin.json
  const pluginJsonPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  const version = pluginJson.version;
  assert(version, 'plugin.json must have a version field');
  assert(/^\d+\.\d+\.\d+$/.test(version), `Invalid semver in plugin.json: ${version}`);

  const existingTag = git(['tag', '-l', `v${version}`], { cwd: repoRoot });
  assert(existingTag === '', `Tag v${version} already exists; bump plugin.json version before publishing`);

  print(`Publishing v${version}...`);

  // 5. Stage allowlist files into a temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-analyzer-publish-'));
  try {
    for (const file of ALLOWLIST) {
      const src = path.join(repoRoot, file);
      assert(fs.existsSync(src), `Allowlist file missing: ${file}`);
      const dest = path.join(tmpDir, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    print(`Staged ${ALLOWLIST.length} files`);

    // 6. Checkout main in a git worktree (cwd stays on dev)
    const worktreePath = path.join(os.tmpdir(), `pa-main-${Date.now()}`);
    git(['worktree', 'add', worktreePath, 'main'], { cwd: repoRoot });

    try {
      // 7. Clear main tree
      gitIn(worktreePath, ['rm', '-rf', '.']);

      // Copy allowlist into worktree
      for (const file of ALLOWLIST) {
        const dest = path.join(worktreePath, file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(tmpDir, file), dest);
      }

      // 8. Commit (force +x on hook scripts; core.fileMode=false on macOS ignores mode changes)
      gitIn(worktreePath, ['add', '-A']);
      gitIn(worktreePath, ['update-index', '--chmod=+x', 'hooks/capture-prompts.js', 'hooks/session-init.js']);
      gitIn(worktreePath, ['commit', '-m', `release: v${version}`]);

      // 9. Annotated tag
      gitIn(worktreePath, ['tag', '-a', `v${version}`, '-m', `v${version}`]);

      // 10. Push main + tag
      if (isFirstRun) {
        gitIn(worktreePath, ['push', 'origin', 'main', '--force']);
        print('First-run: force-pushed main to establish clean payload history.');
      } else {
        gitIn(worktreePath, ['push', 'origin', 'main']);
      }
      gitIn(worktreePath, ['push', 'origin', `v${version}`]);

      print(`\nPublished v${version} to main and tagged v${version}.`);
    } finally {
      try { git(['worktree', 'remove', worktreePath, '--force'], { cwd: repoRoot }); } catch { }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  process.stderr.write(`[FAIL] ${err.message}\n`);
  process.exit(1);
});
