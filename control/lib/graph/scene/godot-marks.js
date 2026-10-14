/**
 * THE GODOT MARKS — one portability source. What a Godot export runs, said once, and read by both the export check
 * (engine-portability.js, engine-score.js's ledger) and the cosmos registry (cosmos/facets, read-sources.js), so the
 * ruler and the export cannot disagree.
 *
 *   built         the kernel runs it as the web does (or, for a look, carries it whole)
 *   approximated  it runs, simpler or in part: the `how` says what stays the web's
 *   absent        nothing in the kernel runs it: the export names it, never drops it silently
 *
 * Every table here is CLOSED against the thing it marks: a new page input, controllable rule, events key, gait shape,
 * system kind or mind axis without a mark fails godot-marks.test.js. Flip a mark in the step that builds its kernel
 * part, never before (the ratchet then asks for the conformance scenario that names it).
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */

export const GODOT_MARKS = Object.freeze(['built', 'approximated', 'absent']);
const RANK = { built: 0, approximated: 1, absent: 2 };
/** The worse of marks: absent over approximated over built; none → built. */
export const worstMark = (...marks) => marks.flat().reduce((w, m) => (RANK[m] > RANK[w] ? m : w), 'built');

const B = 'built', P = 'approximated', A = 'absent';
const m = (godot, how) => Object.freeze({ godot, ...(how ? { how } : {}) });

// ── the controllable runtime's rules (worlds/controllable/compose.js RULES) ──────────────────────────────────────────
// The pilot's walk and platform rules run in kernel/rules.gd (since 0.23.0), held equal to the web's frame by frame (the
// rules conformance corpus), standing on the level's own faces; a power's move merges into the rule as the page grants
// it. Only the pilot runs its rule: another walker stands (engine-portability.js flags it). The page's camera rules
// (follow, eye, overhead, side, fixed) run there too, after the pilot, held equal by the same corpus, when the camera
// watches the pilot the kernel walks (else engine-portability.js flags it). The platform rule's opt-in moves the kernel
// does not run are PLATFORM_KEYS.lost, named per level.
export const RULE_MARKS = Object.freeze({
  walk: m(B, 'kernel/rules.gd: the web walk rule on the level\'s faces (turn, look, strafe, probe, colliders)'),
  follow: m(B, 'kernel/rules.gd: the web chase camera (its ease, shoulder, lead, reverse swing and pitch), pulled in before the land as the page pulls it in; a level whose camera is not the page\'s rides kernel/walker.gd\'s spring arm behind the suit'),
  eye: m(B, 'kernel/rules.gd: first person at the target\'s eye, its heading and pitch'),
  platform: m(B, 'kernel/rules.gd: the web platform rule\'s run, turn (tank, look, world, lane), jump with its cut, buffer, coyote, wind-up, air jumps and glide, boost and its gauge, on the level\'s faces and colliders; its opt-in moves the kernel does not run are named per level (PLATFORM_LOST)'),
  glide: m(A, 'no glide in kernel/walker.gd'),
  overhead: m(B, 'kernel/rules.gd: the ¾ overhead, north up the screen'),
  side: m(B, 'kernel/rules.gd: square to the pilot\'s lane, swinging round its bends (the lane pilot is the platform rule\'s)'),
  fixed: m(B, 'kernel/rules.gd: the stations, cut by the nearest focus, held against flicker'),
  shot: m(B, 'kernel/rules.gd: the directing camera a scene sets aside the page\'s own (frames, moves, the side of the line, the clear view)'),
  clock: m(P, 'a figure-frames body\'s self-playing loop (a glyph, a turntable): the body stands, its frames do not play'),
  mover: m(A, 'movers do not travel (skipped_movers): a moving platform or lift stands at rest'),
  launcher: m(A, 'no launcher: a catapult stands still'),
  drive: m(B, 'kernel/rules.gd: the web drive rule (its power curve, brakes, steer, the ground followed down, walls, flight off a lip with `air`); the surface grip under it is the web\'s (PAGE_MARKS.driveSurface)'),
  racer: m(B, 'kernel/rules.gd: the rivals drive their lines as the web\'s (score.drivers), braking into bends, counting laps, backing off when held up'),
  fly: m(B, 'kernel/rules.gd: fixed-wing flight (taxi, takeoff, banked turns, stall, touchdown)'),
  patrol: m(A, 'no patrol: a guard stands where it was placed'),
  ai: m(A, 'no mind: an AI character stands where it was placed (the cast\'s bus ops still move it)'),
});

