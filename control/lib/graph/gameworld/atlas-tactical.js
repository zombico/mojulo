/**
 * THE TACTICAL ATLAS — the atlas (atlas.js) depicted as a modern operations map: the land read as relief (contours from
 * its height, an index contour every fifth with its height), a grid with its numbers in the margin, woods as a green
 * tint, the towns as built-up areas of blocks, the links as roads, each level's trail a track; and over it the control
 * measures a briefing draws: each level an area of operations (AO), its stages checkpoints numbered across the game,
 * a phase line where each road crosses into the next level, a passage point at a gate, the start point, the base at the
 * hub, the objective at the deepest level. In its margin a title block, a north diagram and a scale.
 * Its looks: ops (a printed map), nvg (night-vision phosphor), command (a dark command display).
 *
 *   tactical(A, look) → the depiction's parts (atlas-html.js draws the page)
 *
 * Nothing moves: the same layout as every depiction, read as ground. Pure: the world's seed and its layout only.
 */
import { noise2, inside } from './atlas.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (P) => P.map((p) => p.join(',')).join(' ');
const f1 = (v) => v.toFixed(1);
const callsign = (name) => String(name).replace(/^the\s+/i, '').toUpperCase();

/** The looks: a printed map, night-vision phosphor, a command display. */
export const TACTICAL_LOOKS = Object.freeze({
  ops: {
    read: 'a printed operations map: brown contours on white, blue water and grid, green woods, red roads, the control measures in black',
    paint: { paper: '#f3f1e7', paperEdge: '#d9d4c2', ink: '#1d1d1b', label: '#1d1d1b', sea: '#bcdcec', coast: '#2f6f9a', land: '#f3f1e7', contour: '#c08a5c', contourIndex: '#8a5228', woods: '#cfe2b6', woodsEdge: '#7fa260', builtUp: '#ead2c2', building: '#3a3a3a', road: '#e2643c', roadCase: '#5a2b1c', track: '#2b2b2b', grid: '#6e9ccf', overlay: '#111111', objective: '#c4252c', friendly: '#1f5fbf', halo: '#f3f1e7' },
  },
  nvg: {
    read: 'the same map through night-vision: one green phosphor, the relief and the ways glowing, a scan over all',
    paint: { paper: '#021a0b', paperEdge: '#000a04', ink: '#7dff9e', label: '#b6ffc8', sea: '#03140a', coast: '#3cff7a', land: '#062612', contour: '#1c8a40', contourIndex: '#4dff86', woods: '#0b3a1b', woodsEdge: '#28a855', builtUp: '#0f4a24', building: '#7dff9e', road: '#b6ffc8', roadCase: '#06200f', track: '#7dff9e', grid: '#145c2c', overlay: '#c9ffd6', objective: '#f0fff2', friendly: '#7dff9e', halo: '#021a0b', glow: true, scan: true },
  },
  command: {
    read: 'a command display: the land in deep slate, the relief and grid in steel blue, the ways in amber, friendly cyan and the objective red',
    paint: { paper: '#0b121b', paperEdge: '#05090e', ink: '#9fd3ff', label: '#d7ecff', sea: '#08131e', coast: '#3fa7d6', land: '#101b27', contour: '#23465a', contourIndex: '#3d7a96', woods: '#122e29', woodsEdge: '#2a6b5a', builtUp: '#1e2b3b', building: '#6b8fb0', road: '#ffb547', roadCase: '#2a1b05', track: '#9fd3ff', grid: '#173246', overlay: '#5ad1ff', objective: '#ff4d5a', friendly: '#5ad1ff', halo: '#0b121b', glow: true, hud: true },
  },
});

