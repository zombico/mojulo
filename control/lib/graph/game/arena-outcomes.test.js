import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CONTRACT_VERSION } from './level-contract.js';
import { buildGameStoreKernel } from './store-kernel.js';

// ── an arena's outcome is one the shell applies ─────────────────────────────────────────────────────────────────
// The contests, the versus fighter and the holo table are pages of their own, hosted by the play shell like a level.
// The shell applies an outcome only when its envelope names the contract version (store-kernel.js validateEnvelope);
// an envelope without one is refused and the run saves nothing ("the level's outcome could not be applied"). The
// arenas' clients run in the page, so this reads their source: every outcome they post carries the wire's version.

const GRAPH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENTS = ['contest', 'versus', 'tabletop'].flatMap((d) => fs.readdirSync(path.join(GRAPH, d)).filter((f) => f.endsWith('.client.js')).map((f) => `${d}/${f}`));
const POST = /post\(\{ moj: (\w+)\.wire\.outcome, envelope: \{([^}]*)/g;

describe('every arena outcome names the contract version', () => {
  const posts = CLIENTS.flatMap((f) => [...fs.readFileSync(path.join(GRAPH, f), 'utf8').matchAll(POST)].map((m) => ({ f, wire: m[1], head: m[2] })));

  it('finds the arenas that post an outcome', () => {
    for (const d of ['contest', 'versus', 'tabletop']) expect(posts.some((p) => p.f.startsWith(`${d}/`)), d).toBe(true);
  });

  it.each(CLIENTS)('%s: each outcome envelope opens with the wire version', (f) => {
    for (const p of posts.filter((x) => x.f === f)) expect(p.head, `${f}: ${p.head.trim()}`).toMatch(new RegExp(`^ contractVersion: ${p.wire}\\.wire\\.version,`));
  });

  it('the shell refuses an envelope without it and takes one with it', () => {
    const K = buildGameStoreKernel(), contract = { consumes: [], produces: { events: [] } };
    expect(K.validateEnvelope(contract, { result: 'success', events: [] }).ok).toBe(false);
    expect(K.validateEnvelope(contract, { contractVersion: CONTRACT_VERSION, result: 'success', events: [] }).ok).toBe(true);
  });
});
