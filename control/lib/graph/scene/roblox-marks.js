/**
 * THE ROBLOX MARKS — what a Roblox export runs, said once (engines/marks.js says the shape). The same tables over the
 * same keys as every engine with a runtime kernel; the ratchet (engines/marks.test.js) closes them against the sources.
 *
 * The Roblox kernel is young: a row is absent until a part of the place carries it. A row flips in the step that builds
 * its part, with the Lune conformance test that holds the kernel part equal to the web (the registry's `proof`), never
 * before; a built row names the kernel module or the place file that performs it (the ratchet checks the file is
 * there). The place a Roblox export writes (roblox-pack.js): the bus, its stats, the store and the game channel
 * (kernel/*.luau), a greybox from the level's faces and colliders with its look (the floors in their faces' colours and
 * materials, the rest voxelized: roblox-look.js), and a Roblox Humanoid walking the player; a level
 * whose bus.json carries a cast plays it whole in the kernel (kernel/level.luau over the cast, the fight, the minds,
 * the scenes and the journal, held equal by the levelcast corpus with the Humanoid's pose as its input), each body
 * drawn as a block figure (MojuloServer). The
 * Roblox authoring flow offers only what is marked built or approximated here, so an absent row is a value the flow
 * does not offer, not a value it drops.
 *
 * Pure data and small reads. No module with a builder in it is imported, so the cosmos facets can read it.
 */
import { markRow, optionRow, PAGE_OPTIONS, TRAVERSAL_RULE } from './engines/marks.js';

const A = 'absent', P = 'approximated', B = 'built';
const m = markRow('roblox');
const YET = 'not in the Roblox kernel yet';
// how the place carries the player: a Roblox Humanoid, its pace and jump set from the pilot's rule
const HUMANOID = 'a Roblox Humanoid walks the player (WalkSpeed from the rule\'s speed, JumpPower from its jumpSpeed, the world\'s gravity from its gravity; a walk rule does not jump); the web\'s walk feel is not ported';
const absent = (keys, how = YET) => Object.freeze(Object.fromEntries(keys.map((k) => [k, m(A, how)])));

// ── the controllable runtime's rules (worlds/controllable/compose.js RULES) ──────────────────────────────────────────
export const RULE_MARKS = Object.freeze({
  ...absent(['glide', 'overhead', 'side', 'fixed', 'shot', 'mover', 'launcher', 'drive', 'racer', 'fly', 'patrol']),
  ai: m(B, 'kernel/mind.luau: the web mind (every motivation, perception and memory, cover, pathing in kernel/nav.luau, groups in kernel/group.luau, the blade, the roll, the charge, the loadout, the tier, a boss\'s phases), firing and swinging through kernel/combat.luau, held equal by the mind and levelcast corpora; each body a block figure (MojuloServer); the commander and the pilot\'s shove-down set piece stay the web\'s'),
  walk: m(P, HUMANOID),
  platform: m(P, `${HUMANOID}; roblox-marks.js PLATFORM_KEYS says what of the rule it takes`),
  follow: m(P, 'Roblox\'s own Classic camera follows the character (the rule\'s distance, height and lead are not read); a follow pulled in to the eye is first person'),
  eye: m(P, 'the player\'s camera locked to first person (CameraMode.LockFirstPerson)'),
  clock: m(P, 'a figure-frames body\'s self-playing loop feeds nothing the bus reads; the body is the look\'s (model.glb), not the place\'s, and its frames do not play'),
});

// the platform rule's keys, where the place runs each: the Humanoid takes its pace, jump and pull; the strike is the
// fight's (kernel/combat.luau, the left mouse button its fire); the rest of the web's feel and its moves are not run
const FEEL = 'the web\'s walk feel (the Humanoid\'s own)';
const PLATFORM_FEEL = ['accel', 'decel', 'turn', 'strafe', 'boostSpeed', 'fallGravity', 'maxFall', 'snap', 'step', 'coyote', 'buffer', 'jumpCut', 'airControl', 'boostMax',
  'jumpBoostCost', 'turnMode', 'lookSens', 'move', 'lane', 'moveYaw', 'faceRate', 'jumpWindup', 'collideRadius', 'collideHeight', 'stride', 'turnStepMin',
  'turnStride', 'boostTurnCost', 'overheatRegen', 'boostRegen', 'boostUnlockFrac', 'glideFall'];
