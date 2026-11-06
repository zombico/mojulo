/**
 * The RPG channel: a world's party battles (playscape/rpg) on the page, riding the events channel (its bus state, its
 * log, its input queue). Emitted inside the events channel only when the events carry `rpg`, so a world without one
 * keeps every byte. The kernel is the node module's own code (buildRpg.toString()), the page below is one function
 * (rpgPage.toString()), so neither has a second copy.
 *
 * THE UI IS MANA-UI's (control/lib/mana-ui/; the spec is playscape/rpg/rpg-ui.js): this page is its host. It reads the
 * battle kernel's state to the spec through bindings (`read`), answers the effects the spec emits (`act`: a command
 * picked, a target, a class, a ware), and says on the bus what came of them; mana-ui owns the screen's state (each
 * list's row, the open tab, the stack of a command, a skill, a target) and the look (the theme: the world's guide, else
 * the console RPG's); the controls layer's mana-host (controls/mana-host.js) drives it from the menu scheme, the
 * keyboard and every pad in its printed layout. The page keeps two bindings of its own, play's and not a menu's: P (a
 * pad's select) opens and closes the party menu.
 *
 *   THE BATTLE, in place over the field (the world holds still while it is up): a bar over each fighter's head, the
 *   foes' box, the message line, the command window. Each standing member picks (Attack, Skill, Item, Guard, Flee; then
 *   whom), then the round plays back beat by beat, a number rising off whoever it lands on. Accept skips ahead; back
 *   steps to the member before.
 *   THE PARTY MENU (P): the members on the left; Status, Class (switch), Equip (a slot, then what to wear), Skills (the
 *   class's tree: buy) in tabs on the right.
 *   RANDOM ENCOUNTERS: a roll every `every` metres the pilot walks, in the random zones (or anywhere).
 *   A SHOP (rpg-shop:<id>): the party and the gold on the left; Buy (its wares at their price, into the bag), Sell
 *   (the bag's priced things at half) and Stay (an inn: a night's rest for its price) in tabs on the right.
 *
 * It reads the bus's log for `rpg-battle:<encounter>`, `rpg-rest`, `rpg-join:<member>`, `rpg-open:<class>`,
 * `rpg-shop:<shop>`, and pushes
 * `rpg-won` / `rpg-fled` / `rpg-lost` (alone and `:<encounter>`) as a battle closes. With the party mechanic (the level
 * contract's game.party) the party is loaded from the store's slice as the level starts, and kept there as it changes.
 * window.__mojRpg drives it headless (a test, the audit): its state, act(<menu action>), the runtime (`ui`).
 */
import { buildRpg } from '../../playscape/rpg/kernel.js';
import { juiceKeys } from '../../playscape/rpg/juice.js';
import { rpgUiSpec, rpgUiTheme, rpgUiCss } from '../../playscape/rpg/rpg-ui.js';
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../../controls/mana-controls.js';
import { DEVICES } from '../../controls/devices.js';

/**
 * The page: run in the events channel's scope (it reads __busState, __inputQueue). cfg: EVENTS.rpg; K: the kernel; ctl:
 * the menu scheme resolved (keys, pad, padLayout) and the pad's select; jk: the juice's keys; M: mana-ui on the page
 * ({ ui: the kernel, host: mana-host, spec, glyphs, css }).
 * → { step(t), … } the frame's step, and the handles window.__mojRpg exposes.
 */
