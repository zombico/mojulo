/**
 * THE MISSION ON MANA-UI — a mission launched end to end on the game UI runtime (control/lib/mana-ui/), driven by the
 * controls layer (controls/mana-host.js) as the practice rooms' menu is (practice-mana.js): the briefing over the held
 * scene, the HUD while it plays, the pause, the debrief. One input paradigm: the keys, every pad layout and a finger
 * pick the same rows, and each control is named as the controls kernel names it.
 *
 *   the briefing   open as the page loads, the scene held behind it: the mission (its tasks in order), the kit (each gun
 *                  and the band it is for), how to play; Begin plays
 *   the HUD        the level's hp (a bar), the gun in hand with its magazine and reserve, the objective tracker (the
 *                  task in hand, every task ticked as it is met), the yard's clock while it is held. Read each frame off
 *                  the scene: the bus's vars (the hp, the objectives' own var, the hold's clock) and the pilot's weapon.
 *                  The reticle stays the gunplay view's own (its cone, its hit flash and its sights are the gun's)
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
 *
 * The look: the theme the manifest names (the world's interface where it writes one, else the `field-brief` theme
 * card), with no overlay across the screen either way.
 *
 * The page's side only: it imports the UI runtime, the controls layer and the theme cards, and nothing of the gameworld
 * (the scene's emitter reads it through its mission channel: scene/channels/mission.js).
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';
import { MSG_PAUSE, MSG_CONTROLS } from '../game/level-contract.js';
import { THEME_CARDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';

const K = buildControlsKernel();
const B = (p) => ({ bind: `ms.${p}` });
const I = (f) => ({ item: f });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const back = { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } };
const USES = ['pause-menu', 'results-screen', 'objective-tracker', 'ammo-counter'];
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
      { use: 'region', props: { at: 'top-left' }, children: [{ use: 'stack', props: { gap: 'tight' }, children: [txt(B('name'), 'heading'), { use: 'bar', props: { label: { word: 'hp' }, value: B('hp'), max: B('hpMax'), variant: 'hp' } }] }] },
      { use: 'objective-tracker', props: { title: B('objective.title'), steps: B('objective.steps') } },
      { use: 'region', props: { at: 'top-right' }, children: [{ use: 'counter', props: { label: B('hold.label'), value: B('hold.left') } }], when: B('hold.on') },
      { use: 'ammo-counter', props: { weapon: B('weapon'), ammo: B('ammo'), reserve: B('reserve') } },
    ] },
    screens: {
      briefing: tabsScreen(B('title'), B('brief'), [{ use: 'button', props: { label: B('begin') }, on: { accept: { close: true } } }]),
      pause: { use: 'pause-menu', props: { title: B('title'), items: B('menu') } },
      how: tabsScreen('How to play', B('how'), [back]),
      controls: { use: 'screen', props: { title: 'Controls', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
        { use: 'each', props: { rows: B('controls'), row: { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [txt(I('label')), txt(I('keys'), 'label')] } } },
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
  const how = [
    { label: 'Moving', lines: [{ glyph: 'W A S D', text: 'move' }, { glyph: 'mouse', text: 'look' }, { action: 'jump', text: 'jump' }, { action: 'pause', text: 'this menu' }] },
    { label: 'The guns', lines: [{ action: 'fire', text: 'fire' }, { glyph: 'right click', text: 'raise the sights' }, { glyph: 'R', text: 'reload (what is left in the magazine is lost)' }, { glyph: '1-5', text: 'switch' }, { glyph: 'V', text: 'the knife, where one is carried' }] },
    { label: 'The rules', lines: ['Each room has one task. Its way on is sealed until the task is met.', 'A room\'s foes wake as you walk into it, never before.', 'Rounds and health lie on the floor: walk over them.'] },
  ];
  const brief = [
    { label: 'The mission', lines: ui.tasks.map((t, k) => `${k + 1}. ${t.text}${t.foes ? ` (${t.foes})` : ''}${t.seconds ? `: ${t.seconds} s` : ''}`) },
    { label: 'The kit', lines: ui.briefing.kit },
    { label: 'What it teaches', lines: ui.briefing.sections },
    ...how,
  ];
  const state = { ms: {
    title: `Mission · ${ui.title}`, name: ui.title, begin: 'Begin', brief: tabs(brief), how: tabs(how), controls: [],
    menu: [{ label: 'Resume', then: { close: true } }, { label: 'The briefing', then: { open: 'briefing' } }, { label: 'How to play', then: { open: 'how' } }, { label: 'Controls', then: { open: 'controls' } }, { label: 'Start again', then: { emit: 'mission:restart' } }],
    hp: 100, hpMax: 100, weapon: '', ammo: 0, reserve: 0,
    objective: { title: ui.tasks[0]?.text ?? '', steps: ui.tasks.map((t) => ({ text: t.text, done: false })) },
    hold: { on: false, left: 0, label: 'Hold' },
    result: { outcome: '', stats: [], rank: '', items: [{ label: 'Play it again', then: { emit: 'mission:restart' } }, { label: 'The briefing', then: { open: 'briefing' } }] },
  } };
  const C = manaControls();
  return { theme: themeOf(ui.theme), spec: missionManaSpec(), glyphs: manaGlyphs(), controls: { keys: C.keys, pad: C.pad }, open: openControls(), state, tasks: ui.tasks, msg: { pause: MSG_PAUSE, controls: MSG_CONTROLS } };
}

/**
 * The sheet: mana-ui's and the theme's, and the page's own HUD put away where mana-ui draws the same thing (the events
 * channel's readouts and the pilot's ammo panel); the reticle, the hit flash and the moments (banners, toasts) stay.
 */
