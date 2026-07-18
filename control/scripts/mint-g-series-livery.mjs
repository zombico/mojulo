/**
 * Mint a g-series LIVERY DESCENDANT: clone a stored assembler unit's manifest,
 * re-hue its palette roles per the g-series livery shelf, validate through the
 * same planAssembler lowering as create_assembler, and store it as a new
 * sovereign sketch (mint-at-import — no live ref back to the source unit;
 * livery + seed ride as provenance in the title and a manifest note).
 *
 * Phase 1 of the descendant generator (mobile-suit-builder.plan.md, g-series
 * addendum). Roles + shelf: lib/graph/polygonizer/g-series-livery.js, pinned by
 * sketch-vocab/g-series.md.
 *
 *   cd control
 *   node scripts/mint-g-series-livery.mjs                          # seeded pick off the shelf, seed 1
 *   node scripts/mint-g-series-livery.mjs --livery titanic         # explicit livery
 *   node scripts/mint-g-series-livery.mjs --all                    # all four shelf liveries
 *   node scripts/mint-g-series-livery.mjs --seed 7 --jitter        # squad-variance panel breaks
 *   node scripts/mint-g-series-livery.mjs <sourceRef> --classify   # role census only, no mint
 *   node scripts/mint-g-series-livery.mjs --dry-run                # transform + validate, no store
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { planAssembler } from '../lib/graph/worlds/workbench-assembler.js';
import {
  GSERIES_LIVERY_SHELF,
  classifyGSeriesTints,
  applyGSeriesLivery,
} from '../lib/graph/polygonizer/g-series-livery.js';

const REFERENCE_UNIT = 'sk_80str_modular_frame_fit_v78_raised_chest_vents';
const BASE_URL = 'http://127.0.0.1:3001';

// ---- args ----
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const flagValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const sourceRef = argv.find((a) => !a.startsWith('--') && a !== flagValue('--livery')
  && a !== flagValue('--seed') && a !== flagValue('--ref')) || REFERENCE_UNIT;
const livery = flagValue('--livery');
const seed = Number(flagValue('--seed') ?? 1);
const jitter = flags.has('--jitter');
const dryRun = flags.has('--dry-run');
const refOverride = flagValue('--ref');

if (livery && !GSERIES_LIVERY_SHELF.includes(livery)) {
  console.error(`Unknown livery '${livery}' — the shelf is: ${GSERIES_LIVERY_SHELF.join(', ')}`);
  process.exit(1);
}
if (!Number.isInteger(seed)) {
  console.error('--seed must be an integer (seeded dice are the house invariant).');
  process.exit(1);
}

// ---- source ----
const source = SketchRepository.getByRef(sourceRef);
if (!source?.manifest) {
  console.error(`Source sketch '${sourceRef}' not found (or has no manifest).`);
  process.exit(1);
}
if (source.manifest.kind !== 'assembler') {
  console.error(`Source '${sourceRef}' is kind '${source.manifest.kind}' — phase 1 recolors assembled units (kind 'assembler').`);
  process.exit(1);
}

// ---- classify-only mode ----
if (flags.has('--classify')) {
  const census = classifyGSeriesTints(source.manifest);
  console.log(`${sourceRef} — ${census.total} tinted monomers\n`);
  for (const [role, bucket] of Object.entries(census.roles)) {
    console.log(`  ${role.padEnd(9)} ×${String(bucket.monomers).padEnd(4)} ${Object.entries(bucket.hexes)
      .sort((a, b) => b[1] - a[1]).map(([h, c]) => `${h}×${c}`).join(' ')}`);
  }
  const unknowns = Object.entries(census.unknown);
  console.log(unknowns.length
    ? `\n  UNKNOWN (untouched by recolor): ${unknowns.map(([h, c]) => `${h}×${c}`).join(' ')}`
    : '\n  no unknown hexes — every tint classifies into a role');
  process.exit(0);
}

// ---- mint ----
const liveries = flags.has('--all') ? GSERIES_LIVERY_SHELF : [livery]; // [undefined] → seeded pick

for (const pick of liveries) {
  const result = applyGSeriesLivery(source.manifest, { livery: pick, seed, jitter });
  const seedMattered = result.picked || jitter;
  const provenance = `livery descendant of ${sourceRef} · livery=${result.livery}`
    + (seedMattered ? ` · seed=${result.seed}` : '') + (jitter ? ' · jitter' : '');

  const manifest = {
    ...result.manifest,
    title: `${source.title} - ${result.livery} livery`,
    note: provenance,
  };
  const { stats } = planAssembler(manifest); // same validation gate as create_assembler

  const ref = refOverride
    || `sk_${sourceRef.replace(/^sk_/, '')}_${result.livery.replace(/-/g, '_')}${seedMattered ? `_s${result.seed}` : ''}`;

  const remapCount = Object.keys(result.remapped).length;
  console.log(`${result.livery}${result.picked ? ` (seeded pick, seed ${result.seed})` : ''}`
    + ` — ${remapCount} hexes remapped, roles: ${Object.entries(result.counts).map(([r, n]) => `${r}×${n}`).join(' ')}`
    + (result.unknown.length ? ` — UNKNOWN untouched: ${result.unknown.join(' ')}` : ''));

  if (dryRun) {
    console.log(`  dry-run: valid (${stats.items} parts) — would mint ${ref}\n`);
    continue;
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title: manifest.title, manifest, ref });
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err?.message || '')) {
      console.error(`  ref '${ref}' already exists — pass --ref to choose another.\n`);
      continue;
    }
    throw err;
  }
  console.log(`  minted ${sketch.ref}`);
  console.log(`  world  ${BASE_URL}/api/sketches/${encodeURIComponent(sketch.ref)}/world`);
  console.log(`  page   ${BASE_URL}/sketches/${encodeURIComponent(sketch.ref)}\n`);
}
