/**
 * THE PRACTICE ROOM'S PAGE — the room (practice-room.js) resolved and emitted as a level is, its foe's health measured on
 * the resolved bodies (`strings` of the hero's first combo, the runtime's own blows), and its HUD laid over it: the last
 * move's frame data beside what the feel card asks, the combos with the beats of the string being played lit, the
 * sidearm, the guard, the juggle and the MP, and every press, taken or dropped and why. Keys: P the foe's AI on / off
 * (it starts off), K the foe set back, H the HUD. A felled foe plays its fall and comes back where it stood.
 *
 *   practiceRoomHtml(G, { refs?, cast?, pack?, strings?, sound?, cdn? }) → { html, room, string, foeHp }
 *     (room: practice-room.js's result; string: { combo, beats, damage, hits } the first combo measured)
 *   platformRoomHtml(G, { refs?, cast?, sound?, cdn? }) → { html, room, card }: the platform room, the card's jump, air
 *     jumps, wall kick and stomp beside the live ones (each jump's top, the double jump, wall kicks, stomps, touches)
 *   mountLaneHtml(G, { refs?, cast?, coat?, sound?, cdn? }) → { html, room, card }: the mount lane, each gait's speed, the
 *     jump's clearance and the rein-back beside the live speed, the 100 m split, the jumps and the fences cleared or refused
 *   rollRoomHtml(G, { refs?, cast?, sound?, cdn? }) → { html, room, measured }: the roll room, the roll being played (its
 *     seed, what stands, what lies, where it started) beside the seeds audit and the cover forms that stop this hero;
 *     R rolls the next seed, Shift+R the one before (the page's own ?seed=)
 *   practiceHtml(G, id, opts) → the page of the door's room `id` (practice.js); the roll room's course with
 *     `view: 'map'` is its course map (course-map.js) in place of the room, `view: 'sheet'` its course sheet
 *     (course-sheet.js); `level` names the course level whose dress it wears (the first, unsaid)
 *   roomRefs(world, ref, exists) → the refs above, by the run's names, each only where its row exists
 *   cardAsked(feel) → what the feel card asks of one swing: { startup, total, cancel, string, lunge, hitstop, stun, dodge,
 *     guard } in frames
 *
 * Served on read as the gameworld's `bible?book=practice` (app/api/sketches/[ref]/bible); the spike's room.mjs is its CLI.
 */
import { practiceRoom } from './practice-room.js';
import { platformRoom, COURSE } from './platform-room.js';
import { mountLane, FENCES } from './mount-lane.js';
import { rollRoom, rollRoomMeasured, FORMS } from './roll-room.js';
import { feelReport, readFeel } from './feel/lower.js';
import { comboList } from './combos.js';
import { feelCard } from './feel/lower.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

export function cardAsked(feel) {
  const C = feelCard(feel), S = C.moves?.string ?? [], m = S[0];
  const cancel = !m || C.moves.cancel === 'none' || S.length < 2 ? null : C.moves.cancel === 'half' ? m.startup + m.active + Math.ceil(m.recovery / 2) : m.startup + m.active + C.moves.cancel;
  return {
    startup: m?.startup ?? null, total: m ? m.startup + m.active + m.recovery : null, cancel, string: S.length, lunge: m?.lunge ?? 0,
    hitstop: C.hit?.hitstop ? `${C.hit.hitstop.base}-${C.hit.hitstop.max}` : 'none', stun: C.hit?.stun?.model ?? 'none',
    dodge: C.dodge ? { frames: C.dodge.frames, invincible: C.dodge.iframes ? C.dodge.iframes[1] - C.dodge.iframes[0] : 0 } : null,
    guard: C.guard ? { parry: C.guard.parry, perfect: C.guard.perfect?.window ?? null } : null,
  };
}

