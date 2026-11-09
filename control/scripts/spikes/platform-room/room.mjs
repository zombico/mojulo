/**
 * THE PLATFORM ROOM — a greybox course for a 3D platformer's hero (a gameworld whose feel is the mascot platformer's,
 * gameworld/feel/cards.js `jumping-giuseppe`, under a chase camera: no lane, the whole floor), with its foes to stomp: the
 * jump and its cut, the double jump, the wall slide and kick, the sprint, the stomp's bounce (higher with the jump held),
 * and a touch that hurts. The practice room's sibling (../practice-room/room.mjs): the hero and the foes are the game's
 * own, from its built levels, so what plays here is what ships.
 *
 *   cd control
 *   export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…          # a database a platformer game was made in
 *   node scripts/spikes/platform-room/room.mjs --game plat-hero --out /abs/dir [--sound realistic|none] [--cdn]
 *
 * THE COURSE (metres; the floor 24 × 24, a low wall round it): a stair of three steps (0.6, 1.2, 1.8: each a hop, the
 * last a jump), two platforms at 1.8 m with a 2.5 m gap between (a running jump), a ledge at 3 m (the double jump's: one
 * jump will not reach it), and a chimney of two walls 5 m high and 1.6 m apart (the wall kick, side to side, to their
 * tops). THE FOES: walkers on the floor, on the far platform and on the ledge (each paces its stretch and turns at its
 * edge), and a hopper on the floor (the stomp timed to its hop); a felled foe comes back where it stood 3 s on.
 * Keys: Shift+F the foes' AI on / off, K the foes and the hero's hp set back, H the HUD. A spike: nothing registers; the eyes
 * gate is the operator's.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
if (!process.env.MOJULO_DATA_DIR && !process.env.MOJULO_HOME) { console.error('platform room: set MOJULO_DATA_DIR to the data directory a game was made in'); process.exit(2); }
(await import('../../mojulo-paths.mjs')).resolveMojuloPaths();

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const game = opt('--game', 'plat-hero'), out = path.resolve(opt('--out', 'platform-room')), cdn = argv.includes('--cdn');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { sfxSound } = await import('../../../lib/graph/sfx-shelf/resolve.js');
const { feelReport, feelCard, readFeel } = await import('../../../lib/graph/gameworld/feel/lower.js');

const G = SketchRepository.getByRef(game)?.manifest;
if (!G) throw new Error(`platform room: no gameworld '${game}' in this database (MOJULO_DATA_DIR)`);
// (the game's built levels, every one: the hero from the first, a foe of each class from wherever one stands)
const levels = Object.keys(G.levels).flatMap((k) => [0, 1, 2, 3, 4, 5].map((n) => SketchRepository.getByRef(`${game}-level-${k}-${n}`)?.manifest).filter(Boolean));
if (!levels.length) throw new Error(`platform room: '${game}' has no level built (design_game run)`);
const L = levels[0], hero = L.entities.find((e) => e.pilotable);
if (!hero) throw new Error('platform room: the first level has no pilot');
const foeOf = {};
for (const lv of levels) for (const e of lv.entities) if (e.team === 'foes' && e.rule?.foe && !foeOf[e.rule.foe.move]) foeOf[e.rule.foe.move] = { e, figures: lv.figures };
if (!foeOf.pace) throw new Error('platform room: no pacing foe (a walker) in the game\'s levels');

// ─── the course: 1 m tiles in two greys (distances read off the floor), a low wall, the steps, the gap, the ledge, the chimney ───
const HALF = 12, GREY = ['#8d8a83', '#97948c'], WALL = '#6d6f74', faces = [], colliders = [];
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });
for (let i = -HALF; i < HALF; i++) for (let j = -HALF; j < HALF; j++) faces.push(quad([i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0], GREY[(i + j + 2 * HALF) % 2], 'room:floor'));
function box(x0, y0, x1, y1, h, fill, group) {
  faces.push(quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group),
    quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
    quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group));
  colliders.push({ min: [x0, y0, 0], max: [x1, y1, h], hold: false });
}
const T = 0.5;
box(-HALF - T, -HALF - T, HALF + T, -HALF, 1.2, WALL, 'room:wall'); box(-HALF - T, HALF, HALF + T, HALF + T, 1.2, WALL, 'room:wall');
box(-HALF - T, -HALF, -HALF, HALF, 1.2, WALL, 'room:wall'); box(HALF, -HALF, HALF + T, HALF, 1.2, WALL, 'room:wall');
const STEP = '#a4917a', PLAT = '#7f8fa3', LEDGE = '#8a7fa3', CHIM = '#6f7c70';
const COURSE = [
  ['the stair 0.6', [-10, -2, -8, 0, 0.6], STEP], ['the stair 1.2', [-10, 0, -8, 2, 1.2], STEP], ['the stair 1.8', [-10, 2, -8, 4, 1.8], STEP],
  ['the near platform 1.8', [-6, 3, -3, 7, 1.8], PLAT], ['the far platform 1.8 (a 2.5 m gap)', [-0.5, 3, 2.5, 7, 1.8], PLAT],
  ['the ledge 3.0 (the double jump)', [5, 3, 10, 8, 3], LEDGE],
  ['the chimney (5 m, 1.6 m apart: the wall kick)', [6, -9, 7, -4, 5], CHIM], ['', [8.6, -9, 9.6, -4, 5], CHIM],
];
for (const [, [x0, y0, x1, y1, h], fill] of COURSE) box(x0, y0, x1, y1, h, fill, 'room:course');

// ─── the bodies: the hero as it ships, its foes where the course wants them ───
const { vista: _v, ...camera } = L.camera;
const heroE = { ...structuredClone(hero), transform: { pos: [0, -8, 0], heading: Math.PI / 2 } };
const PLACES = [
  ['pace', [-2, -4, 0], 0], ['pace', [1, 5, 1.8], Math.PI / 2], ['pace', [7.5, 5.5, 3], 0], [foeOf.hop ? 'hop' : 'pace', [3, -6, 0], 0],
];
const foes = PLACES.map(([move, at, heading], k) => {
  const src = foeOf[move].e, F = structuredClone(src);
  return { ...F, id: `foe-${k + 1}`, transform: { pos: at.slice(), heading } };
});
const figures = { ...L.figures };
for (const m of Object.keys(foeOf)) Object.assign(figures, Object.fromEntries(Object.entries(foeOf[m].figures).filter(([n]) => !figures[n])));
// THE SOUNDS (--sound realistic | arcade | foley | orchestral | synth | none): the footsteps, the jump and the landing
const soundStyle = opt('--sound', 'realistic');
const soundOf = (word) => { const v = sfxSound(word, { style: soundStyle }); return v && v.gestures ? v.gestures : null; };
const audio = soundStyle === 'none' ? null : (() => {
  const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land');
  return step ? { footsteps: Object.fromEntries(Object.entries({ step, jump, land }).filter(([, v]) => v)) } : null;
})();
const legend = 'W A S D  run · mouse  look · Space  jump (again in the air: the double jump; at a wall: the kick) · F  sprint · land on a foe: the stomp (Space held: higher) · Shift+F  foe AI · K  reset · H  HUD';
const sketch = { ref: `${game}-platform-room`, manifest: { kind: 'controllable', title: `Platform room · ${G.name ?? game}`, bg: '#1b1d22', faces, colliders, figures, entities: [heroE, ...foes], camera, ...(audio ? { audio } : {}), events: { hud: [{ text: legend }] } } };
const { payload } = await resolveWorldScene(sketch, {});
if (!payload) throw new Error('platform room: the room did not resolve');
const pilot = payload.entities.find((e) => e.pilotable), R = pilot.rule;
// (what the card asks of the hero beside what the room measures: its jump, its air jumps, its wall, its stomp)
const report = G.feel ? feelReport(G.feel) : null;
const CARD = { jump: G.feel ? feelCard(readFeel(G.feel)).jump.height : null, airJumps: R.airJumps ?? 0, cling: !!R.cling, stomp: R.stomp ?? null, sprint: R.sprint ? R.sprint.speed : null, run: R.speed,
  // (the stomp the level lays where foes stand, gameworld/foes.js: carried here, whatever the card's report says)
  lost: report ? report.lost.map((x) => x.field).filter((f) => !(f === 'land.stomp' && R.stomp)) : [] };
let html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });

// ─── the HUD: the live world read each frame (window.__mojCtrl), the card's numbers beside it ───
const HUD = `<style>#pf{position:fixed;top:10px;left:10px;width:350px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#pf b{color:#fff}#pf .k{color:#9aa0a8}#pf h4{margin:6px 0 2px;font-size:11px;color:#c9a96a;text-transform:uppercase;letter-spacing:.05em}#pf .ok{color:#8fd18f}#pf .bad{color:#f08a7a}</style>
<div id="pf"><b>Platform room</b> <span class="k">${JSON.stringify(G.feel ?? 'no feel').replace(/"/g, '')}</span><div id="pf-ai"></div><h4>the card</h4><div id="pf-c"></div><h4>live</h4><div id="pf-l"></div><h4>the course</h4><div class="k">${COURSE.filter(([n]) => n).map(([n]) => n).join('<br>')}</div><h4>log</h4><div id="pf-log"></div></div>
<script>
(() => {
  const CARD = ${JSON.stringify(CARD)}, BACK = 3;
  const $ = (id) => document.getElementById(id);
  let W = null, H = null, foes = [], homes = null, hp0 = null, show = true, log = [], air = null, kicks = 0, stomps = 0, hits0 = 0, wasKick = false;
  const say = (t, text, ok = true) => { log.push({ t, text, ok }); if (log.length > 9) log.shift(); };
  const setAi = (on) => { W.aiEnabled = on; $('pf-ai').innerHTML = 'foe AI <b class="' + (on ? 'bad' : 'ok') + '">' + (on ? 'ON' : 'off') + '</b> · Shift+F · K resets'; };
  const back = (f, k) => { f.transform.pos = homes[k].slice(); f.staggerT = null; f.reactClip = null; f.downed = false; f.gone = false; f.dormant = false; f.body.hp = f.hpMax; f.hits = 0; f.backAt = null; f.foeStomped = false; f.foeEnds = null; f.vel = [0, 0, 0]; };
  addEventListener('keydown', (e) => {
    if (!W) return;
    if (e.code === 'KeyF' && e.shiftKey) setAi(!W.aiEnabled);
    if (e.code === 'KeyH') { show = !show; $('pf').style.display = show ? '' : 'none'; }
    if (e.code === 'KeyK') { foes.forEach((f, k) => back(f, k)); if (H.body && hp0 != null) { H.body.hp = hp0; H.downed = false; } hits0 = H.hits || 0; }
  });
  $('pf-c').innerHTML = 'jump <b>' + CARD.jump + ' m</b> · air jumps <b>' + CARD.airJumps + '</b> · wall kick <b>' + (CARD.cling ? 'yes' : 'no') + '</b><br>run <b>' + CARD.run + '</b>' + (CARD.sprint ? ' · sprint <b>' + CARD.sprint + '</b> m/s' : '')
    + (CARD.stomp ? '<br>stomp: bounce <b>' + CARD.stomp.low + '</b> m, <b>' + CARD.stomp.high + '</b> m with Space held · blow <b>' + CARD.stomp.blow + '</b> · a touch <b>' + (CARD.stomp.hurt || 0) + '</b> hp' : '')
    + (CARD.lost.length ? '<br><span class="k">not carried yet: ' + CARD.lost.join(', ') + '</span>' : '');
  function tick() {
    if (!W && window.__mojCtrl && window.__mojCtrl.world) {
      W = window.__mojCtrl.world; H = W.byId[W.pilotId] || W.entities.find((e) => e.pilotable); foes = W.entities.filter((e) => e.team === 'foes');
      homes = foes.map((f) => f.transform.pos.slice()); foes.forEach((f) => { f.hpMax = f.hpMax ?? f.body.hp; }); hp0 = H.body ? H.body.hp : null; hits0 = H.hits || 0; setAi(true);
    }
    if (W && H) {
      const t = W.time || 0, feet = H.transform.pos[2] - (H.rule.eye || 0);
      // (a jump: from the ground it left to the top of its arc, and where it came down)
      if (!H.grounded && !air) air = { from: feet, top: feet, t0: t, doubled: false };
      if (air) { air.top = Math.max(air.top, feet); if ((H.airJumpsUsed || 0) > 0) air.doubled = true; }
      if (H.grounded && air && air.top - air.from < 0.1) air = null;   // (a settle, a step down: no jump)
      if (H.grounded && air && t - air.t0 > 0.05) { say(t, 'jump ' + (air.top - air.from).toFixed(2) + ' m' + (air.doubled ? ' (with the double jump)' : '') + ', landed at ' + feet.toFixed(2) + ' m'); air = null; }
      const kick = (H.kickT || 0) > 0; if (kick && !wasKick) { kicks++; say(t, 'wall kick ' + kicks); } wasKick = kick;
      if ((H.hits || 0) > hits0) { say(t, 'touched: hurt (' + (H.body ? Math.round(H.body.hp) : '—') + ' hp left)', false); hits0 = H.hits || 0; }
      foes.forEach((f, k) => {
        if ((f.downed || f.gone || f.body.hp <= 0) && f.backAt == null) { f.backAt = t + BACK; stomps++; say(t, 'stomped: ' + (f.rule.foe.move === 'hop' ? 'the hopper' : 'a walker')); }
        else if (f.backAt != null && t >= f.backAt) back(f, k);
      });
      $('pf-l').innerHTML = 'feet <b>' + feet.toFixed(2) + ' m</b> · ' + (H.grounded ? 'grounded' : 'in the air') + (H.cling ? ' · <b>on the wall</b>' : '') + ' · air jumps used <b>' + (H.airJumpsUsed || 0) + '</b>'
        + '<br>wall kicks <b>' + kicks + '</b> · stomps <b>' + stomps + '</b> · hp <b>' + (H.body && H.body.hp != null ? Math.round(H.body.hp) : '—') + '</b>' + (H.downed ? ' <b class="bad">DOWN (K)</b>' : '');
      $('pf-log').innerHTML = log.slice().reverse().map((x) => '<div class="' + (x.ok ? '' : 'bad') + '">' + x.t.toFixed(2) + 's ' + x.text + '</div>').join('');
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>`;
html = html.includes('</body>') ? html.replace('</body>', `${HUD}</body>`) : html + HUD;
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'platform-room.html');
await fs.writeFile(file, html);
console.log(`platform room: ${file} (${(html.length / 1e6).toFixed(1)} MB) · the hero '${pilot.body.figure}' (a ${CARD.jump} m jump, ${CARD.airJumps} air jump${CARD.airJumps === 1 ? '' : 's'}, wall kick ${CARD.cling ? 'yes' : 'no'}), foes: ${foes.map((f) => f.rule.foe.move).join(', ')}${CARD.lost.length ? ` · not carried: ${CARD.lost.join(', ')}` : ''}`);
process.exit(0);
