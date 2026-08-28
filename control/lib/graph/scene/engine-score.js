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

const countOf = (x) => (Array.isArray(x) ? x.length : x ? 1 : 0);

export function extractEngineScore(sketch, payload) {
  const manifest = sketch?.manifest ?? {};
  const extras = levelSceneExtras(payload) ?? {};

  const ledger = {};
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
    spawn: extras['moj:spawn'] ?? [0, 0, 2],
    eye: payload.walk?.eye ?? 1.7,
    // The runtime's walk/controllable engines ground-snap on an IMPLICIT plane
    // at z=0 — the collider AABBs are obstacle hulls only, never the floor
    // (G1 finding: a promoted world without this plane is an infinite fall).
    ground: 0,
    colliders: payload.colliders ?? [],
    cameras: levelCameras(payload) ?? [],
    entities: levelEntityNodes(payload) ?? [],
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
