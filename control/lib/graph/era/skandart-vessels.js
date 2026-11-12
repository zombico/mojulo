/**
 * SKANDART'S VESSELS — what a room kept and left: its pots, urns, jars, crates and barrels, standing in groups against
 * its walls where they were stored (a kit's card's `vessels`, or its use's: era/skandart-derive.js USES). They are a
 * room's leavings like its heaps (era/skandart.js), so the room's amount says how they were left: the further gone, the
 * more lie tipped on their sides and the more are already broken where they stood, sherds and splinters off the debris
 * shelf. Each standing or tipped vessel is one THING (a solid doodad of its own, its faces named), so a game that lets
 * objects break (playscape/destruct/breakability.js: `destruction`, objects and up) breaks it like any crate or pot:
 * slashed, shot, blown apart. A group takes a bay in a heap's place (skandartStamps, before the wall's heap rhythm).
 *
 *   VESSELS                                      the numbers
 *   CLASS_OF                                     a vessel's kind → the thing it is to the breakables (a jar is an amphora)
 *   readVessels(v)                               a card's `vessels` checked: { kinds: { kind: weight }, every }
 *   skandartVessels(plan, bays, { amount, read, seed }) → { faces, anchors, laws }
 *     bays    [{ x, y, len, N, U, out }]: each bay's middle at the wall's foot, its length, the wall's normal into the
 *             room and along it, how far out of the wall the floor begins (its plinth)
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { P, r5 } from './geom.js';
import { buildProp, propSurfaces } from './props.js';
import { debrisPiece } from './debris-shelf.js';
import { skandartRead } from './skandart.js';

export const VESSELS = Object.freeze({
  // each kind: its half breadth on the floor (m), what it breaks to, and that piece's size range (m)
  kinds: Object.freeze({
    pot: Object.freeze({ r: 0.22, breaks: 'sherd', size: Object.freeze([0.12, 0.24]), tint: Object.freeze([0.62, 0.42, 0.3]) }),
    urn: Object.freeze({ r: 0.25, breaks: 'sherd', size: Object.freeze([0.14, 0.26]), tint: Object.freeze([0.46, 0.34, 0.28]) }),
    jar: Object.freeze({ r: 0.21, breaks: 'sherd', size: Object.freeze([0.12, 0.24]), tint: Object.freeze([0.62, 0.42, 0.3]) }),
    crate: Object.freeze({ r: 0.38, breaks: 'plank', size: Object.freeze([0.35, 0.7]), tint: Object.freeze([0.42, 0.36, 0.3]) }),
    barrel: Object.freeze({ r: 0.33, breaks: 'plank', size: Object.freeze([0.3, 0.6]), tint: Object.freeze([0.36, 0.3, 0.25]) }),
  }),
  // a wall's bays that hold a group (one in `every`), the group's size, the gap between two vessels (m)
  every: 3, group: Object.freeze([2, 4]), gap: 0.08,
  // the share tipped at the amount's ends, and the share already broken (from `from` of the amount, at most `most`)
  tipped: Object.freeze([0.1, 0.6]), broken: Object.freeze({ from: 0.35, most: 0.6 }), pieces: Object.freeze([7, 11]),
  // a broken clay vessel's lower part left standing (of its height)
  rest: Object.freeze([0.25, 0.5]),
});
export const CLASS_OF = Object.freeze({ pot: 'pot', urn: 'urn', jar: 'amphora', crate: 'crate', barrel: 'barrel' });

const mix = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

export function readVessels(v, at = 'skandart.vessels') {
  if (v === undefined || v === null || v === false) return null;
  if (typeof v !== 'object' || Array.isArray(v) || !v.kinds || typeof v.kinds !== 'object') throw new Error(`stage: ${at} is { kinds: { <${Object.keys(VESSELS.kinds).join(' | ')}>: how many of each, by share }, every? }`);
  for (const [k, n] of Object.entries(v.kinds)) {
    if (!VESSELS.kinds[k]) throw new Error(`stage: ${at}.kinds: '${k}' is no vessel (${Object.keys(VESSELS.kinds).join(', ')})`);
    if (!(typeof n === 'number' && n > 0)) throw new Error(`stage: ${at}.kinds.${k} is how many, by share: a number over 0`);
  }
  if (v.every !== undefined && !(Number.isInteger(v.every) && v.every >= 1)) throw new Error(`stage: ${at}.every is one bay in so many holding a group: a whole number, 1 or more`);
  return { kinds: v.kinds, every: v.every ?? VESSELS.every };
}

/** Turn `pts` about the axis `ax` (unit, through `o`) by `a` (Rodrigues). */
const turn = (p, o, ax, a) => {
  const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], c = Math.cos(a), s = Math.sin(a), d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2];
  const cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
  return [0, 1, 2].map((k) => o[k] + v[k] * c + cr[k] * s + ax[k] * d * (1 - c));
};

