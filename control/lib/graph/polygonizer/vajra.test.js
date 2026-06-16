import { describe, it, expect } from 'vitest';
import {
  validateVajras,
  sampleVajra,
  makeVajraField,
  resolveVajraSpec,
  sdRoundCone,
  smin,
} from './vajra.js';
import { walkManjiTree3D, validateManjiTree3D, validateLeafMarkEndpoints } from './manji-program.js';
import { renderManjiTreeToSvg } from './manji-svg.js';

// A collinear triple along x: outer beads at ±4, hub at origin.
const TRIPLE = {
  proximal: { x: 4, y: 0, z: 0 },
  center: { x: 0, y: 0, z: 0 },
  distal: { x: -4, y: 0, z: 0 },
};
const EQUAL_RADII = { beads: { proximal: { radius: 1 }, center: { radius: 1 }, distal: { radius: 1 } } };

function ringRadius(ring) {
  // Mean distance of polyline vertices from the ring center.
  let sum = 0;
  for (const p of ring.polyline) {
    sum += Math.hypot(p.x - ring.center.x, p.y - ring.center.y, p.z - ring.center.z);
  }
  return sum / ring.polyline.length;
}

describe('vajra — validation', () => {
  it('passes a well-formed inline triple', () => {
    const errs = validateVajras([{ ...TRIPLE, ...EQUAL_RADII }], []);
    expect(errs).toEqual([]);
  });

  it('requires all three points', () => {
    const errs = validateVajras([{ proximal: TRIPLE.proximal, center: TRIPLE.center }], []);
    expect(errs.some((e) => e.includes('distal'))).toBe(true);
  });

  it('rejects a non-positive bead radius', () => {
    const errs = validateVajras([{ ...TRIPLE, beads: { center: { radius: 0 } } }], []);
    expect(errs.some((e) => e.includes('beads.center.radius'))).toBe(true);
  });

  it('rejects negative blend', () => {
    const errs = validateVajras([{ ...TRIPLE, blend: -1 }], []);
    expect(errs.some((e) => e.includes('blend'))).toBe(true);
  });

  it('rejects coincident points', () => {
    const errs = validateVajras([{ proximal: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, distal: TRIPLE.distal }], []);
    expect(errs.some((e) => e.includes('zero-length prong'))).toBe(true);
  });

  it('rejects an unknown extraction mode', () => {
    const errs = validateVajras([{ ...TRIPLE, extraction: 'spiral' }], []);
    expect(errs.some((e) => e.includes('extraction'))).toBe(true);
  });
});

describe('vajra — field', () => {
  it('is negative inside and positive far outside', () => {
    const field = makeVajraField(resolveVajraSpec({ ...TRIPLE, ...EQUAL_RADII }));
    expect(field({ x: 0, y: 0, z: 0 })).toBeLessThan(0);
    expect(field({ x: 2, y: 0, z: 0 })).toBeLessThan(0);
    expect(field({ x: 100, y: 100, z: 100 })).toBeGreaterThan(0);
  });

  it('blend:0 is the exact union of the two bulbs and two necks', () => {
    const resolved = resolveVajraSpec({ ...TRIPLE, ...EQUAL_RADII, blend: 0 });
    const field = makeVajraField(resolved);
    const p = { x: 1.5, y: 0.3, z: -0.2 };
    const proxBulb = Math.hypot(p.x - 4, p.y, p.z) - 1;
    const distBulb = Math.hypot(p.x + 4, p.y, p.z) - 1;
    const proxNeck = sdRoundCone(p, TRIPLE.center, TRIPLE.proximal, 1, 1);
    const distNeck = sdRoundCone(p, TRIPLE.center, TRIPLE.distal, 1, 1);
    expect(field(p)).toBeCloseTo(Math.min(proxBulb, distBulb, proxNeck, distNeck), 9);
  });

  it('smin degrades to hard min at k=0 and lowers the surface for k>0', () => {
    expect(smin(0.4, 0.9, 0)).toBeCloseTo(0.4, 9);
    expect(smin(0.4, 0.4, 0.5)).toBeLessThan(0.4);
  });
});