// THE FOE'S HP: what the hero's first combo deals it, measured, not reckoned (the runtime's own blows on a copy of the foe,
// standing, its combo scaling and all: combat-melee.js)
function stringDamage(arsenal, heroP, foeP) {
  const C = arsenal.weapons[0].combos[0], beats = C.beats.filter((b) => b !== '.');
  // (the hero and the foe as the page plays them, resolved: armed from their figures)
  const w = createWorld({ entities: [{ ...structuredClone(heroP), id: 'p', transform: { pos: [0, 0, 0], heading: 0 } },
    { ...structuredClone(foeP), id: 'f', team: 'foes', rule: { type: 'static' }, body: { ...structuredClone(foeP.body), hp: 1e6 }, transform: { pos: [1.3, 0, 0], heading: Math.PI } }] });
  for (let f = 0; f < 4; f++) stepWorld(w, {}, 1 / 60, { ground: () => 0 });
  const key = { L: 'fire', H: 'heavy', S: 'special' }, hooks = { ground: () => 0 };
  for (let f = 0; f < 60 * 4; f++) { const k = f % 17 === 0 && f / 17 < beats.length ? beats[f / 17] : null; stepWorld(w, k ? { [key[k]]: 1 } : {}, 1 / 60, hooks); }
  return { combo: C.name ?? C.id, beats: C.beats.join(' '), damage: Math.round((1e6 - w.byId.f.body.hp) * 1e4) / 1e4, hits: w.byId.f.hits || 0 };
}

/** The sketches a run made that the room plays, by the run's own names (runner.js): the hero (the equipped one where the
 * run made it), its sheathed twin, each fielded foe; `exists(ref)` says whether a row is there. */
export async function roomRefs(world, ref, exists) {
  const { childRef, heroRefOf } = await import('./runner.js');
  const { bestiaryOf } = await import('./foes.js');
  const has = (r) => (r && exists(r) ? r : null);
  const hero = has(childRef(ref, 'hero-equipped')) ?? has(heroRefOf(world, ref));
  const foes = Object.fromEntries(Object.entries(bestiaryOf(world)).map(([id, e]) => [id, has(e?.skin?.meshRef ?? childRef(ref, `foes-${id}`))]).filter(([, r]) => r));
  return { ...(hero ? { hero } : {}), ...(has(childRef(ref, 'hero-sheathed')) ? { sheathed: childRef(ref, 'hero-sheathed') } : {}), ...(Object.keys(foes).length ? { foes } : {}) };
}

