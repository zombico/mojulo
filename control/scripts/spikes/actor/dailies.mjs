#!/usr/bin/env node
// actor dailies — the eyes gate's page for the scene actor: the baseline's takes side by side on one clock, each with
// its timeline (the lines and their words, the stresses, where the eyes are, the body's gestures, how much the face
// moves, the blinks, and, in a scene, the partner's turns) and its readings, law by law (lib/graph/actor/readings.js).
// One self-contained page, no network. Solo: the four playing styles on the baseline's register (lib/graph/actor/style.js),
// then the persona's own registers with no style. Scene: the persona alone (actor/baseline.js sceneReads), then each
// style; each later phase adds its takes beside these.
//
//   node scripts/spikes/actor/dailies.mjs [--out dir] [--hero <hero-live out dir>]
//
//   --out   where index.html and takes.json go (default <tmp>/actor-dailies)
//   --hero  a hero-live out dir with a minted realistic hero (.claude/skills/hero-live/live.mjs): every take is written
//           there as a face clip (face.mjs --perform) and its body as `<variant>.act.json` (act-sidecar.mjs), so
//           hero-live's viewer plays each take on the hero, its body under its face
//
// Every take's BODY (lib/graph/actor/body.js) is played on the baseline hero's rig in its relaxed stand (the rig expanded
// once and cached in --out as rig.json: most of a minute the first time), drawn as its own lane, and read law by law.
//
// The machine read prints per take; whether it reads as acting is the operator's.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BASELINE, sceneReads } from '../../../lib/graph/actor/baseline.js';
import { actorReadings } from '../../../lib/graph/actor/readings.js';
import { readScript } from '../../../lib/graph/persona/read.js';
import { actRead } from '../../../lib/graph/actor/interpret.js';
import { STYLE_NAMES, STYLES } from '../../../lib/graph/actor/style.js';
import { perform } from '../../../lib/graph/face-acting/perform.js';
import { DELIVERY_NAMES } from '../../../lib/graph/persona/delivery.js';
import { cueSheet } from '../../../lib/graph/persona/cues.js';
import { rigFor, actSidecar, dzOf } from './act-sidecar.mjs';
const { actBody } = await import('../../../lib/graph/actor/body.js');
const { GESTURE_PRESETS } = await import('../../../lib/graph/polygonizer/hero-gesture.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (!['out', 'hero'].includes(k) || argv[i + 1] === undefined) throw new Error(`dailies: --out dir | --hero dir (not ${argv[i]})`);
  opt[k] = argv[++i];
}
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'actor-dailies'));
mkdirSync(out, { recursive: true });
// (the baseline hero's rig and its stand: the relaxed preset of its cast)
const RIG = await rigFor(BASELINE.hero, path.join(out, 'rig.json')), STAND = GESTURE_PRESETS.relaxed[BASELINE.hero.cast] ?? GESTURE_PRESETS.relaxed.male;

