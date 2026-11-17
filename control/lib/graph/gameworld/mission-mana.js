/**
 * THE MISSION ON MANA-UI — a mission launched end to end on the game UI runtime (control/lib/mana-ui/), driven by the
 * controls layer (controls/mana-host.js) as the practice rooms' menu is (practice-mana.js): the briefing over the held
 * scene, the HUD while it plays, the pause, the debrief. One input paradigm: the keys, every pad layout and a finger
 * pick the same rows, and each control is named as the controls kernel names it.
 *
 *   the briefing   open as the page loads, the scene held behind it: the mission (its tasks in order), the kit (each gun
 *                  and the band it is for), how to play; Begin plays
 *   the HUD        drawn as a shooter draws it, not as a dashboard (docs/mana-ui.md, "A HUD that reads as a game"):
 *                  the health a long bar in cells (bottom left), the gun in hand its magazine's rounds as the big figure
 *                  over a belt of rounds, its reserve and fire mode small, low, empty and reloading said (bottom right),
 *                  both on a scrim and fading back while they hold no news; the task in hand as one order with which
 *                  of how many and how far (top), the yard's clock draining under it while it is held; the screen's
 *                  edge closing in as the health runs out. Read each frame off the scene: the bus's vars (the hp, the
 *                  objectives' own var, the hold's clock) and the pilot's weapon. The reticle stays the gunplay view's
 *                  own (its cone, its hit flash and its sights are the gun's); the list of every task is the map's
 *   the radar and the map   what is round the pilot, on a round scope that turns with it (a bezel, the wedge it sees,
 *                  north riding the bezel; top left), and where the pilot is in the level, on its plan (radar.js: the
 *                  map on its key, M, and in the pause menu, with the mission's tasks ticked beside it)
 *   the damage ring   where the fire is coming from: each hit the pilot takes marks a ring round the aim at its
 *                  attacker's bearing from where the pilot faces (ahead at the top, behind at the bottom), an arc that
 *                  fades as it ages, for a moment
 *                  (RING.life seconds of the scene's own clock, begun again by another hit from the same one), turning
 *                  with the pilot as it turns. Read off the scene: the pilot's count of hits taken and who dealt the
 *                  last (the runtime's own, worlds/controllable). mana-ui's damage-direction idiom; no hit, no ring
 *   the pause      the pilot scheme's `pause` (Esc, a pad's start): resume, the briefing, how to play, the controls this
 *                  world answers to (its live rows), restart
 *   the debrief    the level's one outcome envelope read as it lands (scene/channels/game.js): the outcome, the time,
 *                  the tasks met, the foes downed, the hp left; again, or the briefing. Inside a game's shell the
 *                  debrief is the shell's own result screen (game/play-shell-mana.js) and this one stays shut
 *
 *   (what it draws from is the manifest's `mission`: { title, theme, plan, tasks, briefing }, written by
 *   mission-level.js missionUi)
 *   missionManaSpec()         → the spec (validated by mana-ui's readSpec)
 *   missionMana(ui)           → the page's config: { theme, spec, glyphs, controls, open, state, tasks, msg }
 *   missionManaCss(theme)     → the sheet: mana-ui's, the theme's, and the page's own HUD put away
 *   missionManaRuntime(cfg)   → the page's code (inlined with toString(): it references only the kernel, the host and the
 *     pad reader inlined beside it, and the scene's own probes)
 *   missionChannelSource(ui)  → the block the page's mission channel splices (scene/channels/mission.js)
 *   RING, hitBearing          the damage ring's numbers and its bearing (damage-ring.js: the concept, its tracker inlined
 *                             beside the runtime; a page with its own HUD draws the same ring through its own channel)
 *
 * The look: the theme the manifest names (the world's interface where it writes one, else the `field-brief` theme
 * card), with no overlay across the screen either way.
 *
 * The page's side only: it imports the UI runtime, the controls layer, the theme cards and the damage ring (itself
 * import-free), and nothing else of the gameworld
 * (the scene's emitter reads it through its mission channel: scene/channels/mission.js).
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';
import { MSG_PAUSE, MSG_CONTROLS } from '../game/level-contract.js';
import { THEME_CARDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { RING, hitBearing, ringTracker } from './damage-ring.js';
import { RADAR, radarMarks, planBox, planPoint, planSvg, sceneThings } from './radar.js';

// (the damage ring is its own concept, drawn here on mana-ui: damage-ring.js)
export { RING, hitBearing };

const K = buildControlsKernel();
const B = (p) => ({ bind: `ms.${p}` });
const I = (f) => ({ item: f });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const back = { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } };
const USES = ['pause-menu', 'results-screen', 'objective-order', 'weapon-readout', 'health-strip', 'radar-scope', 'peril-edge', 'damage-direction', 'subtitles'];
/** The HUD's numbers: how long a readout holds no news before it fades back (s), the health's cells, where the screen's
 *  edge begins to close in (a share of the health) and where it is closed. */
