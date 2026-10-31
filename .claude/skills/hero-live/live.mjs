#!/usr/bin/env node
// hero-live — the HERO as an engine plays it: each variant minted through the door (create_character), exported as the
// skinned GLB (export_model: every clip, the face's morph weights keyed into the body's), and written beside a viewer page
// (viewer.html) that plays it: orbit, the takes, a scrubber, every morph channel live or held by hand, wireframe, bones,
// and what the mint read back (warnings, the armour's adornment verdicts, the clearance). The eyes lane for the face rig,
// the clips and the dress on a moving body; the machine read is printed per variant.
//
//   node .claude/skills/hero-live/live.mjs [--hero '<json>'] [--armour knight,aka] [--variants '<json>']
//                                          [--clips '<json>' | --clips none] [--out dir] [--jobs n] [--publish]
//                                          [--serve [port]] [--reuse]
//
//   --hero      the hero spec every variant starts from (the door's own); default a realistic female, seed 11, framed
//               close at 1080p (the one-skin head's top rung)
//   --as        the door every variant mints through (create_character's `as`; default hero): a mascot plays here too
//               (--as mascot --hero '{"brief":"raccoon"}' --clips none: its own clips); a variant's `as` overrides it
//   --armour    armour styles (lib/graph/armor/styles.js SEEDED_ARMOR: knight, aka, kuro-kon, shiro …): one variant each,
//               adorn: { type: 'armor', style }, after the bare hero
//   --variants  more variants, a list of { "id"?, "label", "spec": { … } }: each spec merged over --hero (an armour
//               round: { "label": "knight r1", "spec": { "adorn": { "type": "armor", "style": "knight",
//               "dials": { "ornament": 3 }, "wear": ["gorget"] } } })
//   --clips     the door clips every variant carries ({ <name>: [keys] }, hero-gesture.js); default greet, surprise and
//               frown, whose keys carry the western face words and jaw degrees (the landmark and relational heads';
//               the anime head takes its own words: pass --clips for it, or none)
//   --out       output dir (default <tmp>/hero-live): index.html, <id>.glb (or <id>.json with --publish),
//               <id>.read.json, vendor/three (the control plane's three, so the page runs offline)
//   --jobs      variants minted at once (default 2; each mint is one process)
//   --publish   pack each GLB as base64 JSON (gzipped first) and load three from its pinned CDN build: what an artifact host serves
//   --serve     serve the out dir on 127.0.0.1 (default port 8765) after writing it
//   --reuse     keep a variant whose <id>.glb and <id>.read.json are already in --out (iterate on the page alone)
//
// Drive it from a script through window.heroLive (shot.mjs does): variant(id), take(name), view('vFace'|'vBust'|'vBody'|'vSide'|'vBodySide'|'vBack'),
// seek(phase), pause(bool), hold({ morph: weight }), state().
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '../../../control');
const THREE_CDN = '0.184.0';   // the vendored revision (lib/graph/scene/emit-util.js CDN_THREE_VERSION)

