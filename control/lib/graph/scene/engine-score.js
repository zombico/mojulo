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

export const MOJULO_UNITS = '1 mojulo unit = 1 meter';

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

  return {
    ref: sketch?.ref ?? null,
    title: payload.title ?? manifest.title ?? sketch?.ref ?? 'mojulo world',
    kind: manifest.kind ?? null,
    frame: 'z-up',
    units: MOJULO_UNITS,
    // present only when declared — an unstamped score is byte-identical to pre-seam output
    ...(declared ? { posture: declared } : {}),
    spawn: extras['moj:spawn'] ?? [0, 0, 2],
    eye: payload.walk?.eye ?? 1.7,
    // The runtime's walk/controllable engines ground-snap on an IMPLICIT plane
    // at z=0 — the collider AABBs are obstacle hulls only, never the floor
    // (G1 finding: a promoted world without this plane is an infinite fall).
    ground: 0,
    // surface/atlas texture keys riding the payload (skin-over-mesh.plan.md
    // phase 3): the GLB embeds them (TEXCOORD_0 + PNG), so engine packs CARRY
    // them — the ledger states it. Absent textures ⇒ no key, byte-identical.
    ...(payload.textures && Object.keys(payload.textures).length
      ? { textures: Object.keys(payload.textures).sort() } : {}),
    colliders: payload.colliders ?? [],
    cameras: levelCameras(payload) ?? [],
    entities: (levelEntityNodes(payload) ?? []).map((e) => {
      const locomotion = locomotionFor(payload.figures, e.figure);
      return locomotion ? { ...e, locomotion } : e;
    }),
    mechanics: manifest.game?.mechanics ?? [],
    // The runtime's player seat (level-synth deriveLevelPlayer): first entity
    // with a walk/platform rule. Emitters hide its exported body — the
    // operator IS the walker; leaving it renders a body double at spawn.
    player: (payload.entities ?? []).find((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform')?.id ?? null,
    game: extras['moj:game'] ?? null,
    soundtrack: payload.audio?.soundtrack?.beatsRef ?? manifest.audio?.soundtrack?.beatsRef ?? null,
    ledger,
  };
}
