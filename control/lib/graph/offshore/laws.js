/**
 * THE RIG'S LAWS — what a rig level must hold for a body sneaking over it, each read off the plan (plan.js) the way the
 * page's minds and the route search read the world: a body's width over the floor left, a watcher's eye over the boxes.
 * They advise; none refuses.
 *
 *   railed           every edge of a floor that falls away carries a rail, but a stair's head
 *   joined           every deck reaches every other by its stairs, and on each deck every way on and off (a stair's
 *                    foot or head, the start, the goal) reaches every other over the floor, a body's width
 *   carried          every tile of a deck stands within `SPAN` of a pillar under it (a column, a leg)
 *   stairs-clear     a body's width of floor before each stair's foot and past its head, no pillar or module on it
 *   sight-broken     from no stair onto a deck does a watcher standing there see more than three quarters of the floor a
 *                    standing body stands on (a deck of 150 m² or more)
 *   cover-in-reach   nine tenths of every deck's floor lies within 3 m of a piece a crouch hides behind (a pillar, a
 *                    wall, a module of crouch height or more); a floor bare by its use (the helideck) is read by neither
 *
 *   rigLaws(plan) → [{ law, holds, says, deck? }]
 *   floorGrid(plan, deckId, cell?) → { cells: [{ at, free }], ... } the deck's floor at a half metre, what is open on it
 */
import { BODY, FLOORS, stopsOf } from './tiles.js';
import { deckBoxes, DIRS } from './plan.js';
import { sees } from '../gameworld/stealth-routes.js';

/** the farthest a deck's tile stands from a pillar carrying it, metres */
export const SPAN = 7.5;

/** a deck's floor laid out at a half metre: each cell's middle, whether a body stands there (no box in its way) */
export function floorGrid(plan, deckId, step = 0.5) {
  const d = plan.decks.find((e) => e.id === deckId), C = plan.cell, boxes = deckBoxes(plan, deckId), R = BODY.r;
  const [X0, Y0, X1, Y1] = plan.bounds, nx = Math.round((X1 - X0) / step), ny = Math.round((Y1 - Y0) / step), cells = [];
  for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
    const x = X0 + (a + 0.5) * step, y = Y0 + (b + 0.5) * step, i = Math.floor(x / C), j = Math.floor(y / C);
    const floor = !!d.floor[j * plan.W + i];
    const free = floor && !boxes.some((B) => !B.void && B.max[2] > 0.4 && B.min[2] < 1.2 && x > B.min[0] - R && x < B.max[0] + R && y > B.min[1] - R && y < B.max[1] + R)
      && !boxes.some((B) => B.void && x > B.min[0] - R && x < B.max[0] + R && y > B.min[1] - R && y < B.max[1] + R);
    const under = floor && boxes.some((B) => !B.void && x > B.min[0] && x < B.max[0] && y > B.min[1] && y < B.max[1] && B.min[2] < 1.2 && B.max[2] > 0.4);
    cells.push({ at: [x, y], floor, free, under });
  }
  return { nx, ny, step, origin: [X0, Y0], cells, boxes };
}

/** the cell of the grid a point lies in */
const cellAt = (G, p) => Math.min(G.ny - 1, Math.max(0, Math.floor((p[1] - G.origin[1]) / G.step))) * G.nx + Math.min(G.nx - 1, Math.max(0, Math.floor((p[0] - G.origin[0]) / G.step)));
/** every free cell a body reaches from `from`, eight ways */
function reach(G, from) {
  const seen = new Uint8Array(G.cells.length), q = [];
  let s = cellAt(G, from);
  if (!G.cells[s].free) { let best = null; for (let k = 0; k < G.cells.length; k++) if (G.cells[k].free) { const c = G.cells[k].at, dd = Math.hypot(c[0] - from[0], c[1] - from[1]); if (dd < 1 && (!best || dd < best.d)) best = { k, d: dd }; } if (!best) return seen; s = best.k; }
  seen[s] = 1; q.push(s);
  while (q.length) {
    const u = q.pop(), a = u % G.nx, b = Math.floor(u / G.nx);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = a + dx, y = b + dy; if (x < 0 || y < 0 || x >= G.nx || y >= G.ny) continue;
      const v = y * G.nx + x; if (seen[v] || !G.cells[v].free) continue;
      if (dx && dy && (!G.cells[b * G.nx + x].free || !G.cells[y * G.nx + a].free)) continue;
      seen[v] = 1; q.push(v);
    }
  }
  return seen;
}
const near = (G, seen, p) => { for (let k = 0; k < G.cells.length; k++) if (seen[k]) { const c = G.cells[k].at; if (Math.hypot(c[0] - p[0], c[1] - p[1]) < 0.9) return true; } return false; };