// ─── the default take set: each key a stand pose plus the face (a western word or its channels) and the jaw; a key's
// `head` is the skull's axis (atlas to crown, z up, y forward), so a nod is a little y, never a gaze direction ──────
const R = { elbowL: 'slight', elbowR: 'slight' }, UP = { shR: { yaw: -45, pitch: 90, roll: 90 } };
const SMILE = { word: 'smile', mouthCorner: 0.01 };
const DEFAULT_CLIPS = {
  greet: [
    { ...R, face: 'neutral' },
    { ...R, head: { x: 0.12, y: 0.1, z: 0.99 }, face: { word: 'smile', browRaise: 0.011 } },
    { ...R, ...UP, elbowR: 100, head: { x: 0.12, y: -0.06, z: 0.99 }, jaw: 7, face: { ...SMILE, browRaise: 0.008 } },
    { ...R, ...UP, elbowR: 78, jaw: 2, face: SMILE },
    { ...R, ...UP, elbowR: 118, jaw: 8, face: SMILE },
    { ...R, ...UP, elbowR: 85, jaw: 1, face: SMILE },
    { ...R, head: { x: 0.05, y: 0.08, z: 1 }, face: { word: 'smile', mouthCorner: 0.005 } },
  ],
  surprise: [
    { ...R, face: 'neutral' },
    { ...R, spine: { arch: 0.12 }, head: { x: 0, y: -0.16, z: 0.99 }, elbowL: 'half', elbowR: 'half', jaw: 12, face: { word: 'surprised', browRaise: 0.014 } },
    { ...R, spine: { arch: 0.08 }, head: { x: 0, y: -0.1, z: 0.99 }, jaw: 9, face: { word: 'surprised', browRaise: 0.012 } },
    { ...R, head: { x: -0.08, y: 0.02, z: 1 }, face: { word: 'smile', mouthCorner: 0.007, browRaise: 0.004 } },
  ],
  frown: [
    { ...R, face: 'neutral' },
    { ...R, head: { x: 0, y: 0.17, z: 0.98 }, crouch: 0.02, face: { word: 'determined', browRaise: -0.009, browTilt: 0.011, mouthCorner: -0.005 } },
    { ...R, head: { x: 0.1, y: 0.15, z: 0.98 }, face: { word: 'determined', browRaise: -0.01, browTilt: 0.012, mouthCorner: -0.006 } },
    { ...R, face: 'neutral' },
  ],
};
const DEFAULT_HERO = { form: 'realistic', cast: 'female', face: { seed: 11, ethnicity: 'western' }, target: { resolution: '1080p', framing: 'close' } };
// (a door clip plays its keys at this pace; the figure's own clips keep the viewer's)
const KEY_SECONDS = 0.7;

// ─── the worker: one variant minted and exported (a process of its own, so variants mint side by side) ─────────────
if (process.argv[2] === '--worker') {
  const { spec, id, out, as = 'hero' } = JSON.parse(process.argv[3]);
  register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
  process.chdir(CONTROL);
  process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
  process.env.MOJULO_OUTCOMES_DIR = path.join(out, '.outcomes', id);
  process.env.MOJULO_FACE_RIG_DIR ??= path.join(os.tmpdir(), 'hero-live', 'face-rig');
  const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character.js');
  const { exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export.js');
  const t0 = Date.now();
  const minted = await createCharacterHandler({ as, spec });
  if (!minted.ok) { console.error(`${id}: the door refused: ${JSON.stringify(minted.error ?? minted).slice(0, 1200)}`); process.exit(1); }
  const glb = await exportModelHandler({ ref: minted.ref, format: 'glb', clips: '_all', skinned: true, lit: true });
  if (!glb.ok) { console.error(`${id}: the export refused: ${JSON.stringify(glb.error ?? glb).slice(0, 1200)}`); process.exit(1); }
  copyFileSync(glb.path, path.join(out, `${id}.glb`));
  const H = minted.hero ?? {}, D = H.dress ?? {};
  const read = { ref: minted.ref, seconds: Math.round((Date.now() - t0) / 1000), warnings: H.warnings ?? [],
    ...(D.armor || D.adornments ? { adorn: { ...(D.armor ? { armor: D.armor } : {}), ...(D.unworn ? { unworn: D.unworn } : {}), ...(D.adornments ? { verdicts: D.adornments.map((a) => `${a.id}: ${a.verdict} (exposed ${a.exposed}, share ${a.share})`) } : {}), ...(D.clearance ? { sinking: D.clearance.sinking } : {}) } } : {}),
    ...(D.outline ? { outline: D.outline } : {}), ...(D.stylism?.notes ? { notes: D.stylism.notes } : {}) };
  writeFileSync(path.join(out, `${id}.read.json`), JSON.stringify(read, null, 1));
  process.exit(0);
}

// ─── arguments ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]; if (!a.startsWith('--')) throw new Error(`hero-live: unexpected '${a}'`);
  const k = a.slice(2), v = argv[i + 1];
  if (['publish', 'reuse'].includes(k)) opt[k] = true;
  else if (k === 'serve') { opt.serve = v && /^\d+$/.test(v) ? Number(argv[++i]) : 8765; }
  else if (['hero', 'as', 'armour', 'armor', 'variants', 'clips', 'out', 'jobs'].includes(k)) { if (v === undefined) throw new Error(`hero-live: --${k} takes a value`); opt[k === 'armor' ? 'armour' : k] = v; i++; }
  else throw new Error(`hero-live: unknown option --${k}`);
}
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'hero-live'));
const hero = opt.hero ? JSON.parse(opt.hero) : DEFAULT_HERO;
const clips = opt.clips === 'none' ? null : opt.clips ? JSON.parse(opt.clips) : DEFAULT_CLIPS;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'v';
const as = opt.as ?? 'hero';
const variants = [{ id: 'bare', label: 'Bare', spec: hero, as }];
for (const style of (opt.armour ?? '').split(',').map((s) => s.trim()).filter(Boolean)) variants.push({ id: slug(style), label: `${style} armour`, spec: { ...hero, adorn: { type: 'armor', style } } });
for (const v of opt.variants ? JSON.parse(opt.variants) : []) variants.push({ id: slug(v.id ?? v.label), label: v.label ?? v.id, as: v.as ?? as, spec: { ...(v.as && v.as !== as ? {} : hero), ...v.spec } });
if (new Set(variants.map((v) => v.id)).size !== variants.length) throw new Error(`hero-live: two variants share an id (${variants.map((v) => v.id).join(', ')})`);
for (const v of variants) if (clips) v.spec = { ...v.spec, clips: { ...clips, ...(v.spec.clips || {}) } };
mkdirSync(out, { recursive: true });

