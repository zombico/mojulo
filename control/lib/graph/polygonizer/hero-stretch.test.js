// hero-stretch.test.js — the stretch audit reads the hero's shell: the bind is its own rest exactly, a bent knee shows in
// that knee's bands and nowhere on the other leg, the gaits come as labelled frames, and the audit is deterministic.
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered } from './station-loft-rig.js';
import { stretchAudit, shellRings, gaitFrames, STRETCH_REGIONS } from './hero-stretch.js';

const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male' }) });
const mesh = compileLayered(m.recipe, m.dials), R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
const legRings = (A, S) => A.rings.filter((r) => r.part === `thigh${S}` || r.part === `shank${S}`);
const bandLo = (list) => Math.min(...list.map((r) => r.band.min)), bandHi = (list) => Math.max(...list.map((r) => r.band.max));

describe('the stretch audit', () => {
  it('reads every closed part as rings in its slot order, the regions among them', () => {
    const rings = shellRings(mesh, m.recipe);
    expect(rings.length).toBeGreaterThan(50);
    const thigh = rings.filter((r) => r.part === 'thighR');
    expect(thigh.map((r) => r.k)).toEqual(thigh.map((_, i) => i));
    expect(thigh[0].idx.length).toBe(m.recipe.parts.thighR.slots.length);
    const A = stretchAudit(mesh, skin, R, m.recipe, [{ label: 'bind', nodes: R.joints }]);
    expect(Object.keys(A.regions).sort()).toEqual(Object.keys(STRETCH_REGIONS).sort());
  }, 120_000);

  it('the bind is its own rest: every ring and band reads 1, no twist, no fold', () => {
    const A = stretchAudit(mesh, skin, R, m.recipe, [{ label: 'bind', nodes: R.joints }]);
    for (const r of A.rings) {
      expect(Math.abs(r.area.min - 1)).toBeLessThan(1e-9);
      expect(Math.abs(r.pinch.min - 1)).toBeLessThan(1e-9);
      expect(Math.abs(r.twist.max)).toBeLessThan(1e-6);
      expect(r.band.folds).toBe(0);
      if (r.k < r.n - 1) { expect(Math.abs(r.band.min - 1)).toBeLessThan(1e-9); expect(Math.abs(r.band.max - 1)).toBeLessThan(1e-9); }
    }
  }, 120_000);

  it('a bent knee shows in its own bands (the crease compressed, the far side stretched), the other leg as it stands', () => {
    const stand = stretchAudit(mesh, skin, R, m.recipe, [{ label: 'stand', pose: { support: 'L' } }]);
    const bent = stretchAudit(mesh, skin, R, m.recipe, [{ label: 'bent', pose: { support: 'L', kneeR: 90 } }]);
    expect(bandLo(legRings(bent, 'R'))).toBeLessThan(bandLo(legRings(stand, 'R')) - 0.1);
    expect(bandHi(legRings(bent, 'R'))).toBeGreaterThan(bandHi(legRings(stand, 'R')) + 0.3);
    expect(bandLo(legRings(bent, 'L'))).toBeCloseTo(bandLo(legRings(stand, 'L')), 9);
    expect(bandHi(legRings(bent, 'L'))).toBeCloseTo(bandHi(legRings(stand, 'L')), 9);
    expect(bent.regions.knee.bandMin.at).toBe('bent');
  }, 120_000);

  it('the gaits come as labelled frames over their cycles, and the audit is deterministic', () => {
    const frames = gaitFrames(R, { gaits: ['walk'], samples: 4 });
    expect(frames.map((f) => f.label)).toEqual(['walk 0/4', 'walk 1/4', 'walk 2/4', 'walk 3/4']);
    const a = stretchAudit(mesh, skin, R, m.recipe, frames), b = stretchAudit(mesh, skin, R, m.recipe, gaitFrames(R, { gaits: ['walk'], samples: 4 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.frames).toBe(4);
    expect(a.worst.bandMax.at).toMatch(/^walk \d\/4$/);
  }, 120_000);
});
