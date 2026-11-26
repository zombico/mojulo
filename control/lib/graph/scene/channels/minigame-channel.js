/**
 * The minigame channel: a level's games inside the game (playscape/ui/minigames.js) on the page, riding the events
 * channel (its bus state, its log, its input queue). Emitted inside the events channel only when the events carry
 * `minigames`, so a world without one keeps every byte; and of the pixelizer games only the ones the level plays are
 * inlined (their pure cores and raster skins, the arcade cabinet's own code, read by inlineSource as its shell does).
 *
 *   THE WINDOW, in place over the field (the world holds still while it is up): the game's raster, its facts beside it
 *   (score, goal, best, the clock or the casts), the keys below; at the end the result (won or not, the gold paid).
 *   Keys: blocks arrows / WASD, up or X turns (Z back), Space drops, C holds; match arrows move, Space or Enter picks
 *   (or click a cell); fishing hold Space (or the pointer) to lift the line; mowing hold up / W to drive (down back), left
 *   and right to turn; deskwork is a page of its own (its face's renderHtml: a browser of tabs), clicked (each control's
 *   data-act an action of its reducer), 1-4 to answer, [ and ] to turn its tabs. Escape ends the round as it stands.
 *   A game drawn as a page: its difficulty from a var's count (`level`, its face's rankOf), its win its own (wonOf), a
 *   var raised every round won (`each`).
 *
 * It reads the bus's log for `minigame:<id>`, and as a round ends writes its score to `minigame-last-<id>` (and
 * `minigame-best-<id>` when better), pays its gold into the game's purse (said as a bag transfer, in:<holder>:<item>:<n>,
 * when the var is a holder's, so the bag mechanic carries it), and pushes `minigame-done:<id>` and `minigame-won:<id>`
 * or `minigame-lost:<id>`. window.__mojMini drives it headless (a test, the audit).
 */
import { inlineSource } from '../../pixelizer/brickster-shell.js';

export const MINI_CSS = `
.moj-mini{position:fixed;inset:0;pointer-events:none;z-index:33;display:none;align-items:center;justify-content:center;font:14px/1.35 var(--moj-font,system-ui,sans-serif);color:var(--moj-ink,#eef2ff);background:rgba(0,0,0,.45)}
.moj-mini.on{display:flex}
:where(.moj-mini) .moj-w{background:var(--moj-panel,rgba(14,22,58,.96));border:1px solid var(--moj-line,#c9d3ff);border-radius:8px;padding:10px 14px;pointer-events:auto;box-sizing:border-box}
.moj-mini-box{display:flex;flex-direction:column;gap:8px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px)}
.moj-mini-t{font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:.8}
.moj-mini-row{display:flex;gap:14px;align-items:flex-start;min-height:0}
.moj-mini-frame{position:relative;line-height:0;flex:none;touch-action:none;user-select:none}
.moj-mini-frame svg{display:block;width:auto;height:auto;max-width:min(60vw,420px);max-height:calc(100vh - 150px);image-rendering:pixelated}
.moj-mini-cur{position:absolute;box-sizing:border-box;border:2px solid var(--moj-accent,#ffd76a);border-radius:3px;pointer-events:none}
.moj-mini-facts{min-width:120px;font-variant-numeric:tabular-nums}
.moj-mini-facts div{display:flex;justify-content:space-between;gap:12px}
.moj-mini-facts .k{opacity:.7}
.moj-mini-msg{min-height:20px}
.moj-mini-keys{font-size:11px;opacity:.7}
.moj-mini-end{font-size:16px;font-weight:700}
@media (max-width:560px){.moj-mini-row{flex-direction:column}}
`;

/**
 * The page: run in the events channel's scope (it reads __busState, __inputQueue). cfg: EVENTS.minigames; GAMES: the
 * inlined games by name, each { newGame, step, renderWorldSvg, resolveOverlay, gravityMs? }.
 * → { step(t), … } the frame's step, and the handles window.__mojMini exposes.
 */
