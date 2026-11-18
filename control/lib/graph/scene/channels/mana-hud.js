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
 * A race's (`feed.kind: 'race'`, gameworld/race-hud.js): race { place, of, placeSays, field, lap, laps, lapSays, time,
 * best, hasBest, speed, speedMax, markers, solo } · start { lit, of, sub }: its lights held as a screen with the world
 * frozen (`window.__mojFreeze`, the race's clock with it) until they go out, then read off the laps mechanic's vars.
 * It reads no device: a HUD is seen. A part that is pressed (a level's button row, tapped or clicked) raises its event on
 * the level's bus (`window.__mojBus.press`, there only for a level with such a row). The page's own gauge and its widget rows are hidden while this stands (by a rule
 * on its class: the runtime that draws it is untouched). `window.__mojHud = { rt, state }` for a headless driver.
 *
 * THE PILOT'S PARTS (a level's rows with `hero`, game/hud-mana.js), read each frame off what the page already has and
 * drawn in its stead: the health (the pilot's, or the level's health row: its highest as its max) at rest while full and
 * the screen's edge closing in under half; the gun in hand off its loadout or its weapon (the page's own weapon panel put
 * away); the world clock's slow-motion as a charge (the moment a dodge sets off, else the first); the page's radar as a
 * scope (radar.js marks; the canvas put away), its damage ring as arcs (window.__mojDamageRing; its bars put away) and
 * its weapon selector as the wheel (window.__mojWc; its panel put away). What the page lacks stands down.
 */
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { hudToMana } from '../../game/hud-mana.js';
import { hudSubst, fmtDelta } from '../../game/hud-widgets.js';
import { radarMarks, sceneThings, RADAR } from '../../gameworld/radar.js';
import { hitBearing } from '../../gameworld/damage-ring.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export function manaHudScript(hud, { game = false, rows = null, register = null, touch = false, shared = null } = {}) {
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
  // (a race's feed, gameworld/race-hud.js: its lights, laps, times and map; any other HUD carries none of it)
  const race = !!(hud.feed && hud.feed.kind === 'race');
  // (`shared`: the page carries the runtime and the theme's sheet once for its HUD and its screens, scene-three's
  // prelude: this host names it and adds only its own rules; alone on a page, it carries both itself, as it did)
  const css = `${shared ? '' : `${manaCss()}\n${themeCss(hud.theme ?? 'greybox')}\n`}#moj-mana-hud{position:absolute;inset:0;pointer-events:none;z-index:30}.moj-c-gauge,.moj-hud-col${hud.feed && hud.feed.hero ? ',.moj-c-hp,#__radar,#__wc,#__damageRing,div:has(>#__wepIcon)' : ''}{display:none!important}`
    // (money in a corner: the coin and a figure that leads, large, the way an open world shows the cash in hand)
    + '#moj-mana-hud .mana-place:is([data-at=top-right],[data-at=top-left])>.mana-region>.mana-counter:has(>[data-icon=coin]) .mana-num{font:800 38px/1 var(--mana-display);letter-spacing:-.5px}'
    + '#moj-mana-hud .mana-place>.mana-region>.mana-counter:has(>[data-icon=coin]){gap:10px;align-items:center}';
  const H = !!(hud.feed && hud.feed.hero);
  return `
// THE HUD on mana-ui (channels/mana-hud.js): the level's own spec over a state this page feeds
(function () {
  const CFG = ${json({ spec: hud.spec, feed: hud.feed ?? {} })}, GAME = ${game ? 'true' : 'false'};
  const manaUi = ${shared || manaUiSource()};${H ? `
  const __hRadar = ${radarMarks.toString()}, __hThings = ${sceneThings.toString()}, __hBearing = ${hitBearing.toString()}, __hR = ${json({ ...RADAR, range: 40 })};` : ''}
  const sheet = document.createElement('style'); sheet.textContent = ${json(css)}; document.head.appendChild(sheet);
  // (laid over the scene's own frame, as the level's widgets were: a letterboxed scene keeps its HUD inside it)
  const root = document.createElement('div'); root.id = 'moj-mana-hud'; (document.getElementById('wrap') || document.body).appendChild(root);
  const F = CFG.feed, of = Math.max(1, Math.round((F.to || 0) - (F.from || 0)));
  const st = { touch: { on: false, lane: false, held: null, down: [], buttons: [], hint: '' }, course: { metres: 0, of: of, left: of, says: of + ' ' + (F.left || 'm'), short: of + ' ' + (F.leftShort || 'm') }, run: { show: false, at: 1, of: 1 }, gun: { on: false }, focus: { on: false }, radar: { on: false, marks: [], north: 0 }, ring: { on: false, hits: [] }, wheel: { open: false, slots: [], title: '' }, top: {}, hero: { stamina: 1, staminaMax: 1, sprints: !!F.stamina, hp: 1, hpMax: 1, hasHp: false }, coins: { count: 0 }, start: { count: '', sub: '' }, hint: { show: false }, moments: [], v: {}, on: {}, lines: {} };
  let hooked = false, clock = 0, cue = null, hintUntil = -1, last = performance.now();
${race ? `  // A RACE's (gameworld/race-hud.js): the lights, then the laps, the place and the times off the laps mechanic's vars
  const RACE = F.kind === 'race' ? { m: F.mech || 0, lights: null, done: 0, lapStart: 0, best: 0, over: false } : null;
  if (RACE) { st.race = { place: 1, of: F.racers, placeSays: '1st', field: '/ ' + F.racers, lap: 1, laps: F.laps, lapSays: '1/' + F.laps, time: 0, best: 0, hasBest: false, speed: 0, speedMax: F.speedMax, markers: [], solo: F.racers < 2, hasItem: false, itemSays: '—', itemIcon: '' }; st.fx = { finish: 0, best: 0 }; st.start = { lit: 0, of: F.lights.count, lights: '', sub: F.words.ready }; }
  const lightsSay = function (n) { const out = []; for (let i = 0; i < F.lights.count; i++) out.push(i < n ? '●' : '○'); return out.join(' '); };
  const nth = function (n) { const t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };` : ''}
  // a HUD part pressed (a level's button row): its event raised on the level's bus, as a key bound to it would
  // (a keyed one, game/screen-keys.js: that key pressed, heard by whatever listens for it)
  function press(e) {
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
  // the level has started (the shell's params are in): its place in the run, and the start cue
  function begin(params) {
    const R = params && params.__run;
    if (R && R.of > 1) { st.run.show = true; st.run.at = R.at; st.run.of = R.of; }
    if (F.hint && (!R || R.at === 1)) hintUntil = 1e9;   // (shown from the cue; timed from GO)
${race ? `    // (a race's lights: the karts held and the race's clock frozen, the world's, until they go out)
    if (RACE && CFG.spec.screens && CFG.spec.screens.ready) { RACE.lights = { t0: clock }; st.start.lit = 0; rt.open('ready'); view.paint(); }
    else ` : '    '}if (F.cue && CFG.spec.screens && CFG.spec.screens.ready) { cue = { t0: clock }; st.start.count = F.cue.beats[0]; st.start.sub = F.cue.sub || ''; rt.open('ready'); view.paint(); }
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
  ${H ? `// THE PILOT'S PARTS (see the header): read off the page, each standing only where the page has the thing
  const calm = { gun: '', gunT: 0, hp: -1, hpT: 0 }, SAY = { dodge: 'Dodge', strike: 'Strike', 'last-down': 'Last foe', down: 'A foe down', 'down:foe': 'A foe down' };
  function pilot(W, me, V) {
    const h = st.hero;
    // (the health: the level's row where one is the health, its highest as its max; else the pilot's own)
    if (F.hpVar && V) { const v = Number(st.v[F.hpVar]) || 0; st.top[F.hpVar] = Math.max(st.top[F.hpVar] || 1, v); h.hp = v; h.hpMax = st.top[F.hpVar]; }
    const share = h.hpMax > 0 && (F.hpVar || h.hasHp) ? h.hp / h.hpMax : 1;
    h.peril = Math.round(Math.min(1, Math.max(0, (0.5 - share) / 0.45)) * 20) / 20;
    if (h.hp !== calm.hp) { calm.hp = h.hp; calm.hpT = clock; }
    h.rest = share >= 1 && clock - calm.hpT > 3;
    // the gun in hand: its slot on the loadout, else the weapon it carries
    const lo = me.rule && me.rule.loadout, slot = lo ? lo[me.loadoutIdx || 0] : null, w = me.weapon, G = st.gun;
    // (a holstered sidearm, the open city's: its readout only while it is drawn, worlds/controllable/combat-melee.js gunOut)
    G.on = !!(slot || w) && !(me.rule && me.rule.holster && !me.gunOut);
    if (G.on) {
      const melee = !!(slot && (slot.fire === 'melee' || slot.strike) && !slot.weapon);
      G.name = (slot && slot.name) || (w && w.name) || '';
      G.mode = melee || !w ? '' : w.fireClass === 'lob' ? 'Launcher' : w.auto ? 'Auto' : w.burst > 1 ? 'Burst' : 'Semi';
      G.reloading = !melee && !!(w && w.reloading);
      G.rounds = melee || !w || w.reloading ? 0 : (w.ammo == null ? 0 : w.ammo);
      G.size = melee || !w || !Number.isFinite(w.magazine) ? 0 : w.magazine;
      G.reserve = melee || !w ? '' : Number.isFinite(w.reserve) ? w.reserve : '∞';
      const key = [G.name, G.rounds, G.reloading].join('|');
      if (key !== calm.gun) { calm.gun = key; calm.gunT = clock; }
      G.rest = G.size > 0 && G.rounds >= G.size && !G.reloading && clock - calm.gunT > 3;
    }
    // the slow-motion: the moment a dodge sets off (else the first), filling as it comes back, draining as it runs
    const T = W.tempo, ms = T && T.moments, Fc = st.focus;
    Fc.on = !!(ms && ms.length);
    if (Fc.on) {
      let i = ms.findIndex(function (m) { return m.on === 'dodge'; }); if (i < 0) i = 0;
      const m = ms[i], P = T.playing;
      if (P && P.m === m) { const all = 2 * (m.ramp || 0) + m.hold; Fc.state = 'active'; Fc.value = Math.round(Math.max(0, 1 - P.t / (all || 1)) * 20) / 20; Fc.label = ''; }
      else { const cd = m.cooldown || 0, r = cd > 0 ? Math.min(1, (T.real - T.fired[i]) / cd) : 1; Fc.value = Math.round((isFinite(r) ? r : 1) * 20) / 20; Fc.state = Fc.value >= 1 ? 'ready' : 'cooling'; Fc.label = Fc.state === 'ready' ? (SAY[m.on] || m.on) : ''; }
    }
    // the page's radar, as a scope; its damage ring, as arcs; its weapon selector, as the wheel
    const R = st.radar; R.on = !!document.getElementById('__radar');
    if (R.on && me.transform) { const p = me.transform.pos; R.marks = __hRadar(p, me.transform.heading, __hThings(W, me, null), __hR); R.north = __hBearing(p, me.transform.heading, [p[0], p[1] + 1, 0]); }
    const D = window.__mojDamageRing; st.ring.on = !!(D && D.hits && D.hits.length); st.ring.hits = st.ring.on ? D.hits : [];
    const C = window.__mojWc && window.__mojWc.view ? window.__mojWc.view() : null;
    st.wheel.open = !!(C && C.open);
    if (st.wheel.open) { st.wheel.title = C.title || ''; st.wheel.slots = C.rows; }
  }
  ` : ''}(function tick() {
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
    ${H ? 'if (me) pilot(W, me, V);' : ''}
    if (V && V.coins != null) st.coins.count = V.coins;
    if (ROWS && V) rows(window.__mojBus.state, V);
    if (cue) {
      const k = Math.floor((clock - cue.t0) / F.cue.every);
      if (k < F.cue.beats.length) st.start.count = F.cue.beats[k];
      else { cue = null; rt.close(); st.moments = st.moments.concat([{ id: 'go', text: F.cue.go, weight: 'major' }]); if (hintUntil > 0) hintUntil = clock + F.hint.seconds; }
    }
${race ? `    if (RACE) {
      const L = F.lights;
      if (RACE.lights) {
        // (the world held from a beat in, once the camera has found the kart: a world frozen on its first frame has no view)
        if (clock - RACE.lights.t0 > 0.3) window.__mojFreeze = true;
        const k = Math.floor((clock - RACE.lights.t0) / L.every);
        st.start.lit = Math.min(L.count, k); st.start.lights = lightsSay(st.start.lit);
        if (clock - RACE.lights.t0 >= L.count * L.every + L.hold) { RACE.lights = null; window.__mojFreeze = false; st.start.lit = 0; rt.close(); st.moments = st.moments.concat([{ id: 'go', text: F.words.go, weight: 'major' }]); }
      }
      if (V && !RACE.over) {
        const done = V['__lap_' + RACE.m] || 0, t = (V['__race_' + RACE.m] || 0) / 10;
        if (done > RACE.done) {
          const lapT = t - RACE.lapStart; RACE.lapStart = t; RACE.done = done;
          // (a lap better than the best so far: its sparkles, a screen effect that touches nothing)
          if (lapT > 0 && (!st.race.hasBest || lapT < st.race.best)) { if (st.race.hasBest) st.fx.best += 1; st.race.best = lapT; st.race.hasBest = true; }
          if (done >= F.laps) { RACE.over = true; st.fx.finish = 1; st.moments = st.moments.concat([{ id: 'finish', text: F.words.finish, sub: F.racers > 1 ? nth(st.race.place) : '', weight: 'decisive' }]); }
          else if (done === F.laps - 1 && F.laps > 1) st.moments = st.moments.concat([{ id: 'final', text: F.words.final, weight: 'major' }]);
        }
        st.race.lap = Math.min(F.laps, done + 1); st.race.lapSays = st.race.lap + '/' + F.laps;
        if (!RACE.over) st.race.time = Math.max(0, t - RACE.lapStart);
        const pl = V['__place_' + RACE.m]; if (pl != null) { st.race.place = pl; st.race.placeSays = nth(pl); }
      }
      if (me) st.race.speed = Math.round(Math.abs(me.speed || 0) * 3.6);
      // (the item held, a race with item boxes: roads/kart-items.js, the page's window.__mojItems)
      if (F.items && window.__mojItems && W) { const it = window.__mojItems.held(W.pilotId); st.race.hasItem = !!it; st.race.itemSays = it ? String(window.__mojItems.says(it)).toUpperCase() : '—'; st.race.itemIcon = it && window.__mojItems.icon ? String(window.__mojItems.icon(it)) : ''; }
      // the field on the map: you, and the rivals (their team), each at its place on the track's square
      if (F.frame && W) {
        const Fr = F.frame, at = function (p) { return { x: Fr.ox + (p[0] - Fr.x0) * Fr.k, y: 1 - (Fr.oy + (p[1] - Fr.y0) * Fr.k) }; }, mk = [];
        for (const id in W.byId) { const e = W.byId[id]; if (!e || !e.transform || id === W.pilotId || e.team !== 'rivals') continue; const q = at(e.transform.pos); mk.push({ x: q.x, y: q.y, kind: 'foe' }); }
        if (me && me.transform) { const q = at(me.transform.pos); mk.push({ x: q.x, y: q.y, kind: 'self' }); }
        st.race.markers = mk;
      }
    }
` : ''}    st.hint.show = clock < hintUntil;
    // (the touch layer's word for its pad, when the page has one)
    // (a page whose touch layer draws itself still says whether it is up: a button for a touch screen alone reads it)
    const TT = window.__mojTouch; if (TT) { if (TT.view) st.touch = TT.view(); else st.touch.on = !!TT.on() && !window.__mojMenuOpen; }
  })();
})();`;
}
