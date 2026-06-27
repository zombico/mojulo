/**
 * facade-card — express a building facade as a surface "mark card" (the same
 * vocabulary the aircraft livery uses: band / rect / repeat / grid / circle in
 * (u,v) ∈ [0,1]² surface space), and realize that card into flat-colored facets
 * for the WebGL World.
 *
 * This is the unification: a plane's livery windows are a `repeat` mark; a
 * building's windows are a `grid` mark. Both are "marks on a surface." The CSS-3D
 * renderer keeps painting the facade as a gradient (facadeCss, unchanged); the
 * World renderer realizes the SAME card as geometry via projectCardOntoQuad —
 * giving the windows their fidelity the way the airplane already gets it
 * (detail-as-geometry, not detail-as-CSS-texture).
 *
 * The realizer is STRUCTURAL, not sampling: it emits the base wall quad plus one
 * facet per mark rectangle (≈ bays×floors facets per wall), so it stays cheap and
 * grid-aligned (no aliasing, no sampling-grid explosion).
 *
 * Color contract mirrors facadeCss: pane = scaleHex(glass, glassVar*lit),
 * base/structure = scaleHex(frame, lit). glassVar is baked into the card; `lit`
 * (the face's Lambert factor) is applied at projection so the four walls shade
 * differently from one shared card.
 */

import { scaleHex, litFactor } from './polygonizer/vexar.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// A dark recessed-glass color for brick/masonry punched windows (the panes read
// against the brick body, mirroring facadeHtml's child-window divs).
const BRICK_WINDOW = '#2a2f36';

// Per-rhythm gap ratios (fraction of one cell that reads as structure rather than
// glass), so the card differentiates the facade programs instead of always being a
// uniform grid: piers = thick vertical structure, banded = thick spandrels, punched
// = discrete windows in more wall. Mirrors the visual intent of facadeCss's rhythms.
const RHYTHM = {
  grid:    { gu: 0.16, gv: 0.14 },
  curtain: { gu: 0.12, gv: 0.10 },
  banded:  { gu: 0.06, gv: 0.34 },   // horizontal ribbon windows, strong floor spandrels
  pier:    { gu: 0.40, gv: 0.12 },   // dominant vertical pilasters
  punched: { gu: 0.34, gv: 0.34 },   // discrete masonry windows, more wall between
};

/**
 * Build a facade mark-card from the facade descriptor + floor/bay counts the city
 * generator already computes. Material- and rhythm-aware:
 *   • glass  — tinted glass panes (scaleHex(glass, glassVar)) over a structure
 *              (frame) base; the gaps read as mullions + spandrels.
 *   • brick  — dark recessed windows over the brick body (glass field is the brick
 *              color); the World analogue of facadeHtml's punched child windows.
 * The rhythm varies the gap ratios (grid / curtain / banded / pier / punched). The
 * color contract matches facadeCss; `lit` is applied later by the realizer.
 */
export function buildFacadeCard(facade, floors, bays) {
  const F = Math.max(2, floors), B = Math.max(1, bays);
  const u0 = 0.04, u1 = 0.96, v0 = 0.06, v1 = 0.97;
  const stepU = (u1 - u0) / B, stepV = (v1 - v0) / F;
  const brick = facade.material === 'brick';
  const g = RHYTHM[facade.rhythm] || RHYTHM.grid;
  const base = brick ? facade.glass : facade.frame;                       // brick body / curtainwall structure
  const pane = brick ? BRICK_WINDOW : scaleHex(facade.glass, facade.glassVar ?? 1);
  const gu = brick ? 0.36 : g.gu, gv = brick ? 0.34 : g.gv;
  return {
    id: 'facade', surface: 'flat', wrap: null, base,
    parts: [
      {
        kind: 'grid', role: 'panes', fill: pane,
        u0, u1, v0, v1, countU: B, countV: F,
        gapU: stepU * gu, gapV: stepV * gv,
        r: brick ? stepV * 0.18 : 0,                                      // brick windows read slightly arched (sampler path)
      },
    ],
    // World "shirt/finband" realizer hints (consumed by projectCardOntoQuad; the
    // CSS-3D path ignores them and paints facadeCss). bodyHex = the recessed sheet
    // (tinted glass, or dark window for brick); frameHex = the proud structure
    // (mullions, or the brick body for a brick wall — the masonry IS the proud shirt).
    material: brick ? 'brick' : 'glass',
    rhythm: facade.rhythm || 'grid',
    bodyHex: brick ? BRICK_WINDOW : pane,
    frameHex: brick ? facade.glass : facade.frame,
    floors: F, bays: B,
  };
}

