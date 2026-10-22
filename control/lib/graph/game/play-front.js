/**
 * play-front — the FRONT of a light-shell game (play-shell.js): its title screen drawn over a cover, the start menu,
 * the options, the credits roll, and the end when the last level is cleared. Opt-in: a game without `front` emits
 * none of this (no CSS, no code, no config key), and its shell is as it was.
 *
 *   front: {
 *     cover?:   '<cover sketch ref>' | { art: '<image url/path>' }   the title's backdrop; a cover (create_cover
 *               for_kind 'game') carries its own title lockup and a menu zone the menu is placed in
 *     layout?:  center | lower-third | left | right      where the title and the menu sit when no cover zone says
 *     tagline?: words under the title (a cover's own lockup carries its tagline itself)
 *     press?:   true | words                           an attract screen first: "press start", any key or button
 *     menu?:    [continue | play | levels | options | credits]   the start menu, in order (default: what the game has)
 *     credits?: { roll?: [{ role, names: [..] }], thanks?, closing?, attribution? }   the roll; attribution: false
 *               drops the closing "made with mojulo" line
 *     end?:     { text?, credits? }                    the card when the last level is first cleared, then the roll
 *   }
 *
 *   FRONT_ENTRIES, FRONT_LAYOUTS
 *   readFront(front, { levels, run, where })   → errors[] (teaching); shape only (a cover ref resolves in game-resolve)
 *   frontConfig(front, resolvedArt, { levels, run })   → the page's cfg.front: the menu defaulted, the art resolved
 *   FRONT_CSS                                  the front's sheet, laid after the shell's own
 *   playFrontRuntime(cfg, api)                 the page's code (inlined with toString(), references nothing outside
 *                                              itself) → { title(), end(level, envelope), rollFromRun() }
 */

export const FRONT_ENTRIES = Object.freeze(['continue', 'play', 'levels', 'options', 'credits']);
// the words the front writes in when the game leaves them out (frontConfig): the shell's words, localized as its own are
export const FRONT_WORDS = Object.freeze({ press: 'press start', end: 'The end' });
export const FRONT_LAYOUTS = Object.freeze(['center', 'lower-third', 'left', 'right']);
const KEYS = ['cover', 'layout', 'tagline', 'press', 'menu', 'credits', 'end'];
const REF = /^[A-Za-z0-9_-]{1,64}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/** A front's shape, read; every fault said. `levels` is how many the game has, `run` whether it is a run. */
export function readFront(front, { levels = 1, run = false, where = 'front' } = {}) {
  const errors = [];
  if (!isObj(front)) return [`${where} is { ${KEYS.join('?, ')}? }: the game's title screen, start menu, credits and end`];
  for (const k of Object.keys(front)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not a front setting (${KEYS.join(', ')})`);
  const c = front.cover;
  if (c !== undefined && !(typeof c === 'string' && REF.test(c)) && !(isObj(c) && isStr(c.art) && Object.keys(c).length === 1)) {
    errors.push(`${where}.cover is a cover sketch's ref (create_cover for_kind 'game': its art, its title lockup and its menu zone) or { art: '<image url/path>' }`);
  }
  if (front.layout !== undefined && !FRONT_LAYOUTS.includes(front.layout)) errors.push(`${where}.layout is one of: ${FRONT_LAYOUTS.join(', ')}`);
  if (front.tagline !== undefined && !isStr(front.tagline)) errors.push(`${where}.tagline is words`);
  if (front.press !== undefined && front.press !== true && !(isStr(front.press) && front.press.length <= 40)) errors.push(`${where}.press is true ("press start") or its words (40 at most)`);
  if (front.menu !== undefined) {
    const m = front.menu;
    if (!Array.isArray(m) || !m.length || !m.every((e) => FRONT_ENTRIES.includes(e))) errors.push(`${where}.menu is a list of: ${FRONT_ENTRIES.join(', ')}`);
    else {
      if (new Set(m).size !== m.length) errors.push(`${where}.menu names an entry twice`);
      if (!m.includes('play')) errors.push(`${where}.menu needs play: the way into the game`);
      if (run && m.some((e) => e === 'levels' || e === 'continue')) errors.push(`${where}.menu: a run draws its levels anew, so it has no levels or continue`);
      if (!run && levels < 2 && m.includes('levels')) errors.push(`${where}.menu: levels lists a game's levels, and this game has one`);
      if (m.includes('credits') && front.credits === undefined) errors.push(`${where}.menu has credits: give front.credits (at least {}) for the roll`);
    }
  }
  if (front.credits !== undefined) {
    const cr = front.credits;
    if (!isObj(cr)) errors.push(`${where}.credits is { roll?: [{ role, names: [..] }], thanks?, closing?, attribution? }`);
    else {
      for (const k of Object.keys(cr)) if (!['roll', 'thanks', 'closing', 'attribution'].includes(k)) errors.push(`${where}.credits.${k}: not a credits setting (roll, thanks, closing, attribution)`);
      if (cr.roll !== undefined && !(Array.isArray(cr.roll) && cr.roll.length <= 60 && cr.roll.every((r) => isObj(r) && isStr(r.role) && Array.isArray(r.names) && r.names.length && r.names.every(isStr)))) {
        errors.push(`${where}.credits.roll is [{ role: '<words>', names: ['<name>', …] }, …] (60 at most)`);
      }
      for (const k of ['thanks', 'closing']) if (cr[k] !== undefined && !isStr(cr[k])) errors.push(`${where}.credits.${k} is words`);
      if (cr.attribution !== undefined && typeof cr.attribution !== 'boolean') errors.push(`${where}.credits.attribution is true or false (false drops the "made with mojulo" line)`);
    }
  }
  if (front.end !== undefined) {
    const e = front.end;
    if (!isObj(e) || Object.keys(e).some((k) => k !== 'text' && k !== 'credits')) errors.push(`${where}.end is { text?, credits? }`);
    else {
      if (e.text !== undefined && !isStr(e.text)) errors.push(`${where}.end.text is words`);
      if (e.credits !== undefined && typeof e.credits !== 'boolean') errors.push(`${where}.end.credits is true or false`);
      if (run) errors.push(`${where}.end: a run ends at its own result; its credits are on the title's menu`);
    }
  }
  return errors;
}

