/**
 * engine-score.js — the shared score extraction for engine handoffs
 * (godot-handoff.plan.md "Cross-engine alignment"; consumed by the Godot
 * emitter now, export-unreal U0 next).
 *
 * The score is the engine-agnostic digest of a resolved world payload:
 * colliders, spawn, cameras, entities, declarative mechanics, audio binding,
 * plus the honest-loss ledger. Everything stays in mojulo's z-up frame with
 * raw world units (1 unit = 1 meter, the pinned constant) — each engine
 * emitter owns its own frame/unit conversion, exactly like facesToGlb owns
 * the y-up root. NOT an engine adapter: no engine names in here.
 */
import { aquaWaterBodies, aquaScoreEntry } from '../materials/aqua-export.js';
import { levelCameras, levelEntityNodes, levelSceneExtras, levelAddress, shootCameraDefs } from './scene-gltf-level.js';
import { assessWorldTier, contractLedgerEntry } from '@/lib/graph/worlds/world-contract';
import { normalizeHud, styleTokens, STYLE_TOKENS, FONT_IDS } from '@/lib/graph/game/hud-widgets';
import { cleanDials } from '@/lib/graph/playscape/ui/register';
import { shineOptics } from '@/lib/graph/polygonizer/crystal-shine.js';
import { crystalRigFor, rigForScore } from './crystal-rig.js';
import { statusElements, transitKinds } from './channels/status-channel.js';
import { lookRGB } from '../playscape/elements/elements.js';
import { weatherScore } from './weather-score.js';
import { busCoverage } from './bus-abi.js';
import { extractCombat } from './combat-score.js';
import { levelSound } from './engine-sound.js';
import { PAGE_MARKS, EVENT_MARKS, RULE_MARKS, CAMERA_LOST, platformLost } from './godot-marks.js';

export const MOJULO_UNITS = '1 mojulo unit = 1 meter';

/**
 * The recipe's identity for provenance hashes: the stored manifest minus any derived
 * block. The floorplan mint used to stamp a `quality` grade into the manifest, and a
 * re-grade then changed the hash of a room whose geometry had not changed (the lounge
 * carried two hashes across three packs, 2026-09-08). Mint no longer stores it; this
 * strips it from rows that still carry one so old and new rows hash alike.
 */
export const manifestIdentity = (manifest = {}) => {
  const { quality, ...rest } = manifest ?? {};
  return rest;
};

// Handoff posture (skin-over-mesh.plan.md, the greybox seam): an ADVISORY,
// operator-DECLARED stamp — never inferred from the absence of textures or
// materials (the vertex-colour look is a legitimate final style; mojulo does
// not grade its own output's finishedness). 'greybox' declares a blockout:
// geometry/scale/layout authoritative, surfaces placeholder — the ledger
// reframes surfacing losses as deferred, and the import guides carry the
// handoff sentence. 'final' records the opposite declaration. Absent ⇒ no
// stamp, byte-identical score.
export const HANDOFF_POSTURES = ['greybox', 'final'];

export const GREYBOX_LEDGER_NOTE =
  'operator-declared blockout — geometry, scale, and layout are authoritative; '
  + 'surfaces are placeholder. Surfacing losses in this ledger are intentionally '
  + 'deferred to the downstream art pass, not lost.';

// The one-sentence handoff contract the import guides/READMEs carry when a
// pack is stamped greybox — it tells the downstream artist which half of the
// artifact to trust.
export const GREYBOX_HANDOFF_SENTENCE =
  'The operator declared this pack a BLOCKOUT: geometry, scale, and layout are '
  + 'authoritative; surfaces are placeholder. Replace surfacing freely downstream '
  + '— re-mint from `recipe/` to change form.';

/** Resolve the effective posture: explicit (per-handoff) wins over the
 * manifest's durable default; unknown values fail at export, not silently. */
export function resolvePosture(explicit, manifest) {
  const declared = explicit ?? manifest?.posture ?? null;
  if (declared == null) return null;
  if (!HANDOFF_POSTURES.includes(declared)) {
    throw new Error(`unknown handoff posture '${declared}' — expected '${HANDOFF_POSTURES.join("' or '")}' (skin-over-mesh.plan.md, the greybox seam)`);
  }
  return declared;
}

const countOf = (x) => (Array.isArray(x) ? x.length : x ? 1 : 0);

// Scale the positional fields of one declarative mechanic by the unit scale (identity when the
// score has none): the `at` / `radius` a kernel reads on the mechanic itself and on each of its
// `pickups` / `hazards`. Every other field (kind, item, damage, seconds) passes through.
function scaleMechanic(m, sv, sn) {
  if (!m || typeof m !== 'object') return m;
  const one = (o) => (o && typeof o === 'object'
    ? { ...o, ...(Array.isArray(o.at) ? { at: sv(o.at) } : {}), ...(Number.isFinite(o.radius) ? { radius: sn(o.radius) } : {}) }
    : o);
  return {
    ...one(m),
    ...(Array.isArray(m.pickups) ? { pickups: m.pickups.map(one) } : {}),
    ...(Array.isArray(m.hazards) ? { hazards: m.hazards.map(one) } : {}),
  };
}

