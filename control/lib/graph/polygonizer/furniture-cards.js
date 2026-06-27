/**
 * Furniture face-cards — the furniture twin of vehicle-face-cards.js.
 *
 * A furniture object is a box-net: a cuboid skinned with sticker "cards" on its
 * five visible faces (center=top + four cardinals), transparent elsewhere, legs
 * at the planner's support pins, height in meru world-units (see
 * box-net-sticker.plan.md).
 *
 * Cards are PURE DATA in the same `parts[]` grammar vehicles use, so the model
 * can emit and propose them as JSON. Each part is authored in a normalized
 * (u,v) frame on its face (v=0 at the face's base edge):
 *   band  { v, h }                     full-width horizontal band [v, v+h]
 *   rect  { u, w, v, h }               panel-local rectangle
 *   repeat{ u0, u1, count, v, h, gap? } evenly spaced rects (books, slats)
 *   line  { u0, v0, u1, v1 }           segment
 *   circle{ u, v, r }                  r is a fraction of the face's v-extent
 *   poly  { points: [{u,v}, ...] }     polygon
 * Every part takes optional { role, fill, stroke, strokeWidth, opacity }.
 *
 * A face that the card leaves unpainted stays transparent — that's how legs
 * show through a table's apron. Cards carry their own fills (data); the renderer
 * scales them per-face under the shaded render style.
 */

const EDGE = '#4a3720';
const DARK_EDGE = '#302518';
const WALL_EDGE = '#5f4a33';
const BOOK_FILLS = ['#b55745', '#d3a447', '#4f7b8f', '#7c5b95', '#6f8f57'];
// electronics + porcelain palettes (mid-tones chosen to read after vexar shading)
const SCREEN_DARK = '#1b2026';
const SCREEN_GLOW = '#2f4659';
const KEY_FILL = '#3b4046';
const KEY_EDGE = '#1d2024';
const SILVER = '#9aa0a4';
const SILVER_EDGE = '#5f6468';
const PORCELAIN = '#e6e7e3';
const PORCELAIN_EDGE = '#b6b8b1';

function fullFace(role, fill, stroke = EDGE, strokeWidth = 0.6) {
  return { kind: 'band', role, v: 0, h: 1, fill, stroke, strokeWidth };
}

// Handles + pulls are flat face DECALS, never modelled geometry — a 2D part on
// the panel's (u,v) plane, shaded along with its parent face. See
// box-net-sticker.plan.md ("Handle convention"). Brass-ish so they read on wood.
const PULL_BRASS = '#cbb27e';
const PULL_EDGE = '#7a6740';
/** Horizontal bar pull centred at vertical `vMid` on a drawer face. */
function barPull(role, u, w, vMid, h = 0.024) {
  return { kind: 'rect', role, u, w, v: vMid - h / 2, h, fill: PULL_BRASS, stroke: PULL_EDGE, strokeWidth: 0.4 };
}
/** Vertical bar handle centred at (`uMid`, `vMid`) on a cabinet door. */
function vBarPull(role, uMid, vMid, len = 0.24, w = 0.022) {
  return { kind: 'rect', role, u: uMid - w / 2, w, v: vMid - len / 2, h: len, fill: PULL_BRASS, stroke: PULL_EDGE, strokeWidth: 0.4 };
}

