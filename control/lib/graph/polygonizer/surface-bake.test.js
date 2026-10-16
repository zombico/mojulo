// surface-bake: the bake stack's laws on one dressed hero (a ranger: a pauldron over the shoulder, a belt, a bracer).
import { describe, it, expect } from 'vitest';
import { FINISHES, FINISH_NAMES, validateBake, resolveBake, finishFor, finishColour, bakeChannels, bakeTint, stackTints, bakeReadout } from './surface-bake.js';
import { heroRecord, expandLayeredManifest, planLayered, createLayeredHandler } from '../../mcp/tools/layered.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return { m, mesh: planLayered(m).mesh }; };
const RANGER = { cast: 'male', detail: 'clothed', adorn: 'ranger' };
const OPEN = { sky: 0, occlusion: 0, edge: 0, height: 1, rise: 0.5 };

describe('the bake words', () => {
  it('names what it refuses, and no bake is null', () => {
    for (const b of [undefined, null, false]) expect(resolveBake(b)).toBeNull();
    expect(resolveBake(true)).toEqual({ finish: {}, strength: 1 });
    expect(validateBake({ shine: 1 })[0]).toMatch(/bake.shine: not a bake word/);
    expect(validateBake({ strength: 2 })[0]).toMatch(/strength: a number 0–1/);
    expect(validateBake({ finish: { Plate: 'chrome' } })[0]).toMatch(/'chrome' is not a finish \(metal, gilt/);
    expect(validateBake({ finish: { Plate: { sky: [[1, 1], [0, 1]] } } })[0]).toMatch(/sky: 1–16 points/);
    expect(validateBake({ finish: { Plate: { gloss: 1 } } })[0]).toMatch(/gloss: not a finish key/);
    expect(validateBake([1])[0]).toMatch(/^bake: true, or/);
    expect(() => resolveBake({ finish: { Plate: 'chrome' } })).toThrow(/bake refused/);
  });
  it('every finish is plain data and valid inline', () => {
    for (const w of FINISH_NAMES) {
      expect(JSON.parse(JSON.stringify(FINISHES[w]))).toEqual(FINISHES[w]);
      expect(validateBake({ finish: { X: { ...FINISHES[w] } } }), w).toEqual([]);
    }
  });
  it('a group wears its finish by name, the operator\'s by group, then by *', () => {
    const B = resolveBake(true);
    expect(finishFor('Plate', B)).toBe(FINISHES.metal);
    expect(finishFor('Trim', B)).toBe(FINISHES.gilt);
    expect(finishFor('Leather', B)).toBe(FINISHES.leather);
    expect(finishFor('Top', B)).toBe(FINISHES.cloth);
    expect(finishFor('Skin', B)).toBe(FINISHES.skin);
    expect(finishFor('Whatever', B)).toBe(FINISHES.matte);
    const own = resolveBake({ finish: { Plate: 'cloth', '*': 'scale' } });
    expect(finishFor('Plate', own)).toBe(FINISHES.cloth);
    expect(finishFor('Top', own)).toBe(FINISHES.scale);
    expect(finishFor('Plate', resolveBake({ finish: { Plate: { edge: 1 } } })).edge).toBe(1);   // an inline finish over matte
  });
});

describe('the finish', () => {
  it('metal swings wider over the sky than cloth, and strength 0 is no bake', () => {
    const swing = (F) => { const v = [-1, -0.5, 0, 0.5, 0.7, 1].map((sky) => finishColour(F, { ...OPEN, sky })[1]); return Math.max(...v) - Math.min(...v); };
    expect(swing(FINISHES.metal)).toBeGreaterThan(2 * swing(FINISHES.cloth));
    expect(finishColour(FINISHES.metal, { ...OPEN, sky: 0.7, edge: 1 }, 0)).toEqual([1, 1, 1]);
  });
  it('occlusion darkens, an edge lifts, a part\'s foot is darker than its top, gilt lifts warm', () => {
    const at = (F, ch) => finishColour(F, { ...OPEN, ...ch });
    expect(at(FINISHES.cloth, { occlusion: 1 })[0]).toBeLessThan(at(FINISHES.cloth, {})[0] - 0.5);
    expect(at(FINISHES.metal, { edge: 1 })[0]).toBeGreaterThan(at(FINISHES.metal, {})[0]);
    expect(at(FINISHES.metal, { rise: 0 })[0]).toBeLessThan(at(FINISHES.metal, { rise: 1 })[0]);
    const g = at(FINISHES.gilt, { sky: 0.62, edge: 1 }); expect(g[0]).toBeGreaterThan(g[2]);
    for (const w of FINISH_NAMES) for (const sky of [-1, 0, 0.62, 1]) for (const v of at(FINISHES[w], { sky, edge: 1, rise: 1 })) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1.6); }
  });
});

