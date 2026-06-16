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

import { scaleHex } from './polygonizer/vexar.js';

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
  };
}

// A mark → the list of [u0,u1,v0,v1] rectangles it covers. Mirrors partHit's
// geometry so the structural realizer agrees with sampleStickerCard. circle/poly
// are skipped here (facades don't use them in slice 1).
function partRects(p) {
  switch (p.kind) {
    case 'band': return [[0, 1, p.v - p.h / 2, p.v + p.h / 2]];
    case 'rect': return [[p.u, p.u + p.w, p.v - p.h / 2, p.v + p.h / 2]];
    case 'repeat': {
      const span = p.u1 - p.u0, gap = p.gap ?? 0;
      const w = p.w ?? (span - gap * (p.count - 1)) / p.count;
      const step = p.count > 1 ? (span - w) / (p.count - 1) : 0;
      return Array.from({ length: p.count }, (_, i) => {
        const a = p.u0 + i * step; return [a, a + w, p.v - p.h / 2, p.v + p.h / 2];
      });
    }
    case 'grid': {
      const stepU = (p.u1 - p.u0) / p.countU, stepV = (p.v1 - p.v0) / p.countV;
      const wU = p.wU ?? (stepU - (p.gapU ?? 0)), wV = p.wV ?? (stepV - (p.gapV ?? 0));
      const rects = [];
      for (let iv = 0; iv < p.countV; iv += 1) {
        for (let iu = 0; iu < p.countU; iu += 1) {
          const cu = p.u0 + (iu + 0.5) * stepU, cv = p.v0 + (iv + 0.5) * stepV;
          rects.push([cu - wU / 2, cu + wU / 2, cv - wV / 2, cv + wV / 2]);
        }
      }
      return rects;
    }
    default: return [];
  }
}

/**
 * Realize a card onto a planar quad → an array of flat-colored faces.
 * @param {number[][]} corners  the wall quad [c0,c1,c2,c3]; U=c1-c0 (width), V=c3-c0 (height)
 * @param {object} card         { base, parts:[…marks] } from buildFacadeCard
 * @param {object} [opts]
 * @param {number} [opts.lit=1]      Lambert factor for this face (baked into facet colors)
 * @param {number} [opts.relief=0.02] world-units to push mark facets proud of the base (avoids z-fight; >0 = real relief)
 * @param {boolean} [opts.includeBase=true] emit the base wall quad behind the marks
 * @returns {Array<{corners:number[][], fill:string}>}
 */
export function projectCardOntoQuad(corners, card, { lit = 1, relief = 0.02, includeBase = true } = {}) {
  const [c0, c1, c3] = [corners[0], corners[1], corners[3]];
  const U = sub(c1, c0), V = sub(c3, c0);
  const n = norm(cross(U, V));
  const at = (u, v, push) => add(add(add(c0, mul(U, u)), mul(V, v)), mul(n, push));
  const rect = (u0, u1, v0, v1, push) => [at(u0, v0, push), at(u1, v0, push), at(u1, v1, push), at(u0, v1, push)];

  const faces = [];
  if (includeBase) faces.push({ corners: [corners[0], corners[1], corners[2], corners[3]], fill: scaleHex(card.base, lit) });
  for (const part of card.parts) {
    const fill = scaleHex(part.fill, lit);
    for (const [u0, u1, v0, v1] of partRects(part)) {
      faces.push({ corners: rect(u0, u1, v0, v1, relief), fill });
    }
  }
  return faces;
}

/**
 * The World's card-realization stage (first-class): expand every scene face that
 * carries a surface `card` (+ `lit`) into flat-colored facets, passing untagged
 * faces through untouched. This is the one place the "detail-as-card → geometry"
 * principle is realized for WebGL; the CSS-3D emitter realizes the same cards as
 * gradients (facadeCss) and simply ignores the `card` field.
 *
 * @param {Array} faces  the assembled scene faces
 * @param {object} [opts]
 * @param {number} [opts.relief=0.05] world-units to push mark facets proud (the "flat balcony" dial)
 */
export function expandSurfaceCards(faces, { relief = 0.05 } = {}) {
  const out = [];
  for (const f of faces) {
    if (f && f.card) out.push(...projectCardOntoQuad(f.corners, f.card, { lit: f.lit ?? 1, relief }));
    else out.push(f);
  }
  return out;
}