export const HUD = Object.freeze({ rest: 3, cells: 4, peril: 0.5, end: 0.05, radio: 5 });
/** The look a mission wears where its world writes no interface of its own: the field brief (a theme card). */
export const MISSION_LOOK = 'field-brief';
// a mission's theme as mana-ui reads it: a card by its name, else a preset or a theme as written; and nothing of it drawn
// across the whole screen (an overlay lies over the sights: the HUD is over a scene, not a menu's own plate)
function themeOf(t) {
  const T = typeof t === 'string' && THEME_CARDS[t] ? cardTheme(t) : readTheme(t ?? cardTheme(MISSION_LOOK));
  return T.overlay && T.overlay !== 'none' ? readTheme({ ...T, overlay: 'none' }) : T;
}

// a screen of tabs, each a few lines; a line with a key is a prompt (the key of the device in hand beside what it does)
const tabsScreen = (title, pages, more = []) => ({ use: 'screen', props: { title, place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
  { use: 'tabs', props: { pages, page: { use: 'each', props: { rows: I('lines'), row: { use: 'stack', children: [
    { use: 'prompt', props: { action: I('action'), glyph: I('glyph'), label: I('text') }, when: I('key') },
    { use: 'text', props: { value: I('text') }, unless: I('key') },
  ] } } } } },
  { use: 'stack', props: { dir: 'row' }, children: more },
] }] }] });

