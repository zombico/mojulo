/**
 * AUTHORED JACKET — the jacket as built (body-relational-jacket.js, the realistic body's; docs/garment-principles.md,
 * "a jacket opens") on the GAME BODY, the authored and the tiered hero, where the outer garment was a closed tube with its
 * opening painted on it. Run from the kit hook (authored-kit.js) when the outfit names a jacket's CONSTRUCTION
 * (`tailoring.jacket`: `zip`, `open`, `rib`, `pockets`, `epaulettes`, `collar: 'shirt'`):
 *
 *   the OPENING  each of the jacket's own pieces on the trunk (`outer_torso`, `outerTail_pelvis`) and its collar opened at
 *                the centre front (`openFront`: a C in section, two real edges), by one gap down the whole jacket: a
 *                zip's, or worn open, widening up the chest. The pieces keep their names and their stations' ids (what was
 *                placed on them, and the dials, find them), their trims carried across the opening (`bandGroups` read
 *                round the ring from the front edge)
 *   its PIECES   the zip down the front, the rib waistband and cuffs, the flapped pockets, the shirt collar's points, the
 *                epaulettes (`zipDown`, `jacketPieces`), laid on a VIEW of the jacket as the realistic body makes it: its
 *                trunk pieces one tube (`oneTube`, the tail and the body) opened as the pieces are, each sleeve one tube
 *
 *   authoredJacket(recipe, cloth, J, { read }) → { parts, carriers }   `parts` the opened pieces (by their own names) and
 *       the new ones; `carriers` each new piece's body part, for the dials (authored-kit.js followDials); `read` the
 *       garments under the jacket as they are read (authored-kit.js readOf: rings put between the game body's sparse ones)
 * The game body's ring is ring12: it is opened to `ARC` points a side (the realistic body's 25 would be a hundred points
 * round a twelve-sided cloth). Weights by ring (`rings`). Pure and deterministic.
 */
import { openFront, zipDown, jacketPieces, JACKET } from './body-relational-jacket.js';
import { oneTube } from './body-relational-tailor.js';

/** the opened ring's points a side (its slots 4·ARC − 2) */
export const ARC = 10;
/** the jacket's own pieces on the game body, by their role: the trunk (top to bottom: the body, then its tail), the
 * sleeves (the upper arm's, the forearm's), the collar */
const BODY = ['outer_torso', 'outerTail_pelvis'], SLEEVE = (S) => [`outerSleeve_upperArm${S}`, `outerCuff_foreArm${S}`], COLLAR = 'outerCollar_neck';

const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const middle = (st) => mean(Object.values(st.points));

/** a piece opened (openFront) with its TRIMS carried over: each band's groups (one a half-ring slot, front to back) read
 * for the opened ring by place round it from the front edge, the outer face's and the inner face's alike */
function opened(P, gap) {
  const O = openFront(P, { gap, arc: ARC }), half = P.slots.length / 2, N = O.slots.length, H = N / 2, m = ARC;
  if (!P.bandGroups) return O;
  const at = (k) => Math.min(half - 1, Math.round((k < m ? 1 - k / Math.max(1, m - 1) : (k - m) / Math.max(1, H - 1 - m)) * (half - 1)));
  return { ...O, bandGroups: Object.fromEntries(Object.entries(P.bandGroups).map(([band, G]) => [band, Array.from({ length: H }, (_, k) => G[at(k)])])) };
}

/** The jacket on the game body (see the head of this file). `cloth` the recipe's garments by name. */
export function authoredJacket(recipe, cloth, J, { read = (P) => P } = {}) {
  const parts = {}, carriers = {};
  const body = BODY.filter((k) => cloth[k]);
  if (!J || !body.length) return { parts, carriers };
  if (J.cloth) for (const [k, P] of Object.entries(cloth)) if (/^outer[A-Z]?\w*_/.test(k)) parts[k] = { ...P, cloth: J.cloth };
  if (!(J.zip || J.open)) return { parts, carriers };
  const own = (k) => parts[k] ?? cloth[k];
  // THE OPENING: one gap down the whole jacket (its trunk pieces' height): a zip's, or open, widening up the chest
  const zs = body.flatMap((k) => own(k).stations.map((st) => middle(st)[2])), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const gapAt = J.open ? (z) => 0.07 + 0.08 * Math.max(0, Math.min(1, (z - z0) / (z1 - z0))) : () => JACKET.zipGap;
  for (const k of body) parts[k] = opened(own(k), gapAt);
  if (cloth[COLLAR]) parts[COLLAR] = opened(own(COLLAR), () => gapAt(z1));
  // THE VIEW the pieces are laid on: the trunk one tube (its tail's rings below the body's, then the body's) opened as its
  // pieces are, each sleeve one tube; every other garment as worn (under the jacket)
  // (from the pieces as worn, before they were opened)
  const trunk = body.length === 2 ? oneTube(cloth.outerTail_pelvis, cloth.outer_torso) : cloth[body[0]];
  const view = Object.fromEntries(Object.entries(cloth).filter(([k]) => !/^outer[A-Z]?\w*_/.test(k)).map(([k, P]) => [k, read(P)]));
  view.outer_body = { ...openFront(trunk, { gap: gapAt, arc: ARC }), garment: true, group: trunk.group };
  for (const S of ['R', 'L']) { const [a, b] = SLEEVE(S).map((k) => cloth[k]); if (a) view[`outer_arm${S}`] = b ? oneTube(a, b) : a; }
  const made = {};
  if (J.zip && !J.open) Object.assign(made, zipDown(view.outer_body, 'outerZip', { group: 'Buckle', tape: view.outer_body.group ?? 'Outer' }));
  // (the shoulders, where the epaulettes start: each upper arm's first ring, the rig not yet made where the dress is)
  const joints = Object.fromEntries(['R', 'L'].filter((S) => recipe.parts[`upperArm${S}`]).map((S) => [`shoulder${S}`, middle(recipe.parts[`upperArm${S}`].stations[0])]));
  Object.assign(made, jacketPieces(view, 'outer_body', J, { ...recipe, rig: { ...(recipe.rig || {}), joints: { ...(recipe.rig?.joints || {}), ...joints } } }, { gapAt, gathered: {}, rings: true, around: 24 }));
  // (each new piece's body part: a cuff its forearm's, the rest the trunk's at its height)
  const zTorso = Math.min(...(recipe.parts.torso?.stations ?? []).map((st) => middle(st)[2]));
  for (const [k, P] of Object.entries(made)) {
    parts[k] = P;
    const cuff = /cuff([RL])$/.exec(k);
    carriers[k] = cuff ? `foreArm${cuff[1]}` : mean(P.stations.flatMap((st) => Object.values(st.points)))[2] >= zTorso ? 'torso' : 'pelvis';
  }
  return { parts, carriers };
}
