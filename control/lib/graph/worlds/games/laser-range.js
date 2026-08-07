/**
 * laser-range — "laser whack-a-mole in a room": the CAPSTONE proof world for the game-idioms +
 * ray-fact + controllable stack (game-idioms.plan.md, phase 8). The newton-cradles of this layer —
 * it exercises nearly everything at once, and almost all of it is composed idioms, not bespoke code:
 *
 *   room + walls + obstacles  → bespoke STAGE faces (become scene `solids` ⇒ walk-colliders AND
 *                               fire-occluders: walls block both your steps and your shots)
 *   WASD camera               → the built-in walk mode (manifest `walk: true`)
 *   spheres appear ≤ttl       → spawnOnHeartbeat (cadence, rise:false) + ephemeralTarget (lifetime)
 *   crosshair laser (L-click) → hitConfirm over the `fire` LOS raycast (scene-three mechanism)
 *   walls/obstacles occlude   → the `fire` raycast takes the NEAREST scene hit (occlusion for free)
 *   score + timed round       → scoreCounter + countdownClock + gameOverFreeze
 *
 * Only the STAGE (room geometry + the seeded sphere spawn points) is bespoke; every RULE is an idiom.
 * Determinism: spawn points are a fixed, seeded pool — never Math.random (the contract). The node
 * proof (laser-range.test.js) drives scripted shots and asserts a reproducible hashState; the /world
 * page renders that already-decided truth. Pure builder, shared by the proof + the /world generator.
 */

import { compose, scoreCounter, countdownClock, gameOverFreeze, spawnOnHeartbeat, ephemeralTarget, hitConfirm } from '../game-idioms.js';

// a closed box (4 side quads) standing on the floor — a wall segment or an obstacle pillar. Each
// quad becomes a scene `solid`, so it blocks walking AND occludes the laser.
function box(cx, cy, w, d, h, fill) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = h;
  return [
    { corners: [[x0, y0, 0], [x1, y0, 0], [x1, y0, z1], [x0, y0, z1]], fill },   // -y
    { corners: [[x1, y1, 0], [x0, y1, 0], [x0, y1, z1], [x1, y1, z1]], fill },   // +y
    { corners: [[x1, y0, 0], [x1, y1, 0], [x1, y1, z1], [x1, y0, z1]], fill },   // +x
    { corners: [[x0, y1, 0], [x0, y0, 0], [x0, y0, z1], [x0, y1, z1]], fill },   // -x
  ];
}

export function buildLaserRange({ ttl = 2.0, seconds = 30, room = 8, wall = 3 } = {}) {
  const R = room, H = wall;

  // STAGE — floor + four perimeter walls + two obstacle pillars. All become `solids` (occluders).
  const faces = [
    { corners: [[-R, -R, 0], [R, -R, 0], [R, R, 0], [-R, R, 0]], fill: '#1c1f26', doubleSided: true }, // floor
    { corners: [[-R, -R, 0], [R, -R, 0], [R, -R, H], [-R, -R, H]], fill: '#2a3142' },  // south wall
    { corners: [[R, R, 0], [-R, R, 0], [-R, R, H], [R, R, H]], fill: '#2a3142' },      // north wall
    { corners: [[R, -R, 0], [R, R, 0], [R, R, H], [R, -R, H]], fill: '#2a3142' },      // east wall
    { corners: [[-R, R, 0], [-R, -R, 0], [-R, -R, H], [-R, R, H]], fill: '#2a3142' },  // west wall
    ...box(-2.5, 1.5, 1.4, 1.4, 2.2, '#39435a'),    // obstacle pillar A
    ...box(3.0, -2.0, 1.6, 1.6, 2.4, '#39435a'),    // obstacle pillar B (some spheres sit behind cover)
  ];

  // SPHERE POOL — pre-placed at a FIXED (seeded) set of points, some tucked behind the pillars so
  // line of sight matters. They start hidden; spawnOnHeartbeat + ephemeralTarget drive appear/disappear.
  const spawnPts = [
    [-5.5, 5.5, 1.3], [5.5, 5.5, 1.5], [-5.5, -5.5, 1.1],
    [5.5, -5.5, 1.4], [0, 6.5, 1.6], [-2.5, 1.5, 1.2], [3.0, -2.0, 1.4],
  ];
  const periods = [1.3, 0.9, 1.6, 1.1, 1.4, 1.0, 1.2];
  const ids = spawnPts.map((_, i) => 'sphere-' + i);
  const entities = spawnPts.map((p, i) => ({ id: ids[i], on: false, color: '#ff5a4d', radius: 0.5, position: p }));

  // RULES — all idioms. spawnOnHeartbeat carries the cadence (rise:false → it only emits `pop`);
  // ephemeralTarget owns the appear/await-ttl/disappear lifecycle; hitConfirm is the laser deed.
  const events = compose(
    { entities },
    scoreCounter('score', { label: 'Score' }),
    countdownClock({ var: 'time', from: seconds, gate: 'over', onZero: 'game-over', label: 'Time' }),
    spawnOnHeartbeat({ targets: ids, periods, pop: 'pop', field: 'target', gate: 'over', rise: false }),
    ephemeralTarget({ on: 'pop', ttl, field: 'target' }),
    hitConfirm({ on: 'fire', emit: 'shot', score: 'score' }),
    gameOverFreeze({ signal: 'game-over', gate: 'over', clear: ids }),
  );

  // `walk: true` opts the /world page into WASD first-person; the camera frames the room on entry.
  return { kind: 'controllable', walk: true, events, faces, ids, worldFraming: { cameraPosition: [0, -R - 4, 5], lookAt: [0, 0, 1.2], horizontalFov: 70 } };
}