export function skandartVessels(plan, bays, { amount, read = skandartRead(), seed = 1, card }) {
  const A = VESSELS, V = readVessels(card), faces = [], anchors = [], laws = [], count = {};
  if (!V) return { faces, anchors, laws };
  const S = propSurfaces(plan.kit.dress?.props ?? {}), kinds = Object.entries(V.kinds), total = kinds.reduce((a, [, n]) => a + n, 0);
  const pick = (d) => { let acc = 0; for (const [k, n] of kinds) { acc += n / total; if (d < acc) return k; } return kinds[kinds.length - 1][0]; };
  const tipShare = mix(A.tipped[0], A.tipped[1], amount), breakShare = Math.min(A.broken.most, Math.max(0, (amount - A.broken.from) / (1 - A.broken.from)) * A.broken.most);
  let standing = 0, tipped = 0, broken = 0;
  bays.forEach((b, bi) => {
    const h = (q) => hash3(seed, bi, 7601 + q), n = A.group[0] + Math.floor(h(1) * (A.group[1] - A.group[0] + 1));
    const group = Array.from({ length: n }, (_, k) => pick(hash3(seed * 7 + bi, k, 7611)));
    // (along the bay, side by side, the group centred in it; as many as fit)
    const widths = group.map((k) => 2 * A.kinds[k].r + A.gap);
    while (widths.reduce((a, w) => a + w, 0) > b.len && group.length > 1) { group.pop(); widths.pop(); }
    let u = -widths.reduce((a, w) => a + w, 0) / 2;
    group.forEach((kind, k) => {
      const K = A.kinds[kind], g = (q) => hash3(seed * 13 + bi, k, 7621 + q), uc = u + widths[k] / 2;
      u += widths[k];
      const p = P([b.x + b.U[0] * uc + b.N[0] * b.out, b.y + b.U[1] * uc + b.N[1] * b.out, 0]), sd = Math.round(g(9) * 1e6);
      const state = g(1) < breakShare ? 'broken' : g(2) < tipShare ? 'tipped' : 'standing';
      if (state === 'broken') {
        // (broken where it stood: a clay one's lower part still standing, open at the break, its pieces about its foot,
        // none under the eye spot)
        if (K.breaks === 'sherd') { const rest = []; buildProp(kind, rest, p, b.N, b.U, 0, sd, { ...S, cut: mix(A.rest[0], A.rest[1], g(7)) }); for (const f of rest) faces.push({ ...f, group: 'stage:prop', doubleSided: true }); }
        const m = Math.round(mix(A.pieces[0], A.pieces[1], g(3)));
        for (let j = 0; j < m; j++) {
          const w = mix(K.size[0], K.size[1], hash3(sd, j, 7631)); if (w < read.least) continue;
          const a = hash3(sd, j, 7633) * 2 * Math.PI, r = K.r * mix(0.2, 1.6, hash3(sd, j, 7635)), at = add(add(p, mul(b.N, K.r)), [Math.cos(a) * r, Math.sin(a) * r, 0]);
          for (const f of debrisPiece(K.breaks, w, sd * 31 + j).faces) faces.push({ corners: f.corners.map((c) => P(add(at, c))), normal: f.normal, outNormal: f.normal, tint: K.tint, group: 'stage:prop', doubleSided: true });
        }
        broken++;
        return;
      }
      const id = `${kind}-sk-${(count[kind] = (count[kind] || 0) + 1)}`, mine = [];
      buildProp(kind, mine, p, b.N, b.U, 0, sd, S);
      let out = mine;
      if (state === 'tipped') {
        // (on its side, fallen away from the wall: turned about the level line across its fall, at its foot, then let
        // down to rest on the floor)
        const t = unit(add(mul(b.N, 0.6 + 0.4 * g(4)), mul(b.U, (g(5) - 0.5) * 1.6))), ax = unit([-t[1], t[0], 0]), o = add(p, mul(b.N, K.r));
        const a = (Math.PI / 2) * mix(0.82, 0.97, g(6));
        out = mine.map((f) => ({ ...f, corners: f.corners.map((c) => turn(c, o, ax, a)), normal: turn(f.normal, [0, 0, 0], ax, a), outNormal: turn(f.outNormal ?? f.normal, [0, 0, 0], ax, a) }));
        const low = Math.min(...out.flatMap((f) => f.corners.map((c) => c[2])));
        out = out.map((f) => ({ ...f, corners: f.corners.map((c) => P([c[0], c[1], c[2] - low])), normal: f.normal.map(r5), outNormal: f.outNormal.map(r5) }));
        tipped++;
      } else standing++;
      for (const f of out) faces.push({ ...f, group: 'stage:prop-doodad', doubleSided: true, node: id });
      anchors.push({ id, kind: 'doodad', form: CLASS_OF[kind], vessel: kind, at: p, N: P(b.N), solid: true, ...(state === 'tipped' ? { tipped: true } : {}) });
    });
  });
  // the laws: none floating, none sunk through the floor
  const low = faces.length ? Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2]))) : 0;
  laws.push({ law: 'on-the-floor', what: `the vessels' lowest point ${r5(low)} m`, ok: low >= -0.02 });
  laws.push({ law: 'placed', what: `${standing} standing, ${tipped} tipped, ${broken} broken`, ok: standing + tipped + broken > 0 || !bays.length });
  return { faces, anchors, laws, readout: { standing, tipped, broken } };
}
