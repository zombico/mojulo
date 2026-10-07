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
 *   fillers (jushi)   support the principals in TIERS down from them (understory, shrub, herb, then the ground's
 *                     cover): tall behind, short in front, an odd count, a mix of plants, never one repeated
 *   the root (ne)     an accent at the foot: a flowering bush, the arrangement's one bloom (decoration, never the
 *                     accent colour, which is for use)
 *   ma                the empty space: a sector toward the viewer is left open, so the eye can enter
 *   one root          every stem rises from within the kenzan's radius: the bundle
 *   a style           the angles the principals lean at (upright, slanting, spreading) and the side they lean to
 *                     (the hand), mirrored between neighbours along a stroke: adjacent arrangements answer each other
 * A stem leans as far as it still STANDS (the flora index's stands law): a tree leans less than a stem in a vase.
 * Seeded; pure.
 */
import { designFlora, floraLaws, floraMeasures, groundSurface, subSeed } from './out-flora.js';
import { mulberry32 } from '../vegetation/grow.js';

const mix = (a, b, t) => a + (b - a) * t;
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const D = Math.PI / 180;

/** The roles of an arrangement: height as a share of shin's, how much the thing matters (its interest). */
export const IKEBANA_ROLES = Object.freeze({
  shin: { height: [1, 1], interest: 'focus', read: 'heaven: the tallest, the line the arrangement is about' },
  soe: { height: [0.75, 0.75], interest: 'prop', read: 'man: three quarters of shin, leaning out to one side' },
  hikae: { height: [0.56, 0.56], interest: 'prop', read: 'earth: three quarters of soe, low and forward' },
  jushi: { height: [0.05, 0.5], interest: 'filler', read: 'fillers: plants at every size below the principals, by tier (IKEBANA_TIERS), never in the ma' },
  ne: { height: [0.16, 0.25], interest: 'prop', read: 'the root: a flowering accent at the foot, the one bloom' },
});

/**
 * The TIERS an arrangement reads in, vertically: each a band of height as a share of shin's, how far from the root its
 * plants may stand (in kenzan radii) and where round it they go. Tall behind, short in front: a bed seen from the way.
 */
export const IKEBANA_TIERS = Object.freeze({
  canopy: { band: [0.5, 1.01], read: 'the principals: shin, soe, hikae' },
  understory: { band: [0.28, 0.5], reach: 1, where: 'back', lean: [5, 20], read: 'small trees and tall shrubs, inside the triangle, behind' },
  shrub: { band: [0.14, 0.28], reach: 1.8, where: 'sides', lean: [0, 8], read: 'bushes, in and out of bloom, either side of the root' },
  herb: { band: [0.05, 0.14], reach: 2.6, where: 'front', lean: [0, 12], read: 'flowers and tall grasses, in front, either side of the ma' },
  ground: { band: [0, 0.05], read: 'the cover: tufts and low flowers over the footprint' },
});
// the fillers' tiers by count: a single filler is a flower; more fill the bands from the top down and back up
const TIER_RUN = { 1: ['herb'], 3: ['understory', 'shrub', 'herb'], 5: ['understory', 'shrub', 'herb', 'herb', 'shrub'], 7: ['understory', 'shrub', 'herb', 'herb', 'shrub', 'understory', 'herb'] };

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

/**
 * What each role is made of, per tier: presets a zone names (or its own table of the same shape). Plants only, at every
 * size: trees, bushes in and out of bloom, flowers (spikes, umbels, plumes, daisies), caps and fingers; a wide preset
 * adds a ground of its own. Each tier's list is cycled, so an arrangement mixes and never repeats one thing.
 */
const F = (form, variant, over) => ({ form, variant, ...(over ? { over } : {}) });
const BLOOMING = F('broccoli', 'bush', { blooms: [8, 14] });
export const IKEBANA_MATERIALS = Object.freeze({
  // a grove of trees, close and varied, a bush in flower at its foot and a bed of flowers in front
  grove: {
    shin: [F('broccoli', 'column')], soe: [F('broccoli', 'broccoli')], hikae: [F('broccoli', 'lollipop'), F('broccoli', 'broccoli')],
    understory: [F('broccoli', 'lollipop'), F('broccoli', 'column')], shrub: [BLOOMING, F('broccoli', 'bush')], herb: [F('flower', 'spike'), F('flower', 'umbel'), F('flower', 'plume')],
    ne: [BLOOMING], cover: [F('tuft', 'flowering'), F('flower', 'daisy'), F('tuft', 'blades')],
  },
  // a cap-and-finger thicket: parasols over bells over a saguaro, puffballs and frills, spikes and plumes in front
  fungal: {
    shin: [F('mushroom', 'parasol')], soe: [F('mushroom', 'bell')], hikae: [F('fingers', 'saguaro')],
    understory: [F('mushroom', 'bell'), F('fingers', 'tubes')], shrub: [F('fungi', 'puffball'), F('mushroom', 'toadstool')], herb: [F('flower', 'spike'), F('mushroom', 'toadstool'), F('flower', 'plume')],
    ne: [F('fungi', 'frill')], cover: [F('tuft', 'flowering'), F('flower', 'daisy')],
  },
  // a reef: coral and pads under a tube bundle, frills and plumes between
  reef: {
    shin: [F('fingers', 'tubes')], soe: [F('fingers', 'coral')], hikae: [F('fingers', 'pads')],
    understory: [F('fingers', 'coral')], shrub: [F('fingers', 'pads'), F('fungi', 'frill')], herb: [F('flower', 'plume'), F('flower', 'umbel')],
    ne: [F('fungi', 'puffball')], cover: [F('tuft', 'blades'), F('flower', 'daisy')],
  },
  // WIDE: on a ground of their own. A meadow garden on a mound: a round tree over a column over a lollipop, a bush in
  // bloom, spikes, umbels and plumes, daisies in the grass
  garden: {
    shin: [F('broccoli', 'broccoli')], soe: [F('broccoli', 'column')], hikae: [F('broccoli', 'lollipop')],
    understory: [F('broccoli', 'lollipop')], shrub: [BLOOMING, F('broccoli', 'bush')], herb: [F('flower', 'spike'), F('flower', 'umbel'), F('flower', 'plume')],
    ne: [F('flower', 'umbel')], cover: [F('flower', 'daisy'), F('tuft', 'flowering')], ground: F('ground', 'mound'),
  },
  // an oasis: a parasol over a saguaro over pads, round a pool that is the ma; bushes and plumes on the rim
  oasis: {
    shin: [F('mushroom', 'parasol')], soe: [F('fingers', 'saguaro')], hikae: [F('fingers', 'pads')],
    understory: [F('broccoli', 'lollipop')], shrub: [F('broccoli', 'bush'), F('fungi', 'puffball')], herb: [F('flower', 'plume'), F('flower', 'spike')],
    ne: [F('flower', 'umbel')], cover: [F('tuft', 'blades'), F('flower', 'daisy')], ground: F('ground', 'hollow'),
  },
  // a crater garden at night: a cap over a bell over glowing tubes, round a glowing pool
  crater: {
    shin: [F('mushroom', 'parasol')], soe: [F('mushroom', 'bell')], hikae: [F('fingers', 'tubes')],
    understory: [F('fingers', 'saguaro')], shrub: [F('fungi', 'puffball'), F('fungi', 'frill')], herb: [F('flower', 'spike'), F('flower', 'plume')],
    ne: [F('mushroom', 'toadstool')], cover: [F('tuft', 'flowering'), F('flower', 'daisy')], ground: F('ground', 'hollow'),
  },
});

/**
 * WALKING: what each element is to a walker, decided from its built geometry (the arrangement's colliders):
 *   block  what a walker meets at body height: a trunk, a stalk, a stone or a bush taller than a step, any cactus,
 *          a mound too steep to climb; in a THICKET every filler blocks too (a wall of brush)
 *   walk   what a walker steps over or through: tufts, flowers, anything under a step
 *   under  a canopy over head height: walked under (its trunk still blocks)
 *   wade   a shallow pool: walked through, slowly
 */
export const WALK = Object.freeze({ step: 0.45, body: 1.8, head: 2.1, climb: 35, wade: 0.6, modes: ['open', 'thicket'] });

/** The zone painter's dials and their rails. */
export const IKEBANA_DIALS = Object.freeze({
  scale: { rail: [1, 30], read: 'shin\'s height in metres: the arrangement\'s size' },
  bend: { rail: [0, 1], read: 'how much of the style\'s lean the stems take (a vase\'s stem 1, a grove\'s trees about a third)' },
  density: { rail: [0, 1], read: 'how many fillers (an odd count, 0 to 7) and how close the arrangements stand along a stroke' },
  variation: { rail: [0, 1], read: 'how far each stem\'s height strays from its ratio and how freely the materials mix' },
  kenzan: { rail: [0.05, 0.3], read: 'the root\'s radius as a share of scale: how tight the bundle' },
  ma: { rail: [10, 50], read: 'the half-angle in degrees of the open sector toward the viewer' },
  incongruity: { rail: [0, 1], read: 'the stems\' own block mismatch (scaled by each role\'s interest)' },
  cover: { rail: [0, 1], read: 'how much ground cover the arrangement\'s footprint holds (a wide arrangement\'s tufts)' },
  walk: { rail: ['open', 'thicket'], read: 'open: only trunks, stones and bushes block and a way in stays through the ma; thicket: fillers block too' },
});
export const IKEBANA_DEFAULTS = Object.freeze({ clear: 1.2, style: 'upright', hand: 'left', materials: 'grove', scale: 9, bend: 0.35, density: 0.5, variation: 0.4, kenzan: 0.14, ma: 28, incongruity: 0.5, cover: 0.5, walk: 'open', level: 'mid' });

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
  const stem = (role, material, toward, lean, k, tier = null) => {
    const R = IKEBANA_ROLES[role], T = tier ? IKEBANA_TIERS[tier] : null, band = T ? [T.band[0] + 0.01, T.band[1] - 0.01] : R.height;
    const h = o.scale * mix(band[0], band[1], rand()) * (1 + o.variation * mix(-0.04, 0.04, rand()));   // variation strays inside the 1.2× step, never across it
    const reach = K * (T?.reach ?? 1), az = azOf(toward), rr = role === 'shin' ? K * 0.15 : T ? mix(T.reach > 1 ? K * 0.9 : K * 0.4, reach, rand()) : K * mix(0.4, 1, rand());
    const x = at[0] + Math.cos(az) * rr, y = at[1] + Math.sin(az) * rr;
    stems.push({ role, ...(tier ? { tier } : {}), ...material, x: r3(x), y: r3(y), rr, reach: r3(reach), height: r3(h), az, lean: lean * o.bend, k, interest: R.interest });
  };
  stem('shin', pick(M.shin, rand()), S.toward.shin, S.lean.shin, 0);
  stem('soe', pick(M.soe, rand()), S.toward.soe, S.lean.soe, 1);
  stem('hikae', pick(M.hikae, rand()), S.toward.hikae, S.lean.hikae, 2);
  // fillers: an odd count (three principals and the root are four, so the whole counts odd), in tiers down from the
  // principals: the understory inside the triangle, behind; shrubs either side of the root; herbs in front, either
  // side of the ma. Each tier's materials cycle from a seeded start, so the plants mix and never repeat in a row
  const nJ = [1, 1, 3, 3, 5, 5, 7][Math.round(o.density * 6)], run = TIER_RUN[nJ], cyc = {};
  const listOf = (tier) => M[tier] ?? M.jushi ?? [];
  run.forEach((tier, j) => {
    const T = IKEBANA_TIERS[tier], list = listOf(tier);
    if (cyc[tier] == null) cyc[tier] = Math.floor(rand() * list.length);
    const mat = list[cyc[tier]++ % list.length], side = j % 2 ? -1 : 1;
    let toward;
    if (T.where === 'back') toward = mix(Math.min(S.toward.shin, S.toward.soe) - 25, Math.max(S.toward.shin, S.toward.soe) + 25, rand());
    else if (T.where === 'sides') toward = side * mix(70, 125, rand());
    else toward = side * (180 - o.ma - mix(8, 50, rand()));
    stem('jushi', mat, toward, mix(T.lean[0], T.lean[1], rand()), 3 + j, tier);
  });
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
  // WIDE: the ground the arrangement stands on (a mound's crown is the root; a hollow's pool lies in front, in the ma)
  // and every stem set on its surface
  let ground = null, gs = groundSurface({ dials: {} });
  if (M.ground) {
    const kind = M.ground.variant, R = o.scale * (kind === 'hollow' ? 1 : 0.9), gh = o.scale * (kind === 'hollow' ? 0.06 : 0.1);
    const gd = designFlora(M.ground.form, kind, subSeed(seed, 'ikebana:ground'), { level: o.level, over: { height: gh, spread: R / gh } });
    const c = kind === 'hollow' ? [at[0] + Math.cos(face) * R * 0.55, at[1] + Math.sin(face) * R * 0.55] : at.slice();
    ground = { form: M.ground.form, variant: kind, x: r3(c[0]), y: r3(c[1]), z: 0, design: gd };
    gs = groundSurface(gd);
  }
  const zAt = (x, y) => (ground ? r3(gs.at(Math.hypot(x - ground.x, y - ground.y))) : 0);
  for (const s of stems) s.z = zAt(s.x, s.y);
  // ground cover: tufts over the footprint, round the root and out of the ma (and out of the pool)
  const cover = [];
  if (M.cover && o.cover > 0) {
    const n = Math.round(4 + 12 * o.cover), Rc = o.scale * 0.75, cr = mulberry32(subSeed(seed, 'ikebana:cover'));
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      const a = cr() * Math.PI * 2, d = mix(K, Rc, Math.sqrt(cr())), x = at[0] + Math.cos(a) * d, y = at[1] + Math.sin(a) * d;
      const off = Math.abs((((a - face) / D) % 360 + 540) % 360 - 180);
      if (off < o.ma || (gs.pool && Math.hypot(x - ground.x, y - ground.y) < gs.pool * 1.05)) continue;
      const cm = [].concat(M.cover)[i % [].concat(M.cover).length];
      const design = designFlora(cm.form, cm.variant, subSeed(seed, `ikebana:cover:${i}`), { level: o.level, interest: 'filler', over: { height: o.scale * mix(0.02, 0.05, cr()) } });
      cover.push({ role: 'cover', tier: 'ground', form: cm.form, variant: cm.variant, x: r3(x), y: r3(y), z: zAt(x, y), az: a, tilt: 0, design }); i++;
    }
  }
  const out = { at, facing: face, hand: hand > 0 ? 'left' : 'right', style: o.style, kenzan: r3(K), ma: o.ma, walk: o.walk, stems, ground, cover, surface: ground ? { R: r3(gs.R), pool: r3(gs.pool), maxSlope: gs.maxSlope } : null };
  out.colliders = colliders(out);
  // THE WAY IN and SCALENE, settled together: in an open arrangement a blocking stem that crowds the ma turns away from
  // the front (its root round the kenzan, its lean with it); while the principals' triangle has two sides alike, hikae
  // turns away from the front too. Either turn is checked against the other.
  const away_ = (st) => {
    const rel = ((((st.az - face) / D) % 360) + 540) % 360 - 180;
    st.az += (rel >= 0 ? 1 : -1) * 16 * D;
    st.x = r3(at[0] + Math.cos(st.az) * st.rr); st.y = r3(at[1] + Math.sin(st.az) * st.rr);
    settle(st); st.z = zAt(st.x, st.y);
  };
  const turns = () => {
    for (let i = 0; i < 10; i++) {
      const crowd = o.walk === 'open' ? wayInBlockers(out).map((c) => c.stem).filter((x, j, a) => x && a.indexOf(x) === j) : [];
      if (crowd.length) crowd.forEach(away_);
      else if (!scaleneTriangle(stems)) away_(hk);
      else break;
      out.colliders = colliders(out);
    }
  };
  turns();
  // SHAPES by construction: while fewer than three silhouettes show, a filler (the last first, then the root) tries its
  // tier's other plants, then a spike (columnar), daisies or a bush (spreading), a lollipop (round), keeping the first
  // that adds the missing one
  const UNIVERSAL = [{ form: 'flower', variant: 'spike' }, { form: 'flower', variant: 'daisy' }, { form: 'broccoli', variant: 'bush' }, { form: 'broccoli', variant: 'lollipop' }];
  for (const f of [...stems.filter((x) => x.role === 'jushi').reverse(), ...stems.filter((x) => x.role === 'ne')]) {
    const have = new Set(stems.filter((x) => x !== f).map(shapeOf));
    if (new Set(stems.map(shapeOf)).size >= 3) break;
    if (have.has(shapeOf(f))) {
      const was = { form: f.form, variant: f.variant, over: f.over, design: f.design, tilt: f.tilt, height: f.height };
      let ok = false;
      for (const c of [...(f.tier ? listOf(f.tier) : []), ...UNIVERSAL]) {
        Object.assign(f, { form: c.form, variant: c.variant, over: c.over, height: was.height }); settle(f);
        if (!have.has(shapeOf(f)) && (f.role !== 'jushi' || spread(f) <= 0.9 * spread(soe))) { ok = true; break; }
      }
      if (!ok) Object.assign(f, was);
    }
  }
  for (const st of stems) st.z = zAt(st.x, st.y);
  out.colliders = colliders(out);
  turns();
  out.laws = ikebanaLaws(out, M);
  for (const st of stems) { delete st.over; delete st.rr; }
  out.colliders = out.colliders.map(({ stem: _s, ...c }) => c);
  return out;
}