export function missionManaCss(theme) {
  return [manaCss(), themeCss(theme),
    '.moj-hud .moj-w-counter,.moj-hud .moj-w-text,.moj-hud .moj-w-bar,.moj-hud .moj-w-clock{display:none}',
    'div:has(>#__wepIcon){display:none!important}#wrap .hint{display:none}',
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
  __manaHostK.connect(rt, view, { keys: cfg.controls.keys, pad: cfg.controls.pad, padLayout: __manaPadLayout });
  let up = false, shut = false, ended = false;
  const hosted = (function () { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();
  const hold = (on) => { try { window.postMessage({ moj: cfg.msg.pause, on }, '*'); } catch (e) { /* no scene */ } };
  const world = () => (window.__mojCtrl && window.__mojCtrl.world) || null;
  const vars = () => (window.__mojBus && window.__mojBus.state && window.__mojBus.state.vars) || {};
  function open(screen) {
    if (up) return;
    up = true;
    try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* no lock */ }
    rt.open(screen);
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
  // THE HUD: read off the scene each frame, painted when what it shows has changed
  let shown = '';
  function read() {
    const W = world(), v = vars(), me = W && W.entities.find((x) => x.pilotable), w = me && me.weapon;
    if (Number.isFinite(v.hp)) P.hp = Math.max(0, Math.round(v.hp));
    if (w) {
      const slot = me.rule && me.rule.loadout ? me.rule.loadout[me.loadoutIdx || 0] : null;
      P.weapon = (slot && slot.name) || '';
      P.ammo = w.reloading ? 0 : (w.ammo == null ? 0 : w.ammo);
      P.reserve = Number.isFinite(w.reserve) ? w.reserve : 0;
    }
    const n = Number.isFinite(v.__obj) ? v.__obj : 0;
    P.objective.title = n < cfg.tasks.length ? cfg.tasks[n].text : 'Done';
    for (let k = 0; k < cfg.tasks.length; k++) P.objective.steps[k].done = k < n;
    const T = cfg.tasks[n], held = !!T && T.kind === 'hold' && v['__obj_on' + n] === 1;
    P.hold.on = held; P.hold.left = held ? v['__obj_left' + n] : 0;
    const now = JSON.stringify([P.hp, P.weapon, P.ammo, P.reserve, n, P.hold.on, P.hold.left]);
    if (now !== shown) { shown = now; view.paint(); }
    // the end: the level's one envelope; alone, the debrief; in a shell, the shell's own result screen
    const G = window.__mojGame, env = G && G.envelope;
    if (env && !ended) {
      ended = true;
      if (!hosted) {
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
    open('briefing');
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
const __msCss = document.createElement('style');
__msCss.textContent = ${json(missionManaCss(theme))};
document.head.appendChild(__msCss);
(${missionManaRuntime.toString()})(${json(page)});
}`;
}
