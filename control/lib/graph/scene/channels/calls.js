import { safeJson } from '../emit-util.js';

// In-page script: THE CALL SCREEN, a level's radio calls (gameworld/script.js `calls`: each raised on the bus as
// `call:<id>` at its moment). A call stops the game: the world held (window.__mojFreeze, as a menu holds it), a screen
// over it with the two on the line (the one called on the left, the caller on the right, each a portrait: its initials on
// its colour until a portrait is drawn), the speaker lit and named, the words; Enter, Space or a click passes a line,
// Escape (or Backspace) ends the call. The last line passed, the world goes on where it was. A call is made once unless
// it says `again`; calls raised while one is up wait their turn. It reads the bus as the page's other listeners do and
// writes nothing back but `call:<id>:end` (and `:skip`), raised on the bus as the call ends. A call waits while the
// game's opening is up (channels/game-screens.js), so the first call comes once the level is played. Emitted only on a level with
// calls: every other page byte-identical. `window.__mojCalls` { made: [ids], showing: () => { call, line } | null,
// next(), skip() } is its probe.
export const CALLS = Object.freeze({ most: 6, fade: 0.2, settle: 0.35 });
const COLOURS = Object.freeze(['#e0a040', '#4fb3d9', '#d9604f', '#7fcf7f', '#b58fe0']);

/** The page's data: each call by id, its lines and who it is between, and each speaker's name, initials and colour. */
export function callsData({ speakers = {}, calls = [] }) {
  const who = [...new Set(calls.flatMap((C) => C.lines.map((L) => L.who)))];
  const S = Object.fromEntries(who.map((w, i) => {
    const name = speakers[w]?.name ?? w.replace(/(^|-)(\w)/g, (m, d, c) => (d ? ' ' : '') + c.toUpperCase());
    const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return [w, { name, initials, colour: speakers[w]?.colour ?? COLOURS[i % COLOURS.length] }];
  }));
  // (the two on the line: the first to speak whose line is not the caller's is the one called, on the left)
  const calls2 = Object.fromEntries(calls.map((C) => {
    const ws = [...new Set(C.lines.map((L) => L.who))], caller = C.from ?? ws[ws.length > 1 ? 1 : 0], called = ws.find((w) => w !== caller) ?? null;
    return [C.id, { lines: C.lines.map((L) => ({ id: L.id, who: L.who, text: L.text })), left: called, right: caller, ...(C.again ? { again: true } : {}) }];
  }));
  return { calls: calls2, speakers: S };
}

