/**
 * playscape beams — ATTACKS a character fires (the cast's `beam { who, to, is }`): rays, bolts, ki waves, magic. An
 * attack is STRANDS, each one closed form in time, and a few layers round them:
 *
 *   { color, strands: [strand], charge?, rings?, sparks?, impact?, shake? }
 *
 *   charge   an orb gathering before the strands go, lights spiralling into it: { time, size, at: 'hand' | 'above' }
 *            (above: over the head, and the strands leave from there)
 *   rings    shock rings riding a ray: { every (m), size (× width) }
 *   sparks   a spray (elements.js) round every head, born again as it flies
 *   impact   a puff kind where it lands (moments.js), when the first head arrives · shake: 0..1 then
 *
 * A STRAND: a `ray` grows from the hand to the target at `speed`, holds `hold` seconds, then its tail runs after it; a
 * `bolt` is a body `length` long behind a head, flying at `speed` until its tail is in. Its path from A to B is the
 * line, then: `arc` (m, a hump up), `bow` (m, each copy curving out its own seeded way, landing on B), `wave` [amp, per
 * m] (a slither: every point of the body takes the same path, so a long bolt follows its head like a serpent), `twist`
 * (turns a metre: a helix of radius wave's amp round the line; strands at different `phase` braid). Wave and twist
 * die at both ends, so strands leave the hand and meet the target. `count` copies, `stagger` s apart, speeds spread by
 * `vary`, make a barrage.
 *   { form: 'ray' | 'bolt', speed: 12, width: 0.2, length: 1.5, hold: 0.8, head: 1.2 (× width), taper: 0.6, pulse: 0
 *     (hz), count: 1, stagger: 0.08, vary: 0, bow: 0, arc: 0, wave: [0, 0], twist: 0, phase: 0, delay: 0,
 *     edge: 'glow' | 'ink' | 'both', color? }
 *
 * Values first: a white core, a black ink edge, a coloured glow; two attacks read apart by form, edge, width and path
 * before colour (beamSignature).
 *
 *   BEAMS / BEAM_NAMES       presets, by what they do
 *   readBeam(v, where, beams)  a preset's name, a name in play.beams, or a spec → the attack (teaches on a bad one)
 *   readBeams(play)          play.beams, read
 *   strandPoints(S, A, B, t, j, N)  copy j of a strand, t s after the attack began: { spine: [{ p, r }], head, w }
 *   beamLanding(B)           when heads land: [[a, b]] (the first lands at the least a + b × distance)
 *   beamLength(B, D)         how long an attack over D metres plays (s)
 *   beamSignature(B)         what reads with the colour taken out
 */
import { readColor, readSpray } from './elements.js';
import { PUFFS } from './moments.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const FORMS = ['ray', 'bolt'];
const EDGES = ['glow', 'ink', 'both'];

// ── a strand, in time ────────────────────────────────────────────────────────────────────────────────────────────
/** Copy j of a strand t seconds after its attack began (the charge included in S.delay by readBeam), from A to B. The
 *  page runs this source. */