describe('the channels on a dressed hero', () => {
  const { m, mesh } = built(RANGER);
  const ch = bakeChannels(mesh), partOf = (vi) => mesh.provenance[vi].part;
  it('are deterministic and in range', () => {
    expect(bakeChannels(mesh)).toEqual(ch);
    for (const k of ['occlusion', 'edge', 'height', 'rise']) for (const v of ch[k]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('the body under the pauldron is occluded more than the body in the open', () => {
    const V = mesh.vertices, worn = [], pauldron = [];
    mesh.provenance.forEach((pv, vi) => { if (/^adorn\./.test(pv.part)) worn.push(V[vi]); if (/pauldron$/.test(pv.part)) pauldron.push(V[vi]); });
    expect(pauldron.length).toBeGreaterThan(0);
    const near = (p, set, r) => set.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < r);
    const under = [], open = [];
    mesh.provenance.forEach((pv, vi) => { if (pv.part !== 'torso') return; if (near(V[vi], pauldron, 0.025)) under.push(ch.occlusion[vi]); else if (!near(V[vi], worn, 0.15)) open.push(ch.occlusion[vi]); });
    const mean = (a) => a.reduce((t, x) => t + x, 0) / a.length;
    expect(under.length).toBeGreaterThan(0); expect(open.length).toBeGreaterThan(0);
    expect(mean(under)).toBeGreaterThan(mean(open) + 0.1); expect(mean(under)).toBeGreaterThan(4 * mean(open));
  });
  it('a worn shell has rims; a limb\'s low-poly ring is not one; every part rises 0 → 1', () => {
    const of = (re, arr) => arr.filter((_, vi) => re.test(partOf(vi)));
    expect(Math.max(...of(/pauldron$/, [...ch.edge]))).toBeGreaterThan(0.5);
    const thigh = of(/^thighR$/, [...ch.edge]).sort((a, b) => a - b);
    expect(thigh[Math.floor(thigh.length / 2)]).toBeLessThan(0.1);
    const rise = of(/^upperArmR$/, [...ch.rise]);
    expect(Math.min(...rise)).toBe(0); expect(Math.max(...rise)).toBe(1);
  });
  it('the tint leaves emissive groups, stacks by product, and reads out its finishes', () => {
    const T = bakeTint(mesh, true, { glows: ['Leather'] });
    expect(T.length).toBe(mesh.faces.length);
    mesh.faces.forEach((_, fi) => { if (mesh.groups[fi] === 'Leather') expect(T[fi]).toBeNull(); });
    expect(bakeTint(mesh, undefined)).toBeNull();
    const half = T.map((f) => f && f.map(() => [0.5, 0.5, 0.5])), S = stackTints(half, T), fi = T.findIndex(Boolean);
    expect(S[fi][0][0]).toBeCloseTo(T[fi][0][0] * 0.5, 4);
    expect(stackTints(null, T)).toBe(T); expect(stackTints(T, null)).toBe(T);
    const R = bakeReadout(mesh, { finish: { Leather: 'scale' } });
    expect(R.finish.Leather).toBe('scale'); expect(R.finish.Iron).toBe('metal'); expect(R.finish.Top).toBe('cloth');
    expect(R.reach).toBeGreaterThan(0.04); expect(R.reach).toBeLessThan(0.09);
    expect(m.recipe.palette.Iron).toBeTruthy();
  });
});

describe('the bake on the World and the rig pack', () => {
  it('absent or false is byte-identical; on, the faces and the pack carry it per corner', async () => {
    const { m } = built(RANGER);
    const plain = await WORLD_KINDS.layered.resolve(m, { title: 't' });
    expect(JSON.stringify(await WORLD_KINDS.layered.resolve({ ...m, bake: false }, { title: 't' }))).toBe(JSON.stringify(plain));
    const baked = await WORLD_KINDS.layered.resolve({ ...m, bake: true }, { title: 't' });
    expect(baked.faces.length).toBe(plain.faces.length);
    const diff = baked.faces.filter((f, i) => JSON.stringify(f.cornerFills) !== JSON.stringify(plain.faces[i].cornerFills)).length;
    expect(diff).toBeGreaterThan(plain.faces.length / 4);
    const cols = (s) => s.figures.body.parts.map((P) => P?.col ?? null);
    expect(cols(baked)).not.toEqual(cols(plain));
    await expect(WORLD_KINDS.layered.resolve({ ...m, bake: { finish: { Top: 'velvet' } } }, { title: 't' })).rejects.toThrow(/'velvet' is not a finish/);
  }, 120000);
  it('the mint refuses a bad bake by name', async () => {
    await expect(createLayeredHandler({ recipe: { parts: {} }, bake: { strength: 3 } })).rejects.toThrow(/bake refused:\n - bake.strength/);
  });
});