const PLATFORM_MOVES = {
  space: 'space mode (6DoF drift)', liftAccel: 'space mode', spaceAccel: 'space mode', spaceBoostAccel: 'space mode', spaceBoostMax: 'space mode', spaceDamping: 'space mode', spaceMaxSpeed: 'space mode',
  boostHover: 'the boost hover', hoverRise: 'the boost hover', hoverCoyote: 'the boost hover', boostInertia: 'the boost\'s slide', boostInertiaSpeed: 'the boost\'s slide',
  chargeMax: 'the charged jump', chargeMult: 'the charged jump', chargeDash: 'the charged jump', kneel: 'the kneel', airJumps: 'the air jumps', airJumpMult: 'the air jumps',
  dodge: 'the dodge', dodgeBoostCost: 'the dodge', dodgeDur: 'the dodge', dodgeOverheat: 'the dodge', dodgeSpeed: 'the dodge', dodgeTurns: 'the dodge', doubleTapWindow: 'the dodge',
  tackle: 'the tackle', tackleDur: 'the tackle', tackleSpeed: 'the tackle', tackleCone: 'the tackle', tackleDamage: 'the tackle', tackleReach: 'the tackle',
  loadout: 'a loadout\'s other slots', switchReady: 'a loadout\'s other slots', cleaveStep: 'the great cleave\'s step', clashRetreat: 'the clash',
  wall: 'the wall (wall.js: any face held, crawled, mantled, jumped off)', metre: 'the wall and the gear', gear: 'the gear (swing.js: the swinger\'s line, its swing and zip)',
  hitstop: 'the melee hitstop (both bodies frozen on a connect)',
};
export const PLATFORM_KEYS = Object.freeze({
  ported: ['type', 'speed', 'eye', 'jumpSpeed', 'gravity'],
  fight: ['strike', 'strikeCone', 'strikeContact', 'strikeCooldown', 'strikeDamage', 'strikeDur', 'strikeFx', 'strikeImpact', 'strikeLaunch', 'strikeReach', 'combo', 'comboCooldown', 'comboWindow'],
  lost: Object.freeze({ ...Object.fromEntries(PLATFORM_FEEL.map((k) => [k, FEEL])), ...PLATFORM_MOVES }),
});
// the `ai` rule's opt-in moves kernel/mind.luau does not run (it is mind.gd's port, so it leaves what that leaves):
// the match player and the arena shooter's moves. Named per level, as the platform rule's are.
export const AI_LOST = Object.freeze({
  floors: 'floors and their stairs', peek: 'peeking round an edge', items: 'items and their timing', keepRange: 'keeping a long gun\'s range',
  perches: 'perches', objective: 'an objective to hold', clearLine: 'holding fire past a teammate', clearance: 'a flier\'s ground clearance',
  hearRange: 'the match player (frag)', leadSpan: 'the match player (frag)', hunchEvery: 'the match player (frag)', fragGrudge: 'the match player (frag)',
});
// a weapon's opt-in behaviour kernel/combat.luau does not run: the arena shooter's and the dogfight's guns
export const WEAPON_LOST = Object.freeze({
  spread: 'spread and bloom', recoil: 'recoil', falloff: 'damage falloff', headshot: 'headshots', hand: 'the gun\'s hand (its muzzle off the eye)',
  converge: 'the round to the crosshair', band: 'the gun for the range (bands)',
});
export const CAMERA_LOST = Object.freeze({});
/** The opt-in moves a platform rule asks for that the place does not run, by name (its feel is the Humanoid's, said
 * once by the rule's mark, so a plain platform rule loses no named move). */
export function platformLost(rule) {
  if (!rule || rule.type !== 'platform') return [];
  return [...new Set(Object.keys(rule).filter((k) => rule[k] != null && rule[k] !== false && PLATFORM_MOVES[k]).map((k) => PLATFORM_MOVES[k]))].sort();
}
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

