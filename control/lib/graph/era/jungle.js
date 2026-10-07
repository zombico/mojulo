/**
 * JUNGLE — the late sixth-gen jungle stage (Snake Eater's), built to a STYLE CARD (style/jungle-mgs3.js). The
 * `jungle-trail` kit of the stage kind.
 *
 * The nature builder (nature.js) lays what the jungle shares with the trail: one landform heightfield (a low ravine wall
 * by geology, an apron of scree), the trail as a ribbon (mud here), rocks, roots, a fallen log, puddles. On it the
 * jungle stands as the era stood it:
 *   giants      grown figs (vegetation/ficus.js) for their wood: trunk, limbs, buttresses, roots, barked near; the
 *               crowns are NOT the grower's leaf blobs but spray cards at the crown's own leaf clusters
 *   tree ferns  a tube trunk under a crown of fern cards
 *   understory  crossed cards (broadleaf and fern), dense near the trail, sparse further out
 *   litter      fallen-leaf cards laid flat on the floor and the trail's edges
 *   vines       vine-card strips hanging from the crowns, and a few lianas as sagging tubes
 *   canopy      a roof of crown cards on a jittered grid, with holes: the sky and the sun come only through them
 *   walls       beyond the mid ring, rows of crown cards fading into the fog: the jungle goes on
 * Every leaf is a painted cutout card (leaf-cards.js) drawn alpha-tested (the World page's `cutouts`). The sun bake
 * reads the cards' alpha, so the light on the floor falls through the canopy's painted holes as dapples. A filmic grade
 * pulls every baked colour to the palette. Deterministic: integer-hash dice, grown plants from fixed seeds.
 *
 * PROGRESSIVE REVEAL: detail by ring out from the trail (the character's line): NEAR every card distinct, MID fewer and
 * larger, the giants' wood one level down, FAR no plants, only layered walls in the fog.
 */
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { hash3, vnoise } from './dirt.js';
import { P, hexRgb, rgbHex, r5, card, crossed } from './geom.js';
import { makeSunShadow, sunDir } from './sun.js';
import { bakeStageLight } from './stage.js';
import { natureSite, groundFaces, trailFaces, trailEdgeCover, dice, rockItems, rockFaces, debrisFaces, natureMarks, contactShadows, puddleSpots, puddleFaces, tube } from './nature.js';
import { cardMask } from './leaf-cards.js';
import './floor-tiles.js';   // registers the `floor:` tiles (the moss the blend layer fades in)
import { grow, measure } from '../vegetation/grow.js';
import { level } from '../vegetation/ladder.js';
import { FIGS, figTris, rootChains, buttressTris } from '../vegetation/ficus.js';
import { barkQuads, tubeTris } from '../vegetation/tree-mesh.js';
import { barkTile } from '../vegetation/tiles.js';
import { plantPool } from '../vegetation/pool.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';
import { composeCloudDeck } from '../effects/effects-clouds.js';

export const JUNGLE_STYLES = Object.freeze({ 'jungle-mgs3': JUNGLE_MGS3 });

const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const isCard = (f) => typeof f.texture === 'string' && f.texture.startsWith('card:');

/** A crown clump: one card tipped toward flat (seen from below, the canopy) and one standing across it. */
function clump(out, c, yaw, size, tilt, tint, group) {
  const al = [Math.cos(yaw), Math.sin(yaw), 0], up = unit([-Math.sin(yaw) * Math.cos(tilt), Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt)]);
  card(out, [c[0] - up[0] * size / 2, c[1] - up[1] * size / 2, c[2] - up[2] * size / 2], al, up, size, size, 'card:spray', tint, group);
  const al2 = [Math.cos(yaw + Math.PI / 2), Math.sin(yaw + Math.PI / 2), 0];
  card(out, [c[0], c[1], c[2] - size * 0.42], al2, [0, 0, 1], size * 0.9, size * 0.84, 'card:spray', tint.map((v) => v * 0.92), group);
}

// ── the giants ─────────────────────────────────────────────────────────────────
const GROWN = new Map();
/** A grown fig, its wood ladder (leaves dropped), its aerial roots and its leaf nodes; memoized per (species, variant,
 *  bark, growth knobs). The roots come out of the ladder: the stage decides which land and which hang as curtains. */
function grownGiant(species, v, bark, opts = {}) {
  const k = `${species}:${v}:${bark}:${JSON.stringify(opts)}`; if (GROWN.has(k)) return GROWN.get(k);
  const p = grow(FIGS[species], { years: species === 'banyan' ? 22 : 24, seed: 4100 + v * 37 + (species === 'strangler' ? 500 : 0), ...opts });
  const H = measure(p).height, tile = barkTile(bark), rootless = { ...p, arch: { ...p.arch, fig: { ...p.arch.fig, roots: false } } };
  // the wood by ring, cut by DIAMETER (a whole limb goes, never part of one): NEAR barked with the buttresses, MID
  // coarser and plain; the twigs below the cut stand inside the crown cards, where nothing would see them
  const barkOpt = { minR: 0.03, tile: tile.metres, color: tile.mean, key: tile.key };
  const wood = {
    near: [...level(p, { dCut: H / 75, sidesMax: 6, leaves: 'none', bark: barkOpt }), ...figTris(rootless, { dCut: H / 75, sidesMax: 6, cell: H / 11, bark: barkOpt })],
    mid: [...level(p, { dCut: H / 60, sidesMax: 4, leaves: 'none' }), ...figTris(rootless, { dCut: H / 60, sidesMax: 4, near: false, far: true })],
  };
  const leaves = p.nodes.filter((n) => !n.died && n.leaves).map((n) => n.pos);
  const g = { H, wood, leaves, roots: rootChains(p), barkOpt, trunkR: (p.nodes[1] || p.nodes[0]).r }; GROWN.set(k, g); return g;
}