export async function practiceRoomHtml(G, { refs = {}, cast = 'male', pack = 1, strings = 2.5, sound = 'realistic', cdn = false, arsenal: given = null, standIn = null } = {}) {
  const room = practiceRoom(G, { refs, cast, pack, sound, ...(given ? { arsenal: given } : {}), ...(standIn ? { standIn } : {}) });
  const { arsenal } = room;
  const { resolveWorldScene } = await import('../worlds/world-scene.js');
  const { emitThreeWorld } = await import('../scene/scene-three.js');
  const { payload } = await resolveWorldScene({ ref: `${G.id ?? 'game'}-practice-room`, manifest: room.manifest }, {});
  if (!payload) throw new Error('practice room: the room did not resolve');
  const pilot = payload.entities.find((e) => e.pilotable);
  const SD = stringDamage(arsenal, pilot, payload.entities.find((e) => e.team === 'foes')), foeHp = Math.max(1, Math.round(SD.damage * strings * 10) / 10);
  for (const e of payload.entities) if (e.team === 'foes' && e.body) { e.body.hp = foeHp; e.hpMax = foeHp; }
  const card = cardAsked(G.feel), camera = room.manifest.camera;
  let html = emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });
  const HUD = `<style>#pr{position:fixed;top:10px;left:10px;width:360px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#pr b{color:#fff}#pr .k{color:#9aa0aa}#pr .bad{color:#f0a070}#pr .ok{color:#9fd49a}#pr .on{color:#ffd76a}#pr table{border-collapse:collapse;width:100%}#pr td{padding:0 4px 0 0;vertical-align:top}#pr .log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pr h4{margin:6px 0 2px;font-size:11px;color:#9aa0aa;font-weight:normal}</style>
<div id="pr"><b>Practice room</b> <span class="k">${JSON.stringify(G.feel ?? 'no feel').replace(/"/g, '')}</span><div id="pr-ai"></div><h4>combos (all unlocked)</h4><div id="pr-c"></div><div id="pr-s"></div><div id="pr-g"></div><div id="pr-j"></div><div id="pr-mp"></div><h4>last move</h4><table id="pr-t"></table><h4>presses</h4><div class="log" id="pr-log"></div></div>
<script>
(() => {
  const STRINGS = ${strings}, SDN = ${JSON.stringify(SD.beats)}, SDD = ${SD.damage}, BACK = 3, foeHp = ${foeHp};
  const MOUSELOOK = ${!!(camera.mouseLook || camera.turnMode === 'look')}, CARD = ${JSON.stringify(card)}, LISTS = ${JSON.stringify(Object.fromEntries(arsenal.weapons.map((W) => [W.id, { name: W.name ?? W.id, list: comboList({ moves: W.moves, combos: W.combos }) }])))}, MOVES = ${JSON.stringify(Object.fromEntries(arsenal.weapons.flatMap((W) => Object.entries(W.moves).map(([id, m]) => [id, m]))))};
  const $ = (id) => document.getElementById(id), F = (s) => Math.round(s * 60);
  let W = null, H = null, foes = [], cur = null, last = null, log = [], seq = 0, gseq = 0, hHits = 0, hits0 = 0, homes = null, show = true, tPrev = 0, jst = 'ground';
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
    $('pr-c').innerHTML = '<div>weapon <b>' + Wn.name + '</b> <span class="k">(' + Object.values(LISTS).map((x) => x.name).join(' · ') + ': mouse back / R)</span></div>' + LIST.map((c) => { const on = H.swingT != null && live.indexOf(c.id) >= 0; const beats = c.beats.split(' ').map((b, i) => { let n = -1, j = 0; for (const x of c.beats.split(' ')) { if (x !== '.') n++; if (j++ === i) break; } return '<span class="' + (on && b !== '.' && n < k ? 'on' : '') + '">' + (b === 'bH' ? 'back+H' : b[0] === 'm' ? 'R2+' + ({ L: 'W', H: 'N', S: 'E' })[b[1]] : b) + '</span>'; }).join(' ');
      return '<div>' + (c.air ? '<span class="k">in the air:</span> ' : '') + beats + ' <span class="k">' + c.name + ' · ' + c.moves.map((m) => m.id).join(' → ') + '</span></div>'; }).join('');
    // the sidearm on S: its name, its rounds (a quiver's arrows, a magazine, or endless), the draw and its readiness
    const G = H.mvRanged, w = H.weapon;
    $('pr-s').innerHTML = G && w ? 'S <b>' + G.name + '</b> <span class="k">' + (G.mode === 'draw' ? 'hold to draw, let go when ready' : 'hold to fire') + '</span> · ' + (w.infinite ? 'endless' : w.ammo + (w.reserve != null ? ' + ' + w.reserve : '') + (w.reloading ? ' (nocking)' : ''))
      + (G.mode === 'draw' ? ' · <span class="' + (w.chargeReady ? 'ok' : 'k') + '">' + (w.charging ? (w.chargeReady ? 'READY' : 'draw ' + '▮'.repeat(Math.round(w.chargeFrac * 8)) + '▯'.repeat(8 - Math.round(w.chargeFrac * 8))) : '') + '</span>' : '') + ' · shots ' + w.shots : '';
    // the guard (Shift, a pad's left shoulder): up or down, its window, what it has met (combat-melee.js stepGuard)
    const Gd = H.rule && H.rule.guard;
    $('pr-g').innerHTML = Gd ? 'guard <b>' + (H.guarding ? (H.blockT > 0 ? 'blockstun' : 'UP') : 'down') + '</b> <span class="k">hold Shift / LB · parry ' + (Gd.parry == null ? 'any guard' : F(Gd.parry) + ' f from raising it') + ' · riposte ' + F(Gd.riposte) + ' f</span> · blocks ' + (H.blocks || 0) + ' · parries ' + (H.parries || 0) + (Gd.stamina ? ' · stamina ' + Math.round(H.guardSt ?? Gd.stamina.max) : '') : '<span class="k">no guard in this feel</span>';
    // the juggle (combos.js juggle, combat-hit.js): the foe in the air, its stun left (the budget), its air blows; its
    // recovery (an invincible flip out) or its knockdown
    const Fj = foes[0];
    // (the MP pool the specials draw on: the modifier held (the right trigger, left Ctrl), a face pressed)
    $('pr-mp').innerHTML = H.mp != null ? 'MP <b>' + Math.floor(H.mp) + '</b> <span class="k">specials: hold R2 (left Ctrl) + W / N / E (left click / right click / mouse forward)</span>' : '';
    $('pr-j').innerHTML = Fj && Fj.comboCfg && Fj.comboCfg.juggle ? 'juggle <b>' + (Fj.juggle ? (Fj.juggle.recover ? 'RECOVERING' : Fj.juggle.knock ? 'SLAMMED' : 'IN THE AIR') : Fj.reactClip === 'topple' || Fj.reactClip === 'downpause' || Fj.reactClip === 'getup' ? 'KNOCKED DOWN' : 'grounded') + '</b> <span class="k">back+H to launch (away from the foe) · hold H to rise</span>' + (Fj.juggle && !Fj.juggle.recover ? ' · stun ' + Math.max(0, Fj.juggle.stunT || 0).toFixed(2) + ' s · blows ' + (Fj.comboHits || 0) : '') + ' · recoveries ' + (Fj.airRecoveries || 0) : '';
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
      // (the juggle's moments: launched, recovered, knocked down)
      const Fj = foes[0];
      if (Fj) {
        const st = Fj.juggle ? (Fj.juggle.recover ? 'rec' : 'air') : (Fj.reactClip === 'topple' ? 'down' : 'ground');
        if (st !== jst) { if (st === 'air' && jst !== 'air') log.push({ t, ok: true, text: 'launched' }); if (st === 'rec') log.push({ t, ok: false, text: 'the foe recovered: its stun ran out in the air (' + (Fj.comboHits || 0) + ' blows)' }); if (st === 'down' && (jst === 'air' || jst === 'rec')) log.push({ t, ok: true, text: 'KNOCKDOWN: slammed after ' + (Fj.comboHits || 0) + ' blows' }); jst = st; }
      }
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
  return { html, room, string: SD, foeHp };
}

async function resolved(manifest, ref) {
  const { resolveWorldScene } = await import('../worlds/world-scene.js');
  const { payload } = await resolveWorldScene({ ref, manifest }, {});
  if (!payload) throw new Error('practice: the room did not resolve');
  return payload;
}
const emitted = async (payload, cdn) => (await import('../scene/scene-three.js')).emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: !cdn, cdn });

/** The platform room's page (see the header). */
export async function platformRoomHtml(G, { refs = {}, cast = 'male', sound = 'realistic', cdn = false } = {}) {
  const room = platformRoom(G, { refs, cast, sound });
  const payload = await resolved(room.manifest, `${G.id ?? 'game'}-platform-room`);
  const R = payload.entities.find((e) => e.pilotable).rule;
  // (what the card asks of the hero beside what the room measures: its jump, its air jumps, its wall, its stomp)
  const report = G.feel != null ? feelReport(G.feel) : null;
  const CARD = { jump: G.feel != null ? feelCard(readFeel(G.feel)).jump.height : null, airJumps: R.airJumps ?? 0, cling: !!R.cling, stomp: R.stomp ?? null, sprint: R.sprint ? R.sprint.speed : null, run: R.speed,
    // (the stomp the room lays, as a level does where foes stand: carried here, whatever the card's report says)
    lost: report ? report.lost.map((x) => x.field).filter((f) => !(f === 'land.stomp' && R.stomp)) : [] };
  let html = await emitted(payload, cdn);
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
  return { html, room, card: CARD };
}

/** The mount lane's page (see the header). */
export async function mountLaneHtml(G, { refs = {}, cast = 'male', coat: given = null, sound = 'realistic', cdn = false } = {}) {
  const room = mountLane(G, { refs, cast, coat: given, sound });
  const payload = await resolved(room.manifest, `${G.id ?? 'game'}-mount-lane`);
  const horse = payload.entities.find((e) => e.rule && e.rule.type === 'ride');
  if (!horse) throw new Error('practice: the mount lane laid no horse');
  const HR = horse.rule, coat = room.coat, START = room.start;
  const CARD = { coat, gaits: (HR.gaits || []).map((g) => ({ gait: g.clip.replace('ride_', ''), v: g.v, stride: g.stride })), jump: HR.jump ? { clear: HR.jump.clear, v: HR.jump.v, s: HR.jump.s } : null,
    fences: FENCES, reach: horse.mount ? horse.mount.reach : null };
  if (!CARD.gaits.length) throw new Error('practice: the horse stands loose: no hero rides it (the hero\'s riding clips were not solved)');
  let html = await emitted(payload, cdn);
  const HUD = `<style>#mt{position:fixed;top:10px;left:10px;width:350px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#mt b{color:#fff}#mt .k{color:#9aa0a8}#mt h4{margin:6px 0 2px;font-size:11px;color:#c9a96a;text-transform:uppercase;letter-spacing:.05em}#mt .on{color:#c9a96a;font-weight:700}#mt .bad{color:#f08a7a}</style>
