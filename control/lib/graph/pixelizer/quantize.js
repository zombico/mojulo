/**
 * quantize — posture 2 of the dream loop, taken (P8): the
 * deterministic pixel→cell intake. A painted PNG is already pixels;
 * this module bakes them into recipe rasters without redrawing —
 * `quantizeRgba(raw, opts)` is a PURE function (same bytes + same
 * params → same cells, forever), which is what keeps machine-baked
 * cells sovereign: the recipe stays re-derivable from the archived
 * source, carried with dream-audit-style provenance by the caller.
 *
 * Three primitives:
 *  - buildPalette      — deterministic median-cut to the register
 *                        budget (lexicographic tie-breaks, no dice)
 *  - quantizeRgba      — box-filter downsample to the cell grid +
 *                        nearest-color mapping; optional background
 *                        knockout to transparent
 *  - diffRasters       — the sub-cel extractor: two rasters on the
 *                        same grid+palette → the minimal bbox overlay
 *                        sprite of changed cells (unchanged cells stay
 *                        transparent) + its placement offset. This is
 *                        how a worker's meru-locked face variants
 *                        become blink/mouth cels with coordinates for
 *                        free — the edit model's localized change
 *                        mapped onto the sub-cel economy.
 *
 * The module is dependency-free: it takes raw RGBA (Uint8Array/Buffer,
 * 4 bytes per pixel). PNG decoding lives with the caller (sharp in the
 * spikes). Doctrine: quantization recovers LIKENESS; the palette
 * curation, region boundaries, animation timing, and repair passes
 * stay agent-side. See pixelizer.plan.md.
 */

// mirrors cutscene.js's cell alphabet: 61 nameable palette slots
const CELL_CHARS = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Palette index (1-based) → cell char; 0 is transparent '.'. */
export function cellChar(index) {
  return index === 0 ? '.' : CELL_CHARS[index - 1];
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/**
 * Deterministic median-cut. `colors` is a list of [r,g,b,count]
 * samples; returns ≤ budget palette colors as [r,g,b] triples,
 * count-weighted averages per box. Boxes split on their widest
 * channel at the count-median; all orderings are total (channel
 * value, then lexicographic rgb) so ties cannot wobble the result.
 */
export function buildPalette(colors, budget) {
  if (!colors.length) return [];
  const boxes = [colors.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])];
  while (boxes.length < budget) {
    // split the box with the largest (range × count) — biggest visual win first
    let bestIdx = -1;
    let bestScore = 0;
    let bestChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255;
        let hi = 0;
        let count = 0;
        for (const c of box) {
          if (c[ch] < lo) lo = c[ch];
          if (c[ch] > hi) hi = c[ch];
          count += c[3];
        }
        const score = (hi - lo) * count;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
          bestChannel = ch;
        }
      }
    });
    if (bestIdx === -1) break;
    const box = boxes[bestIdx];
    const ch = bestChannel;
    box.sort((a, b) => a[ch] - b[ch] || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const total = box.reduce((n, c) => n + c[3], 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i][3];
      if (acc * 2 >= total) { cut = i + 1; break; }
      cut = i + 1;
    }
    boxes.splice(bestIdx, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const c of box) { r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; n += c[3]; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}

function nearest(palette, r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Box-filter the source RGBA down to the cell grid, then map each
 * cell to the palette. Pure.
 *
 * opts: {
 *   grid: [gw, gh]                 target size in cells (required)
 *   budget?: number                palette budget (default 15); ignored
 *                                  when `palette` is given
 *   palette?: ['#rrggbb', ...]     pin a shared palette (variants must
 *                                  quantize against the base's palette
 *                                  so cell diffs mean pixel change,
 *                                  not palette drift)
 *   transparent?: { color: '#rrggbb', tol?: number }
 *                                  knock cells near this color out to
 *                                  '.' (background removal)
 * }
 * → { size, palette, cells } — validateRaster-compatible.
 */
function boxSamples(raw, width, height, gw, gh, transparent) {
  const tCol = transparent ? [
    parseInt(transparent.color.slice(1, 3), 16),
    parseInt(transparent.color.slice(3, 5), 16),
    parseInt(transparent.color.slice(5, 7), 16),
  ] : null;
  const tTol = transparent?.tol ?? 24;
  const samples = new Array(gw * gh).fill(null);
  for (let cy = 0; cy < gh; cy++) {
    const y0 = Math.floor((cy * height) / gh);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / gh));
    for (let cx = 0; cx < gw; cx++) {
      const x0 = Math.floor((cx * width) / gw);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / gw));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * width + x) * 4;
          if (raw[o + 3] < 128) continue;
          r += raw[o];
          g += raw[o + 1];
          b += raw[o + 2];
          n++;
        }
      }
      if (!n) continue;
      const avg = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
      if (tCol && Math.abs(avg[0] - tCol[0]) <= tTol && Math.abs(avg[1] - tCol[1]) <= tTol && Math.abs(avg[2] - tCol[2]) <= tTol) continue;
      samples[cy * gw + cx] = avg;
    }
  }
  return samples;
}

