/**
 * THE GODOT MARKS — what a Godot export runs, said once, and read by both the export check (engine-portability.js,
 * engine-score.js's ledger) and the cosmos registry (cosmos/facets, read-sources.js), so the ruler and the export
 * cannot disagree. One engine's marks module (engines/marks.js says the shape and the vocabulary; every engine with a
 * runtime kernel exports these same tables over the same keys).
 *
 * Every table here is CLOSED against the thing it marks: a new page input, controllable rule, events key, gait shape,
 * system kind or mind axis without a mark fails the ratchet (engines/marks.test.js for every engine, godot-marks.test.js
 * for what only Godot proves). Flip a mark in the step that builds its kernel part, never before (the ratchet then
 * asks for the conformance scenario that names it).
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */
import { markRow, optionRow, TRAVERSAL_RULE } from './engines/marks.js';

const B = 'built', P = 'approximated', A = 'absent';
const m = markRow('godot');

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
  platform: m(B, 'kernel/rules.gd: the web platform rule\'s run (its ground acceleration too), turn (tank, look, world, lane), jump with its cut, buffer, coyote, wind-up, air jumps and glide, boost and its gauge, on the level\'s faces and colliders; its opt-in moves the kernel does not run are named per level (PLATFORM_LOST)'),
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
  fly: m(B, 'kernel/rules.gd: fixed-wing flight (taxi, takeoff, banked turns, stall, touchdown) and its dials since 0.27.0 (a glider, the throttle lever, space, the boost, the barrel roll, the assist, the map\'s bound)'),
  patrol: m(A, 'no patrol: a guard stands where it was placed'),
  ai: m(B, 'kernel/mind.gd (since 0.26.0): the web mind (every motivation, perception and memory, cover, pathing on the web\'s grid in kernel/nav.gd, groups in kernel/group.gd, the blade, the roll, the charge, the loadout, the tier, a body\'s own tuning, a boss\'s phases and adapting), firing and swinging through kernel/combat.gd; the commander and the pilot\'s shove-down set piece stay the web\'s'),
});

// the platform rule's keys (worlds/controllable rules-platform.js, maneuvers.js, combat-melee.js read them), each where
// the kernel runs it: in kernel/rules.gd (ported), in the fight (kernel/combat.gd: the combat_carried row says what of
// it), or not at all (lost: an opt-in move the web runs and the export names). godot-marks.test.js holds this closed.
export const PLATFORM_KEYS = Object.freeze({
  ported: ['type', 'speed', 'accel', 'decel', 'turn', 'strafe', 'eye', 'gravity', 'fallGravity', 'jumpSpeed', 'maxFall', 'snap', 'step', 'coyote', 'buffer', 'jumpCut', 'airControl',
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
    hitstop: 'the melee hitstop (both bodies frozen on a connect)',
    wall: 'the wall (wall.js: any face held, crawled, mantled, jumped off)', metre: 'the wall and the gear', gear: 'the gear (swing.js: the swinger\'s line, its swing and zip)',
  },
});
// the `ai` rule's opt-in moves the kernel's mind does not run (yet): the match player and the arena shooter's moves
// (worlds/controllable/mind.js since the shooter spike). Named per level, as the platform rule's are.
export const AI_LOST = Object.freeze({
  floors: 'floors and their stairs', peek: 'peeking round an edge', items: 'items and their timing', keepRange: 'keeping a long gun\'s range',
  perches: 'perches', objective: 'an objective to hold', clearLine: 'holding fire past a teammate', clearance: 'a flier\'s ground clearance',
  hearRange: 'the match player (frag)', leadSpan: 'the match player (frag)', hunchEvery: 'the match player (frag)', fragGrudge: 'the match player (frag)',
});
// a weapon's opt-in behaviour kernel/combat.gd does not run (yet): the arena shooter's and the dogfight's guns
// (worlds/controllable/combat-ranged.js since the shooter spike). Named per level.
export const WEAPON_LOST = Object.freeze({
  spread: 'spread and bloom', recoil: 'recoil', falloff: 'damage falloff', headshot: 'headshots', hand: 'the gun\'s hand (its muzzle off the eye)',
  converge: 'the round to the crosshair', band: 'the gun for the range (bands)',
});
/** What a body's weapons (its own, its loadout's) and its rule ask for that the kernel's fight does not run. */
export function weaponLost(e) {
  const ws = [e && e.weapon, ...((e && e.rule && Array.isArray(e.rule.loadout) ? e.rule.loadout : []).map((c) => c && c.weapon))].filter(Boolean);
  const out = ws.flatMap((w) => Object.keys(w).filter((k) => w[k] != null && w[k] !== false && WEAPON_LOST[k]).map((k) => WEAPON_LOST[k]));
  if (e && e.rule && e.rule.missiles) out.push('homing missiles and flares');
  return [...new Set(out)].sort();
}

