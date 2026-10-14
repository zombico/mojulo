#!/usr/bin/env node
/**
 * The sound conformance gate: is the Godot kernel's music meter (lib/graph/scene/godot-kernel/sound.gd) EQUAL to the
 * page's (lib/graph/beats/adaptive-music.js buildAdaptive)? Seeded traces of frames and bus events run through both
 * (raise, leak, decide), with globs and bar lines beside them; every frame's tension, state and change must agree.
 * Builds a scratch Godot project (the kernel's sound.gd plus the runner) and runs it headless. Advisory like every
 * engine gate: it needs Godot ($MOJULO_GODOT, or the app in /Applications).
 *
 *   node scripts/godot-sound-conformance.mjs [--traces 24] [--seed 7]
 *
 * Exit 0 when everything agrees; 1 with the first difference of each unequal trace.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');
const { buildAdaptive, MECHANIC_TENSION, TENSION_DEFAULTS } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/beats/adaptive-music.js')).href);

const A = buildAdaptive();
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const TYPES = ['hit:foe', 'hit:hero', 'enemy:down', 'spotted', 'wave', 'leak', 'pickup:coin', 'goal:reached', 'hit', 'hits:foe', 'a.b', 'x?y', ''];
const PATTERNS = ['*', 'hit:*', '*:down', 'hit*foe', 'a.b', 'a*b', 'x?y', '*o*', 'spotted', '**', 'h*t*e', ''];

/** The corpus: every pattern against every type, bar lines over a seeded spread, and seeded play traces. */
export function soundCorpus({ traces = 24, seed = 7 } = {}) {
  const R = rng(seed);
  const globs = [];
  for (const p of PATTERNS) for (const t of TYPES) globs.push([p, t]);
  const bars = [];
  for (let i = 0; i < 200; i++) { const t0 = R() * 10, bar = 0.5 + R() * 3; bars.push([t0 + R() * 60, t0, bar]); }
  bars.push([4, 0, 2], [0, 0, 2], [2.0000000001, 0, 2]);
  const rows = Object.values(MECHANIC_TENSION);
  const out = [];
  for (let k = 0; k < traces; k++) {
    const on = k % 3 === 0 ? { 'hit:*': 0.35, spotted: 0.7 } : { ...rows[k % rows.length], ...(k % 2 ? { '*:down': 0.2 } : {}) };
    const cfg = { ...TENSION_DEFAULTS, ...(k % 4 === 1 ? { enter: 0.5, exit: 0.1, hold: 1, decay: 3 } : {}), on };
    const rate = [0, 0.004, 0.02, 0.08][k % 4], frames = [];
    for (let i = 0; i < 1200; i++) {
      const events = [];
      while (R() < rate) events.push(TYPES[Math.floor(R() * TYPES.length)]);
      frames.push({ dt: R() < 0.05 ? 0.25 : (1 / 60) * (0.5 + R()), events });
    }
    out.push({ cfg, bar: 1 + Math.floor(R() * 4) * 0.5, frames });
  }
  return { globs, bars, traces: out };
}

/** The page's answers to the corpus (buildAdaptive, the closure the World page runs). */
export function runWeb(corpus) {
  const traces = corpus.traces.map((tr) => {
    let st = { active: 'explore', below: 0 }, t = 0;
    return tr.frames.map((f) => {
      for (const ev of f.events) t = A.raise(t, ev, tr.cfg.on);
      t = A.leak(t, f.dt, tr.cfg.decay);
      const nx = A.decide(st, t, f.dt, tr.cfg, tr.bar);
      st = { active: nx.active, below: nx.below };
      return [t, nx.active, nx.below, nx.to || ''];
    });
  });
  return { globs: corpus.globs.map(([p, t]) => A.glob(p, t)), bars: corpus.bars.map(([e, t0, b]) => A.nextBar(e, t0, b)), traces };
}

export function runGodotSound(corpus, godot) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-sound-'));
  try {
    mkdirSync(path.join(dir, 'kernel'));
    writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="sound-conformance"\n');
    copyFileSync(path.join(CONTROL, 'lib/graph/scene/godot-kernel/sound.gd'), path.join(dir, 'kernel', 'sound.gd'));
    copyFileSync(path.join(HERE, 'godot-sound-conformance.gd'), path.join(dir, 'conformance.gd'));
    const inFile = path.join(dir, 'corpus.json'), outFile = path.join(dir, 'out.json');
    writeFileSync(inFile, JSON.stringify(corpus));
    const r = spawnSync(godot, ['--headless', '--path', dir, '--script', 'res://conformance.gd', '--', inFile, outFile], { encoding: 'utf8', timeout: 120000 });
    let out = null;
    try { out = JSON.parse(readFileSync(outFile, 'utf8')); } catch { /* no output: reported below */ }
    const errors = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').filter((l) => /SCRIPT ERROR|Parse Error|ERROR:/.test(l));
    return { out, errors, status: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// a float agrees to 1e-12 relative (exp may differ in its last bit between V8 and the C library); words exactly
const near = (a, b) => (typeof a === 'number' ? typeof b === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a)) : a === b);

/** Rows of { what, equal, first? } comparing the page's answers with Godot's. */
export function compare(web, gd) {
  const rows = [];
  const list = (what, a, b) => {
    const i = a.findIndex((x, k) => !near(x, b?.[k]));
    rows.push({ what, n: a.length, equal: i < 0 && (b?.length ?? 0) === a.length, ...(i >= 0 ? { first: { at: i, web: a[i], godot: b?.[i] } } : {}) });
  };
  list('globs', web.globs, gd?.globs);
  list('bars', web.bars, gd?.bars);
  web.traces.forEach((tr, k) => {
    const g = gd?.traces?.[k] || [];
    const i = tr.findIndex((row, f) => !row.every((x, c) => near(x, g[f]?.[c])));
    rows.push({ what: `trace ${k}`, n: tr.length, equal: i < 0 && g.length === tr.length, ...(i >= 0 ? { first: { at: i, web: tr[i], godot: g[i] } } : {}) });
  });
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? Number(argv[i + 1]) : d; };
  const { findGodot } = await import(pathToFileURL(path.join(CONTROL, 'lib/workers/find.js')).href);
  const godot = process.env.MOJULO_GODOT || findGodot();
  if (!godot) { console.error('godot-sound-conformance: no Godot (set MOJULO_GODOT)'); process.exit(2); }
  const corpus = soundCorpus({ traces: opt('--traces', 24), seed: opt('--seed', 7) });
  const { out, errors, status } = runGodotSound(corpus, godot);
  if (errors.length || !out) { console.error(`godot exited ${status}:\n${errors.join('\n') || 'no output'}`); process.exit(1); }
  const rows = compare(runWeb(corpus), out);
  console.log(`sound conformance · ${rows.filter((r) => r.equal).length}/${rows.length} equal · ${rows.reduce((n, r) => n + r.n, 0)} checks`);
  for (const r of rows.filter((x) => !x.equal)) console.log(`  ✗ ${r.what} at ${r.first?.at}\n      web   ${JSON.stringify(r.first?.web)}\n      godot ${JSON.stringify(r.first?.godot)}`);
  process.exit(rows.every((r) => r.equal) ? 0 : 1);
}
