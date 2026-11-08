#!/usr/bin/env node
/**
 * THE PRACTICE ROOM — a game's hero and one of its foes in a greybox ring, on the runtime the game ships, the foe never
 * dying and standing still until its AI is switched on; a HUD of the last move's frame data beside what the feel card
 * asks, and a log of every press: taken, or dropped and why.
 *
 *   cd control
 *   export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…          # a database a game was made in (README of the-old-keep)
 *   node scripts/spikes/practice-room/room.mjs --game keep-hero --out /abs/dir [--pack 3] [--cdn]
 *
 * The room is a `controllable` manifest resolved by world-scene.js and emitted as export_game emits a level: the hero is
 * the game's first level's pilot (its rule, its figures, its camera, its lock), the foe that level's first foe, so what
 * plays here is what ships. Keys in the room: P the foe's AI on / off, R the foe set back, H the HUD. A spike: nothing
 * registers; the eyes gate is the operator's.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
// (the database the bins use, ~/.mojulo or MOJULO_DATA_DIR, never control/data: scripts/mojulo-paths.mjs, as mcp-stdio does)
if (!process.env.MOJULO_DATA_DIR && !process.env.MOJULO_HOME) { console.error('room: set MOJULO_DATA_DIR to the data directory a game was made in'); process.exit(2); }
(await import('../../mojulo-paths.mjs')).resolveMojuloPaths();

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const game = opt('--game', 'keep-hero'), out = path.resolve(opt('--out', 'practice-room')), pack = Math.max(1, Number(opt('--pack', '1'))), cdn = argv.includes('--cdn');

const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { asked } = await import('./measure.mjs');

const G = SketchRepository.getByRef(game)?.manifest;
if (!G) throw new Error(`room: no gameworld '${game}' in this database (MOJULO_DATA_DIR)`);
const lv = SketchRepository.getByRef(`${game}-level-${G.start ?? Object.keys(G.levels)[0]}-0`);
if (!lv) throw new Error(`room: '${game}' has no first level built (design_game run)`);
const L = lv.manifest, hero = L.entities.find((e) => e.pilotable), foe0 = L.entities.find((e) => e.team === 'foes');
if (!hero || !foe0) throw new Error('room: the first level has no pilot or no foe');

// ─── the ring: 1 m tiles in two greys (distances read off the floor), a low wall round it, four pillars, a ledge ───
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
for (const [x, y] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) box(x - 0.5, y - 0.5, x + 0.5, y + 0.5, 4, WALL, 'room:pillar');
box(-11, 4, -7, 9, 1.1, WALL, 'room:ledge');

// ─── the bodies: the hero as it ships, the foe (and its pack) never dying ───
const foes = Array.from({ length: pack }, (_, k) => {
  const a = pack === 1 ? 0 : (k / pack) * 2 * Math.PI, at = pack === 1 ? [0, 1, 0] : [3 * Math.sin(a), 2 + 3 * Math.cos(a), 0];
  return { ...structuredClone(foe0), id: `foe-${k + 1}`, noDestroy: true, transform: { pos: at, heading: -Math.PI / 2 } };
});
const { vista: _v, ...camera } = L.camera;
const entities = [{ ...structuredClone(hero), transform: { pos: [0, -3, 0], heading: Math.PI / 2 } }, ...foes];
const legend = 'W A S D  run · mouse  look · click  strike · F  sprint · F F  dodge · C  lock on · P  foe AI · R  reset · H  HUD';
const sketch = { ref: `${game}-practice-room`, manifest: { kind: 'controllable', title: `Practice room · ${G.name ?? game}`, bg: '#1b1d22', faces, colliders, figures: L.figures, entities, camera, ...(L.lock ? { lock: L.lock } : {}), ...(L.figureGrade ? { figureGrade: L.figureGrade } : {}), events: { hud: [{ text: legend, slot: 'bottom', ttl: 20 }] } } };

const { payload } = await resolveWorldScene(sketch, {});
if (!payload) throw new Error('room: the room did not resolve');
const pilot = payload.entities.find((e) => e.pilotable);
const card = asked(G.feel), rule = pilot.rule;
let html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });

// ─── the HUD: the live world read each frame (window.__mojCtrl), the card's numbers beside it ───
const HUD = `<style>#pr{position:fixed;top:10px;left:10px;width:330px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.82);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#pr b{color:#fff}#pr .k{color:#9aa0aa}#pr .bad{color:#f0a070}#pr .ok{color:#9fd49a}#pr table{border-collapse:collapse;width:100%}#pr td{padding:0 4px 0 0}#pr .log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>
<div id="pr"><b>Practice room</b> <span class="k">${JSON.stringify(G.feel ?? 'no feel').replace(/"/g, '')}</span><div id="pr-ai"></div><table id="pr-t"></table><div class="k" style="margin-top:6px">presses</div><div class="log" id="pr-log"></div></div>
<script>
(() => {
  const MOUSELOOK = ${!!(camera.mouseLook || camera.turnMode === 'look')}, CARD = ${JSON.stringify(card)}, RULE = ${JSON.stringify({ strikeDur: rule.strikeDur, strikeContact: rule.strikeContact, combo: rule.combo ?? 0 })};
  const $ = (id) => document.getElementById(id), F = (s) => Math.round(s * 60);
  let W = null, H = null, foes = [], last = null, prev = null, tPrev = 0, cur = null, presses = [], pending = [], seen = 0, hits0 = 0, homes = null, show = true;
  const setAi = (on) => { W.aiEnabled = on; $('pr-ai').innerHTML = 'foe AI <b class="' + (on ? 'bad' : 'ok') + '">' + (on ? 'ON' : 'off') + '</b> · foes never die'; };
  addEventListener('keydown', (e) => {
    if (!W) return;
    if (e.code === 'KeyP') setAi(!W.aiEnabled);
    if (e.code === 'KeyH') { show = !show; $('pr').style.display = show ? '' : 'none'; }
    if (e.code === 'KeyR') foes.forEach((f, k) => { f.transform.pos = homes[k].slice(); f.staggerT = null; f.downed = false; f.gone = false; if (f.hpMax) f.body.hp = f.hpMax; f.hits = 0; hits0 = 0; });
  });
  addEventListener('mousedown', (e) => { if (e.button === 0 && W) pending.push({ t: W.time, locked: !MOUSELOOK || !!document.pointerLockElement, swinging: H.swingT != null, cd: H.strikeCdT || 0, ready: H.readyT || 0, air: !H.grounded, dodge: H.dodgeT != null, combo: H.comboT || 0, n: H.swingCount || 0 }); });
  const reason = (p) => !p.locked ? 'the first click takes the mouse' : p.swinging ? 'mid-swing: the swing takes no cancel' : p.ready > 0 ? 'the weapon is not ready' : p.cd > 0 ? 'cooling down ' + p.cd.toFixed(2) + ' s' : p.air ? 'in the air' : p.dodge ? 'dodging' : 'not taken';
  const row = (k, card, rt, cls) => '<tr><td class="k">' + k + '</td><td>' + (card ?? '—') + '</td><td class="' + (cls || '') + '">' + (rt ?? '—') + '</td></tr>';
  function draw() {
    const m = last;
    const near = (a, b) => (a != null && b != null && Math.abs(a - b) <= 1 ? 'ok' : 'bad');
    $('pr-t').innerHTML = '<tr><td class="k">last move</td><td class="k">card</td><td class="k">runtime</td></tr>'
      + row('clip', '', m ? m.clip : null)
      + row('press → contact', CARD.startup, m && m.contact != null ? m.contact + ' f' : (m ? 'whiff' : null), m && near(m.contact, CARD.startup))
      + row('swing to rest', CARD.total, m && m.end != null ? m.end + ' f' : null, m && near(m.end, CARD.total))
      + row('next press taken', CARD.cancel ?? 'end', prev && prev.next != null ? prev.next + ' f' : null, prev && near(prev.next, CARD.cancel))
      + row('hitstop', CARD.hitstop, m ? m.stop + ' f' : null)
      + row('foe stun', CARD.stun, m && m.stun != null ? m.stun + ' f' : null)
      + row('advantage', '', m && m.adv != null ? (m.adv > 0 ? '+' : '') + m.adv + ' f' : null)
      + row('string', CARD.string + ' hits', m ? 'hit ' + m.k : null)
      + row('swing', '', RULE.strikeDur + ' s · window ' + JSON.stringify(RULE.strikeContact) + ' · combo ' + RULE.combo);
    $('pr-log').innerHTML = presses.slice(-8).reverse().map((p) => '<div class="' + (p.ok ? 'ok' : 'bad') + '">' + p.at.toFixed(2) + 's ' + p.text + '</div>').join('');
  }
  function tick() {
    if (!W && window.__mojCtrl && window.__mojCtrl.world) { W = window.__mojCtrl.world; H = W.byId[W.pilotId] || W.entities.find((e) => e.pilotable); foes = W.entities.filter((e) => e.team === 'foes'); homes = foes.map((f) => f.transform.pos.slice()); foes.forEach((f) => { f.noDestroy = true; }); setAi(false); }
    if (W) {
      const t = W.time, n = H.swingCount || 0, hits = foes.reduce((s, f) => s + (f.hits || 0), 0);
      // a press is judged two frames on: it started a swing, or it is dropped with its reason
      for (const p of pending.splice(0)) p.due = t + 2 / 60, presses.push(Object.assign(p, { at: p.t, text: '…' }));
      for (const p of presses) if (p.text === '…' && t >= p.due) { const ok = n > p.n; p.ok = ok; p.text = ok ? 'taken' + (H.swingCombo ? ' (the combo follow-up)' : '') : 'dropped: ' + reason(p); }
      if (n > seen) {
        const press = presses.filter((p) => p.ok).slice(-1)[0], t0 = press ? press.t : t;
        if (cur && cur.next == null) cur.next = F(t0 - cur.t0);
        cur = { t0, clip: H.swingClip, contact: null, end: null, next: null, stop: 0, stun: null, adv: null, k: (last && t0 - last.t0 < 1.5 ? last.k + 1 : 1), stunEnd: null };
        prev = last; last = cur; seen = n;
      }
      if (cur) {
        if (hits > hits0 && cur.contact == null) cur.contact = F(t - cur.t0);
        if (H.hitstopT > 0) cur.stopS = (cur.stopS || 0) + (t - tPrev); cur.stop = F(cur.stopS || 0);
        if (cur.end == null && H.swingT == null) cur.end = F(t - cur.t0);
        const reel = foes.some((f) => f.staggerT != null);
        if (cur.contact != null && reel) cur.stunEnd = t;
        if (cur.contact != null && !reel && cur.stunEnd != null && cur.stun == null) { cur.stun = F(cur.stunEnd - (cur.t0 + cur.contact / 60)); if (cur.end != null) cur.adv = F(cur.stunEnd - (cur.t0 + cur.end / 60)); }
      }
      hits0 = hits; tPrev = t;
      draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>`;
html = html.includes('</body>') ? html.replace('</body>', `${HUD}</body>`) : html + HUD;
await fs.mkdir(out, { recursive: true });
const file = path.join(out, 'practice-room.html');
await fs.writeFile(file, html);
console.log(`room: ${file} (${(html.length / 1e6).toFixed(1)} MB) · the hero '${pilot.body.figure}' (strike ${rule.strike ?? 'none'}, ${rule.strikeDur ?? '—'} s), ${pack} ${foe0.body.figure} never dying`);
process.exit(0);