<div id="mt"><b>Mount treadmill</b> <span class="k">${G.name ?? G.id ?? 'game'} · a ${coat} horse</span><h4>the horse</h4><div id="mt-c"></div><h4>live</h4><div id="mt-l"></div><h4>log</h4><div id="mt-log"></div></div>
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
  return { html, room, card: CARD };
}

/** The roll room's page (see the header). */
export async function rollRoomHtml(G, { refs = {}, cast = 'male', sound = 'realistic', cdn = false } = {}) {
  const room = rollRoom(G, { refs, cast, sound });
  const payload = await resolved(room.manifest, `${G.id ?? 'game'}-roll-room`);
  const measured = rollRoomMeasured(G);
  let html = await emitted(payload, cdn);
  // the panel: this roll (said live), the measures (a machine gate), and what the room is; a yard's and a course's
  const C = measured.course ?? null;
  const gate = measured.lost.length ? `<span class="bad">lost: ${measured.lost.join(', ')}</span><br><span class="k">${(measured.worst ?? []).join('<br>')}</span>` : '<span class="ok">every law holds</span>';
  const sections = C
    ? [['measured before any level (a machine gate)', `<b>${measured.seeds}</b> seeds played by the reaction bot, of <b>${measured.ways}</b> courses<br>${gate}<br><span class="k">${measured.says.join('<br>')}</span>`],
      ['its dress: ' + measured.dress.name, (measured.dress.lost.length ? `<span class="bad">lost: ${measured.dress.lost.join(', ')}</span>` : '<span class="ok">read, told apart and told ahead</span>') + `<br><span class="k">${measured.dress.says.join('<br>')}</span>`],
      ['where it is read (the screen in thirds)', (measured.view.lost.length ? `<span class="bad">not framed: ${measured.view.lost.join(', ')}</span>` : '<span class="ok">framed</span>') + `<br>top: where stuff comes from, over the vanishing point<br>middle: where it comes to view, from <b>${measured.view.middle.from} m</b> ahead out<br>bottom: where you react, the last <b>${measured.view.bottom.to} m</b> (<b>${measured.view.bottom.seconds} s</b>), and the hero`],
      ['what the course is sized by', `top speed <b>${C.top} m/s</b> · the neediest ask <b>${C.need} s</b> + a rest of <b>${C.rest} s</b><br>a slot every <b>${C.gap} m</b> · sight for a ${C.react} s reaction <b>${C.sight} m</b><br>${Object.entries(C.windows).map(([id, f]) => `${id}: a window of <b>${f}</b> frames`).join(' · ')}<br>a lane change <b>${C.lane[0]} s</b>, two lanes <b>${C.lane[1]} s</b>`]]
    : [['measured before any level (a machine gate)', `<b>${measured.seeds}</b> seeds walked: <b>${measured.distinct}</b> different yards, of <b>${measured.ways}</b> there are<br>${gate}`],
      ['what stops this hero', FORMS.map((f) => `${f.form} (${f.height} m): ${measured.forms.stops.includes(f.form) ? '<b class="ok">stops it</b>' : '<b class="bad">gone over</b>'}`).join('<br>')]];
  const LIVE = { course: !!C, slots: C ? room.course.slots.map((s) => s.of) : null };
  const HUD = `<style>#rl{position:fixed;top:52px;left:10px;width:380px;font:12px/1.45 ui-monospace,monospace;color:#e8e6e1;background:rgba(14,15,18,.84);border:1px solid #3a3d44;padding:8px 10px;z-index:50;pointer-events:none}#rl b{color:#fff}#rl .k{color:#9aa0a8}#rl h4{margin:6px 0 2px;font-size:11px;color:#9aa0a8;font-weight:400;text-transform:uppercase;letter-spacing:.06em}#rl .ok{color:#8fd694}#rl .bad{color:#f08a7c}</style>
<div id="rl"><b>Roll room</b> <span class="k">${JSON.stringify(G.feel ?? 'no feel').replace(/"/g, '')} · ${C ? 'the course' : 'the yard'}</span><h4>this roll</h4><div id="rl-r" class="k">rolling…</div>${sections.map(([h, body]) => `<h4>${h}</h4><div>${body}</div>`).join('')}<h4>${C ? 'the course' : 'the yard'}</h4><div class="k">${room.yard.map(([n, ids]) => (C ? n : `${n}: ${ids.length}`)).join('<br>')}</div><div class="k" style="margin-top:6px">R the next roll · Shift+R the one before · H this panel</div></div>
<script>
(() => {
  const LIVE = ${JSON.stringify(LIVE)};
  const $ = (id) => document.getElementById(id);
  let show = true, said = false;
  const seedNow = () => { const n = Number(new URLSearchParams(location.search).get('seed')); return Number.isInteger(n) && n > 0 ? n : 1; };
  const go = (n) => { const q = new URLSearchParams(location.search); q.set('seed', String(Math.max(1, n))); location.search = '?' + q.toString(); };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') go(seedNow() + (e.shiftKey ? -1 : 1));
    if (e.code === 'KeyH') { show = !show; $('rl').style.display = show ? '' : 'none'; }
  });
  function tick() {
    const R = window.__mojRoll;
    if (R && !said) {
      said = true;
      // (a course: what stands in each slot, in order; a yard: what stands, the gems laid, the start)
      $('rl-r').innerHTML = LIVE.course
        ? 'seed <b>' + R.seed + '</b><br><b>' + LIVE.slots.map((of) => { const id = R.stand.find((s) => of[s]); return id ? of[id] : '—'; }).join(' · ') + '</b>'
        : 'seed <b>' + R.seed + '</b><br>stands: <b>' + (R.stand.join(', ') || 'none') + '</b><br>gems laid: <b>' + R.lay.length + '</b> of ' + (R.lay.length + R.unlaid.length) + '<br>start: <b>' + (R.start == null ? 'its own' : R.start + 1) + '</b>';
    }
    requestAnimationFrame(tick);
  }
  tick();
})();
</script>`;
  html = html.includes('</body>') ? html.replace('</body>', `${HUD}</body>`) : html + HUD;
  return { html, room, measured };
}

