// The sphinx (sphinx-form.js): a ring plan that expands and closes; a recumbent lion in the Great Sphinx's proportions
// wearing the hero's landmark head (no hair, no beard) in a nemes with the uraeus; the docs' worked plan is this form.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { sphinxPlan, SPHINX_PALETTE, criosphinxPlan } from './sphinx-form.js';
import { bullPlan } from './bull-form.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';

const box = (mesh, parts) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  mesh.vertices.forEach((v, i) => { if (parts && !parts.some((p) => mesh.provenance[i].part === p || mesh.provenance[i].part.startsWith(p))) return; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } });
  return { lo, hi };
};

describe('the sphinx', () => {
  const recipe = expandPlan(sphinxPlan()), mesh = compileLayered(recipe);
  it('expands deterministically, every part closes, and it wears the carved head in a nemes, beardless', () => {
    expect(JSON.stringify(expandPlan(sphinxPlan()))).toBe(JSON.stringify(recipe));
    expect(Object.entries(auditLayered(mesh)).filter(([, r]) => !r.pass).map(([n]) => n)).toEqual([]);
    for (const p of ['body', 'forelegR', 'forelegL', 'hindlegR', 'tail', 'nemesCap', 'nemesR', 'nemesL', 'lappetR', 'queue', 'uraeus', 'cranium', 'jaw', 'eyeR', 'noseR'].filter((n) => n !== 'noseR')) expect(recipe.parts[p], p).toBeTruthy();
    expect(Object.keys(recipe.parts).some((n) => /beard|hair/i.test(n))).toBe(false);
  });
  it("lies as Giza's does: long and low, the forelegs reaching forward, the head over the breast, the belly on the floor", () => {
    const all = box(mesh), body = box(mesh, ['body']), head = box(mesh, ['cranium', 'jaw']), fore = box(mesh, ['forelegR']);
    const L = all.hi[1] - all.lo[1], H = all.hi[2] - all.lo[2];
    expect(L / H).toBeGreaterThan(3.2); expect(L / H).toBeLessThan(4.2);              // 73 m long, 20 m high
    expect(all.lo[2]).toBeGreaterThan(-1e-3); expect(body.lo[2]).toBeLessThan(0.02);    // lying on its belly
    expect(fore.hi[1]).toBeGreaterThan(head.hi[1]);                                      // the paws reach past the face
    expect(head.lo[2]).toBeGreaterThan(body.hi[2] * 0.85);                               // the head stands above the shoulders
    expect(Math.abs(all.lo[0] + all.hi[0])).toBeLessThan(0.05);                          // near-mirror (the tail lies on one flank)
  });
  it('scales the whole, and takes a palette over its own', () => {
    const big = compileLayered(expandPlan(sphinxPlan({ scale: 2 })));
    expect((box(big).hi[2] - box(big).lo[2]) / (box(mesh).hi[2] - box(mesh).lo[2])).toBeCloseTo(2, 1);
    expect(sphinxPlan({ palette: { Lion: '#ffffff' } }).palette.Lion).toBe('#ffffff');
    expect(sphinxPlan().palette.Nemes).toBe(SPHINX_PALETTE.Nemes);
  });
  it("the docs' worked plan is the form", () => {
    const file = new URL('../../../../docs/examples/ring-plans/sphinx.plan.json', import.meta.url);
    if (!existsSync(file)) return;   // docs/ is not in the npm package
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(sphinxPlan(), null, 1) + '\n');
  });
});

describe('the criosphinx and the bull', () => {
  it("the criosphinx: Karnak's size, a ram's head with its coiled horns, the king between the paws, closed", () => {
    const recipe = expandPlan(criosphinxPlan()), mesh = compileLayered(recipe);
    expect(Object.entries(auditLayered(mesh)).filter(([, r]) => !r.pass).map(([n]) => n)).toEqual([]);
    const all = box(mesh), king = box(mesh, ['king']), head = box(mesh, ['head']), horn = box(mesh, ['hornR']);
    expect(all.hi[1] - all.lo[1]).toBeGreaterThan(4.6); expect(all.hi[2]).toBeCloseTo(2.72, 1);
    expect(king.lo[2]).toBeLessThan(0.01); expect(king.hi[1]).toBeGreaterThan(head.lo[1]);       // standing under the chin
    expect(horn.hi[0]).toBeGreaterThan(head.hi[0]);                                               // the coil stands out of the skull
    const file = new URL('../../../../docs/examples/ring-plans/criosphinx.plan.json', import.meta.url);
    if (existsSync(file)) expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(criosphinxPlan(), null, 1) + '\n');
  });
  it('the bull: life size, the hump over the shoulders, the head forward at shoulder height, the horns up, closed', () => {
    const recipe = expandPlan(bullPlan()), mesh = compileLayered(recipe);
    expect(Object.entries(auditLayered(mesh)).filter(([, r]) => !r.pass).map(([n]) => n)).toEqual([]);
    const body = box(mesh, ['barrel']), hump = box(mesh, ['hump']), head = box(mesh, ['head']), horn = box(mesh, ['hornR']), hooves = box(mesh, ['foreHoof', 'hindHoof']);
    expect(body.hi[1] - body.lo[1]).toBeGreaterThan(2.0); expect(body.hi[1] - body.lo[1]).toBeLessThan(2.8);
    expect(hump.hi[2]).toBeGreaterThan(body.hi[2]);
    expect(head.hi[1]).toBeGreaterThan(body.hi[1]); expect(horn.hi[2]).toBeGreaterThan(head.hi[2] + 0.2);
    expect(hooves.lo[2]).toBeLessThan(0.01);
    const file = new URL('../../../../docs/examples/ring-plans/bull.plan.json', import.meta.url);
    if (existsSync(file)) expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(bullPlan(), null, 1) + '\n');
  });
});