function paletteFromSampleSets(sampleSets, budget) {
  const byColor = new Map();
  for (const samples of sampleSets) {
    for (const s of samples) {
      if (!s) continue;
      const key = (s[0] << 16) | (s[1] << 8) | s[2];
      byColor.set(key, (byColor.get(key) || 0) + 1);
    }
  }
  const colors = [...byColor.entries()].map(([key, count]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255, count]);
  return buildPalette(colors, budget);
}

/**
 * A shared palette over a SET of frames (base + variants), so a color
 * only a variant introduces (a tongue, a glow) still earns a slot.
 * Frames are {data, width, height}; same box-filter as quantizeRgba.
 */
export function jointPalette(frames, { grid: [gw, gh], budget = 15, transparent } = { grid: [0, 0] }) {
  const sets = frames.map((f) => boxSamples(f.data, f.width, f.height, gw, gh, transparent));
  return paletteFromSampleSets(sets, budget).map(hex);
}

export function quantizeRgba(raw, width, height, opts) {
  const [gw, gh] = opts.grid;
  const budget = opts.budget ?? 15;
  const samples = boxSamples(raw, width, height, gw, gh, opts.transparent);

  const palette = opts.palette
    ? opts.palette.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])
    : paletteFromSampleSets([samples], budget);

  const cells = [];
  for (let cy = 0; cy < gh; cy++) {
    let row = '';
    for (let cx = 0; cx < gw; cx++) {
      const s = samples[cy * gw + cx];
      row += s ? cellChar(nearest(palette, s[0], s[1], s[2]) + 1) : '.';
    }
    cells.push(row);
  }
  return { size: [gw, gh], palette: palette.map(hex), cells };
}

/**
 * The sub-cel extractor. Both rasters must share size and palette
 * (quantize the variant with `palette: base.palette`). Returns null
 * when nothing changed, else:
 *   { cell: [x, y], sprite: { size, palette, cells } }
 * — the minimal bounding box of changed cells as an overlay sprite
 * (unchanged cells transparent), plus where to place it relative to
 * the base raster's origin. changedRatio reports alignment health:
 * meru-locked variants change a few percent; a large ratio means the
 * source pair drifted and the cel is untrustworthy.
 */
export function diffRasters(base, variant, { tolerance = 0 } = {}) {
  const [w, h] = base.size;
  // deep registers make palettes fine-grained enough that generation
  // noise lands on *different-but-indistinguishable* entries; cells
  // whose colors sit within `tolerance` (RGB distance) count as same
  const rgb = base.palette.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  const tolSq = tolerance * tolerance;
  const idx = (ch) => (ch === '.' ? -1 : CELL_CHARS.indexOf(ch));
  const same = (a, b) => {
    if (a === b) return true;
    const ia = idx(a);
    const ib = idx(b);
    if (ia < 0 || ib < 0) return false; // transparent vs painted is always a change
    const A = rgb[ia];
    const B = rgb[ib];
    return (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2 <= tolSq;
  };
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let changed = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (same(base.cells[y][x], variant.cells[y][x])) continue;
      changed++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const cells = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) {
      row += same(base.cells[y][x], variant.cells[y][x]) ? '.' : variant.cells[y][x];
    }
    cells.push(row);
  }
  return {
    cell: [x0, y0],
    changedRatio: changed / (w * h),
    sprite: { size: [x1 - x0 + 1, y1 - y0 + 1], palette: variant.palette, cells },
  };
}

/**
 * Pad diff-extracted cels onto a shared bbox so they can ride one
 * placement's sprite track (variants must share the base size).
 * Takes [{cell, sprite}, ...], returns { cell, sprites: [...] } on the
 * union box, plus an all-transparent blank of the same size (the
 * "off" state — e.g. eyes-open when the cels paint closed lids).
 */
export function unionCels(cels) {
  const x0 = Math.min(...cels.map((c) => c.cell[0]));
  const y0 = Math.min(...cels.map((c) => c.cell[1]));
  const x1 = Math.max(...cels.map((c) => c.cell[0] + c.sprite.size[0]));
  const y1 = Math.max(...cels.map((c) => c.cell[1] + c.sprite.size[1]));
  const w = x1 - x0;
  const h = y1 - y0;
  const sprites = cels.map(({ cell, sprite }) => {
    const cells = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        const sx = x - (cell[0] - x0);
        const sy = y - (cell[1] - y0);
        row += sy >= 0 && sy < sprite.size[1] && sx >= 0 && sx < sprite.size[0] ? sprite.cells[sy][sx] : '.';
      }
      cells.push(row);
    }
    return { size: [w, h], palette: sprite.palette, cells };
  });
  const blank = { size: [w, h], palette: cels[0].sprite.palette.slice(0, 1), cells: Array.from({ length: h }, () => '.'.repeat(w)) };
  return { cell: [x0, y0], sprites, blank };
}