/** The opt-in moves an `ai` rule asks for that the kernel's mind does not run, by name (each once). */
export function aiLost(rule) {
  if (!rule || rule.type !== 'ai') return [];
  const out = Object.keys(rule).filter((k) => rule[k] != null && rule[k] !== false && AI_LOST[k]).map((k) => AI_LOST[k]);
  if (rule.mind && rule.mind.motivation === 'frag') out.push('the match player (frag)');
  if (Array.isArray(rule.loadout) && rule.loadout.some((c) => c && (Array.isArray(c.band) || c.held === false || c.plant))) out.push('the gun for the range (bands)');
  return [...new Set(out)].sort();
}

// a camera rule's keys the kernel does not run (opt-in): the follow camera's lock tracking (the lock is the web's)
export const CAMERA_LOST = Object.freeze({ lockTrack: 'the lock tracking' });

/** The opt-in moves a platform rule asks for that the kernel does not run, by name (each once). */
export function platformLost(rule) {
  if (!rule || rule.type !== 'platform') return [];
  return [...new Set(Object.keys(rule).filter((k) => rule[k] != null && rule[k] !== false && PLATFORM_KEYS.lost[k]).map((k) => PLATFORM_KEYS.lost[k]))].sort();
}

// ── the World page's inputs (scene-three.js emitThreeWorld: a resolved payload spreads into it) ─────────────────────
// `option` rows are how the page is drawn, not what the world is: they carry nothing to an engine.
const OPTION = optionRow('godot');
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
  fabric: m(A, 'the rock\'s fabric is drawn by the page\'s channel (channels/fabric.js) over the cliff faces; no engine leg draws it'),
  creases: m(A, 'the crease pass reads the page\'s depth in a screen-space shader (channels/creases.js); no engine leg draws it yet'),
  vertexContrast: m(P, 'the geocube\'s contrast shapes the faces before scene-gltf.js bakes them (contrastFaces), as the page shapes them; no Godot leg plays a geocube world yet, so it is not proven built'),
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
  spectate: m(A, 'no spectator camera'), ai: m(B, 'the world switch: off, every mind stands down until G (kernel/combat.gd)'), aiDifficulty: m(B, 'the class tier tunes every mind (kernel/mind.gd)'), commander: m(A, 'no commander: the page\'s (its builtin, hook and http ports); a commanded mind keeps its authored strategy'),
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
  hazeHeight: m(A, 'the haze does not thin with the camera\'s height (a city stalker\'s district): Godot keeps its density'),
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
  shallows: m(A, 'shallows are not drawn'), wetSand: m(A, 'wet sand is not drawn'), softGround: m(A, 'soft ground is not drawn'), snowPrints: m(A, 'snow prints are not drawn'),
  jets: m(A, 'jets are not drawn'), jetLight: m(A, 'jet light is not drawn'), sway: m(A, 'vegetation does not sway'),
  flicker: m(A, 'lights do not flicker'), motes: m(A, 'motes are not drawn'),
  fauna: m(A, 'the field fauna (gnats, fireflies, butterflies, birds overhead, ducks, a room\'s roaches and mice: scene/channels/fauna.js) are the page\'s own: none is drawn'),
  wetRoad: m(A, 'a wet road\'s film is not drawn: the road keeps its baked dark, no sky or lamp thrown back off it'),
  weather: m(P, 'fog, colour and light (kernel/weather.gd); falls, landings and lightning are the web\'s'),
  tone: m(B, 'kernel/tone.gdshader on each surface, the page\'s ramp, bands and detail (score.tone); the background and the fog off the default ramp'),
  liveGrass: m(A, 'live grass is not drawn'),
  resample: m(A, 'the page reads its painted detail tiles again at seeded shifts (scene/channels/resample.js) so they do not repeat at scale; a Godot surface tiles the detail as painted'),
  fabric: m(A, 'a gritty style\'s rock fabric (scene/channels/fabric.js) is the page\'s own near-surface shader: the rock keeps its baked faces'),
  versus: m(A, 'the side-on fighter (versus/versus-core.js, scene/channels/versus.js) is the page\'s own frame simulation: nothing in the kernel fights it'),
  board: m(A, 'the strategy board (board/*: tactics, a maze defence, a skirmish) is the page\'s own: nothing in the kernel plays it'),
  screen: m(P, 'project.godot\'s [display] holds the frame the game is made for (its viewport, stretch and handheld orientation) and an upright screen\'s cameras hold its width (kernel/level.gd); the touch pad and the safe-area zones are the page\'s'),
  runner: m(A, 'the endless run (its lanes, rows, hurdles and crash: worlds/controllable/runner.js) is the page\'s'),
  pixel: m(B, 'score.pixel: the 3D drawn at 1/scale and blown up without smoothing (the viewport\'s nearest scaling), the HUD crisp as the page\'s'),
  seats: m(A, 'the seats (a controller per player, their rings and strip: controls/seats-kernel.js) are the page\'s; the kernel seats one pilot, every other body on its AI'),
  science: m(A, 'a science world\'s readout, honesty panel and body labels (scene/channels/science.js) are the page\'s; no engine leg plays a science world'),
});

