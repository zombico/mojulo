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
 * plays here is what ships. Keys in the room: P the foe's AI on / off, K the foe set back, H the HUD. A spike: nothing
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
// (the room is one hero up close: its figures at the pose grade, the full density, unless --grade play, the game's)
const grade = opt('--grade', 'pose');
// (the game type's juice: action by default, its swing timing, wider poses and blade trails; --style none for none)
const styleArg = opt('--style', 'action'), fxStyle = styleArg === 'none' ? null : { register: opt('--register', 'anime'), flavor: styleArg };
const game = opt('--game', 'keep-hero'), out = path.resolve(opt('--out', 'practice-room')), pack = Math.max(1, Number(opt('--pack', '1'))), cdn = argv.includes('--cdn');

const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { asked } = await import('./measure.mjs');
const { BASIC_ARSENAL, readCombos, readArsenal, lowerArsenal, comboList } = await import('../../../lib/graph/gameworld/combos.js');
// the arsenal the room plays (--combos <file>: an arsenal, or one weapon's combo manifest; the basic sword and fist by
// default), every combo unlocked, the weapons stepped through on the cycle
const given = opt('--combos') ? JSON.parse(await fs.readFile(opt('--combos'), 'utf8')) : null;
const arsenal = readArsenal(!given ? structuredClone(BASIC_ARSENAL) : given.weapons ? given : { ...(given.timing ? { timing: given.timing } : {}), weapons: [{ id: 'sword', name: 'Sword', figure: 'drawn', ...readCombos(given) }] });
const weapons = lowerArsenal(arsenal);

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
const H0 = structuredClone(hero);
const entities = [{ ...H0, rule: { ...H0.rule, weapons, moveset: weapons[0].moveset }, transform: { pos: [0, -3, 0], heading: Math.PI / 2 } }, ...foes];
const legend = 'W A S D  run · mouse  look · click  light · right click  heavy · mouse back / R  weapon · F  sprint · F F  dodge · C  lock on · P  foe AI · K  reset · H  HUD';
// THE HERO: the game's own, or (--hero) another body on its rig and clips: `anime` the anime hero on the tiered body, or
// a hero spec as JSON; its sword in hand (the drawn figure) and on its back (the sheathed one)
const HEROES = { anime: { cast: 'male', head: 'anime', proportions: 'anime', form: 'tiered' }, tiered: { cast: 'male', form: 'tiered' } };
const heroArg = opt('--hero');
const own = heroArg ? (HEROES[heroArg] ?? JSON.parse(heroArg)) : null;
const figures = own ? Object.fromEntries(Object.entries(L.figures).map(([n, f]) => {
  if (n !== hero.body.figure && n !== hero.rule.combat?.drawn && n !== hero.rule.combat?.sheathed) return [n, f];
  const { heroRef: _r, ...keep } = f, sheathed = n === hero.rule.combat?.sheathed && n !== hero.rule.combat?.drawn;
  const motion = f.heroRef ? SketchRepository.getByRef(f.heroRef)?.manifest?.hero?.motion : null;   // (the game hero's own gaits: its jog, its sprint)
  return [n, { ...keep, hero: { ...(motion ? { motion } : {}), ...own, gear: sheathed ? { back: { item: 'sword' } } : { right: { item: 'sword' } } } }];
})) : L.figures;
const sketch = { ref: `${game}-practice-room`, manifest: { kind: 'controllable', title: `Practice room · ${G.name ?? game}`, bg: '#1b1d22', faces, colliders, figures, entities, camera, ...(L.lock ? { lock: L.lock } : {}), ...(grade === 'play' ? { figureGrade: 'play' } : {}), ...(fxStyle ? { fxStyle } : {}), events: { hud: [{ text: legend, slot: 'bottom', ttl: 20 }], ...(fxStyle ? { cast: true, reactions: [] } : {}) } } };

