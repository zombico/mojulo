// hero-cloth and cloth-law — the cloth law as data and its bake. The tables: every hero register and body lane has a
// row, a stiffer material pulls harder and a heavier one catches less air; a hero's cloth hangs on its register's budget;
// a baked clip is deterministic, keeps its links and keeps out of the body's capsules through a walk; a hero minted
// before the hero laws 23, or with nothing that flows, packs as it did, byte for byte.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, layeredClip } from './station-loft-rig.js';
import { flowSimulation } from './hero-flow.js';
import { REGISTERS, HERO_LAWS_VERSION } from './hero-form.js';
import { MATERIALS, MATERIAL_NAMES, CLOTH_REGISTERS, materialParams, materialErrors, clothRegisterOf, clothRigidity } from './cloth-law.js';
import { RIGIDITY_WORDS, rigidityParams } from './rigidity.js';
import { CLOTH_LAWS, clothFlows, heroClothRig, bakeClothClips } from './hero-cloth.js';
import { heroRecord, heroPlanOf, planLayered, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { clothClipSeconds, ANIME_CLIP_SECONDS } from './hero-gesture.js';

const heroOf = (spec) => {
  const hero = heroRecord(spec); const ex = expandLayeredManifest({ kind: 'layered', title: 't', hero });
  const manifest = { kind: 'layered', title: 't', recipe: ex.recipe, plan: heroPlanOf(hero), hero, dials: ex.dials, units: 'm' };
  return { mesh: planLayered(manifest).mesh, recipe: manifest.recipe, hero, manifest };
};
const segT = (p, a, b) => { const ab = [0, 1, 2].map((k) => b[k] - a[k]), ap = [0, 1, 2].map((k) => p[k] - a[k]); return Math.max(0, Math.min(1, ab.reduce((s, v, k) => s + v * ap[k], 0) / ab.reduce((s, v) => s + v * v, 0))); };
const segD = (p, a, b) => { const ab = [0, 1, 2].map((k) => b[k] - a[k]), t = segT(p, a, b); return Math.hypot(...[0, 1, 2].map((k) => p[k] - a[k] - ab[k] * t)); };
const rAt = (c, p) => c.r0 + (c.r1 - c.r0) * segT(p, c.a, c.b);

describe('cloth-law: the tables', () => {
  it('every hero register and both body lanes have a row; coarser registers spend no more than the realistic one', () => {
    for (const r of [...Object.keys(REGISTERS), 'anime', 'realistic']) expect(CLOTH_REGISTERS[r], r).toBeDefined();
    const spend = (r) => CLOTH_REGISTERS[r].strings * CLOTH_REGISTERS[r].links;
    for (const [r, row] of Object.entries(CLOTH_REGISTERS)) {
      expect(spend(r), r).toBeLessThanOrEqual(spend('realistic'));
      expect(row.travel, r).toBeGreaterThanOrEqual(0); expect(row.travel, r).toBeLessThanOrEqual(1);
      expect(Number.isInteger(row.hold) && row.hold >= 1, r).toBe(true);
    }
    expect(clothRegisterOf({ form: 'realistic', register: 'box' })).toBe('realistic');
    expect(clothRegisterOf({ head: 'anime' })).toBe('anime');
    expect(clothRegisterOf({ register: 'box' })).toBe('box'); expect(clothRegisterOf({})).toBe('round');
  });
  it('a material names a rigidity on the rigidity scale and a weight; stiffer pulls harder, heavier answers the air less', () => {
    for (const m of MATERIAL_NAMES) { const M = MATERIALS[m]; expect(M.rigidity).toBeGreaterThan(0); expect(M.rigidity).toBeLessThan(1); expect(M.weight).toBeGreaterThan(0); }
    // monotonic in rigidity at a plain weight
    const byR = [...MATERIAL_NAMES].sort((a, b) => MATERIALS[a].rigidity - MATERIALS[b].rigidity);
    for (let i = 1; i < byR.length; i++) expect(materialParams({ rigidity: MATERIALS[byR[i]].rigidity }).stiffness).toBeGreaterThan(materialParams({ rigidity: MATERIALS[byR[i - 1]].rigidity }).stiffness);
    // the weight divides the pull and the air, never the gravity felt
    const heavy = [...MATERIAL_NAMES].sort((a, b) => MATERIALS[b].weight - MATERIALS[a].weight)[0], H = materialParams(heavy), plain = rigidityParams(MATERIALS[heavy].rigidity);
    expect(H.sail).toBeLessThan(plain.sail); expect(H.stiffness).toBeLessThan(plain.stiffness); expect(H.gravity).toBe(plain.gravity);
    // a rigidity word alone is as it was; a piece's rigidity wins over its material's
    expect(materialParams('soft')).toEqual(rigidityParams('soft'));
    expect(clothRigidity({ rigidity: 'stiff', material: MATERIAL_NAMES[0] })).toBe(RIGIDITY_WORDS.stiff);
    expect(materialErrors('velveteen')).toHaveLength(1); expect(materialErrors(MATERIAL_NAMES[0])).toHaveLength(0);
  });
});

// the narrow case: the tiered body under the round register in a robe (a ring of strings round the legs) and a cloak (an
// open curtain round the back)
const ROBED = heroOf({ cast: 'female', register: 'round', outfit: { type: 'outfit', style: 'adventurer', pieces: [{ kind: 'robe' }, { kind: 'cloak' }] } });
describe('hero-cloth: the bake', () => {
  it('the gate: the hero laws 23 flow, a row minted before does not', () => {
    expect(HERO_LAWS_VERSION).toBeGreaterThanOrEqual(CLOTH_LAWS);
    expect(ROBED.hero.laws).toBe(HERO_LAWS_VERSION);
    expect(clothFlows(ROBED.hero)).toBe(true); expect(clothFlows({ ...ROBED.hero, laws: CLOTH_LAWS - 1 })).toBe(false); expect(clothFlows({})).toBe(false);
  });
  const H = heroClothRig(ROBED.mesh, ROBED.recipe, ROBED.hero), reg = CLOTH_REGISTERS.round;
  it('the robe and the cloak hang on the register\'s budget, after the body\'s bones, which keep their places', () => {
    const R0 = validateRig(ROBED.recipe.rig);
    expect(H.R.bones.slice(0, R0.bones.length).map((b) => b.id)).toEqual(R0.bones.map((b) => b.id));
    for (const part of ['robeSkirt_skirt', 'cloak_cape']) {
      const st = H.strings.filter((s) => s.part === part);
      expect(st.length, part).toBeGreaterThan(reg.strings / 2); expect(st.length, part).toBeLessThanOrEqual(reg.strings);
      for (const s of st) expect(s.bones, s.name).toHaveLength(reg.links);
    }
    expect(H.strings.find((s) => s.part === 'robeSkirt_skirt').carrier).toBe('pelvis');
  });
  const R = validateRig(ROBED.recipe.rig), bake = () => bakeClothClips(H, { walk: ROBED.recipe.clips.walk }, R, { seconds: { walk: 1.2 }, speeds: { walk: 1.2 } }).walk;
  const walk = bake();
  it('a baked walk is deterministic and keeps the body\'s own keys', () => {
    expect(JSON.stringify(Array.from({ length: 12 }, (_, k) => bake()(k / 12)))).toBe(JSON.stringify(Array.from({ length: 12 }, (_, k) => walk(k / 12))));
    const { flow, ...pose } = walk(5 / 12); expect(Object.keys(flow).length).toBeGreaterThan(0);
    expect(JSON.stringify(pose)).toBe(JSON.stringify(layeredClip(ROBED.recipe.clips.walk, R)(5 / 12)));
  });
  it('through the walk the links hold and no string joint enters the legs or the arms (as far as it lay at rest)', () => {
    const sim = flowSimulation(H), limbs = H.form.map((c, ci) => [c, ci]).filter(([c]) => /^(thigh|shank|upperArm|foreArm)/.test(c.bone));
    const restD = H.strings.map((st) => st.rest.map((p) => H.form.map((c) => segD(p, c.a, c.b))));
    for (let k = 0; k < 12; k++) {
      const pose = walk(k / 12), { nodes } = rigNodesAt(H.R, pose), caps = sim.caps(pose);
      H.strings.forEach((st, si) => st.joints.forEach((j, q) => {
        if (!q) return;
        expect(Math.abs(Math.hypot(...[0, 1, 2].map((a) => nodes[j][a] - nodes[st.joints[q - 1]][a])) - st.lengths[q - 1]), `${j} key ${k}`).toBeLessThan(0.003);
        for (const [, ci] of limbs) expect(segD(nodes[j], caps[ci].a, caps[ci].b), `key ${k} ${j} in ${H.form[ci].bone}`).toBeGreaterThan(Math.min(rAt(caps[ci], nodes[j]), restD[si][q][ci]) - 0.02);
      }));
    }
  });
});

describe('hero-cloth: one duration for the page and the export', () => {
  // the swing is baked for one duration, so every clip a flowing hero plays carries it: the page and the GLB both play a
  // clip's `s` (rig-preview.js, scene-gltf.js), where before a clip with none played three seconds on the page and one
  // in the GLB, its cloth simulated for the page's
  const R = validateRig(ROBED.recipe.rig);
  it('a clip with seconds keeps them; the hero\'s own clip takes its designed duration; a compiled clip one second; an act keeps its own clock', () => {
    const own = Object.keys(ROBED.recipe.clips), fn = Object.assign(() => ({}), { keys: 24 }), act = Object.assign(() => ({}), { act: { seconds: 2.5 } });
    const S = clothClipSeconds(ROBED.hero, { ...ROBED.recipe.clips, swing: fn, take: act }, { walk: 1.2 });
    expect(S.walk).toBe(1.2); expect(S.swing).toBe(1); expect(S.take).toBeUndefined();
    for (const n of own.filter((x) => x !== 'walk')) expect(S[n], n).toBe(ANIME_CLIP_SECONDS[n] ?? Math.max(1, 0.5 * ROBED.recipe.clips[n].length));
  });
  it('the bake simulates a clip over the seconds it is given, and an act over its own', () => {
    const idle = ROBED.recipe.clips.idle, at = (b) => JSON.stringify(b.idle(0.25).flow);
    const fast = bakeClothClips(H0(), { idle }, R, { seconds: { idle: 1 } }), slow = bakeClothClips(H0(), { idle }, R, { seconds: { idle: 4 } });
    expect(at(fast)).not.toBe(at(slow));
    const fn = layeredClip(idle, R), acted = Object.assign((u) => fn(u), fn, { act: { seconds: 4 } });
    expect(JSON.stringify(bakeClothClips(H0(), { idle: acted }, R).idle(0.25).flow)).toBe(at(slow));
  });
});
const H0 = () => heroClothRig(ROBED.mesh, ROBED.recipe, ROBED.hero);

describe('hero-cloth: the realistic cape keeps its skin', () => {
  // (2026-11-14: hung on strings, the realistic body's cape sheared into flaps at its open edges where the arm carries
  // it; the lane is read off the hero, so the narrow case's mesh stands in for the realistic body's)
  it('on the realistic lane the cape has no strings; what else flows still does', () => {
    const H = heroClothRig(ROBED.mesh, ROBED.recipe, { ...ROBED.hero, form: 'realistic' });
    expect(H.strings.some((s) => s.part === 'cloak_cape')).toBe(false);
    expect(H.strings.some((s) => s.part === 'robeSkirt_skirt')).toBe(true);
  });
});

describe('hero-cloth: nothing that flows', () => {
  it('a hero in nothing loose has no cloth rig, so its pack is the one before', () => {
    const BARE = heroOf({ cast: 'male', register: 'round' });
    expect(Object.values(BARE.recipe.parts).some((p) => clothRigidity(p) !== null)).toBe(false);
    expect(heroClothRig(BARE.mesh, BARE.recipe, BARE.hero)).toBeNull();
  });
});