// ── the World page's inputs (scene-three.js emitThreeWorld) ──────────────────────────────────────────────────────────
const OPTION = optionRow('roblox');
export const PAGE_MARKS = Object.freeze({
  ...Object.fromEntries(PAGE_OPTIONS.map((k) => [k, OPTION])),
  faces: m(P, 'the greybox and its look (roblox-project.js, roblox-look.js): every upward face as floor slabs on a grid, each in its faces\' colour and a Roblox material named by its texture, else by what the material shelf stamped (a metal Metal, glass Glass); the rest of the level voxelized into decoration boxes of their faces\' colours (no body or ray meets them); smooth shapes come out in voxels, a backdrop and ground cover drawn as cards are left to the sky and the slabs; the mesh rides beside the project as model.glb for Studio\'s 3D Importer'),
  colliders: m(B, 'each box collider an anchored Part, unseen as on the page (roblox-project.js greyboxModel)'),
  form: m(A, 'the form render\'s land and rooms (gen-7) are not carried yet: the greybox reads the painted faces'),
  repeats: m(P, 'each instance placed as the page places it and voxelized into the look\'s decoration boxes (roblox-look.js), not instanced'),
  textures: m(P, 'a texture travels as its mean colour (alpha-weighted, times the face\'s tint) and a material its name picks (roblox-look.js); the image itself does not'),
  figures: m(P, 'a rigged figure stands as a block figure of its body\'s size (MojuloServer): its mesh, clips, face and ink are not carried'),
  walk: m(P, 'the player stands at the seat, its feet on the greybox; the walk\'s eye is added back for the zones'),
  pilot: m(P, HUMANOID),
  camera: m(P, 'Roblox\'s Classic camera, or first person for an eye camera or a follow pulled in to the eye'),
  entities: m(P, 'the pilot walks; a level\'s cast moves as the kernel puts it (kernel/cast.luau, the minds), each body a block figure (MojuloServer: a mind in a foe\'s red, the rest in blue), downed laid flat, sent away hidden; a level with no cast: its bodies stand where the recipe put them for the zones'),
  events: m(B, 'kernel/bus.luau, held equal to the web by the bus and level corpora (Lune)'),
  game: m(B, 'kernel/game.luau, the page\'s game channel, held equal by the level corpus; MojuloServer applies the outcome to the store'),
  ai: m(B, 'the world switch: off, every mind stands down until G (kernel/combat.luau; MojuloServer hands it the press)'),
  aiDifficulty: m(B, 'the class tier tunes every mind (kernel/mind.luau)'),
  ...absent([
    'cameras', 'bg', 'backdrop', 'sky', 'light', 'glow', 'cutouts', 'soft', 'ao',
    'picks', 'tracers', 'planets', 'movers', 'comets', 'fields', 'surfaces', 'heatSpheres', 'starSurfaces',
    'buildups', 'transports', 'deforms', 'raymarch', 'signs', 'physics', 'actions',
    'spectate', 'commander', 'lock', 'match', 'hangar', 'breakables', 'breakPieces',
    'wreckExplodes', 'shadows', 'smoke', 'tutorial', 'fog', 'haze', 'hazeHeight', 'splats', 'audio', 'fx',
    'effects', 'spriteSfx', 'marks', 'driveSurface', 'shoot', 'walkers', 'cars', 'carMeshes', 'signals',
    'trafficLanes', 'trafficConstants', 'xr', 'toon', 'stream', 'strokeOverlay', 'terrain', 'crystalLight', 'fire',
    'doors', 'items', 'shallows', 'wetSand', 'softGround', 'snowPrints', 'jets', 'jetLight', 'sway', 'flicker', 'motes', 'fauna', 'wetRoad',
    'weather', 'tone', 'liveGrass', 'pixel', 'versus', 'vertexContrast', 'screen', 'runner', 'board', 'science', 'seats', 'creases', 'occlusion', 'lightTier', 'fabric', 'resample', 'meet', 'court', 'turns', 'pitch', 'holo', 'innings',
  ]),
});

// ── a rigged figure's page overlays ──────────────────────────────────────────────────────────────────────────────────
export const FIGURE_MARKS = absent(['live', 'juice', 'beams', 'trails', 'forms']);

