/**
 * create_workbench — mint a measured OBJECT vantage from a polygomer of lathe monomers.
 *
 * The object-scale sibling of create_fractal_city / create_transportation_hub: instead of a
 * traversable environment, it renders ONE everyday object (built by bonding primitive solids — a
 * candlestick = foot+stem+cup, a bottle, a dumbbell = bar+two bells) on a measured grid at literal
 * scale, for FORM accuracy. Fractal-generation path: the manifest stores ONLY the monomer recipe
 * (no geometry); the object is regenerated deterministically on render and served at
 * /api/sketches/<ref>/world (traversable three.js orbit) and /scene (preset CSS-3D shots).
 *
 * Stored manifest: { kind:'workbench', lathes:[ <lathe spec> … ], units?, viewBox?, title? }.
 *
 * Design: control/lib/graph/workbench.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planWorkbench } from '@/lib/graph/workbench';
import { lowerAssembly } from '@/lib/graph/polygonizer/workbench-assembly';
import { warmScenePng } from '@/lib/graph/scene-png-warm';

export function mintWorkbench({ title, lathes, extrudes, sweeps, reliefs, assembly, units, viewBox, ref, folderRef } = {}) {
  // Relative composition: an `assembly` declares parts by size + how they connect; lower it to
  // absolute monomers and merge with any explicit arrays (e.g. an assembled body + a hand-placed sweep).
  let baseLathes = Array.isArray(lathes) ? lathes : [];
  let baseExtrudes = Array.isArray(extrudes) ? extrudes : [];
  if (assembly && typeof assembly === 'object') {
    const lowered = lowerAssembly(assembly);
    baseLathes = [...lowered.lathes, ...baseLathes];
    baseExtrudes = [...lowered.extrudes, ...baseExtrudes];
  }
  const hasLathes = baseLathes.length > 0;
  const hasExtrudes = baseExtrudes.length > 0;
  const hasSweeps = Array.isArray(sweeps) && sweeps.length > 0;
  const hasReliefs = Array.isArray(reliefs) && reliefs.length > 0;
  if (!hasLathes && !hasExtrudes && !hasSweeps && !hasReliefs) {
    throw new Error('Provide at least one monomer — a non-empty `lathes`, `extrudes`, `sweeps`, `reliefs`, or `assembly` (the polygomer).');
  }
  const manifest = {
    kind: 'workbench',
    ...(hasLathes ? { lathes: baseLathes } : {}),
    ...(hasExtrudes ? { extrudes: baseExtrudes } : {}),
    ...(hasSweeps ? { sweeps } : {}),
    ...(hasReliefs ? { reliefs } : {}),
    ...(typeof units === 'string' ? { units } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Lower once to validate the recipe is renderable + return a size/face readout (no geometry stored).
  const { stats } = planWorkbench(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `workbench · ${stats.monomers} monomer${stats.monomers === 1 ? '' : 's'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
  };
}

export async function createWorkbenchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_workbench requires a recipe object with a `lathes` array');
  }
  const { title, lathes, extrudes, sweeps, reliefs, assembly, units, viewBox, ref, folder_ref: folderRef } = input;
  return mintWorkbench({ title, lathes, extrudes, sweeps, reliefs, assembly, units, viewBox, ref, folderRef });
}

export function registerWorkbenchTools() {
  registerTool({
    name: 'create_workbench',
    description:
      "Mint a measured OBJECT study — the object-scale sibling of create_fractal_city. Where the "
      + "city/hub mints drop you INTO a traversable world at abstract scale, the workbench presents a "
      + "single everyday object on a measured grid at LITERAL real-world scale, for form accuracy "
      + "(neutral studio light, no mood). You build the object as a POLYGOMER — monomer primitives "
      + "bonded by literal placement of their axes. Two monomer kinds today:\n"
      + "• `lathes` — surfaces of REVOLUTION (axisFrom→axisTo + a radius `profile` of {t,radius}, "
      + "optional N-fold `harmonics` for fluting/threads): candlestick, bottle, dumbbell, vase, lamp, "
      + "wheel, plate, spindle.\n"
      + "• `extrudes` — PRISMS from a 2D profile swept along an axis, OR recessed SHELLS when "
      + "`wallThickness` is set: box, slab, bracket, sign (solid) and tray, case, enclosure, drawer, "
      + "bin (shell). Profile is { rect:{w,h,r?} } or { points:[[u,v]…] }.\n"
      + "• `sweeps` — a tube swept ALONG a 3D `path`: handles, frames, hooks, cables, coil springs.\n"
      + "• `reliefs` — a 2D outline (an SVG `path` or font `text`) RAISED off a base along its normal "
      + "into bevelled geometry (additive emboss, never a cut): an embossed nameplate/plaque, a wordmark "
      + "or logo lifted off a panel, a star/seal struck onto a lathe disc (a coin/medallion). { shape: "
      + "{ path:'<svg d>' } | { text:'…', font? }, size (literal height the unit outline maps to), "
      + "anchor:{x,y,z} (the surface it rises from — sink it ~0.1 into the base to avoid coplanar "
      + "z-fight), normal? (raise direction, default +z), up?, style?:{ depth, bevel, tracking, … } }.\n"
      + "STACKING (relative composition): for a vertical multi-part object (candlestick, lamp, vase, "
      + "dumbbell, spindle) prefer `assembly` over hand-placed axes — declare each part by `height` + "
      + "`profile` and it auto-stacks on the one below (running z computed for you; `on`/`gap`/`offset` "
      + "to override). It lowers to `lathes`/`extrudes` and merges with explicit arrays, so a mug = an "
      + "assembled lathe body + an explicit swept handle. A part can REPLICATE itself at the same "
      + "stacked z: `radial:{count,radius}` rings copies around a circle (round-stool legs, bolt "
      + "circles, candelabra arms) and `mirror:'x'|'y'|'xy'` reflects the offset into corner copies "
      + "(`offset:[a,b],mirror:'xy'` → 4 rectangular table/chair legs) — a part `on` a replicated part "
      + "still seats on its single top. The result `stats.parts[]` reports each part's size + base/top "
      + "z, and `stats.warnings` flags an object floating off the measured grid — read them before "
      + "opening /world.\n"
      + "PACKAGE DESIGN: a lathe can carry a `wrap` — a label image (inline svg, a data URL, or a "
      + "stored `sketchRef`) mapped around the wall → a labeled can/bottle/cup (shown in /world). "
      + "Compose them: a mug = a shell lathe + a swept handle; a labeled can = one lathe + a wrap. "
      + "Fractal-generation path — the substrate stores ONLY the recipe and regenerates the object "
      + "deterministically, served as a traversable three.js World at `/api/sketches/<ref>/world` "
      + "(free orbit) + preset CSS-3D shots at `/scene`; persists with `manifest.kind === 'workbench'`. "
      + "Reach for 'render an object / a mechanical part / an everyday object from primitives / a "
      + "turntable of a <object> / block out a <object> in solids'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        lathes: {
          type: 'array',
          description: 'Revolution monomers (surfaces of revolution), bonded by literal placement of their axes. Each renders a vexar-shaded, capped solid. Provide `lathes` and/or `extrudes` (at least one monomer total).',
          items: {
            type: 'object',
            properties: {
              axisFrom: { type: 'object', description: 'Axis start point {x,y,z} (z is up). The revolution sweeps along axisFrom→axisTo.' },
              axisTo: { type: 'object', description: 'Axis end point {x,y,z}.' },
              profile: {
                type: 'array', minItems: 1,
                description: 'Radius profile along the axis: an array of { t, radius } with t in [0,1] monotonically non-decreasing (t=0 at axisFrom, t=1 at axisTo). Ends at radius→0 self-close; ends with real radius get a flat cap.',
                items: { type: 'object', properties: { t: { type: 'number' }, radius: { type: 'number' } }, required: ['t', 'radius'] },
              },
              tint: { type: 'string', description: "Optional base albedo hex (e.g. '#c79a4b' brass, '#9aa3b0' steel). Vexar Lambert shades it per face." },
              harmonics: { type: 'array', description: 'Optional N-fold angular harmonics [{ n, amplitude, phase? }] for fluting / chiselling / thread-like ridges.' },
              normalFrom: { type: 'object', description: 'Optional cross-section normal {x,y,z} at t=0 (paired with normalTo) to bend the sweep frame.' },
              normalTo: { type: 'object', description: 'Optional cross-section normal {x,y,z} at t=1.' },
              crossSections: { type: 'integer', description: 'Optional mesh density along the axis (default 24).' },
              samples: { type: 'integer', description: 'Optional mesh density around the axis (default 36).' },
              wrap: {
                type: 'object',
                description: "Optional LABEL WRAP — map a label image around a t-band of the wall (a can/bottle/cup label; a cylinder is a perfect developable surface, so no distortion). Renders in the traversable /world view. { source: { svg:'<svg…>' | dataUrl:'data:…' | sketchRef:'sk_…' (a stored sketch as the label) }, band?:{ tFrom, tTo } (0..1 of the axis; default the whole wall), seam?: number (rotate the label so its centre faces front / hide the seam at the back, 0..1) }. Tip: a full-wrap label whose art includes the metal top/bottom reads like a real can.",
              },
            },
            required: ['axisFrom', 'axisTo', 'profile'],
          },
        },
        extrudes: {
          type: 'array',
          description: 'Extrusion monomers: a 2D profile swept along an axis into a solid prism, or a recessed SHELL when `wallThickness` is set. Boxes, slabs, brackets (solid); trays, cases, enclosures (shell).',
          items: {
            type: 'object',
            properties: {
              profile: { type: 'object', description: 'The 2D cross-section: { rect: { w, h, r? } } (rounded rectangle — the common case) OR { points: [[u,v], …] } (a closed polygon, e.g. an L-bracket or hex). r is the corner radius.' },
              axisFrom: { type: 'object', description: 'Extrusion start point {x,y,z} (z up). The profile lies in the plane ⟂ to axisFrom→axisTo and sweeps to axisTo.' },
              axisTo: { type: 'object', description: 'Extrusion end point {x,y,z} (axis length = the depth/height).' },
              wallThickness: { type: 'number', description: 'Optional — omit for a SOLID prism; set it to hollow the prism into a recessed SHELL (tray/case/enclosure) with walls this thick. Rect profiles only (v1).' },
              floorThickness: { type: 'number', description: 'Shell only: thickness of the closed back/floor (default = wallThickness).' },
              openFace: { type: 'string', enum: ['to', 'from', 'none'], description: "Shell only: which end is open — 'to' (the axisTo end, default), 'from', or 'none'." },
              tint: { type: 'string', description: 'Optional base albedo hex.' },
              innerTint: { type: 'string', description: 'Optional shell cavity albedo (default = tint; a darker value reads more sunken).' },
              cornerSamples: { type: 'integer', description: 'Optional rounded-corner resolution (default 6).' },
            },
            required: ['profile', 'axisFrom', 'axisTo'],
          },
        },
        sweeps: {
          type: 'array',
          description: 'Sweep monomers: a circular tube swept along a 3D path (rotation-minimizing frames → no twist). Handles, frames, hooks, cables, coil springs.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'array', description: 'The centreline: an array of >= 2 [x,y,z] points the tube follows (a C-curve for a handle, a helix for a spring, etc.). z is up.', items: { type: 'array', items: { type: 'number' } } },
              radius: { type: 'number', description: 'Tube radius.' },
              sides: { type: 'integer', description: 'Optional cross-section resolution around the tube (default 16; >= 3).' },
              tint: { type: 'string', description: 'Optional base albedo hex.' },
              caps: { type: 'boolean', description: 'Optional — close the two ends (default true). Set false when both ends embed in another monomer (e.g. a handle into a mug wall).' },
            },
            required: ['path', 'radius'],
          },
        },
        reliefs: {
          type: 'array',
          description: 'Relief monomers: a 2D outline (SVG path or font text) raised off a base plane along its normal into bevelled geometry — an ADDITIVE emboss, never a subtractive cut. Embossed nameplates/plaques, wordmarks/logos lifted off a panel, a seal/star struck onto a lathe disc (coin/medallion). Geometry only (no metal/glow/fx). Tip: sink `anchor` slightly into the base so the buried back face does not z-fight the base top.',
          items: {
            type: 'object',
            properties: {
              shape: { type: 'object', description: "The outline source: { path: '<svg d>' } (a logo/icon/symbol) OR { text: '…', font?: '<path-to-ttf>' } (font-carved letters; counters become real holes)." },
              size: { type: 'number', description: 'Literal size the normalized outline maps to, in the manifest units (cap-height for text; largest dimension for a path). depth/bevel scale with it, so proportions hold.' },
              anchor: { type: 'object', description: 'Where the outline plane sits {x,y,z} — the surface the relief rises from. Sink it ~0.1 below a base top so the buried back cap does not coincide with (z-fight) the base.' },
              normal: { type: 'object', description: 'Optional raise direction {x,y,z} (default {x:0,y:0,z:1} — lay flat, rise up). Point it at a lathe wall/cap surface-normal to emboss onto a turned form.' },
              up: { type: 'object', description: 'Optional in-plane orientation {x,y,z} of the glyph vertical (default {x:0,y:1,z:0}).' },
              style: { type: 'object', description: 'Optional geometry style: { depth, bevel, bevelSteps, weight, blocky, slant, tracking, curveSteps } — same vocabulary as the carved-solid kernel (depth/bevel are in normalized outline units, scaled by `size`).' },
              tint: { type: 'string', description: 'Optional base albedo hex (vexar Lambert shades it per face).' },
            },
            required: ['shape', 'anchor'],
          },
        },
        assembly: {
          type: 'object',
          description: "RELATIVE COMPOSITION — declare a vertical multi-part object by size + connection instead of absolute axes. The running z is computed for you so each part seats flush on the one below (no hand-stacked `axisFrom`/`axisTo`). Lowers to `lathes`/`extrudes` and merges with any explicit arrays. Use for candlestick/lamp/vase/dumbbell/spindle; keep `sweeps` (handles, springs) in the explicit array.",
          properties: {
            parts: {
              type: 'array', minItems: 1,
              description: 'Ordered parts, stacked bottom→top. Each: { kind:"lathe"|"extrude", height (axis length along z, >0), profile (lathe: [{t,radius}]; extrude: {rect|points}), id? (name for `on`), on? ("ground" | an earlier part id/index; default = the previous part), gap? (lift above the support, default 0), offset? ([dx,dy] off the stack axis, default [0,0]), radial? ({ count, radius, startAngle?, center? } — ring N copies around a circle), mirror? ("x"|"y"|"xy" — reflect the offset into 2/4 corner copies; e.g. offset:[a,b],mirror:"xy" = 4 legs), + any monomer passthrough (tint, harmonics, wrap, wallThickness, openFace, …). Use radial OR mirror, not both.',
              items: { type: 'object' },
            },
          },
          required: ['parts'],
        },
        units: { type: 'string', description: "Informational unit label for the world coordinates (e.g. 'cm', 'mm', 'in') — surfaced in the size readout and grid (1 grid cell = 5 units). Default 'cm'." },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height } (default 900×900).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createWorkbenchHandler,
  });
}
