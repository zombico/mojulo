/**
 * create_painted_landscape — closed-vocabulary landscape minter.
 *
 * The model picks one named glyph per family (heartbeat, splatch, optional
 * structure-glyph) plus an optional seed string and light override; the
 * substrate resolves glyph → recipe, samples wave parameters within the
 * heartbeat's declared ranges, derives a balanced 4-stop palette from the
 * splatch's three seed colors, lays out structures via the structure-glyph's
 * seeded layout, and renders the scene back-to-front as a flat-Lambert,
 * borderless SVG.
 *
 * Persists with `manifest.kind === 'painted-landscape'`. The SVG route
 * dispatches on that discriminator to render via
 * `renderPaintedLandscapeToSvg`. No new persistence layer — painted
 * landscapes ride the sketch artifact system like manji-trees do.
 *
 * Token economy: ~30 tokens of authoring covers what would otherwise be
 * ~14K tokens of raw SVG or ~250 tokens of fully-specified manifest.
 * See `glyph-driven-landscape.spike.gen.test.js` for the measurement.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import {
  validatePaintedLandscape,
  heartbeatIds,
  splatchIds,
  structureGlyphIds,
  cameraIds,
  sceneIds,
  skyIds,
  computeSceneCompletion,
  HEARTBEATS,
  SPLATCHES,
  STRUCTURE_GLYPHS,
  CAMERAS,
  SCENES,
  SKIES,
  RENDER_STYLES,
} from '@/lib/graph/polygonizer/painted-landscape.js';

export function mintPaintedLandscape({
  title,
  heartbeat,
  splatch,
  structures,
  scene,
  seed,
  light,
  paletteOverrides,
  heartbeatOverrides,
  renderStyle,
  camera,
  sky,
  forest,
  ground,
  elevation,
  walk,
  extent,
  builds,
  ref,
  folderRef,
} = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folderRef` must be a non-empty string or null if provided');
    }
    const folder = SketchFolderRepository.getByRef(folderRef);
    if (!folder) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }

  const manifest = {
    kind: 'painted-landscape',
    heartbeat,
    splatch,
    ...(structures !== undefined && structures !== null ? { structures } : {}),
    ...(scene !== undefined && scene !== null ? { scene } : {}),
    ...(seed !== undefined && seed !== null ? { seed } : {}),
    ...(light !== undefined && light !== null ? { light } : {}),
    ...(paletteOverrides !== undefined && paletteOverrides !== null ? { paletteOverrides } : {}),
    ...(heartbeatOverrides !== undefined && heartbeatOverrides !== null ? { heartbeatOverrides } : {}),
    ...(renderStyle !== undefined && renderStyle !== null ? { renderStyle } : {}),
    ...(camera !== undefined && camera !== null ? { camera } : {}),
    ...(sky !== undefined && sky !== null ? { sky } : {}),
    ...(forest !== undefined && forest !== null ? { forest } : {}),
    ...(ground !== undefined && ground !== null ? { ground } : {}),
    ...(elevation !== undefined && elevation !== null ? { elevation } : {}),
    ...(walk !== undefined && walk !== null ? { walk } : {}),
    ...(extent !== undefined && extent !== null ? { extent } : {}),
    ...(builds !== undefined && builds !== null ? { builds } : {}),
    ...(title ? { title } : {}),
  };

  const errors = validatePaintedLandscape(manifest);
  if (errors.length) {
    throw new Error(`Invalid painted-landscape manifest:\n - ${errors.join('\n - ')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${enc}`,
    svgUrl: `/api/sketches/${enc}/svg?inline=1`,
    worldUrl: `/api/sketches/${enc}/world`,                        // live three.js polygon world
    raymarchUrl: `/api/sketches/${enc}/world?render=raymarch`,     // per-pixel raymarch (terrain/water/sky)
    ...(scene ? { completion: computeSceneCompletion(scene) } : {}),
  };
}

export async function createPaintedLandscapeHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_painted_landscape requires { title, heartbeat, splatch }');
  }
  const {
    title,
    heartbeat,
    splatch,
    structures,
    scene,
    seed,
    light,
    paletteOverrides,
    heartbeatOverrides,
    renderStyle,
    camera,
    sky,
    forest,
    ground,
    elevation,
    walk,
    extent,
    builds,
    ref,
    folder_ref: folderRef,
  } = input;
  return mintPaintedLandscape({
    title, heartbeat, splatch, structures, scene, seed, light,
    paletteOverrides, heartbeatOverrides, renderStyle, camera, sky, forest, ground, elevation, walk, extent, builds, ref, folderRef,
  });
}

function heartbeatCatalogue() {
  return Object.entries(HEARTBEATS)
    .map(([id, recipe]) => {
      const engine = recipe.engine || 'sine-stack';
      return `  • ${id} [${engine}] — ${recipe.intent} (aliases: ${recipe.aliases.join(', ')})`;
    })
    .join('\n');
}
function splatchCatalogue() {
  return Object.entries(SPLATCHES)
    .map(([id, s]) => `  • ${id} — ${s.intent} (seeds: ${s.seeds.join(', ')})`)
    .join('\n');
}
function structureCatalogue() {
  return Object.entries(STRUCTURE_GLYPHS)
    .map(([id, g]) => `  • ${id} — ${g.intent}`)
    .join('\n');
}
function cameraCatalogue() {
  return Object.entries(CAMERAS)
    .map(([id, c]) => `  • ${id} — ${c.intent} (aliases: ${c.aliases.join(', ')})`)
    .join('\n');
}
function skyCatalogue() {
  return Object.entries(SKIES)
    .map(([id, s]) => `  • ${id} — ${s.intent} (aliases: ${s.aliases.join(', ')})`)
    .join('\n');
}
function sceneCatalogue() {
  return Object.entries(SCENES)
    .map(([id, s]) => {
      const total = ['near', 'mid', 'far'].reduce(
        (sum, band) => sum + (s.fill[band] || []).reduce((t, e) => t + e.count, 0), 0,
      );
      const affinity = [
        s.affinity?.heartbeats?.length ? `heartbeats: ${s.affinity.heartbeats.join('/')}` : '',
        s.affinity?.splatches?.length ? `splatches: ${s.affinity.splatches.join('/')}` : '',
      ].filter(Boolean).join('; ');
      return `  • ${id} — ${s.intent} (${total} fill items${affinity ? `; affinity ${affinity}` : ''})`;
    })
    .join('\n');
}