// the platform rule's keys (worlds/controllable rules-platform.js, maneuvers.js, combat-melee.js read them), each where
// the kernel runs it: in kernel/rules.gd (ported), in the fight (kernel/combat.gd: the combat_carried row says what of
// it), or not at all (lost: an opt-in move the web runs and the export names). godot-marks.test.js holds this closed.
export const PLATFORM_KEYS = Object.freeze({
  ported: ['type', 'speed', 'turn', 'strafe', 'eye', 'gravity', 'fallGravity', 'jumpSpeed', 'maxFall', 'snap', 'step', 'coyote', 'buffer', 'jumpCut', 'airControl',
    'turnMode', 'lookSens', 'move', 'moveYaw', 'faceRate', 'lane', 'jumpWindup', 'airJumps', 'airJumpMult', 'glideFall', 'collideRadius', 'collideHeight', 'stride',
    'turnStepMin', 'turnStride', 'boostSpeed', 'boostMax', 'boostRegen', 'overheatRegen', 'boostUnlockFrac', 'boostTurnCost', 'jumpBoostCost'],
  fight: ['strike', 'strikeCone', 'strikeContact', 'strikeCooldown', 'strikeDamage', 'strikeDur', 'strikeFx', 'strikeImpact', 'strikeLaunch', 'strikeReach', 'combo', 'comboCooldown', 'comboWindow'],
  lost: {
    space: 'space mode (6DoF drift)', liftAccel: 'space mode', spaceAccel: 'space mode', spaceBoostAccel: 'space mode', spaceBoostMax: 'space mode', spaceDamping: 'space mode', spaceMaxSpeed: 'space mode',
    boostHover: 'the boost hover', hoverRise: 'the boost hover', hoverCoyote: 'the boost hover', boostInertia: 'the boost\'s slide', boostInertiaSpeed: 'the boost\'s slide',
    chargeMax: 'the charged jump', chargeMult: 'the charged jump', chargeDash: 'the charged jump', kneel: 'the kneel',
    dodge: 'the dodge', dodgeBoostCost: 'the dodge', dodgeDur: 'the dodge', dodgeOverheat: 'the dodge', dodgeSpeed: 'the dodge', dodgeTurns: 'the dodge', doubleTapWindow: 'the dodge',
    tackle: 'the tackle', tackleDur: 'the tackle', tackleSpeed: 'the tackle', tackleCone: 'the tackle', tackleDamage: 'the tackle', tackleReach: 'the tackle',
    loadout: 'a loadout\'s other slots', switchReady: 'a loadout\'s other slots', cleaveStep: 'the great cleave\'s step', clashRetreat: 'the clash',
  },
});
// a camera rule's keys the kernel does not run (opt-in): the follow camera's lock tracking (the lock is the web's)
export const CAMERA_LOST = Object.freeze({ lockTrack: 'the lock tracking' });

/** The opt-in moves a platform rule asks for that the kernel does not run, by name (each once). */
export function platformLost(rule) {
  if (!rule || rule.type !== 'platform') return [];
  return [...new Set(Object.keys(rule).filter((k) => rule[k] != null && rule[k] !== false && PLATFORM_KEYS.lost[k]).map((k) => PLATFORM_KEYS.lost[k]))].sort();
}

// space.camera's values, by the camera rule each lowers to (gameworld/cameras.js)
export const CAMERA_RULE = Object.freeze({ 'third-person': 'follow', 'first-person': 'eye', 'top-down': 'overhead', side: 'side', fixed: 'fixed' });