export function rigLaws(plan) {
  const laws = [], C = plan.cell, { W, H } = plan;
  // RAILED: the edges the plan left open (a deck whose rail is none)
  {
    let open = 0;
    const heads = new Set(plan.stairs.map((S) => `${S.to}:${S.arrival}:${S.dir}`)), railed = new Set();
    for (const r of plan.rails) { const X = r.normal.endsWith('x'); for (let s = r.lo; s < r.hi - 1e-9; s += C) railed.add(`${r.deck}|${r.normal}|${X ? r.line : s}|${X ? s : r.line}`); }
    for (const d of plan.decks) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!d.floor[j * W + i]) continue;
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
        const a = i + dx, b = j + dy;
        if (a >= 0 && b >= 0 && a < W && b < H && d.floor[b * W + a]) continue;
        if (heads.has(`${d.id}:${i},${j}:${dir}`)) continue;
        const X = dx !== 0, line = X ? (dx > 0 ? (i + 1) * C : i * C) : (dy > 0 ? (j + 1) * C : j * C);
        if (!railed.has(`${d.id}|${dir}|${X ? line : i * C}|${X ? j * C : line}`)) open++;
      }
    }
    laws.push({ law: 'railed', holds: open === 0, says: open ? `${open} open edges fall away unrailed` : 'every open edge carries a rail but the stairs\' heads' });
  }
  // JOINED: the decks by their stairs; on each deck its ways on and off by its floor
  {
    const link = new Map(plan.decks.map((d) => [d.id, new Set()]));
    for (const S of plan.stairs) { link.get(S.from).add(S.to); link.get(S.to).add(S.from); }
    const seen = new Set([plan.decks[0].id]), q = [plan.decks[0].id];
    while (q.length) for (const n of link.get(q.pop())) if (!seen.has(n)) { seen.add(n); q.push(n); }
    const cut = plan.decks.filter((d) => !seen.has(d.id)).map((d) => d.id);
    const apart = [];
    for (const d of plan.decks) {
      const P = plan.ports.filter((p) => p.deck === d.id);
      if (P.length < 2) continue;
      const G = floorGrid(plan, d.id), S = reach(G, P[0].at);
      for (const p of P.slice(1)) if (!near(G, S, p.at)) apart.push(`${d.id}: ${p.of} from ${P[0].of}`);
    }
    laws.push({ law: 'joined', holds: !cut.length && !apart.length, says: cut.length ? `no stair reaches ${cut.join(', ')}` : apart.length ? `cut off over the floor: ${apart.join('; ')}` : 'every deck reaches every other, and each one\'s ways on and off reach each other' });
  }
  // CARRIED: each tile within SPAN of a pillar under it
  {
    const loose = [];
    for (const d of plan.decks) {
      const under = plan.pillars.filter((p) => (p.kind === 'leg' ? p.z1 >= d.z : p.carries === d.id));
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (!d.floor[j * W + i]) continue;
        const x = (i + 0.5) * C, y = (j + 0.5) * C;
        if (!under.some((p) => Math.hypot(p.at[0] - x, p.at[1] - y) <= SPAN)) loose.push(`${d.id} [${i}, ${j}]`);
      }
    }
    laws.push({ law: 'carried', holds: !loose.length, says: loose.length ? `${loose.length} tiles over ${SPAN} m from a pillar: ${loose.slice(0, 6).join(', ')}${loose.length > 6 ? ' …' : ''}` : `every tile within ${SPAN} m of a pillar carrying it` });
  }
  // STAIRS-CLEAR: a body's width before each foot and past each head
  {
    const blocked = [], h = BODY.pass / 2;
    for (const p of plan.ports.filter((q) => /:(foot|head)$/.test(q.of))) {
      const B = deckBoxes(plan, p.deck).filter((b) => !b.void && !b.stair && b.max[2] > 0.4 && b.min[2] < 1.2);
      if (B.some((b) => p.at[0] + h > b.min[0] && p.at[0] - h < b.max[0] && p.at[1] + h > b.min[1] && p.at[1] - h < b.max[1])) blocked.push(p.of);
    }
    laws.push({ law: 'stairs-clear', holds: !blocked.length, says: blocked.length ? `a piece stands in the way at ${blocked.join(', ')}` : 'each stair\'s foot and head is clear a body\'s width' });
  }
  // MODULES-PLACED: each standing module wholly on its deck's floor, clear of the pillars and the stairs
  {
    const off = [];
    for (const m of plan.modules) {
      if (m.solid === 'none') continue;
      const d = plan.decks.find((e) => e.id === m.deck);
      let floor = true;
      for (let x = m.min[0] + 0.1; x < m.max[0]; x += 0.5) for (let y = m.min[1] + 0.1; y < m.max[1]; y += 0.5) { const i = Math.floor(x / C), j = Math.floor(y / C); if (i < 0 || j < 0 || i >= W || j >= H || !d.floor[j * W + i]) floor = false; }
      const hit = (b) => m.min[0] < b.max[0] && m.max[0] > b.min[0] && m.min[1] < b.max[1] && m.max[1] > b.min[1];
      const clash = deckBoxes(plan, m.deck).filter((b) => (b.pillar || b.stair) && hit(b)).map((b) => b.pillar ?? b.stair);
      if (!floor || clash.length) off.push(`${m.id}${!floor ? ' off its floor' : ''}${clash.length ? ` on a ${clash[0]}` : ''}`);
    }
    laws.push({ law: 'modules-placed', holds: !off.length, says: off.length ? off.join('; ') : 'every module on its floor, clear of the pillars and the stairs' });
  }
  // SIGHT-BROKEN and COVER-IN-REACH, deck by deck
  {
    const wide = [], bare = [];
    for (const d of plan.decks) {
      // (a floor bare by its use, the helideck's pad, is left out of both: it is crossed, never hidden on)
      const G = floorGrid(plan, d.id, 1), bareUse = (c) => FLOORS[d.floor[Math.floor(c.at[1] / C) * W + Math.floor(c.at[0] / C)]]?.open;
      const open = G.cells.filter((c) => c.free && !bareUse(c)), area = open.length;
      if (!area) continue;
      if (area >= 150) {
        for (const p of plan.ports.filter((q) => q.deck === d.id && /:(foot|head)$/.test(q.of))) {
          const w = { at: p.at, heading: 0, cone: Math.PI, range: 40, eye: BODY.watcher };
          const seen = open.filter((c) => sees(w, c.at, BODY.eye, 0, G.boxes)).length / area;
          if (seen > 0.75) wide.push(`${d.id} from ${p.of} (${Math.round(seen * 100)}%)`);
        }
      }
      const cover = G.boxes.filter((b) => !b.void && !b.stair ? stopsOf(b.max[2] - b.min[2]) === 'stand' || stopsOf(b.max[2] - b.min[2]) === 'crouch' : !!b.stair);
      const inReach = open.filter((c) => cover.some((b) => Math.hypot(Math.max(b.min[0] - c.at[0], 0, c.at[0] - b.max[0]), Math.max(b.min[1] - c.at[1], 0, c.at[1] - b.max[1])) <= 3)).length / area;
      if (inReach < 0.9) bare.push(`${d.id} (${Math.round(inReach * 100)}%)`);
    }
    laws.push({ law: 'sight-broken', holds: !wide.length, says: wide.length ? `seen nearly whole: ${wide.join('; ')}` : 'from no way onto a deck is three quarters of it seen' });
    laws.push({ law: 'cover-in-reach', holds: !bare.length, says: bare.length ? `cover out of reach on ${bare.join(', ')}` : 'nine tenths of every deck within 3 m of cover' });
  }
  return laws;
}
