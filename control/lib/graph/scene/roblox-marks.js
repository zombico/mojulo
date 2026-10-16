/**
 * THE ROBLOX MARKS — what a Roblox export runs, said once (engines/marks.js says the shape). The same tables over the
 * same keys as every engine with a runtime kernel; the ratchet (engines/marks.test.js) closes them against the sources.
 *
 * The Roblox kernel is young: everything is absent until a kernel part proves it. A row flips in the step that builds
 * its part, with the Lune conformance test that holds it equal to the web (the registry's `proof`), never before. The
 * Roblox authoring flow offers only what is marked built or approximated here, so an absent row is a value the flow
 * does not offer, not a value it drops.
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */
import { markRow, optionRow, PAGE_OPTIONS } from './engines/marks.js';

const A = 'absent';
const m = markRow('roblox');
const YET = 'not in the Roblox kernel yet';
const absent = (keys, how = YET) => Object.freeze(Object.fromEntries(keys.map((k) => [k, m(A, how)])));

// ── the controllable runtime's rules (worlds/controllable/compose.js RULES) ──────────────────────────────────────────
export const RULE_MARKS = absent([
  'walk', 'follow', 'eye', 'platform', 'glide', 'overhead', 'side', 'fixed', 'shot', 'clock', 'mover', 'launcher',
  'drive', 'racer', 'fly', 'patrol', 'ai',
]);

// the platform rule's keys, where the kernel runs each: none until the platform rule is marked
export const PLATFORM_KEYS = Object.freeze({ ported: [], fight: [], lost: {} });
export const AI_LOST = Object.freeze({});
export const WEAPON_LOST = Object.freeze({});
export const CAMERA_LOST = Object.freeze({});
/** The opt-in moves a rule asks for that the kernel does not run, by name: none while the rules are absent. */
export const platformLost = () => [];
export const aiLost = () => [];
export const weaponLost = () => [];

// ── the World page's inputs (scene-three.js emitThreeWorld) ──────────────────────────────────────────────────────────
const OPTION = optionRow('roblox');
export const PAGE_MARKS = Object.freeze({
  ...Object.fromEntries(PAGE_OPTIONS.map((k) => [k, OPTION])),
  ...absent([
    'faces', 'cameras', 'bg', 'backdrop', 'sky', 'light', 'glow', 'textures', 'cutouts', 'soft', 'repeats', 'ao',
    'walk', 'picks', 'tracers', 'planets', 'movers', 'comets', 'fields', 'surfaces', 'heatSpheres', 'starSurfaces',
    'buildups', 'transports', 'deforms', 'raymarch', 'signs', 'physics', 'actions', 'entities', 'camera', 'pilot',
    'spectate', 'ai', 'aiDifficulty', 'commander', 'lock', 'match', 'hangar', 'colliders', 'breakables', 'breakPieces',
    'wreckExplodes', 'shadows', 'smoke', 'tutorial', 'figures', 'events', 'fog', 'haze', 'splats', 'audio', 'fx',
    'effects', 'spriteSfx', 'marks', 'driveSurface', 'shoot', 'game', 'walkers', 'cars', 'carMeshes', 'signals',
    'trafficLanes', 'trafficConstants', 'xr', 'toon', 'stream', 'strokeOverlay', 'terrain', 'crystalLight', 'fire',
    'doors', 'items', 'shallows', 'wetSand', 'softGround', 'jets', 'jetLight', 'sway', 'flicker', 'motes', 'wetRoad',
    'weather', 'tone', 'liveGrass', 'pixel',
  ]),
});

// ── a rigged figure's page overlays ──────────────────────────────────────────────────────────────────────────────────
export const FIGURE_MARKS = absent(['live', 'juice', 'beams', 'trails']);

// ── the events manifest's keys ───────────────────────────────────────────────────────────────────────────────────────
export const EVENT_MARKS = absent([
  'reactions', 'watches', 'sequences', 'timers', 'vars', 'sources', 'initial', 'entities', 'budget', 'depthCap',
  'cast', 'stats', 'inputs', 'hud', 'style', 'register', 'menus', 'looks', 'scenes', 'quests',
]);

// ── a figure's gaits, power.systems, space.traversal, space.links, the mind ─────────────────────────────────────────
export const gaitMark = () => m(A, YET);
export const SYSTEM_MARKS = absent(['resource', 'stamina', 'unlock', 'transform', 'equip', 'place']);
export const traversalMark = () => m(A, YET);
export const LINK_MARKS = absent(['open', 'door', 'stair', 'gap']);
export const mindMark = () => m(A, YET);

// ── the bus contract (bus-abi.js): no fact fed, no effect drawn, until the Roblox bus runs ───────────────────────────
export const BUS_MARKS = Object.freeze({
  facts: absent(['zone', 'use', 'start', 'timer', 'contact', 'input', 'aim', 'cast', 'hit', 'struck', 'stats', 'menu', 'seen', 'beat']),
  effects: absent(['logic', 'guarded', 'warp', 'impulse', 'hud', 'menus', 'parts', 'phase', 'weather', 'cast', 'rearm', 'stats', 'entities', 'shot']),
});

// ── what a lowered mechanic hands the shell, the ledger rows, the game shell ────────────────────────────────────────
export const MECHANIC_EXTRAS = absent(['doors', 'keep', 'aftermath', 'bag']);
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
  shell: ledger('the play shell does not travel'),
});

// ── what the score's ledger says beside the reading's rows (engine-score.js), for a Roblox export ───────────────────
export const READING_NOTES = Object.freeze({
  rules_carried: 'the motion and camera rules the level\'s entities run, by type (pilot: the player\'s; camera: the camera\'s); roblox-marks.js RULE_MARKS says which the Roblox kernel runs',
  channels_carried: 'the page channels the world fills that a Roblox export does not carry whole (roblox-marks.js PAGE_MARKS says what each loses)',
  figures_carried: 'the page overlays the world\'s rigged figures carry that a Roblox export does not run (roblox-marks.js FIGURE_MARKS)',
  events_carried: 'the events keys bus.json and score.json drop or carry in part (roblox-marks.js EVENT_MARKS)',
  bus_carried: 'the world\'s behaviour (cues, chapters, menu picks, mechanics) rides bus.json; the Roblox kernel runs it with its port of the bus. `roblox` lists the facts it takes and the effects it gives: built is performed, partial in part, absent not',
});
