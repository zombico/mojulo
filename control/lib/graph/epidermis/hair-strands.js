/**
 * HAIR STRANDS — the texture a game's hair card draws (realistic laws 7: hair-depict.js stripMesh `card`): a page of fine
 * strands with ALPHA, so a card's edge is its strands' and not its polygon's. White, so the card's colour is the band's it
 * is painted in (the root darker than the tip: hair-depict.js HAIR_BANDS), times the strands' own small value spread.
 *
 * The page is `HAIR_CARD.cells` cells across, each its own lay: STRANDS strands a cell, each a line from the root down
 * the cell with a slow wave, its width tapering from `root` to `tip` pixels, its alpha a soft edge round it, ending at a
 * length of its own between `end` and 1 of the cell (a ragged cut, the card's last pixels open). Near the root the cell is
 * filled whole (`fill`), so a card never shows the head through where it leaves the cap.
 *
 * A DYE (`dye: { tint, grey }`) draws the hero's own strands on it: the card's colour is the hair's mean (its pigment
 * toward silver by the share gone grey, as the eye averages it at a distance), so a strand of pigment is that mean times
 * `tint` (linear, per channel: the pigment over the mean) and a grey strand is the mean itself; `grey` the share of strands
 * gone grey. Salt and pepper strand by strand, where the mean alone washed every strand to the same grey. No dye: white.
 *
 *   STRAND_PAGE                         the page's numbers
 *   strandPage({ w, h, cells, dye }) → { w, h, rgba: Uint8Array }   the page, rows top (the root) to bottom (the tip)
 *   strandCellUV(cell, [across, along], cells)   a card point's place on the page as [s, t] (t up, glTF's flip done by the
 *                                                 atlas that holds it)
 *   lashPage({ w, h }) → { w, h, rgba }           the LASH PAGE: a lash ribbon's cards' lashes (LASH_PAGE), its own strip
 *   lashCellUV(cell, [across, along])             a lash card point's place on it
 *   lockPage({ w, h }) → { w, h, rgba }           the LOCK PAGE: a lock mass's hair, opaque (LOCK_PAGE)
 *   lockCellUV(cell, [across, along])             a lock point's place on it
 *
 * Deterministic: integer-hash dice, no clock.
 */
import { HAIR_CARD } from './hair-depict.js';

export const STRAND_PAGE = Object.freeze({ strands: 14, root: 2.2, tip: 0.7, wave: 1.6, end: 0.72, fill: 0.06, value: [0.82, 1] });

// an integer hash in [0, 1)
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** The strand page: `cells` cells side by side, each `w / cells` pixels wide and `h` tall, rows from the root (y 0) to the
 * tip. RGBA, alpha the strands' cover. */
export function strandPage({ w = 512, h = 256, cells = HAIR_CARD.cells, dye = null } = {}) {
  const P = STRAND_PAGE, cw = w / cells, rgba = new Uint8Array(w * h * 4);
  for (let c = 0; c < cells; c++) {
    const strands = Array.from({ length: P.strands }, (_, i) => ({
      x: ((i + 0.5 + (hash(c, i, 1) - 0.5) * 0.7) / P.strands) * cw,
      phase: hash(c, i, 2) * Math.PI * 2, freq: 1.5 + hash(c, i, 3) * 2.5, len: P.end + (1 - P.end) * hash(c, i, 4),
      value: P.value[0] + (P.value[1] - P.value[0]) * hash(c, i, 5), grey: !!dye && hash(c, i, 6) < (dye.grey ?? 0),
    }));
    // (a strand's texel: its value, white; under a dye its pigment's tint unless it has gone grey)
    const texel = (S) => (!dye ? [S.value, S.value, S.value] : S.grey ? [S.value, S.value, S.value] : dye.tint.map((t) => toSrgb(Math.min(1, toLin(S.value) * t))));
    for (let y = 0; y < h; y++) {
      const t = (y + 0.5) / h;
      for (let px = 0; px < cw; px++) {
        const X = px + 0.5;
        let a = 0, v = null;
        for (const S of strands) {
          if (t > S.len) continue;
          const at = S.x + Math.sin(S.phase + t * S.freq * Math.PI) * P.wave, half = (P.root + (P.tip - P.root) * (t / S.len)) / 2;
          const d = Math.abs(X - at), cover = 1 - smooth(half - 0.5, half + 0.6, d);
          if (cover > a) { a = cover; v = S; }
        }
        // (the root filled whole, fading into the strands: the cell's darkest strand's colour)
        const f = 1 - smooth(P.fill * 0.5, P.fill, t);
        a = Math.max(a, f); if (f > 0 && v === null) v = { value: P.value[0], grey: false };
        const o = (y * w + Math.floor(c * cw + px)) * 4, g = v ? texel(v) : [0, 0, 0];
        rgba[o] = Math.round(255 * g[0]); rgba[o + 1] = Math.round(255 * g[1]); rgba[o + 2] = Math.round(255 * g[2]); rgba[o + 3] = Math.round(255 * a);
      }
    }
  }
  return { w, h, rgba };
}