// ── a rigged figure's page overlays (scene/channels/controllable: what the page does to a figure beyond its clips) ──
// The skinned figure and its clips ride the GLB (PAGE_MARKS.figures); these are read off each figure in payload.figures
// (engines/marks.js figureOverlays).
export const FIGURE_MARKS = Object.freeze({
  forms: m(A, 'a body in two forms (transformation/) plays as its starting form, its rule and its clips: the other form and the transform beat (B) are the page\'s'),
  live: m(A, 'a vehicle\'s live overlay (the front wheels steering, the body leaning, squatting and diving off the drive) is the page\'s: the car holds its rest pose'),
  juice: m(A, 'a racer\'s juice (flames, smoke, sparks, dust, the landing ring, the lamps lit by its status) is the page\'s'),
  beams: m(A, 'the headlamps\' pool on the road (a dark race mood) is not drawn'),
  trails: m(A, 'the tail lamps\' ribbons (a race after dark) are not drawn'),
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
  fxLight: m(A, 'the light a world\'s beams, puffs and explosions throw on it (scene/effect-light.js) is the page\'s: the moments the kernel strikes light nothing'),
  rpg: m(A, 'the party\'s battles and its menu (play.rpg, playscape/rpg) are the page\'s: the kernel runs play.battle\'s one on one (power.combat turn-based)'),
  minigames: m(A, 'the games inside the game (playscape/ui/minigames.js: blocks, match, fishing in a pixel window) are the page\'s: minigame-won and minigame-lost never come back'),
  fxStyle: m(A, 'the style floor (scene/effect-style.js) raises the page\'s beams and explosions as it draws them: the moments travel as authored'),
  rim: m(A, 'the characters\' rim light from the effects round them (scene/effect-rim.js) is the page\'s: the kernel\'s characters wear none'),
  trail: m(A, 'a weapon\'s swing trail (scene/channels/trail-channel.js) is the page\'s: the kernel\'s swings leave none'),
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
  place: m(B, 'a pad wakes what stands asleep there through the cast, and the towers it wakes fire (kernel/mind.gd sentry)'),
});

// ── space.traversal (playscape/objects ENTRIES): by the runtime rule each lowers to (engines/marks.js TRAVERSAL_RULE) ──
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

// ── the mind (cosmos facet mind): kernel/mind.gd runs the web's mind (since 0.26.0), held equal by the mind corpus. What
// stays the web's is named here: the commander (a page's strategist), and the opportunist's counter on the pilot, which
// the page plays as a shove-down set piece where the kernel plays the plain counter (the swinger stuffed and flung)
export const MIND_WEB = Object.freeze({
  commander: { builtin: m(A, 'the commander is the page\'s: a commanded mind keeps its authored strategy'), agent: m(A, 'the commander is the page\'s (its hook and http ports)') },
  motivation: { frag: m(A, 'the match player (sight, leads, hearing, hunches, the strafe) is the web\'s: kernel/mind.gd hunts as `hunt` does') },
  aggressiveness: { opportunist: m(P, 'kernel/mind.gd: the counter-charge runs; when the pilot is in it the page plays a shove-down set piece, the kernel the plain counter') },
});
export const mindMark = (axis, value) => MIND_WEB[axis]?.[value] ?? m(B, 'kernel/mind.gd runs it as the web\'s mind does (the mind corpus)');

