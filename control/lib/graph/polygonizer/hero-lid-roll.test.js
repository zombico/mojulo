// The realistic lid ROLLS shut (hero-relational-head.js SKIN_FOLLOW `roll`, `cornerCap`) over a brow that is one section
// (realistic laws 13, head-relational-eye.js SEAT `section`): on one realistic hero's one skin, a blink spreads the shut
// lid's length over the whole strip from the margin to the fold's lip (the skin under the fold unrolled), so no band of
// it stretches past twice and tears into a sawtooth, and the inner corner is not swung through its ill-posed turn; the
// brow's section cuts no crease, where the seat of laws 11 and 12 still does.
import { describe, it, expect } from 'vitest';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';
import { oneSkinFollow } from './hero-relational-head.js';
import { relationalHead } from './head-relational.js';
import { eyeRig, browBridge } from './head-relational-eye.js';

const SPEC = { cast: 'female', form: 'realistic', face: { seed: 11, ethnicity: 'western' } };

/** each edge of the right eye's skin a blink moves (at least 0.2 mm long: the shelf's edge nets slivers): its length shut over open */
function stretch(recipe) {
  const P = recipe.parts, fit = recipe.headFit, skin = P.headSkin.mesh;
  const words = { sex: fit.sex, ...(fit.relations ? { relations: fit.relations } : {}), ...(fit.eyes ? { eyes: fit.eyes } : {}), ...(fit.tune ? { tune: fit.tune } : {}), ...(fit.seat ? { seat: fit.seat } : {}) };
  const blend = P.headSkin.bind?.blend, jawShare = blend ? Object.fromEntries(Object.keys(skin.points).map((id) => [id, blend[`st0.${id}`]?.jaw ?? 0])) : null;
  const open = skin.points, shut = oneSkinFollow({ ...words, fit: { k: fit.k, ty: fit.ty, men: fit.men }, actions: { blink: 1 }, points: open, normals: skin.normals, faces: skin.faces, jawShare });
  const moved = (id) => Math.hypot(...[0, 1, 2].map((a) => shut[id][a] - open[id][a])) > 0.001, L = (A, a, b) => Math.hypot(...[0, 1, 2].map((k) => A[a][k] - A[b][k]));
  const out = [], seen = new Set();
  for (const t of Object.values(skin.faces)) {
    if (!t.every((id) => open[id] && shut[id]) || !t.some(moved) || open[t[0]][0] <= 0) continue;
    for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3], k = a < b ? `${a}|${b}` : `${b}|${a}`; if (seen.has(k)) continue; seen.add(k); const l0 = L(open, a, b); if (l0 > 2e-4) out.push(L(shut, a, b) / l0); }
  }
  return out;
}

describe('the realistic lid rolls shut over a brow of one section (laws 13)', () => {
  const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord(SPEC) }).recipe;
  it('spreads the shut lid over its whole strip: no band stretched past twice, the inner corner unswung', () => {
    expect(recipe.headFit.seat).toBe(2);
    const S = stretch(recipe);
    // (gathered in one band, 201 edges stretched past twice and the worst seven times; the corner swung, six. Spread, some
    // 40 to 65 as the face around the eye is tuned: the line holds the principle, half the gathered band's, not a count)
    expect(S.filter((x) => x > 2).length).toBeLessThan(100);
    expect(Math.max(...S)).toBeLessThan(4);
  });
  it('cuts no crease under the brow at seat 2; the seat of laws 11 and 12 keeps its crease', () => {
    const H = relationalHead({ sex: 'female', seat: true }), P = H.relational.points, arcs = browBridge(P, {}, { seat: true }).arcs;
    const at = (seat) => H.relational.eyeRigs.map((e) => eyeRig(P, e.side, e.channels, H.relations.fissure, arcs[e.side], H.relations.lidSplit, { seat }).crease);
    expect(at(2).every((c) => !c)).toBe(true);
    expect(at(true).every((c) => typeof c === 'function')).toBe(true);
  });
});
