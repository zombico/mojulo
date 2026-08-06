import { describe, it, expect } from 'vitest';

import { deriveUnitAnchors, freezeUnitAnchors, anchorWorld, anchorsByTag } from './unit-anchors.js';
import { deriveBipedRig } from './unit-pose.js';
import { UNIT_CLIPS } from './unit-rig.js';
import { articulateTransforms } from '../polygonizer/figure-vajra.js';
import { resolvePose } from '../polygonizer/figure-posing.js';
import { facingYaw } from './workbench.js';

// Minimal biped (the fixture unit-pose/unit-rig tests pose): g-series
// convention, facing '-y', one gravity-seated item per station.
const strut = (len, r = 0.3) => ({
  lathes: [{
    axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: -len },
    profile: [{ t: 0.5, radius: r }], crossSections: 4, samples: 6, tint: '#888888',
  }],
});
function miniBiped(extra = {}) {
  return {
    kind: 'assembler', facing: '-y',
    items: [
      { id: 'head', source: strut(1, 0.5), at: [0, 0, 9] },
      { id: 'torso', source: strut(3, 1), at: [0, 0, 8] },
      { id: 'pelvis', source: strut(1, 0.9), at: [0, 0, 5] },
      { id: 'upper_arm_l', source: strut(1.5), at: [-2, 0, 8] },
      { id: 'upper_arm_r', source: strut(1.5), at: [2, 0, 8] },
      { id: 'forearm_l', source: strut(1.5), at: [-2, 0, 6.5] },
      { id: 'forearm_r', source: strut(1.5), at: [2, 0, 6.5] },
      { id: 'thigh_l', source: strut(2, 0.4), at: [-1, 0, 4] },
      { id: 'thigh_r', source: strut(2, 0.4), at: [1, 0, 4] },
      { id: 'lower_leg_l', source: strut(2, 0.35), at: [-1, 0, 2] },
      { id: 'lower_leg_r', source: strut(2, 0.35), at: [1, 0, 2] },
      { id: 'foot_l', source: strut(0.8, 0.2), on: 'ground', at: [-1, 0, 0] },
      { id: 'foot_r', source: strut(0.8, 0.2), on: 'ground', at: [1, 0, 0] },
    ],
    ...extra,
  };
}

// A weapon recipe stub: only the armory.hardpoints matter to the anchor layer
// (weapon-local frame, +y forward). Bound to forearmR via a rig override so the
// side never depends on the fixture's screen-relative _l/_r labels.
const weaponItem = (id = 'rifle_r') => ({
  id,
  source: { kind: 'workbench', armory: { kind: 'ms-rifle', localFrame: { forward: '+y', up: '+z' }, hardpoints: { primaryGrip: [0, 0, 0], supportGrip: [0, 2, 0], muzzle: [0, 5, 1] } } },
  at: [2, 0, 6.5], rotate: [0, 0, 0], scale: 0.5,
});
const armedMini = () => miniBiped({ items: [...miniBiped().items, weaponItem()], rig: { bones: { rifle_r: 'forearmR' } } });