// ─── the takes: one actor's read and its face's take, measured ─────────────────────────────────────────────────────
const r3 = (v) => Math.round(v * 1000) / 1000;
/** the face's motion a frame (its units' summed speed), at 30 fps, smoothed over a fifth of a second: the sparkline */
function energySeries(take) {
  const C = Object.values(take.curves), raw = [];
  for (let i = 1; i < take.frames; i++) { let s = 0; for (const c of C) s += Math.abs(c[i] - c[i - 1]); raw.push(s * take.fps); }
  const step = Math.max(1, Math.round(take.fps / 30)), win = Math.max(1, Math.round(0.2 * take.fps)), out = [];
  for (let i = 0; i < raw.length; i += step) { let s = 0, n = 0; for (let j = Math.max(0, i - win); j <= Math.min(raw.length - 1, i + win); j++) { s += raw[j]; n++; } out.push(r3(s / n)); }
  return { dt: step / take.fps, v: out };
}
function takeCard({ id, label, sub, read, seed = 1, listens = null }) {
  const P = { beats: read.beats, seconds: read.seconds, seed, ...(read.intensity !== undefined ? { intensity: read.intensity } : {}) };
  const take = perform(P), sheet = cueSheet(id, read, { face: true });
  const body = actBody(read, { R: RIG, base: STAND, ...(read.style ? { style: read.style } : {}), seed });
  return {
    id, label, sub, seconds: read.seconds,
    lines: sheet.lines, words: sheet.words, gaze: sheet.gaze.map((g) => ({ ...g })), body: sheet.body,
    // (a scene's gaze names its partner where a beat looks at the listener; the persona's never does)
    blinks: take.events.blinks.map((b) => b.t), micro: take.events.micro.map((m) => m.t), flashes: take.events.flashes.map((f) => f.t),
    energy: energySeries(take), listens,
    readings: actorReadings({ read, take, listens, body }),
    moves: body.gestures.map((g) => ({ word: g.word, start: g.start, apex: g.apex, end: g.end, side: g.side, cause: g.cause, ...(g.chained ? { chained: true } : {}) })),
    dropped: body.dropped.map((d) => ({ t: d.t, gesture: d.gesture, why: d.why })),
    shifts: (body.idle.pelvis ?? []).filter((_, i) => i % 2 === 1).map((k) => k.t),
    perform: P, _body: body,
  };
}

// (phase 1: the four styles on the baseline's register, beside the persona's registers alone)
const solo = [
  ...STYLE_NAMES.map((style) => takeCard({ id: `solo-${style}`, label: style, sub: `style on ${BASELINE.solo.register} · ${STYLES[style].reads}`, read: actRead({ ...BASELINE.solo, style }) })),
  ...DELIVERY_NAMES.map((register) => takeCard({ id: `solo-${register}`, label: register, sub: register === BASELINE.solo.register ? 'persona · the baseline\'s register, no style' : 'persona register, no style', read: readScript({ script: BASELINE.solo.script, register }) })),
];
const sceneOf = (style) => { const S = sceneReads(BASELINE.scene, style ? { style } : {}); return { S, actors: Object.entries(S.actors).map(([who, A]) => takeCard({ id: `scene-${style ? `${style}-` : ''}${who}`, label: who, sub: `${A.register}${style ? ` · ${style}` : ''}`, read: A.read, listens: A.listens })) }; };
const variants = [{ style: null, label: 'persona alone', sub: 'each speaker reads its lines; the partner\'s turns are pauses' }, ...STYLE_NAMES.map((style) => ({ style, label: style, sub: 'both actors in this style; the partner\'s turns are still pauses (phase 3 directs the listener)' }))];
const scene = variants.map((v) => { const { S, actors } = sceneOf(v.style); return { label: v.label, sub: v.sub, seconds: S.seconds, actors }; });
const data = { made: 'phase 2a', solo: { script: BASELINE.solo.script, cards: solo }, scene: { seconds: Math.max(...scene.map((v) => v.seconds)), lines: BASELINE.scene.lines, variants: scene } };

// ─── the machine read, printed ───────────────────────────────────────────────────────────────────────────────────
const row = (c) => {
  const F = c.readings.face, R = c.readings.read, L = c.readings.laws;
  const st = L.stroke.reads, ov = L.overlap.reads, po = L.possible.reads;
  return `  ${c.id.padEnd(22)} ${String(c.seconds).padStart(6)} s  face ${String(F.energy).padStart(6)}/s  wpm ${String(R.wordsPerMin).padStart(7)}  moves ${c.moves.length} (dropped ${c.dropped.length})  lens ${R.gaze.share.lens ?? 0}${ov ? `  in order ${ov.inOrder}` : ''}${st ? `  stroke lead ${st.lead.mean}` : ''}  stillest ${L.weight.reads.stillest} s${po.over.length ? `  OVER ${po.over.join(', ')}` : ''}${L.listening.reads ? `  regard ${L.listening.reads.regard}` : ''}`;
};
console.log('solo:'); for (const c of solo) console.log(row(c));
console.log('scene:'); for (const v of scene) for (const c of v.actors) console.log(row(c));