/**
 * THE LASH PAGE (the lash ribbon, hero-head-layers.js lashRibbon): `cells` cells side by side, each `strands` lashes from a
 * solid root band (`fill` of its height: the lash line the ribbon's base draws) to their tips, thick at the root
 * (`root` of the cell's width) and tapering to `tip`, gathered in `clump`s toward their tips as wet or mascara'd lashes
 * do, each its own length between `end` and 1 of the cell (the middle's the longest). White: the card's colour is its
 * group's (`Lash`). A card's cell is LASH_CELL0 + its index, so the strand page's hair cards keep their cells.
 */
export const LASH_PAGE = Object.freeze({ cells: 4, strands: 9, root: 0.06, tip: 0.012, clump: 3, pull: 0.45, end: 0.55, fill: 0.07, w: 512, h: 128 });
export const LASH_CELL0 = 100;
export function lashPage({ w = LASH_PAGE.w, h = LASH_PAGE.h } = {}) {
  const P = LASH_PAGE, cw = w / P.cells, rgba = new Uint8Array(w * h * 4);
  for (let c = 0; c < P.cells; c++) {
    const lashes = Array.from({ length: P.strands }, (_, i) => {
      const x = ((i + 0.5 + (hash(c, i, 11) - 0.5) * 0.5) / P.strands) * cw, k = Math.floor((i * P.clump) / P.strands), cx = ((k + 0.5) / P.clump) * cw;
      const mid = 1 - Math.abs((i + 0.5) / P.strands - 0.5) * 2;
      return { x, cx, len: P.end + (1 - P.end) * (0.4 * mid + 0.6 * hash(c, i, 12)) };
    });
    for (let y = 0; y < h; y++) {
      const t = (y + 0.5) / h;
      for (let px = 0; px < cw; px++) {
        const X = px + 0.5;
        let a = 0;
        for (const L of lashes) {
          if (t > L.len) continue;
          const u = t / L.len, at = L.x + (L.cx - L.x) * P.pull * u * u, half = ((P.root + (P.tip - P.root) * u) * cw) / 2;
          a = Math.max(a, 1 - smooth(half - 0.5, half + 0.7, Math.abs(X - at)));
        }
        a = Math.max(a, 1 - smooth(P.fill * 0.6, P.fill, t));
        const o = (y * w + Math.floor(c * cw + px)) * 4, v = Math.round(255 * (0.86 + 0.14 * hash(c, px, y)));
        rgba[o] = rgba[o + 1] = rgba[o + 2] = a > 0 ? v : 0; rgba[o + 3] = Math.round(255 * a);
      }
    }
  }
  return { w, h, rgba };
}
/** A lash card point's [s, t] on the lash page (t up), as strandCellUV's on the strand page. */
export function lashCellUV(cell, [across, along]) {
  const inset = 0.03;
  return [(cell + inset + across * (1 - 2 * inset)) / LASH_PAGE.cells, 1 - Math.min(0.999, Math.max(0.001, along))];
}

/**
 * THE LOCK PAGE (hair-locks.js `uv`: a lock's tube round its ring and along its spine): the HAIR a lock's mass is drawn
 * with, where it was one flat colour, opaque. `cells` cells, each `strands` strands across it, each its own value, drawn
 * with a slow wave down the cell, over a soft band of the lock's own light and shade across it; darker at the root (the
 * mass's depth where it leaves the head). White about 1: the face's colour is its group's (`Hair`, `Beard`) times it.
 * A lock's cell is LOCK_CELL0 + its index.
 */
export const LOCK_PAGE = Object.freeze({ cells: 4, strands: 64, value: [0.8, 1], band: 0.05, wave: 1.5, root: 0.18, w: 512, h: 128 });
export const LOCK_CELL0 = 200;
export function lockPage({ w = LOCK_PAGE.w, h = LOCK_PAGE.h } = {}) {
  const P = LOCK_PAGE, cw = w / P.cells, rgba = new Uint8Array(w * h * 4);
  for (let c = 0; c < P.cells; c++) for (let y = 0; y < h; y++) {
    const t = (y + 0.5) / h, root = 1 - 0.22 * (1 - smooth(0, P.root, t));
    for (let px = 0; px < cw; px++) {
      const x = (px + 0.5) / cw, sx = x * P.strands + Math.sin(t * Math.PI * 2 + hash(c, Math.floor(x * 6), 21) * 6) * P.wave * 0.25, k = Math.floor(sx), f = sx - k;
      // (a strand's value, its edges a touch darker: the gap between two strands)
      const v = P.value[0] + (P.value[1] - P.value[0]) * hash(c, k, 22) * (0.75 + 0.25 * Math.sin(Math.PI * f));
      const band = 1 + P.band * Math.sin(x * Math.PI * 2 * 1.5 + hash(c, 0, 23) * 6);
      const g = Math.round(255 * Math.min(1, v * band * root)), o = (y * w + Math.floor(c * cw + px)) * 4;
      rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}
/** A lock point's [s, t] on the lock page (t up). */
export function lockCellUV(cell, [across, along]) {
  return [(cell + 0.02 + across * 0.96) / LOCK_PAGE.cells, 1 - Math.min(0.999, Math.max(0.001, along))];
}

/** A card point's [s, t] on the strand page (t up): its cell's column by `across`, its row by `along` (root at the top). */
export function strandCellUV(cell, [across, along], cells = HAIR_CARD.cells) {
  const inset = 0.04;
  return [(cell + inset + across * (1 - 2 * inset)) / cells, 1 - Math.min(0.999, Math.max(0.001, along))];
}