// Per-rhythm bar geometry for the shirt realizer. fu/fv = bar width as a fraction of
// one cell (vertical pier / horizontal spandrel); us/vs thin the MINOR axis (draw
// every us-th pier / vs-th spandrel). Mirrors facadeCss's rhythm intent — "which bars
// dominate" — so the World geometry reads the same program as the CSS gradient.
const SHIRT_GAP = {
  grid:    { fu: 0.16, fv: 0.14, us: 1, vs: 1 },
  curtain: { fu: 0.10, fv: 0.09, us: 1, vs: 1 },   // slender curtainwall frame
  banded:  { fu: 0.07, fv: 0.34, us: 2, vs: 1 },   // ribbon windows: fat spandrels, sparse thin piers
  pier:    { fu: 0.40, fv: 0.12, us: 1, vs: 2 },   // dominant pilasters
  punched: { fu: 0.30, fv: 0.30, us: 1, vs: 1 },   // discrete windows in more wall
};

// Planar wall basis from a quad: origin + unit width/height axes + outward normal.
function wallBasis(corners) {
  const c0 = corners[0], U = sub(corners[1], c0), V = sub(corners[3], c0);
  const Ulen = Math.hypot(...U) || 1, Vlen = Math.hypot(...V) || 1;
  return { c0, uHat: mul(U, 1 / Ulen), vHat: mul(V, 1 / Vlen), n: norm(cross(U, V)), Ulen, Vlen };
}

// One proud "bar" with real depth: the proud outer face + two return cheeks dropping
// back to the body sheet. The cheeks take their OWN side-normal Lambert (via the scene
// light), so one cheek catches light and the other falls into shadow — that directional
// shading is what reads as solid mass (concrete mullion / brick fin), not a flat strip.
// short = 'u' (vertical bar, cheeks face ±u) | 'v' (horizontal bar, cheeks face ±v).
// skipCheek (-1 | 0 | +1) omits the return cheek on that side of the SHORT axis: the
// top/bottom boundary spandrels (v=Vlen / v=0) would otherwise emit a horizontal cheek
// coplanar with the box's roof cap / ground plane → z-fighting. The cap already seals
// that edge, so the cheek is redundant; dropping it kills the shimmer.
function pushBar(out, B, u0, u1, v0, v1, proud, short, hex, lit, light, skipCheek = 0) {
  const { c0, uHat, vHat, n } = B;
  const at = (u, v, p) => add(add(add(c0, mul(uHat, u)), mul(vHat, v)), mul(n, p));
  const inn = (p) => [p[0] - n[0] * proud, p[1] - n[1] * proud, p[2] - n[2] * proud];
  const o00 = at(u0, v0, proud), o10 = at(u1, v0, proud), o11 = at(u1, v1, proud), o01 = at(u0, v1, proud);
  out.push({ corners: [o00, o10, o11, o01], fill: scaleHex(hex, lit) });                 // proud face (wall normal → wall lit)
  const wallLam = light ? Math.max(1e-3, litFactor(n, light)) : 1;
  const cheek = (a, b, axis, sign) => {
    const sn = mul(axis, sign);
    // keep cheeks consistent with the wall's baked darkening: scale the side-normal
    // Lambert by (lit / wallLambert) so gravity/tint adjustments carry through. No
    // light (direct/test calls) → a fixed asymmetry so bars still read as mass.
    const f = light ? litFactor(sn, light) * (lit / wallLam) : lit * (sign > 0 ? 0.92 : 0.66);
    out.push({ corners: [a, b, inn(b), inn(a)], fill: scaleHex(hex, f) });
  };
  if (short === 'u') { cheek(o00, o01, uHat, -1); cheek(o10, o11, uHat, 1); }
  else {
    if (skipCheek !== -1) cheek(o00, o10, vHat, -1);
    if (skipCheek !== 1) cheek(o01, o11, vHat, 1);
  }
}