// ─── the page ────────────────────────────────────────────────────────────────────────────────────────────────────
mkdirSync(out, { recursive: true });
const clean = (k, v) => (k === '_body' ? undefined : v);
writeFileSync(path.join(out, 'takes.json'), JSON.stringify(data, clean));
writeFileSync(path.join(out, 'index.html'), page(JSON.parse(JSON.stringify(data, clean))));
console.log(`\n${path.join(out, 'index.html')}`);

// ─── the hero, where one is minted: every take as a face clip on it ────────────────────────────────────────────────
if (opt.hero) {
  const performs = Object.fromEntries([...solo, ...scene.flatMap((v) => v.actors)].map((c) => [c.id, c.perform]));
  const r = spawnSync(process.execPath, [path.resolve(HERE, '../../../../.claude/skills/hero-live/face.mjs'), '--out', path.resolve(opt.hero), '--perform', JSON.stringify(performs)], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  // (each take's body as the GLB's joints play it, beside each variant's GLB: <variant>.act.json)
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(path.resolve(opt.hero)).filter((x) => x.endsWith('.glb'))) {
    const dz = await dzOf(path.join(path.resolve(opt.hero), f), RIG);
    // (the styles' takes and the persona's own on the baseline's register: the rest of the registers' are on the page)
    const bodied = [...solo, ...scene.flatMap((v) => v.actors)].filter((c) => !DELIVERY_NAMES.some((r) => c.id === `solo-${r}`) || c.id === `solo-${BASELINE.solo.register}`);
    const acts = bodied.map((c) => ({ of: `face:${c.id}`, ...actSidecar(c._body, RIG, { dz }) }));
    writeFileSync(path.join(path.resolve(opt.hero), f.replace(/\.glb$/, '.act.json')), JSON.stringify({ acts }));
    console.log(`${f}: ${acts.length} body takes (dz ${dz.toFixed(4)} m) → ${f.replace(/\.glb$/, '.act.json')}`);
  }
  console.log(`\nthe takes play as face:<id> in ${path.join(path.resolve(opt.hero), 'index.html')} (live.mjs --out ${opt.hero} --reuse --serve)`);
}

