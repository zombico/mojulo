/**
 * game-shell — emit the standalone game artifact's hub page (game-metacontext.plan.md).
 *
 * `emitGameShell(manifest, levels)` → one self-contained, dependency-free game.html that OWNS
 * the store and hosts levels in an iframe. The store kernel ships inside it via
 * `buildGameStoreKernel.toString()` (the beats-kernel emit discipline), reducers already
 * generated from the manifest's schema — no mojulo, no network, no keys at runtime.
 *
 * The session loop (the only writes the store ever sees):
 *   1. setup screen — rendered from the level contract's `consumes` (a pick renders a
 *      checkbox loadout/roster picker capped at pick.max; everything else carries whole)
 *   2. shell → level   { moj: 'game-init', contractVersion, params, seed }  (after game-ready)
 *   3. level → shell   { moj: 'game-outcome', envelope }  — once, at level end
 *   4. K.applyOutcome validates against the level's `produces` and applies ATOMICALLY;
 *      the envelope lands in the runLog; the save persists.
 *
 * Saves: localStorage (feature-detected; in-memory fallback with a visible notice) + export /
 * import as a JSON file — { contractVersion, storeState, runLog }, replayable and portable.
 * Seeds are deterministic by doctrine (no Date.now / Math.random anywhere): session seed =
 * runLog.length + 1.
 *
 * `levels` entries: { ref, title?, contract, src? } — contract is the level's NORMALIZED
 * game channel (level-contract.js); src defaults to `levels/<ref>.html` beside game.html in
 * the staged artifact folder.
 */

