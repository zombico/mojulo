/**
 * sprite-sheet tools — the bridge between the image-worker handoff loop and the
 * pixelizer's 2D sprite substrate (sprite-sheet.plan.md).
 *
 * A sprite sheet is NOT new machinery: it is a `kind:'sprite-sheet'` image-outcomes
 * manifest (director recipe) whose per-frame render targets ride the existing,
 * kind-agnostic handoff loop (request_image_render → pull → submit → accept). Once
 * every frame is accepted, `bake_sprite_sheet` quantizes each painted cell DOWN
 * into a pixelizer {size,palette,cells} raster (quantize.js) under ONE shared
 * palette — the sovereign sprite payload, written back onto the sketch's manifest
 * as `baked`, re-derivable from the archived source PNGs.
 *
 * Two tools, one loop:
 *   create_sprite_sheet  — mint the director recipe (frames + grid + bake spec).
 *   bake_sprite_sheet    — turn the accepted frame PNGs into pixelizer sprites.
 * Everything between (request/pull/submit/accept) is the shared render-handoff.
 */

import sharp from 'sharp';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GameProjectRepository, GameProjectMemberRepository } from '@/lib/db/repositories/game-projects';
import { RenderRequestRepository } from '@/lib/db/repositories/render-requests';
import { boundRenderMap } from '@/lib/graph/image-outcomes/render-store';
import {
  normalizeSpriteSheetManifest,
  renderTargets,
  parseSpriteTarget,
} from '@/lib/graph/image-outcomes/manifest';
import { jointPalette, quantizeRgba, diffRasters } from '@/lib/graph/pixelizer/quantize';