// Glass/curtainwall "shirt": frame bars (piers + spandrels) floated proud of the glass
// body sheet. The two END piers extend `relief` past the wall edges so adjacent walls'
// frames overlap at the building corner (the per-wall corner seal).
function realizeShirt(out, B, card, lit, relief, light) {
  const { Ulen, Vlen } = B;
  const F = Math.max(2, card.floors || 4), Bn = Math.max(1, card.bays || 3);
  const cellU = Ulen / Bn, cellV = Vlen / F;
  const g = SHIRT_GAP[card.rhythm] || SHIRT_GAP.grid;
  const mwU = Math.max(0.03, Math.min(cellU * 0.8, cellU * g.fu));
  const mwV = Math.max(0.03, Math.min(cellV * 0.8, cellV * g.fv));
  for (let i = 0; i <= Bn; i += 1) {                              // vertical piers
    if (i % g.us !== 0 && i !== Bn) continue;
    const c = i * cellU;
    let u0, u1;
    if (i === 0) { u0 = -relief; u1 = mwU; }                      // extend past start → corner overlap
    else if (i === Bn) { u0 = Ulen - mwU; u1 = Ulen + relief; }   // extend past end → corner overlap
    else { u0 = Math.max(0, Math.min(c - mwU / 2, Ulen - mwU)); u1 = u0 + mwU; }
    pushBar(out, B, u0, u1, 0, Vlen, relief, 'u', card.frameHex, lit, light);
  }
  // Spandrels sit a touch SHALLOWER than the piers (relief*0.7 vs relief). Otherwise every
  // pier×spandrel crossing is two coplanar faces at the same depth → z-fighting (the grid
  // shimmer). Staggering the depth makes the mullion piers read as the dominant proud grid
  // with the floor bands set just behind — and the crossings stop fighting.
  const spandrelProud = relief * 0.7;
  for (let j = 0; j <= F; j += 1) {                               // horizontal spandrels
    if (j % g.vs !== 0 && j !== F) continue;
    const v0 = Math.max(0, Math.min(j * cellV - mwV / 2, Vlen - mwV));
    const skip = j === 0 ? -1 : (j === F ? 1 : 0);                // boundary cheek sits in the roof/floor plane → drop it
    pushBar(out, B, 0, Ulen, v0, v0 + mwV, spandrelProud, 'v', card.frameHex, lit, light, skip);
  }
}

// Brick "fin-band" (the 1970s institutional read): three depth layers over the dark
// recessed body — fine vertical fins set back into the recess, fat brick spandrels +
// structural piers at the wall face (deeper, so the spandrel's down-cheek reads as the
// hard overhang shadow at the top of each window band). Brick stands proud of the glass.
function realizeFinband(out, B, card, lit, relief, light) {
  const { Ulen, Vlen } = B;
  const F = Math.max(2, card.floors || 4), Bn = Math.max(1, card.bays || 3);
  const cellU = Ulen / Bn, cellV = Vlen / F;
  // brick stands much deeper than the fins → a layered recess whose spandrel down-cheek
  // reads as the hard overhang shadow. Decoupled from the (shallower) glass-shirt relief.
  // piers (rb) are the deepest/frontmost layer; spandrels sit just behind them (rb*0.88) so
  // the pier×spandrel crossings are not coplanar (z-fight); fins are shallower still.
  const rb = relief * 2.4, spandrelProud = relief * 2.4 * 0.88, finProud = relief * 1.1;
  // fins are a FIXED FINE PITCH (world-spaced, not per-bay) — the reference's defining
  // read: many slender fins splitting each band into tall narrow slots, regardless of
  // how wide the bays are. Floored so small walls don't over-subdivide.
  const finPitch = Math.max(0.34, cellU / 6), finW = Math.min(finPitch * 0.34, 0.12);
  const spH = cellV * 0.44, pierW = Math.min(cellU * 0.5, 0.42);
  for (let u = finPitch * 0.5; u < Ulen - finW; u += finPitch)   // 1) continuous fine fins, set back
    pushBar(out, B, u, u + finW, 0, Vlen, finProud, 'u', card.frameHex, lit, light);
  for (let j = 0; j <= F; j += 1) {                              // 2) fat brick spandrels (overhang shadow)
    const v0 = Math.max(0, Math.min(j * cellV - spH / 2, Vlen - spH));
    const skip = j === 0 ? -1 : (j === F ? 1 : 0);              // boundary cheek sits in the roof/floor plane → drop it
    pushBar(out, B, 0, Ulen, v0, v0 + spH, spandrelProud, 'v', card.frameHex, lit, light, skip);
  }
  // 3) a FEW structural brick piers: building ends (extended past edges → corner seal) +
  // uniform interior columns every ~2.4 world units, like the reference's poured piers.
  const nP = Math.max(2, Math.round(Ulen / 2.4));
  for (let k = 0; k <= nP; k += 1) {
    let u0, u1;
    if (k === 0) { u0 = -relief; u1 = pierW; }
    else if (k === nP) { u0 = Ulen - pierW; u1 = Ulen + relief; }
    else { u0 = Math.max(0, Math.min((k / nP) * Ulen - pierW / 2, Ulen - pierW)); u1 = u0 + pierW; }
    pushBar(out, B, u0, u1, 0, Vlen, rb, 'u', card.frameHex, lit, light);
  }
}

