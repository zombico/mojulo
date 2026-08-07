/**
 * unit-anchors — the SEMANTIC-FRAME layer over an assembled biped unit
 * (mobile-suit-builder.plan.md R6-A: "the add-context-later hook").
 *
 * The rig gives a unit a skeleton; anchors give it MEANING. An anchor is a
 * named point (optionally with a direction) that RIDES a bone — muzzle,
 * sensorEye, cockpit, thruster, weakpoint, grip. Every downstream system then
 * addresses a part by what it IS, not by geometry: firing FX at `muzzle`,
 * camera framing on `cockpit`, damage on `weakpoint`, gaze from `sensorEye`.
 * The specialization rides an OPEN `tags` list, so a new kind of context is a
 * new tag (or a new anchor), never new code.
 *
 *   deriveUnitAnchors(manifest)  → default anchors from the rig joints
 *                                  (sensorEye/cockpit) + INGESTED weapon
 *                                  hardpoints (muzzle/grip when armed), with
 *                                  explicit `manifest.anchors` winning per name.
 *   freezeUnitAnchors(manifest)  → the derived anchors written INTO the
 *                                  manifest (frozen suit-frame, like the rig),
 *                                  so a minted unit carries them and never drifts.
 *   anchorWorld(manifest, pose, name)  → the posed anchor { pos, dir } under a
 *                                  pose/clip dof — resolved through the SAME
 *                                  bone affine bakeUnitRig/compileUnitPose use,
 *                                  so an anchor tracks its part for free (the
 *                                  muzzle follows the rifle through boost lean).
 *
 * Frame: anchors are stored in SUIT-frame absolutes (like gravity seats), so at
 * rest an anchor resolves to itself (the bone affine is identity). The affine
 * runs in the RIG frame (+y forward), so anchorWorld conjugates suit→rig→suit
 * exactly the way compileUnitPose lowers a bone motion into the assembler.
 *
 * Known scope (stated): anchorWorld returns positions in the unit's OWN frame
 * (suit, or rig with { frame:'rig' }); mapping into a live world's normalized
 * render space (centered x/y, feet z=0, height scale) is bakeUnitRig's job and
 * a documented follow-on, not part of this layer.
 */

import { articulateTransforms } from '../polygonizer/figure-vajra.js';
import { resolvePose } from '../polygonizer/figure-posing.js';
import { deriveBipedRig, eulerToMat } from './unit-pose.js';
import { facingYaw } from './workbench.js';

const DEG = Math.PI / 180;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rotZdeg = (deg) => {
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
};
const mvec = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const transpose = (M) => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const IDENT = { m: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: { x: 0, y: 0, z: 0 } };

// A weapon RECIPE (ms-rifle et al.) declares its hardpoints in its own local
// frame (localFrame.forward = +y); we ingest them as anchors. primaryGrip →
// grip<side>, supportGrip → support<side>, muzzle → muzzle (with a forward dir).
const HARDPOINT_ANCHORS = {
  muzzle: { anchor: 'muzzle', tags: ['fire'], dir: true },
  primaryGrip: { anchor: 'grip', tags: ['hardpoint'] },
  supportGrip: { anchor: 'support', tags: ['hardpoint'] },
};

/**
 * Derive the semantic anchors for an assembled biped unit.
 *
 * @param {object} manifest  a stored `assembler` unit (biped — deriveBipedRig
 *   must succeed, or a frozen `manifest.rig` supplies it).
 * @param {object} [opts.rig]  a precomputed deriveBipedRig result.
 * @returns {{ anchors: Record<string, {on, at:[x,y,z], dir?:[x,y,z], tags:string[], region?}> }}
 *   anchors in SUIT-frame absolutes.
 */
