// construction/covers — the cloth a piece's soft parts are covered in, cut flat: each part's pieces with their seam
// allowance, laid on the roll the way an upholsterer lays them, and the metres of cloth that takes.
//
// Pieces (mm, finished size plus a 12 mm seam allowance all round), each with its width (u, across the piece as it
// sits on the sofa) and height (v, up the piece: front to back on a seat, bottom to top on a front or a back):
//   · a boxed cushion: two plates (top and bottom); the boxing, a strip round the front and sides (joined where it is
//     longer than the cloth is wide); the zip boxing across the back and 75 mm round each corner, in two halves; its
//     piping cord covered in bias strips 40 mm wide;
//   · a knife cushion or a pillow: two faces; a bolster: its body and two end circles; a pad: each face that shows —
//     not its underside, nor a face another pad covers — with 25 mm over for the padding it wraps;
//   · a custom part: its area only.
// The cloth runs up the piece (the warp along v) unless the cover is railroaded (`railroad: true`), when it runs
// across it: a long piece (a bench cushion, an inside back) then comes out whole where up the roll it needs a seam.
//
// Laying out: pieces in rows across the roll, tallest first. A cloth with a pattern big enough to see (fabric.js
// `match`: a repeat of 25 mm or more) puts every piece's centre on a motif's centre — each row's centre line on the
// repeat, each piece's centre across on it — which is how a stripe runs on from the back down the seat and the
// border, and why a patterned cloth costs more metres. Bias strips for the piping are cut last, from a band across
// the roll.
import { resolveFabric } from './fabric.js';

export const SEAM_MM = 12;
const WRAP_MM = 75;           // the zip boxing runs round each back corner
const EASE_MM = 25;           // a pad's piece runs past its face to wrap the padding
const BIAS_MM = 40;           // a piping strip's width
export const ROLL_MM = 1400;  // an upholstery cloth's usual width (137–140 cm)

const r0 = (v) => Math.round(v);

/**
 * The pieces a lowered soft part (soft.js row and frame) is cut into → [{ part, name, count, u, v }] (finished mm,
 * before the seam allowance), plus the piping it needs (mm of cord). `pads` are the other pads (for faces they cover).
 */
export function partPieces(L, pads = []) {
  const { row, frame } = L;
  const [w, l, t] = row.sizeMm;
  const P = (name, u, v, count = 1) => ({ part: row.id, name, count, u: r0(u), v: r0(v) });
  const pipe = row.piping ? row.piping : 0;
  switch (row.kind) {
    case 'cushion': {
      if (row.style === 'knife') return { pieces: [P('face', w, l, 2)], pipingMm: pipe ? 2 * (w + l) : 0 };
      const boxing = w + 2 * (l - WRAP_MM), zip = w + 2 * WRAP_MM;
      return { pieces: [P('plate', w, l, 2), P('boxing', boxing, t), P('zip boxing', zip, t / 2 + 20, 2)], pipingMm: pipe * 2 * (w + l) };
    }
    case 'pillow': return { pieces: [P('face', w, l, 2)], pipingMm: pipe ? 2 * (w + l) : 0 };
    case 'bolster': return { pieces: [P('body', Math.PI * Math.min(l, t), w), P('end', Math.min(l, t), Math.min(l, t), 2)], pipingMm: pipe ? 2 * Math.PI * Math.min(l, t) : 0 };
    case 'pad': {
      // each face that shows: not the underside, not one another pad lies against
      const lo = frame.lo.map((v) => v * 1000), hi = frame.hi.map((v) => v * 1000), ext = lo.map((v, k) => hi[k] - v);
      const covered = (k, sg) => pads.some((O) => {
        if (O === L) return false;
        const olo = O.frame.lo.map((v) => v * 1000), ohi = O.frame.hi.map((v) => v * 1000);
        const plane = sg > 0 ? hi[k] : lo[k];
        if (plane < olo[k] - 2 || plane > ohi[k] + 2) return false;
        const others = [0, 1, 2].filter((i) => i !== k);
        const area = others.reduce((a, i) => a * Math.max(0, Math.min(hi[i], ohi[i]) - Math.max(lo[i], olo[i])), 1);
        return area >= 0.8 * others.reduce((a, i) => a * ext[i], 1) && (sg > 0 ? ohi[k] > hi[k] + 1 : olo[k] < lo[k] - 1);
      });
      const faces = [['top', 2, 1, ext[0], ext[1]], ['front', 1, -1, ext[0], ext[2]], ['back', 1, 1, ext[0], ext[2]], ['left', 0, -1, ext[1], ext[2]], ['right', 0, 1, ext[1], ext[2]]];
      return { pieces: faces.filter(([, k, sg]) => !covered(k, sg)).map(([name, , , u, v]) => P(name, u + 2 * EASE_MM, v + 2 * EASE_MM)), pipingMm: 0 };
    }
    default: return { pieces: [], pipingMm: 0, areaM2: row.areaM2 };
  }
}

