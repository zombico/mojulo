/**
 * The player: a hero from the hero door, driven in a world. Scapeshift makes the place; the player is what makes it
 * played, so it lives here. A hero already carries a rig and its own clips (station-loft-rig.js packs them in the
 * keys the World page plays on every rig body); what the player adds is the MOVE SET: the clips a hero lacks for the
 * runtime's states (the jump's wind-up and its flight), and which of its clips plays each state.
 *
 * The moves start from an outside ANIMATION LIBRARY (figures/library: Quaternius's CC0 locomotion ships), retargeted
 * onto the hero's rig: most heroes are happy to start with a library's walk and jump. The hero's own clips and the
 * move set's fill the gaps the library leaves; `library: false` plays the hero's own and the move set's alone.
 *
 *   LIBRARY_STATES          per library, runtime state → library clip (a jog, an idle, the jump's start and loop)
 *   PLAYER_CLIPS            the clips the move set adds, in the hero door's pose words (validated by the rig at mint)
 *   playerHero(spec)        the hero's spec with the move set's clips beside its own (its own win on a name clash)
 *   playerStates(clips, library?)  runtime state → clip: the library's where it has one, else the hero's own (forward
 *                           runs or walks, idle idles relaxed, leap and boost hold the jump's flight, squat winds up)
 *   playerWorld({ hero, id?, library?, level?, controls?, title? })
 *                           a controllable world manifest: the hero as the pilot (the platform rule: WASD and Space),
 *                           a follow camera, a test course, and the controls as a `legend` idiom on the HUD
 *
 * The figures map takes the hero inline (`hero`) or stored (`heroRef`, world-scene.js), so the same manifest plays a
 * hero minted once at the door.
 */
import { lowerIdioms, compose } from '../worlds/game-idioms.js';
import { resolveObject } from './objects/index.js';

/** The move set's own clips. A wind-up crouch (the platform rule plays it for `jumpWindup` seconds, its phase the
 *  depth) and the flight (held for the whole jump: legs tucked, arms thrown up). */
export const PLAYER_CLIPS = Object.freeze({
  squat: { seconds: 0.3, keys: [
    { crouch: 0.05, spine: { lean: ['forward', 0.1] }, armL: { x: -0.15, y: 0, z: -0.98 }, elbowL: 20, armR: { x: 0.15, y: 0, z: -0.98 }, elbowR: 20 },
    { crouch: 0.32, spine: { lean: ['forward', 0.35] }, head: { pitch: 8 }, kneeL: 70, kneeR: 70, armL: { x: -0.2, y: -0.55, z: -0.8 }, elbowL: 25, armR: { x: 0.2, y: -0.55, z: -0.8 }, elbowR: 25 },
  ] },
  leap: { seconds: 0.6, keys: [
    { spine: { arch: 0.15 }, head: { pitch: -6 }, legR: { x: 0.05, y: 0.55, z: -0.83 }, kneeR: 85, legL: { x: -0.05, y: -0.2, z: -0.98 }, kneeL: 35, armL: { x: -0.35, y: 0.3, z: 0.88 }, elbowL: 30, armR: { x: 0.35, y: 0.3, z: 0.88 }, elbowR: 30 },
    { spine: { arch: 0.18 }, head: { pitch: -8 }, legR: { x: 0.05, y: 0.6, z: -0.8 }, kneeR: 90, legL: { x: -0.05, y: -0.15, z: -0.99 }, kneeL: 40, armL: { x: -0.4, y: 0.25, z: 0.88 }, elbowL: 35, armR: { x: 0.4, y: 0.25, z: 0.88 }, elbowR: 35 },
  ] },
});

/** The hero's spec with the move set's clips added (the hero's own clip of the same name wins). */
export function playerHero(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('player: give the hero as the hero door takes it ({ cast, head, … })');
  return { ...spec, clips: { ...PLAYER_CLIPS, ...(spec.clips || {}) } };
}

/** Per library, the clip each runtime state plays (a person: the jump's flight under boost too, no thrusters). */
export const LIBRARY_STATES = Object.freeze({
  'quaternius-ual': Object.freeze({ forward: 'Jog_Fwd_Loop', idle: 'Idle_Loop', leap: 'Jump_Loop', boost: 'Jump_Loop', squat: 'Jump_Start', turn: 'Walk_Loop', strafe: 'Jog_Fwd_Loop' }),
});
// the run cycle's length at the run speed, per library: the stride that keeps the feet on the ground
const LIBRARY_STRIDE = { 'quaternius-ual': { speed: 3.6, stride: 3.3 } };

