import { describe, it, expect } from 'vitest';
import {
  validateTaijis,
  sampleTaiji,
  makeTaijiField,
  resolveTaijiSpec,
  taijituDivider,
  taijituLobe,
} from './taiji.js';
import { renderManjiTreeToSvg } from './manji-svg.js';
import { walkManjiTree3D, validateManjiTree3D, validateLeafMarkEndpoints } from './manji-program.js';

// A vertical axis along z: yin low, yang high, hub implied at the midpoint.
const AXIS = {
  yin: { x: 0, y: 0, z: -2 },
  yang: { x: 0, y: 0, z: 2 },
};

// Mean distance of a point set from a center, along all axes.
function meanRadius(points, center) {
  let sum = 0;
  for (const p of points) sum += Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z);
  return sum / points.length;
}

// Signed angle the yang strand sweeps about the yin→yang axis. Sign = chirality.
function yangSweep(spec) {
  const { strands, poleSlots } = sampleTaiji({ ...spec, profile: 'capsule' });
  const d = sub(poleSlots.yang, poleSlots.yin);
  const dir = norm(d);
  const ref = Math.abs(dir.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = norm(cross(dir, ref));
  const v = norm(cross(dir, u));
  let total = 0;
  let prev = null;
  for (let i = 0; i < strands.yang.length; i += 1) {
    const t = i / (strands.yang.length - 1);
    const c = lerp(poleSlots.yin, poleSlots.yang, t);
    const w = sub(strands.yang[i], c);
    const ang = Math.atan2(dot(w, v), dot(w, u));
    if (prev !== null) {
      let delta = ang - prev;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      total += delta;
    }
    prev = ang;
  }
  return total;
}

describe('taiji — validation', () => {
  it('passes a well-formed inline spec', () => {
    expect(validateTaijis([{ ...AXIS, twist: 0.5, radius: 1 }], [])).toEqual([]);
  });

  it('passes without a center (defaults to the midpoint)', () => {
    expect(validateTaijis([{ ...AXIS }], [])).toEqual([]);
  });

  it('requires both poles', () => {
    expect(validateTaijis([{ yin: AXIS.yin }], []).some((e) => e.includes('yang'))).toBe(true);
    expect(validateTaijis([{ yang: AXIS.yang }], []).some((e) => e.includes('yin'))).toBe(true);
  });

  it('rejects a non-finite twist', () => {
    expect(validateTaijis([{ ...AXIS, twist: Infinity }], []).some((e) => e.includes('twist'))).toBe(true);
    expect(validateTaijis([{ ...AXIS, twist: NaN }], []).some((e) => e.includes('twist'))).toBe(true);
  });

  it('accepts twist 0 (the achiral degenerate)', () => {
    expect(validateTaijis([{ ...AXIS, twist: 0 }], [])).toEqual([]);
  });

  it('rejects a non-positive radius', () => {
    expect(validateTaijis([{ ...AXIS, radius: 0 }], []).some((e) => e.includes('radius'))).toBe(true);
    expect(validateTaijis([{ ...AXIS, radius: -1 }], []).some((e) => e.includes('radius'))).toBe(true);
  });

  it('rejects an unknown profile', () => {
    expect(validateTaijis([{ ...AXIS, profile: 'torus' }], []).some((e) => e.includes('profile'))).toBe(true);
  });

  it('rejects coincident poles (zero-length axis)', () => {
    const errs = validateTaijis([{ yin: { x: 0, y: 0, z: 0 }, yang: { x: 0, y: 0, z: 0 } }], []);
    expect(errs.some((e) => e.includes('zero-length axis'))).toBe(true);
  });

  it('resolves endpoint-path poles against emitted nodes', () => {
    const emitted = [{ id: 'host', slots: [
      { id: 'lo', worldPosition: { x: 0, y: 0, z: -2 } },
      { id: 'hi', worldPosition: { x: 0, y: 0, z: 2 } },
    ] }];
    expect(validateTaijis([{ yin: 'host/slot/lo', yang: 'host/slot/hi' }], emitted)).toEqual([]);
  });

  it('surfaces a bad endpoint path at mint time', () => {
    const errs = validateTaijis([{ yin: 'ghost/slot/x', yang: AXIS.yang }], []);
    expect(errs.some((e) => e.includes('ghost') || e.includes('unknown node'))).toBe(true);
  });
});

describe('taiji — field + lobe selector', () => {
  it('is negative inside the envelope and positive far outside', () => {
    const field = makeTaijiField(resolveTaijiSpec({ ...AXIS, twist: 0.5, radius: 1.1 }));
    expect(field({ x: 0, y: 0, z: 0 })).toBeLessThan(0);
    expect(field({ x: 100, y: 100, z: 0 })).toBeGreaterThan(0);
  });

  it('the lobe selector splits space into yin (-1) and yang (+1)', () => {
    const field = makeTaijiField(resolveTaijiSpec({ ...AXIS, twist: 0.5, radius: 1.1 }));
    const lobes = new Set();
    for (let a = 0; a < 12; a += 1) {
      const th = (a / 12) * 2 * Math.PI;
      lobes.add(field.lobe({ x: 0.6 * Math.cos(th), y: 0.6 * Math.sin(th), z: 0 }));
    }
    expect(lobes.has(1)).toBe(true);
    expect(lobes.has(-1)).toBe(true);
  });

  it('the lobe boundary rotates with twist (chirality is legible in the field)', () => {
    // A fixed off-axis point read at the yang end. With twist the partition
    // has rotated there, so the same point can fall in a different lobe than
    // at the yin end (where phi=0). Compare twist vs no-twist at the yang end.
    const p = { x: 0.5, y: 0, z: 1.8 };
    const straight = makeTaijiField(resolveTaijiSpec({ ...AXIS, twist: 0, radius: 1.1 }));
    const turned = makeTaijiField(resolveTaijiSpec({ ...AXIS, twist: 0.5, radius: 1.1 }));
    // Right half is yang under no twist; a half turn near the yang pole flips it.
    expect(straight.lobe(p)).toBe(1);
    expect(turned.lobe(p)).toBe(-1);
  });
});

describe('taiji — sampler', () => {
  it('emits crossSections+1 partition rings of the divider length', () => {
    const { rings } = sampleTaiji({ ...AXIS, crossSections: 12, samples: 24 });
    expect(rings.length).toBe(13);
    const dividerLen = taijituDivider(24).length;
    for (const r of rings) expect(r.polyline.length).toBe(dividerLen);
  });

  it('emits two pole-strands of crossSections+1 points', () => {
    const { strands } = sampleTaiji({ ...AXIS, crossSections: 20, samples: 24 });
    expect(strands.yin.length).toBe(21);
    expect(strands.yang.length).toBe(21);
  });

  it('re-emits the three authored points as pole slots', () => {
    const { poleSlots } = sampleTaiji({ ...AXIS, twist: 0.4 });
    expect(poleSlots.yin).toEqual(AXIS.yin);
    expect(poleSlots.yang).toEqual(AXIS.yang);
    expect(poleSlots.center).toEqual({ x: 0, y: 0, z: 0 }); // midpoint default
  });

  it('strands ride at half the envelope radius (the eyes)', () => {
    // capsule: constant R; the eye sits at R/2 from the axis.
    const R = 1.2;
    const { strands } = sampleTaiji({ ...AXIS, radius: R, profile: 'capsule', twist: 0.5 });
    const mid = strands.yang[Math.floor(strands.yang.length / 2)];
    const axisPoint = { x: 0, y: 0, z: mid.z };
    expect(Math.hypot(mid.x - axisPoint.x, mid.y - axisPoint.y)).toBeCloseTo(R / 2, 5);
  });

  it('the spindle profile tapers the envelope to the poles', () => {
    const { envelope } = sampleTaiji({ ...AXIS, radius: 1, profile: 'spindle', showEnvelope: true, crossSections: 20 });
    const ends = meanRadius([envelope[0].center, envelope[envelope.length - 1].center], { x: 0, y: 0, z: 0 });
    const midRing = envelope[Math.floor(envelope.length / 2)];
    expect(meanRadius(midRing.polyline, midRing.center)).toBeGreaterThan(0.9); // ~full radius at the waist
    // poles taper: end rings collapse toward their centers
    expect(meanRadius(envelope[0].polyline, envelope[0].center)).toBeLessThan(0.1);
    expect(ends).toBeGreaterThan(0); // sanity: axis spans
  });

  it('an off-line center bends the axis (Bézier)', () => {
    const { rings } = sampleTaiji({ ...AXIS, center: { x: 1.5, y: 0, z: 0 }, crossSections: 20 });
    // The middle ring center bows away from the straight chord (x=0).
    const mid = rings[Math.floor(rings.length / 2)];
    expect(mid.center.x).toBeGreaterThan(0.3);
  });
});

describe('taiji — chirality invariant', () => {
  it('twist sign sets the handedness of the strand sweep', () => {
    expect(Math.sign(yangSweep({ ...AXIS, twist: 0.5 }))).toBe(1);
    expect(Math.sign(yangSweep({ ...AXIS, twist: -0.5 }))).toBe(-1);
  });

  it('opposite twists are exact mirror images', () => {
    expect(yangSweep({ ...AXIS, twist: 0.5 }) + yangSweep({ ...AXIS, twist: -0.5 })).toBeCloseTo(0, 9);
  });

  it('twist magnitude is the number of turns (0.5 → half a turn, 1 → full)', () => {
    expect(Math.abs(yangSweep({ ...AXIS, twist: 0.5 }))).toBeCloseTo(Math.PI, 5);
    expect(Math.abs(yangSweep({ ...AXIS, twist: 1 }))).toBeCloseTo(2 * Math.PI, 5);
  });

  it('twist 0 is achiral — the strands do not wind', () => {
    expect(Math.abs(yangSweep({ ...AXIS, twist: 0 }))).toBeLessThan(1e-9);
  });

  it('the 2D lobe selector matches the canonical taijitu (eyes belong to the opposite lobe)', () => {
    // Upper small disc (center 0,+R/2) is yang; lower (0,-R/2) is yin.
    expect(taijituLobe(0, 0.5, 1)).toBe(1);
    expect(taijituLobe(0, -0.5, 1)).toBe(-1);
    // Outside the discs the split is by u sign.
    expect(taijituLobe(0.9, 0, 1)).toBe(1);
    expect(taijituLobe(-0.9, 0, 1)).toBe(-1);
  });
});

describe('taiji — renders through the pipeline (top-level array)', () => {
  const ROOT = {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [],
  };
  it('paints both pole-strands and the partition mesh end-to-end', () => {
    const svg = renderManjiTreeToSvg({
      kind: 'manji-tree',
      dimensions: '3d',
      tree: ROOT,
      taijis: [{ yin: { x: 0, y: 0, z: 2 }, yang: { x: 0, y: 0, z: -2 }, twist: 0.5, radius: 1 }],
    });
    expect(svg).toContain('#4cc9c0'); // yin strand
    expect(svg).toContain('#e9c46a'); // yang strand
    expect(svg).toContain('#9aa0bd'); // partition mesh
    expect(svg).toMatch(/<line /);
  });
});

// ─── Phase 3: taiji as an in-tree leaf + slot emission ─────────────────

// A manji node with three Zenith-Nadir landmarks + an in-tree taiji bound
// to two of them, plus a connection binding to the taiji's emitted pole
// slots (must come AFTER the taiji in document order).
function citizenTree() {
  return {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.1 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'lo', position: { x: 0, y: 0, z: -3 } },
      { id: 'hi', position: { x: 0, y: 0, z: 3 } },
    ],
    children: [
      {
        slot: 'hi',
        node: {
          kind: 'taiji', id: 'coil',
          yin: 'self/slot/lo', yang: 'self/slot/hi',
          twist: 0.5, radius: 1,
        },
      },
      // Binds to the taiji's freshly-emitted pole landmarks.
      { slot: 'hi', node: { kind: 'connection', id: 'tie', from: 'self/slot/coil-yin', to: 'self/slot/coil-yang' } },
    ],
  };
}

