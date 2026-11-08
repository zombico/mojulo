#!/usr/bin/env node
// fighter styles — bodies of every art style a game can pick, put in the arena: one character per style, each made
// from the body rails (gameworld/game-bodies.js gameBody → lowerBody, the words a game's style lays on a hero), minted
// through the hero door into a scratch store, paired into matchups on greybox fight levels (versus/versus-levels.js,
// a different preset each), CPU against CPU. For each body the machine reads what it can: that it bakes and plays
// without a page error, that it stands on the lane's floor and on the lane (its posed mesh's bounds against the lane),
// what it weighs (triangles, its body's bytes in the page). The eyes gate is the operator's: the contact sheet.
//
//   node control/scripts/spikes/fighter/styles.mjs [--out dir] [--only id,id] [--reuse] [--at 2.5,6] [--level preset] [--register anime|western]
//
// --only keeps the matchups holding those cases; --reuse keeps minted characters and baked arenas (re-shoot only);
// --at the moments shot, seconds of fight time after the handshake; --level lays every matchup on that greybox preset (the
// training ground: `--level training`) instead of each its own; --register draws every body in that one look under the
// fight's one light (versus-levels.js FIGHT_REGISTERS), as a fight game made now does. Needs Playwright's Chromium and ffmpeg. A realistic
// body's mint takes about two minutes.
import { register, createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'fighter-styles') }, only: { type: 'string' }, reuse: { type: 'boolean', default: false }, at: { type: 'string', default: '2.5,6' }, level: { type: 'string' }, register: { type: 'string' } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });

// THE CASES: one body per style a game can pick, a rail and its style (gameBody), a pole, the tradition it fights in;
// `own` the hero door's words of its own over the rail's (a realistic head, a face)
const TARGET = { resolution: '720p', framing: 'wide' };
const CASES = [
  { id: 'anime-toji', label: 'Anime · Toji, muscled', rail: 'muscular', style: 'anime', role: 'hero', pole: 'male', muscle: true, tradition: 'karate', color: '#d9532b' },
  { id: 'anime-kale', label: 'Anime · Kale', rail: 'muscular', style: 'anime', role: 'henchman', pole: 'female', muscle: true, tradition: 'muay-thai', color: '#b0399b' },
  { id: 'saikyo-real', label: 'Realistic head · Saikyo body', rail: 'muscular', style: 'anime', role: 'hero', pole: 'male', muscle: 0.6, tradition: 'boxing', moves: 'hero', own: { head: 'relational', face: { seed: 101 } }, color: '#3f7fd0' },
  { id: 'realistic', label: 'Realistic body · jacked', rail: 'muscular', style: 'western', role: 'hero', pole: 'male', tradition: 'savate', own: { face: { seed: 202 } }, color: '#2f9e6a' },
  { id: 'comic-ink', label: 'Comic · ink, heroic', rail: 'comic', style: 'ink', role: 'hero', pole: 'female', tradition: 'taekwondo', color: '#e0b030' },
  { id: 'shonen', label: 'Anime · Shonen High', rail: 'realistic', style: 'anime', role: 'hero', pole: 'male', tradition: 'kung-fu', color: '#5a5fd8' },
  { id: 'chibi', label: 'Mascot · chibi', rail: 'mascot', style: 'mascot', role: 'hero', pole: 'female', tradition: 'capoeira', color: '#ef6b8a' },
  { id: 'lowpoly', label: 'Mascot · lowpoly, stout', rail: 'mascot', style: 'lowpoly', role: 'henchman', pole: 'male', tradition: 'brawler', color: '#8a8f99' },
];
// THE MATCHUPS: two cases on a greybox preset, a different preset each so the loader is exercised with them
const MATCHUPS = [
  { id: 'flat', a: 'saikyo-real', b: 'realistic' },
  { id: 'turned', a: 'anime-toji', b: 'comic-ink' },
  { id: 'rooftop', a: 'shonen', b: 'anime-kale' },
  { id: 'alley', a: 'chibi', b: 'lowpoly' },
];
const only = opt.only ? new Set(opt.only.split(',')) : null;
// (a matchup's files named for the level it is laid on: its own preset, or the one --level names for all)
const matchups = MATCHUPS.filter((m) => !only || only.has(m.a) || only.has(m.b) || only.has(m.id)).map((m) => ({ ...m, preset: opt.level ?? m.id, id: [opt.level, opt.register, m.id].filter(Boolean).join('-') }));
const AT = opt.at.split(',').map(Number);