// frame helpers (mirror unit-anchors' own math) for the rigidity proof
const rotZdeg = (deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const mvec = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const tr = (M) => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const close = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('deriveUnitAnchors — defaults from the rig', () => {
  it('derives sensorEye on the head and cockpit on the torso, tagged', () => {
    const { anchors } = deriveUnitAnchors(miniBiped());
    expect(anchors.sensorEye.on).toBe('head');
    expect(anchors.sensorEye.tags).toEqual(expect.arrayContaining(['camera', 'gaze']));
    expect(anchors.sensorEye.dir).toHaveLength(3);
    expect(anchors.cockpit.on).toBe('torso');
    expect(anchors.cockpit.tags).toContain('camera');
  });

  it('an unarmed unit has no fire anchors', () => {
    expect(anchorsByTag(miniBiped(), 'fire')).toHaveLength(0);
  });
});

describe('deriveUnitAnchors — weapon hardpoint ingestion', () => {
  it('ingests muzzle + grips off an armed sibling, bound to the weapon bone', () => {
    const { anchors } = deriveUnitAnchors(armedMini());
    expect(anchors.muzzle.on).toBe('forearmR');
    expect(anchors.muzzle.tags).toContain('fire');
    expect(anchors.muzzle.dir).toHaveLength(3);        // muzzle carries a forward direction
    expect(anchors.gripR.on).toBe('forearmR');
    expect(anchors.supportR.on).toBe('forearmR');
    // muzzle sits at at + rotate·(muzzle_local·scale) = [2,0,6.5] + [0,2.5,0.5]
    expect(close(anchors.muzzle.at, [2, 2.5, 7.0], 1e-4)).toBe(true);
    expect(anchorsByTag(armedMini(), 'fire').map((a) => a.name)).toContain('muzzle');
  });

  it('explicit manifest.anchors win per name (weakpoint with a region)', () => {
    const wp = { on: 'torso', at: [0, -0.5, 8], tags: ['damage'], region: { min: [-1, -1, 7], max: [1, 1, 9] } };
    const { anchors } = deriveUnitAnchors(miniBiped({ anchors: { weakpoint: wp, cockpit: { tags: ['camera', 'hero'] } } }));
    expect(anchors.weakpoint.region).toBeDefined();
    expect(anchorsByTag(miniBiped({ anchors: { weakpoint: wp } }), 'damage')[0].name).toBe('weakpoint');
    expect(anchors.cockpit.on).toBe('torso');           // merged: derived `on` kept
    expect(anchors.cockpit.tags).toContain('hero');      // override applied
  });
});

describe('anchorWorld — an anchor rides its bone', () => {
  const armed = armedMini();

  it('resolves to its stored point at rest', () => {
    const { pos } = anchorWorld(armed, {}, 'muzzle');
    expect(close(pos, [2, 2.5, 7.0], 1e-4)).toBe(true);
  });

  it('MOVES with the weapon arm, but not with the legs', () => {
    const rest = anchorWorld(armed, {}, 'muzzle').pos;
    const armMoved = anchorWorld(armed, { shR: { pitch: 40 }, elbowR: 60 }, 'muzzle').pos;
    const legMoved = anchorWorld(armed, { hipL: { pitch: 30 } }, 'muzzle').pos;
    expect(close(armMoved, rest, 1e-3)).toBe(false);     // forearmR moved → muzzle moved
    expect(close(legMoved, rest, 1e-6)).toBe(true);       // legs don't carry the muzzle
  });

  it('stays RIGID to forearmR across the boost clip (tracks the gun through the lean)', () => {
    const rig = deriveBipedRig(armed);
    const A = rotZdeg(-facingYaw(armed.facing));
    const restRig = mvec(A, deriveUnitAnchors(armed, { rig }).anchors.muzzle.at);   // suit → rig
    // back-compute the muzzle's rest position in forearmR's LOCAL frame under
    // each pose: p_rest = mᵀ·(posedRig − t). If the muzzle rides the bone
    // rigidly, this is invariant across every pose.
    const localUnder = (pose) => {
      const { m, t } = articulateTransforms(resolvePose(pose), rig.joints).bones.forearmR;
      const posedRig = anchorWorld(armed, pose, 'muzzle', { rig, frame: 'rig' }).pos;
      return mvec(tr(m), [posedRig[0] - t.x, posedRig[1] - t.y, posedRig[2] - t.z]);
    };
    for (const key of [0, 0.25, 0.5, 0.75]) {
      expect(close(localUnder(UNIT_CLIPS.boost.pose(key)), restRig, 1e-6)).toBe(true);
    }
    // and boost actually SWEEPS the muzzle off its rest point (the flight lean
    // is a big arm sweep from rest — not a degenerate no-op)
    const rest = anchorWorld(armed, {}, 'muzzle', { rig }).pos;
    const boosted = anchorWorld(armed, UNIT_CLIPS.boost.pose(0.25), 'muzzle', { rig }).pos;
    expect(close(boosted, rest, 1e-2)).toBe(false);
  });

  it('rotates the muzzle direction with the arm', () => {
    const restDir = anchorWorld(armed, {}, 'muzzle').dir;
    const posedDir = anchorWorld(armed, { shR: { pitch: 40 }, elbowR: 60 }, 'muzzle').dir;
    expect(restDir).toHaveLength(3);
    expect(Math.abs(Math.hypot(...posedDir) - 1)).toBeLessThan(1e-9);   // stays unit
    expect(close(posedDir, restDir, 1e-3)).toBe(false);                  // and it turned
  });
});

describe('freezeUnitAnchors — anchors as frozen manifest data', () => {
  it('writes anchors into the manifest and re-derives byte-identical', () => {
    const frozen = freezeUnitAnchors(armedMini());
    expect(frozen.anchors.muzzle.on).toBe('forearmR');
    // a frozen unit resolves from its stored anchors, no re-derivation needed
    const { pos } = anchorWorld(frozen, {}, 'muzzle');
    expect(close(pos, [2, 2.5, 7.0], 1e-4)).toBe(true);
    // deriving again over the frozen manifest keeps the same set + values
    const re = deriveUnitAnchors(frozen).anchors;
    expect(close(re.muzzle.at, frozen.anchors.muzzle.at, 1e-9)).toBe(true);
    expect(Object.keys(re).sort()).toEqual(Object.keys(frozen.anchors).sort());
  });
});
