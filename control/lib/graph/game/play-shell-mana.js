/**
 * play-shell-mana — the play shell's screens drawn by mana-ui (control/lib/mana-ui/), the game UI runtime: opt in by a
 * game's `ui` ({ theme, languages?, language? }: the look resolved, a preset or a theme object; design_game writes it
 * from a gameworld's `ui` through playscape/ui/interface-look.js). The flow runner (play-shell.js) still says what plays
 * when; this draws its screen steps, and the loading screen over a level's frame. A game without `ui` carries none of
 * this: no kernel, no sheet, no theme, no host.
 *
 *   readShellUi(ui, where?)      → errors[] (teaching): the theme mana-ui reads, the game's languages
 *   shellManaSpec(ui, { picks }) → (picks: the game's turns ask for picks, turn.js: a `pick` screen too) the spec: the screens (attract, title, levels, options, credits, end, result,
 *                                  pause, controls, loading) and a HUD of passing moments as idioms over the shell's UI state (`ui.*` bindings), each pick an effect
 *                                  { emit: <the flow's event> }; the defs only of the idioms it uses
 *   shellManaCss(ui)             → the sheet and the theme, scoped to the mana root
 *   shellManaScript()            → the page's code: the kernel, the controls host, and `__mojMana`
 *   shellManaConfig(ui, opts)    → cfg.mana: { spec, glyphs, controls: { keys, pad } }
 *   playShellManaRuntime(cfg, api) → (inlined) { draw(name), close(), loading(place), loaded(), pause(), unpause(),
 *                                  moment(text, sub?) }: the shell's api is
 *                                  { go, onOf, show, app, title, front, levels(), result(), run(), settings(),
 *                                  saveSettings, pushPrefs, reset, continueTo, runTitle(), pause: { resume, restart,
 *                                  quit, sound, rows(), owner(), homeWord() } }
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const PICK = 'pick-screen';
const USED = ['attract-screen', 'title-screen', 'mode-select', 'options-screen', 'results-screen', 'loading-screen', 'pause-menu'];
const B = (p) => ({ bind: `ui.${p}` });

/** A game's `ui` as the shell takes it: every fault said. */
export function readShellUi(ui, where = 'ui') {
  if (!isObj(ui)) return [`${where} is { theme, languages?, language? }: the look the game's screens are drawn in by mana-ui`];
  const errors = [];
  for (const k of Object.keys(ui)) if (!['theme', 'languages', 'language'].includes(k)) errors.push(`${where}.${k}: not part of a game's ui (theme, languages, language)`);
  try { readTheme(ui.theme === undefined ? 'greybox' : ui.theme); } catch (e) { errors.push(`${where}.theme: ${e.message}`); }
  if (ui.languages !== undefined || ui.language !== undefined) {
    try { manaUi.readSpec({ screens: {}, languages: ui.languages, language: ui.language }); } catch (e) { errors.push(`${where}: ${e.message}`); }
  }
  return errors;
}

/** The shell's screens as mana-ui draws them. */
export function shellManaSpec(ui = {}, { picks = false } = {}) {
  const button = (word, emit) => ({ use: 'button', props: { label: { word } }, on: { accept: { emit } } });
  const screens = {
    attract: { use: 'attract-screen', props: { title: B('title'), prompt: B('press'), then: { emit: 'press' } } },
    title: { use: 'title-screen', props: { title: B('title'), subtitle: B('tagline'), items: B('menu'), version: B('version') } },
    levels: { use: 'mode-select', props: { title: B('levelsTitle'), modes: B('levels') } },
    options: { use: 'options-screen', props: { title: B('optionsTitle'), sections: [{ label: 'Audio', fields: [{ kind: 'toggle', label: 'Sound', var: 'ui.settings.sound' }] }] } },
    // the roll: each role and its names, the thanks, the line that says what made it; done goes on
    credits: { use: 'screen', props: { title: B('title'), place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'each', props: { rows: B('credits'), row: { use: 'stack', props: { gap: 'tight' }, children: [{ use: 'text', props: { value: { item: 'role' }, role: 'label' } }, { use: 'text', props: { value: { item: 'names' } } }] } } },
      button('done', 'done'),
    ] }] }] },
    // the game complete: its words, its title, on
    end: { use: 'screen', props: { place: 'center' }, children: [{ use: 'stack', props: { align: 'center', gap: 'loose' }, children: [
      { use: 'text', props: { value: B('endMark'), role: 'heading' } },
      { use: 'text', props: { value: B('endText'), role: 'display' } },
      { use: 'text', props: { value: B('title'), role: 'caption' } },
      button('continue', 'done'),
    ] }] },
    result: { use: 'results-screen', props: { outcome: B('result.outcome'), stats: B('result.stats'), rank: B('result.rank'), items: B('result.items') } },
    // the pause over a held level: resume, restart, the controls, the sound, the way out (back resumes)
    pause: { use: 'pause-menu', props: { title: B('pause.title'), items: B('pause.items') } },
    // what the level's controls are, as the level says them (its live bindings): read, and back
    controls: { use: 'screen', props: { title: B('pause.controlsTitle'), layer: 'modal', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'each', props: { rows: B('pause.rows'), row: { use: 'stack', props: { dir: 'row', align: 'apart', gap: 'loose' }, children: [{ use: 'text', props: { value: { item: 'does' }, role: 'label' } }, { use: 'text', props: { value: { item: 'keys' } } }] } } },
      { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } },
    ] }] }] },
    // over a level's frame while it loads: no number to claim, ready on its first frame, gone by itself (a quick load never shows)
    loading: { use: 'loading-screen', props: { place: B('load.place'), ready: B('load.ready'), auto: true, then: { emit: 'loaded' } } },
  };
  // UNTAP (turn.js): one pick of a level's turn, the pick-screen idiom over what the shell says of it (the store's
  // rows, what was chosen before, why the game sent the player back); back unwinds one pick, the stack closing
  if (picks) screens.pick = { use: PICK, props: { ...Object.fromEntries(['title', 'ask', 'hint', 'step', 'steps', 'chosen', 'rows', 'faces', 'many', 'short', 'shortWhy', 'why'].map((k) => [k, B(`pick.${k}`)])), confirm: { emit: 'turn:confirm' } } };
  // what passes over the play: a moment, one at a time (a run's map cleared)
  const hud = { use: 'hud', children: [{ use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 1.6, read: 0.6 } }] }] };
  const full = withIdioms({ screens, hud, ...(ui.languages ? { languages: ui.languages } : {}), ...(ui.language ? { language: ui.language } : {}) });
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USED.includes(k) || (picks && k === PICK)));
  manaUi.readSpec(full);
  return full;
}

