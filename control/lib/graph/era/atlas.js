/**
 * ATLAS — discrete stage maps joined by their door ends (doors.js). One map is loaded at a time; walking into an
 * end's trigger crosses to the end it names, in the other map. The atlas recipe:
 *
 *   { title, maps: { <id>: <stage manifest with doors> }, start: { map, door } }
 *
 *   validateAtlas(atlas) → { ends: { <map>: [resolved end] } }   every end names an end that names it back
 *   emitAtlasShell({ title, maps: [{ id, title, src }], ends, start }) → one self-contained html page that hosts
 *     the current map in an iframe, crosses on `map-door`, places the walker with `map-enter`, and carries the
 *     run's state across: the crossing log, visits per map, the items held, and each map's own state (the items
 *     taken there, so a key stays taken when you come back). A locked end (`locked: '<item>'`) refuses the crossing
 *     until the run holds that item. Deterministic: no clock, no dice; the fade is presentation.
 */
import { planStage, buildStageGeometry } from './stage.js';
import { stageDoors } from './doors.js';
import { MSG_MAP_READY, MSG_MAP_DOOR, MSG_MAP_ENTER, MSG_MAP_TAKE, MSG_MAP_REFUSE } from '../scene/channels/doors.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Resolve every map's ends and check the pairing. Throws a teaching error on the first broken link. */
export function validateAtlas(atlas = {}) {
  const ids = Object.keys(atlas.maps || {}), items = new Set();
  if (!ids.length) throw new Error('atlas: needs `maps`, { <id>: <stage manifest> }');
  const ends = {};
  for (const id of ids) {
    const m = atlas.maps[id];
    if (!Array.isArray(m.doors) || !m.doors.length) throw new Error(`atlas: map '${id}' names no doors, so nothing leads in or out`);
    const plan = planStage(m);
    ends[id] = stageDoors(plan, buildStageGeometry(plan), m.doors).map(({ build, ...e }) => e);
    for (const it of m.items || []) {
      if (items.has(it.id)) throw new Error(`atlas: item '${it.id}' is placed in two maps; an item is one thing in one place`);
      items.add(it.id);
    }
  }
  const find = (map, door) => (ends[map] || []).find((e) => e.id === door);
  for (const id of ids) for (const e of ends[id]) {
    const there = find(e.to.map, e.to.door);
    if (!there) throw new Error(`atlas: door '${id}#${e.id}' leads to '${e.to.map}#${e.to.door}', which is not an end in the atlas`);
    if (there.to.map !== id || there.to.door !== e.id) throw new Error(`atlas: door '${id}#${e.id}' leads to '${e.to.map}#${e.to.door}', but that end leads to '${there.to.map}#${there.to.door}': a door's two ends name each other`);
  }
  // a lock must be openable: the item it needs is somewhere in the atlas
  for (const id of ids) for (const e of ends[id]) if (e.locked && !items.has(e.locked)) throw new Error(`atlas: door '${id}#${e.id}' is locked by '${e.locked}', but no map holds that item`);
  const s = atlas.start || {};
  if (!find(s.map, s.door)) throw new Error(`atlas: start { map, door } must name an end; '${s.map}#${s.door}' is not one`);
  return { ends };
}

/** The atlas page: one map at a time in an iframe, a crossing on each `map-door`, the run's state carried across. */
export function emitAtlasShell({ title = 'mojulo atlas', maps = [], ends = {}, start }) {
  const MAPS = Object.fromEntries(maps.map((m) => [m.id, { title: m.title || m.id, src: m.src || `maps/${m.id}.html` }]));
  const LINKS = Object.fromEntries(Object.entries(ends).map(([map, list]) => [map, Object.fromEntries(list.map((e) => [e.id, e.locked ? { ...e.to, locked: e.locked } : e.to]))]));
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden;font:14px system-ui,sans-serif;color:#fff}
#map{position:absolute;inset:0;width:100%;height:100%;border:0}
#fade{position:absolute;inset:0;background:#000;opacity:1;transition:opacity .35s ease;pointer-events:none}
#run{position:absolute;right:12px;top:12px;text-align:right;padding:6px 12px;border-radius:8px;background:rgba(0,0,0,.55);pointer-events:none;line-height:1.5}
#run b{letter-spacing:1px;text-transform:uppercase}
</style></head>
<body><iframe id="map" title="map"></iframe><div id="fade"></div><div id="run"></div>
<script>
const MAPS = ${json(MAPS)};
const LINKS = ${json(LINKS)};
const START = ${json(start)};
// the run's state: where we are, every crossing made (and refused), visits per map, the items held, and each map's
// own state kept for its return
const RUN = { map: null, crossings: [], refused: [], visited: {}, have: [], maps: {} };
const frame = document.getElementById('map'), fade = document.getElementById('fade'), hud = document.getElementById('run');
let arriving = null, crossing = false;
function show() {
  hud.innerHTML = '<b>' + MAPS[RUN.map].title + '</b><br>crossings ' + RUN.crossings.length + ' · visits ' + (RUN.visited[RUN.map] || 0) + (RUN.have.length ? '<br>holding ' + RUN.have.join(', ') : '');
}
function load(map, door) {
  crossing = true; fade.style.opacity = '1';
  arriving = { map: map, door: door };
  setTimeout(() => { frame.src = MAPS[map].src; }, 360);
}
addEventListener('message', (e) => {
  const d = e.data;
  if (!d || e.source !== frame.contentWindow) return;
  if (d.moj === ${json(MSG_MAP_READY)} && arriving) {
    RUN.map = arriving.map; RUN.visited[RUN.map] = (RUN.visited[RUN.map] || 0) + 1; RUN.maps[RUN.map] = RUN.maps[RUN.map] || { taken: [] };
    frame.contentWindow.postMessage({ moj: ${json(MSG_MAP_ENTER)}, door: arriving.door, state: RUN.maps[RUN.map] }, '*');
    arriving = null; crossing = false; fade.style.opacity = '0'; frame.focus(); show();
  } else if (d.moj === ${json(MSG_MAP_TAKE)} && RUN.map) {
    if (!RUN.have.includes(d.item)) RUN.have.push(d.item);
    if (!RUN.maps[RUN.map].taken.includes(d.item)) RUN.maps[RUN.map].taken.push(d.item);
    show();
  } else if (d.moj === ${json(MSG_MAP_DOOR)} && !crossing) {
    const to = (LINKS[RUN.map] || {})[d.door];
    if (!to) return;
    if (to.locked && !RUN.have.includes(to.locked)) {
      RUN.refused.push(RUN.map + '#' + d.door);
      frame.contentWindow.postMessage({ moj: ${json(MSG_MAP_REFUSE)}, door: d.door, need: to.locked }, '*');
      return;
    }
    RUN.crossings.push({ from: RUN.map + '#' + d.door, to: to.map + '#' + to.door });
    load(to.map, to.door);
  }
});
window.__mojAtlas = RUN;   // read-only view for a headless round-trip check
load(START.map, START.door);
</script></body></html>
`;
}