// The locomotion row (export-unreal.plan.md, the walking-suits gap): per
// entity, the GLB animation names a kernel needs to make the figure MOVE —
// idle / walk / boost, derived from the figure's own clip vocabulary
// (mojulo rigs name their travel cycle 'forward'; 'walk' is accepted as an
// alias). Engine-agnostic: these are glTF animation names (`<figure>:<clip>`),
// each engine kernel resolves them to its own imported-asset naming. Absent
// clips ⇒ no row, byte-identical entity. `walkSpeed`: the walk clip's GROUND SPEED (its packed `v`, hero-motion.js) in
// engine metres a second — the speed at which its planted feet stay put, so a kernel plays the walk at planar speed ÷
// walkSpeed; absent when the clip carries none (a walk in place), the row as before.
function locomotionFor(figures, figKey, unitScale = 1) {
  const clips = figKey != null ? figures?.[figKey]?.clips : null;
  if (!clips || typeof clips !== 'object') return null;
  const clip = (...names) => {
    const hit = names.find((n) => clips[n]);
    return hit ? `${figKey}:${hit}` : null;
  };
  const idle = clip('idle');
  const walk = clip('forward', 'walk');
  const boost = clip('boost');
  if (!idle && !walk) return null;
  const v = walk ? clips[walk.slice(figKey.length + 1)]?.v : null;
  // the jumps a figure carries (one-shot clips with their air, hero-jump.js), by name; none ⇒ no key
  const jumps = Object.entries(clips).filter(([, c]) => c && c.once && c.air).map(([n]) => [n, `${figKey}:${n}`]);
  const rolls = Object.entries(clips).filter(([, c]) => c && c.once && c.roll).map(([n]) => [n, `${figKey}:${n}`]);
  // the stops (hero-motion.js heroStop), by the gait they leave: one per braking foot, with the gait phase each starts at
  const stops = {};
  for (const [n, c] of Object.entries(clips)) if (c && c.once && c.stop) (stops[c.stop.from] ??= []).push({ clip: `${figKey}:${n}`, lead: c.stop.lead, phase: c.stop.phase });
  return {
    ...(idle ? { idle } : {}),
    ...(walk ? { walk } : {}),
    ...(v > 0 ? { walkSpeed: Math.round(v * unitScale * 1e4) / 1e4 } : {}),
    ...(jumps.length ? { jumps: Object.fromEntries(jumps) } : {}),
    ...(rolls.length ? { rolls: Object.fromEntries(rolls) } : {}),
    ...(Object.keys(stops).length ? { stops } : {}),
    ...(boost ? { boost } : {}),
  };
}

// THE BUS (godot-bus): a world's behaviour as the event-bus fragment every cue, chapter, menu pick and mechanic lowers
// to. It travels beside the score as `bus.json`, versioned and in recipe units (the kernels convert a walker's metres
// back), and an engine kernel runs it with its port of the one reducer (Godot: kernel/bus.gd, held equal to the web's by
// scripts/godot-bus-conformance.mjs). Only the bus's own channels ride, and the stats that run inside it: the page's
// (hud, menus, style) are read elsewhere. Absent behaviour (no reactions, watches, sequences or timers) ⇒ null, and no file.
export const BUS_VERSION = 'bus/1';
const BUS_CHANNELS = ['reactions', 'watches', 'sequences', 'timers', 'vars', 'sources', 'initial', 'entities', 'budget', 'depthCap'];

// THE GODOT READING (godot-marks.js): what of a payload an engine kernel is asked to run beyond its geometry. The
// rules its entities run (the pilot's, the camera's, the cast's), the page channels it fills that do not travel whole,
// and the events keys an export drops or carries in part. Each is a ledger row only when something in it does not run
// whole, so a world the kernel runs whole keeps its score byte-identical; engine-portability
// reads them against the marks. A channel another ledger row already names (movers, physics, fx, sprite sfx, the sky,
// the tone, the weather, breakables, the crystal light) is left to that row.
const LEDGERED = new Set(['movers', 'physics', 'fx', 'spriteSfx', 'bg', 'backdrop', 'tone', 'weather', 'breakables', 'crystalLight']);
const filled = (v) => v != null && v !== false && (Array.isArray(v) ? v.length > 0 : typeof v === 'object' ? Object.keys(v).length > 0 : true);
export function godotReading(payload) {
  // the pilot: the entity the level marks pilotable (a car on the drive rule is one), else the walker the score seats
  const player = (payload?.entities ?? []).find((e) => e?.pilotable === true)?.id ?? playerOf(payload), by = {};
  for (const e of payload?.entities ?? []) {
    const t = e?.rule?.type;
    if (typeof t !== 'string') continue;
    const r = (by[t] ||= { count: 0 });
    r.count++;
    if (e.isCamera) r.camera = true;
    if (player != null && e.id === player) {
      r.pilot = true;
      const lost = platformLost(e.rule);
      if (lost.length) r.lost = lost;
    }
  }
  const channels = Object.keys(payload || {}).filter((k) => PAGE_MARKS[k] && !PAGE_MARKS[k].option && PAGE_MARKS[k].godot !== 'built' && !LEDGERED.has(k) && filled(payload[k])).sort();
  const ev = payload?.events && typeof payload.events === 'object' ? payload.events : {};
  const events = Object.keys(ev).filter((k) => filled(ev[k]) && EVENT_MARKS[k]?.godot !== 'built').sort();
  // the camera the page drives (payload.camera: { rule, target, … }), beside any camera entity
  const camRule = payload?.camera && typeof payload.camera.rule === 'string' ? payload.camera.rule : null;
  if (camRule) {
    const r = (by[camRule] ||= { count: 0 });
    r.count++; r.camera = true;
    // the kernel steps the page's camera when it watches the pilot it walks by its rule (kernel/level.gd _build_camera_rule)
    const pe = (payload?.entities ?? []).find((e) => e?.id === player);
    if (payload.camera.target !== player || !RULED_PILOTS.has(pe?.rule?.type)) r.unwatched = String(payload.camera.target ?? '');
    const lost = Object.keys(CAMERA_LOST).filter((k) => payload.camera[k] != null && payload.camera[k] !== false).map((k) => CAMERA_LOST[k]);
    if (lost.length) r.lost = [...(r.lost || []), ...lost];
  }
  return { rules: by, channels, events };
}

