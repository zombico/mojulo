/**
 * THE GAME'S SCREENS around a level (the game channel's, game.js): its OPENING, a title screen that loads the level and
 * waits for the player, then a chapter's card into the play; and its RESULTS, the mission's end said as a screen, not a
 * card. Drawn in wireframe (hairlines, corner brackets, a faint grid, spaced capitals) in the level's own look: the
 * world's interface theme where it has one (`game.look`: ink, panel, line, accent, accent2, harm, font), else the page's
 * --moj-* tokens.
 *
 *   OPENING   game.opening { title, kicker?, chapter?: { label?, name? }, press? }, played standalone (a hosting shell has
 *             its own front): over the page as it builds, the game's title, a bar that fills as the world comes up (the
 *             page parsed, the controllable world up, the land laid, then `warm` frames drawn so every shader is built),
 *             then `press` (any key, a click, a tap); the level held until then (its start, so its scenes wait, and the
 *             pilot's keys); then the chapter's card on black for `card` s, fading off as the level starts under it.
 *   RESULTS   as the level ends: the result's word (game.noun, 'Level' unless a level says 'Mission': "Mission
 *             complete", "Mission failed"), the level's name, what it kept (its stats: each a label, a leader, a value),
 *             its rank where it has one; standalone, Play again (Enter, R or a click: the page loaded afresh).
 *
 *   SCREENS                 the timings and sizes: { warm (frames), card (s), fade (s), grid (px) }
 *   screensCss()            → the screens' CSS (scoped .moj-sc)
 *   resultsScript()         → in-page: __mojResults(envelope, { hosted }) draws the results (and the screens' look, which
 *                             the opening shares: it is emitted after this)
 *   openingScript()         → in-page: __mojOpening(start) shows the opening and calls start() once pressed
 *   window.__mojScreens     { opening: 'loading' | 'ready' | 'card' | 'gone' | null, progress, results: null | { word, rows } }
 *
 * Import-free in the page: the strings below are the page's source.
 */
export const SCREENS = Object.freeze({ warm: 45, card: 2.6, fade: 0.9, grid: 48 });

/** The CSS the screens wear: every colour a variable, set from the level's look (or the page's tokens). */
export function screensCss() {
  return [
    '.moj-sc{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;font-family:var(--sc-font);color:var(--sc-ink);transition:opacity .9s ease;pointer-events:auto}',
    '.moj-sc .grid{position:absolute;inset:0;background-image:linear-gradient(var(--sc-grid) 1px,transparent 1px),linear-gradient(90deg,var(--sc-grid) 1px,transparent 1px);background-size:var(--sc-cell) var(--sc-cell);pointer-events:none}',
    '.moj-sc .frame{position:relative;min-width:min(560px,86vw);max-width:92vw;padding:34px 44px 30px;border:1px solid var(--sc-line);background:var(--sc-plate)}',
    '.moj-sc .frame i{position:absolute;width:18px;height:18px;border:2px solid var(--sc-accent)}',
    '.moj-sc .frame i.a{left:-6px;top:-6px;border-right:0;border-bottom:0}.moj-sc .frame i.b{right:-6px;top:-6px;border-left:0;border-bottom:0}',
    '.moj-sc .frame i.c{left:-6px;bottom:-6px;border-right:0;border-top:0}.moj-sc .frame i.d{right:-6px;bottom:-6px;border-left:0;border-top:0}',
    '.moj-sc .kick{font-size:13px;letter-spacing:.5em;text-transform:uppercase;color:var(--sc-accent2);margin-bottom:8px}',
    '.moj-sc .title{font-size:clamp(30px,5.4vw,58px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;line-height:1.05}',
    '.moj-sc .rule{height:1px;background:var(--sc-line);margin:18px 0 14px;position:relative}.moj-sc .rule::after{content:"";position:absolute;left:0;top:-1px;width:64px;height:3px;background:var(--sc-accent)}',
    '.moj-sc .sub{font-size:14px;letter-spacing:.3em;text-transform:uppercase;opacity:.8}',
    '.moj-sc .bar{height:4px;border:1px solid var(--sc-line);margin-top:26px;position:relative}.moj-sc .bar b{position:absolute;left:0;top:0;bottom:0;background:var(--sc-accent);transition:width .25s ease}',
    '.moj-sc .state{margin-top:10px;font-size:12px;letter-spacing:.32em;text-transform:uppercase;opacity:.75;font-family:ui-monospace,Menlo,monospace}',
    '.moj-sc .press{margin-top:22px;font-size:15px;letter-spacing:.42em;text-transform:uppercase;color:var(--sc-accent);animation:moj-sc-pulse 1.6s ease-in-out infinite}',
    '@keyframes moj-sc-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
    '.moj-sc.card{background:#000}.moj-sc.card .chap{text-align:center}.moj-sc.card .chap .kick{font-size:15px}.moj-sc.card .chap .title{font-size:clamp(34px,6vw,66px)}',
    '.moj-sc .word{font-size:clamp(28px,4.6vw,50px);font-weight:800;letter-spacing:.16em;text-transform:uppercase;line-height:1.05}',
    '.moj-sc .rows{margin-top:18px;font-family:ui-monospace,Menlo,monospace;font-size:15px}',
    '.moj-sc .row{display:flex;align-items:baseline;gap:10px;padding:5px 0}.moj-sc .row .l{letter-spacing:.2em;text-transform:uppercase;opacity:.85}',
    '.moj-sc .row .d{flex:1;border-bottom:1px dotted var(--sc-line);transform:translateY(-4px)}.moj-sc .row .v{color:var(--sc-accent)}',
    '.moj-sc .acts{display:flex;gap:14px;margin-top:24px}',
    '.moj-sc button{font:inherit;font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:var(--sc-ink);background:transparent;border:1px solid var(--sc-line);padding:9px 18px;cursor:pointer}',
    '.moj-sc button:hover,.moj-sc button:focus{border-color:var(--sc-accent);color:var(--sc-accent);outline:0}',
  ].join('');
}