/** Giant positions: a framing pair at each gate focus, the rest by rejection in the near and mid rings, spaced. */
export function giantItems(st, site, seed) {
  const G = st.giants, S = seed | 0, { W, D, trailX, trailDist, cliffX, apronAt, halfWAt } = site, out = [];
  const ok = (x, y) => x > cliffX(y) + 4 && x < W + 6 && y > -4 && y < D + 4 && apronAt(x, y) < 0.02 && out.every((g) => Math.hypot(g.x - x, g.y - y) > G.spacing);
  const Bn = st.banyan;
  if (Bn) {   // the banyan first: its place is the composition's, by its focus
    const f = site.foci.find((q) => q.name === Bn.focus), y = f.y + Bn.dy;
    out.push({ x: trailX(y) + Bn.side * (halfWAt(y) + G.clearTrail[0] + Bn.off), y, side: Bn.side, banyan: true });
  }
  for (const f of site.foci.filter((f) => f.gate)) for (const side of [-1, 1]) {
    if (Bn && Bn.focus === f.name && side === Bn.side) continue;   // the banyan frames that side
    const y = f.y + side * 1.2, x = trailX(y) + side * (halfWAt(y) + G.clearTrail[0]);
    if (x > cliffX(y) + 4) out.push({ x, y, side });
  }
  for (let i = 0; i < 600 && out.length < G.count; i++) {
    const y = -2 + (D + 4) * hash3(i, 1, S + 701), side = hash3(i, 2, S + 703) < 0.5 ? -1 : 1;
    const x = trailX(y) + side * (halfWAt(y) + G.clearTrail[0] + (G.clearTrail[1] - G.clearTrail[0]) * hash3(i, 3, S + 705));
    if (ok(x, y)) out.push({ x, y, side });
  }
  const placed = out.map((g, i) => {
    const species = g.banyan ? 'banyan' : i % 3 === 2 ? G.alt : G.species, hr = g.banyan ? Bn.height : G.heights, h = mix(hr[0], hr[1], hash3(i, 4, S + 707));
    // a fig's buttresses spread with its height: step it out until they stop short of the trail
    while (trailDist(g.x, g.y) < halfWAt(g.y) + G.clearTrail[0] + 0.1 * h) g = { ...g, x: g.x + g.side * 0.25 };
    // each giant its own bark (principle: distinct inside the radius): oak's interlaced ridges, chestnut's spiral, smooth beech
    return { ...g, x: r5(g.x), y: r5(g.y), z0: r5(site.ground(g.x, g.y)), h: r5(h), species, v: i % G.variants, bark: i % G.barks.length, yaw: r5(2 * Math.PI * hash3(i, 5, S + 709)), near: trailDist(g.x, g.y) < st.rings.near };
  });
  // the near giants take the barks in turn first, so no two the eye lands on share one; the rest follow on
  let k = 0; for (const g of placed) if (g.near) g.bark = k++ % G.barks.length;
  for (const g of placed) if (!g.near) g.bark = k++ % G.barks.length;
  return placed;
}

function giantFaces(st, site, giants) {
  const G = st.giants, E = st.epiphytes, wood = [], crowns = [], epi = [], tint = st.leafTint;
  for (const g of giants) {
    const B = G.barks[g.bark], grown = grownGiant(g.species, g.v, B.key, st.grow || {}), s = g.h / grown.H, c = Math.cos(g.yaw), sn = Math.sin(g.yaw);
    const at = (q) => P([g.x + (q[0] * c - q[1] * sn) * s, g.y + (q[0] * sn + q[1] * c) * s, g.z0 - 0.25 + q[2] * s]);
    const rot = (n) => [n[0] * c - n[1] * sn, n[0] * sn + n[1] * c, n[2]].map(r5);
    // the aerial roots: a landed one is a pillar (barked near), unless it would stand on the trail (the way runs between
    // them); a hanging one joins its cell's curtain of root cards
    const rootTris = [], hanging = new Map(), Bn = st.banyan;
    for (const ch of grown.roots) {
      const foot = at(ch.pts[0]), top = at(ch.pts[1]);
      if (ch.landed) {
        if (site.trailDist(foot[0], foot[1]) < site.halfWAt(foot[1]) + 0.6) continue;
        // a pillar is no rod: it wanders as it came down (a hanging root swung, then thickened where it stood) and
        // flares at its foot where it took hold
        const [A, Bt] = ch.pts, N = 10, ri = grown.roots.indexOf(ch), wob = (k, j) => (vnoise(k * 0.55, j * 3.7 + ri * 1.3 + g.v, 1621) - 0.5) * 0.9 * Math.sin((Math.PI * k) / N);
        const pts = [], rs = [];
        for (let k = 0; k <= N; k++) { const t = k / N; pts.push([A[0] + (Bt[0] - A[0]) * t + wob(k, 1), A[1] + (Bt[1] - A[1]) * t + wob(k, 2), A[2] + (Bt[2] - A[2]) * t]); rs.push(mix(ch.rs[0], ch.rs[1], t) * (1 + 1.1 * (1 - smooth(0, 0.16, t))) * (0.85 + 0.3 * vnoise(k * 1.3, ri, 1623))); }
        // and braided: a thinner strand winds round the pillar, grafted to it (the roots of a banyan fuse as they thicken)
        if (g.near) {
          const sp = [], sr = [];
          for (let k = 0; k <= N * 2; k++) { const t = k / (N * 2), q = pts[Math.min(N, Math.round(t * N))], a = t * 5 * Math.PI + ri, rr = mix(ch.rs[0], ch.rs[1], t) * 1.05; sp.push([q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr, A[2] + (Bt[2] - A[2]) * t]); sr.push(rr * 0.42); }
          for (const t of tubeTris({ pts: sp, rs: sr, continues: false, dMax: 2 * sr[0] }, { sidesFor: () => 4, colorFor: () => [112, 100, 84] })) rootTris.push(t);
        }
        const chw = { ...ch, pts, rs };
        const tris = g.near && ch.dMax >= 2 * grown.barkOpt.minR ? barkQuads(chw, { sidesFor: () => 6, tile: grown.barkOpt.tile, color: grown.barkOpt.color, key: grown.barkOpt.key }) : tubeTris(chw, { sidesFor: () => 4, colorFor: () => [118, 112, 104] });
        for (const t of tris) rootTris.push(t);
        continue;
      }
      if (!Bn) continue;
      const kc = `${Math.floor(top[0] / Bn.curtain.cell)},${Math.floor(top[1] / Bn.curtain.cell)}`, c = hanging.get(kc) || hanging.set(kc, { x: 0, y: 0, top: -Infinity, bot: 0, n: 0 }).get(kc);
      c.x += top[0]; c.y += top[1]; c.top = Math.max(c.top, top[2]); c.bot += foot[2]; c.n++;
    }
    [...hanging.values()].forEach((c, i) => {
      const x = c.x / c.n, y = c.y / c.n, bot = Math.max(site.ground(x, y) + 1.9, c.bot / c.n), len = c.top - bot;
      if (len < 0.8 || site.trailDist(x, y) < site.halfWAt(y) + 0.4) return;
      const w = mix(Bn.curtain.width[0], Bn.curtain.width[1], hash3(i, 1, g.v + 1601));
      crossed(epi, [x, y, bot], Math.PI * hash3(i, 2, g.v + 1603), w, len, 'card:roots', [0.9, 0.86, 0.76], 'jungle:roots');
    });
    for (const t of [...grown.wood[g.near ? 'near' : 'mid'], ...rootTris]) {
      if (t.q) {   // a barked quad: the tile runs round and up the limb at the grown tree's own texel scale, scaled
        const n = rot(t.n);
        wood.push({ corners: t.q.map(at), normal: n, outNormal: n, texture: t.key, textureLit: true, uv: t.uv.map((q) => q.map((v) => r5(v * s))), tint: B.tint, group: 'jungle:wood', doubleSided: true });
        continue;
      }
      const cs = t.p.map(at), n0 = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))), n = n0.map(r5);
      const albedo = t.c.map((v, k) => mix(v / 255, B.tint[k] * 0.62, 0.5));
      wood.push({ corners: [...cs, cs[2]], normal: n, outNormal: n, tint: albedo.map(r5), group: 'jungle:wood', doubleSided: true });
    }
    // epiphytes: small ferns and broadleaf sitting on the tops of the big limbs, above head height (near giants only)
    if (g.near && E) {
      const seats = [];
      wood.forEach((f, fi) => {
        if (!f.texture || f.normal[2] < 0.6) return;
        const m = f.corners.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4, a[2] + q[2] / 4], [0, 0, 0]);
        if (m[2] - g.z0 < E.above || Math.hypot(m[0] - g.x, m[1] - g.y) > g.h * 0.6) return;
        seats.push({ m, k: hash3(fi, 3, g.v + 1501) });
      });
      seats.sort((a, b) => a.k - b.k);
      const kept = [];
      for (const q of seats) { if (kept.length >= E.perGiant) break; if (kept.every((o) => Math.hypot(o.m[0] - q.m[0], o.m[1] - q.m[1], o.m[2] - q.m[2]) > E.apart)) kept.push(q); }
      kept.forEach((q, j) => {
        const sz = mix(E.size[0], E.size[1], q.k);
        crossed(epi, [q.m[0], q.m[1], q.m[2] - 0.1], Math.PI * q.k * 3, sz * 1.2, sz, j % 2 ? 'card:fern' : 'card:broadleaf', tint.map((v) => v * 0.9), 'jungle:epiphyte');
      });
    }
    // the crown: its leaf nodes binned into cells, one clump of cards per cell at the cell's centroid
    const cells = new Map();
    for (const q of grown.leaves) {
      const p = at(q), k = `${Math.floor(p[0] / G.crownCell)},${Math.floor(p[1] / G.crownCell)},${Math.floor(p[2] / G.crownCell)}`;
      const b = cells.get(k) || cells.set(k, [0, 0, 0, 0]).get(k); b[0] += p[0]; b[1] += p[1]; b[2] += p[2]; b[3]++;
    }
    [...cells.values()].filter((b) => b[3] >= 3).forEach((b, i) => {
      const cpos = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
      if (overCut(st, site, cpos[0], cpos[1], i * 31 + g.v)) return;
      const size = mix(G.crownCard[0], G.crownCard[1], hash3(i, 7, g.v + 711));
      clump(crowns, cpos, 2 * Math.PI * hash3(i, 8, g.v + 713), size, 0.55 + 0.5 * hash3(i, 9, g.v + 717), tint.map((v) => v * (0.86 + 0.18 * hash3(i, 10, 719))), 'jungle:crown');
    });
  }
  return { wood, crowns, epi };
}

