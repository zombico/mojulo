/**
 * IKEBANA — a compositional aid that bundles flora: a cluster is ARRANGED, not scattered. `clustersprout` grows one
 * arrangement from a single root point the way an ikebana arrangement rises from its kenzan; the ZONE PAINTER sprouts
 * arrangements along painted strokes. Built on the flora index (era/out-flora.js): every stem is a doodad, built,
 * leaned and measured there.
 *
 * The principles, from the arrangement:
 *   three principals  SHIN (heaven) the tallest, the line the arrangement is about; SOE (man) three quarters of it,
 *                     leaning out to one side; HIKAE (earth) three quarters of soe, low and forward. Heights and the
 *                     triangle their crowns make are SCALENE: no two alike (a mismatch built in, one leading)
 *   fillers (jushi)   support the principals, shorter, inside their triangle; an odd count
 *   the root (ne)     an accent at the foot: a flowering bush, the arrangement's one bloom (decoration, never the
 *                     accent colour, which is for use)
 *   ma                the empty space: a sector toward the viewer is left open, so the eye can enter
 *   one root          every stem rises from within the kenzan's radius: the bundle
 *   a style           the angles the principals lean at (upright, slanting, spreading) and the side they lean to
 *                     (the hand), mirrored between neighbours along a stroke: adjacent arrangements answer each other
 * A stem leans as far as it still STANDS (the flora index's stands law): a tree leans less than a stem in a vase.
 * Seeded; pure.
 */
import { designFlora, floraLaws, floraMeasures, subSeed } from './out-flora.js';
import { mulberry32 } from '../vegetation/grow.js';

const mix = (a, b, t) => a + (b - a) * t;
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const D = Math.PI / 180;

/** The roles of an arrangement: height as a share of shin's, how much the thing matters (its interest). */
export const IKEBANA_ROLES = Object.freeze({
  shin: { height: [1, 1], interest: 'focus', read: 'heaven: the tallest, the line the arrangement is about' },
  soe: { height: [0.75, 0.75], interest: 'prop', read: 'man: three quarters of shin, leaning out to one side' },
  hikae: { height: [0.56, 0.56], interest: 'prop', read: 'earth: three quarters of soe, low and forward' },
  jushi: { height: [0.22, 0.48], interest: 'filler', read: 'fillers: shorter supporting stems inside the triangle, never in the ma' },
  ne: { height: [0.14, 0.24], interest: 'prop', read: 'the root: a flowering accent at the foot, the one bloom' },
});

/**
 * The styles: each principal's lean from upright (degrees, as in a vase) and the direction it leans, as an angle from
 * AWAY from the viewer toward the arrangement's LEFT (a left hand; the right hand mirrors it). Fillers lean a little
 * outward; the root stands.
 */
export const IKEBANA_STYLES = Object.freeze({
  upright: { lean: { shin: 12, soe: 45, hikae: 72 }, toward: { shin: 25, soe: 80, hikae: -125 }, read: 'shin nearly upright; soe out to the side; hikae low to the front' },
  slanting: { lean: { shin: 45, soe: 15, hikae: 72 }, toward: { shin: 70, soe: 20, hikae: -125 }, read: 'shin slants out; soe stands up behind it' },
  spreading: { lean: { shin: 22, soe: 60, hikae: 82 }, toward: { shin: 15, soe: 95, hikae: -110 }, read: 'low and wide: the principals open out like a grove on a bank' },
});

