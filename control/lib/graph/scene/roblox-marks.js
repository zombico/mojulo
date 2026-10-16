/**
 * THE ROBLOX MARKS — what a Roblox export runs, said once (engines/marks.js says the shape). The same tables over the
 * same keys as every engine with a runtime kernel; the ratchet (engines/marks.test.js) closes them against the sources.
 *
 * The Roblox kernel is young: a row is absent until a part of the place carries it. A row flips in the step that builds
 * its part, with the Lune conformance test that holds the kernel part equal to the web (the registry's `proof`), never
 * before; a built row names the kernel module or the place file that performs it (the ratchet checks the file is
 * there). The place a Roblox export writes (roblox-pack.js): the bus, its stats, the store and the game channel
 * (kernel/*.luau), a greybox from the level's faces and colliders, and a Roblox Humanoid walking the player. The
 * Roblox authoring flow offers only what is marked built or approximated here, so an absent row is a value the flow
 * does not offer, not a value it drops.
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */
import { markRow, optionRow, PAGE_OPTIONS } from './engines/marks.js';

const A = 'absent', P = 'approximated', B = 'built';
const m = markRow('roblox');
const YET = 'not in the Roblox kernel yet';
// how the place carries the player: a Roblox Humanoid, its pace and jump set from the pilot's rule
const HUMANOID = 'a Roblox Humanoid walks the player (WalkSpeed from the rule\'s speed, JumpPower from its jumpSpeed, the world\'s gravity from its gravity; a walk rule does not jump); the web\'s walk feel is not ported';
const absent = (keys, how = YET) => Object.freeze(Object.fromEntries(keys.map((k) => [k, m(A, how)])));

// ── the controllable runtime's rules (worlds/controllable/compose.js RULES) ──────────────────────────────────────────
export const RULE_MARKS = Object.freeze({
  ...absent(['glide', 'overhead', 'side', 'fixed', 'shot', 'mover', 'launcher', 'drive', 'racer', 'fly', 'patrol', 'ai']),
  walk: m(P, HUMANOID),
  platform: m(P, `${HUMANOID}; roblox-marks.js PLATFORM_KEYS says what of the rule it takes`),
  follow: m(P, 'Roblox\'s own Classic camera follows the character (the rule\'s distance, height and lead are not read); a follow pulled in to the eye is first person'),
  eye: m(P, 'the player\'s camera locked to first person (CameraMode.LockFirstPerson)'),
  clock: m(P, 'a figure-frames body\'s self-playing loop feeds nothing the bus reads; the body is the look\'s (model.glb), not the place\'s, and its frames do not play'),
});

// the platform rule's keys, where the place runs each: the Humanoid takes its pace, jump and pull; the rest of the
// web's feel and its moves are not run
const FEEL = 'the web\'s walk feel (the Humanoid\'s own)';
const PLATFORM_FEEL = ['turn', 'strafe', 'boostSpeed', 'fallGravity', 'maxFall', 'snap', 'step', 'coyote', 'buffer', 'jumpCut', 'airControl', 'boostMax',
  'jumpBoostCost', 'turnMode', 'lookSens', 'move', 'lane', 'moveYaw', 'faceRate', 'jumpWindup', 'collideRadius', 'collideHeight', 'stride', 'turnStepMin',
  'turnStride', 'boostTurnCost', 'overheatRegen', 'boostRegen', 'boostUnlockFrac', 'glideFall'];
const PLATFORM_MOVES = {
  space: 'space mode (6DoF drift)', liftAccel: 'space mode', spaceAccel: 'space mode', spaceBoostAccel: 'space mode', spaceBoostMax: 'space mode', spaceDamping: 'space mode', spaceMaxSpeed: 'space mode',
  boostHover: 'the boost hover', hoverRise: 'the boost hover', hoverCoyote: 'the boost hover', boostInertia: 'the boost\'s slide', boostInertiaSpeed: 'the boost\'s slide',
  chargeMax: 'the charged jump', chargeMult: 'the charged jump', chargeDash: 'the charged jump', kneel: 'the kneel', airJumps: 'the air jumps', airJumpMult: 'the air jumps',
  dodge: 'the dodge', dodgeBoostCost: 'the dodge', dodgeDur: 'the dodge', dodgeOverheat: 'the dodge', dodgeSpeed: 'the dodge', dodgeTurns: 'the dodge', doubleTapWindow: 'the dodge',
  tackle: 'the tackle', tackleDur: 'the tackle', tackleSpeed: 'the tackle', tackleCone: 'the tackle', tackleDamage: 'the tackle', tackleReach: 'the tackle',
  loadout: 'a loadout\'s other slots', switchReady: 'a loadout\'s other slots', cleaveStep: 'the great cleave\'s step', clashRetreat: 'the clash',
  strike: 'the strike', strikeCone: 'the strike', strikeContact: 'the strike', strikeCooldown: 'the strike', strikeDamage: 'the strike', strikeDur: 'the strike', strikeFx: 'the strike',
  strikeImpact: 'the strike', strikeLaunch: 'the strike', strikeReach: 'the strike', combo: 'the strike', comboCooldown: 'the strike', comboWindow: 'the strike',
};
export const PLATFORM_KEYS = Object.freeze({
  ported: ['type', 'speed', 'eye', 'jumpSpeed', 'gravity'],
  fight: [],
  lost: Object.freeze({ ...Object.fromEntries(PLATFORM_FEEL.map((k) => [k, FEEL])), ...PLATFORM_MOVES }),
});
export const AI_LOST = Object.freeze({});
export const WEAPON_LOST = Object.freeze({});
export const CAMERA_LOST = Object.freeze({});
/** The opt-in moves a platform rule asks for that the place does not run, by name (its feel is the Humanoid's, said
 * once by the rule's mark, so a plain platform rule loses no named move). */