/** The massive trunks' places: at their stations, stepped out past the reach of their buttresses from the trail. */
export function colossusItems(st, site) {
  const C = st.colossi; if (!C) return [];
  return C.list.map((c) => {
    const reach = c.R * 0.7 + 1.4 * C.buttress.h * 1.15, r0 = c.R * 1.9, off = site.halfWAt(c.y) + 0.4 + Math.max(reach, r0) + c.gap;
    const x = site.trailX(c.y) + c.side * off;
    return { x: r5(x), y: c.y, R: c.R, side: c.side, z0: r5(site.ground(x, c.y)), reach: Math.max(reach, r0) };
  });
}

/**
 * A MASSIVE TRUNK: a low-poly bole (few faces; the texture carries it), lumpy round its girth, flared at its foot,
 * leaning a little, barked at a crack scale for its thickness; buttress fins on the side away from the trail.
 */
function colossusFaces(st, site, items, seed) {
  const C = st.colossi, out = [], S = seed | 0, tile = barkTile(C.bark), tm = tile.metres * C.barkScale;
  items.forEach((c, ci) => {
    const zs = []; for (let z = -0.6; z < C.top; z += z < 4 ? 0.6 : z < 12 ? 1.4 : 3) zs.push(z); zs.push(C.top);
    const lean = [(hash3(ci, 1, S + 2001) - 0.5) * 0.04, (hash3(ci, 2, S + 2003) - 0.5) * 0.04];
    const at = (k, z) => {
      const a = (2 * Math.PI * k) / C.sides, flare = 1 + 0.9 * Math.exp(-Math.max(0, z) / 1.2);
      const lump = 1 + 0.08 * Math.sin(a * 3 + ci) + 0.1 * (vnoise(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3 + z * 0.12, S + 2005 + ci) - 0.5) * 2;
      const r = c.R * flare * lump * (1 - 0.18 * Math.min(1, z / C.top));
      return [c.x + lean[0] * z + Math.cos(a) * r, c.y + lean[1] * z + Math.sin(a) * r, c.z0 + z];
    };
    const circ = 2 * Math.PI * c.R;
    for (let j = 0; j + 1 < zs.length; j++) for (let k = 0; k < C.sides; k++) {
      const cs = [at(k, zs[j]), at(k + 1, zs[j]), at(k + 1, zs[j + 1]), at(k, zs[j + 1])].map(P);
      const n = unit(cross(sub(cs[1], cs[0]), sub(cs[3], cs[0]))), mid = [(cs[0][0] + cs[2][0]) / 2 - c.x, (cs[0][1] + cs[2][1]) / 2 - c.y];
      const nn = (n[0] * mid[0] + n[1] * mid[1] < 0 ? n.map((v) => -v) : n).map(r5);
      const u0 = (circ * k) / C.sides / tm, u1 = (circ * (k + 1)) / C.sides / tm;
      out.push({ corners: cs, normal: nn, outNormal: nn, texture: tile.key, textureLit: true, uv: [[u0, zs[j] / tm], [u1, zs[j] / tm], [u1, zs[j + 1] / tm], [u0, zs[j + 1] / tm]].map((q) => q.map(r5)), tint: C.tint, group: 'jungle:wood', colossus: ci, doubleSided: true });
    }
    // its crown is far above the roof: a few clumps where the bole goes into it, so the bole never ends in the open
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + ci, top = at(0, C.top); clump(out, [top[0] + Math.cos(a) * 2.5, top[1] + Math.sin(a) * 2.5, top[2] - 2 + k], a, 8, 0.3, st.leafTint, 'jungle:crown'); }
    // the fins, standing on the side away from the trail
    const toTrail = [site.trailX(c.y) - c.x, 0];
    for (const t of buttressTris([0, 0, 0], c.R * 1.3, C.buttress.h, { n: C.buttress.n, lean: toTrail, seed: 31 + ci, segs: 6 })) {
      const cs = t.p.map((q) => P([c.x + q[0], c.y + q[1], c.z0 - 0.15 + q[2]])), n = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))).map(r5);
      out.push({ corners: [...cs, cs[2]], normal: n, outNormal: n, tint: C.tint.map((v, k) => r5(v * 0.8 * (t.c ? t.c[k] / 128 : 1))), group: 'jungle:wood', colossus: ci, doubleSided: true });
    }
  });
  return out;
}

/** The MOSS layer: a blend copy of each soil face (and each massive trunk's face) near the trail, the moss tile faded
 *  in per corner by cause — worn off where feet go, thick in patches and in shade; on a trunk, up its foot and round
 *  its shaded side. */