// the sprites that stand up on the table, each on its foot at the bottom middle of a 40 × 40 box
const SPRITES = (P) => ({
  bldg: `<path d="M8 36 V20 L20 14 L32 20 V36 Z" fill="${P.builtUp}" stroke="${P.building}" stroke-width="1.2"/><path d="M20 14 V30 M8 20 L20 26 L32 20" fill="none" stroke="${P.building}" stroke-width="1"/><path d="M12 26 h3 v4 h-3 Z M25 26 h3 v4 h-3 Z" fill="${P.building}"/>`,
  mast: `<path d="M20 2 L14 36 M20 2 L26 36 M15.5 28 L24.5 28 M16.6 20 L23.4 20 M17.8 12 L22.2 12 M14 36 L26 28 M26 36 L14 28" fill="none" stroke="${P.overlay}" stroke-width="1.2"/><circle cx="20" cy="2" r="2" fill="${P.objective}"/>`,
  tower: `<path d="M13 36 L15 14 H25 L27 36 Z" fill="${P.builtUp}" stroke="${P.building}" stroke-width="1.2"/><path d="M11 14 H29 V8 H11 Z" fill="${P.builtUp}" stroke="${P.building}" stroke-width="1.2"/><path d="M14 36 L26 20 M26 36 L14 20" stroke="${P.building}" stroke-width=".8"/>`,
  'flag-base': `<path d="M12 38 V4" stroke="${P.overlay}" stroke-width="1.8"/><path d="M12 5 H32 V17 H12 Z" fill="${P.friendly}" stroke="${P.overlay}" stroke-width="1.2"/><path d="M12 5 L32 17 M32 5 L12 17" stroke="${P.paper}" stroke-width="1.4"/>`,
  'flag-obj': `<path d="M12 38 V4" stroke="${P.overlay}" stroke-width="1.8"/><path d="M12 5 L32 11 L12 17 Z" fill="${P.objective}" stroke="${P.overlay}" stroke-width="1.2"/>`,
  'flag-sp': `<path d="M12 38 V4" stroke="${P.overlay}" stroke-width="1.8"/><path d="M12 5 H30 V15 H12 Z" fill="${P.paper}" stroke="${P.overlay}" stroke-width="1.2"/><path d="M12 5 H21 V10 H12 Z M21 10 H30 V15 H21 Z" fill="${P.overlay}"/>`,
});

// THE RELIEF: the land's height on a lattice, 0 on the coast rising inland, its hills and peaks raised over it, stirred
const CELL = 8;
function reliefOf(A) {
  const nx = Math.ceil(A.W / CELL) + 1, ny = Math.ceil(A.H / CELL) + 1;
  const shores = A.regions.map((R) => R.outline.map(([x, y]) => [R.at[0] + (x - R.at[0]) * 1.5, R.at[1] + (y - R.at[1]) * 1.55]));
  const peaks = A.regions.flatMap((R) => R.glyphs.filter((g) => g.kind === 'peak').map((g) => g.at)), hills = A.regions.flatMap((R) => R.glyphs.filter((g) => g.kind === 'hill').map((g) => g.at));
  const edgeD = (p, poly) => { let m = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy)); } return m; };
  const F = [];
  for (let j = 0; j < ny; j++) {
    const row = [];
    for (let i = 0; i < nx; i++) {
      const p = [i * CELL, j * CELL], home = shores.findIndex((s) => inside(p, s));
      if (home < 0) { row.push(-1); continue; }
      const rise = Math.min(1, edgeD(p, shores[home]) / 46);
      let peak = 0; for (const q of peaks) { const d2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d2 < 9000) peak = Math.max(peak, 1.05 * Math.exp(-d2 / (2 * 24 * 24))); }
      let hill = 0; for (const q of hills) { const d2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d2 < 2500) hill = Math.max(hill, 0.32 * Math.exp(-d2 / (2 * 15 * 15))); }
      row.push(Math.round(rise * (0.14 + hill + peak + 0.22 * (noise2(A.seed, 'relief', p[0] / 85, p[1] / 85) - 0.3)) * 1000) / 1000);
    }
    F.push(row);
  }
  return { F, nx, ny };
}
// the contour at height L, as segments, by marching squares
const CASES = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [2, 1]], 6: [[0, 2]], 7: [[3, 0]], 8: [[3, 0]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]] };
function contourAt({ F, nx, ny }, L) {
  const out = [];
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const v = [F[j][i], F[j][i + 1], F[j + 1][i + 1], F[j + 1][i]], c = (v[0] > L ? 8 : 0) | (v[1] > L ? 4 : 0) | (v[2] > L ? 2 : 0) | (v[3] > L ? 1 : 0);
    if (!CASES[c]) continue;
    const x = i * CELL, y = j * CELL, t = (a, b) => (L - a) / (b - a || 1e-9);
    const E = [[x + CELL * t(v[0], v[1]), y], [x + CELL, y + CELL * t(v[1], v[2])], [x + CELL * t(v[3], v[2]), y + CELL], [x, y + CELL * t(v[0], v[3])]];
    for (const [a, b] of CASES[c]) out.push([E[a], E[b]]);
  }
  return out;
}