export const FURNITURE_FACE_CARDS = {
  // ── table ────────────────────────────────────────────────────────────────
  'table-top': {
    id: 'table-top', faceKind: 'center', label: 'Tabletop',
    parts: [
      { kind: 'band', role: 'wood', v: 0, h: 1, fill: '#c79a5e' },
      { kind: 'line', role: 'seam', u0: 0, v0: 0.25, u1: 1, v1: 0.25, stroke: '#9a743f', strokeWidth: 1 },
      { kind: 'line', role: 'seam', u0: 0, v0: 0.50, u1: 1, v1: 0.50, stroke: '#9a743f', strokeWidth: 1 },
      { kind: 'line', role: 'seam', u0: 0, v0: 0.75, u1: 1, v1: 0.75, stroke: '#9a743f', strokeWidth: 1 },
      { kind: 'rect', role: 'inlay', u: 0.24, w: 0.52, v: 0.24, h: 0.52, fill: '#b98c4f', stroke: '#5a4426', strokeWidth: 0.8 },
    ],
  },
  'table-apron': {
    id: 'table-apron', faceKind: 'side', label: 'Table apron',
    parts: [{ kind: 'band', role: 'apron', v: 0.80, h: 0.20, fill: '#a87f47', stroke: '#5a4426', strokeWidth: 0.8 }],
  },
  'table-apron-drawer': {
    id: 'table-apron-drawer', faceKind: 'side', label: 'Table apron + drawer',
    parts: [
      { kind: 'band', role: 'apron', v: 0.80, h: 0.20, fill: '#a87f47', stroke: '#5a4426', strokeWidth: 0.8 },
      { kind: 'rect', role: 'drawer', u: 0.30, w: 0.40, v: 0.835, h: 0.125, fill: '#8c6738', stroke: EDGE, strokeWidth: 0.8 },
      { kind: 'circle', role: 'knob', u: 0.5, v: 0.90, r: 0.10, fill: '#e7d7ad' },
    ],
  },
  'standing-desk-top': {
    id: 'standing-desk-top', faceKind: 'center', label: 'Standing desk top',
    parts: [
      fullFace('desktop', '#b88a54', '#5a3f23', 0.7),
      { kind: 'rect', role: 'work-mat', u: 0.10, w: 0.40, v: 0.18, h: 0.58, fill: '#4b5f61', stroke: '#2f3d3f', strokeWidth: 0.6 },
      { kind: 'rect', role: 'keyboard', u: 0.58, w: 0.30, v: 0.34, h: 0.18, fill: '#2d3032', stroke: '#161819', strokeWidth: 0.5 },
      { kind: 'circle', role: 'cable-port', u: 0.92, v: 0.18, r: 0.045, fill: '#3a2c19' },
    ],
  },
  'standing-desk-apron': {
    id: 'standing-desk-apron', faceKind: 'side', label: 'Standing desk modesty panel',
    parts: [
      { kind: 'band', role: 'thick-top', v: 0.78, h: 0.18, fill: '#9b7242', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'rect', role: 'lift-panel', u: 0.35, w: 0.30, v: 0.28, h: 0.44, fill: '#596163', stroke: '#303638', strokeWidth: 0.6 },
    ],
  },

  // ── cabinet (block, no legs, full-height door faces) ───────────────────────
  'cabinet-top': {
    id: 'cabinet-top', faceKind: 'center', label: 'Cabinet top',
    parts: [{ kind: 'band', role: 'top', v: 0, h: 1, fill: '#7a5c3a', stroke: EDGE, strokeWidth: 0.6 }],
  },
  'cabinet-front': {
    id: 'cabinet-front', faceKind: 'side', label: 'Cabinet doors',
    parts: [
      { kind: 'band', role: 'body', v: 0, h: 1, fill: '#6e5236' },
      { kind: 'rect', role: 'door-l', u: 0.06, w: 0.40, v: 0.05, h: 0.90, fill: '#82643f', stroke: '#3a2c19', strokeWidth: 0.9 },
      { kind: 'rect', role: 'door-r', u: 0.54, w: 0.40, v: 0.05, h: 0.90, fill: '#82643f', stroke: '#3a2c19', strokeWidth: 0.9 },
      vBarPull('handle-l', 0.41, 0.5),
      vBarPull('handle-r', 0.59, 0.5),
    ],
  },
  'cabinet-side': {
    id: 'cabinet-side', faceKind: 'side', label: 'Cabinet side',
    parts: [
      { kind: 'band', role: 'body', v: 0, h: 1, fill: '#5e4630' },
      { kind: 'line', role: 'seam', u0: 0.5, v0: 0.05, u1: 0.5, v1: 0.95, stroke: EDGE, strokeWidth: 0.7 },
    ],
  },

  // ── chair (four-corner legs, low seat) ─────────────────────────────────────
  'chair-seat': {
    id: 'chair-seat', faceKind: 'center', label: 'Chair seat',
    parts: [
      { kind: 'band', role: 'seat', v: 0, h: 1, fill: '#8a6b46' },
      { kind: 'rect', role: 'cushion', u: 0.12, w: 0.76, v: 0.12, h: 0.76, fill: '#9b7c54', stroke: '#5a4426', strokeWidth: 0.8 },
    ],
  },
  'chair-rail': {
    id: 'chair-rail', faceKind: 'side', label: 'Chair rail',
    parts: [{ kind: 'band', role: 'rail', v: 0.78, h: 0.22, fill: '#7a5d3c', stroke: EDGE, strokeWidth: 0.8 }],
  },
  'computer-chair-seat': {
    id: 'computer-chair-seat', faceKind: 'center', label: 'Computer chair seat',
    parts: [
      fullFace('seat-shell', '#30373d', '#161b1f', 0.7),
      { kind: 'rect', role: 'soft-cushion', u: 0.12, w: 0.76, v: 0.18, h: 0.62, fill: '#48545d', stroke: '#1e252a', strokeWidth: 0.7 },
      { kind: 'line', role: 'cushion-seam', u0: 0.20, v0: 0.50, u1: 0.80, v1: 0.50, stroke: '#222a2f', strokeWidth: 0.7 },
    ],
  },
  'computer-chair-front': {
    id: 'computer-chair-front', faceKind: 'side', label: 'Computer chair front',
    parts: [
      { kind: 'band', role: 'seat-lip', v: 0.80, h: 0.18, fill: '#353f47', stroke: '#161b1f', strokeWidth: 0.7 },
      { kind: 'circle', role: 'caster-l', u: 0.23, v: 0.10, r: 0.055, fill: '#161b1f' },
      { kind: 'circle', role: 'caster-r', u: 0.77, v: 0.10, r: 0.055, fill: '#161b1f' },
      { kind: 'line', role: 'gas-lift', u0: 0.5, v0: 0.12, u1: 0.5, v1: 0.78, stroke: '#2a3136', strokeWidth: 1.2 },
    ],
  },
  'computer-chair-side': {
    id: 'computer-chair-side', faceKind: 'side', label: 'Computer chair side',
    parts: [
      { kind: 'band', role: 'side-rail', v: 0.76, h: 0.18, fill: '#313a41', stroke: '#161b1f', strokeWidth: 0.7 },
      { kind: 'rect', role: 'back-post', u: 0.68, w: 0.12, v: 0.34, h: 0.58, fill: '#222a2f', stroke: '#161b1f', strokeWidth: 0.5 },
      { kind: 'circle', role: 'caster', u: 0.32, v: 0.10, r: 0.055, fill: '#161b1f' },
    ],
  },

  // ── wooden crest-back chairs (tall box; crest "head" rides the top of the front
  //    face within the box silhouette — see wooden-chairs.plan.md) ──────────────
  'wood-chair-top': {
    id: 'wood-chair-top', faceKind: 'center', label: 'Wooden chair top',
    parts: [
      { kind: 'band', role: 'wood', v: 0, h: 1, fill: '#7a5d3c', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'line', role: 'grain-1', u0: 0.08, v0: 0.34, u1: 0.92, v1: 0.34, stroke: '#5a4426', strokeWidth: 0.5 },
      { kind: 'line', role: 'grain-2', u0: 0.08, v0: 0.66, u1: 0.92, v1: 0.66, stroke: '#5a4426', strokeWidth: 0.5 },
    ],
  },
  'yoke-chair-front': {
    id: 'yoke-chair-front', faceKind: 'side', label: 'Yoke-back chair front',
    parts: [
      // back stiles + central splat (drawn behind seat + crest)
      { kind: 'rect', role: 'stile-l', u: 0.12, w: 0.07, v: 0.50, h: 0.38, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'stile-r', u: 0.81, w: 0.07, v: 0.50, h: 0.38, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'splat', u: 0.40, w: 0.20, v: 0.54, h: 0.30, fill: '#7a5d3c', stroke: '#5a4426', strokeWidth: 0.5 },
      // seat rail + seat (opaque; covers upper legs on this face)
      { kind: 'band', role: 'seat-rail', v: 0.34, h: 0.07, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'seat', u: 0.04, w: 0.92, v: 0.40, h: 0.11, fill: '#9b7c54', stroke: '#5a4426', strokeWidth: 0.8 },
      // yoke crest — raised center crown + ears poking up = the "head"
      { kind: 'poly', role: 'yoke-crest', fill: '#8a6b46', stroke: EDGE, strokeWidth: 0.8, points: [
        { u: 0.08, v: 0.84 }, { u: 0.92, v: 0.84 }, { u: 0.92, v: 0.90 },
        { u: 0.855, v: 0.965 }, { u: 0.78, v: 0.905 }, { u: 0.60, v: 0.93 },
        { u: 0.54, v: 0.99 }, { u: 0.46, v: 0.99 }, { u: 0.40, v: 0.93 },
        { u: 0.22, v: 0.905 }, { u: 0.145, v: 0.965 }, { u: 0.08, v: 0.90 },
      ] },
    ],
  },
  'ladder-chair-front': {
    id: 'ladder-chair-front', faceKind: 'side', label: 'Ladder-back chair front',
    parts: [
      { kind: 'rect', role: 'stile-l', u: 0.12, w: 0.07, v: 0.50, h: 0.42, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'stile-r', u: 0.81, w: 0.07, v: 0.50, h: 0.42, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      // stacked ladder slats between the stiles
      { kind: 'rect', role: 'slat-1', u: 0.19, w: 0.62, v: 0.56, h: 0.05, fill: '#856544', stroke: '#5a4426', strokeWidth: 0.5 },
      { kind: 'rect', role: 'slat-2', u: 0.19, w: 0.62, v: 0.66, h: 0.05, fill: '#856544', stroke: '#5a4426', strokeWidth: 0.5 },
      { kind: 'rect', role: 'slat-3', u: 0.19, w: 0.62, v: 0.76, h: 0.05, fill: '#856544', stroke: '#5a4426', strokeWidth: 0.5 },
      // seat rail + seat
      { kind: 'band', role: 'seat-rail', v: 0.34, h: 0.07, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'seat', u: 0.04, w: 0.92, v: 0.40, h: 0.11, fill: '#9b7c54', stroke: '#5a4426', strokeWidth: 0.8 },
      // crest rail + raised-center head crown
      { kind: 'rect', role: 'crest-rail', u: 0.10, w: 0.80, v: 0.85, h: 0.07, fill: '#8a6b46', stroke: EDGE, strokeWidth: 0.7 },
      { kind: 'poly', role: 'crest-crown', fill: '#8a6b46', stroke: EDGE, strokeWidth: 0.7, points: [
        { u: 0.36, v: 0.91 }, { u: 0.64, v: 0.91 }, { u: 0.57, v: 0.99 }, { u: 0.43, v: 0.99 },
      ] },
    ],
  },
  'wood-chair-side': {
    id: 'wood-chair-side', faceKind: 'side', label: 'Wooden chair side',
    parts: [
      // back post + small crest cap toward the back edge
      { kind: 'rect', role: 'back-post', u: 0.68, w: 0.11, v: 0.50, h: 0.40, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'crest-cap', u: 0.62, w: 0.23, v: 0.86, h: 0.07, fill: '#8a6b46', stroke: EDGE, strokeWidth: 0.6 },
      // seat rail + seat lip
      { kind: 'band', role: 'seat-rail', v: 0.34, h: 0.07, fill: '#6e5436', stroke: EDGE, strokeWidth: 0.6 },
      { kind: 'rect', role: 'seat-lip', u: 0.10, w: 0.80, v: 0.40, h: 0.11, fill: '#8a6b46', stroke: '#5a4426', strokeWidth: 0.7 },
    ],
  },

  // ── dining table (long plank top + apron; distinct from generic table) ───────
  'dining-table-top': {
    id: 'dining-table-top', faceKind: 'center', label: 'Dining table top',
    parts: [
      { kind: 'band', role: 'wood', v: 0, h: 1, fill: '#b98c52' },
      { kind: 'line', role: 'plank-1', u0: 0, v0: 0.20, u1: 1, v1: 0.20, stroke: '#8f6a39', strokeWidth: 0.9 },
      { kind: 'line', role: 'plank-2', u0: 0, v0: 0.40, u1: 1, v1: 0.40, stroke: '#8f6a39', strokeWidth: 0.9 },
      { kind: 'line', role: 'plank-3', u0: 0, v0: 0.60, u1: 1, v1: 0.60, stroke: '#8f6a39', strokeWidth: 0.9 },
      { kind: 'line', role: 'plank-4', u0: 0, v0: 0.80, u1: 1, v1: 0.80, stroke: '#8f6a39', strokeWidth: 0.9 },
      { kind: 'rect', role: 'edge-bevel', u: 0.03, w: 0.94, v: 0.06, h: 0.88, fill: 'none', stroke: '#7a5736', strokeWidth: 0.7 },
    ],
  },
  'dining-table-apron': {
    id: 'dining-table-apron', faceKind: 'side', label: 'Dining table apron',
    parts: [
      { kind: 'band', role: 'apron', v: 0.78, h: 0.22, fill: '#a87f47', stroke: '#5a4426', strokeWidth: 0.8 },
      { kind: 'line', role: 'lip', u0: 0.02, v0: 0.965, u1: 0.98, v1: 0.965, stroke: '#3c2c1e', strokeWidth: 0.7 },
    ],
  },

  // ── club chair / single-seater sofa (upholstered tall block: rolled arms +
  //    plush back rise into the front-view silhouette; dusty-blue fabric) ───────
  'club-chair-top': {
    id: 'club-chair-top', faceKind: 'center', label: 'Club chair top',
    parts: [
      { kind: 'band', role: 'fabric', v: 0, h: 1, fill: '#6d7f86', stroke: '#3c484d', strokeWidth: 0.6 },
      { kind: 'band', role: 'back-top', v: 0.70, h: 0.30, fill: '#647680', stroke: '#3c484d', strokeWidth: 0.5 },
      { kind: 'line', role: 'seam', u0: 0.12, v0: 0.46, u1: 0.88, v1: 0.46, stroke: '#3c484d', strokeWidth: 0.6 },
    ],
  },
  'club-chair-front': {
    id: 'club-chair-front', faceKind: 'side', label: 'Club chair front',
    parts: [
      // plush back cushion rising between the arms (rounded top)
      { kind: 'poly', role: 'back-cushion', fill: '#6d7f86', stroke: '#3c484d', strokeWidth: 0.8, points: [
        { u: 0.22, v: 0.40 }, { u: 0.78, v: 0.40 }, { u: 0.78, v: 0.82 },
        { u: 0.70, v: 0.93 }, { u: 0.30, v: 0.93 }, { u: 0.22, v: 0.82 },
      ] },
      // rolled arms (body + lighter padded roll on top)
      { kind: 'rect', role: 'arm-l', u: 0.03, w: 0.16, v: 0.14, h: 0.44, fill: '#5f7078', stroke: '#3c484d', strokeWidth: 0.7 },
      { kind: 'rect', role: 'arm-l-roll', u: 0.03, w: 0.16, v: 0.52, h: 0.08, fill: '#7e9097', stroke: '#3c484d', strokeWidth: 0.6 },
      { kind: 'rect', role: 'arm-r', u: 0.81, w: 0.16, v: 0.14, h: 0.44, fill: '#5f7078', stroke: '#3c484d', strokeWidth: 0.7 },
      { kind: 'rect', role: 'arm-r-roll', u: 0.81, w: 0.16, v: 0.52, h: 0.08, fill: '#7e9097', stroke: '#3c484d', strokeWidth: 0.6 },
      // seat cushion (front, plump) + piping seam
      { kind: 'rect', role: 'seat-cushion', u: 0.21, w: 0.58, v: 0.14, h: 0.30, fill: '#7e9097', stroke: '#3c484d', strokeWidth: 0.8 },
      { kind: 'line', role: 'seat-pipe', u0: 0.23, v0: 0.42, u1: 0.77, v1: 0.42, stroke: '#90a1a7', strokeWidth: 0.8 },
      // skirted base
      { kind: 'band', role: 'skirt', v: 0, h: 0.14, fill: '#4f6068', stroke: '#3c484d', strokeWidth: 0.6 },
    ],
  },
  'club-chair-side': {
    id: 'club-chair-side', faceKind: 'side', label: 'Club chair side',
    parts: [
      // arm runs the depth: long low pad + roll
      { kind: 'rect', role: 'arm', u: 0.08, w: 0.84, v: 0.30, h: 0.28, fill: '#647680', stroke: '#3c484d', strokeWidth: 0.7 },
      { kind: 'rect', role: 'arm-roll', u: 0.08, w: 0.84, v: 0.52, h: 0.06, fill: '#7e9097', stroke: '#3c484d', strokeWidth: 0.6 },
      // back cushion rises at the back edge
      { kind: 'poly', role: 'back-cushion', fill: '#6d7f86', stroke: '#3c484d', strokeWidth: 0.7, points: [
        { u: 0.62, v: 0.40 }, { u: 0.92, v: 0.40 }, { u: 0.92, v: 0.84 }, { u: 0.84, v: 0.92 }, { u: 0.62, v: 0.92 },
      ] },
      // skirted base
      { kind: 'band', role: 'skirt', v: 0, h: 0.14, fill: '#4f6068', stroke: '#3c484d', strokeWidth: 0.6 },
    ],
  },

  // ── modern lounge / tub chair (rounded barrel shell on thin pin legs; the
  //    curves come from poly arcs + circle accents; sage upholstery) ────────────
  'lounge-chair-top': {
    id: 'lounge-chair-top', faceKind: 'center', label: 'Lounge chair top',
    // round disc only (no full plate) so the box lid reads as the chair's round rim
    parts: [
      { kind: 'circle', role: 'rim', u: 0.5, v: 0.5, r: 0.46, fill: '#788a5f', stroke: '#3d472b', strokeWidth: 0.6 },
      { kind: 'circle', role: 'well', u: 0.5, v: 0.52, r: 0.36, fill: '#586440', stroke: '#3d472b', strokeWidth: 0.5 },
      { kind: 'circle', role: 'seat', u: 0.5, v: 0.46, r: 0.24, fill: '#97a675', stroke: '#3d472b', strokeWidth: 0.6 },
    ],
  },
  'lounge-chair-front': {
    id: 'lounge-chair-front', faceKind: 'side', label: 'Lounge chair front',
    parts: [
      // splayed pin legs (decals in the transparent base; shell covers their tops)
      { kind: 'poly', role: 'leg-l', fill: '#5b4a32', stroke: '#332817', strokeWidth: 0.5, points: [
        { u: 0.33, v: 0.16 }, { u: 0.37, v: 0.16 }, { u: 0.27, v: 0.0 }, { u: 0.23, v: 0.0 },
      ] },
      { kind: 'poly', role: 'leg-r', fill: '#5b4a32', stroke: '#332817', strokeWidth: 0.5, points: [
        { u: 0.63, v: 0.16 }, { u: 0.67, v: 0.16 }, { u: 0.77, v: 0.0 }, { u: 0.73, v: 0.0 },
      ] },
      // rounded barrel shell (back + wraparound arms) — the defining round mass
      { kind: 'poly', role: 'shell', fill: '#788a5f', stroke: '#3d472b', strokeWidth: 0.8, points: [
        { u: 0.06, v: 0.10 }, { u: 0.05, v: 0.55 }, { u: 0.09, v: 0.74 }, { u: 0.18, v: 0.88 },
        { u: 0.32, v: 0.96 }, { u: 0.50, v: 0.985 }, { u: 0.68, v: 0.96 }, { u: 0.82, v: 0.88 },
        { u: 0.91, v: 0.74 }, { u: 0.95, v: 0.55 }, { u: 0.94, v: 0.10 },
      ] },
      // soft rounded sheen high on the shell
      { kind: 'circle', role: 'sheen', u: 0.5, v: 0.66, r: 0.24, fill: '#8b9c72', strokeWidth: 0, opacity: 0.45 },
      // concave inner well (scoop the sitter leans into)
      { kind: 'poly', role: 'well', fill: '#586440', stroke: '#3d472b', strokeWidth: 0.5, points: [
        { u: 0.24, v: 0.22 }, { u: 0.24, v: 0.56 }, { u: 0.30, v: 0.70 }, { u: 0.41, v: 0.78 },
        { u: 0.50, v: 0.79 }, { u: 0.59, v: 0.78 }, { u: 0.70, v: 0.70 }, { u: 0.76, v: 0.56 }, { u: 0.76, v: 0.22 },
      ] },
      // rounded pillow seat cushion
      { kind: 'poly', role: 'cushion', fill: '#97a675', stroke: '#3d472b', strokeWidth: 0.8, points: [
        { u: 0.26, v: 0.16 }, { u: 0.74, v: 0.16 }, { u: 0.78, v: 0.27 }, { u: 0.72, v: 0.39 },
        { u: 0.50, v: 0.42 }, { u: 0.28, v: 0.39 }, { u: 0.22, v: 0.27 },
      ] },
      { kind: 'line', role: 'tuck', u0: 0.30, v0: 0.30, u1: 0.70, v1: 0.30, stroke: '#aab891', strokeWidth: 0.7 },
    ],
  },
  'lounge-chair-side': {
    id: 'lounge-chair-side', faceKind: 'side', label: 'Lounge chair side',
    parts: [
      // splayed pin legs (front + back)
      { kind: 'poly', role: 'leg-f', fill: '#5b4a32', stroke: '#332817', strokeWidth: 0.5, points: [
        { u: 0.20, v: 0.16 }, { u: 0.24, v: 0.16 }, { u: 0.14, v: 0.0 }, { u: 0.10, v: 0.0 },
      ] },
      { kind: 'poly', role: 'leg-b', fill: '#5b4a32', stroke: '#332817', strokeWidth: 0.5, points: [
        { u: 0.72, v: 0.16 }, { u: 0.76, v: 0.16 }, { u: 0.86, v: 0.0 }, { u: 0.82, v: 0.0 },
      ] },
      // tall rounded back at the back edge
      { kind: 'poly', role: 'back', fill: '#788a5f', stroke: '#3d472b', strokeWidth: 0.8, points: [
        { u: 0.55, v: 0.10 }, { u: 0.55, v: 0.78 }, { u: 0.62, v: 0.90 }, { u: 0.80, v: 0.92 }, { u: 0.88, v: 0.82 }, { u: 0.88, v: 0.10 },
      ] },
      // low rounded seat + front arm sweep
      { kind: 'poly', role: 'seat-arm', fill: '#788a5f', stroke: '#3d472b', strokeWidth: 0.8, points: [
        { u: 0.08, v: 0.10 }, { u: 0.08, v: 0.46 }, { u: 0.16, v: 0.54 }, { u: 0.34, v: 0.54 },
        { u: 0.46, v: 0.48 }, { u: 0.62, v: 0.48 }, { u: 0.62, v: 0.10 },
      ] },
      { kind: 'circle', role: 'sheen', u: 0.72, v: 0.58, r: 0.16, fill: '#8b9c72', strokeWidth: 0, opacity: 0.4 },
      // rounded seat cushion (profile)
      { kind: 'poly', role: 'cushion', fill: '#97a675', stroke: '#3d472b', strokeWidth: 0.7, points: [
        { u: 0.16, v: 0.40 }, { u: 0.56, v: 0.40 }, { u: 0.60, v: 0.46 }, { u: 0.56, v: 0.52 }, { u: 0.16, v: 0.52 }, { u: 0.12, v: 0.46 },
      ] },
    ],
  },

  // ── media unit: low walnut console (3 compartments + splayed legs) carrying a
  //    TV on top. Tall box drawn as a full front elevation; the TV zone is left
  //    transparent on sides/top so the screen reads thin, not as a deep block. ──
  'media-unit-front': {
    id: 'media-unit-front', faceKind: 'side', label: 'Media unit + TV front',
    parts: [
      // four splayed legs (decals in the transparent base)
      { kind: 'poly', role: 'leg-1', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.11, v: 0.12 }, { u: 0.135, v: 0.12 }, { u: 0.075, v: 0.0 }, { u: 0.05, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-2', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.33, v: 0.12 }, { u: 0.355, v: 0.12 }, { u: 0.315, v: 0.0 }, { u: 0.29, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-3', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.645, v: 0.12 }, { u: 0.67, v: 0.12 }, { u: 0.71, v: 0.0 }, { u: 0.685, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-4', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.865, v: 0.12 }, { u: 0.89, v: 0.12 }, { u: 0.95, v: 0.0 }, { u: 0.925, v: 0.0 } ] },
      // console carcass + top lip
      { kind: 'band', role: 'body', v: 0.11, h: 0.35, fill: '#574231', stroke: '#2b2118', strokeWidth: 0.7 },
      { kind: 'band', role: 'top-lip', v: 0.44, h: 0.045, fill: '#6e553c', stroke: '#2b2118', strokeWidth: 0.5 },
      // three recessed open compartments (wider middle bay, like the sketch)
      { kind: 'rect', role: 'cubby-l', u: 0.05, w: 0.24, v: 0.15, h: 0.26, fill: '#33271a', stroke: '#1f160d', strokeWidth: 0.6 },
      { kind: 'rect', role: 'cubby-c', u: 0.33, w: 0.34, v: 0.15, h: 0.26, fill: '#33271a', stroke: '#1f160d', strokeWidth: 0.6 },
      { kind: 'rect', role: 'cubby-r', u: 0.71, w: 0.24, v: 0.15, h: 0.26, fill: '#33271a', stroke: '#1f160d', strokeWidth: 0.6 },
      // a shelf line splitting the middle bay
      { kind: 'line', role: 'shelf-c', u0: 0.34, v0: 0.28, u1: 0.66, v1: 0.28, stroke: '#5a4631', strokeWidth: 0.8 },
      // TV pedestal stand
      { kind: 'rect', role: 'tv-foot', u: 0.40, w: 0.20, v: 0.45, h: 0.03, fill: '#3a3e44', stroke: '#1c1f24', strokeWidth: 0.4 },
      { kind: 'rect', role: 'tv-neck', u: 0.47, w: 0.06, v: 0.47, h: 0.07, fill: '#2a2d31', stroke: '#1c1f24', strokeWidth: 0.4 },
      // TV: bezel + screen + a little landscape glow
      { kind: 'rect', role: 'tv-bezel', u: 0.16, w: 0.68, v: 0.52, h: 0.44, fill: '#17191c', stroke: '#0b0c0e', strokeWidth: 0.6 },
      { kind: 'rect', role: 'tv-screen', u: 0.20, w: 0.60, v: 0.57, h: 0.34, fill: '#11202b', stroke: '#0a0c0e', strokeWidth: 0.5 },
      { kind: 'rect', role: 'screen-land', u: 0.20, w: 0.60, v: 0.57, h: 0.13, fill: '#1d3a2b', opacity: 0.92 },
      { kind: 'rect', role: 'screen-sky', u: 0.20, w: 0.60, v: 0.70, h: 0.21, fill: '#274d64', opacity: 0.88 },
      { kind: 'circle', role: 'screen-sun', u: 0.66, v: 0.80, r: 0.045, fill: '#caa24e', opacity: 0.8 },
      { kind: 'circle', role: 'power-led', u: 0.50, v: 0.535, r: 0.008, fill: '#7fd081' },
    ],
  },
  'media-unit-side': {
    id: 'media-unit-side', faceKind: 'side', label: 'Media unit side',
    parts: [
      { kind: 'poly', role: 'leg-f', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.18, v: 0.12 }, { u: 0.205, v: 0.12 }, { u: 0.13, v: 0.0 }, { u: 0.105, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-b', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.795, v: 0.12 }, { u: 0.82, v: 0.12 }, { u: 0.895, v: 0.0 }, { u: 0.87, v: 0.0 } ] },
      { kind: 'band', role: 'body', v: 0.11, h: 0.35, fill: '#4d3a2a', stroke: '#2b2118', strokeWidth: 0.7 },
      { kind: 'rect', role: 'side-panel', u: 0.14, w: 0.72, v: 0.15, h: 0.26, fill: '#563f2c', stroke: '#2b2118', strokeWidth: 0.5 },
      { kind: 'band', role: 'top-lip', v: 0.44, h: 0.045, fill: '#5e4732', stroke: '#2b2118', strokeWidth: 0.5 },
    ],
  },
  'media-unit-back': {
    id: 'media-unit-back', faceKind: 'side', label: 'Media unit back',
    // same console + cubbies as the front, but NO TV. Because the box's front/back
    // orientation relative to the camera isn't fixed, this guarantees the nearest
    // face always shows the cubbies (never a blank panel over them), while exactly
    // one face carries the TV — so the screen reads with no ghost behind it.
    parts: [
      { kind: 'poly', role: 'leg-1', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.11, v: 0.12 }, { u: 0.135, v: 0.12 }, { u: 0.075, v: 0.0 }, { u: 0.05, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-2', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.33, v: 0.12 }, { u: 0.355, v: 0.12 }, { u: 0.315, v: 0.0 }, { u: 0.29, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-3', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.645, v: 0.12 }, { u: 0.67, v: 0.12 }, { u: 0.71, v: 0.0 }, { u: 0.685, v: 0.0 } ] },
      { kind: 'poly', role: 'leg-4', fill: '#3f2f20', stroke: '#241a10', strokeWidth: 0.5, points: [
        { u: 0.865, v: 0.12 }, { u: 0.89, v: 0.12 }, { u: 0.95, v: 0.0 }, { u: 0.925, v: 0.0 } ] },
      { kind: 'band', role: 'body', v: 0.11, h: 0.35, fill: '#4d3a2a', stroke: '#2b2118', strokeWidth: 0.7 },
      { kind: 'band', role: 'top-lip', v: 0.44, h: 0.045, fill: '#5e4732', stroke: '#2b2118', strokeWidth: 0.5 },
      { kind: 'rect', role: 'cubby-l', u: 0.05, w: 0.24, v: 0.15, h: 0.26, fill: '#33271a', stroke: '#1f160d', strokeWidth: 0.6 },
      { kind: 'rect', role: 'cubby-c', u: 0.33, w: 0.34, v: 0.15, h: 0.26, fill: '#33271a', stroke: '#1f160d', strokeWidth: 0.6 },
      { kind: 'rect', role: 'cubby-r', u: 0.71, w: 0.24, v: 0.15, h: 0.26, fill: '#33271a', stroke: '#1f160d', strokeWidth: 0.6 },
      { kind: 'line', role: 'shelf-c', u0: 0.34, v0: 0.28, u1: 0.66, v1: 0.28, stroke: '#5a4631', strokeWidth: 0.8 },
    ],
  },
  'media-unit-top': {
    id: 'media-unit-top', faceKind: 'center', label: 'Media unit top',
    // box lid sits well above the console (at TV-top height); leave it open so
    // nothing floats above the screen — the TV is the only tall element, on the front face
    parts: [],
  },

  // ── floor textiles (center face only) ──────────────────────────────────────
  'rug-woven': {
    id: 'rug-woven', faceKind: 'center', label: 'Woven rug',
    parts: [
      fullFace('field', '#8e4c3f', '#5c332b', 0.7),
      { kind: 'rect', role: 'border', u: 0.04, w: 0.92, v: 0.04, h: 0.92, fill: 'none', stroke: '#e5c778', strokeWidth: 1.2 },
      { kind: 'rect', role: 'inner-border', u: 0.12, w: 0.76, v: 0.14, h: 0.72, fill: '#a85d4c', stroke: '#6d3c32', strokeWidth: 0.8 },
      { kind: 'repeat', role: 'weft', u0: 0.17, u1: 0.83, count: 5, v: 0.22, h: 0.56, gap: 0.035, fill: '#d9b96d', opacity: 0.72 },
    ],
  },
  'runner-woven': {
    id: 'runner-woven', faceKind: 'center', label: 'Floor runner',
    parts: [
      fullFace('field', '#3f6875', '#264650', 0.7),
      { kind: 'rect', role: 'border', u: 0.025, w: 0.95, v: 0.08, h: 0.84, fill: 'none', stroke: '#d7c48a', strokeWidth: 1 },
      { kind: 'repeat', role: 'stripe', u0: 0.08, u1: 0.92, count: 9, v: 0.26, h: 0.48, gap: 0.018, fill: '#6fa0a3', opacity: 0.8 },
    ],
  },

  // ── beds and seating blocks ────────────────────────────────────────────────
  'bed-top': {
    id: 'bed-top', faceKind: 'center', label: 'Bed top',
    parts: [
      fullFace('blanket', '#496b89', '#263b50', 0.7),
      { kind: 'rect', role: 'pillow-l', u: 0.09, w: 0.34, v: 0.08, h: 0.22, fill: '#efe6d2', stroke: '#baa981', strokeWidth: 0.7 },
      { kind: 'rect', role: 'pillow-r', u: 0.57, w: 0.34, v: 0.08, h: 0.22, fill: '#efe6d2', stroke: '#baa981', strokeWidth: 0.7 },
      { kind: 'band', role: 'fold', v: 0.68, h: 0.12, fill: '#38566f', stroke: '#263b50', strokeWidth: 0.4 },
    ],
  },
  'bed-side': {
    id: 'bed-side', faceKind: 'side', label: 'Bed side',
    parts: [
      fullFace('base', '#6b4d36', DARK_EDGE, 0.7),
      { kind: 'band', role: 'blanket-drop', v: 0.62, h: 0.38, fill: '#3f5f7a', stroke: '#263b50', strokeWidth: 0.6 },
    ],
  },
  'sofa-top': {
    id: 'sofa-top', faceKind: 'center', label: 'Sofa cushions',
    parts: [
      fullFace('seat', '#657b5c', '#3d5138', 0.7),
      { kind: 'line', role: 'cushion-seam-l', u0: 0.33, v0: 0.08, u1: 0.33, v1: 0.92, stroke: '#354830', strokeWidth: 0.9 },
      { kind: 'line', role: 'cushion-seam-r', u0: 0.66, v0: 0.08, u1: 0.66, v1: 0.92, stroke: '#354830', strokeWidth: 0.9 },
    ],
  },
  'sofa-front': {
    id: 'sofa-front', faceKind: 'side', label: 'Sofa front',
    parts: [
      fullFace('apron', '#58704f', '#354830', 0.7),
      { kind: 'repeat', role: 'cushion-fronts', u0: 0.06, u1: 0.94, count: 3, v: 0.48, h: 0.42, gap: 0.02, fill: '#6f8664', stroke: '#3d5138', strokeWidth: 0.5 },
    ],
  },
  'sofa-side': {
    id: 'sofa-side', faceKind: 'side', label: 'Sofa side',
    parts: [fullFace('arm', '#4f6848', '#354830', 0.7)],
  },
  'bench-top': {
    id: 'bench-top', faceKind: 'center', label: 'Bench plank',
    parts: [
      fullFace('plank', '#a77942', '#5a3f23', 0.7),
      { kind: 'line', role: 'grain-1', u0: 0.08, v0: 0.32, u1: 0.92, v1: 0.28, stroke: '#77532d', strokeWidth: 0.8 },
      { kind: 'line', role: 'grain-2', u0: 0.08, v0: 0.64, u1: 0.92, v1: 0.69, stroke: '#77532d', strokeWidth: 0.8 },
    ],
  },
  'bench-rail': {
    id: 'bench-rail', faceKind: 'side', label: 'Bench rail',
    parts: [{ kind: 'band', role: 'rail', v: 0.78, h: 0.22, fill: '#806037', stroke: DARK_EDGE, strokeWidth: 0.8 }],
  },
  'stool-seat': {
    id: 'stool-seat', faceKind: 'center', label: 'Stool seat',
    parts: [
      fullFace('seat', '#b6864d', '#5a3f23', 0.7),
      { kind: 'circle', role: 'round-inset', u: 0.5, v: 0.5, r: 0.32, fill: '#c39258', stroke: '#77532d', strokeWidth: 0.7 },
    ],
  },
  'armchair-seat': {
    id: 'armchair-seat', faceKind: 'center', label: 'Armchair cushion',
    parts: [
      fullFace('seat', '#7f5f76', '#49384b', 0.7),
      { kind: 'rect', role: 'cushion', u: 0.14, w: 0.72, v: 0.18, h: 0.66, fill: '#92718a', stroke: '#49384b', strokeWidth: 0.7 },
    ],
  },
  'armchair-front': {
    id: 'armchair-front', faceKind: 'side', label: 'Armchair front',
    parts: [fullFace('front-panel', '#74566d', '#49384b', 0.7)],
  },
  'armchair-side': {
    id: 'armchair-side', faceKind: 'side', label: 'Armchair arm',
    parts: [fullFace('arm-panel', '#664b61', '#49384b', 0.7)],
  },

  // ── storage families ──────────────────────────────────────────────────────
  'bookshelf-top': {
    id: 'bookshelf-top', faceKind: 'center', label: 'Bookshelf top',
    parts: [fullFace('wood-top', '#73583b', DARK_EDGE, 0.6)],
  },
  'bookshelf-front': {
    id: 'bookshelf-front', faceKind: 'side', label: 'Bookshelf grid',
    parts: [
      fullFace('case', '#5c442f', DARK_EDGE, 0.8),
      { kind: 'repeat', role: 'books-row-top', u0: 0.10, u1: 0.90, count: 9, v: 0.12, h: 0.18, gap: 0.012, fills: BOOK_FILLS, stroke: DARK_EDGE, strokeWidth: 0.25 },
      { kind: 'band', role: 'shelf-1', v: 0.34, h: 0.035, fill: '#876744', stroke: DARK_EDGE, strokeWidth: 0.3 },
      { kind: 'repeat', role: 'books-row-mid', u0: 0.08, u1: 0.92, count: 8, v: 0.41, h: 0.21, gap: 0.014, fills: [...BOOK_FILLS].reverse(), stroke: DARK_EDGE, strokeWidth: 0.25 },
      { kind: 'band', role: 'shelf-2', v: 0.68, h: 0.035, fill: '#876744', stroke: DARK_EDGE, strokeWidth: 0.3 },
      { kind: 'repeat', role: 'books-row-low', u0: 0.12, u1: 0.88, count: 7, v: 0.75, h: 0.16, gap: 0.018, fills: BOOK_FILLS, stroke: DARK_EDGE, strokeWidth: 0.25 },
    ],
  },
  'bookshelf-side': {
    id: 'bookshelf-side', faceKind: 'side', label: 'Bookshelf side',
    parts: [fullFace('side', '#4d3828', DARK_EDGE, 0.7)],
  },
  'rack-shelf-top': {
    id: 'rack-shelf-top', faceKind: 'center', label: 'Rack shelf top',
    parts: [
      fullFace('metal-top', '#5b6366', '#252b2d', 0.6),
      { kind: 'repeat', role: 'top-slots', u0: 0.08, u1: 0.92, count: 8, v: 0.36, h: 0.18, gap: 0.018, fill: '#3c4447', stroke: '#252b2d', strokeWidth: 0.25 },
    ],
  },
  'rack-shelf-front': {
    id: 'rack-shelf-front', faceKind: 'side', label: 'Repeating rack shelves',
    parts: [
      fullFace('open-shadow', '#303638', '#171b1d', 0.8),
      { kind: 'band', role: 'shelf-top', v: 0.86, h: 0.035, fill: '#7c8587', stroke: '#252b2d', strokeWidth: 0.3 },
      { kind: 'band', role: 'shelf-upper', v: 0.64, h: 0.035, fill: '#7c8587', stroke: '#252b2d', strokeWidth: 0.3 },
      { kind: 'band', role: 'shelf-middle', v: 0.42, h: 0.035, fill: '#7c8587', stroke: '#252b2d', strokeWidth: 0.3 },
      { kind: 'band', role: 'shelf-lower', v: 0.20, h: 0.035, fill: '#7c8587', stroke: '#252b2d', strokeWidth: 0.3 },
      { kind: 'repeat', role: 'upper-bins', u0: 0.08, u1: 0.92, count: 4, v: 0.68, h: 0.13, gap: 0.025, fill: '#687982', stroke: '#252b2d', strokeWidth: 0.35 },
      { kind: 'repeat', role: 'mid-boxes', u0: 0.08, u1: 0.92, count: 5, v: 0.47, h: 0.11, gap: 0.018, fill: '#8a744d', stroke: '#3a2c19', strokeWidth: 0.35 },
      { kind: 'repeat', role: 'lower-crates', u0: 0.08, u1: 0.92, count: 3, v: 0.25, h: 0.12, gap: 0.035, fill: '#566068', stroke: '#252b2d', strokeWidth: 0.35 },
    ],
  },
  'rack-shelf-side': {
    id: 'rack-shelf-side', faceKind: 'side', label: 'Rack shelf side',
    parts: [
      fullFace('side-shadow', '#2b3133', '#171b1d', 0.7),
      { kind: 'line', role: 'upright-front', u0: 0.15, v0: 0.08, u1: 0.15, v1: 0.94, stroke: '#7c8587', strokeWidth: 1 },
      { kind: 'line', role: 'upright-back', u0: 0.85, v0: 0.08, u1: 0.85, v1: 0.94, stroke: '#7c8587', strokeWidth: 1 },
      { kind: 'repeat', role: 'side-shelves', u0: 0.12, u1: 0.88, count: 4, v: 0.20, h: 0.025, gap: 0.18, fill: '#7c8587', stroke: '#252b2d', strokeWidth: 0.25 },
    ],
  },
  'dresser-top': {
    id: 'dresser-top', faceKind: 'center', label: 'Dresser top',
    parts: [fullFace('top', '#8a6640', DARK_EDGE, 0.6)],
  },
  'dresser-front': {
    id: 'dresser-front', faceKind: 'side', label: 'Dresser drawers',
    parts: [
      fullFace('body', '#765739', DARK_EDGE, 0.7),
      { kind: 'rect', role: 'drawer-top', u: 0.08, w: 0.84, v: 0.08, h: 0.22, fill: '#8b6843', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'rect', role: 'drawer-mid', u: 0.08, w: 0.84, v: 0.38, h: 0.22, fill: '#8b6843', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'rect', role: 'drawer-low', u: 0.08, w: 0.84, v: 0.68, h: 0.22, fill: '#8b6843', stroke: DARK_EDGE, strokeWidth: 0.7 },
      barPull('pull-top', 0.30, 0.40, 0.19),
      barPull('pull-mid', 0.30, 0.40, 0.49),
      barPull('pull-low', 0.30, 0.40, 0.79),
    ],
  },
  'nightstand-front': {
    id: 'nightstand-front', faceKind: 'side', label: 'Nightstand drawer',
    parts: [
      fullFace('body', '#6f5136', DARK_EDGE, 0.7),
      { kind: 'rect', role: 'drawer', u: 0.12, w: 0.76, v: 0.12, h: 0.36, fill: '#84613d', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'circle', role: 'knob', u: 0.5, v: 0.30, r: 0.045, fill: '#d8c08a' },
      { kind: 'rect', role: 'lower-door', u: 0.15, w: 0.70, v: 0.58, h: 0.30, fill: '#76583a', stroke: DARK_EDGE, strokeWidth: 0.55 },
    ],
  },
  'sideboard-front': {
    id: 'sideboard-front', faceKind: 'side', label: 'Sideboard doors',
    parts: [
      fullFace('body', '#705139', DARK_EDGE, 0.7),
      { kind: 'repeat', role: 'doors', u0: 0.05, u1: 0.95, count: 4, v: 0.10, h: 0.78, gap: 0.018, fill: '#826144', stroke: DARK_EDGE, strokeWidth: 0.55 },
      { kind: 'line', role: 'top-lip', u0: 0.04, v0: 0.92, u1: 0.96, v1: 0.92, stroke: '#3c2c1e', strokeWidth: 0.8 },
    ],
  },

  // ── electronics (screens, decks, keys) ─────────────────────────────────────
  'monitor-screen': {
    id: 'monitor-screen', faceKind: 'side', label: 'Monitor screen',
    parts: [
      fullFace('bezel', '#26292e', '#131517', 0.6),
      { kind: 'rect', role: 'stand-foot', u: 0.30, w: 0.40, v: 0, h: 0.06, fill: '#4a4f55', stroke: '#1c1f24', strokeWidth: 0.5 },
      { kind: 'rect', role: 'stand-neck', u: 0.45, w: 0.10, v: 0.05, h: 0.24, fill: '#3a3e44', stroke: '#1c1f24', strokeWidth: 0.5 },
      { kind: 'rect', role: 'screen', u: 0.08, w: 0.84, v: 0.30, h: 0.62, fill: SCREEN_DARK, stroke: '#0e1013', strokeWidth: 0.5 },
      { kind: 'rect', role: 'screen-glow', u: 0.12, w: 0.50, v: 0.40, h: 0.40, fill: SCREEN_GLOW, stroke: 'none', strokeWidth: 0, opacity: 0.55 },
      { kind: 'circle', role: 'power-led', u: 0.88, v: 0.33, r: 0.012, fill: '#7fd081' },
    ],
  },
  'monitor-back': {
    id: 'monitor-back', faceKind: 'side', label: 'Monitor back',
    parts: [
      fullFace('shell', '#33373c', '#16181b', 0.6),
      { kind: 'rect', role: 'panel', u: 0.10, w: 0.80, v: 0.30, h: 0.62, fill: '#2c3035', stroke: '#16181b', strokeWidth: 0.5 },
      { kind: 'rect', role: 'neck', u: 0.43, w: 0.14, v: 0.04, h: 0.28, fill: '#3a3e44', stroke: '#16181b', strokeWidth: 0.5 },
      { kind: 'repeat', role: 'vents', u0: 0.22, u1: 0.78, count: 6, v: 0.50, h: 0.30, gap: 0.02, fill: '#23272b', stroke: '#16181b', strokeWidth: 0.2 },
    ],
  },
  'monitor-edge': {
    id: 'monitor-edge', faceKind: 'center', label: 'Monitor top edge',
    parts: [fullFace('edge', '#2a2d31', '#141619', 0.5)],
  },
  'monitor-side': {
    id: 'monitor-side', faceKind: 'side', label: 'Monitor side',
    parts: [
      fullFace('edge', '#272a2e', '#141619', 0.5),
      { kind: 'rect', role: 'neck', u: 0.42, w: 0.16, v: 0.04, h: 0.26, fill: '#3a3e44', stroke: '#16181b', strokeWidth: 0.4 },
    ],
  },
  'tv-screen': {
    id: 'tv-screen', faceKind: 'center', label: 'Wall TV',
    parts: [
      fullFace('bezel', '#17191c', '#0b0c0e', 0.7),
      { kind: 'rect', role: 'screen', u: 0.04, w: 0.92, v: 0.10, h: 0.82, fill: '#11202b', stroke: '#0a0c0e', strokeWidth: 0.5 },
      { kind: 'band', role: 'sky', v: 0.52, h: 0.30, fill: '#274d64', opacity: 0.85 },
      { kind: 'band', role: 'land', v: 0.16, h: 0.22, fill: '#1d3a2b', opacity: 0.9 },
      { kind: 'circle', role: 'sun', u: 0.70, v: 0.60, r: 0.09, fill: '#caa24e', opacity: 0.75 },
      { kind: 'circle', role: 'power-led', u: 0.50, v: 0.055, r: 0.01, fill: '#7fd081' },
    ],
  },
  'keyboard-keys': {
    id: 'keyboard-keys', faceKind: 'center', label: 'Keyboard',
    parts: [
      fullFace('base', '#2c2f34', '#171a1d', 0.6),
      { kind: 'repeat', role: 'row-top', u0: 0.05, u1: 0.95, count: 13, v: 0.66, h: 0.22, gap: 0.008, fill: KEY_FILL, stroke: KEY_EDGE, strokeWidth: 0.3 },
      { kind: 'repeat', role: 'row-mid', u0: 0.05, u1: 0.92, count: 12, v: 0.40, h: 0.22, gap: 0.008, fill: KEY_FILL, stroke: KEY_EDGE, strokeWidth: 0.3 },
      { kind: 'repeat', role: 'row-low', u0: 0.05, u1: 0.86, count: 10, v: 0.16, h: 0.20, gap: 0.008, fill: KEY_FILL, stroke: KEY_EDGE, strokeWidth: 0.3 },
      { kind: 'rect', role: 'spacebar', u: 0.28, w: 0.40, v: 0.04, h: 0.10, fill: KEY_FILL, stroke: KEY_EDGE, strokeWidth: 0.3 },
    ],
  },
  'laptop-deck': {
    id: 'laptop-deck', faceKind: 'center', label: 'Open laptop',
    parts: [
      fullFace('chassis', SILVER, SILVER_EDGE, 0.6),
      { kind: 'rect', role: 'screen', u: 0.10, w: 0.80, v: 0.52, h: 0.42, fill: '#191c21', stroke: '#0e1013', strokeWidth: 0.6 },
      { kind: 'rect', role: 'screen-glow', u: 0.14, w: 0.52, v: 0.58, h: 0.28, fill: SCREEN_GLOW, stroke: 'none', strokeWidth: 0, opacity: 0.6 },
      { kind: 'line', role: 'hinge', u0: 0.08, v0: 0.50, u1: 0.92, v1: 0.50, stroke: SILVER_EDGE, strokeWidth: 1 },
      { kind: 'rect', role: 'keydeck', u: 0.12, w: 0.76, v: 0.12, h: 0.34, fill: '#7e8488', stroke: SILVER_EDGE, strokeWidth: 0.4 },
      { kind: 'repeat', role: 'keys', u0: 0.16, u1: 0.84, count: 10, v: 0.24, h: 0.16, gap: 0.012, fill: KEY_FILL, stroke: '#23262a', strokeWidth: 0.25 },
      { kind: 'rect', role: 'trackpad', u: 0.40, w: 0.20, v: 0.135, h: 0.07, fill: '#8b9195', stroke: SILVER_EDGE, strokeWidth: 0.3 },
    ],
  },

  // ── bathroom ───────────────────────────────────────────────────────────────
  'toilet-lid': {
    id: 'toilet-lid', faceKind: 'center', label: 'Toilet top',
    parts: [
      fullFace('porcelain', PORCELAIN, PORCELAIN_EDGE, 0.6),
      { kind: 'circle', role: 'seat', u: 0.5, v: 0.40, r: 0.40, fill: '#edeee9', stroke: '#c6c8c1', strokeWidth: 0.7 },
      { kind: 'circle', role: 'bowl-rim', u: 0.5, v: 0.40, r: 0.23, fill: '#d7d8d2', stroke: '#c0c2bb', strokeWidth: 0.5 },
      { kind: 'rect', role: 'tank-lid', u: 0.18, w: 0.64, v: 0.80, h: 0.16, fill: '#dcddd7', stroke: '#c0c2bb', strokeWidth: 0.6 },
      { kind: 'circle', role: 'flush', u: 0.5, v: 0.88, r: 0.035, fill: '#bcbeb7' },
    ],
  },
  'toilet-bowl': {
    id: 'toilet-bowl', faceKind: 'side', label: 'Toilet bowl',
    parts: [
      fullFace('porcelain', '#e3e4df', '#b1b3ac', 0.7),
      { kind: 'poly', role: 'pedestal', fill: '#d6d7d1', stroke: '#b1b3ac', strokeWidth: 0.6, points: [{ u: 0.34, v: 0 }, { u: 0.66, v: 0 }, { u: 0.60, v: 0.48 }, { u: 0.40, v: 0.48 }] },
      { kind: 'rect', role: 'bowl', u: 0.16, w: 0.68, v: 0.46, h: 0.40, fill: '#dadbd5', stroke: '#b1b3ac', strokeWidth: 0.6 },
      { kind: 'circle', role: 'bowl-shadow', u: 0.5, v: 0.66, r: 0.20, fill: '#c6c8c1', opacity: 0.7 },
    ],
  },
  'toilet-tank': {
    id: 'toilet-tank', faceKind: 'side', label: 'Toilet tank',
    parts: [
      fullFace('porcelain', '#e1e2dc', '#b1b3ac', 0.7),
      { kind: 'rect', role: 'tank', u: 0.12, w: 0.76, v: 0.42, h: 0.52, fill: '#dcddd7', stroke: '#b1b3ac', strokeWidth: 0.6 },
      { kind: 'rect', role: 'pedestal', u: 0.36, w: 0.28, v: 0, h: 0.44, fill: '#d6d7d1', stroke: '#b1b3ac', strokeWidth: 0.5 },
    ],
  },
  'toilet-side': {
    id: 'toilet-side', faceKind: 'side', label: 'Toilet side',
    parts: [
      fullFace('porcelain', '#dcddd7', '#a8aaa3', 0.7),
      { kind: 'rect', role: 'tank', u: 0.56, w: 0.40, v: 0.42, h: 0.52, fill: '#d4d5cf', stroke: '#a8aaa3', strokeWidth: 0.5 },
      { kind: 'poly', role: 'bowl', fill: '#d4d5cf', stroke: '#a8aaa3', strokeWidth: 0.5, points: [{ u: 0.04, v: 0.12 }, { u: 0.54, v: 0.12 }, { u: 0.48, v: 0.54 }, { u: 0.08, v: 0.54 }] },
    ],
  },

  // ── chest of drawers (tall, stacked — distinct from the wide dresser) ───────
  'drawers-front': {
    id: 'drawers-front', faceKind: 'side', label: 'Chest of drawers',
    parts: [
      fullFace('body', '#6f5236', DARK_EDGE, 0.7),
      { kind: 'rect', role: 'drawer-1', u: 0.08, w: 0.84, v: 0.06, h: 0.19, fill: '#83613e', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'rect', role: 'drawer-2', u: 0.08, w: 0.84, v: 0.29, h: 0.19, fill: '#83613e', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'rect', role: 'drawer-3', u: 0.08, w: 0.84, v: 0.52, h: 0.19, fill: '#83613e', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'rect', role: 'drawer-4', u: 0.08, w: 0.84, v: 0.75, h: 0.19, fill: '#83613e', stroke: DARK_EDGE, strokeWidth: 0.7 },
      barPull('pull-1', 0.36, 0.28, 0.155),
      barPull('pull-2', 0.36, 0.28, 0.385),
      barPull('pull-3', 0.36, 0.28, 0.615),
      barPull('pull-4', 0.36, 0.28, 0.845),
    ],
  },

  // ── wall cards (center face only; side faces intentionally transparent) ───
  'window-light': {
    id: 'window-light', faceKind: 'center', label: 'Window light',
    parts: [
      fullFace('glass', '#9fc6cf', WALL_EDGE, 0.8),
      { kind: 'rect', role: 'inner-glow', u: 0.08, w: 0.84, v: 0.08, h: 0.84, fill: '#cde5df', stroke: '#6fa0a3', strokeWidth: 0.5, opacity: 0.85 },
      { kind: 'line', role: 'mullion-v', u0: 0.5, v0: 0.08, u1: 0.5, v1: 0.92, stroke: WALL_EDGE, strokeWidth: 0.9 },
      { kind: 'line', role: 'mullion-h', u0: 0.08, v0: 0.5, u1: 0.92, v1: 0.5, stroke: WALL_EDGE, strokeWidth: 0.9 },
    ],
  },
  'door-panel': {
    id: 'door-panel', faceKind: 'center', label: 'Door panel',
    parts: [
      fullFace('door', '#745238', DARK_EDGE, 0.8),
      { kind: 'rect', role: 'upper-panel', u: 0.16, w: 0.68, v: 0.10, h: 0.34, fill: '#805d3e', stroke: DARK_EDGE, strokeWidth: 0.65 },
      { kind: 'rect', role: 'lower-panel', u: 0.16, w: 0.68, v: 0.54, h: 0.34, fill: '#805d3e', stroke: DARK_EDGE, strokeWidth: 0.65 },
      { kind: 'circle', role: 'knob', u: 0.78, v: 0.5, r: 0.045, fill: '#d8c08a' },
    ],
  },
  'picture-frame': {
    id: 'picture-frame', faceKind: 'center', label: 'Picture frame',
    parts: [
      fullFace('frame', '#61452f', DARK_EDGE, 0.7),
      { kind: 'rect', role: 'mat', u: 0.10, w: 0.80, v: 0.12, h: 0.76, fill: '#e7dac0', stroke: '#8f795d', strokeWidth: 0.5 },
      { kind: 'poly', role: 'landscape-hill', fill: '#6f8f57', stroke: 'none', points: [{ u: 0.16, v: 0.76 }, { u: 0.42, v: 0.48 }, { u: 0.67, v: 0.74 }, { u: 0.86, v: 0.54 }, { u: 0.86, v: 0.82 }, { u: 0.16, v: 0.82 }] },
      { kind: 'circle', role: 'sun', u: 0.75, v: 0.30, r: 0.08, fill: '#d3a447' },
    ],
  },
  'sconce-glow': {
    id: 'sconce-glow', faceKind: 'center', label: 'Wall sconce',
    parts: [
      { kind: 'circle', role: 'halo', u: 0.5, v: 0.5, r: 0.46, fill: '#e9c875', opacity: 0.28 },
      { kind: 'rect', role: 'mount', u: 0.36, w: 0.28, v: 0.40, h: 0.38, fill: '#6b5038', stroke: DARK_EDGE, strokeWidth: 0.6 },
      { kind: 'poly', role: 'shade', fill: '#d8b862', stroke: '#856b34', strokeWidth: 0.6, points: [{ u: 0.30, v: 0.22 }, { u: 0.70, v: 0.22 }, { u: 0.62, v: 0.47 }, { u: 0.38, v: 0.47 }] },
    ],
  },

  // ── bar counter (block, no legs; foot rail + panelled front + metal top rail) ──
  'bar-top': {
    id: 'bar-top', faceKind: 'center', label: 'Bar counter top',
    parts: [
      { kind: 'band', role: 'counter', v: 0, h: 1, fill: '#6b4a2c' },
      { kind: 'rect', role: 'inlay', u: 0.05, w: 0.90, v: 0.18, h: 0.72, fill: '#7a5736', stroke: '#4a3720', strokeWidth: 0.7 },
      { kind: 'band', role: 'edge-rail', v: 0, h: 0.07, fill: SILVER, stroke: SILVER_EDGE, strokeWidth: 0.5 },
    ],
  },
  'bar-front': {
    id: 'bar-front', faceKind: 'side', label: 'Bar counter front',
    parts: [
      { kind: 'band', role: 'body', v: 0, h: 1, fill: '#5e4228' },
      { kind: 'band', role: 'apron', v: 0.82, h: 0.18, fill: '#73552f', stroke: DARK_EDGE, strokeWidth: 0.7 },
      { kind: 'repeat', role: 'panels', u0: 0.04, u1: 0.96, count: 5, gap: 0.02, v: 0.18, h: 0.58, fill: '#6a4d2e', stroke: '#3a2c19', strokeWidth: 0.7 },
      { kind: 'band', role: 'foot-rail', v: 0.13, h: 0.035, fill: '#b9bfc4', stroke: '#6c7176', strokeWidth: 0.4 },
      { kind: 'band', role: 'kick', v: 0, h: 0.085, fill: '#2c2118' },
    ],
  },
  'bar-side': {
    id: 'bar-side', faceKind: 'side', label: 'Bar counter side',
    parts: [
      { kind: 'band', role: 'body', v: 0, h: 1, fill: '#553c25' },
      { kind: 'rect', role: 'panel', u: 0.12, w: 0.76, v: 0.18, h: 0.6, fill: '#624629', stroke: '#3a2c19', strokeWidth: 0.7 },
      { kind: 'band', role: 'kick', v: 0, h: 0.085, fill: '#2c2118' },
    ],
  },
};

/**
 * Furniture nets — the furniture twin of VEHICLE_FACE_NETS. Maps each face slot
 * (center + 4 cardinals) to a face-card id. Geometry (footprint, height,
 * support pins) comes from the room planner, keyed by element type; the net only
 * decides which sticker rides each face.
 */
export const FURNITURE_NETS = {
  table: {
    conceptId: 'furniture.table.four-leg',
    faces: { center: 'table-top', front: 'table-apron-drawer', back: 'table-apron', left: 'table-apron', right: 'table-apron' },
  },
  'dining-table': {
    conceptId: 'furniture.table.dining',
    faces: { center: 'dining-table-top', front: 'dining-table-apron', back: 'dining-table-apron', left: 'dining-table-apron', right: 'dining-table-apron' },
  },
  diningTable: {
    conceptId: 'furniture.table.dining',
    faces: { center: 'dining-table-top', front: 'dining-table-apron', back: 'dining-table-apron', left: 'dining-table-apron', right: 'dining-table-apron' },
  },
  'standing-desk': {
    conceptId: 'furniture.desk.standing',
    faces: { center: 'standing-desk-top', front: 'standing-desk-apron', back: 'standing-desk-apron', left: 'table-apron', right: 'table-apron' },
  },
  standingDesk: {
    conceptId: 'furniture.desk.standing',
    faces: { center: 'standing-desk-top', front: 'standing-desk-apron', back: 'standing-desk-apron', left: 'table-apron', right: 'table-apron' },
  },
  rug: {
    conceptId: 'furniture.rug.woven',
    faces: { center: 'rug-woven' },
  },
  runner: {
    conceptId: 'furniture.runner.woven',
    faces: { center: 'runner-woven' },
  },
  bed: {
    conceptId: 'furniture.bed.block',
    faces: { center: 'bed-top', front: 'bed-side', back: 'bed-side', left: 'bed-side', right: 'bed-side' },
  },
  sofa: {
    conceptId: 'furniture.sofa.block',
    faces: { center: 'sofa-top', front: 'sofa-front', back: 'sofa-front', left: 'sofa-side', right: 'sofa-side' },
  },
  bench: {
    conceptId: 'furniture.bench.trestle',
    faces: { center: 'bench-top', front: 'bench-rail', back: 'bench-rail', left: 'bench-rail', right: 'bench-rail' },
  },
  stool: {
    conceptId: 'furniture.stool.four-leg',
    faces: { center: 'stool-seat', front: 'chair-rail', back: 'chair-rail', left: 'chair-rail', right: 'chair-rail' },
  },
  'computer-chair': {
    conceptId: 'furniture.chair.computer',
    faces: { center: 'computer-chair-seat', front: 'computer-chair-front', back: 'computer-chair-front', left: 'computer-chair-side', right: 'computer-chair-side' },
  },
  computerChair: {
    conceptId: 'furniture.chair.computer',
    faces: { center: 'computer-chair-seat', front: 'computer-chair-front', back: 'computer-chair-front', left: 'computer-chair-side', right: 'computer-chair-side' },
  },
  cabinet: {
    conceptId: 'furniture.cabinet.block',
    faces: { center: 'cabinet-top', front: 'cabinet-front', back: 'cabinet-side', left: 'cabinet-side', right: 'cabinet-side' },
  },
  bar: {
    conceptId: 'furniture.bar.counter',
    faces: { center: 'bar-top', front: 'bar-front', back: 'bar-side', left: 'bar-side', right: 'bar-side' },
  },
  bookshelf: {
    conceptId: 'furniture.bookshelf.grid',
    faces: { center: 'bookshelf-top', front: 'bookshelf-front', back: 'bookshelf-side', left: 'bookshelf-side', right: 'bookshelf-side' },
  },
  'rack-shelf': {
    conceptId: 'furniture.rack-shelf.repeat',
    faces: { center: 'rack-shelf-top', front: 'rack-shelf-front', back: 'rack-shelf-side', left: 'rack-shelf-side', right: 'rack-shelf-side' },
  },
  rackShelf: {
    conceptId: 'furniture.rack-shelf.repeat',
    faces: { center: 'rack-shelf-top', front: 'rack-shelf-front', back: 'rack-shelf-side', left: 'rack-shelf-side', right: 'rack-shelf-side' },
  },
  rackShelves: {
    conceptId: 'furniture.rack-shelf.repeat',
    faces: { center: 'rack-shelf-top', front: 'rack-shelf-front', back: 'rack-shelf-side', left: 'rack-shelf-side', right: 'rack-shelf-side' },
  },
  dresser: {
    conceptId: 'furniture.dresser.drawers',
    faces: { center: 'dresser-top', front: 'dresser-front', back: 'cabinet-side', left: 'cabinet-side', right: 'cabinet-side' },
  },
  nightstand: {
    conceptId: 'furniture.nightstand.drawer',
    faces: { center: 'cabinet-top', front: 'nightstand-front', back: 'cabinet-side', left: 'cabinet-side', right: 'cabinet-side' },
  },
  sideboard: {
    conceptId: 'furniture.sideboard.doors',
    faces: { center: 'dresser-top', front: 'sideboard-front', back: 'cabinet-side', left: 'cabinet-side', right: 'cabinet-side' },
  },
  'media-unit': {
    conceptId: 'furniture.media-unit.tv',
    faces: { center: 'media-unit-top', front: 'media-unit-front', back: 'media-unit-back', left: 'media-unit-side', right: 'media-unit-side' },
  },
  mediaUnit: {
    conceptId: 'furniture.media-unit.tv',
    faces: { center: 'media-unit-top', front: 'media-unit-front', back: 'media-unit-back', left: 'media-unit-side', right: 'media-unit-side' },
  },
  'tv-stand': {
    conceptId: 'furniture.media-unit.tv',
    faces: { center: 'media-unit-top', front: 'media-unit-front', back: 'media-unit-back', left: 'media-unit-side', right: 'media-unit-side' },
  },
  tvStand: {
    conceptId: 'furniture.media-unit.tv',
    faces: { center: 'media-unit-top', front: 'media-unit-front', back: 'media-unit-back', left: 'media-unit-side', right: 'media-unit-side' },
  },
  chair: {
    conceptId: 'furniture.chair.four-leg',
    faces: { center: 'chair-seat', front: 'chair-rail', back: 'chair-rail', left: 'chair-rail', right: 'chair-rail' },
  },
  armchair: {
    conceptId: 'furniture.armchair.block',
    faces: { center: 'armchair-seat', front: 'armchair-front', back: 'armchair-front', left: 'armchair-side', right: 'armchair-side' },
  },
  'club-chair': {
    conceptId: 'furniture.chair.club',
    faces: { center: 'club-chair-top', front: 'club-chair-front', back: 'club-chair-front', left: 'club-chair-side', right: 'club-chair-side' },
  },
  clubChair: {
    conceptId: 'furniture.chair.club',
    faces: { center: 'club-chair-top', front: 'club-chair-front', back: 'club-chair-front', left: 'club-chair-side', right: 'club-chair-side' },
  },
  'single-sofa': {
    conceptId: 'furniture.chair.club',
    faces: { center: 'club-chair-top', front: 'club-chair-front', back: 'club-chair-front', left: 'club-chair-side', right: 'club-chair-side' },
  },
  singleSofa: {
    conceptId: 'furniture.chair.club',
    faces: { center: 'club-chair-top', front: 'club-chair-front', back: 'club-chair-front', left: 'club-chair-side', right: 'club-chair-side' },
  },
  'lounge-chair': {
    conceptId: 'furniture.chair.lounge',
    faces: { center: 'lounge-chair-top', front: 'lounge-chair-front', back: 'lounge-chair-front', left: 'lounge-chair-side', right: 'lounge-chair-side' },
  },
  loungeChair: {
    conceptId: 'furniture.chair.lounge',
    faces: { center: 'lounge-chair-top', front: 'lounge-chair-front', back: 'lounge-chair-front', left: 'lounge-chair-side', right: 'lounge-chair-side' },
  },
  'tub-chair': {
    conceptId: 'furniture.chair.lounge',
    faces: { center: 'lounge-chair-top', front: 'lounge-chair-front', back: 'lounge-chair-front', left: 'lounge-chair-side', right: 'lounge-chair-side' },
  },
  tubChair: {
    conceptId: 'furniture.chair.lounge',
    faces: { center: 'lounge-chair-top', front: 'lounge-chair-front', back: 'lounge-chair-front', left: 'lounge-chair-side', right: 'lounge-chair-side' },
  },
  'yoke-chair': {
    conceptId: 'furniture.chair.yoke-back',
    faces: { center: 'wood-chair-top', front: 'yoke-chair-front', back: 'yoke-chair-front', left: 'wood-chair-side', right: 'wood-chair-side' },
  },
  yokeChair: {
    conceptId: 'furniture.chair.yoke-back',
    faces: { center: 'wood-chair-top', front: 'yoke-chair-front', back: 'yoke-chair-front', left: 'wood-chair-side', right: 'wood-chair-side' },
  },
  'ladder-chair': {
    conceptId: 'furniture.chair.ladder-back',
    faces: { center: 'wood-chair-top', front: 'ladder-chair-front', back: 'ladder-chair-front', left: 'wood-chair-side', right: 'wood-chair-side' },
  },
  ladderChair: {
    conceptId: 'furniture.chair.ladder-back',
    faces: { center: 'wood-chair-top', front: 'ladder-chair-front', back: 'ladder-chair-front', left: 'wood-chair-side', right: 'wood-chair-side' },
  },
  monitor: {
    conceptId: 'electronics.monitor.stand',
    faces: { center: 'monitor-edge', front: 'monitor-screen', back: 'monitor-back', left: 'monitor-side', right: 'monitor-side' },
  },
  display: {
    conceptId: 'electronics.monitor.stand',
    faces: { center: 'monitor-edge', front: 'monitor-screen', back: 'monitor-back', left: 'monitor-side', right: 'monitor-side' },
  },
  tv: {
    conceptId: 'electronics.tv.wall',
    faces: { center: 'tv-screen' },
  },
  television: {
    conceptId: 'electronics.tv.wall',
    faces: { center: 'tv-screen' },
  },
  laptop: {
    conceptId: 'electronics.laptop.open',
    faces: { center: 'laptop-deck' },
  },
  keyboard: {
    conceptId: 'electronics.keyboard.deck',
    faces: { center: 'keyboard-keys' },
  },
  toilet: {
    conceptId: 'bathroom.toilet.block',
    faces: { center: 'toilet-lid', front: 'toilet-bowl', back: 'toilet-tank', left: 'toilet-side', right: 'toilet-side' },
  },
  drawers: {
    conceptId: 'furniture.drawers.tall',
    faces: { center: 'dresser-top', front: 'drawers-front', back: 'cabinet-side', left: 'cabinet-side', right: 'cabinet-side' },
  },
  tallboy: {
    conceptId: 'furniture.drawers.tall',
    faces: { center: 'dresser-top', front: 'drawers-front', back: 'cabinet-side', left: 'cabinet-side', right: 'cabinet-side' },
  },
  window: {
    conceptId: 'fixture.window.light',
    faces: { center: 'window-light' },
  },
  door: {
    conceptId: 'fixture.door.panel',
    faces: { center: 'door-panel' },
  },
  picture: {
    conceptId: 'fixture.picture.frame',
    faces: { center: 'picture-frame' },
  },
  sconce: {
    conceptId: 'fixture.sconce.glow',
    faces: { center: 'sconce-glow' },
  },
};

export function getFurnitureFaceCard(id) {
  return FURNITURE_FACE_CARDS[String(id || '').trim()] || null;
}
export function getFurnitureNet(type) {
  return FURNITURE_NETS[String(type || '').trim()] || null;
}

export function listFurnitureNetTypes() {
  return Object.keys(FURNITURE_NETS);
}
