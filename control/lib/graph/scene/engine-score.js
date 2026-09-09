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
import { levelCameras, levelEntityNodes, levelSceneExtras } from './scene-gltf-level.js';
import { assessWorldTier, contractLedgerEntry } from '@/lib/graph/worlds/world-contract';

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
    cameras: (levelCameras(payload) ?? []).map((c) => (unitScale ? { ...c, translation: sv(c.translation), znear: sn(c.znear), zfar: sn(c.zfar) } : c)),
    ...(lights.length ? { lights } : {}),
    // the sky DECLARATION (a preset name: day / night / dawn / dusk) so an engine rig can set its
    // sun, sky and fog to what the recipe said — the mesh never carried the backdrop
    // (sky_approximated). Absent a preset ⇒ no row, byte-identical.
    ...(typeof payload.sky?.preset === 'string' ? { sky: { preset: payload.sky.preset } } : {}),
    entities: (levelEntityNodes(payload) ?? []).map((e) => {
      const locomotion = locomotionFor(payload.figures, e.figure);
      const scaled = unitScale ? { ...e, translation: sv(e.translation) } : e;
      return locomotion ? { ...scaled, locomotion } : scaled;
    }),
    // declarative mechanics: `at` + `radius` on a zone, a pickup, a hazard are RECIPE units, so
    // they scale with the mesh (a kernel reads them as metres × 100). Absent a unit ⇒ untouched.
    mechanics: (manifest.game?.mechanics ?? []).map((m) => scaleMechanic(m, sv, sn)),
    // The runtime's player seat (level-synth deriveLevelPlayer): first entity
    // with a walk/platform rule. Emitters hide its exported body — the
    // operator IS the walker; leaving it renders a body double at spawn.
    player: (payload.entities ?? []).find((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform')?.id ?? null,
    game: extras['moj:game'] ?? null,
    soundtrack: payload.audio?.soundtrack?.beatsRef ?? manifest.audio?.soundtrack?.beatsRef ?? null,
    ledger,
  };
}