export function tactical(A, look) {
  const P = TACTICAL_LOOKS[look].paint, S = SPRITES(P), { W, H } = A, g = [], sprites = [], glow = P.glow ? ' filter="url(#glow)"' : '';
  const halo = (cls, x, y, text, extra = '') => `<text x="${f1(x)}" y="${f1(y)}" class="${cls}"${extra}>${esc(text)}</text>`;
  g.push(`<rect width="${W}" height="${H}" fill="${P.sea}"/>`);
  // the land and its coast
  const shores = A.regions.map((R) => R.outline.map(([x, y]) => [+(R.at[0] + (x - R.at[0]) * 1.5).toFixed(1), +(R.at[1] + (y - R.at[1]) * 1.55).toFixed(1)]));
  for (const s of shores) g.push(`<polygon points="${pts(s)}" fill="none" stroke="${P.coast}" stroke-width="3" stroke-linejoin="round"/>`);
  for (const s of shores) g.push(`<polygon points="${pts(s)}" fill="${P.land}"/>`);
  // the woods: a tint where the trees stand, its edge drawn under it
  const woods = A.regions.flatMap((R) => R.glyphs.filter((q) => ['conifer', 'broadleaf', 'palm'].includes(q.kind)).map((q) => q.at));
  g.push(`<g>${woods.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="10.5" fill="${P.woodsEdge}"/>`).join('')}</g><g>${woods.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="9.2" fill="${P.woods}"/>`).join('')}</g>`);
  // the relief: a contour every step, every fifth an index contour with its height
  const RF = reliefOf(A), step = 0.1, top = Math.max(...RF.F.flat());
  const labels = [];
  for (let k = 1; k * step < top; k++) {
    const segs = contourAt(RF, k * step), index = k % 5 === 0;
    if (!segs.length) continue;
    g.push(`<path d="${segs.map(([a, b]) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`).join('')}" fill="none" stroke="${index ? P.contourIndex : P.contour}" stroke-width="${index ? 1.5 : 0.8}" stroke-linecap="round" opacity="${index ? 1 : 0.85}"/>`);
    if (index) for (let s = 0; s < segs.length; s += 1) {
      const [a, b] = segs[s], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (labels.some((q) => Math.hypot(q[0] - m[0], q[1] - m[1]) < 220)) continue;
      labels.push(m);
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, up = ang > 90 || ang < -90 ? ang + 180 : ang;
      g.push(halo('ht', m[0], m[1] + 3, String(k * 20), ` text-anchor="middle" transform="rotate(${f1(up)} ${f1(m[0])} ${f1(m[1])})"`));
    }
  }
  // the grid: a line every hundred units, numbered in the margin
  const e0 = 40 + (A.seed % 37), n0 = 70 + (A.seed % 23);
  for (let x = 100; x < W; x += 100) g.push(`<path d="M${x} 0V${H}" stroke="${P.grid}" stroke-width=".8" opacity=".75"/>${halo('grid', x + 3, 14, String(e0 + x / 100).padStart(2, '0'))}`);
  for (let y = 100; y < H; y += 100) g.push(`<path d="M0 ${y}H${W}" stroke="${P.grid}" stroke-width=".8" opacity=".75"/>${halo('grid', 4, y - 4, String(n0 - y / 100).padStart(2, '0'))}`);
  // the rivers: blue lines from the heights to the sea
  for (const R of A.regions.filter((x) => x.river)) g.push(`<polyline points="${pts(R.river)}" fill="none" stroke="${P.coast}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`);
  // the built-up areas: each town a block of buildings round its square, the hub's the larger
  const order = [...A.regions].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1));
  for (const R of A.regions) for (const p of R.places.filter((q) => ['town', 'walls', 'hall'].includes(q.kind))) {
    const big = R.hub || p.kind === 'walls', rr = big ? 40 : 24, path = R.trail.path;
    g.push(`<circle cx="${p.at[0]}" cy="${p.at[1]}" r="${rr}" fill="${P.builtUp}" stroke="${P.building}" stroke-width=".8" stroke-dasharray="3 2"/>`);
    // (its blocks on a grid turned to its trail, kept off the trail itself)
    const k = path.findIndex((q) => Math.hypot(q[0] - p.at[0], q[1] - p.at[1]) < 30), a = k > 0 ? Math.atan2(path[k][1] - path[k - 1][1], path[k][0] - path[k - 1][0]) : 0, c = Math.cos(a), s = Math.sin(a);
    for (let u = -rr + 6; u <= rr - 6; u += 9) for (let v = -rr + 6; v <= rr - 6; v += 9) {
      const q = [p.at[0] + u * c - v * s, p.at[1] + u * s + v * c];
      if (Math.hypot(q[0] - p.at[0], q[1] - p.at[1]) > rr - 5 || path.some((w) => Math.hypot(w[0] - q[0], w[1] - q[1]) < 7) || R.trail.stops.some((w) => Math.hypot(w.at[0] - q[0], w.at[1] - q[1]) < 13) || noise2(A.seed, `blocks-${R.id}`, q[0] / 9, q[1] / 9) < 0.35) continue;
      g.push(`<rect x="${f1(q[0] - 3)}" y="${f1(q[1] - 2.5)}" width="6" height="5" transform="rotate(${f1((a * 180) / Math.PI)} ${f1(q[0])} ${f1(q[1])})" fill="${P.building}"/>`);
    }
    // (a few stand up on the table)
    for (const [dx, dy, sc] of big ? [[-16, -8, 1], [14, -12, 1.2], [4, 12, 1.1], [-8, 16, 0.9]] : [[-6, -4, 0.9], [8, 4, 1]]) { const at = [p.at[0] + dx, p.at[1] + dy]; if (!R.trail.stops.some((w) => Math.hypot(w.at[0] - at[0], w.at[1] - at[1]) < 14)) sprites.push({ kind: 'bldg', at, s: sc }); }
    if (R.hub) sprites.push({ kind: 'mast', at: [p.at[0] + 34, p.at[1] + 30], s: 1.5 });
  }
  // the castles: a fortified area, its tower standing
  for (const R of A.regions) for (const p of R.places.filter((q) => q.kind === 'castle')) {
    g.push(`<rect x="${f1(p.at[0] - 14)}" y="${f1(p.at[1] - 14)}" width="28" height="28" fill="${P.builtUp}" stroke="${P.overlay}" stroke-width="2"/>${[0, 1, 2, 3].map((i) => `<rect x="${f1(p.at[0] - 14 + i * 9)}" y="${f1(p.at[1] - 18)}" width="5" height="4" fill="${P.overlay}"/>`).join('')}${halo('lab', p.at[0], p.at[1] + 30, 'FORT', ' text-anchor="middle"')}`);
    sprites.push({ kind: 'tower', at: p.at, s: 1.3 });
  }
  // the roads between levels and each level's track through its stages
  for (const r of A.roads) g.push(`<polyline points="${pts(r.path)}" fill="none" stroke="${P.roadCase}" stroke-width="5.6" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts(r.path)}" fill="none" stroke="${P.road}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"${glow}/>`);
  for (const R of A.regions) g.push(`<polyline points="${pts(R.trail.path)}" fill="none" stroke="${P.track}" stroke-width="1.8" stroke-dasharray="7 3" stroke-linejoin="round"${glow}/>`);
  // the control measures: each level an AO, its boundary and its name
  A.regions.forEach((R) => {
    g.push(`<polygon class="prov" data-level="${esc(R.id)}" points="${pts(R.outline)}" fill="transparent" stroke="${P.overlay}" stroke-width="2.2" stroke-dasharray="16 4 3 4"${glow}><title>${esc(R.name)}</title></polygon>`);
    // (its name at its top edge, else its bottom where a town stands under the top)
    const top = R.outline.reduce((m, q) => (q[1] < m[1] ? q : m), R.outline[0]), bottom = R.outline.reduce((m, q) => (q[1] > m[1] ? q : m), R.outline[0]);
    const y = R.places.some((q) => Math.abs(q.at[0] - R.at[0]) < 90 && q.at[1] - (top[1] + 22) < 62) ? bottom[1] - 24 : top[1] + 22;
    g.push(halo('ao', R.at[0], y, `AO ${callsign(R.name)}`, ' text-anchor="middle"'));
    g.push(`<text x="${f1(R.at[0])}" y="${f1(y + 14)}" class="sub" text-anchor="middle">${esc(R.name)}</text>`);
  });
  // the checkpoints: every stage across the game, numbered in the order the game reaches them
  let n = 0;
  for (const R of order) for (const s of R.trail.stops) {
    n += 1;
    g.push(`<circle cx="${s.at[0]}" cy="${s.at[1]}" r="8" fill="${P.paper}" stroke="${P.overlay}" stroke-width="1.6"${glow}><title>${esc(R.name)} · ${esc(s.node)} (${esc(s.section)})</title></circle>${halo('cp', s.at[0], s.at[1] + 3.6, String(n), ' text-anchor="middle"')}${s.section === 'meru' ? halo('lab', s.at[0] + 12, s.at[1] - 8, 'CLIMB') : ''}`);
  }
  // the phase lines where each road crosses into the next level, a passage point at a gate, a locked way's word
  for (const r of A.roads) {
    const m = r.path[Math.floor(r.path.length / 2)], q = r.path[Math.floor(r.path.length / 2) + 1] ?? r.path.at(-1), L = Math.hypot(q[0] - m[0], q[1] - m[1]) || 1, nx = -(q[1] - m[1]) / L, ny = (q[0] - m[0]) / L;
    const to = A.regions.find((x) => x.id === r.to);
    g.push(`<path d="M${f1(m[0] - nx * 46)} ${f1(m[1] - ny * 46)}L${f1(m[0] + nx * 46)} ${f1(m[1] + ny * 46)}" stroke="${P.overlay}" stroke-width="2"${glow}/>${halo('lab', m[0] + nx * 50, m[1] + ny * 50 + 4, `PL ${callsign(to.name).split(' ')[0]}`, ' text-anchor="middle"')}`);
    if (r.kind === 'gate') g.push(`<circle cx="${m[0]}" cy="${m[1]}" r="9" fill="${P.paper}" stroke="${P.overlay}" stroke-width="1.8"/>${halo('cp', m[0], m[1] + 3.6, 'PP', ' text-anchor="middle"')}`);
    if (r.key) g.push(halo('lab warn', m[0] - nx * 50, m[1] - ny * 50 + 4, 'LOCKED', ' text-anchor="middle"'));
  }
  // the start point, the base, the objective (the deepest level's trail end, ringed)
  const start = A.regions.find((R) => R.start) ?? order[0], hub = A.regions.find((R) => R.hub), obj = [...order].reverse()[0];
  const sp = start.trail.path[0];
  g.push(halo('lab', sp[0] + 14, sp[1] + 18, 'SP'));
  sprites.push({ kind: 'flag-sp', at: sp, s: 1.2 });
  if (hub) { const b = hub.places[0]?.at ?? hub.at; g.push(halo('lab', b[0] + 26, b[1] + 50, `BASE ${callsign(hub.name)}`)); sprites.push({ kind: 'flag-base', at: [b[0] - 30, b[1] + 34], s: 1.4 }); }
  if (obj && obj !== hub) {
    const e = obj.trail.path.at(-1), ring = Array.from({ length: 24 }, (_, i) => { const a = (i * Math.PI * 2) / 24, r = 26 + 4 * Math.sin(i * 1.7 + A.seed); return [f1(e[0] + r * Math.cos(a)), f1(e[1] + r * 0.8 * Math.sin(a))]; });
    g.push(`<polygon points="${pts(ring)}" fill="none" stroke="${P.objective}" stroke-width="2.8"${glow}/>${halo('obj', e[0], e[1] + 40, `OBJ ${callsign(obj.name)}`, ' text-anchor="middle"')}`);
    sprites.push({ kind: 'flag-obj', at: e, s: 1.4 });
  }
  // the margin: the title block, the north diagram, the scale
  const title = A.name ?? 'The world', bx = W - 330, by = H - 128;
  g.push(`<g class="tb"><rect x="${bx}" y="${by}" width="300" height="100" fill="${P.paper}" stroke="${P.overlay}" stroke-width="1.6"/><path d="M${bx} ${by + 26}H${bx + 300}M${bx} ${by + 74}H${bx + 300}" stroke="${P.overlay}" stroke-width=".8"/>${halo('tbk', bx + 10, by + 18, 'OPERATIONS MAP')}${halo('tbt', bx + 10, by + 55, callsign(title))}${halo('tbs', bx + 10, by + 90, `SHEET 1 · 1:25 000 · CI 20 M · ${A.regions.length} AO · ${n} CP`)}</g>`);
  const nx0 = bx - 70, ny0 = by + 90;
  g.push(`<g>${[['GN', 0, 70], ['TN', -16, 62], ['MN', 18, 56]].map(([t, a, len]) => { const r = (a * Math.PI) / 180, tip = [nx0 + len * Math.sin(r), ny0 - len * Math.cos(r)]; return `<path d="M${nx0} ${ny0}L${f1(tip[0])} ${f1(tip[1])}" stroke="${P.overlay}" stroke-width="${t === 'GN' ? 1.8 : 1.1}"${t === 'MN' ? ' stroke-dasharray="4 2"' : ''}/>${halo('lab', tip[0], tip[1] - 5, t, ' text-anchor="middle"')}`; }).join('')}</g>`);
  g.push(`<g transform="translate(40 ${H - 40})">${[0, 1, 2, 3].map((i) => `<rect x="${i * 50}" y="0" width="50" height="7" fill="${i % 2 ? P.paper : P.overlay}" stroke="${P.overlay}" stroke-width="1"/>`).join('')}${[0, 1, 2].map((i) => halo('grid', i * 100, -5, `${i}`, ' text-anchor="middle"')).join('')}${halo('grid', 205, 7, 'KM')}</g>`);
  if (P.hud) g.push(`<path d="M14 40V14H40M${W - 40} 14H${W - 14}V40M14 ${H - 40}V${H - 14}H40M${W - 40} ${H - 14}H${W - 14}V${H - 40}" fill="none" stroke="${P.overlay}" stroke-width="2.4"/>`);
  const legend = `<span><svg width="34" height="10"><path d="M2 5 h30" stroke="${P.roadCase}" stroke-width="5"/><path d="M2 5 h30" stroke="${P.road}" stroke-width="3"/></svg>road</span><span><svg width="34" height="10"><path d="M2 5 h30" stroke="${P.track}" stroke-width="1.8" stroke-dasharray="7 3"/></svg>track (a level's trail)</span><span><svg width="34" height="10"><path d="M2 5 h30" stroke="${P.overlay}" stroke-width="2.2" stroke-dasharray="16 4 3 4"/></svg>AO boundary (a level)</span><span><svg width="18" height="18"><circle cx="9" cy="9" r="7" fill="${P.paper}" stroke="${P.overlay}" stroke-width="1.6"/></svg>checkpoint (a stage)</span><span><svg width="18" height="18"><path d="M2 9 h14" stroke="${P.overlay}" stroke-width="2"/></svg>PL: phase line (into a level)</span><span><svg width="18" height="18"><circle cx="9" cy="9" r="7" fill="none" stroke="${P.objective}" stroke-width="2.4"/></svg>objective</span><span>${esc(TACTICAL_LOOKS[look].read)}</span>`;
  return {
    paint: P, fonts: 'family=Barlow+Condensed:wght@500;700&family=IBM+Plex+Mono:wght@400;500', body: '"IBM Plex Mono",ui-monospace,monospace', head: '"Barlow Condensed","Arial Narrow",sans-serif', spriteW: 2.3,
    css: `.ao{font:700 19px "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.14em;fill:${P.overlay};paint-order:stroke;stroke:${P.halo};stroke-width:4px}
.sub{font:500 11px "IBM Plex Mono",monospace;fill:${P.label};opacity:.8;paint-order:stroke;stroke:${P.halo};stroke-width:3px}
.lab{font:700 13px "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.1em;fill:${P.overlay};paint-order:stroke;stroke:${P.halo};stroke-width:3.5px}.lab.warn{fill:${P.objective}}
.obj{font:700 17px "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.12em;fill:${P.objective};paint-order:stroke;stroke:${P.halo};stroke-width:4px}
.cp{font:500 10px "IBM Plex Mono",monospace;fill:${P.overlay}}
.ht{font:500 9px "IBM Plex Mono",monospace;fill:${P.contourIndex};paint-order:stroke;stroke:${P.land};stroke-width:3px}
.grid{font:500 10px "IBM Plex Mono",monospace;fill:${P.grid === '#6e9ccf' ? '#3e6ea5' : P.ink};paint-order:stroke;stroke:${P.halo};stroke-width:3px}
.tbk{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.2em;fill:${P.label}}.tbt{font:700 26px "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.08em;fill:${P.label}}.tbs{font:500 9.5px "IBM Plex Mono",monospace;fill:${P.label}}
${P.scan ? '.scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px),radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.65));mix-blend-mode:multiply}' : ''}`,
    ground: g.join(''), symbols: Object.entries(S).map(([k, v]) => `<symbol id="${k}" viewBox="0 0 40 40" overflow="visible">${v}</symbol>`).join(''),
    sprites: sprites.sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]), legend, over: P.scan ? '<div class="scan"></div>' : '',
  };
}
