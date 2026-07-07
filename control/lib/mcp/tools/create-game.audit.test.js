// The G4 promotion GATE, end to end: create_game refuses uncompletable levels and accepts
// levels backed by a winning traversal. Needs both the in-memory sketch DB and a temp
// outcomes dir (where forge_motion traversals write their evidence) — set both before imports.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
const OUT = mkdtempSync(join(tmpdir(), 'moj-game-gate-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createGameHandler, mintGame } from './create-game.js';

beforeEach(() => { closeDb(); });
afterAll(() => { try { rmSync(OUT, { recursive: true, force: true }); } catch { /* ignore */ } });

const STORE = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] };
const contract = (levelRef) => ({
  levelRef,
  produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] },
});

function mintLevel(ref) {
  SketchRepository.create({ ref, title: ref, manifest: { kind: 'orbit-view', scenario: 'circular', game: contract(ref) } });
}
// fabricate the evidence a forge_motion traversal of `levelRef` would have written
function writeWinningTraversal(motionRef, levelRef, result = 'success') {
  const dir = join(OUT, motionRef);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'recipe.json'), JSON.stringify({ subject: { world_ref: levelRef }, shot: { motion: 'traversal' } }));
  writeFileSync(join(dir, 'probes.json'), JSON.stringify([{ t: 0, game: null }, { t: 1000, game: { levelRef, ended: true, result } }]));
}

describe('create_game — the completability gate', () => {
  it('refuses an unaudited level by default (points the agent at the traversal audit)', async () => {
    mintLevel('crypt-1');
    await expect(createGameHandler({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }] }))
      .rejects.toThrow(/verification gate[\s\S]*no completability evidence[\s\S]*forge_motion/);
  });

  it('promotes a level backed by a WINNING traversal, and records it audited', async () => {
    mintLevel('crypt-1');
    writeWinningTraversal('mo_c1', 'crypt-1');
    const out = await mintGame({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }], audits: { 'crypt-1': { motion_ref: 'mo_c1' } }, ref: 'g1' });
    expect(out.ok).toBe(true);
    expect(out.audits).toEqual([{ ref: 'crypt-1', completable: true, result: 'success', audited: true, note: expect.stringMatching(/reached result: success/) }]);
  });

  it('refuses a level whose traversal ended in FAIL (evidence exists but the run lost)', async () => {
    mintLevel('crypt-1');
    writeWinningTraversal('mo_lose', 'crypt-1', 'fail');
    await expect(createGameHandler({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }], audits: { 'crypt-1': { motion_ref: 'mo_lose' } } }))
      .rejects.toThrow(/ended in 'fail'/);
  });

  it('refuses when the audit traversal is of a DIFFERENT world', async () => {
    mintLevel('crypt-1');
    writeWinningTraversal('mo_wrong', 'some-other-world');
    await expect(createGameHandler({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }], audits: { 'crypt-1': { motion_ref: 'mo_wrong' } } }))
      .rejects.toThrow(/not level 'crypt-1'/);
  });

  it('allow_unaudited promotes without evidence but records audited:false', async () => {
    mintLevel('crypt-1');
    const out = await mintGame({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }], allowUnaudited: true, ref: 'g2' });
    expect(out.ok).toBe(true);
    expect(out.audits[0]).toMatchObject({ ref: 'crypt-1', audited: false, completable: null });
  });

  it('a mixed campaign: one audited, one waived — the gate reports per level', async () => {
    mintLevel('crypt-1'); mintLevel('crypt-2');
    writeWinningTraversal('mo_c1', 'crypt-1');
    // crypt-2 has no audit → without allow_unaudited the whole mint is refused
    await expect(createGameHandler({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }, { ref: 'crypt-2' }], audits: { 'crypt-1': { motion_ref: 'mo_c1' } } }))
      .rejects.toThrow(/crypt-2: no completability evidence/);
    // with the override, both promote; the audited one is still recorded as proven
    const out = await mintGame({ title: 'G', store: STORE, levels: [{ ref: 'crypt-1' }, { ref: 'crypt-2' }], audits: { 'crypt-1': { motion_ref: 'mo_c1' } }, allowUnaudited: true, ref: 'g3' });
    expect(out.audits.find((a) => a.ref === 'crypt-1').audited).toBe(true);
    expect(out.audits.find((a) => a.ref === 'crypt-2').audited).toBe(false);
  });
});