/** What each role is made of: presets a zone names (or its own table of the same shape). */
export const IKEBANA_MATERIALS = Object.freeze({
  // a grove of trees, close and varied, paired with a bush in flower at its foot
  grove: {
    shin: [{ form: 'broccoli', variant: 'column' }], soe: [{ form: 'broccoli', variant: 'broccoli' }], hikae: [{ form: 'broccoli', variant: 'lollipop' }, { form: 'broccoli', variant: 'broccoli' }],
    jushi: [{ form: 'broccoli', variant: 'lollipop' }, { form: 'broccoli', variant: 'bush' }, { form: 'broccoli', variant: 'column' }],
    ne: [{ form: 'broccoli', variant: 'bush', over: { blooms: [8, 14] } }],
  },
  // a cap-and-finger thicket: parasols over bells, a saguaro low, toadstools and tubes between, a puffball at the root
  fungal: {
    shin: [{ form: 'mushroom', variant: 'parasol' }], soe: [{ form: 'mushroom', variant: 'bell' }], hikae: [{ form: 'fingers', variant: 'saguaro' }],
    jushi: [{ form: 'mushroom', variant: 'toadstool' }, { form: 'fingers', variant: 'tubes' }, { form: 'fungi', variant: 'puffball' }],
    ne: [{ form: 'fungi', variant: 'puffball' }],
  },
  // a reef: coral and pads, a tube bundle for the heaven line
  reef: {
    shin: [{ form: 'fingers', variant: 'tubes' }], soe: [{ form: 'fingers', variant: 'coral' }], hikae: [{ form: 'fingers', variant: 'pads' }],
    jushi: [{ form: 'fingers', variant: 'coral' }, { form: 'fingers', variant: 'tubes' }], ne: [{ form: 'fungi', variant: 'frill' }],
  },
});

/** The zone painter's dials and their rails. */
export const IKEBANA_DIALS = Object.freeze({
  scale: { rail: [1, 30], read: 'shin\'s height in metres: the arrangement\'s size' },
  bend: { rail: [0, 1], read: 'how much of the style\'s lean the stems take (a vase\'s stem 1, a grove\'s trees about a third)' },
  density: { rail: [0, 1], read: 'how many fillers (an odd count, 0 to 7) and how close the arrangements stand along a stroke' },
  variation: { rail: [0, 1], read: 'how far each stem\'s height strays from its ratio and how freely the materials mix' },
  kenzan: { rail: [0.05, 0.3], read: 'the root\'s radius as a share of scale: how tight the bundle' },
  ma: { rail: [10, 50], read: 'the half-angle in degrees of the open sector toward the viewer' },
  incongruity: { rail: [0, 1], read: 'the stems\' own block mismatch (scaled by each role\'s interest)' },
});
export const IKEBANA_DEFAULTS = Object.freeze({ style: 'upright', hand: 'left', materials: 'grove', scale: 9, bend: 0.35, density: 0.5, variation: 0.4, kenzan: 0.14, ma: 28, incongruity: 0.5, level: 'mid' });

const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

/**
 * CLUSTERSPROUT: one arrangement at `at` [x, y], facing the viewer along `facing` (radians: the direction from the root
 * toward the viewer). → { at, facing, hand, style, stems: [{ role, form, variant, x, y, height, tilt, design }], laws }
 */
