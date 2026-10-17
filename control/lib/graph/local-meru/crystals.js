/**
 * THE LAND'S CRYSTALS (`crystals`, opt-in): seeded clusters of real gems (polygonizer/crystal-faces.js) grown out of a
 * local meru's land, where its rock and its hollows say: out of the cliff faces, or in the ground's hollows (scene.js
 * valleyOf). Each cluster is a druse on a disc in its face's plane, stones leaning off the face's normal, many small and
 * a few large; every face carries the `crystal` tag the World page's crystal channel shades live (each stone throwing
 * its own light) and the GLB exports as a transmissive material. Not baked with the land, and not in its sun shadow:
 * a stone's print draws its own.
 *
 *   readCrystals(v)                            the recipe's `crystals`, checked → { gem, where, count, size, glow, seed } or null
 *   crystalSites(C, ground, { valley, avoid, keep, seed })  → [{ q, n }]: where the clusters grow, spaced, off the walks
 *   landCrystalFaces(C, sites)                 → the stones' faces
 *
 * A crystals' words (or a gem's name alone: `'amethyst'`):
 *   gem     one of crystal-optics' gems (quartz, amethyst, calcite, diamond, ruby, sapphire, tourmaline, opal)
 *   where   'crags' (out of the cliff faces, the default) or 'hollows' (in the ground's hollows)
 *   count   clusters, 1 to 24 (8 by default)
 *   size    metres, the longest stone (2.4 by default, 0.2 to 4); the rest run down to half of it
 *   glow    0 to 1: the stones shine in their own colour (a night level's lamp); 0 by default
 *   seed    an integer: another draw of the same land
 */
import { crystalTermFaces } from '../polygonizer/crystal-faces.js';
import { CRYSTAL_GEMS } from '../polygonizer/crystal-optics.js';

export const CRYSTALS = Object.freeze({ where: 'crags', count: 8, size: 2.4, glow: 0, seed: 0 });
const WORDS = ['gem', 'where', 'count', 'size', 'glow', 'seed'];
const WHERE = ['crags', 'hollows'];
// stones per cluster, the share of the longest the least runs to, how far apart clusters stand (× size), the
// clear round a walk (metres): no stone in a path or a stair, and the bed's radius (× size): a tight druse
const STONES = 9, LEAST = 1 / 2, APART = 4, CLEAR = 1.6, BED = 0.35;
// stones are drawn at the gem's own colour for a path in centimetres: true metre paths (a metre of amethyst) read black
const UNIT = 'cm';
const bad = (m) => { throw new Error(`local-meru: crystals${m}`); };

/** The recipe's `crystals`, checked → the crystals, or null when absent. */
export function readCrystals(v) {
  if (v === undefined || v === false || v === null) return null;
  const o = typeof v === 'string' ? { gem: v } : v;
  if (typeof o !== 'object' || Array.isArray(o)) bad(` is a gem's name, or { gem, where?, count?, size?, glow?, seed? }`);
  for (const k of Object.keys(o)) if (!WORDS.includes(k)) bad(`.${k} is not a setting (crystals: ${WORDS.join(', ')})`);
  const C = { ...CRYSTALS, ...o };
  if (!CRYSTAL_GEMS.includes(C.gem)) bad(`.gem is one of ${CRYSTAL_GEMS.join(', ')}`);
  if (!WHERE.includes(C.where)) bad(`.where is 'crags' (out of the cliff faces) or 'hollows' (in the ground's hollows)`);
  if (!(Number.isInteger(C.count) && C.count >= 1 && C.count <= 24)) bad('.count is clusters, an integer 1 to 24');
  if (!(Number.isFinite(C.size) && C.size >= 0.2 && C.size <= 4)) bad('.size is metres, the longest stone, 0.2 to 4');
  if (!(Number.isFinite(C.glow) && C.glow >= 0 && C.glow <= 1)) bad('.glow is 0 to 1');
  if (!Number.isInteger(C.seed)) bad('.seed is an integer');
  return { gem: C.gem, where: C.where, count: C.count, size: C.size, glow: C.glow, seed: C.seed };
}

const hash = (i, s) => { let h = Math.imul(i + 1, 374761393) ^ Math.imul(s + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mid = (cs) => [0, 1, 2].map((k) => (cs[0][k] + cs[1][k] + cs[2][k] + cs[3][k]) / 4);

/**
 * Where the clusters grow: the land's faces of the kind `where` names (cliff faces; or level ground ranked by the
 * valley's hollow at its corners), each scored, then taken best first, APART × size from every one taken and CLEAR of
 * every point in `avoid` (the walks' centres) and where `keep(q)` allows (off the seam). `valley`: scene.js valleyOf(grid),
 * for 'hollows'.
 */
export function crystalSites(C, groundFaces, { valley = null, avoid = [], keep = null, seed = 1 } = {}) {
  const s = seed + 613 + 97 * C.seed, cand = [];
  groundFaces.forEach((f, i) => {
    if (C.where === 'crags' ? f.cel !== 'cliff' : f.group !== 'isekai:ground' || !(f.flat > 0.8)) return;
    const q = mid(f.corners);
    if ((keep && !keep(q)) || avoid.some((a) => Math.hypot(q[0] - a[0], q[1] - a[1]) < CLEAR)) return;
    let score = hash(i, s);
    if (C.where === 'hollows') { const v = valley ? f.corners.map((c) => valley.at(c) ?? 0).reduce((a, b) => a + b, 0) / 4 : 0; if (v < 0.25) return; score = v + 0.25 * score; }
    cand.push({ q, n: f.outNormal ?? f.normal, score, i });
  });
  cand.sort((a, b) => b.score - a.score || a.i - b.i);
  const out = [], gap = APART * C.size;
  for (const c of cand) {
    if (out.length >= C.count) break;
    if (out.some((o) => Math.hypot(o.q[0] - c.q[0], o.q[1] - c.q[1], o.q[2] - c.q[2]) < gap)) continue;
    out.push({ q: c.q, n: c.n });
  }
  return out;
}

/** The stones of every site: a seeded druse on a disc in the face's plane, its own seed per site. */
export function landCrystalFaces(C, sites) {
  const faces = sites.flatMap((site, k) => crystalTermFaces({ id: 'meru:crystals', shape: { kind: 'crystal', gem: C.gem, size: C.size, unit: UNIT, ...(C.glow > 0 ? { glow: C.glow } : {}),
    cluster: { on: { disc: { center: site.q, radius: C.size * BED, normal: site.n } }, count: STONES, seed: 1 + k + 31 * C.seed, lengths: [C.size * LEAST, C.size], tilt: 32, bury: 0.3 } } }, { index: k }));
  // a crag's stones throw no print (scene/crystal-prints.js): the floor it would fall on is not under them
  return C.where === 'crags' ? faces.map((f) => ({ ...f, crystal: { ...f.crystal, print: false } })) : faces;
}