// ── the bus contract (bus-abi.js): which facts kernel/level.gd feeds the bus and which effects it draws ──────────────
// The bus itself is one reducer on every kernel (kernel/bus.gd, held equal by the bus corpus), so a row lacking here is
// never the logic: it is a fact nothing feeds in, or an effect nothing draws. Change a row in the step that builds its
// adapter. Approximated is the bus's `partial` (bus-abi.js busCoverage buckets it so).
export const BUS_MARKS = Object.freeze({
  facts: Object.freeze({
    zone: m(B, 'kernel/bus.gd derive_zone_events over the walker, in recipe units'),
    use: m(B, 'E inside a usable zone; the prompt shows the place\'s word'),
    start: m(B),
    timer: m(B),
    contact: m(A, 'Godot runs its own physics; no body reports to the bus yet'),
    input: m(B, 'level.gd: a key by the character it types (as the page\'s KeyboardEvent.key), a click anywhere'),
    aim: m(P, 'kernel/level.gd aim_input: the ray meets the bus\'s markers and the level\'s box colliders (since 0.22.0); the page\'s also meets the GLB\'s meshes, so a shot through a mesh with no collider hits on Godot'),
    cast: m(B, 'kernel/cast.gd castFacts'),
    hit: m(B, 'kernel/combat.gd deals the hero\'s hits (its blade, its rounds, their splash; a fall\'s blast hits nobody) and kernel/cast.gd tells the bus'),
    struck: m(B, 'kernel/cast.gd: a beam is a moment that lands after its distance (the web\'s land rule), and its target hears struck'),
    stats: m(B, 'kernel/stats.gd, conformance-tested equal to the web\'s stats kernel'),
    menu: m(B, 'level.gd: arrows or W / S, Enter / Space / E, Esc'),
    seen: m(B, 'kernel/mind.gd counts sightings (perceive) and kernel/cast.gd facts says them (since 0.26.0)'),
    beat: m(B, 'kernel/level.gd _beat_tick from the music player\'s position and score.beat, the page\'s clock as one function (beats/beat-clock.js); equal on the bus at the harness\'s fixed step'),
  }),
  effects: Object.freeze({
    logic: m(B, 'the reducer itself, conformance-tested equal'),
    guarded: m(B, 'kernel/bus.gd _reaction_match reads if as buildBus reactionMatch does, conformance-tested equal (since 0.19.0)'),
    warp: m(B),
    impulse: m(P, 'the bus entity moves; no Godot body is linked to it'),
    hud: m(B, 'kernel/hud.gd: the slots, text / counter / bar / clock, banners, stacking toasts, legends, in the guide\'s tokens, font, frame and plate (score.hudStyle); the register\'s motion, sound, cursor and light and a stylized border stay the web\'s'),
    menus: m(B, 'level.gd: the open one centred on the guide\'s panel, its {var} words filled, a row per choice; keys, a gamepad (d-pad or stick, A, B) and the pointer'),
    parts: m(B, 'kernel/hud.gd gates a row by its part id and draws its state (disabled, alert, focus, active)'),
    phase: m(B, 'kernel/hud.gd reads the phase var against a row\'s when'),
    weather: m(B, 'kernel/weather.gd force(): the newest force eased in over its blend, held, eased back (fog, colour, light; falls and lightning stay web)'),
    cast: m(P, 'kernel/cast.gd: spawn, vanish, kill, hurt, heal, walk, stop, status, lift, transfigure, shake, puff and explosion, beam (level.gd draws them simpler than the page); a walk stands on the level\'s land and is pushed out of its boxes as the web\'s; transits stay on the web'),
    rearm: m(B, 'kernel/cast.gd rearm into the weapon\'s reserve, which kernel/combat.gd\'s reload draws from (since 0.22.0), held equal by the combat corpus'),
    stats: m(B, 'kernel/stats.gd inside the bus\'s watch fixpoint; bound bodies onto the cast and the walker\'s pace'),
    entities: m(B, 'kernel/level.gd _sync_markers draws each as the page does (an unlit sphere, its radius and colour, where the bus puts it, shown while on; since 0.22.0)'),
    shot: m(B, 'kernel/level.gd sets kernel/rules.gd\'s shot rule aside the page\'s camera rule (unshot hands it back) and kernel/cast.gd finishes the walks, as worlds/controllable cast.js does (since 0.23.0)'),
  }),
});