export function clustersprout(seed, opts = {}) {
  const o = { ...IKEBANA_DEFAULTS, ...opts }, S = IKEBANA_STYLES[o.style], M = typeof o.materials === 'string' ? IKEBANA_MATERIALS[o.materials] : o.materials;
  if (!S) throw new Error(`ikebana: unknown style '${o.style}' (known: ${Object.keys(IKEBANA_STYLES).join(', ')})`);
  const rand = mulberry32(subSeed(seed, 'ikebana')), at = o.at ?? [0, 0], face = o.facing ?? -Math.PI / 2, hand = o.hand === 'right' ? -1 : 1;
  // a direction given as degrees from AWAY toward the LEFT (mirrored for the right hand) → an azimuth in the world
  const away = face + Math.PI, azOf = (deg) => away + hand * deg * D;
  const K = o.kenzan * o.scale, stems = [];
  const stem = (role, material, toward, lean, k) => {
    const R = IKEBANA_ROLES[role], h = o.scale * mix(R.height[0], R.height[1], rand()) * (1 + o.variation * mix(-0.04, 0.04, rand()));   // variation strays inside the 1.2× step, never across it
    const az = azOf(toward), rr = K * (role === 'shin' ? 0.15 : mix(0.4, 1, rand()));
    const x = at[0] + Math.cos(az) * rr, y = at[1] + Math.sin(az) * rr;
    stems.push({ role, ...material, x: r3(x), y: r3(y), height: r3(h), az, lean: lean * o.bend, k, interest: R.interest });
  };
  stem('shin', pick(M.shin, rand()), S.toward.shin, S.lean.shin, 0);
  stem('soe', pick(M.soe, rand()), S.toward.soe, S.lean.soe, 1);
  stem('hikae', pick(M.hikae, rand()), S.toward.hikae, S.lean.hikae, 2);
  // fillers: an odd count (three principals and the root are four, so the whole counts odd), toward the angles between the principals (inside the triangle), out of the ma
  const nJ = [1, 1, 3, 3, 5, 5, 7][Math.round(o.density * 6)];
  const inside = [S.toward.shin, S.toward.soe, S.toward.hikae].sort((a, b) => a - b);
  for (let j = 0; j < nJ; j++) {
    const lo = inside[j % 2 ? 1 : 0], hi = inside[j % 2 ? 2 : 1];
    let toward = mix(lo, hi, rand());
    // the ma: the sector toward the viewer (180° from away) is left open
    const fromFront = 180 - Math.abs(((toward % 360) + 540) % 360 - 180);
    if (fromFront < o.ma) toward = toward >= 0 ? 180 - o.ma - 5 : -(180 - o.ma - 5);
    const mat = o.variation > 0.5 || j % 2 ? pick(M.jushi, rand()) : M.jushi[0];
    stem('jushi', mat, toward, mix(8, 30, rand()), 3 + j);
  }
  // the root: at the foot, toward the front and the hikae side, standing
  stem('ne', pick(M.ne, rand()), S.toward.hikae * 0.6, 0, 99);
  // build every stem: its height pinned, its own incongruity by its interest, its lean taken back until it stands
  const settle = (s) => {
    const sd = subSeed(seed, `ikebana:${s.k}`), over = { ...(s.over ?? {}), height: s.height };
    let inc = o.incongruity ? { vertical: o.incongruity, horizontal: o.incongruity } : null;
    const build = (deg) => designFlora(s.form, s.variant, sd, { level: o.level, over, interest: s.interest, incongruity: inc, tilt: deg ? { deg, az: s.az } : null });
    // a form's height dial is not its built height (a column's tiers rise past it): built once, measured, rescaled
    // to the stem's share (every form scales with its height, so one correction lands it)
    const h0 = floraMeasures(build(0)).height;
    if (h0 > 1e-6) over.height = s.height * (s.height / h0);
    // lean, then lengthen to the standing share (the heights that read are the standing ones), and while it does not
    // stand, lean less; leaning hardly at all and still off its foot, the stem's own mismatch gives way, then it
    // stands upright
    let deg = s.lean, d;
    for (let i = 0; i < 9; i++) {
      d = build(deg);
      const hs = floraMeasures(d).height;
      if (deg && Math.abs(hs - s.height) > 0.01 * s.height) { over.height *= s.height / hs; d = build(deg); }
      if (!floraLaws(d).some((l) => l.law === 'stands')) break;
      deg *= 0.7;
      if (i === 5 && inc) { inc = null; deg = s.lean * 0.3; }
      if (i === 7) deg = 0;
    }
    s.tilt = r3(deg); s.design = d;
  };
  for (const s of stems) settle(s);
  // a filler is sized by its footprint as well as its height: one that would spread wider than soe shrinks to fit
  const soe = stems.find((x) => x.role === 'soe');
  for (const s of stems.filter((x) => x.role === 'jushi')) for (let i = 0; i < 3 && spread(s) > 0.9 * spread(soe); i++) { s.height = r3(s.height * (0.88 * spread(soe)) / spread(s)); settle(s); }
  // SCALENE by construction: while the principals' crowns make a triangle with two sides alike, hikae turns on (and
  // settles again: a turned stem leans a new way)
  const hk = stems.find((x) => x.role === 'hikae');
  for (let i = 0; i < 6 && !scaleneTriangle(stems); i++) { hk.az += hand * 14 * D; settle(hk); }
  for (const s of stems) delete s.over;
  const out = { at, facing: face, hand: hand > 0 ? 'left' : 'right', style: o.style, kenzan: r3(K), ma: o.ma, stems };
  out.laws = ikebanaLaws(out);
  return out;
}

