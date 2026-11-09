/**
 * THE MOUNT TREADMILL — a greybox lane for a game's hero and its horse (lib/graph/mount/, the controllable runtime's
 * `ride` rule and its getting on and off: worlds/controllable/mount.js): get on, ride up through the gaits, time them,
 * jump the fences, turn, get off. The practice room's sibling (../practice-room/room.mjs): the hero is the game's own,
 * from its first built level, and the horse the game's (its `mounts`, a coat), so what plays here is what ships.
 *
 *   cd control
 *   export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…          # a database a game was made in
 *   node scripts/spikes/mount-treadmill/room.mjs --game keep-hero --out /abs/dir [--coat chestnut] [--sound realistic|none] [--cdn]
 *
 * THE LANE (metres, along +y): the start line at 0, a post either side every 10 m (white, red at each 50), the 100 m
 * split timed from the start line; three fences across it, at 60 m (0.5 m), 110 m (0.8 m) and 160 m (1.1 m: the
 * horse's jump clears up to its `jump.clear`, the HUD says it, a fence above it stops the horse); open ground past 200 m
 * to turn, a ring of pylons 15 m round. The horse stands at the start, saddled, the hero beside it.
 * Keys: E get on (in reach) and off (at a walk or halted) · W urge up through the gaits, let go to come back, S check and
 * rein back · A / D turn · Space jump (a trot or faster) · K back to the start · H the HUD. A spike: nothing registers;
 * the eyes gate is the operator's.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
if (!process.env.MOJULO_DATA_DIR && !process.env.MOJULO_HOME) { console.error('mount treadmill: set MOJULO_DATA_DIR to the data directory a game was made in'); process.exit(2); }
(await import('../../mojulo-paths.mjs')).resolveMojuloPaths();

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const game = opt('--game', 'keep-hero'), out = path.resolve(opt('--out', 'mount-treadmill')), cdn = argv.includes('--cdn');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { sfxSound } = await import('../../../lib/graph/sfx-shelf/resolve.js');

const G = SketchRepository.getByRef(game)?.manifest;
if (!G) throw new Error(`mount treadmill: no gameworld '${game}' in this database (MOJULO_DATA_DIR)`);
const L = SketchRepository.getByRef(`${game}-level-${G.start ?? Object.keys(G.levels)[0]}-0`)?.manifest;
if (!L) throw new Error(`mount treadmill: '${game}' has no first level built (design_game run)`);
const hero = L.entities.find((e) => e.pilotable);
if (!hero) throw new Error('mount treadmill: the first level has no pilot');
// (the game's horse: its first mount's coat, else --coat, else a bay)
const coat = opt('--coat') ?? (Array.isArray(G.mounts) ? G.mounts[0]?.coat : null) ?? (Array.isArray(L.mounts) ? L.mounts[0]?.coat : null) ?? 'bay';

// ─── the lane: 5 m tiles (a grey field, the lane in sand), the posts, the fences, the turning ring ───
const X0 = -30, X1 = 30, Y0 = -20, Y1 = 240, TILE = 5, faces = [], colliders = [];
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });
for (let x = X0; x < X1; x += TILE) for (let y = Y0; y < Y1; y += TILE) {
  const lane = x >= -5 && x < 5 && y >= 0 && y < 200;
  faces.push(quad([x, y, 0], [x + TILE, y, 0], [x + TILE, y + TILE, 0], [x, y + TILE, 0], lane ? (((y / TILE) | 0) % 2 ? '#b9a27c' : '#c4ad86') : (((x + y) / TILE) % 2 ? '#7f8a74' : '#8a947e'), lane ? 'lane:sand' : 'lane:field'));
}
function box(x0, y0, x1, y1, h, fill, group, solid = true) {
  faces.push(quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group),
    quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
    quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group));
  if (solid) colliders.push({ min: [x0, y0, 0], max: [x1, y1, h], hold: false });
}
// the start line, and a post either side of the lane every 10 m (red at each 50)
box(-5, -0.15, 5, 0.15, 0.02, '#f2efe6', 'lane:line', false);
box(-5, 99.85, 5, 100.15, 0.02, '#f2efe6', 'lane:line', false);
for (let y = 0; y <= 200; y += 10) for (const x of [-5.6, 5.4]) box(x, y - 0.1, x + 0.2, y + 0.1, y % 50 ? 1.0 : 1.6, y % 50 ? '#e9e5da' : '#c8473b', 'lane:post', false);
// THE FENCES across the lane (rails on two standards), each its height
const FENCES = [[60, 0.5], [110, 0.8], [160, 1.1]];
for (const [y, h] of FENCES) { box(-5, y - 0.15, 5, y + 0.15, h, '#8b5a3c', 'lane:fence'); for (const x of [-5.3, 5.0]) box(x, y - 0.2, x + 0.3, y + 0.2, h + 0.3, '#5f3e2a', 'lane:standard', false); }
// the turning ring past the lane: pylons 15 m round
for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI; box(15 * Math.cos(a) - 0.3, 220 + 15 * Math.sin(a) - 0.3, 15 * Math.cos(a) + 0.3, 220 + 15 * Math.sin(a) + 0.3, 0.9, '#e0873a', 'lane:pylon', false); }

// ─── the bodies: the hero as it ships, beside its horse at the start ───
const { vista: _v, ...camera } = L.camera;
const START = { hero: [-2.4, -6, 0], horse: [0, -6, 0] };
const heroE = { ...structuredClone(hero), transform: { pos: START.hero.slice(), heading: Math.PI / 2 } };
const soundStyle = opt('--sound', 'realistic');
const soundOf = (word) => { const v = sfxSound(word, { style: soundStyle }); return v && v.gestures ? v.gestures : null; };
const audio = soundStyle === 'none' ? null : (() => { const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land'); return step ? { footsteps: Object.fromEntries(Object.entries({ step, jump, land }).filter(([, v]) => v)) } : null; })();
const legend = 'E  get on / off · W  urge on (up through the gaits) · S  check, rein back · A / D  turn · Space  jump (a trot or faster) · K  back to the start · H  HUD';
const sketch = { ref: `${game}-mount-treadmill`, manifest: { kind: 'controllable', title: `Mount treadmill · ${G.name ?? game}`, bg: '#a9c0cf', faces, colliders, figures: L.figures, entities: [heroE], camera,
  mounts: [{ at: START.horse.slice(0, 2), heading: Math.PI / 2, coat }], ...(audio ? { audio } : {}), events: { hud: [{ text: legend }] } } };
const { payload } = await resolveWorldScene(sketch, {});
if (!payload) throw new Error('mount treadmill: the room did not resolve');
const horse = payload.entities.find((e) => e.rule && e.rule.type === 'ride');
if (!horse) throw new Error('mount treadmill: no horse laid (the world\'s mounts)');
const HR = horse.rule;
const CARD = { coat, gaits: (HR.gaits || []).map((g) => ({ gait: g.clip.replace('ride_', ''), v: g.v, stride: g.stride })), jump: HR.jump ? { clear: HR.jump.clear, v: HR.jump.v, s: HR.jump.s } : null, back: HR.back ? HR.back.v : null,
  fences: FENCES, reach: horse.mount ? horse.mount.reach : null };
if (!CARD.gaits.length) throw new Error('mount treadmill: the horse stands loose: no hero rides it (the hero\'s riding clips were not solved)');
let html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });

// ─── the HUD: the live world read each frame (window.__mojCtrl), the horse's numbers beside it ───
const HUD = `<style>#mt{position:fixed;top:10px;left:10px;width:350px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#mt b{color:#fff}#mt .k{color:#9aa0a8}#mt h4{margin:6px 0 2px;font-size:11px;color:#c9a96a;text-transform:uppercase;letter-spacing:.05em}#mt .on{color:#c9a96a;font-weight:700}#mt .bad{color:#f08a7a}</style>
<div id="mt"><b>Mount treadmill</b> <span class="k">${G.name ?? game} · a ${coat} horse</span><h4>the horse</h4><div id="mt-c"></div><h4>live</h4><div id="mt-l"></div><h4>log</h4><div id="mt-log"></div></div>
<script>
(() => {
  const CARD = ${JSON.stringify(CARD)}, START = ${JSON.stringify(START)};
  const $ = (id) => document.getElementById(id);
  let W = null, H = null, M = null, show = true, log = [], prev = null, v = 0, top = 0, split = null, fenceHit = {}, wasJump = false, phase0 = null;
  const say = (t, text, bad) => { log.push({ t, text, bad }); if (log.length > 9) log.shift(); };
  addEventListener('keydown', (e) => {
    if (!W) return;
    if (e.code === 'KeyH') { show = !show; $('mt').style.display = show ? '' : 'none'; }
    if (e.code === 'KeyK') { M.transform.pos = [START.horse[0], START.horse[1], M.transform.pos[2]]; M.transform.heading = Math.PI / 2; M.speed = 0; if (!H.mountedOn) { H.transform.pos = [START.hero[0], START.hero[1], H.transform.pos[2]]; H.transform.heading = Math.PI / 2; } split = null; top = 0; }
  });
  const gaitRow = () => CARD.gaits.map((g, i) => '<span class="' + (M && M.riderId && (M.gaitIx ?? -1) === i ? 'on' : '') + '">' + g.gait + ' ' + g.v + '</span>').join(' · ');
  function tick() {
    if (!W && window.__mojCtrl && window.__mojCtrl.world) { W = window.__mojCtrl.world; H = W.entities.find((e) => e.rides) || W.byId.hero; M = W.entities.find((e) => e.rule && e.rule.type === 'ride'); }
    if (W && H && M) {
      const t = W.time || 0, p = M.transform.pos;
      // (the horse's speed measured off its ground travel, eased)
      if (prev) { const dt = t - prev.t; if (dt > 0) { const inst = Math.hypot(p[0] - prev.x, p[1] - prev.y) / dt; v += (inst - v) * Math.min(1, dt * 8); } }
      prev = { t, x: p[0], y: p[1] }; top = Math.max(top, v);
      const phase = H.mountPhase || 'on foot';
      if (phase !== phase0) { if (phase0 != null) say(t, phase === 'ride' ? 'in the saddle' : phase === 'on foot' ? 'on foot' : phase); phase0 = phase; }
      // the 100 m split: from the start line to the 100 m line, ridden up the lane
      if (M.riderId && p[1] >= 0 && prev && split == null && Math.abs(p[0]) < 5) split = { t0: null };
      if (split && split.t0 == null && p[1] >= 0 && p[1] < 2) split.t0 = t;
      if (split && split.t0 != null && split.done == null && p[1] >= 100) { split.done = t - split.t0; say(t, '100 m in ' + split.done.toFixed(2) + ' s (' + (100 / split.done).toFixed(1) + ' m/s)'); }
      // the jumps and the fences: a jump taken, a fence cleared (past it, its height) or refused (stopped at it)
      const jumping = M.jumpT != null; if (jumping && !wasJump) say(t, 'jump at ' + v.toFixed(1) + ' m/s'); wasJump = jumping;
      for (const [fy, fh] of CARD.fences) { const k = String(fy);
        if (Math.abs(p[0]) < 5 && p[1] > fy + 0.5 && !fenceHit[k]) { fenceHit[k] = 'cleared'; say(t, 'cleared the ' + fh + ' m fence'); }
        if (Math.abs(p[0]) < 5 && p[1] < fy && p[1] > fy - 2 && v < 0.4 && M.riderId && !fenceHit[k + 'r']) { fenceHit[k + 'r'] = 1; say(t, 'stopped at the ' + fh + ' m fence' + (CARD.jump && fh > CARD.jump.clear ? ' (above the jump\\'s ' + CARD.jump.clear + ' m)' : ''), true); }
        if (p[1] < fy - 5) { fenceHit[k] = null; fenceHit[k + 'r'] = null; } }
      if (p[1] < -1) split = null;
      $('mt-c').innerHTML = 'gaits (m/s): ' + gaitRow() + (CARD.back ? '<br>rein back <b>' + CARD.back + '</b> m/s' : '') + (CARD.jump ? '<br>jump: clears <b>' + CARD.jump.clear + ' m</b> · carried at <b>' + CARD.jump.v + '</b> m/s' : '')
        + '<br><span class="k">fences ' + CARD.fences.map(([y, h]) => h + ' m at ' + y).join(' · ') + '</span>';
      $('mt-l').innerHTML = (M.riderId ? '<b>riding</b>' : '<b>' + phase + '</b>') + ' · speed <b>' + v.toFixed(1) + '</b> m/s · top <b>' + top.toFixed(1) + '</b>'
        + '<br>along the lane <b>' + p[1].toFixed(1) + ' m</b>' + (M.jumpT != null ? ' · <b>in the air</b>' : '') + (split && split.done != null ? ' · 100 m <b>' + split.done.toFixed(2) + ' s</b>' : '');
      $('mt-log').innerHTML = log.slice().reverse().map((x) => '<div class="' + (x.bad ? 'bad' : '') + '">' + x.t.toFixed(1) + 's ' + x.text + '</div>').join('');
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>`;
html = html.includes('</body>') ? html.replace('</body>', `${HUD}</body>`) : html + HUD;
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'mount-treadmill.html');
await fs.writeFile(file, html);
console.log(`mount treadmill: ${file} (${(html.length / 1e6).toFixed(1)} MB) · a ${coat} horse: ${CARD.gaits.map((g) => `${g.gait} ${g.v} m/s`).join(', ')}${CARD.jump ? `; its jump clears ${CARD.jump.clear} m` : ''}`);
process.exit(0);
