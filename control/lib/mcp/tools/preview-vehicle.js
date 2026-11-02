/**
 * mint_solid({ kind: 'vehicle' }) — render a vehicle on the workbench studio grid (`preview_vehicle_instance` is its
 * unlisted retired alias, mint-solid.js). A vehicle is named by the vehicle REGISTRY first (`vehicle`: any word it
 * names, vehicle-registry/roster.js; `tier`: toy | stylised | realistic), read to the build its row has; the legacy keys
 * below are that build's, kept so a stored instance regenerates as it was minted.
 *
 * The render affordance the `design-vehicle-family` catalyst leans on (the way `create_workbench` is
 * the render tool for the object catalysts). A family instance is a sampled/authored vehicle — a
 * TYPE (a registered preset: airliner / widebody / sedan / city-bus …) plus an optional DECORATION
 * (aircraft livery scheme, car paint+hull). This mints a tiny `vehicle-instance` recipe sketch and
 * serves it as a traversable three.js World at /api/sketches/<ref>/world, on the measured studio
 * grid with turntable cameras. A new vehicle is a registry row first, never a new key in a legacy table.
 *
 * A RACE MACHINE is an instance too: { racer: <a racer's recipe> } or { supercar: <a supercar's spec> }, each wearing its
 * `theme` (car-designer/vehicle-theme.js: a starter, its variation, or a card of the user's own), so a theme is tried on
 * the grid before a race wears it.
 *
 * Orbit-only (like `planetary`): no CSS-3D /scene path, no /scene PNG thumbnail.
 * A REALISTIC LOFT is an instance too: { loft: { class, era?, brief?, seed? } }, a road class at its true numbers
 * (car-designer/realistic.js), the registry's realistic build of a car, a truck or a bus.
 *
 * Stored manifest: { kind:'vehicle-instance', vehicle?, type | racer | supercar | loft, decoration?, pose?, viewBox?, title? }
 * (`vehicle`: the registry row it was asked as, when it was; the renderer reads the build's own keys).
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planInstance } from '@/lib/graph/meta-fabricator';
import { resolveVehicle, rowOfHandle, suggestVehicles } from '@/lib/graph/vehicle-registry/roster';
import { buildsOf, buildOf, TIER_IDS } from '@/lib/graph/vehicle-registry/builds';
import { registryReadout } from '@/lib/graph/vehicle-registry/doors';
import { isVehicleType } from '@/lib/graph/vehicles/vehicles-css3d';

// the builds this door can show on the studio grid, and the instance key each is shown by
const PREVIEWS = Object.freeze({
  scenery: (b) => ({ type: b.key }),
  racer: () => ({ racer: {} }),
  supercar: (b) => ({ supercar: { preset: b.key } }),
  loft: (b) => ({ loft: { class: b.key } }),
});
const previewable = (b) => Boolean(PREVIEWS[b.via]);

/**
 * THE REGISTRY'S WAY IN (vehicle-registry/): a `vehicle` word (any word the registry names) is read to its row, and
 * the row's build at the `tier` asked (or its first build this door can show) is the instance. A legacy `type` that is
 * not a scenery key is read the same way, so 'a pickup truck' or 'tram' finds its row; a scenery key keeps its own
 * path, byte for byte. Returns the instance keys and the row's id (null for a legacy key's own path).
 */
