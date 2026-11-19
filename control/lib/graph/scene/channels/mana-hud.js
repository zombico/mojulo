/**
 * THE HUD HOST — a level page's in-play HUD on mana-ui (docs/mana-ui.md): one runtime over a state object the page
 * writes each frame, drawn over the scene. What the HUD is (its spec, its theme, what it reads) is the level's own
 * (`manaHud`, written by whoever lays the level: a course's is gameworld/course-hud.js); this channel only hosts it.
 * A level without one carries not a byte of this.
 *
 *   manaHudScript({ spec, theme, feed }, { game? }) → the page's script ('' for none); `game`: the page is a game's
 *     level, so the HUD begins when the game's channel starts (the shell's params in hand)
 *     spec    a mana-ui spec: { hud, screens? } (a screen named `ready` is the start cue: while it is up the pilot's
 *             input is held, the controllable channel's own rule for any screen)
 *     (`touch`: the level is made for a screen and its pilot is steered by a virtual pad: the HUD carries the pad)
 *     theme   a mana-ui theme (a preset's name or a theme object, resolved by the level's author)
 *             or, for a level whose HUD is its own widget rows (`events.hud`): { rows: 'events', theme } and the rows
 *             handed in (`rows`, `register`): lowered by game/hud-mana.js to a spec and the feed below
 *     feed    { rows: { vars, gates, banners, toasts, lines }, hero } a level's rows off its bus (v.<k>, on.<k>,
 *             lines.<k>, moments) and the pilot's own gauges (hero.hp, hero.stamina); and/or, a course's: { kind: 'course', from, to, cue?: { beats, every, go, sub? },
 *             hint?: { seconds }, stamina? } (the pilot's place along +y from `from` to `to`)
 *
 * The state it writes (a spec binds these): course { metres, of, left, says } · run { show, at, of } (the shell's
 * `params.__run`) · hero { stamina, staminaMax, sprints } · coins { count } (the bus's `coins`) · start { count, sub } · hint { show } · moments [].
 * It reads no device: a HUD is seen. A part that is pressed (a level's button row, tapped or clicked) raises its event on
 * the level's bus (`window.__mojBus.press`, there only for a level with such a row). The page's own gauge and its widget rows are hidden while this stands (by a rule
 * on its class: the runtime that draws it is untouched). `window.__mojHud = { rt, state }` for a headless driver.
 */
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { hudToMana } from '../../game/hud-mana.js';
import { hudSubst, fmtDelta } from '../../game/hud-widgets.js';
import { manaControls, manaHostSource } from '../../controls/mana-controls.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export function manaHudScript(hud, { game = false, rows = null, register = null, touch = false } = {}) {
  // (a level whose HUD is its own rows, `rows: 'events'`: lowered here, where the page emits them, game/hud-mana.js)
  if (hud && hud.rows === 'events' && !hud.spec) { const L = hudToMana(rows, { register, hero: hud.hero !== false, touch }); hud = { ...hud, spec: L.spec, feed: { ...L.feed, ...(hud.feed ?? {}) } }; }
  if (!hud || !hud.spec) return '';
  // (a HUD of the level's own making, a course's: the level's buttons for a touch screen alone, game/screen-keys.js, are
  // drawn by it too, since the page's own widget rows stand down beside it)
  if (hud.rows !== 'events' && hud.spec.hud && Array.isArray(rows) && rows.some((r) => r && r.touch === true && r.key !== undefined)) {
    const K = hudToMana(rows.filter((r) => r && r.touch === true && r.key !== undefined), { hero: false });
    hud = { ...hud, spec: { ...hud.spec, hud: { ...hud.spec.hud, children: [...(hud.spec.hud.children ?? []), ...K.spec.hud.children] } } };
  }
  // THE TOUCH PAD (controllable/touch.js): on a level made for a screen the HUD draws the virtual pad's stick and pads at
  // its foot, from what the touch layer says of itself each frame (touch.*: on, lane, held, down, buttons); the layer
  // reads the thumbs and draws nothing
  if (touch && hud.spec.hud) {
    const T = (k) => ({ bind: `touch.${k}` });
    const pad = { use: 'region', props: { at: 'bottom', variant: 'bare' }, when: T('on'), children: [{ use: 'touchpad', props: { lane: T('lane'), held: T('held'), down: T('down'), buttons: T('buttons') } }] };
    hud = { ...hud, spec: { ...hud.spec, hud: { ...hud.spec.hud, children: [...(hud.spec.hud.children ?? []), pad] } } };
  }
  const R = hud.feed && hud.feed.rows;
  const css = `${manaCss()}\n${themeCss(hud.theme ?? 'greybox')}\n#moj-mana-hud{position:absolute;inset:0;pointer-events:none;z-index:30}.moj-c-gauge,.moj-hud-col${hud.feed && hud.feed.hero ? ',.moj-c-hp' : ''}{display:none!important}`;
  // (a HUD of the level's own making may bring its parts' look over the theme: a side map's, gameworld/side-map/hud.js)
  const sheetCss = hud.css ? `${css}\n${hud.css}` : css, SM = hud.feed && hud.feed.sidemap ? hud.feed.sidemap : null;
  return `
// THE HUD on mana-ui (channels/mana-hud.js): the level's own spec over a state this page feeds
(function () {
  const CFG = ${json({ spec: hud.spec, feed: hud.feed ?? {} })}, GAME = ${game ? 'true' : 'false'};
  const manaUi = ${manaUiSource()};
  const sheet = document.createElement('style'); sheet.textContent = ${json(sheetCss)}; document.head.appendChild(sheet);
  // (laid over the scene's own frame, as the level's widgets were: a letterboxed scene keeps its HUD inside it)
  const root = document.createElement('div'); root.id = 'moj-mana-hud'; (document.getElementById('wrap') || document.body).appendChild(root);
  const F = CFG.feed, of = Math.max(1, Math.round((F.to || 0) - (F.from || 0)));
  const st = { touch: { on: false, lane: false, held: null, down: [], buttons: [], hint: '' }, course: { metres: 0, of: of, left: of, says: of + ' ' + (F.left || 'm'), short: of + ' ' + (F.leftShort || 'm') }, run: { show: false, at: 1, of: 1 }, hero: { stamina: 1, staminaMax: 1, sprints: !!F.stamina, hp: 1, hpMax: 1, hasHp: false }, coins: { count: 0 }, start: { count: '', sub: '' }, hint: { show: false }, moments: [], v: {}, on: {}, lines: {} };
  ${SM ? `// A SIDE MAP's columns and screens (gameworld/side-map/hud.js): the energy, the boss's while it fights, READY and the
  // lives under it, the keys at first; the intro card, the start menu and GAME OVER over the held level
  const SMF = F.sidemap, SMK = ${json({ keys: manaControls().keys, pad: manaControls().pad })};
  st.sm = { lives: SMF.lives, livesWord: '×' + SMF.lives, energy: SMF.energy || 0, weaponOn: false, weapon: 0, weaponMax: 1, bossOn: false, boss: SMF.boss ? SMF.boss.hp : 0, ready: !SMF.intro, keysOn: true, keys: SMF.keys, moments: [], weapons: [], gate: '', keep: 'Weapons' };
  let smLives = -1, smReady = SMF.intro ? -1 : 2.4, smKeys = 8, smBoss = null, smOn = false, smOff = -1, smTint = null, smUp = null, smQuiet = false, smIntro = -1, smOver = -1;
  if (SMF.intro && SMF.intro.hue) root.style.setProperty('--sm-hue', SMF.intro.hue);
  // (a screen up holds the level as a level's own menus do: no input to the pilot, the world and its clock stopped, and
  // the shell's Esc menu not asked for over it, scene-three's .moj-menu-hud)
  const smHold = document.createElement('div'); smHold.className = 'moj-menu-hud'; smHold.style.display = 'none'; document.body.appendChild(smHold);
  function smOpen(id) { smQuiet = true; try { rt.close(); rt.open(id); } finally { smQuiet = false; } smUp = id; window.__mojMenuOpen = true; window.__mojFreeze = true; smHold.textContent = id; view.paint(); smTints(); }
  function smClose() { if (!smUp) return; smUp = null; smQuiet = true; try { rt.close(); } finally { smQuiet = false; } window.__mojMenuOpen = false; window.__mojFreeze = false; setTimeout(function () { if (!smUp) smHold.textContent = ''; }, 0); view.paint(); }
  // (an event raised on the level's bus, heard by its mechanics and its game: a continue, a giving up)
  function smBus(type) { const M = window.__mojBus; if (M && M.bus && M.state) M.bus.processEvents(M.state, [{ type: type }]); }
  function smPilot() { const W = window.__mojCtrl && window.__mojCtrl.world; return W && W.pilotId ? W.byId[W.pilotId] : null; }
  // the start menu's weapons: the loadout's held slots in order (the buster first), the rest of the game's locked
  function smWeapons() {
    const me = smPilot(), lo = me && ((me.pilotRule && me.pilotRule.loadout) || (me.rule && me.rule.loadout)), ws = me && me.loadoutWeapons, rows = [];
    if (Array.isArray(lo) && ws) lo.forEach(function (c, i) {
      if (me.loadoutHeld && !me.loadoutHeld[i]) return;
      const w = ws[i], en = !!(w && w.energyMax > 0);
      rows.push({ name: (c && c.name) || 'Weapon', icon: rows.length ? 'bolt' : 'target', bar: en, e: en ? Math.max(0, Math.round(w.energy == null ? w.energyMax : w.energy)) : 0, max: en ? w.energyMax : 1, tint: w && typeof w.fxColor === 'string' ? w.fxColor : '', then: { emit: 'sm:equip', i: i } });
    });
    else rows.push({ name: 'Buster', icon: 'target', bar: false, e: 0, max: 1, tint: '', then: { emit: 'sm:equip', i: -1 } });
    while (rows.length < SMF.slots) rows.push({ name: '— — —', icon: 'lock', bar: false, e: 0, max: 1, tint: '#555555', then: { emit: 'sm:none' } });
    st.sm.weapons = rows;
  }
  function smTints() { const R = root.querySelectorAll('.mana-screen .mana-list .mana-row'); st.sm.weapons.forEach(function (w, i) { if (R[i]) { if (w.tint) R[i].style.setProperty('--tint', w.tint); else R[i].style.removeProperty('--tint'); } }); }
  function smEquip(i) {
    const me = smPilot(), lo = me && ((me.pilotRule && me.pilotRule.loadout) || (me.rule && me.rule.loadout));
    if (!me || !Array.isArray(lo) || !me.loadoutWeapons || i < 0 || !me.loadoutWeapons[i]) return;
    me.loadoutIdx = i; me.weapon = me.loadoutWeapons[i];
    if (me.body && lo[i] && lo[i].figure) me.body.figure = lo[i].figure;
  }
  function smGo() { smClose(); smReady = clock + 2.2; smKeys = clock + 8; }
  function smAct(e) {
    if (e.emit === 'mana:closed') {
      if (smQuiet || !smUp) return;
      const was = smUp; smUp = null;
      // (a back: the menu resumes, the card goes on to READY; GAME OVER is left only by its choices)
      if (was === 'over') { smOpen('over'); return; }
      if (was === 'intro') { smGo(); return; }
      window.__mojMenuOpen = false; window.__mojFreeze = false; setTimeout(function () { if (!smUp) smHold.textContent = ''; }, 0);
      return;
    }
    if (e.emit === 'sm:go') { smGo(); return; }
    if (e.emit === 'sm:continue') { smBus('continue'); smOver = -1; smClose(); smReady = clock + 2.2; return; }
    if (e.emit === 'sm:quit') { smClose(); smBus('giveup'); return; }
    if (e.emit === 'sm:equip') { smEquip(e.i); smClose(); return; }
  }