// ── what a lowered mechanic hands the SHELL beside its world (the bus carries the world; engine-portability.js finds a
// mechanic's mark by lowering it and reading these with the bus rows it uses) ───────────────────────────────────────
export const MECHANIC_EXTRAS = Object.freeze({
  doors: m(B, 'a door between levels: kernel/game.gd applies the transit and enters the linked level by its own door (godot-game-shell.test.js)'),
  keep: m(B, 'the kept numbers ride the envelope and kernel/game.gd keeps their bests in user://bests.json'),
  aftermath: m(A, 'what broke is the web\'s: nothing breaks in Godot (breakables_held)'),
  bag: m(P, 'the store carries the inventory between levels; the web shell\'s fill of the level\'s bag from it at start is not ported'),
  party: m(A, 'the store carries the party slice between levels; the battle party that loads and writes it (play.rpg, playscape/rpg) is the web\'s'),
});

// ── the ledger rows an export writes (engine-score.js), each with what it costs a Godot export ──────────────────────
// The rows that only say what travels are engines/marks.js LEDGER_INFO; the rest flag. `core` marks what a game turns
// on (the verdict reads it). An unknown ledger key fails the ratchet: a row nobody reads is a silent drop by another name.
const ledger = (godot, flag) => Object.freeze({ godot, flag });
export const LEDGER_MARKS = Object.freeze({
  bodies_solid: ledger(P, 'solid bodies (body.collide) push the walkers out of them on the web; in Godot the pilot passes through them'),
  skipped_movers: ledger(A, 'mover/platform integrator channels do not travel'),
  skipped_physics: ledger(A, 'live physics channels do not travel'),
  skipped_fx: ledger(A, 'camera-facing fx (billboards, glows) are not drawn'),
  skipped_sprite_sfx: ledger(A, 'sprite sfx are not drawn'),
  sky_approximated: ledger(A, 'the backdrop image the page loads by URL is not carried'),
  weather_partial: ledger(P, 'the weather plays its fog, colour and light; rain, snow, dust, petals and lightning stay the web\'s'),
  tone_graded_on_page: ledger(B, 'the tone is graded in Godot as on the page (kernel/tone.gdshader)'),
  breakables_held: ledger(P, 'what breaks on the web is held whole'),
  crystal_light_performed: ledger(P, 'the crystal light plays, its stones at rest (movers do not travel)'),
  looks_carried: ledger(P, 'the cast\'s looks ride as data: nothing wears one until a script calls looks.wear'),
});

// the shell keys a game manifest may carry, and what each costs (kernel/game.gd: a level list, gates, the store, the
// save); an unknown game key is named, never dropped. engines/marks.js SHELL_INFO says what carries nothing to judge.
export const SHELL_MARKS = Object.freeze({
  menu: ledger(P, 'the menu\'s entries are played as a level list'),
  theme: ledger(P, 'the theme skins the HUD only'),
  setup: ledger(A, 'the pre-level setup screen does not travel'),
  difficulty: ledger(A, 'the difficulty pick does not travel'),
  front: ledger(A, 'the title and credits do not travel'),
  run: ledger(B, 'a run draws its order with the web shell\'s roll and keeps the deepest (kernel/game.gd)'),
  links: ledger(B, 'door links travel: a door applies what the session gathered and enters the linked level (kernel/game.gd)'),
  shell: ledger(P, 'the light play shell is played as the kernel\'s level list'),
});

// ── what the score's ledger says beside the reading's rows (engine-score.js), for a Godot export ────────────────────
export const READING_NOTES = Object.freeze({
  rules_carried: 'the motion and camera rules the level\'s entities run, by type (pilot: the player\'s; camera: the camera\'s; lost: the opt-in moves of the pilot\'s platform rule the kernel does not run); kernel/rules.gd runs the pilot\'s walk or platform rule, kernel/walker.gd follow and eye (godot-marks.js RULE_MARKS)',
  channels_carried: 'the page channels the world fills that a Godot export does not carry whole (godot-marks.js PAGE_MARKS says what each loses)',
  figures_carried: 'the page overlays the world\'s rigged figures carry that a Godot export does not run: the figure and its clips ride the GLB (godot-marks.js FIGURE_MARKS says what each loses)',
  events_carried: 'the events keys bus.json and score.json drop or carry in part (godot-marks.js EVENT_MARKS)',
  bus_carried: 'the world\'s behaviour (cues, chapters, menu picks, mechanics) rides bus.json; an engine kernel runs it with its port of the bus (Godot: kernel/bus.gd, conformance-tested equal to the web). `godot` lists the facts it takes and the effects it gives: built is performed, partial in part, absent not (the logic still runs; nothing feeds or draws that row)',
});