// the look's variables on a screen: the level's look where it has one, else the page's tokens
const LOOK = `function __scLook(el) {
    const L = (__GAME && __GAME.look) || {}, hex = /^#[0-9a-fA-F]{6}$/, v = (k, d) => (typeof L[k] === 'string' && hex.test(L[k]) ? L[k] : d);
    const a = (h, o) => (hex.test(h) ? 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ',' + o + ')' : h);
    const ink = v('ink', 'var(--moj-ink,#e9edee)'), panel = v('panel', null), line = v('line', 'var(--moj-line,#5d6a70)');
    el.style.setProperty('--sc-ink', ink); el.style.setProperty('--sc-line', line);
    el.style.setProperty('--sc-accent', v('accent', 'var(--moj-accent,#9fd2d6)')); el.style.setProperty('--sc-accent2', v('accent2', 'var(--moj-accent,#e3c98a)'));
    el.style.setProperty('--sc-harm', v('harm', 'var(--moj-harm,#e0634f)'));
    el.style.setProperty('--sc-plate', panel ? a(panel, 0.82) : 'var(--moj-panel-a,rgba(13,17,20,.82))');
    el.style.setProperty('--sc-grid', hex.test(line) ? a(line, 0.16) : 'rgba(120,140,150,.14)');
    el.style.setProperty('--sc-cell', ${SCREENS.grid} + 'px');
    el.style.setProperty('--sc-font', typeof L.font === 'string' && L.font ? L.font : 'var(--moj-font,system-ui,sans-serif)');
  }
  function __scCss() { if (document.getElementById('moj-sc-css')) return; const s = document.createElement('style'); s.id = 'moj-sc-css'; s.textContent = ${JSON.stringify(screensCss())}; document.head.appendChild(s); }
  const __scEsc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  window.__mojScreens = window.__mojScreens || { opening: null, progress: 0, results: null };`;

/** In-page: the opening. `__mojOpening(start)`: shown at once; `start()` called once the player presses, the chapter's
 *  card then laid over the level as it begins. */
