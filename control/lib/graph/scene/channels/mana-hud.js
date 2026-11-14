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
 *     theme   a mana-ui theme (a preset's name or a theme object, resolved by the level's author)
 *             or, for a level whose HUD is its own widget rows (`events.hud`): { rows: 'events', theme } and the rows
 *             handed in (`rows`, `register`): lowered by game/hud-mana.js to a spec and the feed below
 *     feed    { rows: { vars, gates, banners, toasts, lines }, hero } a level's rows off its bus (v.<k>, on.<k>,
 *             lines.<k>, moments) and the pilot's own gauges (hero.hp, hero.stamina); and/or, a course's: { kind: 'course', from, to, cue?: { beats, every, go, sub? },
 *             hint?: { seconds }, stamina? } (the pilot's place along +y from `from` to `to`)
 *
 * The state it writes (a spec binds these): course { metres, of, left, says } · run { show, at, of } (the shell's
 * `params.__run`) · hero { stamina, staminaMax, sprints } · coins { count } (the bus's `coins`) · start { count, sub } · hint { show } · moments [].
 * It takes no input and reads no device: a HUD is seen. The page's own gauge and its widget rows are hidden while this stands (by a rule
 * on its class: the runtime that draws it is untouched). `window.__mojHud = { rt, state }` for a headless driver.
 */
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { hudToMana } from '../../game/hud-mana.js';
import { hudSubst, fmtDelta } from '../../game/hud-widgets.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export function manaHudScript(hud, { game = false, rows = null, register = null } = {}) {
  // (a level whose HUD is its own rows, `rows: 'events'`: lowered here, where the page emits them, game/hud-mana.js)
  if (hud && hud.rows === 'events' && !hud.spec) { const L = hudToMana(rows, { register, hero: hud.hero !== false }); hud = { ...hud, spec: L.spec, feed: { ...L.feed, ...(hud.feed ?? {}) } }; }
  if (!hud || !hud.spec) return '';
  const R = hud.feed && hud.feed.rows;
  const css = `${manaCss()}\n${themeCss(hud.theme ?? 'greybox')}\n#moj-mana-hud{position:absolute;inset:0;pointer-events:none;z-index:30}.moj-c-gauge,.moj-hud-col${hud.feed && hud.feed.hero ? ',.moj-c-hp' : ''}{display:none!important}`;
  return `
// THE HUD on mana-ui (channels/mana-hud.js): the level's own spec over a state this page feeds
(function () {
  const CFG = ${json({ spec: hud.spec, feed: hud.feed ?? {} })}, GAME = ${game ? 'true' : 'false'};
  const manaUi = ${manaUiSource()};
  const sheet = document.createElement('style'); sheet.textContent = ${json(css)}; document.head.appendChild(sheet);
  // (laid over the scene's own frame, as the level's widgets were: a letterboxed scene keeps its HUD inside it)
  const root = document.createElement('div'); root.id = 'moj-mana-hud'; (document.getElementById('wrap') || document.body).appendChild(root);
  const F = CFG.feed, of = Math.max(1, Math.round((F.to || 0) - (F.from || 0)));
  const st = { course: { metres: 0, of: of, left: of, says: of + ' ' + (F.left || 'm') }, run: { show: false, at: 1, of: 1 }, hero: { stamina: 1, staminaMax: 1, sprints: !!F.stamina, hp: 1, hpMax: 1, hasHp: false }, coins: { count: 0 }, start: { count: '', sub: '' }, hint: { show: false }, moments: [], v: {}, on: {}, lines: {} };
  let hooked = false, clock = 0, cue = null, hintUntil = -1, last = performance.now();
  const rt = manaUi.runtime(CFG.spec, { read: function (p) { return manaUi.readPath(st, p); }, act: function () {}, now: function () { return clock; } });
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
      st.course.metres = Math.round(m); st.course.left = of - Math.round(m); st.course.says = st.course.left + ' ' + (F.left || 'm');
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
  })();
})();`;
}
