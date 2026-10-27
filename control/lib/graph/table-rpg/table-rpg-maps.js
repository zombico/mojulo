/**
 * THE TABLE RPG'S MAPS — a dungeon and a world drawn as the table reads them, before any walkable level exists: a
 * FLOWCHART of the dungeon (each room a numbered box, numbered as the key numbers it, laid in ranks by how many rooms
 * it is from the way in; each link drawn by its kind: a way a line, a door a bar across it, a stair three ticks, a lock
 * a filled square, a hidden way dashed and marked S, a one-way an arrow) and a POINT-CRAWL of the world (each place a
 * mark by its kind, each road a line with its days). SVG in `currentColor` and the press's colours (var(--paper),
 * var(--accent), var(--muted)), so a book's look recolours its maps.
 *
 *   roomNumbers(D) → { <room id>: n }       the key's numbers: the dungeon's rooms in their written order, from 1
 *   dungeonMapSvg(K, dungeonId, { legend? }) → svg
 *   worldMapSvg(K) → svg
 *   factionMapSvg(K) → svg   the factions as the party meets them: the party above, each faction a box below it with its
 *     standing at the start on the line between them, rivals joined by a dashed line, allies by a solid one
 * A map's size is its drawing's at MM a unit (width and height in millimetres), so a small map stays small on the page.
 *
 *   rankLayout(ids, edges, start) → { at: { id: [x, y] }, ranks: [[id]] }   ranks by distance from the start, each
 *     rank ordered by its neighbours in the rank before (the crossings fewer); ids no edge reaches stand in a last rank
 */
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
const MM = 0.62;
const svgOpen = (w, h, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r1(w)} ${r1(h)}" width="${r1(w * MM)}mm" height="${r1(h * MM)}mm" role="img" aria-label="${esc(label)}" stroke="currentColor" stroke-width=".8" font-family="var(--display, serif)">`;

export function roomNumbers(D) {
  return Object.fromEntries(Object.keys(D.rooms).map((id, i) => [id, i + 1]));
}

export function rankLayout(ids, edges, start) {
  const adj = new Map(ids.map((id) => [id, []]));
  for (const [a, b] of edges) { adj.get(a)?.push(b); adj.get(b)?.push(a); }
  const rank = new Map([[start, 0]]), order = [start];
  for (let i = 0; i < order.length; i++) for (const n of adj.get(order[i])) if (!rank.has(n)) { rank.set(n, rank.get(order[i]) + 1); order.push(n); }
  const last = Math.max(0, ...rank.values()) + 1;
  for (const id of ids) if (!rank.has(id)) { rank.set(id, last); order.push(id); }
  const ranks = [];
  for (const id of order) (ranks[rank.get(id)] ??= []).push(id);
  // one pass of barycentres: a rank ordered by the mean place of its neighbours in the rank before
  const pos = new Map();
  ranks.forEach((R, r) => {
    if (r > 0) {
      const bary = (id) => { const ns = adj.get(id).filter((n) => rank.get(n) === r - 1); return ns.length ? ns.reduce((a, n) => a + pos.get(n), 0) / ns.length : Infinity; };
      R.sort((a, b) => bary(a) - bary(b) || order.indexOf(a) - order.indexOf(b));
    }
    R.forEach((id, i) => pos.set(id, i - (R.length - 1) / 2));
  });
  const at = Object.fromEntries([...pos].map(([id, p]) => [id, [p, rank.get(id)]]));
  return { at, ranks: ranks.filter(Boolean) };
}

// a name in at most two lines of about `n` characters
function wrap(name, n) {
  const words = String(name).split(/\s+/), out = [''];
  for (const w of words) { if (out[out.length - 1] && (out[out.length - 1] + ' ' + w).length > n && out.length < 2) out.push(w); else out[out.length - 1] = out[out.length - 1] ? `${out[out.length - 1]} ${w}` : w; }
  return out;
}

const BOX = { w: 44, h: 18, dx: 54, dy: 32 };