export function strandPoints(S, A, B, t, j, N) {
  const TAU = 6.283185307179586, fr = (x) => x - Math.floor(x), hs = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233 + 2.3) * 43758.5453);
  const n = N || 24, dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], D = Math.hypot(dx, dy, dz) || 1e-6;
  const u = [dx / D, dy / D, dz / D];
  // a side and an up square to the line (the side level when the line is not straight up)
  let s = [u[1], -u[0], 0], sl = Math.hypot(s[0], s[1]);
  s = sl > 1e-6 ? [s[0] / sl, s[1] / sl, 0] : [1, 0, 0];
  const up = [s[1] * u[2] - s[2] * u[1], s[2] * u[0] - s[0] * u[2], s[0] * u[1] - s[1] * u[0]];
  const speed = S.speed * (1 + S.vary * (hs(j, 1) - 0.5) * 2), tt = t - S.delay - S.stagger * j;
  const bowA = hs(j, 2) * TAU, bow = S.bow * (S.count > 1 ? 0.35 + 0.65 * hs(j, 3) : 1), ph = S.phase + (S.count > 1 && S.twist ? j / S.count : 0);
  const P = (x) => {
    const q = Math.max(0, Math.min(1, x / D)), hump = 4 * q * (1 - q), env = Math.sin(Math.PI * q);
    let os = Math.cos(bowA) * bow * hump, ou = S.arc * hump + Math.sin(bowA) * bow * hump;
    if (S.twist) { const a = TAU * (S.twist * x + ph); os += Math.cos(a) * S.wave[0] * env; ou += Math.sin(a) * S.wave[0] * env; }
    else if (S.wave[0]) { const a = TAU * (S.wave[1] * x + ph); os += Math.sin(a) * S.wave[0] * env; ou += 0.45 * Math.sin(0.7 * a + 1.3) * S.wave[0] * env; }
    return [A[0] + u[0] * x + s[0] * os + up[0] * ou, A[1] + u[1] * x + s[1] * os + up[1] * ou, A[2] + u[2] * x + s[2] * os + up[2] * ou];
  };
  const empty = { spine: [], head: null, w: 0 };
  if (tt <= 0) return empty;
  const run = speed * tt, arrive = D / speed;
  let x0, x1, w = 1;
  if (S.form === 'ray') {
    // grows to the target, holds, then its tail runs after it
    x1 = Math.min(D, run);
    x0 = tt > arrive + S.hold ? Math.min(D, speed * 1.6 * (tt - arrive - S.hold)) : 0;
    if (x0 >= D - 1e-6) return empty;
  } else {
    // a body behind a head; the head stops at the target and the body pours in after it
    x1 = Math.min(D, run);
    x0 = Math.max(0, run - S.length);
    if (x0 >= D - 1e-6) return empty;
  }
  const flick = S.pulse ? 1 + 0.14 * Math.sin(TAU * S.pulse * tt) : 1;
  const spine = [];
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1), x = x0 + (x1 - x0) * f;
    // a bolt thins toward its tail; a ray rounds off at its front and is even behind
    const r = S.form === 'bolt' ? S.width * (1 - S.taper * (1 - f)) : S.width * flick * (x1 - x < S.width ? 0.55 + 0.45 * ((x1 - x) / S.width) : 1);
    spine.push({ p: P(x), r: Math.max(0, r) });
  }
  const headOn = S.head > 0 && run < D + (S.form === 'bolt' ? 0 : -1e-9);
  return { spine, head: headOn ? { p: P(x1), r: S.width * S.head * flick } : null, w };
}

/** When heads land: one [a, b] a strand (its first copy): it lands a + b × distance seconds after the attack began. */
export function beamLanding(B) {
  return B.strands.map((S) => [S.delay, 1 / (S.speed * (1 + S.vary * (fracSin(0) - 0.5) * 2))]);
}
const fracSin = (j) => { const x = Math.sin(j * 12.9898 + 78.233 + 2.3) * 43758.5453; return x - Math.floor(x); };

/** How long an attack over D metres plays, its last strand's tail in (s). */
export function beamLength(B, D) {
  let end = 0;
  for (const S of B.strands) {
    const slow = S.speed * (1 - S.vary), last = S.delay + S.stagger * (S.count - 1);
    end = Math.max(end, last + (S.form === 'ray' ? D / slow + S.hold + D / (slow * 1.6) : (D + S.length) / slow));
  }
  return end + 0.2;
}

// ── reading ───────────────────────────────────────────────────────────────────────────────────────────────────────
const pair = (v, where, say) => {
  if (Array.isArray(v) && v.length === 2 && v.every(num)) return v.slice();
  throw new Error(`${where} is ${say}`);
};
export function readStrand(v, where) {
  if (!isObj(v)) throw new Error(`${where} is a strand: { form: ray | bolt, speed, width, … } (see the play-beams card)`);
  const n = (k, d, ok, say) => { const x = v[k] ?? d; if (!num(x) || !ok(x)) throw new Error(`${where}.${k} is ${say}`); return x; };
  const out = {
    form: v.form ?? 'bolt',
    speed: n('speed', 12, (x) => x > 0 && x <= 200, 'metres a second (to 200)'),
    width: n('width', 0.2, (x) => x > 0 && x <= 4, 'its radius (m, to 4)'),
    length: n('length', 1.5, (x) => x >= 0 && x <= 40, 'a bolt\'s body behind its head (m)'),
    hold: n('hold', 0.8, (x) => x >= 0 && x <= 10, 'seconds a ray holds on its target'),
    head: n('head', 1.2, (x) => x >= 0 && x <= 12, 'the head\'s size × width (0: none)'),
    taper: n('taper', 0.6, (x) => x >= 0 && x <= 1, 'how much a bolt thins to its tail, 0..1'),
    pulse: n('pulse', 0, (x) => x >= 0, 'flickers a second'),
    count: Math.round(n('count', 1, (x) => x >= 1 && x <= 24, 'how many copies (1 to 24)')),
    stagger: n('stagger', 0.08, (x) => x >= 0, 'seconds between copies'),
    vary: n('vary', 0, (x) => x >= 0 && x < 1, 'how much the copies\' speeds differ, 0..1'),
    bow: n('bow', 0, (x) => x >= 0 && x <= 20, 'metres each copy curves out'),
    arc: n('arc', 0, (x) => Math.abs(x) <= 20, 'metres it humps up'),
    wave: v.wave === undefined ? [0, 0] : pair(v.wave, `${where}.wave`, '[amp (m), waves a metre]'),
    twist: n('twist', 0, (x) => Math.abs(x) <= 10, 'turns a metre round the line'),
    phase: n('phase', 0, () => true, 'where on its wave it starts, 0..1'),
    delay: n('delay', 0, (x) => x >= 0, 'seconds before it goes'),
    edge: v.edge ?? 'glow',
  };
  if (!FORMS.includes(out.form)) throw new Error(`${where}.form is ray or bolt`);
  if (!EDGES.includes(out.edge)) throw new Error(`${where}.edge is glow, ink or both`);
  if (out.twist && !out.wave[0]) throw new Error(`${where}.twist braids round the line at wave's amp: give wave: [amp, 0]`);
  if (v.color !== undefined) out.color = readColor(v.color, `${where}.color`);
  const bad = Object.keys(v).filter((k) => !(k in out) && k !== 'color');
  if (bad.length) throw new Error(`${where} has no ${bad.join(', ')}: a strand is ${Object.keys(out).join(', ')}, color`);
  return out;
}