/** The mission's screens and its HUD (see the header). */
export function missionManaSpec() {
  const spec = {
    hud: { use: 'hud', children: [
      // the screen's own edge, closing in as the health runs out (under everything else)
      { use: 'peril-edge', props: { level: B('peril') } },
      // the radar (radar.js): the pilot at its middle, ahead at the top, the foes awake and the task in hand
      { use: 'radar-scope', props: { markers: B('radar.marks'), north: B('radar.north'), label: B('radar.label') } },
      // the task in hand, as an order; the yard's clock draining under it while it is held
      { use: 'objective-order', when: B('order.on'), props: { title: B('order.title'), step: B('order.step'), distance: B('order.distance'), holding: B('hold.on'), hold: B('hold.total'), left: B('hold.left'), label: B('hold.label') } },
      { use: 'health-strip', props: { hp: B('hp'), hpMax: B('hpMax'), cells: HUD.cells, rest: B('rest.hp') } },
      { use: 'weapon-readout', props: { name: B('weapon'), mode: B('mode'), rounds: B('ammo'), size: B('magazine'), reserve: B('reserve'), reloading: B('reloading'), rest: B('rest.gun') } },
      // the order as it is spoken: who gives it and the line, for a few seconds as a task begins
      { use: 'subtitles', props: { show: B('radio.on'), who: B('radio.who'), line: B('radio.line'), skip: '' } },
      // the damage ring: drawn only while a hit's mark stands
      { use: 'damage-direction', props: { hits: B('ring.hits') }, when: B('ring.on') },
    ] },
    screens: {
      briefing: tabsScreen(B('title'), B('brief'), [{ use: 'button', props: { label: B('begin') }, on: { accept: { close: true } } }]),
      pause: { use: 'pause-menu', props: { title: B('title'), items: B('menu') } },
      how: tabsScreen('How to play', B('how'), [back]),
      controls: { use: 'screen', props: { title: 'Controls', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
        { use: 'each', props: { rows: B('controls'), row: { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [txt(I('label')), txt(I('keys'), 'label')] } } },
        back,
      ] }] }] },
      // the map (radar.js): the level's plan, north at the top, the pilot, the task in hand and the foes awake on it
      map: { use: 'screen', props: { title: 'The map', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
        { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'start' }, children: [
          { use: 'minimap', props: { markers: B('map.marks'), label: B('map.label') } },
          { use: 'stack', props: { gap: 'tight' }, children: [
            txt(B('objective.title'), 'heading'),
            { use: 'each', props: { rows: B('objective.steps'), row: { use: 'stack', props: { dir: 'row', gap: 'tight' }, children: [{ use: 'text', props: { value: '◆' }, unless: I('done') }, { use: 'text', props: { value: '✓' }, when: I('done') }, txt(I('text'), 'label')] } } },
            { use: 'divider' },
            { use: 'each', props: { rows: B('map.legend'), row: txt(I('text'), 'caption') } },
          ] },
        ] },
        back,
      ] }] }] },
      debrief: { use: 'results-screen', props: { outcome: B('result.outcome'), stats: B('result.stats'), rank: B('result.rank'), items: B('result.items') } },
    },
  };
  const full = withIdioms(spec);
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USES.includes(k)));
  manaUi.readSpec(full);
  return full;
}

// the pilot's pause, as the page opens the menu with it: its key codes, and its pad button on the standard mapping
function openControls() {
  const B0 = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad });
  const keys = Object.entries(K.codeMap(B0, 'keyboard')).filter(([, a]) => a === 'pause').map(([c]) => c);
  const pad = (B0.bind.gamepad.pause || []).map((b) => DEVICES.gamepad.buttons[b]).filter((i) => i !== undefined);
  return { keys, pad };
}
const tabs = (list) => list.map((t) => ({ label: t.label, lines: t.lines.map((l) => (typeof l === 'string' ? { text: l } : { ...l, key: true })) }));

