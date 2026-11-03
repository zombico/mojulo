/**
 * panto-odm — the design grammar of a current collector on a train's roof, on the vehicle ODM's pattern: a brief solved
 * into its arms, its base, its head and its working range, held to laws; and its kinematics, how it stands at a pose.
 * panto-surface.js compiles it. Pure and deterministic; generic (no maker's pantograph is copied).
 *
 *   archetype   singleArm  a mainline single-arm pantograph: a lower arm from a hinge on its base frame, an upper arm
 *                          from the knee to the head, a guide rod that keeps the head level, the head's two carbon strips
 *                          between its horns, the base on four insulators, its drive (an air bellows) at the hinge
 *               tramArm    the same, smaller, for a streetcar's low wire
 *               diamond    the older double-arm pantograph: two frames hinged at either end of the base, meeting the head
 *                          above in a lozenge, its springs at the hinges
 *               pole       a trolley pole: a pole on a sprung swivel base, trailing, its harp and its wheel on the wire
 *
 *   The KINEMATICS (`pantoPose(design, pose)`): a pose's `raise` (0 folded … 1 at its highest), or `wire` (the contact
 *   wire's height over the base: the head raised until its strips meet it, as far as the arms reach) → the head's height,
 *   and the joints that put it there: a single arm's knee is where the circles of its two arms about the hinge and the
 *   head meet (the head held over its line, a little ahead of the hinge, as its guide rod holds it); a diamond's knees
 *   are its lozenge's sides; a pole's angle the one that reaches the wire.
 *
 *   solvePantoDesign(brief) → { version, archetype, seed, kind, arms, base, head, range, laws, valid }
 *   pantoPose(design, { raise?, wire? }) → { raise, height, contact, reached, knee?, angle? }
 *
 * Pantograph space: the origin on the roof under its base's middle, +y the way it faces (its knee leads), z up. Metres.
 */
const frozen = (x) => Object.freeze(x);
export const PANTO_GRAMMAR_VERSION = 'rail-panto-v0.1';
const r4 = (x) => Math.round(x * 10000) / 10000 + 0;

// each kind's numbers: arms (lower, upper), base (insulators' height, frame's length and width), head (its width, its
// strips' spacing, its horns' drop), the head's offset from over the hinge (a single arm's head rides almost over its
// hinge, its knee out ahead), the wire band its class works under over the rail and the roof it typically stands on
export const PANTO_ARCHETYPES = frozen({
  singleArm: frozen({ kind: 'arm', lower: 1.9, upper: 2.15, insulator: 0.24, frame: [1.6, 0.9], head: { width: 1.95, strips: 2, spacing: 0.34, horn: 0.22 }, lead: -0.26, fold: 0.18, band: [4.9, 6.4], roof: 4.0 }),
  tramArm: frozen({ kind: 'arm', lower: 1.45, upper: 1.66, insulator: 0.18, frame: [1.2, 0.7], head: { width: 1.6, strips: 2, spacing: 0.26, horn: 0.18 }, lead: -0.22, fold: 0.16, band: [4.2, 6.5], roof: 3.4 }),
  diamond: frozen({ kind: 'diamond', lower: 1.35, upper: 1.35, insulator: 0.24, frame: [2.2, 1.1], head: { width: 1.9, strips: 2, spacing: 0.3, horn: 0.2 }, lead: 0, fold: 0.22, band: [4.9, 6.2], roof: 4.0 }),
  pole: frozen({ kind: 'pole', lower: 4.6, upper: 0, insulator: 0.16, frame: [0.7, 0.55], head: { width: 0.12, strips: 0, spacing: 0, horn: 0 }, lead: 0, fold: 0.1, band: [4.3, 6.2], roof: 3.3 }),
});
export const PANTO_KINDS = Object.freeze(Object.keys(PANTO_ARCHETYPES));
export const PANTO_LIMITS = frozen({ lower: [0.8, 5.5], upper: [0, 2.6], head: [0.1, 2.2] });

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let t = hash(seed); return () => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function number(value, fallback, limits, key) {
  if (value === undefined) return r4(Math.max(limits[0], Math.min(limits[1], fallback)));
  if (typeof value !== 'number' || !Number.isFinite(value) || value < limits[0] || value > limits[1]) throw new Error(`rail-panto: ${key} must be in [${limits.join(', ')}]`);
  return r4(value);
}