export const BEAM_LAYERS = Object.freeze(['color', 'strands', 'charge', 'rings', 'sparks', 'impact', 'shake']);
/** An attack: a preset's name (or one in `beams`, play.beams read), or a spec. */
export function readBeam(v, where, beams = null) {
  if (typeof v === 'string') {
    const B = (beams && beams[v]) || BEAMS[v];
    if (!B) throw new Error(`${where} '${v}' is not an attack: name a preset (${BEAM_NAMES.join(', ')}), one in play.beams, or give its strands`);
    return B;
  }
  if (!isObj(v)) throw new Error(`${where} is an attack: a preset's name, or { ${BEAM_LAYERS.join(', ')} }`);
  const bad = Object.keys(v).filter((k) => !BEAM_LAYERS.includes(k));
  if (bad.length) throw new Error(`${where} has no ${bad.join(', ')}: an attack is ${BEAM_LAYERS.join(', ')}`);
  const list = v.strands === undefined ? null : Array.isArray(v.strands) ? v.strands : [v.strands];
  if (!list || !list.length) throw new Error(`${where}.strands is one strand or a list ({ form: ray | bolt, speed, width, … })`);
  const out = { color: v.color === undefined ? [1, 1, 1] : readColor(v.color, `${where}.color`), strands: [] };
  if (v.charge !== undefined && v.charge !== false) {
    const c = v.charge === true ? {} : v.charge;
    if (!isObj(c)) throw new Error(`${where}.charge is { time, size, at: hand | above }`);
    const time = c.time ?? 0.8, size = c.size ?? 0.35, at = c.at ?? 'hand';
    if (!(num(time) && time > 0 && time <= 6)) throw new Error(`${where}.charge.time is seconds (to 6)`);
    if (!(num(size) && size > 0 && size <= 6)) throw new Error(`${where}.charge.size is the orb's radius (m, to 6)`);
    if (!['hand', 'above'].includes(at)) throw new Error(`${where}.charge.at is hand or above`);
    out.charge = { time, size, at };
  }
  const wait = out.charge ? out.charge.time : 0;
  // the charge comes first: every strand waits for it
  out.strands = list.map((s, i) => { const S = readStrand(s, `${where}.strands${Array.isArray(v.strands) ? `[${i}]` : ''}`); return { ...S, delay: S.delay + wait }; });
  if (v.rings !== undefined && v.rings !== false) {
    const r = v.rings === true ? {} : v.rings;
    if (!isObj(r) || (r.every !== undefined && !(num(r.every) && r.every >= 0.3)) || (r.size !== undefined && !(num(r.size) && r.size > 0))) throw new Error(`${where}.rings is { every: m (0.3 up), size: × width }`);
    out.rings = { every: r.every ?? 1.5, size: r.size ?? 2.2 };
  }
  if (v.sparks !== undefined && v.sparks !== false) out.sparks = readSpray(v.sparks === true ? { glyph: 'spark', count: 10, from: 'point', z: 0, v: 2.5, life: 0.4, size: 0.08 } : v.sparks, `${where}.sparks`);
  if (v.impact !== undefined && v.impact !== false) { if (!PUFFS.includes(v.impact)) throw new Error(`${where}.impact is a puff where it lands: ${PUFFS.join(', ')}`); out.impact = v.impact; }
  if (v.shake !== undefined) { if (!(num(v.shake) && v.shake > 0 && v.shake <= 1)) throw new Error(`${where}.shake is 0..1`); out.shake = v.shake; }
  return out;
}