// ─── mint and bake (a scratch store: the operator's own is never touched) ─────────────────────────────────────────
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = path.join(out, 'store.db'); process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = path.join(out, 'outcomes');
const refsFile = path.join(out, 'refs.json');
const refs = opt.reuse && existsSync(refsFile) ? JSON.parse(readFileSync(refsFile, 'utf8')) : {};
const report = { cases: {}, matchups: {} };
const needed = [...new Set(matchups.flatMap((m) => [m.a, m.b]))].map((id) => CASES.find((c) => c.id === id));
{
  const { gameBody, lowerBody } = await import('@/lib/graph/gameworld/game-bodies.js');
  const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character.js');
  for (const C of needed) {
    const B = gameBody(C.rail, C.role, { style: C.style, pole: C.pole, ...(C.muscle !== undefined ? { muscle: C.muscle } : {}) });
    // (its top in its roster colour, so the two bodies of a matchup read apart, as a fight's two sides do)
    const spec = lowerBody({ cast: C.pole, target: TARGET, palette: { Top: C.color }, ...(C.own ?? {}) }, B);
    report.cases[C.id] = { label: C.label, rail: C.rail, style: B.style, why: B.why, spec };
    if (refs[C.id]) continue;
    const t0 = Date.now();
    console.log(`minting ${C.id} …`);
    const r = await createCharacterHandler({ as: 'hero', title: C.label, spec });
    if (!r.ok) throw new Error(`${C.id}: the door refused: ${JSON.stringify(r.error ?? r).slice(0, 600)}`);
    refs[C.id] = r.ref;
    report.cases[C.id].mintSeconds = Math.round((Date.now() - t0) / 1000);
    report.cases[C.id].height_m = r.hero?.measures?.height_m ?? null;
    writeFileSync(refsFile, JSON.stringify(refs));
  }
}
{
  const { fightLevel } = await import('@/lib/graph/versus/versus-levels.js');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
  for (const M of matchups) {
    const page = path.join(out, `${M.id}.html`), picks = path.join(out, `${M.id}.picks.json`);
    const baked = path.join(out, `${M.id}.bake.json`);
    // (a matchup baked before: its page, its picks and what its bake read, kept)
    if (opt.reuse && existsSync(page) && existsSync(picks) && existsSync(baked)) { const K = JSON.parse(readFileSync(baked, 'utf8')); report.matchups[M.id] = K.matchup; for (const [id, c] of Object.entries(K.cases)) report.cases[id] = { ...report.cases[id], ...c }; continue; }
    const roster = [M.a, M.b].map((id) => { const C = CASES.find((c) => c.id === id); return { id: C.id, name: C.label.split(' · ')[1] ?? C.id, color: C.color, tradition: C.tradition, hero: { ref: refs[C.id] }, ...(C.moves ? { moves: C.moves } : {}) }; });
    const manifest = fightLevel({ kind: 'greybox', preset: M.preset }, { roster, title: `styles · ${M.id}`, ...(opt.register ? { register: opt.register } : {}) });
    console.log(`baking ${M.id} (${M.a} vs ${M.b}) …`);
    const t0 = Date.now();
    const { payload } = await resolveWorldScene({ ref: `styles-${M.id}`, title: manifest.title, manifest }, { live: true });
    writeFileSync(page, emitThreeWorld({ ...payload, hud: false, inline: true }));
    const R = payload.versus.roster;
    writeFileSync(picks, JSON.stringify({ wire: payload.versus.wire, lane: payload.versus.lane, picks: { fighters: R.map((e) => e.recipe), names: R.map((e) => e.name), colors: R.map((e) => e.color), characters: R.map((e) => e.character ?? null), schemes: ['modern', 'modern'], mode: 'watch', level: 1, cpu: 'veteran', seed: 7 } }));
    // each body's weight in the page: its triangles, its bytes, played (its own clips) or posed by the fight
    for (const [i, id] of [M.a, M.b].entries()) {
      const b = payload.versus.bodies?.[refs[id]];
      report.cases[id] = { ...report.cases[id], body: b ? { played: !!b.played, lit: !!b.lit, triangles: b.parts.reduce((s, p) => s + (p?.faces ?? 0), 0), mb: +(JSON.stringify(b).length / 1048576).toFixed(1) } : null, dials: R[i].recipe.body };
    }
    report.matchups[M.id] = { a: M.a, b: M.b, lane: payload.versus.lane, bakeSeconds: Math.round((Date.now() - t0) / 1000) };
    writeFileSync(baked, JSON.stringify({ matchup: report.matchups[M.id], cases: Object.fromEntries([M.a, M.b].map((id) => [id, { body: report.cases[id].body, dials: report.cases[id].dials, ...(report.cases[id].mintSeconds ? { mintSeconds: report.cases[id].mintSeconds, height_m: report.cases[id].height_m } : {}) }])) }));
  }
}