describe('taiji — in-tree leaf authoring + slot emission', () => {
  it('emits as a leaf-mark and is shape-valid', () => {
    expect(validateManjiTree3D(citizenTree())).toEqual([]);
    const emitted = walkManjiTree3D(citizenTree(), () => null, {});
    const leaf = emitted.find((n) => n?.leafMark?.kind === 'taiji');
    expect(leaf).toBeTruthy();
    expect(leaf.leafMark.selfId).toBe('world');
  });

  it('emits yin / center / hub-default-midpoint / yang as slots', () => {
    const emitted = walkManjiTree3D(citizenTree(), () => null, {});
    const world = emitted.find((n) => n.id === 'world');
    const slot = (id) => world.slots.find((s) => s.id === id);
    expect(slot('coil-yin').worldPosition).toMatchObject({ x: 0, y: 0, z: -3 });
    expect(slot('coil-yang').worldPosition).toMatchObject({ x: 0, y: 0, z: 3 });
    // center not authored → defaults to the midpoint of the two poles.
    expect(slot('coil-center').worldPosition).toMatchObject({ x: 0, y: 0, z: 0 });
  });

  it('downstream leaves can bind to the emitted pole slots', () => {
    const emitted = walkManjiTree3D(citizenTree(), () => null, {});
    expect(validateLeafMarkEndpoints(emitted)).toEqual([]);
  });

  it('an anonymous (id-less) taiji renders but emits no slots', () => {
    const tree = citizenTree();
    delete tree.children[0].node.id;
    tree.children.pop(); // the connection referenced coil-*; drop it
    const emitted = walkManjiTree3D(tree, () => null, {});
    const world = emitted.find((n) => n.id === 'world');
    expect(world.slots.some((s) => s.emittedByTaiji)).toBe(false);
  });

  it('shape validation rejects a taiji missing a pole', () => {
    const tree = citizenTree();
    delete tree.children[0].node.yang;
    tree.children.pop();
    expect(validateManjiTree3D(tree).some((e) => e.includes('taiji.yang'))).toBe(true);
  });

  it('renders the chiral wave-space face end-to-end from an in-tree taiji', () => {
    const svg = renderManjiTreeToSvg({ kind: 'manji-tree', dimensions: '3d', tree: citizenTree() });
    expect(svg).toContain('#4cc9c0'); // yin strand
    expect(svg).toContain('#e9c46a'); // yang strand
    expect(svg).toMatch(/<line /);
  });
});

