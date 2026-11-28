/**
 * The MAP channel: a played city's map on the page, on mana-ui (gameworld/city-map.js lays it: the plan as shapes, what
 * stands on it as markers with icons). Two places: a RADAR in the corner (mana's `radar-corner`: the ground round the
 * pilot, the way it faces up or north up), and the MAP opened with M (mana's `map-screen`: the whole place, a key to its
 * icons beside it), turned through its views with V (from straight above, as a miniature on a table, following), zoomed
 * with + and -, shut with M or Esc; the world is held while it is open, as a menu holds it. What moves is read each
 * frame off the controllable runtime (`window.__mojCtrl`: the pilot, the cars) and the guide (`window.__mojGuide`: where
 * to go). Its look is the theme's, never its own. Emitted only for a page with a city map: absent, not one byte.
 * A map with PINS (`pins`: its region's id, gameworld/city-map.js planMap): on the opened map a cursor the arrows move
 * and P (or Enter) setting a pin there, or lifting the one under it; each raised on the bus for the pins mechanic to
 * keep (game/mechanics.js), carried back in as the next page opens (window.__mojPinsIn), and handed to the compass
 * (window.__mojPins).
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { withIdioms } from '../../../mana-ui/idioms.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const B = (p) => ({ bind: `map.${p}` });

/** The spec it draws: the radar (where the map asks for one) and the opened map. */
export function mapSpec(M) {
  // (mana's `map-screen`, with a legend of its own keys: the view turned, the zoom, the way out)
  const screen = { use: 'screen', props: { title: 'Map', layer: 'modal', place: 'full', legend: 'none' }, children: [
    { use: 'split', props: { ratio: 'wide' }, children: [
      { use: 'window', children: [{ use: 'map', props: { shapes: B('shapes'), markers: B('all'), view: B('view'), focus: B('focus'), heading: B('heading'), zoom: B('zoom'), size: 'full', labels: true } }] },
      { use: 'window', props: { title: { word: 'map' } }, children: [{ use: 'each', props: { rows: B('key'), row: { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [{ use: 'icon', props: { name: { item: 'icon' } } }, { use: 'text', props: { value: { item: 'name' } } }] } } }] },
    ] },
    { use: 'legend', props: { rows: [...(M.views.length > 1 ? [{ action: 'tabNext', label: 'View' }] : []), { actions: ['up', 'down'], label: 'Zoom' }, ...(M.pins ? [{ actions: ['left', 'right'], label: 'Move' }, { action: 'accept', label: 'Pin' }] : []), { action: 'back', label: { word: 'back' } }] } },
  ] };
  return withIdioms({
    screens: { map: screen },
    hud: { use: 'hud', children: M.corner ? [{ use: 'radar-corner', props: { shapes: B('shapes'), markers: B('near'), focus: B('you'), heading: B(M.corner === 'follow' ? 'heading' : 'north'), zoom: M.zoom } }] : [] },
  });
}
const MAP_CSS = '.moj-map{position:absolute;inset:0;pointer-events:none;z-index:8}.moj-map .mana-root{background:none}.moj-map.open{z-index:34;pointer-events:auto}'
  // THE RADAR, an instrument and not a picture in a box: round, on no plate, its rim the panel's with a hairline round it
  // and a shadow under it, the ground inside darkened toward its edge (docs/mana-ui.md: the map is an instrument)
  + '.moj-map .mana-place>.mana-region:has(>.mana-map[data-size=corner]){background:none!important;border:0!important;box-shadow:none!important;clip-path:none!important;padding:0!important}'
  + '.moj-map .mana-map[data-size=corner]{border:0;border-radius:50%;clip-path:circle(50% at 50% 50%);box-shadow:0 0 0 4px var(--mana-panel),0 0 0 5px color-mix(in srgb,var(--mana-ink) 30%,transparent),0 10px 28px rgba(0,0,0,.5)}'
  + '.moj-map .mana-map[data-size=corner]::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,transparent 62%,color-mix(in srgb,var(--mana-panel) 70%,transparent))}'
  // THE GROUND, in the look's own night: the frame round the city the panel's, the water a cold blue (the look's shield)
  // under the land; on the opened map only the goal and you are named (every stop's words at once is noise; the key
  // beside it names the rest)
  + '.moj-map .mana-map,.moj-map .mana-map-plane,.moj-map .mana-map-shape[data-kind=land]{background:color-mix(in srgb,var(--mana-panel) 88%,#000)}'
  + '.moj-map .mana-map-shape[data-kind=water]{background:color-mix(in srgb,var(--mana-shield) 42%,var(--mana-panel))}'
  + '.moj-map .mana-map-mark:not([data-kind=goal]):not([data-you=yes])>.mana-caption{display:none}';

