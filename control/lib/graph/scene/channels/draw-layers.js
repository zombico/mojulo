import { safeJson } from '../emit-util.js';

// In-page script: the DRAW LAYERS (opt-in by face data: a face `layer`, station-loft-shade.js drawLayer) — the stencil
// rules a character-lit figure is drawn with, on its static faces and on its rig preview's moving parts. The emitter
// splits each render group by layer (`<group>:<layer>`: body, body:hair, body:through, body:veil) and asks for a
// stencil buffer (WebGLRenderer { stencil: true }) only on a page carrying a layer; a page without one emits ZERO bytes
// here and its renderer line is unchanged.
// Two stencil bits, both written only where a fill passes the depth test:
//   THRU (1) — a `through` part (the brows, the lid bands) is the nearest surface drawn so far at the pixel;
//   HAIR (2) — the nearest fill at the pixel is hair (a `hair` or a `veil` face).
// The FILLS (every opaque render group; the rig preview's parts take the same rules):
//   no layer   order 0 — clears HAIR (only with the hair rule on: a nearer body surface takes the pixel back from hair
//              drawn behind it, whichever of the two drew first);
//   'hair'     order 0 — sets HAIR;
//   'through'  order 1 — after every order-0 fill, so it is depth-tested against the skull, the face and every lock
//              that is not the veil: sets THRU and clears HAIR where it wins (from behind, the skull hides it and it
//              sets nothing; in profile a side lock hides it);
//   'veil'     order 2 — skips every THRU pixel (the brow shows through the fringe), sets HAIR where it wins.
// The OUTLINE HULLS (toon-ink.js; the rig preview's `__rpInk`): a 'hair' hull draws after every fill (order 3) and
// only where HAIR is clear — the hair outline never draws over hair (no seam between two locks; the line stays where a
// lock meets the face or the background); a 'veil' hull where both bits are clear — nor over the brow it lets through.
// Every other hull keeps its draw (order −1, no stencil test), and a `through` face takes no outline.
// `__mojLayers` is the probe seam: { hair: the hair rule is on, groups: the layered render groups }.
// BAKE twin: the GLB's baked ink (ink-geometry.js inkBuried) cannot stencil — see its header for what it does instead.
export const DRAW_LAYER_KEYS = Object.freeze(['hair', 'through', 'veil']);
/** the render group a face lands in: its group, split by its draw layer (a face without one keeps its group) */
export const drawLayerGroup = (f) => (f.group || 'static') + (DRAW_LAYER_KEYS.includes(f.layer) ? `:${f.layer}` : '');

export function drawLayersScript({ hair = false, groups = [] } = {}) {
  return `
// --- draw layers (opt-in face \`layer\`): brows and lids through the fringe; the hair outline never over hair ---
const __LAYERS = ${safeJson({ hair: !!hair, groups })};
const __LAYER_ORDER = { through: 1, veil: 2 };
function __layerFill(mat, layer) {   // a fill's stencil rule → its render order
  if (!layer && !__LAYERS.hair) return 0;
  mat.stencilWrite = true; mat.stencilFunc = THREE.AlwaysStencilFunc; mat.stencilFuncMask = 0xff;
  mat.stencilFail = THREE.KeepStencilOp; mat.stencilZFail = THREE.KeepStencilOp; mat.stencilZPass = THREE.ReplaceStencilOp;
  if (layer === 'through') { mat.stencilRef = 1; mat.stencilWriteMask = 3; }                                                      // THRU set, HAIR cleared
  else if (layer === 'veil') { mat.stencilFunc = THREE.NotEqualStencilFunc; mat.stencilRef = 3; mat.stencilFuncMask = 1; mat.stencilWriteMask = 2; }   // not over THRU; HAIR set
  else if (layer === 'hair') { mat.stencilRef = 2; mat.stencilWriteMask = 2; }                                                     // HAIR set
  else { mat.stencilRef = 0; mat.stencilWriteMask = 2; }                                                                             // HAIR cleared
  return __LAYER_ORDER[layer] || 0;
}
function __layerHull(mat, layer) {   // an outline hull's stencil test → true when it must draw after every fill
  if (layer !== 'hair' && layer !== 'veil') return false;
  mat.stencilWrite = true; mat.stencilWriteMask = 0; mat.stencilFunc = THREE.EqualStencilFunc; mat.stencilRef = 0; mat.stencilFuncMask = layer === 'veil' ? 3 : 2;
  mat.stencilFail = THREE.KeepStencilOp; mat.stencilZFail = THREE.KeepStencilOp; mat.stencilZPass = THREE.KeepStencilOp;
  return true;
}
for (const grp of GROUPS) {
  const m = meshes[grp.name];
  if (!m || m.material.transparent) continue;
  const order = __layerFill(m.material, grp.layer);
  if (order) m.renderOrder = order;
}
window.__mojLayers = __LAYERS;`;
}