// sharp → the raw RGBA the quantize primitives expect (4 bytes/pixel, alpha
// preserved so a transparent sprite background knocks out to '.' cells).
async function decodeRgba(absPath) {
  const { data, info } = await sharp(absPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function createSpriteSheetHandler(input) {
  const {
    title, intent, frames, register, cell, cols, gutter, bake, characters, renderBrief,
    ref, project_ref: projectRef,
  } = input && typeof input === 'object' ? input : {};

  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (projectRef !== undefined && projectRef !== null) {
    if (typeof projectRef !== 'string' || !projectRef) throw new Error('`project_ref` must be a non-empty gp_ ref if provided');
    if (!GameProjectRepository.getByRef(projectRef)) {
      throw new Error(`Game project '${projectRef}' not found — create_game_project first, or list_game_projects to find it`);
    }
  }

  let manifest;
  try {
    manifest = normalizeSpriteSheetManifest({
      kind: 'sprite-sheet', title, intent, frames, register, cell, cols, gutter, bake, characters, renderBrief,
    });
  } catch (err) {
    throw new Error(`Invalid sprite-sheet: ${err.message}`);
  }
  const sketch = SketchRepository.create({ title: manifest.title, manifest, ref });

  let project = null;
  if (projectRef) {
    // A sprite sheet is graphic art in a game's project (the `graphic` member role).
    GameProjectMemberRepository.bind({ projectRef, memberRef: sketch.ref, role: 'graphic' });
    project = { ref: projectRef, url: `/games/${encodeURIComponent(projectRef)}` };
  }

  return {
    ok: true,
    ref: sketch.ref,
    kind: 'sprite-sheet',
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    frames: manifest.frames.map((f) => f.id),
    targets: renderTargets(manifest),
    ...(project ? { project } : {}),
    next:
      `Paint the sprites: call request_image_render { ref: '${sketch.ref}' } to park a durable render `
      + 'request per frame, then run the pull/submit/accept loop (image worker). Once every frame is '
      + `accepted, call bake_sprite_sheet { ref: '${sketch.ref}' } to quantize them into pixelizer sprites.`,
  };
}

export async function bakeSpriteSheetHandler(input) {
  const { ref, tolerance } = input && typeof input === 'object' ? input : {};
  if (!ref || typeof ref !== 'string') throw new Error('bake_sprite_sheet requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (sketch.manifest?.kind !== 'sprite-sheet') {
    throw new Error(`Sketch '${ref}' is kind '${sketch.manifest?.kind}', not a sprite-sheet. Mint one with create_sprite_sheet.`);
  }
  const manifest = normalizeSpriteSheetManifest(sketch.manifest);
  const targets = renderTargets(manifest); // frame-<id>, base first

  // Eyes gate: bake only from ACCEPTED frames (the render-handoff accept step).
  const accepted = new Set(
    RenderRequestRepository.listByRef(ref).filter((r) => r.status === 'accepted').map((r) => r.target),
  );
  const bound = boundRenderMap(ref, targets); // { target: { n, path } } on disk
  const missing = targets.filter((t) => !accepted.has(t) || !bound[t]);
  if (missing.length) {
    throw new Error(
      `Cannot bake — ${missing.length} frame(s) are not yet accepted with a bound render: ${missing.join(', ')}. `
      + 'Finish the request_image_render → pull → submit → accept loop for each frame first '
      + `(get_image_render_packet { ref: '${ref}' } restates the loop).`,
    );
  }

  const [gw, gh] = manifest.bake.grid;
  const budget = manifest.bake.budget;
  const grid = [gw, gh];

  // Decode every accepted cell, then pin ONE palette over all of them so a color
  // a single pose introduces still earns a slot and cell diffs mean pixel change,
  // never palette drift (the same discipline as pixel-actor's bakeActor).
  const baseFrame = manifest.frames.find((f) => f.base);
  const baseTarget = `frame-${baseFrame.id}`;
  const decoded = {};
  for (const frame of manifest.frames) {
    const target = `frame-${frame.id}`;
    decoded[frame.id] = await decodeRgba(bound[target].path);
  }
  const palette = jointPalette(Object.values(decoded), { grid, budget });

  const sprites = {};
  const provenance = {};
  const changedRatios = {};
  const base = quantizeRgba(decoded[baseFrame.id].data, decoded[baseFrame.id].width, decoded[baseFrame.id].height, { grid, palette });
  for (const frame of manifest.frames) {
    const d = decoded[frame.id];
    const raster = frame.base ? base : quantizeRgba(d.data, d.width, d.height, { grid, palette });
    sprites[frame.id] = raster;
    const target = `frame-${frame.id}`;
    provenance[frame.id] = { target, n: bound[target].n, grid, budget };
    if (!frame.base) {
      // Alignment health vs the base (meru-lock signal): a small changedRatio
      // means the poses register cleanly; a large one flags a drifted frame.
      const diff = diffRasters(base, raster, { tolerance: Number.isFinite(tolerance) ? tolerance : 32 });
      changedRatios[frame.id] = diff ? diff.changedRatio : 0;
    }
  }

  const baked = {
    register: manifest.register,
    grid,
    budget,
    base: baseFrame.id,
    palette,
    sprites,
    provenance,
    changedRatios,
  };
  // Write the sovereign sprite payload back onto the recipe (preserved across
  // re-normalization). The recipe stays re-derivable from the archived cell PNGs.
  SketchRepository.update({ ref: sketch.ref, manifest: { ...sketch.manifest, baked } });

  return {
    ok: true,
    ref: sketch.ref,
    register: manifest.register,
    grid,
    frames: manifest.frames.map((f) => f.id),
    base: baseFrame.id,
    paletteSize: palette.length,
    changedRatios,
    next:
      'The baked pixelizer sprites now ride the sketch manifest as `baked.sprites` '
      + '({size,palette,cells} per frame). A pixelizer game can consume them by ref '
      + '(see sprite-sheet.plan.md P2). Inspect them via get_sketch / the /sketches page.',
  };
}

export function registerSpriteSheetTools() {
  registerTool({
    name: 'create_sprite_sheet',
    description:
      'Mint a 2D game SPRITE SHEET as a director recipe, painted by your image worker. Declares `frames` '
      + "(one per pose/direction — e.g. idle, walk-1, walk-2, jump; one is the `base`) laid out on a grid; "
      + 'each frame becomes a per-frame render target on the shared image-render handoff loop. Then run '
      + 'request_image_render → pull → submit → accept per frame, and bake_sprite_sheet quantizes the '
      + 'accepted cells into pixelizer {size,palette,cells} sprites. Reach for "make a sprite sheet for my '
      + '2D game", "sprite atlas for a walking character". `project_ref` binds it as a game project\'s graphic art.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Sprite sheet title (e.g. "Hero — walk cycle").' },
        intent: { type: 'string', description: 'Optional one-line intent.' },
        frames: {
          type: 'array',
          description: 'The sprites to paint. Each: { action (required, e.g. "idle"/"walk-1"), direction?, id?, base?, note? }. Exactly one frame may set base:true (defaults to the first) — the canonical pose every other frame is measured against.',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'What the sprite is doing (idle, walk-1, walk-2, jump, hit…).' },
              direction: { type: 'string', description: 'Optional facing (e.g. "east", "south").' },
              id: { type: 'string', description: 'Optional stable frame id (lowercase kebab); defaults to action[-direction].' },
              base: { type: 'boolean', description: 'Mark this the base frame (exactly one; defaults to the first).' },
              note: { type: 'string' },
            },
            required: ['action'],
          },
        },
        register: { type: 'string', enum: ['8bit', '16bit', '32bit'], description: 'Palette budget era (colors + transparent per sprite): 8bit=3, 16bit=15 (default), 32bit=61.' },
        cell: { type: 'object', description: 'Painted pixel size per cell { width, height } (default 96×96).' },
        cols: { type: 'integer', description: 'Grid columns (default ceil(sqrt(frames))).' },
        gutter: { type: 'integer', description: 'Transparent px between cells (default 8).' },
        bake: { type: 'object', description: 'Bake spec { grid: [w, h] } — the pixelizer cell resolution each frame is quantized into (default 16×16).' },
        characters: { type: 'array', description: 'Optional identity lock: [{ id, description, name?, rig?, ref? }] — the sprite\'s design held across every frame (same shape as keyframe-animation/sequential-art).' },
        renderBrief: { type: 'object', description: 'Optional style lock (preset / fork / custom) for the painted look.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        project_ref: { type: 'string', description: "Optional gp_… ref: binds as the project's graphic art." },
      },
      required: ['title', 'frames'],
    },
    handler: createSpriteSheetHandler,
  });

  registerTool({
    name: 'bake_sprite_sheet',
    description:
      'Bake an accepted sprite sheet into pixelizer sprites — the finish step of the sprite-sheet loop. '
      + 'Requires every frame accepted via the image-render handoff (request/pull/submit/accept). Quantizes '
      + 'each painted cell into a {size,palette,cells} raster under ONE shared palette (with per-frame '
      + 'alignment health vs the base), and writes the sovereign sprite payload back onto the sketch as '
      + '`baked.sprites`. Reach for "bake the sprite sheet", "turn the painted sprites into pixels".',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The sprite-sheet sketch ref (from create_sprite_sheet).' },
        tolerance: { type: 'integer', description: 'Cell-diff tolerance for the alignment-health check vs the base (default 32).' },
      },
      required: ['ref'],
    },
    handler: bakeSpriteSheetHandler,
  });
}