export function platformLost(rule) {
  if (!rule || rule.type !== 'platform') return [];
  return [...new Set(Object.keys(rule).filter((k) => rule[k] != null && rule[k] !== false && PLATFORM_MOVES[k]).map((k) => PLATFORM_MOVES[k]))].sort();
}
export const aiLost = () => [];
export const weaponLost = () => [];

// ── the World page's inputs (scene-three.js emitThreeWorld) ──────────────────────────────────────────────────────────
const OPTION = optionRow('roblox');
export const PAGE_MARKS = Object.freeze({
  ...Object.fromEntries(PAGE_OPTIONS.map((k) => [k, OPTION])),
  faces: m(P, 'the greybox (roblox-project.js): every upward face as floor slabs on a grid, in grey; the look rides beside the project as model.glb for Studio\'s 3D Importer, the place carries no mesh'),
  colliders: m(B, 'each box collider an anchored Part (roblox-project.js greyboxModel)'),
  walk: m(P, 'the player stands at the seat, its feet on the greybox; the walk\'s eye is added back for the zones'),
  pilot: m(P, HUMANOID),
  camera: m(P, 'Roblox\'s Classic camera, or first person for an eye camera or a follow pulled in to the eye'),
  entities: m(P, 'the pilot walks; the other bodies stand where the recipe put them for the zones, their rules not run'),
  events: m(B, 'kernel/bus.luau, held equal to the web by the bus and level corpora (Lune)'),
  game: m(B, 'kernel/game.luau, the page\'s game channel, held equal by the level corpus; MojuloServer applies the outcome to the store'),
  ...absent([
    'cameras', 'bg', 'backdrop', 'sky', 'light', 'glow', 'textures', 'cutouts', 'soft', 'repeats', 'ao',
    'picks', 'tracers', 'planets', 'movers', 'comets', 'fields', 'surfaces', 'heatSpheres', 'starSurfaces',
    'buildups', 'transports', 'deforms', 'raymarch', 'signs', 'physics', 'actions',
    'spectate', 'ai', 'aiDifficulty', 'commander', 'lock', 'match', 'hangar', 'breakables', 'breakPieces',
    'wreckExplodes', 'shadows', 'smoke', 'tutorial', 'figures', 'fog', 'haze', 'splats', 'audio', 'fx',
    'effects', 'spriteSfx', 'marks', 'driveSurface', 'shoot', 'walkers', 'cars', 'carMeshes', 'signals',
    'trafficLanes', 'trafficConstants', 'xr', 'toon', 'stream', 'strokeOverlay', 'terrain', 'crystalLight', 'fire',
    'doors', 'items', 'shallows', 'wetSand', 'softGround', 'jets', 'jetLight', 'sway', 'flicker', 'motes', 'wetRoad',
    'weather', 'tone', 'liveGrass', 'pixel',
  ]),
});

// ── a rigged figure's page overlays ──────────────────────────────────────────────────────────────────────────────────
export const FIGURE_MARKS = absent(['live', 'juice', 'beams', 'trails']);

// ── the events manifest's keys ───────────────────────────────────────────────────────────────────────────────────────
const BUS = 'kernel/bus.luau, held equal to the web by the bus and level corpora (Lune)';
export const EVENT_MARKS = Object.freeze({
  ...Object.fromEntries(['reactions', 'watches', 'sequences', 'timers', 'vars', 'sources', 'initial', 'entities', 'budget', 'depthCap'].map((k) => [k, m(B, BUS)])),
  stats: m(P, 'kernel/stats.luau inside the bus\'s watch fixpoint, held equal by the bus corpus; the bodies bound to them (hpMax, speed) do not move the Humanoid'),
  inputs: m(P, 'a key the player presses reaches the bus by the page\'s name for it (MojuloClient: letters, digits, Space, Enter, Escape, the arrows); a click, a pick and a shot do not'),
  hud: m(P, 'kernel/hud.luau writes the rows as words (MojuloClient draws them); the page\'s widgets, motion and gates are not drawn'),
  ...absent(['cast', 'style', 'register', 'menus', 'looks', 'scenes', 'quests']),
});

// ── a figure's gaits, power.systems, space.traversal, space.links, the mind ─────────────────────────────────────────
export const gaitMark = () => m(A, YET);
export const SYSTEM_MARKS = absent(['resource', 'stamina', 'unlock', 'transform', 'equip', 'place']);
export const traversalMark = () => m(A, YET);
export const LINK_MARKS = absent(['open', 'door', 'stair', 'gap']);
export const mindMark = () => m(A, YET);