export function deriveUnitAnchors(manifest = {}, { rig: rigOverride } = {}) {
  const rig = rigOverride || deriveBipedRig(manifest);
  const At = transpose(rotZdeg(-facingYaw(manifest.facing)));   // rig → suit
  const suit = (j) => mvec(At, [j.x, j.y, j.z]);
  const fwd = norm(mvec(At, [0, 1, 0]));   // the unit's forward, suit frame
  const J = rig.joints;
  const anchors = {};

  // ── defaults from the rig joints ───────────────────────────────────────────
  if (J.headBase && J.headTop) {
    const mid = { x: (J.headBase.x + J.headTop.x) / 2, y: (J.headBase.y + J.headTop.y) / 2, z: (J.headBase.z + J.headTop.z) / 2 };
    anchors.sensorEye = { on: 'head', at: suit(mid), dir: fwd, tags: ['camera', 'gaze'] };
  }
  if (J.navel) {
    anchors.cockpit = { on: 'torso', at: suit(J.navel), dir: fwd, tags: ['camera'] };
  }

  // ── ingest weapon hardpoints (arming a unit populates its fire anchors) ─────
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  for (const item of items) {
    const hp = item?.source?.armory?.hardpoints;
    if (!hp || typeof hp !== 'object') continue;
    const key = typeof item.id === 'string' ? item.id : null;
    const bone = key ? rig.bones[key] : null;
    if (!bone) continue;                       // a hardpoint anchor must ride a known bone
    const side = bone.endsWith('L') ? 'L' : bone.endsWith('R') ? 'R' : '';
    const scale = Number.isFinite(item.scale) ? item.scale : 1;
    const R = Array.isArray(item.rotate) ? eulerToMat(item.rotate) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const at0 = Array.isArray(item.at) ? item.at : [0, 0, 0];
    for (const [hpName, spec] of Object.entries(HARDPOINT_ANCHORS)) {
      const local = hp[hpName];
      if (!Array.isArray(local)) continue;
      const pos = vadd(at0, mvec(R, [local[0] * scale, local[1] * scale, local[2] * scale]));
      const name = spec.anchor === 'muzzle' ? 'muzzle' : spec.anchor + side;
      anchors[name] = {
        on: bone,
        at: pos.map(r4),
        ...(spec.dir ? { dir: norm(mvec(R, [0, 1, 0])) } : {}),
        tags: [...spec.tags],
      };
    }
  }

  // ── explicit overrides win per name (partial merge) ────────────────────────
  const declared = manifest.anchors && typeof manifest.anchors === 'object' ? manifest.anchors : null;
  if (declared) {
    for (const [name, a] of Object.entries(declared)) {
      if (!a || typeof a !== 'object') continue;
      anchors[name] = { ...(anchors[name] || {}), ...a };
    }
  }

  return { anchors };
}

/**
 * Freeze the derived anchors INTO the manifest (suit-frame, rounded) — the
 * "declared context as data" sibling of freezeUnitRig. Mint units through this
 * so what was proven at mint time can never drift.
 */
export function freezeUnitAnchors(manifest = {}, { rig } = {}) {
  const { anchors } = deriveUnitAnchors(manifest, { rig });
  const frozen = {};
  for (const [name, a] of Object.entries(anchors)) {
    frozen[name] = {
      on: a.on,
      at: a.at.map(r4),
      ...(a.dir ? { dir: a.dir.map((v) => r4(v)) } : {}),
      tags: [...(a.tags || [])],
      ...(a.region ? { region: a.region } : {}),
    };
  }
  return { ...manifest, anchors: frozen };
}

/**
 * Resolve one anchor's live { pos, dir } under a pose. `pose` is a figure-posing
 * spec or raw dof (a clip's own dof passes straight through resolvePose), so a
 * clip key resolves by feeding its `pose(phase)`.
 *
 * @param {object} manifest  a unit carrying (or able to derive) `anchors`.
 * @param {object} [pose]    posing spec / dof (default rest).
 * @param {string} name      the anchor to resolve.
 * @param {object} [opts.rig]     precomputed rig.
 * @param {'suit'|'rig'} [opts.frame='suit']  output frame.
 * @returns {{ pos:[x,y,z], dir:?[x,y,z] }}
 */
export function anchorWorld(manifest = {}, pose = {}, name, { rig: rigOverride, frame = 'suit' } = {}) {
  const rig = rigOverride || deriveBipedRig(manifest);
  const anchors = (manifest.anchors && typeof manifest.anchors === 'object')
    ? manifest.anchors
    : deriveUnitAnchors(manifest, { rig }).anchors;
  const a = anchors[name];
  if (!a) throw new Error(`anchorWorld: no anchor '${name}' (have ${Object.keys(anchors).join(', ') || 'none'})`);

  const A = rotZdeg(-facingYaw(manifest.facing));   // suit → rig
  const At = transpose(A);                          // rig → suit
  const { bones: T } = articulateTransforms(resolvePose(pose || {}), rig.joints);
  const bt = (a.on && T[a.on]) ? T[a.on] : IDENT;

  // rest suit → rig → posed rig (= m·p + t) → back to suit
  const posedRig = vadd(mvec(bt.m, mvec(A, a.at)), [bt.t.x, bt.t.y, bt.t.z]);
  const dirRig = a.dir ? norm(mvec(bt.m, mvec(A, a.dir))) : null;
  if (frame === 'rig') return { pos: posedRig, dir: dirRig };
  return { pos: mvec(At, posedRig), dir: dirRig ? norm(mvec(At, dirRig)) : null };
}

/**
 * All anchors carrying a tag, as [{ name, ...anchor }]. The consumer's front
 * door: `anchorsByTag(unit, 'fire')` → every muzzle/emitter to spawn from.
 */
export function anchorsByTag(manifest = {}, tag, { rig } = {}) {
  const anchors = (manifest.anchors && typeof manifest.anchors === 'object')
    ? manifest.anchors
    : deriveUnitAnchors(manifest, { rig }).anchors;
  return Object.entries(anchors)
    .filter(([, a]) => Array.isArray(a.tags) && a.tags.includes(tag))
    .map(([name, a]) => ({ name, ...a }));
}
