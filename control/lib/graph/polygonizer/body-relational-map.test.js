// body-relational-map.test.js — the body-part map: every re-sampled skin point of the realistic body labelled by body
// part and muscle from the field's own blend; the sides one another's mirror; the parts where the anatomy puts them; the
// same map twice. One build per procedure: the male (no bust) and the female (the breast its own part).
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { validateRig } from './station-loft-rig.js';
import { physique } from './body-relational.js';
import { bodyPartMap, BODY_PARTS } from './body-relational-map.js';

const mapOf = (cast) => {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic' }) });
  return { m, map: bodyPartMap(m.recipe, validateRig(m.recipe.rig), physique(cast === 'female' ? 'shalla' : 'norrin', 'athletic')) };
};

describe('the body-part map', () => {
  it('labels every re-sampled point, the sides mirrored, the parts where the anatomy puts them', () => {
    const { m, map } = mapOf('male');
    const ids = Object.keys(map.part);
    for (const k of ['torso', 'pelvis', 'neck', 'upperArmR', 'thighL']) expect(ids.filter((id) => id.startsWith(`${k}/`)).length, k).toBe(m.recipe.parts[k].stations.length * m.recipe.parts[k].slots.length);
    for (const p of Object.values(map.part)) expect(BODY_PARTS).toContain(p);
    // the left limb and the torso's left half read as the right's mirror (a mirrored limb's slot swaps its side too)
    const swap = (id) => id.replace(/([RL])$/, (c) => (c === 'R' ? 'L' : 'R'));
    for (const id of ids.filter((x) => /^upperArmR\//.test(x))) expect(map.part[swap(id.replace('upperArmR/', 'upperArmL/'))], id).toBe(map.part[id]);
    for (const id of ids.filter((x) => /^torso\/.*R$/.test(x))) expect(map.part[id.replace(/R$/, 'L')], id).toBe(map.part[id]);
    // where they are: the chest in front above the abdomen, the seat behind under the lower back, the knee at the thigh's end
    const at = (part, pick) => ids.filter((id) => map.part[id] === part).map((id) => { const [p, rest] = id.split('/'), [st, sl] = rest.split('.'); return m.recipe.parts[p].stations.find((s) => s.id === st).points[sl]; }).map(pick);
    const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(mean(at('chest', (q) => q[2]))).toBeGreaterThan(mean(at('abdomen', (q) => q[2])));
    expect(mean(at('chest', (q) => q[1]))).toBeGreaterThan(0);
    expect(mean(at('seat', (q) => q[1]))).toBeLessThan(0);
    expect(mean(at('seat', (q) => q[2]))).toBeLessThan(mean(at('lowerBack', (q) => q[2])));
    expect(mean(at('knee', (q) => q[2]))).toBeLessThan(mean(at('thigh', (q) => q[2])));
    expect(ids.some((id) => map.part[id] === 'hidden')).toBe(true);   // the pelvis under the crotch, the arm's top under the cap
    expect(Object.values(map.part)).not.toContain('breast');
  }, 120_000);

  it('the female\'s breasts are their own part, and the map is the same twice', () => {
    const { m, map } = mapOf('female');
    expect(Object.values(map.part).filter((p) => p === 'breast').length).toBeGreaterThan(20);
    expect(JSON.stringify(bodyPartMap(m.recipe, validateRig(m.recipe.rig), physique('shalla', 'athletic')))).toBe(JSON.stringify(map));
  }, 120_000);
});
