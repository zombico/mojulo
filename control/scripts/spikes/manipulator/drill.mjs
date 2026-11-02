#!/usr/bin/env node
// drill — the manual manipulator's target drill (lib/graph/polygonizer/hero-reach.js targetDrill) on the realistic hero:
// seeded targets around the striking shoulder from the guard, each struck with its cheapest approach, as little of the
// ladder as lands it (the girdle, the trunk, the hips and weight, a step) and the surface drawn for it, driven along its
// path (straight, or an arc for a hook or an uppercut) and recovered. Prints each target and its checks on the clip as
// played (the contact's error, the surface's facing off the approach, the servos past a stop, the surface off its path,
// the balance at contact), and the drill's worst.
//
//   node scripts/spikes/manipulator/drill.mjs [--cast male] [--seed 1] [--count 6] [--surfaces knuckles,palmHeel]
//        [--bands '[0.6,0.95]'] [--az '[-45,80]'] [--el '[-35,45]'] [--page out.html] [--sheet <dir>] [--json out.json]
//
// --page writes the EYES GATE's page: one self-contained HTML file that plays the drill's skeleton (every bone of the
// rig, posed by the clip as keyedClip plays it, 30 frames a second) with the targets and their drive paths drawn, a target
// lit as the hand drives at it and marked when struck; drag to turn round it, scroll to come closer, the scrubber and
// the speed below. --sheet renders the guard and each contact frame, whole body, through the body-study skill.
import { register } from 'node:module';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { validateRig, rigNodesAt } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { targetDrill, SURFACE_NAMES, RUNGS } = await import('@/lib/graph/polygonizer/hero-reach.js');

const { values: opt } = parseArgs({ options: {
  cast: { type: 'string', default: 'male' }, seed: { type: 'string', default: '1' }, count: { type: 'string', default: '6' }, surfaces: { type: 'string', default: SURFACE_NAMES.join(',') },
  bands: { type: 'string' }, az: { type: 'string' }, el: { type: 'string' }, page: { type: 'string' }, sheet: { type: 'string' }, json: { type: 'string' },
} });

const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: opt.cast, form: 'realistic' }) });
const R = validateRig(m.recipe.rig);
const t0 = performance.now();
const D = targetDrill(R, { seed: Number(opt.seed), count: Number(opt.count), surfaces: opt.surfaces.split(','), ...(opt.bands ? { bands: JSON.parse(opt.bands) } : {}), ...(opt.az ? { az: JSON.parse(opt.az) } : {}), ...(opt.el ? { el: JSON.parse(opt.el) } : {}) });
const ms = performance.now() - t0;
const mm = (v) => +(v * 1000).toFixed(1);

console.log(`\n══ the target drill: ${opt.cast} (realistic), right hand from the guard, seed ${D.seed} ══ ${D.targets.length} targets in ${D.seconds} s of clip (solved in ${(ms / 1000).toFixed(1)} s)`);
console.log(' #  surface    approach  rung    share  az°    el°    t s     status  contact mm  facing°  path mm  balance mm  past a stop');
D.targets.forEach((x, i) => {
  const c = D.checks.targets[i];
  console.log(`${String(i).padStart(2)}  ${x.surface.padEnd(10)} ${x.family.padEnd(9)} ${RUNGS[x.rung].padEnd(7)} ${String(x.share).padEnd(6)} ${String(x.az).padStart(5)}  ${String(x.el).padStart(5)}  ${String(x.t).padEnd(6)}  ${(c.contact > 0.005 ? "missed" : x.reached ? "landed" : "stop").padEnd(7)}  ${String(mm(c.contact)).padStart(9)}  ${String(c.approach).padStart(7)}  ${String(mm(c.path)).padStart(7)}  ${String(mm(c.balance)).padStart(10)}  ${c.past.join(', ') || '-'}`);
});
const w = D.checks.worst;
console.log(`worst: contact ${mm(w.contact)} mm, facing ${w.approach}°, ${mm(w.path)} mm off its path, the balance ${mm(w.balance)} mm inside the feet, ${w.past} servo readings past a stop; ${D.targets.filter((x) => !x.reached).length} target(s) landed past a stop or missed`);

