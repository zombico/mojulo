#!/usr/bin/env node
// head-study — render the protoform HUMAN head as a TURNTABLE (azimuth sweep + top + under),
// cropped to the head, for both sexes, filled and as the blueprint ring-wave wireframe — so a
// skull reads from EVERY angle, not just the one a body study shows. The human sibling of
// /skull-study. Run, then Read the printed PNGs — that IS the eyes gate.
//
//   node .claude/skills/head-study/study.mjs [male] [female] [--proto '{…}'] [--pose '{…}']
//                                            [--hair <wig>] [--no-wire] [--out dir]
//
//   male / female   which poles to render (default both).
//   --proto         extra `proto` dials merged over the pole (headScale, browRidge, jawWidth,
//                   chinPoint, noseSize, cheekbone, foreheadSlope, neckGirth …).
//   --pose          a `pose` spec — e.g. '{"face":{"jaw":20}}' opens the jaw; head/neck DOF too.
//   --hair          seat a wig on the head (checks the scalp reader on the new skull; hats are not
//                   a figure-manifest channel — hat.js is exercised by figure-head.test.js directly).
//   --no-wire       skip the wireframe row.
//   --out           output dir (default /tmp/head-study). Per sex: <out>/<sex>/svg, <out>/<sex>/png,
//                   plus <out>/sheet.svg|png — every view of every sex on ONE contact sheet.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const { renderFigureToSvg } = await import(path.join(REPO, 'control/lib/graph/polygonizer/figure-render.js'));

// The same eight angles /skull-study uses. view = azimuth degrees (0 = face-on), elev = degrees.
const TURNTABLE = [
  { file: '1-front',    view: 0,   elev: 6 },
  { file: '2-front3q',  view: 25,  elev: 8 },
  { file: '3-threeqtr', view: 45,  elev: 10 },
  { file: '4-lateral',  view: 90,  elev: 4 },
  { file: '5-rear3q',   view: 135, elev: 10 },
  { file: '6-back',     view: 180, elev: 8 },
  { file: '7-top',      view: 20,  elev: 74 },    // crown, brow line, cheek width
  { file: '8-under',    view: 20,  elev: -50 },   // jaw, chin, the closed underside
];

const args = process.argv.slice(2);
let out = '/tmp/head-study', proto = {}, pose = {}, hair = null, wire = true;
const sexes = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') { out = args[++i]; continue; }
  if (a === '--proto') { proto = JSON.parse(args[++i]); continue; }
  if (a === '--pose') { pose = JSON.parse(args[++i]); continue; }
  if (a === '--hair') { hair = args[++i]; continue; }
  if (a === '--no-wire') { wire = false; continue; }
  if (a === 'male' || a === 'female') { sexes.push(a); continue; }
  console.error(`head-study: unknown argument "${a}"`);
  process.exit(1);
}
if (!sexes.length) sexes.push('male', 'female');

const manifestFor = (sex, v, setup) => ({
  kind: 'figure', proto: { sex, ...proto }, pose, view: v.view, elev: v.elev, crop: 'head',
  ...(hair ? { hair } : {}), ...(setup ? { setup } : {}),
});
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const CW = 560, CH = 760;
const cells = [];
let row = 0;
for (const sex of sexes) {
  const svgDir = path.join(out, sex, 'svg');
  mkdirSync(svgDir, { recursive: true });
  for (const setup of wire ? [null, 'blueprint-wire'] : [null]) {
    TURNTABLE.forEach((v, col) => {
      const svg = renderFigureToSvg(manifestFor(sex, v, setup));
      if (!setup) writeFileSync(path.join(svgDir, `${v.file}.svg`), svg);
      else writeFileSync(path.join(svgDir, `${v.file}-wire.svg`), svg);
      cells.push(`<svg x="${col * CW}" y="${row * CH}" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">${inner(svg)}</svg>`);
      cells.push(`<text x="${col * CW + 10}" y="${row * CH + CH - 12}" font-family="monospace" font-size="20" fill="${setup ? '#9fd' : '#444'}">${sex} · ${v.file}${setup ? ' · wire' : ''}</text>`);
    });
    row++;
  }
  const pngDir = path.join(out, sex, 'png');
  const ras = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), svgDir, '--out', pngDir], { cwd: REPO, encoding: 'utf8' });
  if (ras.stderr) process.stderr.write(ras.stderr);
}
const W = CW * TURNTABLE.length, H = CH * row;
writeFileSync(path.join(out, 'sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${cells.join('\n')}</svg>`);
const sheet = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
process.stdout.write(sheet.stdout || '');
if (sheet.stderr) process.stderr.write(sheet.stderr);
console.log(`— head-study: ${sexes.join(' + ')} → ${out} (per-view PNGs under <sex>/png, the sheet above)`);
