#!/usr/bin/env node
/**
 * Prune the MCP tool-call telemetry table to its retention caps (the same prune the control plane
 * runs on startup; lib/db/index.js pruneMcpToolCalls).
 *
 *   node scripts/cleanup-stale-artifacts.js [--dry-run]
 *
 * Until 3.0 this script also swept data/artifacts/, deleting chatbot build zips and staging dirs
 * whose deployment row was gone. That leg left with the chatbot factory: 3.0 never deletes the
 * bot data a 2.x install left behind (its zips, tables and rows stay in place, inert).
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
