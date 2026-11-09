/**
 * THE PRACTICE ROOM'S PAGE — the room (practice-room.js) resolved and emitted as a level is, its foe's health measured on
 * the resolved bodies (`strings` of the hero's first combo, the runtime's own blows), and its HUD laid over it: the last
 * move's frame data beside what the feel card asks, the combos with the beats of the string being played lit, the
 * sidearm, the guard, the juggle and the MP, and every press, taken or dropped and why. Keys: P the foe's AI on / off
 * (it starts off), K the foe set back, H the HUD. A felled foe plays its fall and comes back where it stood.
 *
 *   practiceRoomHtml(G, { refs?, cast?, pack?, strings?, sound?, cdn? }) → { html, room, string, foeHp }
 *     (room: practice-room.js's result; string: { combo, beats, damage, hits } the first combo measured)
 *   roomRefs(world, ref, exists) → the refs above, by the run's names, each only where its row exists
 *   cardAsked(feel) → what the feel card asks of one swing: { startup, total, cancel, string, lunge, hitstop, stun, dodge,
 *     guard } in frames
 *
 * Served on read as the gameworld's `bible?book=practice` (app/api/sketches/[ref]/bible); the spike's room.mjs is its CLI.
 */
import { practiceRoom } from './practice-room.js';
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
