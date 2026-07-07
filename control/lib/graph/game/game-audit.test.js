// A temp outcomes dir so readTraversalAudit reads fabricated traversal evidence.
// Set before importing anything that resolves outcome paths.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = mkdtempSync(join(tmpdir(), 'moj-game-audit-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;

import { describe, it, expect, afterAll } from 'vitest';
import { dryRunContract, probeShowsCompletion, readTraversalAudit, auditLevel } from './game-audit.js';
import { normalizeLevelContract } from './level-contract.js';

afterAll(() => { try { rmSync(OUT, { recursive: true, force: true }); } catch { /* ignore */ } });

const STORE = {
  slices: [
    { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
    { name: 'bag', kind: 'inventory' },
    { name: 'army', kind: 'party' },
    { name: 'campaign', kind: 'progression' },
    { name: 'world', kind: 'flags' },
  ],
};

// write a fake forge_motion traversal into the temp outcomes dir
function writeTraversal(motionRef, { worldRef, motion = 'traversal', finalGame }) {
  const dir = join(OUT, motionRef);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'recipe.json'), JSON.stringify({ motion_ref: motionRef, subject: { world_ref: worldRef }, shot: { motion } }));
  const probes = [{ t: 0, game: null }, { t: 500, game: finalGame }];
  writeFileSync(join(dir, 'probes.json'), JSON.stringify(probes));
}

describe('dryRunContract — the always-on gate', () => {
  it('passes a coherent contract (grant + promote)', () => {
    const c = normalizeLevelContract({ levelRef: 'lv1', produces: { events: [{ type: 'grant', slice: 'bag', max: 3 }, { type: 'promote', slice: 'campaign' }] } });
    expect(dryRunContract(STORE, c).ok).toBe(true);
  });

  it('passes contracts touching every slice kind (composability across the vocabulary)', () => {
    const c = normalizeLevelContract({ levelRef: 'lv', produces: { events: [
      { type: 'grant', slice: 'bag' }, { type: 'consume', slice: 'bag' },
      { type: 'setStat', slice: 'hero' }, { type: 'levelUp', slice: 'hero' },
      { type: 'recruit', slice: 'army' }, { type: 'dismiss', slice: 'army' },
      { type: 'levelUp', slice: 'army' }, { type: 'setFlag', slice: 'world' },
      { type: 'promote', slice: 'campaign' },
    ] } });
    const r = dryRunContract(STORE, c);
    expect(r.ok).toBe(true);
    expect(r.envelope.events.length).toBeGreaterThan(0);
  });

  it('an empty produces (a level that writes nothing back) still dry-runs ok', () => {
    const c = normalizeLevelContract({ levelRef: 'lv', produces: { events: [] } });
    expect(dryRunContract(STORE, c).ok).toBe(true);
  });
});

describe('probeShowsCompletion — reading a run outcome', () => {
  it('success → completable', () => {
    expect(probeShowsCompletion({ game: { ended: true, result: 'success' } })).toMatchObject({ completable: true, result: 'success' });
  });
  it('a run that never ended is not completable', () => {
    expect(probeShowsCompletion({ game: { ended: false, result: null } }).completable).toBe(false);
    expect(probeShowsCompletion({ game: { ended: false } }).reason).toMatch(/ended before the level/);
  });
  it('a fail/abort ending is not completable', () => {
    expect(probeShowsCompletion({ game: { ended: true, result: 'fail' } })).toMatchObject({ completable: false, result: 'fail' });
  });
  it('a probe with no game field (not a level traversal) is not completable', () => {
    expect(probeShowsCompletion({ entities: {} }).reason).toMatch(/no game outcome/);
    expect(probeShowsCompletion(null).completable).toBe(false);
  });
});

describe('readTraversalAudit — verifying stored evidence', () => {
  it('reads a winning traversal of the right level', () => {
    writeTraversal('mo_win', { worldRef: 'lv1', finalGame: { ended: true, result: 'success' } });
    expect(readTraversalAudit('mo_win', 'lv1')).toMatchObject({ ok: true, completable: true, result: 'success' });
  });

  it('rejects a traversal of a DIFFERENT world (evidence must be OF the level)', () => {
    writeTraversal('mo_other', { worldRef: 'someone-else', finalGame: { ended: true, result: 'success' } });
    expect(readTraversalAudit('mo_other', 'lv1')).toMatchObject({ ok: false });
    expect(readTraversalAudit('mo_other', 'lv1').reason).toMatch(/is of world 'someone-else', not level 'lv1'/);
  });

  it('rejects a non-traversal motion (completability needs a played run)', () => {
    writeTraversal('mo_turntable', { worldRef: 'lv1', motion: 'turntable', finalGame: { ended: true, result: 'success' } });
    expect(readTraversalAudit('mo_turntable', 'lv1').reason).toMatch(/not a traversal/);
  });

  it('reports a losing run as not completable (evidence exists but the run failed)', () => {
    writeTraversal('mo_lose', { worldRef: 'lv1', finalGame: { ended: true, result: 'fail' } });
    expect(readTraversalAudit('mo_lose', 'lv1')).toMatchObject({ ok: true, completable: false, result: 'fail' });
  });

  it('reports missing evidence legibly', () => {
    expect(readTraversalAudit('mo_ghost', 'lv1')).toMatchObject({ ok: false });
    expect(readTraversalAudit('mo_ghost', 'lv1').reason).toMatch(/no traversal 'mo_ghost' on disk/);
  });
});

describe('auditLevel — the combined promotion verdict', () => {
  const contract = normalizeLevelContract({ levelRef: 'lv1', produces: { events: [{ type: 'promote', slice: 'campaign' }] } });

  it('promotable only with a winning audit', async () => {
    writeTraversal('mo_lv1', { worldRef: 'lv1', finalGame: { ended: true, result: 'success' } });
    const a = await auditLevel({ ref: 'lv1', store: STORE, contract, motionRef: 'mo_lv1' });
    expect(a.promotable).toBe(true);
    expect(a.completable).toBe(true);
  });

  it('NOT promotable without evidence, unless allow_unaudited', async () => {
    const blocked = await auditLevel({ ref: 'lv1', store: STORE, contract });
    expect(blocked.promotable).toBe(false);
    expect(blocked.reason).toMatch(/no completability evidence/);
    const waived = await auditLevel({ ref: 'lv1', store: STORE, contract, allowUnaudited: true });
    expect(waived.promotable).toBe(true);
    expect(waived.completable).toBe(null);   // waived, not proven
  });

  it('a failed dry-run blocks promotion even with allow_unaudited', async () => {
    // consume from a slice that isn't inventory would be caught earlier by the contract validator;
    // here we prove the dry-run is a hard gate the override can't bypass by giving a promotable
    // level a contract the store cannot host (setFlag to a nonexistent slice name).
    const bad = { levelRef: 'lv1', produces: { events: [{ type: 'setFlag', slice: 'ghost' }] }, presets: { default: {} } };
    const a = await auditLevel({ ref: 'lv1', store: STORE, contract: bad, allowUnaudited: true });
    expect(a.dryRun.ok).toBe(false);
    expect(a.promotable).toBe(false);
  });
});