describe('vajra — ring extraction (field march)', () => {
  it('emits crossSections+1 closed rings of samples+1 vertices', () => {
    const { rings } = sampleVajra({ ...TRIPLE, ...EQUAL_RADII, crossSections: 12, samples: 24 });
    expect(rings.length).toBe(13);
    for (const ring of rings) {
      expect(ring.polyline.length).toBe(25);
      const a = ring.polyline[0];
      const b = ring.polyline[ring.polyline.length - 1];
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-6);
    }
  });

  it('equal radii give a capsule of the bead radius (blend:0)', () => {
    const { rings } = sampleVajra({ ...TRIPLE, ...EQUAL_RADII, blend: 0, crossSections: 24, samples: 48 });
    // Neck radius == bulb radius == 1, so a ring on the proximal prong
    // (world x≈2) sits at radius ≈ 1.
    const mid = rings.find((r) => Math.abs(r.center.x - 2) < 0.3);
    expect(mid).toBeTruthy();
    expect(ringRadius(mid)).toBeCloseTo(1, 1);
  });

  it('exposes the three bead positions as slots', () => {
    const { beadSlots } = sampleVajra({ ...TRIPLE, ...EQUAL_RADII });
    expect(beadSlots.proximal).toEqual(TRIPLE.proximal);
    expect(beadSlots.center).toEqual(TRIPLE.center);
    expect(beadSlots.distal).toEqual(TRIPLE.distal);
  });

  it('the bulb sits at the outer beads and the neck pinches at the center', () => {
    // Big outer bulbs (r=1), thin center screw (r=0.25), upright along z.
    const { rings } = sampleVajra({
      proximal: { x: 0, y: 0, z: 3 },
      center: { x: 0, y: 0, z: 0 },
      distal: { x: 0, y: 0, z: -3 },
      beads: { proximal: { radius: 1 }, center: { radius: 0.25 }, distal: { radius: 1 } },
      blend: 0.2, crossSections: 48, samples: 48,
    });
    const closestTo = (z) => rings.reduce((best, r) => (Math.abs(r.center.z - z) < Math.abs(best.center.z - z) ? r : best));
    const neck = ringRadius(closestTo(0));      // hub — the thin screw
    const bulb = ringRadius(closestTo(2.6));     // up in the proximal bulb
    expect(neck).toBeLessThan(0.4);
    expect(bulb).toBeGreaterThan(neck * 1.8);
  });
});

describe('vajra — sweep extraction (fallback)', () => {
  it('returns rings without throwing', () => {
    const { rings } = sampleVajra({ ...TRIPLE, ...EQUAL_RADII, extraction: 'sweep', crossSections: 12, samples: 24 });
    expect(rings.length).toBeGreaterThan(0);
    expect(rings[0].polyline.length).toBeGreaterThan(0);
  });
});

// ─── Phase 2: vajra as a first-class mandala-space citizen ─────────────

// A manji node with three Zenith-Nadir landmarks + an in-tree vajra child
// bound to them, plus a connection that binds to the vajra's emitted bead
// slots (must come AFTER the vajra in document order).
function citizenTree() {
  return {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'a', position: { x: 0, y: 0, z: 3 } },
      { id: 'b', position: { x: 0, y: 0, z: 0 } },
      { id: 'c', position: { x: 0, y: 0, z: -3 } },
    ],
    children: [
      {
        slot: 'b',
        node: {
          kind: 'vajra', id: 'bond',
          proximal: 'self/slot/a', center: 'self/slot/b', distal: 'self/slot/c',
          beads: { proximal: { radius: 1 }, center: { radius: 0.25 }, distal: { radius: 1 } },
        },
      },
      // Binds to the vajra's freshly-emitted bead landmarks.
      { slot: 'b', node: { kind: 'connection', id: 'tie', from: 'self/slot/bond-proximal', to: 'self/slot/bond-distal' } },
    ],
  };
}

describe('vajra — in-tree leaf authoring + slot emission', () => {
  it('emits as a leaf-mark and is shape-valid', () => {
    expect(validateManjiTree3D(citizenTree())).toEqual([]);
    const emitted = walkManjiTree3D(citizenTree(), () => null, {});
    const leaf = emitted.find((n) => n?.leafMark?.kind === 'vajra');
    expect(leaf).toBeTruthy();
    expect(leaf.leafMark.selfId).toBe('world');
  });

  it('emits the three bead positions as slots on the enclosing manji', () => {
    const emitted = walkManjiTree3D(citizenTree(), () => null, {});
    const world = emitted.find((n) => n.id === 'world');
    const slot = (id) => world.slots.find((s) => s.id === id);
    expect(slot('bond-proximal').worldPosition).toMatchObject({ x: 0, y: 0, z: 3 });
    expect(slot('bond-center').worldPosition).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(slot('bond-distal').worldPosition).toMatchObject({ x: 0, y: 0, z: -3 });
  });

  it('downstream leaves can bind to the emitted bead slots', () => {
    const emitted = walkManjiTree3D(citizenTree(), () => null, {});
    expect(validateLeafMarkEndpoints(emitted)).toEqual([]);
  });

  it('an anonymous (id-less) vajra renders but emits no slots', () => {
    const tree = citizenTree();
    delete tree.children[0].node.id;
    tree.children.pop(); // the connection referenced bond-*; drop it
    const emitted = walkManjiTree3D(tree, () => null, {});
    const world = emitted.find((n) => n.id === 'world');
    expect(world.slots.some((s) => s.emittedByVajra)).toBe(false);
  });

  it('shape validation rejects a vajra missing a point', () => {
    const tree = citizenTree();
    delete tree.children[0].node.distal;
    tree.children.pop();
    expect(validateManjiTree3D(tree).some((e) => e.includes('vajra.distal'))).toBe(true);
  });

  it('renders gold wave-space rings end-to-end from an in-tree vajra', () => {
    const svg = renderManjiTreeToSvg({ kind: 'manji-tree', dimensions: '3d', tree: citizenTree() });
    expect(svg).toContain('#c9a23a');
    expect(svg).toMatch(/<line /);
  });
});