/** The head's height over the hinge at a pose, and the joints that put it there. */
export function pantoPose(d, pose = {}) {
  const R = d.range, top = d.head.top;
  let h;
  if (Number.isFinite(+pose.wire)) h = +pose.wire - d.base.hinge - top;
  else h = R.min + Math.max(0, Math.min(1, Number(pose.raise) || 0)) * (R.max - R.min);
  const reached = Number.isFinite(+pose.wire) ? h >= R.min - 1e-9 && h <= R.max + 1e-9 : null;
  h = Math.max(R.min, Math.min(R.max, h));
  const raise = r4((h - R.min) / (R.max - R.min || 1)), out = { raise, height: r4(h), contact: r4(d.base.hinge + h + top), ...(reached === null ? {} : { reached }) };
  const a = d.arms.lower, b = d.arms.upper;
  if (d.kind === 'arm') {
    // (the knee where the two arms' circles meet: about the hinge (0, 0) and the head (lead, h), on the leading side)
    const L = Math.hypot(d.arms.lead, h), m = (a * a - b * b + L * L) / (2 * L), q = Math.sqrt(Math.max(0, a * a - m * m));
    const ux = d.arms.lead / L, uz = h / L, px = ux * m, pz = uz * m;
    const k1 = [px + uz * q, pz - ux * q], k2 = [px - uz * q, pz + ux * q], knee = k1[0] > k2[0] ? k1 : k2;
    return { ...out, knee: knee.map(r4), head: [r4(d.arms.lead), r4(h)] };
  }
  if (d.kind === 'diamond') {
    // (each frame's knee out at the lozenge's side: half the height up, as far out as its arm reaches)
    const s = Math.sqrt(Math.max(0, a * a - (h / 2) ** 2));
    return { ...out, knee: [r4(d.base.pivot + s), r4(h / 2)], head: [0, r4(h)] };
  }
  // (a pole trailing from its swivel, raised to the angle that reaches the height)
  const angle = Math.asin(Math.max(0, Math.min(1, h / a)));
  return { ...out, angle: r4(angle * 180 / Math.PI), head: [r4(-a * Math.cos(angle)), r4(h)] };
}

export function solvePantoDesign({ seed = 1, archetype = 'singleArm', dimensions = {} } = {}) {
  const A = PANTO_ARCHETYPES[archetype];
  if (!A) throw new Error(`rail-panto: unknown archetype ${archetype} (known: ${PANTO_KINDS.join(', ')})`);
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) throw new Error('rail-panto: dimensions must be an object');
  for (const k of Object.keys(dimensions)) if (!Object.hasOwn(PANTO_LIMITS, k)) throw new Error(`rail-panto: unknown dimension ${k}`);
  const random = rng(`${seed}:${archetype}`), jitter = (m) => (random() * 2 - 1) * m;
  const lower = number(dimensions.lower, A.lower * (1 + jitter(0.02)), PANTO_LIMITS.lower, 'lower');
  const upper = number(dimensions.upper, A.upper * (1 + jitter(0.02)), PANTO_LIMITS.upper, 'upper');
  const width = number(dimensions.head, A.head.width, PANTO_LIMITS.head, 'head');
  // the base: insulators to the frame, the hinge just over it (a diamond's two pivots at the frame's ends)
  const base = frozen({ insulator: A.insulator, frame: frozen([...A.frame]), hinge: r4(A.insulator + 0.08), pivot: r4(A.kind === 'diamond' ? A.frame[0] / 2 - 0.25 : 0) });
  // the head: its strips' top over its pivot, its width, its strips and horns (a pole's: its harp and wheel)
  const head = frozen({ width, strips: A.head.strips, spacing: A.head.spacing, horn: A.head.horn, top: r4(A.kind === 'pole' ? 0.06 : 0.12) });
  const arms = frozen({ lower, upper, lead: A.lead });
  // the range: folded (the head just over the frame) to the arms' reach (a single arm short of straight, a diamond's
  // lozenge short of closing, a pole short of upright)
  const reach = A.kind === 'arm' ? Math.sqrt(Math.max(0, (lower + upper) ** 2 * 0.86 - A.lead ** 2)) : A.kind === 'diamond' ? 2 * lower * 0.93 : lower * Math.sin((60 * Math.PI) / 180);
  const range = frozen({ min: r4(A.fold), max: r4(reach) });
  const design = { version: PANTO_GRAMMAR_VERSION, archetype, seed, kind: A.kind, arms, base, head, range, band: frozen([...A.band]), roof: A.roof };
  const fold = pantoPose(design, { raise: 0 }), full = pantoPose(design, { raise: 1 });
  const laws = [
    { id: 'arms-close', pass: A.kind !== 'arm' || Math.hypot(A.lead, range.min) >= Math.abs(lower - upper) - 1e-9 },
    // (folded, low on the roof: no more than 0.7 m over it)
    { id: 'folds-low', pass: fold.contact <= 0.7 },
    // (its working range, over its class's roof, covers its class's wire band: folded under the lowest, raised over the highest)
    { id: 'reaches-wire', pass: A.roof + full.contact >= A.band[1] && A.roof + fold.contact <= A.band[0] },
    { id: 'head-over-hinge', pass: A.kind !== 'arm' || Math.abs(A.lead) < 0.3 * lower },
  ];
  return frozen({ ...design, laws: frozen(laws.map(frozen)), valid: laws.every((l) => l.pass) });
}
