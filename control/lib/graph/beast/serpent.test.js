// The snake-kin's coil (lib/graph/beast/serpent.js): a person's torso, arms and head on a serpent's coil in place of the
// legs, grown out of the pelvis's own hip ring (one surface), its length on the ground planted and lying on the floor,
// its ground links a wave that travels toward the tail through every gait (station-loft-rig.js `wave`, `planted`). Kins
// are chosen in code by the procedure they run.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { COIL } from './serpent.js';
import { beastCoatOf, coverMap } from './cover.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { partRings } from '../polygonizer/tiered-form.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig, rigNodesAt, waveAt } from '../polygonizer/station-loft-rig.js';
import { locomotionClips } from '../polygonizer/hero-motion.js';
import { stretchAudit } from '../polygonizer/hero-stretch.js';
import { layeredShadingNormals } from '../polygonizer/station-loft-shade.js';
import { PALETTE } from '../polygonizer/hero-form.js';

const kinBy = (pred) => Object.entries(BEAST_KINS).find(([, c]) => pred(c))[0];
const COILED = kinBy((c) => c.legs === 'serpent'), LEGGED = kinBy((c) => !c.legs);
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const kin = (id, extra = {}, spec = {}) => mint({ cast: 'female', beast: { kin: id, ...extra }, ...spec });
const seg = (p, n) => p.segments.find((s) => s.name === n);
const built = (hero) => { const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials); return { recipe, R, mesh, skin: bindLayered(mesh, recipe, R) }; };

describe('the snake-kin\'s coil', () => {
  it('grows out of the pelvis\'s own hip ring, point for point, the legs\' parts gone and their bones kept', () => {
    const p = heroPlanOf(kin(COILED)), coil = seg(p, 'coil'), pelvis = seg(p, 'pelvis');
    expect(p.segments.some((s) => /^(thigh|shank|foot|toes|kneeBridge)(R|L)?$/.test(s.name))).toBe(false);
    const R = validateRig(expandLayeredManifest({ kind: 'layered', hero: kin(COILED) }).recipe.rig);
    for (const b of ['thighR', 'shankL']) expect(R.bones.some((x) => x.id === b)).toBe(true);
    expect(Object.keys(R.legs)).toEqual(['R', 'L']);
    // (the pelvis cut at the hip: its first ring now the coil's first, the same points in the same order round)
    const hip = partRings(p, pelvis).stations[0].points, first = coil.stations[0].points;
    expect(Object.keys(first).sort()).toEqual(Object.keys(hip).sort());
    for (const sl of Object.keys(hip)) expect(Math.hypot(...hip[sl].map((x, i) => x - first[sl][i]))).toBeLessThan(2e-6);
    expect(Math.abs(pelvis.stations[0].z - p.joints.hip[2])).toBeLessThan(0.05);
  });

  it('lies on the floor where it reaches the ground, and stays there through every gait as its wave turns it', () => {
    const { recipe, R, mesh } = built(kin(COILED, {}, { motion: { walk: true, sprint: true } }));
    const low = (pts) => Math.min(...pts.map((q) => q[2]));
    const onGround = mesh.vertices.filter((_, i) => mesh.provenance[i].part === 'coil');
    expect(Math.abs(low(onGround))).toBeLessThan(0.01);
    const planted = R.planted;
    expect(planted.length).toBeGreaterThan(3);
    const C = locomotionClips(recipe.locomotion, R).clips;
    for (const g of ['walk', 'sprint'].filter((x) => C[x])) for (const t of [0, 0.3, 0.6]) {
      const N = rigNodesAt(R, C[g](t)).nodes;
      for (const j of planted) expect(Math.abs(N[j][2] - R.joints[j][2])).toBeLessThan(1e-9);   // (turned about the vertical only)
    }
  }, 60_000);

  it('its wave travels toward the tail: each ground link\'s bend peaks later than the one before it', () => {
    const { R } = built(kin(COILED)), W = R.wave;
    expect(W.chains.length).toBeGreaterThan(2);
    const peak = (ch) => { let best = 0, at = 0; for (let k = 0; k < 200; k++) { const v = waveAt(R, k / 200)[ch]; if (v > best) { best = v; at = k / 200; } } return at; };
    const peaks = W.chains.map(peak);
    for (let i = 1; i < peaks.length; i++) expect((peaks[i] - peaks[i - 1] + 1) % 1).toBeCloseTo(1 / W.links, 1);
    expect(Math.max(...W.chains.map((c) => waveAt(R, 0.25)[c]))).toBeLessThanOrEqual(COIL.wave.amp + 1e-9);
  }, 60_000);

  it('a hero without a coil carries no wave and no planted joint: its clips as they were', () => {
    const { recipe, R } = built(kin(LEGGED));
    expect(R.wave).toBeUndefined(); expect(R.planted).toBeUndefined();
    expect(waveAt(R, 0.3)).toEqual({});
    const C = locomotionClips(recipe.locomotion, R).clips;
    expect(Object.keys(C.walk(0.3)).some((k) => /^coil/.test(k))).toBe(false);
    expect(() => validateRig({ ...recipe.rig, wave: { chains: ['nope'], amp: 10, links: 4 } })).toThrow(/wave\.chains/);
    expect(() => validateRig({ ...recipe.rig, planted: ['pelvisHub'] })).toThrow(/planted/);
  }, 60_000);

  it('binds and rigs whole; its joints stretch no worse than a person\'s through its own gaits', () => {
    const { recipe, R, mesh, skin } = built(kin(COILED, {}, { motion: { walk: true, sprint: true } })), A = auditRig(mesh, skin, R);
    expect(A.badWeights).toBe(0); expect(A.restIdentity).toBeLessThan(1e-9);
    const C = locomotionClips(recipe.locomotion, R).clips, frames = ['walk', 'sprint'].flatMap((g) => [0, 2, 4].map((i) => ({ label: `${g} ${i}`, pose: C[g](i / 6) })));
    const W = stretchAudit(mesh, skin, R, recipe, frames).worst;
    expect(W.pinch.value).toBeGreaterThan(0.7); expect(W.folds.value).toBeLessThanOrEqual(2);
  }, 120_000);

  it('its scales cover the coil and the hips over it only, a person\'s skin above', () => {
    const H = kin(COILED), { recipe, mesh } = built(H), N = layeredShadingNormals(mesh, recipe, {});
    const coat = beastCoatOf(H), C = coverMap(mesh, recipe, N, 'scales', coat), flat = 2 / 128;
    let onCoil = 0;
    mesh.faces.forEach((_, fi) => { const covered = C.uvAt(fi, 0)[0] !== flat || C.uvAt(fi, 1)[0] !== flat;
      if (covered) { expect(coat.has(mesh.groups[fi])).toBe(true); if (mesh.groups[fi] === 'Coil') onCoil++; } });
    expect(onCoil).toBeGreaterThan(100);
    expect(H.palette.Top).toBe(H.palette.Skin ?? PALETTE.Skin);   // (bare above: no shirt's colour)
  }, 60_000);

  it('the door refuses what is cut for legs: trousers, footwear, an armour build', () => {
    const errs = (extra) => validateHeroSpec({ cast: 'female', beast: { kin: COILED }, ...extra }).join(' | ');
    expect(errs({ adorn: { type: 'armor', style: 'knight' } })).toMatch(/snake-kin wears no armour build/);
    expect(validateHeroSpec({ cast: 'female', beast: { kin: COILED } })).toEqual([]);
    expect(validateHeroSpec({ cast: 'female', beast: { kin: LEGGED, legs: 'serpent' } })).toEqual([]);   // (any kin may stand on one)
  });
});
