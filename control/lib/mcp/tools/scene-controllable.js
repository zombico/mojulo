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
import { registerTool } from '@/lib/mcp/server';
import { assembleControllableScene } from '@/lib/graph/controllable-world';

const KNOWN_RULES = new Set(['glide', 'walk', 'follow', 'clock', 'static']);

export function mintControllableWorld({ title, entities, camera, figures, faces, ground, worldFraming, viewBox, bg, ref, folderRef } = {}) {
  if (!Array.isArray(entities) || entities.length === 0) {
    throw new Error('create_controllable_world requires a non-empty `entities` array');
  }
  const manifest = {
    kind: 'controllable',
    entities,
    ...(camera && typeof camera === 'object' && camera.rule ? { camera } : {}),
    ...(figures && typeof figures === 'object' ? { figures } : {}),
    ...(Array.isArray(faces) && faces.length ? { faces } : {}),
    ...(ground && typeof ground === 'object' ? { ground } : {}),
    ...(worldFraming && typeof worldFraming === 'object' ? { worldFraming } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(bg ? { bg } : {}),
    ...(title ? { title } : {}),
  };

  // validate the recipe is renderable (no geometry persisted beyond the recipe itself).
  assembleControllableScene(manifest, {});   // throws if the stage is malformed
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
  const { title, entities, camera, figures, faces, ground, worldFraming, viewBox, bg, ref, folder_ref: folderRef } = input;
  return mintControllableWorld({ title, entities, camera, figures, faces, ground, worldFraming, viewBox, bg, ref, folderRef });
}

export function registerSceneControllableTools() {
  registerTool({
    name: 'create_controllable_world',
    description:
      "Mint a LIVE, INTERACTIVE world the user can DRIVE — the unified 'control a thing in a world' "
      + "primitive (a person you walk, a drone you fly, a self-playing figure). Stores ONLY a tiny recipe "
      + "(`kind: 'controllable'`); the traversable world regenerates deterministically on render at "
      + "`/api/sketches/<ref>/world` (open it / embed it). Reach for this on framing like 'let me walk a "
      + "character through X', 'fly a drone through the city', 'a controllable / playable / first-person "
      + "world', 'move a thing around a scene'. NOT for a static look-at scene — that's create_fractal_city "
      + "/ create_sketch.\n\n"
      + "The world is a list of ENTITIES. An entity = a transform + a RULE (how it moves each frame) + a "
      + "BODY (what it looks like). The CAMERA is just an entity too.\n"
      + "Rules: `glide` (free flight, momentum, no gravity — drones/spectator), `walk` (ground-locked, "
      + "W/S move + A/D turn, drives a walk-cycle gait), `follow` (a chase camera slaved to a target "
      + "entity), `clock` (autonomous frame playback — a self-walking figure), `static`.\n"
      + "Bodies: `mesh` ({shape:'box'|'sphere', size|radius, color}), `figure-frames` ({figure:<name>} — a "
      + "baked human figure declared in `figures`), `none` (invisible — e.g. a first-person camera entity).\n"
      + "Controls in the rendered world: W/S move, A/D turn, Q/E strafe, Space/Shift up-down (glide), "
      + "mouse-drag to look; a clock world plays itself under orbit.\n"
      + "Because input makes it path-dependent the world is non-bakeable (the /svg + /scene tiers show only "
      + "its initial frame); /world is the live tier.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        entities: {
          type: 'array',
          description: "The things in the world (at least one). Each: { id, transform:{ pos:[x,y,z], heading?, pitch? }, rule:{ type, ...params }, body:{ type, ...} }. z is up; heading is yaw in radians. Rule params — walk: { speed, turn, stride }; glide: { accel, maxSpeed, damping }; follow: { target:<entity id>, dist, height, shoulder, lead, lerp }; clock: { rate } (cycles/sec). Body — mesh: { shape:'box'|'sphere', size:[w,d,h] or radius, color }; figure-frames: { figure:<name declared in figures> }.",
          items: { type: 'object' },
          minItems: 1,
        },
        camera: { type: 'object', description: "Optional camera entity (sugar). { rule:'follow'|'glide'|'orbit', target?:<entity id>, dist?, height?, shoulder?, lead?, lerp? }. With a `follow` rule + target it trails that entity (over-the-shoulder); omit entirely to keep the default mouse OrbitControls (good for a `clock` turntable)." },
        figures: { type: 'object', description: "Optional map of name → baked-figure SPEC, e.g. { male: { motion:'walk', proto:'male', frames:24 } }. A `figure-frames` body references one by name. Baked at render time via renderFigureWorldFrames, so the manifest stays a recipe (no geometry stored). `proto`: 'male'|'female'; `motion`: e.g. 'walk'." },
        faces: { type: 'array', description: 'Optional explicit static world geometry as baked face quads ({ corners:[[x,y,z]×4], fill, doubleSided? }). Omit to get the default checker floor (see `ground`).', items: { type: 'object' } },
        ground: { type: 'object', description: 'Optional default-floor spec when `faces` is omitted: { size, cell, colorA, colorB }. Builds a 2-tone checker plane at z=0.' },
        worldFraming: { type: 'object', description: 'Optional initial camera framing { cameraPosition:[x,y,z], lookAt:[x,y,z], horizontalFov }. A follow/orbit camera then takes over each frame.' },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height } (default 1120×780).' },
        bg: { type: 'string', description: 'Optional background color (default #0b1220).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['entities'],
    },
    handler: createControllableWorldHandler,
  });
}