export function minigamePage(cfg, GAMES) {
  const V = () => __busState.vars;
  const byId = {};
  for (const g of cfg.games) byId[g.id] = g;
  const st = document.createElement('style'); st.textContent = MINI_CSS_TEXT; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-hud moj-mini'; document.body.appendChild(root);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const KEYS = {
    blocks: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'cw', KeyW: 'cw', KeyX: 'cw', KeyZ: 'ccw', ArrowDown: 'softDrop', KeyS: 'softDrop', Space: 'hardDrop', KeyC: 'hold', ShiftLeft: 'hold' },
    match: { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'pick', Enter: 'pick' },
    fishing: { Space: 'reel', Enter: 'reel', ArrowUp: 'reel', KeyW: 'reel' },
    mowing: { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' },
    deskwork: { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, BracketLeft: -1, BracketRight: 1 },
  };
  const HINT = { blocks: '← → move · ↑ turn · ↓ drop · Space slam · C hold · Esc stop', match: 'arrows move · Space pick · Esc stop', fishing: 'hold Space to lift the line · Esc stop', mowing: '↑ drive · ↓ back · ← → turn · Esc stop', deskwork: 'click, or 1-4 to answer · [ ] turn the tabs · Esc end the shift' };
  const plays = {}, styled = {};
  // cur: the round up, or null: { g, s (the reducer's state), phase: 'play' | 'result', left (blocks' clock, ms), grav, cx, cy, pay, won }
  let cur = null, pending = [], seen = 0, lastT = 0, lastKey = '', lastDraw = -1, dirty = true;
  const busy = () => (window.__mojMenus && window.__mojMenus.open && window.__mojMenus.open()) || (window.__mojScenes && window.__mojScenes.on && window.__mojScenes.on()) || (window.__mojRpg && window.__mojRpg.state && window.__mojRpg.state().mode);
  function hold() { window.__mojFreeze = true; window.__mojMenuOpen = true; }
  function release() { window.__mojFreeze = false; window.__mojMenuOpen = false; }

  function open(id) {
    const g = byId[id];
    if (!g || cur) return false;
    const n = plays[id] = (plays[id] || 0) + 1;
    const seed = (g.seed + Math.imul(n - 1, 2654435761)) >>> 0, G = GAMES[g.game];
    // (a game drawn as a page: its rank from its level var's count, its schedule that rank's)
    const count = g.level ? Number(V()[g.level]) || 0 : 0, rank = G.rankOf ? G.rankOf(count) : 0;
    const s = g.game === 'fishing' ? G.newGame(seed, g.casts ? { casts: g.casts } : {}) : g.game === 'mowing' ? G.newGame(seed, { lawn: g.lawn || null, ...(g.time ? { time: g.time } : {}) })
      : G.renderHtml ? G.newGame(seed, { rank, ...(g.schedules ? { schedule: g.schedules[Math.min(rank, g.schedules.length - 1)] } : {}) }) : G.newGame(seed);
    if (G.css && !styled[g.game]) { const css = document.createElement('style'); css.textContent = G.css; document.head.appendChild(css); styled[g.game] = true; }
    cur = { g, G, s, phase: 'play', left: (g.time || 0) * 1000, grav: 0, cx: 0, cy: 0, pay: 0, won: false, count, promoted: null };
    lastKey = ''; lastDraw = -1; dirty = true; hold(); root.classList.add('on');
    return true;
  }
  function finish() {
    if (!cur || cur.phase !== 'play') return;
    const g = cur.g, v = V(), score = cur.s.score || 0;
    cur.phase = 'result';
    cur.won = cur.G.wonOf ? cur.G.wonOf(cur.s) : score >= g.goal;
    cur.pay = Math.floor(score * g.gold);
    v['minigame-last-' + g.id] = score;
    if (score > (Number(v['minigame-best-' + g.id]) || 0)) { v['minigame-best-' + g.id] = score; cur.best = true; }
    if (cur.pay) {
      v[g.purse] = (Number(v[g.purse]) || 0) + cur.pay;
      // a holder's var (held:bag:gold): said as the bag transfer it is, so the bag mechanic carries it
      if (g.purse.indexOf('held:') === 0) __inputQueue.push({ type: 'in:' + g.purse.slice(5) + ':' + cur.pay });
    }
    // (every round won raises its `each`: a commendation; past a rank's worth, a promotion said)
    if (cur.won && g.each) {
      v[g.each] = (Number(v[g.each]) || 0) + 1;
      if (g.each.indexOf('held:') === 0) __inputQueue.push({ type: 'in:' + g.each.slice(5) + ':1' });
      if (cur.G.rankOf && g.level === g.each && cur.G.rankOf(cur.count + 1) > cur.G.rankOf(cur.count)) cur.promoted = cur.G.rankTitle(cur.G.rankOf(cur.count + 1));
    }
    __inputQueue.push({ type: 'minigame-done:' + g.id });
    __inputQueue.push({ type: (cur.won ? 'minigame-won:' : 'minigame-lost:') + g.id });
    dirty = true;
  }
  function close() {
    if (!cur) return;
    cur = null; root.classList.remove('on'); root.innerHTML = ''; release();
  }
  // one action into the reducer: blocks' words, match's cursor and pick, fishing's line
  function act(a) {
    if (!cur) return;
    if (cur.phase === 'result') { if (a === 'end' || a === 'go') close(); return; }
    if (a === 'end') return finish();
    const G = cur.G, k = cur.g.game;
    if (G.renderHtml) { if (a && typeof a === 'object') cur.s = G.step(cur.s, a); dirty = true; return; }
    if (k === 'blocks') cur.s = G.step(cur.s, a);
    else if (k === 'match') {
      if (a === 'pick') cur.s = G.step(cur.s, { type: 'select', x: cur.cx, y: cur.cy });
      else if (typeof a === 'object') { cur.cx = a.x; cur.cy = a.y; cur.s = G.step(cur.s, { type: 'select', x: a.x, y: a.y }); }
      else { cur.cx = Math.max(0, Math.min(cur.s.W - 1, cur.cx + (a === 'r' ? 1 : a === 'l' ? -1 : 0))); cur.cy = Math.max(0, Math.min(cur.s.H - 1, cur.cy + (a === 'd' ? 1 : a === 'u' ? -1 : 0))); }
    }
    else if (k === 'fishing') cur.s = G.step(cur.s, { type: 'hold', on: a === 'reel' || a === true });
    else if (k === 'mowing' && a && typeof a === 'object') cur.s = G.step(cur.s, { type: 'key', key: a.key, on: a.on });
    dirty = true;
  }

  window.addEventListener('keydown', (ev) => {
    if (!cur) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (ev.code === 'Escape') { if (!ev.repeat) act('end'); return; }
    // the result goes on Space or Enter only: a key still held from the round never skips it
    if (cur.phase === 'result') { if (!ev.repeat && (ev.code === 'Space' || ev.code === 'Enter')) close(); return; }
    const a = (KEYS[cur.g.game] || {})[ev.code];
    if (cur.G.renderHtml) {
      // (a page's keys: a number answers, a bracket turns the tabs)
      if (a === undefined || ev.repeat) return;
      if (/^Bracket/.test(ev.code)) { const T = cur.G.tabs || [], i = T.indexOf(cur.s.tab); if (T.length) act({ type: 'tab', tab: T[(i + a + T.length) % T.length] }); }
      else act({ type: 'answer', k: a });
      return;
    }
    if (!a) return;
    if (cur.g.game === 'fishing') { if (!ev.repeat) act('reel'); return; }
    if (cur.g.game === 'mowing') { if (!ev.repeat) act({ key: a, on: true }); return; }
    if (ev.repeat && !(a === 'left' || a === 'right' || a === 'softDrop' || a === 'l' || a === 'r' || a === 'u' || a === 'd')) return;
    act(a);
  }, true);
  window.addEventListener('keyup', (ev) => {
    if (!cur) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (cur.g.game === 'fishing' && cur.phase === 'play' && (KEYS.fishing[ev.code])) act('let');
    if (cur.g.game === 'mowing' && cur.phase === 'play' && KEYS.mowing[ev.code]) act({ key: KEYS.mowing[ev.code], on: false });
  }, true);
  root.addEventListener('pointerdown', (ev) => {
    if (!cur) return;
    if (cur.phase === 'result') return close();
    // (a page's controls: each says its action)
    if (cur.G.renderHtml) { const el = ev.target.closest && ev.target.closest('[data-act]'); if (el) { try { act(JSON.parse(el.getAttribute('data-act'))); } catch (e) { /* a control that says nothing */ } } return; }
    const fr = ev.target.closest('.moj-mini-frame');
    if (!fr) return;
    if (cur.g.game === 'fishing') return act('reel');
    if (cur.g.game === 'match') {
      const r = fr.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - r.left) / r.width) * cur.s.W), y = Math.floor(((ev.clientY - r.top) / r.height) * cur.s.H);
      if (x >= 0 && y >= 0 && x < cur.s.W && y < cur.s.H) act({ x, y });
    }
  });
  root.addEventListener('pointerup', () => { if (cur && cur.g.game === 'fishing' && cur.phase === 'play') act('let'); });

  function facts() {
    const o = cur.G.resolveOverlay(cur.s), g = cur.g, rows = [['Score', o.score]];
    if (g.game === 'blocks') rows.push(['Lines', o.lines], ['Time', Math.max(0, Math.ceil(cur.left / 1000)) + 's']);
    if (g.game === 'match') rows.push(['Level', o.level], ['Time', (o.timeSec ?? 0) + 's']);
    if (g.game === 'fishing') rows.push(['Casts', o.casts], ['Caught', o.caught]);
    if (g.game === 'mowing') rows.push(['Mown', o.mown], ['Time', o.time], ['Flowers', o.trampled ? '-' + o.trampled : 'fine']);
    rows.push(['Goal', g.goal], ['Best', Number(V()['minigame-best-' + g.id]) || 0]);
    return { rows, msg: o.message || '' };
  }
  function draw(now) {
    // a frame at most every 50 ms (at once after a key), and only when the raster or the facts changed
    if (!dirty && lastDraw >= 0 && now - lastDraw < 50) return;
    if (cur.G.renderHtml) return drawPage(now);
    const svg = cur.G.renderWorldSvg(cur.s), f = facts(), key = svg + JSON.stringify(f);
    lastDraw = now;
    if (!dirty && key === lastKey) return;
    lastKey = key; dirty = false;
    const g = cur.g;
    const curEl = g.game === 'match' && cur.phase === 'play' ? '<div class="moj-mini-cur" style="left:' + (cur.cx / cur.s.W) * 100 + '%;top:' + (cur.cy / cur.s.H) * 100 + '%;width:' + 100 / cur.s.W + '%;height:' + 100 / cur.s.H + '%"></div>' : '';
    const end = cur.phase === 'result'
      ? '<div class="moj-mini-end">' + (g.game === 'mowing' ? (cur.won ? 'Lawn mowed!' : 'Not enough of it cut') : cur.won ? 'You win!' : 'Better luck next time') + '</div><div>Score ' + esc(cur.s.score) + (cur.best ? ' (best)' : '') + (cur.pay ? ' · +' + cur.pay + ' gold' : '') + '</div><div class="moj-mini-keys">Space to go on</div>'
      : '<div class="moj-mini-msg">' + esc(f.msg || '') + '</div><div class="moj-mini-keys">' + esc(HINT[g.game] || '') + '</div>';
    root.innerHTML = '<div class="moj-w moj-mini-box"><div class="moj-mini-t">' + esc(g.title) + '</div><div class="moj-mini-row"><div class="moj-mini-frame">' + svg + curEl + '</div><div class="moj-mini-facts">' +
      f.rows.map((r) => '<div><span class="k">' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>').join('') + '</div></div>' + end + '</div>';
  }

  // a game drawn as a page: its own page, and under it at the end what the round came to
  function drawPage(now) {
    const g = cur.g, o = cur.G.resolveOverlay(cur.s), html = cur.G.renderHtml(cur.s);
    const end = cur.phase === 'result'
      ? '<div class="moj-w" style="margin-top:8px;text-align:center"><div class="moj-mini-end">' + (cur.won ? 'Quota met' : 'Quota missed') + '</div><div>' + esc(o.message || '') + (cur.pay ? ' · +' + cur.pay + ' pay' : '') + (cur.promoted ? ' · Promoted to ' + esc(cur.promoted) + '! Your new responsibilities include all of your old ones, and Kevin\'s.' : cur.won && g.each ? ' · A commendation for your file.' : '') + '</div><div class="moj-mini-keys">Space to go on</div></div>'
      : '<div class="moj-mini-keys" style="margin-top:6px;text-align:center">' + esc(HINT[g.game] || '') + '</div>';
    const key = html + end;
    lastDraw = now;
    if (!dirty && key === lastKey) return;
    lastKey = key; dirty = false;
    root.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">' + html + end + '</div>';
  }

  function listen() {
    const log = __busState.log;
    for (let i = seen; i < log.length; i++) {
      const ty = log[i] && log[i].type;
      if (typeof ty === 'string' && ty.indexOf('minigame:') === 0 && byId[ty.slice(9)]) pending.push(ty.slice(9));
    }
    seen = log.length;
  }
  function step(t) {
    const now = typeof t === 'number' ? t : 0, dt = lastT ? Math.max(0, Math.min(now - lastT, 1000)) : 0;
    lastT = now;
    listen();
    if (!cur && pending.length && !busy()) open(pending.shift());
    if (!cur) return;
    hold();
    if (cur.phase === 'play') {
      const k = cur.g.game, G = cur.G;
      if (k === 'blocks') {
        cur.left -= dt; cur.grav += dt;
        let guard = 0;
        while (cur.grav >= G.gravityMs(cur.s) && guard++ < 20) { cur.grav -= G.gravityMs(cur.s); cur.s = G.step(cur.s, 'tick'); }
        if (cur.left <= 0 || cur.s.over) finish();
      } else if (dt) {
        cur.s = G.step(cur.s, { type: 'tick', dt });
        if (cur.s.over) finish();
      }
    }
    draw(now);
  }
  const api = {
    step, open, act, finish, close,
    state: () => (cur ? { id: cur.g.id, game: cur.g.game, phase: cur.phase, score: cur.s.score, won: cur.won, pay: cur.pay, over: !!cur.s.over } : null),
    game: () => (cur ? cur.s : null),
  };
  window.__mojMini = api;
  return api;
}

