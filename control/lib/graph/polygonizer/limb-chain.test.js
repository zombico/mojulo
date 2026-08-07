import { describe, it, expect } from 'vitest';
import { walkLimbChain, validateLimbChainSpec, composeRotation, rotateAroundPivot } from './limb-chain.js';
import { walkManjiTree3D, validateManjiTree3D } from './manji-program.js';

describe('walkLimbChain — forward kinematics', () => {
  const origin = { x: 0, y: 0, z: 0 };

  it('extends along the fold vector for an unbent chain', () => {
    const joints = walkLimbChain(
      {
        origin: 'self/slot/origin',
        fold: [0, 0, -1],
        segments: [
          { length: 1, emit: 'elbow' },
          { length: 1, emit: 'wrist' },
        ],
      },
      origin,
    );
    expect(joints).toHaveLength(2);
    expect(joints[0]).toEqual({ id: 'elbow', worldPosition: { x: 0, y: 0, z: -1 } });
    expect(joints[1].id).toBe('wrist');
    expect(joints[1].worldPosition.x).toBeCloseTo(0, 6);
    expect(joints[1].worldPosition.y).toBeCloseTo(0, 6);
    expect(joints[1].worldPosition.z).toBeCloseTo(-2, 6);
  });

  it('honors fold vector pointing up-and-outward (orans-style)', () => {
    const joints = walkLimbChain(
      {
        origin: 'self/slot/shoulder-l',
        fold: [-0.7071, 0, 0.7071],
        segments: [
          { length: 1, emit: 'elbow-l' },
          { length: 1, emit: 'wrist-l' },
        ],
      },
      origin,
    );
    expect(joints[1].worldPosition.x).toBeCloseTo(-1.4142, 3);
    expect(joints[1].worldPosition.z).toBeCloseTo(1.4142, 3);
    expect(joints[1].worldPosition.y).toBeCloseTo(0, 6);
  });

  it('binormal bend rotates a downward fold into a forward forearm (90 degrees)', () => {
    const joints = walkLimbChain(
      {
        origin: 'self/slot/shoulder',
        fold: [0, 0, -1],
        segments: [
          { length: 1, emit: 'elbow' },
          { length: 1, emit: 'wrist', bend: 90 },
        ],
      },
      origin,
    );
    expect(joints[0].worldPosition).toEqual({ x: 0, y: 0, z: -1 });
    // Bend 90° around the binormal axis = cross((0,0,-1), (0,1,0)) = (1,0,0).
    // Rotating (0,0,-1) by +90° around +X (right-hand) gives (0,+1,0).
    expect(joints[1].worldPosition.x).toBeCloseTo(0, 6);
    expect(joints[1].worldPosition.y).toBeCloseTo(1, 6);
    expect(joints[1].worldPosition.z).toBeCloseTo(-1, 6);
  });

  it('explicit bendAxis overrides the binormal default', () => {
    // Rotate downward fold by 90° around +Z axis instead of the binormal.
    // (0,0,-1) rotated 90° around (0,0,1) stays (0,0,-1) since the vector is parallel.
    const joints = walkLimbChain(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: 1, emit: 'next', bend: 90, bendAxis: [0, 0, 1] }],
      },
      origin,
    );
    expect(joints[0].worldPosition.x).toBeCloseTo(0, 6);
    expect(joints[0].worldPosition.y).toBeCloseTo(0, 6);
    expect(joints[0].worldPosition.z).toBeCloseTo(-1, 6);
  });

  it('walks from a non-zero origin', () => {
    const joints = walkLimbChain(
      {
        origin: 'self/slot/hip-l',
        fold: [0, 0, -1],
        segments: [{ length: 0.5, emit: 'knee-l' }],
      },
      { x: -0.09, y: 0, z: 0.47 },
    );
    expect(joints[0].worldPosition).toEqual({ x: -0.09, y: 0, z: 0.47 - 0.5 });
  });

  describe('rotations — full grid-aligned range of motion', () => {
    it('cardinal-axis rotation labels resolve correctly (E-W 90° pitches down → forward)', () => {
      // (0,0,-1) rotated 90° around E-W (= +X axis) → (0,+1,0)
      const joints = walkLimbChain(
        {
          origin: 'self/slot/shoulder',
          fold: [0, 0, -1],
          segments: [{ length: 1, emit: 'tip', rotations: [{ axis: 'E-W', angle: 90 }] }],
        },
        origin,
      );
      expect(joints[0].worldPosition.x).toBeCloseTo(0, 6);
      expect(joints[0].worldPosition.y).toBeCloseTo(1, 6);
      expect(joints[0].worldPosition.z).toBeCloseTo(0, 6);
    });

    it('N-S 90° around (0,1,0) rotates down to lateral-left (T-pose left arm)', () => {
      // (0,0,-1) rotated +90° around N-S (= +Y axis) → (-1,0,0) by right-hand rule
      const joints = walkLimbChain(
        {
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [{ length: 1, emit: 'wrist-l', rotations: [{ axis: 'N-S', angle: 90 }] }],
        },
        origin,
      );
      expect(joints[0].worldPosition.x).toBeCloseTo(-1, 6);
      expect(joints[0].worldPosition.y).toBeCloseTo(0, 6);
      expect(joints[0].worldPosition.z).toBeCloseTo(0, 6);
    });

    it('Zenith-Nadir rotation yaws perpendicular vectors in the XY plane', () => {
      // (1,0,0) rotated 90° around Z → (0,1,0)
      const joints = walkLimbChain(
        {
          origin: 'self/slot/x',
          fold: [1, 0, 0],
          segments: [{ length: 1, emit: 't', rotations: [{ axis: 'Zenith-Nadir', angle: 90 }] }],
        },
        origin,
      );
      expect(joints[0].worldPosition.x).toBeCloseTo(0, 6);
      expect(joints[0].worldPosition.y).toBeCloseTo(1, 6);
      expect(joints[0].worldPosition.z).toBeCloseTo(0, 6);
    });

    it('composes multiple rotations in order (E-W then N-S)', () => {
      // (0,0,-1) → E-W 45° → forward-down; then N-S 45° → forward-out
      const joints = walkLimbChain(
        {
          origin: 'self/slot/x',
          fold: [0, 0, -1],
          segments: [{
            length: 1, emit: 'tip',
            rotations: [{ axis: 'E-W', angle: 45 }, { axis: 'N-S', angle: 45 }],
          }],
        },
        origin,
      );
      // Step 1: (0,0,-1) around (1,0,0) by 45° → (0, sin45°, -cos45°) = (0, 0.707, -0.707)
      // Step 2: that around (0,1,0) by 45° → no change in y, rotate xz
      //   x' = 0·cos45 + (-0.707)·sin45 = -0.5
      //   z' = -0·sin45 + (-0.707)·cos45 = -0.5
      expect(joints[0].worldPosition.x).toBeCloseTo(-0.5, 4);
      expect(joints[0].worldPosition.y).toBeCloseTo(0.707, 3);
      expect(joints[0].worldPosition.z).toBeCloseTo(-0.5, 4);
    });

    it('direction override replaces the rotation chain entirely', () => {
      const joints = walkLimbChain(
        {
          origin: 'self/slot/x',
          fold: [0, 0, -1],
          segments: [{
            length: 1, emit: 'tip',
            direction: [0, 1, 0],
            rotations: [{ axis: 'N-S', angle: 90 }],  // ignored
          }],
        },
        origin,
      );
      expect(joints[0].worldPosition.x).toBeCloseTo(0, 6);
      expect(joints[0].worldPosition.y).toBeCloseTo(1, 6);
      expect(joints[0].worldPosition.z).toBeCloseTo(0, 6);
    });

    it('foot chain: rotation flips direction segment-to-segment (heel back, toe forward)', () => {
      const joints = walkLimbChain(
        {
          origin: 'self/slot/ankle-l',
          fold: [0, -1, 0],  // start backward
          segments: [
            { length: 0.03, emit: 'heel-l' },
            { length: 0.14, emit: 'toe-l', direction: [0, 1, 0] },  // flip to forward
          ],
        },
        { x: -0.09, y: 0, z: 0 },
      );
      expect(joints[0].worldPosition.y).toBeCloseTo(-0.03, 6);
      expect(joints[1].worldPosition.y).toBeCloseTo(-0.03 + 0.14, 6);
    });
  });

  it('omits emit when not provided (uneven joint emission)', () => {
    const joints = walkLimbChain(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: 1 }, { length: 1, emit: 'tip' }],
      },
      origin,
    );
    expect(joints).toHaveLength(1);
    expect(joints[0].id).toBe('tip');
  });
});

