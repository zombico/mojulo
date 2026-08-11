/**
 * create_controllable_world — mint a LIVE, INTERACTIVE world from a tiny recipe (the unified
 * "control a thing in a world" primitive; see control/lib/graph/controllable-world.plan.md).
 *
 * Fractal-generation philosophy, same as create_fractal_city: the operator passes a recipe (a stage +
 * a list of ENTITIES); the substrate stores ONLY that recipe (`kind: 'controllable'`) — no geometry,
 * no baked figure frames. The full traversable world is regenerated deterministically on render at
 * `/api/sketches/<ref>/world` (figure bodies are baked from their spec at resolve time).
 *
 * An entity = a transform + a RULE that updates it each frame + a BODY. The CAMERA is just an entity.
 * Rules: glide (free flight) · walk (ground-locked, tank-steer, drives a gait) · follow (chase camera)
 * · clock (autonomous frame playback) · static. Bodies: mesh (sphere/box) · figure-frames (a baked
 * human figure) · none.
 *
 * Stored manifest: { kind:'controllable', entities, camera?, figures?, ground?|faces?, worldFraming?, … }
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { assembleControllableScene } from '@/lib/graph/worlds/controllable-world';
import { applyMapRef } from '@/lib/graph/worlds/map-ref';
import { composeMatchLevel, lightenMatchLevel, MATCH_MODES } from '@/lib/graph/worlds/match-modes';
import { synthesizeLevel } from '@/lib/graph/game/level-synth';
import { validateLevelContract } from '@/lib/graph/game/level-contract';

// 'ai' is the engine's autonomous-combatant rule (seat brains — target policy, boost/juke); the
// match-mode builders author it and an operator may hand-place one beside their pilotable bodies.
const KNOWN_RULES = new Set(['glide', 'walk', 'platform', 'drive', 'fly', 'follow', 'clock', 'static', 'ai']);

export function mintControllableWorld({ title, entities, camera, figures, faces, textures, ground, worldFraming, viewBox, bg, game, mapRef, match, ref, folderRef } = {}) {
  if (match == null && (!Array.isArray(entities) || entities.length === 0)) {
    throw new Error('create_controllable_world requires a non-empty `entities` array (or a `match` channel, which authors the seats)');
  }
  // mapRef (worlds/map-ref.js): mint a LIGHT level that INHERITS terrain from a stored map world
  // instead of carrying faces of its own — the way to mint N level variants over ONE map (one map
  // row, N light levels; the arena's mode × map matrix is the worked example). The stored manifest
  // keeps only this level's own keys + the ref; world-scene.js merges the map underneath at resolve.
  let mapManifest = null;
  if (mapRef != null) {
    if (typeof mapRef !== 'string' || !mapRef.trim()) throw new Error('`mapRef` must be a sketch ref string');
    const src = SketchRepository.getByRef(mapRef);
    if (!src?.manifest) throw new Error(`mapRef '${mapRef}' does not exist — mint the map world first`);
    if (src.manifest.kind !== 'controllable') {
      throw new Error(`mapRef '${mapRef}' is kind '${src.manifest.kind}' — terrain inheritance needs a stored controllable world`);
    }
    mapManifest = src.manifest;
  }
  let manifest;
  if (match != null) {
    // match channel (match-modes.plan.md M4): mint this world AS a scored match level — the mode
    // builder (worlds/match-modes.js) authors the seats (every pilotable roster body as a pilot
    // option + the mode's AI combatants), the match layer (killTarget / respawn ring / drop-in /
    // fire-guard) and the level contract, all derived from the MAP's own roster. Stored in the
    // light form (mapRef + the mode's output).
    if (typeof match !== 'object' || typeof match.mode !== 'string') {
      throw new Error(`\`match\` must be an object naming a \`mode\` — one of: ${Object.keys(MATCH_MODES).join(', ')}`);
    }
    if (!mapManifest) throw new Error('`match` requires `mapRef` — the mode authors its seats from the map\'s pilotable roster');
    if (!ref) throw new Error('`match` requires an explicit `ref` — the synthesized level contract names it (levelRef)');
    const clash = Object.entries({ entities, game, figures, faces, ground, camera })
      .filter(([, v]) => v != null).map(([k]) => k);
    if (clash.length) {
      throw new Error(`\`match\` authors the level itself — drop: ${clash.join(', ')} (seats, contract and camera derive from the mode + the map)`);
    }
    const { mode, space = false, killTarget, rivals, teamNames, allyCount, foeCount, side } = match;
    const full = composeMatchLevel(mode, mapManifest, {
      ref, title: title || `${mode} · ${mapManifest.title || mapRef}`, space,
      killTarget, rivals, teamNames, allyCount, foeCount, side,
    });
    manifest = lightenMatchLevel(full, mapRef);
  } else {
    manifest = {
      kind: 'controllable',
      ...(mapManifest ? { mapRef } : {}),
      entities,
      ...(camera && typeof camera === 'object' && camera.rule ? { camera } : {}),
      ...(figures && typeof figures === 'object' ? { figures } : {}),
      ...(Array.isArray(faces) && faces.length ? { faces } : {}),
      // custom face-texture atlas ({ key: dataURL }) that pairs with faces carrying `texture:'<key>'` + `uv`.
      // world-scene.js merges this into payload.textures; scene-three emits it as TEXTURES. Procedural
      // surface-textures.js keys self-resolve via collectFaceTextures and need no entry here — this is the
      // channel for CUSTOM PNG tiles (image-worker bound / hand-authored dataURLs). Absent → untouched.
      ...(textures && typeof textures === 'object' && Object.keys(textures).length ? { textures } : {}),
      ...(ground && typeof ground === 'object' ? { ground } : {}),
      ...(worldFraming && typeof worldFraming === 'object' ? { worldFraming } : {}),
      ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
      ...(bg ? { bg } : {}),
      ...(title ? { title } : {}),
      ...(game && typeof game === 'object' ? { game } : {}),
    };
  }

  // validate the recipe is renderable (no geometry persisted beyond the recipe itself). A mapRef
  // level validates in its MERGED form — the stage and any figure references may live on the map.
  const effective = mapManifest ? applyMapRef(manifest, mapManifest) : manifest;
  assembleControllableScene(effective, {});   // throws if the stage is malformed

  // GAME channel (game-mechanics.plan.md M1/M4): a level = a world minted WITH its contract.
  // Mechanics-authored channels lower through the same synthesizeLevel seam world-scene uses at
  // render/resolve (throws on malformed verbs); hand-authored contracts validate structurally.
  // The store isn't known here — create_game re-validates the contract against the actual store.
  if (manifest.game) {
    if (Array.isArray(manifest.game.mechanics) && manifest.game.mechanics.length) {
      synthesizeLevel(manifest);
    } else {
      const v = validateLevelContract(manifest.game);
      if (!v.ok) throw new Error(`game channel is invalid:\n${v.errors.join('\n')}`);
    }
  }
  const figNames = new Set(Object.keys(effective.figures || {}));
  for (const e of manifest.entities) {
    if (!e || typeof e !== 'object') throw new Error('each entity must be an object');
    const rt = e.rule && e.rule.type;
    if (rt && !KNOWN_RULES.has(rt)) throw new Error(`entity '${e.id || '?'}' has unknown rule '${rt}' (known: ${[...KNOWN_RULES].join(', ')})`);
    if (e.body && e.body.type === 'figure-frames' && !figNames.has(e.body.figure)) {
      throw new Error(`entity '${e.id || '?'}' references figure '${e.body.figure}' which is not declared in figures{}`);
    }
  }
  if (camera && camera.target && !manifest.entities.some((e) => e.id === camera.target)) {
    throw new Error(`camera target '${camera.target}' is not an entity id`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || manifest.title || 'controllable world', manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${enc}/world`,
    url: `/sketches/${enc}`,
    recipe: manifest,
    stats: {
      entities: manifest.entities.length,
      rules: manifest.entities.map((e) => e.rule && e.rule.type).filter(Boolean),
      camera: manifest.camera && manifest.camera.rule ? manifest.camera.rule : (camera && camera.rule ? camera.rule : null),
      figures: [...figNames],
      ...(match ? { match: { mode: match.mode, killTarget: manifest.match.killTarget, seats: manifest.entities.map((e) => e.seat).filter(Boolean) } } : {}),
      ...(manifest.mapRef ? { mapRef: manifest.mapRef } : {}),
      nonBakeable: true,
    },
  };
}

export async function createControllableWorldHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_controllable_world requires a recipe object');
  const { title, entities, camera, figures, faces, textures, ground, worldFraming, viewBox, bg, game, mapRef, map_ref, match, ref, folder_ref: folderRef } = input;
  return mintControllableWorld({ title, entities, camera, figures, faces, textures, ground, worldFraming, viewBox, bg, game, mapRef: mapRef ?? map_ref, match, ref, folderRef });
}