// ─── mint: the variants as workers, `--jobs` at a time ──────────────────────
const jobs = Math.max(1, Number(opt.jobs ?? 2));
const todo = variants.filter((v) => !(opt.reuse && existsSync(path.join(out, `${v.id}.glb`)) && existsSync(path.join(out, `${v.id}.read.json`))));
const failed = [];
const runOne = (v) => new Promise((resolve) => {
  console.log(`minting ${v.label} …`);
  const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', JSON.stringify({ spec: v.spec, id: v.id, out, as: v.as ?? 'hero' })], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => { if (code) { failed.push(v.id); console.error(err.trim().split('\n').filter((l) => !/ExperimentalWarning|--trace-warnings/.test(l)).slice(-6).join('\n')); } resolve(); });
});
for (let i = 0; i < todo.length; i += jobs) await Promise.all(todo.slice(i, i + jobs).map(runOne));
const made = variants.filter((v) => !failed.includes(v.id));
if (!made.length) { console.error('hero-live: no variant minted'); process.exit(1); }

// ─── the machine read, per variant ──────────────────────────────────────────
for (const v of made) {
  v.read = JSON.parse(readFileSync(path.join(out, `${v.id}.read.json`), 'utf8'));
  v.mb = +(statSync(path.join(out, `${v.id}.glb`)).size / 1e6).toFixed(1);
  const A = v.read.adorn, tally = {};
  for (const line of A?.verdicts ?? []) { const w = line.split(': ')[1].replace(/ \(.*$/, ''); tally[w] = (tally[w] ?? 0) + 1; }
  console.log(`\n${v.label} (${v.read.ref}, ${v.mb} MB, ${v.read.seconds} s)`);
  if (A?.armor) console.log(`  armour ${A.armor.style} (${A.armor.family}), dials ${JSON.stringify(A.armor.dials)}, focal ${A.armor.focal}`);
  if (A?.verdicts) console.log(`  adornments: ${Object.entries(tally).map(([w, n]) => `${n} ${w}`).join(', ')}`);
  if (A?.unworn?.length) console.log(`  refitted or left off on this body (not scored): ${A.unworn.join(', ')}`);
  if (A?.sinking?.length) console.log(`  sinking at some dial extreme: ${A.sinking.length} (${A.sinking.slice(0, 6).join(', ')}${A.sinking.length > 6 ? ' …' : ''})`);
  const other = v.read.warnings.filter((w) => !/^adornment /.test(w));
  console.log(`  warnings: ${v.read.warnings.length} (${v.read.warnings.length - other.length} adornment)`);
  for (const w of other) console.log(`    - ${w.length > 200 ? `${w.slice(0, 200)}…` : w}`);
}

// ─── the page ───────────────────────────────────────────────────────────────
// (gzipped before its base64, the browser's DecompressionStream undoing it: a realistic hero's GLB, its morph targets and
// clips, runs past an artifact host's file limit as base64 alone)
if (opt.publish) for (const v of made) writeFileSync(path.join(out, `${v.id}.json`), JSON.stringify({ gz: true, glb: gzipSync(readFileSync(path.join(out, `${v.id}.glb`))).toString('base64') }));
else {
  // (the control plane's own three, copied beside the page: it runs with no network)
  const V = path.join(CONTROL, 'public/vendor/three');
  for (const f of ['three.core.min.js', 'three.module.min.js', 'addons/loaders/GLTFLoader.js', 'addons/controls/OrbitControls.js', 'addons/utils/BufferGeometryUtils.js', 'addons/utils/SkeletonUtils.js']) {
    mkdirSync(path.dirname(path.join(out, 'vendor/three', f)), { recursive: true }); copyFileSync(path.join(V, f), path.join(out, 'vendor/three', f));
  }
}
const seconds = clips ? Object.fromEntries(Object.entries(clips).filter(([, k]) => Array.isArray(k) || Array.isArray(k?.keys)).map(([n, k]) => [n, +Math.max(1.6, ((Array.isArray(k) ? k : k.keys).length - 1) * KEY_SECONDS).toFixed(2)])) : {};
const manifest = { packed: !!opt.publish, firstTake: clips ? Object.keys(clips)[0] : null, seconds,
  variants: made.map((v) => ({ id: v.id, label: v.label, file: `${v.id}.${opt.publish ? 'json' : 'glb'}`, mb: v.mb, spec: v.spec, read: v.read })) };
const importmap = opt.publish
  ? { imports: { three: `https://cdn.jsdelivr.net/npm/three@${THREE_CDN}/build/three.module.min.js`, 'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_CDN}/examples/jsm/` } }
  : { imports: { three: './vendor/three/three.module.min.js', 'three/addons/': './vendor/three/addons/' } };
const title = as !== 'hero' ? `The ${as[0].toUpperCase()}${as.slice(1)}, Live` : `${hero.form === 'realistic' ? 'Realistic' : 'The'} Hero, Live`;
const page = readFileSync(path.join(HERE, 'viewer.html'), 'utf8')
  .replaceAll('@TITLE@', title)
  .replace('@IMPORTMAP@', JSON.stringify(importmap))
  .replace('@MANIFEST@', JSON.stringify(manifest).replace(/</g, '\\u003c'));
writeFileSync(path.join(out, 'index.html'), page);
console.log(`\n${path.join(out, 'index.html')}${failed.length ? `  (failed: ${failed.join(', ')})` : ''}`);
if (opt.publish) console.log(`publish: the page, with files ${JSON.stringify(Object.fromEntries(made.flatMap((v) => [[`${v.id}.json`, path.join(out, `${v.id}.json`)], ...(existsSync(path.join(out, `${v.id}.face.json`)) ? [[`${v.id}.face.json`, path.join(out, `${v.id}.face.json`)]] : [])])))}`);

// ─── serve (loopback only) ──────────────────────────────────────────────────
if (opt.serve) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
  createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html', file = path.resolve(out, rel);
    if (!file.startsWith(out + path.sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); createReadStream(file).pipe(res);
  }).listen(opt.serve, '127.0.0.1', () => console.log(`serving http://127.0.0.1:${opt.serve}/ (ctrl-c to stop)`));
}