// ── the World page's inputs (scene-three.js emitThreeWorld: a resolved payload spreads into it) ─────────────────────
// `option` rows are how the page is drawn, not what the world is: they carry nothing to an engine.
const OPTION = Object.freeze({ godot: B, option: true });
export const PAGE_MARKS = Object.freeze({
  faces: m(B, 'model.glb (scene-gltf.js), unlit with COLOR_0'),
  cameras: m(B, 'the GLB\'s cameras'),
  viewBox: OPTION, title: OPTION, inline: OPTION, cdn: OPTION, capture: OPTION, pack: OPTION, hud: OPTION, wireframe: OPTION, spin: OPTION, decollide: OPTION, metersPerUnit: OPTION,
  bg: m(B, 'score.bg: the WorldEnvironment\'s background (kernel/level.gd _build_look)'),
  backdrop: m(A, 'the backdrop is an image the page loads by URL: a pack fetches nothing (sky_approximated)'),
  sky: m(P, 'score.skyDome: kernel/sky.gdshader paints the dome\'s gradient, the moon and the sun; its stars are scattered by a hash, not where the page puts them, and the moon\'s phase is not carved'),
  light: m(B, 'baked into the vertex colours by scene-gltf.js, as the page bakes it'),
  glow: m(A, 'glow sprites (camera-facing additive cards) are not drawn'),
  textures: m(B, 'embedded in the GLB (TEXCOORD_0 + PNG)'),
  cutouts: m(P, 'the cutout textures ride the GLB opaque: no alpha test'),
  soft: m(B, 'soft groups carry no colliders, as on the page'),
  repeats: m(B, 'baked into the GLB, one mesh per template'),
  ao: m(B, 'baked into the vertex colours'),
  walk: m(P, 'kernel/walker.gd walks it, standing on a flat plane at score.ground and the box colliders: the page casts its ground onto the land\'s faces (a hill is walked through, a hollow floated over); a level\'s pilot on the walk or platform rule stands on the faces (RULE_MARKS)'),
  picks: m(A, 'pick popups are the page\'s'),
  tracers: m(A, 'tracers are not drawn'), planets: m(A, 'planets do not orbit'), movers: m(A, 'movers do not travel'), comets: m(A, 'comets are not drawn'),
  fields: m(A, 'field lines are not drawn'), surfaces: m(A, 'animated surfaces are not stepped'), heatSpheres: m(A, 'heat spheres are not drawn'),
  starSurfaces: m(A, 'star surfaces are not drawn'), buildups: m(A, 'buildups are not stepped'), transports: m(A, 'transports are not stepped'),
  deforms: m(A, 'deforms are not stepped'), raymarch: m(A, 'the raymarch layer is the page\'s'), signs: m(A, 'animated signage is not stepped'),
  physics: m(A, 'live physics bodies do not travel (skipped_physics)'), actions: m(A, 'input impulses on physics bodies do not travel'),
  entities: m(B, 'GLB nodes placed as the payload places them; their rules are marked by RULE_MARKS'),
  camera: m(B, 'the camera entity; its rule is marked by RULE_MARKS'),
  pilot: m(B, 'the walker pilots the player entity'),
  spectate: m(A, 'no spectator camera'), ai: m(A, 'no mind (P5)'), aiDifficulty: m(A, 'no mind to tune'), commander: m(A, 'no commander'),
  lock: m(A, 'no lock-on'), match: m(A, 'arena match modes do not travel'), hangar: m(A, 'the hangar is the page\'s'),
  colliders: m(B, 'StaticBody3D boxes (level.gd _build_colliders)'),
  breakables: m(P, 'held whole as solid colliders (breakables_held): breaking them is the web\'s'),
  breakPieces: m(A, 'break pieces are not carried'), wreckExplodes: m(A, 'wreck finishers are not carried'),
  shadows: m(A, 'the controllable shadow keys are not drawn'), smoke: m(A, 'smoke is not drawn'),
  tutorial: m(A, 'the tutorial step director does not travel'),
  figures: m(B, 'a rigged figure ships skinned in world and game packs alike (one mesh, its clips, its painted or blend-shape face, its ink; since 0.24.0)'),
  events: m(B, 'bus.json and score.json carry what the kernel runs; the keys they drop are named by EVENT_MARKS'),
  fog: m(A, 'the page\'s fog rides only on weather (weather-score.js)'),
  haze: m(P, 'score.haze: exponential fog in the horizon colour, the background with it, the sky clear of it; Godot\'s exponential curve is not three\'s squared one, so the falloff differs'),
  splats: m(A, 'fur and grass splats are not drawn'),
  audio: m(P, 'the soundtrack and one-shot sounds play (kernel/sound.gd); positional sound and weather beds are the web\'s'),
  fx: m(A, 'camera-facing fx are not drawn (skipped_fx)'), effects: m(A, 'screen effects are not drawn'),
  spriteSfx: m(A, 'sprite sfx are not drawn (skipped_sprite_sfx)'), marks: m(A, 'strength marks are not drawn'),
  driveSurface: m(P, 'the drive rule runs in kernel/rules.gd; the grip and rolling of the ground under a car (`surfaceGrip`) are the web\'s: in Godot a car grips as on its own tarmac'),
  shoot: m(P, 'the edit plays on P (kernel/level.gd, since 0.25.0): the program camera cut for cut, its lens frame by frame; the set pieces and transitions are the page\'s picture, and the world\'s clock does not follow the shots'),
  game: m(B, 'contract.json: the level ends through its contract (kernel/game.gd)'),
  walkers: m(A, 'city walkers are not stepped'), cars: m(A, 'traffic is not stepped'), carMeshes: m(A, 'traffic is not stepped'),
  signals: m(A, 'traffic signals are not stepped'), trafficLanes: m(A, 'traffic is not stepped'), trafficConstants: m(A, 'traffic is not stepped'),
  xr: m(A, 'WebXR is the page\'s'), toon: m(A, 'toon ink hulls are not drawn'), stream: m(A, 'streamed tiles do not travel'),
  strokeOverlay: m(A, 'the stroke overlay is not drawn'),
  terrain: m(P, 'the terrain\'s faces ride the GLB; its LOD and live grass are the web\'s'),
  crystalLight: m(P, 'performed live by kernel/crystal_light.gd; movers do not travel, so stones stand at rest'),
  fire: m(A, 'fire is not drawn'),
  doors: m(P, 'doors and doorways are triggers (kernel/level.gd _build_address); a door leaf does not swing'),
  items: m(P, 'items are triggers (kernel/level.gd _build_address); they are not drawn as the page draws them'),
  shallows: m(A, 'shallows are not drawn'), wetSand: m(A, 'wet sand is not drawn'), softGround: m(A, 'soft ground is not drawn'),
  jets: m(A, 'jets are not drawn'), jetLight: m(A, 'jet light is not drawn'), sway: m(A, 'vegetation does not sway'),
  flicker: m(A, 'lights do not flicker'), motes: m(A, 'motes are not drawn'),
  weather: m(P, 'fog, colour and light (kernel/weather.gd); falls, landings and lightning are the web\'s'),
  tone: m(B, 'kernel/tone.gdshader on each surface, the page\'s ramp, bands and detail (score.tone); the background and the fog off the default ramp'),
  liveGrass: m(A, 'live grass is not drawn'),
  pixel: m(B, 'score.pixel: the 3D drawn at 1/scale and blown up without smoothing (the viewport\'s nearest scaling), the HUD crisp as the page\'s'),
});

