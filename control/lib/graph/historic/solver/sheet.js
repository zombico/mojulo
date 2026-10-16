/**
 * historic/solver/sheet — a solved plan drawn from above: the claim grid's ground (water, lanes, the precinct, the
 * fields, the town and the land outside), every slot's footprint by what it is, the monuments outlined, the views as
 * eyes looking along their line. The field guide's plan sheet, and the review drawing for the solver. Pure SVG.
 */
const FILL = { 0: '#e8dcc0', 1: '#7fa8c0', 2: '#8a7a64', 3: '#d9c9a4', 4: '#efe2bf', 5: '#e8dcc0', 6: '#dfe3c8', 7: '#e2d7bb', 8: '#c9cf9a', 9: '#c6d39a' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;

export function planSheetSvg(plan, { width = 1100 } = {}) {
  const { w: W, d: D } = plan.frame, pad = 24, s = (width - 2 * pad) / W, H = D * s + 2 * pad;
  const X = (x) => r1(pad + x * s), Y = (y) => r1(pad + y * s);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${r1(H)}" class="sheet" role="img" aria-label="${esc(plan.stats.culture)} plan">`, `<rect width="${width}" height="${r1(H)}" fill="#f6f1e4"/>`];
  const G = plan.grid, [ox, oy] = G.origin || [0, 0];
  if (G) {
    // the ground by row runs of one code
    for (let r = 0; r < G.rows; r++) {
      let c0 = 0;
      for (let c = 1; c <= G.cols; c++) {
        const v = G.data[r * G.cols + c0];
        if (c < G.cols && G.data[r * G.cols + c] === v) continue;
        const x = c0 * G.cell - ox, y = r * G.cell - oy;
        if (x + (c - c0) * G.cell > 0 && y + G.cell > 0 && x < W && y < D) out.push(`<rect x="${X(x)}" y="${Y(y)}" width="${r1((c - c0) * G.cell * s)}" height="${r1(G.cell * s + 0.3)}" fill="${FILL[v] ?? '#eee'}"/>`);
        c0 = c;
      }
    }
  }
  const houses = new Set((plan.form?.houses || []).map((h) => h.asset)), mons = new Set((plan.stats.monuments || []).map((m) => m.id));
  for (const q of plan.slots) {
    const r = q.rect, kind = q.monument ? 'monument' : houses.has(q.asset) ? 'house' : q.activity ? 'activity' : 'other';
    const fill = { monument: '#b5523b', house: '#b89a72', activity: '#7d8f4e', other: '#6d6a8a' }[kind];
    out.push(`<rect x="${X(r.x)}" y="${Y(r.y)}" width="${r1(r.w * s)}" height="${r1(r.d * s)}" fill="${fill}" fill-opacity="${kind === 'house' ? 0.75 : 0.85}" stroke="#3a2f22" stroke-width="0.4"><title>${esc(q.asset)} · faces ${q.facing}</title></rect>`);
  }
  void mons;
  for (const m of plan.stats.monuments || []) out.push(`<rect x="${X(m.rect.x)}" y="${Y(m.rect.y)}" width="${r1(m.rect.w * s)}" height="${r1(m.rect.d * s)}" fill="none" stroke="#7a1f12" stroke-width="2"><title>${esc(m.id)}</title></rect>`);
  if (plan.stats.precinct) { const p = plan.stats.precinct; out.push(`<rect x="${X(p.x)}" y="${Y(p.y)}" width="${r1(p.w * s)}" height="${r1(p.d * s)}" fill="none" stroke="#7a1f12" stroke-dasharray="5 4" stroke-width="1"/>`); }
  for (const [name, v] of Object.entries(plan.views || {})) {
    const [ex, ey] = v.eye, [tx, ty] = v.at, L = Math.hypot(tx - ex, ty - ey) || 1, k = Math.min(1, 40 / L);
    out.push(`<line x1="${X(ex)}" y1="${Y(ey)}" x2="${X(ex + (tx - ex) * k)}" y2="${Y(ey + (ty - ey) * k)}" stroke="#14324a" stroke-width="1.6"/><circle cx="${X(ex)}" cy="${Y(ey)}" r="4" fill="#14324a"/><text x="${X(ex) + 6}" y="${Y(ey) - 6}" font-size="12" font-family="sans-serif" fill="#14324a">${esc(name)}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}