// THE EDIT of a shoot plan (lib/graph/shoot/): its program camera rides the GLB (`cam:shot:program` and its STEP
// animation `shot:program`, shootCameraDefs) and the kernel plays it (kernel/level.gd, key P); a glTF camera cannot key
// its lens, so the score carries it: `fov` the program's vertical field of view (degrees) at each of its frames, `fps`
// their rate, `total` the edit's length in seconds, `cameras` the plan's cameras. No program ⇒ no key.
function shootRow(payload) {
  const defs = shootCameraDefs(payload?.shoot, payload?.viewBox), program = defs.find((d) => d.name === 'shot:program');
  if (!program) return {};
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return { shoot: { fps: payload.shoot.fps || 24, total: payload.shoot.total, cameras: defs.filter((d) => d !== program).map((d) => d.name), fov: program.yfovs.map((y) => r4((y * 180) / Math.PI)) } };
}

// the sky dome as the page draws it (scene-three.js skyDome): an atmosphere's gradient or space's void, its stars and lights
function skyDomeRow(sky) {
  if (!sky || !(sky.space || (Array.isArray(sky.zenith) && Array.isArray(sky.horizon)))) return null;
  return {
    space: !!sky.space, zenith: sky.zenith || [], horizon: sky.horizon || [],
    day: Number.isFinite(sky.day) ? sky.day : (sky.space ? 0 : 1),
    stars: Number.isFinite(sky.stars) ? sky.stars : (sky.space ? 1 : 0), seed: (sky.seed >>> 0) || 1,
    ...(sky.moon && !sky.space ? { moon: sky.moon } : {}), ...(sky.sun ? { sun: sky.sun } : {}),
  };
}

// the GLB nodes (a face's `node`, else its `group`: scene-gltf.js) whose every face is a blend face
function blendOnlyNodes(faces) {
  const by = new Map();
  for (const f of Array.isArray(faces) ? faces : []) {
    if (!f || f.water || f.decal === 'shadow' || f.decal === 'ink') continue;
    const k = typeof f.node === 'string' && f.node ? f.node : typeof f.group === 'string' ? f.group : 'static';
    by.set(k, (by.get(k) ?? true) && !!f.blend);
  }
  return [...by].filter(([, all]) => all).map(([k]) => k).sort();
}

// the rules kernel/rules.gd runs for a pilot (since 0.23.0: the vehicles too), and the drivers it runs for no one
const RULED_PILOTS = new Set(['walk', 'platform', 'drive', 'fly']);
function driverRows(payload) {
  return (Array.isArray(payload?.entities) ? payload.entities : []).filter((e) => e && typeof e.id === 'string' && e.rule?.type === 'racer' && !e.isCamera)
    .map((e) => ({ id: e.id, rule: JSON.parse(JSON.stringify(e.rule)), pos: Array.isArray(e.transform?.pos) ? e.transform.pos.slice(0, 3) : [0, 0, 0], heading: Number.isFinite(e.transform?.heading) ? e.transform.heading : 0 }));
}

// the pilot the level-equivalence key names first (a pilotable entity, else the first walker), when it walks or runs
function pilotRow(payload) {
  const ents = Array.isArray(payload?.entities) ? payload.entities : [];
  const e = ents.find((x) => x?.pilotable === true) ?? ents.find((x) => x?.rule?.type === 'walk' || x?.rule?.type === 'platform');
  if (!e || !RULED_PILOTS.has(e.rule?.type)) return null;
  const t = e.transform && typeof e.transform === 'object' ? e.transform : {};
  return { id: String(e.id), rule: JSON.parse(JSON.stringify(e.rule)), pos: Array.isArray(t.pos) && t.pos.length >= 3 ? t.pos.slice(0, 3) : [0, 0, 0], heading: Number.isFinite(t.heading) ? t.heading : 0 };
}