// (a planned map's places named on the opened map, `names`: its blocks are few and their names are the map)
const NAMES_CSS = '.moj-map.open .mana-map-mark[data-kind=poi]>.mana-caption{display:block}';
// (and its corner the page's one radar: the HUD grammar's scope, scene/channels/hud-grammar.js, put away beside it)
const ONE_RADAR_CSS = '.moj-hg .mana-place[data-at=bottom-right]{display:none!important}';

/** The page's side (inlined by toString): the runtime mounted, a frame's read of the pilot, the cars and the goal. */
export function mapPage(M, ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-map'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { map: { shapes: M.shapes, all: M.markers, near: [], you: { x: 0.5, y: 0.5 }, focus: { x: 0.5, y: 0.5 }, heading: 0, north: 0, zoom: 1, view: M.views[0], key: M.key } };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  // (its legend says the keys that work it)
  rt.glyphs({ keys: { tabNext: 'V', up: '+', down: '−', back: 'M', left: '← ↑', right: '→ ↓', accept: 'P' } }); rt.input('keys');
  ui.mount(root, rt, { auto: true });
  const X = (x) => (x - M.box[0]) / M.side, Y = (y) => 1 - (y - M.box[1]) / M.side, r4 = (v) => Math.round(v * 1e4) / 1e4;
  let open = false, vi = 0, zoom = 1, last = 0, sig = '';
  // THE PINS (`M.pins`: the region's id; the pins mechanic carries them, game/mechanics.js): set and lifted at the
  // cursor on the opened map (the arrows move it, P sets one there or lifts the one under it), drawn on the map and its
  // corner, their bearings on the compass (window.__mojPins, scene/channels/hud-grammar.js)
  const PN = { list: [], k: {}, read: false, cursor: null, step: M.side / 48, near: M.side / 60 };
  const snap = (v) => Math.round(v / 2) * 2;
  function pinsIn() {
    if (!M.pins || PN.read || !Array.isArray(window.__mojPinsIn)) return;
    PN.read = true;
    const set = {}, unset = {};
    for (const k of window.__mojPinsIn) { const q = String(k).split('|'); if (q[1] !== M.pins || q.length < 5) continue; const at = q[2] + '|' + q[3], n = Number(q[4]) || 0; if (k.indexOf('pin:') === 0) set[at] = Math.max(set[at] || 0, n); else unset[at] = Math.max(unset[at] || 0, n); }
    for (const at in set) { PN.k[at] = Math.max(set[at], unset[at] || 0); if (set[at] > (unset[at] || 0)) PN.list.push(at.split('|').map(Number)); }
    window.__mojPins = PN.list.map((q) => q.slice()); sig = '';
  }
  function pinAt(x, y) {
    const raise = (pre, at, k) => { try { if (typeof __inputQueue !== 'undefined') __inputQueue.push({ type: pre + ':|' + M.pins + '|' + at + '|' + k }); } catch (e) { /* no bus */ } };
    const i = PN.list.findIndex((q) => Math.hypot(q[0] - x, q[1] - y) <= PN.near);
    if (i >= 0) { const q = PN.list[i], at = q[0] + '|' + q[1]; raise('unpin', at, PN.k[at] || 1); PN.list.splice(i, 1); }
    else if (PN.list.length < (M.pinsMost || 12)) { const px = snap(x), py = snap(y), at = px + '|' + py, k = (PN.k[at] || 0) + 1; PN.k[at] = k; raise('pin', at, k); PN.list.push([px, py]); }
    window.__mojPins = PN.list.map((q) => q.slice()); sig = ''; read();
  }
  const reach = 1 / (2 * M.zoom) * 1.45;   // what the corner can show round the pilot, its corners included
  function read() {
    const C = window.__mojCtrl, W = C && C.world, me = W && W.pilotId ? W.byId[W.pilotId] : null;
    if (!me) return;
    if (M.pins) pinsIn();
    const p = me.transform.pos, you = { x: r4(X(p[0])), y: r4(Y(p[1])) };
    // (the runtime's heading is anticlockwise from east; a map's clockwise from north. Rounded: a radar need not shiver)
    const heading = Math.round(((90 - me.transform.heading * 180 / Math.PI) % 360 + 360) % 360 / 2) * 2;
    const GV = window.__mojGuide && window.__mojGuide.view ? window.__mojGuide.view() : null, goal = GV && GV.goal ? GV.goal : null;
    const moving = [{ x: you.x, y: you.y, you: true, heading, kind: 'self', label: 'You' }];
    if (goal) moving.push({ x: r4(X(goal.at[0])), y: r4(Y(goal.at[1])), kind: 'goal', icon: M.icons.goal, label: goal.say });
    // (a planned map's, `foes`: the foes awake about her, as the grammar's scope showed them, gameworld/radar.js; on her
    // horse, her side is her own)
    if (M.foes) { const side = ((me.riderId && W.byId[me.riderId]) || me).team; for (const e of W.entities) { if (!e || e === me || e.id === me.riderId || !e.transform || e.isCamera || e.dormant || e.downed || e.gone || !e.team || e.team === side || !e.body || !e.body.hittable) continue; moving.push({ x: r4(X(e.transform.pos[0])), y: r4(Y(e.transform.pos[1])), kind: 'foe', label: 'A foe', named: false }); } }
    if (M.cars) for (const e of W.entities) { if (!e.mount || !e.mount.cab || e.gone || e === me || !e.mount.pool) continue; moving.push({ x: r4(X(e.transform.pos[0])), y: r4(Y(e.transform.pos[1])), kind: 'poi', icon: M.icons.car, label: 'A car', named: false }); }
    if (M.pins) { PN.list.forEach((q, i) => moving.push({ x: r4(X(q[0])), y: r4(Y(q[1])), kind: 'item', icon: 'pin', label: 'Pin ' + (i + 1) })); if (open && PN.cursor) moving.push({ x: r4(X(PN.cursor[0])), y: r4(Y(PN.cursor[1])), kind: 'goal', icon: 'plus', label: 'P: pin here' }); }
    const all = M.markers.concat(moving.slice(1), [moving[0]]);
    const near = all.filter((m) => m.you || m.kind === 'goal' || (Math.abs(m.x - you.x) < reach && Math.abs(m.y - you.y) < reach));
    const view = M.views[vi], cur = M.pins && open && PN.cursor ? { x: r4(X(PN.cursor[0])), y: r4(Y(PN.cursor[1])) } : null, focus = view === 'follow' || zoom > 1 ? cur || you : { x: 0.5, y: 0.5 };
    const next = JSON.stringify([you, heading, near.length, all.length, view, zoom, goal && goal.at, cur, M.pins ? PN.list.length : 0, M.foes ? moving.filter((m) => m.kind === 'foe').map((m) => [Math.round(m.x * 400), Math.round(m.y * 400)]) : 0]);
    if (next === sig) return;
    sig = next;
    S.map = { shapes: M.shapes, all, near, you, focus, heading, north: 0, zoom: view === 'follow' ? Math.max(zoom, M.zoom / 2) : zoom, view, key: M.key };
  }
  function show(on) {
    if (on === open) return;
    if (on && ((window.__mojScenes && window.__mojScenes.on()) || window.__mojMenuOpen || window.__mojManaOpen)) return;   // not over a scene or another menu (`__mojManaOpen`: the mana screen that is up, the journal's, the map's, the bag's)
    open = on; root.classList.toggle('open', on); sig = '';
    // (the cursor starts where she stands)
    if (on && M.pins) { const C = window.__mojCtrl, W = C && C.world, me = W && W.pilotId ? W.byId[W.pilotId] : null; PN.cursor = me ? [me.transform.pos[0], me.transform.pos[1]] : [M.box[0] + M.side / 2, M.box[1] + M.side / 2]; }
    read();
    if (on) rt.open('map'); else rt.close();
    window.__mojManaOpen = on ? 'map' : null; window.__mojMenuOpen = on; window.__mojFreeze = on;
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyM' && !ev.repeat) { ev.preventDefault(); show(!open); return; }
    if (!open) return;
    if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); show(false); }
    else if (ev.code === 'KeyV' && !ev.repeat) { ev.preventDefault(); ev.stopImmediatePropagation(); vi = (vi + 1) % M.views.length; sig = ''; read(); }
    else if (ev.code === 'Equal' || ev.code === 'NumpadAdd') { ev.preventDefault(); zoom = Math.min(8, zoom * 1.5); sig = ''; read(); }
    else if (ev.code === 'Minus' || ev.code === 'NumpadSubtract') { ev.preventDefault(); zoom = Math.max(1, zoom / 1.5); sig = ''; read(); }
    else if (M.pins && PN.cursor && /^Arrow(Up|Down|Left|Right)$/.test(ev.code)) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      const d = PN.step / zoom, v = { ArrowUp: [0, d], ArrowDown: [0, -d], ArrowLeft: [-d, 0], ArrowRight: [d, 0] }[ev.code];
      PN.cursor = [Math.min(M.box[0] + M.side, Math.max(M.box[0], PN.cursor[0] + v[0])), Math.min(M.box[1] + M.side, Math.max(M.box[1], PN.cursor[1] + v[1]))]; sig = ''; read();
    } else if (M.pins && PN.cursor && (ev.code === 'KeyP' || ev.code === 'Enter') && !ev.repeat) { ev.preventDefault(); ev.stopImmediatePropagation(); pinAt(PN.cursor[0], PN.cursor[1]); }
  }, true);
  (function tick() { requestAnimationFrame(tick); const now = performance.now(); if (now - last < 110) return; last = now; read(); })();
  return { state: S, rt, open: () => show(true), close: () => show(false), isOpen: () => open, view: () => M.views[vi], turn: () => { vi = (vi + 1) % M.views.length; sig = ''; read(); }, pins: () => PN.list.map((q) => q.slice()), pin: (x, y) => pinAt(x, y) };
}

/** The page's script ('' for none). `theme`: the look the level's HUD wears. */
export function mapScript(M, theme = null, { shared = null } = {}) {
  if (!M || !Array.isArray(M.shapes) || !Array.isArray(M.views) || !M.views.length) return '';
  const spec = mapSpec(M);
  manaUi.readSpec(spec);
  return `
// THE MAP (scene/channels/map-channel.js): a radar in the corner and the map on M, mana-ui's; its ground gameworld/city-map.js
window.__mojMap = (${mapPage.toString()})(${json(M)}, ${shared || manaUiSource()}, ${json(spec)}, ${json(`${shared ? '' : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n`}${MAP_CSS}${M.names ? NAMES_CSS : ''}${M.foes && M.corner ? ONE_RADAR_CSS : ''}`)});
`;
}
