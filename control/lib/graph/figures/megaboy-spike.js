/**
 * megaboy-spike — PURE SPIKE: drive the mega-boy figure around a world in third-person, with a
 * laser sight that pops targets. The point is to SEE mega-boy controllable and prove interactivity —
 * not a game. It exercises the movers+events combo end-to-end:
 *
 *   controllable MOVER  → a hero whose RULE is `platform` (run + jump) and whose BODY is mega-boy
 *                         baked to figure-frames; a `follow` camera trails him (third-person).
 *   laser              → a `fire` LOS raycast (hitConfirm) over target spheres, aimed from MEGA-BOY's
 *                         OWN line of sight (`from:'hero'`, horizontal at muzzle height) — NOT
 *                         camera-forward. A world-space dot marks where he points; turn with the MOUSE
 *                         to sweep it onto a target, click to fire. Works live with no region source.
 *
 * CONTROLS (twin-stick): W/S forward/back · A/D strafe left/right · MOUSE rotates (click once to
 * capture the pointer) · Space jump · left-click fire.
 *
 * MODEL: the mega-boy figure-VAJRA (character-megaboy-vajra.js) — the wave-form ring primitive with
 * a re-girthed radii override (broad shoulders, thick limbs, helmet head + ear-pods), NOT the
 * stacked-cylinder character-mega-boy.js. Posed per frame by a walk dof and baked to figure-frames.
 *
 * SCALE NOTE: packFigureFrames packs a figure in its OWN units with no world normalization, so we
 * normalize the baked frames to a human ~1.8-unit height here (the vajra figure is ~1 unit tall;
 * the earlier cm-scale mega-boy was ~40 and buried the follow camera at his ankle).
 */

import { compose, scoreCounter, hitConfirm } from '../worlds/game-idioms.js';
import { buildMegaBoyVajraFaces } from './character-megaboy-vajra.js';

// a closed box standing on the floor — cover / occluder. Each quad is a scene solid: it blocks the
// platform rule's ground raycast AND occludes the laser (a shot into a wall is no hit).
function box(cx, cy, w, d, h, fill) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  return [
    { corners: [[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill },
    { corners: [[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill },
    { corners: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill },
    { corners: [[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill },
    { corners: [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], fill, doubleSided: true },
  ];
}

function arenaFaces() {
  return [
    { corners: [[-14, -12, 0], [14, -12, 0], [14, 12, 0], [-14, 12, 0]], fill: '#1b2230', doubleSided: true }, // floor
    ...box(5.5, 2.5, 1.6, 1.6, 1.7, '#2f3a52'),    // a pillar near a couple of targets (cover / occluder)
    ...box(7.0, -3.5, 2.2, 1.0, 1.4, '#2f3a52'),   // a low wall some targets sit behind
  ];
}

// ── locomotion clips: each is N poses → N figure-frames ({faces}). The walk/platform rule advances
// gaitPhase by the DOMINANT axis and picks the matching clip, so fore/aft plays `forward` and A/D
// plays `strafe`. ──

// forward walk: contralateral fore-aft leg + arm swing (hip PITCH). Reads as walking/running forward.
function walkPose(p) {
  const s = Math.sin(p * Math.PI * 2);
  const legA = 28, armA = 20, kneeA = 46, trunk = 12;
  return {
    hipL: { pitch: legA * s }, hipR: { pitch: -legA * s },
    kneeL: Math.max(0, -kneeA * s), kneeR: Math.max(0, kneeA * s),
    shL: { pitch: -armA * s }, shR: { pitch: armA * s },
    shoulders: -trunk * s, pelvis: (trunk * 0.6) * s,
  };
}

// strafe / side-step: body stays facing forward; legs scissor LATERALLY (hip YAW = abduction) with
// alternating knee-lift, so it reads as stepping sideways rather than sliding. Symmetric, so the same
// clip serves left and right (signed gaitPhase just offsets the phase).
function strafePose(p) {
  const s = Math.sin(p * Math.PI * 2);
  const abd = 16, kneeA = 40, arm = 8;
  return {
    hipL: { yaw: abd * s }, hipR: { yaw: -abd * s },          // legs spread/close laterally
    kneeL: Math.max(0, kneeA * s), kneeR: Math.max(0, -kneeA * s),  // alternating lift
    shL: { pitch: arm }, shR: { pitch: arm },                // arms a touch forward for balance
  };
}

/**
 * Bake mega-boy's locomotion CLIPS as figure-frames ({ faces } per frame — the shape emitThreeWorld
 * `figures` takes). Both clips share ONE scale (from the forward neutral pose) so the figure never
 * changes size when the renderer switches clips. Returns { forward: [...], strafe: [...] }.
 */
export function bakeMegaBoyClips(n = 8, { targetH = 1.8 } = {}) {
  let mn = Infinity, mx = -Infinity;                         // one scale for every clip/frame
  for (const f of buildMegaBoyVajraFaces(walkPose(0))) for (const c of f.corners) { if (c[2] < mn) mn = c[2]; if (c[2] > mx) mx = c[2]; }
  const s = targetH / ((mx - mn) || 1);
  const bake = (poseFn) => Array.from({ length: n }, (_, i) => ({
    faces: buildMegaBoyVajraFaces(poseFn(i / n)).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x * s, y * s, z * s]) })),
  }));
  return { forward: bake(walkPose), strafe: bake(strafePose) };
}

