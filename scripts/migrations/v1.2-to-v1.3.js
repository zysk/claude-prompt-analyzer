#!/usr/bin/env node

'use strict';

/**
 * v1.2.0 -> v1.3.0 migration
 *
 * Changes:
 *   - Merge 4 state JSON files into single state.json (with schemaVersion)
 *   - Delete old files: meta.json, scores.json, corrections.json, learned-rules.json
 *   - Delete ~/prompt-analysis/projects.json (no longer used)
 */

const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function migrate(root) {
  const reportsDir = path.join(root, 'reports');
  const projectsJson = path.join(root, 'projects.json');

  // If reports dir doesn't exist, nothing to merge
  if (!fs.existsSync(reportsDir)) {
    // Still delete projects.json if present
    if (fs.existsSync(projectsJson)) {
      fs.unlinkSync(projectsJson);
    }
    return { merged: false, deletedProjectsJson: fs.existsSync(projectsJson) };
  }

  const metaPath = path.join(reportsDir, 'meta.json');
  const scoresPath = path.join(reportsDir, 'scores.json');
  const correctionsPath = path.join(reportsDir, 'corrections.json');
  const learnedRulesPath = path.join(reportsDir, 'learned-rules.json');
  const stateJsonPath = path.join(reportsDir, 'state.json');

  // Already migrated (state.json exists)
  if (fs.existsSync(stateJsonPath)) {
    return { merged: false, alreadyMigrated: true };
  }

  const meta = readJsonSafe(metaPath, {});
  const scores = readJsonSafe(scoresPath, {});
  const corrections = readJsonSafe(correctionsPath, {
    scope: 'CLASSIFICATION ONLY',
    maxEntries: 200,
    corrections: [],
    ruleAccuracy: {},
  });
  const learnedRules = readJsonSafe(learnedRulesPath, {
    scope: 'CLASSIFICATION ONLY - never quality judgment',
    stalePruneAfterDays: 30,
    userPatterns: [],
  });

  // Merge into state.json with schemaVersion
  const state = {
    schemaVersion: '1.3.0',
    meta,
    scores,
    corrections,
    learnedRules,
  };

  fs.writeFileSync(stateJsonPath, JSON.stringify(state, null, 2), 'utf8');

  // Delete old files
  const deleted = [];
  for (const p of [metaPath, scoresPath, correctionsPath, learnedRulesPath]) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      deleted.push(path.basename(p));
    }
  }

  // Delete projects.json (no longer used as of v1.3)
  if (fs.existsSync(projectsJson)) {
    fs.unlinkSync(projectsJson);
    deleted.push('projects.json');
  }

  return { merged: true, deleted };
}

module.exports = {
  from: '1.2.0',
  to: '1.3.0',
  description: 'Merge state JSONs into state.json; drop projects.json',
  migrate,
};