const { payload } = await resolveWorldScene(sketch, {});
if (!payload) throw new Error('room: the room did not resolve');
const pilot = payload.entities.find((e) => e.pilotable);
const card = asked(G.feel), rule = pilot.rule;
let html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });

// ─── the HUD: the live world read each frame (window.__mojCtrl), the card's numbers beside it ───
const HUD = `<style>#pr{position:fixed;top:10px;left:10px;width:360px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#pr b{color:#fff}#pr .k{color:#9aa0aa}#pr .bad{color:#f0a070}#pr .ok{color:#9fd49a}#pr .on{color:#ffd76a}#pr table{border-collapse:collapse;width:100%}#pr td{padding:0 4px 0 0;vertical-align:top}#pr .log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pr h4{margin:6px 0 2px;font-size:11px;color:#9aa0aa;font-weight:normal}</style>
<div id="pr"><b>Practice room</b> <span class="k">${JSON.stringify(G.feel ?? 'no feel').replace(/"/g, '')}</span><div id="pr-ai"></div><h4>combos (all unlocked)</h4><div id="pr-c"></div><h4>last move</h4><table id="pr-t"></table><h4>presses</h4><div class="log" id="pr-log"></div></div>
<script>
(() => {
  const MOUSELOOK = ${!!(camera.mouseLook || camera.turnMode === 'look')}, CARD = ${JSON.stringify(card)}, LISTS = ${JSON.stringify(Object.fromEntries(arsenal.weapons.map((W) => [W.id, { name: W.name ?? W.id, list: comboList({ moves: W.moves, combos: W.combos }) }])))}, MOVES = ${JSON.stringify(Object.fromEntries(arsenal.weapons.flatMap((W) => Object.entries(W.moves).map(([id, m]) => [id, m]))))};
  const $ = (id) => document.getElementById(id), F = (s) => Math.round(s * 60);
  let W = null, H = null, foes = [], cur = null, last = null, log = [], seq = 0, hits0 = 0, homes = null, show = true, tPrev = 0;
  const setAi = (on) => { W.aiEnabled = on; $('pr-ai').innerHTML = 'foe AI <b class="' + (on ? 'bad' : 'ok') + '">' + (on ? 'ON' : 'off') + '</b> · P · foes never die · K resets';  };
  addEventListener('keydown', (e) => {
    if (!W) return;
    if (e.code === 'KeyP') setAi(!W.aiEnabled);
    if (e.code === 'KeyH') { show = !show; $('pr').style.display = show ? '' : 'none'; }
    if (e.code === 'KeyK') foes.forEach((f, k) => { f.transform.pos = homes[k].slice(); f.staggerT = null; f.downed = false; f.gone = false; if (f.hpMax) f.body.hp = f.hpMax; f.hits = 0; hits0 = 0; });
  });
  // (the click that only takes the mouse: the runtime never sees it, the room says so)
  addEventListener('mousedown', (e) => { if (W && MOUSELOOK && !document.pointerLockElement) log.push({ t: W.time, ok: false, text: 'click: the first click takes the mouse' }); });
  const row = (k, a, b, cls) => '<tr><td class="k">' + k + '</td><td>' + (a ?? '') + '</td><td class="' + (cls || '') + '">' + (b ?? '—') + '</td></tr>';
  function draw() {
    const live = H.mvCombos || [], k = H.mvHit || 0, Wn = LISTS[H.mvWeapon || Object.keys(LISTS)[0]], LIST = Wn.list;
    $('pr-c').innerHTML = '<div>weapon <b>' + Wn.name + '</b> <span class="k">(' + Object.values(LISTS).map((x) => x.name).join(' · ') + ': mouse back / R)</span></div>' + LIST.map((c) => { const on = H.swingT != null && live.indexOf(c.id) >= 0; const beats = c.beats.split(' ').map((b, i) => { let n = -1, j = 0; for (const x of c.beats.split(' ')) { if (x !== '.') n++; if (j++ === i) break; } return '<span class="' + (on && b !== '.' && n < k ? 'on' : '') + '">' + b + '</span>'; }).join(' ');
      return '<div>' + beats + ' <span class="k">' + c.name + ' · ' + c.moves.map((m) => m.id).join(' → ') + '</span></div>'; }).join('');
    const m = last, mv = m && MOVES[m.id];
    $('pr-t').innerHTML = (m ? row('move', m.id + ' · ' + mv.role, m.clip) + row('frames', mv.frames + (mv.cancel ? ' · cancel ' + mv.cancel : ' · no cancel'), (m.end != null ? m.end + ' f' : '…'))
      + row('press → contact', '', m.contact != null ? m.contact + ' f' : (m.end != null ? 'whiff' : '…'), m.contact != null ? 'ok' : (m.end != null ? 'bad' : ''))
      + row('travel', mv.travel ? mv.travel.kind + ' ' + mv.travel.m + ' m' : 'in place', m.moved.toFixed(2) + ' m')
      + row('hitstop', '', m.stop + ' f') + row('foe stun · advantage', '', (m.stun != null ? m.stun + ' f' : '—') + ' · ' + (m.adv != null ? (m.adv > 0 ? '+' : '') + m.adv + ' f' : '—'))
      + row('in the string', '', 'hit ' + m.k) : '<tr><td class="k">press L (click) or H (right click)</td></tr>');
    $('pr-log').innerHTML = log.slice(-8).reverse().map((p) => '<div class="' + (p.ok ? 'ok' : 'bad') + '">' + p.t.toFixed(2) + 's ' + p.text + '</div>').join('');
  }
  function tick() {
    if (!W && window.__mojCtrl && window.__mojCtrl.world) { W = window.__mojCtrl.world; H = W.byId[W.pilotId] || W.entities.find((e) => e.pilotable); foes = W.entities.filter((e) => e.team === 'foes'); homes = foes.map((f) => f.transform.pos.slice()); foes.forEach((f) => { f.noDestroy = true; }); setAi(false); }
    if (W) {
      const t = W.time, hits = foes.reduce((s, f) => s + (f.hits || 0), 0), P = H.mvPress;
      // every press as the runtime judged it (combat-melee.js stepMoveset): taken and how, or dropped and why
      if (P && P.seq !== seq) { seq = P.seq; log.push({ t: P.t, ok: P.verdict === 'taken', text: P.beat + ' ' + P.verdict + ': ' + P.why }); }
      if (H.mvMove && (!cur || H.swingCount !== cur.n)) { cur = { n: H.swingCount, id: H.mvMove, clip: H.swingClip, t0: t, k: H.mvHit, contact: null, end: null, stop: 0, stopS: 0, stun: null, adv: null, stunEnd: null, at: H.transform.pos.slice(), moved: 0 }; last = cur; }
      if (cur) {
        if (hits > hits0 && cur.contact == null) cur.contact = F(t - cur.t0);
        if (H.hitstopT > 0) { cur.stopS += t - tPrev; cur.stop = F(cur.stopS); }
        if (cur.end == null) { cur.moved = Math.hypot(H.transform.pos[0] - cur.at[0], H.transform.pos[1] - cur.at[1]); if (H.swingT == null || H.swingCount !== cur.n) cur.end = F(t - cur.t0); }
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
// THE COMBO MANIFEST: what the room played, every combo unlocked, for the game's director
await fs.writeFile(path.join(out, 'combos.json'), JSON.stringify(arsenal, null, 2));
console.log(`room: ${arsenal.weapons.map((W) => `${W.name ?? W.id}: ${comboList({ moves: W.moves, combos: W.combos }).map((c) => `${c.beats} ${c.name}`).join(', ')}`).join(' · ')} → ${path.join(out, 'combos.json')}`);
console.log(`room: ${file} (${(html.length / 1e6).toFixed(1)} MB) · the hero '${pilot.body.figure}' (strike ${rule.strike ?? 'none'}, ${rule.strikeDur ?? '—'} s), ${pack} ${foe0.body.figure} never dying`);
process.exit(0);
