/**
 * The RPG channel: a world's party battles (playscape/rpg) on the page, riding the events channel (its bus state, its
 * log, its input queue). Emitted inside the events channel only when the events carry `rpg`, so a world without one
 * keeps every byte. The kernel is the node module's own code (buildRpg.toString()), the page below is one function
 * (rpgPage.toString()), so neither has a second copy.
 *
 *   THE BATTLE, in place over the field (the world holds still while it is up): the foes above, the message line, the
 *   command window and the party strip below. Each standing member picks (Attack, Skill, Item, Guard, Flee; a target
 *   with the arrows), then the round plays back beat by beat, a number rising off whoever it lands on. Accept skips
 *   ahead; back steps to the member before.
 *   THE PARTY MENU (P): the members on the left; Status, Class (switch), Skills (the class's tree: buy) on the right.
 *   RANDOM ENCOUNTERS: a roll every `every` metres the pilot walks, in the random zones (or anywhere).
 *
 * It reads the bus's log for `rpg-battle:<encounter>`, `rpg-rest`, `rpg-join:<member>`, `rpg-open:<class>`, and pushes
 * `rpg-won` / `rpg-fled` / `rpg-lost` (alone and `:<encounter>`) as a battle closes. With the party mechanic (the level
 * contract's game.party) the party is loaded from the store's slice as the level starts, and kept there as it changes.
 * Keys: the menu control scheme (arrows / WASD, Enter / Space / E accept, Escape / Backspace back, [ ] tabs; a pad in
 * its printed layout); P or the pad's select opens the party menu. window.__mojRpg drives it headless (a test, the audit).
 */
import { buildRpg } from '../../playscape/rpg/kernel.js';
import { juiceKeys } from '../../playscape/rpg/juice.js';
import { menuControls, padLayoutSource } from './interact-channel.js';
import { DEVICES } from '../../controls/devices.js';

