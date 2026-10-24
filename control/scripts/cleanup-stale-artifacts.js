#!/usr/bin/env node
/**
 * Prune the MCP tool-call telemetry table to its retention caps (the same prune the control plane
 * runs on startup; lib/db/index.js pruneMcpToolCalls).
 *
 *   node scripts/cleanup-stale-artifacts.js [--dry-run]
 *
 * It never deletes the data a 2.x install left behind (its folders, tables and rows stay in place,
 * inert).
 */

import { getDb, pruneMcpToolCalls } from '../lib/db/index.js';

const dryRun = process.argv.includes('--dry-run');

function main() {
  // --dry-run keeps the script read-only: the prune is the only write it makes.
  if (dryRun) {
    console.log('[dry-run] telemetry prune skipped');
    return;
  }
  const prunedRows = pruneMcpToolCalls(getDb());
  console.log(`telemetry rows pruned=${prunedRows}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
