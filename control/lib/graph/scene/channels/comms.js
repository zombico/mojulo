import { safeJson } from '../emit-util.js';

// In-page script: COMMS, a level's spoken lines shown as they are said (gameworld/script.js: each line raised on the bus
// as `comms:<id>` at its moment). One at a time, in the order raised: the speaker's portrait (its initials on its colour,
// until a portrait is drawn), its name, the words as a subtitle; each held for as long as it takes to read (COMMS.base
// seconds, and COMMS.perChar a letter), then the next. It reads the bus as the page's other listeners do (the run of
// events processed, its log's new entries) and writes nothing back. Emitted only on a level with a script: every other
// page byte-identical. `window.__mojComms` { said: [ids], showing: () => id | null } is its probe.
export const COMMS = Object.freeze({ base: 1.8, perChar: 0.055, most: 9 });
const COLOURS = Object.freeze(['#e0a040', '#4fb3d9', '#d9604f', '#7fcf7f', '#b58fe0']);

/** The page's data: the lines by id, each with its speaker's name, initials and colour (a speaker with none takes one
 *  of COLOURS by its place among the speakers). */
export function commsData({ speakers = {}, lines = [] }) {
  const who = [...new Set(lines.map((L) => L.who))];
  const S = Object.fromEntries(who.map((w, i) => {
    const name = speakers[w]?.name ?? w.replace(/(^|-)(\w)/g, (m, d, c) => (d ? ' ' : '') + c.toUpperCase());
    const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return [w, { name, initials, colour: speakers[w]?.colour ?? COLOURS[i % COLOURS.length] }];
  }));
  return { lines: Object.fromEntries(lines.map((L) => [L.id, { who: L.who, text: L.text }])), speakers: S };
}

export function commsScript(data) {
  return `
// --- comms: the level's spoken lines as they are said (gameworld/script.js) ---
(function () {
  const CM = ${safeJson(data)}, C = ${JSON.stringify(COMMS)};
  const host = (typeof wrap !== 'undefined' && wrap) || document.body;
  const sheet = document.createElement('style');
  sheet.textContent = '.moj-cm{position:absolute;left:24px;top:132px;display:flex;gap:12px;align-items:flex-start;max-width:min(460px,60%);padding:10px 14px 10px 10px;background:rgba(8,12,18,.72);border:1px solid rgba(160,200,230,.28);border-left-width:3px;pointer-events:none;z-index:15;transition:opacity .25s;opacity:0}'
    + '.moj-cm.on{opacity:1}.moj-cm .pt{flex:none;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font:700 20px/1 ui-monospace,Menlo,monospace;color:#0b0f15}'
    + '.moj-cm .nm{font:700 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}.moj-cm .tx{font:500 16px/1.4 system-ui,sans-serif;color:#eef4f8;text-shadow:0 1px 2px rgba(0,0,0,.8)}';
  document.head.appendChild(sheet);
  const box = document.createElement('div'); box.className = 'moj-cm'; box.innerHTML = '<div class="pt"></div><div><div class="nm"></div><div class="tx"></div></div>'; host.appendChild(box);
  const pt = box.querySelector('.pt'), nm = box.querySelector('.nm'), tx = box.querySelector('.tx');
  const queue = [], said = [];
  let now = null, until = 0;
  function show(id) {
    const L = CM.lines[id], S = L && CM.speakers[L.who];
    if (!L || !S) return;
    now = id; said.push(id); until = performance.now() + 1000 * (C.base + C.perChar * L.text.length);
    pt.textContent = S.initials; pt.style.background = S.colour; nm.textContent = S.name; nm.style.color = S.colour; box.style.borderLeftColor = S.colour;
    tx.textContent = L.text; box.className = 'moj-cm on';
  }
  // (the bus's run: each event of the kind comms:<id> queued, as it is processed)
  function listen() {
    let B = null;
    try { B = typeof __BUS !== 'undefined' ? __BUS : null; } catch (e) { return false; }   // (the bus not declared yet)
    if (!B || !B.processEvents || B.__comms) return !!(B && B.__comms);
    const pe = B.processEvents; B.__comms = true;
    B.processEvents = function (state, events) {
      const n0 = state.log.length, out = pe(state, events);
      for (let i = n0; i < state.log.length; i++) { const ev = state.log[i]; if (ev && typeof ev.type === 'string' && ev.type.indexOf('comms:') === 0 && queue.length < C.most) queue.push(ev.type.slice(6)); }
      return out;
    };
    return true;
  }
  (function tick() {
    listen();
    const t = performance.now();
    if (now && t > until) { now = null; box.className = 'moj-cm'; until = t + 250; }
    else if (!now && t > until && queue.length) show(queue.shift());
    requestAnimationFrame(tick);
  })();
  window.__mojComms = { said, showing: () => now };
})();
`;
}
