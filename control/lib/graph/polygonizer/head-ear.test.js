// head-ear — the ear on the landmark and the anime head: the side shape traced from the operator's sketch (wider above
// than below, taller than wide), a thin plate angled off the head, the bowl dipping below the rim; closed on both heads,
// both registers, both sides, the left the right's mirror; the anime head's studio-exact face keeps the studio's ear.
import { describe, it, expect } from 'vitest';
import { earMesh } from './head-ear.js';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';

const ear = (o = {}) => earMesh({ origin: [0, 0, 0], side: 1, height: 1, ...o });
const P = (m) => Object.values(m.points);

describe('the ear', () => {
  it('the side shape: taller than wide, wider over its upper half than its lower', () => {
    for (const style of ['western', 'anime']) {
      const pts = P(ear({ style, tilt: 0 })), wAt = (lo, hi) => { const s = pts.filter((p) => p[2] >= lo && p[2] < hi).map((p) => p[1]); return Math.max(...s) - Math.min(...s); };
      const ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
      expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(1.4 * (Math.max(...ys) - Math.min(...ys)));
      expect(wAt(0.1, 0.4)).toBeGreaterThan(wAt(-0.4, -0.1));
    }
  });

  it('a plate: thin at its edge, angled off the head toward its back; the bowl below the rim', () => {
    const m = ear({ tilt: 0 }), back = m.points.r0_5, edge = m.points.r1_5, rim = m.points.r2_5;   // the back of the outline
    expect(edge[0] - back[0]).toBeLessThan(0.1);
    expect(m.points.r1_5[0]).toBeGreaterThan(m.points.r1_0[0]);   // the back edge stands further off the head than the front
    expect(m.points.bowl[0]).toBeLessThan(rim[0] - 0.05);
    expect(m.groups.filter((g) => g !== 'Skin')).toHaveLength(0);
    expect(new Set(ear({ inner: 'EarInner' }).groups)).toEqual(new Set(['Skin', 'EarInner']));
  });

  it('the left ear is the right\'s mirror', () => {
    const R = ear(), L = ear({ side: -1 });
    for (const id of Object.keys(R.points)) expect(L.points[id]).toEqual([-R.points[id][0] + 0, R.points[id][1], R.points[id][2]]);
  });

  for (const head of ['landmark', 'anime']) for (const register of ['round', 'lowpoly']) it(`${head}, ${register}: both ears closed on the hero`, () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head, register }) });
    const audit = auditLayered(compileLayered(m.recipe));
    for (const n of ['earR', 'earL']) { expect(m.recipe.parts[n]).toBeDefined(); expect(audit[n]?.pass, n).toBe(true); }
  }, 60000);

  it('the anime head\'s studio-exact face keeps the studio\'s ear', () => {
    const faces = (sculpt) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', ...(sculpt === false ? { sculpt: false } : {}) }) }); return Object.keys(m.recipe.parts.earR.faces ?? m.recipe.parts.earR.offsets).length; };
    expect(faces(false)).not.toBe(faces());
  }, 60000);
});