// (the image component draws a placeholder until it takes a picture: a game's screens show none of its marks, where a
// wireframe would; a backdrop keeps its ground, the theme's own)
export const shellManaCss = (ui = {}) => `${manaCss()}\n${themeCss(ui.theme === undefined ? 'greybox' : ui.theme)}\n#mana .mana-image:not([data-ratio=backdrop]){display:none}#mana .mana-image .mana-caption{display:none}#mana .mana-image[data-ratio=backdrop]{background-image:none!important}`;
export function shellManaConfig(ui = {}, opts = {}) {
  const C = manaControls();
  return { spec: shellManaSpec(ui, opts), glyphs: manaGlyphs(), controls: { keys: C.keys, pad: C.pad } };
}
export const shellManaScript = () => `const __manaUi = ${manaUiSource()};
const __manaHostK = ${manaHostSource()};
const __manaPadLayout = (${padLayoutSource()});
const __mojMana = (${playShellManaRuntime.toString()});`;

/**
 * The page's code (inlined with toString(), references nothing outside itself but the kernel, the host and the pad
 * reader inlined beside it). One mana-ui runtime over the page; the flow runner draws a screen step by switching its
 * stack to it, and closes it for a level. A close the runner makes is never the player's back.
 */
export function playShellManaRuntime(cfg, api) {
  const M = cfg.mana, UI = { ui: { title: api.title, version: '', settings: { sound: api.settings().sfxOn ? 1 : 0 }, load: { place: '', ready: false }, moments: [], pause: { title: 'paused', controlsTitle: 'controls', items: [], rows: [] } } };
  const root = document.createElement('div');
  root.id = 'mana';
  document.body.appendChild(root);
  let quiet = false, up = null;
  const rt = __manaUi.runtime(M.spec, { read: (p) => __manaUi.readPath(UI, p), act, now: () => performance.now() / 1000, countUp: 0.8, cues: 'silent' });
  rt.glyphs(M.glyphs);
  const view = __manaUi.mount(root, rt, { auto: true });
  window.__mojManaUi = rt; window.__mojManaState = UI;   // the runtime and what it reads, for a headless driver
  __manaHostK.connect(rt, view, { keys: M.controls.keys, pad: M.controls.pad, padLayout: __manaPadLayout });
  const L = api.settings().language;
  if (L) { try { rt.language(L); } catch (e) { /* a language the game no longer ships */ } }

  function hush(fn) { quiet = true; try { fn(); } finally { quiet = false; } }
  function act(e) {
    if (e.emit === 'mana:closed') {
      if (quiet) return;
      // (a pick left by its back: the turn unwinds one pick, or is left)
      if (up === 'pick') { up = null; api.turn.back(); return; }
      // (the pause left by its back: the game resumes)
      if (up === 'pause' || up === 'controls') { up = null; api.pause.resume(); return; }
      // a back that emptied the stack: the step's back, else the screen it left drawn again
      const was = up;
      up = null;
      if (!(api.onOf('back') && api.go('back'))) draw(was);
      return;
    }
    if (e.emit === 'turn:pick') { api.turn.pick(e.id); return; }
    if (e.emit === 'turn:confirm') { api.turn.confirm(); return; }
    if (e.emit === 'pause:resume') { api.pause.resume(); return; }
    if (e.emit === 'pause:restart') { api.pause.restart(); return; }
    if (e.emit === 'pause:quit') { api.pause.quit(); return; }
    if (e.emit === 'pause:sound') { api.pause.sound(); fillPause(); view.paint(); return; }
    if (e.emit === 'loaded') { hush(() => rt.close()); up = null; view.paint(); return; }
    if (e.emit === 'language') { api.settings().language = e.to; api.saveSettings(); return; }
    if (e.emit === 'options:reset') { api.reset(); api.go('back'); return; }
    if (typeof e.emit === 'string') { api.go(e.emit, e.level ? { picked: e.level } : null); return; }
    if (e.set === 'ui.settings.sound') { UI.ui.settings.sound = e.to ? 1 : 0; api.settings().sfxOn = !!e.to; api.saveSettings(); api.pushPrefs(); }
  }
  // the pause's rows as the shell stands: whose pause it is, the sound as it is, the level's own controls
  function fillPause() {
    const P = api.pause, u = UI.ui.pause, owner = P.owner();
    u.title = owner ? 'paused · ' + owner : 'paused';
    u.items = [{ label: 'resume', then: { emit: 'pause:resume' } }, { label: 'restart', then: { emit: 'pause:restart' } }, { label: 'controls', then: { open: 'controls' } },
      { label: 'sound: ' + (api.settings().sfxOn ? 'on' : 'off'), then: { emit: 'pause:sound' } }, { label: 'quit to ' + P.homeWord(), then: { emit: 'pause:quit' } }];
    u.rows = P.rows().map((r) => ({ keys: r[0], does: r[1] }));
  }
  function open(id) { hush(() => { rt.close(); rt.open(id); }); up = id; view.paint(); }

  // what each screen reads, from the shell as it stands
  function fill(name) {
    const F = api.front || {}, u = UI.ui;
    if (name === 'attract' || name === 'title') {
      u.press = F.press || 'press start';
      u.tagline = F.tagline || '';
      const entries = F.menu || ['play'];
      // (a RUN: its rules under the title, how deep the best went in the corner, and its own word for play)
      const R = api.runTitle ? api.runTitle() : null;
      if (R) { u.tagline = F.tagline || R.rules; u.version = R.best; }
      const label = { continue: 'continue', play: R ? (R.runs ? 'new run' : 'start a run') : api.progress() ? 'new game' : 'start', levels: 'levels', options: 'options', credits: 'credits' };
      u.menu = entries.filter((k) => api.onOf(k) && (k !== 'continue' || api.continueTo())).map((k) => ({ label: label[k] || k, then: { emit: k } }));
    }
    if (name === 'levels') {
      u.levelsTitle = 'levels';
      u.levels = api.levels().map((l) => ({ id: l.ref, name: l.title, about: l.lock || (l.cleared ? 'cleared' : ''), players: '', disabled: !l.open, then: { emit: 'pick', level: l.ref } }));
    }
    if (name === 'options') u.optionsTitle = 'options';
    if (name === 'credits') u.credits = ((F.credits && F.credits.roll) || []).map((r) => ({ role: r.role, names: r.names.join(' · ') })).concat(F.credits && F.credits.attribution === false ? [] : [{ role: '', names: 'made with mojulo · github.com/zombico/mojulo' }]);
    if (name === 'end') { u.endMark = 'game complete'; u.endText = (F.end && F.end.text) || 'The end'; }
    if (name === 'result' || name === 'run-result') u.result = name === 'result' ? api.result() : api.run();
  }
  function draw(name) {
    if (!name) return false;
    fill(name);
    api.app.textContent = '';
    api.show('title');
    open(name === 'run-result' ? 'result' : name);
    return true;
  }
  return {
    draw,
    close() { hush(() => rt.close()); up = null; view.paint(); },
    loading(place) { UI.ui.load = { place: place || '', ready: false }; open('loading'); },
    loaded() { UI.ui.load = Object.assign({}, UI.ui.load, { ready: true }); view.paint(); },
    // untap: one pick of the turn, as the shell stands (what the pick-screen idiom reads)
    // (`fresh`: another pick than the one up, so the cursor starts at its first row)
    pick(what, fresh) { UI.ui.pick = what; api.app.textContent = ''; api.show('title'); if (up === 'pick' && !fresh) view.paint(); else { open('pick'); rt.focusAt(0); view.paint(); } },
    // the pause over a held level, and off again; a moment over the play (a run's map cleared)
    pause() { fillPause(); open('pause'); },
    unpause() { if (up === 'pause' || up === 'controls') { hush(() => rt.close()); up = null; view.paint(); } },
    moment(text, sub) { UI.ui.moments = UI.ui.moments.concat([{ id: 'm' + UI.ui.moments.length, text: text, sub: sub || '', weight: 'major' }]); view.paint(); },
  };
}