/**
 * coverLayout(soft, { fabric, railroad, rollMm }) → { rollMm, railroad, match, repeatMm, pieces, placed, lengthMm,
 * unmatchedMm, seams, bias }. `soft` are lowered parts (soft.js); every length in mm.
 */
export function coverLayout(soft, { fabric, railroad = false, rollMm: roll } = {}) {
  const R = resolveFabric(fabric !== undefined ? fabric : 'linen');
  const rollMm = roll || R.rollMm || ROLL_MM;
  const pads = soft.filter((L) => L.row.kind === 'pad');
  const all = []; let piping = 0; let seams = 0; let customM2 = 0;
  for (const L of soft) {
    const { pieces, pipingMm, areaM2 } = partPieces(L, pads);
    piping += pipingMm; if (areaM2) customM2 += areaM2;
    for (const p of pieces) {
      // across and along the roll, allowance on: up the roll the piece's width lies across the cloth
      const across0 = (railroad ? p.v : p.u) + 2 * SEAM_MM, along = (railroad ? p.u : p.v) + 2 * SEAM_MM;
      // wider than the cloth: cut in widths and seamed
      const k = Math.ceil(across0 / rollMm - 1e-9), across = k > 1 ? Math.ceil((across0 - 2 * SEAM_MM) / k) + 2 * SEAM_MM : across0;
      seams += (k - 1) * p.count;
      for (let c = 0; c < p.count; c++) for (let j = 0; j < k; j++) all.push({ part: p.part, name: p.name, ...(k > 1 ? { of: [j + 1, k] } : {}), w: across, h: along });
    }
  }
  const [rx, ry] = railroad ? [R.repeatMm[1], R.repeatMm[0]] : R.repeatMm;   // the repeat across and along the roll
  const lay = (match) => {
    const list = all.map((p, i) => ({ ...p, i })).sort((a, b) => b.h - a.h || b.w - a.w || a.i - b.i);
    const placed = []; let y = 0, x = 0, rowH = 0, rowC = null; const rows = [];
    const snap = (v, rep, half) => (match && rep > 0 ? Math.ceil((v + half - rep / 2) / rep - 1e-9) * rep + rep / 2 - half : v);
    for (const p of list) {
      let px = snap(x, rx, p.w / 2);
      if (px + p.w > rollMm) { rows.push({ y, h: rowH }); y += rowH; x = 0; rowH = 0; rowC = null; px = snap(0, rx, p.w / 2); if (px + p.w > rollMm) px = 0; }
      // the row's centre line sits on the repeat's centre; every piece in it is centred on that line
      if (rowC === null) rowC = snap(y, ry, p.h / 2) + p.h / 2;
      const py = rowC - p.h / 2;
      placed.push({ ...p, x: Math.round(px), y: Math.round(py) });
      x = px + p.w; rowH = Math.max(rowH, py + p.h - y);
    }
    return { placed, length: y + rowH };
  };
  const matched = lay(R.match), plain = lay(false);
  const use = R.match ? matched : plain;
  // bias strips for the piping: across the roll at 45°, each √2 × roll wide long, a band √2 × 40 mm deep each
  const stripLen = rollMm * Math.SQRT2, strips = piping > 0 ? Math.ceil((piping * 1.05) / stripLen) : 0;
  const biasBand = Math.ceil(strips * BIAS_MM * Math.SQRT2);
  const areaM2 = all.reduce((s, p) => s + p.w * p.h, 0) / 1e6;
  return {
    fabric: R.name, cloth: { title: R.title, ...(R.martindale ? { martindale: R.martindale, ...(R.est ? { est: true } : {}) } : {}), nap: R.nap, directional: R.directional },
    parts: [...new Set(soft.map((L) => L.row.id))], rollMm, railroad, match: R.match, repeatMm: R.repeatMm, pieces: all.length, seams,
    lengthMm: Math.ceil(use.length + biasBand), unmatchedMm: Math.ceil(plain.length + biasBand),
    metres: Math.ceil((use.length + biasBand) / 100) / 10, metresUnmatched: Math.ceil((plain.length + biasBand) / 100) / 10,
    yieldPct: Math.round((1000 * areaM2 * 1e6) / (rollMm * (use.length + biasBand))) / 10,
    ...(piping > 0 ? { bias: { cordMm: Math.round(piping), strips, bandMm: biasBand } } : {}),
    ...(customM2 > 0 ? { customM2: Math.round(customM2 * 1000) / 1000 } : {}),
    placed: use.placed, biasAt: use.length,
  };
}

