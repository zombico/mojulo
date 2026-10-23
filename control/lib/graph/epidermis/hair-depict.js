/**
 * HAIR DEPICTION — the grass hat's geometry (dermal-hair.js grassHat: the scalp a lawn of blades, combed, cut and hung)
 * as plain meshes in the chart's frame (metres, x the figure's right, y forward, z up), for whoever wears or measures
 * them: the realistic hero pins them to its head (polygonizer/hero-head-layers.js), the depiction solver scores them.
 *
 *   stripMesh(blades, bands, { streakGroup, centre })  the blades as open strips, banded root to tip
 *   capMesh(chart, D, { tract, S, min, where })        the tuft's base: a coat over the skin that grows the tract's hair
 *   depictHair(chart, D, S, { level })                 the hat on a head: { blades, strips, cap, counts }
 *   hairClass(S) / depictionOf(S, level)               the groom's class and its solved numbers (HAIR_DEPICTION)
 *
 * A mesh is { vertices: [[x, y, z]], faces: [[a, b, c]], groups: [group a face], closure: 'open' | 'closed' }.
 * Deterministic: the same chart, dermis and groom give the same mesh.
 */
import { dermisAt } from './dermal-map.js';
import { hatStrands, hatBlades, partDistance } from './dermal-hair.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };

/** the hair's bands, root to tip: the root darker, its own colour, the tip lighter (the stylized meadow's ramp) */
export const HAIR_BANDS = Object.freeze([[0.25, 'HairRoot'], [0.5, 'HairShade'], [0.78, 'Hair'], [1.01, 'HairTip']]);
/** the ramp's stops (× the hair's colour, linear), root to tip */
export const HAIR_RAMP = Object.freeze({ HairRoot: 0.45, HairShade: 0.72, Hair: 1, HairTip: 1.3 });
/** the CAP (the tuft's base, a coat of the hair's paint): its height over the skin (m: paint, not a mass), the run in from
 * its edge it rises over (m), how far its underside is sunk into the head (m, unseen), and the PART left open (turns
 * round the head either side of the comb's part line: the part shows the scalp, as it does) */
export const HAT_CAP = Object.freeze({ height: 0.0005, edge: 0.004, sink: 0.001, part: 0.004 });

/**
 * BLADES as one open mesh: each blade { pts, across?, half } a strip, its stations' two edges `half` either side along
 * `across` (absent, square to the blade and to its way out from `centre`: the blade lies along the head, combed), its tip
 * one point; banded root to tip by `bands` ([share, group] pairs, the first whose share the segment's middle is under), a
 * streak's blade `streakGroup` whole. Open and double-sided, as grass is.
 */
export function stripMesh(blades, bands = HAIR_BANDS, { streakGroup = null, centre = [0, 0, 0] } = {}) {
  const vertices = [], faces = [], groups = [];
  const put = (p) => vertices.push(p) - 1, face = (a, b, c, g) => { faces.push([a, b, c]); groups.push(g); };
  for (const B of blades) {
    const M = B.pts.length - 1, L = [], R = [];
    const across = (i) => B.across?.[i] ?? unit(cross(unit(sub(B.pts[Math.min(M, i + 1)], B.pts[Math.max(0, i - 1)])), sub(B.pts[i], centre)));
    for (let i = 0; i < M; i++) { const p = B.pts[i], a = across(i), h = B.half[i]; L.push(put(p.map((v, q) => v + a[q] * h))); R.push(put(p.map((v, q) => v - a[q] * h))); }
    const tip = put(B.pts[M]);
    const g = (i) => (B.streak && streakGroup ? streakGroup : bands.find(([u]) => (i + 0.5) / M < u)?.[1] ?? bands.at(-1)[1]);
    for (let i = 0; i + 1 < M; i++) { face(L[i], R[i], R[i + 1], g(i)); face(L[i], R[i + 1], L[i + 1], g(i)); }
    face(L[M - 1], R[M - 1], tip, g(M - 1));
  }
  return { vertices, faces, groups, closure: 'open' };
}

/**
 * THE TUFT'S BASE as one closed mesh: the chart's faces where the dermis grows `tract`'s hair (dermal-map.js dermisAt: the
 * scalp's terminal tract, so the hairline, a peak and a loss are its edge and a bald crown is left bare; a beard's where
 * its locks are at least `min` mm; `where` a point's own test; off the groom `S`'s part), raised off the skin to
 * HAT_CAP.height (rising to it over HAT_CAP.edge from its edge, so the hairline is soft) above an underside sunk into the
 * head, walled round its edge, in `group`. A point its edge would pass twice (a pinch) lets go of the faces that make it.
 * Null where none grows.
 */