/**
 * The page's front: the menu defaulted from what the game has, the cover's art as resolved (`art`: { src, zone?,
 * aspect?, titled } or null), the credits kept as words.
 */
export function frontConfig(front, art, { levels = 1, run = false } = {}) {
  const credits = front.credits ? {
    roll: (front.credits.roll || []).map((r) => ({ role: r.role, names: r.names.slice() })),
    ...(front.credits.thanks ? { thanks: front.credits.thanks } : {}),
    ...(front.credits.closing ? { closing: front.credits.closing } : {}),
    attribution: front.credits.attribution !== false,
  } : null;
  const menu = front.menu ? front.menu.slice() : [
    ...(run ? [] : ['continue']), 'play', ...(!run && levels > 1 ? ['levels'] : []), 'options', ...(credits ? ['credits'] : []),
  ];
  const end = run ? null : { text: (front.end && front.end.text) || FRONT_WORDS.end, credits: !!credits && !(front.end && front.end.credits === false) };
  return {
    art: art || null,
    layout: front.layout || 'center',
    ...(front.tagline ? { tagline: front.tagline } : {}),
    ...(front.press ? { press: front.press === true ? FRONT_WORDS.press : front.press } : {}),
    menu, credits, end,
  };
}

// the front's sheet: the title stage (the cover sized to fill, its menu zone in its own percentages), the lockup and
// the menu by layout, the attract prompt, the options, the roll; motion stops for a reader who asks for less
export const FRONT_CSS = [
  '#front{position:fixed;inset:0;overflow:hidden;display:none;background:var(--bg);z-index:1}',
  '#front .fx-stage{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background-size:cover;background-position:center}',
  // a cover is drawn whole (its menu zone always on screen), the margins filled by its own art, blurred and darkened
  '#front .fx-stage.cover{width:min(100vw,calc(100vh * var(--fx-aspect)));aspect-ratio:var(--fx-aspect)}',
  '#front .fx-back{position:absolute;inset:-48px;background-size:cover;background-position:center;filter:blur(28px) brightness(.45)}',
  '#front .fx-stage.full{inset:0;transform:none;left:0;top:0;width:100%;height:100%}',
  '#front .fx-stage.full::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,color-mix(in srgb,var(--bg) 70%,transparent))}',
  '#front .fx-col{position:absolute;z-index:1;display:flex;flex-direction:column;gap:12px;max-width:min(560px,calc(100vw - 32px))}',
  '#front .fx-col.center{left:50%;top:50%;transform:translate(-50%,-50%);align-items:center;text-align:center}',
  '#front .fx-col.lower-third{left:max(16px,6vw);bottom:9vh;align-items:flex-start}',
  '#front .fx-col.left{left:max(16px,6vw);top:50%;transform:translateY(-50%);align-items:flex-start}',
  '#front .fx-col.right{right:max(16px,6vw);top:50%;transform:translateY(-50%);align-items:flex-end;text-align:right}',
  '#front .fx-zone{position:absolute;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}',
  '#front h1.fx-title{font-size:clamp(34px,7vw,72px);line-height:1;margin:0;text-shadow:0 2px 18px color-mix(in srgb,var(--bg) 80%,transparent)}',
  '#front .fx-tag{color:var(--dim);font-size:clamp(14px,2vw,18px)}',
  '#front .fx-hide{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
  '#front .fx-menu{display:flex;flex-direction:column;gap:6px;min-width:min(240px,80vw)}',
  '#front .fx-menu button{text-align:center;background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(4px)}',
  '#front .fx-menu button.on{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}',
  '#front .fx-press{letter-spacing:.2em;text-transform:uppercase;font-size:14px;color:var(--ink);animation:fx-blink 1.6s ease-in-out infinite;background:color-mix(in srgb,var(--panel) 70%,transparent);padding:8px 16px;border-radius:999px}',
  '@keyframes fx-blink{50%{opacity:.35}}',
  '#front .fx-panel{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(6px)}',
  '#front .fx-panel .screen{max-width:360px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px}',
  '#front .fx-roll{position:absolute;inset:0;z-index:2;overflow:hidden;background:var(--bg)}',
  '#front .fx-roll .fx-crawl{position:absolute;left:50%;top:0;width:min(560px,calc(100vw - 32px));transform:translate(-50%,100vh);text-align:center;display:flex;flex-direction:column;gap:26px;padding:0 0 30vh;animation:fx-roll var(--fx-dur,30s) linear forwards}',
  '@keyframes fx-roll{to{transform:translate(-50%,-100%)}}',
  '#front .fx-crawl h2{font-size:clamp(28px,5vw,44px)}#front .fx-crawl .fx-role{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}',
  '#front .fx-crawl .fx-names{font-size:18px;display:flex;flex-direction:column;gap:2px}#front .fx-crawl .fx-made{color:var(--dim);font-size:13px}',
  '#front .fx-skip{position:absolute;right:16px;bottom:14px;z-index:3}',
  '#front .fx-end{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:var(--bg)}',
  '@media (prefers-reduced-motion:reduce){#front .fx-press{animation:none}#front .fx-roll{overflow:auto}#front .fx-roll .fx-crawl{animation:none;transform:translateX(-50%);padding:12vh 0}}',
].join('\n  ');

