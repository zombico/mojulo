#!/usr/bin/env node
// throws — the throw library as STICK FIGURES (the eyes gate's page): every technique baked in
// lib/graph/contest/throw-sticks.data.js (node scripts/throw-sticks.mjs) played as a stick figure in a self-contained page,
// side on and from behind the thrower, the ball in the hand until it leaves and then flying as the library launches it
// (its speed, its line; real gravity, no air), looping; a scrubber, a speed control, the release marked.
//
//   node scripts/spikes/manipulator/throws.mjs --page out.html [--only overhand,toss]
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { THROW_STICKS, THROW_STICK_JOINTS, THROW_STICK_FRAME } = await import(path.join(control, 'lib/graph/contest/throw-sticks.data.js'));
const args = process.argv.slice(2), at = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const only = at('--only')?.split(','), out = at('--page') ?? 'throws.html';
const lib = Object.fromEntries(Object.entries(THROW_STICKS).filter(([k]) => !only || only.includes(k)));

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Throw Library</title>
<style>
:root{--bg:#f6f5f2;--ink:#1d1d1f;--mute:#6b6b70;--card:#fff;--line:#e2e0da;--L:#2f6fd6;--R:#d4502f;--ball:#c9a227}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--ink:#ececef;--mute:#9a9aa2;--card:#1d1d21;--line:#2c2c31;--L:#6f9cf0;--R:#f07a58;--ball:#e2c04a}}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
header{padding:20px 16px 8px;max-width:1200px;margin:auto}h1{font-size:20px;margin:0 0 4px}p{margin:0;color:var(--mute)}
.bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 16px;max-width:1200px;margin:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;padding:8px 16px 24px;max-width:1200px;margin:auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px}
.card h2{font-size:15px;margin:0 0 2px}.card .meta{font-size:12px;color:var(--mute);margin-bottom:6px}
canvas{width:100%;height:auto;display:block;border-radius:6px;background:var(--bg)}
.says{font-size:12px;color:var(--mute);margin-top:6px}
input[type=range]{width:180px}
</style></head><body>
<header><h1>Throw library</h1><p>Each technique solved by the manual manipulator on the canonical hero, baked to the sports pages' stick. Left: side on (the target to the right). Right: from behind the thrower. The ball is held to the release, then flies at the library's launch.</p></header>
<div class="bar"><label>speed <input id="spd" type="range" min="0.1" max="1" step="0.05" value="0.35"></label><label><input id="pause" type="checkbox"> pause</label><label>scrub <input id="scrub" type="range" min="0" max="1" step="0.001" value="0"></label></div>
<div class="grid" id="grid"></div>
<script>
const LIB = ${JSON.stringify(lib)};
const J = ${JSON.stringify(THROW_STICK_JOINTS)}, FRAME = ${JSON.stringify(THROW_STICK_FRAME)};
const BONES = [['pelvis','neck'],['neck','shoulderL'],['shoulderL','elbowL'],['elbowL','wristL'],['neck','shoulderR'],['shoulderR','elbowR'],['elbowR','wristR'],['pelvis','hipL'],['hipL','kneeL'],['kneeL','ankleL'],['pelvis','hipR'],['hipR','kneeR'],['kneeR','ankleR']];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const grid = document.getElementById('grid'), cards = [];
for (const [name, T] of Object.entries(LIB)) {
  const el = document.createElement('div'); el.className = 'card';
  const ok = Object.values(T.laws).every(Boolean), bad = Object.entries(T.laws).filter(([, v]) => !v).map(([k]) => k);
  el.innerHTML = '<h2>' + name + '</h2><div class="meta">' + T.ball.id + ' · ' + T.ball.grip + ' grip · ' + T.hands + ' hand' + (T.hands > 1 ? 's' : '') + ' · ' + T.release.spec.speed + ' m/s at ' + T.release.spec.elevation + '° · ' + T.seconds + ' s · laws ' + (ok ? 'all hold' : 'missing: ' + bad.join(', ')) + '</div><canvas width="680" height="320"></canvas><div class="says">' + T.says + '</div>';
  grid.appendChild(el); cards.push({ name, T, cv: el.querySelector('canvas') });
}
const at = (T, u) => { const F = T.frames, x = Math.max(0, Math.min(1, u)) * (F.length - 1), i = Math.min(F.length - 2, Math.floor(x)), t = x - i;
  const L = (a, b) => a.map((v, k) => (v + (b[k] - v) * t) / 1000); const o = {}; J.forEach((k, j) => o[k] = L(F[i][j], F[i + 1][j])); const n = J.length; o.ball = F[i][n] && F[i + 1][n] ? L(F[i][n], F[i + 1][n]) : F[i][n] ? F[i][n].map((v) => v / 1000) : null; return o; };