// ── the bus contract (bus-abi.js): no fact fed, no effect drawn, until the Roblox bus runs ───────────────────────────
export const BUS_MARKS = Object.freeze({
  facts: Object.freeze({
    zone: m(B, 'kernel/level.luau derives them from where the Humanoid stands (its feet, the rule\'s eye above), in recipe units'),
    start: m(B, 'kernel/level.luau processes the initial events and the session\'s carried chapters and arrival (kernel/game.luau start)'),
    timer: m(B, 'kernel/bus.luau at the web\'s fixed step (MojuloServer steps it at 30 Hz)'),
    input: m(P, 'a key, by the page\'s name for it (MojuloClient); a click does not reach the bus'),
    stats: m(B, 'kernel/stats.luau, held equal to the web\'s stats kernel by the bus corpus'),
    ...absent(['use', 'contact', 'aim', 'cast', 'hit', 'struck', 'menu', 'seen', 'beat']),
  }),
  effects: Object.freeze({
    logic: m(B, 'the reducer itself (kernel/bus.luau), held equal'),
    guarded: m(B, 'kernel/bus.luau reads a reaction\'s if as the web does, held equal'),
    warp: m(B, 'kernel/level.luau hands the warp back; MojuloServer stands the character there'),
    stats: m(P, 'kernel/stats.luau runs them; the bodies bound to them (hpMax, speed) do not move the Humanoid'),
    hud: m(P, 'kernel/hud.luau as words (MojuloClient): each readout a line in its slot (a bar, a counter and a clock written out), each banner and toast a moment, each legend for its time; the page\'s look and a part\'s gate are not drawn'),
    entities: m(B, 'MojuloServer draws each as the page does (a sphere of its radius and colour where the bus puts it, shown while on)'),
    ...absent(['impulse', 'menus', 'parts', 'phase', 'weather', 'cast', 'rearm', 'shot']),
  }),
});

// ── what a lowered mechanic hands the shell, the ledger rows, the game shell ────────────────────────────────────────
export const MECHANIC_EXTRAS = Object.freeze({
  keep: m(P, 'the kept numbers ride the envelope (kernel/game.luau) and are said on screen; no best is kept between sessions'),
  ...absent(['doors', 'aftermath', 'bag']),
});
const ledger = (flag) => Object.freeze({ roblox: A, flag });
export const LEDGER_MARKS = Object.freeze({
  bodies_solid: ledger('solid bodies (body.collide) do not push walkers in a Roblox export'),
  skipped_movers: ledger('mover/platform integrator channels do not travel'),
  skipped_physics: ledger('live physics channels do not travel'),
  skipped_fx: ledger('camera-facing fx (billboards, glows) are not drawn'),
  skipped_sprite_sfx: ledger('sprite sfx are not drawn'),
  sky_approximated: ledger('the backdrop image the page loads by URL is not carried'),
  weather_partial: ledger('the weather does not play in a Roblox export'),
  tone_graded_on_page: ledger('the tone is not graded in a Roblox export'),
  breakables_held: ledger('what breaks on the web is held whole'),
  crystal_light_performed: ledger('the crystal light does not play in a Roblox export'),
  looks_carried: ledger('the cast\'s looks do not travel'),
});
export const SHELL_MARKS = Object.freeze({
  menu: ledger('the menu does not travel'),
  theme: ledger('the theme does not travel'),
  setup: ledger('the pre-level setup screen does not travel'),
  difficulty: ledger('the difficulty pick does not travel'),
  front: ledger('the title and credits do not travel'),
  run: ledger('a run does not travel'),
  links: ledger('door links between levels do not travel'),
  shell: Object.freeze({ roblox: P, flag: 'the levels play in order (a gate read against the store), a failed one again; the store lives for the session, not between them' }),
});

// ── what the score's ledger says beside the reading's rows (engine-score.js), for a Roblox export ───────────────────
export const READING_NOTES = Object.freeze({
  rules_carried: 'the motion and camera rules the level\'s entities run, by type (pilot: the player\'s; camera: the camera\'s; lost: the opt-in moves of the pilot\'s platform rule the place does not run); roblox-marks.js RULE_MARKS says how the place carries each (a Roblox Humanoid walks the player)',
  channels_carried: 'the page channels the world fills that a Roblox export does not carry whole (roblox-marks.js PAGE_MARKS says what each loses)',
  figures_carried: 'the page overlays the world\'s rigged figures carry that a Roblox export does not run (roblox-marks.js FIGURE_MARKS)',
  events_carried: 'the events keys bus.json and score.json drop or carry in part (roblox-marks.js EVENT_MARKS)',
  bus_carried: 'the world\'s behaviour (cues, chapters, menu picks, mechanics) rides bus.json; the Roblox kernel runs it with its port of the bus (kernel/bus.luau, conformance-tested equal to the web under Lune). `roblox` lists the facts it takes and the effects it gives: built is performed, partial in part, absent not (the logic still runs; nothing feeds or draws that row)',
});