export function openingScript() {
  return `
  function __mojOpening(start) {
    const O = __GAME.opening, S = window.__mojScreens, W = ${SCREENS.warm};
    __scCss();
    const el = document.createElement('div'); el.className = 'moj-sc'; el.style.background = '#000'; __scLook(el);
    el.innerHTML = '<div class="grid"></div><div class="frame"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i>'
      + (O.kicker ? '<div class="kick">' + __scEsc(O.kicker) + '</div>' : '') + '<div class="title">' + __scEsc(O.title) + '</div><div class="rule"></div>'
      + (O.chapter ? '<div class="sub">' + __scEsc([O.chapter.label, O.chapter.name].filter(Boolean).join(' \\u00b7 ')) + '</div>' : '')
      + '<div class="bar"><b style="width:0%"></b></div><div class="state">Loading</div></div>';
    document.body.appendChild(el);
    S.opening = 'loading';
    // (the pilot's keys held while it is up: the menus' freeze)
    window.__mojMenuOpen = true;
    const bar = el.querySelector('.bar b'), state = el.querySelector('.state');
    let drawn = 0, pressed = false;
    // (the world's coming up, a step at a time: the world, the land, then frames drawn so every shader is built)
    (function watch() {
      const up = !!(window.__mojCtrl && window.__mojCtrl.world), land = typeof window.__formReady === 'undefined' || window.__formReady === true;
      if (up && land) drawn++;
      const p = Math.min(1, 0.15 + (up ? 0.25 : 0) + (up && land ? 0.2 : 0) + 0.4 * Math.min(1, drawn / W));
      S.progress = p; bar.style.width = Math.round(p * 100) + '%';
      if (p < 1) { requestAnimationFrame(watch); return; }
      S.opening = 'ready';
      state.textContent = 'Ready';
      const pr = document.createElement('div'); pr.className = 'press'; pr.textContent = O.press || 'Press any key'; el.querySelector('.frame').appendChild(pr);
      const go = (ev) => { if (pressed) return; if (ev && ev.key && /^(Shift|Control|Alt|Meta|Tab)$/.test(ev.key)) return; pressed = true; window.removeEventListener('keydown', go, true); el.removeEventListener('pointerdown', go); begin(); };
      window.addEventListener('keydown', go, true); el.addEventListener('pointerdown', go);
    })();
    // (pressed: the chapter's card on black, the level begun under it, the card fading off)
    function begin() {
      window.__mojMenuOpen = false;
      if (!O.chapter) { el.style.opacity = '0'; setTimeout(() => el.remove(), ${SCREENS.fade * 1000}); S.opening = 'gone'; start(); return; }
      el.className = 'moj-sc card'; el.innerHTML = '<div class="chap">' + (O.chapter.label ? '<div class="kick">' + __scEsc(O.chapter.label) + '</div>' : '') + '<div class="title">' + __scEsc(O.chapter.name || '') + '</div></div>';
      S.opening = 'card';
      start();
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.remove(); S.opening = 'gone'; }, ${SCREENS.fade * 1000}); }, ${SCREENS.card * 1000});
    }
  }`;
}

/** In-page: the results. `__mojResults(envelope, { hosted })`. */
export function resultsScript() {
  return `
  ${LOOK}
  function __mojResults(env, { hosted } = {}) {
    const S = window.__mojScreens, ok = env.result === 'success', noun = (__GAME.noun || 'Level');
    const said = __GAME.complete && typeof __GAME.complete.text === 'string' && __GAME.complete.text ? __GAME.complete.text : null;
    const word = said || (noun + ' ' + (ok ? 'complete' : env.result === 'fail' ? 'failed' : env.result));
    const kept = (env.stats && env.stats.kept) || [], rows = kept.map((k) => ({ l: k.label, v: String(k.value) + (k.unit || '') }));
    if (env.stats && env.stats.rank) rows.unshift({ l: 'Rank', v: String(env.stats.rank) });
    __scCss();
    const el = document.createElement('div'); el.className = 'moj-sc'; el.style.background = 'rgba(0,0,0,.55)'; el.style.opacity = '0'; __scLook(el);
    el.innerHTML = '<div class="grid"></div><div class="frame"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i>'
      + (__GAME.title ? '<div class="kick">' + __scEsc(__GAME.title) + '</div>' : '')
      + '<div class="word" style="color:' + (ok ? 'var(--sc-accent)' : 'var(--sc-harm)') + '">' + __scEsc(word) + '</div><div class="rule"></div>'
      + (__GAME.name ? '<div class="sub">' + __scEsc(__GAME.name) + '</div>' : '')
      + (rows.length ? '<div class="rows">' + rows.map((r) => '<div class="row"><span class="l">' + __scEsc(r.l) + '</span><span class="d"></span><span class="v">' + __scEsc(r.v) + '</span></div>').join('') + '</div>' : '')
      + (hosted ? '' : '<div class="acts"><button class="again">Play again</button></div>') + '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    S.results = { word, rows };
    if (!hosted) {
      const again = () => { try { location.reload(); } catch (e) { /* (no reload: the screen stays) */ } };
      el.querySelector('.again').addEventListener('click', again);
      setTimeout(() => window.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') again(); }), 600);
    } else el.style.pointerEvents = 'none';
    return el;
  }`;
}
