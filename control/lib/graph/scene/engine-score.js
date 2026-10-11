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
import { levelCameras, levelEntityNodes, levelSceneExtras, levelAddress } from './scene-gltf-level.js';
import { assessWorldTier, contractLedgerEntry } from '@/lib/graph/worlds/world-contract';
import { normalizeHud, styleTokens, STYLE_TOKENS, FONT_IDS } from '@/lib/graph/game/hud-widgets';
import { cleanDials } from '@/lib/graph/playscape/ui/register';
import { shineOptics } from '@/lib/graph/polygonizer/crystal-shine.js';
import { crystalRigFor, rigForScore } from './crystal-rig.js';
import { statusElements, transitKinds } from './channels/status-channel.js';
import { lookRGB } from '../playscape/elements/elements.js';
import { weatherScore } from './weather-score.js';
import { busCoverage } from './bus-abi.js';

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

export function extractBus(payload) {
  const ev = payload && payload.events;
  if (!ev || !['reactions', 'watches', 'sequences', 'timers'].some((k) => Array.isArray(ev[k]) && ev[k].length)) return null;
  const fragment = Object.fromEntries(BUS_CHANNELS.filter((k) => ev[k] !== undefined).map((k) => [k, ev[k]]));
  const mpu = Number(payload.metersPerUnit);
  // the characters the behaviour moves (its cues reach the cast: events.cast), in the bus's own units: where each
  // stands, its heading, asleep or not, its hp and pace. An engine kernel's cast adapter (Godot: kernel/cast.gd)
  // starts from these. Absent cast ⇒ no rows.
  const cast = ev.cast === true ? (payload.entities || []).filter((e) => e && typeof e.id === 'string' && !e.isCamera).map((e) => ({
    id: e.id, pos: Array.isArray(e.transform?.pos) ? e.transform.pos : [0, 0, 0],
    ...(Number.isFinite(e.transform?.heading) ? { heading: e.transform.heading } : {}),
    ...(e.dormant ? { dormant: true } : {}),
    ...(Number.isFinite(e.body?.hp) ? { hp: e.body.hp } : {}),
    ...(Number.isFinite(e.rule?.speed) ? { speed: e.rule.speed } : {}),
  })) : null;
  // the stats a world's play declares (playscape/stats: the kernel's cfg), which run inside the bus's watch fixpoint
  // (Godot: kernel/stats.gd, held equal by the same corpus); their vars start in the fragment's. Absent ⇒ no key.
  const stats = ev.stats && typeof ev.stats === 'object' ? ev.stats : null;
  return { version: BUS_VERSION, metersPerUnit: Number.isFinite(mpu) && mpu > 0 ? mpu : 1, fragment, ...(cast && cast.length ? { cast } : {}), ...(stats ? { stats } : {}) };
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
  if (payload.bg || payload.backdrop) {
    ledger.sky_approximated = { note: 'sky/backdrop dropped as mesh — approximate with the engine sky/fog' };
  }
  ledger.skipped_runtime = {
    note: 'game shell, AI, combat feel — re-orchestrate in-engine; reference performance is the web build',
  };
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

  // The contract tier (world-contract-tiers W1): what this payload DECLARES and what the next
  // tier would need — one ledger row every pack carries, so a missing declaration is read in
  // lib/ instead of found at the most expensive gate that happens to be open.
  const walkable = Boolean(payload.walk) || (payload.entities ?? []).some((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform');
  ledger.contract = contractLedgerEntry(assessWorldTier(payload, { walkable }));
  const bus = extractBus(payload);
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
    colliders: (payload.colliders ?? []).map((c) => (unitScale && c && Array.isArray(c.min) && Array.isArray(c.max) ? { ...c, min: sv(c.min), max: sv(c.max) } : c)),
    ...addr,
    ...(payload.tone && Array.isArray(payload.tone.ramps) ? { tone: payload.tone } : {}),
    cameras: (levelCameras(payload) ?? []).map((c) => (unitScale ? { ...c, translation: sv(c.translation), znear: sn(c.znear), zfar: sn(c.zfar) } : c)),
    ...(lights.length ? { lights } : {}),
    // the sky DECLARATION (a preset name: day / night / dawn / dusk) so an engine rig can set its
    // sun, sky and fog to what the recipe said — the mesh never carried the backdrop
    // (sky_approximated). Absent a preset ⇒ no row, byte-identical.
    ...(typeof payload.sky?.preset === 'string' ? { sky: { preset: payload.sky.preset } } : {}),
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
      return locomotion ? { ...scaled, locomotion } : scaled;
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
    player: (payload.entities ?? []).find((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform')?.id ?? null,
    game: extras['moj:game'] ?? null,
    soundtrack: payload.audio?.soundtrack?.beatsRef ?? manifest.audio?.soundtrack?.beatsRef ?? null,
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