/** Build the mega-boy arena spec: a controllable mega-boy + laser targets. */
export function buildMegaBoyArena({ figureName = 'megaboy' } = {}) {
  const AIM = 1.4;   // muzzle + target height: a level shot at AIM hits a target centered at AIM.
  const targetsXY = [[6, 0], [8.5, 4], [8.5, -4], [3, 7.5], [3, -7.5], [11, 1.5]];
  const targets = targetsXY.map(([x, y], i) => ({ id: 't' + i, on: true, color: '#ff5a4d', radius: 0.6, position: [x, y, AIM] }));

  const events = compose(
    { entities: targets },                                 // bus props → red target spheres
    scoreCounter('hits', { label: 'Hits' }),
    // LOS laser from MEGA-BOY's own line of sight (`from`), horizontal (`level`) at muzzle height `eye`
    // — pure-yaw aim, so turning (mouse) sweeps it across targets at the same height. The world-space
    // red dot marks exactly where it points → aim by putting the dot on a target, click to fire.
    hitConfirm({ on: 'fire', emit: 'shot', score: 'hits', drop: true, from: 'hero', eye: AIM, level: true }),
  );

  // TWIN-STICK controls: W/S forward/back · A/D STRAFE left/right · mouse rotates (steers heading) ·
  // Space jump. `turnMode:'look'` frees A/D to strafe and routes the mouse to heading; the follow
  // camera trails that heading, so the view rotates ONLY on the mouse (never on strafing).
  const hero = {
    id: 'hero',
    rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, strafe: 1, jumpSpeed: 8.5, coyote: 0.1, lookSens: 0.0022 },
    body: { type: 'figure-frames', figure: figureName },
    transform: { pos: [0, 0, 0.1], heading: 0 },                                  // faces +X
  };
  // stable chase: `mouseLook` captures the pointer (click once) so raw mouse steers; tight `lerp`
  // keeps it planted behind the hero (only swings when the mouse turns him), small `shoulder` to see past.
  const camera = { rule: 'follow', target: 'hero', mouseLook: true, dist: 5, height: 2.2, shoulder: 0.8, lead: 2, lookH: 1.5, lerp: 10 };

  return {
    kind: 'controllable',
    entities: [hero],
    camera,
    figures: { [figureName]: { asset: 'megaboy' } },       // SPEC marker — baked by the spike, not world-scene (gap #1)
    events,
    faces: arenaFaces(),
    worldFraming: { cameraPosition: [-5, 0, 3], lookAt: [3, 0, 1.1], horizontalFov: 65 },
    targets,
  };
}
