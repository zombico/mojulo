// In-page script: a metroidvania's EXPLORED MAP seen (gameworld/metroidvania/explored.js draws it; worlds/controllable/
// explore.js keeps the record). Two reads of one map:
//   the MINIMAP   top right, a window on the tiles round the one she stands in, the map's own drawing at a small tile,
//                 the share walked under it; a map room found said under it a moment
//   the MAP       M opens it whole, over the held world: the castle's tiles as walked, known and unwalked, its walls and
//                 doors, its gates (ringed where what she holds opens them now), its frontier, its marks, the share
//                 walked and each region's; M or Esc shuts it
// Drawn from the map's data (explored.js mapOf, here as JSON) and the world's own records (the explored tiles, the held
// gates' tokens, what is taken and felled), redrawn only as they change. Emitted only into a page whose world has an
// explored map, so every other page keeps every byte.
import { viewOf, exploredSvg } from '../../../gameworld/metroidvania/explored.js';

export const MINIMAP = Object.freeze({ tile: 16, across: 7, up: 4 });

export function exploredViewScript(map) {
  return `
// THE EXPLORED MAP (explored-view.js): the minimap round her, the whole map on M
const __XM = ${JSON.stringify(map).replace(/</g, '\\u003c')}, __XMM = ${JSON.stringify(MINIMAP)};
const __xmView = ${viewOf.toString()};
const __xmSvg = ${exploredSvg.toString()};
const __xmMini = document.createElement('div');
__xmMini.style.cssText = 'position:fixed;right:16px;top:14px;width:' + (__XMM.tile * __XMM.across) + 'px;height:' + (__XMM.tile * __XMM.up) + 'px;overflow:hidden;border:1px solid #c9a75a;background:#0b0d16;pointer-events:none;z-index:30';
const __xmMiniIn = document.createElement('div'); __xmMiniIn.style.cssText = 'position:absolute;left:0;top:0'; __xmMini.appendChild(__xmMiniIn);
const __xmCap = document.createElement('div');
__xmCap.style.cssText = 'position:fixed;right:16px;top:' + (18 + __XMM.tile * __XMM.up) + 'px;color:#e8dcc0;font:600 11px/1.3 Georgia,serif;letter-spacing:.06em;text-align:right;pointer-events:none;z-index:30;text-shadow:0 1px 2px #000';
const __xmFull = document.createElement('div');
__xmFull.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(4,5,10,.9);z-index:35';
document.body.appendChild(__xmMini); document.body.appendChild(__xmCap); document.body.appendChild(__xmFull);
// (the minimap is this page's map round her: the page's own radar, drawn for any world with foes, put away by its id)
{ const __r = document.getElementById('__radar'); if (__r) __r.style.display = 'none'; }
function __xmSeen() {
  const X = __world.explored, G = __world.heldGates || {};
  return { visited: Object.keys(X.visited), known: Object.keys(X.known), at: X.at, held: Object.keys(G.held || {}), taken: Object.keys(G.taken || {}),
    felled: Object.keys(G.felled || {}).map((k) => k.replace(/^boss-/, '')) };
}
let __xmSig = '', __xmOpen = false, __xmGot = 0, __xmSaid = '', __xmSaidT = -1;
function __xmDraw(force) {
  const X = __world.explored;
  if (!X) return;
  const seen = __xmSeen(), sig = JSON.stringify([seen.visited.length, seen.known.length, seen.at, seen.held.length, seen.taken.length, seen.felled.length, __xmOpen]);
  if (!force && sig === __xmSig) return;
  __xmSig = sig;
  const V = __xmView(__XM, seen);
  // (the minimap: the map's own drawing at a small tile, slid so her tile is in its middle)
  __xmMiniIn.innerHTML = __xmSvg(V, { tile: __XMM.tile, title: '', key: false });
  if (seen.at) { const rows = __XM.box[1], x = 24 + seen.at[0] * __XMM.tile, y = 12 + (rows - 1 - seen.at[1]) * __XMM.tile; __xmMiniIn.style.transform = 'translate(' + (-(x - __XMM.tile * (__XMM.across - 1) / 2)) + 'px,' + (-(y - __XMM.tile * (__XMM.up - 1) / 2)) + 'px)'; }
  if (__xmOpen) __xmFull.innerHTML = __xmSvg(V, { tile: Math.max(14, Math.min(30, Math.floor(Math.min((innerWidth - 300) / __XM.box[0], (innerHeight - 140) / __XM.box[1])))), title: 'The castle' });
  __xmCap.textContent = (__xmSaid && (__world.time || 0) - __xmSaidT < 2.4 ? __xmSaid + ' · ' : '') + V.percent + '%';
}
function __xmShow(on) {
  if (on === __xmOpen) return;
  if (on && (window.__mojMenuOpen || window.__mojManaOpen)) return;   // (not over another menu)
  __xmOpen = on; __xmFull.style.display = on ? 'flex' : 'none';
  window.__mojMenuOpen = on; window.__mojFreeze = on;
  __xmDraw(true);
}
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyM' && !ev.repeat) { ev.preventDefault(); __xmShow(!__xmOpen); return; }
  if (__xmOpen && ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); __xmShow(false); }
}, true);
window.__mojExplored = { open: () => __xmShow(true), close: () => __xmShow(false), isOpen: () => __xmOpen, view: () => __xmView(__XM, __xmSeen()) };
(function __xmTick() {
  requestAnimationFrame(__xmTick);
  const X = __world.explored;
  if (!X) return;
  // (a map room found: said under the minimap a moment)
  if (X.got.length > __xmGot) { const g = X.got[X.got.length - 1]; __xmGot = X.got.length; __xmSaid = 'Map · ' + g.name; __xmSaidT = __world.time || 0; __xmSig = ''; }
  __xmDraw(false);
})();
`;
}