describe('validateLimbChainSpec — shape checks', () => {
  it('accepts a well-formed spec', () => {
    const errors = validateLimbChainSpec(
      {
        origin: 'self/slot/shoulder-l',
        fold: [0, 0, -1],
        segments: [{ length: 0.18, emit: 'elbow-l' }],
      },
      'test',
    );
    expect(errors).toEqual([]);
  });

  it('rejects missing origin', () => {
    const errors = validateLimbChainSpec(
      { fold: [0, 0, -1], segments: [{ length: 1, emit: 'a' }] },
      'test',
    );
    expect(errors.some((e) => /origin/.test(e))).toBe(true);
  });

  it('rejects missing fold', () => {
    const errors = validateLimbChainSpec(
      { origin: 'self/slot/x', segments: [{ length: 1, emit: 'a' }] },
      'test',
    );
    expect(errors.some((e) => /fold/.test(e))).toBe(true);
  });

  it('rejects empty segments', () => {
    const errors = validateLimbChainSpec(
      { origin: 'self/slot/x', fold: [0, 0, -1], segments: [] },
      'test',
    );
    expect(errors.some((e) => /segments/.test(e))).toBe(true);
  });

  it('rejects non-positive length', () => {
    const errors = validateLimbChainSpec(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: -0.1, emit: 'a' }],
      },
      'test',
    );
    expect(errors.some((e) => /length/.test(e))).toBe(true);
  });

  it('accepts cardinal axis labels for rotations', () => {
    const errors = validateLimbChainSpec(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: 1, emit: 'a', rotations: [
          { axis: 'N-S',          angle: 30 },
          { axis: 'E-W',          angle: 45 },
          { axis: 'Zenith-Nadir', angle: 90 },
          { axis: 'binormal',     angle: 15 },
          { axis: [1, 0, 0],      angle: 10 },
        ] }],
      },
      'test',
    );
    expect(errors).toEqual([]);
  });

  it('rejects unknown axis label or zero vector', () => {
    const errors = validateLimbChainSpec(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: 1, emit: 'a', rotations: [
          { axis: 'sideways', angle: 30 },
          { axis: [0, 0, 0],  angle: 30 },
        ] }],
      },
      'test',
    );
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  describe('hinge constraint — elbow/knee joint locking', () => {
    it('accepts a hinge segment with bend (single rotation)', () => {
      const errors = validateLimbChainSpec(
        {
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [{ length: 0.15, emit: 'wrist-l', hinge: true, hingeAxis: 'binormal', bend: 90 }],
        },
        'test',
      );
      expect(errors).toEqual([]);
    });

    it('rejects hinge with both bend and rotations', () => {
      const errors = validateLimbChainSpec(
        {
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [{
            length: 0.15, emit: 'wrist-l',
            hinge: true, bend: 90, rotations: [{ axis: 'binormal', angle: 90 }],
          }],
        },
        'test',
      );
      expect(errors.some((e) => /bend OR rotations/.test(e))).toBe(true);
    });

    it('rejects hinge with more than one rotation entry', () => {
      const errors = validateLimbChainSpec(
        {
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [{
            length: 0.15, emit: 'wrist-l', hinge: true,
            rotations: [
              { axis: 'binormal', angle: 90 },
              { axis: 'Zenith-Nadir', angle: 30 },
            ],
          }],
        },
        'test',
      );
      expect(errors.some((e) => /at most one rotation/.test(e))).toBe(true);
    });

    it('rejects hinge whose declared axis conflicts with the rotation axis', () => {
      const errors = validateLimbChainSpec(
        {
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [{
            length: 0.15, emit: 'wrist-l',
            hinge: true, hingeAxis: 'binormal',
            rotations: [{ axis: 'Zenith-Nadir', angle: 90 }],
          }],
        },
        'test',
      );
      expect(errors.some((e) => /hinge axis is 'binormal'/.test(e))).toBe(true);
    });

    it('hinge bend defaults to binormal when hingeAxis not specified', () => {
      // Bicep direction (0, 0, -1) — straight down. Hinge bend +90°
      // should flex the forearm forward (binormal = world +X, rotation
      // takes -Z to +Y by right-hand rule).
      const joints = walkLimbChain(
        {
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [
            { length: 0.18, emit: 'elbow-l' },
            { length: 0.15, emit: 'wrist-l', hinge: true, bend: 90 },
          ],
        },
        { x: -0.18, y: 0, z: 0.78 },
      );
      const wrist = joints[1].worldPosition;
      const elbow = joints[0].worldPosition;
      expect(wrist.x).toBeCloseTo(elbow.x, 6);
      expect(wrist.y).toBeCloseTo(elbow.y + 0.15, 5);
      expect(wrist.z).toBeCloseTo(elbow.z, 5);
    });
  });

  it('rejects direction = zero vector', () => {
    const errors = validateLimbChainSpec(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: 1, emit: 'a', direction: [0, 0, 0] }],
      },
      'test',
    );
    expect(errors.some((e) => /direction/.test(e))).toBe(true);
  });

  it('rejects bendAxis = [0,0,0]', () => {
    const errors = validateLimbChainSpec(
      {
        origin: 'self/slot/x',
        fold: [0, 0, -1],
        segments: [{ length: 1, emit: 'a', bend: 90, bendAxis: [0, 0, 0] }],
      },
      'test',
    );
    expect(errors.some((e) => /bendAxis/.test(e))).toBe(true);
  });
});

