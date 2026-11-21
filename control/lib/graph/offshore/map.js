/**
 * THE RIG'S MAPS — each deck of a planned rig (plan.js) drawn from above as a level designer reads it, in the facility
 * maps' hand (gameworld/facility-maps.js): the sea dark, each tile of floor by its kind (plate, grating barred, the
 * helideck green), the deck under it faint where none is, the rails by kind (gold a guard rail a gaze goes through,
 * grey a bulwark, light a wind screen), the pillars (a leg's octagon, a column's square), each module coloured by what it
 * hides (red stops a standing gaze, amber hides a crouch, blue a body lying down), the stairs dashed with their way up,
 * the ways on and off, and over it a way across unseen (white, dashed) and the rounds that watch it (red).
 *
 *   rigMapSvg(plan, { deck, title?, path?, patrols?, px? }) → an SVG string
 */
import { FLOORS, stopsOf } from './tiles.js';
import { moduleBoxes, pillarBox, railBox } from './plan.js';

const r2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const HIDE = { stand: '#c9553f', crouch: '#d99a3c', prone: '#6f8fa6' };
const RAIL = { guard: '#e2b437', bulwark: '#9aa09b', screen: '#d8dcd4' };

export function rigMapSvg(plan, { deck, title = null, path = null, patrols = [], px = 14 } = {}) {
  const d = plan.decks.find((e) => e.id === deck) ?? plan.decks[0], C = plan.cell, S = px, pad = 24;
  const [X0, Y0, X1, Y1] = plan.bounds, W = r2((X1 - X0) * S + 2 * pad), H = r2((Y1 - Y0) * S + 2 * pad + 22);
  const x = (v) => r2(pad + (v - X0) * S), y = (v) => r2(pad + 22 + (Y1 - v) * S), w = (v) => r2(v * S);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace,monospace" role="img"${title ? ` aria-label="${esc(title)}"` : ''}><rect width="${W}" height="${H}" fill="#10232c"/>`;
  s += `<text x="${pad}" y="16" fill="#cfd8dc" font-size="12">${esc(title ?? `${plan.name}: ${d.id}, ${d.z} m over the sea`)}</text>`;
  // (the deck under this one, faint, where this one has no floor)
  const below = plan.decks.filter((e) => e.z < d.z).sort((a, b) => b.z - a.z)[0];
  for (let j = 0; j < plan.H; j++) for (let i = 0; i < plan.W; i++) {
    const id = d.floor[j * plan.W + i], b = below?.floor[j * plan.W + i];
    if (!id && b) s += `<rect x="${x(i * C)}" y="${y((j + 1) * C)}" width="${w(C)}" height="${w(C)}" fill="#24343b"/>`;
    if (!id) continue;
    s += `<rect x="${x(i * C)}" y="${y((j + 1) * C)}" width="${w(C)}" height="${w(C)}" fill="${FLOORS[id].fill}" stroke="#2b2f31" stroke-width="0.5"/>`;
    if (id === 'grating') for (let q = 1; q < 4; q++) s += `<line x1="${x(i * C)}" y1="${y(j * C + (C * q) / 4)}" x2="${x((i + 1) * C)}" y2="${y(j * C + (C * q) / 4)}" stroke="#454a4c" stroke-width="1"/>`;
  }
  for (const S0 of plan.stairs) {
    if (S0.from !== d.id && S0.to !== d.id) continue;
    const R = S0.rect;
    s += `<rect x="${x(R.min[0])}" y="${y(R.max[1])}" width="${w(R.max[0] - R.min[0])}" height="${w(R.max[1] - R.min[1])}" fill="${S0.from === d.id ? '#3b4f63' : 'none'}" stroke="#8fb3d9" stroke-width="2" stroke-dasharray="6 4"/>`;
    const a = S0.P(0.4, C / 2), b = S0.P(2 * C, C / 2), c2 = S0.P(2 * C, 1.5 * C), e = S0.P(0.4, 1.5 * C);
    s += `<polyline points="${[a, b, c2, e].map((p) => `${x(p[0])},${y(p[1])}`).join(' ')}" fill="none" stroke="#8fb3d9" stroke-width="1.5" marker-end="url(#up)"/>`;
    s += `<text x="${x((R.min[0] + R.max[0]) / 2) - 18}" y="${y((R.min[1] + R.max[1]) / 2) + 4}" fill="#cfe0f0" font-size="10">${S0.from === d.id ? `up to ${esc(S0.to)}` : `from ${esc(S0.from)}`}</text>`;
  }
  for (const r of plan.rails) if (r.deck === d.id) { const B = railBox(r); s += `<rect x="${x(B.min[0])}" y="${y(B.max[1])}" width="${Math.max(2, w(B.max[0] - B.min[0]))}" height="${Math.max(2, w(B.max[1] - B.min[1]))}" fill="${RAIL[r.kind]}"/>`; }
  for (const p of plan.pillars) {
    // (a pillar standing on this deck or passing through its floor; one passing beside it, off its floor, is not drawn)
    const C2 = [[-1, -1], [0, -1], [-1, 0], [0, 0]].some(([a, b]) => { const i = Math.round(p.at[0] / C) + a, j = Math.round(p.at[1] / C) + b; return i >= 0 && j >= 0 && i < plan.W && j < plan.H && d.floor[j * plan.W + i]; });
    if (!(p.z0 <= d.z + 0.1 && p.z1 >= d.z + 1) || !C2) continue;
    if (p.kind === 'leg') { const R = p.size / 2, pts = Array.from({ length: 8 }, (_, k) => { const a = (Math.PI * (k + 0.5)) / 4; return `${x(p.at[0] + R * Math.cos(a))},${y(p.at[1] + R * Math.sin(a))}`; }).join(' '); s += `<polygon points="${pts}" fill="${HIDE.stand}" stroke="#f0d6a0" stroke-width="1.5"/>`; }
    else { const B = pillarBox(p); s += `<rect x="${x(B.min[0])}" y="${y(B.max[1])}" width="${w(B.max[0] - B.min[0])}" height="${w(B.max[1] - B.min[1])}" fill="${HIDE.stand}" stroke="#1c1f22" stroke-width="1"/>`; }
  }
  for (const m of plan.modules) {
    if (m.deck !== d.id) continue;
    const boxes = moduleBoxes(m), hide = HIDE[stopsOf(m.h)] ?? '#556';
    if (!boxes.length || m.solid !== 'box') s += `<rect x="${x(m.min[0])}" y="${y(m.max[1])}" width="${w(m.max[0] - m.min[0])}" height="${w(m.max[1] - m.min[1])}" fill="none" stroke="#9aa5ad" stroke-width="1" stroke-dasharray="3 3"/>`;
    for (const B of boxes) s += `<rect x="${x(B.min[0])}" y="${y(B.max[1])}" width="${w(B.max[0] - B.min[0])}" height="${w(B.max[1] - B.min[1])}" fill="${hide}" stroke="#1c1f22" stroke-width="1"/>`;
    s += `<text x="${x(m.min[0]) + 2}" y="${y(m.max[1]) + 10}" fill="#1c1f22" font-size="9">${esc(m.kind)}</text>`;
  }
  for (const p of plan.ports) if (p.deck === d.id) s += `<circle cx="${x(p.at[0])}" cy="${y(p.at[1])}" r="5" fill="${p.of === 'goal' ? '#ffd24a' : '#6ae88a'}" stroke="#10232c" stroke-width="1.5"/>`;
  for (const P of patrols) {
    if (P.to) s += `<line x1="${x(P.at[0])}" y1="${y(P.at[1])}" x2="${x(P.to[0])}" y2="${y(P.to[1])}" stroke="#ff5a5a" stroke-width="2.5" opacity="0.85"/>`;
    s += `<circle cx="${x(P.at[0])}" cy="${y(P.at[1])}" r="4" fill="#ff5a5a"/>`;
  }
  if (path && path.length > 1) s += `<polyline points="${path.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')}" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += `<defs><marker id="up" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8fb3d9"/></marker></defs>`;
  return s + '</svg>';
}
