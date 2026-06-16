/**
 * create_carved_solid — mint a CARVED, METALIFIED solid (3D wordmark / logo /
 * icon) as a sketch. The carve-solid render primitive graduated onto the sketch
 * surface: persists with `kind: 'carved-solid'`; the /api/sketches/<ref>/svg
 * route dispatches on that discriminator to renderCarvedSolidToSvg (the same
 * pattern as manji-tree and painted-landscape). No new persistence layer.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { renderCarvedSolidToSvg, renderCarvedSolidFrames, carvedSolidIsAnimated } from '@/lib/graph/carved-solid';
import { encodeGif } from '@/lib/motion';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes/paths';

export async function createCarvedSolidHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_carved_solid requires { title, shape }');
  }
  const { title, shape, style, material, metal, inner, fx, camera, background, animate, ref, folder_ref: folderRef } = input;
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (!shape || typeof shape !== 'object' || (!shape.path && !shape.text)) {
    throw new Error('`shape` must be { path: "<svg d>" } or { text: "...", font?: "<ttf path>" }');
  }
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }

  const manifest = {
    kind: 'carved-solid',
    shape,
    ...(style !== undefined && style !== null ? { style } : {}),
    ...(material !== undefined && material !== null ? { material } : {}),
    ...(metal !== undefined && metal !== null ? { metal } : {}),
    ...(inner !== undefined && inner !== null ? { inner } : {}),
    ...(fx !== undefined && fx !== null ? { fx } : {}),
    ...(camera !== undefined && camera !== null ? { camera } : {}),
    ...(background !== undefined ? { background } : {}),
    title,
  };

  // Render once to validate (bad path / missing font / bad effect fail here,
  // not at view time).
  try { renderCarvedSolidToSvg(manifest); }
  catch (err) { throw new Error(`carved-solid render failed: ${err.message}`); }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  // Motion: an animated effect (electric / flame / ice / pulse glow) gets a
  // looping GIF rendered into the sketch's outcome folder for the viewer. Auto
  // when the manifest animates; `animate:false` skips, `animate:{frames,fps}` tunes.
  let gifUrl = null;
  const wantGif = animate === undefined ? carvedSolidIsAnimated(manifest) : (animate !== false);
  if (wantGif) {
    try {
      const frames = (typeof animate === 'object' && animate.frames) || 24;
      const fps = (typeof animate === 'object' && animate.fps) || 14;
      const dir = outcomeDirFor(sketch.ref);
      await fs.mkdir(dir, { recursive: true });
      await encodeGif(renderCarvedSolidFrames(manifest, frames), path.join(dir, 'motion.gif'), { width: 640, fps, bg: '#070a11', loop: 0 });
      gifUrl = `${outcomeUrlFor(sketch.ref)}motion.gif`;
    } catch (err) { /* GIF is a bonus; the still SVG already succeeded */ gifUrl = null; }
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    svgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/svg?inline=1`,
    ...(gifUrl ? { gifUrl } : {}),
  };
}

export function registerCarvedSolidTools() {
  registerTool({
    name: 'create_carved_solid',
    description:
      "Mint a CARVED, METALIFIED 3D solid from any vector outline — a chrome/gold wordmark, an extruded logo, a beveled icon. Reach for this on framing like \"3D metal logo / extruded chrome text / carved wordmark / beveled badge / metalify this shape\". The outline is EXTRUDED with a rounded bevel and shaded as smooth metal (vexar diffuse + a specular highlight); holes (letter counters, ring centres) carve through.\n\nTwo shape sources, one primitive:\n  • shape.path — an SVG path `d` string (M L H V C S Q T Z; arcs approximated). Any vector shape: logos, icons, symbols.\n  • shape.text — a string, carved from a font (any UTF-8 the font covers). Optional shape.font = a .ttf path (defaults to a system bold face).\n\nStyle knobs (all optional): depth (extrusion), bevel + bevelSteps (rounded edge), weight (bolder/thinner outline), blocky (grid-snap → chunky), slant (italic), tracking (text spacing).\n\nmaterial is a shading MODEL, not just a tint — metal is one family among many. Pass a preset name, a #rrggbb (a satin finish in that color), or an object { preset?, base?, ambient?, diffuse?, specular?, shininess?, emissive?, cel?, opacity? } to fine-tune. Presets: metallic (gold/steel/chrome/bronze/silver/copper/gunmetal); matte/non-metal (matte/plaster/stone/wood/rubber/plastic/satin); stylized (glass = translucent, neon = self-lit glow, cel = banded toon). (`metal` is a legacy alias for `material`.)\n\nThe look composes FOUR independent layers — name them and they stack:\n  • material — the surface finish (above).\n  • inner — luminosity ON the form, a SEPARATE layer from material: 'glow' | 'glow:<preset>' | { effect:'glow', preset?, ... }. glow presets: soft / neon / ember / rim / pulse.\n  • fx — outer effect(s) OUTSIDE the silhouette, each a generator routed along the contour: a string 'flame' | 'flame:engulf', an object { effect, preset?, pathing?, ... }, or an ARRAY of these. Effects: overgrow (vine/moss/ivy), electric (crackle/arc/storm/filament/snake/prowl/surge), ice (encase/shards/rime), flame (engulf/lick/blaze).\n  • camera: { yaw (deg, 3/4 view), fov }.\n\nMotion: animated effects (electric / flame / ice shimmer / pulse glow) automatically also render a looping GIF into the sketch's outcome folder (returned as gifUrl) — the motion viewer. `animate:false` skips it; `animate:{frames,fps}` tunes it.\n\nPersisted with kind `carved-solid`; the /api/sketches/<ref>/svg route renders the still SVG. Returns { ok, ref, url, svgUrl, gifUrl? }. (Contrast: flat diagrams/charts → create_sketch; a painterly terrain → create_painted_landscape; a manji-tree subject in motion → forge_motion.)",
    inputSchema: {
      type: 'object',
      required: ['title', 'shape'],
      properties: {
        title: { type: 'string', description: 'Title for the sketch.' },
        shape: {
          type: 'object',
          description: 'The vector outline. One of: { path } (SVG d string) or { text, font? }.',
          properties: {
            path: { type: 'string', description: 'An SVG path `d` string — any vector shape (logo/icon/symbol).' },
            text: { type: 'string', description: 'A string to carve from a font (any UTF-8 the font covers).' },
            font: { type: 'string', description: 'Optional .ttf path for text (defaults to a system bold face).' },
          },
        },
        style: {
          type: 'object',
          description: 'depth, bevel, bevelSteps, weight, blocky (grid-snap N), slant, tracking, curveSteps.',
          properties: {
            depth: { type: 'number' }, bevel: { type: 'number' }, bevelSteps: { type: 'integer' },
            weight: { type: 'number' }, blocky: { type: 'number' }, slant: { type: 'number' },
            tracking: { type: 'number' }, curveSteps: { type: 'integer' },
          },
        },
        material: { type: ['string', 'object'], description: 'Shading model. Preset name (gold/steel/chrome/bronze/silver/copper/gunmetal | matte/plaster/stone/wood/rubber/plastic/satin | glass/neon/cel), a #rrggbb, or an object { preset?, base?, ambient?, diffuse?, specular?, shininess?, emissive?, cel?, opacity? }.' },
        metal: { type: 'string', description: 'Legacy alias for `material` (a metallic preset or #rrggbb).' },
        inner: { type: ['string', 'object'], description: "Inner luminosity layer (separate from material): 'glow' | 'glow:<preset>' (soft/neon/ember/rim/pulse) | { effect:'glow', preset?, color?, emission?, rim?, bloom?, pulse? }." },
        fx: { type: ['string', 'object', 'array'], description: "Outer effect(s) routed along the contour: 'flame' | 'flame:engulf' | { effect, preset?, pathing?, ...overrides } | an array of these. Effects: overgrow / electric / ice / flame." },
        camera: { type: 'object', description: '{ yaw (deg), fov (deg) }.', properties: { yaw: { type: 'number' }, fov: { type: 'number' } } },
        background: { type: 'boolean', description: 'Dark grade behind the solid (default true; false → transparent).' },
        animate: { description: 'Motion GIF control. Omit → auto (GIF when the effect animates); false → still only; { frames, fps } → tune.' },
        ref: { type: 'string', description: 'Optional explicit sketch ref (1-64 chars [A-Za-z0-9_-]).' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createCarvedSolidHandler,
  });
}