describe('composeRotation + rotateAroundPivot — X-manji hub rotation', () => {
  it('returns null for an empty or all-zero list', () => {
    expect(composeRotation([])).toBeNull();
    expect(composeRotation([{ axis: 'E-W', angle: 0 }])).toBeNull();
    expect(composeRotation(null)).toBeNull();
  });

  it('rotates a vector by a cardinal-axis composition', () => {
    const rotFn = composeRotation([{ axis: 'E-W', angle: 90 }]);
    const v = rotFn({ x: 0, y: 0, z: -1 });
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('composes rotations in order (different from reversed order)', () => {
    const ab = composeRotation([{ axis: 'E-W', angle: 45 }, { axis: 'N-S', angle: 45 }]);
    const ba = composeRotation([{ axis: 'N-S', angle: 45 }, { axis: 'E-W', angle: 45 }]);
    const v = { x: 0, y: 0, z: -1 };
    const r1 = ab(v);
    const r2 = ba(v);
    // Non-commutative — at least one component should differ.
    const diff = Math.abs(r1.x - r2.x) + Math.abs(r1.y - r2.y) + Math.abs(r1.z - r2.z);
    expect(diff).toBeGreaterThan(0.01);
  });

  it('rotateAroundPivot pivots the rotation center', () => {
    const rotFn = composeRotation([{ axis: 'E-W', angle: 90 }]);
    // Point (0,0,1) pivoted around (0,0,0.5), rotated +90° around E-W
    // (right-hand rule, thumb along +X, fingers curl +Y→+Z, so +Z→-Y):
    //   rel = (0,0,0.5); rotated rel = (0,-0.5,0); back = (0,-0.5,0.5)
    const out = rotateAroundPivot(rotFn, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0.5 });
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(-0.5, 6);
    expect(out.z).toBeCloseTo(0.5, 6);
  });

  it('null rotation returns the point unchanged', () => {
    const out = rotateAroundPivot(null, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 });
    expect(out).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('walker integration — limb-chain emits slots on enclosing manji', () => {
  // X-manji invoked via programRef so its children (the limb-chain leaf
  // mark) are inlined as card-children with `self` = the figure's emitted
  // id. This is how a real figure shelf card would be authored.
  function figureCard() {
    return {
      spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.3 } },
      slots: [
        { id: 'torso-center', position: { x: 0, y: 0, z: 0.65 } },
        { id: 'shoulder-l',   position: { x: -0.18, y: 0, z: 0.78 } },
        { id: 'shoulder-r',   position: { x: 0.18,  y: 0, z: 0.78 } },
        { id: 'hip-l',        position: { x: -0.09, y: 0, z: 0.47 } },
        { id: 'hip-r',        position: { x: 0.09,  y: 0, z: 0.47 } },
      ],
      children: [
        {
          kind: 'limb-chain',
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [
            { length: 0.18, emit: 'elbow-l' },
            { length: 0.15, emit: 'wrist-l' },
          ],
        },
      ],
    };
  }

  function hostInvoking(card, extraCardChildren = [], scale = 1) {
    const program = { ...card, children: [...card.children, ...extraCardChildren] };
    const resolveProgramRef = (ref) => (ref === 'X-figure-test' ? program : null);
    const tree = {
      id: 'world',
      spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'figure-anchor', position: { x: 0, y: 0, z: 0 } }],
      children: [{ slot: 'figure-anchor', node: { id: 'figure', programRef: 'X-figure-test', scale } }],
    };
    return { tree, resolveProgramRef };
  }

  it('emits elbow-l and wrist-l as slots on the parent manji', () => {
    const { tree, resolveProgramRef } = hostInvoking(figureCard());
    const emitted = walkManjiTree3D(tree, resolveProgramRef);
    const figure = emitted.find((r) => r.id === 'figure');
    expect(figure).toBeDefined();
    const ids = figure.slots.map((s) => s.id);
    expect(ids).toContain('elbow-l');
    expect(ids).toContain('wrist-l');
    const elbow = figure.slots.find((s) => s.id === 'elbow-l');
    expect(elbow.worldPosition.x).toBeCloseTo(-0.18, 6);
    expect(elbow.worldPosition.y).toBeCloseTo(0, 6);
    expect(elbow.worldPosition.z).toBeCloseTo(0.78 - 0.18, 6);
  });

  it('subsequent leaf marks resolve self/slot/elbow-l after the chain runs', () => {
    const extra = [{ kind: 'connection', from: 'self/slot/shoulder-l', to: 'self/slot/elbow-l' }];
    const { tree, resolveProgramRef } = hostInvoking(figureCard(), extra);
    expect(validateManjiTree3D(tree, resolveProgramRef)).toEqual([]);
    const emitted = walkManjiTree3D(tree, resolveProgramRef);
    const leaf = emitted.find((r) => r.leafMark?.kind === 'connection');
    expect(leaf).toBeDefined();
    expect(leaf.leafMark.spec.to).toBe('self/slot/elbow-l');
  });

  it('chain emission scales with worldScale (figure at scale=4)', () => {
    const { tree, resolveProgramRef } = hostInvoking(figureCard(), [], 4);
    const emitted = walkManjiTree3D(tree, resolveProgramRef);
    const figure = emitted.find((r) => r.id === 'figure');
    expect(figure).toBeDefined();
    const elbow = figure.slots.find((s) => s.id === 'elbow-l');
    expect(elbow.worldPosition.z).toBeCloseTo(4 * (0.78 - 0.18), 6);
    expect(elbow.worldPosition.x).toBeCloseTo(4 * -0.18, 6);
  });
});

