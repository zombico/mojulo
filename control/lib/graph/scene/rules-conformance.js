/**
 * THE RULES CONFORMANCE CORPUS — the motion rules the Godot kernel runs (kernel/rules.gd: walk, and the ground half of
 * platform) against the web's own (worlds/controllable rules-basic.js, rules-platform.js), frame by frame. Each scenario
 * is one pilot on a small piece of land (triangles, as the page's ground raycast meets them: level-equivalence.js
 * faceGround), its colliders and its held input a frame; the web side steps it through the level runtime (level-sim.js,
 * the harness's own web), the Godot side through rules.gd, and both print one canonical snapshot a frame: the pose to
 * 1e-9 and the rule's state (grounded, coyote, the jump buffer, the gait).
 *
 *   SCENARIOS, randomScenarios(n, seed), corpus({ random, seed }), runRules(sc) → [snapshot], scenarioById(id, opts)
 *
 * The hand scenarios pick one case per path through the rules (a tank turn, a look, a strafe, a slope, a wall, a probe;
 * a jump, its cut, its buffer, coyote time, a wind-up, an air jump, a glide, a ledge stepped up, a ledge fallen off, an
 * embed climbed out of; world and lane movement; a boost, its gauge, its lock); the seeded ones throw random input at a random heightfield with boxes.
 */
import { simLevel } from '../game/level-sim.js';
import { faceGround } from '../game/level-equivalence.js';
import { mulberry32 } from '../vegetation/grow.js';

export const DT = 1 / 30;
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── land: quads as faces (corners), their triangles as faceGround fans them ─────────────────────────────────────────
const quad = (x0, y0, x1, y1, z = 0) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });
const ramp = (x0, x1, y0, y1, z0, z1) => ({ corners: [[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]] });
const box = (min, max) => ({ min, max });
export const trianglesOf = (faces) => faces.flatMap((f) => f.corners.slice(1, -1).map((_, i) => [f.corners[0], f.corners[i + 1], f.corners[i + 2]]));

const run = (...parts) => parts.flatMap(([n, input]) => Array.from({ length: n }, () => ({ ...input })));
const pilot = (rule, pos = [0, 0, 1.7], heading = 0) => ({ id: 'hero', pilotable: true, rule, transform: { pos, heading }, body: { type: 'none' } });

const FLAT = [quad(-40, -40, 40, 40)];
const STEPPED = [quad(-40, -40, 4, 40), quad(4, -40, 8, 40, 0.3), quad(8, -40, 12, 40, 1.2), quad(12, -40, 40, 40, 1.2)];