// how wide a stem spreads in plan
const spread = (s) => { let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity; for (const f of s.design.faces) for (const p of f.corners) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); e = Math.max(e, p[1]); } return Math.max(b - a, e - c); };
const scaleneTriangle = (stems) => {
  const P = ['shin', 'soe', 'hikae'].map((r) => crownXY(stems.find((s) => s.role === r))), side = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const L = [side(P[0], P[1]), side(P[1], P[2]), side(P[2], P[0])].sort((a, b) => a - b);
  return !(L[1] - L[0] < 0.1 * L[1] || L[2] - L[1] < 0.1 * L[2]);
};
// where a stem's crown stands in plan: its foot moved by its lean
export const crownXY = (s) => { const h = floraMeasures(s.design).height, off = Math.sin((s.tilt * Math.PI) / 180) * h * 0.7; return [s.x + Math.cos(s.az) * off, s.y + Math.sin(s.az) * off]; };

/**
 * The arrangement's laws (advice, never refusal):
 *   scalene   the principals' heights step by at least 1.2× and the triangle of their crowns has no two sides within
 *             a tenth of each other
 *   odd       the stems count odd
 *   ma        no filler's crown in the open sector toward the viewer (beyond the root's radius)
 *   under     no filler spreads wider than soe
 *   one-root  every stem rises within the kenzan's radius
 *   stands    every stem, leaned, keeps the flora index's laws
 */
export const IKEBANA_LAWS = Object.freeze([
  { id: 'scalene', rule: 'the principals\' heights step by 1.2× and their crowns make a triangle with no two sides alike' },
  { id: 'odd', rule: 'the stems count odd' },
  { id: 'ma', rule: 'the sector toward the viewer is left open: no filler stands in it' },
  { id: 'one-root', rule: 'every stem rises within the kenzan\'s radius: the bundle' },
  { id: 'under', rule: 'a filler never spreads wider than soe: the principals keep the read' },
  { id: 'stands', rule: 'every stem, leaned, keeps the flora index\'s laws' },
]);

export function ikebanaLaws(A) {
  const out = [], by = (r) => A.stems.find((s) => s.role === r);
  const [sh, so, hi] = ['shin', 'soe', 'hikae'].map(by), H = [sh, so, hi].map((s) => floraMeasures(s.design).height);
  if (!(H[0] >= 1.2 * H[1] * 0.999 && H[1] >= 1.2 * H[2] * 0.999)) out.push({ law: 'scalene', line: `principal heights ${H.map(r3).join(', ')}: each should be 1.2× the next.` });
  const P = [sh, so, hi].map(crownXY), side = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), L = [side(P[0], P[1]), side(P[1], P[2]), side(P[2], P[0])].sort((a, b) => a - b);
  if (L[1] - L[0] < 0.1 * L[1] || L[2] - L[1] < 0.1 * L[2]) out.push({ law: 'scalene', line: `the crowns' triangle has two sides alike (${L.map(r3).join(', ')}).` });
  if (A.stems.length % 2 === 0) out.push({ law: 'odd', line: `${A.stems.length} stems; an arrangement counts odd.` });
  for (const s of A.stems.filter((x) => x.role === 'jushi')) {
    const c = crownXY(s), dx = c[0] - A.at[0], dy = c[1] - A.at[1];
    if (Math.hypot(dx, dy) <= A.kenzan) continue;
    const off = Math.abs((((Math.atan2(dy, dx) - A.facing) / D) % 360 + 540) % 360 - 180);
    if (off < A.ma) out.push({ law: 'ma', line: `a filler's crown stands ${r3(off)}° off the line to the viewer, inside the ${A.ma}° ma.` });
  }
  for (const s of A.stems.filter((x) => x.role === 'jushi')) if (spread(s) > spread(so) * 1.001) out.push({ law: 'under', line: `a filler (${s.form} ${s.variant}) spreads ${r3(spread(s))} m, wider than soe's ${r3(spread(so))} m.` });
  for (const s of A.stems) if (Math.hypot(s.x - A.at[0], s.y - A.at[1]) > A.kenzan + 1e-6) out.push({ law: 'one-root', line: `${s.role} rises ${r3(Math.hypot(s.x - A.at[0], s.y - A.at[1]))} m from the root, outside its ${A.kenzan} m.` });
  for (const s of A.stems) for (const l of floraLaws(s.design)) out.push({ law: 'stands', line: `${s.role} (${s.form} ${s.variant}): ${l.line}` });
  return out;
}