/** The page's config (see the header), from the manifest's `mission`. */
export function missionMana(ui) {
  // (a shooter with no mission, `plain`: the same HUD, radar, map and pause, and no order, briefing or debrief: its
  // level's own counters and end stay the page's)
  const plain = ui.plain === true;
  const how = [
    { label: 'Moving', lines: [{ glyph: 'W A S D', text: 'move' }, { glyph: 'mouse', text: 'look' }, { action: 'jump', text: 'jump' }, { action: 'pause', text: 'this menu' }] },
    { label: 'The guns', lines: [{ action: 'fire', text: 'fire' }, { glyph: 'right click', text: 'raise the sights' }, { glyph: 'R', text: 'reload (what is left in the magazine is lost)' }, { glyph: '1-5', text: 'switch' }, { glyph: 'V', text: 'the knife, where one is carried' }] },
    { label: 'Under fire', lines: ['A red mark on the ring round your aim shows where a hit came from.', 'The top of the ring is ahead of you, the bottom behind, the sides your sides.', 'Turn until the mark is at the top: you are facing who is shooting.'] },
    { label: 'Radar and map', lines: ['The round scope shows what is round you: you are its middle and the top is ahead, so it turns as you turn.', 'A cross is a foe that is awake. A star is the task in hand, on the rim while it is further off.', { glyph: 'M', text: 'the map: the level from above, north at the top' }] },
    ...(plain ? [] : [{ label: 'The rules', lines: ['Each room has one task. Its way on is sealed until the task is met.', 'A room\'s foes wake as you walk into it, never before.', 'Rounds and health lie on the floor: walk over them.'] }]),
  ];
  const brief = plain ? [] : [
    { label: 'The mission', lines: ui.tasks.map((t, k) => `${k + 1}. ${t.text}${t.foes ? ` (${t.foes})` : ''}${t.seconds ? `: ${t.seconds} s` : ''}`) },
    { label: 'The kit', lines: ui.briefing.kit },
    { label: 'What it teaches', lines: ui.briefing.sections },
    ...how,
  ];
  const state = { ms: {
    title: plain ? ui.title : `Mission · ${ui.title}`, name: ui.title, begin: 'Begin', brief: tabs(brief), how: tabs(how), controls: [],
    menu: [{ label: 'Resume', then: { close: true } }, { label: 'The map', then: { open: 'map' } }, ...(plain ? [] : [{ label: 'The briefing', then: { open: 'briefing' } }]), { label: 'How to play', then: { open: 'how' } }, { label: 'Controls', then: { open: 'controls' } }, { label: 'Start again', then: { emit: 'mission:restart' } }],
    hp: 100, hpMax: 100, peril: 0, weapon: '', mode: '', ammo: 0, magazine: 0, reserve: '', reloading: false,
    rest: { hp: false, gun: false },
    objective: { title: plain ? ui.title : 'The mission', steps: ui.tasks.map((t) => ({ text: t.text, done: false })) },
    order: { on: ui.tasks.length > 0, title: ui.tasks[0]?.text ?? '', step: ui.tasks.length ? `1/${ui.tasks.length}` : '', distance: '' },
    hold: { on: false, left: 0, total: 0, label: 'Hold' },
    radio: { on: false, who: ui.callsign ?? 'Command', line: '' },
    ring: { on: false, hits: [] },
    radar: { marks: [], north: 0, label: `${RADAR.range} m` },
    map: { marks: [], label: 'north up', legend: [{ text: '▲ you' }, ...(plain ? [] : [{ text: '★ the task in hand' }]), { text: '✕ a foe awake' }] },
    result: { outcome: '', stats: [], rank: '', items: [{ label: 'Play it again', then: { emit: 'mission:restart' } }, { label: 'The briefing', then: { open: 'briefing' } }] },
  } };
  const C = manaControls();
  return { theme: themeOf(ui.theme), ...(plain ? { plain: true } : {}), ...(Array.isArray(ui.rect) ? { rect: ui.rect.slice(0, 4) } : {}), spec: missionManaSpec(), glyphs: manaGlyphs(), controls: { keys: C.keys, pad: C.pad }, open: openControls(), state, tasks: ui.tasks, hud: { ...HUD }, ring: { life: RING.life, most: RING.most }, radar: { ...RADAR }, mapKey: 'KeyM', water: ((R) => (R?.water ?? []).map(([i, j]) => [i * R.cell, j * R.cell, (i + 1) * R.cell, (j + 1) * R.cell]))(ui.plan?.map?.blocks?.read), msg: { pause: MSG_PAUSE, controls: MSG_CONTROLS } };
}

/**
 * The sheet: mana-ui's and the theme's, and the page's own HUD put away where mana-ui draws the same thing (the events
 * channel's readouts and the pilot's ammo panel); the reticle, the hit flash and the moments (banners, toasts) stay. The
 * radar, the damage ring and the peril are mana-ui's own parts; the page only sizes them to the screen and lays the plan
 * under the map.
 */