export const SCENARIOS = [
  { id: 'walk-tank', about: 'a tank turn and a walk on flat land, eye above the feet',
    entity: pilot({ type: 'walk', eye: 1.7 }), faces: FLAT, input: run([20, { forward: 1 }], [15, { forward: 1, turn: 0.6 }], [10, { turn: -1 }], [10, { forward: -1 }]) },
  { id: 'walk-slope', about: 'up a ramp and down it, the feet on the faces under the eye',
    entity: pilot({ type: 'walk', eye: 1.7, speed: 5 }), faces: [quad(-20, -10, 0, 10), ramp(0, 10, -10, 10, 0, 3), quad(10, -10, 30, 10, 3)], input: run([70, { forward: 1 }], [20, { turn: 1 }], [70, { forward: 1 }]) },
  { id: 'walk-wall', about: 'into a box, the footprint stops and slides along it',
    entity: pilot({ type: 'walk', eye: 1.7, collideRadius: 0.4, collideHeight: 1.8 }, [0, 0, 1.7], 0.3), faces: FLAT, colliders: [box([4, -6, 0], [6, 6, 3])], input: run([60, { forward: 1 }], [20, { forward: 1, turn: 0.5 }]) },
  { id: 'walk-look', about: 'a look walker: the mouse turns and pitches it, A/D turns it (keyTurn), it strafes',
    entity: pilot({ type: 'walk', eye: 1.6, turnMode: 'look', keyTurn: true, lookPitch: true, strafe: 0.8 }), faces: FLAT, input: run([10, { lookDX: 40, lookDY: -12 }], [20, { forward: 1, strafe: 1 }], [10, { turn: 1, forward: 0.5 }], [10, { lookDX: -300, lookDY: 900 }]) },
  { id: 'walk-probe', about: 'a probe walker steps a tread, never the shelf above it (lower than its eye)',
    entity: pilot({ type: 'walk', eye: 1.7, probe: 0.5 }), faces: [quad(-10, -10, 3, 10), quad(3, -10, 20, 10, 0.4), quad(6, -10, 20, 10, 1.2)], input: run([50, { forward: 1 }]) },
  { id: 'walk-off-the-land', about: 'past the last face: no ground, the height kept',
    entity: pilot({ type: 'walk', eye: 1.7 }), faces: [quad(-5, -5, 5, 5)], input: run([60, { forward: 1 }]) },
  { id: 'platform-jump', about: 'a jump held to its height, a jump cut short, a buffered press landing',
    entity: pilot({ type: 'platform', eye: 1.7, jumpCut: 2 }), faces: FLAT, input: run([5, {}], [2, { jump: 1, jumpHeld: 1 }], [20, { jumpHeld: 1, forward: 1 }], [30, {}], [2, { jump: 1, jumpHeld: 1 }], [40, { forward: 1 }], [1, { jump: 1, jumpHeld: 1 }], [30, {}]) },
  { id: 'platform-ledges', about: 'a step up a low ledge, a high one in the way, a jump onto it, a fall off its end',
    entity: pilot({ type: 'platform', eye: 1.7, collideRadius: 0.3 }), faces: STEPPED, colliders: [box([8, -40, 0], [12, 40, 1.2])], input: run([45, { forward: 1 }], [3, { forward: 1, jump: 1, jumpHeld: 1 }], [30, { forward: 1, jumpHeld: 1 }], [20, { turn: 1 }], [80, { forward: 1 }]) },
  { id: 'platform-coyote', about: 'off a ledge and a press inside the grace still jumps',
    entity: pilot({ type: 'platform', eye: 1.7, coyote: 0.2 }, [0, 0, 4.7]), faces: [quad(-10, -10, 2, 10, 3), quad(-10, -10, 40, 10)], input: run([12, { forward: 1 }], [2, { forward: 1, jump: 1, jumpHeld: 1 }], [40, { forward: 1, jumpHeld: 1 }]) },
  { id: 'platform-windup-airjump-glide', about: 'a wind-up before the launch, an air jump, a glide down',
    entity: pilot({ type: 'platform', eye: 1.7, jumpWindup: 0.15, airJumps: 1, glideFall: 2, airJumpMult: 0.8 }), faces: FLAT, input: run([3, { jump: 1, jumpHeld: 1 }], [18, { jumpHeld: 1 }], [2, { jump: 1, jumpHeld: 1 }], [80, { jumpHeld: 1, forward: 0.5 }]) },
  { id: 'platform-embed', about: 'run into land rising faster than a step: climbed out of, never fallen through',
    entity: pilot({ type: 'platform', eye: 1.7, speed: 9, collideHeight: 1.8 }), faces: [quad(-10, -10, 2, 10), ramp(2, 4, -10, 10, 0, 1.4), quad(4, -10, 20, 10, 1.4)], input: run([40, { forward: 1 }]) },
  { id: 'platform-world', about: 'world movement: W up the screen whichever way the body faces, the body turning toward the run',
    entity: pilot({ type: 'platform', eye: 1.7, move: 'world', moveYaw: Math.PI / 2, faceRate: 8 }), faces: FLAT, input: run([20, { forward: 1 }], [20, { turn: 1 }], [20, { forward: -1, strafe: -1 }]) },
  { id: 'platform-lane', about: 'a side-scroller\'s lane bending at a corner, the body held on the line',
    entity: pilot({ type: 'platform', eye: 1.7, move: 'lane', lane: [[0, 0], [10, 0], [14, 6]] }), faces: FLAT, input: run([60, { turn: 1 }], [20, { strafe: -1 }], [5, { jump: 1, jumpHeld: 1, turn: 1 }], [20, { turn: 1 }]) },
  { id: 'platform-boost', about: 'F held: the dash at boost speed, plain F forward, a strafe dash, a boost in the air',
    entity: pilot({ type: 'platform', eye: 1.7, boostSpeed: 14 }), faces: FLAT, input: run([10, { boost: 1 }], [10, { boost: 1, strafe: 1 }], [10, { boost: 1, forward: -1 }], [2, { boost: 1, jump: 1, jumpHeld: 1 }], [20, { boost: 1, forward: 1, jumpHeld: 1 }], [10, { forward: 1 }]) },
  { id: 'platform-gauge', about: 'a boost gauge drained by thrust, a jump and each flip of the dash, locked empty, refilled cold',
    entity: pilot({ type: 'platform', eye: 1.7, boostMax: 1.5, boostRegen: 0.6, overheatRegen: 1 }), faces: FLAT, input: run([10, { boost: 1, forward: 1 }], [6, { boost: 1, strafe: 1 }], [6, { boost: 1, strafe: -1 }], [2, { boost: 1, jump: 1, jumpHeld: 1 }], [40, { boost: 1, forward: 1 }], [20, { boost: 1, forward: 1 }], [60, {}], [15, { boost: 1, forward: 1 }]) },
  { id: 'platform-look', about: 'a look platformer: the mouse turns and pitches it, A/D strafes it',
    entity: pilot({ type: 'platform', eye: 1.7, turnMode: 'look', strafe: 0.7, airControl: 0.4 }), faces: FLAT, input: run([10, { lookDX: 80, lookDY: 30 }], [20, { forward: 1, turn: -1 }], [2, { jump: 1, jumpHeld: 1, forward: 1 }], [25, { forward: 1, jumpHeld: 1 }]) },
];