// THE MENU (practice-mana.js, on mana-ui): the room's readout and its choices, opened by the pilot's pause; the
// choices as the route reads them (a feel, a mascot's form, a trade or none, an area or none)
// HOW TO PLAY: the tutorial the screen no longer carries, each key the one the pilot scheme binds
const MOVE = ['moveForward', 'turnLeft', 'moveBack', 'turnRight'];
const WORK_TABS = (key, M) => [
  { label: 'Moving', lines: [{ glyph: key(MOVE), text: 'move: up the screen is up' }, { action: 'boost', text: 'sprint' }, { action: 'interact', text: 'take, work, put down, hand in' }, { action: 'pause', text: 'this menu' }] },
  { label: 'The work', lines: ['stand at a station and work it; walk off and it waits', 'some run alone once started: come back before they burn', 'shelves keep what is made: put on the left pad, take on the right'] },
  { label: 'The floor', lines: ['each arrow runs from where a thing comes from to where it goes next', 'warm: hands-on work · cool: carrying, sorting, handing in', 'over a station, pips fill as it is worked, again as it runs alone, then go out toward the burn'] },
];
async function workHow(room) {
  const { keyOf } = await import('./practice-mana.js'), M = room.measured;
  return [{ label: 'The goal', lines: [`serve ${M.goal} of ${M.arrivals} orders before the bell`, 'an order waits only so long: a lost one is gone'] }, ...WORK_TABS(keyOf, M)];
}
async function roomHow(room) {
  const { keyOf } = await import('./practice-mana.js'), nf = room.room.anchors.foes.length;
  return [
    { label: 'Moving', lines: [{ glyph: keyOf(MOVE), text: 'move' }, { glyph: 'mouse', text: 'look' }, { action: 'jump', text: 'jump' }, { action: 'boost', text: 'sprint' }, { action: 'interact', text: 'use' }, { action: 'pause', text: 'this menu' }] },
    ...(nf ? [{ label: 'The foes', lines: [`${nf} stand on their spots, still until woken`, { action: 'aiToggle', text: 'wake them, or still them' }, 'or the switch in Set up'] }] : []),
    { label: 'The room', lines: [room.measured ? 'the blue ring is where you start; the shift runs on the counters' : 'the blue ring is where you start, the green the goal'] },
    ...(room.measured ? WORK_TABS(keyOf).slice(1) : []),
  ];
}
function roomChoices(room, cast) {
  const C = room.choices, out = [{ id: 'feel', label: 'Movement', now: room.feel, options: C.feels.map((f) => ({ id: f.id, name: `${f.name} (run ${f.run})` })) }];
  if (room.hero === 'mascot') out.push({ id: 'cast', label: 'Worker', now: cast, options: C.casts.map((c) => ({ id: c, name: c })) });
  out.push({ id: 'dress', label: 'Dress', now: room.dress ? room.dress.trade : 'none', options: [...C.dresses.map((d) => ({ id: d, name: d })), { id: 'none', name: 'greybox' }] });
  out.push({ id: 'area', label: 'Area', now: room.area ? room.area.name : 'none', options: [...C.areas.map((a) => ({ id: a, name: a })), { id: 'none', name: 'plane' }] });
  return out;
}
const placeLines = (room) => [
  room.dress ? `dress: ${room.dress.about}` : 'dress: the blocks as solved, undressed',
  room.area ? `area: ${room.area.about}` : 'area: the conceptual plane, ruled every two metres',
  ...(room.area ? [`floor ${room.area.floor} · walls ${room.area.walls}${room.area.cut?.length ? ' (cut away on the camera\'s side)' : ''} · outside: ${room.area.surround.join(', ') || 'nothing'}`] : []),
];
// the page's own query, for set up to reopen the room with; none when the page is not the studio's
const queryOf = (link, q) => (link ? Object.fromEntries(new URLSearchParams(String(link(q)).replace(/^\?/, ''))) : null);
// the look: the shift family's card for where the room stands (its area, else its dress's trade), else the family's own
const SHIFT_CARDS = { kitchen: 'shift-kitchen', farm: 'shift-farm', site: 'shift-site', chores: 'shift-garden', hall: 'shift-hall' };
async function roomTheme(room) {
  const { cardTheme } = await import('../playscape/ui/theme-cards/loader.js');
  return cardTheme(SHIFT_CARDS[room.area?.name ?? room.dress?.trade] ?? 'shift');
}
async function withMenu(html, cfg, room) {
  const { practiceMana, practiceManaHtml } = await import('./practice-mana.js');
  const M = practiceManaHtml(practiceMana({ ...cfg, theme: await roomTheme(room) }));
  return html.includes('</body>') ? html.replace('</body>', `${M}</body>`) : html + M;
}