export function rpgPage(cfg, K, ctl, jk, M) {
  const R = K.init(cfg), V = () => __busState.vars;
  K.mirror(cfg, R, V());
  const st = document.createElement('style'); st.textContent = M.css; document.head.appendChild(st);
  // (mana-ui draws into root; the flash over the field is the juice's, not the UI's)
  const root = document.createElement('div'); root.className = 'moj-rpg'; document.body.appendChild(root);
  const flashEl = document.createElement('div'); flashEl.className = 'moj-rpg-flash'; document.body.appendChild(flashEl);
  const CMD = { attack: 'Attack', skill: 'Skill', item: 'Item', guard: 'Guard', flee: 'Flee' };
  const WHY = { battle: 'Not during a fight.', rules: 'Classes are fixed here.', same: 'Already that class.', locked: 'That class is not open yet.', member: 'Not a class they can take.', sp: 'Not enough class points.', requires: 'Learn what it builds on first.', learned: 'Already learned.', class: 'Take that class first.', unknown: '' };
  const BEAT = 650, POP_FOR = 1200;
  // how long each act plays (seconds), within a beat
  const ACT_FOR = { strike: 0.55, cast: 0.55, hurt: 0.4, fall: 0.6 };
  // mode: null | 'battle' | 'field' | 'shop'; the battle's own phase: intro | command | play | end. (Which list a member
  // is on, its row, the open tab: the screen's state, mana-ui's; `pend` is the pick waiting for its target)
  let mode = null, phase = null, beats = [], bi = 0, bt = 0, shown = {}, msg = '', picks = {}, mi = 0, pend = null, pops = [], popN = 0;
  let fmsg = '', seen = 0, walked = 0, lastPos = null, rolls = 0, lastT = 0;
  const SLOT = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' };
  // (a shop's id, what was last said; the party menu's slot being chosen for, and whose)
  let shopId = null, shopAsk = null, smsg = '', fslot = null, fwho = null;
  const SHOP_WHY = { gold: 'Not enough gold.', ware: '', none: 'None left to sell.', shop: '' };
  // CARRIED (the party mechanic: the level contract's game.party): the roster loaded as the level starts, and each
  // number that changed since put back as a setStat after a fight, a class switch, a skill bought, a rest
  const carry = { hooked: false, slice: null, sent: null };
  function hookCarry() {
    const G = window.__mojGame;
    if (carry.hooked || !G) return;
    carry.hooked = true;
    const P = G.contract && G.contract.party;
    if (!P || typeof P.slice !== 'string') return;
    carry.slice = P.slice;
    G.onStart(function (params) {
      const sl = params && params[P.slice];
      if (sl && sl.roster) K.load(cfg, R, sl.roster, V());
      carry.sent = K.save(cfg, R);
    });
  }
  function keep() {
    const G = window.__mojGame;
    if (!carry.slice || !G || !carry.sent) return;
    const now = K.save(cfg, R);
    for (const m in now) {
      for (const k in now[m]) if (!carry.sent[m] || carry.sent[m][k] !== now[m][k]) G.emit({ type: 'setStat', slice: carry.slice, id: m, stat: k, value: now[m][k] });
      // a number gone (an item taken off): 0, so the store forgets it
      for (const k in carry.sent[m] || {}) if (!(k in now[m]) && carry.sent[m][k] !== 0) G.emit({ type: 'setStat', slice: carry.slice, id: m, stat: k, value: 0 });
    }
    carry.sent = now;
  }
  // THE BAG: what the kernel moves in or out of it (a fight's spoils and items used, gear worn or taken off) said on the
  // bus as every bag transfer is (in:bag:<item>:<n> / out:…), so the bag mechanic carries it. Counted from just before.
  let bagSnap = null;
  const bagNow = () => { const v = V(), out = {}; for (const k in v) if (k.indexOf('held:bag:') === 0) out[k.slice(9)] = Number(v[k]) || 0; return out; };
  function bagFrom() { bagSnap = bagNow(); }
  function bagSay() {
    if (!bagSnap) return;
    const now = bagNow();
    for (const k of Object.keys(Object.assign({}, bagSnap, now))) { const d = (now[k] || 0) - (bagSnap[k] || 0); if (d) __inputQueue.push({ type: (d > 0 ? 'in' : 'out') + ':bag:' + k + ':' + Math.abs(d) }); }
    bagSnap = null;
  }

  const memberName = (id) => { for (const p of cfg.party) if (p.id === id) return p.name; return id; };
  // who picks now: every standing member in rounds; on the timeline, the one whose turn it is
  const commanders = () => (!R.b ? [] : R.b.turn !== undefined ? (R.b.turn != null ? [R.b.turn] : []) : R.b.ids.filter((m) => R.m[m].hp > 0 && !R.b.side[m].st.sleep && !K.isAuto(cfg, m)));
  const busy = () => (window.__mojMenus && window.__mojMenus.open && window.__mojMenus.open()) || (window.__mojScenes && window.__mojScenes.on && window.__mojScenes.on());

  // ── the juice (playscape/rpg/juice.js): each beat says its happenings on the bus, and plays the most specific
  // binding's steps: moments and attacks at the figures on the map, the window's flash, jolt and number, a hold ──
  const J = (cfg.juice && cfg.juice.on) || {};
  let linger = 0, popStyle = null;
  const W = () => window.__mojCtrl && window.__mojCtrl.world;
  // the figure on the map a combatant stands for: a member's own (the pilot when they have none); a foe's own where its
  // encounter stands one for each of its foes (in the foes' order), else the pack's one figure
  function figureOf(who) {
    const w = W();
    if (!w || who == null || !R.b) return null;
    if (R.b.side[who]) return w.byId[who] ? who : w.pilotId || null;
    const m = (cfg.met || []).find((x) => x.id === R.b.enc);
    if (!m || !m.who) return null;
    const i = R.b.foes.findIndex((x) => x.uid === who), id = Array.isArray(m.who) ? m.who[Math.max(0, i)] : m.who;
    return id && w.byId[id] && !w.byId[id].gone ? id : null;
  }
  // (a foe with a figure of its own: its fall is its own, not the pack's)
  const ownFigure = (who) => { const m = (cfg.met || []).find((x) => x.id === R.b.enc); return !!(m && Array.isArray(m.who)); };
  function cast(ops) { try { if (window.__mojCtrl && window.__mojCtrl.cast) window.__mojCtrl.cast(ops); } catch (e) { /* a figure gone: no moment */ } }
  function flash(color, secs) {
    flashEl.style.transition = 'none'; flashEl.style.background = color || '#ffffff'; flashEl.style.opacity = '0.75';
    void flashEl.offsetWidth;
    flashEl.style.transition = 'opacity ' + (secs || 0.12) + 's ease-out'; flashEl.style.opacity = '0';
  }
  function step1(s, b) {
    if (s.puff) { const f = figureOf(s.at === 'actor' ? b.by || b.who : b.target); if (f) cast([{ op: 'puff', who: f, is: s.puff, ...(s.color ? { color: s.color } : {}), ...(s.scale ? { scale: s.scale } : {}) }]); }
    else if (s.beam) { const a = figureOf(b.by || b.who), t = figureOf(b.target); if (a && t && a !== t) cast([{ op: 'beam', who: a, to: t, spec: cfg.juice.fx.beams[s.beam], land: s.land, ...(s.color ? { color: s.color } : {}) }]); }
    else if (s.shake) cast([{ op: 'shake', k: s.shake, for: s.for || 0.4 }]);
    else if (s.flash !== undefined) flash(s.flash, s.for);
    else if (s.jolt) {
      const who = s.jolt === 'actor' ? b.by || b.who : b.target;
      // (the window jolts; a row's jolt is its number's change, which flashes and pops as mana-ui marks every change)
      if (s.jolt === 'window') { root.style.setProperty('--k', s.k || 1); root.classList.remove('jolt'); void root.offsetWidth; root.classList.add('jolt'); }
      else if (who != null) { /* the change's own mark */ }
    }
    else if (s.pop) popStyle = s;
    else if (s.hold) linger += s.hold * 1000;
    else if (s.emit) __inputQueue.push({ type: s.emit });
    else if (s.shot) shotAt(s.shot, figureOf(s.at === 'target' ? b.target : b.by || b.who), figureOf(b.target), (s.for || SHOT_FOR) * 1000);
    else if (s.act) {
      // the body acts it out (the controllable channel plays e.act: its own clip at the act's phase on the world clock);
      // a pack's figure stands for all its foes, so a foe's fall is its recoil (it falls when the fight is won)
      const who = s.at === 'actor' ? b.by || b.who : b.target, w = W(), id = figureOf(who), e = id && w && w.byId[id];
      if (e) {
        const is = s.act === 'fall' && !R.b.side[who] && !ownFigure(who) ? 'hurt' : s.act, to = is === 'strike' ? figureOf(b.target) : null;
        e.act = { is, t0: w.time || 0, for: s.for || ACT_FOR[is], ...(to && to !== id ? { to } : {}) };
      }
    }
  }
  function juice(b) {
    linger = 0; popStyle = null;
    const keys = jk ? jk(b) : [];
    for (const k of keys) __inputQueue.push({ type: 'rpg-on:' + k });
    for (const k of keys) if (J[k]) { for (const s of J[k]) step1(s, b); break; }
    // layered over it: every happening of the beat with an also adds its steps
    const A = (cfg.juice && cfg.juice.also) || {};
    for (const k of keys) if (A[k]) for (const s of A[k]) step1(s, b);
  }
  // a beat shown: its juice, its number, its numbers moved, its film
  function show(b) { shots = []; juice(b); pop(b); note(b); cinema(b); }

  // ── THE CINEMA (rules.cinema): a skill (or every action) as a short film while the round plays out, nobody picking:
  // the actor close as it begins, behind it at its target as the blow goes, the target as it lands, back to the view.
  // A shot is a camera placed each frame by its figures, the beat held until its shots have run; past `skip` seconds
  // the film says it may be skipped, and accept cuts to its end ──
  const CINE = cfg.rules && cfg.rules.cinema, SHOT_FOR = 0.7;
  let shots = [], film = null, filmUi = null;
  function shotAt(kind, a, t, ms) {
    const at = shots.length ? shots[shots.length - 1].t1 : 0;
    shots.push({ kind, a, t, t0: at, t1: at + ms });
    linger = Math.max(linger, at + ms - BEAT);
  }
  function cinema(b) {
    if (!CINE || !b) return;
    const by = b.by || b.who, starts = (b.kind === 'cast' || (CINE.on === 'all' && b.kind === 'hurt' && !film)) && by != null;
    if (starts) {
      const a = figureOf(by), t = figureOf(b.target) || (R.b.foes[0] && figureOf(R.b.foes[0].uid));
      film = { by, t: Date.now() };
      if (b.kind === 'cast') { shotAt('closeup', a, t, 800); shotAt('behind', a, t, 900); }
      else { shotAt('behind', a, t, 800); shotAt('target', t, a, 700); }
    } else if (film && by === film.by && b.target != null && ['hurt', 'heal', 'status', 'miss', 'ko'].includes(b.kind)) shotAt('target', figureOf(b.target), figureOf(by), 700);
    else if (film) endFilm();
    // (the screen meanwhile: what the book's cinema keeps; past its skip seconds, the prompt to cut it short)
    filmUi = film ? CINE.ui || 'numbers' : null;
    const est = film ? (Date.now() - film.t) / 1000 + (shots.length ? shots[shots.length - 1].t1 / 1000 : 0) + 0.7 : 0;
    if (film) film.long = film.long || est > (CINE.skip ?? 3);
  }
  function endFilm() { film = null; filmUi = null; shots = []; view(); }
  // (the staged view given back to the camera)
  function view() { const w = W(), C = w && w.camera; if (C && staged && staged.view) { C.transform.pos = staged.view.pos.slice(); C.lookAt = staged.view.look.slice(); } }
  // each frame: the shot the beat is on, its camera placed by its figures (a close-up in front of one, behind the actor
  // at its target, on the target from the actor's side); between shots and after the last, the view
  function film1() {
    const w = W(), C = w && w.camera;
    if (!C || !shots.length) return;
    const S = shots.find((x) => bt >= x.t0 && bt < x.t1) || null;
    if (!S) { if (bt >= shots[shots.length - 1].t1) view(); return; }
    const A = S.a && w.byId[S.a], T = S.t && w.byId[S.t];
    if (!A) return;
    const p = A.transform.pos, hgt = (A.rule && A.rule.collideHeight) || 1.7, q = T ? T.transform.pos : [p[0] + Math.cos(A.transform.heading), p[1] + Math.sin(A.transform.heading), p[2]];
    let dx = q[0] - p[0], dy = q[1] - p[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const sx = -dy, sy = dx, k = Math.max(1, hgt / 1.7);
    if (S.kind === 'closeup' || S.kind === 'target') {
      // (in front of the figure, a little to its side, at its chest: on the target from the side its blow came from)
      C.transform.pos = [p[0] + dx * 2.4 * k + sx * 1.0 * k, p[1] + dy * 2.4 * k + sy * 1.0 * k, p[2] + hgt * 0.85];
      C.lookAt = [p[0], p[1], p[2] + hgt * 0.6];
    } else if (S.kind === 'behind') {
      // (over the actor's shoulder at its target)
      C.transform.pos = [p[0] - dx * 2.2 * k + sx * 0.7 * k, p[1] - dy * 2.2 * k + sy * 0.7 * k, p[2] + hgt * 1.05];
      C.lookAt = [q[0], q[1], q[2] + 0.9];
    } else view();
  }
  function skipFilm() { let n = 0; while (film && phase === 'play' && n++ < 40) advance(); if (film) endFilm(); }

  // ── the battle ──
  function startBattle(enc) {
    if (R.b || mode === 'battle') return false;
    if (mode === 'field') closeField();
    bagFrom();
    const out = K.start(cfg, R, enc, V());
    if (!out.length) return false;
    mode = 'battle'; phase = 'intro'; beats = out; bi = 0; bt = 0; shown = {}; picks = {}; mi = 0; pend = null; boxes = { cmd: 'bottom-left', foes: 'bottom-right' };
    msg = out[0].text; show(out[0]);
    stage(); placeDue = 3;
    screen('rpg-watch');
    return true;
  }

  // ── the staging: a fight lines its sides up and frames them. The party stands abreast a few metres from the pack's
  // figure, each facing it, the pack facing them; the camera stands off to the side, three-quarters, both lines in
  // frame. All of it put back as the fight closes (the world is held through it: nothing else moves) ──
  // (gap: the party's point off the pack; WEDGE: each member's place in the party's formation, [aside, back] in metres,
  // the hero at its point and the rest in ranks behind on either side, never a line; the camera: back along the
  // party's side, up, its field and the margin round the fighters it fits; low: how far below the frame's middle the
  // fighters' middle sits (a fraction of the half-frame; below zero, above it: the bars over their heads kept in the
  // frame, the corners' boxes clear of their feet); clear: how far a
  // sightline may pass over the ground)
  const STAGE = { gap: 4.2, back: 1.0, up: 2.2, fov: 45, margin: 2.4, low: -0.12, clear: 0.4, near: 4.5, far: 12 };
  const WEDGE = [[0, 0], [-1.1, 1.0], [1.1, 1.0], [0, 2.0], [-2.2, 2.0], [2.2, 2.0], [-1.1, 3.0], [1.1, 3.0]];
  // THE VIEWS a fight may be seen from (rules.view): az, degrees round the fight from behind the party (0 over its
  // shoulders at the foes, ±90 from the side), el the camera's elevation, mirror whether its other side may be taken
  // where the first is blocked, low the aim's drop (below zero: lifted), far a reach beyond the usual
  const VIEWS = {
    side: { az: 90, el: 12, mirror: true },
    front: { az: 0, el: 24, low: -0.05 },
    left: { az: 40, el: 26 },
    right: { az: -40, el: 26 },
    overhead: { az: 60, el: 56, mirror: true, low: 0, far: 1.4 },
  };
  let viewOver = null;
  let staged = null;
  // THE ENCOUNTER'S STAGE (rules.stage): 'live', the fight on the map where it was met (the default); 'backdrop', its
  // fighters moved by ARENA to an arena of their own, seen from the side with the party on the left, before the map drawn
  // once from that view where they met (__mojCtrl.backdrop, after the move has reached the figures: the second frame)
  const ARENA = [6000, 0, 0];
  const onArena = () => !!(cfg.rules && cfg.rules.stage === 'backdrop' && window.__mojCtrl && window.__mojCtrl.backdrop);
  function stage() {
    const w = W();
    if (!w || !R.b) return;
    // (a figure the page cannot place, one with no transform, stands where it is)
    const placed = (id) => !!(id && w.byId[id] && w.byId[id].transform && w.byId[id].transform.pos);
    const fid0 = figureOf(R.b.foes && R.b.foes[0] && R.b.foes[0].uid), fid = placed(fid0) ? fid0 : null, pid = placed(w.pilotId) ? w.pilotId : null, P = pid && w.byId[pid];
    const ids = [...new Set(R.b.ids.map((m) => figureOf(m)).filter(placed))], F = fid && w.byId[fid];
    if (!P || !ids.length) return;
    const fp = F ? F.transform.pos : [P.transform.pos[0] + Math.cos(P.transform.heading) * STAGE.gap, P.transform.pos[1] + Math.sin(P.transform.heading) * STAGE.gap, P.transform.pos[2]];
    let ux = P.transform.pos[0] - fp[0], uy = P.transform.pos[1] - fp[1];
    const n = Math.hypot(ux, uy);
    if (n < 1e-3) { ux = -Math.cos(P.transform.heading); uy = -Math.sin(P.transform.heading); } else { ux /= n; uy /= n; }
    // (each fighter stood on the ground found from well above it: a probe from under a slope's surface finds the one below)
    const px = -uy, py = ux, ground = (x, y, z, e) => { const g = window.__mojCtrl && window.__mojCtrl.ground ? window.__mojCtrl.ground(x, y, z + 30) : null; return g == null ? z : g + ((e.rule && e.rule.eye) || 0); };
    const C = w.camera && w.camera.transform ? w.camera : null;
    staged = { at: {}, cam: C ? { pos: C.transform.pos.slice(), heading: C.transform.heading, pitch: C.transform.pitch, lookAt: C.lookAt ? C.lookAt.slice() : null, rule: C.rule } : null };
    const face = (e, x, y) => { e.transform.heading = Math.atan2(y - e.transform.pos[1], x - e.transform.pos[0]); };
    ids.forEach((id, i) => {
      const e = w.byId[id], [o, b] = WEDGE[i] || [((i % 2) ? -1 : 1) * 1.1 * Math.ceil(i / 2), 1 + Math.floor(i / 2)];
      staged.at[id] = { pos: e.transform.pos.slice(), heading: e.transform.heading };
      const x = fp[0] + ux * (STAGE.gap + b) + px * o, y = fp[1] + uy * (STAGE.gap + b) + py * o;
      e.transform.pos = [x, y, ground(x, y, fp[2], e)]; e.staged = true;
      face(e, fp[0], fp[1]);
    });
    const cx = fp[0] + ux * STAGE.gap / 2, cy = fp[1] + uy * STAGE.gap / 2;
    // (the pack's other figures, where each foe has its own: a wedge mirrored to the party's behind the first, each
    // facing the party)
    const met = (cfg.met || []).find((x) => x.id === R.b.enc), crew = met && Array.isArray(met.who) ? met.who.slice(1).filter(placed) : [];
    // (spaced by the pack's widest: a wedge of person steps spread by how far its largest reaches round its middle)
    const wide = Math.max(1, ...[fid, ...crew].filter(Boolean).map((id) => (2 * ((w.byId[id].rule && w.byId[id].rule.collideRadius) || 0.3) + 0.6) / 1.1));
    crew.forEach((id, i) => {
      const e = w.byId[id], [o0, b0] = WEDGE[i + 1] || [((i % 2) ? -1 : 1) * 1.1, 1 + i], o = o0 * wide, b = b0 * wide;
      staged.at[id] = { pos: e.transform.pos.slice(), heading: e.transform.heading };
      const x = fp[0] - ux * b + px * o, y = fp[1] - uy * b + py * o;
      e.transform.pos = [x, y, ground(x, y, fp[2], e)]; e.staged = true;
      face(e, fp[0] + ux * STAGE.gap, fp[1] + uy * STAGE.gap);
    });
    if (F) { staged.at[fid] = { pos: F.transform.pos.slice(), heading: F.transform.heading }; F.staged = true; face(F, cx + ux * STAGE.gap / 2, cy + uy * STAGE.gap / 2); }
    if (C) {
      // THE VIEW the fight is seen from (the battles' rules.view, the book's): a direction round the fight, its azimuth
      // from behind the party (0: over the party's shoulders at the foes; ±90: from the side) and its elevation; the
      // distance fitted to every fighter across the frame and down it, the aim set low by the band's share
      const V = onArena() ? { ...VIEWS.side, mirror: false } : VIEWS[viewOver || (cfg.rules && cfg.rules.view)] || VIEWS.side;
      const gz = (x, y) => { const g = window.__mojCtrl && window.__mojCtrl.ground ? window.__mojCtrl.ground(x, y, fp[2] + 30) : null; return g == null ? fp[2] : g; };
      // (the frame's middle the midpoint of the fight's extent, its height the middle of both lines' ground)
      const pts = [fp, ...crew.map((id) => w.byId[id].transform.pos), ...ids.map((id) => w.byId[id].transform.pos)], zs = pts.map((q) => q[2]), zm = (Math.min(...zs) + Math.max(...zs)) / 2;
      const along = pts.map((q) => (q[0] - fp[0]) * ux + (q[1] - fp[1]) * uy), across = pts.map((q) => (q[0] - fp[0]) * px + (q[1] - fp[1]) * py);
      const mu = (Math.min(...along) + Math.max(...along)) / 2, mp = (Math.min(...across) + Math.max(...across)) / 2;
      const mx = fp[0] + ux * mu + px * mp, my = fp[1] + uy * mu + py * mp;
      const vf = (C.fov || STAGE.fov) * Math.PI / 360, asp = (window.innerWidth || 16) / (window.innerHeight || 9), hf = Math.atan(Math.tan(vf) * asp);
      const shot = (az, lift) => {
        const a = az * Math.PI / 180, el = V.el * Math.PI / 180, dx = ux * Math.cos(a) + px * Math.sin(a), dy = uy * Math.cos(a) + py * Math.sin(a), rx = -dy, ry = dx;
        // (fitted across the frame by each fighter's offset on the camera's right, nearer ones wider; down it by the
        // fight's depth tipped up by the elevation)
        let dist = STAGE.near;
        for (const q of pts) {
          const ox = q[0] - mx, oy = q[1] - my, r = ox * rx + oy * ry, dep = ox * dx + oy * dy;
          dist = Math.max(dist, (Math.abs(r) + STAGE.margin) / Math.tan(hf) + Math.max(0, dep), (Math.abs(dep) * Math.sin(el) + 1.2) / Math.tan(vf) + Math.max(0, dep));
        }
        dist = Math.min(STAGE.far * (V.far || 1), dist);
        const H = dist * Math.cos(el), x = mx + dx * H, y = my + dy * H, g = gz(x, y), z = Math.max(zm + 1 + dist * Math.sin(el) + lift, g + 1.2);
        const look = [mx, my, zm + 1 - dist * Math.tan(vf) * (V.low ?? STAGE.low)];
        // (every fighter's chest seen past the ground: a sightline sampled against the ground under it)
        let hit = g + 1.2 > zm + 1 + dist * Math.sin(el) + lift + 1.5 ? 4 * pts.length : 0;
        for (const q of pts) for (let k = 1; k < 7; k++) { const t = k / 7, sx = x + (q[0] - x) * t, sy = y + (q[1] - y) * t, sz = z + (q[2] + 1.2 - z) * t; if (gz(sx, sy) + STAGE.clear > sz) hit++; }
        return { pos: [x, y, z], look, hit };
      };
      let best = null;
      for (const lift of [0, 2, 4]) { for (const az of V.mirror ? [V.az, -V.az] : [V.az]) { const v = shot(az, lift); if (!best || v.hit < best.hit) best = v; } if (best.hit === 0) break; }
      C.transform.pos = best.pos; C.lookAt = best.look; C.rule = null;
      staged.view = { pos: best.pos.slice(), look: best.look.slice() };
      // (on its arena: every fighter and the view moved by ARENA, the map's view kept for the backdrop, drawn two frames on)
      if (onArena()) {
        const sh = (q) => [q[0] + ARENA[0], q[1] + ARENA[1], q[2] + ARENA[2]];
        for (const id in staged.at) { const e = w.byId[id]; if (e) e.transform.pos = sh(e.transform.pos); }
        staged.backdrop = { from: best.pos.slice(), look: best.look.slice(), due: 2, h: null };
        staged.view = { pos: sh(best.pos), look: sh(best.look) };
        C.transform.pos = staged.view.pos.slice(); C.lookAt = staged.view.look.slice();
      }
    }
  }
  // (the backdrop drawn once the fighters have left the place they met, so none stands in it)
  function backdrop1() {
    const B = staged && staged.backdrop;
    if (!B || B.h || --B.due > 0) return;
    try { B.h = window.__mojCtrl.backdrop(B.from, B.look, ARENA); } catch (e) { B.h = { dispose() {} }; }
  }
  function unstage() {
    const w = W();
    if (!w || !staged) { staged = null; return; }
    for (const id in staged.at) { const e = w.byId[id], s = staged.at[id]; if (e) { e.transform.pos = s.pos; e.transform.heading = s.heading; e.staged = false; } }
    const C = w.camera, s = staged.cam;
    if (C && s) { C.transform.pos = s.pos; C.transform.heading = s.heading; C.transform.pitch = s.pitch; C.lookAt = s.lookAt; C.rule = s.rule; }
    if (staged.backdrop && staged.backdrop.h) staged.backdrop.h.dispose();
    staged = null;
  }
  // ── a member's pick: a command, then what it uses, then whom (each a screen of mana-ui's, one back apart) ──
  function pickNow(pick) {
    const ids = commanders(), m = ids[mi];
    picks[m] = pick;
    if (pick.act === 'flee') return resolve();
    mi++; pend = null;
    if (mi >= ids.length) return resolve();
    screen('rpg-cmd');
  }
  function resolve() {
    // the round is played back from where it began: each beat moves the numbers it names, nothing else jumps ahead
    const before = {};
    for (const x of R.b.foes) before[x.uid] = x.hp;
    for (const m of R.b.ids) { before[m] = R.m[m].hp; before[m + ':mp'] = R.m[m].mp; }
    const out = K.round(cfg, R, picks, V());
    picks = {}; mi = 0; pend = null;
    beats = out; bi = 0; bt = 0; phase = 'play'; shown = before;
    if (out.length) { msg = out[0].text; show(out[0]); }
    screen('rpg-watch');
  }
  function note(b) { if (b && b.target != null && b.hp != null) shown[b.target] = b.hp; if (b && b.who != null && b.mp != null) shown[b.who + ':mp'] = b.mp; }
  // a number where a blow lands: what it did told by its word (values first), how big by the juice's pop
  const POP_ROLE = { normal: 'numeral', small: 'caption', big: 'title', crit: 'display' };
  function pop(b) {
    if (!b || b.target == null) return;
    const value = b.kind === 'miss' ? 'miss' : b.kind === 'hurt' ? String(b.amount) : b.kind === 'heal' && b.amount ? '+' + b.amount : '';
    if (!value) return;
    const kind = b.kind === 'heal' ? (b.absorb ? 'absorb' : 'heal') : b.kind === 'hurt' ? (b.crit ? 'crit' : b.mul === 2 ? 'weak' : b.mul === 0 ? 'immune' : b.mul === 0.5 ? 'resist' : '') : '';
    pops.push({ id: ++popN, at: b.target, value, kind, role: POP_ROLE[(popStyle && popStyle.pop) || 'normal'] || 'numeral', t: lastT });
  }
  function advance() {
    if (phase === 'intro') { phase = 'command'; msg = ''; if (!commanders().length) return resolve(); return screen('rpg-cmd'); }
    if (phase === 'play') {
      bi++; bt = 0;
      if (bi < beats.length) { msg = beats[bi].text; show(beats[bi]); return; }
      shown = {};
      if (R.b.phase === 'command') { phase = 'command'; msg = ''; if (!commanders().length) return resolve(); return screen('rpg-cmd'); }
      phase = 'end';
      return;
    }
    if (phase === 'end') {
      const ev = K.close(cfg, R, V());
      keep(); bagSay();
      for (const e of ev) __inputQueue.push(e);
      mode = null; phase = null; pops = [];
      { const w = W(); if (w) for (const e of w.entities) if (e.act) e.act = null; }   // the fight's acts end with it
      unstage();
      screen(null);
      release();
    }
  }
  function command(id) {
    if (id === 'guard' || id === 'flee') return pickNow({ act: id });
    if (id === 'attack') return toTarget({ act: 'attack' });
    if (id === 'skill' || id === 'item') { rt.open('rpg-' + id); rt.focusAt(0); }
  }
  function toTarget(pick) {
    const ts = K.targets(cfg, R, pick);
    if (!ts.length) { const aim = K.aimOf(cfg, pick); return pickNow(Object.assign({}, pick, { target: aim === 'self' ? commanders()[mi] : null })); }
    pend = pick; rt.open('rpg-target'); rt.focusAt(0);
  }
  // back from the commands: the member before picks again
  function undo() { if (mi > 0) { mi--; delete picks[commanders()[mi]]; screen('rpg-cmd'); } }

  // ── what the screens read (the host's state, never copied into the UI: a binding reads it here each frame) ──
  // (the banner across the top tells an action's name or a status, never a number: a blow's lands over whoever takes it)
  const TOLD = ['start', 'cast', 'status', 'ko', 'level', 'learn', 'spoils', 'end'];
  const LIST = { 'rpg-cmd': 'commands', 'rpg-skill': 'skills', 'rpg-item': 'items', 'rpg-target': 'targets' };
  const LEVEL = { 'rpg-cmd': 'cmd', 'rpg-skill': 'skill', 'rpg-item': 'item', 'rpg-target': 'target' };
  // (the screen up: none while the runtime draws its first frame)
  const up = () => (rt ? rt.state().screen : null);
  // (the model is built once a frame, and again on a change the host made or a screen mana-ui opened or left)
  let VM = null, VMat = null;
  const vm = () => { const top = up(); if (!VM || VMat !== top) { VMat = top; VM = model(); } return VM; };
  const changed = () => { VM = null; };
  function model() {
    return { battle: mode === 'battle' && R.b ? battleModel() : { on: false }, party: mode === 'field' ? partyModel() : {}, shop: mode === 'shop' ? shopModel() : {} };
  }
  // where a figure's head is on the screen (px), by the scene's projection, and in the world (its third: a headset draws
  // what stands over it there); null behind the eye or without one
  function headAt(fig) {
    const w = W(), proj = window.__mojCtrl && window.__mojCtrl.project, e = fig && w && w.byId[fig];
    if (!e || !e.transform || !proj) return null;
    const top = (e.rule && e.rule.collideHeight) || 1.8, P = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] - ((e.rule && e.rule.eye) || 0) + top + 0.12], p = proj(P[0], P[1], P[2]);
    return p[2] < 1 ? [p[0], p[1], P] : null;
  }
  function battleModel() {
    const b = R.b, cmd = phase === 'command', active = cmd ? commanders()[mi] : null, top = up(), lv = LEVEL[top] || 'cmd', aiming = cmd && top === 'rpg-target' && !!pend;
    const o = cmd && active ? K.options(cfg, R, active, V()) : { commands: [], skills: [], items: [] };
    const acting = phase === 'play', beat = phase === 'intro' || phase === 'play' ? beats[bi] : null;
    const Wd = window.innerWidth || 960, Ht = window.innerHeight || 540, frac = (p) => [p[0] / Wd, p[1] / Ht];
    const hp = (id, now) => (shown[id] != null ? shown[id] : now);
    const named = !pend ? '' : pend.act === 'attack' ? CMD.attack : pend.act === 'skill' ? (cfg.skills[pend.skill] || {}).name : pend.act === 'item' ? (cfg.items[pend.item] || {}).name : '';
    // the heads: one over each member's figure (members who share one, the pilot's, stacked; two that meet, the later
    // lifted clear), and one over a foe's figure while a target is being chosen
    const heads = [], stack = {};
    for (const m of b.ids) {
      const fig = figureOf(m), at = headAt(fig);
      if (!at) continue;
      const Mm = R.m[m], S = K.statsOf(cfg, R, m), s1 = b.side[m].st, k = stack[fig] = (stack[fig] || 0) + 1;
      const tags = [Mm.poison ? 'poison' : '', s1.sleep ? 'asleep' : '', s1.silence ? 'silenced' : ''].filter(Boolean);
      heads.push({ id: m, px: [at[0], at[1] - 44 * (k - 1)], world: [at[2][0], at[2][1], at[2][2] + 0.3 * (k - 1)], hp: hp(m, Mm.hp), hpMax: S.hp, mp: shown[m + ':mp'] != null ? shown[m + ':mp'] : Mm.mp, mpMax: S.mp > 0 ? S.mp : 0, statuses: tags.length ? tags : null, turn: m === active, foe: false });
    }
    const placed = heads.slice().sort((x, y) => y.px[1] - x.px[1]);
    for (let i = 0; i < placed.length; i++) for (let j = 0; j < i; j++) { const a = placed[i], c = placed[j]; if (Math.abs(a.px[0] - c.px[0]) < 86 && Math.abs(a.px[1] - c.px[1]) < 36) a.px[1] = c.px[1] - 37; }
    const figs = {};
    if (aiming) for (const x of b.foes) { const ff = figureOf(x.uid), at = !figs[ff] && headAt(ff); if (at) { figs[ff] = 1; heads.push({ id: 'fig-' + ff, px: [at[0], at[1]], world: at[2], foe: true }); } }
    for (const h of heads) { const [x, y] = frac(h.px); delete h.px; h.x = x; h.y = y; }
    // the numbers where blows land, over whoever took them (a foe over its own figure, or its pack's)
    const numbers = [];
    for (const p of pops) { const at = headAt(figureOf(p.at)); if (at) { const [x, y] = frac(at); numbers.push({ id: p.id, x, y, world: at[2], value: p.value, kind: p.kind, role: p.role }); } }
    const next = K.preview(cfg, R, 6);
    return {
      on: true, phase, aiming, acting, message: msg, foeHp: cfg.rules.foeHp === 'bar',
      // what stays up while a round plays (the book's cinema: none, the numbers, everything)
      panels: !acting || filmUi === 'all', numbers: filmUi !== 'none', told: !!(beat && msg && TOLD.includes(beat.kind)) && filmUi !== 'none',
      next: film && film.long ? 'Skip ▸' : phase === 'end' ? 'Continue ▸' : 'Next ▸',
      cmdAt: boxes.cmd, foesAt: boxes.foes,
      title: !active ? '' : memberName(active) + (aiming ? ' · ' + named : lv !== 'cmd' ? ' · ' + CMD[lv] : ''),
      commands: o.commands.map((c) => ({ id: c.id, label: CMD[c.id], disabled: !c.ok })),
      skills: o.skills.map((x) => ({ id: x.id, label: x.name, right: x.mp ? x.mp + ' MP' : '', disabled: !x.ok })),
      items: o.items.map((it) => ({ id: it.id, label: it.name, right: '×' + it.count })),
      // (each target names the rows it marks while in focus: its own, and the figure it stands on)
      targets: aiming ? K.targets(cfg, R, pend).map((t) => { const ff = R.b.side[t.id] ? null : figureOf(t.id); return { id: t.id, label: t.name, aim: Object.assign({ [t.id]: true }, ff ? { ['fig-' + ff]: true } : {}) }; }) : [],
      foes: b.foes.map((x) => { const h = hp(x.uid, x.hp); return { id: x.uid, name: x.name, hp: Math.max(0, h), hpMax: x.max, down: h <= 0 }; }),
      turns: next.length ? next.map((x, i) => ({ name: x.name, variant: x.party ? 'plain' : 'muted', turn: i === 0 })) : null,
      heads, pops: numbers,
    };
  }
  // THE BOXES PLACED BY THE VIEW: once a fight is staged (and when its view changes), where its fighters stand on the
  // screen is measured by the scene's projection, and the command window and the foes' box take the two corners that
  // cover the party least (the foes' figures next); the banner keeps the top's middle
  let placeDue = 0, boxes = { cmd: 'bottom-left', foes: 'bottom-right' };
  const CORNERS = ['bl', 'br', 'tl', 'tr'], BOX = { cmd: [230, 160], foes: [230, 96] }, REGION = { bl: 'bottom-left', br: 'bottom-right', tl: 'top-left', tr: 'top-right' };
  function placeBoxes() {
    const w = W(), proj = window.__mojCtrl && window.__mojCtrl.project, b = R.b;
    // (the side view keeps the window's own layout: the menu at the lower left, the foes' box at the lower right)
    if ((viewOver || (cfg.rules && cfg.rules.view) || 'side') === 'side') { boxes = { cmd: 'bottom-left', foes: 'bottom-right' }; return true; }
    if (!w || !proj || !b) return false;
    const W0 = window.innerWidth || 960, H0 = window.innerHeight || 540;
    const rectOf = (ids) => {
      let r = null;
      for (const id of ids) {
        const e = id && w.byId[id]; if (!e || !e.transform) continue;
        const h = (e.rule && e.rule.collideHeight) || 1.7, z = e.transform.pos[2] - ((e.rule && e.rule.eye) || 0);
        for (const zz of [z, z + h + 0.4]) { const p = proj(e.transform.pos[0], e.transform.pos[1], zz); if (!(p[2] < 1)) continue; r = r ? [Math.min(r[0], p[0]), Math.min(r[1], p[1]), Math.max(r[2], p[0]), Math.max(r[3], p[1])] : [p[0], p[1], p[0], p[1]]; }
      }
      return r && [r[0] - 30, r[1] - 20, r[2] + 30, r[3] + 10];
    };
    const party = rectOf([...new Set(b.ids.map((m) => figureOf(m)))]), foes = rectOf([...new Set(b.foes.map((x) => figureOf(x.uid)))]);
    const box = (c, [bw, bh]) => [c[1] === 'l' ? 12 : W0 - 12 - bw, c[0] === 't' ? 12 : H0 - 12 - bh, c[1] === 'l' ? 12 + bw : W0 - 12, c[0] === 't' ? 12 + bh : H0 - 12];
    const over = (a, r) => (!a || !r ? 0 : Math.max(0, Math.min(a[2], r[2]) - Math.max(a[0], r[0])) * Math.max(0, Math.min(a[3], r[3]) - Math.max(a[1], r[1])));
    let best = null;
    for (const c of CORNERS) for (const f of CORNERS) {
      if (c === f) continue;
      const bc = box(c, BOX.cmd), bf = box(f, BOX.foes);
      // (the party covered weighs most, the foes next; a box low is a little better than one high, as a pad's thumbs are)
      const cost = 3 * (over(bc, party) + over(bf, party)) + over(bc, foes) + over(bf, foes) + (c[0] === 't' ? 400 : 0) + (f[0] === 't' ? 200 : 0);
      if (!best || cost < best.cost) best = { cost, c, f };
    }
    boxes = { cmd: REGION[best.c], foes: REGION[best.f] };
    return true;
  }

  // ── the party menu ──
  function openField() {
    if (mode || busy()) return;
    mode = 'field'; fmsg = ''; fslot = null;
    screen('rpg-party', true);
  }
  function closeField() { if (!mode || mode === 'battle') return; mode = null; fslot = null; screen(null); release(); }
  const members = () => K.partyOf(cfg, R, V());
  function partyModel() {
    const gold = V()[cfg.rules.gold] || 0;
    const rows = members().map((id) => {
      const M0 = R.m[id], S = K.statsOf(cfg, R, id), C = cfg.classes[M0.cls], cl = M0.cl[M0.cls], next = M0.level < cfg.rules.cap ? K.xpFor(cfg, M0.level + 1) - M0.xp : 0;
      return {
        id, name: memberName(id), level: M0.level, hp: M0.hp, hpMax: S.hp,
        title: memberName(id) + ' · ' + C.name + ' rank ' + cl.lv,
        stats: [{ label: 'Next', value: next + ' XP' }, { label: 'HP', value: M0.hp, max: S.hp }, { label: 'MP', value: M0.mp, max: S.mp }, { label: 'Attack', value: S.atk }, { label: 'Defence', value: S.def }, { label: 'Magic', value: S.mag }, { label: 'Speed', value: S.spd }, { label: 'Class pts', value: cl.sp }, ...(M0.poison ? [{ label: 'Status', value: 'Poisoned' }] : [])],
        skills: K.usable(cfg, R, id).map((x) => cfg.skills[x].name).join(', ') || '—',
        worn: Object.values(M0.gear).map((g) => cfg.gear[g].name).join(', ') || '—',
        classes: K.classesOf(cfg, R, id, V()).map((c) => ({ id: c.id, label: c.name, right: c.current ? 'current' : !c.open ? 'locked' : c.rank ? 'rank ' + c.rank : 'new', disabled: !c.open })),
        slots: K.gearOf(cfg, R, id, V()).map((g) => ({ id: g.slot, label: SLOT[g.slot], right: g.name || '—' })),
        points: C.name + ' · ' + cl.sp + ' CP',
        tree: K.treeOf(cfg, R, id).map((e) => ({
          id: e.skill, label: e.name, disabled: e.state === 'locked' || e.state === 'later',
          right: e.state === 'learned' ? '✓' : e.state === 'buy' ? e.cost + ' CP' : e.state === 'later' ? 'rank ' + e.at : e.why === 'requires' ? 'needs ' + e.need.map((n) => cfg.skills[n].name).join(', ') : e.cost + ' CP',
        })),
      };
    });
    // (a slot being chosen for: take it off, or what the bag holds for it)
    const g = fslot && fwho ? K.gearOf(cfg, R, fwho, V()).find((x) => x.slot === fslot) : null;
    return { members: rows, gold, said: fmsg, slot: g ? memberName(fwho) + ' · ' + SLOT[fslot] : '', choices: g ? [{ id: '-', label: '—', right: '', disabled: !g.item }, ...g.can.map((c) => ({ id: c.item, label: c.name, right: '×' + c.count }))] : [] };
  }
  function party(e) {
    const said = (why, ok) => { fmsg = why ? WHY[why] || why : ok; };
    if (e.emit === 'class') { bagFrom(); const why = K.switchClass(cfg, R, e.member, e.cls, V()); bagSay(); said(why, memberName(e.member) + ' is now a ' + cfg.classes[e.cls].name + '.'); if (!why) { keep(); __inputQueue.push({ type: 'rpg-class:' + e.member + ':' + e.cls }); } }
    else if (e.emit === 'slot') { fwho = e.member; fslot = e.slot; fmsg = ''; }
    else if (e.emit === 'equip' && fslot && fwho) {
      bagFrom(); const why = e.item === '-' ? K.unequip(cfg, R, fwho, fslot, V()) : K.equip(cfg, R, fwho, e.item, V()); bagSay();
      if (!why) keep(); said(why, '');
      fslot = null;   // (the spec steps back to the slots)
    }
    else if (e.emit === 'learn') { const why = K.buy(cfg, R, e.member, e.skill); said(why, memberName(e.member) + ' learned ' + cfg.skills[e.skill].name + '.'); if (!why) keep(); }
  }
  // ── a shop and an inn (rpg.js shops): opened by a cue's rpg-shop:<id>, its wares bought with the gold into the bag ──
  function openShop(sid) {
    if (mode || busy() || !K.shopOf(cfg, sid)) return;
    mode = 'shop'; shopId = sid; smsg = '';
    screen('rpg-shop');
  }
  function shopModel() {
    const S = K.shopOf(cfg, shopId), gold = V()[cfg.rules.gold] || 0;
    if (!S) return {};
    const tabs = [];
    if (S.wares.length) tabs.push({ label: 'Buy', empty: '—', rows: K.waresOf(cfg, shopId, V()).map((w) => ({ id: w.item, kind: 'buy', label: w.name, right: w.price + ' G', small: w.have ? '×' + w.have : '', disabled: gold < w.price })) });
    if (S.buys) tabs.push({ label: 'Sell', empty: 'Nothing to sell.', rows: K.sellsOf(cfg, shopId, V()).map((w) => ({ id: w.item, kind: 'sell', label: w.name, right: w.price + ' G', small: '×' + w.have })) });
    if (S.inn != null) tabs.push({ label: 'Stay', empty: '—', rows: [{ id: 'inn', kind: 'stay', label: 'A night\'s rest', right: S.inn + ' G', disabled: gold < S.inn }] });
    return { name: S.name, gold, said: smsg, tabs, party: members().map((m) => ({ name: memberName(m), level: R.m[m].level, hp: R.m[m].hp, hpMax: K.statsOf(cfg, R, m).hp })) };
  }
  function deal(e) {
    const ware = (id) => (cfg.items[id] || cfg.gear[id] || {}).name || id;
    const go = (fn, said, ev) => { bagFrom(); const why = fn(); bagSay(); smsg = why ? SHOP_WHY[why] || why : said; if (!why) { keep(); __inputQueue.push({ type: ev }); } };
    if (e.kind === 'buy') go(() => K.purchase(cfg, shopId, e.item, V()), 'Bought ' + ware(e.item) + '.', 'rpg-bought:' + shopId + ':' + e.item);
    else if (e.kind === 'sell') go(() => K.sell(cfg, shopId, e.item, V()), 'Sold ' + ware(e.item) + '.', 'rpg-sold:' + shopId + ':' + e.item);
    else if (e.kind === 'stay') go(() => K.stay(cfg, R, shopId, V()), 'Rested. The party is well.', 'rpg-stayed:' + shopId);
  }

  // ── the host: what mana-ui's screens emit, answered; the screen up kept to the fight's phase and the menus ──
  function answer(e) {
    if (quiet || !e || typeof e.emit !== 'string') return;
    changed();
    if (e.emit === 'mana:closed') { closeField(); return; }
    if (mode === 'battle') {
      if (e.emit === 'next') { if (film && film.long) skipFilm(); else if (phase !== 'command') advance(); }
      else if (phase !== 'command') return;
      else if (e.emit === 'command') command(e.id);
      else if (e.emit === 'skill') toTarget({ act: 'skill', skill: e.id });
      else if (e.emit === 'item') toTarget({ act: 'item', item: e.id });
      else if (e.emit === 'target' && pend) pickNow(Object.assign({}, pend, { target: e.id }));
      else if (e.emit === 'undo') undo();
    } else if (mode === 'field') party(e);
    else if (mode === 'shop' && e.emit === 'deal') deal(e);
    changed();
  }
  // the one screen the state calls for, opened over nothing (its cursor at the top, unless it keeps its place)
  let quiet = false;
  function screen(id, keepPlace) {
    quiet = true;
    try { if (up()) rt.close(); if (id) { rt.open(id); if (!keepPlace) rt.focusAt(0); } } finally { quiet = false; }
    changed();
    face.paint();
  }
  let rt = null;
  rt = M.ui.runtime(M.spec, { read: (p) => M.ui.readPath(vm(), p), act: answer });
  if (M.glyphs) rt.glyphs(M.glyphs);
  const mounted = M.ui.mount(root, rt, {});
  // (the view, held: a fight or a menu holds the world as mana-ui's own hold says the menu has the input)
  const face = { paint: () => { mounted.paint(); if (mode) hold(); } };

  // ── input: the menus are mana-host's (the menu scheme on the keys and every pad); P and a pad's select are play's ──
  window.addEventListener('keydown', (ev) => {
    if (ev.code !== 'KeyP' || ev.repeat) return;
    if (mode === 'field') { ev.preventDefault(); ev.stopImmediatePropagation(); return closeField(); }
    if (!mode) { openField(); if (mode) { ev.preventDefault(); ev.stopImmediatePropagation(); } }
  }, true);
  const input = M.host.connect(rt, face, { keys: ctl.keys, pad: ctl.pad, padLayout: ctl.padLayout, loop: false });
  // (the view, registered: a headset draws its screens on a panel and drives it with the controllers, channels/xr.js)
  (window.__manaViews = window.__manaViews || []).push({ root, rt, css: M.css, host: input });
  let selectWas = false;
  function padSelect() {
    const ps = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let now = false;
    for (let i = 0; i < ps.length; i++) { const g = ps[i]; if (g && g.connected && g.buttons[ctl.select] && g.buttons[ctl.select].pressed) now = true; }
    if (now && !selectWas) { if (mode === 'field') closeField(); else if (!mode) openField(); }
    selectWas = now;
  }

  // (a fight or the party menu holds the world; a fight's own window stands in for the level's HUD while it is up)
  function hold() { window.__mojFreeze = true; window.__mojMenuOpen = true; if (document.body && document.body.classList) document.body.classList[mode === 'battle' ? 'add' : 'remove']('moj-in-battle'); }
  function release() { window.__mojFreeze = false; window.__mojMenuOpen = false; if (document.body && document.body.classList) document.body.classList.remove('moj-in-battle'); }

  // ── the bus, and the walk ──
  // the bus's new events: joins, openings and rests first, then a battle (the bus sorts what arrives together, so a
  // cue's join and its fight may come in either order)
  function listen() {
    const log = __busState.log, fights = [];
    for (let i = seen; i < log.length; i++) {
      const ty = log[i] && log[i].type;
      if (typeof ty !== 'string' || ty.indexOf('rpg-') !== 0) continue;
      if (ty.indexOf('rpg-battle:') === 0) fights.push(ty.slice(11));
      else if (ty === 'rpg-rest') { K.rest(cfg, R, V()); keep(); }
      else if (ty.indexOf('rpg-join:') === 0) { R.joined[ty.slice(9)] = 1; keep(); }
      else if (ty.indexOf('rpg-open:') === 0) { R.opened[ty.slice(9)] = 1; keep(); }
      else if (ty.indexOf('rpg-shop:') === 0) shopAsk = ty.slice(9);
    }
    seen = log.length;
    for (const enc of fights) startBattle(enc);
    if (shopAsk) { openShop(shopAsk); shopAsk = null; }
  }
  function walk() {
    const Rn = cfg.random, w = window.__mojCtrl && window.__mojCtrl.world;
    if (!Rn || !w || mode || window.__mojFreeze || busy()) { lastPos = null; return; }
    const e = (w.pilotId && w.byId[w.pilotId]) || w.entities[0];
    if (!e || !e.transform) return;
    const p = e.transform.pos;
    if (lastPos) {
      const d = Math.hypot(p[0] - lastPos[0], p[1] - lastPos[1]);
      const inZone = !Rn.in.length || Rn.in.some((z) => Math.hypot(p[0] - z.at[0], p[1] - z.at[1]) <= z.r);
      if (d < 5 && inZone) walked += d;
      if (walked >= Rn.after + Rn.every * (rolls + 1)) {
        rolls++;
        const dice = { r: (cfg.seed * 2654435761 + rolls * 40503) >>> 0 };
        const roll = K.roll(dice), set = Rn.sets[Math.floor(K.roll(dice) * Rn.sets.length)];
        if (roll < Rn.chance) { lastPos = null; startBattle({ id: 'random', foes: set }); return; }
      }
    }
    lastPos = [p[0], p[1]];
  }

  function step(t) {
    const now = typeof t === 'number' ? t : 0, dt = lastT ? Math.max(0, Math.min(now - lastT, 1000)) : 0;   // real time: a slow frame still moves the playback on
    lastT = now;
    changed();
    hookCarry();
    listen();
    padSelect();
    walk();
    if (mode === 'battle' && (phase === 'intro' || phase === 'play')) { bt += dt; if (bt >= BEAT + linger) advance(); }
    // the world holds still in a fight, but its moments (a juice's puffs, beams and shakes) play on: their clock runs
    if (mode === 'battle' && W()) W().time = (W().time || 0) + dt / 1000;
    if (mode === 'battle') {
      backdrop1();
      if (phase === 'play') film1(); else if (film) endFilm();
      if (placeDue > 0 && --placeDue === 0 && !placeBoxes()) placeDue = 1;
    }
    // (a number stays up while it rises)
    if (pops.length) pops = pops.filter((p) => now - p.t < POP_FOR);
    input.poll();
    changed();
    if (rt.tick()) mounted.paint();
    if (mode) hold();
  }
  const api = {
    step, R, ui: rt,
    state: () => {
      const top = up(), cmd = mode === 'battle' && phase === 'command', B0 = vm().battle;
      const S0 = mode === 'shop' ? vm().shop : null, T0 = S0 && S0.tabs ? S0.tabs[rt.state().tabs[0] || 0] : null;
      return {
        mode, phase, msg, screen: top, level: cmd ? LEVEL[top] || 'cmd' : null, member: cmd ? commanders()[mi] : null, acting: !!B0.acting, ui: filmUi,
        options: cmd ? (B0[LIST[top]] || []).map((o) => ({ label: o.label, ok: !o.disabled })) : [],
        ...(S0 ? { shop: { id: shopId, tab: T0 ? T0.label : null, rows: (T0 ? T0.rows : []).map((o) => ({ label: o.label, right: o.right, ok: !o.disabled })), said: smsg } } : {}),
      };
    },
    // (a menu action, as the menu scheme names it: up, down, left, right, accept, back, tabNext, tabPrev)
    act: (a) => { if (up()) { rt.press(a); face.paint(); } },
    start: startBattle, advance, open: openField, close: closeField, shop: openShop,
    // (the view a fight is seen from, over the book's: for a preview of the views, the next fight staged in it)
    view: (name) => { viewOver = VIEWS[name] ? name : null; if (mode === 'battle' && staged) { unstage(); stage(); placeDue = 3; } return viewOver; },
  };
  window.__mojRpg = api;
  return api;
}