// ── the events manifest's keys ───────────────────────────────────────────────────────────────────────────────────────
const BUS = 'kernel/bus.luau, held equal to the web by the bus and level corpora (Lune)';
export const EVENT_MARKS = Object.freeze({
  ...Object.fromEntries(['reactions', 'watches', 'sequences', 'timers', 'vars', 'sources', 'initial', 'entities', 'budget', 'depthCap'].map((k) => [k, m(B, BUS)])),
  stats: m(P, 'kernel/stats.luau inside the bus\'s watch fixpoint, held equal by the bus corpus; the bodies bound to them (hpMax, speed) do not move the Humanoid'),
  inputs: m(P, 'a key the player presses reaches the bus by the page\'s name for it (MojuloClient: letters, digits, Space, Enter, Escape, the arrows); a click, a pick and a shot do not'),
  hud: m(P, 'kernel/hud.luau writes the rows as words (MojuloClient draws them); the page\'s widgets, motion and gates are not drawn'),
  titles: m(P, 'a carved title is written as a banner\'s words (kernel/hud.luau); the 3D letters, their entrance and sparks are the web\'s'),
  cast: m(B, 'bus.json cast rows (kernel/cast.luau), held equal by the combat, mind and levelcast corpora; MojuloServer draws each body as a box'),
  scenes: m(P, 'bus.json scenes (kernel/scenes.luau, the page\'s runner ported): the beats, the line and the choices as words in a box (MojuloClient; Space, Enter or E goes on, Esc skips, the arrows and 1-4 choose); the bars and the shots are not drawn (the camera is Roblox\'s)'),
  quests: m(P, 'bus.json quests (kernel/quests.luau): a word as one begins, moves on, ends (MojuloServer); there is no journal to open'),
  ...absent(['style', 'register', 'menus', 'looks', 'fxLight', 'fxStyle', 'rim', 'trail', 'minigames', 'rpg']),
  vanish: m(A, 'a downed foe\'s disposal (its fade: gameworld/vanish.js, the page\'s transits) is the page\'s: a downed body stays down'),
  wreck: m(A, 'a destroyed foe\'s pieces (its dismantle or cleave, a mode\'s shed: scene/channels/wreck-channel.js) are the page\'s: a downed body stays down whole'),
  layer0: m(A, 'a layer-0 foe\'s looks laid on the body it wears now (docs/foes.md) are the page\'s: the kernel draws no status looks on a foe'),
  born: m(A, 'the statuses a foe is born under (foes/states.js), drawn in their looks, are the page\'s: the kernel\'s foe is born bare'),
  arrive: m(A, 'a summoner\'s summons arriving in their transit (worlds/controllable/summon.js) are the page\'s: the kernel calls no summons'),
});

// ── a figure's gaits, power.systems, space.traversal, space.links, the mind ─────────────────────────────────────────
// a gait: the Humanoid's own walk, jump and stop stand in for the web's; a pose, a stance, a seat, a roll or a vault no
export function gaitMark(name, row) {
  if (!row || typeof row !== 'object') return m(A, 'not a gait');
  if (row.base !== undefined) return name === 'walk' ? m(P, 'the Humanoid walks at the rule\'s pace; the figure\'s walk clip does not play') : m(A, 'the Humanoid has one pace: only the walk');
  if (row.from !== undefined) return m(P, 'the Humanoid stops; the stop clip does not play');
  if (row.vault !== undefined || row.family !== undefined || row.seconds === undefined) return m(A, 'no pose, stance, seat or vault: the cast stands as block figures');
  return ({ jump: 1, jumpForward: 1, jumpBack: 1, runningJump: 1 })[name] ? m(P, 'the Humanoid jumps (the rule\'s jumpSpeed); the clip does not play') : m(A, 'no air jump and no roll on the Humanoid');
}
export const SYSTEM_MARKS = Object.freeze({
  resource: m(P, 'a stat resource and its keys (kernel/stats.luau inside the bus); its HUD as words'),
  stamina: m(P, 'one stat pool spent by every action (kernel/stats.luau); the bodies bound to it do not move the Humanoid'),
  unlock: m(A, 'a power\'s move does not merge into the Humanoid\'s walk'),
  transform: m(A, 'a form\'s look does not travel (block figures)'),
  equip: m(P, 'powers from carried gear: their stats and cues run (kernel/stats.luau, kernel/bus.luau); the gear is not drawn'),
  place: m(P, 'a pad wakes what stands asleep there through the cast, and the towers it wakes fire (kernel/mind.luau sentry)'),
});
const TRAVERSAL_HOW = Object.freeze({
  door: m(A, 'a door is not a trigger in the place (the page\'s doors do not travel)'),
  bridge: m(P, 'a static deck: a floor slab the Humanoid walks'),
  platform: m(P, 'a static deck travels as a floor slab; a moving one is a mover and stands at rest'),
  stairs: m(P, 'treads as floor slabs the Humanoid climbs'),
});
export function traversalMark(entry) {
  if (TRAVERSAL_HOW[entry]) return TRAVERSAL_HOW[entry];
  const rule = TRAVERSAL_RULE[entry];
  if (rule === undefined || !RULE_MARKS[rule]) return m(A, 'not marked');
  return m(RULE_MARKS[rule].roblox, `lowers to the ${rule} rule: ${RULE_MARKS[rule].how}`);
}
export const LINK_MARKS = Object.freeze({
  open: m(P, 'an opening in the greybox and its look'),
  door: m(A, 'a doorway is not a trigger in the place'),
  stair: m(P, 'treads as floor slabs the Humanoid climbs'),
  gap: m(P, 'jumped by the Humanoid'),
});
// the mind: kernel/mind.luau runs the web's mind (mind.gd's port), held equal by the mind corpus. What stays the web's
// is named here, as Godot's marks name it
const MIND_WEB = Object.freeze({
  commander: { builtin: m(A, 'the commander is the page\'s: a commanded mind keeps its authored strategy'), agent: m(A, 'the commander is the page\'s (its hook and http ports)') },
  motivation: { frag: m(A, 'the match player (sight, leads, hearing, hunches, the strafe) is the web\'s: kernel/mind.luau hunts as `hunt` does') },
  aggressiveness: { opportunist: m(P, 'kernel/mind.luau: the counter-charge runs; when the pilot is in it the page plays a shove-down set piece, the kernel the plain counter') },
});
export const mindMark = (axis, value) => MIND_WEB[axis]?.[value] ?? m(B, 'kernel/mind.luau runs it as the web\'s mind does (the mind corpus)');

