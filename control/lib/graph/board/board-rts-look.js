/**
 * THE SKIRMISH'S LOOK — each unit and building a civilization fields (board-rts-tech.js) drawn as the thing its
 * technology crafted: its chassis and adornment where its form has a body plan (tech-adornment.js), else its block
 * (era/blocks.js), painted in its finish over the world's kit, cut to what reads from the RTS camera (technology's LOD:
 * tech-eras.js designs at the person-scale cameras; top-down sees the largest faces only), and fitted to its spot.
 *
 *   rtsLooks(G, cid, roster, { kit, seed? }) → { <unit or building id>: look }
 *     look: { pal: ['#rrggbb', …], team: [palette indexes the side's colour takes], t: [palette index a triangle],
 *             p: [x, y, z × 3 a triangle, in centimetres], h: height in metres, hand?: true }
 *   a held weapon's look is a hand's (`hand`: the token figure carries it); everything else stands on its spot, its
 *   front +x, its foot at z 0, centred
 *
 * Only what the civilization crafted has a look: a fallback (a plain worker, soldier, archer, base, barracks, works,
 * lab) has none and adds nothing; the page draws it as before. Pure: the same gameworld, the same looks.
 */
import { buildBlock, blockPaint } from '../era/blocks.js';
import { paintFill } from '../era/out-structures-draw.js';
import { buildAdorned } from '../gameworld/tech-adornment.js';
import { hasChassis } from '../gameworld/tech-chassis.js';
import { resolveTechDirection } from '../gameworld/tech-direction.js';
import { civLibrary, CRAFTED } from '../gameworld/world.js';

// how many triangles each reads in from above, and how wide it stands (metres; a spot is the board's cell, 2 m)
export const RTS_LOOK_CEILING = Object.freeze({ unit: 120, building: 200, hand: 40 });
const FOOT = { worker: 0.9, melee: 0.6, ranged: 0.6, guard: 0.6, heavy: 1.6, scout: 1.0, fighting: 1.3, flyer: 1.3, siege: 1.2 };
const BUILDING_FOOT = 1.8, HAND = 0.7, TALLEST = 3.2;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const area = (c) => { let s = 0; for (let i = 1; i + 1 < c.length; i++) { const n = cross(sub(c[i], c[0]), sub(c[i + 1], c[0])); s += Math.hypot(n[0], n[1], n[2]) / 2; } return s; };

/** The faces a crafted thing is drawn by: its adorned chassis where its form has a body plan, else its block. */
function facesOf(G, cid, list, id, seed) {
  const C = G.civilizations[cid], t = C.technology[list][id], kind = CRAFTED[list];
  const D = kind ? resolveTechDirection(G, cid) : null, r = D?.ranks?.[`${list}/${id}`];
  if (D && r && hasChassis(kind, t.form)) {
    return buildAdorned(t, { kind, direction: D, rank: r.rank, use: r.use }).faces.map((f) => ({ corners: f.corners, group: f.group ?? 'tech:body', value: f.value ?? 0.5 }));
  }
  return buildBlock(t.block, { seed: t.seed ?? seed, library: civLibrary(C) }).faces.map((f) => ({ corners: f.corners, group: f.group ?? 'tech:body', value: f.value ?? 0.5 }));
}

/** Faces cut to a ceiling (the largest first, a face's triangles a fan), painted, fitted, packed. */
export function lookOf(faces, paint, { ceiling, foot, hand = false }) {
  const tris = (f) => Math.max(0, f.corners.length - 2);
  const ranked = faces.map((f, i) => ({ f, i, a: area(f.corners) })).filter((x) => x.a > 1e-9 && tris(x.f)).sort((a, b) => b.a - a.a || a.i - b.i);
  const kept = [];
  let n = 0;
  for (const x of ranked) { if (n + tris(x.f) > ceiling) continue; kept.push(x); n += tris(x.f); }
  kept.sort((a, b) => a.i - b.i);
  if (!kept.length) return null;
  // its team colour: the group with the most area (the main mass), as an engine's mask would take it
  const byGroup = {};
  for (const x of kept) byGroup[x.f.group] = (byGroup[x.f.group] ?? 0) + x.a;
  const main = Object.keys(byGroup).sort((a, b) => byGroup[b] - byGroup[a] || (a < b ? -1 : 1))[0];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of kept) for (const c of x.f.corners) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], 1e-6), height = Math.max(hi[2] - lo[2], 1e-6);
  const s = hand ? HAND / Math.max(span, height) : Math.min(foot / span, TALLEST / height);
  const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]];
  const pal = [], team = [], t = [], p = [], ix = {};
  const colour = (f) => {
    const hex = paintFill(paint, f.group, f.value), key = `${hex}${f.group === main ? '*' : ''}`;
    if (ix[key] === undefined) { ix[key] = pal.length; pal.push(hex); if (f.group === main) team.push(ix[key]); }
    return ix[key];
  };
  const at = (c) => [Math.round((c[0] - mid[0]) * s * 100), Math.round((c[1] - mid[1]) * s * 100), Math.round((c[2] - mid[2]) * s * 100)];
  for (const { f } of kept) {
    const k = colour(f), c = f.corners.map(at);
    for (let i = 1; i + 1 < c.length; i++) { t.push(k); p.push(...c[0], ...c[i], ...c[i + 1]); }
  }
  return { pal, team, t, p, h: Math.round(height * s * 100) / 100, ...(hand ? { hand: true } : {}) };
}

/** The looks of what a civilization fields, by roster id. */
export function rtsLooks(G, cid, roster, { kit, seed = 1 } = {}) {
  const C = G.civilizations[cid];
  if (!C) throw new Error(`board rts: '${cid}' is not one of the world's civilizations`);
  const paint = blockPaint(kit, C.technology?.finish ?? 'alloy'), looks = {};
  for (const l of roster.ledger) {
    if (!l.of || !l.as) continue;
    const [list, id] = l.of.split('/'), U = roster.units[l.as], hand = !!U && ['melee', 'ranged', 'guard'].includes(U.role);
    const ceiling = hand ? RTS_LOOK_CEILING.hand : U ? RTS_LOOK_CEILING.unit : RTS_LOOK_CEILING.building;
    const look = lookOf(facesOf(G, cid, list, id, seed), paint, { ceiling, foot: U ? FOOT[U.role] ?? 1 : BUILDING_FOOT, hand });
    if (look) looks[l.as] = look;
  }
  return looks;
}
