import { CONTRACT_VERSION as GAME_CONTRACT_VERSION, MSG_INIT as GAME_MSG_INIT, MSG_OUTCOME as GAME_MSG_OUTCOME, MSG_READY as GAME_MSG_READY } from '../../game/level-contract.js';
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
  return `
// ---- game channel (level contract bridge, opt-in) ----
const __GAME = ${safeJson(game)};
(function () {
  const __CV = ${GAME_CONTRACT_VERSION};
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
  function end(result, stats) {
    if (st.ended) return st.envelope;
    st.ended = true;
    st.envelope = { contractVersion: __CV, levelRef: __GAME.levelRef, seed: st.seed, result: result || 'success', events: st.events.slice() };
    // optional SCORE payload (additive — validateEnvelope ignores it; shells without a score
    // screen simply never read it): { pilot, rows: [{ id, name, kills, deaths, dmg, shots, hits }] }.
    if (stats && typeof stats === 'object') { try { st.envelope.stats = JSON.parse(JSON.stringify(stats)); } catch (e) { /* non-serializable stats are dropped, never fatal */ } }
    if (hosted && !capture) { try { window.parent.postMessage({ moj: '${GAME_MSG_OUTCOME}', envelope: st.envelope }, '*'); } catch (e) { console.error('game outcome post', e); } }
    if (!capture) {
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.55);z-index:40;pointer-events:none';
      o.innerHTML = '<div style="background:rgba(12,16,26,.92);border:1px solid #2a3b58;border-radius:10px;padding:18px 28px;color:#dfe8f8;font:15px system-ui;text-align:center">level ' + (st.envelope.result === 'success' ? 'complete' : st.envelope.result) + '<br><span style="font-size:12px;color:#8fa5c8">' + st.events.length + ' event' + (st.events.length === 1 ? '' : 's') + ' → store</span></div>';
      document.body.appendChild(o);
    }
    return st.envelope;
  }
  window.__mojGame = {
    contract: __GAME,
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
    const prev = __BUS.processEvents;
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
          if (act.emit) emit(JSON.parse(JSON.stringify(act.emit)));
          else if (act.end) end(act.end);
          break;
        }
      }
      return out;
    };
  }
  // handshake: hosted levels announce and await params; standalone/capture runs fall back to
  // the contract's default preset (1.5s grace for a slow shell; capture never waits).
  function fallback() { start((__GAME.presets && __GAME.presets.default) || {}, 1); }
  if (hosted && !capture) {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.moj !== '${GAME_MSG_INIT}') return;
      if (d.contractVersion !== __CV) { console.error('game: shell contract v' + d.contractVersion + ' ≠ level v' + __CV + ' — running presets'); fallback(); return; }
      start(d.params, d.seed);
    });
    try { window.parent.postMessage({ moj: '${GAME_MSG_READY}', contractVersion: __CV, levelRef: __GAME.levelRef }, '*'); } catch (e) { /* opaque parent */ }
    setTimeout(() => { if (!st.started) fallback(); }, 1500);
  } else {
    fallback();
  }
})();`;
}