export function missionManaCss(theme, { plain = false } = {}) {
  return [manaCss(), themeCss(theme),
    // (a shooter with no mission keeps its level's own counters, lines and clock: only the health bar gives way)
    // and they stand at the top right, clear of the scope
    plain ? '.moj-hud .moj-w-bar{display:none}.moj-hud-top-left{left:auto;right:12px;align-items:flex-end}' : '.moj-hud .moj-w-counter,.moj-hud .moj-w-text,.moj-hud .moj-w-bar,.moj-hud .moj-w-clock{display:none}',
    'div:has(>#__wepIcon){display:none!important}#wrap .hint{display:none}',
    // (the page's own round radar, the controllable runtime's: this HUD draws the scope, so there is one radar, not two)
    '.moj-c-radar{display:none!important}',
    // the damage ring, sized to the screen round the aim
    '#mana .mana-threat{width:min(46vh,46vw);height:min(46vh,46vw)}',
    // the radar: a round scope, the pilot its middle, its marks small, a foe in the harm's colour; the map: the plan under
    // its marks, large
    '#mana .mana-minimap[data-scope=yes]{width:min(32vh,32vw);height:min(32vh,32vw)}',
    // (a MINIMAP: the level's plan under the scope's marks, at its scale, turned so ahead is up, the pilot at its middle;
    // it fades out before the bezel)
    '#mana .ms-mm{position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;-webkit-mask:radial-gradient(closest-side,#000 80%,transparent 98%);mask:radial-gradient(closest-side,#000 80%,transparent 98%)}',
    '#mana .ms-mm>i{position:absolute;display:block;width:var(--ms-mm-w,0);height:var(--ms-mm-w,0);left:var(--ms-mm-l,0);top:var(--ms-mm-t,0);transform-origin:var(--ms-mm-o,50% 50%);transform:rotate(var(--ms-mm-r,0rad));background:var(--ms-plan,none) center/100% 100% no-repeat;opacity:.8}',
    '#mana .mana-minimap[data-scope=yes] .mana-marker,#mana .mana-minimap[data-scope=yes]>.mana-caption{z-index:1}',
    '#mana .mana-minimap[data-scope=yes]>.mana-caption{left:50%;bottom:9%;transform:translateX(-50%);font-size:1.2vh;opacity:.6}',
    '#mana .mana-minimap[data-scope=yes]::after{content:"▲";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:1.4vh;color:var(--mana-ink,#eef0e6)}',
    '#mana .mana-minimap[data-shape=square]{width:min(62vh,62vw);height:min(62vh,62vw);background:var(--ms-plan,none) center/100% 100% no-repeat #1c1f1c}',
    '#mana .mana-minimap .mana-marker{font-size:1.5vh}#mana .mana-minimap .mana-marker[data-kind=foe]{color:var(--mana-harm,#e0533f)}#mana .mana-minimap .mana-marker[data-kind=goal]{color:var(--mana-accent,#e8b53a);font-size:2vh}',
  ].join('\n');
}