function page(D) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Actor dailies</title>
<style>
:root{--bg:#f7f6f3;--panel:#fff;--ink:#1d1c1a;--dim:#6b6862;--line:#e3e0da;--accent:#c2410c;--lens:#2563eb;--notes:#a16207;--away:#7c3aed;--partner:#059669;--energy:#0e7490;--listen:rgba(5,150,105,.10);--blink:#64748b}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#161514;--panel:#1f1e1c;--ink:#ecebe8;--dim:#a19d96;--line:#33312e;--accent:#fb923c;--lens:#60a5fa;--notes:#facc15;--away:#a78bfa;--partner:#34d399;--energy:#22d3ee;--listen:rgba(52,211,153,.12);--blink:#94a3b8}}
:root[data-theme=dark]{--bg:#161514;--panel:#1f1e1c;--ink:#ecebe8;--dim:#a19d96;--line:#33312e;--accent:#fb923c;--lens:#60a5fa;--notes:#facc15;--away:#a78bfa;--partner:#34d399;--energy:#22d3ee;--listen:rgba(52,211,153,.12);--blink:#94a3b8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1500px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}p.lede{color:var(--dim);margin:0 0 12px;max-width:80ch}
.bar{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap}
button{font:inherit;padding:4px 12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:6px;cursor:pointer}
input[type=range]{flex:1;min-width:160px}
.t{font-variant-numeric:tabular-nums;color:var(--dim);min-width:7ch}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;min-width:0}
.card h3{margin:0;font-size:15px}.card .sub{color:var(--dim);font-size:12px;margin-bottom:6px}
.cap{min-height:2.9em;font-size:13px;margin:6px 0;color:var(--dim)}.cap b{color:var(--ink)}.cap .now{color:var(--accent);font-weight:600}
svg{width:100%;height:auto;display:block}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}td{padding:2px 4px;border-top:1px solid var(--line);vertical-align:top}td:first-child{color:var(--dim);white-space:nowrap}
td.null{color:var(--dim);font-style:italic}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--dim)}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
details{margin-top:6px}summary{cursor:pointer;color:var(--dim);font-size:12px}pre{white-space:pre-wrap;font-size:12px;color:var(--dim)}
.scene{display:flex;flex-direction:column;gap:8px;max-width:760px}
</style></head><body><main>
<h1>Actor dailies</h1>
<p class="lede">The scene actor's baseline (${D.made}): the persona's takes on one clock, each with its timeline and its readings law by law. Each take's body is played on the baseline hero's rig in its relaxed stand (phase 2a: the gestures solved by holdArm on the rig, the stand's life between them). The four playing styles on the baseline's register first, then the persona's own registers with no style. The scene is played once by the persona alone and once per style, with the partner's turns read as pauses (the listener is phase 3's). The machine readings are advisory. Whether a take reads as acting is the eyes gate's call.</p>
<div class="bar"><button id="play">Play</button><input id="scrub" type="range" min="0" max="1000" value="0"><span class="t" id="time">0.00 s</span>
<span class="legend"><span><i style="background:var(--lens)"></i>lens</span><span><i style="background:var(--notes)"></i>notes</span><span><i style="background:var(--away)"></i>away</span><span><i style="background:var(--partner)"></i>partner</span><span><i style="background:var(--listen);border:1px solid var(--partner)"></i>the partner's turn</span><span><i style="background:var(--accent)"></i>stress · gesture cue · the body's move (going to letting go, the apex a line)</span><span><i style="background:var(--energy)"></i>face motion</span></span></div>
<h2>Solo: one speech, the styles and the persona's registers</h2>
<details><summary>the script</summary><pre>${esc(D.solo.script)}</pre></details>
<div class="grid" id="solo"></div>
<h2>Scene: a two-hander</h2>
<details><summary>the script</summary><pre>${esc(D.scene.lines.map((L) => `${L.who.toUpperCase()}: ${L.line}`).join('\n'))}</pre></details>
<div class="grid" id="scene"></div>
</main>
<script>
const D = ${JSON.stringify(D).replace(/</g, '\\u003c')};
const LAWS = { overlap: '1 overlap', stroke: '2 stroke on stress', weight: '3 weight', variation: '4 variation', listening: '5 listening', possible: '6 humanly possible', absent: '7 absent adds nothing' };
const W = 600, ROWS = { lines: [4, 20], words: [28, 14], gaze: [46, 8], body: [58, 14], moves: [76, 14], energy: [94, 30], blinks: [128, 8] }, H = 140;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const gazeColour = (g) => ({ lens: 'var(--lens)', notes: 'var(--notes)', away: 'var(--away)' })[g] ?? 'var(--partner)';
function timeline(c, seconds) {
  const x = (t) => (t / seconds) * W, s = [];
  for (const [a, b] of c.listens ?? []) s.push('<rect x="' + x(a) + '" y="0" width="' + (x(b) - x(a)) + '" height="' + H + '" fill="var(--listen)"/>');
  for (const L of c.lines) s.push('<rect x="' + x(L.at) + '" y="' + ROWS.lines[0] + '" width="' + Math.max(1, x(L.end) - x(L.at)) + '" height="' + ROWS.lines[1] + '" rx="3" fill="none" stroke="var(--line)"/>' +
    '<text x="' + (x(L.at) + 3) + '" y="' + (ROWS.lines[0] + 14) + '" font-size="10" fill="var(--dim)"' + (L.aside ? ' font-style="italic"' : '') + ' clip-path="inset(0)">' + esc(L.text.slice(0, Math.max(0, Math.floor((x(L.end) - x(L.at)) / 5.5)))) + '</text>');
  for (const w of c.words) s.push('<rect x="' + x(w.t) + '" y="' + (ROWS.words[0] + (w.emph ? 0 : 6)) + '" width="' + Math.max(1, x(w.t + w.dur) - x(w.t) - 1) + '" height="' + (w.emph ? ROWS.words[1] : ROWS.words[1] - 6) + '" fill="' + (w.emph ? 'var(--accent)' : 'var(--dim)') + '" opacity="' + (w.emph ? 1 : 0.45) + '"/>');
  c.gaze.forEach((g, i) => { const e = c.gaze[i + 1]?.t ?? c.seconds; s.push('<rect x="' + x(g.t) + '" y="' + ROWS.gaze[0] + '" width="' + (x(e) - x(g.t)) + '" height="' + ROWS.gaze[1] + '" fill="' + gazeColour(g.target) + '"/>'); });
  for (const b of c.body) s.push('<path d="M' + x(b.t) + ' ' + ROWS.body[0] + 'l5 6 -5 6 -5 -6z" fill="var(--accent)"/><text x="' + (x(b.t) + 7) + '" y="' + (ROWS.body[0] + 10) + '" font-size="9" fill="var(--dim)">' + esc(b.gesture) + '</text>');
  // (the body: each gesture from its going to its letting go, its apex marked; a chained one joined to the last; a
  // dropped cue a cross; the stand's shifts small ticks)
  const [my, mh] = ROWS.moves;
  for (const m of c.moves ?? []) s.push('<rect x="' + x(m.start) + '" y="' + (my + 2) + '" width="' + Math.max(1, x(m.end) - x(m.start)) + '" height="' + (mh - 4) + '" rx="3" fill="var(--accent)" opacity=".18" stroke="var(--accent)" stroke-width=".5"' + (m.chained ? ' stroke-dasharray="2 2"' : '') + '/><rect x="' + (x(m.apex) - 0.75) + '" y="' + my + '" width="1.5" height="' + mh + '" fill="var(--accent)"/><text x="' + (x(m.start) + 2) + '" y="' + (my + 10) + '" font-size="8" fill="var(--ink)">' + esc(m.word) + (m.side && m.side !== 'R' ? ' ' + m.side : '') + '</text>');
  for (const d of c.dropped ?? []) s.push('<text x="' + x(d.t) + '" y="' + (my + 10) + '" font-size="10" fill="var(--dim)" text-anchor="middle"><title>' + esc(d.gesture + ': ' + d.why) + '</title>×</text>');
  for (const t of c.shifts ?? []) s.push('<rect x="' + x(t) + '" y="' + (my + mh - 3) + '" width="1" height="3" fill="var(--dim)"/>');
  const E = c.energy, top = Math.max(1, ...E.v), [ey, eh] = ROWS.energy;
  s.push('<path d="M0 ' + (ey + eh) + E.v.map((v, i) => 'L' + x(i * E.dt).toFixed(1) + ' ' + (ey + eh - (v / top) * eh).toFixed(1)).join('') + 'L' + x(E.v.length * E.dt) + ' ' + (ey + eh) + 'z" fill="var(--energy)" opacity=".35" stroke="var(--energy)" stroke-width=".6"/>');
  for (const t of c.blinks) s.push('<rect x="' + x(t) + '" y="' + ROWS.blinks[0] + '" width="1.5" height="' + ROWS.blinks[1] + '" fill="var(--blink)"/>');
  for (const t of c.micro) s.push('<circle cx="' + x(t) + '" cy="' + (ROWS.blinks[0] + 4) + '" r="3" fill="var(--accent)"/>');
  s.push('<line class="head" x1="0" x2="0" y1="0" y2="' + H + '" stroke="var(--ink)" stroke-width="1"/>');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" data-seconds="' + seconds + '" role="img" aria-label="timeline of ' + esc(c.label) + '">' + s.join('') + '</svg>';
}
const fmt = (v) => v === null || v === undefined ? '—' : typeof v === 'object' ? Object.entries(v).map(([k, x]) => k + ' ' + fmt(x)).join(' · ') : String(v);
function table(R) {
  const F = R.face, Q = R.read, rows = [
    ['face motion', F.energy + ' /s · level ' + F.level], ['blinks · saccades', F.blinks + ' · ' + F.saccades + ' a min'], ['micro · flashes · tells', F.micro + ' · ' + F.flashes + ' · ' + F.tells], ['head travel', F.headTravel + ' °/s'],
    ['pace', Q.wordsPerMin + ' words a min · ' + Q.stressed + ' stressed'], ['gaze', fmt(Q.gaze.share) + ' · hold ' + Q.gaze.hold + ' s'], ['gestures', Q.gestures.count + ' · ' + Q.gestures.perMin + ' a min'],
  ];
  const laws = Object.entries(R.laws).map(([k, L]) => '<tr><td>' + LAWS[k] + '</td><td class="' + (L.reads ? '' : 'null') + '" title="' + esc(L.note) + '">' + (L.reads ? esc(fmt(L.reads)) : esc(L.note)) + '</td></tr>');
  return '<table>' + rows.map(([k, v]) => '<tr><td>' + k + '</td><td>' + esc(v) + '</td></tr>').join('') + laws.join('') + '</table>';
}
function card(c, seconds) {
  return '<div class="card" data-id="' + c.id + '"><h3>' + esc(c.label) + '</h3><div class="sub">' + esc(c.sub) + ' · ' + c.seconds + ' s</div>' + timeline(c, seconds) + '<div class="cap"></div>' + table(c.readings) + '</div>';
}
const all = [];
const soloMax = Math.max(...D.solo.cards.map((c) => c.seconds));
document.getElementById('solo').innerHTML = D.solo.cards.map((c) => (all.push(c), card(c, soloMax))).join('');
document.getElementById('scene').innerHTML = D.scene.variants.map((v) => '<div class="scene"><div class="sub"><b>' + esc(v.label) + '</b> · ' + esc(v.sub) + '</div>' + v.actors.map((c) => (all.push(c), card(c, D.scene.seconds))).join('') + '</div>').join('');
const longest = Math.max(soloMax, D.scene.seconds);
let t = 0, playing = false, last = 0;
function seek(s) {
  t = Math.max(0, Math.min(longest, s));
  document.getElementById('time').textContent = t.toFixed(2) + ' s';
  document.getElementById('scrub').value = Math.round((t / longest) * 1000);
  for (const c of all) {
    const el = document.querySelector('[data-id="' + c.id + '"]'), svg = el.querySelector('svg'), sec = +svg.dataset.seconds, h = svg.querySelector('.head'), xx = (Math.min(t, sec) / sec) * W;
    h.setAttribute('x1', xx); h.setAttribute('x2', xx);
    const L = c.lines.find((l) => t >= l.at && t <= l.end + 0.15), cap = el.querySelector('.cap');
    if (!L) { cap.textContent = ''; continue; }
    const ws = c.words.filter((w) => w.t >= L.at - 1e-3 && w.t <= L.end + 1e-3);
    cap.innerHTML = ws.map((w) => { const now = t >= w.t && t < w.t + w.dur; return '<span class="' + (now ? 'now' : '') + '">' + (w.emph ? '<b>' + esc(w.w) + '</b>' : esc(w.w)) + '</span>'; }).join(' ');
  }
}
function frame(ms) { if (!playing) return; t += (ms - last) / 1000; last = ms; if (t >= longest) { playing = false; document.getElementById('play').textContent = 'Play'; } seek(t); if (playing) requestAnimationFrame(frame); }
document.getElementById('play').onclick = () => { playing = !playing; document.getElementById('play').textContent = playing ? 'Pause' : 'Play'; if (playing) { if (t >= longest) t = 0; last = performance.now(); requestAnimationFrame(frame); } };
document.getElementById('scrub').oninput = (e) => seek((e.target.value / 1000) * longest);
seek(0);
</script></body></html>
`;
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
