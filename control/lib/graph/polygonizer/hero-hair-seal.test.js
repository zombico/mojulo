// The realistic hair SEALED against the neck and the body (realistic laws 14, hero-head-layers.js HAIR_SEAL): on one
// realistic hero with hair that falls past the jaw, no hair point lies inside the neck, the trunk, the upper arms or the
// head's skin below its base, at rest and with the head turned and tilted as the face's head layer turns it
// (face-acting/head.js headBones, an engine's additive layer from the rest pose); the hair near the skin rides the skin's
// own bones (never the jaw's), and a stroke that runs into the body stops there, never wrapped round the throat. A hero
// stamped with laws 13 keeps the hair it had.
import { describe, it, expect } from 'vitest';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, skinLayered } from './station-loft-rig.js';
import { headBones } from '../face-acting/head.js';

const SPEC = { cast: 'female', form: 'realistic', face: { seed: 11, ethnicity: 'western' } };
const HAIR = new Set(['hair', 'hairCards']), BODY = new Set(['neck', 'torso', 'upperArmR', 'upperArmL', 'headSkin']);
const recipeAt = (laws) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ ...SPEC, physique: { from: 'athletic', laws } }) }).recipe;

/** the hair points inside the body (deeper than 1 mm under the nearest body vertex, along its normal), at the head's turn */
function inside(recipe, turn) {
  const mesh = compileLayered(recipe), R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R), part = (i) => mesh.provenance[i].part;
  const heads = Object.fromEntries(R.bones.map((b) => [b.id, R.joints[b.head]]));
  const B = turn ? headBones(heads, { yaw: [turn.yaw ?? 0], pitch: [turn.pitch ?? 0], roll: [turn.roll ?? 0] }) : {};
  const mat = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
  const V = skinLayered(mesh, skin, R.bones.map((b) => { const h = heads[b.id], M = B[b.id]; return { restHead: h, head: M?.d ? h.map((v, k) => v + M.d[k]) : h, m: M?.r ? mat(M.r.slice(0, 4)) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }; }));
  const N = V.map(() => [0, 0, 0]);
  for (const [a, b, c] of mesh.faces) { if (!BODY.has(part(a))) continue; const u = V[b].map((x, k) => x - V[a][k]), v = V[c].map((x, k) => x - V[a][k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; for (const x of [a, b, c]) for (let k = 0; k < 3; k++) N[x][k] += n[k]; }
  const cell = 0.02, key = (p) => p.map((x) => Math.floor(x / cell)).join(','), grid = new Map();
  V.forEach((p, i) => { if (BODY.has(part(i))) (grid.get(key(p)) ?? grid.set(key(p), []).get(key(p))).push(i); });
  let count = 0;
  V.forEach((p, i) => {
    if (!HAIR.has(part(i))) return;
    const c = p.map((x) => Math.floor(x / cell)); let j = -1, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) for (const q of grid.get(`${c[0] + a},${c[1] + b},${c[2] + d}`) ?? []) { const e = (V[q][0] - p[0]) ** 2 + (V[q][1] - p[1]) ** 2 + (V[q][2] - p[2]) ** 2; if (e < bd) { bd = e; j = q; } }
    if (j < 0) return;
    const l = Math.hypot(...N[j]) || 1, s = ((p[0] - V[j][0]) * N[j][0] + (p[1] - V[j][1]) * N[j][1] + (p[2] - V[j][2]) * N[j][2]) / l;
    if (s < -0.001) count++;
  });
  return count;
}

describe('the realistic hair sealed against the neck and the body (laws 14)', () => {
  const sealed = recipeAt(14), before = recipeAt(13);
  it('lies outside the neck, the trunk and the upper neck at rest, and as the head turns and tilts', () => {
    // (a single point at the neck's buried foot reads as inside it: a few, never a sheet)
    for (const turn of [null, { yaw: -25 }, { yaw: 25 }, { roll: 12 }, { pitch: -15 }]) expect(inside(sealed, turn)).toBeLessThan(4);
  });
  it('rides the skin it lies on: a long lock\'s foot by the trunk takes the trunk\'s bones, never the jaw\'s', () => {
    const W = Object.values(sealed.parts.hair.boneWeights ?? {});
    expect(W.some((w) => w.some(([b]) => b === 'torso') && w.some(([b]) => !['head', 'neck', 'torso'].includes(b)))).toBe(true);
    expect(W.some((w) => w.some(([b]) => b === 'jaw'))).toBe(false);
  });
  it('stops a stroke where it meets the body: none wraps round the throat and down the chest', () => {
    const mesh = compileLayered(sealed);
    const ahead = mesh.vertices.filter((v, i) => HAIR.has(mesh.provenance[i].part) && v[1] > 0.045 && v[2] < 1.37 && Math.abs(v[0]) < 0.09);
    expect(ahead).toEqual([]);
  });
  it('keeps a hero stamped with laws 13 as it was: its hair falls by the height\'s rule alone', () => {
    const W = Object.values(before.parts.hair.boneWeights ?? {});
    expect(W.every((w) => w.every(([b]) => ['head', 'neck', 'torso'].includes(b)))).toBe(true);
  });
});
