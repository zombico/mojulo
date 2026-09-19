/**
 * figure-attach — gear on landmarks, riding the pose.
 *
 * The cases are what an accessory actually has to get right: it lands ON the landmark, it is
 * scaled to the figure rather than to its own authored units, `anchor` decides which of its own
 * points touches (a helmet seats by its BASE, not its middle), it follows the armature when the
 * pose moves, and a bad mount degrades to gearless instead of throwing.
 */
import { describe, it, expect } from 'vitest';
import { buildAttachments, lowerPropFaces, validateAttachments } from './figure-attach.js';

// A 2-unit cube as a prop, authored well away from its own origin so a naive build that forgets
// to re-anchor lands it in the wrong place and the test notices.
const CUBE = {
  extrudes: [{
    id: 'box',
    profile: { rect: { w: 2, h: 2 } },
    axisFrom: { x: 10, y: 10, z: 10 },
    axisTo: { x: 10, y: 10, z: 12 },
    tint: '#888888',
  }],
};

const NODES = {
  headTop: { x: 0, y: 0, z: 1.7 },
  wristL: { x: -0.4, y: 0, z: 1.0 },
  elbowL: { x: -0.4, y: 0, z: 1.3 },
};

const boundsOf = (stacks) => {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const st of stacks) for (const f of st.faces) for (const q of f.corners) {
    const p = [q.x, q.y, q.z];
    for (let i = 0; i < 3; i++) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; }
  }
  return { lo, hi, mid: [0, 1, 2].map((i) => (lo[i] + hi[i]) / 2) };
};

describe('lowerPropFaces', () => {
  it('lowers a workbench recipe to faces without importing the world chain', () => {
    expect(lowerPropFaces(CUBE).length).toBeGreaterThan(0);
  });
  it('carries a lathe\'s tint, which the lathe lowerer reads from OPTS not the spec', () => {
    const turned = { lathes: [{ id: 't', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], tint: '#c9a23f' }] };
    const plain = { lathes: [{ ...turned.lathes[0], tint: undefined }] };
    const fills = new Set(lowerPropFaces(turned).map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(0);
    // The shaded fills differ from the untinted default — the colour actually reached the lowerer.
    expect([...fills].join()).not.toBe([...new Set(lowerPropFaces(plain).map((f) => f.fill))].join());
  });

  it('is empty, not thrown, for a recipe with no monomers', () => {
    expect(lowerPropFaces({})).toEqual([]);
    expect(lowerPropFaces(null)).toEqual([]);
  });
});

