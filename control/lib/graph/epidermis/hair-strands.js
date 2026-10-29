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

/** A card point's [s, t] on the strand page (t up): its cell's column by `across`, its row by `along` (root at the top). */
export function strandCellUV(cell, [across, along], cells = HAIR_CARD.cells) {
  const inset = 0.04;
  return [(cell + inset + across * (1 - 2 * inset)) / cells, 1 - Math.min(0.999, Math.max(0.001, along))];
}