/** The link's mark at its middle, by its kind, turned along the line. */
function linkMark(L, x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const t = `transform="translate(${r1(mx)} ${r1(my)}) rotate(${r1(ang)})"`;
  if (L.kind === 'door') return `<g ${t}><line x1="0" y1="-3.2" x2="0" y2="3.2" stroke-width="1.6"/></g>`;
  if (L.kind === 'stair') return `<g ${t}>${[-2.4, 0, 2.4].map((x) => `<line x1="${x}" y1="-2.6" x2="${x}" y2="2.6"/>`).join('')}</g>`;
  if (L.kind === 'locked') return `<g ${t}><rect x="-2.6" y="-2.6" width="5.2" height="5.2" fill="currentColor"/></g>`;
  if (L.kind === 'secret') return `<g transform="translate(${r1(mx)} ${r1(my)})"><circle r="3.4" fill="var(--paper,#fff)"/><text y="1.6" font-size="4.6" text-anchor="middle" fill="currentColor" stroke="none">S</text></g>`;
  return '';
}

export function dungeonMapSvg(K, did, { legend = true } = {}) {
  const D = K.D[did];
  if (!D) throw new Error(`table rpg map: no dungeon '${did}'`);
  const ids = Object.keys(D.rooms), num = roomNumbers(D);
  const links = [];
  for (const R of Object.values(D.rooms)) for (const e of R.exits) if (!links.includes(e.L)) links.push(e.L);
  const { at, ranks } = rankLayout(ids, links.map((l) => [l.a, l.b]), D.entry);
  const width = Math.max(...ranks.map((R) => R.length)) * BOX.dx;
  const X = (id) => width / 2 + at[id][0] * BOX.dx, Y = (id) => 14 + at[id][1] * BOX.dy + BOX.h / 2;
  const H = 14 + ranks.length * BOX.dy + (legend ? 16 : 0);
  const out = [];
  for (const L of links) {
    const [x1, y1, x2, y2] = [X(L.a), Y(L.a), X(L.b), Y(L.b)];
    const same = at[L.a][1] === at[L.b][1], far = Math.abs(at[L.a][1] - at[L.b][1]) > 1;
    // a link within a rank runs under the two boxes, bowing into the gap below them; one past a rank bows sideways;
    // so neither runs through the boxes between (the mark sits at the bow's middle)
    let d, mx = null;
    if (same) {
      const yb = y1 + BOX.h / 2, bow = (BOX.dy - BOX.h) * 0.9;
      d = `M${r1(x1)} ${r1(yb)} Q${r1((x1 + x2) / 2)} ${r1(yb + bow * 2)} ${r1(x2)} ${r1(yb)}`;
      mx = [(x1 + x2) / 2, yb + bow];
    } else if (far) {
      d = `M${r1(x1)} ${r1(y1)} Q${r1((x1 + x2) / 2 + BOX.dx * 0.6)} ${r1((y1 + y2) / 2)} ${r1(x2)} ${r1(y2)}`;
      mx = [(x1 + x2) / 2 + BOX.dx * 0.3, (y1 + y2) / 2];
    } else d = `M${r1(x1)} ${r1(y1)} L${r1(x2)} ${r1(y2)}`;
    out.push(`<path class="link ${L.kind}" d="${d}" fill="none"${L.kind === 'secret' ? ' stroke-dasharray="2.2 1.8"' : ''}${L.oneWay ? ' marker-end="url(#arrow)"' : ''}/>`);
    out.push(mx ? linkMark(L, mx[0] - 1, mx[1], mx[0] + 1, mx[1]) : linkMark(L, x1, y1, x2, y2));
  }
  for (const id of ids) {
    const R = D.rooms[id], x = X(id) - BOX.w / 2, y = Y(id) - BOX.h / 2;
    const lines = wrap(R.name.replace(/^the /i, ''), 16);
    const entry = id === D.entry, foes = (R.foes ?? []).length;
    out.push(`<g class="room" id="room-${esc(id)}"><rect x="${r1(x)}" y="${r1(y)}" width="${BOX.w}" height="${BOX.h}" rx="2" fill="var(--paper,#fff)"${entry ? ' stroke-width="1.6"' : ''}/>`
      + `<circle cx="${r1(x)}" cy="${r1(y)}" r="4.2" fill="currentColor"/><text x="${r1(x)}" y="${r1(y + 1.6)}" font-size="4.6" text-anchor="middle" fill="var(--paper,#fff)" stroke="none" font-weight="700">${num[id]}</text>`
      + lines.map((l, i) => `<text x="${r1(X(id))}" y="${r1(Y(id) + (i - (lines.length - 1) / 2) * 5 + 1.6)}" font-size="4.4" text-anchor="middle" fill="currentColor" stroke="none">${esc(l)}</text>`).join('')
      + (foes ? `<text x="${r1(x + BOX.w - 2)}" y="${r1(y + 4.6)}" font-size="4" text-anchor="end" fill="var(--accent,currentColor)" stroke="none">✕${foes > 1 ? foes : ''}</text>` : '')
      + '</g>');
  }
  if (legend) {
    const ly = H - 8, items = [['way', 'open'], ['door', 'door'], ['stair', 'stair'], ['locked', 'locked'], ['hidden', 'secret']];
    const step = width / items.length;
    items.forEach(([word, kind], i) => {
      const x = i * step + 4;
      out.push(`<path d="M${r1(x)} ${ly} L${r1(x + 14)} ${ly}" fill="none"${kind === 'secret' ? ' stroke-dasharray="2.2 1.8"' : ''}/>${linkMark({ kind }, x, ly, x + 14, ly)}<text x="${r1(x + 17)}" y="${ly + 1.5}" font-size="4" fill="var(--muted,currentColor)" stroke="none">${word}</text>`);
    });
  }
  return svgOpen(width, H, `Map of ${D.name}`)
    + '<defs><marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6 z" fill="currentColor" stroke="none"/></marker></defs>'
    + out.join('') + '</svg>';
}