// the vehicles: a car's power, brakes, reverse, steer and coast; its opt-in physics; a wall; a ledge; flight off a ramp
// and a crest; a racer round a closed line (its bends, its laps), held up by a wall and backing off; fixed-wing flight
const CAR = { type: 'drive', horsepower: 180, mass: 1300, wheelbase: 2.7, eye: 0.6 };
const RAMP = [quad(-60, -10, 20, 10), { corners: [[20, -10, 0], [30, -10, 3], [30, 10, 3], [20, 10, 0]] }, quad(30, -10, 34, 10, 3), quad(34, -10, 120, 10, -0.5)];
const CREST = [quad(-60, -10, 10, 10), { corners: [[10, -10, 0], [20, -10, 4], [20, 10, 4], [10, 10, 0]] }, { corners: [[20, -10, 4], [26, -10, 0], [26, 10, 0], [20, 10, 4]] }, quad(26, -10, 120, 10)];
const LOOP = [[0, 0], [30, 0], [45, 10], [45, 30], [30, 40], [0, 40], [-15, 30], [-15, 10]];
export const VEHICLE_SCENARIOS = [
  { id: 'drive-basics', about: 'throttle up the power curve, coast, brake, reverse from a stand, steer at speed and slow',
    entity: pilot(CAR, [0, 0, 0.6]), faces: [quad(-200, -200, 200, 200)], input: run([60, { forward: 1 }], [20, {}], [25, { forward: -1 }], [30, { forward: -1 }], [20, { forward: 1, turn: 1 }], [40, { forward: 1, turn: -0.5 }], [30, {}]) },
  { id: 'drive-physics', about: 'the classes\' opt-ins: driven share, brake efficiency, lateral grip, the weather\'s grip, a top speed, a two-wheeler\'s lean',
    entity: pilot({ ...CAR, drivenShare: 0.6, brakeEff: 0.7, lateralGrip: true, muScale: 0.8, topSpeed: 22, wheels: 2, steerTighten: 0.05 }, [0, 0, 0.6]), faces: [quad(-200, -200, 200, 200)], input: run([90, { forward: 1, turn: 0.6 }], [30, { forward: -1, turn: -1 }], [20, {}]) },
  { id: 'drive-wall-ledge', about: 'into a wall it slides along; off a ledge, followed down at the fall rate',
    entity: pilot({ ...CAR, collideRadius: 1, fallRate: 8 }, [0, 0, 2.6], 0.2), faces: [quad(-60, -60, 20, 60, 2), quad(20, -60, 80, 60)], colliders: [{ min: [10, 4, 0], max: [14, 30, 6] }], input: run([90, { forward: 1, turn: -0.1 }]) },
  { id: 'drive-ramp', about: 'off a ramp\'s lip: launched at the lip\'s slope, flown, landed keeping the speed along the landing',
    entity: pilot({ ...CAR, air: true, landKeep: 0.6 }, [0, 0, 0.6]), faces: RAMP, input: run([150, { forward: 1 }]) },
  { id: 'drive-crest', about: 'over a crest fast enough that the ground falls away faster than gravity takes the car',
    entity: pilot({ ...CAR, air: true, horsepower: 400 }, [-50, 0, 0.6]), faces: CREST, input: run([150, { forward: 1 }]) },
  { id: 'racer-loop', about: 'a racer round a closed line: the nearest point ahead, the bends braked into, its laps counted',
    entity: pilot({ ...CAR, type: 'racer', line: LOOP, closed: true, look: 1, reach: 6, corner: 8, pace: 0.9 }, [-2, 0, 0.6], 0), faces: [quad(-200, -200, 200, 200)], input: run([700, {}]) },
  { id: 'racer-grip', about: 'a grip-bound racer\'s speed plan, a lane off its line, a ramp ahead to lift for',
    entity: pilot({ ...CAR, type: 'racer', line: LOOP, closed: true, lateralGrip: true, lane: 1.5, ramps: [{ at: [45, 20], lo: 6, hi: 10 }] }, [0, 0, 0.6], 0), faces: [quad(-200, -200, 200, 200)], input: run([300, {}]) },
  { id: 'racer-stuck', about: 'a racer that cannot get going (a second throttling at a crawl) backs off for one, steering the other way',
    entity: pilot({ ...CAR, type: 'racer', line: [[0, 0], [10, 5], [40, 0]], horsepower: 0.5, mass: 40000 }, [0, 0, 0.6], 0), faces: [quad(-200, -200, 200, 200)], input: run([150, {}]) },
  { id: 'fly-flight', about: 'a taxi, the takeoff roll and rotation, a banked turn, a climb into a stall, the mush, a touchdown',
    entity: pilot({ type: 'fly', mass: 900, thrust: 8000, stallSpeed: 16 }, [0, 0, 0]), faces: [quad(-2000, -2000, 2000, 2000)],
    input: run([30, { forward: 0.3, turn: 0.5 }], [120, { forward: 1, lift: 1 }], [60, { forward: 1, turn: 1 }], [40, { forward: 1, turn: 0 }], [150, { lift: 1, forward: 0 }], [200, { forward: 0.2, lift: -0.5 }], [60, { forward: -1 }]) },
  // the flight dials (the web's skyscape)
  { id: 'fly-glider', about: 'a glider set down aloft, already flying: no engine, W does nothing in the air; it sinks to a landing',
    entity: pilot({ type: 'fly', engine: false, launchSpeed: 24, mass: 300, stallSpeed: 14 }, [0, 0, 120]), faces: [quad(-3000, -3000, 3000, 3000)], input: run([60, { forward: 1, turn: 0.4 }], [120, { lift: -0.4 }], [300, {}]) },
  { id: 'fly-lever', about: 'the throttle a lever that holds where it is left; S at idle on the ground the wheel brakes',
    entity: pilot({ type: 'fly', lever: true, leverRate: 0.8, mass: 900, thrust: 8000 }, [0, 0, 0]), faces: [quad(-3000, -3000, 3000, 3000)], input: run([40, { forward: 1 }], [200, { lift: 0.6 }], [60, { forward: -1 }], [120, {}], [80, { lift: -1, forward: -1 }]) },
  { id: 'fly-space', about: 'space: no gravity, no lift, a turn rate at full bank, the boost and its charge, a barrel roll each way',
    entity: pilot({ type: 'fly', gravity: false, lift: false, turnRate: 1.4, launchSpeed: 40, maxSpeed: 120, boost: { thrust: 2.5, time: 1.5, recharge: 0.8 }, roll: { time: 0.6, side: 20, cooldown: 1 } }, [0, 0, 500]), faces: [],
    input: run([40, { forward: 1, turn: 1 }], [70, { forward: 1, boost: 1 }], [30, { forward: 1, lift: 1 }], [2, { strafe: 1 }], [30, {}], [2, { strafe: -1 }], [10, { strafe: -1 }], [40, { forward: 0.4, boost: 1 }]) },
  { id: 'fly-arcade', about: 'the arcade assist: slow, the nose will not come up and eases down until the speed is back; never a stall; wings level twice as fast',
    entity: pilot({ type: 'fly', assist: 'arcade', mass: 900, thrust: 3000, stallSpeed: 20, launchSpeed: 26 }, [0, 0, 300]), faces: [quad(-3000, -3000, 3000, 3000)], input: run([90, { lift: 1, turn: 1 }], [60, { lift: 1 }], [120, { forward: 1 }]) },
  { id: 'fly-sim', about: 'the sim assist: the bank stays where it is put', entity: pilot({ type: 'fly', assist: 'sim', launchSpeed: 40 }, [0, 0, 300]), faces: [quad(-3000, -3000, 3000, 3000)], input: run([20, { turn: 1, forward: 1 }], [90, { forward: 1 }]) },
  { id: 'fly-bound', about: 'out of the map\'s reach: warned, then the stick taken and the craft turned back toward the centre, its nose toward the centre\'s height',
    entity: pilot({ type: 'fly', gravity: false, lift: false, launchSpeed: 60, bound: { hx: 80, hy: 80, warn: 1, hz: 40, cz: 0 } }, [0, 0, 0], 0.3), faces: [], input: run([400, { forward: 1, lift: 0.4 }]) },
  { id: 'fly-space-surface', about: 'a craft in space meets what it flies into: its ground read without gravity', entity: pilot({ type: 'fly', gravity: false, space: true, launchSpeed: 30 }, [0, 0, 20]), faces: [quad(-3000, -3000, 3000, 3000)], input: run([60, { lift: -1 }], [60, {}]) },
];