describe('walker integration — node rotation rotates slots and chains (local frame)', () => {
  function rotatedFigureCard({ rotation, rotationPivot }) {
    return {
      spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.3 } },
      slots: [
        { id: 'torso-center', position: { x: 0, y: 0, z: 0.6 } },
        { id: 'shoulder-l',   position: { x: -0.18, y: 0, z: 0.78 } },
        { id: 'hip-l',        position: { x: -0.09, y: 0, z: 0.47 } },
      ],
      children: [
        {
          kind: 'limb-chain',
          origin: 'self/slot/shoulder-l',
          fold: [0, 0, -1],
          segments: [{ length: 0.18, emit: 'elbow-l' }],
        },
      ],
      // Carried through the host invocation onto the figure node.
      rotation,
      rotationPivot,
    };
  }

  it('rotates slot positions around an explicit pivot', () => {
    // Tilt the figure 90° around E-W with pivot at feet (z=0). The
    // shoulder-l at (-0.18, 0, 0.78) should rotate to (-0.18, 0.78, 0).
    const card = rotatedFigureCard({
      rotation: [{ axis: 'E-W', angle: 90 }],
      rotationPivot: { x: 0, y: 0, z: 0 },
    });
    const program = { ...card };
    const resolveProgramRef = (ref) => (ref === 'X-rot-test' ? program : null);
    const tree = {
      id: 'world',
      spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'figure-anchor', position: { x: 0, y: 0, z: 0 } }],
      children: [{ slot: 'figure-anchor', node: { id: 'figure', programRef: 'X-rot-test', scale: 1 } }],
    };
    const emitted = walkManjiTree3D(tree, resolveProgramRef);
    const figure = emitted.find((r) => r.id === 'figure');
    const shoulder = figure.slots.find((s) => s.id === 'shoulder-l');
    // Shoulder at (-0.18, 0, 0.78) rotated +90° around E-W (right-hand
    // rule +Y→+Z so +Z→-Y) → (-0.18, -0.78, 0).
    expect(shoulder.worldPosition.x).toBeCloseTo(-0.18, 6);
    expect(shoulder.worldPosition.y).toBeCloseTo(-0.78, 6);
    expect(shoulder.worldPosition.z).toBeCloseTo(0, 6);
  });

  it('limb-chain fold rotates with the parent (local-frame chain)', () => {
    // E-W +90° rotates the whole figure forward. The arm chain's fold
    // (0,0,-1) should become (0,1,0) in world frame, so the chain
    // emits elbow-l forward of shoulder-l (in +y), not below it.
    const card = rotatedFigureCard({
      rotation: [{ axis: 'E-W', angle: 90 }],
      rotationPivot: { x: 0, y: 0, z: 0 },
    });
    const program = { ...card };
    const resolveProgramRef = (ref) => (ref === 'X-rot-chain' ? program : null);
    const tree = {
      id: 'world',
      spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'figure-anchor', position: { x: 0, y: 0, z: 0 } }],
      children: [{ slot: 'figure-anchor', node: { id: 'figure', programRef: 'X-rot-chain', scale: 1 } }],
    };
    const emitted = walkManjiTree3D(tree, resolveProgramRef);
    const figure = emitted.find((r) => r.id === 'figure');
    const shoulder = figure.slots.find((s) => s.id === 'shoulder-l');
    const elbow    = figure.slots.find((s) => s.id === 'elbow-l');
    // Shoulder at (-0.18, -0.78, 0). Fold (0,0,-1) rotated by E-W +90°
    // (right-hand rule: -Z → +Y) → (0, +1, 0). Elbow = shoulder + 0.18*
    // (0,+1,0) = (-0.18, -0.6, 0).
    expect(elbow.worldPosition.x).toBeCloseTo(shoulder.worldPosition.x, 6);
    expect(elbow.worldPosition.y).toBeCloseTo(shoulder.worldPosition.y + 0.18, 5);
    expect(elbow.worldPosition.z).toBeCloseTo(shoulder.worldPosition.z, 5);
  });
});
