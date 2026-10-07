import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry, STAGE_KITS } from './stage.js';
import { cryptTomb, accentWall, ossuaryRows, cryptNiches } from './crypt.js';
import { PRINCIPLE_LAWS } from './laws.js';
import { checkStageLaws } from './law-checks.js';
import { starter } from './entries.js';
import { CATACOMB } from './style/catacomb.js';

const CATA = { ...starter('catacomb'), reference: 'gothic-night' };

describe('the catacomb: galleries cut in rock, dressed by the crypt\'s dressing from its own card', () => {
  const scene = assembleStageScene(CATA), plan = planStage(CATA);

  it('keeps every law its card states that the checks can read', () => {
    const r = checkStageLaws(scene, { only: [...new Set(PRINCIPLE_LAWS.catacomb.flat())] });
    expect(r.of).toBeGreaterThanOrEqual(9);
    for (const l of r.laws) expect(l.ok, `${l.law}: ${l.why}`).toBe(true);
  });

  it('principle 3 — carved, not built: wall, vault and piers are rock tiles, none of them coursed, the vault its own', () => {
    const fam = (g) => new Set(scene.faces.filter((f) => f.group === `stage:${g}` && !f.blend && f.texture).map((f) => f.texture.replace(/-[a-d]$/, '')));
    for (const g of ['wall', 'ceiling']) for (const k of fam(g)) expect(k).toMatch(/^gen:rock-/);
    expect([...fam('ceiling')].some((k) => fam('wall').has(k))).toBe(false);
  });

  it('principle 5 — loculi in tiers: a tall bay holds more than two, some sealed', () => {
    const geom = buildStageGeometry(plan), slots = scene.faces.filter((f) => f.group === 'stage:niche');
    const tiers = new Set(slots.map((f) => Math.min(...f.corners.map((c) => c[2])).toFixed(2)));
    expect(tiers.size).toBeGreaterThan(2);
    expect(geom.pilasters.length).toBeGreaterThan(0);
    const tomb = cryptTomb(plan), tc = [tomb.corners.reduce((s, c) => s + c[0], 0) / 4, tomb.corners.reduce((s, c) => s + c[1], 0) / 4];
    const built = cryptNiches(plan, geom.pilasters, accentWall(plan, geom.pilasters, tc));
    const slabs = built.filter((f) => f.group === 'stage:motif' && f.tint === CATACOMB.niches.slab).length, open = built.filter((f) => f.group === 'stage:niche').length;
    expect(slabs).toBeGreaterThan(0); expect(open).toBeGreaterThan(slabs);   // some sealed, most still open and dark
  });

  it('principle 6 — the ossuary wall: behind the sarcophagus, rows of skulls on ledges, one plane', () => {
    const geom = buildStageGeometry(plan), tomb = cryptTomb(plan), tc = [tomb.corners.reduce((s, c) => s + c[0], 0) / 4, tomb.corners.reduce((s, c) => s + c[1], 0) / 4];
    const acc = accentWall(plan, geom.pilasters, tc), skulls = ossuaryRows(plan, geom.pilasters, acc).filter((f) => f.group === 'stage:accent-skull');
    expect(skulls.length).toBeGreaterThan(0);
    // every skull sits in front of the accent wall, within its reach
    for (const f of skulls) for (const c of f.corners) expect((c[0] - acc.F.o[0]) * acc.F.N[0] + (c[1] - acc.F.o[1]) * acc.F.N[1]).toBeGreaterThan(-1e-6);
    expect(new Set(scene.faces.filter((f) => f.group === 'stage:accent').map((f) => f.normal.join())).size).toBe(1);
  });

  it('principle 9 — corner things of its own kinds: amphorae and bones, no crates', () => {
    expect(CATACOMB.props.kinds).not.toContain('crate');
    expect(scene.faces.filter((f) => f.group === 'stage:prop').length).toBeGreaterThan(0);
  });

  it('is a room kit an agent can name: starter of six linked rooms, proportions on the rails', () => {
    expect(STAGE_KITS.catacomb.arch).toBeTruthy();
    expect(CATA.rooms).toHaveLength(6);
    expect(plan.links).toHaveLength(5);
    expect(() => planStage({ ...CATA, proportions: { pilaster: { w: 0.5 } } })).not.toThrow();
  });
});