// the camera rules, each watching a pilot run a short course (follow, eye, overhead, side, fixed)
const COURSE = run([10, {}], [30, { forward: 1, turn: 0.4 }], [2, { forward: 1, jump: 1, jumpHeld: 1 }], [20, { forward: 1, jumpHeld: 1 }], [20, { turn: -1 }], [30, { forward: 1 }]);
const LOOK_COURSE = run([10, { lookDX: 60, lookDY: 25 }], [30, { forward: 1, lookDX: -10 }], [20, { lookDY: -60 }]);
const HILL = [quad(-40, -40, 40, 40), { corners: [[6, -4, 0], [12, -4, 3], [12, 4, 3], [6, 4, 0]] }, quad(12, -4, 16, 4, 3)];
const shotCam = (shot, at = [0, -10, 3]) => ({ camera: { rule: 'shot', target: 'hero', ...shot }, at, faces: HILL });
export const CAMERA_SCENARIOS = [
  ...[['wide', {}], ['low', { move: 'track' }], ['profile', { move: 'push', for: 1.5 }], ['corner', { move: 'orbit', rate: 0.5 }], ['overhead', {}], ['close', { cut: true, lerp: 6 }], ['two', { side: -1 }]].map(([frame, extra]) => ({
    id: `camera-shot-${frame}`, about: `a directing shot framing the pilot (${frame}${extra.move ? `, ${extra.move}` : ''})`,
    entity: pilot({ type: 'platform', eye: 1.7 }), input: run([20, { forward: 1, turn: 0.3 }], [20, {}]), ...shotCam({ frame, on: ['hero'], ...extra }) })),
  { id: 'camera-shot-two-places', about: 'the pilot and a place across a hill: the side of the line from where the camera stands, a clear view searched',
    entity: pilot({ type: 'walk', eye: 1.7 }), input: run([30, { forward: 1 }]), ...shotCam({ frame: 'two', on: ['hero'], at: [[14, 0], [9, 2, 1]] }, [20, 2, 2]) },
  { id: 'camera-shot-hillside', about: 'a framing that lands in a steep slope: lifted onto it, and a clear view searched round it',
    entity: pilot({ type: 'walk', eye: 1.7 }, [4.5, 0, 1.7], 0), input: run([25, {}]), camera: { rule: 'shot', target: 'hero', frame: 'low', on: ['hero'] }, at: [0, -6, 3],
    faces: [quad(-40, -40, 6, 40), { corners: [[6, -40, 0], [8, -40, 6], [8, 40, 6], [6, 40, 0]] }, quad(8, -40, 40, 40, 6)] },
  { id: 'camera-shot-ridge', about: 'a ridge between the framing and the pilot: the clear view is searched round it',
    entity: pilot({ type: 'walk', eye: 1.7 }, [4, 0, 1.7], 0), input: run([15, {}]), camera: { rule: 'shot', target: 'hero', frame: 'low', on: ['hero'] }, at: [0, -6, 3],
    faces: [quad(-40, -40, 40, 40), quad(5.5, -1, 6, 1, 8)] },
  { id: 'camera-shot-over', about: 'over the place\'s shoulder at the pilot', entity: pilot({ type: 'walk', eye: 1.7 }), input: run([20, { forward: 1 }]), ...shotCam({ frame: 'over', on: ['hero'], at: [[5, 3]] }) },
  { id: 'camera-shot-lone-place', about: 'a lone place: the pilot\'s view of it from behind and above', entity: pilot({ type: 'walk', eye: 1.7 }), input: run([20, { turn: 1, forward: 0.5 }]), ...shotCam({ frame: 'wide', at: [[14, 0]] }) },

  { id: 'camera-follow', about: 'a chase camera easing behind and above, looking ahead of the pilot',
    entity: pilot({ type: 'platform', eye: 1.7 }), faces: STEPPED, input: COURSE, camera: { rule: 'follow', target: 'hero', dist: 7, height: 2.5, shoulder: 0.6, lead: 3, lookH: 1.2, lerp: 6 } },
  { id: 'camera-follow-reverse-pitch', about: 'the reverse chase swinging round, pitched with a look pilot',
    entity: pilot({ type: 'platform', eye: 1.7, turnMode: 'look' }), faces: FLAT, input: LOOK_COURSE, camera: { rule: 'follow', target: 'hero', reverse: true, pitchFollow: 0.7 }, at: [3, -8, 4] },
  { id: 'camera-follow-roll', about: 'a chase banking with a craft that rolls (rollFollow), the sim\'s bank held where it is put',
    entity: pilot({ type: 'fly', assist: 'sim', launchSpeed: 40 }, [0, 0, 300]), faces: [quad(-3000, -3000, 3000, 3000)], input: run([20, { turn: 1, forward: 1 }], [60, { forward: 1 }], [20, { turn: -1 }]), camera: { rule: 'follow', target: 'hero', dist: 12, height: 3, lead: 8, rollFollow: 1 }, at: [0, -12, 303] },
  { id: 'camera-eye', about: 'first person: the eye above the target, its heading and pitch',
    entity: pilot({ type: 'walk', eye: 1.6, turnMode: 'look', lookPitch: true }), faces: FLAT, input: LOOK_COURSE, camera: { rule: 'eye', target: 'hero', height: 0.1 } },
  { id: 'camera-overhead', about: 'the ¾ overhead, north up the screen, a world-movement pilot under it',
    entity: pilot({ type: 'platform', eye: 1.7, move: 'world' }), faces: STEPPED, input: run([40, { forward: 1, turn: 0.5 }], [30, { forward: -1 }]), camera: { rule: 'overhead', target: 'hero', tilt: 1.6, dist: 12 } },
  { id: 'camera-side', about: 'the side camera square to a bending lane, swinging round the bend',
    entity: pilot({ type: 'platform', eye: 1.7, move: 'lane', lane: [[0, 0], [10, 0], [14, 6], [14, 20]] }), faces: FLAT, input: run([120, { turn: 1 }]), camera: { rule: 'side', target: 'hero' } },
  { id: 'camera-fixed', about: 'fixed stations cutting as the pilot passes, held against flicker',
    entity: pilot({ type: 'walk', eye: 1.7, speed: 4 }), faces: FLAT, input: run([90, { forward: 1 }], [30, { turn: 1 }], [40, { forward: 1 }]),
    camera: { rule: 'fixed', target: 'hero', hold: 1, stations: [{ at: [0, 8, 5], focus: [0, 0] }, { at: [6, -8, 5], focus: [6, 0, 0.5] }, { at: [12, 8, 5], focus: [12, 0] }] } },
];