// ─── play and read: each arena hosted (the level wire), CPU against CPU, stepped on a virtual clock ──────────────────
const CLOCK = () => {
  if (window.parent === window) return;
  let now = 0, next = [];
  const t0 = Date.now();
  window.requestAnimationFrame = (cb) => { next.push(cb); return next.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => now;
  Date.now = () => t0 + now;
  // (a frame's pixels read in the task that drew it, before the compositor takes the WebGL buffer: the 3D canvas, then
  // the overlay over it; the page's own screenshot would wait on a frame the virtual clock never gives)
  window.__shot = () => {
    const cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight; const g = cv.getContext('2d');
    for (const k of document.querySelectorAll('canvas')) { const r = k.getBoundingClientRect(); if (r.width > 0 && r.height > 0) g.drawImage(k, r.left, r.top, r.width, r.height); }
    return cv.toDataURL('image/png');
  };
  window.__step = (ms) => { now += ms; const run = next; next = []; for (const cb of run) { try { cb(now); } catch (e) { console.error('frame: ' + e.message); } } return now; };
};
const { chromium } = createRequire(path.join(CONTROL, 'package.json'))('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const shots = [];
for (const M of matchups) {
  const { wire, picks, lane } = JSON.parse(readFileSync(path.join(out, `${M.id}.picks.json`), 'utf8'));
  writeFileSync(path.join(out, `${M.id}.host.html`), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
<iframe id="f" src="${M.id}.html"></iframe><script>
const W = ${JSON.stringify(wire)}, picks = ${JSON.stringify(picks).replace(/</g, '\\u003c')}, f = document.getElementById('f');
addEventListener('message', (e) => { if (e.source === f.contentWindow && e.data && e.data.moj === W.ready) f.contentWindow.postMessage({ moj: W.init, contractVersion: W.version, params: { versus: picks }, seed: picks.seed }, '*'); });
</script>`);
  const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  tab.on('pageerror', (e) => errs.push(e.message)); tab.on('console', (m) => { if (m.type() === 'error' && !/AudioContext/.test(m.text())) errs.push(m.text()); });
  await tab.addInitScript(CLOCK);
  await tab.goto(pathToFileURL(path.join(out, `${M.id}.host.html`)).href, { waitUntil: 'load', timeout: 600000 });
  const arena = () => tab.frames().find((f) => f !== tab.mainFrame());
  for (let t = 0; !(arena() && await arena().evaluate(() => !!window.__step).catch(() => false)); t++) { if (t > 600) throw new Error(`${M.id}: the arena never started`); await new Promise((r) => setTimeout(r, 500)); }
  const step = (n) => arena().evaluate((n) => { for (let i = 0; i < n; i++) window.__step(1000 / 60); }, n);
  // (the handshake and the round's intro)
  await step(150);
  let done = 0;
  for (const [k, sec] of AT.entries()) {
    await step(Math.max(0, Math.round(sec * 60) - done)); done = Math.round(sec * 60);
    // what the machine reads: each body's posed mesh's bounds, against the lane (its floor, its line)
    const read = await arena().evaluate(async (lane) => {
      const THREE = await import('three'), v = window.__mojVersus;
      const t = (lane.heading * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
      return v.bodies.map((B, i) => {
        B.group.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(B.group, true), mid = box.getCenter(new THREE.Vector3());
        const dx = mid.x - lane.at[0], dy = mid.y - lane.at[1];
        return { st: v.match.s.p[i].st, air: v.match.s.p[i].y > 0, feet: +(box.min.z - lane.floor).toFixed(3), across: +(-dx * s + dy * c).toFixed(3), height: +(box.max.z - box.min.z).toFixed(3) };
      });
    }, lane);
    const file = path.join(out, `${M.id}-${k}.png`);
    const url = await arena().evaluate(() => { window.__step(1000 / 60); return window.__shot(); });
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    shots.push(file);
    report.matchups[M.id] = { ...(report.matchups[M.id] ?? {}), [`at${sec}`]: read };
  }
  report.matchups[M.id] = { ...report.matchups[M.id], errors: [...new Set(errs)].slice(0, 6) };
  console.log(`${M.id}: ${JSON.stringify(report.matchups[M.id][`at${AT[0]}`])} errors ${errs.length}`);
  await tab.close();
}
await browser.close();

// ─── the verdicts (machine, advisory) and the sheet (the eyes') ──────────────────────────────────────────────────────
const FEET = 0.08, LINE = 0.6;
for (const [id, M] of Object.entries(report.matchups)) {
  const first = M[`at${AT[0]}`] ?? [];
  M.verdicts = first.map((b, i) => ({ who: i ? M.b : M.a, grounded: b.air || Math.abs(b.feet) <= FEET, onLane: Math.abs(b.across) <= LINE, clean: !M.errors?.length }));
}
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
const cols = AT.length, inputs = shots.flatMap((f) => ['-i', f]);
const layout = shots.map((_, i) => `${(i % cols) ? `w0${'+w0'.repeat((i % cols) - 1)}` : '0'}_${Math.floor(i / cols) ? `h0${'+h0'.repeat(Math.floor(i / cols) - 1)}` : '0'}`).join('|');
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${shots.map((_, i) => `[${i}]scale=640:-1[s${i}]`).join(';')};${shots.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${shots.length}:layout=${layout}`, path.join(out, 'sheet.png')], { stdio: 'inherit' });
for (const [id, M] of Object.entries(report.matchups)) console.log(id, JSON.stringify(M.verdicts));
console.log(path.join(out, 'report.json')); console.log(path.join(out, 'sheet.png'));