function mossFaces(st, site, faces, shadow, dir, seed) {
  const M = st.moss, S = seed | 0, out = [];
  if (!M) return out;
  // with a `trailBlend`, the moss gives out along the trail's one edge (nature.js trailEdgeCover), the line the soil's
  // wear follows too (jungleMarks)
  const edge = st.trailBlend ? trailEdgeCover(st, site, seed) : null;
  const floorAlpha = (c) => {
    const hw = site.halfWAt(c[1]), d = site.trailDist(c[0], c[1]); if (d > M.ring) return 0;
    const wander = edge ? 0 : (vnoise(c[0] * 0.5, c[1] * 0.5, S + 2101) - 0.5) * 1.4;
    const worn = edge ? edge(c[0], c[1]) : smooth(hw * M.wear[0], hw + site.fringeAt(c[1]) + M.wear[1], d + wander);
    const patch = smooth(M.patch[0], M.patch[1], 0.7 * vnoise(c[0] * 0.17, c[1] * 0.17, S + 2103) + 0.3 * vnoise(c[0] * 0.6, c[1] * 0.6, S + 2105));
    const shade = shadow(c, [0, 0, 1]) ? 0.7 : 1;
    return M.max * worn * (0.18 + 0.82 * patch) * shade;
  };
  const trunkAlpha = (f, c) => {
    const up = c[2] - site.ground(c[0], c[1]), lit = f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2];
    const grow = Math.max(1 - smooth(0.3, 3.5, up), 0.75 * smooth(0.1, -0.5, lit) * (1 - smooth(8, 18, up)));
    return M.trunk * grow * smooth(0.25, 0.55, vnoise(c[2] * 0.5, Math.atan2(c[1] - site.trailX(c[1]), 1) + c[0] * 0.3, S + 2107));
  };
  for (const f of faces) {
    const floor = f.group === 'trail:ground' && f.texture === st.tiles.trail.key, trunk = f.colossus !== undefined && f.texture;
    if (!floor && !trunk) continue;
    const al = f.corners.map((c) => r5(floor ? floorAlpha(c) : trunkAlpha(f, c)));
    if (al.every((a) => a < 0.02)) continue;
    const uv = floor ? f.corners.map((q) => [r5(q[0] / M.scale), r5(q[1] / M.scale)]) : f.uv.map((q) => q.map((v) => r5(v * 1.6)));
    out.push({ corners: f.corners, normal: f.normal, outNormal: f.normal, texture: M.key, textureLit: true, uv, tint: M.tint, cornerAlpha: al, blend: true, group: 'jungle:moss' });
  }
  return out;
}

/** Lianas that wind up the trunks: a helix round a giant's bole from its foot to under its crown. */
function spiralFaces(st, giants) {
  const Sp = st.spirals, out = [];
  if (!Sp) return out;
  giants.filter((g) => g.species !== 'banyan').slice(0, Sp.count).forEach((g, i) => {
    const grown = grownGiant(g.species, g.v, st.giants.barks[g.bark].key, st.grow || {}), R0 = grown.trunkR * (g.h / grown.H) + Sp.r * 1.5;
    const pts = [], radii = [], n = 48, a0 = 2 * Math.PI * hash3(i, 1, 1701), hand = i % 2 ? 1 : -1;
    for (let k = 0; k <= n; k++) {
      const t = k / n, a = a0 + hand * t * Sp.turns * 2 * Math.PI, rr = R0 * (1 - 0.35 * t);
      pts.push([g.x + Math.cos(a) * rr, g.y + Math.sin(a) * rr, g.z0 + 0.1 + t * g.h * Sp.reach]); radii.push(Sp.r * (1.2 - 0.5 * t));
    }
    tube(out, pts, radii, 4, Sp.tint, 'jungle:liana');
  });
  return out;
}

/** BAMBOO clumps on the wet ground at the ravine's foot: mojulo's clumping bamboo (its culms, upright inside and leaning
 *  out at the rim), the foliage as bamboo cards hung down the upper culm. */
function bambooFaces(st, site, seed) {
  const Bb = st.bamboo, out = [], S = seed | 0;
  if (!Bb) return out;
  const pool = plantPool({ species: Bb.species, variants: 2, seed: 'jungle-bamboo', light: FLAT_LIGHT, maxLevel: 'L1' });
  const upright = pool.variants.filter((v) => v.lean === undefined && !v.wax), leaning = pool.variants.filter((v) => v.lean !== undefined);
  for (let c = 0; c < Bb.clumps; c++) {
    let y = site.D * (0.25 + 0.5 * c / Math.max(1, Bb.clumps - 1) + 0.08 * (hash3(c, 1, S + 1801) - 0.5)), x = site.cliffX(y) + Bb.off;
    for (let tries = 0; tries < 20 && site.apronAt(x, y) > st.landform.apronMin; tries++) x += 0.5;   // off the scree, onto the wet soil
    for (let k = 0; k < Bb.culms; k++) {
      const a = 2 * Math.PI * hash3(c * 31 + k, 2, S + 1803), rim = k >= 4, r = rim ? Bb.radius * (0.6 + 0.4 * hash3(c * 31 + k, 3, S + 1805)) : Bb.radius * 0.35 * hash3(c * 31 + k, 4, S + 1807);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, pz = site.ground(px, py) - 0.1;
      // a rim culm takes the leaning variant whose azimuth looks out from the clump's heart
      const deg = ((a * 180) / Math.PI + 360) % 360;
      const towardWall = Math.cos(a) < -0.2;   // the wall is on the clump's low-x side: a culm never leans into rock
      const v = rim && !towardWall && leaning.length ? leaning.reduce((b, q) => (Math.abs(((q.az - deg + 540) % 360) - 180) < Math.abs(((b.az - deg + 540) % 360) - 180) ? q : b)) : upright[k % upright.length];
      const h = mix(Bb.height[0], Bb.height[1], hash3(c * 31 + k, 5, S + 1809)), s = h / v.height;
      let top = [px, py, pz];
      for (const f of v.parts.culm.L1) {
        const cs = f.corners.map((q) => P([px + q[0] * s, py + q[1] * s, pz + q[2] * s]));
        for (const q of cs) if (q[2] > top[2]) top = q;
        const n0 = unit(cross(sub(cs[1], cs[0]), sub(cs[2], cs[0]))).map(r5);
        out.push({ corners: cs.length === 3 ? [...cs, cs[2]] : cs, normal: n0, outNormal: n0, tint: hexRgb(f.fill).map((q, i) => r5(q * [0.92, 1, 0.72][i])), group: 'jungle:bamboo', doubleSided: true });
      }
      // the foliage: cards hung down the culm's upper part, toward its leaning top
      for (let j = 0; j < Bb.cards; j++) {
        const t = 0.55 + (0.45 * (j + 1)) / Bb.cards, q = [px + (top[0] - px) * t, py + (top[1] - py) * t, pz + (top[2] - pz) * t], sz = mix(Bb.leaf[0], Bb.leaf[1], hash3(c * 31 + k, 6 + j, S + 1811));
        crossed(out, [q[0], q[1], q[2] - sz * 0.75], Math.PI * hash3(c * 31 + k, 12 + j, S + 1813), sz * 1.2, sz, 'card:bamboo', Bb.tint, 'jungle:bamboo-leaf');
      }
    }
  }
  return out;
}