export const RPG_CSS = `
.moj-rpg{position:fixed;inset:0;pointer-events:none;z-index:31;font:14px/1.35 var(--moj-font,system-ui,sans-serif);color:var(--moj-ink,#eef2ff);display:none}
.moj-rpg.on{display:block}
:where(.moj-rpg) .moj-w{background:var(--moj-panel,rgba(14,22,58,.94));border:1px solid var(--moj-line,#c9d3ff);border-radius:8px;padding:8px 12px;pointer-events:auto;box-sizing:border-box}
.moj-rpg-foes{width:230px;flex:none;display:flex;flex-direction:column;gap:3px}
.moj-rpg-foe{position:relative;padding:1px 4px 1px 16px;cursor:pointer}
.moj-rpg-msg{position:absolute;left:50%;top:14px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 32px));padding:5px 16px;text-align:center}
.moj-rpg-foe.down{opacity:.3;text-decoration:line-through}
.moj-rpg-foe .bar,.moj-rpg-row .bar{height:4px;margin-top:3px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden}
.moj-rpg-foe .bar i,.moj-rpg-row .bar i{display:block;height:100%;background:var(--moj-accent,#ffd76a)}
.moj-rpg-turns{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;font-size:11px}.moj-rpg-turns span{padding:1px 6px;border-radius:3px;background:rgba(0,0,0,.35)}.moj-rpg-turns span:first-child{outline:1px solid var(--moj-accent,#ffd76a)}.moj-rpg-turns .f{opacity:.7}
.moj-rpg-bottom{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;justify-content:space-between;gap:10px;width:min(960px,calc(100vw - 24px));align-items:flex-end}
.moj-rpg-cmd{width:230px;flex:none}
.moj-rpg-bottom .moj-rpg-foes{margin-left:auto}
.moj-rpg.placed .moj-rpg-bottom{position:static;transform:none;width:auto;display:block}.moj-rpg.placed .moj-rpg-cmd,.moj-rpg.placed .moj-rpg-foes{position:absolute;margin:0}
.moj-rpg.cmd-tl .moj-rpg-cmd,.moj-rpg.foes-tl .moj-rpg-foes{top:12px;left:12px}.moj-rpg.cmd-tr .moj-rpg-cmd,.moj-rpg.foes-tr .moj-rpg-foes{top:12px;right:12px}
.moj-rpg.cmd-bl .moj-rpg-cmd,.moj-rpg.foes-bl .moj-rpg-foes{bottom:12px;left:12px}.moj-rpg.cmd-br .moj-rpg-cmd,.moj-rpg.foes-br .moj-rpg-foes{bottom:12px;right:12px}
.moj-rpg-heads{position:fixed;inset:0;pointer-events:none;z-index:31;display:none;font:12px/1.25 var(--moj-font,system-ui,sans-serif);color:var(--moj-ink,#eef2ff)}
.moj-rpg-heads.on{display:block}
.moj-rpg-head{position:absolute;transform:translate(-50%,-100%);width:64px;padding:3px 4px;transition:opacity .25s ease,background .25s ease;border-radius:5px;background:var(--moj-panel-a,rgba(14,22,58,.72));pointer-events:auto;cursor:pointer;text-align:center}
.moj-rpg-head .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.moj-rpg-head .bar{height:4px;margin-top:2px;background:rgba(255,255,255,.18);border-radius:2px;overflow:hidden}.moj-rpg-head .bar i{display:block;height:100%;background:var(--moj-hp,#5ccf7e)}
.moj-rpg-head .bar i.lo{background:var(--moj-harm,#ff6b6b)}.moj-rpg-head .bar.mp{height:3px}.moj-rpg-head .bar.mp i{background:var(--moj-mp,#5aa8ff)}
.moj-rpg-head .st{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#ffd76a}
.moj-rpg-head.turn{outline:2px solid var(--moj-accent,#ffd76a)}.moj-rpg-head.turn::before{content:"\\25BC";position:absolute;left:50%;top:-15px;transform:translateX(-50%);color:var(--moj-accent,#ffd76a);font-size:12px}
.moj-rpg-head.aim{outline:2px solid #ff8a5a;box-shadow:0 0 10px rgba(255,138,90,.7)}.moj-rpg-head.aim::after{content:"\\25BC";position:absolute;left:50%;top:-15px;transform:translateX(-50%);color:#ff8a5a}
.moj-rpg-head.down{opacity:.45}.moj-rpg-head.foe{width:24px;min-height:4px;padding:0;background:transparent}.moj-rpg-head.foe.aim{outline:none;box-shadow:none}
.moj-rpg-head.foe.aim::after{top:-6px;font-size:18px;text-shadow:0 0 6px rgba(0,0,0,.8)}
.moj-rpg .opt.set{opacity:1;font-weight:700}
.moj-rpg-head .moj-rpg-pop{top:-18px}
.moj-rpg-bottom{transition:opacity .25s ease}.moj-rpg.acting .moj-rpg-bottom{opacity:0;pointer-events:none}
.moj-rpg-heads.acting .moj-rpg-head{background:transparent;outline:none;box-shadow:none}.moj-rpg-heads.acting .moj-rpg-head::before,.moj-rpg-heads.acting .moj-rpg-head::after{display:none}
.moj-rpg-heads.acting .moj-rpg-head>:not(.moj-rpg-pop){opacity:0;transition:opacity .25s ease}
.moj-rpg-row .bar i.lo{background:var(--moj-harm,#ff6b6b)}
.moj-rpg-party{width:250px;flex:none;display:flex;flex-direction:column;gap:3px}
.moj-rpg-cmd .t,.moj-rpg-field .t{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75;margin-bottom:4px}
.moj-rpg .opt{display:flex;justify-content:space-between;gap:10px;padding:1px 0 1px 16px;position:relative;cursor:pointer}
.moj-rpg .opt.off{opacity:.42}
.moj-rpg .on-f::before{content:"\\25B6";position:absolute;left:0;font-size:11px;top:3px;color:var(--moj-accent,#ffd76a)}
.moj-rpg-row{padding:2px 4px 2px 16px;position:relative}
.moj-rpg-row .n{display:flex;justify-content:space-between;gap:8px}.moj-rpg-row .n small{opacity:.8;font-size:11px;font-variant-numeric:tabular-nums}
.moj-rpg-row .bar i{background:var(--moj-hp,#5ccf7e)}.moj-rpg-row .mp{height:3px;margin-top:2px}.moj-rpg-row .mp i{background:var(--moj-mp,#5aa8ff)}
body.moj-in-battle .moj-hud:not(.moj-rpg){display:none}
.moj-rpg.cine-none .moj-rpg-msg,.moj-rpg-heads.cine-none{display:none}
.moj-rpg.cine-all.acting .moj-rpg-bottom{opacity:1}.moj-rpg-heads.cine-all.acting .moj-rpg-head>*{opacity:1}
.moj-rpg-skip{position:absolute;right:16px;top:14px;padding:4px 10px;font-size:12px;opacity:.85;cursor:pointer}
.moj-rpg-row.act{background:rgba(255,255,255,.08);border-radius:4px}
.moj-rpg-row.down{color:#ff8a8a}
.moj-rpg-row .n small,.moj-rpg-field small{opacity:.7;font-size:11px;margin-left:5px}
.moj-rpg-row .v{font-variant-numeric:tabular-nums;text-align:right}
.moj-rpg-pop{position:absolute;left:50%;top:-4px;transform:translateX(-50%);font-weight:800;font-size:18px;text-shadow:0 1px 2px #000,0 0 6px #000;pointer-events:none;animation:moj-rpg-pop .9s ease-out forwards}
.moj-rpg-pop.heal{color:#7dffa5}.moj-rpg-pop.miss{color:#c9c9c9;font-size:14px}
.moj-rpg-pop.small{font-size:13px;opacity:.85}.moj-rpg-pop.big{font-size:24px}.moj-rpg-pop.crit{font-size:28px;color:#ffe07a}
.moj-rpg-flash{position:fixed;inset:0;pointer-events:none;z-index:32;opacity:0}
.moj-rpg .jolt,.moj-rpg.jolt{animation:moj-rpg-jolt .28s linear}
@keyframes moj-rpg-jolt{0%,100%{transform:translateX(0)}20%{transform:translateX(calc(var(--k,1) * -6px))}40%{transform:translateX(calc(var(--k,1) * 5px))}60%{transform:translateX(calc(var(--k,1) * -3px))}80%{transform:translateX(calc(var(--k,1) * 2px))}}
@keyframes moj-rpg-pop{0%{opacity:0;margin-top:6px}15%{opacity:1}100%{opacity:0;margin-top:-26px}}
.moj-rpg-field{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(680px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;display:flex;gap:12px}
.moj-rpg-field .mem{width:200px;flex:none}
.moj-rpg-field .pane{flex:1;min-width:0}
.moj-rpg-field .tabs{display:flex;gap:4px;margin-bottom:8px}
.moj-rpg-field .tab{padding:2px 10px;border:1px solid var(--moj-line,#c9d3ff);border-radius:999px;font-size:12px;opacity:.65;cursor:pointer}
.moj-rpg-field .tab.sel{opacity:1;background:var(--moj-accent,#ffd76a);color:var(--moj-panel,#0e163a);border-color:var(--moj-accent,#ffd76a)}
.moj-rpg-field table{border-collapse:collapse;font-size:13px}.moj-rpg-field td{padding:1px 10px 1px 0}
.moj-rpg-field .note{font-size:12px;opacity:.75;margin-top:6px}
@media (max-width:560px){.moj-rpg-bottom{flex-direction:column;align-items:stretch}.moj-rpg-foes,.moj-rpg-party{width:auto}.moj-rpg-cmd{width:auto;right:0}.moj-rpg-field{flex-direction:column}.moj-rpg-field .mem{width:auto}}
`;