// a plant's silhouette class: tall and narrow, about as tall as wide, or wider than tall
const shapeOf = (s) => { const a = floraMeasures(s.design).height / Math.max(1e-6, spread(s)); return a >= 1.8 ? 'columnar' : a >= 0.8 ? 'round' : 'spreading'; };
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
 * The arrangement's colliders, from what was built (WALK): each element a circle in plan, `block`, `walk`, `under` or
 * `wade`. A stem's block is what it holds below body height round its foot; a canopy over head height is `under`.
 */
export function colliders(A) {
  const out = [], solid = new Set(['wood', 'flesh', 'stone', 'mass', 'core', 'gills']);
  for (const s of [...A.stems, ...A.cover]) {
    const fs = s.design.faces, h = floraMeasures(s.design).height;
    const low = fs.flatMap((f) => (solid.has(f.part) ? f.corners : [])).filter((p) => p[2] < WALK.body);
    const circle = (pts) => { if (!pts.length) return null; const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; return { x: r3(s.x + cx), y: r3(s.y + cy), r: r3(Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)))) }; };
    const thick = A.walk === 'thicket' && s.role === 'jushi';
    let kind = h < WALK.step ? 'walk' : 'block';
    // soft plants (tufts, flowers) are walked through: a walker parts them
    if (s.form === 'tuft' || s.form === 'flower') kind = 'walk';
    if (s.form === 'fingers' && h >= WALK.step * 0.5) kind = 'block';
    if (thick) kind = 'block';
    const c = circle(thick ? fs.flatMap((f) => f.corners) : low.length ? low : fs.flatMap((f) => f.corners));
    if (c) out.push({ of: s.role, form: s.form, kind, ...c, h: r3(h), stem: s });
    const high = fs.flatMap((f) => (f.part === 'mass' || f.part === 'flesh' ? f.corners : [])).filter((p) => p[2] > WALK.head), cu = circle(high);
    if (cu && kind === 'block' && cu.r > (c?.r ?? 0) * 1.2) out.push({ of: s.role, form: s.form, kind: 'under', ...cu, h: r3(h), stem: s });
  }
  if (A.ground) {
    const g = A.ground, S = A.surface;
    out.push({ of: 'ground', form: 'ground', kind: S.maxSlope <= WALK.climb ? 'walk' : 'block', x: g.x, y: g.y, r: S.R, slope: S.maxSlope });
    if (S.pool) out.push({ of: 'ground', form: 'water', kind: A.ground.design.dials.height * A.ground.design.dials.pool <= WALK.wade ? 'wade' : 'block', x: g.x, y: g.y, r: S.pool });
  }
  return out;
}

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
  { id: 'mix', rule: 'an arrangement mixes what its materials offer: at least three different things when it can' },
  { id: 'way-in', rule: 'an open arrangement keeps the ma walkable from its edge in to the root' },
  { id: 'layers', rule: 'it reads in at least four height bands, canopy to ground (vertical variety)' },
  { id: 'shapes', rule: 'its plants show at least three silhouettes: columnar, round, spreading (horizontal variety)' },
  { id: 'depth', rule: 'tall behind, short in front: the herbs stand nearer the viewer than the understory' },
  { id: 'trail-clear', rule: 'painted along a trail, nothing that blocks stands within its clearance of it' },
]);

