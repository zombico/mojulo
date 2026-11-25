#!/usr/bin/env node
/**
 * import-corpus — sweep the import corpus (lib/graph/import/corpus.js): open 3D files people bring, pinned by hash,
 * fetched into a cache on THIS machine and never into the repository, each read through the import and held to its
 * label. It writes docs/import-corpus.md, the measured reach of the import.
 *
 *   node scripts/import-corpus.mjs [--fetch] [--only id,id] [--add <folder>] [--dir <cache>] [--no-write]
 *
 *   --fetch      download what is missing or changed (plain HTTPS; a hash that does not match is reported, the file kept
 *                out); without it only what is already cached is swept
 *   --only       sweep these rows
 *   --add        also sweep every model file in a folder (the ones a desktop downloads by hand: Kenney, Quaternius,
 *                Poly Pizza), labelled from their folder's name when it is a class (body/, mascot/, creature/, prop/)
 *   --dir        the cache (default: $MOJULO_HOME/cache/import-corpus)
 *   --no-write   print the table, write no page
 *
 * Run from control/. Nothing here is a test: a test never fetches (lib/graph/import/*.test.js build their own files).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const home = process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
const cacheDir = path.resolve(opt('--dir') || path.join(home, 'cache', 'import-corpus'));
const only = opt('--only')?.split(',') ?? null;

const { CORPUS, CORPUS_CLASSES } = await import('../lib/graph/import/corpus.js');
const { readModelPath } = await import('../lib/graph/import/read-path.js');
const { assessModel } = await import('../lib/graph/import/assess.js');
const { stripSkin, autoRig } = await import('../lib/graph/import/autorig.js');
const { importRig } = await import('../lib/graph/scene/rig-import.js');
const { poseStretch } = await import('../lib/graph/import/rig-gate.js');

const sha = (b) => createHash('sha256').update(b).digest('hex');

async function fetchFile(url, dest, want) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return `HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha(buf);
  if (want && got !== want) return `hash changed upstream (${got.slice(0, 12)}…, pinned ${want.slice(0, 12)}…): re-pin it in corpus.js`;
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return null;
}

async function ensure(row) {
  const dir = path.join(cacheDir, row.id);
  const problems = [];
  for (const [name, f] of Object.entries(row.files)) {
    const dest = path.join(dir, ...name.split('/'));
    const ok = existsSync(dest) && (!f.sha256 || sha(readFileSync(dest)) === f.sha256);
    if (ok) continue;
    if (!flag('--fetch')) { problems.push(`${name} not cached (--fetch)`); continue; }
    const e = await fetchFile(f.url, dest, f.sha256).catch((err) => err.message);
    if (e) problems.push(`${name}: ${e}`);
  }
  return { dir, problems };
}

const pad = (s, n) => String(s).padEnd(n);
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');

async function sweep(label, file, expect) {
  const t = Date.now();
  const out = { id: label, expect, read: null, format: '', tris: '', height: '', class: '', rig: '', note: '' };
  let glb;
  try {
    const r = await readModelPath(file);
    glb = r.bytes; out.format = r.from.format; out.read = 'ok';
    if (r.ledger.notes.length) out.note = r.ledger.notes.join('; ');
  } catch (e) { out.read = 'refused'; out.note = e.message.replace(/^import: /, ''); out.ms = Date.now() - t; return out; }
  try {
    const a = await assessModel(glb, { name: path.basename(file) });
    out.tris = a.inspect.triangles; out.height = a.height; out.class = a.class?.class ?? '';
    out.heads = a.class?.headsTall ?? '';
    out.rig = a.rig.ok ? a.rig.how : `✗ ${a.rig.how ?? ''}`.trim();
    if (a.rig.gate) out.gate = `${a.rig.gate.verdict} ${(100 * a.rig.gate.torn).toFixed(1)}%`;
    if (!a.rig.ok && a.rig.error) out.note = [out.note, a.rig.error].filter(Boolean).join('; ');
    if (a.units?.ambiguous) out.note = [out.note, `units: ${a.units.basis}`].filter(Boolean).join('; ');
  } catch (e) { out.note = [out.note, `assess: ${e.message}`].filter(Boolean).join('; '); }
  out.ms = Date.now() - t;
  return out;
}

const rows = [];
for (const row of CORPUS) {
  if (only && !only.includes(row.id)) continue;
  const { dir, problems } = await ensure(row);
  if (problems.length) { rows.push({ id: row.id, expect: row.expect, read: 'missing', note: problems.join('; '), row }); continue; }
  rows.push({ ...(await sweep(row.id, path.join(dir, ...row.entry.split('/')), row.expect)), row });
}
const added = opt('--add');
if (added) {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(path.resolve(added)).filter((f) => /\.(glb|vrm|gltf|obj|stl|3mf|fbx|dae|ply|zip)$/i.test(f)).sort()) {
    const cls = path.basename(path.dirname(f));
    rows.push(await sweep(path.relative(path.resolve(added), f), f, { class: CORPUS_CLASSES.includes(cls) ? cls : null, rig: null }));
  }
}

// ── the verdicts: each row against its label ──
const rigOk = (r) => {
  const want = r.expect?.rig;
  if (!want) return null;
  if (want === 'refused') return r.read === 'refused';
  if (want === 'none') return r.read === 'ok' && !/^(name|shape|file|auto)/.test(r.rig);
  return r.read === 'ok' && r.rig === want;
};
const classOk = (r) => (r.expect?.class && r.read === 'ok' ? r.class === r.expect.class : null);
for (const r of rows) { r.rigOk = rigOk(r); r.classOk = classOk(r); }

// ── strip and score: each humanoid the corpus rigs by its own skeleton, its skeleton taken away and auto-rigged, its
// fitted joints measured against the artist's (in shares of its height) and both rigs put through the machine gate ──
const JOINTS = ['pelvis', 'neck', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shankL', 'footL', 'thighR', 'shankR', 'footR'];
const scored = [];
for (const r of rows) {
  if (r.read !== 'ok' || !/^(name|shape|file)$/.test(r.rig)) continue;
  const file = path.join(cacheDir, r.row.id, ...r.row.entry.split('/'));
  try {
    const glb = (await readModelPath(file)).bytes;
    const truth = importRig(glb).pack;
    const fitted = autoRig(stripSkin(glb));
    const mine = importRig(fitted.bytes).pack;
    const H = truth.figH;
    const errs = JOINTS.map((id) => { const a = truth.bones.find((b) => b.id === id)?.head, b = mine.bones.find((x) => x.id === id)?.head; return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / H : null; }).filter((v) => v !== null);
    const worst = JOINTS.map((id, i) => [id, i]).map(([id]) => { const a = truth.bones.find((b) => b.id === id)?.head, b = mine.bones.find((x) => x.id === id)?.head; return [id, a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / H : 0]; }).sort((x, y) => y[1] - x[1])[0];
    scored.push({ id: r.id, cls: fitted.class, mean: errs.reduce((x, y) => x + y, 0) / errs.length, worst, artist: poseStretch(truth), auto: poseStretch(mine) });
  } catch (e) { scored.push({ id: r.id, error: e.message.replace(/^import: /, '') }); }
}
const pct = (v) => `${(100 * v).toFixed(1)}%`;
console.log('\nstrip and score (the skeleton taken away, auto-rigged, against the artist\'s):');
for (const s of scored) console.log(`  ${pad(s.id, 18)} ${s.error ? `✗ ${s.error.slice(0, 100)}` : `${pad(s.cls, 7)} joints off by ${pad(pct(s.mean), 6)} (worst ${s.worst[0]} ${pct(s.worst[1])})  torn: artist ${pad(pct(s.artist.torn), 6)} auto ${pct(s.auto.torn)} ${s.auto.verdict}`}`);

const mark = (v) => (v === null ? '·' : v ? '✓' : '✗');
console.log(`${pad('id', 20)} ${pad('read', 8)} ${pad('fmt', 5)} ${pad('tris', 7)} ${pad('height', 9)} ${pad('class', 9)} ${pad('heads', 6)} ${pad('rig', 10)} ${pad('gate', 12)} note`);
for (const r of rows) console.log(`${pad(r.id, 20)} ${pad(r.read, 8)} ${pad(r.format ?? '', 5)} ${pad(r.tris ?? '', 7)} ${pad(r.height ?? '', 9)} ${pad(`${r.class ?? ''}${r.classOk === false ? '✗' : ''}`, 9)} ${pad(r.heads ?? '', 6)} ${pad(`${r.rig ?? ''}${r.rigOk === false ? ' ✗' : ''}`, 10)} ${pad(r.gate ?? '', 12)} ${(r.note || '').slice(0, 90)}`);
const judged = (k) => rows.filter((r) => r[k] !== null && r[k] !== undefined);
const score = (k) => `${judged(k).filter((r) => r[k]).length}/${judged(k).length}`;
console.log(`\nrig as labelled ${score('rigOk')} · class as labelled ${score('classOk')} · read ${rows.filter((r) => r.read === 'ok').length}/${rows.length}`);

if (!flag('--no-write') && !added && !only && rows.every((r) => r.read !== 'missing')) {
  const lines = [
    '# The import corpus',
    '',
    '<!-- Generated by `node scripts/import-corpus.mjs` from `lib/graph/import/corpus.js`. Do not edit by hand. -->',
    '',
    'Open 3D files people bring, pinned by hash, swept through the import (`lib/graph/import/`): read into the canonical',
    'GLB, measured, classed, and brought to move. The files are fetched into a cache on the machine that sweeps them and',
    'are never committed: they are other people\'s work, under the terms in the last column. A file a site turns an',
    'automated client away from (Kenney, Poly Pizza, Thingiverse) is swept from a desktop with `--add <folder>`.',
    '',
    `Rig as labelled: ${score('rigOk')}. Class as labelled: ${score('classOk')}.`,
    '',
    '| file | source | tests | read | triangles | height | class | heads tall | rig | machine gate | as labelled | licence |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${cell(r.row.source)} | ${cell(r.row.tests)} | ${r.read === 'ok' ? r.format : `refused${r.note ? `: ${cell(r.note.split(':')[0])}` : ''}`} | ${r.tris ?? ''} | ${r.height ?? ''} | ${r.class || '·'}${r.classOk === false ? ` (labelled ${r.expect.class})` : ''} | ${r.heads ?? ''} | ${r.rig || '·'} | ${r.gate ?? '·'} | ${mark(r.rigOk)}${mark(r.classOk)} | ${cell(r.row.licence.name)} |`),
    '',
    '## Strip and score',
    '',
    'Each humanoid above that rigs by its own skeleton, its skeleton taken away (`stripSkin`) and fitted onto the vajra',
    '(`autoRig`): its fitted joints against the artist\'s, as a share of its height (the mean over the pelvis, neck,',
    'head and the limbs\' joints, and the worst), and both rigs through the machine gate.',
    '',
    '| file | read as | joints off (mean) | worst joint | torn, artist\'s rig | torn, auto-rig | gate |',
    '|---|---|---|---|---|---|---|',
    ...scored.map((s) => (s.error ? `| ${s.id} | refused: ${cell(s.error)} | | | | | |` : `| ${s.id} | ${s.cls} | ${pct(s.mean)} | ${s.worst[0]} ${pct(s.worst[1])} | ${pct(s.artist.torn)} | ${pct(s.auto.torn)} | ${s.auto.verdict} |`)),
    '',
    'Rig: `name` by its joints\' names, `shape` by its skeleton\'s shape, `file` by the file\'s own humanoid map (VRM),',
    '`auto` fitted onto the vajra, `none` placed as it is. Machine gate: the rig posed through the bends a character',
    'makes (`lib/graph/import/rig-gate.js`), the share of its triangles torn; it advises, it never refuses, and the eyes',
    'gate (a person watching it move) is not claimed. Height: in the file\'s own units, read as metres unless they say',
    'otherwise. As labelled: the rig, then the class, against the row\'s label.',
    '',
  ];
  writeFileSync(path.resolve('..', 'docs', 'import-corpus.md'), lines.join('\n'));
  console.log('wrote ../docs/import-corpus.md');
}
