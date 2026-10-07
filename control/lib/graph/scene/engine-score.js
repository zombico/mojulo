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
import { normalizeHud } from '@/lib/graph/game/hud-widgets';
import { shineOptics } from '@/lib/graph/polygonizer/crystal-shine.js';
import { crystalRigFor, rigForScore } from './crystal-rig.js';

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
// clips ⇒ no row, byte-identical entity.
function locomotionFor(figures, figKey) {
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
  return {
    ...(idle ? { idle } : {}),
    ...(walk ? { walk } : {}),
    ...(boost ? { boost } : {}),
  };
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
    ledger.hud_declared = { count: hudWidgets.length, note: 'HUD widgets (slot / kind / banner / legend) ride score.json `hud` as data; the pack kernels paint their own default readout from `mechanics` until an engine arm reads the widget list' };
  }
  // Units: a kind authored in other-than-metres (the floorplan: feet) declares
  // `metersPerUnit`; the GLB root scales by it, so every positional field here scales
  // too — the score and the mesh agree in metres. Absent ⇒ every field byte-identical.
  const mpu = Number(payload.metersPerUnit);
  const unitScale = Number.isFinite(mpu) && mpu > 0 && mpu !== 1 ? mpu : null;
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
  // The contract tier (world-contract-tiers W1): what this payload DECLARES and what the next
  // tier would need — one ledger row every pack carries, so a missing declaration is read in
  // lib/ instead of found at the most expensive gate that happens to be open.
  const walkable = Boolean(payload.walk) || (payload.entities ?? []).some((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform');
  ledger.contract = contractLedgerEntry(assessWorldTier(payload, { walkable }));

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
    cameras: (levelCameras(payload) ?? []).map((c) => (unitScale ? { ...c, translation: sv(c.translation), znear: sn(c.znear), zfar: sn(c.zfar) } : c)),
    ...(lights.length ? { lights } : {}),
    // the sky DECLARATION (a preset name: day / night / dawn / dusk) so an engine rig can set its
    // sun, sky and fog to what the recipe said — the mesh never carried the backdrop
    // (sky_approximated). Absent a preset ⇒ no row, byte-identical.
    ...(typeof payload.sky?.preset === 'string' ? { sky: { preset: payload.sky.preset } } : {}),
    // the figure look (rim) as data — see ledger.look_declared. Absent ⇒ no key.
    ...(lookFigures.length ? { look: { figures: Object.fromEntries(lookFigures.map(([n, f]) => [n, { rim: f.rim }])) } } : {}),
    ...(Object.keys(crystals).length ? { crystals } : {}),
    ...(waterBodies.length ? { water } : {}),
    ...(cryRig ? { crystalLight: rigForScore(cryRig, unitScale || 1) } : {}),
    entities: (levelEntityNodes(payload) ?? []).map((e) => {
      const locomotion = locomotionFor(payload.figures, e.figure);
      const scaled = unitScale ? { ...e, translation: sv(e.translation) } : e;
      return locomotion ? { ...scaled, locomotion } : scaled;
    }),
    // declarative mechanics: `at` + `radius` on a zone, a pickup, a hazard are RECIPE units, so
    // they scale with the mesh (a kernel reads them as metres × 100). Absent a unit ⇒ untouched.
    mechanics: (manifest.game?.mechanics ?? []).map((m) => scaleMechanic(m, sv, sn)),
    // the HUD widget list (hud-widgets.js): slots / kinds / banners / legends as DATA, so an
    // engine arm can lay the readout out as authored. Absent rows ⇒ no key, byte-identical.
    ...(hudWidgets.length ? { hud: hudWidgets } : {}),
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