/** The blocking colliders that reach into the way in: the corridor down the ma (half its angle each side) from beyond the
 *  root's own reach out to the arrangement's edge. */
export function wayInBlockers(A) {
  return (A.colliders ?? []).filter((c) => {
    if (c.kind !== 'block' || c.of === 'ground') return false;
    const dx = c.x - A.at[0], dy = c.y - A.at[1], dist = Math.hypot(dx, dy);
    if (dist < A.kenzan * 1.5) return false;
    const off = Math.abs((((Math.atan2(dy, dx) - A.facing) / D) % 360 + 540) % 360 - 180), half = Math.asin(Math.min(1, c.r / Math.max(dist, 1e-6))) / D;
    return off - half < A.ma * 0.5;
  });
}

export function ikebanaLaws(A, M = null) {
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
  for (const s of A.stems) { const lim = (s.reach ?? A.kenzan) + 2e-3, d = Math.hypot(s.x - A.at[0], s.y - A.at[1]); if (d > lim) out.push({ law: 'one-root', line: `${s.role} rises ${r3(d)} m from the root, beyond its tier's ${r3(lim)} m.` }); }
  // LAYERS (vertical variety): the arrangement reads in at least four height bands, canopy to ground
  const shinH = H[0], bandOf = (h) => Object.entries(IKEBANA_TIERS).find(([, T]) => h / shinH >= T.band[0] && h / shinH < T.band[1])?.[0];
  const bands = new Set([...A.stems, ...(A.cover ?? [])].map((s) => bandOf(floraMeasures(s.design).height)).filter(Boolean));
  if (bands.size < (A.cover?.length ? 4 : 3)) out.push({ law: 'layers', line: `it reads in ${bands.size} height bands (${[...bands].join(', ')}); give it four, canopy to ground.` });
  // SHAPES (horizontal variety): its plants show at least three silhouettes: columnar, round, spreading
  const shapes = new Set(A.stems.map(shapeOf));
  if (shapes.size < 3) out.push({ law: 'shapes', line: `its plants show ${shapes.size} silhouettes (${[...shapes].join(', ')}); mix columnar, round and spreading.` });
  // DEPTH: tall behind, short in front: the herbs stand nearer the viewer than the understory
  const front = (s) => { const c = crownXY(s); return (c[0] - A.at[0]) * Math.cos(A.facing) + (c[1] - A.at[1]) * Math.sin(A.facing); };
  const tierFront = (t) => { const ss = A.stems.filter((s) => s.tier === t); return ss.length ? ss.reduce((a, s) => a + front(s), 0) / ss.length : null; };
  const fu = tierFront('understory'), fh = tierFront('herb');
  if (fu != null && fh != null && fh <= fu) out.push({ law: 'depth', line: 'the herbs stand no nearer the viewer than the understory: tall behind, short in front.' });
  for (const s of A.stems) for (const l of floraLaws(s.design)) out.push({ law: 'stands', line: `${s.role} (${s.form} ${s.variant}): ${l.line}` });
  // MIX: an arrangement mixes what its materials offer, up to three different things
  if (M) {
    const offered = new Set(['shin', 'soe', 'hikae', 'jushi', 'ne'].flatMap((r) => (M[r] ?? []).map((m) => `${m.form}/${m.variant}`))), used = new Set(A.stems.map((s) => `${s.form}/${s.variant}`));
    if (used.size < Math.min(3, offered.size)) out.push({ law: 'mix', line: `${used.size} different things; the materials offer ${offered.size}.` });
  }
  // WAY IN: an open arrangement keeps the ma walkable from its edge in to the root
  if (A.walk === 'open') for (const c of wayInBlockers(A)) out.push({ law: 'way-in', line: `${c.of} (${c.form}) blocks the way in through the ma.` });
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
  // the ma at the composition's scale: arrangements stand at least their own width apart, open lawn between them
  const spacing = o.scale * mix(2.2, 1.3, o.density);
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
      const A = { stroke: si, odd: isOdd, ...clustersprout(subSeed(seed, `ikebana:${si}:${k}`), {
        ...o, at, facing,
        hand: (k % 2 ? (o.hand === 'left' ? 'right' : 'left') : o.hand),
        style: isOdd ? pick(other, rand()) : o.style,
        scale: o.scale * (isOdd ? 1.3 : mix(1 - 0.25 * o.variation, 1 + 0.1 * o.variation, rand())),
      }) };
      // THE TRAIL STAYS CLEAR: nothing that blocks stands within `clear` metres of the line the arrangement faces; one
      // that would is moved back whole, away from the line
      if (o.faceTo) {
        const gap = (c) => Math.hypot(c.x - nearestOn(o.faceTo, [c.x, c.y])[0], c.y - nearestOn(o.faceTo, [c.x, c.y])[1]) - c.r;
        const worst = Math.min(Infinity, ...A.colliders.filter((c) => c.kind === 'block' && c.of !== 'ground').map(gap));
        if (worst < o.clear) {
          const q = nearestOn(o.faceTo, A.at), dx = A.at[0] - q[0], dy = A.at[1] - q[1], l = Math.hypot(dx, dy) || 1, m = o.clear - worst + 0.01, d = [(dx / l) * m, (dy / l) * m];
          const mv = (e) => { e.x = r3(e.x + d[0]); e.y = r3(e.y + d[1]); };
          A.at = [r3(A.at[0] + d[0]), r3(A.at[1] + d[1])]; A.stems.forEach(mv); A.cover.forEach(mv); A.colliders.forEach(mv); if (A.ground) mv(A.ground);
        }
        const now = Math.min(Infinity, ...A.colliders.filter((c) => c.kind === 'block' && c.of !== 'ground').map(gap));
        if (now < o.clear - 0.02) A.laws.push({ law: 'trail-clear', line: `a blocker stands ${r3(now)} m from the trail, inside its ${o.clear} m.` });
      }
      arrangements.push(A);
    });
  });
  return { arrangements, params: { style: o.style, materials: typeof o.materials === 'string' ? o.materials : 'custom', scale: o.scale, density: o.density, variation: o.variation, bend: o.bend, spacing: r3(spacing) } };
}