// ── the events manifest's keys (the page reads the whole object; what travels rides bus.json or score.json) ──────────
// `carried` rows ride the export (bus.json's fragment, cast, stats, inputs; score.json's hud, hudStyle, menus, looks).
export const EVENT_MARKS = Object.freeze({
  reactions: m(B, 'bus.json'), watches: m(B, 'bus.json'), sequences: m(B, 'bus.json'), timers: m(B, 'bus.json'), vars: m(B, 'bus.json'),
  sources: m(B, 'bus.json: zones and uses'), initial: m(B, 'bus.json'), entities: m(B, 'bus.json: the bus\'s own entities (not drawn: see effect:entities)'),
  budget: m(B, 'bus.json'), depthCap: m(B, 'bus.json'),
  cast: m(B, 'bus.json cast rows (kernel/cast.gd)'), stats: m(B, 'bus.json (kernel/stats.gd)'),
  inputs: m(P, 'keys and clicks travel (bus.json inputs); a pick or a shot on a marker does not'),
  hud: m(B, 'score.json hud (kernel/hud.gd)'), style: m(B, 'score.json hudStyle'), register: m(P, 'score.json hudStyle.register: its motion, sound, cursor and light are the web\'s'),
  menus: m(B, 'score.json menus (level.gd)'),
  looks: m(P, 'score.json looks (kernel/looks.gd): nothing wears one until a script calls looks.wear'),
  scenes: m(B, 'bus.json scenes (kernel/scenes.gd, the page\'s runner ported): the beats, the bars, the text box and the choices; its shots direct the camera when the level has the page\'s camera, as on the page'),
  quests: m(B, 'bus.json quests (kernel/quests.gd): the journal (J) and a word as one begins, moves on, ends'),
});
/** The events keys an export carries (bus.json or score.json), whatever their mark. */
export const EVENT_CARRIED = Object.freeze(Object.keys(EVENT_MARKS));