/** TALL GRASS where the sun reaches the floor (the gaps feed it), in patches, clear of the trail: crossed grass cards,
 *  the era's way (Snake Eater's grass is cards), lit and shaded by the bake like every leaf and walked through. */
function tallGrassFaces(st, site, shadow, seed) {
  const Tg = st.tallGrass, S = seed | 0, out = []; if (!Tg) return out;
  let n = 0;
  for (let y = 0; y < site.D && n < Tg.max; y += Tg.cell) for (let x = 0; x < site.W && n < Tg.max; x += Tg.cell) {
    const i = Math.round(x / Tg.cell) * 2003 + Math.round(y / Tg.cell), px = x + Tg.cell * hash3(i, 1, S + 1901), py = y + Tg.cell * hash3(i, 2, S + 1903);
    const d = site.trailDist(px, py);
    if (d > st.rings.mid || vnoise(px * 0.18, py * 0.18, S + 1905) < Tg.patch || !floorOk(st, site, px, py, Tg.clear)) continue;
    const z = site.ground(px, py), lit = shadow([px, py, z + 0.3], [0, 0, 1]);
    if (!lit && hash3(i, 3, S + 1907) > 0.25) continue;   // it grows where the light falls
    const h = mix(Tg.height[0], Tg.height[1], hash3(i, 4, S + 1909));
    crossed(out, [px, py, z - 0.06], Math.PI * hash3(i, 5, S + 1911), h * 0.9, h, 'card:grass', Tg.tint.map((q) => r5(q * (0.85 + 0.3 * hash3(i, 6, S + 1913)))), 'jungle:grass');
    n++;
  }
  return out;
}

/** The cut overhead: the trail is the one opening in the wall, and in the roof too — a clump over the trail's
 *  corridor is mostly left out, so the light comes down along the way forward (principles 1 and 5). */
function overCut(st, site, x, y, i) {
  const d = site.trailDist(x, y), C = st.corridor;
  return d < site.halfWAt(y) + C.width && hash3(i, 77, 1301) < C.open * (1 - smooth(site.halfWAt(y), site.halfWAt(y) + C.width, d) * 0.6);
}

// ── the smaller plants ─────────────────────────────────────────────────────────
/** Where a plant may stand: on the floor (not the ravine wall, the apron or the trail), inside the site. */
const floorOk = (st, site, x, y, clear) => x > site.cliffX(y) + 1.2 && site.apronAt(x, y) < st.landform.apronMin && site.trailDist(x, y) > site.halfWAt(y) + clear && !(site.blocked && site.blocked(x, y));

function treeFernFaces(st, site, giants, seed) {
  const T = st.treeferns, S = seed | 0, out = [], items = [];
  for (let i = 0; i < 500 && items.length < T.count; i++) {
    const y = site.D * hash3(i, 1, S + 801), side = hash3(i, 2, S + 803) < 0.5 ? -1 : 1;
    const x = site.trailX(y) + side * (site.halfWAt(y) + 1.2 + (st.rings.mid - 2) * Math.pow(hash3(i, 3, S + 805), 1.6));
    if (!floorOk(st, site, x, y, 1) || giants.some((g) => Math.hypot(g.x - x, g.y - y) < 3) || items.some((t) => Math.hypot(t.x - x, t.y - y) < 2.2)) continue;
    items.push({ x, y, i });
  }
  for (const { x, y, i } of items) {
    const z = site.ground(x, y), h = mix(T.height[0], T.height[1], hash3(i, 4, S + 807)), lean = [(hash3(i, 5, S + 809) - 0.5) * 0.5, (hash3(i, 6, S + 811) - 0.5) * 0.5];
    const pts = [0, 0.5, 1].map((f) => [x + lean[0] * f * f, y + lean[1] * f * f, z - 0.1 + h * f]);
    tube(out, pts, [0.14, 0.11, 0.1], 6, T.trunk, 'jungle:fern-trunk');
    const top = pts[2], fr = mix(T.frond[0], T.frond[1], hash3(i, 7, S + 813));
    // the crown: fern cards rising from the trunk's top and bowing out round it
    for (let k = 0; k < T.fronds; k++) {
      const a = (2 * Math.PI * k) / T.fronds + hash3(i, 8, S + 815), tilt = 0.75 + 0.25 * hash3(i * 7 + k, 9, S + 817);
      const al = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2), 0], up = unit([Math.cos(a) * Math.cos(tilt), Math.sin(a) * Math.cos(tilt), Math.sin(tilt)]);
      card(out, [top[0] - up[0] * 0.2, top[1] - up[1] * 0.2, top[2] - 0.25], al, up, fr * 0.9, fr * 0.75, 'card:fern', st.leafTint, 'jungle:fern');
    }
  }
  return { faces: out, items };
}

function understoryFaces(st, site, giants, seed) {
  const U = st.understory, S = seed | 0, out = [], cell = 0.9;
  for (let y = -2; y < site.D + 2; y += cell) for (let x = -2; x < site.W + 2; x += cell) {
    const i = Math.round(x / cell) * 1009 + Math.round(y / cell);
    const px = x + cell * hash3(i, 1, S + 901), py = y + cell * hash3(i, 2, S + 903), d = site.trailDist(px, py);
    const dens = d < st.rings.near ? U.near : d < st.rings.mid ? U.mid : 0;
    if (hash3(i, 3, S + 905) > dens * cell * cell || !floorOk(st, site, px, py, U.clearTrail)) continue;
    if (giants.some((g) => Math.hypot(g.x - px, g.y - py) < 1.2)) continue;
    // nearer the trail, smaller (the eye is close); further out, larger to fill the view with fewer cards
    const s = mix(U.size[0], U.size[1], hash3(i, 4, S + 907)) * (d < st.rings.near ? 1 : 1.35), fern = hash3(i, 5, S + 909) < U.ferns;
    const t = U.tint.map((v) => v * (0.82 + 0.3 * hash3(i, 6, S + 911)));
    crossed(out, [px, py, site.ground(px, py) - 0.08], Math.PI * hash3(i, 7, S + 913), s * 1.15, s, fern ? 'card:fern' : 'card:broadleaf', t, 'jungle:under');
  }
  return out;
}

