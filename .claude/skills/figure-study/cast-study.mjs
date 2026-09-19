#!/usr/bin/env node
// cast-study — render the figure's PROPORTION casts (figure-cast.js) as a contact sheet, so the
// eyes gate on a cast is one command. Every preset (or a cast you pass) × sex × front·¾·lateral,
// plus a dressed ¾ so the tailoring is judged on the same body. Run, then Read the printed PNGs
// — that IS the eyes gate; nothing here claims it passed.
//
//   node .claude/skills/figure-study/cast-study.mjs [<preset>...] [--cast '{…}'] [--proto '{…}']
//                                                   [--pose '{…}'] [--garment <key>] [--no-dressed]
//                                                   [--sex male|female] [--out dir]
//
//   <preset>       which casts to render (default: every preset in CAST_PRESETS).
//   --cast         an extra cast, as JSON, rendered alongside them (label: 'custom').
//   --sweep        one dial across values, one row each: 'shoulderDrop=0,3,5,8'. Merged over
//                  --cast (or over `canonical`), so it sweeps a dial on whatever body you name.
//                  Prefix with `proto:` to sweep a MASS dial instead of a proportion one:
//                  'proto:weight=1,1.3,1.6,2' is the limb-mass sheet.
//   --proto        proto dials merged into every figure — the mass half of the read
//                  (a brute wants stockiness/chestWidth/bicep; a chibi wants headScale).
//   --garment      wardrobe key for the dressed column (default 'tee').
//   --sex          render one pole only (default both).
//   --out          output dir (default /tmp/cast-study).
//
// Heights are printed as a table because each panel is auto-FIT to its own figure: the sheet
// shows proportion honestly and stature not at all. Read the numbers for stature.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const P = (f) => path.join(REPO, 'control/lib/graph/polygonizer', f);
const { renderFigureToSvg, renderFigureWorldFrames } = await import(P('figure-render.js'));
const { CAST_PRESET_NAMES, CAST_PRESETS, resolveCast } = await import(P('figure-cast.js'));

const VIEWS = [{ file: 'frontal', view: 'frontal' }, { file: 'threeqtr', view: 'three-quarter' }, { file: 'lateral', view: 'lateral' }];

const args = process.argv.slice(2);
let out = '/tmp/cast-study', proto = {}, pose = {}, garment = 'tee', dressed = true, custom = null, sweep = null;
let sexes = null;
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') { out = args[++i]; continue; }
  if (a === '--proto') { proto = JSON.parse(args[++i]); continue; }
  if (a === '--pose') { pose = JSON.parse(args[++i]); continue; }
  if (a === '--cast') { custom = JSON.parse(args[++i]); continue; }
  if (a === '--sweep') {
    const [dial, vals] = args[++i].split('=');
    sweep = { dial, values: vals.split(',').map(Number) };
    continue;
  }
  if (a === '--garment') { garment = args[++i]; continue; }
  if (a === '--no-dressed') { dressed = false; continue; }
  if (a === '--sex') { sexes = [args[++i]]; continue; }
  if (!a.startsWith('--')) { names.push(a); continue; }
  console.error(`cast-study: unknown argument "${a}"`);
  process.exit(1);
}
if (!sexes) sexes = ['male', 'female'];
for (const n of names) {
  if (CAST_PRESETS[n]) continue;
  console.error(`cast-study: unknown preset "${n}" (have ${CAST_PRESET_NAMES.join(', ')})`);
  process.exit(1);
}
let casts = (names.length ? names : CAST_PRESET_NAMES).map((n) => ({ label: n, cast: n, add: null }));
if (custom) casts.push({ label: 'custom', cast: custom, add: null });
// A sweep replaces the preset rows with one row per value of the swept dial, over whatever
// body was named (a preset, a --cast, or the canonical figure). Prefix the dial with `proto:` to
// sweep a MASS dial instead of a proportion one — 'proto:weight=1,1.3,1.6,2' is the limb-mass
// sheet, and the cast stays whatever was named.
if (sweep) {
  const over = custom || (names.length ? names[0] : null);
  const isProto = sweep.dial.startsWith('proto:');
  const dial = isProto ? sweep.dial.slice(6) : sweep.dial;
  casts = sweep.values.map((v) => ({
    label: `${dial}=${v}`,
    cast: isProto ? (over || {}) : (over ? [over, { [dial]: v }] : { [dial]: v }),
    add: isProto ? { [dial]: v } : null,
  }));
}

const manifestFor = (cast, sex, view, wear, add) => ({
  kind: 'figure', cast, proto: { sex, ...proto, ...(add || {}) }, pose, view, ...(wear ? { garment: wear } : {}),
});
// Stature in STAND units off the world build, which plants every body on the same floor.
const heightOf = (cast, sex, add) => {
  const { frames } = renderFigureWorldFrames(manifestFor(cast, sex, 'frontal', null, add), 1);
  const z = frames[0].faces.flatMap((f) => f.corners.map((c) => c[2]));
  return Math.max(...z) - Math.min(...z);
};

const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const CW = 460, CH = 760;
const cols = VIEWS.length + (dressed ? 1 : 0);
const cells = [];
const table = [];
let row = 0;
for (const { label, cast, add } of casts) {
  for (const sex of sexes) {
    const svgDir = path.join(out, label, sex);
    mkdirSync(svgDir, { recursive: true });
    const panels = [...VIEWS.map((v) => ({ ...v, wear: null })), ...(dressed ? [{ file: `dressed-${garment}`, view: 'three-quarter', wear: garment }] : [])];
    panels.forEach((v, col) => {
      const svg = renderFigureToSvg(manifestFor(cast, sex, v.view, v.wear, add));
      writeFileSync(path.join(svgDir, `${v.file}.svg`), svg);
      cells.push(`<svg x="${col * CW}" y="${row * CH}" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">${inner(svg)}</svg>`);
      cells.push(`<text x="${col * CW + 10}" y="${row * CH + CH - 12}" font-family="monospace" font-size="18" fill="#444">${label} · ${sex} · ${v.file}</text>`);
    });
    row++;
    const h = heightOf(cast, sex, add);
    const r = resolveCast(cast);
    table.push({ cast: label, sex, height: h.toFixed(3), leg: r.thigh * 0.22 + r.shank * 0.23436, arm: r.upperArm * 0.18173 + r.forearm * 0.15524, shoulderSpan: r.shoulderSpan });
  }
}
const W = CW * cols, H = CH * row;
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${cells.join('\n')}</svg>`);
const sheet = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
process.stdout.write(sheet.stdout || '');
if (sheet.stderr) process.stderr.write(sheet.stderr);

console.log('\ncast          sex      height   leg     arm     ape    shoulderSpan');
for (const t of table) {
  console.log(`${t.cast.padEnd(13)} ${t.sex.padEnd(8)} ${t.height.padStart(6)}  ${t.leg.toFixed(3)}  ${t.arm.toFixed(3)}  ${(t.arm / t.leg).toFixed(3)}  ${t.shoulderSpan}`);
}
console.log(`\n— cast-study: ${casts.map((c) => c.label).join(' + ')} → ${out} (per-cast SVGs under <cast>/<sex>, the sheet above)`);
