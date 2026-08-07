/**
 * Mint the MAP-TREATMENT LAB worlds (map-treatment.plan.md, phase 1 — the eyes
 * gate): each arena map family CLONED with the two dormant rails switched on —
 * volumetric fog (manifest `fog` → composeVolumeFog over the map's colliders)
 * and baked AO (manifest `ao` → effects/ao-bake.js) — so the treatment can be
 * judged A/B against the untouched source from the identical spawn framing.
 *
 *   sk_ms_map_lab_ground   ← sk_ms_nature_arena_dusk        (warm dusk ground haze)
 *   sk_ms_map_lab_city     ← sk_ms_fractal_city_arena       (cool skyline haze)
 *   sk_ms_map_lab_space    ← sk_ms_space_asteroid_field_noir (nebula depth veil)
 *   sk_ms_map_lab_colony   ← sk_ms_space_colony             (interior atmosphere + AO seams)
 *
 * Sources and game levels are untouched (phase-1 isolation contract). AO radius
 * is explicit — the bake's auto radius caps at 3.5 world units, invisible at
 * suit scale.
 *
 *   cd control
 *   node scripts/mint-map-lab.mjs             # mint / refresh the four labs
 *   node scripts/mint-map-lab.mjs --dry-run   # print the treatments only
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';

const dryRun = process.argv.includes('--dry-run');

const LABS = [
  {
    ref: 'sk_ms_map_lab_ground', src: 'sk_ms_nature_arena_dusk', label: 'Canyon (dusk)',
    // v2: the arena-atmosphere test values (h14 · d0.02) read as a cream WALL at combat
    // scale — density integrates over a ~500-unit march, and the overlay can't clip
    // against suits. Thin + low: a shin-height dust layer that hazes the far canyon only.
    fog: { depthClip: true, height: 11, density: 0.013, color: [0.78, 0.70, 0.60], maxDist: 460, cell: 24, steps: 100, traceSteps: 84 },
    ao: { strength: 0.6, radius: 10 },
  },
  {
    ref: 'sk_ms_map_lab_city', src: 'sk_ms_fractal_city_arena', label: 'City (O’Neill noon)',
    // taller ceiling + thinner density = aerial perspective down the lanes, not ground soup
    fog: { depthClip: true, height: 40, density: 0.0065, color: [0.78, 0.85, 0.93], maxDist: 900, cell: 30, steps: 96, traceSteps: 80 },
    ao: { strength: 0.6, radius: 12 },
  },
  {
    ref: 'sk_ms_map_lab_space', src: 'sk_ms_space_asteroid_field_noir', label: 'Space (asteroid noir)',
    // a very tall, very thin blue-black veil: distant rocks dim into it (depth), near combat stays clear
    fog: { depthClip: true, height: 240, density: 0.0018, color: [0.10, 0.16, 0.30], maxDist: 1000, cell: 40, steps: 90, traceSteps: 76 },
    ao: { strength: 0.5, radius: 8 },
  },
  {
    ref: 'sk_ms_map_lab_colony', src: 'sk_ms_space_colony', label: 'Colony (interior)',
    // faint cool interior air + the strongest AO — seams, cover bases, partition junctions
    fog: { depthClip: true, height: 12, density: 0.007, color: [0.52, 0.60, 0.70], maxDist: 320, cell: 18, steps: 100, traceSteps: 84 },
    ao: { strength: 0.7, radius: 9 },
  },
];

for (const lab of LABS) {
  const source = SketchRepository.getByRef(lab.src);
  if (!source?.manifest) { console.error(`${lab.src}: not found`); process.exit(1); }
  const manifest = structuredClone(source.manifest);
  manifest.title = `MAP LAB — ${lab.label} (fog + AO)`;
  manifest.note = `map-treatment SPIKE phase 1 eyes gate · from ${lab.src} — not a game world`;
  manifest.fog = lab.fog;
  manifest.ao = lab.ao;
  console.log(`${lab.ref} ← ${lab.src}`);
  console.log(`  fog ${JSON.stringify(lab.fog)}`);
  console.log(`  ao  ${JSON.stringify(lab.ao)}`);
  if (dryRun) continue;
  try {
    SketchRepository.create({ title: manifest.title, manifest, ref: lab.ref });
    console.log('  minted');
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err?.message || '')) {
      SketchRepository.update({ ref: lab.ref, title: manifest.title, manifest });
      console.log('  updated in place');
    } else throw err;
  }
  console.log(`  world  http://127.0.0.1:3001/api/sketches/${encodeURIComponent(lab.ref)}/world`);
}