/**
 * The work room's page: the room on the runtime, and its menu (mana-ui, the pilot's pause opens it; open as the page
 * loads, the briefing): the shift as tuned (pace, patience, the goal), how to read the room, the work proof at the
 * template's run, and the presets to choose from (a feel template, a body, the dress, the area), the room reopened with
 * them.
 */
export async function workRoomHtml(G, { refs = {}, cast = null, feel = null, dress = null, area = undefined, sound = 'realistic', cdn = false, link = null } = {}) {
  const { workRoom, WORK_CAST } = await import('./work-room.js');
  cast = cast ?? WORK_CAST;
  const room = workRoom(G, { refs, cast, feel, dress, area, sound });
  const payload = await resolved(room.manifest, `${G.id ?? 'game'}-work-room`);
  const D = room.card.demand, M = room.measured;
  const about = [
    { label: 'The shift', lines: [`${room.card.name ?? room.card.id} · ${room.solved.target}`, `an order every ${D.every} s${D.mode === 'backlog' ? `, ${D.backlog} standing` : `, patience ${D.patience} s`}, ${D.orders.length} on the menu`, `${M.arrivals} orders · the goal ${M.goal}`] },
    { label: 'Measured', lines: [`a walker who knows the card, at this template's run: ${M.says}`] },
    { label: 'The place', lines: [room.hero === 'own' ? 'the worker: the world\'s own hero' : `the worker: ${room.mascot.thesis}`, ...placeLines(room)] },
  ];
  const html = await withMenu(await emitted(payload, cdn), { title: `Work room · ${room.card.name ?? room.card.id}`, how: await workHow(room), about, choices: roomChoices(room, cast), query: queryOf(link, { cast, feel: room.feel, dress: room.dress ? room.dress.trade : 'none', ...(area !== undefined ? { area: area === false ? 'none' : area } : {}) }) }, room);
  return { html, room };
}

