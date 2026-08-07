#!/usr/bin/env node
// skull-study — render an animal HEAD as a TURNTABLE (azimuth sweep + top + under),
// cropped to the skull, so skull SHAPE can be checked from every angle. A single view
// hides the failure modes this catches (the open-tube hollow face only showed frontally;
// the pale interior scoop only showed at ¾; a lopsided muzzle only shows from above).
// Run, then Read the printed PNGs — that IS the check pass.
//
//   node .claude/skills/skull-study/study.mjs <subject> [<subject>...] [--recipe file.json] [--out dir]
//
//   <subject>  a ZOO_BUILDS species key (wolf, cougar, lion, deer, …)
//              OR a bare QUADRUPED_ARCHETYPES key (feline, canine, stumpy, …) → rendered
//              with neutral skin + coat so you see the raw archetype skull.
//   --recipe   an ad-hoc { archetype, opts } JSON (a head being TUNED, pre-graduation).
//              The file's basename (sans .json) names the subject. Repeatable.
//   --out      output dir (default /tmp/skull-study). SVGs → <out>/<subject>/svg,
//              PNGs → <out>/<subject>/png (the paths printed).
//
// The turntable: 7 azimuths front→back on one side (skulls are ~bilaterally symmetric,
// so one side suffices) + a top-down (dorsal skull + nasal bridge) + an under (muzzle/
// jaw underside). Elevations are gentle so the crop frames the head, not the neck.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const { renderAnimalToSvg } = await import(path.join(REPO, 'control/lib/graph/polygonizer/figure-render.js'));
const { ZOO_BUILDS } = await import(path.join(REPO, 'control/lib/graph/polygonizer/figure-animal-build.js'));
const { QUADRUPED_ARCHETYPES } = await import(path.join(REPO, 'control/lib/graph/polygonizer/figure-animal.js'));

// azimuth: 180 = front (head-on), 130 = three-quarter, 90 = lateral, 0 = back.
const TURNTABLE = [
  { file: '1-front',    view: 180, elev: 8 },
  { file: '2-front3q',  view: 155, elev: 10 },
  { file: '3-threeqtr', view: 130, elev: 12 },
  { file: '4-lateral',  view: 90,  elev: 6 },
  { file: '5-rear3q',   view: 45,  elev: 12 },
  { file: '6-back',     view: 0,   elev: 10 },
  { file: '7-top',      view: 180, elev: 78 },   // dorsal skull + nasal bridge
  { file: '8-under',    view: 180, elev: -38 },  // muzzle / jaw underside
];

// A neutral head recipe for a bare archetype (so the raw skull reads, no species paint).
const archetypeHead = (name) => ({
  archetype: name,
  opts: { skin: true, coat: { color: '#b3a488' }, underHex: '#e7ddc8', underCut: -0.38, face: true },
});

const args = process.argv.slice(2);
let out = '/tmp/skull-study';
const subjects = [];   // { name, recipe }
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') { out = args[++i]; continue; }
  if (a === '--recipe') {
    const file = args[++i];
    const recipe = JSON.parse(readFileSync(file, 'utf8'));
    subjects.push({ name: path.basename(file).replace(/\.json$/, ''), recipe });
    continue;
  }
  if (ZOO_BUILDS[a]) { subjects.push({ name: a, recipe: ZOO_BUILDS[a] }); continue; }
  if (QUADRUPED_ARCHETYPES[a]) { subjects.push({ name: a, recipe: archetypeHead(a) }); continue; }
  console.error(`skull-study: unknown subject "${a}" — not a ZOO_BUILDS species or an archetype. Known archetypes: ${Object.keys(QUADRUPED_ARCHETYPES).join(', ')}`);
  process.exit(1);
}
if (!subjects.length) {
  console.error('skull-study: no subject. Pass a species (wolf, cougar, …), an archetype (feline, …), or --recipe file.json');
  process.exit(1);
}

const pngPaths = [];
for (const { name, recipe } of subjects) {
  const svgDir = path.join(out, name, 'svg');
  mkdirSync(svgDir, { recursive: true });
  for (const v of TURNTABLE) {
    const svg = renderAnimalToSvg({ ...recipe, crop: 'head', view: v.view, elev: v.elev });
    writeFileSync(path.join(svgDir, `${v.file}.svg`), svg);
  }
  const pngDir = path.join(out, name, 'png');
  const ras = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), svgDir, '--out', pngDir], {
    cwd: REPO, encoding: 'utf8',
  });
  process.stdout.write(ras.stdout || '');
  if (ras.stderr) process.stderr.write(ras.stderr);
  console.log(`— skull-study: ${name} turntable → ${pngDir}`);
}