const acts = [{ pose: D.clip.fn(0), label: 'guard' }, ...D.targets.map((x) => ({ pose: D.clip.fn(x.t / D.seconds), label: `${x.surface} ${x.family}` }))];
if (opt.json) writeFileSync(opt.json, JSON.stringify({ targets: D.targets, checks: D.checks, seconds: D.seconds, keys: D.keys, acts }, null, 2));
if (opt.page) { writeFileSync(opt.page, pageOf()); console.log(`page → ${opt.page}`); }
if (opt.sheet) {
  const r = spawnSync(process.execPath, [path.join(CONTROL, '../.claude/skills/body-study/body.mjs'), opt.cast, '--hero', '{"form":"realistic"}', '--out', opt.sheet, '--acts', JSON.stringify(acts.map((a) => ({ pose: a.pose })))], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}

/** the review page: the skeleton's frames, the bones as joint pairs, the targets */
function pageOf() {
  const FPS = 30, n = Math.max(2, Math.round(D.seconds * FPS) + 1);
  // the rig's bones, and the links a skeleton reads by that are not bones (the hips and the collarbones to the spine, the feet)
  const extra = [['pelvisHub', 'hipL'], ['pelvisHub', 'hipR'], ['neckHub', 'clavicleL'], ['neckHub', 'clavicleR'], ...Object.values(R.legs).flatMap((L) => [[L.hock, L.toeBase], [L.toeBase, L.toeTip]])];
  const bones = [...R.bones.map((b) => [b.head, b.tail]), ...extra].filter(([a, b]) => R.joints[a] && R.joints[b] && !/Fold|Aim|Axis|Hinge/.test(a + b));
  const names = [...new Set(bones.flat())], idx = Object.fromEntries(names.map((j, i) => [j, i]));
  const frames = Array.from({ length: n }, (_, i) => { const nd = rigNodesAt(R, D.clip.fn(i / (n - 1))).nodes; return names.map((j) => (nd[j] ?? [0, 0, 0]).map((v) => +v.toFixed(4))); });
  const data = {
    seconds: D.seconds, fps: FPS, bones: bones.map(([a, b]) => [idx[a], idx[b]]), side: names.map((j) => (/R$/.test(j) ? 1 : /L$/.test(j) ? -1 : 0)), frames,
    targets: D.targets.map((x, i) => ({ ...x, check: D.checks.targets[i] })), cast: opt.cast, seed: D.seed,
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Target Drill Review</title>
<style>
:root { --bg: #f6f5f2; --panel: #ffffff; --ink: #1d1d1f; --muted: #6b6b70; --line: #d9d7d2; --bone: #3b3b40; --boneR: #b3541e; --boneL: #2f6f9f; --target: #8a8a90; --live: #d1342f; --hit: #2e8b57; --path: #c9a227; --floor: #e7e5df; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #141416; --panel: #1d1d20; --ink: #ececee; --muted: #9a9aa2; --line: #333338; --bone: #d6d6da; --boneR: #f08a4b; --boneL: #6fb3e8; --target: #77777f; --live: #ff5a52; --hit: #5fd38d; --path: #e8c547; --floor: #232327; } }
:root[data-theme="dark"] { --bg: #141416; --panel: #1d1d20; --ink: #ececee; --muted: #9a9aa2; --line: #333338; --bone: #d6d6da; --boneR: #f08a4b; --boneL: #6fb3e8; --target: #77777f; --live: #ff5a52; --hit: #5fd38d; --path: #e8c547; --floor: #232327; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 16px; }
h1 { font-size: 18px; margin: 0 0 4px; } p.sub { margin: 0 0 12px; color: var(--muted); }
.stage { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
canvas { display: block; width: 100%; height: min(70vh, 640px); touch-action: none; cursor: grab; }
.bar { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
button, select { font: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; }
input[type=range] { flex: 1; min-width: 140px; } .time { font-variant-numeric: tabular-nums; color: var(--muted); min-width: 92px; }
table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { color: var(--muted); font-weight: 600; } tr.on td { background: color-mix(in srgb, var(--live) 12%, transparent); } td.no { color: var(--live); } .wrap { overflow-x: auto; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; color: var(--muted); font-size: 12px; margin-top: 8px; } .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
</style></head><body><main>
<h1>Target drill review</h1>
<p class="sub" id="sub"></p>
<div class="stage"><canvas id="c"></canvas>
<div class="bar"><button id="play">Pause</button><input type="range" id="t" min="0" max="1000" value="0"><span class="time" id="clock"></span>
<select id="speed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1" selected>1×</option></select>
<button id="view">Front</button></div></div>
<div class="legend"><span><i class="sw" style="background:var(--boneR)"></i>right side</span><span><i class="sw" style="background:var(--boneL)"></i>left side</span><span><i class="sw" style="background:var(--live)"></i>the target being struck</span><span><i class="sw" style="background:var(--hit)"></i>struck</span><span><i class="sw" style="background:var(--path)"></i>its drive</span></div>
<div class="wrap"><table><thead><tr><th>#</th><th>surface</th><th>approach</th><th>body</th><th>share of reach</th><th>status</th><th>contact</th><th>path</th><th>balance</th><th>past a stop</th></tr></thead><tbody id="rows"></tbody></table></div>
</main>
<script>
const D = ${json};
const RUNGS = ${JSON.stringify(RUNGS)};
const cv = document.getElementById('c'), ctx = cv.getContext('2d'), css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
document.getElementById('sub').textContent = D.cast + ' (realistic), right hand from the guard, seed ' + D.seed + ': ' + D.targets.length + ' targets, ' + D.seconds.toFixed(2) + ' s. The checks were measured on this clip; whether it reads as striking is for you to judge.';
const mm = (v) => (v * 1000).toFixed(1) + ' mm';
document.getElementById('rows').innerHTML = D.targets.map((x, i) => '<tr id="r' + i + '"><td>' + i + '</td><td>' + x.surface + '</td><td>' + x.family + '</td><td>' + (x.step && RUNGS[x.rung] !== 'step' ? RUNGS[x.rung] + ' + step' : RUNGS[x.rung]) + '</td><td>' + x.share + '</td><td' + (x.reached ? '' : ' class="no"') + '>' + (x.check.contact > 0.005 ? 'missed' : x.reached ? 'landed' : 'landed past a stop') + '</td><td>' + mm(x.check.contact) + '</td><td>' + mm(x.check.path) + '</td><td' + (x.check.balance < 0 ? ' class="no"' : '') + '>' + mm(x.check.balance) + '</td><td' + (x.check.past.length ? ' class="no"' : '') + '>' + (x.check.past.join(', ') || '–') + '</td></tr>').join('');
// the camera: orbit round the body's middle, z up
let az = -0.5, el = 0.18, dist = 2.5, playing = true, t = 0, last = null, speed = 1;
const mid = (() => { const f = D.frames[0]; let s = [0, 0, 0]; f.forEach((p) => { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }); return s.map((v) => v / f.length); })();
function project(p) {
  const x = p[0] - mid[0], y = p[1] - mid[1], z = p[2] - mid[2];
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const X = ca * x - sa * y, Y0 = sa * x + ca * y, Z = ce * z - se * Y0, Y = se * z + ce * Y0;   // Y: depth away from the camera
  const k = (cv.height * 0.9) / (dist - Y) * 1.0;
  return [cv.width / 2 + X * k, cv.height / 2 - Z * k, dist - Y];
}
function resize() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; }
addEventListener('resize', resize); resize();
let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, az, el]; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
cv.addEventListener('pointermove', (e) => { if (!drag) return; az = drag[2] - (e.clientX - drag[0]) * 0.008; el = Math.max(-0.2, Math.min(1.3, drag[3] + (e.clientY - drag[1]) * 0.006)); });
cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(1.4, Math.min(7, dist * (1 + e.deltaY * 0.001))); }, { passive: false });
const views = [['Front', 0, 0.12], ['Side', -Math.PI / 2, 0.12], ['Above', -0.5, 1.2], ['Three-quarter', -0.5, 0.18]]; let vi = 3;
document.getElementById('view').onclick = () => { vi = (vi + 1) % views.length; az = views[vi][1]; el = views[vi][2]; document.getElementById('view').textContent = views[(vi + 1) % views.length][0]; };
document.getElementById('play').onclick = () => { playing = !playing; document.getElementById('play').textContent = playing ? 'Pause' : 'Play'; };
document.getElementById('speed').onchange = (e) => { speed = +e.target.value; };
const slider = document.getElementById('t'); slider.oninput = () => { t = (slider.value / 1000) * D.seconds; playing = false; document.getElementById('play').textContent = 'Play'; };
function frameAt(time) { const f = Math.max(0, Math.min(D.frames.length - 1, (time / D.seconds) * (D.frames.length - 1))), i = Math.floor(f), w = f - i, A = D.frames[i], B = D.frames[Math.min(i + 1, D.frames.length - 1)]; return A.map((p, j) => [p[0] + (B[j][0] - p[0]) * w, p[1] + (B[j][1] - p[1]) * w, p[2] + (B[j][2] - p[2]) * w]); }
function draw(now) {
  if (last !== null && playing) t = (t + ((now - last) / 1000) * speed) % D.seconds; last = now;
  slider.value = Math.round((t / D.seconds) * 1000); document.getElementById('clock').textContent = t.toFixed(2) + ' / ' + D.seconds.toFixed(2) + ' s';
  ctx.clearRect(0, 0, cv.width, cv.height); const d = devicePixelRatio || 1;
  // the floor
  ctx.strokeStyle = css('--floor'); ctx.lineWidth = 1 * d;
  for (let g = -1.5; g <= 1.5001; g += 0.25) { let a = project([mid[0] + g, mid[1] - 1.5, 0]), b = project([mid[0] + g, mid[1] + 1.5, 0]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); a = project([mid[0] - 1.5, mid[1] + g, 0]); b = project([mid[0] + 1.5, mid[1] + g, 0]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // the targets and their drives: the one being driven at lit, the struck ones marked
  let on = -1;
  D.targets.forEach((x, i) => { const prev = i ? D.targets[i - 1].t : 0; if (t > prev + 0.05 && t <= x.t + 0.25) on = i; });
  D.targets.forEach((x, i) => {
    const struck = t > x.t + 0.03, live = i === on;
    if (live) { ctx.strokeStyle = css('--path'); ctx.lineWidth = 2.5 * d; ctx.beginPath(); x.path.forEach((p, k) => { const q = project(p); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); }
    const q = project(x.at), r = Math.max(4, 0.035 * cv.height * 0.9 / q[2]);
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    if (live) { ctx.fillStyle = css('--live'); ctx.globalAlpha = Math.abs(t - x.t) < 0.06 ? 1 : 0.55; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = struck && !live ? css('--hit') : live ? css('--live') : css('--target'); ctx.lineWidth = 2 * d; ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.font = (11 * d) + 'px system-ui'; ctx.fillText(String(i), q[0] + r + 3 * d, q[1] - r);
  });
  document.querySelectorAll('tr.on').forEach((r) => r.classList.remove('on')); if (on >= 0) document.getElementById('r' + on)?.classList.add('on');
  // the skeleton, far bones first
  const F = frameAt(t), segs = D.bones.map(([a, b]) => { const p = project(F[a]), q = project(F[b]); return { p, q, z: (p[2] + q[2]) / 2, s: D.side[a] || D.side[b] }; }).sort((u, v) => v.z - u.z);
  for (const s of segs) { ctx.strokeStyle = s.s > 0 ? css('--boneR') : s.s < 0 ? css('--boneL') : css('--bone'); ctx.lineWidth = Math.max(1.5, 14 * d / s.z); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.p[0], s.p[1]); ctx.lineTo(s.q[0], s.q[1]); ctx.stroke(); }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
</script></body></html>`;
}