export function callsScript(data) {
  return `
// --- calls: the level's radio calls, the game held while each is on (gameworld/script.js) ---
(function () {
  const CD = ${safeJson(data)}, C = ${JSON.stringify(CALLS)};
  const host = document.body;
  const sheet = document.createElement('style');
  sheet.textContent = '.moj-call{position:fixed;inset:0;z-index:58;display:flex;align-items:flex-end;justify-content:center;padding:0 16px 7vh;background:rgba(4,8,12,.55);opacity:0;pointer-events:none;transition:opacity ' + C.fade + 's}'
    + '.moj-call.on{opacity:1;pointer-events:auto}.moj-call .box{width:min(880px,100%);display:flex;gap:16px;align-items:stretch;padding:14px;background:rgba(8,12,18,.92);border:1px solid rgba(160,200,230,.3)}'
    + '.moj-call .pt{flex:none;width:92px;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:.38;transition:opacity .15s}.moj-call .pt.lit{opacity:1}'
    + '.moj-call .face{width:92px;height:92px;display:flex;align-items:center;justify-content:center;font:700 30px/1 ui-monospace,Menlo,monospace;color:#0b0f15}'
    + '.moj-call .who{font:700 11px/1.2 ui-monospace,Menlo,monospace;letter-spacing:1.5px;text-transform:uppercase;color:#cfe0ea;text-align:center}'
    + '.moj-call .mid{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}.moj-call .nm{font:700 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:2px;text-transform:uppercase}'
    + '.moj-call .tx{font:500 19px/1.45 system-ui,sans-serif;color:#eef4f8;min-height:2.9em}.moj-call .keys{margin-top:auto;font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:1px;color:#8fa3b0;text-transform:uppercase}'
    + '.moj-call .tag{font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:3px;color:#8fa3b0;text-transform:uppercase}'
    + '@media (max-width:640px){.moj-call .pt{width:56px}.moj-call .face{width:56px;height:56px;font-size:20px}.moj-call .tx{font-size:16px}}';
  document.head.appendChild(sheet);
  const el = document.createElement('div'); el.className = 'moj-call';
  el.innerHTML = '<div class="box"><div class="pt l"><div class="face"></div><div class="who"></div></div><div class="mid"><div class="tag">Radio</div><div class="nm"></div><div class="tx"></div><div class="keys">Enter  next · Esc  end call</div></div><div class="pt r"><div class="face"></div><div class="who"></div></div></div>';
  host.appendChild(el);
  const $ = (s) => el.querySelector(s), L = $('.pt.l'), R = $('.pt.r'), nm = $('.nm'), tx = $('.tx');
  const queue = [], made = [];
  let call = null, k = 0, froze = false, opened = 0, shut = -1e9;
  const face = (P, w) => { const S = w && CD.speakers[w]; P.style.visibility = S ? '' : 'hidden'; if (!S) return; P.querySelector('.face').textContent = S.initials; P.querySelector('.face').style.background = S.colour; P.querySelector('.who').textContent = S.name; };
  function line() {
    const Ln = call.def.lines[k], S = CD.speakers[Ln.who];
    nm.textContent = S.name; nm.style.color = S.colour; tx.textContent = Ln.text;
    L.classList.toggle('lit', Ln.who === call.def.left); R.classList.toggle('lit', Ln.who === call.def.right);
  }
  // (the call's end on the bus, so a task or a line can wait on it: the page's bus, channels/events.js)
  function raise(type) { try { const M = window.__mojBus; if (M && M.bus && M.state) M.bus.processEvents(M.state, [{ type }]); } catch (e) {} }
  function open(id) {
    const def = CD.calls[id]; if (!def) return;
    call = { id, def }; k = 0; made.push(id); opened = performance.now();
    froze = !window.__mojFreeze; window.__mojFreeze = true;
    face(L, def.left); face(R, def.right); line(); el.className = 'moj-call on';
  }
  function close(how) {
    if (!call) return;
    const id = call.id; call = null; el.className = 'moj-call';
    if (froze) window.__mojFreeze = false; froze = false;
    window.__mojCallEnded = (window.__mojCallEnded || []).concat([{ id, how }]);
    raise('call:' + id + ':end'); if (how === 'skip') raise('call:' + id + ':skip');
    shut = performance.now();
  }
  // (a press that came as the call opened, the one that started the level among them, passes nothing)
  function next() { if (!call || performance.now() - opened < C.settle * 1000) return; if (++k >= call.def.lines.length) close('end'); else line(); }
  function skip() { if (call) close('skip'); }
  // (a call's keys are its own while it is up: none reaches the game under it)
  window.addEventListener('keydown', (e) => {
    if (!call) return;
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) next(); }
    else if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
    else e.stopImmediatePropagation();
  }, true);
  el.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  function want(id) {
    if (!CD.calls[id] || (!CD.calls[id].again && (made.includes(id) || queue.includes(id) || (call && call.id === id)))) return;
    if (queue.length < C.most) queue.push(id);
  }
  // (a call waits its turn: never over the game's opening, its title or its chapter's card, nor straight after another)
  // (a game with an opening is held from its first frame, before the opening has drawn itself: wait for it to be gone)
  // (read before the game's own script has run, the game is not up yet: wait)
  const opens = () => { try { return typeof __GAME !== 'undefined' && !!__GAME && !!__GAME.opening; } catch (e) { return null; } };
  const clear = () => { const O = opens(), S = window.__mojScreens, o = S && S.opening; return O === null ? false : O ? o === 'gone' : !o || o === 'gone'; };
  function pump() { if (!call && queue.length && clear() && performance.now() - shut > C.fade * 1000 + 60) open(queue.shift()); }
  // (the bus's run: each event of the kind call:<id> heard as it is processed)
  function listen() {
    let B = null;
    try { B = typeof __BUS !== 'undefined' ? __BUS : null; } catch (e) { return false; }
    if (!B || !B.processEvents || B.__calls) return !!(B && B.__calls);
    const pe = B.processEvents; B.__calls = true;
    B.processEvents = function (state, events) {
      const n0 = state.log.length, out = pe(state, events);
      for (let i = n0; i < state.log.length; i++) { const ev = state.log[i]; if (ev && typeof ev.type === 'string' && ev.type.indexOf('call:') === 0) want(ev.type.slice(5)); }
      return out;
    };
    // (and what it already heard: a call on the level's start is raised in the frame it begins, before this listens)
    try { const M = window.__mojBus, log = (M && M.state && M.state.log) || []; for (const ev of log) if (ev && typeof ev.type === 'string' && ev.type.indexOf('call:') === 0) want(ev.type.slice(5)); } catch (e) {}
    return true;
  }
  (function tick() { listen(); pump(); requestAnimationFrame(tick); })();
  window.__mojCalls = { made, showing: () => (call ? { call: call.id, line: call.def.lines[k].id } : null), next, skip, want, clear, opens };
})();
`;
}