describe('buildAttachments', () => {
  it('centres the prop on a named landmark, whatever its authored origin', () => {
    const out = buildAttachments(NODES, [{ id: 'hat', recipe: CUBE, at: 'headTop', size: 0.4 }], 1);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('attach:hat');
    const b = boundsOf(out);
    expect(b.mid[0]).toBeCloseTo(0, 5);
    expect(b.mid[1]).toBeCloseTo(0, 5);
    expect(b.mid[2]).toBeCloseTo(1.7, 5);
  });

  it('scales to `size` in STAND units, not to the prop\'s own units', () => {
    const b = boundsOf(buildAttachments(NODES, [{ recipe: CUBE, at: 'headTop', size: 0.4 }], 1));
    expect(b.hi[2] - b.lo[2]).toBeCloseTo(0.4, 5);   // authored 2 units tall → 0.4
  });

  it('seats by its BASE when asked — how a helmet sits on a head', () => {
    const b = boundsOf(buildAttachments(NODES, [{ recipe: CUBE, at: 'headTop', size: 0.4, anchor: 'base' }], 1));
    expect(b.lo[2]).toBeCloseTo(1.7, 5);             // bottom AT the landmark
    expect(b.hi[2]).toBeCloseTo(2.1, 5);             // and it rises from there
  });

  it('lerps along a bone and honours `offset`', () => {
    const b = boundsOf(buildAttachments(NODES, [{ recipe: CUBE, at: ['elbowL', 'wristL'], t: 0.5, size: 0.2, offset: [0, 0.1, 0] }], 1));
    expect(b.mid[2]).toBeCloseTo(1.15, 5);           // midway elbow(1.3) → wrist(1.0)
    expect(b.mid[1]).toBeCloseTo(0.1, 5);            // pushed forward
  });

  it('RIDES THE POSE — the same spec follows the armature when the arm moves', () => {
    const spec = [{ recipe: CUBE, at: ['elbowL', 'wristL'], size: 0.2 }];
    const rest = boundsOf(buildAttachments(NODES, spec, 1));
    const raised = boundsOf(buildAttachments({ ...NODES, elbowL: { x: -0.4, y: 0, z: 1.9 }, wristL: { x: -0.4, y: 0, z: 2.3 } }, spec, 1));
    expect(raised.mid[2]).toBeCloseTo(2.1, 5);
    expect(raised.mid[2] - rest.mid[2]).toBeGreaterThan(0.9);
  });

  it('align:"bone" turns the prop onto the bone direction', () => {
    // A horizontal forearm: the prop's long axis should follow x, not z.
    const nodes = { elbowL: { x: 0, y: 0, z: 1 }, wristL: { x: 0.6, y: 0, z: 1 } };
    const tall = { extrudes: [{ profile: { rect: { w: 0.5, h: 0.5 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 4 } }] };
    const b = boundsOf(buildAttachments(nodes, [{ recipe: tall, at: ['elbowL', 'wristL'], size: 0.8, fit: 'max', align: 'bone' }], 1));
    expect(b.hi[0] - b.lo[0]).toBeGreaterThan(b.hi[2] - b.lo[2]);
  });

  it('applies the render scale', () => {
    const one = boundsOf(buildAttachments(NODES, [{ recipe: CUBE, at: 'headTop', size: 0.4 }], 1));
    const twelve = boundsOf(buildAttachments(NODES, [{ recipe: CUBE, at: 'headTop', size: 0.4 }], 12));
    expect(twelve.mid[2]).toBeCloseTo(one.mid[2] * 12, 4);
  });

  it('degrades to gearless rather than throwing', () => {
    expect(buildAttachments(NODES, [{ recipe: CUBE, at: 'noSuchLandmark', size: 0.4 }], 1)).toEqual([]);
    expect(buildAttachments(NODES, [{ recipe: {}, at: 'headTop' }], 1)).toEqual([]);
    expect(buildAttachments(NODES, null, 1)).toEqual([]);
    expect(buildAttachments(null, [{ recipe: CUBE, at: 'headTop' }], 1)).toEqual([]);
  });

  it('is deterministic', () => {
    const spec = [{ id: 'a', recipe: CUBE, at: 'headTop', size: 0.4, rotate: [15, 0, 30] }];
    expect(buildAttachments(NODES, spec, 12)).toEqual(buildAttachments(NODES, spec, 12));
  });
});

describe('validateAttachments', () => {
  const names = new Set(Object.keys(NODES));
  it('accepts a good spec and passes null through', () => {
    expect(validateAttachments([{ recipe: CUBE, at: 'headTop', size: 0.3 }], names)).toEqual([]);
    expect(validateAttachments(null, names)).toEqual([]);
  });
  it('names a bad landmark, a missing recipe and a bad enum', () => {
    const e = validateAttachments([{ recipe: CUBE, at: 'elbow' }, { at: 'headTop' }, { recipe: CUBE, at: 'headTop', anchor: 'middle' }], names);
    expect(e.join(' ')).toMatch(/unknown landmark 'elbow'/);
    expect(e.join(' ')).toMatch(/\.recipe: required/);
    expect(e.join(' ')).toMatch(/anchor: must be one of/);
  });
  it("rejects align:'bone' without a bone to take a direction from", () => {
    expect(validateAttachments([{ recipe: CUBE, at: 'headTop', align: 'bone' }], names).join(' ')).toMatch(/needs `at` to be a \[a, b\] pair/);
  });
});