// a place's mark by its kind
function placeMark(kind, x, y) {
  if (kind === 'town') return `<rect x="${r1(x - 4.5)}" y="${r1(y - 4.5)}" width="9" height="9" fill="currentColor"/>`;
  if (kind === 'dungeon' || kind === 'lair') return `<path d="M${r1(x - 5)} ${r1(y + 4.5)} L${r1(x - 5)} ${r1(y - 1)} A5 5 0 0 1 ${r1(x + 5)} ${r1(y - 1)} L${r1(x + 5)} ${r1(y + 4.5)} Z" fill="var(--paper,#fff)" stroke-width="1.4"/><rect x="${r1(x - 1.6)}" y="${r1(y)}" width="3.2" height="4.5" fill="currentColor"/>`;
  if (kind === 'landmark') return `<path d="M${r1(x)} ${r1(y - 5.5)} L${r1(x + 5)} ${r1(y)} L${r1(x)} ${r1(y + 5.5)} L${r1(x - 5)} ${r1(y)} Z" fill="var(--paper,#fff)" stroke-width="1.2"/>`;
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="4.5" fill="var(--paper,#fff)" stroke-width="1.2"/>`;
}

export function worldMapSvg(K) {
  const ids = Object.keys(K.places), routes = [];
  for (const r of K.M.world.routes ?? []) routes.push(r);
  const { at, ranks } = rankLayout(ids, routes.map((r) => [r.a, r.b]), K.M.world.start);
  const dx = 70, dy = 40;
  // the world reads left to right, from the start
  const X = (id) => 24 + at[id][1] * dx, Y = (id) => 22 + (at[id][0] + (Math.max(...ranks.map((R) => R.length)) - 1) / 2) * dy;
  const W = 48 + (ranks.length - 1) * dx, H = 30 + (Math.max(...ranks.map((R) => R.length)) - 1) * dy + 14;
  const out = [];
  for (const r of routes) {
    const [x1, y1, x2, y2] = [X(r.a), Y(r.a), X(r.b), Y(r.b)];
    out.push(`<path class="road" d="M${r1(x1)} ${r1(y1)} L${r1(x2)} ${r1(y2)}" fill="none" stroke-dasharray="${r.danger ? '3 1.6' : 'none'}"/>`);
    const days = r.days ?? 1;
    out.push(`<text x="${r1((x1 + x2) / 2)}" y="${r1((y1 + y2) / 2 - 2.5)}" font-size="4.4" text-anchor="middle" fill="var(--muted,currentColor)" stroke="none">${days} day${days === 1 ? '' : 's'}</text>`);
  }
  for (const id of ids) {
    const P = K.places[id];
    out.push(`<g class="place" id="place-${esc(id)}">${placeMark(P.kind, X(id), Y(id))}<text x="${r1(X(id))}" y="${r1(Y(id) + 11)}" font-size="5" text-anchor="middle" fill="currentColor" stroke="none">${esc(P.name.replace(/^the /i, ''))}</text>${id === K.M.world.start ? `<text x="${r1(X(id))}" y="${r1(Y(id) - 8)}" font-size="3.8" text-anchor="middle" fill="var(--accent,currentColor)" stroke="none">start</text>` : ''}</g>`);
  }
  return `${svgOpen(W, H, 'Map of the world')}${out.join('')}</svg>`;
}

export function factionMapSvg(K) {
  const F = Object.values(K.factions), STAND = ['hostile', 'wary', 'neutral', 'friendly', 'allied'];
  const w = (F_) => Math.max(40, F_.name.length * 2.7 + 10), gap = 18, boxH = 16;
  const widths = F.map(w), W = Math.max(60, widths.reduce((a, b) => a + b, 0) + gap * (F.length - 1) + 16);
  const X = [];
  let x = 8;
  for (const bw of widths) { X.push(x + bw / 2); x += bw + gap; }
  const py = 12, fy = 52, H = fy + boxH / 2 + 8 + (F.length > 2 ? 14 : 0);
  const out = [];
  F.forEach((f, i) => {
    const n = f.standing ?? 0;
    out.push(`<path class="standing" d="M${r1(W / 2)} ${py + 6} L${r1(X[i])} ${fy - boxH / 2}" fill="none" stroke="var(--muted,currentColor)"/>`);
    out.push(`<text x="${r1((W / 2 + X[i]) / 2 + (X[i] < W / 2 ? -3 : X[i] > W / 2 ? 3 : 2))}" y="${r1((py + fy) / 2)}" font-size="4.2" text-anchor="${X[i] < W / 2 ? 'end' : 'start'}" fill="var(--accent,currentColor)" stroke="none">${STAND[n + 2]}</text>`);
  });
  const drawn = new Set();
  F.forEach((f, i) => {
    for (const [kind, others] of [['rivals', f.rivals], ['allies', f.allies]]) for (const o of others) {
      const j = F.findIndex((g) => g.id === o), key = [kind, ...[f.id, o].sort()].join('|');
      if (j < 0 || drawn.has(key)) continue;
      drawn.add(key);
      const [a, b] = i < j ? [i, j] : [j, i], dash = kind === 'rivals' ? ' stroke-dasharray="2.4 1.6"' : '';
      if (b - a === 1) {
        out.push(`<path class="tie ${kind}" d="M${r1(X[a] + widths[a] / 2)} ${fy} L${r1(X[b] - widths[b] / 2)} ${fy}" fill="none"${dash}/>`);
        out.push(`<text x="${r1((X[a] + widths[a] / 2 + X[b] - widths[b] / 2) / 2)}" y="${fy - 2}" font-size="3.8" text-anchor="middle" fill="var(--muted,currentColor)" stroke="none">${kind}</text>`);
      } else {
        const low = fy + boxH / 2 + 10;
        out.push(`<path class="tie ${kind}" d="M${r1(X[a])} ${fy + boxH / 2} Q${r1((X[a] + X[b]) / 2)} ${low + 6} ${r1(X[b])} ${fy + boxH / 2}" fill="none"${dash}/>`);
        out.push(`<text x="${r1((X[a] + X[b]) / 2)}" y="${low + 5}" font-size="3.8" text-anchor="middle" fill="var(--muted,currentColor)" stroke="none">${kind}</text>`);
      }
    }
  });
  out.push(`<g class="party"><circle cx="${r1(W / 2)}" cy="${py}" r="5" fill="var(--accent,currentColor)" stroke="none"/><text x="${r1(W / 2)}" y="${py - 7}" font-size="4.4" text-anchor="middle" fill="currentColor" stroke="none">the party</text></g>`);
  F.forEach((f, i) => out.push(`<g class="faction" id="faction-${esc(f.id)}"><rect x="${r1(X[i] - widths[i] / 2)}" y="${fy - boxH / 2}" width="${r1(widths[i])}" height="${boxH}" rx="2" fill="var(--paper,#fff)"/><text x="${r1(X[i])}" y="${fy + 1.8}" font-size="5" text-anchor="middle" fill="currentColor" stroke="none">${esc(f.name)}</text></g>`));
  return `${svgOpen(W, H, 'The factions and the party')}${out.join('')}</svg>`;
}