/**
 * Realize a facade card onto a planar wall quad → flat-colored facets.
 *
 * The "shirt" model: the structure (mullion frame, or the brick body itself) is a
 * self-shading lattice of bars whose gaps are the windows, over a body SHEET (recessed
 * glass / dark brick window). The lattice is INSET so its proud outer face lands on the
 * wall quad (the box footprint) and the window body recesses INWARD by the shirt's
 * thickness — the shirt no longer grows the building past its surface-area budget, it
 * carves the windows into the existing footprint. The ENTIRE recessed face is painted the
 * window/body color, so every gap in the holey shirt reads as window with no per-window
 * recess geometry. Glass walls get a frame lattice; brick walls get the three-layer
 * fin-band. Per-wall corner overlap keeps the building corners sealed without box-level
 * knowledge.
 *
 * @param {number[][]} corners  the wall quad [c0,c1,c2,c3]; U=c1-c0 (width), V=c3-c0 (height)
 * @param {object} card         from buildFacadeCard (needs material/rhythm/bodyHex/frameHex/floors/bays)
 * @param {object} [opts]
 * @param {number} [opts.lit=1]       baked Lambert factor for this wall
 * @param {number} [opts.relief=0.12] world-units of shirt thickness (recess depth into the wall)
 * @param {boolean} [opts.includeBase=true] emit the recessed window body sheet behind the lattice
 * @param {object} [opts.light]       scene light (makeLight) → return cheeks self-shade
 * @returns {Array<{corners:number[][], fill:string}>}
 */
export function projectCardOntoQuad(corners, card, { lit = 1, relief = 0.12, includeBase = true, light = null } = {}) {
  const brick = card.material === 'brick';
  // The shirt stands proud by up to `maxProud` (brick fins/spandrels go deeper than the
  // glass frame). Inset the whole realization inward by that depth so the FRONTMOST proud
  // face lands on the wall quad: the building's outer footprint stays == the box footprint
  // (the surface-area budget is preserved), and the windows recess INTO the wall instead of
  // bulging the building outward.
  const maxProud = brick ? relief * 2.4 : relief;
  const n = wallBasis(corners).n;
  const inset = corners.map((p) => [p[0] - n[0] * maxProud, p[1] - n[1] * maxProud, p[2] - n[2] * maxProud]);
  const B = wallBasis(inset);
  const out = [];
  // Paint the ENTIRE recessed face the window/body color; the holey shirt overlays it, so
  // each lattice gap is window — no per-window recess facets needed.
  if (includeBase) out.push({ corners: [inset[0], inset[1], inset[2], inset[3]], fill: scaleHex(card.bodyHex ?? card.base, lit) });
  if (brick) realizeFinband(out, B, card, lit, relief, light);
  else realizeShirt(out, B, card, lit, relief, light);
  return out;
}

/**
 * The World's card-realization stage (first-class): expand every scene face that
 * carries a surface `card` (+ `lit`) into flat-colored facets, passing untagged faces
 * through untouched. This is the one place the "detail-as-card → geometry" principle is
 * realized for WebGL; the CSS-3D emitter realizes the same cards as gradients (facadeCss)
 * and ignores the `card` field.
 *
 * @param {Array} faces  the assembled scene faces
 * @param {object} [opts]
 * @param {number} [opts.relief=0.12] world-units of shirt thickness (recess depth into the wall)
 * @param {object} [opts.light]       scene light (makeLight) → facade bars self-shade
 */
export function expandSurfaceCards(faces, { relief = 0.12, light = null } = {}) {
  const out = [];
  for (const f of faces) {
    if (f && f.card) out.push(...projectCardOntoQuad(f.corners, f.card, { lit: f.lit ?? 1, relief, light }));
    else out.push(f);
  }
  return out;
}