/** play.beams: { name: attack }, read. */
export function readBeams(play) {
  const L = play && play.beams;
  if (L === undefined) return {};
  if (!isObj(L)) throw new Error('play.beams is { name: { strands, charge?, … } }');
  const out = {};
  for (const [k, v] of Object.entries(L)) {
    if (!/^[a-z][a-z0-9-]*$/.test(k)) throw new Error(`play.beams: '${k}' is a lower-case word`);
    out[k] = readBeam(v, `play.beams.${k}`);
  }
  return out;
}

// ── presets: named by what they do ───────────────────────────────────────────────────────────────────────────────
const P = (spec) => readBeam(spec, 'preset');
export const BEAMS = Object.freeze({
  // a ball of light from cupped hands, a short tail behind it
  orb: P({ color: [0.45, 0.75, 1], charge: { time: 0.35, size: 0.22 }, strands: { form: 'bolt', speed: 9, width: 0.26, length: 1.1, head: 1.35, taper: 0.85, edge: 'both' }, sparks: { glyph: 'spark', count: 8, from: 'point', z: 0, v: 1.6, life: 0.35, size: 0.07 }, impact: 'flash' }),
  // a long body slithering after its head, pouring into the target
  serpent: P({ color: [1, 0.48, 0.12], strands: { form: 'bolt', speed: 7, width: 0.3, length: 7, head: 1.7, taper: 0.92, wave: [0.6, 0.28], edge: 'glow' }, sparks: { glyph: 'spark', count: 14, from: 'point', z: 0, v: 1.2, gravity: -1, life: 0.6, size: 0.08 }, impact: 'sparks' }),
  // gathered at the hands, then a column that reaches, holds and goes
  ray: P({ color: [0.5, 0.8, 1], charge: { time: 1.2, size: 0.4 }, strands: { form: 'ray', speed: 24, width: 0.42, hold: 1.4, head: 1.5, pulse: 14, edge: 'both' }, rings: { every: 1.8, size: 2.1 }, impact: 'flash', shake: 0.6 }),
  // a great ball raised over the head, sent slowly down
  nova: P({ color: [1, 0.55, 0.25], charge: { time: 1.6, size: 1.1, at: 'above' }, strands: { form: 'bolt', speed: 3.2, width: 1.1, length: 0, head: 1, edge: 'ink' }, impact: 'strike', shake: 1 }),
  // many thin bolts from one hand, each its own speed and curve, all landing
  barrage: P({ color: [1, 0.35, 0.6], strands: { form: 'bolt', speed: 13, width: 0.05, length: 1.4, head: 2, taper: 1, count: 14, stagger: 0.07, vary: 0.55, bow: 2.6, edge: 'glow' }, impact: 'sparks' }),
  // two rays braiding round the line, meeting at the target
  braid: P({ color: [0.7, 0.5, 1], strands: [{ form: 'ray', speed: 16, width: 0.13, hold: 0.9, head: 1.6, twist: 0.45, wave: [0.42, 0], edge: 'glow' }, { form: 'ray', speed: 16, width: 0.13, hold: 0.9, head: 1.6, twist: 0.45, wave: [0.42, 0], phase: 0.5, edge: 'glow', color: [0.45, 1, 0.8] }], impact: 'flash' }),
  // a thin line, there at once, flickering, inked
  laser: P({ color: [1, 0.2, 0.2], strands: { form: 'ray', speed: 90, width: 0.045, hold: 0.35, head: 2.4, pulse: 30, edge: 'ink' }, impact: 'sparks' }),
});
export const BEAM_NAMES = Object.freeze(Object.keys(BEAMS));

/** What an attack reads as with the colour taken out: its strands' form, edge, width, path and number; its layers. */
export function beamSignature(B) {
  const band = (x, cuts) => cuts.findIndex((c) => x <= c);
  const path = (S) => (S.twist ? 'braid' : S.wave[0] ? 'slither' : S.bow ? 'bow' : S.arc ? 'arc' : 'straight');
  return [B.strands.map((S) => [S.form, S.edge, band(S.width, [0.08, 0.3, 0.7, 9]), path(S), S.count > 1 ? 'many' : 'one', S.speed > 30 ? 'instant' : S.speed < 5 ? 'slow' : 'flies'].join(' ')).join(' + '),
    B.charge ? `charge ${B.charge.at}` : '', B.rings ? 'rings' : ''].join(' | ');
}