const FILES = { blocks: ['brickster-core.js', 'brickster-skin.js'], match: ['philosophers-stone-core.js', 'philosophers-stone-skin.js'], fishing: ['fishing-core.js', 'fishing-skin.js'], mowing: ['mowing-core.js', 'mowing-skin.js'], deskwork: ['../deskwork/core.js', '../deskwork/skin.js'] };
// each game's face to the page: its reducer, its raster, its facts (match is the timed trial)
const FACE = {
  blocks: '{ newGame: (s) => newGame(s), step, renderWorldSvg: (s) => renderWorldSvg(s, 4), resolveOverlay, gravityMs }',
  match: "{ newGame: (s) => newGame(s, { mode: 'timed' }), step, renderWorldSvg: (s) => renderWorldSvg(s, 3), resolveOverlay }",
  fishing: '{ newGame: (s, o) => newGame(s, o), step, renderWorldSvg: (s) => renderWorldSvg(s, 4), resolveOverlay }',
  mowing: '{ newGame: (s, o) => newGame(s, o), step, renderWorldSvg: (s) => renderWorldSvg(s, 4), resolveOverlay }',
  deskwork: '{ newGame: (s, o) => newGame(s, o), step, renderHtml, resolveOverlay, wonOf, css: DESK_CSS, tabs: TABS, rankOf: (n) => Math.min(RANKS.length - 1, Math.floor(n / PER_RANK)), rankTitle }',
};
/** One game's code as an expression: its core and skin in a scope of their own (their names may meet another's). */
export const gameSource = (game) => `(function () {\n${FILES[game].map(inlineSource).join('\n')}\nreturn ${FACE[game]};\n})()`;
export const MINIGAME_GAMES = Object.freeze(Object.keys(FILES));

/** The channel's script, inside the events channel: the games the level plays, the page, its step (`__stepMinigames`). */
export function minigameScript(cfg) {
  const used = [...new Set((cfg && cfg.games || []).map((g) => g.game))].filter((g) => FILES[g]).sort();
  return `
// MINIGAMES: the games inside the game, in a window over the field (playscape/ui/minigames.js)
const MINI_CSS_TEXT = ${JSON.stringify(MINI_CSS)};
const __MINI_GAMES = (function () {
${inlineSource('pixelizer.js')}
return { ${used.map((g) => `${g}: ${gameSource(g)}`).join(',\n')} };
})();
const __mini = (${minigamePage.toString()})(EVENTS.minigames, __MINI_GAMES);
function __stepMinigames(t) { __mini.step(t); }`;
}
