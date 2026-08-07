/**
 * Pose an assembled BIPED unit: derive its vajra rig from the station names +
 * geometry, compile a pose (figure-posing language or raw dof) into a posed
 * sibling manifest, validate through planAssembler, and mint it. The posed unit
 * is a plain assembler sketch — /world, /png, .glb, livery recolor, and the
 * skin seam all work on it unchanged.
 *
 * Rig + compiler: lib/graph/worlds/unit-pose.js. Kinematics + limits:
 * lib/graph/polygonizer/figure-vajra.js (articulateTransforms).
 *
 *   cd control
 *   node scripts/pose-unit.mjs --list                      # show pose presets
 *   node scripts/pose-unit.mjs --rig                       # print the derived rig, no mint
 *   node scripts/pose-unit.mjs --pose salute               # preset pose on the v78 reference
 *   node scripts/pose-unit.mjs <ref> --pose '{"elbowR":90}'  # any unit, any spec
 *   node scripts/pose-unit.mjs --pose stride --dry-run     # compile + validate only
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { planAssembler } from '../lib/graph/worlds/workbench-assembler.js';
import { deriveBipedRig, compileUnitPose } from '../lib/graph/worlds/unit-pose.js';

const REFERENCE_UNIT = 'sk_80str_modular_frame_fit_v78_raised_chest_vents';
const BASE_URL = 'http://127.0.0.1:3001';

// Named pose presets in the figure-posing intent language (anatomical sides:
// armR = the unit's right arm, wherever the authored _l/_r labels ended up).
const PRESETS = {
  salute: { armR: ['forward', 'up'], elbowR: 110 },
  stride: {
    legL: ['forward', 'down'], legR: ['back', 'down'], kneeR: 30,
    armR: ['forward', 'down'], armL: ['back', 'down'], elbowL: 25, elbowR: 25,
  },
  guard: {
    armL: ['forward', 'inward'], elbowL: 100,
    armR: ['forward', 'down'], elbowR: 60,
    spine: { twist: ['right', 0.3] },
  },
};

// ---- args ----
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const flagValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const consumed = new Set([flagValue('--pose'), flagValue('--ref'), flagValue('--title')]);
const sourceRef = argv.find((a) => !a.startsWith('--') && !consumed.has(a)) || REFERENCE_UNIT;

if (flags.has('--list')) {
  for (const [name, spec] of Object.entries(PRESETS)) console.log(`${name.padEnd(8)} ${JSON.stringify(spec)}`);
  process.exit(0);
}

const source = SketchRepository.getByRef(sourceRef);
if (!source?.manifest) {
  console.error(`Source sketch '${sourceRef}' not found (or has no manifest).`);
  process.exit(1);
}
if (source.manifest.kind !== 'assembler') {
  console.error(`Source '${sourceRef}' is kind '${source.manifest.kind}' — unit posing works on assembled units (kind 'assembler').`);
  process.exit(1);
}

if (flags.has('--rig')) {
  const rig = deriveBipedRig(source.manifest);
  const byBone = {};
  for (const s of rig.stations) (byBone[s.bone] ||= []).push(s.key);
  console.log(`${sourceRef} — model ${rig.model}, facing ${rig.facing}\n`);
  for (const [bone, keys] of Object.entries(byBone)) console.log(`  ${bone.padEnd(10)} ${keys.join(' ')}`);
  console.log('\n  joints (rig frame, +y forward):');
  for (const [name, p] of Object.entries(rig.joints)) {
    console.log(`    ${name.padEnd(10)} [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`);
  }
  if (rig.warnings) console.log(`\n  warnings: ${rig.warnings.join(' · ')}`);
  process.exit(0);
}

const poseArg = flagValue('--pose');
if (!poseArg) {
  console.error('Pass --pose <preset|json> (see --list), or --rig to inspect the derived rig.');
  process.exit(1);
}
const poseName = PRESETS[poseArg] ? poseArg : 'custom';
let pose;
try {
  pose = PRESETS[poseArg] || JSON.parse(poseArg);
} catch {
  console.error(`--pose '${poseArg}' is neither a preset (${Object.keys(PRESETS).join(', ')}) nor valid JSON.`);
  process.exit(1);
}

const { manifest, report } = compileUnitPose(source.manifest, pose);
manifest.title = flagValue('--title') || `${source.title} - pose: ${poseName}`;
manifest.note = `posed from ${sourceRef} · pose=${poseName === 'custom' ? JSON.stringify(pose) : poseName} · unit-pose v1`;
const { stats } = planAssembler(manifest);   // same validation gate as create_assembler

console.log(`pose ${poseName}: moved bones [${report.movedBones.join(', ')}], `
  + `${stats.items} parts, ground shift ${report.groundShift}`
  + (report.warnings ? `\n  rig warnings: ${report.warnings.join(' · ')}` : ''));

if (flags.has('--dry-run')) {
  console.log('  dry-run: valid — not minted');
  process.exit(0);
}

const ref = flagValue('--ref') || `${sourceRef}_pose_${poseName === 'custom' ? 'custom' : poseName}`;
let sketch;
try {
  sketch = SketchRepository.create({ title: manifest.title, manifest, ref });
} catch (err) {
  if (/UNIQUE constraint failed/.test(err?.message || '')) {
    console.error(`  ref '${ref}' already exists — pass --ref to choose another.`);
    process.exit(1);
  }
  throw err;
}
console.log(`  minted ${sketch.ref}`);
console.log(`  world  ${BASE_URL}/api/sketches/${encodeURIComponent(sketch.ref)}/world`);
console.log(`  png    ${BASE_URL}/api/sketches/${encodeURIComponent(sketch.ref)}/png?inline=1`);