/** Which clip plays each runtime state: the library's where it names one, else the hero's own by the clips it has. */
export function playerStates(clipNames, library = null) {
  const has = new Set(clipNames), pick = (...xs) => xs.find((x) => has.has(x));
  const forward = pick('run', 'walk'), idle = pick('idleRelaxed', 'idle'), leap = pick('leap');
  const own = Object.fromEntries(Object.entries({ forward, idle, leap, boost: leap, squat: pick('squat'), turn: pick('walk', 'run'), strafe: forward }).filter(([, v]) => v));
  if (!library) return own;
  if (!LIBRARY_STATES[library]) throw new Error(`player: no states for the library '${library}' (libraries: ${Object.keys(LIBRARY_STATES).join(', ')})`);
  return { ...own, ...LIBRARY_STATES[library] };
}

const hex = (v) => '#' + [v, v, v].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
// an axis-aligned box as faces (its top and sides) and its collider
function block(min, max, v = 0.62) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max, fill = hex(v), side = hex(v * 0.82);
  const faces = [
    { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill },
    { corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], fill: side },
    { corners: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], fill: side },
    { corners: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], fill: side },
    { corners: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], fill: side },
  ];
  return { faces, collider: { min, max } };
}

/** The test course: hop-up blocks in steps a jump clears, a flight of stairs onto a terrace, and a wall to walk into. */
export function testCourse() {
  const parts = [
    block([-1, 4, 0], [1, 6, 0.45], 0.7),        // a step a jump clears
    block([-1, 6, 0], [1, 8, 0.9], 0.64),        // the next, half a metre up again
    block([-1, 8, 0], [1, 10, 1.35], 0.58),      // the top of the hop-up
    block([4, 4, 0], [8, 9, 1.6], 0.5),          // the terrace the stairs reach
    block([-8, -2, 0], [-7.6, 6, 1.2], 0.45),    // a wall to walk into
  ];
  const stairs = resolveObject({ entry: 'stairs', variant: 'flight', from: [6, 0, 0], to: [6, 4, 1.6], width: 1.6 });
  return {
    faces: [...parts.flatMap((p) => p.faces), ...stairs.world.faces],
    colliders: [...parts.map((p) => p.collider), ...stairs.world.colliders],
  };
}

/** A controllable world with the hero as the pilot. */
export function playerWorld({ hero, heroRef, id = 'hero', library = 'quaternius-ual', level, controls, title, clips, rule } = {}) {
  if (!hero && !heroRef) throw new Error('player: give a hero (inline, as the hero door takes it) or a heroRef');
  const spec = hero ? playerHero(hero) : null;
  const states = clips || playerStates(spec ? [...Object.keys(spec.clips), 'idle', 'walk', 'wave'] : ['idle', 'walk'], library || null);
  const pace = (library && LIBRARY_STRIDE[library]) || { speed: 4, stride: 3.2 };
  const L = level || testCourse();
  const ground = { size: 40, cell: 2, colorA: '#8a8c90', colorB: '#94969a' };
  const floor = [];
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) { const x = -20 + i * 2, y = -20 + j * 2; floor.push({ corners: [[x, y, 0], [x + 2, y, 0], [x + 2, y + 2, 0], [x, y + 2, 0]], fill: (i + j) % 2 ? ground.colorA : ground.colorB, doubleSided: true }); }
  const legend = controls ?? 'W / S  run · A / D  turn · Space  jump';
  return {
    kind: 'controllable',
    title: title || 'mojulo player test',
    bg: '#c9ccd2',
    faces: [...floor, ...L.faces],
    colliders: L.colliders,
    figures: { [id]: { ...(spec ? { hero: spec } : { heroRef }), ...(library ? { library } : {}), clips: states } },
    entities: [{
      id, pilotable: true,
      // a person, not a suit: a jog of under 4 m/s, a hop of about a metre, a short wind-up; the stride is the run
      // cycle's length at that speed, so the feet keep pace with the ground
      rule: { type: 'platform', speed: pace.speed, turn: 2.6, jumpSpeed: 6.5, jumpWindup: library ? 0.15 : 0.08, stride: pace.stride, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(rule || {}) },
      body: { type: 'figure-rig', figure: id },
      transform: { pos: [0, -4, 0], heading: Math.PI / 2 },
    }],
    camera: { rule: 'follow', target: id, dist: 5.5, height: 2.4, lookH: 1.1, lead: 1.5 },
    ...(legend ? { events: compose(...lowerIdioms([{ kind: 'legend', text: legend, slot: 'bottom', ttl: 12 }])) } : {}),
  };
}