/**
 * The game room's page: the room on the runtime, and its menu (mana-ui, as the work room's): the brief (what the game
 * asked of the room, and why), the primitives laid, the room laws, the shift's proof where there is one, and the presets
 * to choose from, the room reopened with them; the foes woken on its switch or the pilot's own (still at first).
 */
export async function gameRoomHtml(G, { refs = {}, cast = null, feel = null, dress = null, area = undefined, sound = 'realistic', cdn = false, link = null } = {}) {
  const { gameRoom } = await import('./game-room.js');
  const { WORK_CAST } = await import('./work-room.js');
  cast = cast ?? WORK_CAST;
  const room = gameRoom(G, { refs, cast, feel, dress, area, sound });
  const payload = await resolved(room.manifest, `${G.id ?? 'game'}-game-room`);
  const N = room.needs, counts = {};
  for (const p of room.room.primitives) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  const nf = room.room.anchors.foes.length;
  const about = [
    { label: 'The brief', lines: Object.entries(N.why).map(([k, v]) => `${k}: ${v}`) },
    { label: 'Laid', lines: [Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(' · ') || 'nothing: an open floor', `${room.room.size} m square · ${nf} foe spot${nf === 1 ? '' : 's'}; the spawn's ring blue, the goal's green`] },
    { label: 'The laws', lines: room.laws.map((l) => `${l.holds ? 'holds' : 'advise'} · ${l.law}: ${l.says}`) },
    ...(room.measured ? [{ label: 'The shift', lines: [room.measured.says] }] : []),
    { label: 'The place', lines: [room.hero === 'own' ? 'the hero: the world\'s own' : `the hero: ${room.mascot.thesis}`, ...placeLines(room)] },
  ];
  const html = await withMenu(await emitted(payload, cdn), { title: `Game room · ${G.name ?? G.id ?? 'game'}`, how: await roomHow(room), about, choices: roomChoices(room, cast), foes: nf > 0, query: queryOf(link, { cast, feel: room.feel, dress: room.dress ? room.dress.trade : 'none', ...(area !== undefined ? { area: area === false ? 'none' : area } : {}) }) }, room);
  return { html, room };
}