function litterFaces(st, site, seed) {
  const L = st.litter, S = seed | 0, out = [], cell = 1.1;
  for (let y = 0; y < site.D; y += cell) for (let x = 0; x < site.W; x += cell) {
    const i = Math.round(x / cell) * 1013 + Math.round(y / cell), px = x + cell * hash3(i, 1, S + 951), py = y + cell * hash3(i, 2, S + 953);
    const d = site.trailDist(px, py), edge = Math.abs(d - site.halfWAt(py)) < 0.7;
    const onTrail = d < site.halfWAt(py) - 0.3;
    const want = onTrail ? L.onTrail : edge ? L.near * L.edge : d > st.rings.near ? 0 : L.near;   // the trail's edge is where litter piles
    if (hash3(i, 3, S + 955) > want * cell * cell) continue;
    if (px < site.cliffX(py) + 1 || site.apronAt(px, py) > st.landform.apronMin) continue;
    const s = mix(L.size[0], L.size[1], hash3(i, 5, S + 959)), a = Math.PI * hash3(i, 6, S + 961), lift = d < site.halfWAt(py) + 0.2 ? 0.075 : 0.03;
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const xx = px + (u * Math.cos(a) - v * Math.sin(a)) * s / 2, yy = py + (u * Math.sin(a) + v * Math.cos(a)) * s / 2; return P([xx, yy, site.ground(xx, yy) + lift]); });
    out.push({ corners: cs, normal: [0, 0, 1], outNormal: [0, 0, 1], texture: 'card:litter', textureLit: true, uv: [[0, 0], [1, 0], [1, 1], [0, 1]], tint: L.tint, group: 'jungle:litter', doubleSided: true });
  }
  // twigs fallen across the trail and its edges, lying on the soil
  for (let y = 0.5, i = 0; y < site.D; y += 1 / L.twigs, i++) {
    const off = (hash3(i, 7, S + 963) - 0.5) * 2 * (site.halfWAt(y) + 0.8), x = site.trailX(y) + off, yy = y + hash3(i, 8, S + 965) * 0.6;
    const yaw = Math.PI * hash3(i, 9, S + 967), len = 0.3 + 0.7 * hash3(i, 10, S + 969), z = site.ground(x, yy) + 0.09;
    const b = [x + Math.cos(yaw) * len, yy + Math.sin(yaw) * len];
    tube(out, [[x, yy, z], [(x + b[0]) / 2, (yy + b[1]) / 2, z + 0.015], [b[0], b[1], site.ground(b[0], b[1]) + 0.09]], [0.022, 0.017, 0.01], 3, L.twig, 'jungle:twig');
  }
  return out;
}

function vineFaces(st, site, giants, crowns, seed) {
  const V = st.vines, S = seed | 0, out = [];
  // strips hang from crown clumps over the near and mid rings, stopping a body's height or more above the floor
  const anchors = crowns.filter((f, i) => i % 2 === 0).map((f) => f.corners.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]))
    .filter((c) => site.trailDist(c[0], c[1]) < st.rings.mid && site.trailDist(c[0], c[1]) > site.halfWAt(c[1]) + 0.6);
  for (let k = 0; k < Math.min(V.count, anchors.length); k++) {
    const c = anchors[Math.floor(hash3(k, 1, S + 971) * anchors.length)], floor = site.ground(c[0], c[1]);
    const bottom = floor + 2.2 + 4 * hash3(k, 2, S + 973), len = c[2] - bottom; if (len < 2) continue;
    crossed(out, [c[0], c[1], bottom], Math.PI * hash3(k, 3, S + 975), V.width, len, 'card:vine', V.tint, 'jungle:vine');
    // the crossed pair repeats the vine tile down its length
    for (const f of out.slice(-2)) f.uv = [[0, 0], [1, 0], [1, r5(len / V.tile)], [0, r5(len / V.tile)]];
  }
  // lianas: sagging ropes from one giant's limbs to the ground or to the next giant
  for (let k = 0; k < Math.min(V.lianas, giants.length); k++) {
    const g = giants[k], h = giants[(k + 1) % giants.length], a = [g.x, g.y, g.z0 + g.h * 0.55];
    const b = Math.hypot(h.x - g.x, h.y - g.y) < 16 ? [h.x, h.y, h.z0 + h.h * 0.45] : [g.x + 3, g.y + 2, site.ground(g.x + 3, g.y + 2)];
    const pts = [], radii = [], n = 10, sag = 2.5 + 2 * hash3(k, 4, S + 977);
    for (let i = 0; i <= n; i++) { const f = i / n; pts.push([mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f) - sag * 4 * f * (1 - f)]); radii.push(V.liana); }
    tube(out, pts, radii, 4, [0.4, 0.36, 0.24], 'jungle:liana');
  }
  return out;
}

function canopyFaces(st, site, seed) {
  const C = st.canopy, S = seed | 0, out = [];
  for (let y = -14; y < site.D + 14; y += C.cell) for (let x = -14; x < site.W + 14; x += C.cell) {
    const i = Math.round(x / C.cell) * 1019 + Math.round(y / C.cell);
    // the holes come in patches (a fallen giant's gap, a light well), not as single missing cells
    const open = vnoise(x * 0.07, y * 0.07, S + 991);
    if (hash3(i, 1, S + 993) > C.cover * (1.35 - open * 0.75)) continue;
    const px = x + C.cell * hash3(i, 2, S + 995), py = y + C.cell * hash3(i, 3, S + 997);
    if (overCut(st, site, px, py, i)) continue;
    const base = Math.max(site.ground(px, py), site.valley(px, py));
    const z = base + mix(C.z[0], C.z[1], hash3(i, 4, S + 999)), size = mix(C.card[0], C.card[1], hash3(i, 5, S + 1001));
    clump(out, [px, py, z], 2 * Math.PI * hash3(i, 6, S + 1003), size, 0.12 + 0.35 * hash3(i, 7, S + 1005), C.tint.map((v) => v * (0.85 + 0.2 * hash3(i, 8, S + 1007))), 'jungle:canopy');
  }
  return out;
}

/** The far walls: rows of tall crown cards past the mid ring on the open side, past the trail's ends, and up on the
 *  ravine's rim, each row darker; the World's haze fades them. */
function wallFaces(st, site, seed) {
  const Wl = st.walls, S = seed | 0, out = [];
  const row = (pts, r) => pts.forEach(([x, y, along], i) => {
    if (site.trailDist(x, y) < st.rings.mid && y > 0 && y < site.D && x > site.cliffX(y)) return;   // where the trail bends toward a row
    const h = mix(Wl.height[0], Wl.height[1], vnoise(i * 0.4, r * 3.1, S + 1101)), w = mix(Wl.card[0], Wl.card[1], hash3(i, r, S + 1103));
    const z0 = site.ground(x, y) - 0.5, t = [0.72, 0.8, 0.62].map((v) => v * (1 - 0.12 * r));
    // a wall is crown cards stacked up a column (one card is never tall enough), so its top edge is a ragged skyline
    for (let zz = 0; zz < h; zz += w * 0.7) card(out, [x, y, z0 + zz], along, [0, 0, 1], w, w, 'card:spray', t, 'jungle:wall');
  });
  for (let r = 0; r < Wl.rows; r++) {
    const off = st.rings.mid + 2 + r * Wl.gap, pts = [];
    for (let y = -20 - r * Wl.gap; y < site.D + 20 + r * Wl.gap; y += 3.2) pts.push([site.trailX(y) + off, y, [0, 1, 0]]);   // the open side
    for (let y = -20 - r * Wl.gap; y < site.D + 20 + r * Wl.gap; y += 3.2) pts.push([site.cliffX(y) - 3 - r * Wl.gap, y, [0, 1, 0]]);   // the rim
    for (const yEnd of [site.D + 6 + r * Wl.gap, -6 - r * Wl.gap]) for (let x = site.cliffX(yEnd) - 6; x < site.trailX(yEnd) + off; x += 3.2) pts.push([x, yEnd, [1, 0, 0]]);
    row(pts, r);
  }
  return out;
}

