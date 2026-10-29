/**
 * THE DUNGEON'S PAGE in a world's book (bible-html.js): a walled-core dungeon (wcd/wcd.js) drawn as rings, the outermost
 * layer outside and the core in the middle, each space on its ring, the doors on the joins with what opens them, the
 * critical path in the accent, a space not yet built dashed; beside it each layer's level and look, and the principles'
 * verdicts. Drawn in the book's own variables (`var(--ink)`, `var(--c-trail)`, …), so a skin (book-skin.js) recolours it.
 *
 *   wcdPage(G, esc, finishes) → the section's html, '' for a world with no dungeon; `finishes` (finishes.js, by level)
 *   puts each built layer's wall, base, floor and paint beside its look, so the page approves the materials too
 *
 * Pure: the same world, the same page.
 */

import { finishesHtml } from './finishes.js';

const S = 640, C = S / 2, R0 = 64, R1 = 270;
const r1 = (v) => Math.round(v * 10) / 10;

/** The rings plate: one ring a depth, each space a node on its ring, each door a line between nodes. */
function plate(W, esc) {
  const sp = Object.values(W.spaces), D = Math.max(...sp.map((s) => s.depth)), top = Math.min(...sp.map((s) => s.depth));
  const span = Math.max(1, D - top), radius = (d) => (d === D ? 0 : R0 + ((D - d) / span) * (R1 - R0));
  // (a depth's spaces spread round its ring, each ring turned a little from the last so a stack reads as a path in)
  const at = {};
  for (let d = top; d <= D; d++) {
    const here = sp.filter((s) => s.depth === d);
    // (the depths spread over most of the turn, so a path in reads as a spiral and its labels have room)
    const step = Math.min(80, 300 / span);
    here.forEach((s, i) => { const a = ((-90 - (d - top) * step + (i * 360) / here.length) * Math.PI) / 180, r = radius(d); at[s.id] = [r1(C + r * Math.cos(a)), r1(C + r * Math.sin(a))]; });
  }
  const onPath = new Set((W.path ?? []).slice(1).map((id, i) => `${W.path[i]}>${id}`));
  const rings = [...new Set(sp.map((s) => s.depth))].filter((d) => d !== D).map((d) => `<circle cx="${C}" cy="${C}" r="${r1(radius(d))}" fill="none" style="stroke:var(--rule)" stroke-width="1.5"${sp.filter((s) => s.depth === d).every((s) => !s.built) ? ' stroke-dasharray="6 6"' : ''}/>`).join('');
  const gateOf = (g) => (!g ? 'open' : g.clearance !== undefined ? `CL-${g.clearance}` : g.power);
  const doors = W.doors.map((d) => {
    const [a, b] = [at[d.from], at[d.to]], path = onPath.has(`${d.from}>${d.to}`) || (!d.oneWay && onPath.has(`${d.to}>${d.from}`));
    // (its gate's label off the line's middle, square to it, on the side away from the core)
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = -dy / L, ny = dx / L;
    if ((mx + nx - C) ** 2 + (my + ny - C) ** 2 < (mx - C) ** 2 + (my - C) ** 2) { nx = -nx; ny = -ny; }
    const m = [r1(mx + nx * 16), r1(my + ny * 16 + 4)];
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" style="stroke:${path ? 'var(--c-trail)' : 'var(--muted)'}" stroke-width="${path ? 3 : 1.5}"${d.oneWay ? ' stroke-dasharray="3 5" marker-end="url(#wcd-arrow)"' : ''}/>`
      + `<text x="${m[0]}" y="${m[1]}" text-anchor="middle" class="wcd-gate">${esc(`${d.via} · ${gateOf(d.gate)}`)}</text>`;
  }).join('');
  const nodes = sp.map((s) => {
    const [x, y] = at[s.id], core = s.id === W.core, rr = core ? 26 : 17;
    return `<g><circle cx="${x}" cy="${y}" r="${rr}" style="fill:var(--sheet);stroke:${core ? 'var(--local)' : s.kind === 'inner' ? 'var(--c-trail)' : 'var(--ink)'}" stroke-width="${core ? 3 : 2}"${s.built ? '' : ' stroke-dasharray="4 3"'}/>`
      + `<text x="${x}" y="${y + 4}" text-anchor="middle" class="wcd-k">${s.kind === 'inner' ? 'IN' : 'OUT'}</text>`
      + `<text x="${x}" y="${y + rr + 15}" text-anchor="middle" class="wcd-n">${esc(s.id)}${s.built ? '' : ' · unbuilt'}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="The dungeon's layers, the core in the middle">`
    + '<defs><marker id="wcd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--muted)"/></marker></defs>'
    + `${rings}${doors}${nodes}</svg>`;
}

/** The dungeon's section of the book. */
export function wcdPage(G, esc, finishes = {}) {
  const W = G.wcd;
  if (!W) return '';
  const order = Object.values(W.spaces).sort((a, b) => a.depth - b.depth);
  const level = (s) => (s.level ? esc(G.levels?.[s.level]?.name ?? s.level) : '—');
  // (the look a layer is built in: its finishes' when its level is a building, as composed; else the look it names)
  const look = (s) => {
    const F = s.level ? finishes[s.level] : null, L = F?.axes ?? s.look;
    return `${L ? esc(`${L.construction} · ${L.palette}`) : '—'}${F ? `<br>${finishesHtml(F, esc, { roles: ['wall', 'base', 'floor', 'paint'] })}` : ''}`;
  };
  const rows = order.map((s) => `<tr><td class="mono">${s.depth}</td><td><b>${esc(s.id)}</b>${s.id === W.core ? ' <span class="stamp st-revise">core</span>' : ''}</td><td class="mono">${s.kind}</td><td>${level(s)}</td><td class="mono">${look(s)}${s.tone !== undefined ? ' · toned' : ''}</td><td class="mono">${s.built ? 'built' : 'unbuilt'}</td></tr>`).join('');
  const laws = W.laws.map((l) => `<li><span class="stamp ${l.holds ? 'st-approved' : 'st-changed'}">${l.holds ? 'holds' : 'advise'}</span> <b class="mono">${esc(l.law)}</b> <span class="muted">${esc(l.says)}</span></li>`).join('');
  return `<section class="part" id="wcd"><div class="part-h"><span class="eyebrow">The way in</span><h2>To the core</h2></div>`
    + `<div class="wcd"><figure class="canvas wcd-plate">${plate(W, esc)}</figure><div class="card"><div class="card-h"><span class="eyebrow">Critical path</span><h3>${W.path ? W.path.map(esc).join(' › ') : 'no way in'}</h3></div>`
    + `<table class="wcd-t"><thead><tr><th>depth</th><th>layer</th><th>kind</th><th>level</th><th>look</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    + `<ul class="wcd-laws">${laws}</ul></div></div></section>`;
}

/** The page's rules, laid with the book's own. */
export const WCD_CSS = '.wcd{display:grid;grid-template-columns:minmax(0,640px) minmax(0,1fr);gap:18px;align-items:start}.wcd-plate{padding:8px}'
  + '.wcd-gate{font:10.5px var(--mono);fill:var(--local);letter-spacing:.06em;text-transform:uppercase}.wcd-k{font:600 10px var(--mono);fill:var(--muted)}'
  + '.wcd-n{font:600 12px var(--mono);fill:var(--ink);text-transform:uppercase;letter-spacing:.06em}'
  + '.wcd-t{width:100%;border-collapse:collapse;font-size:13px}.wcd-t th,.wcd-t td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--rule)}.wcd-t th{font:10.5px var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}'
  + '.wcd-laws{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:13px}@media (max-width:900px){.wcd{grid-template-columns:1fr}}';