import { buildGameStoreKernel } from './store-kernel.js';
import { CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME } from './level-contract.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function emitGameShell(manifest, levels = []) {
  if (!manifest || manifest.kind !== 'game') throw new Error("emitGameShell needs a validated game manifest (kind: 'game')");
  const byRef = new Map(levels.map((l) => [l.ref, l]));
  for (const lv of manifest.levels) {
    if (!byRef.has(lv.ref)) throw new Error(`emitGameShell: manifest level '${lv.ref}' has no matching entry in levels[] (need its contract + src)`);
    if (!byRef.get(lv.ref).contract) throw new Error(`emitGameShell: level '${lv.ref}' is missing its contract — a level is promoted into a game WITH its signature`);
  }
  const levelTable = manifest.levels.map((lv) => {
    const l = byRef.get(lv.ref);
    return { ref: lv.ref, title: lv.title || l.title || lv.ref, gate: lv.gate || null, src: l.src || `levels/${lv.ref}.html`, contract: l.contract };
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(manifest.title)}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:14px/1.5 system-ui,sans-serif}
  header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid #1c2942;flex-wrap:wrap}
  h1{font-size:16px;margin:0;color:#eaf2ff}
  header .spacer{flex:1}
  button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit}
  button:disabled{opacity:.4;cursor:not-allowed}
  button.primary{background:#1b2740;color:#fff}
  #notice{padding:4px 16px;font-size:12px;color:#e8b96a;display:none}
  #main{padding:14px 16px;max-width:960px;margin:0 auto}
  .level{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #1c2942;border-radius:8px;margin:8px 0;background:rgba(13,19,33,.6)}
  .level .name{flex:1}
  .level .done{color:#7ed49a;font-size:12px}
  .level .lock{color:#8fa5c8;font-size:12px}
  .card{border:1px solid #1c2942;border-radius:8px;padding:12px 14px;margin:10px 0;background:rgba(13,19,33,.6)}
  .card h3{margin:0 0 8px;font-size:13px;color:#9cc4ff;text-transform:uppercase;letter-spacing:.4px}
  label.pick{display:inline-flex;align-items:center;gap:6px;margin:3px 10px 3px 0;padding:4px 8px;border:1px solid #24324a;border-radius:6px;cursor:pointer}
  pre{white-space:pre-wrap;background:rgba(9,13,23,.8);border:1px solid #1c2942;border-radius:6px;padding:8px;font-size:12px;color:#a9c1e8;overflow-x:auto}
  #frame{width:100%;aspect-ratio:16/10;border:1px solid #1c2942;border-radius:8px;background:#000;display:none}
  #toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(12,16,26,.95);border:1px solid #2a3b58;border-radius:8px;padding:10px 18px;display:none;max-width:80%;color:#dfe8f8}
  #toast.err{border-color:#8a3b3b;color:#f2c9c9}
</style></head><body>
<header>
  <h1>${esc(manifest.title)}</h1>
  <span class="spacer"></span>
  <button id="exportBtn" title="download the save as a portable JSON file">export save</button>
  <button id="importBtn">import save</button>
  <input id="importFile" type="file" accept="application/json" style="display:none">
  <button id="resetBtn" title="wipe the save and start over">reset</button>
</header>
<div id="notice"></div>
<div id="main"></div>
<iframe id="frame" title="level"></iframe>
<div id="toast"></div>
<script>
// ---- the store kernel, generated reducers included (single source of truth) ----
const K = (${buildGameStoreKernel.toString()})();
const MANIFEST = ${JSON.stringify(manifest)};
const LEVELS = ${JSON.stringify(levelTable)};
const SCHEMA = MANIFEST.store;
const SAVE_KEY = 'moj-game:' + ${JSON.stringify(manifest.title)};

// ---- persistence: localStorage feature-detected, in-memory fallback (visible) ----
const mem = {};
const storage = (function () {
  try { localStorage.setItem(SAVE_KEY + ':probe', '1'); localStorage.removeItem(SAVE_KEY + ':probe'); return localStorage; }
  catch (e) {
    const n = document.getElementById('notice');
    n.style.display = 'block';
    n.textContent = 'storage unavailable here (file:// quirk?) — this session will not persist. Export your save, or serve the folder with any static server.';
    return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  }
})();

let state, runLog;
function boot() {
  const raw = storage.getItem(SAVE_KEY);
  if (raw) {
    const p = K.parseSave(raw);
    if (p.ok) { state = p.save.storeState; runLog = p.save.runLog; return; }
    console.error('save rejected, starting fresh:', p.errors);
  }
  state = K.createStore(SCHEMA);
  runLog = [];
}
function persist() { storage.setItem(SAVE_KEY, K.makeSave(state, runLog)); }
boot();

// ---- UI ----
const main = document.getElementById('main');
const frame = document.getElementById('frame');
let session = null;   // { level, params, seed } while a level runs

function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = err ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.style.display = 'none'; }, err ? 8000 : 3500);
}

function sliceKindOf(name) { const sl = SCHEMA.slices.find((s) => s.name === name); return sl && sl.kind; }
function completedResult(ref) {
  for (const sl of SCHEMA.slices) if (sl.kind === 'progression' && state[sl.name].completed[ref]) return state[sl.name].completed[ref];
  return null;
}

function renderHome() {
  session = null;
  frame.style.display = 'none';
  frame.src = 'about:blank';
  main.innerHTML = '<h2 style="font-size:14px;color:#9cc4ff">levels</h2>';
  for (const lv of LEVELS) {
    const open = K.evalGate(SCHEMA, state, lv.gate);
    const row = document.createElement('div');
    row.className = 'level';
    const done = completedResult(lv.ref);
    row.innerHTML = '<span class="name">' + lv.title + '</span>'
      + (done ? '<span class="done">' + done + '</span>' : '')
      + (open ? '' : '<span class="lock">locked — ' + (lv.gate.completed ? 'complete ' + lv.gate.completed : 'needs ' + lv.gate.flag) + '</span>');
    const btn = document.createElement('button');
    btn.textContent = 'play';
    btn.disabled = !open;
    btn.className = 'primary';
    btn.addEventListener('click', () => renderSetup(lv));
    row.appendChild(btn);
    main.appendChild(row);
  }
  const store = document.createElement('div');
  store.className = 'card';
  store.innerHTML = '<h3>store</h3><pre>' + JSON.stringify(state, null, 2) + '</pre>'
    + '<div style="font-size:12px;color:#8fa5c8">' + runLog.length + ' session' + (runLog.length === 1 ? '' : 's') + ' in the run log</div>';
  main.appendChild(store);
}

// the pre-level setup screen: a param composer over the level contract's consumes.
function renderSetup(lv) {
  main.innerHTML = '<h2 style="font-size:14px;color:#9cc4ff">' + lv.title + ' — setup</h2>';
  const pickers = [];
  for (const c of (lv.contract.consumes || [])) {
    const kind = sliceKindOf(c.slice);
    const card = document.createElement('div');
    card.className = 'card';
    if (c.pick && (kind === 'inventory' || kind === 'party')) {
      const entries = kind === 'inventory'
        ? Object.entries(state[c.slice].items).map(([id, n]) => ({ id, label: id + ' ×' + n }))
        : Object.entries(state[c.slice].roster).map(([id, m]) => ({ id, label: m.name + ' (lv ' + m.level + ')' }));
      card.innerHTML = '<h3>' + c.slice + ' — take up to ' + c.pick.max + '</h3>';
      const boxes = [];
      for (const e of entries) {
        const label = document.createElement('label');
        label.className = 'pick';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = e.id;
        box.addEventListener('change', () => {
          if (boxes.filter((b) => b.checked).length > c.pick.max) box.checked = false;
        });
        label.appendChild(box);
        label.appendChild(document.createTextNode(e.label));
        card.appendChild(label);
        boxes.push(box);
      }
      if (!entries.length) card.innerHTML += '<div style="font-size:12px;color:#8fa5c8">nothing to take — the ' + c.slice + ' is empty</div>';
      pickers.push({ c, kind, boxes });
    } else {
      card.innerHTML = '<h3>' + c.slice + ' — carried along</h3><pre>' + JSON.stringify(state[c.slice], null, 2) + '</pre>';
      pickers.push({ c, kind, boxes: null });
    }
    main.appendChild(card);
  }
  const bar = document.createElement('div');
  const start = document.createElement('button');
  start.textContent = 'start level';
  start.className = 'primary';
  start.addEventListener('click', () => startLevel(lv, pickers));
  const back = document.createElement('button');
  back.textContent = 'back';
  back.style.marginLeft = '8px';
  back.addEventListener('click', renderHome);
  bar.appendChild(start); bar.appendChild(back);
  main.appendChild(bar);
}

function startLevel(lv, pickers) {
  const params = {};
  for (const p of pickers) {
    const name = p.c.slice;
    if (!p.boxes) { params[name] = JSON.parse(JSON.stringify(state[name])); continue; }
    const chosen = new Set(p.boxes.filter((b) => b.checked).map((b) => b.value));
    if (p.kind === 'inventory') {
      const items = {};
      for (const id of chosen) items[id] = state[name].items[id];
      params[name] = { items };
    } else {
      const roster = {};
      for (const id of chosen) roster[id] = JSON.parse(JSON.stringify(state[name].roster[id]));
      params[name] = { roster };
    }
  }
  session = { level: lv, params, seed: runLog.length + 1 };
  main.innerHTML = '<h2 style="font-size:14px;color:#9cc4ff">' + lv.title + '</h2>';
  const back = document.createElement('button');
  back.textContent = 'abandon level';
  back.addEventListener('click', renderHome);
  main.appendChild(back);
  frame.style.display = 'block';
  frame.src = lv.src;
}

// ---- the shell↔level wire (versioned both directions; refuse legibly on drift) ----
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || !session || e.source !== frame.contentWindow) return;
  if (d.moj === ${JSON.stringify(MSG_READY)}) {
    if (d.contractVersion !== K.CONTRACT_VERSION) {
      toast('level "' + session.level.ref + '" speaks contract v' + d.contractVersion + ' but this shell is v' + K.CONTRACT_VERSION + ' — re-stage the artifact.', true);
      return;
    }
    frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_INIT)}, contractVersion: K.CONTRACT_VERSION, params: session.params, seed: session.seed }, '*');
  }
  if (d.moj === ${JSON.stringify(MSG_OUTCOME)}) {
    const r = K.applyOutcome(SCHEMA, state, session.level.contract, d.envelope);
    if (!r.ok) { toast('outcome rejected (store untouched): ' + r.errors.join('; '), true); return; }
    state = r.state;
    runLog.push(d.envelope);
    persist();
    toast(session.level.title + ': ' + d.envelope.result + ' — ' + (d.envelope.events || []).length + ' event(s) applied');
    renderHome();
  }
});

// ---- save management: export / import / reset ----
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([K.makeSave(state, runLog)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ${JSON.stringify(manifest.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} + '.save.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const p = K.parseSave(String(reader.result));
    if (!p.ok) { toast('save rejected: ' + p.errors.join('; '), true); return; }
    state = p.save.storeState;
    runLog = p.save.runLog;
    persist();
    toast('save imported — ' + runLog.length + ' session(s)');
    renderHome();
  };
  reader.readAsText(f);
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Wipe the save and start over?')) return;
  storage.removeItem(SAVE_KEY);
  boot();
  renderHome();
});

renderHome();
</script>
</body></html>`;
}

export { CONTRACT_VERSION };