/**
 * LIGHT SHAFTS: where the sun reaches the floor near the trail (the sun test through the cards' painted holes), a beam
 * stands from the dapple up toward the sun: two crossed translucent sheets, clear at the floor and the canopy and
 * densest between, warm. Drawn in the World page's translucent sheet pass (per-vertex alpha).
 */
function shaftFaces(st, site, shadow, dir, seed) {
  const Sh = st.shafts, S = seed | 0, cand = [];
  for (let y = 0; y < site.D; y += 1.1) for (let off = -st.rings.near; off <= st.rings.near; off += 1.1) {
    const x = site.trailX(y) + off, z = site.ground(x, y);
    if (x < site.cliffX(y) + 1 || !shadow([x, y, z + 0.1], [0, 0, 1])) continue;
    cand.push({ x, y, z, k: hash3(Math.round(x * 10), Math.round(y * 10), S + 1401) });
  }
  cand.sort((a, b) => a.k - b.k);
  const picked = [];
  for (const c of cand) { if (picked.length >= Sh.count) break; if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > Sh.apart)) picked.push(c); }
  const out = [], side1 = unit(cross(dir, [0, 0, 1])), side2 = unit(cross(dir, side1)), fill = gradeHex(Sh.color, st.grade);
  picked.forEach((c, i) => {
    const w = mix(Sh.width[0], Sh.width[1], hash3(i, 1, S + 1403)), L = Sh.reach / dir[2];
    const at = (t, sd, k) => P([c.x + dir[0] * L * t + sd[0] * k, c.y + dir[1] * L * t + sd[1] * k, c.z + dir[2] * L * t + sd[2] * k]);
    for (const sd of [side1, side2]) for (const [t0, t1, a0, a1] of [[0, 0.45, Sh.alpha[0], Sh.alpha[1]], [0.45, 1, Sh.alpha[1], 0]]) {
      // each sheet in two halves, clear at its outer edges: a beam with a soft side, not a pane
      const w0 = (w / 2) * (1 + 0.5 * t0), w1 = (w / 2) * (1 + 0.5 * t1);
      for (const sg of [-1, 1]) out.push({ corners: [at(t0, sd, 0), at(t0, sd, sg * w0), at(t1, sd, sg * w1), at(t1, sd, 0)], normal: [0, 0, 1], water: true, fill, cornerAlpha: [a0, 0, 0, a1].map(r5), group: 'jungle:shaft' });
    }
  });
  return out;
}

/** The grade: lift the blacks, desaturate toward the luma, tint, gain — over a '#rrggbb'. */
function gradeHex(h, g) {
  const c = hexRgb(h), l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return rgbHex(c.map((v, k) => Math.max(0, Math.min(1, g.lift[k] + g.gain * g.tint[k] * (l + g.sat * (v - l))))));
}
function gradeFaces(faces, g) {
  return faces.map((f) => (f.fill || f.cornerFills ? { ...f, ...(f.fill ? { fill: gradeHex(f.fill, g) } : {}), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((c) => gradeHex(c, g)) } : {}) } : f));
}

/** Jungle by cause, over the nature builder's marks: moss up the giants' bases, darker wood in the shade. */
function jungleMarks(st, site, dir, seed, giants, wet) {
  const base = natureMarks(st, site, dir, seed, giants.map((g) => ({ x: g.x, y: g.y, h: g.h })), wet), S = seed | 0;
  const Bl = st.blend, Wm = st.woodMarks, Ls = st.leafShade, cardMid = new Map(), edge = st.trailBlend ? trailEdgeCover(st, site, seed) : null;
  const midZ = (f) => { let m = cardMid.get(f); if (m === undefined) { m = f.corners.reduce((a, q) => a + q[2], 0) / f.corners.length; cardMid.set(f, m); } return m; };
  return (f, c) => {
    if (f.group === 'trail:ground' && f.texture === st.tiles.trail.key) {
      // the trail blended into the floor: one soil, a value that wanders from the packed centre out to the patchy floor
      const hw = site.halfWAt(c[1]), d = site.trailDist(c[0], c[1]);
      const wander = (vnoise(c[0] * 0.55, c[1] * 0.55, S + 1211) - 0.5) * 2 * Bl.wander + (vnoise(c[0] * 2.3, c[1] * 2.3, S + 1213) - 0.5) * 0.35;
      const w = edge ? edge(c[0], c[1]) : smooth(hw * Bl.edge[0], hw + site.fringeAt(c[1]) + Bl.edge[1], d + wander);
      const packed = 1 + 0.18 * Math.max(0, 1 - (d / hw) ** 2), patch = 1 - Bl.patch + 2 * Bl.patch * vnoise(c[0] * 0.35, c[1] * 0.35, S + 1215);
      const damp = wet.reduce((m, q) => Math.min(m, mix(0.68, 1, smooth(q.r * 0.7, q.r * 1.9, Math.hypot(q.x - c[0], q.y - c[1])))), 1);
      return [0, 1, 2].map((k) => mix(packed, Bl.floor[k] * patch, w) * damp);
    }
    if (f.group === 'jungle:wood' || f.group === 'jungle:fern-trunk') {
      // by cause: moss climbs the base, sits on the limbs' tops and the side the sun never reaches; lichen in pale
      // blotches; rain runs down the trunk in dark streaks
      const n = f.normal, up = c[2] - site.ground(c[0], c[1]), lit = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
      const grow = Math.max(1 - smooth(0.4, Wm.base, up), 0.8 * Math.max(0, n[2]), 0.55 * Math.max(0, -lit));
      const moss = Math.min(1, grow * 1.3) * smooth(0.28, 0.62, vnoise(c[0] * 0.9 + c[1] * 0.4, c[2] * 0.7, S + 1201));
      const lichen = smooth(0.72, 0.86, vnoise(c[0] * 1.7, c[2] * 1.3 + c[1], S + 1203)) * (1 - moss);
      const streak = Wm.streak * smooth(0.55, 0.85, vnoise((c[0] + c[1]) * 2.4, c[2] * 0.12, S + 1205)) * (1 - moss);
      return [0, 1, 2].map((k) => mix(1, Wm.moss[k], moss) * mix(1, Wm.lichen[k], lichen) * (1 - streak));
    }
    if (f.group === 'jungle:under' || f.group === 'jungle:epiphyte' || f.group === 'jungle:fern' || f.group === 'jungle:grass') {
      // a plant's own shade: darker toward its foot, where its leaves overlap and the floor's shade rises
      const foot = f.group === 'jungle:under' || f.group === 'jungle:grass' ? site.ground(c[0], c[1]) : Math.min(...f.corners.map((q) => q[2]));
      const v = mix(Ls.foot, 1, smooth(0, f.group === 'jungle:under' ? 1.3 : 0.9, c[2] - foot)); return [v, v, v * 0.96];
    }
    if (f.group === 'jungle:crown' || f.group === 'jungle:canopy') { const v = c[2] < midZ(f) ? Ls.under : 1; return [v, v, v]; }
    if (f.group === 'jungle:vine') return [Ls.vine, Ls.vine, Ls.vine];
    return base(f, c);
  };
}

