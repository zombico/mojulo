/**
 * THE GEOCITY'S BLOCKS — inside each neighbourhood, its own streets and the blocks they leave, each block given to a
 * segment by the ring it builds as, its storeys read off the height field and its ground shared out. Layer by layer,
 * each its own dice:
 *
 *   streets   COLLECTORS first: a neighbourhood wider than the card's `collector` span gets one across it each way, near
 *             its middle (a geotown's main street, in its section), moved off its park to run along it; then its park's
 *             edges (a street round it, unless the strip between it and the neighbourhood's edge is under a block's
 *             least, when the park takes the strip); then LOCALS between those fixed lines, each gap cut into the whole
 *             number of blocks its ring's block length allows, jittered: square blocks of the grammar's pitch in the core
 *             and the frame (its minor section), the geotown's long blocks in the outskirts (its street's section),
 *             running north and south. A street through the park is cut by it
 *   blocks    the cells the streets leave; the park one block; each block its sides (an arterial, a collector, a local,
 *             the water, the beyond)
 *   segments  by ring (segments.js): the core's blocks towers or podiums by weight, a square at its middle; the
 *             frame's with a long side on an arterial mid-rise, the rest mid-rise or slabs; the outskirts' with a long
 *             side on an arterial an edge (its avenue facing it), on a collector a main street (a short end on either is
 *             its houses' corners), a school at its middle, the rest houses, walk-ups and low-rises by weight
 *   storeys   the field's median at the block's middle inside its ring's rail, a block on an arterial its frontage's;
 *             a tower block's towers past it (the core's tail) and its podium
 *   ground    its segment's shares of its area, every square metre once
 *
 *   blocksOf(d) → { <region id>: { streets: [{ id, axis, at, w, rank, runs }], blocks: [block], park: rect | null,
 *                   ledger: { area, streets, blocks, park, surfaces } } }
 *   block: { id, rect, area, kind, ring, sides: { n, e, s, w: { kind, rank? } }, storeys: { median, rail }, podium?,
 *            towers?: [{ rect, storeys }], surfaces: { <surface>: m² } }
 *
 * Pure: a neighbourhood's dice are its own (`${seed}|blocks-v1|<id>:<layer>`), so a change to one moves no other.
 */
import { streamOf } from '../city/plan/dice.js';
import { sectionOf } from '../geotown/pattern.js';
import { CARDS, segmentShares } from './segments.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
const inside = (p, r) => p[0] > r[0] && p[0] < r[2] && p[1] > r[1] && p[1] < r[3];
const gauss = (R) => Math.sqrt(-2 * Math.log(Math.max(1e-9, R()))) * Math.cos(2 * Math.PI * R());
// a gap's blocks are jittered this share of their length
const JITTER = 0.15;
// a block under this share of its ring's least is cut no further (a gap of one)
const LEAST = 0.6;

/** A weighted pick on a stream. */
const pick = (R, weights) => { const es = Object.entries(weights).filter(([, w]) => w > 0), t = es.reduce((s, [, w]) => s + w, 0); let u = R() * t; for (const [k, w] of es) { if ((u -= w) < 0) return k; } return es[es.length - 1][0]; };

/** Locals between fixed lines along one axis: each gap cut into whole blocks of `size`, `w` the local street. */
function locals(a, b, fixed, size, w, R) {
  const out = [], ends = [{ at: a, w: 0 }, ...fixed.slice().sort((p, q) => p.at - q.at), { at: b, w: 0 }], mean = (size[0] + size[1]) / 2;
  for (let k = 0; k + 1 < ends.length; k++) {
    const p = ends[k].at + ends[k].w / 2, q = ends[k + 1].at - ends[k + 1].w / 2, g = q - p;
    if (g <= 0) continue;
    let n = Math.max(1, Math.round((g + w) / (mean + w)));
    while (n > 1 && (g - (n - 1) * w) / n < size[0] * LEAST) n--;
    const blk = (g - (n - 1) * w) / n;
    for (let i = 1; i < n; i++) out.push({ at: r3(p + i * blk + (i - 1) * w + w / 2 + (R() - 0.5) * 2 * JITTER * blk * 0.5), w, rank: 'local' });
  }
  return out;
}

