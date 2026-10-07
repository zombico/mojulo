// The horse (horse-form.js): a ring plan that expands, closes and measures as a light riding horse; the docs' worked
// plan (docs/examples/ring-plans/horse.plan.json) is this form byte for byte.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { horsePlan, HORSE_PALETTE } from './horse-form.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';

const box = (mesh, parts) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  mesh.vertices.forEach((v, i) => { if (parts && !parts.some((p) => mesh.provenance[i].part.startsWith(p))) return; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } });
  return { lo, hi };
};

describe('the horse', () => {
  const recipe = expandPlan(horsePlan()), mesh = compileLayered(recipe);
  it('expands deterministically and every part closes', () => {
    expect(JSON.stringify(expandPlan(horsePlan()))).toBe(JSON.stringify(recipe));
    expect(Object.entries(auditLayered(mesh)).filter(([, r]) => !r.pass).map(([n]) => n)).toEqual([]);
    for (const p of ['barrel', 'neck', 'crest', 'head', 'tail0', 'earR', 'earL', 'foreHoofR', 'hindHoofL']) expect(recipe.parts[p], p).toBeTruthy();
  });
  it('measures as a horse: 1.6 m at the withers, as long as it is high, the belly at half height, the head carried above', () => {
    const body = box(mesh, ['barrel']), head = box(mesh, ['head']), hooves = box(mesh, ['foreHoof', 'hindHoof']);
    expect(body.hi[2]).toBeGreaterThan(1.55); expect(body.hi[2]).toBeLessThan(1.7);           // the withers
    expect(body.lo[2]).toBeGreaterThan(0.8); expect(body.lo[2]).toBeLessThan(0.95);           // the belly
    expect(body.hi[1] - body.lo[1]).toBeGreaterThan(1.5); expect(body.hi[1] - body.lo[1]).toBeLessThan(1.9);   // shoulder to buttock
    expect(head.hi[2]).toBeGreaterThan(body.hi[2] + 0.3); expect(head.lo[1]).toBeGreaterThan(body.hi[1] - 0.1);
    expect(hooves.lo[2]).toBeLessThan(0.01);                                                    // on the floor
    expect(Math.abs(box(mesh).lo[0] + box(mesh).hi[0])).toBeLessThan(1e-9);                     // mirror-exact
  });
  it('scales about the floor and takes a palette over its own', () => {
    const big = compileLayered(expandPlan(horsePlan({ scale: 1.1 })));
    expect(box(big, ['barrel']).hi[2] / box(mesh, ['barrel']).hi[2]).toBeCloseTo(1.1, 2);
    expect(horsePlan({ palette: { Body: '#ffffff' } }).palette).toEqual({ ...HORSE_PALETTE, Body: '#ffffff' });
  });
  it("the docs' worked plan is the form", () => {
    const file = new URL('../../../../docs/examples/ring-plans/horse.plan.json', import.meta.url);
    if (!existsSync(file)) return;   // docs/ is not in the npm package
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(horsePlan(), null, 1) + '\n');
  });
});
