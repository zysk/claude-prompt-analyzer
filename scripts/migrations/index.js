#!/usr/bin/env node

'use strict';

/**
 * Migration registry + runner.
 * Add new migrations here as `{ from, to, migrate }` objects.
 */

const fs = require('fs');
const path = require('path');
const { existsDir, createBackup, restoreFromBackup, deleteBackup } = require('./utils');

// Registry: keep in ASCENDING version order
const MIGRATIONS = [
  require('./v1.2-to-v1.3'),
  // future migrations go here
];

function parseVersion(v) {
  return v.split('.').map(Number);
}

function cmpVersion(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((av[i] || 0) < (bv[i] || 0)) return -1;
    if ((av[i] || 0) > (bv[i] || 0)) return 1;
  }
  return 0;
}

/**
 * Find migration chain from `fromVersion` to `toVersion`.
 * Returns array of migration modules in order.
 */
function findMigrationChain(fromVersion, toVersion) {
  if (cmpVersion(fromVersion, toVersion) >= 0) return [];

  const chain = [];
  let current = fromVersion;

  while (cmpVersion(current, toVersion) < 0) {
    const next = MIGRATIONS.find((m) => m.from === current);
    if (!next) {
      throw new Error(`No migration path from v${current} to v${toVersion}`);
    }
    chain.push(next);
    current = next.to;
  }

  return chain;
}

/**
 * Run all applicable migrations from fromVersion -> toVersion on the
 * ~/prompt-analysis root. Backup + rollback on failure.
 *
 * Returns: { ran: boolean, chain: [], results: [] }
 */
async function runMigrations(root, fromVersion, toVersion, log = () => {}) {
  if (!existsDir(root)) {
    return { ran: false, reason: 'no-data', chain: [], results: [] };
  }

  const chain = findMigrationChain(fromVersion, toVersion);
  if (chain.length === 0) {
    return { ran: false, reason: 'already-current', chain: [], results: [] };
  }

  log(`Found ${chain.length} migration(s) to apply:`);
  for (const m of chain) {
    log(`  - v${m.from} -> v${m.to}: ${m.description}`);
  }

  log('Creating backup...');
  const backupDir = createBackup(root);
  log(`  Backup: ${backupDir}`);

  const results = [];
  try {
    for (const m of chain) {
      log(`Running migration v${m.from} -> v${m.to}...`);
      const result = await m.migrate(root);
      results.push({ from: m.from, to: m.to, result });
      log(`  Done.`);
    }
  } catch (err) {
    log(`Migration failed: ${err.message}`);
    log('Rolling back from backup...');
    try {
      restoreFromBackup(root, backupDir);
      log('  Rollback complete.');
    } catch (rollbackErr) {
      log(`  Rollback FAILED: ${rollbackErr.message}`);
      log(`  Backup is still at: ${backupDir}`);
      throw new Error(`Migration failed AND rollback failed. Backup at ${backupDir}. Original error: ${err.message}`);
    }
    throw err;
  }

  // Success: delete backup
  log('Deleting backup...');
  deleteBackup(backupDir);

  return { ran: true, chain, results };
}

module.exports = {
  runMigrations,
  findMigrationChain,
  MIGRATIONS,
  cmpVersion,
};