export function blocksOf(d) {
  const M = d.metro, G = d.grammar, P = d.spec.pattern, out = {};
  const localRow = (ring) => (ring === 'outskirts' ? sectionOf(P, 'street').row : r3(G.street.minor.road + 2 * G.street.minor.walk));
  const collectorRow = sectionOf(P, 'main').row;
  for (const r of d.regions) {
    const [x0, y0, x1, y1] = r.rect, ring = r.builds, R = (layer) => streamOf(d.seed, 'blocks', `${r.id}:${layer}`);
    // a geotown's neighbourhood (towns.js): no blocks of the metro's; its ground the town's ledger (its streets, the rest
    // its plots' and sites'), and the green round its frame
    if (r.geotown) {
      const town = r.geotown.design.ledger.town, STREETS = ['road', 'verge', 'walk', 'furnish', 'parking'], surfaces = {};
      let streets = 0;
      for (const [k, v] of Object.entries(town)) { if (!(v > 0)) continue; if (STREETS.includes(k)) streets += v; else surfaces[k] = r3(v); }
      if (r.geotown.rest > 0) surfaces.margin = r.geotown.rest;
      const blocksArea = Object.values(surfaces).reduce((a, v) => a + v, 0);
      out[r.id] = { streets: [], blocks: [], park: null, ledger: { area: r.area, streets: r3(r.area - blocksArea), blocks: r3(blocksArea), park: 0, surfaces } };
      continue;
    }
    if (r.park) {
      out[r.id] = { streets: [], blocks: [{ id: `${r.id}.park`, rect: r.rect, area: r.area, kind: 'park', ring, sides: r.sides, storeys: { median: 0, rail: [0, 0] }, surfaces: { park: r.area } }], park: r.rect, ledger: { area: r.area, streets: 0, blocks: 0, park: r.area, surfaces: { park: r.area } } };
      continue;
    }
    const w = localRow(ring), sizes = ring === 'outskirts' ? { x: P.block.depth.map((v) => 2 * v), y: P.block.long } : { x: G.block.pitch.map((v) => v - w), y: G.block.pitch.map((v) => v - w) };
    // the park, fitted to the streets: a strip under a block's least between it and an edge is the park's
    let pk = r.parkRect ? [...r.parkRect.rect] : null;
    if (pk) {
      const least = { x: sizes.x[0] * LEAST + w, y: sizes.y[0] * LEAST + w };
      if (pk[0] - x0 < least.x) pk[0] = x0; if (x1 - pk[2] < least.x) pk[2] = x1;
      if (pk[1] - y0 < least.y) pk[1] = y0; if (y1 - pk[3] < least.y) pk[3] = y1;
      pk = pk.map(r3);
    }
    // the collectors: across each way where the neighbourhood is wider than the span, near its middle, off its park
    const fixed = { x: [], y: [] };
    for (const [axis, lo, hi, plo, phi] of [['x', x0, x1, pk?.[0], pk?.[2]], ['y', y0, y1, pk?.[1], pk?.[3]]]) {
      if (hi - lo <= M.streets.collector) continue;
      let at = (lo + hi) / 2 + (R(`collector:${axis}`)() - 0.5) * 0.2 * (hi - lo);
      if (pk && at > plo - collectorRow / 2 && at < phi + collectorRow / 2) at = at - plo < phi - at ? plo - collectorRow / 2 : phi + collectorRow / 2;
      if (at - collectorRow / 2 > lo + sizes[axis][0] * LEAST && at + collectorRow / 2 < hi - sizes[axis][0] * LEAST) fixed[axis].push({ at: r3(at), w: collectorRow, rank: 'collector' });
    }
    // the park's edges, a street round it (none where it meets the neighbourhood's edge, or a collector runs along it)
    if (pk) for (const [axis, e, out_, lo, hi] of [['x', pk[0], -1, x0, x1], ['x', pk[2], 1, x0, x1], ['y', pk[1], -1, y0, y1], ['y', pk[3], 1, y0, y1]]) {
      if (e <= lo + 1e-6 || e >= hi - 1e-6) continue;
      const at = r3(e + out_ * w / 2);
      if (fixed[axis].some((f) => Math.abs(f.at - (e + out_ * f.w / 2)) < 1e-3)) continue;
      fixed[axis].push({ at, w, rank: 'local', park: true });
    }
    const xs = [...fixed.x, ...locals(x0, x1, fixed.x, sizes.x, w, R('locals:x'))].sort((p, q) => p.at - q.at);
    const ys = [...fixed.y, ...locals(y0, y1, fixed.y, sizes.y, w, R('locals:y'))].sort((p, q) => p.at - q.at);
    // each street's runs: its length inside the neighbourhood, less the park it would cross
    const runsOf = (axis, at, lo, hi) => (pk && at > pk[axis === 'x' ? 0 : 1] && at < pk[axis === 'x' ? 2 : 3] ? [[lo, pk[axis === 'x' ? 1 : 0]], [pk[axis === 'x' ? 3 : 2], hi]] : [[lo, hi]]).filter(([a, b]) => b - a > 1e-6).map((s) => s.map(r3));
    const streets = [...xs.map((l, k) => ({ id: `${r.id}:ns-${k}`, axis: 'ns', ...l, runs: runsOf('x', l.at, y0, y1) })), ...ys.map((l, k) => ({ id: `${r.id}:ew-${k}`, axis: 'ew', ...l, runs: runsOf('y', l.at, x0, x1) }))];

    // the cells, the park one block
    const bx = [{ at: x0, w: 0, edge: 'w' }, ...xs, { at: x1, w: 0, edge: 'e' }], by = [{ at: y0, w: 0, edge: 's' }, ...ys, { at: y1, w: 0, edge: 'n' }];
    const cells = [];
    for (let j = 0; j + 1 < by.length; j++) for (let i = 0; i + 1 < bx.length; i++) {
      const rect = [bx[i].at + bx[i].w / 2, by[j].at + by[j].w / 2, bx[i + 1].at - bx[i + 1].w / 2, by[j + 1].at - by[j + 1].w / 2].map(r3);
      if (rect[2] - rect[0] <= 1e-6 || rect[3] - rect[1] <= 1e-6) continue;
      if (pk && inside([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2], pk)) continue;
      const side = (l, s) => (l.edge ? r.sides[s] : { kind: 'street', rank: l.rank });
      cells.push({ i, j, rect, sides: { w: side(bx[i], 'w'), e: side(bx[i + 1], 'e'), s: side(by[j], 's'), n: side(by[j + 1], 'n') } });
    }

    // the segments by ring: a geotown's edge and main street face their street along their LONG side (a block's short
    // end on an arterial is its houses' corners); the core's blocks by its weights; the civic block the one nearest the
    // neighbourhood's middle, off its arterials where one is
    const longSides = (c) => (c.rect[3] - c.rect[1] >= c.rect[2] - c.rect[0] ? ['w', 'e'] : ['s', 'n']);
    const onLong = (c, rank) => longSides(c).some((k) => (rank === 'arterial' ? c.sides[k].kind === 'arterial' : c.sides[k].rank === rank));
    const onAny = (c, rank) => Object.values(c.sides).some((v) => (rank === 'arterial' ? v.kind === 'arterial' : v.rank === rank));
    const mid = [(x0 + x1) / 2, (y0 + y1) / 2], near = (c) => Math.hypot((c.rect[0] + c.rect[2]) / 2 - mid[0], (c.rect[1] + c.rect[3]) / 2 - mid[1]);
    // (off the arterials, else off their long sides, else any: a neighbourhood two blocks deep has no block off them)
    const byNear = (cs) => cs.slice().sort((p, q) => near(p) - near(q));
    const calm = [...byNear(cells.filter((c) => !onAny(c, 'arterial'))), ...byNear(cells.filter((c) => onAny(c, 'arterial') && !onLong(c, 'arterial'))), ...byNear(cells.filter((c) => onLong(c, 'arterial')))];
    const Rs = R('segments');
    const civic = ring === 'core' ? 'square' : ring === 'outskirts' ? 'school' : null, civicAt = civic && cells.length >= M.streets.civic ? calm.find((c) => civic !== 'school' || area(c.rect) >= M.streets.school) : null;
    const mix = M.segments[ring];
    const blocks = cells.map((c) => {
      const kind = c === civicAt ? civic
        : ring === 'core' ? pick(Rs, mix)
          : ring === 'frame' ? (onLong(c, 'arterial') ? 'midrise' : pick(Rs, mix))
            : onLong(c, 'arterial') ? 'edge' : onLong(c, 'collector') ? 'main-street' : pick(Rs, mix);
      // the city changing: a share of the blocks (off the civic one) a site, a lot, a vacant lot, on its own dice
      const Rl = streamOf(d.seed, 'blocks', `${r.id}.${c.i}.${c.j}:lively`), u = Rl(), L = M.lively[ring];
      const lively = c === civicAt ? null : u < L.construction ? 'construction' : u < L.construction + L.parking ? 'parking' : u < L.construction + L.parking + L.vacant ? 'vacant' : null;
      return { c, kind: lively ?? kind, ...(lively === 'construction' ? { becomes: kind } : {}) };
    });

    // storeys, towers and ground
    const H = M.heights;
    const built = blocks.map(({ c, kind, becomes }, k) => {
      const rect = c.rect, a = r3(area(rect)), id = `${r.id}.${c.i}.${c.j}`, Rb = streamOf(d.seed, 'blocks', `${id}:build`);
      const rail = [...H[ring].rail], m0 = d.heights.storeysAt((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2).median;
      let median = Math.min(rail[1], Math.max(rail[0], m0));
      for (const [s, v] of Object.entries(c.sides)) if (v.kind === 'arterial' && r.frontage[s]) { median = Math.max(median, r.frontage[s].median); rail[1] = Math.max(rail[1], r.frontage[s].rail[1]); }
      if (CARDS[kind]?.storeys) { rail[0] = CARDS[kind].storeys[0]; rail[1] = CARDS[kind].storeys[1]; median = rail[0]; }
      const b = { id, rect, area: a, kind, ring, sides: c.sides, storeys: { median: r3(median), rail } };
      // a building going up: what it becomes, and how far it has risen
      if (kind === 'construction') { const P0 = CARDS.construction.progress; b.becomes = becomes; b.progress = r3(P0[0] + (P0[1] - P0[0]) * Rb()); }
      if (kind === 'tower') {
        // the podium, and a tower or two on its corners past the block's median (the core's tail)
        const T = CARDS.tower, pod = Math.round(T.podium[0] + (T.podium[1] - T.podium[0]) * Rb()), n = 1 + (Rb() < T.towers.second ? 1 : 0);
        const corners = [[0, 0], [1, 1], [1, 0], [0, 1]], first = Math.floor(Rb() * 4);
        b.podium = pod;
        b.towers = Array.from({ length: n }, (_, t) => {
          const [cx, cy] = corners[(first + t * 2) % 4], s = Math.min(T.towers.side[0] + (T.towers.side[1] - T.towers.side[0]) * Rb(), (rect[2] - rect[0]) / 2, (rect[3] - rect[1]) / 2);
          const tx = cx ? rect[2] - s : rect[0], ty = cy ? rect[3] - s : rect[1];
          const storeys = Math.round(Math.min(rail[1], Math.max(pod + 4, median * Math.exp(T.towers.tail * Math.abs(gauss(Rb))))));
          return { rect: [tx, ty, tx + s, ty + s].map(r3), storeys };
        });
      }
      // its ground: its segment's shares of its area, the remainder to its largest
      const shares = segmentShares(kind, P), keys = Object.keys(shares), surfaces = {};
      let left = a;
      for (const s of keys) { surfaces[s] = r3(a * shares[s]); left -= surfaces[s]; }
      const big = keys.reduce((p, q) => (shares[q] > shares[p] ? q : p), keys[0]);
      surfaces[big] = r3(surfaces[big] + left);
      b.surfaces = surfaces;
      return b;
    });
    if (pk) built.push({ id: `${r.id}.park`, rect: pk, area: r3(area(pk)), kind: 'park', ring, sides: {}, storeys: { median: 0, rail: [0, 0] }, surfaces: { park: r3(area(pk)) } });

    const blocksArea = built.filter((b) => b.kind !== 'park').reduce((s, b) => s + b.area, 0), parkArea = pk ? area(pk) : 0;
    const surfaces = {};
    for (const b of built) for (const [s, v] of Object.entries(b.surfaces)) surfaces[s] = r3((surfaces[s] ?? 0) + v);
    out[r.id] = { streets, blocks: built, park: pk, ledger: { area: r.area, streets: r3(r.area - blocksArea - parkArea), blocks: r3(blocksArea), park: r3(parkArea), surfaces } };
  }
  return out;
}