// ── a figure's gaits (polygonizer/hero-motion.js MOTION_GAITS), by the shape of the gait's row ───────────────────────
// The suit plays its idle and its walk (the locomotion row's `walk`) and its swings; a jump is the walker's own (no
// clip), a stop is a stop (no clip). Nothing plays a pose, a stance, a seat or a vault: the cast's arrive says a pose
// on the bus and draws none.
const AIR_MOVES = Object.freeze({ jump: P, jumpForward: P, jumpBack: P, runningJump: P });
export function gaitMark(name, row) {
  if (!row || typeof row !== 'object') return m(A, 'not a gait');
  if (row.base !== undefined) return name === 'walk' ? m(B, 'the suit\'s walk clip, played at the walker\'s pace') : m(A, 'the walker has one pace: only the walk plays');
  if (row.from !== undefined) return m(P, 'the walker stops; the stop clip does not play');
  if (row.vault !== undefined) return m(A, 'no vault');
  if (row.family !== undefined || row.seconds === undefined) return m(A, 'nothing plays a pose, a stance or a seat');
  return AIR_MOVES[name] ? m(P, 'the walker jumps; the clip does not play') : m(A, 'no air jump and no roll in kernel/walker.gd');
}

// ── power.systems (gameworld/actions.js SYSTEM_KINDS): what a system lowers to ───────────────────────────────────────
export const SYSTEM_MARKS = Object.freeze({
  resource: m(B, 'a stat resource, its keys and its HUD (kernel/stats.gd, hud.gd)'),
  stamina: m(B, 'one stat pool spent by every action (kernel/stats.gd)'),
  unlock: m(B, 'a power\'s move merges into the pilot\'s platform rule the moment the bus hears it picked up (kernel/level.gd, rules.gd)'),
  transform: m(P, 'a form is a stat tier and a transfigure (kernel/cast.gd, drawn simpler)'),
  equip: m(B, 'powers from carried gear: stats and cues'),
  place: m(A, 'a pad wakes what stands asleep there through the cast, but the towers it wakes fire through a mind'),
});

// ── space.traversal (playscape/objects ENTRIES): the runtime rule each lowers to, if any ─────────────────────────────
export const TRAVERSAL_RULE = Object.freeze({ door: null, platform: 'mover', lift: 'mover', catapult: 'launcher', bridge: null, ladder: 'platform', stairs: null });
const TRAVERSAL_HOW = Object.freeze({
  door: m(P, 'a door is a trigger; its leaf does not swing'),
  bridge: m(B, 'a static deck: a floor face and its collider'),
  platform: m(P, 'a static deck travels (a floor face and its collider); a moving one is a mover and stands at rest'),
  stairs: m(B, 'treads as faces over solid blocks'),
});
export function traversalMark(entry) {
  if (TRAVERSAL_HOW[entry]) return TRAVERSAL_HOW[entry];
  const rule = TRAVERSAL_RULE[entry];
  if (rule === undefined) return m(A, 'not marked');
  // a ladder's climb is the platform rule's: the walker does not climb at all
  if (entry === 'ladder') return m(A, 'the walker does not climb (the platform rule\'s climb is the web\'s)');
  return m(RULE_MARKS[rule].godot, `lowers to the ${rule} rule: ${RULE_MARKS[rule].how}`);
}

// ── space.links (era/floormap.js LINK_KINDS): how rooms join ────────────────────────────────────────────────────────
export const LINK_MARKS = Object.freeze({
  open: m(B, 'an opening in the geometry'),
  door: m(P, 'a doorway is a trigger; its leaf does not swing'),
  stair: m(B, 'treads as faces over solid blocks'),
  gap: m(B, 'jumped with the pilot\'s own rule (kernel/rules.gd)'),
});

// ── the mind (cosmos facet mind): the kernel has no mind. A value that asks nothing of one travels ─────────────────
// ambient and passive are the practice dummy: it stands to be met and hit (kernel/cast.gd, combat.gd)
export const MIND_TRAVELS = Object.freeze({
  motivation: ['ambient'], aggressiveness: ['passive'], rank: [], skill: [], perception: [], pathing: [],
  // a routine is cues on the clock's hour and the cast's walk, which the kernel runs (II5): no mind needed
  // talk is a scene with the cast (kernel/scenes.gd, III-d): it asks nothing of a mind either
  squad: ['none'], social: ['none', 'schedule', 'talk'], commander: ['none'],
});
export const mindMark = (axis, value) => ((MIND_TRAVELS[axis] || []).includes(value)
  ? m(B, 'asks nothing of a mind: the character stands to be met')
  : m(A, 'the kernel has no mind (worlds/controllable/mind.js is not ported)'));