// ── the bus contract (bus-abi.js): which facts the place feeds the bus and which effects it draws ─────────────────────
export const BUS_MARKS = Object.freeze({
  facts: Object.freeze({
    zone: m(B, 'kernel/level.luau derives them from where the Humanoid stands (its feet, the rule\'s eye above), in recipe units'),
    start: m(B, 'kernel/level.luau processes the initial events and the session\'s carried chapters and arrival (kernel/game.luau start)'),
    timer: m(B, 'kernel/bus.luau at the web\'s fixed step (MojuloServer steps it at 30 Hz)'),
    input: m(P, 'a key, by the page\'s name for it (MojuloClient); a click does not reach the bus'),
    stats: m(B, 'kernel/stats.luau, held equal to the web\'s stats kernel by the bus corpus'),
    cast: m(B, 'kernel/cast.luau facts, read before the bus as the page reads them (kernel/level.luau)'),
    hit: m(B, 'kernel/combat.luau deals the hits (the hero\'s blade on the left mouse button, its rounds and their splash, the minds\' own) and kernel/cast.luau tells the bus, a round\'s with what it dealt'),
    struck: m(B, 'kernel/cast.luau: a beam is a moment that lands after its distance, and its target hears struck'),
    seen: m(B, 'kernel/mind.luau counts sightings and kernel/cast.luau facts says them'),
    ...absent(['use', 'contact', 'aim', 'menu', 'beat']),
  }),
  effects: Object.freeze({
    logic: m(B, 'the reducer itself (kernel/bus.luau), held equal'),
    guarded: m(B, 'kernel/bus.luau reads a reaction\'s if as the web does, held equal'),
    warp: m(B, 'kernel/level.luau hands the warp back; MojuloServer stands the character there'),
    stats: m(P, 'kernel/stats.luau runs them; the bodies bound to them (hpMax, speed) do not move the Humanoid'),
    hud: m(P, 'kernel/hud.luau as words (MojuloClient): each readout a line in its slot (a bar, a counter and a clock written out), each banner and toast a moment, each legend for its time; the page\'s look and a part\'s gate are not drawn'),
    entities: m(B, 'MojuloServer draws each as the page does (a sphere of its radius and colour where the bus puts it, shown while on)'),
    cast: m(P, 'kernel/cast.luau: spawn, vanish, kill, hurt, heal, walk, stop, status, lift, transfigure, shake, puff and explosion, beam, each body a block figure (MojuloServer): the moments (a puff, a blast, a beam, a shake) and a transfigure\'s look are not drawn; a walk stands on the place\'s land and is pushed out of the fight\'s boxes; transits stay on the web'),
    rearm: m(B, 'kernel/cast.luau rearm into the weapon\'s reserve, which kernel/combat.luau\'s reload draws from, held equal by the combat corpus'),
    ...absent(['impulse', 'menus', 'parts', 'phase', 'weather', 'shot']),
  }),
});

// ── what a lowered mechanic hands the shell, the ledger rows, the game shell ────────────────────────────────────────
export const MECHANIC_EXTRAS = Object.freeze({
  keep: m(P, 'the kept numbers ride the envelope (kernel/game.luau) and are said on screen; no best is kept between sessions'),
  ...absent(['doors', 'aftermath', 'bag', 'party']),
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
