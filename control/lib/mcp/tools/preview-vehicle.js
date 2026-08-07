/**
 * preview_vehicle_instance — render a meta-fabricator family INSTANCE on the workbench studio grid.
 *
 * The render affordance the `design-vehicle-family` catalyst leans on (the way `create_workbench` is
 * the render tool for the object catalysts). A family instance is a sampled/authored vehicle — a
 * TYPE (a registered preset: airliner / widebody / sedan / city-bus …) plus an optional DECORATION
 * (aircraft livery scheme, car paint+hull). This mints a tiny `vehicle-instance` recipe sketch and
 * serves it as a traversable three.js World at /api/sketches/<ref>/world, on the measured studio
 * grid with turntable cameras — so a fleet-library candidate (a new livery, a tuned preset) can be
 * eyeballed before it is committed to the registry.
 *
 * Orbit-only (like `planetary`): no CSS-3D /scene path, no /scene PNG thumbnail.
 * Stored manifest: { kind:'vehicle-instance', type, decoration?, pose?, viewBox?, title? }.
 *
 * Design: control/lib/graph/meta-fabricator.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planInstance } from '@/lib/graph/meta-fabricator';

export function mintVehicleInstance({ title, type, decoration, pose, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'vehicle-instance',
    type,
    ...(decoration && typeof decoration === 'object' ? { decoration } : {}),
    ...(pose && typeof pose === 'object' ? { pose } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Validate the instance is buildable + return a face/family readout (no geometry stored).
  const { stats } = planInstance(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${stats.type} · ${stats.family}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
  };
}

export async function previewVehicleInstanceHandler(input) {
  if (!input || typeof input !== 'object' || !input.type) {
    throw new Error('preview_vehicle_instance requires a `type` (a registered vehicle preset, e.g. "airliner" or "sedan")');
  }
  const { title, type, decoration, pose, viewBox, ref, folder_ref: folderRef } = input;
  return mintVehicleInstance({ title, type, decoration, pose, viewBox, ref, folderRef });
}

export function registerPreviewVehicleTools() {
  registerTool({
    name: 'preview_vehicle_instance',
    description:
      "Preview a single VEHICLE family instance on the workbench's measured studio grid — orbitable in "
      + "/world. A meta-fabricator family instance is a registered vehicle TYPE plus an optional "
      + "DECORATION. This is the eyeball-before-you-commit step of populating a fleet library: render a "
      + "candidate (a tuned preset, a new livery scheme, a car paint/hull) and check the silhouette + "
      + "decoration read, then commit it to the registry. Families + their presets and decoration "
      + "vocabularies come from the meta-fabricator (control/lib/graph/meta-fabricator.js): "
      + "fixed-wing-aircraft (airliner | widebody | regional | bizjet; livery scheme by name — classic, "
      + "teal, crimson, forest, ember, royal, sky, sand), ground-car (sedan | suv | taxi | opsWagon; "
      + "paint hex + hull name — standard/coupe/wide/lowered/lifted…), ground-box (cityBus | boxTruck | "
      + "streetcar | beltLoader …; baked livery, no scheme). The substrate stores ONLY the tiny recipe "
      + "(kind:'vehicle-instance') and regenerates the vehicle deterministically on render. Reach for "
      + "'preview/show a <plane|bus|car>', 'try the teal livery on a widebody', 'render a sedan in "
      + "crimson'. To DROP a vehicle into a populated world, use create_transportation_hub instead.",
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'The registered vehicle preset to render (e.g. "airliner", "widebody", "regional", "bizjet", "sedan", "suv", "taxi", "cityBus", "boxTruck", "streetcar"). Unknown types are rejected with the list of families/presets.' },
        decoration: {
          type: 'object',
          description: "Optional family-appropriate decoration. Aircraft: { scheme: '<livery name>' } (classic/teal/crimson/forest/ember/royal/sky/sand) or { scheme: <index> }. Cars: { paint: '#hex', hull: '<name>' } (hull: standard/coupe/chopped/wide/narrow/lowered/lifted). Box vehicles ignore it (livery is baked into the body cards). Omit for the authored default.",
        },
        pose: { type: 'object', description: 'Optional render pose passed to the vehicle builder: { scale?: number, heading?: number (radians) }. Default centred, scale 1.' },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height } (default 900×900).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['type'],
    },
    handler: previewVehicleInstanceHandler,
  });
}