` : ''}
  let hooked = false, clock = 0, cue = null, hintUntil = -1, last = performance.now();
  // a HUD part pressed (a level's button row): its event raised on the level's bus, as a key bound to it would
  // (a keyed one, game/screen-keys.js: that key pressed, heard by whatever listens for it)
  function press(e) {
    ${SM ? "if (e && typeof e.emit === 'string' && (e.emit.indexOf('sm:') === 0 || e.emit === 'mana:closed')) { smAct(e); return; }" : ''}
    if (e && typeof e.key === 'string') { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key: e.key, code: e.code || e.key, bubbles: true, cancelable: true })); return; }
    if (e && typeof e.emit === 'string' && window.__mojBus && window.__mojBus.press) window.__mojBus.press(e.emit);
  }
  const rt = manaUi.runtime(CFG.spec, { read: function (p) { return manaUi.readPath(st, p); }, act: press, now: function () { return clock; } });
  rt.glyphs({ keys: { jump: 'Space', steer: 'A · D' }, pad: { xbox: { jump: 'A', steer: 'L' }, playstation: { jump: '✕', steer: 'L' }, nintendo: { jump: 'B', steer: 'L' } }, touch: { jump: 'tap', steer: 'swipe' } });
  // (the device in hand: a touch screen, or the page told to be one, as the touch layer reads it)
  const __tq = new URLSearchParams(location.search).get('touch');
  rt.input(__tq === '1' || (__tq !== '0' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'touch' : 'keys');
  const view = manaUi.mount(root, rt, { auto: true });
  window.__mojHud = { rt: rt, state: st };
  ${SM ? `// the keys and the pad drive the screens while one is up (controls/mana-host.js: with none up a key is play's); the
  // menu key opens the start menu over play
  const __smHost = ${manaHostSource()};
  __smHost.connect(rt, view, { keys: SMK.keys, pad: SMK.pad });
  window.addEventListener('keydown', function (e) {
    if (e.key !== SMF.menuKey || e.repeat || smUp || window.__mojMenuOpen || st.sm.lives <= 0) return;
    smWeapons(); smOpen('menu'); e.preventDefault();
  });` : ''}
  // the level has started (the shell's params are in): its place in the run, and the start cue
  function begin(params) {
    const R = params && params.__run;
    if (R && R.of > 1) { st.run.show = true; st.run.at = R.at; st.run.of = R.of; }
    if (F.hint && (!R || R.at === 1)) hintUntil = 1e9;   // (shown from the cue; timed from GO)
    ${SM ? "if (F.sidemap.intro) { smOpen('intro'); smIntro = clock + 3.2; }   // (a world's intro card, then READY)" : ''}
    if (F.cue && CFG.spec.screens && CFG.spec.screens.ready) { cue = { t0: clock }; st.start.count = F.cue.beats[0]; st.start.sub = F.cue.sub || ''; rt.open('ready'); view.paint(); }
    else if (hintUntil > 0) hintUntil = clock + F.hint.seconds;
  }
  // A LEVEL'S ROWS (game/hud-mana.js): its vars read off the bus, its gated and timed rows said on or off, its banners
  // called as moments and its toasts as lines when the bus's log names their event (or their var changes)
  const ROWS = F.rows || null;
  ${R ? `${hudSubst.toString()}
  ${fmtDelta.toString()}
  function glob(str, pat) {   // the game.on glob: '*' spans, literals anchor at both ends
    str = String(str); if (pat === '*') return true;
    const parts = pat.split('*'); if (parts.length === 1) return str === pat;
    let pos = 0;
    for (let i = 0; i < parts.length; i++) { const p = parts[i]; if (!p) continue; const at = str.indexOf(p, pos); if (at < 0 || (i === 0 && at !== 0)) return false; pos = at + p.length; }
    return !parts[parts.length - 1] || pos === str.length;
  }
  function stands(w, V) {   // a part not hidden (ui-<id>, ui-<id>-state), in one of its phases
    if (w.id && (V['ui-' + w.id] === 0 || V['ui-' + w.id + '-state'] === 0)) return false;
    return !(w.when && w.when.indexOf(typeof V.phase === 'number' ? V.phase : 0) < 0);
  }
  let logN = -1, seq = 0; const live = [], prev = {};
  ROWS.lines.forEach(function (k) { st.lines[k] = []; });
  function line(tw, text) { live.push({ k: tw.line, text: text, until: clock + tw.ttl }); st.lines[tw.line] = st.lines[tw.line].concat([{ text: text }]); }
  function rows(bus, V) {
    for (const k in ROWS.vars) { const raw = V[ROWS.vars[k]]; st.v[k] = raw != null ? raw : 0; }
    for (const g of ROWS.gates) st.on[g.k] = stands(g, V) && (!g.ttl || clock < g.ttl);
    const log = bus.log || [];
    if (logN < 0 || log.length < logN) logN = logN < 0 ? log.length : 0;
    for (let i = logN; i < log.length; i++) {
      const ev = log[i]; if (!ev || !ev.type) continue;
      for (const b of ROWS.banners) if (glob(ev.type, b.on) && stands(b, V)) st.moments = st.moments.slice(-5).concat([{ id: 'b' + (seq++), text: hudSubst(b.text, V, { event: ev }) }]);
      for (const tw of ROWS.toasts) if (tw.on && glob(ev.type, tw.on) && stands(tw, V)) line(tw, hudSubst(tw.text, V, { event: ev }));
    }
    logN = log.length;
    ROWS.toasts.forEach(function (tw, i) {   // the var toast: fires on a change, seeded silently on its first frame
      if (!tw.var) return;
      const raw = V[tw.var], v = typeof raw === 'number' ? raw : 0;
      if (prev[i] === undefined) prev[i] = v;
      else if (v !== prev[i]) { const d = v - prev[i]; prev[i] = v; if (stands(tw, V)) line(tw, hudSubst(tw.text, V, { delta: fmtDelta(d), value: v })); }
    });
    for (let i = live.length - 1; i >= 0; i--) if (clock >= live[i].until) { const l = live[i]; live.splice(i, 1); const at = st.lines[l.k].findIndex(function (r) { return r.text === l.text; }); if (at >= 0) st.lines[l.k] = st.lines[l.k].filter(function (_, j) { return j !== at; }); }
  }` : 'function rows() {}'}
  (function tick() {
    requestAnimationFrame(tick);
    // (hooked once the game's channel is up, which on a level of a game may be some frames after this one: its start
    // hands over the shell's params, the run among them. A page with no game begins at once)
    if (!hooked && (!GAME || (window.__mojGame && window.__mojGame.onStart))) { hooked = true; if (GAME) window.__mojGame.onStart(begin); else begin(null); }
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
    const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.pilotId && W.byId[W.pilotId];
    if (me && me.transform) {
      const m = Math.max(0, Math.min(of, me.transform.pos[1] - (F.from || 0)));
      st.course.metres = Math.round(m); st.course.left = of - Math.round(m); st.course.says = st.course.left + ' ' + (F.left || 'm'); st.course.short = st.course.left + ' ' + (F.leftShort || 'm');
      if (F.stamina && me.rule) { const max = me.rule.boostMax || 1; st.hero.staminaMax = max; st.hero.stamina = Math.max(0, Math.min(max, me.boost == null ? max : me.boost)); }
    }
    // the pilot's own gauges (a level's rows, feed.hero): its health where it has one, its sprint where its rule has one
    if (F.hero && me) {
      const hm = Number.isFinite(me.hpMax) && me.hpMax > 0 ? me.hpMax : 0;
      st.hero.hasHp = hm > 0; st.hero.hpMax = hm || 1; st.hero.hp = Math.max(0, Math.min(hm, me.hp == null ? hm : me.hp));
      const bm = me.rule && me.rule.boostMax > 0 ? me.rule.boostMax : 0;
      st.hero.sprints = bm > 0; st.hero.staminaMax = bm || 1; st.hero.stamina = Math.max(0, Math.min(bm, me.boost == null ? bm : me.boost));
    }
    const V = window.__mojBus && window.__mojBus.state && window.__mojBus.state.vars;
    if (V && V.coins != null) st.coins.count = V.coins;
    if (ROWS && V) rows(window.__mojBus.state, V);
    if (cue) {
      const k = Math.floor((clock - cue.t0) / F.cue.every);
      if (k < F.cue.beats.length) st.start.count = F.cue.beats[k];
      else { cue = null; rt.close(); st.moments = st.moments.concat([{ id: 'go', text: F.cue.go, weight: 'major' }]); if (hintUntil > 0) hintUntil = clock + F.hint.seconds; }
    }
    st.hint.show = clock < hintUntil;
    ${SM ? `// (the side map's: READY at the start and after a life lost, the lives under it; the energy; the keys for the first
    // seconds; the boss's column once it is near and awake, its name said as it comes in, gone a moment after it falls)
    if (V && V.lives != null) { if (smLives >= 0 && V.lives < smLives && V.lives > 0) smReady = clock + 2.2; smLives = V.lives; st.sm.lives = V.lives; st.sm.livesWord = '×' + V.lives; }
    if (V && V.energy != null) st.sm.energy = Math.max(0, V.energy);
    st.sm.ready = !smUp && clock < smReady; st.sm.keysOn = !smUp && clock < smKeys;
    if (smUp === 'intro' && clock > smIntro) smGo();
    // GAME OVER: the last life gone, a moment after (the hero back at its gate), where the level offers a continue
    if (SMF.continues && V && V.lives != null && V.lives <= 0 && smUp !== 'over') {
      if (smOver < 0) smOver = clock + 1;
      else if (clock > smOver) {
        const cam = W && W.entities ? W.entities.find(function (x) { return x.rule && Array.isArray(x.rule.zones) && x.frame; }) : null;
        st.sm.gate = cam ? 'Gate ' + ((cam._zoneAt || 0) + 1) + ' of ' + cam.rule.zones.length : 'Gate';
        smOpen('over');
      }
    }
    // (a special weapon's column: the held gun's own energy, in its tint, while it has one; the buster has none)
    const smW = me && me.weapon && me.weapon.energyMax > 0 ? me.weapon : null;
    st.sm.weaponOn = !!smW; if (smW) { st.sm.weapon = Math.max(0, smW.energy ?? smW.energyMax); st.sm.weaponMax = smW.energyMax; }
    const smT = smW && typeof smW.fxColor === 'string' ? smW.fxColor : ''; if (smT !== smTint) { smTint = smT; if (smT) root.style.setProperty('--sm-weapon', smT); else root.style.removeProperty('--sm-weapon'); }
    if (F.sidemap.boss && V) {
      if (smBoss === null) for (const k in V) if (/^boss_\\d+$/.test(k)) { smBoss = k; break; }
      const bv = smBoss ? Number(V[smBoss]) : NaN, Bo = W && W.byId ? W.byId[F.sidemap.boss.id] : null;
      if (Number.isFinite(bv)) st.sm.boss = Math.max(0, bv);
      if (!smOn && Bo && me && !Bo.dormant && Math.hypot(Bo.transform.pos[0] - me.transform.pos[0], Bo.transform.pos[1] - me.transform.pos[1]) < 24) { smOn = true; st.sm.moments = st.sm.moments.concat([{ id: 'boss', text: F.sidemap.boss.name, weight: 'decisive' }]); }
      if (smOn && st.sm.boss <= 0 && smOff < 0) smOff = clock + 1.5;
      st.sm.bossOn = smOn && (smOff < 0 || clock < smOff);
    }` : ''}
    // (the touch layer's word for its pad, when the page has one)
    // (a page whose touch layer draws itself still says whether it is up: a button for a touch screen alone reads it)
    const TT = window.__mojTouch; if (TT) { if (TT.view) st.touch = TT.view(); else st.touch.on = !!TT.on() && !window.__mojMenuOpen; }
  })();
})();`;
}
