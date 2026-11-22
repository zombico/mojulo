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
 *
 * THE PILOT'S PARTS (a level's rows with `hero`, game/hud-mana.js), read each frame off what the page already has and
 * drawn in its stead: the health (the pilot's, or the level's health row: its highest as its max) at rest while full and
 * the screen's edge closing in under half; the gun in hand off its loadout or its weapon (the page's own weapon panel put
 * away); the world clock's slow-motion as a charge (the moment a dodge sets off, else the first); the page's radar as a
 * scope (radar.js marks; the canvas put away), its damage ring as arcs (window.__mojDamageRing; its bars put away) and
 * its weapon selector as the wheel (window.__mojWc; its panel put away). What the page lacks stands down.
 *
 * THE TALK BOX (`talk`: the page plays a level's scenes, playscape/ui/talk-box.js): the scenes' lines and choices drawn
 * by mana-ui's talk presenter in the HUD's theme, a second runtime on this one's kernel and sheet over a root of its own
 * (`#moj-mana-talk`), fed each frame from the scene runner's view (window.__mojScenes). The page's own box and its hint
 * stand down, and the HUD steps aside while a scene plays (as the page's own HUD does). The input stays the scene
 * channel's: a press goes on, holding or Esc skips, and a choice's row pressed is that answer. `window.__mojTalk = { rt,
 * state, face? }` for a headless driver.
 *   talk: true, or { faces?, speakers? }: `faces` the speakers' own figures are drawn live in the box's face
 *   (scene/channels/talk-face.js: the page's renderer, its bodies and the frame's pre-pass hook `window.__mojTalkFace`,
 *   which scene-three.js calls before each render on such a page); `speakers` the level's sheet (talk-box.js
 *   readSpeakers), a speaker whose portrait is `none` shown by the box alone. A speaker with no body on the page, or one
 *   hidden (the player's in first person), has no face.
 */
import { manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { hudToMana } from '../../game/hud-mana.js';
import { hudSubst, fmtDelta } from '../../game/hud-widgets.js';
import { radarMarks, sceneThings, RADAR, planSvg, planBox, radarPlan, planFloors, floorPlanSvg } from '../../gameworld/radar.js';
import { hitBearing } from '../../gameworld/damage-ring.js';
import { talkSpec, talkState, TALK_GLYPHS } from '../../playscape/ui/talk-box.js';
import { faceFrame, buildTalkFace } from './talk-face.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// the talk box's own place (the presenter's root over the HUD's; the box over the scene's bottom letterbox bar, as the
// page's own box sat over the bottom one), the page's box and hint put away, the HUD aside while a
// scene plays; a choice's rows take the pointer
const TALK_CSS = '#moj-mana-talk{position:fixed;inset:0;pointer-events:none;z-index:32}'
  + '#moj-mana-talk .mana-place[data-at=bottom]{bottom:calc(11vh + 12px);width:min(92%,max(62%,560px));align-items:stretch}'
  + '#moj-mana-talk .mana-place[data-at=bottom] :is(.mana-region,.mana-window){align-self:stretch;box-sizing:border-box}'
  + '#moj-mana-talk .mana-each>*{pointer-events:auto;cursor:pointer}'
  + '.moj-scene-box,.moj-scene-hint{display:none!important}.moj-scene-on #moj-mana-hud{visibility:hidden}';

export function manaHudScript(hud, { game = false, rows = null, register = null, touch = false, radarMap = null, talk = false, boss = false } = {}) {
  // (a level whose HUD is its own rows, `rows: 'events'`: lowered here, where the page emits them, game/hud-mana.js)
  if (hud && hud.rows === 'events' && !hud.spec) { const L = hudToMana(rows, { register, hero: hud.hero !== false, touch, ...(hud.radar ? { radar: hud.radar } : {}), ...(boss ? { boss: true } : {}) }); hud = { ...hud, spec: L.spec, feed: { ...L.feed, ...(hud.feed ?? {}) } }; }
  // (a level's radar look, game/hud-mana.js RADAR_LOOK: its size and a square scope's face are this HUD's own CSS, and its
  // floor the plan and the guards of the pilot's floor alone; absent, not one byte)
  const RL = hud && hud.radar ? hud.radar : null, floorRadar = !!(RL && RL.floor);
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
  const radarCss = !RL ? '' : (RL.size === 'large' ? '#moj-mana-hud .mana-minimap{width:calc(260 * var(--mana-du));height:calc(260 * var(--mana-du))}' : '')
    + (RL.shape === 'square' ? '#moj-mana-hud .mana-minimap[data-shape=square][data-scope=yes]{border-radius:calc(6 * var(--mana-du));background:color-mix(in srgb,var(--mana-panel) 38%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--mana-ink) 40%,transparent);overflow:hidden}'
      + '#moj-mana-hud .mana-minimap[data-shape=square] .mana-planclip{border-radius:calc(6 * var(--mana-du))}#moj-mana-hud .mana-minimap[data-shape=square] .mana-bezel::before{display:none}'
      + '#moj-mana-hud .mana-minimap[data-shape=square][data-scope=yes]::before{border-radius:0}'
      + '#moj-mana-hud .mana-minimap[data-shape=square] .mana-cone{border-radius:0}' : '');
  const R = hud.feed && hud.feed.rows;
  const css = `${manaCss()}\n${themeCss(hud.theme ?? 'greybox')}\n${radarCss ? `${radarCss}\n` : ''}#moj-mana-hud{position:absolute;inset:0;pointer-events:none;z-index:30}.moj-c-gauge,.moj-hud-col${hud.feed && hud.feed.hero ? ',.moj-c-hp,#__radar,#__wc,#__damageRing,div:has(>#__wepIcon)' : ''}{display:none!important}${talk ? TALK_CSS : ''}`;
  const H = !!(hud.feed && hud.feed.hero);
  const faces = !!(talk && talk.faces), speakers = (talk && talk.speakers) || {};
  return `
// THE HUD on mana-ui (channels/mana-hud.js): the level's own spec over a state this page feeds
(function () {
  const CFG = ${json({ spec: hud.spec, feed: hud.feed ?? {} })}, GAME = ${game ? 'true' : 'false'};
  const manaUi = ${manaUiSource()};${H ? `
  const __hRadar = ${radarMarks.toString()}, __hThings = ${sceneThings.toString()}, __hBearing = ${hitBearing.toString()}, __hR = ${json({ ...RADAR, range: 40 })};
  // (the map under the scope, radar.js: the level's plan from its own colliders and its tall grass, drawn once, the first
  // frame the radar is up; laid under the scope each frame at the radar's scale, ahead at the top)
  const __hPlanSvg = ${planSvg.toString()}, __hPlanBox = ${planBox.toString()}, __hPlanAt = ${radarPlan.toString()};
  let __hPlan = null;${floorRadar ? `
  // (the radar of one floor: the level's floors, each one's plan drawn the first time the pilot stands on it)
  const __hFloors = ${planFloors.toString()}, __hFloorSvg = ${floorPlanSvg.toString()};
  let __hFl = null, __hBox = null; const __hFlPlans = {};` : ''}${radarMap ? `
  // (the land under it too, a level's \`radar.map\`: its contours and its trail, read when the level was built)
  const __hLand = ${json(radarMap)};` : ''}` : ''}
  const sheet = document.createElement('style'); sheet.textContent = ${json(css)}; document.head.appendChild(sheet);
  // (laid over the scene's own frame, as the level's widgets were: a letterboxed scene keeps its HUD inside it)
  const root = document.createElement('div'); root.id = 'moj-mana-hud'; (document.getElementById('wrap') || document.body).appendChild(root);
  const F = CFG.feed, of = Math.max(1, Math.round((F.to || 0) - (F.from || 0)));
  const st = { touch: { on: false, lane: false, held: null, down: [], buttons: [], hint: '' }, course: { metres: 0, of: of, left: of, says: of + ' ' + (F.left || 'm'), short: of + ' ' + (F.leftShort || 'm') }, run: { show: false, at: 1, of: 1 }, gun: { on: false }, focus: { on: false }, radar: { on: false, marks: [], north: 0 }, ring: { on: false, hits: [] }, wheel: { open: false, slots: [], title: '' }, top: {}, hero: { stamina: 1, staminaMax: 1, sprints: !!F.stamina, hp: 1, hpMax: 1, hasHp: false }, coins: { count: 0 }, start: { count: '', sub: '' }, hint: { show: false }, moments: [], v: {}, on: {}, lines: {} };
  let hooked = false, clock = 0, cue = null, hintUntil = -1, last = performance.now();
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
  window.__mojHud = { rt: rt, state: st };${talk ? `
  // THE TALK BOX (see the header): the scenes' lines in this HUD's look, its own runtime over its own root
  const __talkOf = (${talkState.toString()});
  const talkRoot = document.createElement('div'); talkRoot.id = 'moj-mana-talk'; (document.getElementById('wrap') || document.body).appendChild(talkRoot);
  const tst = { talk: __talkOf(null) }; let talkKey = '';
  const trt = manaUi.runtime(${json(talkSpec())}, { read: function (p) { return manaUi.readPath(tst, p); }, act: function () {}, now: function () { return clock; } });
  trt.glyphs(${json(TALK_GLYPHS)});
  trt.input(__tq === '1' || (__tq !== '0' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'touch' : 'keys');
  manaUi.mount(talkRoot, trt, { auto: true });
  // a choice's row pressed is that answer (the scene channel hears the press as well: an answer taken wins over a press)
  talkRoot.addEventListener('pointerdown', function (ev) {
    const r = ev.target && ev.target.closest ? ev.target.closest('.mana-each>*') : null;
    if (r && window.__mojScenes) window.__mojScenes.pick(Array.prototype.indexOf.call(r.parentNode.children, r));
  });
  window.__mojTalk = { rt: trt, state: tst };${faces ? `
  // THE FACES (scene/channels/talk-face.js): who speaks, drawn live in the box's face by the frame's pre-pass
  const __TF = (${buildTalkFace.toString()})(THREE, renderer, scene, (${faceFrame.toString()}));
  const SPK = ${json(speakers)};
  let talkFace = null;
  window.__mojTalk.face = __TF;
  // the speaker's body and facing, when they have one shown and their sheet does not say none (hero: the player's)
  function faceOf(who) {
    const C = window.__mojCtrl, W = C && C.world, B = C && C.bodies;
    if (!W || !B || (SPK[who] && SPK[who].portrait === 'none')) return null;
    const id = W.byId[who] ? who : who === 'hero' ? W.pilotId : null, E = id && W.byId[id], b = id && B[id];
    return E && b && b.visible && !E.gone ? { who: id, b: b, h: (E.transform && E.transform.heading) || 0 } : null;
  }
  window.__mojTalkFace = function () {
    const el = talkFace && talkRoot.querySelector('.mana-portrait .mana-ph');
    if (el) __TF.draw(talkFace.who, talkFace.b, talkFace.h, el); else __TF.hide();
  };` : ''}
  function talkStep() {
    const S = window.__mojScenes, G = window.__mojStage, v = S ? S.view() : null;${faces ? `
    talkFace = v && v.on && v.line ? faceOf(v.line.who) : null;` : ''}
    const T = __talkOf(v, { noSkip: !!(G && G.on && !G.skip)${faces ? ', face: !!talkFace' : ''} }), k = JSON.stringify(T);
    if (k !== talkKey) { talkKey = k; tst.talk = T; }
  }` : ''}
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
    G.on = !!(slot || w);
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
    if (R.on && me.transform) { const p = me.transform.pos, cfgR = me.rule && me.rule.radarRange > 0 ? Object.assign({}, __hR, { range: me.rule.radarRange }) : __hR;${floorRadar ? `
      // (the floor the pilot stands on: the highest a body's height under its feet; on a stair, the one it left until it
      // is all but up. Its plan alone, and the foes within a storey of it)
      if (!__hFl && W.colliders && W.colliders.length) { __hFl = __hFloors(W.colliders); __hBox = __hPlanBox(W.colliders, null); }
      const foot = p[2] - ((me.rule && me.rule.eye) || 0), fz = (__hFl || []).reduce((a, z) => (z <= foot + 1 ? z : a), (__hFl && __hFl[0]) || 0);
      R.marks = __hRadar(p, me.transform.heading, __hThings(W, me, null).filter((t) => Math.abs(((t.at && t.at[2]) || 0) - fz) < 3), cfgR); R.north = __hBearing(p, me.transform.heading, [p[0], p[1] + 1, 0]);
      if (__hBox) { const k = String(fz); if (!__hFlPlans[k]) __hFlPlans[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(__hFloorSvg(__hPlanSvg, W.colliders, __hBox, fz)); R.plan = Object.assign({ src: __hFlPlans[k] }, __hPlanAt(__hBox, p, me.transform.heading, cfgR.range)); } }` : ` R.marks = __hRadar(p, me.transform.heading, __hThings(W, me, null), cfgR); R.north = __hBearing(p, me.transform.heading, [p[0], p[1] + 1, 0]);
      if (!__hPlan && W.colliders && W.colliders.length) { const box = __hPlanBox(W.colliders, null); __hPlan = { box, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(__hPlanSvg(W.colliders, null, box, { rel: true, veils: W.veils || []${radarMap ? ', relief: __hLand.relief, trail: __hLand.trail' : ''} })) }; }
      if (__hPlan) R.plan = Object.assign({ src: __hPlan.src }, __hPlanAt(__hPlan.box, p, me.transform.heading, cfgR.range)); }`}
    // JAMMED (the pilot inside a chaff cloud, combat-ranged.js state.jams): the radar reads nothing, its scope a static
    {
      const p = me && me.transform ? me.transform.pos : null, t = W.time || 0;
      const jam = R.on && p && (W.jams || []).some(function (j) { return j.until > t && Math.hypot(p[0] - j.at[0], p[1] - j.at[1]) <= j.r; });
      if (jam) { R.marks = []; R.plan = null; }
      let J = window.__mojJam;
      if (jam && !J) {
        const css = document.createElement('style'); css.textContent = '@keyframes mojJam{0%{background-position:0 0}100%{background-position:0 9px}}'; document.head.appendChild(css);
        J = window.__mojJam = document.createElement('div');
        J.style.cssText = 'position:absolute;pointer-events:none;z-index:31;border-radius:50%;display:none;align-items:center;justify-content:center;font:700 11px/1 ui-monospace,monospace;letter-spacing:.2em;color:#cfe3ff;text-shadow:0 0 4px #000;background:repeating-linear-gradient(0deg,rgba(200,215,230,.22) 0 1px,rgba(20,28,40,.5) 1px 3px);animation:mojJam .18s steps(3) infinite';
        J.textContent = 'JAMMED'; root.appendChild(J);
      }
      if (J) {
        const sc = jam ? root.querySelector('[data-scope="yes"]') : null;
        if (sc) { const a = sc.getBoundingClientRect(), b = root.getBoundingClientRect(); J.style.borderRadius = getComputedStyle(sc).borderRadius || '50%'; J.style.left = (a.left - b.left) + 'px'; J.style.top = (a.top - b.top) + 'px'; J.style.width = a.width + 'px'; J.style.height = a.height + 'px'; J.style.display = 'flex'; }
        else J.style.display = 'none';
      }
    }
${boss ? `    // THE BOSS (worlds/controllable/boss.js): the first standing, its name, title, health and its phases' ticks
    { const Bs = W.bosses || {}, k = Object.keys(Bs).find((id) => !Bs[id].down), b = k ? Bs[k] : null; st.boss = b ? { on: true, name: b.name, title: b.title || '', hp: Math.max(0, b.hp), hpMax: b.hpMax || 1, phases: Math.max(1, b.phases || 1) } : { on: false }; }
` : ''}    const D = window.__mojDamageRing; st.ring.on = !!(D && D.hits && D.hits.length); st.ring.hits = st.ring.on ? D.hits : [];
    const C = window.__mojWc && window.__mojWc.view ? window.__mojWc.view() : null;
    st.wheel.open = !!(C && C.open);
    if (st.wheel.open) { st.wheel.title = C.title || ''; st.wheel.slots = C.rows; }
  }
  ` : ''}(function tick() {
    requestAnimationFrame(tick);${talk ? `
    talkStep();` : ''}
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
    st.hint.show = clock < hintUntil;
    // (the touch layer's word for its pad, when the page has one)
    // (a page whose touch layer draws itself still says whether it is up: a button for a touch screen alone reads it)
    const TT = window.__mojTouch; if (TT) { if (TT.view) st.touch = TT.view(); else st.touch.on = !!TT.on() && !window.__mojMenuOpen; }
  })();
})();`;
}
