/**
 * Mint the MATERIAL-CONTRAST LAB worlds (ms-contrast.plan.md SPIKE — the eyes
 * gate): for each series, the SAME stored unit baked twice and stood side by
 * side — STOCK on the left, CONTRAST-TREATED on the right — so the treatment
 * can be visually judged before anything folds into a real game world.
 *
 *   sk_ms_contrast_lab_g   g-frame mk II (multi) — stock vs high-contrast-suit-v1
 *   sk_ms_contrast_lab_z   z-A11 (zeonic-green multi) — stock vs high-contrast-suit-v1
 *
 * Nothing outside these two spike refs sets `contrast`; the game worlds are
 * untouched (the isolation contract in ms-contrast.plan.md).
 *
 *   cd control
 *   node scripts/mint-contrast-lab.mjs             # mint / refresh both labs
 *   node scripts/mint-contrast-lab.mjs --dry-run   # bake + census only
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { bakeUnitRig } from '../lib/graph/worlds/unit-rig.js';
import { applyContrastTreatment } from '../lib/graph/mobile-suit/ms-contrast.js';

const BASE_URL = 'http://127.0.0.1:3001';
const dryRun = process.argv.includes('--dry-run');

const LABS = [
  { ref: 'sk_ms_contrast_lab_g', unitRef: 'sk_gframe_mk2_unit_v1_multi', label: 'g-frame mk II' },
  { ref: 'sk_ms_contrast_lab_z', unitRef: 'sk_zseries_a11_skirt_biped_multi_zeonic_green', label: 'z-A11 zeonic' },
  { ref: 'sk_ms_contrast_lab_taisa', unitRef: 'sk_taisa_unit_v1_captain_multi', label: 'taisa captain (akai-comet)' },
  { ref: 'sk_ms_contrast_lab_diaz', unitRef: 'sk_diaz_unit_v1_multi', label: 'diaz (akai-comet hover)' },
  { ref: 'sk_ms_contrast_lab_toretto', unitRef: 'sk_toretto_unit_v1_multi', label: 'toretto (black-star)' },
  { ref: 'sk_ms_contrast_lab_geof', unitRef: 'sk_geof_unit_v1_multi', label: 'geof (geof-blue z-frame)' },
];

const round = (v) => Math.round(v * 10) / 10;

for (const lab of LABS) {
  const source = SketchRepository.getByRef(lab.unitRef);
  if (!source?.manifest || source.manifest.kind !== 'assembler') {
    console.error(`${lab.unitRef}: not a stored assembler unit`); process.exit(1);
  }
  // aim lock if the unit is armed, matching the walker mints — the weapon stays seated
  const aim = source.manifest.armory?.aim && typeof source.manifest.armory.aim === 'object'
    ? source.manifest.armory.aim : null;

  // validate BOTH bakes at mint (a bad treatment fails here, not in the browser)
  // + log the census so the role coverage is visible
  const census = applyContrastTreatment(source.manifest, true);
  console.log(`${lab.unitRef}: series ${census.series} — roles ${JSON.stringify(census.counts)}`
    + (Object.keys(census.unknown).length ? ` · unknown ${JSON.stringify(census.unknown)}` : ''));
  const stock = bakeUnitRig(source.manifest, { ...(aim ? { aim } : {}) });
  const treated = bakeUnitRig(source.manifest, { ...(aim ? { aim } : {}), contrast: true });
  if (!Array.isArray(treated.rim)) { console.error('treated bake carries no rim — treatment did not apply'); process.exit(1); }
  const h = stock.figH;
  console.log(`  baked stock + treated: height ${h}, rim [${treated.rim.join(', ')}]`);

  const gap = round(h * 0.85);
  const FACE_CAMERA = -1.5708;   // heading −π/2: rig forward (+x at heading 0) turned to −y, square to the lab camera
  const figSpec = { unitRef: lab.unitRef, ...(aim ? { aim } : {}) };
  const figures = { stock: figSpec, treated: { ...figSpec, contrast: true } };
  const entities = [
    { id: 'stock', transform: { pos: [-gap, 0, 0], heading: FACE_CAMERA }, rule: { type: 'clock', rate: 0.5 }, body: { type: 'figure-rig', figure: 'stock' } },
    { id: 'treated', transform: { pos: [gap, 0, 0], heading: FACE_CAMERA }, rule: { type: 'clock', rate: 0.5 }, body: { type: 'figure-rig', figure: 'treated' } },
  ];
  const worlds = [
    {
      ref: lab.ref,
      manifest: {
        kind: 'controllable',
        title: `CONTRAST LAB — ${lab.label} (stock left · treated right)`,
        note: `ms-contrast SPIKE eyes gate · high-contrast-suit-v1 · from ${lab.unitRef} — not a game world`,
        ground: { size: round(h * 16), cell: round(h / 2) },
        worldFraming: {
          cameraPosition: [0, round(-h * 2.9), round(h * 0.62)],
          lookAt: [0, 0, round(h * 0.46)],
          horizontalFov: 60,
        },
        figures,
        entities,
      },
    },
    {
      // the CLOSE lab: same pair, camera tight on the treated suit's upper body —
      // the finish/emissive/rim read the far framing compresses.
      ref: `${lab.ref}_close`,
      manifest: {
        kind: 'controllable',
        title: `CONTRAST LAB (close) — ${lab.label} (treated upper body)`,
        note: `ms-contrast SPIKE eyes gate (close-up) · from ${lab.unitRef} — not a game world`,
        ground: { size: round(h * 16), cell: round(h / 2) },
        worldFraming: {
          cameraPosition: [round(gap * 0.45), round(-h * 1.5), round(h * 0.78)],
          lookAt: [gap, 0, round(h * 0.64)],
          horizontalFov: 45,
        },
        figures,
        entities,
      },
    },
  ];

  if (dryRun) { console.log('  dry-run: not minted'); continue; }
  for (const w of worlds) {
    try {
      SketchRepository.create({ title: w.manifest.title, manifest: w.manifest, ref: w.ref });
      console.log(`  minted ${w.ref}`);
    } catch (err) {
      if (/UNIQUE constraint failed/.test(err?.message || '')) {
        SketchRepository.update({ ref: w.ref, title: w.manifest.title, manifest: w.manifest });
        console.log(`  updated ${w.ref} in place`);
      } else throw err;
    }
    console.log(`  world  ${BASE_URL}/api/sketches/${encodeURIComponent(w.ref)}/world`);
  }
}