/** The report row: the layout without the placements. */
export function coverSummary(c) {
  const { placed, biasAt, ...rest } = c; return rest;
}

/**
 * The lines a mint stamps for a cover: cloth too weak for a seat, a nap, a pattern turned on its side, pieces seamed
 * where railroading would not be.
 */
export function coverStamps(c, label, { seats = false } = {}) {
  const out = []; const R = c.cloth;
  if (seats && R.martindale && R.martindale < 25000) out.push(`${label}: ${R.title} is rated ${R.martindale} Martindale rubs${R.est ? ' (a typical cloth of its kind)' : ''}: on a sofa used every day, a seat wants 25 000 or more`);
  if (R.nap) out.push(`${label}: ${R.title} has a nap: cut every piece the same way up (the pile running down the back and toward the front of the seat), or the panels shade differently`);
  if (c.railroad && R.directional) out.push(`${label}: railroading ${R.title} turns its pattern on its side (its warp and weft differ)`);
  // (a nap turned sideways shades wrong: a napped cloth is seamed, not railroaded)
  if (!c.railroad && c.seams && !R.directional && !R.nap) out.push(`${label}: ${c.seams} piece${c.seams > 1 ? 's are' : ' is'} wider than the ${c.rollMm} mm cloth and seamed — railroading it (\`railroad: true\`) cuts them whole`);
  return out;
}

// ── the cutting layout, in black and white ──────────────────────────────────────────────────────────────────────

const INK = '#000';
const r2 = (v) => Math.round(v * 100) / 100;
const text = (x, y, s, size = 3, anchor = 'middle', weight = 400) => `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif" font-weight="${weight}">${s}</text>`;

/**
 * The layout on A4 pages (mm): the roll's width across the page, its length down it, each page a stretch of roll.
 * Pieces outlined and labelled (a part's number from `numberOf`, else its id; the piece's name), their finished size in
 * mm, the warp's arrow; a matched cloth's repeat as faint ticks on the selvedges; a scale bar. → [svg].
 */