/** The page's code (see the header). */
export function missionManaRuntime(cfg) {
  const S = JSON.parse(JSON.stringify(cfg.state)), P = S.ms;
  const root = document.createElement('div');
  root.id = 'mana';
  document.body.appendChild(root);
  const rt = __manaUi.runtime(cfg.spec, { read: (p) => __manaUi.readPath(S, p), act, now: () => performance.now() / 1000, cues: 'silent' });
  rt.glyphs(cfg.glyphs);
  const view = __manaUi.mount(root, rt, { auto: true });
  // the map's key: opens it over the held scene, and closes it again (listened for ahead of the menu's host, which
  // takes the keys it knows while a screen is up)
  addEventListener('keydown', (e) => {
    if (e.code !== cfg.mapKey || ended) return;
    if (up && onMap) { e.preventDefault(); rt.close(); view.paint(); return; }
    if (!up && !shut && !e.defaultPrevented && !window.__mojMenuOpen) { e.preventDefault(); open('map'); read(); view.paint(); }
  }, true);
  __manaHostK.connect(rt, view, { keys: cfg.controls.keys, pad: cfg.controls.pad, padLayout: __manaPadLayout });
  let up = false, shut = false, ended = false, onMap = false;
  const hosted = (function () { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();
  const hold = (on) => { try { window.postMessage({ moj: cfg.msg.pause, on }, '*'); } catch (e) { /* no scene */ } };
  const world = () => (window.__mojCtrl && window.__mojCtrl.world) || null;
  const vars = () => (window.__mojBus && window.__mojBus.state && window.__mojBus.state.vars) || {};
  function open(screen) {
    if (up) return;
    up = true;
    try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* no lock */ }
    rt.open(screen);
    onMap = screen === 'map';
    hold(true);
    view.paint();
  }
  function act(e) {
    if (e.emit === 'mana:closed') {
      up = false; shut = true; setTimeout(() => { shut = false; }, 0);
      if (!ended) hold(false);
      return;
    }
    if (e.emit === 'mission:restart') { try { location.reload(); } catch (err) { /* a page that cannot reload */ } }
  }
  // the scene's answer to the hold: the controls this world answers to, read off its live bindings
  addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.moj === cfg.msg.controls && Array.isArray(d.rows)) { P.controls = d.rows.map((r) => ({ keys: String(r[0]), label: String(r[1]) })); view.paint(); }
  });
  // the pilot's pause opens the menu (its keys, its pad button), only while no screen is up: up, the host has the input
  addEventListener('keydown', (e) => { if (!up && !shut && !ended && !e.defaultPrevented && !window.__mojMenuOpen && cfg.open.keys.indexOf(e.code) >= 0) { e.preventDefault(); open('pause'); } }, true);
  const was = {};
  // (when each readout last changed: the clock it rests on)
  const calm = { gun: '', gunT: 0, hp: -1, hpT: 0 };
  // THE HUD: read off the scene each frame, painted when what it shows has changed
  let shown = '', said = -1, saidT = 0;
  // THE DAMAGE RING (damage-ring.js): the marks standing this frame, from the pilot's own count of hits
  const ring = __msRing(cfg.ring, __msBearing);
  // THE RADAR AND THE MAP (radar.js): the plan drawn once from the scene's own colliders, the marks read each frame
  let plan = null;
  function planOf(W) {
    if (plan) return plan;
    // (the floor it is of: the pilot's own feet when the plan is first drawn)
    const me = W.entities.find((x) => x.pilotable), z0 = me && me.transform ? me.transform.pos[2] - ((me.rule && me.rule.eye) || 0) : 0;
    plan = __msPlanBox(W.colliders, cfg.water, cfg.rect || null);
    try { root.style.setProperty('--ms-plan', 'url("data:image/svg+xml,' + encodeURIComponent(__msPlanSvg(W.colliders, cfg.water, plan, Math.abs(z0) < 0.6 ? 0 : z0)) + '")'); } catch (e) { /* a page with no style */ }
    return plan;
  }
  function read() {
    const W = world(), v = vars(), me = W && W.entities.find((x) => x.pilotable), w = me && me.weapon;
    const t = performance.now() / 1000;
    if (Number.isFinite(v.hp)) P.hp = Math.max(0, Math.round(v.hp));
    // (a level that keeps no health on the bus, a bout: the pilot's own body's)
    else if (me && me.body && Number.isFinite(me.body.hp)) { P.hp = Math.max(0, Math.round(me.body.hp)); if (Number.isFinite(me.hpMax) && me.hpMax > 0) P.hpMax = me.hpMax; }
    // the screen's edge: nothing over the health's half, closing in to all of it near none
    const share = P.hpMax > 0 ? P.hp / P.hpMax : 1;
    P.peril = Math.round(Math.min(1, Math.max(0, (cfg.hud.peril - share) / (cfg.hud.peril - cfg.hud.end))) * 20) / 20;
    const slot = me && me.rule && me.rule.loadout ? me.rule.loadout[me.loadoutIdx || 0] : null;
    if (slot && slot.fire === 'melee') {
      // (a blade in hand: its wireframe and name, nothing counted)
      P.weapon = slot.name || ''; P.mode = ''; P.reloading = false; P.ammo = 0; P.magazine = 0; P.reserve = '';
    } else if (w) {
      P.weapon = (slot && slot.name) || '';
      P.mode = w.fireClass === 'lob' ? 'Launcher' : w.auto ? 'Auto' : w.burst > 1 ? 'Burst' : 'Semi';
      P.reloading = !!w.reloading;
      P.ammo = w.reloading ? 0 : (w.ammo == null ? 0 : w.ammo);
      P.magazine = Number.isFinite(w.magazine) ? w.magazine : 0;
      // (no reserve: the reload is endless)
      P.reserve = Number.isFinite(w.reserve) ? w.reserve : '∞';
    }
    // AT REST: a readout that has held no news for a moment fades back (a full magazine, full health); a change wakes it
    const gunKey = [P.weapon, P.ammo, P.reloading].join('|'), full = P.magazine > 0 && P.ammo >= P.magazine && !P.reloading;
    if (gunKey !== calm.gun) { calm.gun = gunKey; calm.gunT = t; }
    if (P.hp !== calm.hp) { calm.hp = P.hp; calm.hpT = t; }
    P.rest.gun = full && t - calm.gunT > cfg.hud.rest;
    P.rest.hp = P.hp >= P.hpMax && t - calm.hpT > cfg.hud.rest;
    const n = Number.isFinite(v.__obj) ? v.__obj : 0;
    for (let k = 0; k < cfg.tasks.length; k++) P.objective.steps[k].done = k < n;
    const T = cfg.tasks[n], held = !!T && T.kind === 'hold' && v['__obj_on' + n] === 1;
    // THE ORDER, SPOKEN: as a task begins (the first once the briefing is shut) its line stands a few seconds
    if (n !== said && !up && cfg.tasks[n]) { said = n; P.radio.line = cfg.tasks[n].say || ''; saidT = t; }
    P.radio.on = !!P.radio.line && said === n && t - saidT < cfg.hud.radio && !up;
    P.order.on = cfg.tasks.length > 0;
    P.order.title = T ? T.text : 'Mission complete';
    P.order.step = T ? (n + 1) + '/' + cfg.tasks.length : '';
    P.hold.on = held; P.hold.left = held ? v['__obj_left' + n] : 0; P.hold.total = T && T.seconds ? T.seconds : 0;
    P.ring.hits = me ? ring.step(W, me) : [];
    P.ring.on = P.ring.hits.length > 0;
    if (me && me.transform) {
      const pos = me.transform.pos, things = __msThings(W, me, T && T.at ? T.at : null), box = planOf(W);
      P.radar.marks = __msRadar(pos, me.transform.heading, things, cfg.radar);
      // THE MINIMAP: the plan under the scope, the pilot's place on it at the scope's middle, turned so ahead is up
      // (a side of the plan is `box[2]` m; the scope's width is twice the radar's range)
      {
        const w = box[2] / (2 * cfg.radar.range), px = (pos[0] - box[0]) / box[2], py = 1 - (pos[1] - box[1]) / box[2], pc = (v) => Math.round(v * 10000) / 100 + '%';
        root.style.setProperty('--ms-mm-w', pc(w)); root.style.setProperty('--ms-mm-l', pc(0.5 - px * w)); root.style.setProperty('--ms-mm-t', pc(0.5 - py * w));
        root.style.setProperty('--ms-mm-o', pc(px) + ' ' + pc(py)); root.style.setProperty('--ms-mm-r', Math.round(((me.transform.heading || 0) - Math.PI / 2) * 1000) / 1000 + 'rad');
        const sc = root.querySelector('.mana-minimap[data-scope=yes]');
        if (sc && !sc.querySelector(':scope>.ms-mm')) { const d = document.createElement('div'); d.className = 'ms-mm'; d.appendChild(document.createElement('i')); sc.insertBefore(d, sc.firstChild); }
      }
      // (north on the radar's bezel: where +y lies from where the pilot faces)
      P.radar.north = __msBearing(pos, me.transform.heading, [pos[0], pos[1] + 1, 0]);
      P.map.marks = up ? things.map((x) => Object.assign(__msPlanPoint(box, x.at), { kind: x.kind })).concat([Object.assign(__msPlanPoint(box, pos), { kind: 'self' })]) : [];
      // how far: to the task's place, else how many foes still stand awake for it
      const foes = things.filter((x) => x.kind === 'foe').length;
      P.order.distance = !T ? '' : T.at ? Math.round(Math.hypot(T.at[0] - pos[0], T.at[1] - pos[1])) + ' m' : T.kind === 'clear' && foes ? foes + (foes === 1 ? ' hostile' : ' hostiles') : '';
    }
    // (a mark is repainted when it has moved five degrees: a turning pilot's ring turns, a still one's is left alone)
    const now = JSON.stringify([P.radio.on, P.radio.line, P.hp, P.peril, P.weapon, P.mode, P.ammo, P.magazine, P.reserve, P.reloading, P.rest.gun, P.rest.hp, n, P.order.distance, P.hold.on, P.hold.left, P.ring.hits.map((x) => [Math.round(x.bearing / 5), Math.round(x.fade * 5)]), P.radar.marks.map((x) => [Math.round(x.x * 40), Math.round(x.y * 40), x.kind]), Math.round(P.radar.north / 5), P.map.marks.length]);
    if (now !== shown) { shown = now; view.paint(); }
    // the end: the level's one envelope; alone, the debrief; in a shell, the shell's own result screen
    const G = window.__mojGame, env = G && G.envelope;
    if (env && !ended) {
      ended = true;
      if (!hosted && !cfg.plain) {
        // (the foes downed and the seconds taken are the objectives' own count on the bus)
        const down = Number.isFinite(v.__obj_downs) ? v.__obj_downs : 0, secs = Number.isFinite(v.__obj_time) ? v.__obj_time : 0, won = env.result === 'success';
        P.result.outcome = won ? 'Mission complete' : 'Mission failed';
        P.result.stats = [{ label: 'Time (s)', value: secs }, { label: 'Tasks met', value: Math.min(n, cfg.tasks.length) }, { label: 'Foes down', value: down }, { label: 'Health left', value: P.hp }];
        P.result.rank = !won ? '—' : P.hp >= 75 ? 'A' : P.hp >= 40 ? 'B' : 'C';
        if (up) { rt.close(); up = false; }
        open('debrief');
      }
    }
  }
  (function frame() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    for (const g of pads) {
      if (!g) continue;
      const on = cfg.open.pad.some((i) => g.buttons[i] && g.buttons[i].pressed);
      if (on && !was[g.index] && !up && !shut && !ended && !window.__mojMenuOpen) open('pause');
      was[g.index] = on;
    }
    if (world()) read();
    requestAnimationFrame(frame);
  })();
  // the briefing: open over the held scene once it stands
  (function ready() {
    if (!world()) { requestAnimationFrame(ready); return; }
    read();
    if (!cfg.plain) open('briefing');
    // (with no mission the page keeps its own readouts: the health's own row gives way, since this HUD draws it; the
    // page's round radar is put away by the sheet)
    else {
      for (const l of document.querySelectorAll('.moj-hud .moj-w .moj-lbl')) if (/^(hp|health)$/i.test(l.textContent.trim())) l.parentElement.style.display = 'none';
    }
  })();
  // for a headless driver
  window.__mojMission = { rt, state: S, view, open, get up() { return up; }, get ended() { return ended; }, get hosted() { return hosted; } };
}

/** The block the page's mission channel splices: the sheet, the kernel, the host and the runtime, in a scope of its own. */
export function missionChannelSource(ui) {
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  const { theme, ...page } = missionMana(ui);
  return `{
const __manaUi = ${manaUiSource()};
const __manaHostK = ${manaHostSource()};
const __manaPadLayout = (${padLayoutSource()});
const __msBearing = ${hitBearing.toString()};
const __msRing = ${ringTracker.toString()};
const __msRadar = ${radarMarks.toString()};
const __msPlanBox = ${planBox.toString()};
const __msPlanPoint = ${planPoint.toString()};
const __msPlanSvg = ${planSvg.toString()};
const __msThings = ${sceneThings.toString()};
const __msCss = document.createElement('style');
__msCss.textContent = ${json(missionManaCss(theme, { plain: ui.plain === true }))};
document.head.appendChild(__msCss);
(${missionManaRuntime.toString()})(${json(page)});
}`;
}