/** The page of one of the door's rooms. */
export async function practiceHtml(G, id, opts = {}) {
  const { practiceFor, PRACTICE_ROOMS } = await import('./practice.js');
  if (!PRACTICE_ROOMS[id]) throw new Error(`practice: room is ${Object.keys(PRACTICE_ROOMS).join(', ')}`);
  const { rooms, why } = practiceFor(G);
  if (!rooms.includes(id)) throw new Error(`practice: this world has no ${PRACTICE_ROOMS[id].name.replace(/^The /, '').toLowerCase()}${rooms.length ? ` (it has ${rooms.join(', ')})` : `: ${why}`}`);
  if (id === 'range' || id === 'artillery') {
    // the gun rooms: their own pages (the range's gym, the artillery range's sight), their own controls and HUD
    const { rangeFor, artilleryFor } = await import('./practice.js');
    if (id === 'range') { const { rangeHtml } = await import('./combat/range.js'); return { html: rangeHtml({ ...rangeFor(G), ...(opts.sound === 'none' ? { quiet: true } : {}) }) }; }
    const { artilleryHtml } = await import('./combat/artillery.js');
    return { html: artilleryHtml({ ...artilleryFor(G), ...(opts.sound === 'none' ? { quiet: true } : {}) }) };
  }
  // (the roll room's course as its MAP, course-map.js: the book's diagram of a running game's course, `view: 'map'`)
  if (id === 'roll' && opts.view === 'map') {
    const room = rollRoom(G, opts);
    if (room.layout !== 'course') throw new Error('practice: the course map is a running game\'s (a hero that runs on momentum has a course; this world\'s roll room is the yard)');
    const { courseMapHtml } = await import('./course-map.js');
    return { html: courseMapHtml(room.course, { title: G.name ?? G.id ?? 'Course' }), room };
  }
  // (and as its SHEET, course-sheet.js: the way, the asks, the walls and the backdrop on one page, `view: 'sheet'`; framed
  // for the game's own screen)
  if (id === 'roll' && opts.view === 'sheet') {
    const room = rollRoom(G, opts);
    if (room.layout !== 'course') throw new Error('practice: the course sheet is a running game\'s (a hero that runs on momentum has a course; this world\'s roll room is the yard)');
    const [{ courseSheetHtml }, { readScreen, screenPayload }, { courseCamera, COURSE_NEAR, COURSE_TALL_FOV }] = await Promise.all([import('./course-sheet.js'), import('../game/screen.js'), import('./course-view.js')]);
    const S = G.screen ? readScreen(G.screen) : null, P = S ? screenPayload(S.orientation === 'portrait' ? { ...S, fov: S.fov ?? COURSE_TALL_FOV } : S) : null;
    // (an upright screen's course is followed by the camera solved for it, as its level's is: levels.js screenLevel)
    const course = P?.v0 ? { ...room.course, camera: courseCamera({ react: room.course.reactAt, vfov: P.v0, near: COURSE_NEAR.tall }) } : room.course;
    return { html: courseSheetHtml(course, { title: G.name ?? G.id ?? 'Course', ...(P ? { aspect: P.aspect } : {}), ...(P?.v0 ? { vfov: P.v0 } : {}) }), room };
  }
  return id === 'practice' ? practiceRoomHtml(G, opts) : id === 'platform' ? platformRoomHtml(G, opts) : id === 'roll' ? rollRoomHtml(G, opts) : id === 'work' ? workRoomHtml(G, opts) : id === 'room' ? gameRoomHtml(G, opts) : mountLaneHtml(G, opts);
}
