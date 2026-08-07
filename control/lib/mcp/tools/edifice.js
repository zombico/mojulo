/**
 * create_edifice — mint a BESPOKE inhabitable building authored as a GRAPH.
 *
 * The building-scale sibling of create_workbench: where the workbench bonds object
 * monomers, an edifice composes MASSES (footprint + floors + facade + roof + interior)
 * connected by CONCOURSES (halls), placed by RELATION (mass B sits east of mass A). It
 * is the "workbench for buildings" — the metaprinciple (recipe → plan → baked faces)
 * applied to buildings the frozen generators (fractal-city/school/hub) don't produce.
 *
 * Fractal-generation path: the manifest stores ONLY the recipe (no geometry); the
 * building is regenerated deterministically on render and served walkable at
 * /api/sketches/<ref>/world + .glb, kind === 'edifice'. Design + doctrine:
 * control/lib/graph/architecture/dream-architecture.plan.md.
 *
 * ADVISORY, NEVER GATED: the livability/reachability checks are SURFACED in the mint
 * response, but the building is minted regardless — a user's building is theirs
 * (docs/responsibility-model.md).
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planEdifice, assessEdifice } from '@/lib/graph/architecture/edifice';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

export function mintEdifice({ title, masses, concourses, entrance, seed, theme, viewBox, ref, folderRef } = {}) {
  if (!Array.isArray(masses) || masses.length === 0) {
    throw new Error('create_edifice requires a non-empty `masses` array (each with a footprint, floors, facade, and an `at` or `on` placement).');
  }
  const manifest = {
    kind: 'edifice',
    masses,
    ...(Array.isArray(concourses) && concourses.length ? { concourses } : {}),
    ...(entrance ? { entrance } : {}),
    ...(seed != null ? { seed } : {}),
    ...(theme ? { theme } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Validate the recipe by PLANNING it (bad placement / a concourse between non-facing
  // masses throws here, at mint, not at render) + derive a readout.
  const plan = planEdifice(manifest);
  const assessment = assessEdifice(plan);
  const stats = {
    masses: plan.masses.length,
    concourses: plan.concourses.length,
    maxFloors: Math.max(...plan.masses.map((m) => m.floors)),
    footprintFt: { w: +(plan.bounds.x1 - plan.bounds.x0).toFixed(1), d: +(plan.bounds.y1 - plan.bounds.y0).toFixed(1) },
  };

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `edifice · ${stats.masses} mass${stats.masses === 1 ? '' : 'es'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  warmScenePng(sketch);

  // Advisory: surface any defects across every check, but the building is minted
  // regardless (never gated — a user's building is theirs).
  const defects = Object.values(assessment).flatMap((c) => c.necessary);
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
    advisory: assessment,
    ...(defects.length ? { note: `Advisory (not enforced): ${defects.map((d) => d.note).join('; ')}. Minted anyway — the building is yours.` } : {}),
  };
}

export async function createEdificeHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_edifice requires a recipe object with a `masses` array.');
  }
  const { title, masses, concourses, entrance, seed, theme, viewBox, ref, folder_ref: folderRef } = input;
  return mintEdifice({ title, masses, concourses, entrance, seed, theme, viewBox, ref, folderRef });
}

export function registerEdificeTools() {
  registerTool({
    name: 'create_edifice',
    description:
      "Mint a BESPOKE inhabitable BUILDING (kind `edifice`) — the building-scale sibling of "
      + "create_workbench, for a NEW one-off building the fractal city/school/hub generators don't make. "
      + "Compose a GRAPH of MASSES (footprint + floors + facade + roof) joined by CONCOURSES (halls), "
      + "placed by RELATION: a root mass `at:[x,y]`, the rest `on:{anchor,side,align,gap}` (mass B east "
      + "of mass A). A concourse `{from,to,width}` derives a hall between two facing masses and punches "
      + "doorways so they become ONE walkable building. Recipe-only, served walkable at /world + .glb. "
      + "Livability is surfaced but NEVER enforced. Field manual: forward_context. Dream it: the "
      + "`dream-edifice` catalyst.",
    inputSchema: {
      type: 'object',
      required: ['masses'],
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        masses: {
          type: 'array', minItems: 1,
          description: 'The building volumes. The root carries `at:[x,y]`; the rest sit `on` a neighbour.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique mass id (referenced by concourses + other masses’ `on.anchor`).' },
              footprint: { type: 'object', description: 'Ground footprint in feet: { w, d }.', properties: { w: { type: 'number' }, d: { type: 'number' } }, required: ['w', 'd'] },
              floors: { type: 'integer', description: 'Storey count (each ~11ft). Drives the mass height.' },
              at: { type: 'array', description: 'Absolute [x,y] placement (feet) — the root mass. Use `on` for the rest.', items: { type: 'number' } },
              on: {
                type: 'object',
                description: 'Relative placement against a neighbour: { anchor:<mass id>, side:N|S|E|W, align:start|center|end, gap:<ft> }.',
                properties: {
                  anchor: { type: 'string' },
                  side: { type: 'string', enum: ['N', 'S', 'E', 'W'] },
                  align: { type: 'string', enum: ['start', 'center', 'end', 'N', 'S', 'E', 'W'] },
                  gap: { type: 'number' },
                },
                required: ['anchor', 'side'],
              },
              form: { type: 'string', enum: ['rect', 'round'], description: "Massing shape (default 'rect'). 'round' reserved for a future increment." },
              facade: {
                type: 'object',
                description: 'The exterior skin. material glass|brick|concrete × rhythm curtain|punched|banded|pier|grid, plus the glass/frame hex.',
                properties: {
                  material: { type: 'string', enum: ['glass', 'brick', 'concrete'] },
                  rhythm: { type: 'string', enum: ['curtain', 'punched', 'banded', 'pier', 'grid'] },
                  glass: { type: 'string', description: 'Glass tint hex (or the brick BODY colour when material=brick).' },
                  frame: { type: 'string', description: 'Mullion / structure hex.' },
                },
              },
              roof: { description: "'flat' or a pitched form name (mission/modern-shed/manor/bungalow/farmhouse/colonial)." },
              interior: { type: 'object', description: "Interior kernel: { kernel:'open' } (a walkable hollow shell). Default 'open'.", properties: { kernel: { type: 'string', enum: ['open'] } } },
            },
            required: ['id', 'footprint', 'floors', 'facade'],
          },
        },
        concourses: {
          type: 'array',
          description: 'Halls connecting two masses. Each derives a corridor in the gap between the masses’ facing walls and punches a doorway in both.',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'A mass id.' },
              to: { type: 'string', description: 'A mass id it faces (placed apart on one axis).' },
              width: { type: 'number', description: 'Hall width in feet (default 10).' },
            },
            required: ['from', 'to'],
          },
        },
        entrance: { type: 'string', description: 'The mass the spawn point + reachability check start from (default the first mass).' },
        seed: { type: 'integer', description: 'Determinism seed (default 1).' },
        theme: { type: 'string', description: "Suggested-defaults theme id (default 'earth-temperate'); every facade/roof is overridable per mass regardless." },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createEdificeHandler,
  });
}