export function capMesh(chart, D, { tract = 'scalp', group = 'HairRoot', S = null, min = 0, where = null, height = HAT_CAP.height } = {}) {
  const V = chart.vertices, N = chart.normals;
  const inside = chart.samples.map((s, i) => { if (!s || s.feature || (where && !where(V[i]))) return false; const H = dermisAt(s, D, { detail: false }).hair; return H.tract === tract && H.kind === 'terminal' && H.length >= min && !(S && partDistance(s, S) < HAT_CAP.part); });
  let F = chart.faces.filter((t) => t.every((v) => inside[v]));
  const k = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (let pass = 0; pass < 64; pass++) {
    const uses = new Map();
    for (const t of F) for (let e = 0; e < 3; e++) { const kk = k(t[e], t[(e + 1) % 3]); uses.set(kk, (uses.get(kk) || 0) + 1); }
    const deg = new Map(); for (const [kk, n] of uses) if (n === 1) for (const v of kk.split('|')) deg.set(v, (deg.get(v) || 0) + 1);
    const pinched = new Set([...deg].filter(([, d]) => d > 2).map(([v]) => Number(v)));
    if (!pinched.size) break;
    const open = (t) => [0, 1, 2].filter((e) => uses.get(k(t[e], t[(e + 1) % 3])) === 1).length;
    F = F.filter((t) => !(t.some((v) => pinched.has(v)) && open(t) > 0));
  }
  if (!F.length) return null;
  // its edge (each edge one face uses) and each point's run in from it, the shortest over the faces' edges
  const count = new Map(), adj = new Map();
  for (const t of F) for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; count.set(k(a, b), (count.get(k(a, b)) || 0) + 1); for (const [p, q] of [[a, b], [b, a]]) (adj.get(p) || adj.set(p, new Set()).get(p)).add(q); }
  const edges = [...count].filter(([, n]) => n === 1).map(([kk]) => kk.split('|').map(Number)), run = new Map();
  let front = [...new Set(edges.flat())]; front.forEach((v) => run.set(v, 0));
  while (front.length) { const next = []; for (const v of front) for (const q of adj.get(v) || []) { const d = run.get(v) + Math.hypot(...sub(V[q], V[v])); if (!(run.get(q) <= d)) { run.set(q, d); next.push(q); } } front = next; }
  const vertices = [], faces = [], top = new Map(), bot = new Map();
  for (const v of adj.keys()) {
    const n = unit(N[v]), h = height * Math.min(1, (run.get(v) ?? 0) / HAT_CAP.edge);
    top.set(v, vertices.push(V[v].map((x, q) => x + n[q] * h)) - 1); bot.set(v, vertices.push(V[v].map((x, q) => x - n[q] * HAT_CAP.sink)) - 1);
  }
  for (const t of F) { faces.push(t.map((v) => top.get(v))); faces.push([...t].reverse().map((v) => bot.get(v))); }
  // the wall round its edge, each edge's way round as the face that uses it runs
  const way = new Set(); for (const t of F) for (let e = 0; e < 3; e++) way.add(`${t[e]}>${t[(e + 1) % 3]}`);
  for (const [a, b] of edges) { const [p, q] = way.has(`${a}>${b}`) ? [a, b] : [b, a]; faces.push([top.get(q), top.get(p), bot.get(p)]); faces.push([top.get(q), bot.get(p), bot.get(q)]); }
  return { vertices, faces, groups: faces.map(() => group), closure: 'closed' };
}

/**
 * A GROOM'S CLASS, how its hat is cut into blades (one procedure a class: the depiction solver's unit, never a style's
 * own): `rope` its hair in locs or rows, `tied` gathered into a tail, a braid or a bun, `coil` curly or coily, `standing`
 * gelled or stood up (a spike, a crest), `cropped` under 6 cm, `short` under 15 cm, `long` the rest.
 */
export function hairClass(S) {
  const tails = (S.ties || []).map((T) => T.tail?.kind ?? 'tail');
  if (tails.some((k) => k === 'loc' || k === 'row')) return 'rope';
  if (tails.length) return 'tied';
  if (S.type === 'curly' || S.type === 'coily') return 'coil';
  if ((S.stand ?? 0) >= 0.5 || (S.gel ?? 0) >= 0.6 || S.cut?.strip) return 'standing';
  return S.length < 0.06 ? 'cropped' : S.length < 0.15 ? 'short' : 'long';
}
/**
 * THE DEPICTION's numbers a class and rung (over HAIR_LADDER's: `widen` the blades' width, `turn` the degrees a kept
 * point needs, `stations` the spans of a straight fall, `lie` how flat a short blade lies, `cap` the most spans a blade
 * keeps), solved by the depiction solver (epidermis/hair-solve.js: the fewest faces whose coat and blades leave no bald
 * spot and hold the strands' outline) and written here; a rung a class has no row for is the ladder's own.
 */
export const HAIR_DEPICTION = Object.freeze({});
export const depictionOf = (S, level = 'L1') => HAIR_DEPICTION[hairClass(S)]?.[level] ?? {};
/** the hat's blades as its strips (a grey streak's blade in the hair's own bands) */
export const stripsOf = (blades, centre) => (blades.length ? stripMesh(blades.map((b) => (b.streak?.grey ? { pts: b.pts, half: b.half } : b)), HAIR_BANDS, { streakGroup: 'HairStreak', centre }) : null);

/** THE HAT on a head: the groom's blades at `level` on the ladder (dermal-hair.js HAIR_LADDER), by its class's solved
 * numbers (`rules` over them), as strips, and the coat under them (a buzz, lying on the scalp, is the coat alone).
 * `centre` the head's middle the blades lie round. */
export function depictHair(chart, D, S, { level = 'L1', centre = [0, 0, 0], rules = null } = {}) {
  const G = hatStrands(chart, D, S, { level });
  const blades = G.counts.lying ? [] : hatBlades(G, { level, centre, rules: rules ?? depictionOf(S, level) });
  return { blades, strips: stripsOf(blades, centre), cap: capMesh(chart, D, { S }), counts: G.counts };
}