// random input over a random heightfield (a grid of quads at seeded heights) with seeded boxes
export function randomScenarios(n = 8, seed = 1) {
  const rand = mulberry32(seed);
  const r2 = (x) => Math.round(x * 100) / 100;
  const out = [];
  for (let s = 0; s < n; s++) {
    const faces = [];
    for (let x = -4; x < 4; x++) for (let y = -4; y < 4; y++) {
      const h = () => r2(rand() * 1.5);
      faces.push({ corners: [[x * 4, y * 4, h()], [x * 4 + 4, y * 4, h()], [x * 4 + 4, y * 4 + 4, h()], [x * 4, y * 4 + 4, h()]] });
    }
    const colliders = Array.from({ length: 3 }, () => { const cx = r2(rand() * 20 - 10), cy = r2(rand() * 20 - 10); return box([cx, cy, 0], [r2(cx + 1 + rand() * 2), r2(cy + 1 + rand() * 2), r2(0.5 + rand() * 2)]); });
    const platform = rand() < 0.6;
    const rule = platform
      ? { type: 'platform', eye: 1.7, collideRadius: 0.3, ...(rand() < 0.5 ? { turnMode: 'look' } : {}), ...(rand() < 0.3 ? { jumpCut: 3 } : {}), ...(rand() < 0.4 ? { boostMax: r2(0.5 + rand() * 2) } : {}) }
      : { type: 'walk', eye: 1.7, collideRadius: 0.3, strafe: 0.5, ...(rand() < 0.4 ? { turnMode: 'look', keyTurn: true } : {}) };
    const input = [];
    for (let k = 0; k < 6; k++) {
      const pressJump = platform && rand() < 0.4;
      const one = { forward: r2(rand() * 2 - 0.6), turn: r2(rand() * 2 - 1), strafe: rand() < 0.3 ? r2(rand() * 2 - 1) : 0, lookDX: rand() < 0.3 ? r2(rand() * 60 - 30) : 0, ...(platform && rand() < 0.25 ? { boost: 1 } : {}) };
      input.push(...run([2, pressJump ? { ...one, jump: 1, jumpHeld: 1 } : one], [8 + Math.floor(rand() * 20), { ...one, jumpHeld: pressJump && rand() < 0.5 ? 1 : 0 }]));
    }
    out.push({ id: `random-${seed}-${s}`, about: 'seeded input over a seeded heightfield with boxes', entity: pilot(rule, [r2(rand() * 4 - 2), r2(rand() * 4 - 2), 5], r2(rand() * 6)), faces, colliders, input });
  }
  return out;
}

