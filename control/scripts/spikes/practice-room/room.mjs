#!/usr/bin/env node
/**
 * THE PRACTICE ROOM — a game's hero and one of its foes in a greybox ring, on the runtime the game ships, the foe never
 * dying and standing still until its AI is switched on; a HUD of the last move's frame data beside what the feel card
 * asks, and a log of every press: taken, or dropped and why.
 *
 *   cd control
 *   export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…          # a database a game was made in (README of the-old-keep)
 *   node scripts/spikes/practice-room/room.mjs --game keep-hero --out /abs/dir [--pack 3] [--strings 2.5] [--cdn]
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
const { feelRule } = await import('../../../lib/graph/gameworld/feel/lower.js');
const { sfxSound } = await import('../../../lib/graph/sfx-shelf/resolve.js');
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

// ─── the bodies: the hero as it ships, the foe (and its pack) dying in `--strings` of the hero's first combo, back after ───
const { vista: _v, ...camera } = L.camera;
const H0 = structuredClone(hero);
// (the game's feel's guard, lowered as a level built now lowers it, gameworld/feel/lower.js: a level stored before the
// guard was carried has none)
const guard = G.feel ? feelRule(G.feel).guard ?? null : null;
const heroE = { ...H0, rule: { ...H0.rule, weapons, moveset: weapons[0].moveset, ...(weapons[0].sidearm ? { weapon: weapons[0].sidearm.weapon } : {}), ...(guard ? { guard } : {}) }, transform: { pos: [0, -3, 0], heading: Math.PI / 2 } };
const foes = Array.from({ length: pack }, (_, k) => {
  const a = pack === 1 ? 0 : (k / pack) * 2 * Math.PI, at = pack === 1 ? [0, 1, 0] : [3 * Math.sin(a), 2 + 3 * Math.cos(a), 0];
  return { ...structuredClone(foe0), id: `foe-${k + 1}`, transform: { pos: at, heading: -Math.PI / 2 } };
});
const entities = [heroE, ...foes];
// THE SOUNDS (--sound realistic | arcade | foley | orchestral | synth | none): the SFX shelf's by the words people say
// (sfx-shelf/resolve.js sfxSound), each a cue of the room's audio, and the moveset's events wired to them (audio.moves,
// beats-world.js): a blade's light and heavy cuts and its blow, the fist's swing, punch and uppercut, the finisher's
// knockout, the guard's block, parry and break, the bow's draw, loose and arrow striking home, the weapon cycle, the
// foe's swing and its fall, a blow taken; footsteps on the stone floor, the dodge, the jump and the landing. Through
// the SFX mixer in an interior's space
const soundStyle = opt('--sound', 'realistic');
const SOUND_WORDS = { 'blade-light': 'katana-swing', 'blade-heavy': 'katana-heavy-swing', 'fist-swing': 'swing', 'blade-hit': 'blade-hit', 'finisher-hit': 'knockout-blow',
  punch: 'punch', uppercut: 'uppercut', block: 'block', parry: 'blade-clash', 'guard-break': 'wood-break', 'bow-draw': 'bow-draw', 'bow-shot': 'bow-shot',
  'arrow-hit': 'arrow-target', felled: 'down', cycle: 'weapon-switch', 'foe-swing': 'katana-swing', hurt: 'flesh-impact' };
const soundOf = (word) => { const v = sfxSound(word, { style: soundStyle }); return v && v.gestures ? v.gestures : null; };
const audio = soundStyle === 'none' ? null : (() => {
  const cues = Object.fromEntries(Object.entries(SOUND_WORDS).map(([id, w]) => [id, soundOf(w)]).filter(([, g]) => g));
  const has = (id) => (cues[id] ? id : undefined), clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  // (each weapon by the figure it shows: a blade drawn, the fist sheathed)
  const blade = (W) => (W.figure ?? 'drawn') === 'drawn';
  const swing = Object.fromEntries(arsenal.weapons.map((W) => [W.id, blade(W) ? clean({ light: has('blade-light'), heavy: has('blade-heavy'), finisher: has('blade-heavy') }) : clean({ light: has('fist-swing') })]));
  const hit = Object.fromEntries(arsenal.weapons.map((W) => [W.id, blade(W) ? clean({ light: has('blade-hit'), heavy: has('blade-hit'), finisher: has('finisher-hit') }) : clean({ light: has('punch'), heavy: has('uppercut'), finisher: has('finisher-hit') })]));
  const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land'), dodge = soundOf('dodge');
  return { sfx: { cues, ...(soundStyle === 'realistic' ? { mix: { space: 'interior' } } : {}) },
    ...(step ? { footsteps: clean({ step, jump: jump ?? undefined, land: land ?? undefined }) } : {}), ...(dodge ? { dodge } : {}),
    moves: clean({ swing, hit, block: has('block'), parry: has('parry'), break: has('guard-break'), draw: has('bow-draw'), loose: has('bow-shot'), arrow: has('arrow-hit'),
      felled: has('felled'), cycle: has('cycle'), foeSwing: has('foe-swing'), hurt: has('hurt') }) };
})();
const legend = 'W A S D  run · mouse  look · click  light · right click  heavy · mouse forward  sidearm (hold) · mouse back / R  weapon · Shift  guard (hold) · F  sprint · F F  dodge · C  lock on · P  foe AI · K  reset · H  HUD';
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
const sketch = { ref: `${game}-practice-room`, manifest: { kind: 'controllable', title: `Practice room · ${G.name ?? game}`, bg: '#1b1d22', faces, colliders, figures, entities, camera, ...(audio ? { audio } : {}), ...(L.lock ? { lock: L.lock } : {}), ...(grade === 'play' ? { figureGrade: 'play' } : {}), ...(fxStyle ? { fxStyle } : {}), events: { hud: [{ text: legend, slot: 'bottom', ttl: 20 }], ...(fxStyle ? { cast: true, reactions: [] } : {}) } } };

const { payload } = await resolveWorldScene(sketch, {});
if (!payload) throw new Error('room: the room did not resolve');
const pilot = payload.entities.find((e) => e.pilotable);
// THE FOE'S HP: what the hero's first combo deals it, measured, not reckoned (the runtime's own blows on a copy of the foe,
// standing, its combo scaling and all: combat-melee.js), times `--strings` (2.5: two strings and a half to fell it)
const { createWorld, stepWorld } = await import('../../../lib/graph/worlds/controllable-world.js');
const strings = Number(opt('--strings', '2.5'));
function stringDamage(heroP, foeP) {
  const C = arsenal.weapons[0].combos[0], beats = C.beats.filter((b) => b !== '.');
  // (the hero and the foe as the page plays them, resolved: armed from their figures)
  const w = createWorld({ entities: [{ ...structuredClone(heroP), id: 'p', transform: { pos: [0, 0, 0], heading: 0 } },
    { ...structuredClone(foeP), id: 'f', team: 'foes', rule: { type: 'static' }, body: { ...structuredClone(foeP.body), hp: 1e6 }, transform: { pos: [1.3, 0, 0], heading: Math.PI } }] });
  for (let f = 0; f < 4; f++) stepWorld(w, {}, 1 / 60, { ground: () => 0 });
  const key = { L: 'fire', H: 'heavy', S: 'special' }, hooks = { ground: () => 0 };
  for (let f = 0; f < 60 * 4; f++) { const k = f % 17 === 0 && f / 17 < beats.length ? beats[f / 17] : null; stepWorld(w, k ? { [key[k]]: 1 } : {}, 1 / 60, hooks); }
  return { combo: C.name ?? C.id, beats: C.beats.join(' '), damage: Math.round((1e6 - w.byId.f.body.hp) * 1e4) / 1e4, hits: w.byId.f.hits || 0 };
}
const SD = stringDamage(pilot, payload.entities.find((e) => e.team === 'foes')), foeHp = Math.max(1, Math.round(SD.damage * strings * 10) / 10);
for (const e of payload.entities) if (e.team === 'foes' && e.body) { e.body.hp = foeHp; e.hpMax = foeHp; }
const card = asked(G.feel), rule = pilot.rule;
let html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });

// ─── the HUD: the live world read each frame (window.__mojCtrl), the card's numbers beside it ───
const HUD = `<style>#pr{position:fixed;top:10px;left:10px;width:360px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#pr b{color:#fff}#pr .k{color:#9aa0aa}#pr .bad{color:#f0a070}#pr .ok{color:#9fd49a}#pr .on{color:#ffd76a}#pr table{border-collapse:collapse;width:100%}#pr td{padding:0 4px 0 0;vertical-align:top}#pr .log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pr h4{margin:6px 0 2px;font-size:11px;color:#9aa0aa;font-weight:normal}</style>
<div id="pr"><b>Practice room</b> <span class="k">${JSON.stringify(G.feel ?? 'no feel').replace(/"/g, '')}</span><div id="pr-ai"></div><h4>combos (all unlocked)</h4><div id="pr-c"></div><div id="pr-s"></div><div id="pr-g"></div><h4>last move</h4><table id="pr-t"></table><h4>presses</h4><div class="log" id="pr-log"></div></div>
<script>
(() => {
  const STRINGS = ${strings}, SDN = ${JSON.stringify(SD.beats)}, SDD = ${SD.damage}, BACK = 3, foeHp = ${foeHp};
  const MOUSELOOK = ${!!(camera.mouseLook || camera.turnMode === 'look')}, CARD = ${JSON.stringify(card)}, LISTS = ${JSON.stringify(Object.fromEntries(arsenal.weapons.map((W) => [W.id, { name: W.name ?? W.id, list: comboList({ moves: W.moves, combos: W.combos }) }])))}, MOVES = ${JSON.stringify(Object.fromEntries(arsenal.weapons.flatMap((W) => Object.entries(W.moves).map(([id, m]) => [id, m]))))};
  const $ = (id) => document.getElementById(id), F = (s) => Math.round(s * 60);
  let W = null, H = null, foes = [], cur = null, last = null, log = [], seq = 0, gseq = 0, hHits = 0, hits0 = 0, homes = null, show = true, tPrev = 0;
  const setAi = (on) => { W.aiEnabled = on; $('pr-ai').innerHTML = 'foe AI <b class="' + (on ? 'bad' : 'ok') + '">' + (on ? 'ON' : 'off') + '</b> · P · K resets' + '<div>foe <b>' + foeHp + '</b> hp <span class="k">(' + STRINGS + ' × ' + SDN + ': ' + SDD + ' a string) · back ' + BACK + ' s after it falls</span> · <span id="pr-hp"></span></div>';  };
  const back = (f, k) => { f.transform.pos = homes[k].slice(); f.staggerT = null; f.reactClip = null; f.downed = false; f.gone = false; f.dormant = false; f.body.hp = f.hpMax; f.hits = 0; f.backAt = null; };
  addEventListener('keydown', (e) => {
    if (!W) return;
    if (e.code === 'KeyP') setAi(!W.aiEnabled);
    if (e.code === 'KeyH') { show = !show; $('pr').style.display = show ? '' : 'none'; }
    if (e.code === 'KeyK') { foes.forEach((f, k) => back(f, k)); hits0 = 0; }
  });
  // (the click that only takes the mouse: the runtime never sees it, the room says so)
  addEventListener('mousedown', (e) => { if (W && MOUSELOOK && !document.pointerLockElement) log.push({ t: W.time, ok: false, text: 'click: the first click takes the mouse' }); });
  const row = (k, a, b, cls) => '<tr><td class="k">' + k + '</td><td>' + (a ?? '') + '</td><td class="' + (cls || '') + '">' + (b ?? '—') + '</td></tr>';
  function draw() {
    const live = H.mvCombos || [], k = H.mvHit || 0, Wn = LISTS[H.mvWeapon || Object.keys(LISTS)[0]], LIST = Wn.list;
    $('pr-c').innerHTML = '<div>weapon <b>' + Wn.name + '</b> <span class="k">(' + Object.values(LISTS).map((x) => x.name).join(' · ') + ': mouse back / R)</span></div>' + LIST.map((c) => { const on = H.swingT != null && live.indexOf(c.id) >= 0; const beats = c.beats.split(' ').map((b, i) => { let n = -1, j = 0; for (const x of c.beats.split(' ')) { if (x !== '.') n++; if (j++ === i) break; } return '<span class="' + (on && b !== '.' && n < k ? 'on' : '') + '">' + b + '</span>'; }).join(' ');
      return '<div>' + beats + ' <span class="k">' + c.name + ' · ' + c.moves.map((m) => m.id).join(' → ') + '</span></div>'; }).join('');
    // the sidearm on S: its name, its rounds (a quiver's arrows, a magazine, or endless), the draw and its readiness
    const G = H.mvRanged, w = H.weapon;
    $('pr-s').innerHTML = G && w ? 'S <b>' + G.name + '</b> <span class="k">' + (G.mode === 'draw' ? 'hold to draw, let go when ready' : 'hold to fire') + '</span> · ' + (w.infinite ? 'endless' : w.ammo + (w.reserve != null ? ' + ' + w.reserve : '') + (w.reloading ? ' (nocking)' : ''))
      + (G.mode === 'draw' ? ' · <span class="' + (w.chargeReady ? 'ok' : 'k') + '">' + (w.charging ? (w.chargeReady ? 'READY' : 'draw ' + '▮'.repeat(Math.round(w.chargeFrac * 8)) + '▯'.repeat(8 - Math.round(w.chargeFrac * 8))) : '') + '</span>' : '') + ' · shots ' + w.shots : '';
    // the guard (Shift, a pad's left shoulder): up or down, its window, what it has met (combat-melee.js stepGuard)
    const Gd = H.rule && H.rule.guard;
    $('pr-g').innerHTML = Gd ? 'guard <b>' + (H.guarding ? (H.blockT > 0 ? 'blockstun' : 'UP') : 'down') + '</b> <span class="k">hold Shift / LB · parry ' + (Gd.parry == null ? 'any guard' : F(Gd.parry) + ' f from raising it') + ' · riposte ' + F(Gd.riposte) + ' f</span> · blocks ' + (H.blocks || 0) + ' · parries ' + (H.parries || 0) + (Gd.stamina ? ' · stamina ' + Math.round(H.guardSt ?? Gd.stamina.max) : '') : '<span class="k">no guard in this feel</span>';
    const m = last, mv = m && MOVES[m.id];
    $('pr-t').innerHTML = (m ? row('move', m.id + ' · ' + mv.role, m.clip) + row('frames', mv.frames + (mv.cancel ? ' · cancel ' + mv.cancel : ' · no cancel'), (m.end != null ? m.end + ' f' : '…'))
      + row('press → contact', '', m.contact != null ? m.contact + ' f' : (m.end != null ? 'whiff' : '…'), m.contact != null ? 'ok' : (m.end != null ? 'bad' : ''))
      + row('travel', mv.travel ? mv.travel.kind + ' ' + mv.travel.m + ' m' : 'in place', m.moved.toFixed(2) + ' m')
      + row('hitstop', '', m.stop + ' f') + row('foe stun · advantage', '', (m.stun != null ? m.stun + ' f' : '—') + ' · ' + (m.adv != null ? (m.adv > 0 ? '+' : '') + m.adv + ' f' : '—'))
      + row('in the string', '', 'hit ' + m.k) : '<tr><td class="k">press L (click) or H (right click)</td></tr>');
    $('pr-log').innerHTML = log.slice(-8).reverse().map((p) => '<div class="' + (p.ok ? 'ok' : 'bad') + '">' + p.t.toFixed(2) + 's ' + p.text + '</div>').join('');
  }
  function tick() {
    if (!W && window.__mojCtrl && window.__mojCtrl.world) { W = window.__mojCtrl.world; H = W.byId[W.pilotId] || W.entities.find((e) => e.pilotable); foes = W.entities.filter((e) => e.team === 'foes'); homes = foes.map((f) => f.transform.pos.slice()); foes.forEach((f) => { f.hpMax = f.hpMax ?? f.body.hp; }); setAi(false); }
    if (W) {
      const t = W.time, hits = foes.reduce((s, f) => s + (f.hits || 0), 0), P = H.mvPress;
      // every press as the runtime judged it (combat-melee.js stepMoveset): taken and how, or dropped and why
      if (P && P.seq !== seq) { seq = P.seq; log.push({ t: P.t, ok: P.verdict === 'taken', text: P.beat + ' ' + P.verdict + ': ' + P.why }); }
      // what the guard met: a parry (and how soon after raising it), a block (outside the window), a break; a blow taken
      const Gl = H.lastGuard, Gd = H.rule && H.rule.guard;
      if (Gl && Gl.seq !== gseq) { gseq = Gl.seq; log.push({ t: Gl.t, ok: Gl.kind === 'parry', text: Gl.kind === 'parry' ? 'PARRY: ' + F(Gl.at) + ' f after raising the guard; the foe open ' + F(Gd.riposte) + ' f' : Gl.kind === 'break' ? 'guard broken: stamina spent' : 'blocked: ' + F(Gl.at) + ' f after raising it' + (Gd.parry != null ? ' (the parry is ' + F(Gd.parry) + ' f)' : '') }); }
      if ((H.hits || 0) > hHits) { hHits = H.hits || 0; log.push({ t, ok: false, text: 'hit taken: ' + (H.guarding ? 'from behind the guard' : 'the guard was down') }); }
      if (H.mvMove && (!cur || H.swingCount !== cur.n)) { cur = { n: H.swingCount, id: H.mvMove, clip: H.swingClip, t0: t, k: H.mvHit, contact: null, end: null, stop: 0, stopS: 0, stun: null, adv: null, stunEnd: null, at: H.transform.pos.slice(), moved: 0 }; last = cur; }
      if (cur) {
        if (hits > hits0 && cur.contact == null) cur.contact = F(t - cur.t0);
        if (H.hitstopT > 0) { cur.stopS += t - tPrev; cur.stop = F(cur.stopS); }
        if (cur.end == null) { cur.moved = Math.hypot(H.transform.pos[0] - cur.at[0], H.transform.pos[1] - cur.at[1]); if (H.swingT == null || H.swingCount !== cur.n) cur.end = F(t - cur.t0); }
        const reel = foes.some((f) => f.staggerT != null);
        if (cur.contact != null && reel) cur.stunEnd = t;
        if (cur.contact != null && !reel && cur.stunEnd != null && cur.stun == null) { cur.stun = F(cur.stunEnd - (cur.t0 + cur.contact / 60)); if (cur.end != null) cur.adv = F(cur.stunEnd - (cur.t0 + cur.end / 60)); }
      }
      // (a felled foe plays its fall and comes back where it stood, whole, BACK seconds on)
      foes.forEach((f, k) => { if ((f.downed || f.gone) && f.backAt == null) { f.backAt = t + BACK; log.push({ t, ok: true, text: 'felled: ' + (f.hits || 0) + ' hits' }); } else if (f.backAt != null && t >= f.backAt) back(f, k); });
      const hpEl = $('pr-hp'); if (hpEl) hpEl.textContent = foes.map((f) => Math.max(0, Math.round(f.body.hp * 10) / 10) + ' / ' + f.hpMax).join(' · ');
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
console.log(`room: ${file} (${(html.length / 1e6).toFixed(1)} MB) · the hero '${pilot.body.figure}' (strike ${rule.strike ?? 'none'}, ${rule.strikeDur ?? '—'} s), ${pack} ${foe0.body.figure} at ${foeHp} hp (${strings} × ${SD.beats}: ${SD.damage} a string, ${SD.hits} hits)`);
process.exit(0);
