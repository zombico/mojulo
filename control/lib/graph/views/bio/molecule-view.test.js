import { describe, expect, it } from 'vitest';

import { planMoleculeScene, assembleMoleculeScene } from './molecule-view.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

// a small non-degenerate molecule: distinct per-axis spread (x > y > z) so PCA has a
// well-defined principal axis, and it's 3D enough to exercise chirality framing.
const MOL = {
  kind: 'molecule-view',
  atoms: [
    { symbol: 'C', pos: [0, 0, 0] },
    { symbol: 'O', pos: [3, 0, 0] },
    { symbol: 'N', pos: [0, 2, 0] },
    { symbol: 'H', pos: [0, 0, 1] },
    { symbol: 'H', pos: [1, 1, 1] },
  ],
  bonds: [
    { from: 0, to: 1, order: 2 },
    { from: 0, to: 2, order: 1 },
    { from: 0, to: 3, order: 1 },
    { from: 0, to: 4, order: 1 },
  ],
};

const axisVariance = (atoms) => {
  const n = atoms.length;
  return [0, 1, 2].map((k) => {
    const mean = atoms.reduce((s, a) => s + a.pos[k], 0) / n;
    return atoms.reduce((s, a) => s + (a.pos[k] - mean) ** 2, 0) / n;
  });
};

describe('planMoleculeScene', () => {
  it('is deterministic — same recipe yields byte-identical faces', () => {
    const a = planMoleculeScene(MOL), b = planMoleculeScene(MOL);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
  });

  it('emits lit sphere faces per atom and rod faces per bond, with a pick for each', () => {
    const plan = planMoleculeScene(MOL);
    expect(plan.atoms).toHaveLength(5);
    expect(plan.bonds).toHaveLength(4);
    expect(plan.faces.length).toBeGreaterThan(0);
    // one pickable region per atom + per bond, each with a #rrggbb-baked fill on its faces.
    expect(plan.picks).toHaveLength(9);
    expect(plan.picks.filter((p) => p.kind === 'atom')).toHaveLength(5);
    expect(plan.picks.filter((p) => p.kind === 'bond')).toHaveLength(4);
    for (const f of plan.faces) expect(f.fill).toMatch(/^#|^rgb/);
    // every face is tagged with a group that maps back to a pick.
    const pickNames = new Set(plan.picks.map((p) => p.name));
    for (const f of plan.faces) expect(pickNames.has(f.group)).toBe(true);
  });

  it('orders bonds into parallel rods (double bond has more rod faces than a single)', () => {
    const plan = planMoleculeScene(MOL);
    const faceCount = (name) => plan.faces.filter((f) => f.group === name).length;
    expect(faceCount('bond:0')).toBeGreaterThan(faceCount('bond:1')); // order 2 vs order 1
  });

  it('canonically orients the principal axis to vertical (+Z)', () => {
    const plan = planMoleculeScene(MOL);
    const v = axisVariance(plan.atoms);
    expect(v[2]).toBeGreaterThan(v[0]); // most spread now along z (the principal axis)
    expect(v[2]).toBeGreaterThan(v[1]);
  });

  it('honours orient:false — coordinates pass through verbatim', () => {
    const plan = planMoleculeScene({ ...MOL, orient: false });
    expect(plan.atoms[1].pos).toEqual([3, 0, 0]);
  });

  it('chirality sign mirrors the in-plane frame (x negated, z preserved)', () => {
    const plus = planMoleculeScene({ ...MOL, chirality: 1 });
    const minus = planMoleculeScene({ ...MOL, chirality: -1 });
    plus.atoms.forEach((a, i) => {
      expect(minus.atoms[i].pos[0]).toBeCloseTo(-a.pos[0], 6); // X flipped
      expect(minus.atoms[i].pos[2]).toBeCloseTo(a.pos[2], 6);  // principal axis unchanged
    });
  });

  it('adds scaffold faces for opt-in axis and mandala overlays', () => {
    const base = planMoleculeScene(MOL).faces.length;
    expect(planMoleculeScene({ ...MOL, axis: true }).faces.length).toBeGreaterThan(base);
    expect(planMoleculeScene({ ...MOL, mandala: true }).faces.length).toBeGreaterThan(base);
    expect(planMoleculeScene({ ...MOL, axis: true }).faces.some((f) => f.group === 'axis')).toBe(true);
  });

  it('renders every bond style, each producing bond faces', () => {
    for (const style of ['stick', 'split', 'line']) {
      const plan = planMoleculeScene({ ...MOL, bondStyle: style });
      const bondFaces = plan.faces.filter((f) => f.group && f.group.startsWith('bond:'));
      expect(bondFaces.length, `${style} should emit bond faces`).toBeGreaterThan(0);
    }
  });

  it("split style colours each bond half by its nearer atom", () => {
    // a lone O–H bond: split → both the O red (#ff3030) and the H white show on the rod.
    const plan = planMoleculeScene({
      atoms: [{ symbol: 'O', pos: [0, 0, 0] }, { symbol: 'H', pos: [1, 0, 0] }],
      bonds: [{ from: 0, to: 1 }], bondStyle: 'split', orient: false,
    });
    const fills = new Set(plan.faces.filter((f) => f.group === 'bond:0').map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(1); // not a single uniform tint
  });

  it('resolves CPK colour + covalent radius by element, overridable per atom', () => {
    const plan = planMoleculeScene({ atoms: [{ symbol: 'O', pos: [0, 0, 0] }, { symbol: 'X', pos: [2, 0, 0], color: '#123456', radius: 0.9 }] });
    expect(plan.atoms[0].color).toBe('#ff3030');   // oxygen CPK red
    expect(plan.atoms[1].color).toBe('#123456');   // explicit override (unknown element)
    expect(plan.atoms[1].radius).toBe(0.9);
  });

  it('throws on an empty atom list and on a dangling bond reference', () => {
    expect(() => planMoleculeScene({ atoms: [] })).toThrow(/at least one atom/);
    expect(() => planMoleculeScene({ atoms: [{ symbol: 'C', pos: [0, 0, 0] }], bonds: [{ from: 0, to: 5 }] })).toThrow(/bond 0/);
    expect(() => planMoleculeScene({ atoms: [{ symbol: 'C', pos: ['x', 0, 0] }] })).toThrow(/numeric pos/);
  });
});

describe('assembleMoleculeScene', () => {
  it('returns an emitThreeWorld payload with picks, preset cameras and no glow', () => {
    const payload = assembleMoleculeScene(MOL, { title: 'test mol' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.picks).toHaveLength(9);
    expect(payload.cameras.map((c) => c.name)).toContain('end-on');
    expect(payload.glow).toBe(false);
    expect(payload.title).toBe('test mol');
  });
});

describe('molecule-view render routing', () => {
  it('routes to the World renderer, in the object concern bucket', () => {
    expect(sketchRenderMode({ kind: 'molecule-view' })).toBe('world');
    expect(classifyBucket({ kind: 'molecule-view' })).toBe('object');
  });
});