// ── the snapshot: the same canonical string on both sides ────────────────────────────────────────────────────────
function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
// the pose to 1e-9: a step's sine and cosine agree between the engines' libraries to the last bit almost, not always
const nano = (x) => Math.floor(x * 1e9 + 0.5) / 1e9;

export function snapshot(e) {
  const t = e.transform;
  return canon({
    pos: t.pos.map(nano), heading: nano(t.heading), pitch: nano(t.pitch || 0), vz: nano(e.vel[2]),
    gait: nano(e.gaitPhase || 0), moving: !!e.moving,
    ...(e.rule.type === 'platform' ? { grounded: !!e.grounded, coyote: nano(e.coyote ?? 0), buf: nano(e.jumpBuf ?? 0), wind: nano(e.jumpWind ?? 0), air: e.airJumpsUsed ?? 0, loco: e.locomotion, jumped: !!e.jumped, landed: !!e.landed, boosting: !!e.boosting, boost: e.boost == null ? null : nano(e.boost), lock: !!e.boostLock } : {}),
    ...(e.rule.type === 'drive' || e.rule.type === 'racer' ? { speed: nano(e.speed || 0), steer: nano(e.steerAngle || 0), cvz: nano(e.vz || 0), airborne: !!e.airborne, wheel: nano(e.wheelPhase || 0), braking: !!e.braking,
      // a lateral-grip car steered to its limit holds its demand at the tyres' grip exactly (tan of the atan that set
      // it), where the skid flag turns on the maths library's last bit (V8's against Godot's): left out there, the
      // pose and the speed still held
      skidding: e.rule.lateralGrip ? null : !!e.skidding, lean: e.lean == null ? null : nano(e.lean) } : {}),
    ...(e.rule.type === 'racer' ? { lineAt: e.lineAt ?? null, laps: e.laps ?? 0, stuckT: nano(e.stuckT || 0), backT: nano(e.backT || 0) } : {}),
    ...(e.rule.type === 'fly' ? { airspeed: nano(e.airspeed || 0), bank: nano(e.bank || 0), airborne: !!e.airborne, stalled: !!e.stalled, takeoff: !!e.takeoff, touchdown: !!e.touchdown, climb: nano(e.climbRate || 0), loco: e.locomotion,
      lever: e.lever == null ? null : nano(e.lever), boostE: e.boostE == null ? null : nano(e.boostE), boosting: !!e.boosting, rolling: !!e.rolling, oob: !!e.outOfBounds, roll: nano(e.tilt ? e.tilt.roll : 0) } : {}),
  });
}

