/**
 * create_assembler — compose several finished workbench PARTS into one worldspace.
 *
 *   Assembler makes a chariot. Workbench makes chariot parts.
 *
 * The ring above create_workbench: where the workbench mints ONE measured object (its invariant is
 * single-subject), the assembler places SEVERAL whole workbench parts in a shared, meru-scaled
 * worldspace. The MAIN move is REPOSITION (`at`) — each part was authored alone at its own origin,
 * so without it they pile at [0,0,0]. `repeat` arrays a part (one spindle → a banister) and
 * `rotate`/`flip`/`scale` adjust a placement (peg → spindle).
 *
 * Source policy — FROZEN at import. Each item's `source` is stored inline. A `{ ref }` is resolved
 * to the stored workbench's monomers and COPIED in at mint time (mint-at-import), so the assembler
 * is self-contained: no binding, no live refs, no staleness. Re-mint = re-import + redo.
 *
 * Stored manifest: { kind:'assembler', items:[ { source:{lathes?,extrudes?,sweeps?}, at?, rotate?, flip?, scale?, repeat? } … ], units?, viewBox?, title? }.
 *
 * Design: control/lib/graph/workbench-assembler.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planAssembler } from '@/lib/graph/worlds/workbench-assembler';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

// Pull the renderable monomer arrays off a workbench-shaped manifest (the frozen part).
function monomersOf(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  const out = {};
  if (Array.isArray(manifest.lathes) && manifest.lathes.length) out.lathes = manifest.lathes;
  if (Array.isArray(manifest.extrudes) && manifest.extrudes.length) out.extrudes = manifest.extrudes;
  if (Array.isArray(manifest.sweeps) && manifest.sweeps.length) out.sweeps = manifest.sweeps;
  if (Array.isArray(manifest.reliefs) && manifest.reliefs.length) out.reliefs = manifest.reliefs;
  return (out.lathes || out.extrudes || out.sweeps || out.reliefs) ? out : null;
}

// Resolve an item's `source` to a FROZEN inline part. Accepts an inline workbench manifest
// ({ lathes?, extrudes?, sweeps? }) or a { ref } to a stored workbench sketch (copied in here).
function freezeSource(source, index) {
  if (!source || typeof source !== 'object') {
    throw new Error(`Item ${index}: \`source\` must be a workbench part — an inline { lathes/extrudes/sweeps } or a { ref } to a stored workbench.`);
  }
  if (typeof source.ref === 'string') {
    const sketch = SketchRepository.getByRef(source.ref);
    if (!sketch || !sketch.manifest) throw new Error(`Item ${index}: source ref '${source.ref}' not found.`);
    if (sketch.manifest.kind !== 'workbench') throw new Error(`Item ${index}: source ref '${source.ref}' is a '${sketch.manifest.kind}', not a workbench — the assembler composes workbench parts.`);
    const frozen = monomersOf(sketch.manifest);
    if (!frozen) throw new Error(`Item ${index}: workbench '${source.ref}' has no renderable monomers.`);
    return frozen;
  }
  const inline = monomersOf(source);
  if (!inline) throw new Error(`Item ${index}: \`source\` has no renderable monomers (need a non-empty lathes/extrudes/sweeps, or a { ref }).`);
  return inline;
}

export function mintAssembler({ title, items, units, viewBox, ref, folderRef } = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Provide a non-empty `items` array — each item places one workbench part in the shared worldspace.');
  }
  const frozenItems = items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Item ${index} must be an object.`);
    return {
      source: freezeSource(item.source, index),
      ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
      ...(Array.isArray(item.at) ? { at: item.at } : {}),
      ...(item.on != null ? { on: item.on } : {}),
      ...(Number.isFinite(item.gap) ? { gap: item.gap } : {}),
      ...(Array.isArray(item.rotate) ? { rotate: item.rotate } : {}),
      ...(typeof item.flip === 'string' ? { flip: item.flip } : {}),
      ...(Number.isFinite(item.scale) ? { scale: item.scale } : {}),
      ...(item.repeat && typeof item.repeat === 'object' ? { repeat: item.repeat } : {}),
    };
  });

  const manifest = {
    kind: 'assembler',
    items: frozenItems,
    ...(typeof units === 'string' ? { units } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Lower once to validate every part renders + return a placement/size readout (no geometry stored).
  const { stats } = planAssembler(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `assembler · ${stats.items} part${stats.items === 1 ? '' : 's'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  warmScenePng(sketch);

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
  };
}

export async function createAssemblerHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_assembler requires a recipe object with an `items` array');
  }
  const { title, items, units, viewBox, ref, folder_ref: folderRef } = input;
  return mintAssembler({ title, items, units, viewBox, ref, folderRef });
}

export function registerAssemblerTools() {
  registerTool({
    name: 'create_assembler',
    description:
      "Compose several finished WORKBENCH parts into ONE worldspace — the ring above create_workbench. "
      + "Principle: ASSEMBLER MAKES A CHARIOT, WORKBENCH MAKES CHARIOT PARTS. A workbench is single-subject "
      + "(it builds one object well), so it can't honestly make 'something complicated'; the assembler "
      + "takes several whole workbench parts and arranges them. Every part already shares meru scale, so "
      + "this is a PLACING concern, not a geometry one.\n"
      + "PLACEMENT has two modes. GRAVITY SEATING (standard): give a part `on:'ground'` (or `on` an "
      + "earlier part's `id`/index, lifted by `gap`) and it DROPS so its lowest point — measured AFTER "
      + "rotate/flip/scale — rests on that support; you never hand-compute a z lift (e.g. a wheel rotated "
      + "upright auto-seats at its own radius). SUPERPOSITION (the allowed non-standard fallback): give an "
      + "absolute `at:[x,y,z]` with no `on` for parts that bridge rather than rest (a chariot's bed sits "
      + "between its wheels, not on the floor). `at` always supplies x/y; with `on`, its z is ignored. "
      + "`repeat` arrays a part along a line (one spindle → a banister), and `rotate`/`flip`/`scale` adjust "
      + "a single placement (flip a peg upside-down → a spindle). Need a part the workbench doesn't have? "
      + "Mint it on the workbench first — a spindle is just its own narrow lathe — then place it here; the "
      + "assembler never reaches inside a part.\n"
      + "SOURCE IS FROZEN AT IMPORT: an item's `source` is either an inline workbench part "
      + "({ lathes/extrudes/sweeps }) or a { ref } to a stored workbench (copied in at mint time). No live "
      + "binding — if the source workbench later changes, re-import and redo the adjustments. The result "
      + "`stats.parts[]` reports each part's placement + copy count and `stats.warnings` flags an assembly "
      + "floating off the measured grid. Served on the SAME measured studio vantage as the workbench: a "
      + "traversable three.js World at `/api/sketches/<ref>/world` + preset CSS-3D shots at `/scene`; "
      + "persists with `manifest.kind === 'assembler'`. Reach for 'assemble / arrange / combine several "
      + "parts / build a <complex thing> from workbench parts / a stair from one step / a banister from one "
      + "spindle'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        items: {
          type: 'array', minItems: 1,
          description: 'The placed parts. Each item drops one frozen workbench part into the shared worldspace at a position.',
          items: {
            type: 'object',
            properties: {
              source: {
                type: 'object',
                description: 'The workbench PART, frozen inline at mint. Either an inline workbench manifest { lathes?:[…], extrudes?:[…], sweeps?:[…] } (copy a part recipe in), OR { ref: "sk_…" } pointing at a stored workbench sketch (its monomers are copied in here — no live link afterward).',
              },
              id: { type: 'string', description: 'Optional name for this part so a LATER part can rest `on` it (gravity seating).' },
              at: { type: 'array', items: { type: 'number' }, description: 'REPOSITION — [x,y,z]. x/y is where the part sits in shared space (z is up). With `on`, the z here is ignored (gravity computes it); without `on`, z is the absolute superposition height. Default [0,0,0].' },
              on: { description: "GRAVITY SEAT (standard placement) — 'ground' (rest on z=0) or the id/index of an EARLIER part (rest on its top). Drops the part so its lowest point, measured after rotate/flip/scale, sits on the support. Omit for superposition (absolute `at` z).", type: ['string', 'integer'] },
              gap: { type: 'number', description: 'With `on`: lift the part this far above its support (default 0).' },
              rotate: { type: 'array', items: { type: 'number' }, description: 'Optional orient — [rx,ry,rz] in DEGREES (applied Rz·Ry·Rx, after flip). Lighting tracks the rotation.' },
              flip: { type: 'string', description: "Optional mirror — any combo of axes ('x' | 'z' | 'xy' | 'xyz' …). Flips the part on those axes (e.g. flip a candlestick peg on z → a spindle)." },
              scale: { type: 'number', description: 'Optional uniform scale nudge within the shared meru scale (default 1).' },
              repeat: {
                type: 'object',
                description: 'Optional linear array — replicate this part at stepped positions (one spindle → a banister). { count: N, step: [dx,dy,dz] }: copy k sits at at + k·step.',
                properties: { count: { type: 'integer' }, step: { type: 'array', items: { type: 'number' } } },
              },
            },
            required: ['source'],
          },
        },
        units: { type: 'string', description: "Informational unit label (e.g. 'cm') — surfaced in the size readout and grid (1 grid cell = 5 units). Default 'cm'." },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height } (default 900×900).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['items'],
    },
    handler: createAssemblerHandler,
  });
}