/**
 * THE ZONE PAINTER: arrangements sprouted along painted strokes. A zone is `strokes` (polylines [[x, y], …], each
 * with a `width`), the dials (IKEBANA_DIALS), and what the arrangements face: `faceTo` (a line, a trail: each turns
 * to its nearest point), `view` (a point every one turns to) or `facing` (a fixed direction). Along a stroke the roots stand a spacing apart (closer with density), jittered across
 * the stroke's width; neighbours alternate hands, and one in each stroke is the odd one out (a bigger scale, the
 * other style), so a run of arrangements answers itself the way a run of blocks does.
 * → { arrangements: [clustersprout…], params }
 */
// the nearest point on a polyline to p
function nearestOn(line, p) {
  let best = line[0], bd = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)), q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

export function ikebanaZone(zone, seed) {
  const o = { ...IKEBANA_DEFAULTS, ...zone }, rand = mulberry32(subSeed(seed, 'ikebana:zone')), arrangements = [];
  const spacing = o.scale * mix(1.6, 0.85, o.density);
  (zone.strokes ?? []).forEach((st, si) => {
    const pts = st.points ?? st, w = st.width ?? o.scale * 0.5, roots = [];
    let carry = spacing * 0.5 * rand();
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
      for (let t = carry; t <= len; t += spacing * mix(0.85, 1.15, rand())) {
        const f = t / len, j = (rand() - 0.5) * w;
        roots.push([a[0] + (b[0] - a[0]) * f + nx * j, a[1] + (b[1] - a[1]) * f + ny * j]);
        carry = t;
      }
      carry = Math.max(0, carry - len);
    }
    const odd = roots.length > 2 ? Math.floor(rand() * roots.length) : -1, other = Object.keys(IKEBANA_STYLES).filter((k) => k !== o.style);
    roots.forEach((at, k) => {
      const to = o.faceTo ? nearestOn(o.faceTo, at) : o.view;
      const facing = to ? Math.atan2(to[1] - at[1], to[0] - at[0]) : (o.facing ?? -Math.PI / 2);
      const isOdd = k === odd;
      arrangements.push({ stroke: si, odd: isOdd, ...clustersprout(subSeed(seed, `ikebana:${si}:${k}`), {
        ...o, at, facing,
        hand: (k % 2 ? (o.hand === 'left' ? 'right' : 'left') : o.hand),
        style: isOdd ? pick(other, rand()) : o.style,
        scale: o.scale * (isOdd ? 1.3 : mix(1 - 0.25 * o.variation, 1 + 0.1 * o.variation, rand())),
      }) });
    });
  });
  return { arrangements, params: { style: o.style, materials: typeof o.materials === 'string' ? o.materials : 'custom', scale: o.scale, density: o.density, variation: o.variation, bend: o.bend, spacing: r3(spacing) } };
}