// a camera: its pose and its look point to 1e-9
const camSnap = (c) => canon({ pos: c.transform.pos.map(nano), heading: nano(c.transform.heading), pitch: nano(c.transform.pitch || 0), lookAt: c.lookAt ? c.lookAt.map(nano) : null, ...(c.roll != null ? { roll: nano(c.roll) } : {}) });

export function runRules(sc) {
  const camera = sc.camera ? { ...clone(sc.camera), ...(sc.at ? { transform: { pos: sc.at.slice(), heading: 0 } } : {}) } : undefined;
  const sim = simLevel({ entities: [clone(sc.entity)], events: {}, ...(sc.colliders ? { colliders: clone(sc.colliders) } : {}), camera }, { ground: faceGround(sc.faces) });
  const snaps = [];
  for (const inp of sc.input) {
    for (const k of Object.keys(sim.input)) delete sim.input[k];
    Object.assign(sim.input, inp);
    sim.frame(DT);
    snaps.push(snapshot(sim.world.byId.hero) + (camera ? `|${camSnap(sim.world.camera)}` : ''));
  }
  return snaps;
}

// what the Godot side reads: the rule, the start pose, the triangles, the colliders, the input
export function corpus({ random = 8, seed = 1 } = {}) {
  return [...SCENARIOS, ...VEHICLE_SCENARIOS, ...CAMERA_SCENARIOS, ...randomScenarios(random, seed)].map((sc) => clone({
    id: sc.id, rule: sc.entity.rule, pos: sc.entity.transform.pos, heading: sc.entity.transform.heading,
    tris: trianglesOf(sc.faces), colliders: sc.colliders || [], input: sc.input, dt: DT,
    // the camera's rule as the controllable engine seats it (core.js createWorld: { type: camera.rule, ...camera })
    ...(sc.camera ? { camera: { type: sc.camera.rule, ...sc.camera }, cameraAt: sc.at || [0, 0, 0] } : {}),
  }));
}

export const scenarioById = (id, { random = 8, seed = 1 } = {}) => [...SCENARIOS, ...VEHICLE_SCENARIOS, ...CAMERA_SCENARIOS, ...randomScenarios(random, seed)].find((s) => s.id === id);