export function readVehicleWord({ vehicle, type, racer, supercar, loft, tier } = {}) {
  if (tier !== undefined && !TIER_IDS.includes(tier)) throw new Error(`mint_solid vehicle: tier is one of ${TIER_IDS.join(', ')}`);
  const word = vehicle ?? (type !== undefined && !isVehicleType(type) ? type : undefined);
  if (word === undefined) return { instance: { type, racer, supercar, loft }, id: type !== undefined ? rowOfHandle('scenery', type) : racer !== undefined ? rowOfHandle('racer', true) : supercar !== undefined ? rowOfHandle('supercar', supercar?.preset ?? 'razor') : loft !== undefined ? rowOfHandle('physics', loft?.class) : null, asked: false };
  const hit = resolveVehicle(word);
  if (!hit) throw new Error(`mint_solid vehicle: '${word}' is no vehicle the registry names: ${suggestVehicles(word)}`);
  const { id } = hit, builds = buildsOf(id);
  // a race machine's recipe beside its row: the row must be the machine's, and the recipe is the instance
  if (racer !== undefined || supercar !== undefined || loft !== undefined) {
    const kind = racer !== undefined ? 'racer' : supercar !== undefined ? 'supercar' : 'loft';
    const own = kind === 'racer' ? rowOfHandle('racer', true) : kind === 'supercar' ? rowOfHandle('supercar', supercar?.preset ?? 'razor') : rowOfHandle('physics', loft?.class);
    if (own !== id) throw new Error(`mint_solid vehicle: '${word}' is the registry's ${id}, and a ${kind} recipe is the ${own}'s`);
    return { instance: { [kind]: kind === 'racer' ? racer : kind === 'supercar' ? supercar : loft }, id, asked: true };
  }
  // the grid shows a vehicle parked: the build that serves it (the fleet's loft is traffic; the grid draws the class's own)
  const at = tier ? buildOf(id, tier, { use: 'parked' }) : null;
  const shown = at ? (previewable(at.build) ? at.build : null) : builds.find((b) => previewable(b) && b.uses.includes('parked'));
  if (!shown) {
    const why = at ? `its ${tier} build is ${at.build.via}${at.build.key ? ` ${at.build.key}` : ''} (${at.build.status}), which the studio grid cannot show yet` : 'none of its builds is one the studio grid shows yet';
    throw new Error(`mint_solid vehicle: '${word}' is the registry's ${id} (${hit.row.label}): ${why}. Its builds: ${builds.map((b) => `${b.tier ?? 'concept'} ${b.via} (${b.status})`).join(', ')}`);
  }
  return { instance: PREVIEWS[shown.via](shown), id, tier: shown.tier, asked: true };
}

export async function mintVehicleInstance({ title, type, racer, supercar, loft, decoration, pose, viewBox, ref, folderRef, vehicle } = {}) {
  const manifest = {
    kind: 'vehicle-instance',
    ...(vehicle !== undefined ? { vehicle } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(racer !== undefined ? { racer } : {}),
    ...(supercar !== undefined ? { supercar } : {}),
    ...(loft !== undefined ? { loft } : {}),
    ...(decoration && typeof decoration === 'object' ? { decoration } : {}),
    ...(pose && typeof pose === 'object' ? { pose } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Validate the instance is buildable + return a face/family readout (no geometry stored).
  const { stats } = await planInstance(manifest);

  const sketch = SketchRepository.create({
      title: title || `${stats.type ?? stats.archetype ?? stats.preset ?? stats.class} · ${stats.family}`,
      manifest, ref, folderRef: folderRef ?? null,
    });

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
  };
}

export async function previewVehicleInstanceHandler(input) {
  if (!input || typeof input !== 'object' || !(input.vehicle || input.type || input.racer || input.supercar || input.loft)) {
    throw new Error('mint_solid vehicle requires a `vehicle` (any vehicle the registry names: "sedan", "a pickup truck", "kart", "widebody"), or a race machine\'s recipe: `racer` or `supercar` (with its `theme`)');
  }
  const { title, vehicle, tier, racer, supercar, loft, decoration, pose, viewBox, ref, folder_ref: folderRef } = input;
  const read = readVehicleWord({ vehicle, type: input.type, racer, supercar, loft, tier });
  const { type } = read.instance;
  const out = await mintVehicleInstance({ title, type, racer: read.instance.racer, supercar: read.instance.supercar, loft: read.instance.loft, decoration, pose, viewBox, ref, folderRef, ...(read.asked ? { vehicle: read.id } : {}) });
  return read.id ? { ...out, registry: registryReadout(read.id, { tier: read.tier ?? tier ?? 'stylised', use: 'parked' }) } : out;
}