// (:where keeps the defaults below the world's UI guide: its register and border rules, .moj-hud .moj-w, win)

/**
 * The page: run in the events channel's scope (it reads __busState, __inputQueue). cfg: EVENTS.rpg; K: the kernel.
 * → { step(t), … } the frame's step, and the handles window.__mojRpg exposes.
 */
export function rpgPage(cfg, K, ctl, jk) {
  const R = K.init(cfg), V = () => __busState.vars;
  K.mirror(cfg, R, V());
  const st = document.createElement('style'); st.textContent = RPG_CSS_TEXT; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-hud moj-rpg'; document.body.appendChild(root);
  // (the bars over the fighters' heads: each member's name, HP, MP, statuses and turn; the pack's aimed foe and the numbers
  // that land on it; pinned to their figures every frame by the scene's projection)
  const heads = document.createElement('div'); heads.className = 'moj-rpg-heads'; document.body.appendChild(heads);
  const flashEl = document.createElement('div'); flashEl.className = 'moj-rpg-flash'; document.body.appendChild(flashEl);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CMD = { attack: 'Attack', skill: 'Skill', item: 'Item', guard: 'Guard', flee: 'Flee' };
  const WHY = { battle: 'Not during a fight.', rules: 'Classes are fixed here.', same: 'Already that class.', locked: 'That class is not open yet.', member: 'Not a class they can take.', sp: 'Not enough class points.', requires: 'Learn what it builds on first.', learned: 'Already learned.', class: 'Take that class first.', unknown: '' };
  const BEAT = 650;
  // how long each act plays (seconds), within a beat
  const ACT_FOR = { strike: 0.55, cast: 0.55, hurt: 0.4, fall: 0.6 };
  // mode: null | 'battle' | 'field'; the battle's own phase: intro | command | play | end
  let mode = null, phase = null, beats = [], bi = 0, bt = 0, shown = {}, msg = '', picks = {}, mi = 0, level = 'cmd', f = 0, pend = null, pops = [], dirty = true;
  let fm = 0, ftab = 0, flevel = 'members', ff = 0, fmsg = '', seen = 0, walked = 0, lastPos = null, rolls = 0, lastT = 0;
  const TABS = ['Status', 'Class', 'Equip', 'Skills'], SLOT = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' };
  let fslot = null;   // the Equip tab's slot being chosen for
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
      carry.sent = K.save(cfg, R); dirty = true;
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
  let linger = 0, popStyle = null, jolts = {};
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
      if (s.jolt === 'window') { root.style.setProperty('--k', s.k || 1); root.classList.remove('jolt'); void root.offsetWidth; root.classList.add('jolt'); }
      else if (who != null) jolts[who] = s.k || 1;
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
    mode = 'battle'; phase = 'intro'; beats = out; bi = 0; bt = 0; shown = {}; picks = {}; mi = 0; level = 'cmd'; f = 0; pend = null;
    msg = out[0].text; show(out[0]); dirty = true;
    stage(); placeDue = 3;
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
      const V = VIEWS[viewOver || (cfg.rules && cfg.rules.view)] || VIEWS.side;
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
    }
  }
  function unstage() {
    const w = W();
    if (!w || !staged) { staged = null; return; }
    for (const id in staged.at) { const e = w.byId[id], s = staged.at[id]; if (e) { e.transform.pos = s.pos; e.transform.heading = s.heading; e.staged = false; } }
    const C = w.camera, s = staged.cam;
    if (C && s) { C.transform.pos = s.pos; C.transform.heading = s.heading; C.transform.pitch = s.pitch; C.lookAt = s.lookAt; C.rule = s.rule; }
    staged = null;
  }
  function pickNow(pick) {
    const ids = commanders(), m = ids[mi];
    picks[m] = pick;
    if (pick.act === 'flee') return resolve();
    mi++; level = 'cmd'; f = 0; pend = null;
    if (mi >= ids.length) return resolve();
    dirty = true;
  }
  function resolve() {
    // the round is played back from where it began: each beat moves the numbers it names, nothing else jumps ahead
    const before = {};
    for (const x of R.b.foes) before[x.uid] = x.hp;
    for (const m of R.b.ids) { before[m] = R.m[m].hp; before[m + ':mp'] = R.m[m].mp; }
    const out = K.round(cfg, R, picks, V());
    picks = {}; mi = 0; level = 'cmd'; f = 0; pend = null;
    beats = out; bi = 0; bt = 0; phase = 'play'; shown = before;
    if (out.length) { msg = out[0].text; show(out[0]); }
    dirty = true;
  }
  function note(b) { if (b && b.target != null && b.hp != null) shown[b.target] = b.hp; if (b && b.who != null && b.mp != null) shown[b.who + ':mp'] = b.mp; }
  function pop(b) {
    if (!b || b.target == null) return;
    const txt = b.kind === 'miss' ? 'miss' : b.kind === 'hurt' ? String(b.amount) : b.kind === 'heal' && b.amount ? '+' + b.amount : '';
    if (txt) pops.push({ at: b.target, txt, cls: (b.kind === 'heal' ? 'heal' : b.kind === 'miss' ? 'miss' : '') + (popStyle && popStyle.pop !== 'normal' ? ' ' + popStyle.pop : ''), color: popStyle && popStyle.color });
  }
  function advance() {
    if (phase === 'intro') { phase = 'command'; msg = ''; dirty = true; if (!commanders().length) resolve(); return; }
    if (phase === 'play') {
      bi++; bt = 0;
      if (bi < beats.length) { msg = beats[bi].text; show(beats[bi]); dirty = true; return; }
      shown = {};
      if (R.b.phase === 'command') { phase = 'command'; msg = ''; if (!commanders().length) return resolve(); }
      else phase = 'end';
      dirty = true; return;
    }
    if (phase === 'end') {
      const ev = K.close(cfg, R, V());
      keep(); bagSay();
      for (const e of ev) __inputQueue.push(e);
      mode = null; phase = null; root.classList.remove('on'); root.innerHTML = '';
      { const w = W(); if (w) for (const e of w.entities) if (e.act) e.act = null; }   // the fight's acts end with it
      unstage();
      root.classList.remove('placed'); for (const c of CORNERS) { root.classList.remove('cmd-' + c); root.classList.remove('foes-' + c); }
      release(); dirty = true;
    }
  }
  function cmdList() {
    const ids = commanders(), m = ids[mi], o = K.options(cfg, R, m, V());
    if (level === 'cmd') return o.commands.map((c) => ({ label: CMD[c.id], ok: c.ok, go: () => {
      if (c.id === 'guard' || c.id === 'flee') return pickNow({ act: c.id });
      if (c.id === 'attack') return toTarget({ act: 'attack' });
      level = c.id; f = 0; dirty = true;
    } }));
    if (level === 'skill') return o.skills.map((s) => ({ label: s.name, right: s.mp ? s.mp + ' MP' : '', ok: s.ok, go: () => toTarget({ act: 'skill', skill: s.id }) }));
    if (level === 'item') return o.items.map((it) => ({ label: it.name, right: '×' + it.count, ok: true, go: () => toTarget({ act: 'item', item: it.id }) }));
    return K.targets(cfg, R, pend).map((t) => ({ label: t.name, ok: true, target: t.id, go: () => pickNow(Object.assign({}, pend, { target: t.id })) }));
  }
  function toTarget(pick) {
    const ts = K.targets(cfg, R, pick);
    if (!ts.length) { const aim = K.aimOf(cfg, pick); return pickNow(Object.assign({}, pick, { target: aim === 'self' ? commanders()[mi] : null })); }
    pend = pick; level = 'target'; f = 0; dirty = true;
  }
  function back() {
    if (level === 'target') { level = pend.act === 'attack' ? 'cmd' : pend.act; f = 0; pend = null; }
    else if (level !== 'cmd') { level = 'cmd'; f = 0; }
    else if (mi > 0) { mi--; delete picks[commanders()[mi]]; f = 0; }
    dirty = true;
  }

  // (the banner across the top tells an action's name or a status, never a number: a blow's lands over whoever takes it)
  const TOLD = ['start', 'cast', 'status', 'ko', 'level', 'learn', 'spoils', 'end'];
  function drawBattle() {
    const b = R.b, L = phase === 'command' ? cmdList() : [];
    if (phase === 'command') f = Math.max(0, Math.min(f, L.length - 1));
    const aimAt = phase === 'command' && level === 'target' && L[f] ? L[f].target : null, active = phase === 'command' ? commanders()[mi] : null;
    // (the command menu in the lower-left corner while a member picks; the foes' box at the lower right)
    let h = '<div class="moj-rpg-bottom">';
    if (phase === 'command') {
      // (choosing a target, the menu stays on the list the action came from, the action set; the target is chosen where
      // it stands: in the foes' box, or over an ally's head)
      const aiming = level === 'target' && pend, from = aiming ? (pend.act === 'attack' ? 'cmd' : pend.act) : level;
      let M = L, at = f;
      if (aiming) {
        const was = level; level = from; M = cmdList(); level = was;
        const named = pend.act === 'attack' ? CMD.attack : pend.act === 'skill' ? (cfg.skills[pend.skill] || {}).name : pend.act === 'item' ? (cfg.items[pend.item] || {}).name : null;
        at = M.findIndex((o) => o.label === named);
      }
      h += '<div class="moj-w moj-rpg-cmd"><div class="t">' + esc(memberName(active)) + (from !== 'cmd' ? ' · ' + CMD[from] : '') + '</div>';
      M.forEach((o, i) => { h += '<div class="opt' + (o.ok ? '' : ' off') + (i === at ? ' on-f' + (aiming ? ' set' : '') : '') + '"' + (aiming ? '' : ' data-i="' + i + '"') + '><span>' + esc(o.label) + '</span><span>' + esc(o.right || '') + '</span></div>'; });
      if (!M.length) h += '<div class="opt off">—</div>';
      h += '</div>';
    }
    h += '<div class="moj-w moj-rpg-foes">';
    if (b) b.foes.forEach((x) => {
      const hp = shown[x.uid] != null ? shown[x.uid] : x.hp;
      h += '<div class="moj-rpg-foe' + (hp <= 0 ? ' down' : '') + (aimAt === x.uid ? ' on-f' : '') + joltOf(x.uid) + '" data-aim="' + x.uid + '">' + esc(x.name) + (cfg.rules.foeHp === 'bar' ? '<div class="bar"><i style="width:' + Math.round(100 * Math.max(0, hp) / x.max) + '%"></i></div>' : '') + '</div>';
    });
    const next = K.preview(cfg, R, 6);
    if (next.length) h += '<div class="moj-rpg-turns">' + next.map((x) => '<span class="' + (x.party ? 'p' : 'f') + '">' + esc(x.name) + '</span>').join('') + '</div>';
    const beat = phase === 'intro' || phase === 'play' ? beats[bi] : null, told = beat && msg && TOLD.includes(beat.kind);
    root.innerHTML = h + '</div></div>' + (told ? '<div class="moj-w moj-rpg-msg">' + esc(msg) + '</div>' : '') + (film && film.long ? '<div class="moj-w moj-rpg-skip" data-skip="1">Skip ▸ Enter</div>' : '');
    drawHeads(aimAt, active);
    pops = []; jolts = {};
  }
  // the heads: one over each member's figure (members who share one, the pilot's, stacked), and one over the pack's
  // figure while a foe is aimed at or a number lands on it
  function drawHeads(aimAt, active) {
    const b = R.b, w = W(), pct = (v, of) => Math.round(100 * Math.max(0, v) / Math.max(1, of));
    if (!b || !w) { heads.innerHTML = ''; return; }
    let h = '';
    const stack = {};
    for (const m of b.ids) {
      const fig = figureOf(m); if (!fig) continue;
      const M = R.m[m], S = K.statsOf(cfg, R, m), hp = shown[m] != null ? shown[m] : M.hp, mp = shown[m + ':mp'] != null ? shown[m + ':mp'] : M.mp, st = b.side[m].st;
      const tags = [M.poison ? 'poison' : '', st.sleep ? 'asleep' : '', st.silence ? 'silenced' : ''].filter(Boolean).join(' · ');
      const k = stack[fig] = (stack[fig] || 0) + 1;
      h += '<div class="moj-rpg-head' + (m === active ? ' turn' : '') + (aimAt === m ? ' aim' : '') + (hp <= 0 ? ' down' : '') + joltOf(m) + '" data-fig="' + fig + '" data-k="' + (k - 1) + '" data-aim="' + m + '" title="' + esc(memberName(m)) + '">'
        + (tags ? '<div class="st">' + tags + '</div>' : '') + '<div class="bar"><i' + (hp * 4 <= S.hp ? ' class="lo"' : '') + ' style="width:' + pct(hp, S.hp) + '%"></i></div>'
        + (S.mp > 0 ? '<div class="bar mp"><i style="width:' + pct(mp, S.mp) + '%"></i></div>' : '') + popsFor(m) + '</div>';
    }
    // (over each foe's figure, or the pack's one: the marker where it is aimed at, the numbers that land on it)
    const byFig = {};
    for (const x of b.foes) { const ff = figureOf(x.uid); if (!ff) continue; const g = byFig[ff] || (byFig[ff] = { aim: null, pops: '' }); if (aimAt === x.uid) g.aim = x.uid; g.pops += popsFor(x.uid); }
    for (const ff in byFig) { const g = byFig[ff]; if (g.aim || g.pops) h += '<div class="moj-rpg-head foe' + (g.aim ? ' aim' : '') + '" data-fig="' + ff + '" data-k="0"' + (g.aim ? ' data-aim="' + g.aim + '"' : '') + '>' + g.pops + '</div>'; }
    heads.innerHTML = h;
  }
  // THE BOXES PLACED BY THE VIEW: once a fight is staged (and when its view changes), where its fighters stand on the
  // screen is measured by the scene's projection, and the command menu and the foes' box take the two corners that cover
  // the party least (the foes' figures next); the banner keeps the top's middle
  let placeDue = 0;
  const CORNERS = ['bl', 'br', 'tl', 'tr'], BOX = { cmd: [230, 160], foes: [230, 96] };
  function placeBoxes() {
    const w = W(), proj = window.__mojCtrl && window.__mojCtrl.project, b = R.b;
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
    for (const c of CORNERS) { root.classList.remove('cmd-' + c); root.classList.remove('foes-' + c); }
    root.classList.add('placed'); root.classList.add('cmd-' + best.c); root.classList.add('foes-' + best.f);
    return true;
  }
  // every frame: each head over its figure's head, by the scene's projection (hidden behind the eye)
  function placeHeads() {
    const w = W(), proj = window.__mojCtrl && window.__mojCtrl.project;
    if (!w || !proj) return;
    for (const el of heads.children) {
      const e = w.byId[el.getAttribute('data-fig')];
      if (!e || !e.transform) { el.style.display = 'none'; continue; }
      const top = (e.rule && e.rule.collideHeight) || 1.8, p = proj(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] - ((e.rule && e.rule.eye) || 0) + top + 0.12);
      if (!(p[2] < 1)) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.left = Math.round(p[0]) + 'px'; el.style.top = Math.round(p[1] - 44 * Number(el.getAttribute('data-k') || 0)) + 'px';
    }
    // (two heads that meet on the screen: the later lifted clear of the earlier, so no name sits under another's)
    const shown = [...heads.children].filter((el) => el.style.display !== 'none').map((el) => ({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth || 84, h: el.offsetHeight || 34 })).sort((a, b) => b.y - a.y);
    for (let i = 0; i < shown.length; i++) for (let j = 0; j < i; j++) {
      const a = shown[i], c = shown[j];
      if (Math.abs(a.x - c.x) < (a.w + c.w) / 2 + 2 && Math.abs(a.y - c.y) < Math.max(a.h, c.h) + 2) { a.y = c.y - Math.max(a.h, c.h) - 3; a.el.style.top = Math.round(a.y) + 'px'; }
    }
  }
  function popsFor(id) { return pops.filter((p) => p.at === id).map((p) => '<span class="moj-rpg-pop ' + p.cls + '"' + (p.color ? ' style="color:' + esc(p.color) + '"' : '') + '>' + esc(p.txt) + '</span>').join(''); }
  // a row's jolt, drawn once with the beat that asked for it
  const joltOf = (id) => (jolts[id] ? ' jolt" style="--k:' + jolts[id] : '');

  // ── the party menu ──
  function openField() {
    if (mode || busy()) return;
    mode = 'field'; flevel = 'members'; ff = 0; fmsg = ''; dirty = true;
  }
  function closeField() { mode = null; root.classList.remove('on'); root.innerHTML = ''; release(); }
  const members = () => K.partyOf(cfg, R, V());
  function fieldRows() {
    const id = members()[fm];
    if (!id) return [];
    if (TABS[ftab] === 'Class') return K.classesOf(cfg, R, id, V()).map((c) => ({ label: c.name, right: c.current ? 'current' : !c.open ? 'locked' : c.rank ? 'rank ' + c.rank : 'new', ok: c.open && !c.current, go: () => { bagFrom(); const why = K.switchClass(cfg, R, id, c.id, V()); bagSay(); fmsg = why ? WHY[why] || why : memberName(id) + ' is now a ' + c.name + '.'; if (!why) { keep(); __inputQueue.push({ type: 'rpg-class:' + id + ':' + c.id }); } } }));
    if (TABS[ftab] === 'Equip') {
      const G = K.gearOf(cfg, R, id, V());
      if (!fslot) return G.map((g) => ({ label: SLOT[g.slot], right: g.name || '—', ok: true, go: () => { fslot = g.slot; ff = 0; } }));
      const g = G.find((x) => x.slot === fslot);
      const wear = (fn) => () => { bagFrom(); const why = fn(); bagSay(); if (!why) keep(); fmsg = why ? WHY[why] || why : ''; fslot = null; ff = 0; };
      return [{ label: '—', right: '', ok: !!g.item, go: wear(() => K.unequip(cfg, R, id, fslot, V())) }, ...g.can.map((c) => ({ label: c.name, right: '×' + c.count, ok: true, go: wear(() => K.equip(cfg, R, id, c.item, V())) }))];
    }
    if (TABS[ftab] === 'Skills') return K.treeOf(cfg, R, id).map((e) => ({
      label: e.name, ok: e.state === 'buy', dim: e.state === 'locked' || e.state === 'later',
      right: e.state === 'learned' ? '✓' : e.state === 'buy' ? e.cost + ' CP' : e.state === 'later' ? 'rank ' + e.at : e.why === 'requires' ? 'needs ' + e.need.map((n) => cfg.skills[n].name).join(', ') : e.cost + ' CP',
      go: () => { const why = K.buy(cfg, R, id, e.skill); fmsg = why ? WHY[why] || why : memberName(id) + ' learned ' + e.name + '.'; if (!why) keep(); },
    }));
    return [];
  }
  function drawField() {
    const ids = members(), id = ids[fm], M = R.m[id];
    let h = '<div class="moj-w moj-rpg-field"><div class="mem"><div class="t">Party</div>';
    ids.forEach((m, i) => { const S = K.statsOf(cfg, R, m); h += '<div class="opt' + (i === fm && flevel === 'members' ? ' on-f' : '') + '" data-m="' + i + '"><span>' + esc(memberName(m)) + '<small>Lv ' + R.m[m].level + '</small></span><span>' + R.m[m].hp + '/' + S.hp + '</span></div>'; });
    h += '<div class="note">Gold ' + (V()[cfg.rules.gold] || 0) + '</div></div><div class="pane"><div class="tabs">';
    TABS.forEach((t, i) => { h += '<span class="tab' + (i === ftab ? ' sel' : '') + '" data-tab="' + i + '">' + t + '</span>'; });
    h += '</div>';
    if (M) {
      const S = K.statsOf(cfg, R, id), C = cfg.classes[M.cls], cl = M.cl[M.cls], next = M.level < cfg.rules.cap ? K.xpFor(cfg, M.level + 1) - M.xp : 0;
      if (TABS[ftab] === 'Status') {
        h += '<div class="t">' + esc(memberName(id)) + ' · ' + esc(C.name) + ' rank ' + cl.lv + '</div><table>';
        h += '<tr><td>Level</td><td>' + M.level + '</td><td>Next</td><td>' + next + ' XP</td></tr><tr><td>HP</td><td>' + M.hp + '/' + S.hp + '</td><td>MP</td><td>' + M.mp + '/' + S.mp + '</td></tr>';
        h += '<tr><td>Attack</td><td>' + S.atk + '</td><td>Defence</td><td>' + S.def + '</td></tr><tr><td>Magic</td><td>' + S.mag + '</td><td>Speed</td><td>' + S.spd + '</td></tr><tr><td>Class pts</td><td>' + cl.sp + '</td><td>' + (M.poison ? 'Poisoned' : '') + '</td><td></td></tr></table>';
        h += '<div class="note">' + (K.usable(cfg, R, id).map((s) => esc(cfg.skills[s].name)).join(', ') || '—') + '</div>';
        h += '<div class="note">' + (Object.values(M.gear).map((g) => esc(cfg.gear[g].name)).join(', ') || '—') + '</div>';
      } else {
        const rows = fieldRows();
        ff = Math.max(0, Math.min(ff, rows.length - 1));
        if (TABS[ftab] === 'Skills') h += '<div class="t">' + esc(C.name) + ' · ' + cl.sp + ' CP</div>';
        if (TABS[ftab] === 'Equip' && fslot) h += '<div class="t">' + SLOT[fslot] + '</div>';
        rows.forEach((o, i) => { h += '<div class="opt' + ((o.dim != null ? o.dim : !o.ok) ? ' off' : '') + (flevel === 'list' && i === ff ? ' on-f' : '') + '" data-i="' + i + '"><span>' + esc(o.label) + '</span><span>' + esc(o.right) + '</span></div>'; });
      }
    }
    h += (fmsg ? '<div class="note">' + esc(fmsg) + '</div>' : '') + '</div></div>';
    root.innerHTML = h;
  }

  // ── input ──
  // the menu control scheme (controls/schemes.js menu), the same keys and pad roles every menu answers to
  const KEYS = (ctl && ctl.keys) || {};
  function act(a) {
    if (a === 'tabNext' || a === 'tabPrev') { if (mode !== 'field') return; a = a === 'tabNext' ? 'right' : 'left'; }
    if (mode === 'battle') {
      if (phase !== 'command') { if (a === 'accept') { if (film && film.long) skipFilm(); else advance(); } return; }
      const L = cmdList(), n = L.length;
      if (a === 'up' && n) f = (f + n - 1) % n;
      else if (a === 'down' && n) f = (f + 1) % n;
      else if (a === 'accept' && L[f] && L[f].ok) L[f].go();
      else if (a === 'back') back();
      dirty = true; return;
    }
    if (mode === 'field') {
      const n = members().length, rows = fieldRows();
      if (flevel === 'members') {
        if (a === 'up' && n) fm = (fm + n - 1) % n;
        else if (a === 'down' && n) fm = (fm + 1) % n;
        else if (a === 'left') ftab = (ftab + TABS.length - 1) % TABS.length;
        else if (a === 'right') ftab = (ftab + 1) % TABS.length;
        else if (a === 'accept' && ftab > 0 && rows.length) { flevel = 'list'; ff = 0; fslot = null; }
        else if (a === 'back') return closeField();
      } else {
        if (a === 'up' && rows.length) ff = (ff + rows.length - 1) % rows.length;
        else if (a === 'down' && rows.length) ff = (ff + 1) % rows.length;
        else if (a === 'accept' && rows[ff]) { if (rows[ff].ok) rows[ff].go(); else fmsg = ''; }
        else if (fslot && (a === 'back' || a === 'left' || a === 'right')) { if (a === 'back') { fslot = null; ff = 0; } }
        else if (a === 'back' || a === 'left' || a === 'right') { flevel = 'members'; if (a !== 'back') ftab = (ftab + (a === 'right' ? 1 : TABS.length - 1)) % TABS.length; }
      }
      fmsg = a === 'accept' ? fmsg : '';
      dirty = true;
    }
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyP' && !ev.repeat) {
      if (mode === 'field') { ev.preventDefault(); ev.stopImmediatePropagation(); return closeField(); }
      if (!mode) { openField(); if (mode) { ev.preventDefault(); ev.stopImmediatePropagation(); } return; }
    }
    if (!mode) return;
    const a = KEYS[ev.code];
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (a && !ev.repeat) act(a);
  }, true);
  heads.addEventListener('click', (ev) => {
    const aim = ev.target.closest('[data-aim]');
    if (mode === 'battle' && phase === 'command' && level === 'target' && aim) { const L = cmdList(), i = L.findIndex((x) => x.target === aim.getAttribute('data-aim')); if (i >= 0) { f = i; act('accept'); } }
  });
  root.addEventListener('click', (ev) => {
    if (!mode) return;
    const o = ev.target.closest('[data-i]'), t = ev.target.closest('[data-tab]'), m = ev.target.closest('[data-m]'), aim = ev.target.closest('[data-aim]');
    if (mode === 'battle') {
      if (ev.target.closest('[data-skip]')) return skipFilm();
      if (phase !== 'command') return advance();
      if (o) { f = Number(o.getAttribute('data-i')); act('accept'); return; }
      if (aim && level === 'target') { const L = cmdList(), i = L.findIndex((x) => x.target === aim.getAttribute('data-aim')); if (i >= 0) { f = i; act('accept'); } }
      return;
    }
    if (t) { ftab = Number(t.getAttribute('data-tab')); flevel = 'members'; fslot = null; dirty = true; return; }
    if (m) { fm = Number(m.getAttribute('data-m')); flevel = 'members'; fslot = null; dirty = true; return; }
    if (o) { ff = Number(o.getAttribute('data-i')); flevel = 'list'; act('accept'); }
  });

  // the pad: the first connected one, read in its own printed layout; an action fires on the press edge, and its
  // select button opens and closes the party menu
  let padPrev = {};
  function padNow() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : [], now = {};
    let g = null;
    for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { g = ps[i]; break; }
    if (!g || !ctl) return now;
    const P = ctl.pad[ctl.layout(g.id)] || ctl.pad.xbox || {};
    for (const i in P.b || {}) { const b = g.buttons[i]; if (b && (b.pressed || b.value > 0.5)) now[P.b[i]] = 1; }
    for (const [ax, sg, a] of P.a || []) if ((g.axes[ax] || 0) * sg > 0.6) now[a] = 1;
    const sb = g.buttons[ctl.select];
    if (sb && sb.pressed) now.party = 1;
    return now;
  }
  function pad() {
    const now = padNow();
    for (const a in now) if (!padPrev[a]) {
      if (a === 'party') { if (mode === 'field') closeField(); else if (!mode) openField(); }
      else if (mode) act(a);
    }
    padPrev = now;
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
    }
    seen = log.length;
    for (const enc of fights) startBattle(enc);
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
    hookCarry();
    listen();
    if (typeof navigator !== 'undefined') pad();
    walk();
    if (mode === 'battle' && (phase === 'intro' || phase === 'play')) { bt += dt; if (bt >= BEAT + linger) advance(); }
    // the world holds still in a fight, but its moments (a juice's puffs, beams and shakes) play on: their clock runs
    if (mode === 'battle' && W()) W().time = (W().time || 0) + dt / 1000;
    if (mode) { hold(); root.classList.add('on'); }
    if (mode && (dirty || pops.length)) { if (mode === 'battle') drawBattle(); else drawField(); dirty = false; }
    if (mode === 'battle') {
      if (phase === 'play') film1(); else if (film) endFilm();
      for (const lv of ['none', 'numbers', 'all']) { root.classList[filmUi === lv ? 'add' : 'remove']('cine-' + lv); heads.classList[filmUi === lv ? 'add' : 'remove']('cine-' + lv); }
      heads.classList.add('on'); placeHeads();
      if (placeDue > 0 && --placeDue === 0 && !placeBoxes()) placeDue = 1;
      // (a round playing out: the window and the bars step aside for the bodies' acts, back for the next pick)
      const acting = phase === 'play'; root.classList[acting ? 'add' : 'remove']('acting'); heads.classList[acting ? 'add' : 'remove']('acting');
    } else if (heads.innerHTML) { heads.classList.remove('on'); heads.innerHTML = ''; }
  }
  const api = {
    step, R,
    state: () => ({ mode, phase, msg, level, member: mode === 'battle' && phase === 'command' ? commanders()[mi] : null, options: mode === 'battle' && phase === 'command' ? cmdList().map((o) => ({ label: o.label, ok: o.ok })) : [] }),
    start: startBattle, act, advance, open: openField, close: () => (mode === 'field' ? closeField() : null),
    // (the view a fight is seen from, over the book's: for a preview of the views, the next fight staged in it)
    view: (name) => { viewOver = VIEWS[name] ? name : null; if (mode === 'battle' && staged) { unstage(); stage(); placeDue = 3; dirty = true; } return viewOver; },
  };
  window.__mojRpg = api;
  return api;
}

/** The channel's script, inside the events channel: the kernel, the page, its step called each frame (`__stepRpg`). */
export function rpgScript() {
  const { keys, pad } = menuControls();
  return `
// RPG: party battles over the field, the party menu on P (playscape/rpg)
const RPG_CSS_TEXT = ${JSON.stringify(RPG_CSS)};
const __rpg = (${rpgPage.toString()})(EVENTS.rpg, (${buildRpg.toString()})(), { keys: ${JSON.stringify(keys)}, pad: ${JSON.stringify(pad)}, layout: ${padLayoutSource()}, select: ${DEVICES.gamepad.buttons.select} }, ${juiceKeys.toString()});
function __stepRpg(t) { __rpg.step(t); }`;
}