export function coverPages(c, { numberOf = new Map(), box = { x: 20, y: 22, w: 170, h: 250 } } = {}) {
  const s = box.w / c.rollMm;                                   // mm on the page per mm of cloth
  const perPage = Math.floor(box.h / s);
  const total = c.lengthMm; const pages = [];
  const label = (p) => [String(numberOf.get(p.part) || p.part), `${p.name}${p.of ? ` ${p.of[0]}/${p.of[1]}` : ''}`];
  for (let y0 = 0; y0 < total; y0 += perPage) {
    const y1 = Math.min(total, y0 + perPage);
    const Y = (y) => box.y + (y - y0) * s, X = (x) => box.x + x * s;
    let body = '';
    // the selvedges, and the repeat along them
    body += `<g stroke="${INK}" fill="none" stroke-width="0.35"><line x1="${X(0)}" y1="${Y(y0)}" x2="${X(0)}" y2="${r2(Y(y1))}"/><line x1="${X(c.rollMm)}" y1="${Y(y0)}" x2="${X(c.rollMm)}" y2="${r2(Y(y1))}"/></g>`;
    const rep = c.railroad ? c.repeatMm[0] : c.repeatMm[1];
    if (c.match && rep > 0) { const ticks = []; for (let y = Math.ceil(y0 / rep) * rep; y <= y1; y += rep) ticks.push(`M${r2(X(0) - 2)} ${r2(Y(y))}h2M${r2(X(c.rollMm))} ${r2(Y(y))}h2`); body += `<path d="${ticks.join('')}" stroke="${INK}" stroke-width="0.2"/>`; }
    for (const p of c.placed) {
      if (p.y + p.h <= y0 || p.y >= y1) continue;
      const x = X(p.x), y = Y(Math.max(p.y, y0)), w = p.w * s, h = (Math.min(p.y + p.h, y1) - Math.max(p.y, y0)) * s;
      // the cutting line, and the stitching line a seam allowance inside it (dashed)
      body += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="#fff" stroke="${INK}" stroke-width="0.3"/>`;
      const a = 12 * s; if (w > 2 * a && h > 2 * a) body += `<rect x="${r2(x + a)}" y="${r2(y + (p.y >= y0 ? a : 0))}" width="${r2(w - 2 * a)}" height="${r2(h - (p.y >= y0 ? a : 0) - (p.y + p.h <= y1 ? a : 0))}" fill="none" stroke="${INK}" stroke-width="0.12" stroke-dasharray="0.8 0.6"/>`;
      if (h > 7 && w > 9) {
        const cx = x + w / 2, cy = y + h / 2;
        const [l1, l2] = label(p); const fs = Math.min(3.4, w / 6);
        body += text(cx, cy - 2.4, l1, fs, 'middle', 700) + text(cx, cy + 1.2, l2, Math.min(2.6, w / 8)) + text(cx, cy + 4.4, `${p.w - 24} × ${p.h - 24}`, Math.min(2.4, w / 9));
        // the warp's arrow (along the roll, down the page), beside the label
        if (h > 16) body += `<path d="M${r2(x + 3)} ${r2(cy - 5)}V${r2(cy + 5)}M${r2(x + 2)} ${r2(cy + 3.6)}L${r2(x + 3)} ${r2(cy + 5)}L${r2(x + 4)} ${r2(cy + 3.6)}" stroke="${INK}" stroke-width="0.25" fill="none"/>`;
      }
    }
    // the bias band for the piping, hatched at 45°
    if (c.bias && c.biasAt < y1 && c.biasAt + c.bias.bandMm > y0) {
      const by0 = Math.max(c.biasAt, y0), by1 = Math.min(c.biasAt + c.bias.bandMm, y1);
      const hs = []; for (let d = -c.rollMm; d < c.rollMm + (by1 - by0); d += 40 * Math.SQRT2) hs.push(`M${r2(X(Math.max(0, d)))} ${r2(Y(by0 + Math.max(0, -d)))}L${r2(X(Math.min(c.rollMm, d + (by1 - by0))))} ${r2(Y(by0 + Math.min(by1 - by0, c.rollMm - d)))}`);
      body += `<clipPath id="bias${y0}"><rect x="${X(0)}" y="${r2(Y(by0))}" width="${r2(c.rollMm * s)}" height="${r2((by1 - by0) * s)}"/></clipPath><path d="${hs.join('')}" stroke="${INK}" stroke-width="0.15" clip-path="url(#bias${y0})"/>`;
    }
    // how far along the roll this page runs, and a scale bar (100 mm of cloth)
    body += text(box.x, box.y - 4, `${(y0 / 1000).toFixed(2)}–${(y1 / 1000).toFixed(2)} m`, 3.4, 'start', 700) + text(box.x + box.w, box.y - 4, `${c.rollMm} mm`, 3.4, 'end', 700);
    const sb = box.y + box.h + 12;
    body += `<g stroke="${INK}" stroke-width="0.35"><line x1="${box.x}" y1="${sb}" x2="${r2(box.x + 100 * s)}" y2="${sb}" stroke-width="0.7"/><line x1="${box.x}" y1="${sb - 1.5}" x2="${box.x}" y2="${sb + 1.5}"/><line x1="${r2(box.x + 100 * s)}" y1="${sb - 1.5}" x2="${r2(box.x + 100 * s)}" y2="${sb + 1.5}"/></g>` + text(box.x + 100 * s + 3, sb + 1.2, '100 mm', 3, 'start');
    pages.push(`<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="#fff"/>${body}</svg>`);
  }
  return pages;
}
