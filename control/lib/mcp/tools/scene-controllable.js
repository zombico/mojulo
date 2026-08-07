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
import { synthesizeLevel } from '@/lib/graph/game/level-synth';
import { validateLevelContract } from '@/lib/graph/game/level-contract';

const KNOWN_RULES = new Set(['glide', 'walk', 'platform', 'drive', 'fly', 'follow', 'clock', 'static']);

export function mintControllableWorld({ title, entities, camera, figures, faces, textures, ground, worldFraming, viewBox, bg, game, ref, folderRef } = {}) {
  if (!Array.isArray(entities) || entities.length === 0) {
    throw new Error('create_controllable_world requires a non-empty `entities` array');
  }
  const manifest = {
    kind: 'controllable',
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

  // validate the recipe is renderable (no geometry persisted beyond the recipe itself).
  assembleControllableScene(manifest, {});   // throws if the stage is malformed

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
  const figNames = new Set(Object.keys(manifest.figures || {}));
  for (const e of entities) {
    if (!e || typeof e !== 'object') throw new Error('each entity must be an object');
    const rt = e.rule && e.rule.type;
    if (rt && !KNOWN_RULES.has(rt)) throw new Error(`entity '${e.id || '?'}' has unknown rule '${rt}' (known: ${[...KNOWN_RULES].join(', ')})`);
    if (e.body && e.body.type === 'figure-frames' && !figNames.has(e.body.figure)) {
      throw new Error(`entity '${e.id || '?'}' references figure '${e.body.figure}' which is not declared in figures{}`);
    }
  }
  if (camera && camera.target && !entities.some((e) => e.id === camera.target)) {
    throw new Error(`camera target '${camera.target}' is not an entity id`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || 'controllable world', manifest, ref, folderRef: folderRef ?? null });
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
      entities: entities.length,
      rules: entities.map((e) => e.rule && e.rule.type).filter(Boolean),
      camera: camera && camera.rule ? camera.rule : null,
      figures: [...figNames],
      nonBakeable: true,
    },
  };
}

export async function createControllableWorldHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_controllable_world requires a recipe object');
  const { title, entities, camera, figures, faces, textures, ground, worldFraming, viewBox, bg, game, ref, folder_ref: folderRef } = input;
  return mintControllableWorld({ title, entities, camera, figures, faces, textures, ground, worldFraming, viewBox, bg, game, ref, folderRef });
}