/**
 * mana-ui on the page for a world's battles: the kernel and mana-host as source, the spec, the glyphs of the menu
 * scheme, and the sheet in the world's theme (cfg.theme, its UI guide lowered; else the console RPG's).
 */
export function rpgMana(cfg) {
  return { spec: rpgUiSpec(), glyphs: manaGlyphs(), css: rpgUiCss(rpgUiTheme(cfg)) };
}

/** The channel's script, inside the events channel: the kernel, the page, its step called each frame (`__stepRpg`). */
export function rpgScript(cfg) {
  const { keys, pad } = manaControls(), M = rpgMana(cfg), json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `
// RPG: party battles over the field, the party menu on P (playscape/rpg); its UI mana-ui's (playscape/rpg/rpg-ui.js)
const __rpg = (${rpgPage.toString()})(EVENTS.rpg, (${buildRpg.toString()})(), { keys: ${json(keys)}, pad: ${json(pad)}, padLayout: (${padLayoutSource()}), select: ${DEVICES.gamepad.buttons.select} }, ${juiceKeys.toString()}, { ui: ${manaUiSource()}, host: ${manaHostSource()}, spec: ${json(M.spec)}, glyphs: ${json(M.glyphs)}, css: ${json(M.css)} });
function __stepRpg(t) { __rpg.step(t); }`;
}