// the ball after the release: the library's launch from the release point, gravity only
const flight = (T, dt) => { const s = T.release.spec, e = s.elevation * Math.PI / 180, p = T.release.at.map((v) => v / 1000); return [p[0], p[1] + s.speed * Math.cos(e) * dt, p[2] + s.speed * Math.sin(e) * dt - 4.905 * dt * dt]; };
let clock = 0, last = performance.now();
function draw(c, u) {
  const { T, cv } = c, g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  // (the frames are off the pelvis at the start: the floor lies under the lowest ankle there, an ankle's height lower)
  const P = at(T, u), half = W / 2, sc = 110, floor = H - 22, lift = -Math.min(T.frames[0][J.indexOf('ankleL')][2], T.frames[0][J.indexOf('ankleR')][2]) / 1000 + 0.07;
  const views = [{ x0: half * 0.36, proj: (p) => [p[1], p[2], p[0]] }, { x0: half + half * 0.5, proj: (p) => [p[0], p[2], -p[1]] }];
  g.strokeStyle = css('--line'); g.lineWidth = 1; g.beginPath(); g.moveTo(8, floor); g.lineTo(half - 8, floor); g.moveTo(half + 8, floor); g.lineTo(W - 8, floor); g.stroke();
  for (const v of views) {
    const S = (p) => { const q = v.proj([p[0], p[1], p[2] + lift]); return [v.x0 + q[0] * sc, floor - q[1] * sc, q[2]]; };
    const segs = BONES.map(([a, b]) => ({ a: S(P[a]), b: S(P[b]), side: /L$/.test(b) ? 'L' : /R$/.test(b) ? 'R' : 'C' })).sort((x, y) => (x.a[2] + x.b[2]) - (y.a[2] + y.b[2]));
    for (const s of segs) { g.strokeStyle = s.side === 'L' ? css('--L') : s.side === 'R' ? css('--R') : css('--ink'); g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(s.a[0], s.a[1]); g.lineTo(s.b[0], s.b[1]); g.stroke(); }
    const head = S(P.neck), hb = S([P.neck[0], P.neck[1], P.neck[2] + 0.12]); g.fillStyle = css('--ink'); g.beginPath(); g.arc(hb[0], hb[1], 0.1 * sc, 0, 7); g.fill();
    let b = P.ball; const gone = u > T.release.u;
    if (gone) b = flight(T, (u - T.release.u) * T.seconds);
    if (b) { const q = S(b); g.fillStyle = css('--ball'); g.beginPath(); g.arc(q[0], q[1], Math.max(3, T.ball.r * sc), 0, 7); g.fill(); }
  }
  g.fillStyle = css('--mute'); g.font = '12px system-ui'; g.fillText((u * T.seconds).toFixed(2) + ' s' + (u > T.release.u ? ' · released' : ''), 10, 16);
}
function tick(now) {
  const dt = (now - last) / 1000; last = now;
  const spd = +document.getElementById('spd').value, paused = document.getElementById('pause').checked, scrub = +document.getElementById('scrub').value;
  if (!paused) clock += dt * spd;
  for (const c of cards) { const L = c.T.seconds + 0.6; const u = paused ? scrub : Math.min(1, (clock % L) / c.T.seconds); draw(c, u); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
</script></body></html>`;
writeFileSync(out, html);
console.log(`throws: wrote ${out} (${Object.keys(lib).length} throws, ${html.length} bytes)`);