/** Soft shadow blobs under the near understory and the tree ferns: the leaves' own shade on the floor. */
function plantShadows(st, site, raw) {
  const out = [], seen = new Set();
  for (const f of raw) {
    if (f.group !== 'jungle:under' && f.group !== 'jungle:fern-trunk') continue;
    const x = (f.corners[0][0] + f.corners[1][0]) / 2, y = (f.corners[0][1] + f.corners[1][1]) / 2, k = `${Math.round(x * 2)},${Math.round(y * 2)}`;
    if (seen.has(k) || site.trailDist(x, y) > st.rings.near) continue; seen.add(k);
    const half = f.group === 'jungle:fern-trunk' ? 1.3 : Math.hypot(f.corners[1][0] - f.corners[0][0], f.corners[1][1] - f.corners[0][1]) * 0.42, z = site.ground(x, y) + 0.04;
    out.push({ corners: [[x - half, y - half, z], [x + half, y - half, z], [x + half, y + half, z], [x - half, y + half, z]].map(P), normal: [0, 0, 1], decal: 'shadow', shadowAlpha: st.contact.plant, group: 'trail:shadow' });
  }
  return out;
}

/** The jungle's unlit faces and its sun: { site, giants, rocks, puddles, raw, dir, shadow } (the tests read it too). */
export function jungleLayers(st, seed = 1) {
  const site = natureSite(st, seed), colossi = colossusItems(st, site);
  site.blocked = (x, y) => colossi.some((c) => Math.hypot(x - c.x, y - c.y) < c.reach + 0.4);   // nothing grows inside a massive trunk's foot
  const giants = giantItems(st, site, seed).filter((g) => !colossi.some((c) => Math.hypot(g.x - c.x, g.y - c.y) < c.reach + 4)), rocks = rockItems(st, site, seed), puddles = puddleSpots(st, site);
  const { wood, crowns, epi } = giantFaces(st, site, giants), ferns = treeFernFaces(st, site, giants, seed);
  const raw = [
    // the trail's ribbon wears the floor's own soil mapped the floor's way (world x, y), so no seam shows where it meets
    // the ground: only the value tells the trail from the floor
    ...groundFaces(st, site), ...trailFaces(st, site).flatMap((f) => dice(f, st.trail.dice || 1)).map((f) => ({ ...f, uv: f.corners.map((q) => [r5(q[0] / st.tiles.trail.scale), r5(q[1] / st.tiles.trail.scale)]) })), ...rockFaces(st, rocks),
    ...debrisFaces(st, site, giants.filter((g) => g.near).map((g) => ({ x: g.x, y: g.y, h: g.h })), seed),
    ...wood, ...colossusFaces(st, site, colossi, seed), ...crowns, ...epi, ...ferns.faces, ...understoryFaces(st, site, giants, seed), ...litterFaces(st, site, seed),
    ...vineFaces(st, site, giants, crowns, seed), ...spiralFaces(st, giants), ...bambooFaces(st, site, seed), ...canopyFaces(st, site, seed), ...wallFaces(st, site, seed),
  ];
  const key = st.light.key, dir = sunDir(key.elevation, key.azimuth);
  // the sun's occluders: everything that stands (litter lies flat and the far walls are beyond the floor); a card stops
  // the sun only where its painted leaf is
  const shadow = makeSunShadow(raw, dir, { cell: 0.8, skip: (f) => f.group === 'jungle:litter' || f.group === 'jungle:wall' || f.group === 'jungle:twig' || f.group === 'jungle:grass', maskOf: (f) => (isCard(f) ? cardMask(f.texture) : null) });
  // tall grass needs to know where the light falls, so it comes after the sun; it is no occluder (it is skipped above)
  raw.push(...tallGrassFaces(st, site, shadow, seed));
  return { site, giants, colossi, rocks, puddles, raw, dir, shadow };
}

/** manifest → World payload, for a stage whose kit is a jungle kit. */
export function assembleJungleScene(manifest = {}, ctx = {}) {
  const st = JUNGLE_STYLES[manifest.style || 'jungle-mgs3'];
  if (!st) throw new Error(`stage: unknown jungle style '${manifest.style}' (known: ${Object.keys(JUNGLE_STYLES).join(', ')})`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1;
  const { site, giants, colossi, rocks, puddles, raw, dir, shadow } = jungleLayers(st, seed), key = st.light.key;
  const sun = { dir, rgb: hexRgb(key.color), gain: st.light.sunGain, bounce: st.light.bounce, bounceGain: st.light.bounceGain, shadow };
  const ambient = hexRgb(st.light.ambient).map((v) => v * st.light.fill);
  // a leaf is lit from either side (it lets the light through): its card faces the sun, and lifts a little on its own
  const faced = [...raw, ...mossFaces(st, site, raw, shadow, dir, seed)].map((f) => {
    if (!isCard(f) || f.group === 'jungle:litter') return f;
    const d = f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2];
    const n = d < 0 ? f.normal.map((v) => -v) : f.normal, lift = 1 + st.light.leafLift;
    return { ...f, normal: n, outNormal: n, tint: f.tint.map((v) => v * lift) };
  });
  const marks = jungleMarks(st, site, dir, seed, giants, puddles);
  const lit = ctx.unshaded
    ? faced.map(({ tint, cls, ...f }) => ({ ...f, fill: rgbHex(tint) }))
    : bakeStageLight(faced, [], ambient, marks, sun).map(({ cls, detail, colossus, ...f }) => f);
  const decals = [...contactShadows(st, site, [...giants.map((g) => ({ x: g.x, y: g.y, h: g.h * 0.5 })), ...colossi.map((c) => ({ x: c.x, y: c.y, h: c.R * 22 }))], rocks), ...plantShadows(st, site, raw)];
  const grade = (rgb) => hexRgb(gradeHex(rgbHex(rgb.map((v) => v / 255)), st.grade)).map((v) => Math.round(v * 255));
  const y0 = 2, x0 = site.trailX(y0), y1 = 22, x1 = site.trailX(y1);
  const eye = [x0, y0, site.ground(x0, y0) + 1.7];
  const faces = [...gradeFaces(lit, st.grade), ...decals, ...puddleFaces(st, site, puddles), ...(st.shafts ? shaftFaces(st, site, shadow, dir, seed) : [])];
  return {
    faces,
    cutouts: [...new Set(faces.filter(isCard).map((f) => f.texture))].sort(),
    ...(st.clouds ? { effects: [composeCloudDeck([], { up: 'z', ...st.clouds, sun: dir })] } : {}),
    lights: [],
    cameras: [manifest.camera || { name: 'jungle', worldFraming: { cameraPosition: eye.map(r5), lookAt: [x1, y1, site.ground(x1, y1) + 2.5].map(r5), horizontalFov: 75, pictureCenter: [560, 390] } }],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: ctx.title || manifest.title || 'mojulo stage · jungle',
    bg: gradeHex(rgbHex(st.air.dome.horizon.map((v) => v / 255)), st.grade),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { zenith: grade(st.air.dome.zenith), horizon: grade(st.air.dome.horizon), day: 1, stars: 0, seed: 1 },
    glow: false,
    walk: manifest.walk === false ? false : { speed: 5, spawn: eye.map(r5), minEye: 1.7, gravity: 22, radius: 0.4 },
  };
}