/**
 * The page's code. `cfg.front` is frontConfig's; `api` is the shell's: { el, app, show, home, launch, levels, run,
 * startRun, renderLevels, progress, cleared, isOpen, settings, saveSettings, pushPrefs, reset, playtest, title }.
 */
export function playFrontRuntime(cfg, api) {
  const F = cfg.front, el = api.el, T = api.T;
  const root = document.getElementById('front');
  let pressed = !F.press, focus = 0, items = [], view = null;

  const firstUncleared = () => api.levels.find((l) => api.isOpen(l) && !api.cleared(l.ref)) || null;
  // continue: the open level after the last one played, else the first open one not cleared
  function continueTo() {
    const last = api.progress();
    if (!last) return null;
    const at = api.levels.findIndex((l) => l.ref === last);
    const after = api.levels.slice(at + 1).find((l) => api.isOpen(l) && !api.cleared(l.ref));
    return after || firstUncleared() || api.levels.find((l) => l.ref === last) || null;
  }
  const ENTRY = {
    continue: () => { const lv = continueTo(); return lv ? { label: T('continue'), go: () => { close(); api.launch(lv); } } : null; },
    play: () => ({ label: api.progress() ? T('new game') : T('start'), go: () => { close(); if (api.run) api.startRun(); else api.launch(api.levels[0]); } }),
    levels: () => ({ label: T('levels'), go: () => { close(); api.renderLevels(); } }),
    options: () => ({ label: T('options'), go: () => options() }),
    credits: () => (F.credits ? { label: T('credits'), go: () => roll(title) } : null),
  };

  function open() { root.style.display = 'block'; api.app.style.display = 'none'; }
  function close() { root.style.display = 'none'; view = null; }

  function stage() {
    const a = F.art, s = el('div', { cls: 'fx-stage ' + (a && a.aspect ? 'cover' : 'full') });
    const url = a ? 'url("' + String(a.src).replace(/["\\\n]/g, '') + '")' : null;
    if (a) s.style.backgroundImage = url;
    if (a && a.aspect) {
      s.style.setProperty('--fx-aspect', String(a.aspect));
      const back = el('div', { cls: 'fx-back' });
      back.style.backgroundImage = url;
      root.appendChild(back);
    }
    return s;
  }

  function title() {
    api.show('title');
    open();
    view = 'title';
    root.textContent = '';
    const s = stage();
    root.appendChild(s);
    const a = F.art, titled = a && a.titled;
    const head = [
      el('h1', { cls: 'fx-title' + (titled ? ' fx-hide' : ''), text: T(api.title) }),
      F.tagline && !titled ? el('div', { cls: 'fx-tag', text: T(F.tagline) }) : null,
      api.playtest ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null,
    ];
    items = F.menu.map((k) => ENTRY[k]()).filter(Boolean);
    focus = Math.min(focus, items.length - 1);
    const body = pressed
      ? el('div', { cls: 'fx-menu', role: 'menu' }, items.map((it, i) => el('button', { cls: i === focus ? 'on' : '', role: 'menuitem', text: it.label, on: it.go })))
      : el('div', { cls: 'fx-press', text: T(F.press) });
    // a cover's menu zone (its own percentages, in the stage the cover fills), else a column by the layout
    if (a && a.zone) {
      const z = el('div', { cls: 'fx-zone' }, [body]);
      z.style.left = a.zone.x * 100 + '%'; z.style.top = a.zone.y * 100 + '%'; z.style.width = a.zone.w * 100 + '%'; z.style.height = a.zone.h * 100 + '%';
      s.appendChild(z);
      root.appendChild(el('div', { cls: 'fx-col center fx-hide' }, head));
    } else root.appendChild(el('div', { cls: 'fx-col ' + F.layout }, head.concat([body])));
  }

  function options() {
    view = 'options';
    const p = el('div', { cls: 'fx-panel' });
    let armed = false;
    const draw = () => {
      p.textContent = '';
      const reset = el('button', { cls: 'link', text: armed ? T('tap again to reset') : T('reset progress'), on: () => { if (!armed) { armed = true; draw(); return; } api.reset(); armed = false; title(); } });
      const L = api.lang;
      items = [
        { label: api.settings().sfxOn ? T('sound: on') : T('sound: off'), go: () => { api.settings().sfxOn = !api.settings().sfxOn; api.saveSettings(); api.pushPrefs(); draw(); } },
        // the language row (a game with languages): the word localized, the language in its own name
        L ? { label: T('language') + ': ' + L.list.find((x) => x.tag === L.current()).name, go: () => { p.remove(); languages(); } } : null,
        { label: T('back'), go: title },
      ].filter(Boolean);
      focus = Math.min(focus, items.length - 1);
      p.appendChild(el('div', { cls: 'screen' }, [el('h2', { text: T('options') })].concat(items.map((it, i) => el('button', { cls: i === focus ? 'on' : '', text: it.label, on: it.go })), [api.playtest ? null : reset])));
    };
    focus = 0;
    draw();
    root.appendChild(p);
  }

  // the languages (a game with languages): each in its own name and its own script; picking one sets the page in it and
  // goes back to the options, now in that language
  function languages() {
    view = 'options';
    const L = api.lang, p = el('div', { cls: 'fx-panel' });
    items = L.list.map((x) => ({ tag: x.tag, label: x.name, go: () => { L.choose(x.tag); p.remove(); title(); options(); } })).concat([{ label: T('back'), go: () => { p.remove(); options(); } }]);
    focus = Math.max(0, L.list.findIndex((x) => x.tag === L.current()));
    p.appendChild(el('div', { cls: 'screen' }, [el('h2', { text: T('language') })].concat(items.map((it, i) => el('button', { cls: i === focus ? 'on' : '', lang: it.tag || null, text: it.label, on: it.go })))));
    root.appendChild(p);
  }

  // the roll: the title, each role and its names, the thanks, the closing words, the line that says what made it
  function roll(after) {
    open();
    view = 'roll';
    const C = F.credits || { roll: [], attribution: true };
    const kids = [el('h2', { text: T(api.title) })];
    // people keep their names in every language; their roles are words
    for (const r of C.roll) kids.push(el('div', null, [el('div', { cls: 'fx-role', text: T(r.role) }), el('div', { cls: 'fx-names' }, r.names.map((n) => el('span', { text: n })))]));
    if (C.thanks) kids.push(el('div', null, [el('div', { cls: 'fx-role', text: T('thanks') }), el('div', { cls: 'fx-names', text: T(C.thanks) })]));
    if (C.closing) kids.push(el('div', { cls: 'fx-names', text: T(C.closing) }));
    if (C.attribution) kids.push(el('div', { cls: 'fx-made', text: T('made with mojulo · github.com/zombico/mojulo') }));
    const crawl = el('div', { cls: 'fx-crawl' }, kids);
    crawl.style.setProperty('--fx-dur', Math.max(14, 6 + kids.length * 2.4) + 's');
    const done = () => { if (view === 'roll') { view = null; after(); } };
    crawl.addEventListener('animationend', done);
    const wrap = el('div', { cls: 'fx-roll' }, [crawl, el('button', { cls: 'fx-skip', text: T('skip'), on: done })]);
    items = [{ label: T('skip'), go: done }];
    root.textContent = '';
    root.appendChild(wrap);
  }

  // the last level first cleared: the end card, then the roll (when the game has credits), then the title
  function end() {
    if (!F.end) return false;
    api.show('title');
    open();
    view = 'end';
    root.textContent = '';
    const next = () => (F.end.credits ? roll(title) : title());
    items = [{ label: F.end.credits ? T('credits') : T('title'), go: next }];
    root.appendChild(el('div', { cls: 'fx-end' }, [el('div', { cls: 'screen center' }, [
      el('div', { cls: 'result-mark', text: T('game complete') }),
      el('h1', { text: T(F.end.text) }),
      el('div', { cls: 'muted', text: T(api.title) }),
      el('div', { cls: 'row' }, [el('button', { cls: 'primary on', text: items[0].label, on: next })]),
    ])]));
    return true;
  }

  // keys and the pad: up / down move the focus, enter / space / A pick, escape / B back; any of them presses start
  function act(k) {
    if (root.style.display !== 'block' || !view) return;
    if (view === 'title' && !pressed) { pressed = true; title(); return; }
    if (k === 'back') { if (view === 'options') title(); else if (view === 'roll') items[0].go(); return; }
    if (!items.length) return;
    if (k === 'up' || k === 'down') {
      focus = (focus + (k === 'up' ? items.length - 1 : 1)) % items.length;
      const bs = root.querySelectorAll(view === 'title' ? '.fx-menu button' : '.fx-panel .screen > button:not(.link)');
      bs.forEach((b, i) => { b.className = i === focus ? 'on' : ''; });
      return;
    }
    if (k === 'pick' && items[focus]) items[focus].go();
  }
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Enter: 'pick', Space: 'pick', KeyE: 'pick', Escape: 'back', Backspace: 'back' };
  window.addEventListener('keydown', (e) => {
    if (root.style.display !== 'block') return;
    const k = KEYMAP[e.code] || (view === 'title' && !pressed ? 'pick' : null);
    if (!k) return;
    e.preventDefault();
    act(k);
  });
  root.addEventListener('click', () => { if (view === 'title' && !pressed) act('pick'); });
  const PAD = [[12, 'up'], [13, 'down'], [0, 'pick'], [9, 'pick'], [1, 'back']];
  let padWas = {};
  (function padPoll() {
    requestAnimationFrame(padPoll);
    if (root.style.display !== 'block' || !navigator.getGamepads) { padWas = {}; return; }
    const now = {};
    for (const p of navigator.getGamepads()) if (p && p.connected) for (const [b, k] of PAD) if (p.buttons[b] && p.buttons[b].pressed) now[k] = true;
    for (const k in now) if (!padWas[k]) act(k);
    padWas = now;
  })();

  return { title, end, rollFromRun: () => roll(api.home) };
}
