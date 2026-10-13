import { CONTRACT_VERSION as GAME_CONTRACT_VERSION, MSG_INIT as GAME_MSG_INIT, MSG_OUTCOME as GAME_MSG_OUTCOME, MSG_READY as GAME_MSG_READY, MSG_DOOR as GAME_MSG_DOOR } from '../../game/level-contract.js';
import { FONTS } from '../../game/hud-widgets.js';
import { safeJson } from '../emit-util.js';

// game channel (game-metacontext.plan.md): the level-contract bridge. Emitted when the payload
// carries `game` — a LEVEL is a pure function (params, seed, ticks) → outcome envelope, and this
// block is its I/O surface. Params arrive from a hosting game shell via versioned postMessage
// (level posts game-ready, shell replies game-init); with no shell — opened standalone, or a
// capture run — the contract's presets.default feeds the level so it stays playable/auditable.
// ONE envelope leaves per session via __mojGame.end(); in a shell it posts game-outcome, always
// it lands on __mojGame.envelope so capture probes can assert it (the completability audit).
// The store lives in the shell, never here. Emitted in capture runs too (unlike audio): the
// bridge is inert I/O there — no DOM, no messaging — but the envelope must be observable.
export function gameChannelScript(game) {
  // a level left by one of several named exits (reach-exit `exit`, on `{ end, exit }`): only then does the envelope carry
  // `exit`, so a level without one keeps its bytes
  const exits = !!(game && game.on && Object.values(game.on).some((a) => a && typeof a.exit === 'string'));
  // the numbers it keeps (game.keep: a score, a time), read off the bus at the end and sent as stats.kept: only then
  const keeps = !!(game && Array.isArray(game.keep) && game.keep.length);
  // an emit that names its event ({event}: a broken block's broke:<id> kept as a flag of that name): only then
  const named = !!(game && game.on && Object.values(game.on).some((a) => a && a.emit && Object.values(a.emit).some((v) => v === '{event}')));
  return `
// ---- game channel (level contract bridge, opt-in) ----
const __GAME = ${safeJson(game)};
(function () {
  const __CV = ${GAME_CONTRACT_VERSION};
  // the style tokens (hud-widgets.js) a hosting shell sends beside game-init: set as --moj-* vars
  // on the root so the HUD widgets and the result card adopt the game's skin. Hex-only, re-guarded
  // here so a shell (or a hand-poked frame) can never inject into a CSS context.
  const __FONTS = ${safeJson(FONTS)};
  const __HEX = /^#[0-9a-fA-F]{3,8}$/;
  function __rgba(hex) { let h = hex.slice(1); if (h.length < 6) h = h.split('').map((c) => c + c).join(''); return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',.72)'; }
  function __applyStyle(tk) {
    if (!tk || typeof tk !== 'object') return;
    const rs = document.documentElement.style;
    for (const k of ['accent', 'accent2', 'ink', 'bg', 'panel', 'line']) {
      if (typeof tk[k] === 'string' && __HEX.test(tk[k])) { rs.setProperty('--moj-' + k, tk[k]); if (k === 'panel') rs.setProperty('--moj-panel-a', __rgba(tk[k])); }
    }
    if (typeof tk.font === 'string' && __FONTS[tk.font]) rs.setProperty('--moj-font', __FONTS[tk.font]);
  }
  const hosted = (function () { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();
  const capture = _capture;
  const st = { params: null, seed: 1, started: false, ended: false, events: [], envelope: null, onStart: [] };
  function start(params, seed) {
    if (st.started) return;
    st.started = true;
    st.params = params || {};
    if (typeof seed === 'number' && isFinite(seed)) st.seed = seed;
    st.onStart.splice(0).forEach((cb) => { try { cb(st.params, st.seed); } catch (e) { console.error('game onStart', e); } });
  }
  function emit(ev) { if (!st.ended && ev && typeof ev === 'object' && ev.type) st.events.push(ev); }
  function end(result, stats${exits ? ', exit' : ''}) {
    if (st.ended) return st.envelope;
    st.ended = true;
    st.envelope = { contractVersion: __CV, levelRef: __GAME.levelRef, seed: st.seed, result: result || 'success', events: st.events.slice() };${exits ? `
    // the way the level was left, when it has several (a map game travels by it)
    if (typeof exit === 'string' && exit) st.envelope.exit = exit;` : ''}
    // optional SCORE payload (additive — validateEnvelope ignores it; shells without a score
    // screen simply never read it): { pilot, rows: [{ id, name, kills, deaths, dmg, shots, hits }] }.
    if (stats && typeof stats === 'object') { try { st.envelope.stats = JSON.parse(JSON.stringify(stats)); } catch (e) { /* non-serializable stats are dropped, never fatal */ } }
    if (hosted && !capture) { try { window.parent.postMessage({ moj: '${GAME_MSG_OUTCOME}', envelope: st.envelope }, '*'); } catch (e) { console.error('game outcome post', e); } }
    // the RESULT CARD (game.complete: false hides it; { text } retitles it) — themed by the
    // --moj-* tokens, the literals are the fallbacks so an un-themed level looks as before.
    if (!capture && __GAME.complete !== false) {
      const title = __GAME.complete && typeof __GAME.complete.text === 'string' && __GAME.complete.text ? __GAME.complete.text : ('level ' + (st.envelope.result === 'success' ? 'complete' : st.envelope.result));
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.55);z-index:40;pointer-events:none';
      o.innerHTML = '<div style="background:var(--moj-panel-a,rgba(12,16,26,.92));border:1px solid var(--moj-line,#2a3b58);border-radius:10px;padding:18px 28px;color:var(--moj-ink,#dfe8f8);font:15px var(--moj-font,system-ui);text-align:center"><span class="moj-complete"></span><br><span style="font-size:12px;color:var(--moj-accent,#8fa5c8)">' + st.events.length + ' event' + (st.events.length === 1 ? '' : 's') + ' → store</span></div>';
      o.querySelector('.moj-complete').textContent = title;${keeps ? `
      const kp = st.envelope.stats && st.envelope.stats.kept;
      if (kp) o.querySelector('.moj-complete').textContent = title + ' · ' + kp.map((k) => k.label + ' ' + k.value + (k.unit || '')).join(' · ');` : ''}
      document.body.appendChild(o);
    }
    return st.envelope;
  }
${game.doors ? `  // a DOOR crossed (the door mechanic): leave by it once, carrying what the session gathered (result 'transit');
  // the shell loads the level it links to. With no shell, the door stays shut and says so.
  function door(id) {
    if (st.ended || st.leaving) return;
    const env = { contractVersion: __CV, levelRef: __GAME.levelRef, seed: st.seed, result: 'transit', events: st.events.slice() };
    if (hosted && !capture) { st.leaving = true; try { window.parent.postMessage({ moj: '${GAME_MSG_DOOR}', levelRef: __GAME.levelRef, door: id, envelope: env }, '*'); } catch (e) { console.error('game door post', e); } }
    else st.doorTried = id;
  }
  // entered BY a door (params.__entry): the pilot stands at that door's spawn, facing in (the controllable world
  // is built after this block, so it is looked for until it is up)
  st.onStart.push(function (params) {
    const e = params && params.__entry, d = e && (__GAME.doors || []).find((x) => x.id === e.door);
    if (!d) return;
    (function place(n) {
      const W = window.__mojCtrl && window.__mojCtrl.world, P = W && W.byId && W.byId[W.pilotId];
      if (!P) { if (n < 100) setTimeout(function () { place(n + 1); }, 50); return; }
      P.transform.pos = [d.spawn[0], d.spawn[1], d.spawn[2] + ((P.rule && P.rule.eye) || 0)];
      P.transform.heading = d.heading;
    })(0);
  });
` : ''}  window.__mojGame = {
    contract: __GAME,${game.doors ? `
    // the door this level was entered by (the shell's game-init params.__entry), and its end: where to stand
    get entry() { const e = st.params && st.params.__entry; return (e && (__GAME.doors || []).find((d) => d.id === e.door)) || null; },` : ''}
    get params() { return st.params; },
    get seed() { return st.seed; },
    get events() { return st.events.slice(); },
    get envelope() { return st.envelope; },
    onStart: function (cb) { if (st.started) cb(st.params, st.seed); else st.onStart.push(cb); },
    emit: emit,
    end: end,
  };
  // declarative bus → game mapping (mirrors audio.on): observe the drained event stream by
  // wrapping the reducer entry — reads only, so bus determinism (hash → replay) is untouched.
  if (__GAME.on && typeof __BUS !== 'undefined') {
    const glob = (str, pat) => {
      if (pat === '*') return true;
      if (pat.indexOf('*') < 0) return String(str) === pat;
      return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*') + '$').test(String(str));
    };
${keeps ? `    // the KEPT numbers (game.keep), as the level ends: each var off the bus, scaled, beside how the shell keeps its best
    const __kept = (state) => ({ kept: __GAME.keep.map((k) => ({ label: k.label, value: Math.round((Number(state.vars[k.var]) || 0) * (k.scale || 1) * 1000) / 1000, best: k.best, ...(k.unit ? { unit: k.unit } : {}) })) });
` : ''}    const prev = __BUS.processEvents;
    __BUS.processEvents = function (state, events) {
      // Match against state.log's DELTA, not the incoming array: the reducer cascades
      // reaction-emitted events (goal:reached, pickup:*) INTERNALLY (frontier=next), so they
      // never re-enter this wrapper as arguments. Every processed event — incoming facts AND
      // cascaded emissions — lands in the durable log, so the delta is the complete drained
      // stream. Read-only on bus state: determinism (hash → replay) is untouched.
      const n0 = state.log.length;
      const out = prev(state, events);
      for (let i = n0; i < state.log.length; i++) {
        const ev = state.log[i];
        if (!ev || !ev.type) continue;   // cap/noop markers carry no type
        for (const pat in __GAME.on) {
          if (!glob(ev.type, pat)) continue;
          const act = __GAME.on[pat];
          if (act.emit) ${named ? "{ const o = JSON.parse(JSON.stringify(act.emit)); for (const k in o) if (o[k] === '{event}') o[k] = ev.type; emit(o); }" : 'emit(JSON.parse(JSON.stringify(act.emit)));'}
          else if (act.end) end(act.end${keeps ? ', __kept(state)' : exits ? ', undefined' : ''}${exits ? ', act.exit' : ''});${game.doors ? `
          else if (act.door) door(act.door);` : ''}
          break;
        }
      }
      return out;
    };
  }
${game.chapters ? `  // CHAPTERS carried in (playscape/ui/chapters.js): a chapter whose flag the store already holds is applied at
  // once. The bus takes it as an input on its first frame (deferred: the events channel may load after this block).
  st.onStart.push(function (params) {
    const s = params && params[__GAME.chapters.slice], flags = (s && s.flags) || {};
    const due = __GAME.chapters.carried.filter((c) => flags[c.key]).map((c) => ({ type: c.event }));
    if (due.length) setTimeout(function () { try { __inputQueue.push.apply(__inputQueue, due); } catch (e) { console.error('chapters carried', e); } }, 0);
  });
` : ''}${game.powers ? `  // POWERS (a map game's power keys): a power gives its holder a move, a change to its rule. The ones the consumed slice
  // holds apply at start; one picked up here applies the moment the bus hears pickup:<power>. Reads only from the bus.
  const __pw = { on: {} };
  function __grant(id) {
    const g = __GAME.powers.grants[id], w = window.__mojCtrl && window.__mojCtrl.world, e = w && w.byId[__GAME.powers.target];
    if (!g || !e || __pw.on[id]) return;
    __pw.on[id] = true;
    if (e.rule) Object.assign(e.rule, g);
    if (e.pilotRule && e.pilotRule !== e.rule) Object.assign(e.pilotRule, g);
  }
  st.onStart.push(function (params) {
    const s = params && params[__GAME.powers.slice], items = (s && s.items) || {};
    setTimeout(function () { for (const id in items) if (items[id] > 0) { try { __grant(id); } catch (e) { console.error('power', e); } } }, 0);
  });
  if (typeof __BUS !== 'undefined') {
    const prevP = __BUS.processEvents;
    __BUS.processEvents = function (state, events) {
      const n0 = state.log.length, out = prevP(state, events);
      for (let i = n0; i < state.log.length; i++) { const ev = state.log[i]; if (ev && typeof ev.type === 'string' && ev.type.indexOf('pickup:') === 0) __grant(ev.type.slice(7)); }
      return out;
    };
  }
` : ''}${game.flags ? `  // FLAGS carried in (playscape/ui/scenes.js): each held flag reaches the bus on its first frame, then flags-ready, which
  // a scene on the level's start waits for, so its conditions read what was carried in (deferred, as chapters are).
  st.onStart.push(function (params) {
    const s = __GAME.flags.slice && params && params[__GAME.flags.slice], held = (s && s.flags) || {};
    const evs = __GAME.flags.names.filter((n) => held[n]).map((n) => ({ type: 'flag-carried:' + n }));
    // items held in the carried inventories, and levels the campaign records completed
    const I = __GAME.flags.items, D = __GAME.flags.done;
    if (I) for (const n of I.names) if (I.slices.some((sl) => { const v = params && params[sl]; return v && v.items && v.items[n] > 0; })) evs.push({ type: 'has-carried:' + n });
    if (D) { const c = params && params[D.slice], dn = (c && c.completed) || {}; for (const k in D.levels) if (dn[D.levels[k]]) evs.push({ type: 'done-carried:' + k }); }
    evs.push({ type: 'flags-ready' });
    setTimeout(function () { try { __inputQueue.push.apply(__inputQueue, evs); } catch (e) { console.error('flags carried', e); } }, 0);
  });
` : ''}${game.bag ? `  // the BAG carried (the bag mechanic): the level starts with the slice's items in its bag (the bus's held:bag:<item>
  // vars, set as the bus comes up), and each bag:in:<item>:<n> / bag:out:<item>:<n> the bus says goes back as a grant /
  // consume
  st.onStart.push(function (params) {
    const s = params && params[__GAME.bag.slice], items = (s && s.items) || {};
    (function fill(n) {
      const B = window.__mojBus;
      if (!B) { if (n < 100) setTimeout(function () { fill(n + 1); }, 50); return; }
      for (const k in items) if (items[k] > 0) B.state.vars['held:bag:' + k] = items[k];
    })(0);
  });
  if (typeof __BUS !== 'undefined') {
    const prevB = __BUS.processEvents;
    __BUS.processEvents = function (state, events) {
      const n0 = state.log.length, out = prevB(state, events);
      for (let i = n0; i < state.log.length; i++) {
        const ev = state.log[i];
        const m = ev && typeof ev.type === 'string' ? /^bag:(in|out):([a-z0-9-]+):(\\d+)$/.exec(ev.type) : null;
        if (m) emit({ type: m[1] === 'in' ? 'grant' : 'consume', slice: __GAME.bag.slice, item: m[2], count: Number(m[3]) });
      }
      return out;
    };
  }
` : ''}${game.aftermath ? `  // AFTERMATH carried in (the aftermath mechanic): each block a flag in the slice says broke here before is taken away at
  // the start, without the shatter (the controllable world is built after this block: it is looked for until it is up)
  st.onStart.push(function (params) {
    const s = params && params[__GAME.aftermath.slice], fl = (s && s.flags) || {};
    const ids = Object.keys(fl).filter((k) => fl[k] && k.indexOf('broke:') === 0).map((k) => k.slice(6));
    if (!ids.length) return;
    (function restore(n) {
      const C = window.__mojCtrl;
      if (!C || !C.restore) { if (n < 100) setTimeout(function () { restore(n + 1); }, 50); return; }
      for (const id of ids) C.restore(id);
    })(0);
  });
` : ''}${Array.isArray(game.arrive) && game.arrive.length ? `  // ARRIVAL (a map game): the shell names the level travelled in from; the bus hears arrive:<ref> on its first frame
  // and the level's own events move the pilot to that end (deferred, as chapters are: the events channel may load later).
  st.onStart.push(function (params) {
    const from = params && params.arrive;
    if (typeof from === 'string' && __GAME.arrive.indexOf(from) >= 0) setTimeout(function () { try { __inputQueue.push({ type: 'arrive:' + from }); } catch (e) { console.error('arrive', e); } }, 0);
  });
` : ''}  // handshake: hosted levels announce and await params; standalone/capture runs fall back to
  // the contract's default preset (1.5s grace for a slow shell; capture never waits).
  function fallback() { start((__GAME.presets && __GAME.presets.default) || {}, 1); }
  if (hosted && !capture) {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.moj !== '${GAME_MSG_INIT}') return;
      if (d.contractVersion !== __CV) { console.error('game: shell contract v' + d.contractVersion + ' ≠ level v' + __CV + ' — running presets'); fallback(); return; }
      __applyStyle(d.theme);   // presentation sidecar (unversioned): the shell's skin reaches the level
      start(d.params, d.seed);
    });
    try { window.parent.postMessage({ moj: '${GAME_MSG_READY}', contractVersion: __CV, levelRef: __GAME.levelRef }, '*'); } catch (e) { /* opaque parent */ }
    setTimeout(() => { if (!st.started) fallback(); }, 1500);
  } else {
    fallback();
  }
})();`;
}