// The composition payoff: a taiji wound onto a vajra's bond line. The
// vajra emits -proximal/-center/-distal; the taiji binds its poles to them
// so the static bond gains a handed circulation.
describe('taiji — composes onto a vajra bond line', () => {
  function vajraPlusTaiji() {
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
            beads: { proximal: { radius: 0.9 }, center: { radius: 0.25 }, distal: { radius: 0.9 } },
          },
        },
        // Wind a taiji on the SAME bond line by binding to the vajra's beads.
        {
          slot: 'b',
          node: {
            kind: 'taiji', id: 'spin',
            yin: 'self/slot/bond-proximal', center: 'self/slot/bond-center', yang: 'self/slot/bond-distal',
            twist: 1, radius: 0.6,
          },
        },
      ],
    };
  }

  it('is shape-valid and resolves the taiji poles to the vajra beads', () => {
    expect(validateManjiTree3D(vajraPlusTaiji())).toEqual([]);
    const emitted = walkManjiTree3D(vajraPlusTaiji(), () => null, {});
    expect(validateLeafMarkEndpoints(emitted)).toEqual([]);
    const world = emitted.find((n) => n.id === 'world');
    // Both primitives emitted their slots onto the same host.
    expect(world.slots.some((s) => s.id === 'bond-proximal' && s.emittedByVajra)).toBe(true);
    expect(world.slots.some((s) => s.id === 'spin-yin' && s.emittedByTaiji)).toBe(true);
  });

  it('renders both the gold vajra rings and the two-tone taiji strands', () => {
    const svg = renderManjiTreeToSvg({ kind: 'manji-tree', dimensions: '3d', tree: vajraPlusTaiji() });
    expect(svg).toContain('#c9a23a'); // vajra gold rings
    expect(svg).toContain('#4cc9c0'); // taiji yin strand
    expect(svg).toContain('#e9c46a'); // taiji yang strand
  });
});

// local vector helpers
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function norm(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
function lerp(a, b, t) { return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z: a.z + t * (b.z - a.z) }; }