const playerOf = (payload) => (payload?.entities ?? []).find((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform')?.id ?? null;

export function extractBus(payload) {
  const ev = (payload && payload.events) || {};
  // the fight (combat-score.js): a melee hero and what it can hit ride beside the cast, which they need; a level with
  // a fight and no other behaviour carries an empty fragment
  const combat = payload ? extractCombat(payload, playerOf(payload)) : null;
  if (!combat && !['reactions', 'watches', 'sequences', 'timers'].some((k) => Array.isArray(ev[k]) && ev[k].length)) return null;
  const fragment = Object.fromEntries(BUS_CHANNELS.filter((k) => ev[k] !== undefined).map((k) => [k, ev[k]]));
  const mpu = Number(payload.metersPerUnit);
  // the characters the behaviour moves (its cues reach the cast: events.cast), in the bus's own units: where each
  // stands, its heading, asleep or not, its hp and pace. An engine kernel's cast adapter (Godot: kernel/cast.gd)
  // starts from these. Absent cast ⇒ no rows.
  const cast = ev.cast === true || combat ? (payload.entities || []).filter((e) => e && typeof e.id === 'string' && !e.isCamera).map((e) => ({
    id: e.id, pos: Array.isArray(e.transform?.pos) ? e.transform.pos : [0, 0, 0],
    ...(Number.isFinite(e.transform?.heading) ? { heading: e.transform.heading } : {}),
    ...(e.dormant ? { dormant: true } : {}),
    ...(Number.isFinite(e.body?.hp) ? { hp: e.body.hp } : {}),
    ...(Number.isFinite(e.rule?.speed) ? { speed: e.rule.speed } : {}),
    // where it stands below its pos (the web's feet: its rule's eye, else half its box, else its radius): a beam
    // leaves its hand and lands at its feet
    ...((f) => (f ? { foot: f } : {}))(Number.isFinite(e.rule?.eye) ? e.rule.eye : Array.isArray(e.body?.size) ? e.body.size[2] / 2 : Number.isFinite(e.body?.radius) ? e.body.radius : 0),
  })) : null;
  // the stats a world's play declares (playscape/stats: the kernel's cfg), which run inside the bus's watch fixpoint
  // (Godot: kernel/stats.gd, held equal by the same corpus); their vars start in the fragment's. Absent ⇒ no key.
  const stats = ev.stats && typeof ev.stats === 'object' ? ev.stats : null;
  // the keys, clicks, picks and shots bound to events (events.inputs: a power's key, the status page's, a marker picked
  // or shot): what an engine kernel feeds the bus as the page does (Godot: picks and shots since kernel 0.22.0, against
  // the bus's markers). Absent ⇒ no key.
  const inputs = (Array.isArray(ev.inputs) ? ev.inputs : []).filter((i) => i && i.emit && ['key', 'pointer', 'pick', 'fire'].includes(i.on));
  // the scenes' program (scenes.js sceneProgram: what the page's runner plays) and the quests' journal (quests.js
  // questProgram), which an engine kernel plays and keeps as the page does (Godot: kernel/scenes.gd, quests.gd, since
  // 0.23.0, held equal by the scenes corpus). Absent ⇒ no key.
  const scenes = Array.isArray(ev.scenes) && ev.scenes.length ? ev.scenes : null;
  const quests = Array.isArray(ev.quests) && ev.quests.length ? ev.quests : null;
  return { version: BUS_VERSION, metersPerUnit: Number.isFinite(mpu) && mpu > 0 ? mpu : 1, fragment, ...(cast && cast.length ? { cast } : {}), ...(stats ? { stats } : {}), ...(combat ? { combat } : {}), ...(inputs.length ? { inputs } : {}), ...(scenes ? { scenes } : {}), ...(quests ? { quests } : {}) };
}

// A primitive body (`mesh`: a box or a sphere, centred on the entity) bakes no geometry into the GLB: its node is an
// empty placement. The score carries its shape, size and colour so an engine kernel builds it (Godot: level.gd, in
// place of the gold placeholder). Any other body ⇒ null (no key).
const HEX_BODY = /^#[0-9a-fA-F]{3,8}$/;
function primitiveBody(list, id, sv, sn) {
  const src = (Array.isArray(list) ? list : []).find((x) => x && String(x.id) === id);
  const b = src && src.body;
  if (!b || b.type !== 'mesh') return null;
  const color = typeof b.color === 'string' && HEX_BODY.test(b.color) ? { color: b.color } : {};
  if (b.shape === 'sphere' && Number.isFinite(b.radius) && b.radius > 0) return { shape: 'sphere', radius: sn(b.radius), ...color };
  if (Array.isArray(b.size) && b.size.length >= 3 && b.size.slice(0, 3).every((x) => Number.isFinite(x) && x > 0)) return { shape: 'box', size: sv(b.size.slice(0, 3)), ...color };
  return null;
}

/**
 * A level's music bed: { id, recipe } | null. A stored beats row keeps its ref as the id (recipe null: the pack
 * renders the row); any other soundtrack world-scene resolved onto the payload ('field:<mood>', { score }, an inline
 * recipe, a kind's period music) ships as `<level ref>-soundtrack` with that resolved recipe. The id names the
 * score's `soundtrack` and the pack's `audio/<id>.wav` (engine-audio.js renders it).
 */
export function levelSoundtrack(sketch, payload) {
  const ref = payload?.audio?.soundtrack?.beatsRef ?? sketch?.manifest?.audio?.soundtrack?.beatsRef;
  if (ref) return { id: ref, recipe: null };
  if (payload?.audio?.soundtrack && sketch?.ref) return { id: `${sketch.ref}-soundtrack`, recipe: payload.audio.soundtrack };
  return null;
}

export function extractEngineScore(sketch, payload, { posture = null } = {}) {
  const manifest = sketch?.manifest ?? {};
  const extras = levelSceneExtras(payload) ?? {};
  const declared = resolvePosture(posture, manifest);

  const ledger = {};
  // Reframe first so pack READMEs/guides lead with it — the rest of the
  // ledger reads under this declaration.
  if (declared === 'greybox') ledger.greybox_declared = { note: GREYBOX_LEDGER_NOTE };
  const skip = (key, n, note) => { if (n) ledger[key] = { count: n, note }; };
  skip('skipped_movers', countOf(payload.movers), 'live integrator platforms/movers — runtime state, not geometry');
  skip('skipped_fx', countOf(payload.fx), 'camera-facing/runtime fx (billboards, glows) — not geometry');
  skip('skipped_physics', countOf(payload.physics), 'live physics-body channels do not bake');
  skip('skipped_sprite_sfx', countOf(payload.spriteSfx), 'sprite sfx cues — re-orchestrate in-engine');
  // the page's backdrop is an IMAGE it loads by URL behind a transparent canvas: a pack fetches nothing, so it is named
  // (the background colour, the sky dome and the haze ride the score since 0.23.0: score.bg, score.skyDome, score.haze)
  if (payload.backdrop) {
    ledger.sky_approximated = { note: 'the backdrop image the page loads by URL is not carried; the engine draws the background colour and the sky dome' };
  }
  ledger.skipped_runtime = {
    note: 'game shell, AI, combat feel — re-orchestrate in-engine; reference performance is the web build',
  };
  const sound = levelSound(payload.audio, sketch?.ref);
  if (sound?.sounds.length) ledger.sfx_carried = { count: sound.sounds.length, note: `action sounds ride score.json \`audio\` (bus events, footsteps, shots, swings) as one-shot WAVs${sound.score.variants > 1 ? `, ${sound.score.variants} takes each` : ''}; the Godot kernel plays them (kernel/sound.gd, an AudioStreamRandomizer per sound on the SFX bus, which ducks the music); Unity and Unreal carry the data` };
  if (sound?.combat) ledger.combat_music_carried = { note: 'the fight score ships beside the soundtrack and the Godot kernel changes to it on the bar line when the tension the level\'s events raise reaches its threshold, and back after the hold (kernel/sound.gd, the page\'s meter); Unity and Unreal play the explore score only' };
  const hudWidgets = normalizeHud(payload.events?.hud).widgets;
  if (hudWidgets.length) {
    ledger.hud_declared = { count: hudWidgets.length, note: 'HUD widgets (slot / kind / banner / legend) ride score.json `hud` as data; when the world has a bus, the Godot kernel draws them as the page does (kernel/hud.gd: slots, text / counter / bar / clock, banners, stacking toasts, legends, a part\'s show / hide / state and its phases) in the guide\'s tokens, font and frame and plate dials (`hudStyle`); the register\'s motion, sound, cursor and light stay the web\'s; without a bus the kernels paint their own readout from `mechanics`' };
  }
  // the HUD's look (the guide's tokens resolved, its font's id, the register's dials) for an engine's HUD; absent a
  // style and a register ⇒ no key (an engine draws the defaults, as the page does)
  const evStyle = payload.events?.style, evReg = payload.events?.register;
  const hudStyle = hudWidgets.length && (evStyle || evReg) ? {
    ...Object.fromEntries(STYLE_TOKENS.map((k) => [k, styleTokens(evStyle)[k]])),
    font: FONT_IDS.includes(evStyle?.font) ? evStyle.font : 'system',
    ...(Object.keys(cleanDials(evReg)).length ? { register: cleanDials(evReg) } : {}),
  } : null;
  // Units: a kind authored in other-than-metres (the floorplan: feet) declares
  // `metersPerUnit`; the GLB root scales by it, so every positional field here scales
  // too — the score and the mesh agree in metres. Absent ⇒ every field byte-identical.
  const mpu = Number(payload.metersPerUnit);
  const unitScale = Number.isFinite(mpu) && mpu > 0 && mpu !== 1 ? mpu : null;
  const weatherScoreRow = weatherScore(payload, { unitScale: unitScale || 1 });
  if (weatherScoreRow) ledger.weather_partial = { note: 'the sky\'s fog, colour and light are played by the engine kernels from score.weather (its schedule and each state in the style\'s air); falling rain, snow, dust and petals, their landings and the lightning stay the web build\'s, and Blender and a bare GLB carry the row as data only' };
  const sv = (v) => (unitScale && Array.isArray(v) ? v.map((x) => (Number.isFinite(x) ? x * unitScale : x)) : v);
  const sn = (x) => (unitScale && Number.isFinite(x) ? x * unitScale : x);
  // what the game lets break (playscape/destruct/breakability.js) left the collider list for the web runtime's blocks;
  // an engine holds it whole, as the solid it was. Absent ⇒ no row, byte-identical.
  const breakables = Array.isArray(payload.breakables) ? payload.breakables : [];
  if (breakables.length) ledger.breakables_held = { count: breakables.length, note: 'what the game lets break (destruction) travels as solid colliders: engines hold it whole; breaking it, its pieces and its flash stay the web build\'s' };
  // Positioned lights (pot lights) ride the GLB as KHR_lights_punctual; the score carries
  // them too so an importer that brings none in (Interchange) can spawn them itself.
  const lights = (Array.isArray(payload.lights) ? payload.lights : [])
    .filter((l) => l && Array.isArray(l.position))
    .map((l) => ({ ...l, position: sv(l.position) }));
  if (lights.length) {
    ledger.lights_carried = { count: lights.length, note: 'recessed pot lights ride the GLB as KHR_lights_punctual spots (candela) and the score carries them too; Blender, Godot and Unity import them from the GLB (Godot converts candela to its lamp energy in the pack kernel), the Unreal importer spawns SpotLights from score.json when Interchange brings none' };
  }
  // The LOOK declaration (shader-look phase 4): the one runtime term the bake cannot carry — a
  // figure's rim `[r,g,b,strength,power]` — rides the score so each engine kernel lowers it to
  // its own idiom (Godot: kernel/rim.gdshader as a next_pass; the World page's rig-preview and
  // controllable channels are the reference render). Absent rims ⇒ no key, byte-identical.
  const lookFigures = Object.entries(payload.figures || {})
    .filter(([, f]) => f && Array.isArray(f.rim) && f.rim.length === 5 && f.rim.every(Number.isFinite));
  if (lookFigures.length) {
    ledger.look_declared = { figures: lookFigures.length, note: 'rim rides score.look.figures; the GLB carries no shader — each engine kernel realizes it (Godot: next_pass rim.gdshader)' };
  }
  // Crystals (crystal-rig R5): each `<group>:crystal` node's optics as data, since an importer that drops the KHR
  // transmission family (Godot) cannot recover them from the material; kernel/level.gd gives those surfaces a
  // refraction material of their own. Absent crystal faces ⇒ no key, byte-identical.
  const crystals = crystalNodes(payload.faces);
  if (Object.keys(crystals).length) {
    ledger.crystals_carried = { count: Object.keys(crystals).length, note: 'crystal nodes carry KHR transmission / ior / volume / dispersion (Blender reads them; Godot drops transmission, so kernel/level.gd applies a refraction material from score.crystals)' };
  }
  // Water (aqua look): each `water:<kind>` node's look as data — absorption, tint, ripples, shore band, sky — in metres.
  // The GLB carries transmission / ior / volume for importers that read them (Blender); Godot drops them, so
  // kernel/level.gd gives those surfaces kernel/water.gdshader from score.water. Absent aqua water ⇒ no key.
  const waterBodies = aquaWaterBodies(payload);
  const water = Object.fromEntries(waterBodies.map((w) => [w.name, aquaScoreEntry(w, unitScale || 1)]));
  if (waterBodies.length) {
    ledger.water_carried = { count: waterBodies.length, note: 'water nodes carry KHR transmission / ior / volume (Blender reads them); Godot drops transmission, so kernel/level.gd shades them with kernel/water.gdshader from score.water (depth absorption, refraction, Fresnel sky, ripples, shore foam)' + (waterBodies.some((w) => w.frame) ? '; animated seas and rivers leave as one frozen frame (t = 0) — their ripples move in the shader, the waves do not' : '') };
  }
  // A crystal light rig: lamps, stones as operators, targets — performed live by kernel/crystal_light.gd; the GLB's
  // frozen frame (`crystal-light:*` nodes) is what other importers keep. Absent ⇒ no key.
  const cryRig = payload.crystalLight ? crystalRigFor(payload.faces || [], payload.crystalLight) : null;
  if (cryRig) {
    ledger.crystal_light_performed = { lamps: cryRig.lamps.length, stones: cryRig.stones.filter((st) => st.op).length, targets: cryRig.targets.length, note: 'performed live by kernel/crystal_light.gd (beams re-solved each frame against the level\'s meshes); movers do not travel, so stones stand at rest; the GLB carries a frozen frame at t = 0' };
  }
  // The level's ADDRESS (a room stage, era/anchors.js): rooms, anchors (doorways, doors, items, the set piece, things,
  // torches, niches) and the colliders built from them, so an idiom can name a place and an engine can walk and
  // trigger it. Absent ⇒ no key, byte-identical.
  const addr = levelAddress(payload, sv, sn);
  if (addr.anchors) {
    const by = {};
    for (const a of addr.anchors) by[a.kind] = (by[a.kind] || 0) + 1;
    ledger.address_carried = { count: addr.anchors.length, rooms: addr.rooms ? addr.rooms.length : 0, kinds: Object.entries(by).map(([k, n]) => `${k} ×${n}`), note: 'rooms and anchors ride score.json and the GLB scene extras (moj:rooms, moj:anchors); an anchor with a `node` is the GLB node of that name; doorways, doors and items become triggers in kernel/level.gd, every anchor a named Marker3D' };
  }
  // A TONE (era/tone.js) is graded on the World page: the build under it is drained to greys, and the score carries
  // the tone as data for an engine to grade with. Absent ⇒ no key.
  if (payload.tone && Array.isArray(payload.tone.ramps)) {
    ledger.tone_graded_on_page = { count: payload.tone.ramps.length, note: 'the World page colours the lit value off the tone\'s ramps (channels/tone.js); the GLB carries the grey build it grades, and score.tone carries the ramps, steps and gain — an engine pass colours it (none yet)' };
  }
  // LOOKS (playscape elements): the looks a world's cues put on its cast, and the transits they play, as data. The cues
  // do not travel, so an engine kernel offers them to its scripts (Godot: kernel/looks.gd). Absent ⇒ no key.
  const ev = payload.events && payload.events.cast === true ? payload.events : null;
  const worn = ev ? statusElements(ev).filter((n) => ev.looks && ev.looks[n]) : [];
  const transits = ev ? transitKinds(ev) : [];
  const looks = Object.fromEntries(worn.map((n) => [n, lookRGB(ev.looks[n])]));
  if (worn.length || transits.length) {
    const DRAWN = ['coat', 'motes', 'drift'], dropped = [...new Set(worn.flatMap((n) => ['bolts', 'fire', 'ice', 'water', 'steam'].filter((k) => looks[n][k])))];
    ledger.looks_carried = {
      count: worn.length, names: worn, ...(transits.length ? { transits } : {}), drawn: DRAWN, ...(dropped.length ? { not_drawn: dropped } : {}),
      note: 'score.looks carries each status\'s look as data; kernel/looks.gd wears it (the coat as a material_overlay, waves and drift as billboards from the same closed forms) and plays transits as animation clips. The cues run on the bus, but no adapter wears a look yet: nothing wears one until a script calls $Level.looks.wear(node, name)',
    };
  }

  // solid bodies (body.collide: the world pass that pushes walkers out of them) are the web's: named, never dropped
  const solids = (payload.entities ?? []).filter((e) => e?.body?.collide && !e.isCamera).length;
  if (solids) ledger.bodies_solid = { count: solids, note: 'solid bodies (body.collide) push the walkers and the cast\'s walks out of their eggs on the web (controllable core.js stepBodyCollisions); the Godot kernel does not run that pass' };
  const reading = godotReading(payload);
  const pilot = pilotRow(payload);
  const drivers = driverRows(payload);
  const blendNodes = blendOnlyNodes(payload.faces);
  // only when some rule does not run whole: a world the kernel walks whole keeps its score byte-identical
  if (Object.entries(reading.rules).some(([t, r]) => RULE_MARKS[t]?.godot !== 'built' || r.lost || r.unwatched != null || ((t === 'walk' || t === 'platform') && r.count > (r.pilot ? 1 : 0)))) ledger.rules_carried = { by: reading.rules, note: 'the motion and camera rules the level\'s entities run, by type (pilot: the player\'s; camera: the camera\'s; lost: the opt-in moves of the pilot\'s platform rule the kernel does not run); kernel/rules.gd runs the pilot\'s walk or platform rule, kernel/walker.gd follow and eye (godot-marks.js RULE_MARKS)' };
  if (reading.channels.length) ledger.channels_carried = { keys: reading.channels, note: 'the page channels the world fills that a Godot export does not carry whole (godot-marks.js PAGE_MARKS says what each loses)' };
  if (reading.events.length) ledger.events_carried = { keys: reading.events, note: 'the events keys bus.json and score.json drop or carry in part (godot-marks.js EVENT_MARKS)' };

  // The contract tier (world-contract-tiers W1): what this payload DECLARES and what the next
  // tier would need — one ledger row every pack carries, so a missing declaration is read in
  // lib/ instead of found at the most expensive gate that happens to be open.
  const walkable = Boolean(payload.walk) || (payload.entities ?? []).some((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform');
  ledger.contract = contractLedgerEntry(assessWorldTier(payload, { walkable }));
  const bus = extractBus(payload);
  if (bus?.combat) {
    ledger.combat_carried = { hero: bus.combat.hero, bodies: Object.keys(bus.combat.bodies).length, version: bus.combat.version, note: 'the hero\'s fight rides bus.json `combat`: its five swings (reach, cone, contact window, damage), its weapon (the trigger, the rounds, their splash), the cover, and every hittable body with its reaction and shield; an engine kernel adjudicates them in recipe units (Godot: kernel/combat.gd, held equal to the web frame by frame) and each hit is a hit:<id> fact. The combo\'s stun, scaling and juggle, the clash and the other set pieces, the deferred wreck finisher, a loadout\'s other slots and every AI\'s attack stay the web\'s' };
  }
  if (bus) {
    const n = (k) => (Array.isArray(bus.fragment[k]) ? bus.fragment[k].length : 0);
    // what the behaviour takes and gives, and what the Godot kernel performs of it (bus-abi.js)
    const { godot } = busCoverage(payload.events);
    ledger.bus_carried = { reactions: n('reactions'), watches: n('watches'), sequences: n('sequences'), timers: n('timers'), version: BUS_VERSION, godot, note: 'the world\'s behaviour (cues, chapters, menu picks, mechanics) rides bus.json; an engine kernel runs it with its port of the bus (Godot: kernel/bus.gd, conformance-tested equal to the web). `godot` lists the facts it takes and the effects it gives: built is performed, partial in part, absent not (the logic still runs; nothing feeds or draws that row)' };
  }

  return {
    ref: sketch?.ref ?? null,
    title: payload.title ?? manifest.title ?? sketch?.ref ?? 'mojulo world',
    kind: manifest.kind ?? null,
    frame: 'z-up',
    units: MOJULO_UNITS,
    // Both fields are true at once: the recipe was authored in another unit (feet), the GLB
    // root and every number on this score have ALREADY been scaled by metersPerUnit, and a
    // kernel must not scale again. The note says so where the next kernel author will read it.
    ...(unitScale ? { metersPerUnit: unitScale, unitsNote: `score and GLB are in metres already: recipe units × ${unitScale} applied by the exporter; metersPerUnit is provenance, never a second scale` } : {}),
    // present only when declared — an unstamped score is byte-identical to pre-seam output
    ...(declared ? { posture: declared } : {}),
    spawn: sv(extras['moj:spawn'] ?? [0, 0, 2]),
    eye: sn(payload.walk?.eye ?? 1.7),
    // the seat's FACING (`walk.yaw`, degrees, counter-clockwise from +x seen from above — the
    // recipe's own frame): an engine spawns the pawn looking that way, so a "walk forward" probe
    // and a player's first step head where the level intends. Absent ⇒ no row.
    ...(Number.isFinite(payload.walk?.yaw) ? { yaw: payload.walk.yaw } : {}),
    // The runtime's walk/controllable engines ground-snap on an IMPLICIT plane
    // at z=0 — the collider AABBs are obstacle hulls only, never the floor
    // (G1 finding: a promoted world without this plane is an infinite fall).
    ground: Number.isFinite(payload.walk?.ground) ? sn(payload.walk.ground) : 0,
    // surface/atlas texture keys riding the payload (skin-over-mesh.plan.md
    // phase 3): the GLB embeds them (TEXCOORD_0 + PNG), so engine packs CARRY
    // them — the ledger states it. Absent textures ⇒ no key, byte-identical.
    ...(payload.textures && Object.keys(payload.textures).length
      ? { textures: Object.keys(payload.textures).sort() } : {}),
    colliders: [...(payload.colliders ?? []), ...breakables.map((b) => ({ min: b.min, max: b.max, of: b.id }))].map((c) => (unitScale && c && Array.isArray(c.min) && Array.isArray(c.max) ? { ...c, min: sv(c.min), max: sv(c.max) } : c)),
    ...addr,
    ...(payload.tone && Array.isArray(payload.tone.ramps) ? { tone: payload.tone } : {}),
    cameras: (levelCameras(payload) ?? []).map((c) => (unitScale ? { ...c, translation: sv(c.translation), znear: sn(c.znear), zfar: sn(c.zfar) } : c)),
    ...shootRow(payload),
    ...(lights.length ? { lights } : {}),
    // the sky DECLARATION (a preset name: day / night / dawn / dusk) so an engine rig can set its
    // sun, sky and fog to what the recipe said — the mesh never carried the backdrop
    // (sky_approximated). Absent a preset ⇒ no row, byte-identical.
    ...(typeof payload.sky?.preset === 'string' ? { sky: { preset: payload.sky.preset } } : {}),
    // the LOOK of the sky as the page draws it (since 0.23.0): its background colour, its dome (a horizon-to-zenith
    // gradient in sRGB 0..255, night stars, the moon and sun; or the void of space) and its distance haze (exponential fog
    // in the horizon colour, the background with it). Kernel/level.gd builds a WorldEnvironment from them. Absent ⇒ no key.
    ...(typeof payload.bg === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(payload.bg) ? { bg: payload.bg } : {}),
    // the PIXEL medium (reality.medium=pixel): the 3D drawn at 1/scale and blown up without smoothing. Absent ⇒ no key.
    ...(payload.pixel && Number(payload.pixel.scale) > 1 ? { pixel: { scale: Math.round(Number(payload.pixel.scale)) } } : {}),
    ...(skyDomeRow(payload.sky) ? { skyDome: skyDomeRow(payload.sky) } : {}),
    ...(payload.haze && Number.isFinite(payload.haze.density) && payload.haze.density > 0 && typeof payload.haze.color === 'string' ? { haze: { color: payload.haze.color, density: payload.haze.density / (unitScale || 1) } } : {}),
    // the world's weather as data (weather-score.js): the schedule's first half hour and what each state is in the style's air,
    // for the kernels' fog, colour and light; falls and lightning stay the web build's (ledger.weather_partial). Absent ⇒ no row.
    ...(weatherScoreRow ? { weather: weatherScoreRow } : {}),
    // the figure look (rim) as data — see ledger.look_declared. Absent ⇒ no key.
    ...(lookFigures.length ? { look: { figures: Object.fromEntries(lookFigures.map(([n, f]) => [n, { rim: f.rim }])) } } : {}),
    ...(Object.keys(crystals).length ? { crystals } : {}),
    ...(waterBodies.length ? { water } : {}),
    ...(cryRig ? { crystalLight: rigForScore(cryRig, unitScale || 1) } : {}),
    ...(worn.length ? { looks } : {}),
    ...(transits.length ? { transits } : {}),
    entities: (levelEntityNodes(payload) ?? []).map((e) => {
      const locomotion = locomotionFor(payload.figures, e.figure, unitScale || 1);
      const scaled = unitScale ? { ...e, translation: sv(e.translation) } : e;
      const prim = primitiveBody(payload.entities, e.id, sv, sn);
      return { ...scaled, ...(locomotion ? { locomotion } : {}), ...(prim ? { primitive: prim } : {}) };
    }),
    // declarative mechanics: `at` + `radius` on a zone, a pickup, a hazard are RECIPE units, so
    // they scale with the mesh (a kernel reads them as metres × 100). Absent a unit ⇒ untouched.
    mechanics: (manifest.game?.mechanics ?? []).map((m) => scaleMechanic(m, sv, sn)),
    // the HUD widget list (hud-widgets.js): slots / kinds / banners / legends as DATA, so an
    // engine arm can lay the readout out as authored. Absent rows ⇒ no key, byte-identical.
    ...(hudWidgets.length ? { hud: hudWidgets } : {}),
    ...(hudStyle ? { hudStyle } : {}),
    // the menus a world's play declares (playscape/ui/menus.js menuPages: words and pick labels; the picks' effects
    // ride the bus), so an engine kernel draws the open one (ui-menu-<id> = 1) and sends its picks back. Absent ⇒ no key.
    ...(Array.isArray(payload.events?.menus) && payload.events.menus.length ? { menus: payload.events.menus } : {}),
    // The runtime's player seat (level-synth deriveLevelPlayer): first entity
    // with a walk/platform rule. Emitters hide its exported body — the
    // operator IS the walker; leaving it renders a body double at spawn.
    player: playerOf(payload),
    // the pilot's motion rule as data, in RECIPE units like bus.json (score.metersPerUnit is the mesh's scale over them):
    // kernel/rules.gd runs a walk or a platform pilot as the web runs it, standing on the GLB's own faces. Absent ⇒ no key.
    ...(pilot ? { pilot } : {}),
    // the rivals that drive themselves (the racer rule: a line, a pace), in recipe units: kernel/rules.gd drives each
    // as the web does (since 0.23.0). Absent ⇒ no key.
    ...(drivers.length ? { drivers } : {}),
    // the GLB nodes that are all blend faces (a second tile over the ground, which the page draws in its own pass at the
    // ground's height): the kernel's land leaves them out, so its pilot stands where the page's does. Absent ⇒ no key.
    ...(blendNodes.length ? { blendNodes } : {}),
    // the camera the page drives (payload.camera: { rule, target, … }) as data, in recipe units: kernel/rules.gd steps
    // follow, eye, overhead, side and fixed after the pilot, as the page's world steps its camera. Absent ⇒ no key.
    ...(payload.camera && typeof payload.camera.rule === 'string' ? { camera: JSON.parse(JSON.stringify(payload.camera)) } : {}),
    game: extras['moj:game'] ?? null,
    soundtrack: levelSoundtrack(sketch, payload)?.id ?? null,
    // the level's action sounds and fight score (engine-sound.js): absent ⇒ no key, byte-identical
    ...(sound ? { audio: sound.score } : {}),
    // the music's pulse on the bus (audio.beat: { every, lead }; beats/beat-clock.js), which kernel/level.gd says from
    // its music player's clock as the page does from its AudioContext. Absent ⇒ no key.
    ...(payload.audio?.beat && payload.audio.beat.every > 0 ? { beat: { every: payload.audio.beat.every, lead: payload.audio.beat.lead ?? 0 } } : {}),
    ledger,
  };
}

/**
 * The GLB's crystal nodes (scene-gltf names them `<group>:crystal`, or `<group>:crystalN` when a group holds several
 * gem variants, in order of appearance) → { name: { gem, nD, body, glow, opal } }.
 */
function crystalNodes(faces) {
  const groups = new Map();
  for (const f of faces || []) {
    const k = f && f.crystal; if (!k || typeof k.gem !== 'string') continue;
    const g = typeof f.group === 'string' ? f.group : 'static'; const key = k.glow ? `${k.gem}~${k.glow}` : k.gem;
    const list = groups.get(g) || groups.set(g, []).get(g); if (!list.includes(key)) list.push(key);
  }
  const out = {};
  for (const [g, keys] of groups) keys.forEach((key, i) => {
    const o = shineOptics(key); const body = o.colour.o[2].map((c) => +Math.max(0.002, Math.min(1, c)).toFixed(4));
    out[keys.length > 1 ? `${g}:crystal${i}` : `${g}:crystal`] = { gem: o.gem, nD: +o.nD.toFixed(4), body,
      glow: o.glow && o.glow.strength > 0 ? o.glow.rgb.map((c) => +(c * Math.min(1, o.glow.strength)).toFixed(4)) : null, opal: !!o.photonic };
  });
  return out;
}
