/**
 * station-loft-adorn — ADORNMENT as its own layer over a built-up figure (body → segment detail → limbs → adornment),
 * species-free. Lifted from the dragon's example (docs/examples/adornment) when the hero became its third wearer; a KIT
 * is data, and every signature is a named element from SIGNATURES with its numbers.
 *
 * MUGEN on a layered figure: an adornment point is an ADDRESS on its carrier, lifted along that address's normal by the
 * height of everything beneath it (the carrier, the parts it spans `over`, their segment detail and every adornment
 * already worn: true stacking) plus its mugen. The height field is smoothed (a max, then a mean) so an adornment
 * follows the gross line, not every scale; detail that pokes (spurs, spines) is left out and passes through. The mugen
 * ramps looser away from the adornment's `support`.
 *
 * Modes: SHELL (a window of the carrier, wrapped `t: 'wrap'` or partial; a BAND is a narrow wrapped shell), STRAP (a
 * path of addresses), HANG (a chain from an anchor under gravity, clear of the surface it hangs in front of; built by
 * the `medallion` and `bell` signatures). The SIGNATURE: every adornment names one recognizable visual element (a boss,
 * a spike, a buckle, a ring, a medallion, a plume, a bell, a stud), and `justify` asks the exposure ledger whether it
 * reads (exposed ≥ 0.25) and is a real share of its adornment's picture (≥ 0.08); otherwise the adornment is flagged
 * unjustified — advice, never a refusal. The ledger says an adornment is SEEN, not that it is wanted.
 *
 * `wear(fig, kit, { recipe })` builds at render time; `bakeAdorn(recipe, fig, kit)` stores each adornment, its signature
 * and its links as pinned L3 parts at ONE carrier address, so the whole adornment rides one pin face's weights (a
 * rigid adornment belongs to the bone that dominates where it is pinned) and FOLLOWS the dials as the surface under
 * that pin moves (a `bulk` that widens the chest widens the baldric with it; station-loft-clearance.js measures it). `pin: [s, t, side, part?]` chooses that address,
 * on another carrier if named: a pauldron shaped over the deltoid can ride the torso, and the arm moves beneath it.
 * Deterministic, no dice.
 */
import { compileLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';
import { frameAt, loftParts, ringLoft, sweep, ringAt, projectOnto, address, vec } from './station-loft-detail.js';
import { dominance, bakePart } from './station-loft-body.js';
import * as dmath from '../../util/dmath.js';
import { rigidityErrors } from './rigidity.js';

const { sub, add, mul, dot, cross, unit, mean } = vec;
const lerp = (a, b, t) => a + (b - a) * t;
export const ADORN_MODES = ['shell', 'band', 'strap'];

// ─── beneath: what an adornment stands off ───
/** the points beneath an adornment: its carrier and `over` parts (L1) plus every detail/adornment part whose
 * name mentions one of them, minus the ones that declare they poke through */
export function beneathOf(fig, names, { pokes = /^(spur|spine)/, onTop = false } = {}) { const pts = []; const L1 = fig.mesh.parts;
  // ON TOP: also every body detail PINNED to a carrier (fur tiles, locks, scales: named for their pass, not their part), so
  // an adornment rides over the cover instead of sinking under it
  const pinned = (k, p) => onTop && names.includes(p.pin?.parent ?? fig.anchors?.[k]?.part);
  // the part and every GARMENT worn on it (body-garment.js names a garment piece `<id>_<part>`): an adornment rides over
  // the cloth, not under it
  for (const n of names) if (L1[n]) pts.push(...Object.values(L1[n].points));
  for (const [k, P] of Object.entries(L1)) if (P.garment && names.some((n) => k.endsWith(`_${n}`))) pts.push(...Object.values(P.points));
  for (const [k, p] of Object.entries(fig.parts)) if (!pokes.test(k) && (names.some((n) => k.includes(n)) || pinned(k, p))) pts.push(...Object.values(p.points));
  return pts; }
/** height of the beneath hull above an address, along its normal, within a lateral radius */
export function hullHeight(pts, p, n, rad) { let h = 0; for (const v of pts) { const d = sub(v, p), up = dot(d, n); if (up <= h) continue; const lat = dmath.hypot(...sub(d, mul(n, up))); if (lat < rad) h = up; } return h; }
/** the circumferential sample list: a t window on one half, or the whole wrap (R half out, L half back) */
function around(P, t, side, nt) { const H = P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
  if (t === 'wrap') { const r = Array.from({ length: nt }, (_, k) => [H * k / nt, 'R']); const l = Array.from({ length: nt }, (_, k) => [H * (1 - k / nt), 'L']); return { list: [...r, ...l], closed: true }; }
  return { list: Array.from({ length: nt + 1 }, (_, k) => [lerp(t[0], t[1], k / nt), side]), closed: false }; }

// ─── modes ───
/** `share: true`: an adornment's window as SHARES of its carrier, the paint's measure (s of its station span, t of the ring
 * half, 0 the front → 1 the back), so one window reads alike on parts whose stations or slots differ → the window in the
 * carrier's own units (every reader of `s` and `t` goes through here) */
export function byShare(P, A) {
  if (!A.share || !P) return A;
  const U = P.stations.map((st, i) => st.u ?? i), H = P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
  const { share: _s, ...rest } = A;
  return { ...rest, s: A.s.map((x) => U[0] + x * (U[U.length - 1] - U[0])), ...(Array.isArray(A.t) ? { t: A.t.map((x) => x * H) } : {}) };
}
/** SHELL: the carrier's (s, t) window lifted by the smoothed beneath hull + mugen; a thick wall. Wrapped → a torus
 * (ringLoft); partial → a capped loft. The mugen field ramps away from the `support` station (snug where it hangs). */
export function shell(fig, A, side) { const L1 = fig.mesh.parts; const P = L1[A.part]; const beneath = beneathOf(fig, [A.part, ...(A.over || [])], { onTop: !!A.onTop });
  A = byShare(P, A);
  if (A.edge) return hollowShell(fig, A, side, beneath);
  let { list, closed } = around(P, A.t, side, A.nt ?? 12); let S = Array.from({ length: (A.ns ?? 4) + 1 }, (_, j) => lerp(A.s[0], A.s[1], j / (A.ns ?? 4)));
  // a RIM paints a band along the shell's own edges in another group (the low-poly trim: it IS the plate's edge, so it
  // follows every flare); its rows are inserted `w` (stations) in from the rimmed ends, and `wt` (a fraction) in from a
  // partial shell's t ends. Absent, the shell is unchanged.
  const rim = A.rim; let ends = false;
  if (rim) { const at = rim.at ?? 'both', e = Math.min(0.3, (rim.w ?? 0.08) / Math.abs(A.s[1] - A.s[0])), fr = S.map((_, j) => j / (S.length - 1));
    if (at !== 'high') fr.push(e); if (at !== 'low') fr.push(1 - e);
    S = [...new Set(fr.map((f) => Math.round(f * 1e6) / 1e6))].sort((a, b) => a - b).map((f) => lerp(A.s[0], A.s[1], f));
    if (!closed && rim.ends !== false) { const et = Math.min(0.3, rim.wt ?? 0.07), nt = A.nt ?? 12; ends = true;
      list = [0, et, ...Array.from({ length: nt - 1 }, (_, k) => (k + 1) / nt).filter((f) => f > et && f < 1 - et), 1 - et, 1].map((f) => [lerp(A.t[0], A.t[1], f), side]); } }
  const F = list.map(([t, sd]) => S.map((s) => frameAt(L1, A.part, [s, t], sd)));
  let H = F.map((row) => row.map((f) => hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05)));
  const nb = (k, j) => [[k, j], [k - 1, j], [k + 1, j], [k, j - 1], [k, j + 1]].map(([a, b]) => [closed ? (a + H.length) % H.length : Math.min(H.length - 1, Math.max(0, a)), Math.min(S.length - 1, Math.max(0, b))]);
  H = H.map((row, k) => row.map((_, j) => Math.max(...nb(k, j).map(([a, b]) => H[a][b])))); H = H.map((row, k) => row.map((_, j) => mean(nb(k, j).map(([a, b]) => [H[a][b]]))[0]));   // min-shield: max, then mean
  const mug = (s) => A.mugen * (1 + (A.ramp ?? 0) * (A.support == null ? 0 : Math.abs(s - A.support) / Math.max(1e-9, Math.abs(A.s[1] - A.s[0]))));
  // `seat`: the wall filled down to `seat` off the hull, solid from the body to the outer face (a plate standing out by
  // its own mass, never on a gap)
  const lift = (k, j) => (A.seat != null ? H[k][j] + A.seat : H[k][j] + mug(S[j]));
  const inner = F.map((row, k) => row.map((f, j) => add(f.origin, mul(f.normal, lift(k, j))))); const outer = inner.map((row, k) => row.map((p, j) => (A.seat != null ? add(F[k][j].origin, mul(F[k][j].normal, H[k][j] + mug(S[j]) + A.thick)) : add(p, mul(F[k][j].normal, A.thick)))));
  const sections = inner.map((row, k) => [...row, ...[...outer[k]].reverse()]);
  const mesh = closed ? ringLoft(sections) : loftParts(sections, mean(sections[0]), mean(sections[sections.length - 1]));
  if (rim) { const J = S.length, m = 2 * J, K = sections.length, at = rim.at ?? 'both', G = [];
    // ring index q runs the inner row j = 0…J-1, then the outer row back; face (k, q) spans ring points q → q+1
    const edge = (q) => (at !== 'high' && (q === m - 2 || q === m - 1)) || (at !== 'low' && (q === J - 1 || q === J));
    const bands = closed ? K : K - 1;
    for (let k = 0; k < bands; k++) for (let q = 0; q < m; q++) { const g = edge(q) || (ends && (k === 0 || k === bands - 1) && q >= J - 1) ? rim.group : A.group; G.push(g, g); }
    if (!closed) for (let q = 0; q < m; q++) G.push(ends ? rim.group : A.group, ends ? rim.group : A.group);
    mesh.faceGroups = G; }
  return { mesh: { ...mesh, group: A.group }, grid: { inner, outer, F, S, list, closed } }; }
/** HOLLOW SHELL (`edge` given): a PLATE, not a slab — what reads as worked metal or boiled leather is a thin wall whose
 * thickness shows only at its edge, and a curve of its own over the form beneath:
 *   edge   'roll' (the wall swells to `thick` at every free edge and the edge rounds over: a rolled bead) | 'flat' (the
 *          wall alone, a sheet's own thickness at the edge)
 *   wall   the sheet's thickness (m; default 0.3 × `thick`); the outer face is where a slab's would be
 *   crown  (m) the outer face domed off the hull, most at the window's middle (a pauldron's cup, a breastplate's swell)
 *   keel   (m) a ridge toward the window's t start (the centre line of a half plate: the breastplate's two planes)
 *   bead   the edge band's share of the window (default 0.07)
 *   interior  the group the inside of the wall is shaded in (absent: the plate's own)
 * Rows are added at the bead and the window is sampled at least 6 × 12, so the crown reads as a curve under the toon
 * light. A partial shell's t ends round over too (no flat cap). `seat` does not fill a hollow shell: what closes the gap
 * under a plate is its liner, a piece of its own (outfit-plan.js). `rim` paints the bead. The grid it hands the
 * signatures is the plate's (inner and outer faces). */
function hollowShell(fig, A, side, beneath) { const L1 = fig.mesh.parts, P = L1[A.part];
  const e = A.bead ?? 0.07, r6 = (x) => Math.round(x * 1e6) / 1e6;
  const fr = (n) => [...new Set([...Array.from({ length: n + 1 }, (_, i) => i / n), e, 1 - e].map(r6))].sort((a, b) => a - b);
  const fs = fr(Math.max(A.ns ?? 4, 6)), S = fs.map((f) => lerp(A.s[0], A.s[1], f));
  const closed = A.t === 'wrap', fk = closed ? null : fr(Math.max(A.nt ?? 12, 12));
  const list = closed ? around(P, 'wrap', side, Math.max(A.nt ?? 12, 12)).list : fk.map((f) => [lerp(A.t[0], A.t[1], f), side]);
  const F = list.map(([t, sd]) => S.map((s) => frameAt(L1, A.part, [s, t], sd)));
  // `slab` (m): a plate clears only what lies BESIDE it (its own slab along the part, that far each way): a bust's
  // overhang lifts the plate over the bust, not the fauld under it; and the lift is smoothed round the ring only, never
  // along the part (a dilation along it would fill the under-bust and the waist): a plate MOULDED, coming back in under a
  // form. Absent, it clears everything within `rad` and the lift is smoothed both ways (a cop riding over the deltoid)
  const slab = A.slab ?? Infinity, along = (k, j) => unit(sub(F[k][Math.min(S.length - 1, j + 1)].origin, F[k][Math.max(0, j - 1)].origin));
  // (each row's slab reaches its neighbouring rows at the least: a form peaking between two rows is still cleared)
  const gap = (k, j) => Math.max(...[j - 1, j + 1].filter((x) => x >= 0 && x < S.length).map((x) => dmath.hypot(...sub(F[k][x].origin, F[k][j].origin))));
  let H = F.map((row, k) => row.map((f, j) => { const ax = along(k, j), sl = Math.max(slab, gap(k, j)); let h = 0; for (const v of beneath) { const d = sub(v, f.origin), up = dot(d, f.normal); if (up <= h || Math.abs(dot(d, ax)) > sl) continue;
    if (dmath.hypot(...sub(d, mul(f.normal, up))) < (A.rad ?? 0.05)) h = up; } return h; }));
  const nb = (k, j) => [[k, j], [k - 1, j], [k + 1, j], ...(A.slab != null ? [] : [[k, j - 1], [k, j + 1]])].map(([a, b]) => [closed ? (a + H.length) % H.length : Math.min(H.length - 1, Math.max(0, a)), Math.min(S.length - 1, Math.max(0, b))]);
  H = H.map((row, k) => row.map((_, j) => Math.max(...nb(k, j).map(([a, b]) => H[a][b])))); H = H.map((row, k) => row.map((_, j) => mean(nb(k, j).map(([a, b]) => [H[a][b]]))[0]));
  const mug = (s) => A.mugen * (1 + (A.ramp ?? 0) * (A.support == null ? 0 : Math.abs(s - A.support) / Math.max(1e-9, Math.abs(A.s[1] - A.s[0]))));
  const J = S.length, K = list.length, wall = A.wall ?? A.thick * 0.3, roll = A.edge === 'roll';
  const atEdge = (k, j) => j === 0 || j === J - 1 || (!closed && (k === 0 || k === K - 1));
  const rise = (k, j) => (A.crown ?? 0) * dmath.sin(Math.PI * fs[j]) * (closed ? 1 : dmath.sin(Math.PI * fk[k])) + (closed || !A.keel ? 0 : A.keel * Math.max(0, 1 - fk[k] / 0.3));
  const outAt = (k, j) => H[k][j] + mug(S[j]) + A.thick + rise(k, j);
  // the plate is FAIRER than the body under it (a smith beats out the muscle's bumps): the outer face relaxed toward its
  // neighbours' mean a few times, then held clear of what it covers (no point nearer the body than its own stand-off)
  // (no point moves farther than `fairCap` m: small bumps are ironed out, a form as big as a bust is kept and the plate
  // comes back in under it)
  const raw = F.map((row, k) => row.map((f, j) => add(f.origin, mul(f.normal, outAt(k, j))))), cap = A.fairCap ?? 0.008;
  let outer = raw;
  for (let it = 0; it < (A.fair ?? 6); it++) outer = outer.map((row, k) => row.map((p, j) => {
    const ks = closed ? [(k + K - 1) % K, (k + 1) % K] : [k - 1, k + 1].filter((x) => x >= 0 && x < K), js = [j - 1, j + 1].filter((x) => x >= 0 && x < J);
    if (j === 0 || j === J - 1 || (!closed && (k === 0 || k === K - 1))) return p;   // the edges hold the window (two halves meeting on a seam stay met)
    const q = mean([...ks.map((x) => outer[x][j]), ...js.map((x) => outer[k][x])]), f = F[k][j], lifted = add(p, mul(sub(q, p), 0.5));
    const h = dot(sub(lifted, f.origin), f.normal), floor = H[k][j] + mug(S[j]) + wall;
    const held = h < floor ? add(lifted, mul(f.normal, floor - h)) : lifted, d = sub(held, raw[k][j]), l = dmath.hypot(...d);
    return l > cap ? add(raw[k][j], mul(d, cap / l)) : held; }));
  // WITHIN THE FIGURE (`within`: m past it): no point of the plate stands out sideways past the body's own widest line at
  // its height (the arms at rest included) by more than `within`; a point past it comes in along its normal, never nearer
  // the body than its wall (armour drawn for games: the outline is the figure's, the plate reads on it, not beside it)
  // The plate keeps its shape: its whole stand-off over what it covers is scaled down by one factor until it fits. A
  // `hover`ing plate (a detached genre's: alien) keeps its gap and scales only what stands past it.
  // (the width is that of what the plate COVERS, its part and `over`: a breastplate is held to the torso, a pauldron
  // over the arm to the arm's line)
  if (A.within != null) { const covered = new Set([A.part, ...(A.over || [])]), body = Object.entries(L1).filter(([n, Q]) => (Q.layer ?? 1) === 1 && (covered.has(n) || [...covered].some((c) => n.endsWith(`_${c}`)))).flatMap(([, Q]) => Object.values(Q.points));
    const reach = (z) => body.reduce((w, v) => (Math.abs(v[2] - z) < 0.04 && Math.abs(v[0]) > w ? Math.abs(v[0]) : w), 0);
    const base = outer.map((row, k) => row.map((p, j) => { const f = F[k][j], floor = H[k][j] + wall + (A.hover ? mug(S[j]) : 0); return { f, floor, h: dot(sub(p, f.origin), f.normal) }; }));
    const lims = outer.map((row) => row.map((p) => reach(p[2]) + A.within));
    const at = (c, x) => add(c.f.origin, mul(c.f.normal, c.floor + x * Math.max(0, c.h - c.floor)));
    const fits = (x) => base.every((row, k) => row.every((c, j) => Math.abs(at(c, x)[0]) <= lims[k][j] + 1e-9));
    if (!fits(1)) { let lo = 0, hi = 1; for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      outer = base.map((row) => row.map((c) => at(c, lo))); } }
  const inner = outer.map((row, k) => row.map((p, j) => add(p, mul(F[k][j].normal, -(roll && atEdge(k, j) ? A.thick : wall)))));
  const mid = (k, j) => mul(add(outer[k][j], inner[k][j]), 0.5), r = (roll ? A.thick : wall) * 0.45;
  const away = (k, a, b) => unit(sub(F[k][a].origin, F[k][b].origin));
  // a section per ring sample: the inner face up the window, over the high edge, the outer face back, under the low edge
  const sections = F.map((_, k) => [...inner[k], add(mid(k, J - 1), mul(away(k, J - 1, J - 2), r)), ...[...outer[k]].reverse(), add(mid(k, 0), mul(away(k, 0, 1), r))]);
  const m = 2 * J + 2, jOf = (q) => (q < J ? q : q === J ? J - 1 : q <= 2 * J ? 2 * J - q : 0);
  let mesh;
  if (closed) mesh = ringLoft(sections);
  else { // the t ends round over: each end's section drawn in toward its mid-line and carried a bead's radius beyond it
    const end = (k, k2) => sections[k].map((p, q) => { const j = jOf(q), c = mid(k, j); return add(add(p, mul(sub(c, p), 0.8)), mul(unit(sub(F[k][j].origin, F[k2][j].origin)), r)); });
    const e0 = end(0, 1), e1 = end(K - 1, K - 2);
    mesh = loftParts([e0, ...sections, e1], mean(e0), mean(e1)); }
  // the faces' groups: the wall's inside in `interior`, the bead (and with a `rim`, its band) in the rim's
  const rim = A.rim, inside = A.interior ?? A.group, hiRim = rim && (rim.at ?? 'both') !== 'low', loRim = rim && (rim.at ?? 'both') !== 'high';
  const qGroup = (q) => { const hi = q === J - 1 || q === J || q === J + 1 || q === J - 2, lo = q === 2 * J || q === 2 * J + 1 || q === 2 * J - 1 || q === 0;
    if ((hi && hiRim) || (lo && loRim)) return rim.group; return q < J - 1 && !hi && !lo ? inside : A.group; };
  const G = [], bands = closed ? K : K + 1, endG = rim && rim.ends !== false ? rim.group : A.group;
  for (let b = 0; b < bands; b++) for (let q = 0; q < m; q++) { const g = !closed && (b === 0 || b === bands - 1) ? endG : qGroup(q); G.push(g, g); }
  if (!closed) for (let q = 0; q < m; q++) G.push(endG, endG);
  // the LINER (`liner: { group, seat }`): what fills the gap under a plate standing off the body, recessed a bead inside
  // its edge and in the plate's shadow, so the outline stays one shape and the plate still reads as a shell over it
  let liner = null;
  if (A.liner) { const L = A.liner, ks = closed ? F.map((_, k) => k) : F.map((_, k) => k).slice(1, -1), js = S.map((_, j) => j).slice(1, -1);
    const secs = ks.map((k) => [...js.map((j) => add(F[k][j].origin, mul(F[k][j].normal, H[k][j] + (L.seat ?? 0)))), ...[...js].reverse().map((j) => add(inner[k][j], mul(F[k][j].normal, -0.001)))]);
    liner = { ...(closed ? ringLoft(secs) : loftParts(secs, mean(secs[0]), mean(secs[secs.length - 1]))), group: L.group }; }
  return { mesh: { ...mesh, group: A.group, ...(G.some((g) => g !== A.group) ? { faceGroups: G } : {}) }, grid: { inner, outer, F, S, list, closed }, ...(liner ? { liner } : {}) }; }
/** STRAP: a path of addresses (each [s, t, side] on the carrier), lifted over the beneath hull, as a flat band */
export function strap(fig, A) { const L1 = fig.mesh.parts; const beneath = beneathOf(fig, [A.part, ...(A.over || [])], { onTop: !!A.onTop }); const pts = [], ns = [];
  for (let i = 0; i + 1 < A.path.length; i++) { const [a, b] = [A.path[i], A.path[i + 1]]; const n = a[2] === b[2] ? 4 : 1; for (let k = 0; k < n; k++) { const u = k / n; const at = a[2] === b[2] ? [lerp(a[0], b[0], u), lerp(a[1], b[1], u)] : [a[0], a[1]]; const f = frameAt(L1, A.part, at, a[2]); pts.push(add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05) + A.mugen))); ns.push(f.normal); } }
  { const z = A.path[A.path.length - 1]; const f = frameAt(L1, A.part, [z[0], z[1]], z[2]); pts.push(add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05) + A.mugen))); ns.push(f.normal); }
  const rings = pts.map((p, i) => { const along = unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)])); const n = unit(sub(ns[i], mul(along, dot(ns[i], along)))); const lat = mul(unit(cross(n, along)), A.width / 2);
    return [sub(p, lat), add(p, lat), add(add(p, lat), mul(n, A.thick)), add(sub(p, lat), mul(n, A.thick))]; });
  return { mesh: { ...loftParts(rings, sub(pts[0], mul(unit(sub(pts[1], pts[0])), 0.01)), add(pts[pts.length - 1], mul(unit(sub(pts[pts.length - 1], pts[pts.length - 2])), 0.01))), group: A.group }, pts, ns }; }
/** HANG: a chain from an anchor under gravity, kept `clear` off the beneath points (a few relaxation passes that
 * keep link length), ending in a pendant; links alternate orientation */
export function clearOf(p, surfaces, out, clear) { for (const S of surfaces) { let hit; try { hit = projectOnto(S, p, out); } catch { continue; } const d = dot(sub(p, hit), out); if (d < clear) p = add(p, mul(out, clear - d)); } return p; }
// `sides`: each link's loop and wire (a drawn creature's by its target)
export function hang(beneath, anchor, { links, len, clear, r, surfaces = [], out = [0, 1, 0], sides = [10, 5] }) { let P = Array.from({ length: links + 1 }, (_, i) => add(anchor, [0, 0, -len * i]));
  for (let it = 0; it < 12; it++) { for (let i = 1; i < P.length; i++) { for (const v of beneath) { const d = sub(P[i], v), l = dmath.hypot(...d); if (l < clear && l > 1e-9) P[i] = add(v, mul(d, clear / l)); } P[i] = clearOf(P[i], surfaces, out, clear); }
    for (let i = 1; i < P.length; i++) { const d = sub(P[i], P[i - 1]), l = dmath.hypot(...d); P[i] = add(P[i - 1], mul(d, len / l)); } }
  const meshes = P.slice(0, -1).map((p, i) => { const c = mean([p, P[i + 1]]), ax = unit(sub(P[i + 1], p)); const side = unit(cross(ax, i % 2 ? [1, 0, 0] : [0, 1, 0]));
    return ringLoft(Array.from({ length: sides[0] }, (_, k) => { const a = 2 * Math.PI * k / sides[0]; const q = add(c, add(mul(ax, dmath.cos(a) * len * 0.55), mul(side, dmath.sin(a) * len * 0.3))); const t = unit(add(mul(ax, -dmath.sin(a) * 0.55), mul(side, dmath.cos(a) * 0.3))); return ringAt(q, t, r, sides[1]); })); });
  return { P, meshes }; }
/** a flat disc (medallion, boss, buckle plate) facing n: two rings and a raised face */
export function disc(c, n, r, h, m = 12, rim = 0.8) { const ring = (rr, z) => ringAt(add(c, mul(n, z)), n, rr, m); return loftParts([ring(r, 0), ring(r, h * 0.6), ring(r * rim, h)], sub(c, mul(n, 0.002)), add(c, mul(n, h * 1.15))); }

// ─── ribbons: the hair's tessellation for cloth strands ───
/**
 * A RIBBON along `spine` (world points), tessellated as an anime hair section is (anime-form.js): a sheet of `cols`
 * columns across its `width`, an outer and an inner face `thick` apart, `rows` rows along it; `ridge` raises the outer
 * face to a spine down its centre (a tent across the columns: it shades as two planes), `flute` a crease down each
 * column; `taper` narrows it toward the end (a share of its width lost by the tip), `twist` turns it about its own line
 * (degrees by the end); `tip` cuts its end square, to a `point`, or into a `swallow` tail (the V a ribbon is cut with),
 * `notch` the cut's depth (a share of the length). `across` the direction its width lies (default: level, across the
 * line). A closed loft (loftParts): each ring the section's outline, outer face across then inner face back.
 */
export function ribbonMesh(spine, { width = 0.03, thick = 0.004, cols = 5, rows = 12, taper = 0, ridge = 0, flute = 0, twist = 0, tip = 'square', notch = 0.15, across = null } = {}) {
  // the spine as one smooth curve by arc length (Catmull-Rom through its points)
  const P = spine, n = P.length - 1;
  const cr = (i, t) => { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[Math.min(n, i + 1)], p3 = P[Math.min(n, i + 2)], t2 = t * t, t3 = t2 * t;
    return [0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)); };
  const dense = []; for (let i = 0; i < n; i++) for (let k = 0; k < 8; k++) dense.push(cr(i, k / 8)); dense.push(P[n]);
  const acc = [0]; for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + dmath.hypot(...sub(dense[i], dense[i - 1])));
  const L = acc[acc.length - 1] || 1e-9;
  const at = (s) => { const d = Math.max(0, Math.min(1, s)) * L; let i = 1; while (i < acc.length - 1 && acc[i] < d) i++; const f = (d - acc[i - 1]) / Math.max(1e-12, acc[i] - acc[i - 1]);
    return { c: add(dense[i - 1], mul(sub(dense[i], dense[i - 1]), f)), T: unit(sub(dense[i], dense[i - 1])) }; };
  const xs = Array.from({ length: cols }, (_, c) => -1 + (2 * c) / (cols - 1));
  // each column's own length: the cut at the end
  const lenOf = (x) => (tip === 'swallow' ? 1 - notch * (1 - Math.abs(x)) : tip === 'point' ? 1 - notch * Math.abs(x) : 1);
  const tent = (x) => Math.max(0, 1 - Math.abs(x)), fl = (c) => (c % 2 ? -1 : 1);
  const point = (x, c, t, outer) => {
    const s = t * lenOf(x), { c: C, T } = at(s);
    let A = across ? sub(across, mul(T, dot(across, T))) : cross(T, [0, 0, 1]); if (dmath.hypot(...A) < 1e-6) A = cross(T, [0, 1, 0]); A = unit(A);
    let N = unit(cross(T, A));
    if (twist) { const a = (twist * s * Math.PI) / 180, ca = dmath.cos(a), sa = dmath.sin(a); [A, N] = [add(mul(A, ca), mul(N, sa)), sub(mul(N, ca), mul(A, sa))]; }
    const w = width * (1 - taper * s) / 2, h = thick / 2;
    const lift = outer ? h * (1 + ridge * tent(x) + flute * fl(c)) : -h;
    return add(add(C, mul(A, x * w)), mul(N, lift));
  };
  const rings = Array.from({ length: rows + 1 }, (_, r) => [...xs.map((x, c) => point(x, c, r / rows, true)), ...[...xs].reverse().map((x, i) => point(x, cols - 1 - i, r / rows, false))]);
  const back = sub(at(0).c, mul(at(0).T, thick)), end = at(lenOf(0)).c;
  return loftParts(rings, back, tip === 'swallow' ? add(end, mul(at(lenOf(0)).T, -thick * 0.5)) : end);
}

// ─── the signature library: one recognizable element, as data ───
/** a grid point of a shell: `k` a row index (a number, 'mid', or negative from the end), or `{ t, side, tol }` / `{ after, side }`
 * to find the first row at that ring parameter; `j` a station index (negative from the end; default the middle) */
function gridAt(g, sig, side) { const L = g.list.length, n = g.S.length; const idx = (v, N, dflt) => (v === undefined ? dflt : v === 'mid' ? Math.floor(N / 2) : v < 0 ? N + v : v);
  const sd = sig.side ?? side; let k;
  if (sig.t !== undefined) k = g.list.findIndex(([t, s]) => s === sd && Math.abs(t - sig.t) < (sig.tol ?? 0.2));
  else if (sig.after !== undefined) k = Math.max(0, g.list.findIndex(([t, s]) => s === sd && t > sig.after));
  else k = idx(sig.k, L, 0);
  const j = idx(sig.j, n, Math.floor(n / 2)); return [k, j]; }
/** where a shell's LIFTED outer skin faces `dir` (x mirrors on the L side): the outer skin's own normal, not the frame's
 * (a cap lifted over the arm has every frame normal facing up) → { c, n } */
function facePoint(g, dir, side) { const O = g.outer, K = O.length, J = O[0].length; const want = unit(side === 'L' ? [-dir[0], dir[1], dir[2]] : dir); let best = null;
  for (let k = Math.min(1, K - 1); k < Math.max(1, K - 1); k++) for (let j = Math.min(1, J - 1); j < Math.max(1, J - 1); j++) {
    let n = unit(cross(sub(O[Math.min(K - 1, k + 1)][j], O[Math.max(0, k - 1)][j]), sub(O[k][Math.min(J - 1, j + 1)], O[k][Math.max(0, j - 1)])));
    if (dot(n, g.F[k][j].normal) < 0) n = mul(n, -1); const score = dot(n, want); if (!best || score > best.score) best = { score, c: O[k][j], n }; }
  return best; }
/** a motif's seat: on a strap, the point `at` (0–1) along its path; on a shell, where its outer skin faces `dir` */
function seatOf(g, S) { if (g.pts) { const i = Math.round((S.at ?? 0.5) * (g.pts.length - 1)); return { c: g.pts[i], n: g.ns[i] }; } return facePoint(g, S.dir ?? [0, 1, 0], S.side); }
/** an edge as points and normals: a strap's path, or a shell's station row `j` (default the last) across its grid */
function edgeOf(g, S) { if (g.pts) return g.pts.map((p, i) => ({ p, n: g.ns[i] })); const J = g.outer[0].length, j = S.j === undefined ? J - 1 : S.j < 0 ? J + S.j : S.j;
  return g.outer.map((row, k) => ({ p: row[j], n: g.F[k][j].normal })); }
/** a closed ellipse ring in a frame: centre `o`, half-widths `a` along `u` and `b` along `v` */
const ellipse = (o, u, v, a, b, m, ph = 0) => Array.from({ length: m }, (_, i) => { const t = 2 * Math.PI * i / m + ph; return add(o, add(mul(u, a * dmath.cos(t)), mul(v, b * dmath.sin(t)))); });
/** a low-poly cone from `p` along `dir`: `len` long, base radius `r` (the motif spike: crowns, crests, horns) */
const cone = (p, dir, len, r, m = 5, minR = 0.0015) => sweep([sub(p, mul(dir, r * 0.8)), p, add(p, mul(dir, len * 0.45)), add(p, mul(dir, len))], [r, r * 0.8, Math.max(minR, r * 0.38)], m);
// the rune glyphs: strokes in a unit box (x across, y up), angular like carved runes
const GLYPHS = [[[[0, -1], [0, 1]], [[0, 0.2], [0.6, 0.8]]], [[[0, -1], [0, 1]], [[0, 1], [0.6, 0.35]], [[0.6, 0.35], [0, -0.15]]], [[[-0.5, -1], [0, 1]], [[0, 1], [0.5, -1]]],
  [[[0, -1], [0, 1]], [[-0.5, 0.5], [0.5, -0.5]]], [[[0, -1], [0, 1]], [[0, 0.35], [0.5, 0.9]], [[0, 0.35], [-0.5, 0.9]]], [[[-0.4, 1], [0.4, 0.2]], [[0.4, 0.2], [-0.4, -0.55]], [[-0.4, -0.55], [0.4, -1]]]];
/** THE MOTIFS: embroidery's library, each a set of strokes (polylines) in a unit cell, x across [−1, 1] and y up [−1, 1].
 * A border repeats the cell edge to edge, so the strokes that leave a cell's side meet the next one's (a vine's stem, a
 * key's run, a wave's line); a field places one, centred, as an emblem */
export const MOTIFS = Object.freeze({
  vine: [[[-1, 0], [-0.5, 0.35], [0, 0], [0.5, -0.35], [1, 0]], [[-0.5, 0.35], [-0.35, 0.8]], [[0.5, -0.35], [0.35, -0.8]], [[0, 0], [0.2, 0.45]]],
  knot: [[[-1, 0], [-0.6, 0.5], [0, 0.6], [0.6, 0], [0, -0.6], [-0.6, -0.5], [-1, 0]], [[1, 0], [0.6, 0.5], [0, 0.6], [-0.6, 0], [0, -0.6], [0.6, -0.5], [1, 0]]],
  key: [[[-1, -0.8], [-1, 0.8], [0.6, 0.8], [0.6, -0.4], [-0.4, -0.4], [-0.4, 0.3], [0.1, 0.3]], [[-1, -0.8], [1, -0.8]]],
  wave: [[[-1, -0.3], [-0.5, -0.3], [-0.2, 0.2], [0.2, 0.6], [0.5, 0.4], [0.4, 0.05], [0.1, 0.1]], [[0.5, 0.4], [0.8, -0.1], [1, -0.3]]],
  chevron: [[[-1, 0.6], [0, -0.6], [1, 0.6]]],
  diamond: [[[0, 0.9], [0.9, 0], [0, -0.9], [-0.9, 0], [0, 0.9]], [[0, 0.3], [0.3, 0], [0, -0.3], [-0.3, 0], [0, 0.3]]],
  dots: [[[-0.5, -0.1], [-0.5, 0.1]], [[0.5, -0.1], [0.5, 0.1]], [[0, 0.5], [0, 0.7]], [[0, -0.7], [0, -0.5]]],
  star: [[[0, 1], [0, -1]], [[-0.85, 0.5], [0.85, -0.5]], [[-0.85, -0.5], [0.85, 0.5]]],
});
const PROFILES = { even: () => 1, crown: (q) => 0.55 + 0.45 * dmath.sin(Math.PI * q), rake: (q) => 0.45 + 0.55 * q, fan: (q) => 1 - 0.5 * Math.abs(2 * q - 1) };
/** a low-poly SKULL facing out of the surface at `c` along `n` (its up the world's up off `n`), `r` its half-width:
 * a cranium and a jaw in `group`, eye sockets and the nose and teeth gap in `socketGroup` (dark, or a glow), and 0–2
 * horns in `hornGroup` (1: one rising from the brow; 2: a pair from the temples) */
function skullAt(c, n, S) { const r = S.r; let up = sub([0, 0, 1], mul(n, n[2])); if (dmath.hypot(...up) < 1e-3) up = [0, 1, 0]; up = unit(up); const lat = unit(cross(up, n));
  const z0 = S.proud ?? 0.35, P = (l, u, d) => add(c, add(add(mul(lat, l * r), mul(up, u * r)), mul(n, d * r))), m = S.m ?? 8;
  const ring = (u, w, d, zc) => ellipse(P(0, u, zc), lat, n, w * r, d * r, m, Math.PI / m);
  const cran = [[-0.5, 0.62, 0.52], [-0.28, 0.8, 0.66], [0.05, 0.94, 0.76], [0.42, 0.94, 0.74], [0.72, 0.78, 0.62], [0.92, 0.46, 0.38]];
  const jaw = [[-0.98, 0.34, 0.3], [-0.78, 0.44, 0.4], [-0.48, 0.5, 0.42]];
  const sg = S.socketGroup ?? S.group, out = [
    loftParts(cran.map(([u, w, d]) => ring(u, w, d, z0)), P(0, -0.58, z0), P(0, 1.0, z0)),
    loftParts(jaw.map(([u, w, d]) => ring(u, w, d, z0 + 0.14)), P(0, -1.04, z0 + 0.14), P(0, -0.4, z0 + 0.14))];
  for (const sd of [1, -1]) out.push({ ...disc(P(sd * 0.34, 0.1, z0 + 0.66), unit(add(n, mul(lat, sd * 0.3))), r * 0.22, r * 0.08, 8, 0.6), group: sg });
  out.push({ ...disc(P(0, -0.24, z0 + 0.7), n, r * 0.09, r * 0.05, 5, 0.4), group: sg });
  out.push({ ...sweep([P(-0.34, -0.7, z0 + 0.5), P(0, -0.7, z0 + 0.58), P(0.34, -0.7, z0 + 0.5)], [r * 0.055, r * 0.055], 5, { squash: [1, 0.5] }), group: sg });
  const hg = S.hornGroup ?? S.group, horns = S.horns ?? 0;
  if (horns === 1) out.push({ ...sweep([P(0, 0.5, z0 + 0.5), P(0, 0.8, z0 + 0.95), P(0, 1.25, z0 + 1.2), P(0, 1.75, z0 + 1.25)], [r * 0.2, r * 0.14, r * 0.07], 6), group: hg });
  if (horns === 2) for (const sd of [1, -1]) out.push({ ...sweep([P(sd * 0.62, 0.45, z0 + 0.1), P(sd * 1.0, 0.7, z0 + 0.1), P(sd * 1.22, 1.15, z0), P(sd * 1.12, 1.7, z0 - 0.05)], [r * 0.2, r * 0.14, r * 0.07], 6), group: hg });
  return out; }
export const VOLUME_SHAPES = Object.freeze(['football', 'cone', 'bell', 'slab', 'bead', 'plate']);
/** the carrier's axis under a wrapped shell window: the ring centre and mean radius at each station row */
function axisOf(g) { const J = g.S.length;
  return Array.from({ length: J }, (_, j) => { const pts = g.F.map((row) => row[j].origin), c = mean(pts); return { c, r: mean(pts.map((p) => [dmath.hypot(...sub(p, c))]))[0] }; }); }
/** the VOLUME signature's mesh (SIGNATURES.volume) */
function volumeAt(g, S) {
  if (!VOLUME_SHAPES.includes(S.shape)) throw new Error(`adorn: volume shape '${S.shape}' is not one of ${VOLUME_SHAPES.join(', ')}`);
  const ax = axisOf(g), c0 = ax[0].c, c1 = ax[ax.length - 1].c, L = dmath.hypot(...sub(c1, c0)), a = unit(sub(c1, c0));
  const R = (S.girth ?? 1.5) * mean(ax.map((x) => [x.r]))[0];
  // the cross-section frame: `fw` the figure's forward (+y) off the axis, or up where the carrier already runs forward
  const ref = Math.abs(a[1]) > 0.8 ? [0, 0, 1] : [0, 1, 0], fw = unit(sub(ref, mul(a, dot(ref, a)))), lat = unit(cross(fw, a));
  const [sq0, sq1] = S.squash ?? [1, 1], [b0, b1, b2] = S.bias ?? [0, 0, 0], n = S.n ?? 2, m = S.m ?? 20;
  const se = (v) => Math.sign(v) * dmath.pow(Math.abs(v), 2 / n);
  // `half` { cut }: a flat face across the section `cut` radii below the axis (on the fw side's opposite), level along the
  // whole length: a half-egg foot's sole
  const cutAt = S.half ? -(S.half.cut ?? 0) : -Infinity;
  const ring = (c, r) => Array.from({ length: m }, (_, i) => { const t = 2 * Math.PI * i / m; return add(c, add(mul(lat, se(dmath.cos(t)) * r * sq0), mul(fw, Math.max(se(dmath.sin(t)) * r * sq1, cutAt * R)))); });
  const off = (u) => add(add(c0, mul(a, u * L + b2 * R)), add(mul(lat, b0 * R), mul(fw, b1 * R)));
  if (S.shape === 'plate') {   // an angular PLATE arched over the carrier's outer side (a pauldron over a ball): `profile`
    // rows [along (in R, negative toward the window's start), radius (in R)], each an arc of `span` radians either side of
    // the figure's outward side in `facets` flat facets, `thick` (in R) deep
    const c = off(S.at ?? 0.5); let o = [S.side === 'L' ? -1 : 1, 0, 0]; o = unit(sub(o, mul(a, dot(o, a)))); const f2 = cross(a, o);
    const span = S.span ?? 1.5, nf = S.facets ?? 4, th = S.thick ?? 0.08, P = Array.from({ length: nf + 1 }, (_, i) => -span + 2 * span * i / nf);
    const pt = (z, ph, rr) => add(add(c, mul(a, z * R)), mul(add(mul(o, dmath.cos(ph)), mul(f2, dmath.sin(ph))), rr * R));
    const rows = (S.profile ?? [[-1.05, 0.5], [-0.7, 1.08], [0, 1.22], [0.6, 1.3]]).map(([z, r]) => [...P.map((ph) => pt(z, ph, r)), ...[...P].reverse().map((ph) => pt(z, ph, r - th))]);
    return loftParts(rows, mean(rows[0]), mean(rows[rows.length - 1])); }
  if (S.shape === 'bead') {   // a ball (squashed, or pointed toward a crest by `peak`) at `at` along the window
    const c = off(S.at ?? 0.5), K = S.rings ?? 9, pk = S.peak ?? 0;
    // `point: 'start'` turns the crest toward the window's start (a knee pad pointing up the thigh from the shank)
    const ab = S.point === 'start' ? mul(a, -1) : a, lb = S.point === 'start' ? unit(cross(fw, ab)) : lat;
    const rg = S.point === 'start' ? (cc, r) => Array.from({ length: m }, (_, i) => { const t = 2 * Math.PI * i / m; return add(cc, add(mul(lb, se(dmath.cos(t)) * r * sq0), mul(fw, Math.max(se(dmath.sin(t)) * r * sq1, cutAt * R)))); }) : ring;
    const rings = Array.from({ length: K }, (_, i) => { const th = Math.PI * (i + 1) / (K + 1), z = -dmath.cos(th), w = dmath.sin(th) * (1 - pk * Math.max(0, z)); return rg(add(c, mul(ab, z * R * (S.squashAlong ?? 1))), Math.max(1e-4, w * R)); });
    return loftParts(rings, add(c, mul(ab, -R * (S.squashAlong ?? 1))), add(c, mul(ab, R * (S.squashAlong ?? 1) * (1 + pk * 0.6)))); }
  const [e0, e1] = S.extend ?? [0, 0], u0 = -e0, u1 = 1 + e1, K = S.rings ?? 12;
  const prof = { cone: (q) => 1 + ((S.taper ?? 1.4) - 1) * q,
    football: (q) => { const p = S.peak ?? 0.6, base = S.base ?? 0.62, mouth = S.mouth ?? 0.5; return q < p ? base + (1 - base) * dmath.pow(dmath.sin(Math.PI / 2 * q / p), 0.7) : mouth + (1 - mouth) * dmath.pow(dmath.cos(Math.PI / 2 * (q - p) / (1 - p)), 0.7); },
    bell: (q) => 1 + ((S.mouth ?? 1.5) - 1) * q * q,
    slab: (q) => 1 + ((S.taper ?? 1) - 1) * q }[S.shape];
  const U = Array.from({ length: K }, (_, i) => u0 + (u1 - u0) * i / (K - 1)), rad = U.map((u, i) => R * prof(i / (K - 1)));
  const rings = U.map((u, i) => ring(off(u), rad[i]));
  // a rounded proximal end (the volume swells out of the limb), a flat distal face (a cuff, a sole, a muzzle)
  const body = loftParts(rings, add(off(u0), mul(a, -rad[0] * 0.35)), off(u1));
  const out = [body];
  if (S.bore) { const br = rad[K - 1] * (S.bore.r ?? 0.62); out.push({ ...disc(add(off(u1), mul(a, 0.0005)), a, br, Math.max(0.001, br * 0.12), m, 0.7), group: S.bore.group }); }
  if (S.lip) { const hi = S.lip.at !== 'low', w = S.lip.w ?? 0.12, o = 1 + (S.lip.out ?? 0.06), Q = 3;
    const band = Array.from({ length: Q }, (_, i) => { const q = hi ? 1 - w + w * i / (Q - 1) : w * i / (Q - 1), u = u0 + (u1 - u0) * q; return ring(off(u), R * prof(q) * o); });
    out.push({ ...loftParts(band, off(u0 + (u1 - u0) * (hi ? 1 - w : 0)), off(u0 + (u1 - u0) * (hi ? 1 : w))), group: S.lip.group }); }
  return out; }
/** the PLAQUE signature's mesh (SIGNATURES.plaque) */
function plaqueAt(fig, beneath, S) {
  const L1 = fig.mesh.parts, part = S.part ?? S.carrier, [s0, s1] = S.s, [wb, wt] = S.w, Q = S.rows ?? 6, K = S.cols ?? 9;
  const lift = S.lift ?? 0.01, thick = S.thick ?? 0.004, bev = S.bevel ?? 0.86, tc = S.c ?? 0;
  const pt = (sv, t, off) => { const f = frameAt(L1, part, [sv, Math.abs(t)], t < 0 ? 'L' : 'R'); return add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, S.rad ?? 0.05) + off)); };
  const rows = Array.from({ length: Q }, (_, i) => { const q = i / (Q - 1), sv = s0 + (s1 - s0) * q, w = wb + (wt - wb) * q, sOut = i === 0 ? s0 + (s1 - s0) * 0.06 : sv;
    const T = Array.from({ length: K }, (_, k) => tc + (-w + 2 * w * k / (K - 1)));
    return [...T.map((t) => pt(sv, t, lift)), ...[...T].reverse().map((t) => pt(sOut, tc + (t - tc) * bev, lift + thick))]; });
  return loftParts(rows, mean(rows[0]), mean(rows[Q - 1])); }
// ─── the CAST mask (SIGNATURES.cast): an outline in the eyes' frame cast onto the face ───
const pip = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const nearestOn = (P, x, z) => { let best = null, bd = Infinity; for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)), px = ax + t * dx, pz = az + t * dz, d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = [px, pz]; } } return best; };
// an EYE's outline in the eyes' frame round its centre `cx` (±1), its outer corner toward the temple: `almond` (pointed at
// both corners), `slit` (an almond pressed thin), `angular` (a six-sided eye, its outer corner swept up), `round`
const eyeShape = (shape, cx, rx, rz, tilt, n = 24) => {
  const out = Math.sign(cx), rot = ([x, z]) => { const c = dmath.cos(tilt), sn = dmath.sin(tilt) * out; return [cx + x * c - z * sn, x * sn + z * c]; };
  if (shape === 'angular') return [[-rx, -0.05 * rz], [-0.45 * rx, rz * 0.85], [0.55 * rx, rz], [rx, rz * 0.35], [0.7 * rx, -rz * 0.55], [-0.35 * rx, -rz * 0.8]].map(([x, z]) => rot([x * out, z]));
  if (shape === 'round') return Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return rot([rx * dmath.cos(a), rz * dmath.sin(a)]); });
  const k = shape === 'slit' ? 0.4 : 1;
  return Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n, x = rx * dmath.cos(a), z = k * rz * Math.sign(dmath.sin(a)) * Math.abs(dmath.sin(a)) ** 0.8 * (1 - Math.abs(dmath.cos(a)) ** 4) ** 0.6; return rot([x, z]); });
};
// Chaikin's corner cutting, `passes` times, the points flagged sharp kept (a temple's point, a widow's peak)
const chaikin = (P, passes) => { let Q = P; for (let it = 0; it < passes; it++) { const R = []; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length];
  if (a.sharp) R.push(a); else if (!R.length || R[R.length - 1] !== a) R.push({ x: 0.75 * a.x + 0.25 * b.x, z: 0.75 * a.z + 0.25 * b.z });
  if (!b.sharp) R.push({ x: 0.25 * a.x + 0.75 * b.x, z: 0.25 * a.z + 0.75 * b.z }); } Q = R; } return Q; };
/** the cast's OUTLINE in the eyes' frame from its dials (see SIGNATURES.cast), the right half mirrored; its eye shapes */
export const CAST_DIALS = Object.freeze({ bridge: 0.5, cheek: 0.95, brow: 1.18, notch: 0.3, peak: 0, wing: 2.75, wingRise: 0.85, fang: 0, round: 1 });
function castOutline(S) {
  const E = S.eyes ?? {}, [rx, rz] = E.size ?? S.eye ?? [0.6, 0.36], tilt = E.tilt ?? S.tilt ?? 0.1, shape = E.shape ?? 'almond';
  const holes = [eyeShape(shape, 1, rx, rz, tilt), eyeShape(shape, -1, rx, rz, tilt)];
  if (S.outline && typeof S.outline === 'object' && S.outline.poly) return { outer: S.outline.poly, holes: S.outline.holes ?? holes };
  if (S.outline === 'band') return { outer: [[-2.3, -0.62], [2.3, -0.62], [2.3, 0.7], [-2.3, 0.7]], holes };
  const D = { ...CAST_DIALS, ...(S.outline && typeof S.outline === 'object' ? S.outline : {}) }, w = D.wing;
  // the right half, from the bridge's foot round the cheek to the temple's point and back along the brow to the middle
  const half = [{ x: 0, z: -D.bridge, sharp: D.round < 1 }, { x: 0.3, z: -(D.cheek - 0.17) }, { x: 0.9, z: -D.cheek }, { x: 1.55, z: -(D.cheek - 0.1) },
    ...(D.fang > 0 ? [{ x: 1.85, z: -(D.cheek + D.fang), sharp: true }, { x: 2.05, z: -0.55 * D.cheek }] : [{ x: 2.1, z: -0.53 * D.cheek }]),
    { x: w - 0.3, z: 0.05 }, { x: w, z: D.wingRise, sharp: true }, { x: w - 0.55, z: Math.max(D.wingRise + 0.1, D.brow - 0.25) }, { x: 1.6, z: D.brow - 0.06 }, { x: 0.95, z: D.brow },
    ...(D.peak > 0 ? [{ x: 0.35, z: D.brow - 0.1 - D.notch * 0.5 }, { x: 0, z: D.brow + D.peak, sharp: true }] : [{ x: 0.4, z: D.brow - 0.13 }, { x: 0, z: D.brow - D.notch, sharp: D.round < 1 }])];
  const ring = [...half, ...half.slice(1, -1).reverse().map((p) => ({ ...p, x: -p.x }))];
  return { outer: chaikin(ring, Math.round(2 * Math.max(0, Math.min(1, D.round)))).map((p) => [p.x, p.z]), holes };
}
// the SEAMS a technical cast carries, by word, in the eyes' frame (polylines; each mirrored but the centre's)
const SEAM_WORDS = { centre: [[[0, -1.2], [0, 1.6]]], brow: [[[-2.2, 0.62], [-1.2, 0.72], [0, 0.6], [1.2, 0.72], [2.2, 0.62]]], cheek: [[[1.55, -0.3], [2.2, -0.75]], [[-1.55, -0.3], [-2.2, -0.75]]],
  temple: [[[1.62, 0.12], [2.5, 0.6]], [[-1.62, 0.12], [-2.5, 0.6]]] };
const segDist = (x, z, L) => { let b = Infinity; for (let i = 0; i + 1 < L.length; i++) { const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-12))); b = Math.min(b, Math.hypot(ax + t * dx - x, az + t * dz - z)); } return b; };
const ringDist = (x, z, P) => segDist(x, z, [...P, P[0]]);
function castMask(fig, S) {
  const tri = []; const take = (P) => { if (!P?.faces || !P.points) return; const F = Array.isArray(P.faces) ? P.faces : Object.values(P.faces); for (const f of F) for (let k = 1; k + 1 < f.length; k++) { const a = P.points[f[0]], b = P.points[f[k]], c = P.points[f[k + 1]]; if (a && b && c) tri.push([a, b, c]); } };
  // (the skin it is cast onto: the named parts, by default the landmark head's cranium and jaw and the anime head's face)
  for (const n of S.parts || ['cranium', 'jaw', 'face']) take(fig.mesh.parts[n]);
  const over = S.over ? new RegExp(S.over) : /^(brow|lid)(R|L)?$/;
  for (const [k, P] of Object.entries(fig.parts || {})) if (over.test(k)) take(P);
  if (!tri.length) return [];
  const all = tri.flat(), lo = [0, 1, 2].map((i) => Math.min(...all.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...all.map((p) => p[i])));
  const mid = (P) => { const v = Object.values(P?.points || {}); return v.length ? [0, 1, 2].map((i) => v.reduce((a, p) => a + p[i], 0) / v.length) : null; };
  // (the eyes' centres: the head's eye details are not built yet when it is dressed, so they are read off the cranium's own
  // EYE ROW, the landmark head's station 4 (its rows: 0 the mouth … 3 the bridge, 4 the eyes, 5 the brow), between the
  // eye's inner and outer corner slots; a head without them falls back to its bounds)
  const Cr = fig.mesh.parts[(S.parts || ['cranium'])[0]], eyeRow = Cr?.stations?.find((st) => st.id === (S.eyeRow ?? 'st4'));
  // (the landmark head draws its eye a little past the middle of its corners, `eyeAt` of the way from the inner to the outer)
  const pre = Cr ? Object.keys(Cr.points)[0].split('/')[0] : '', eyeAt = S.eyeAt ?? 0.565;
  const corner = (S0) => { const a = Cr?.points?.[`${pre}/${eyeRow?.id}.inner${S0}`], b = Cr?.points?.[`${pre}/${eyeRow?.id}.outer${S0}`]; return a && b ? add(a, mul(sub(b, a), eyeAt)) : null; };
  // (a head that draws its pupils as parts by the time it is dressed, the anime head's: their middles)
  const pupil = (S0) => mid(fig.mesh.parts[`pupil${S0}`]) ?? mid(fig.parts?.[`pupil${S0}`]) ?? mid(fig.mesh.parts[`iris${S0}`]) ?? mid(fig.parts?.[`iris${S0}`]);
  const eR = (eyeRow && corner('R')) || pupil('R'), eL = (eyeRow && corner('L')) || pupil('L');
  const c0 = eR && eL ? mul(add(eR, eL), 0.5) : [(lo[0] + hi[0]) / 2, hi[1], lo[2] + 0.55 * (hi[2] - lo[2])];
  const d = eR && eL ? Math.max(0.012, Math.abs(eR[0] - eL[0]) / 2) : 0.032;
  // the cylinder the outline wraps round: its axis vertical through the head's middle, its radius the head's half-depth
  const ax = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], R = Math.max(0.03, Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 2);
  // (the wrap is anchored on the eyes: X ±1 lands on each eye's own angle round the axis, so the holes sit on the eyes
  // however round the head is; a head without eyes found wraps by arc length on the radius)
  const thE = eR ? Math.atan2(Math.abs(eR[0] - ax[0]), eR[1] - ax[1]) : d / R;
  const dirAt = (X) => { const th = X * thE; return [dmath.sin(th), dmath.cos(th), 0]; };
  const castAt = (X, Z) => { const dir = dirAt(X), z = c0[2] + Z * d, o = [ax[0] + dir[0] * 0.4, ax[1] + dir[1] * 0.4, z], ray = mul(dir, -1); let best = null;
    for (const [a, b, c] of tri) { const e1 = sub(b, a), e2 = sub(c, a), h = cross(ray, e2), det = dot(e1, h); if (Math.abs(det) < 1e-14) continue; const f = 1 / det, sv = sub(o, a), u = f * dot(sv, h); if (u < 0 || u > 1) continue; const q = cross(sv, e1), v = f * dot(ray, q); if (v < 0 || u + v > 1) continue; const t = f * dot(e2, q); if (t > 1e-6 && (best === null || t < best)) best = t; }
    return best === null ? null : 0.4 - best; };   // the skin's distance from the axis along the ray
  const { outer, holes } = castOutline(S), cell = S.cell ?? 0.06, treat = S.eyes?.treat ?? 'open', cut = treat === 'open' ? holes : [];
  const inside = (x, z) => pip(outer, x, z) && !cut.some((H) => pip(H, x, z));
  const xs = outer.map((p) => p[0]), zs = outer.map((p) => p[1]), X0 = Math.min(...xs) - cell, Z0 = Math.min(...zs) - cell, NX = Math.ceil((Math.max(...xs) - X0) / cell) + 2, NZ = Math.ceil((Math.max(...zs) - Z0) / cell) + 2;
  const keep = new Set(); for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NZ - 1; j++) if (inside(X0 + (i + 0.5) * cell, Z0 + (j + 0.5) * cell)) keep.add(`${i},${j}`);
  // the corners the kept cells use, those outside the shape snapped onto its nearest edge (the outline, or an eye hole's)
  // (`edge`: the corner lies on the outline, `eye` on an eye's; a covered eye's outline is snapped to too, so a lens's
  // colour, cut by the faces, follows its shape instead of the grid's steps)
  const covered = treat === 'open' ? [] : holes, used = new Map(), uv = (i, j) => { const kk = `${i},${j}`; if (!used.has(kk)) { let x = X0 + i * cell, z = Z0 + j * cell, edge = false, eye = false;
      if (!inside(x, z)) { const cands = [[nearestOn(outer, x, z), 'edge'], ...cut.map((H) => [nearestOn(H, x, z), 'eye'])].sort(([A], [B]) => (A[0] - x) ** 2 + (A[1] - z) ** 2 - ((B[0] - x) ** 2 + (B[1] - z) ** 2)); [x, z] = cands[0][0]; edge = cands[0][1] === 'edge'; eye = !edge; }
      else for (const H of covered) { const q = nearestOn(H, x, z); if (Math.hypot(q[0] - x, q[1] - z) < 0.5 * cell) { [x, z] = q; eye = true; break; } }
      used.set(kk, { x, z, edge, eye }); } return kk; };
  for (const kk of keep) { const [i, j] = kk.split(',').map(Number); uv(i, j); uv(i + 1, j); uv(i + 1, j + 1); uv(i, j + 1); }
  // the cast depth, smoothed twice over the grid's neighbours and never below the cast (the mask lies on the face's peaks)
  let r = new Map([...used].map(([kk, q]) => [kk, castAt(q.x, q.z)]));
  const miss = [...r.values()].filter((v) => v === null).length; if (miss > r.size / 2) return [];
  const fallback = Math.max(...[...r.values()].filter((v) => v !== null)); for (const [kk, v] of r) if (v === null) r.set(kk, fallback);
  for (let pass = 0; pass < 2; pass++) { const n = new Map(); for (const [kk, v] of r) { const [i, j] = kk.split(',').map(Number), nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => r.get(`${i + a},${j + b}`)).filter((x) => x !== undefined); n.set(kk, Math.max(v, (2 * v + nb.reduce((a, x) => a + x, 0)) / (2 + nb.length))); } r = n; }
  // RELIEF on the outer face (m, by the corner's place in the eyes' frame): a raised RIM along the outline (`rim` { w, h }),
  // a RIDGE down the middle (`ridge` { w, h }: a crest over the bridge), each eased to nothing at its width; the SEAMS
  // (`seams`: words or polylines) pressed in a hair
  const seams = (S.seams || []).flatMap((x) => (typeof x === 'string' ? SEAM_WORDS[x] ?? [] : [x])), sw = S.seamW ?? 0.045;
  const ease = (t) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
  // a covered eye (a lens, or no eyes at all) DOMED over the eye, `eyes.dome` (m) at its middle, eased out past its outline,
  // so the eyeball and its lids under the cast stay under it
  const dome = treat === 'open' ? 0 : S.eyes?.dome ?? 0.006, domeAt = (x, z) => (dome ? dome * Math.max(...holes.map((H) => (pip(H, x, z) ? 1 : ease(1 - ringDist(x, z, H) / 0.3)))) : 0);
  const relief = (x, z) => domeAt(x, z) + (S.rim ? (S.rim.h ?? 0.0015) * ease(1 - ringDist(x, z, outer) / (S.rim.w ?? 0.14)) : 0) + (S.ridge ? (S.ridge.h ?? 0.002) * ease(1 - Math.abs(x) / (S.ridge.w ?? 0.25)) * (pip(outer, x, z) ? 1 : 0) : 0)
    - (seams.some((L) => segDist(x, z, L) < sw) ? 0.0006 : 0);
  const lift = S.lift ?? 0.0025, th = S.thick ?? 0.003, pts = {}, at = (kk, off) => { const q = used.get(kk), dir = dirAt(q.x); return [ax[0] + dir[0] * (r.get(kk) + off), ax[1] + dir[1] * (r.get(kk) + off), c0[2] + q.z * d]; };
  for (const [kk, q] of used) { pts[`o${kk}`] = at(kk, lift + th + relief(q.x, q.z)); pts[`i${kk}`] = at(kk, lift); }
  // each outer face's GROUP by its cell's middle: a lens cover's (`eyes.treat: 'lens'`, `eyes.group`), a seam's (`seamGroup`),
  // the rim's (`rim.group`), else the mask's; the inside and the walls the mask's
  // (by each triangle: its middle inside a covered eye, a lens; on a seam, the seam; two corners on the outline, the rim's
  // strip along the edge)
  const G = S.group, gOf = (T) => { const Q = T.map((k) => used.get(k)), x = (Q[0].x + Q[1].x + Q[2].x) / 3, z = (Q[0].z + Q[1].z + Q[2].z) / 3;
    if (treat === 'lens' && holes.some((H) => pip(H, x, z))) return S.eyes.group ?? 'Lens';
    if (seams.length && S.seamGroup && seams.some((L) => segDist(x, z, L) < sw)) return S.seamGroup;
    if (S.rim?.group && Q.filter((q) => q.edge).length >= 2) return S.rim.group;
    return G; };
  const faces = [], fg = [], edges = new Map();
  for (const kk of keep) { const [i, j] = kk.split(',').map(Number), C = [`${i},${j}`, `${i + 1},${j}`, `${i + 1},${j + 1}`, `${i},${j + 1}`];
    faces.push([`o${C[0]}`, `o${C[1]}`, `o${C[2]}`], [`o${C[0]}`, `o${C[2]}`, `o${C[3]}`], [`i${C[2]}`, `i${C[1]}`, `i${C[0]}`], [`i${C[3]}`, `i${C[2]}`, `i${C[0]}`]); fg.push(gOf([C[0], C[1], C[2]]), gOf([C[0], C[2], C[3]]), G, G);
    for (let e = 0; e < 4; e++) { const a = C[e], b = C[(e + 1) % 4], key = a < b ? `${a}|${b}` : `${b}|${a}`; const E = edges.get(key); if (E) E.n++; else edges.set(key, { a, b, n: 1 }); } }
  for (const { a, b, n } of edges.values()) if (n === 1) { faces.push([`o${b}`, `o${a}`, `i${a}`], [`o${b}`, `i${a}`, `i${b}`]); fg.push(S.rim?.group ?? G, S.rim?.group ?? G); }
  // wound outward: the outer face of the first cell faces away from the axis, else every face turned
  const f0 = faces[0].map((k) => pts[k]), nrm = cross(sub(f0[1], f0[0]), sub(f0[2], f0[0])), out0 = sub(f0[0], [ax[0], ax[1], f0[0][2]]);
  return [{ points: Object.fromEntries(Object.entries(pts).map(([k, p]) => [k, p.map((v) => Math.round(v * 1e6) / 1e6)])), faces: dot(nrm, out0) < 0 ? faces.map((f) => [...f].reverse()) : faces, ...(fg.some((g) => g !== G) ? { faceGroups: fg } : {}), group: G }];
}

export const SIGNATURES = {
  /** a disc on the shell's outer skin: { r, h, m?, rim? } at a grid point */
  boss: (fig, g, _b, S) => { const [k, j] = gridAt(g, S, S.side); return disc(g.outer[k][j], g.F[k][j].normal, S.r, S.h, S.m ?? 12, S.rim ?? 0.55); },
  /** a horn standing out of the shell, raised toward +z by `rise`: { len: [3], r: [3], rise, sink?, m? } */
  spike: (fig, g, _b, S) => { const [k, j] = gridAt(g, { k: 'mid', j: -2, ...S }, S.side); const p = g.outer[k][j], n = g.F[k][j].normal; const up = unit(add(n, [0, 0, S.rise ?? 1.2]));
    return sweep([sub(p, mul(n, S.sink ?? 0.01)), ...S.len.map((l) => add(p, mul(up, l)))], S.r, S.m ?? 6); },
  /** a rectangular frame of four bars, upright on the shell: { w, h, bar, standoff? } */
  buckle: (fig, g, _b, S) => { let p, n, up;
    if (g.pts) { const i = Math.floor(g.pts.length / 2) + (S.shift ?? 0); p = g.pts[i]; n = g.ns[i]; const d = sub(g.pts[Math.min(i + 1, g.pts.length - 1)], g.pts[Math.max(i - 1, 0)]); up = unit(sub(d, mul(n, dot(d, n)))); }   // on a strap: upright along it
    // on a shell the buckle sits on the belt's own station (the band's middle, or `j`) at the row whose frame faces the
    // body's FRONT across the plan (the waist's centre line, by the skin, not by grid row zero, which turns with the
    // ring's own origin; and never the lowest row, which on a pelvis juts forward at the pubis); a seat named by row,
    // parameter or `after` wins, and the plate stands upright: the skin's lean up or down is not its facing
    else if (S.k === undefined && S.t === undefined && S.after === undefined) {
      const K = g.outer.length, J = g.outer[0].length, j = S.j === undefined ? Math.floor(J / 2) : S.j < 0 ? J + S.j : S.j, want = unit(S.dir ?? [0, 1, 0]);
      let k = 0, best = -Infinity;
      for (let r = 0; r < K; r++) { const m = g.F[r][j].normal, flat = unit([m[0], m[1], 0]); const score = flat ? dot(flat, want) : -Infinity; if (score > best) { best = score; k = r; } }
      p = g.outer[k][j]; const m = g.F[k][j].normal; n = unit([m[0], m[1], 0]) ?? m; up = [0, 0, 1];
    }
    else { const [k, j] = gridAt(g, { k: 0, j: 1, ...S }, S.side); p = g.outer[k][j]; n = g.F[k][j].normal; up = [0, 0, 1]; }
    const lat = unit(cross(up, n)); const W = S.w, Hh = S.h;
    const path = [[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh]].flatMap(([a, b], i, arr) => { const [c, d] = arr[(i + 1) % 4]; return [0, 0.5].map((u) => [lerp(a, c, u), lerp(b, d, u)]); });
    return ringLoft(path.map(([a, b], i) => { const q = add(add(add(p, mul(lat, a)), mul(up, b)), mul(n, S.standoff ?? 0.01)); const nx = path[(i + 1) % path.length], pv = path[(i - 1 + path.length) % path.length]; const tan = unit(add(mul(lat, nx[0] - pv[0]), mul(up, nx[1] - pv[1]))); return ringAt(q, tan, S.bar, 4, Math.PI / 4); })); },
  /** a torus on a strap's path, tipped by `lean`: { R, r, lean?, standoff?, m?, rm? } */
  ring: (fig, g, _b, S) => { const i = Math.floor(g.pts.length / 2) - 1 + (S.shift ?? 0); const c = g.pts[i]; const n = unit(sub(c, [0, 0, c[2]])); const f = unit(add(n, S.lean ?? [0, 0.4, 0])); const m = S.m ?? 14;
    return ringLoft(Array.from({ length: m }, (_, k) => { const a = 2 * Math.PI * k / m; const u = unit(cross(f, [0, 0, 1])), v = cross(f, u); const q = add(add(c, mul(f, S.standoff ?? 0.02)), add(mul(u, dmath.cos(a) * S.R), mul(v, dmath.sin(a) * S.R))); return ringAt(q, unit(add(mul(u, -dmath.sin(a)), mul(v, dmath.cos(a)))), S.r, S.rm ?? 6); })); },
  /** a disc hanging on a chain in front of `surfaces`: { links, len, clear, link, drop, dropClear, face, r, h, m?, rim?, anchor?, out?, surfaces } */
  medallion: (fig, g, beneath, S) => { const [k, j] = gridAt(g, { k: 0, j: 0, ...S }, S.side); const a = g.outer[k][j]; const surfaces = (S.surfaces || []).map((n) => fig.mesh.parts[n]); const out = S.out ?? [0, 1, 0];
    const { P, meshes } = hang(beneath, add(a, S.anchor ?? [0, 0.01, -0.01]), { links: S.links, len: S.len, clear: S.clear, r: S.link, surfaces, out, ...(S.linkSides ? { sides: S.linkSides } : {}) }); const c = clearOf(add(P[P.length - 1], [0, 0, -S.drop]), surfaces, out, S.dropClear);
    return { links: meshes, element: disc(c, unit(S.face ?? [0, 1, 0.15]), S.r, S.h, S.m ?? 14, S.rim ?? 0.6) }; },
  /** RIBBONS from one grid point, tessellated as the anime hair's sections are (ribbonMesh): { spine: [[x,y,z]…] (x scaled
   * by each `spread`), spread?, width, thick, cols?, rows?, taper?, ridge?, flute?, twist?, tip?: 'square' | 'point' |
   * 'swallow', notch?, across? } — a bow's tails, a streamer, a hair ribbon */
  // `drape: { len, links?, clear?, apart? }` LAYS each ribbon over what lies beneath it instead of along `spine`: a chain
  // falling from the grid point, each link pushed out along the knot's outward direction (level) until it stands `clear`
  // off everything beneath within a hand's breadth of it, its links kept their length: a tail down a seat, over a bust
  ribbon: (fig, g, beneath, S) => { const [k, j] = gridAt(g, { k: 0, j: 2, ...S }, S.side); const p = g.outer[k][j];
    const lay = (a, D) => { const n = D.links ?? 6, len = D.len / n, clear = D.clear ?? 0.02, nf = g.F[k][j].normal, out = unit([nf[0], nf[1], 0]);
      let P = Array.from({ length: n + 1 }, (_, i) => add(a, [0, 0, -len * i]));
      for (let it = 0; it < 10; it++) {
        for (let i = 1; i <= n; i++) { let h = -Infinity; for (const v of beneath) { const d = sub(v, P[i]), up = dot(d, out); if (up <= h) continue; if (dmath.hypot(...sub(d, mul(out, up))) < 0.05) h = up; }
          if (h > -clear) P[i] = add(P[i], mul(out, h + clear)); }
        for (let i = 1; i <= n; i++) { const d = sub(P[i], P[i - 1]), l = dmath.hypot(...d) || 1; P[i] = add(P[i - 1], mul(d, len / l)); } }
      return P; };
    const spineOf = (x) => (S.drape ? lay(add(p, [x * (S.drape.apart ?? 0.012), 0, 0]), S.drape) : S.spine.map(([a, b, c]) => add(p, [a * x, b, c])));
    return (S.spread ?? [1]).map((x) => ({ ...ribbonMesh(spineOf(x), { ...S, across: S.across ? [S.across[0] * x, S.across[1], S.across[2]] : null }), root: p.map((v) => +v.toFixed(6)) })); },
  /** a fan of flattened sweeps from one grid point: { spine: [[x,y,z]…] (x scaled by each `spread`), spread, r, m?, squash? } */
  plume: (fig, g, _b, S) => { const [k, j] = gridAt(g, { k: 0, j: 2, ...S }, S.side); const p = g.outer[k][j];
    return S.spread.map((x) => sweep(S.spine.map(([a, b, c]) => add(p, [a * x, b, c])), S.r, S.m ?? 6, { squash: S.squash ?? [1, 0.45] })); },
  /** a bell on a short chain from the shell's rim: { after, side, links, len, clear, link, profile, r, top, step, m?, capTop, capBottom } */
  bell: (fig, g, beneath, S) => { const [k] = gridAt(g, S, S.side); const a = g.outer[k][g.S.length - 1]; const { P, meshes } = hang(beneath, a, { links: S.links, len: S.len, clear: S.clear, r: S.link, ...(S.linkSides ? { sides: S.linkSides } : {}) }); const e = P[P.length - 1];
    return { links: meshes, element: loftParts(S.profile.map((q, i) => ringAt(add(e, [0, 0, -S.top - S.step * i]), [0, 0, 1], S.r * q, S.m ?? 10)), add(e, [0, 0, -S.capTop]), add(e, [0, 0, -S.capBottom])) }; },
  /** a disc set on the LIFTED outer skin where it faces `dir` (the eye's direction; x mirrors on the L side): { dir, r, h,
   * m?, rim? }. A shell's frame normal is its carrier's, so on a cap lifted over the arm every address still faces up;
   * the outer skin's own normal knows better (fantasy armour: the focal boss that hid on the crown). */
  facing: (fig, g, _b, S) => { const { c, n } = g.pts ? seatOf(g, S) : facePoint(g, S.dir, S.side); return disc(c, n, S.r, S.h, S.m ?? 14, S.rim ?? 0.5); },
  /** flat BOARDS hung from the shell's bottom edge (`bottom`: 'j0' | 'jN', the window end they hang from), a shell
   * following its carrier can never be flat (lamellar sode, kusazuri): { n, len, thick, tilt, stand?, dm?, bow?, widen?,
   * wide?, cords?, cordR?, cordGroup? }. Row i hangs `len/n` lower and `dm·i` further out, its bottom edge `tilt` out
   * (the sawtooth); `bow` curves a row across its width, `widen` grows lower rows, `wide` scales the edge's span. With
   * `cords`, lacing columns ride each row's outer face in their own group (`cordGroup`). */
  boards: (fig, g, _b, S) => { const O = g.outer, K = O.length, J = O[0].length, jb = S.bottom === 'j0' ? 0 : J - 1, mid = Math.floor(K / 2);
    const front = O[0][jb], back = O[K - 1][jb], n0 = unit(g.F[mid][jb].normal), along = unit(sub(back, front));
    let down = unit(cross(along, n0)); if (down[2] > 0) down = mul(down, -1); let N = unit(cross(down, along)); if (dot(N, n0) < 0) N = mul(N, -1);
    const c = add(O[mid][jb], mul(N, S.stand ?? 0)), W0 = dmath.hypot(...sub(back, front)) * (S.wide ?? 1), step = S.len / S.n, h = step * 1.3, out = [];
    for (let i = 0; i < S.n; i++) { const W = W0 * (1 + (S.widen ?? 0) * i) / 2, top = add(c, add(mul(down, i * step), mul(N, (S.dm ?? 0) * i)));
      const at = (u, lift) => add(top, add(mul(along, u * W), mul(N, -(S.bow ?? 0) * u * u + lift)));
      const sec = Array.from({ length: 9 }, (_, q) => { const o = at(-1 + q / 4, 0), b = add(o, add(mul(down, h), mul(N, S.tilt))); return [o, add(o, mul(N, S.thick)), add(b, mul(N, S.thick)), b]; });
      out.push(loftParts(sec, sub(mean([sec[0][0], sec[0][2]]), mul(along, 0.001)), add(mean([sec[8][0], sec[8][2]]), mul(along, 0.001))));
      for (let q = 0; q < (S.cords ?? 0); q++) { const base = at(-0.8 + 1.6 * (q + 0.5) / S.cords, S.thick * 1.15);
        const spine = [0.08, 0.5, 0.92].map((f) => add(base, add(mul(down, h * f), mul(N, S.tilt * f))));
        out.push({ ...sweep(spine, spine.map(() => S.cordR), 6, { squash: [1, 0.4] }), ...(S.cordGroup ? { group: S.cordGroup } : {}) }); } }
    return out; },
  /** a CREST rising from the shell's front edge (grid row 0 at its last station): { shape: 'crescent' | 'kuwagata' | 'sun',
   * w, z, r, minR? } — a crescent moon lying horns-up, a pair of horns in a V, or a sun disc facing forward */
  crest: (fig, g, _b, S) => { const c = g.outer[0][g.outer[0].length - 1]; const base = [0, c[1] + S.r * 0.9, c[2] + S.r * 0.7], N = 17, minR = S.minR ?? 0.002;
    const arc = (f) => Array.from({ length: N }, (_, i) => f(i / (N - 1))), flat = { squash: [1, 0.22] };
    if (S.shape === 'crescent') { const P = arc((u) => { const a = (u - 0.5) * 2.3; return [base[0] + S.w * dmath.sin(a), base[1], base[2] + S.z + S.w * 0.55 * (1 - dmath.cos(a))]; });
      return sweep(P, P.map((_, i) => Math.max(minR, S.r * dmath.pow(dmath.sin(Math.PI * (0.06 + 0.88 * i / (N - 1))), 0.8))), 10, flat); }
    if (S.shape === 'kuwagata') return [1, -1].map((sd) => { const P = arc((u) => [base[0] + sd * (S.r + S.w * 0.55 * dmath.pow(u, 1.3)), base[1] + S.r * 1.5 * u, base[2] + S.r * 0.7 + S.z * 3.2 * u]);
      return sweep(P, P.map((_, i) => Math.max(minR, S.r * 0.8 * (1 - 0.7 * i / (N - 1)))), 10, flat); });
    return disc([base[0], base[1] + S.r * 0.4, base[2] + S.z * 1.6], [0, 1, 0.12], S.w * 0.28, Math.max(minR, S.r * 0.55), 20, 0.85); },
  /** a smooth HELM round the head, sized from the head's own measured bounds (`parts`, default cranium + jaw): a shell
   * over the cranium would copy the face's topology (its ring carries nose and brow slots). Rings from below the jaw to
   * over the crown, a superellipse of exponent `n` (2 round … 4 boxy), `pad` off the head, `drop` below the chin,
   * `flare` at the bottom edge, `muzzle` forward at the mouth, `crown` (0 flat … 1 domed). The face is elements in their
   * own groups: `visor` 't' (a T of flat bars) | 'lenses' (two discs) | 'slits' (two eye slits) | 'band' (a band across
   * the eyes), `grille` (bars at the mouth), each `{ group }`. { pad, drop?, flare?, muzzle?, crown?, n?, visor?,
   * visorGroup?, lens?, grille?, grilleGroup?, eye?, m? } */
  helm: (fig, _g, _b, S) => {
    const P = (S.parts || ['cranium', 'jaw']).flatMap((n) => Object.values(fig.mesh.parts[n]?.points || {}));
    const lo = [0, 1, 2].map((i) => Math.min(...P.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...P.map((p) => p[i])));
    let cy = (lo[1] + hi[1]) / 2, zB = lo[2] - (S.drop ?? 0.02), zT = hi[2] + S.pad * 0.8, rx0 = (hi[0] - lo[0]) / 2 + S.pad, ry0 = (hi[1] - lo[1]) / 2 + S.pad;
    // `scale` grows the whole helm about its own centre (the window, ears and gem ride it: they are placed in helm heights)
    if (S.scale) { const k = S.scale, zc = (zB + zT) / 2; rx0 *= k; ry0 *= k; zB = zc + (zB - zc) * k; zT = zc + (zT - zc) * k; }
    const n = S.n ?? 2.4, m = S.m ?? 28, se = (v) => Math.sign(v) * dmath.pow(Math.abs(v), 2 / n), zEye = lo[2] + (S.eye ?? 0.55) * (hi[2] - lo[2]);
    const shape = (u) => { const top = u > 0.55 ? Math.sqrt(Math.max(0.02, 1 - ((u - 0.55) / 0.45) ** 2 * (S.crown ?? 0.9))) : 1; return top * (1 + (S.flare ?? 0) * dmath.pow(1 - u, 3)); };
    const mz = (u) => (S.muzzle ?? 0) * dmath.exp(-(((u - 0.22) / 0.14) ** 2));
    const at = (u, th, off = 0) => { const k = shape(u), c = dmath.cos(th), sn = dmath.sin(th); const rx = rx0 * k + off, ry = ry0 * k + off + (sn > 0 ? mz(u) * dmath.pow(sn, 4) : 0);
      return [rx * se(c), cy + ry * se(sn), zB + u * (zT - zB)]; };
    const uOf = (z) => (z - zB) / (zT - zB), uE = uOf(zEye), F = Math.PI / 2;
    const out = []; let shellOff = () => 0;   // the window horseshoe's own offset (jaw curl, back tuck), for trim that rides it
    if (!S.window) { const U = Array.from({ length: 14 }, (_, i) => i / 13); out.push(loftParts(U.map((u) => Array.from({ length: m }, (_, q) => at(u, 2 * Math.PI * q / m))), [0, cy, zB - 0.002], [0, cy, zT + 0.002])); }
    else {   // a FACE WINDOW (the hero robot's open helmet: the face shows, the helm wraps the crown, the temples and the
      // cheeks): a closed dome from the window's top edge `brow` (above the eye line, in helm heights) over the crown, and
      // below it a thick horseshoe round the back, open `w` radians either side of the front, down to `bottom`
      const W = S.window, uT = Math.min(0.9, uE + (W.brow ?? 0.12)), uB = W.bottom ?? 0.12, hw = W.w ?? 0.95, th = W.thick ?? Math.max(0.004, S.pad * 0.5);
      const Uc = Array.from({ length: 9 }, (_, i) => uT + (1 - uT) * i / 8);
      out.push(loftParts(Uc.map((u) => Array.from({ length: m }, (_, q) => at(u, 2 * Math.PI * q / m))), [0, cy, zB + uT * (zT - zB)], [0, cy, zT + 0.002]));
      const Uh = Array.from({ length: 7 }, (_, i) => uB + (uT - uB) * i / 6), arcN = m;
      // `nape` drops the bottom edge toward the back (in helm heights), so the helm reaches down over the nape; `jaw`
      // { drop, curl } brings the CHEEK GUARDS down at the window's sides (`drop` helm heights, fading round to the
      // back) and curls them in under the jaw (`curl`: a share of the helm's half-width, growing below the jaw line)
      const J = W.jaw, front = (a) => dmath.pow(Math.max(0, dmath.sin(a)), 1.2);
      const ub = (a) => uB - (W.nape ?? 0) * dmath.pow(Math.max(0, -dmath.sin(a)), 1.5) - (J ? (J.drop ?? 0.12) * front(a) : 0), uh = (i, a) => ub(a) + (uT - ub(a)) * i / 6;
      // `back` { tuck } rounds the back in profile: below the eye line the shell turns in toward the nape (a share of the
      // helm's half-width, growing as the square toward the bottom edge, strongest straight behind), so the side view
      // closes as a circle instead of dropping as a wall
      const B = W.back, behind = (a) => Math.max(0, -dmath.sin(a)), uNape = uB - (W.nape ?? 0);
      const curl = (u, a) => { let o = 0;
        if (J && u < uB + 0.12) { const q = Math.min(1, (uB + 0.12 - u) / (0.12 + (J.drop ?? 0.12))); o -= (J.curl ?? 0.25) * rx0 * q * q * front(a); }
        if (B && u < uE) { const q = Math.min(1, (uE - u) / Math.max(1e-6, uE - uNape)); o -= (B.tuck ?? 0.3) * rx0 * q * q * behind(a); }
        // `hug` rounds the whole lower helm in toward the face and jaw, sides and back (a share of the half-width at the
        // bottom edge, growing as a circle's sag below the eye line), so the shell closes like an egg instead of a bucket
        if (W.hug && u < uE) { const q = Math.min(1, (uE - u) / Math.max(1e-6, uE - uB)); o -= W.hug * rx0 * (1 - Math.sqrt(Math.max(0, 1 - q * q))) * (1 - front(a)); }
        return o; };
      shellOff = curl;
      // `jaw.wrap` (radians) closes the window over the guard's lowest rows, so the guards come forward toward the chin
      const hwAt = (i) => hw - (J?.wrap ?? 0) * dmath.pow(Math.max(0, (2 - i) / 2), 1.5);
      const arcAt = (i) => Array.from({ length: arcN + 1 }, (_, q) => F + hwAt(i) + (2 * Math.PI - 2 * hwAt(i)) * q / arcN);
      out.push(loftParts(Uh.map((_, i) => { const Ai = arcAt(i); return [...Ai.map((a) => at(uh(i, a), a, curl(uh(i, a), a))), ...[...Ai].reverse().map((a) => at(uh(i, a), a, curl(uh(i, a), a) - th))]; }), [0, cy, zB + uB * (zT - zB) - 0.001], [0, cy, zB + uT * (zT - zB)]));
    }
    // a flat bar lying on the helm's skin along (u, θ) samples, `w` wide across it, standing `t` proud
    const lift = S.faceplate ? 0.007 : 0.001;   // over a faceplate the visor stands on it, never buried beneath
    // `surf`: stand it along the helm's true surface normal (from its u and θ tangents) instead of the horizontal offset —
    // for a bar crossing the crown, where the skin faces up
    const zMid = (zB + zT) / 2;
    const surfN = (u, th, base) => { const e = 1e-3, n0 = unit(cross(sub(at(u, th + e, base), at(u, th - e, base)), sub(at(u + e, th, base), at(u - e, th, base)))), p = at(u, th, base);
      return dot(n0, sub(p, [0, cy, zMid])) < 0 ? mul(n0, -1) : n0; };
    const bar = (pts, w, t, group, base0 = lift, offOf = null, surf = false) => { const secs = pts.map(([u, th], i) => { const base = base0 + (offOf ? offOf(u, th) : 0), p = at(u, th, base), out = surf ? surfN(u, th, base) : unit(sub(at(u, th, base + 0.01), p));
      const [u2, th2] = pts[Math.min(i + 1, pts.length - 1)], [u1, th1] = pts[Math.max(i - 1, 0)]; const along = unit(sub(at(u2, th2), at(u1, th1))); const across = unit(cross(out, along));
      return [add(p, mul(across, -w / 2)), add(p, mul(across, w / 2)), add(add(p, mul(across, w / 2)), mul(out, t)), add(add(p, mul(across, -w / 2)), mul(out, t))]; });
      return { ...loftParts(secs, mean(secs[0]), mean(secs[secs.length - 1])), group }; };
    const arc = (u, a0, a1, k = 9) => Array.from({ length: k }, (_, i) => [u, a0 + (a1 - a0) * i / (k - 1)]);
    const w = (hi[2] - lo[2]), vg = S.visorGroup ?? S.group;
    if (S.visor === 't') { out.push(bar(arc(uE, F - 0.75, F + 0.75), w * 0.1, 0.004, vg), bar(Array.from({ length: 6 }, (_, i) => [uE - i * (uE - 0.12) / 5, F]), w * 0.085, 0.004, vg)); }
    if (S.visor === 'band') out.push(bar(arc(uE, F - 0.9, F + 0.9), w * 0.11, 0.004, vg));
    if (S.visor === 'lenses') for (const sd of [1, -1]) { const th = F - sd * 0.42, c = at(uE, th, 0.002), nrm = unit(sub(at(uE, th, 0.02), c)); out.push({ ...disc(c, unit(add(nrm, [0, 0.35, 0])), S.lens ?? w * 0.075, Math.max(0.003, (S.lens ?? w * 0.075) * 0.35), 16, 0.7), group: vg }); }
    if (S.visor === 'slits') for (const sd of [1, -1]) out.push(bar([[uE + 0.03, F - sd * 0.18], [uE + 0.01, F - sd * 0.42], [uE - 0.02, F - sd * 0.6]], w * 0.045, 0.003, vg));
    if (S.faceplate) {   // a proud front patch (a faceplate) in its own group: arcs across the face, closed through the helm
      const secs = Array.from({ length: 8 }, (_, i) => { const u = 0.08 + i * (0.8 - 0.08) / 7, A = Array.from({ length: 9 }, (_, q) => F - 0.95 + 1.9 * q / 8);
        return [...A.map((th) => at(u, th, 0.005)), ...[...A].reverse().map((th) => at(u, th, -0.002))]; });
      out.push({ ...loftParts(secs, mean(secs[0]), mean(secs[secs.length - 1])), group: S.faceplate }); }
    // the window's top edge as a V (`window.v`): two lines from the window's top corners (where the rim turns) down to an
    // APEX over the bridge of the nose, the plate between them and the brow raised in its own group; `curve` > 1 keeps
    // the V narrow longer near the apex (clear of the eyes). `stripes` carry the two lines on past the corners, up and
    // over the crown to the back edge, as raised bands. { apex?, curve?, raise?, thick?, group, stripes?: { w?, t?, group? } }
    const W = S.window, VP = W?.v, vLift = VP ? (VP.raise ?? 0.004) + (VP.thick ?? 0.002) : 0;
    const uTw = W ? Math.min(0.9, uE + (W.brow ?? 0.12)) : 0, hwW = W?.w ?? 0.95, uAv = VP ? uE - (VP.apex ?? 0.05) : 0, pv = VP?.curve ?? 1.6;
    const vHalf = (u) => hwW * dmath.pow(Math.max(0, Math.min(1, (u - uAv) / (uTw - uAv))), pv);   // the V's half-angle at height u
    const FR = VP?.frame, FG = FR?.gem ?? { corner: [0.1, 0.28], top: 0.22, bottom: 0.09 }, [pRise, dP] = FR?.peak ?? [0.28, 0.56];
    const uP = uTw + pRise, uGc = uTw + FG.corner[0], dG = FG.corner[1], uGt = uTw + FG.top, uGb = uAv + FG.bottom;
    if (VP) { const Q = 10, K = 11;
      const rows = Array.from({ length: Q }, (_, i) => uAv + (uTw - uAv) * dmath.pow(i / (Q - 1), 0.8)).map((u) => { const hv = Math.max(0.012, vHalf(u)), A = Array.from({ length: K }, (_, q) => F - hv + 2 * hv * q / (K - 1));
        return [...A.map((a) => at(u, a, vLift)), ...[...A].reverse().map((a) => at(u, a, -0.002))]; });
      out.push({ ...loftParts(rows, at(uAv - 0.008, F, vLift * 0.5), at(uTw + 0.004, F, vLift * 0.5)), group: VP.group ?? S.group });
      // `frame`: the V plate grown into the visor's whole FRAME in its group: wide CHEEK bands up the window's sides
      // (`cheek` [width at the guard's tip, width at the top corner], radians), tapering to a point at the jaw; a brow band
      // over the V up to the gem's corners; and from there two HORNS rising to points at `peak` [height over the window's
      // top corner, radians from the front], the gem's upper half in the helm's colour between them.
      // { cheek?, peak?, gem?: { corner: [rise, d], top, bottom } (the gem's rhombus in helm heights and radians) }
      if (FR) { const K = 9, gq = VP.group ?? S.group, [c0, c1] = FR.cheek ?? [0.004, 0.2], hw0 = hwW;
        const plate = (U, iv, offOf = () => 0) => U.map((u) => { const [d0, d1] = iv(u), A = Array.from({ length: K }, (_, q) => d0 + (d1 - d0) * q / (K - 1));
          return [...A.map((a) => at(u, a, vLift + offOf(u, a))), ...[...A].reverse().map((a) => at(u, a, -0.002 + offOf(u, a)))]; });
        const fr = dmath.pow(dmath.sin(F + hw0), 1.2), uJb = (W.bottom ?? 0.12) - (W.jaw ? (W.jaw.drop ?? 0.12) * fr : 0);
        const hwC = (u) => hw0 - (W.jaw?.wrap ?? 0) * dmath.pow(Math.max(0, (2 - 6 * (u - uJb) / (uTw - uJb)) / 2), 1.5);
        const outer = (u) => (hw0 + c1) + (dP - hw0 - c1) * (u - uTw) / (uP - uTw), lo = (u) => dG + (dP - 0.004 - dG) * (u - uGc) / (uP - uGc);
        const span = (a0, a1, k) => Array.from({ length: k }, (_, i) => a0 + (a1 - a0) * i / (k - 1));
        for (const sd of [1, -1]) { const A = (d0, d1) => (sd > 0 ? [F + d0, F + d1] : [F - d1, F - d0]);
          const cheek = plate(span(uJb, uTw, 12), (u) => { const q = (u - uJb) / (uTw - uJb), h = hwC(u); return A(h - 0.03, h + c0 + (c1 - c0) * dmath.pow(q, 0.6)); }, shellOff);
          const brow = plate(span(uTw, uGc, 5), (u) => A(0, outer(u))), horn = plate(span(uGc, uP, 7), (u) => A(lo(u), outer(u)));
          for (const R of [cheek, brow, horn]) out.push({ ...loftParts(R, mean(R[0]), mean(R[R.length - 1])), group: gq }); } }
      if (VP.stripes) { const St = VP.stripes, cx = at(uTw, F + hwW)[0];   // the corner's lateral offset: the stripe keeps it over the head
        // the stripe's lateral offset eases in from the corner's to `span` (a share of the helm's half-width) as it rises,
        // and holds there over the crown and down the back; it crosses the crown on the highest ring that still holds it
        const xs = (St.span ?? 0.38) * rx0, uK = uTw + 0.55 * (0.97 - uTw), xAt = (u) => (u >= uK ? xs : Math.abs(cx) + (xs - Math.abs(cx)) * dmath.pow(Math.max(0, (u - uTw) / (uK - uTw)), 0.8));
        let uMax = uTw; for (let i = 0; uTw + i * 0.0025 <= 0.995; i++) { const u = uTw + i * 0.0025; if (0.96 * rx0 * shape(u) >= xAt(u)) uMax = u; }
        // the angle where the section at height u reaches |x| on side `sd`, on the front (sin > 0) or the back
        const thAt = (u, sd, back) => { const c = Math.min(0.96, (back ? xs : xAt(u)) / (rx0 * shape(u))), cs = Math.sign(cx) * sd * dmath.pow(c, n / 2), a = Math.acos(cs); return back ? 2 * Math.PI - a : a; };
        const uEnd = (W.bottom ?? 0.12) - (W.nape ?? 0) + 0.04;
        for (const sd of [1, -1]) { const vEdge = Array.from({ length: 5 }, (_, i) => { const t = i / 4, u = uAv + (uTw - uAv) * t; return [u, F - Math.sign(cx) * sd * vHalf(u)]; });   // the V's edge on the stripe's own side
          const up = Array.from({ length: 10 }, (_, i) => { const u = uTw + (uMax - uTw) * (i + 1) / 10; return [u, thAt(u, sd, false)]; });
          // across the crown the short way round its ring, through the side
          const a0 = thAt(uMax, sd, false), a1 = a0 < Math.PI / 2 ? -a0 : 2 * Math.PI - a0, over = Array.from({ length: 7 }, (_, i) => [uMax, a0 + (a1 - a0) * (i + 1) / 8]);
          const down = Array.from({ length: 12 }, (_, i) => { const u = uMax - (uMax - uEnd) * i / 11; return [u, thAt(u, sd, true)]; });
          out.push(bar([...vEdge, ...up, ...over, ...down], St.w ?? w * 0.075, St.t ?? 0.004, St.group ?? VP.group ?? S.group, vLift * 0.5, (u, th) => (u < uTw && dmath.sin(th) < 0 ? shellOff(u, th) : 0), true)); } } }
    // the window's RIM: a proud bar round its edge in its own group (the helmet's trim line), up the sides to the window's
    // top corners and across the top (under a V, the plate is the top edge): { group, w?, t? }
    if (W?.rim) { const uT = uTw, hw = hwW, n = 7;
      // the rim follows the cheek guard's own edge: down to its dropped bottom, curled in with it
      const fr = dmath.pow(dmath.sin(F + hw), 1.2), uB = (W.bottom ?? 0.12) - (W.jaw ? (W.jaw.drop ?? 0.12) * fr : 0), uC = (W.bottom ?? 0.12) + 0.12;
      const cOf = (u) => (W.jaw && u < uC ? -(W.jaw.curl ?? 0.25) * rx0 * Math.min(1, (uC - u) / (0.12 + (W.jaw.drop ?? 0.12))) ** 2 * fr : 0);
      // the rim's sides on the horseshoe's own rows (7 of them), each at that row's window half-angle (jaw.wrap)
      const hwAt = (i) => hw - (W.jaw?.wrap ?? 0) * dmath.pow(Math.max(0, (2 - i) / 2), 1.5);
      const side = (sd) => Array.from({ length: n }, (_, i) => [uB + (uT - uB) * i / (n - 1), F + sd * hwAt(i)]), top = Array.from({ length: 9 }, (_, i) => [uT, F + hw - 2 * hw * i / 8]);
      const rw = W.rim.w ?? w * 0.05, rt = W.rim.t ?? 0.003, rg = W.rim.group ?? S.group;
      if (VP) { if (!FR) for (const sd of [1, -1]) out.push(bar(side(sd), rw, rt, rg, 0, cOf)); }
      else out.push(bar([...side(1), ...top.slice(1, -1), ...[...side(-1)].reverse()], rw, rt, rg, 0, cOf)); }
    // EARS: a dome on each side of the helm at the ear (the hero robot's ear pods): { r, h, u?, group, cap?: { r, group } }
    if (S.ears) { const E = S.ears, ue = E.u ?? uE - 0.08;
      for (const a of [0, Math.PI]) { const so = W?.hug ? shellOff(ue, a) : 0, c = at(ue, a, so), nrm = unit(sub(at(ue, a, so + 0.02), c)), r = E.r ?? w * 0.16, h = E.h ?? r * 0.45;
        out.push({ ...disc(add(c, mul(nrm, -0.002)), nrm, r, h, 20, 0.82), group: E.group ?? S.group });
        if (E.cap) out.push({ ...disc(add(c, mul(nrm, h * 0.95)), nrm, E.cap.r ?? r * 0.55, h * 0.35, 16, 0.75), group: E.cap.group ?? S.group }); } }
    // HORNS: a pair of tapering blades rooted on the helm at height `u` and `a` radians either side of the front, leaning
    // `out` along the skin's normal, `up` and `back`, bending up by `bend`: { u, a, len, r, out?, up?, back?, bend?,
    // squash?, group }
    if (S.horns) { const H = S.horns;
      for (const sd of [1, -1]) { const th = F - sd * (H.a ?? 1.2), root = at(H.u, th, -0.003), n0 = surfN(H.u, th, 0);
        const d = unit(add(add(mul(n0, H.out ?? 0.6), [0, 0, H.up ?? 1]), [0, -(H.back ?? 0.6), 0])), K = 6;
        const spine = Array.from({ length: K }, (_, i) => { const t = i / (K - 1); return add(add(root, mul(d, H.len * t)), [0, 0, (H.bend ?? 0) * H.len * t * t]); });
        out.push({ ...sweep(spine, spine.slice(0, -1).map((_, i) => Math.max(0.0008, H.r * dmath.pow(1 - i / (K - 1), 0.9))), 6, { squash: H.squash ?? [1, 0.45] }), group: H.group ?? S.group }); } }
    // a PONYTAIL out of the helm's back: `n` flattened, tapering clumps from a tie at height `u` (behind), falling `len`
    // down and `back` behind, fanning `spread` (of len) toward the tips; `wild` scatters each clump's direction, length and
    // flick by a fixed pattern (no dice), so the tail reads as wild hair: { u, len, r, n?, spread?, back?, wild?, flick?,
    // group, tie?: { group, r? } }
    if (S.ponytail) { const T = S.ponytail, nC = T.n ?? 9, root = at(T.u, -Math.PI / 2, 0.004), bk = [0, -1, 0], len = T.len;
      const hsh = (i, k) => { const x = dmath.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
      if (T.tie) out.push({ ...disc(add(root, mul(bk, -0.004)), unit(add(bk, [0, 0, -0.35])), T.tie.r ?? T.r * 1.4, T.r * 0.9, 10, 0.6), group: T.tie.group ?? S.group });
      for (let i = 0; i < nC; i++) { const ph = i * 2.39996, w = T.wild ?? 0.5, L = len * (1 - 0.3 * w * hsh(i, 1)), sp = (T.spread ?? 0.35) * (0.5 + hsh(i, 2));
        const side = add(mul([1, 0, 0], dmath.cos(ph)), mul([0, -0.7, 0], dmath.sin(ph))), K = 7;
        const spine = Array.from({ length: K }, (_, j) => { const t = j / (K - 1);
          return add(add(add(root, mul(bk, L * (T.back ?? 0.3) * dmath.pow(Math.min(1, t * 2.2), 0.6))), [0, 0, -L * dmath.pow(t, 1.25)]),
            add(mul(side, sp * L * dmath.pow(t, 0.9)), [0, -(T.flick ?? 0.12) * L * w * hsh(i, 3) * t * t * t, 0])); });
        out.push({ ...sweep(spine, spine.slice(0, -1).map((_, j) => Math.max(0.0008, T.r * (0.7 + 0.5 * hsh(i, 4)) * dmath.pow(1 - j / (K - 1), 0.85))), 5, { squash: [1, 0.45] }), group: T.group ?? 'Hair' }); } }
    // a GEM on the brow, centred over the window (the forehead jewel): { r, h?, u?, group, setting?: { group, w? }, shape?:
    // 'diamond' (a faceted rhombus, `tall`/`wide` its half-extents in r, on a rhombus plate `w` wider: the border) }
    if (S.gem) { const G = S.gem, ug = G.u ?? (VP ? uTw - 0.3 * (uTw - uAv) : Math.min(0.95, uE + (S.window?.brow ?? 0.12) + 0.07)), c = at(ug, F, vLift), nrm = unit(sub(at(ug, F, 0.02), c)), r = G.r ?? w * 0.07;
      if (G.shape === 'diamond' && FR) {   // the frame's gem: its rhombus in helm heights and radians (FR.gem), set in the frame's notch
        const h = G.h ?? r * 0.75, o0 = G.setting ? r * 0.22 : 0;
        const V = (q, z) => [[uGc + q * (uGt - uGc), 0], [uGc, q * dG], [uGc + q * (uGb - uGc), 0], [uGc, -q * dG]].map(([u, d]) => at(u, F + d, vLift + z));
        if (G.setting) { const bw = 1 + (G.setting.w ?? 0.2); out.push({ ...loftParts([V(bw, 0), V(bw, o0), V(bw * 0.94, o0 + r * 0.08)], at(uGc, F, vLift - 0.001), at(uGc, F, vLift + o0 + r * 0.08)), group: G.setting.group ?? S.group }); }
        out.push({ ...loftParts([V(1, o0), V(1, o0 + h * 0.3), V(0.5, o0 + h)], at(uGc, F, vLift + o0 - 0.001), at(uGc, F, vLift + o0 + h)), group: G.group ?? S.group }); }
      else if (G.shape === 'diamond') {   // a faceted rhombus stone, taller than wide, on a rhombus setting plate (its border)
        let up = sub([0, 0, 1], mul(nrm, nrm[2])); up = unit(up); const lat = unit(cross(up, nrm)), hh = r * (G.tall ?? 1.35), h = G.h ?? r * 0.75;
        let hw = r * (G.wide ?? 0.9), ys = 0, ht = hh;
        // `fit: 'v'`: the stone's lower edges run parallel to the V's lines at its height (`wide` sets where they turn),
        // the top shortened to `top` (in r) above that turn, so the stone sits in the V like a kite
        if (G.fit === 'v' && VP) { const xy = (u) => { const d = sub(at(u, F + vHalf(u), vLift), c); return [Math.abs(dot(d, lat)), dot(d, up)]; };
          const [x1, y1] = xy(ug - 0.04), [x2, y2] = xy(ug), k = (x2 - x1) / (y2 - y1); ys = -hh + hw / k; ht = ys + r * (G.top ?? 0.75); }
        const rh = (o, q, z) => [[0, q * ht], [q * hw, q * ys], [0, -q * hh], [-q * hw, q * ys]].map(([x, y]) => add(add(c, mul(nrm, o + z)), add(mul(lat, x), mul(up, y))));
        const o0 = G.setting ? r * 0.22 : 0;
        if (G.setting) { const bw = 1 + (G.setting.w ?? 0.35); out.push({ ...loftParts([rh(-0.001, bw, 0), rh(-0.001, bw, o0), rh(-0.001, bw * 0.92, o0 + r * 0.08)], add(c, mul(nrm, -0.002)), add(c, mul(nrm, o0 + r * 0.08))), group: G.setting.group ?? S.group }); }
        out.push({ ...loftParts([rh(o0, 1, 0), rh(o0, 1, h * 0.3), rh(o0, 0.5, h)], add(c, mul(nrm, o0 - 0.001)), add(c, mul(nrm, o0 + h))), group: G.group ?? S.group }); }
      else {
      if (G.setting) out.push({ ...disc(add(c, mul(nrm, -0.001)), nrm, r * 1.4, r * 0.3, 16, 0.8), group: G.setting.group ?? S.group });
      out.push({ ...disc(add(c, mul(nrm, G.setting ? r * 0.25 : 0)), nrm, r, G.h ?? r * 0.6, 12, 0.55), group: G.group ?? S.group }); } }
    if (S.grille) for (let i = 0; i < S.grille; i++) { const u = 0.12 + i * 0.05; out.push(bar(arc(u, F - 0.35, F + 0.35, 5), w * 0.025, 0.004, S.grilleGroup ?? S.group)); }
    // a BROW: a proud bar over the eyes that casts the face beneath into shadow ({ group, t? })
    if (S.brow) out.push(bar(arc(Math.min(0.97, uE + 0.075), F - 0.85, F + 0.85), w * 0.07, S.brow.t ?? w * 0.05, S.brow.group ?? S.group));
    // a CORONET: spikes round a band at height `u` (the silhouette verb on the helm's crest line), over `arc` of the
    // circumference centred on the front, or the back with `centre: 'back'` (a halo) (1: all the way round), leaning out `lean` from vertical, lengths by `profile` over q (0 at
    // the front → 1 at the back, or across the arc)
    // ({ count, len, r, u?, arc?, centre?, lean?, profile?, group, band? })
    if (S.coronet) { const C = S.coronet, uc = C.u ?? 0.8, A = C.arc ?? 1, prof = PROFILES[C.profile ?? 'crown'], cg = C.group ?? S.group;
      const F0 = C.centre === 'back' ? F + Math.PI : F, th = (q) => (A >= 1 ? F0 + 2 * Math.PI * q / C.count : F0 - Math.PI * A + 2 * Math.PI * A * (C.count === 1 ? 0.5 : q / (C.count - 1)));
      if (C.band) out.push(bar(Array.from({ length: 29 }, (_, i) => [uc, (A >= 1 ? F0 - Math.PI : F0 - Math.PI * A) + 2 * Math.PI * A * i / 28]), C.band, w * 0.03, cg));
      for (let q = 0; q < C.count; q++) { const t = th(q), p = at(uc, t, 0), o = unit(sub(at(uc, t, 0.02), p)), f = A >= 1 ? Math.abs(dmath.sin((t - F0) / 2)) : (C.count === 1 ? 0.5 : q / (C.count - 1));
        out.push({ ...cone(p, unit(add(mul(o, C.lean ?? 0.35), [0, 0, 1])), C.len * prof(f), C.r, 5), group: cg }); } }
    return out; },
  /** a vented block (a power pack) on the shell's outer skin at its grid centre: { w, h, d, lift?, chamfer?, vents?,
   * ventR?, ventH?, ventGroup? } — `w` across, `h` up, `d` out; vents stand on its top face in their own group */
  pack: (fig, g, _b, S) => { const K = g.outer.length, J = g.outer[0].length, k = Math.floor(K / 2), j = Math.floor(J / 2);
    const c = add(g.outer[k][j], mul(g.F[k][j].normal, S.lift ?? 0)); const nrm = unit(sub(g.F[k][j].normal, mul([0, 0, 1], g.F[k][j].normal[2])));
    const up = [0, 0, 1], lat = unit(cross(up, nrm)), ch = S.chamfer ?? Math.min(S.w, S.h) * 0.15;
    // SOFT: a bag, not a box — a rounded section (a superellipse) pillowed through its depth, sagging wider at the
    // bottom, its flap a sheet over the top and down the front with a turned edge
    if (S.soft) { const n = 20, ex = 2 / (S.round ?? 3.2), sag = S.sag ?? 0.08;
      const sect = (dz, sc) => Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n, ca = dmath.cos(a), sa = dmath.sin(a);
        const x = Math.sign(ca) * Math.abs(ca) ** ex, y = Math.sign(sa) * Math.abs(sa) ** ex;
        return add(add(add(c, mul(lat, x * S.w / 2 * sc * (1 - sag * y))), mul(up, y * S.h / 2 * sc)), mul(nrm, dz)); });
      const D = [0, 0.12, 0.35, 0.65, 0.88, 1].map((f) => [f * S.d, 0.78 + 0.22 * dmath.sin(Math.PI * Math.min(1, f * 1.15))]);
      const bag = loftParts(D.map(([dz, sc]) => sect(dz, sc)), add(c, mul(nrm, -0.002)), add(c, mul(nrm, S.d + 0.002)));
      if (S.flap === false) return [bag];
      const lip = Math.max(0.004, S.d * 0.06), top = add(add(c, mul(up, S.h / 2 + lip)), mul(nrm, S.d * 0.25));
      const spine = [top, add(add(c, mul(up, S.h / 2 + lip)), mul(nrm, S.d * 0.85)), add(add(c, mul(up, S.h / 2 - lip)), mul(nrm, S.d + lip)), add(add(c, mul(up, S.h * (0.5 - (S.flap ?? 0.42)))), mul(nrm, S.d * 0.98 + lip))];
      return [bag, { ...ribbonMesh(spine, { width: S.w * 0.96, thick: lip * 0.6, cols: 7, rows: 10, ridge: 0.6, across: lat }), ...(S.flapGroup ? { group: S.flapGroup } : {}) }]; }
    const rect = (dz, sc) => [[-1, -1 + ch / S.h * 2], [-1 + ch / S.w * 2, -1], [1 - ch / S.w * 2, -1], [1, -1 + ch / S.h * 2], [1, 1 - ch / S.h * 2], [1 - ch / S.w * 2, 1], [-1 + ch / S.w * 2, 1], [-1, 1 - ch / S.h * 2]]
      .map(([a, b]) => add(add(add(c, mul(lat, a * S.w / 2 * sc)), mul(up, b * S.h / 2 * sc)), mul(nrm, dz)));
    const out = [loftParts([rect(0, 0.92), rect(S.d * 0.15, 1), rect(S.d * 0.85, 1), rect(S.d, 0.9)], add(c, mul(nrm, -0.002)), add(c, mul(nrm, S.d + 0.002)))];
    for (let q = 0; q < (S.vents ?? 0); q++) { const b = add(add(add(c, mul(lat, (-0.3 + 0.6 * (S.vents === 1 ? 0.5 : q / (S.vents - 1))) * S.w)), mul(up, S.h / 2 - 0.01)), mul(nrm, S.d * 0.55));
      out.push({ ...sweep([b, add(b, mul(up, S.ventH * 0.5)), add(b, mul(up, S.ventH))], [S.ventR, S.ventR, S.ventR * 1.1], 10), ...(S.ventGroup ? { group: S.ventGroup } : {}) }); }
    return out; },
  /** a CAST mask: a shape cast from the face itself (a domino glued to the skin), not built over the head's bounds. An
   * outline is drawn in the EYES' frame (x across, z up, in half the distance between the eye centres, the eyes at ±1
   * on z 0; the head's `eyeR`/`eyeL` details, else the cranium's eye row), wrapped round the head on a cylinder through
   * its middle; a grid over it (`cell`, units) is cast inward onto the skin (`parts`, default cranium + jaw) and the
   * details riding it (`over`, default the brows and the lids), its depth smoothed but never below the cast, then lifted
   * `lift` (m) and made `thick` (m) deep, its edge closed by a wall. THE MASK BUILDER'S PRIMITIVE: every look is words.
   * `outline`: dials over the domino (CAST_DIALS: `bridge` the foot over the nose, `cheek` the depth under the eyes, `brow`
   * the top over them, `notch` its dip in the middle or `peak` a widow's point rising there, `wing` and `wingRise` the
   * temples' points, `fang` a point down each cheek, `round` 1 curved, 0 angular) | 'band' | { poly, holes? } in the
   * eyes' frame. `eyes` { shape: almond | slit | angular | round, size: [rx, rz], tilt, treat: 'open' (holes) | 'lens'
   * (covers in `group`, default Lens) | 'none' (the mask whole), dome: m a covered eye bulges over the eyeball }. Relief and detail: `rim` { w, h, group? } a raised edge,
   * `ridge` { w, h } a crest down the middle, `seams` words (centre, brow, cheek, temple) or polylines pressed in, in
   * `seamGroup`. Plates are a second cast over the first (a smaller outline, a larger `lift`).
   * { parts?, over?, outline?, eyes?, rim?, ridge?, seams?, seamW?, seamGroup?, lift?, thick?, cell?, eyeAt?, eyeRow? } */
  cast: (fig, _g, _b, S) => castMask(fig, S),
  /** a RESPIRATOR: a cup over the nose and the mouth (the cyberpunk gas mask), sized from the head's own bounds as the helm
   * is (`parts`, default cranium + jaw; `pad` off the head), the head's superellipse section (`n`) spanning `spread`
   * radians either side of the front from `low` (helm heights, 0 under the chin) to `high` (default just under the eye
   * line, `eye`), pushed forward `muzzle` at the mouth line, `thick` deep. `filters` { count: 1 | 2, r?, h?, a?, group }:
   * canister discs on its sides (`a` radians either side of the front; one at the front), `grille` bars across the
   * mouth in `grilleGroup`. Composes with a cowl (the helm, open below the nose), a hood or a visor band over it.
   * { parts?, pad?, n?, eye?, spread?, low?, high?, muzzle?, thick?, filters?, grille?, grilleGroup? } */
  respirator: (fig, _g, _b, S) => {
    const P = (S.parts || ['cranium', 'jaw']).flatMap((n) => Object.values(fig.mesh.parts[n]?.points || {}));
    const lo = [0, 1, 2].map((i) => Math.min(...P.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...P.map((p) => p[i])));
    const pad = S.pad ?? 0.006, cy = (lo[1] + hi[1]) / 2, zB = lo[2] - 0.01, zT = hi[2], rx0 = (hi[0] - lo[0]) / 2 + pad, ry0 = (hi[1] - lo[1]) / 2 + pad;
    const n = S.n ?? 2.4, se = (v) => Math.sign(v) * dmath.pow(Math.abs(v), 2 / n), F = Math.PI / 2;
    const uE = (lo[2] + (S.eye ?? 0.55) * (hi[2] - lo[2]) - zB) / (zT - zB), u0 = S.low ?? 0.03, u1 = S.high ?? uE - 0.09, a = S.spread ?? 0.85, th = S.thick ?? 0.006, mz = S.muzzle ?? 0.03;
    const uM = u0 + (u1 - u0) * 0.45;   // the mouth line, where the cup stands farthest forward
    const at = (u, t, off = 0) => { const c = dmath.cos(t), sn = dmath.sin(t), fr = dmath.cos(((t - F) / a) * (Math.PI / 2));
      const bulge = mz * dmath.exp(-(((u - uM) / (0.5 * (u1 - u0))) ** 2)) * Math.max(0, fr) ** 2;
      return [(rx0 + off) * se(c), cy + (ry0 + off) * se(sn) + bulge + (sn > 0 ? off * 0.2 : 0), zB + u * (zT - zB)]; };
    const K = 7, M = 11, A = Array.from({ length: M }, (_, q) => F - a + (2 * a * q) / (M - 1));
    const secs = Array.from({ length: K }, (_, i) => { const u = u0 + ((u1 - u0) * i) / (K - 1); return [...A.map((t) => at(u, t, 0)), ...[...A].reverse().map((t) => at(u, t, -th))]; });
    const out = [{ ...loftParts(secs, mean(secs[0]), mean(secs[secs.length - 1])), group: S.group }];
    const w = hi[2] - lo[2];
    if (S.filters) { const Fl = S.filters, r = Fl.r ?? w * 0.11, h = Fl.h ?? r * 0.8, ths = (Fl.count ?? 2) === 1 ? [F] : [F - (Fl.a ?? 0.62), F + (Fl.a ?? 0.62)];
      for (const t of ths) { const c = at(uM, t, 0.001), nrm = unit(add(sub(at(uM, t, 0.02), c), [0, 0, -0.25])); out.push({ ...disc(c, nrm, r, h, 16, 0.7), group: Fl.group ?? S.group }); } }
    if (S.grille) for (let i = 0; i < S.grille; i++) { const u = uM + (i - (S.grille - 1) / 2) * 0.05, pts = Array.from({ length: 7 }, (_, q) => at(u, F - 0.32 + (0.64 * q) / 6, 0.003));
      out.push({ ...sweep(pts, pts.slice(0, -1).map(() => w * 0.012), 6), group: S.grilleGroup ?? S.group }); }
    return out; },
  /** a free VOLUME round the carrier (figure-fluff's girth contrast on the rig: the hero robot's football forearm, flared
   * boot, shoulder ball). Built on its shell's WRAPPED window: the carrier's own axis (the ring centres at the window's
   * ends) and its measured radius, so it scales with the body and rides the bone it is pinned to. The shape is fluff's
   * closed set: `football` (a belly at `peak`, the distal end narrowed to `mouth`), `cone` (`taper` > 1 flares: a boot),
   * `bell` (the distal end opened to `mouth`), `slab` (a superellipse block, `taper`), `bead` (a ball at `at` along the
   * window). `girth` multiplies the measured radius; the cross-section is a superellipse of exponent `n` (2 round, 3–4
   * chamfered moulding) squashed by `squash` [lateral, forward]; `bias` [lateral, forward, along] moves it off the axis
   * (fractions of the radius; the forward is the figure's +y, or up for a carrier that already points forward, a foot);
   * `extend` [proximal, distal] runs it past the window (fractions of the window's length). `bore` { group, r? } sets a
   * dark muzzle disc on the distal face (the arm cannon); `lip` { group, at: 'low' | 'high', w?, out? } a proud band at
   * one end (a cuff); `half` { cut } a flat face `cut` radii below the axis along the whole length (a half-egg foot's sole).
   * { shape, girth, peak?, mouth?, taper?, n?, squash?, bias?, extend?, at?, m?, rings?, bore?, lip?, half? } */
  volume: (fig, g, _b, S) => volumeAt(g, S),
  /** a PLAQUE: a thick trapezoid plate lying on the carrier (`part`, default the adornment's own) between stations `s`
   * [bottom, top], centred on the front (t 0), its half-width in ring units `w` [at the bottom, at the top], lifted `lift`
   * off whatever lies beneath and `thick` deep, its face narrowed to `bevel` of its width and its bottom edge bevelled up
   * (an embossed ab plate jutting down under a chest plate): { s, w, lift?, thick?, bevel?, part?, rows?, cols? } */
  plaque: (fig, _g, beneath, S) => plaqueAt(fig, beneath, S),
  // ── THEME MOTIFS (armor/theme.js places them by role): the primary motif, the field's line, the edge and crest verbs ──
  /** a SKULL at the seat (seatOf: a strap's `at`, a shell's `dir`): { r, proud?, horns? 0–2, socketGroup?, hornGroup?, m? } */
  skull: (fig, g, _b, S) => { const { c, n } = seatOf(g, S); return skullAt(c, n, S); },
  /** a row of SPIKES along an edge (edgeOf: a strap's path, a shell's row `j`), leaning up by `rise` (0 along the normal, large ≈
   * vertical), their lengths shaped by `profile` ('even' | 'crown' | 'rake' | 'fan'): { count, len, r, rise?, profile?, from?, to?, m? } */
  spikes: (fig, g, _b, S) => { const E = edgeOf(g, S), a = S.from ?? 0, b = S.to ?? E.length - 1, prof = PROFILES[S.profile ?? 'even'];
    return Array.from({ length: S.count }, (_, q) => { const f = S.count === 1 ? 0.5 : q / (S.count - 1), e = E[Math.round(lerp(a, b, f))];
      const dir = unit(add(e.n, [0, 0, S.rise ?? 1])); return cone(add(e.p, mul(e.n, -(S.sink ?? 0.002))), dir, S.len * prof(f), S.r, S.m ?? 5, S.minR); }); },
  /** RIBS across a shell's field (the secondary motif as the field's one structural line, law 15): `count` flat bars along
   * the grid's rows between station fractions `from`→`to`, each drooping `droop` (stations) toward its far end:
   * { count, r, from?, to?, droop?, lift?, taper? } */
  ribs: (fig, g, _b, S) => { const O = g.outer, K = O.length, J = O[0].length, out = [];
    const pt = (k, jf) => { const x = Math.max(0, Math.min(J - 1, jf)), j0 = Math.floor(x), j1 = Math.min(J - 1, j0 + 1), f = x - j0; const p = add(mul(O[k][j0], 1 - f), mul(O[k][j1], f)), n = unit(add(mul(g.F[k][j0].normal, 1 - f), mul(g.F[k][j1].normal, f))); return add(p, mul(n, S.lift ?? 0.002)); };
    for (let q = 0; q < S.count; q++) { const jf = (J - 1) * lerp(S.from ?? 0.15, S.to ?? 0.6, S.count === 1 ? 0.5 : q / (S.count - 1));
      const spine = Array.from({ length: K }, (_, k) => pt(k, jf - (S.droop ?? 0.4) * dmath.pow(k / (K - 1), 1.5)));
      out.push(sweep(spine, spine.slice(0, -1).map((_, i) => S.r * (1 - (S.taper ?? 0.4) * i / (K - 1))), 5, { squash: [1, 0.55] })); }
    return out; },
  /** a FUR roll along an edge: a lumpy tube lifted `lift` off it, with `tufts` short points hanging out and down:
   * { r, lift?, tufts?, j?, m? } */
  fur: (fig, g, _b, S) => { const E = edgeOf(g, S), lift = S.lift ?? S.r * 0.6;
    const spine = E.map(({ p, n }) => add(p, mul(n, lift))), out = [sweep([...spine, add(spine[spine.length - 1], mul(unit(sub(spine[spine.length - 1], spine[spine.length - 2])), S.r * 0.5))], spine.map((_, i) => S.r * (i % 2 ? 0.72 : 1.08)), S.m ?? 6, { squash: [1, 0.8] })];
    const T = S.tufts ?? 0; for (let q = 0; q < T; q++) { const e = E[Math.round((q + 0.5) / T * (E.length - 1))]; out.push(cone(add(e.p, mul(e.n, lift * 1.4)), unit(add(e.n, [0, 0, q % 2 ? -0.6 : 0.4])), S.r * 1.25, S.r * 0.6, 4)); }
    return out; },
  /** RUNES: glowing glyph strokes lying on a shell's field, spread over its grid (a fixed glyph table, chosen by position:
   * no dice): { count, h, w, lift?, group } */
  runes: (fig, g, _b, S) => { const O = g.outer, K = O.length, J = O[0].length, out = [], lift = S.lift ?? 0.0015;
    for (let q = 0; q < S.count; q++) { const k = Math.round(lerp(0.5, K - 1.5, (q + 0.5) / S.count)), j = Math.max(1, Math.min(J - 2, Math.round((J - 1) * (q % 2 ? 0.35 : 0.65))));
      const c = O[k][j], n = unit(g.F[k][j].normal), upRaw = sub(O[k][Math.min(J - 1, j + 1)], O[k][Math.max(0, j - 1)]), up = unit(sub(upRaw, mul(n, dot(upRaw, n)))), lat = unit(cross(n, up));
      const at = ([x, y]) => add(add(c, mul(n, lift)), add(mul(lat, x * S.h * 0.5), mul(up, y * S.h * 0.5)));
      for (const [a, b] of GLYPHS[(k * 7 + j * 3 + q) % GLYPHS.length]) { const A = at(a), B = at(b), M = mean([A, B]);
        out.push(sweep([A, M, B, add(B, mul(unit(sub(B, A)), S.w * 0.3))], [S.w, S.w, S.w], 4, { squash: [1, 0.35] })); } }
    return out; },
  /** a MOTIF worked into a shell's field as thread (embroidery): `name` from MOTIFS, as a BORDER (`mode: 'border'`, the cell
   * repeated edge to edge along the grid's longer way: round a hem, down an opening) or an EMBLEM (`mode: 'emblem'`, one
   * cell centred on the grid, `size` its height); `w` the thread's width, `lift` off the cloth: { name, mode?, size?, w?,
   * lift? } */
  motif: (fig, g, _b, S) => { const O = g.outer, K = O.length, J = O[0].length, cell = MOTIFS[S.name ?? 'vine'], lift = S.lift ?? 0.0015, w = S.w ?? 0.003, out = [];
    // a closed ring samples round its seam (k wraps), an open grid clamps
    const pt = (kf, jf) => { const kk = g.closed ? ((kf % K) + K) % K : Math.max(0, Math.min(K - 1, kf)), k0 = Math.floor(kk), k1 = g.closed ? (k0 + 1) % K : Math.min(K - 1, k0 + 1), j0 = Math.max(0, Math.min(J - 1, Math.floor(jf))), j1 = Math.min(J - 1, j0 + 1), a = Math.max(0, Math.min(1, kk - k0)), b = Math.max(0, Math.min(1, jf - j0));
      const P = add(add(mul(O[k0][j0], (1 - a) * (1 - b)), mul(O[k1][j0], a * (1 - b))), add(mul(O[k0][j1], (1 - a) * b), mul(O[k1][j1], a * b)));
      const n = unit(add(add(mul(g.F[k0][j0].normal, (1 - a) * (1 - b)), mul(g.F[k1][j0].normal, a * (1 - b))), add(mul(g.F[k0][j1].normal, (1 - a) * b), mul(g.F[k1][j1].normal, a * b))));
      return add(P, mul(n, lift)); };
    const len = (path) => path.slice(1).reduce((t, p, i) => t + dmath.hypot(...sub(p, path[i])), 0);
    // a thread is three-sided (it reads as a line, never as a tube)
    const stroke = (cellAt) => { for (const line of cell) { const P = line.map(([x, y]) => cellAt(x, y)); if (P.length > 1) out.push(sweep(P, P.slice(0, -1).map(() => w), 3, { squash: [1, 0.4] })); } };
    if ((S.mode ?? 'border') === 'emblem') {   // one cell, `size` tall: centred, or on a closed ring's front (k 0) or back (k K/2)
      const kc = S.at === 'front' && g.closed ? 0 : S.at === 'back' && g.closed ? K / 2 : (K - 1) / 2, jc = (J - 1) / 2, along = len(Array.from({ length: J }, (_, j) => O[Math.round(kc)][j])) / Math.max(1, J - 1), across = len(Array.from({ length: K }, (_, k) => O[k][Math.round(jc)])) / Math.max(1, K - 1);
      const hj = (S.size ?? 0.08) / 2 / Math.max(1e-6, along), hk = (S.size ?? 0.08) / 2 / Math.max(1e-6, across);
      stroke((x, y) => pt(kc + (S.at === 'back' ? -x : x) * hk, jc + y * hj)); return out; }
    // a border: along k (round the part) when the grid wraps or is wider round than long, else along j (down an opening)
    const roundK = g.closed || K >= J, n = roundK ? K : J, m = roundK ? J : K, mid = (m - 1) / 2;
    // at most `cells` repeats (a dozen): past that round a hem, a motif reads as texture, not as a motif
    const run = roundK ? Array.from({ length: K }, (_, k) => O[k][Math.round(mid)]) : Array.from({ length: J }, (_, j) => O[Math.round(mid)][j]);
    const L = len(roundK && g.closed ? [...run, run[0]] : run), hgt = len(roundK ? O[0] : O.map((r) => r[0])), cells = Math.max(1, Math.min(S.cells ?? 12, Math.round(L / Math.max(1e-6, hgt * (S.aspect ?? 1.6))))), span = (roundK && g.closed ? n : n - 1) / cells;
    for (let c = 0; c < cells; c++) stroke((x, y) => { const along2 = c * span + (x + 1) / 2 * span, acr = mid + y * mid * 0.8;
      return roundK ? pt(along2, acr) : pt(acr, along2); });
    return out; },
  /** a POLYLINE: a tube through world points `pts` the caller computed off the body's own landmarks (a necklace's curve
   * round the neck and over the chest, which the body's rings cannot address), `r` a radius per segment (beads and links
   * alternating read as a chain): { pts, r, sides? } */
  polyline: (fig, g, _b, S) => sweep(S.pts, Array.isArray(S.r) ? S.r : S.pts.slice(0, -1).map(() => S.r), S.sides ?? 6),
  /** a DISC at a world point `c` facing `n` (a pendant, a mounted boss): { c, n, r, h, m?, rim? } */
  disc: (fig, g, _b, S) => disc(S.c, unit(S.n), S.r, S.h, S.m ?? 14, S.rim ?? 0.55),
  /** a TABARD hung from a strap's path: a cloth board `len` long, standing `stand` off, its hem swung `tilt` out, `taper`ing to
   * the hem, `thick`; with `hemGroup`, a bar along the hem: { len, thick, tilt?, stand?, taper?, hem?, hemGroup? } */
  tabard: (fig, g, _b, S) => { const P = g.pts, N = g.ns, L = P.length, down = [0, 0, -1], Q = 9, secs = [];
    const top = (u) => { const x = u * (L - 1), i = Math.min(L - 2, Math.floor(x)), f = x - i; return { p: add(mul(P[i], 1 - f), mul(P[i + 1], f)), n: unit(add(mul(N[i], 1 - f), mul(N[i + 1], f))) }; };
    const mid = top(0.5), taper = S.taper ?? 0.8, hem = [];
    for (let q = 0; q < Q; q++) { const u = q / (Q - 1), t = top(u), o = add(t.p, mul(t.n, S.stand ?? 0.004)), nn = mid.n;
      const o2 = add(add(o, mul(down, S.len * 0.45)), add(mul(nn, (S.tilt ?? 0) * 0.55), mul(sub(mid.p, t.p), (1 - taper) * 0.45)));
      const o3 = add(add(o, mul(down, S.len)), add(mul(nn, S.tilt ?? 0), mul(sub(mid.p, t.p), 1 - taper)));
      hem.push(o3); secs.push([o, o2, o3, add(o3, mul(nn, S.thick)), add(o2, mul(nn, S.thick)), add(o, mul(nn, S.thick))]); }
    const out = [loftParts(secs, sub(mean(secs[0]), mul(unit(sub(secs[1][0], secs[0][0])), 0.001)), add(mean(secs[Q - 1]), mul(unit(sub(secs[Q - 1][0], secs[Q - 2][0])), 0.001)))];
    if (S.hemGroup) out.push({ ...sweep(hem.map((p) => add(p, mul(mid.n, S.thick * 1.2))), hem.slice(0, -1).map(() => S.hem ?? S.thick * 1.6), 5, { squash: [1, 0.6] }), group: S.hemGroup });
    return out; },
  /** a row of studs along a strap or a shell row: { r, h, count, from?, to?, m? } */
  studs: (fig, g, _b, S) => { const j = g.pts ? 0 : gridAt(g, S, S.side)[1];
    const row = g.pts ? g.pts.map((p) => ({ p, n: unit(sub(p, [0, 0, p[2]])) })) : g.list.map((_, k) => ({ p: g.outer[k][j], n: g.F[k][j].normal }));
    const end = (v, d) => (v === undefined ? d : v < 0 ? row.length + v : v);   // a negative index counts from the row's end
    const a = end(S.from, 0), b = end(S.to, row.length - 1); return Array.from({ length: S.count }, (_, q) => { const e = row[Math.round(lerp(a, b, S.count === 1 ? 0.5 : q / (S.count - 1)))]; return disc(e.p, e.n, S.r, S.h, S.m ?? 8, S.rim ?? 0.7); }); },
};

// ─── wear: build up the figure ───
/** Wear a KIT over a figure `{ mesh, parts }` (the compiled mesh and its detail parts). Each adornment:
 * `{ id, mode: 'shell' | 'band' | 'strap', part, over?, side?, s, t | path, nt?, ns?, mugen, thick, rad?, support?, ramp?,
 *    onTop? (clear every body detail pinned to the carrier too: fur, locks, scales), share? (the window as shares),
 *    ghost? (carry the signature, draw no plate),
 *    width? (strap), group, rim? (shell), rigid?, signature: { kind, group, beneath?, …numbers } }`. STACKING: each adornment's beneath
 * includes the ones worn before it. `recipe` (the unrefined source) names the bone a rigid adornment rides. */
export function wear(fig, kit, { recipe } = {}) { const out = {}; const record = []; const meta = {};
  for (const A of kit) { const side = A.side || 'R'; let g, mesh; const mode = A.mode === 'band' ? 'shell' : A.mode;
    if (mode === 'shell') { let liner; ({ mesh, grid: g, liner } = shell(fig, A, side)); if (liner && !A.ghost) out[`adorn.${A.id}.liner`] = { ...liner, layer: 3 };
      // a VOLUME is the whole visible piece: its carrying shell (whose window only sizes it) becomes a slender core on the
      // carrier's axis, buried in the body, so no shell face shows past the volume's rounded ends
      if (A.signature?.kind === 'volume' && A.t === 'wrap') { const ax = axisOf(g), r = 0.25 * Math.min(...ax.map((x) => x.r));
        mesh = { ...loftParts(ax.map((x, j) => ringAt(x.c, sub(ax[Math.min(j + 1, ax.length - 1)].c, ax[Math.max(j - 1, 0)].c), r, 6)), ax[0].c, ax[ax.length - 1].c), group: A.group }; } } else if (mode === 'strap') { const r = strap(fig, A); mesh = r.mesh; g = r; } else throw new Error(`adorn: ${A.id} mode must be one of ${ADORN_MODES.join(' / ')}`);
    // a GHOST carries its signature's grid and draws nothing of its own (embroidery lies on the cloth, not on a plate)
    if (!A.ghost) out[`adorn.${A.id}`] = { ...mesh, layer: 3 };
    // the signature is built on the adornment (so it rides it); what it hangs past is its own beneath
    const beneath = beneathOf({ mesh: fig.mesh, parts: { ...fig.parts, ...out }, anchors: fig.anchors }, A.signature.beneath || [A.part], { onTop: !!A.onTop });
    const make = typeof A.signature.build === 'function' ? A.signature.build : SIGNATURES[A.signature.kind];
    if (!make) throw new Error(`adorn: ${A.id} signature kind '${A.signature.kind}' is not in the library (have ${Object.keys(SIGNATURES).join(', ')})`);
    const sig = make(fig, g, beneath, { side, carrier: A.part, ...A.signature });
    // a signature is its ELEMENT (what must read) plus whatever carries it (chain links), named apart
    // an element may carry its own group (a board's lacing cords); absent, the signature's
    // a signature with a `rigidity` (rigidity.js) flows (hero-flow.js): each element carries it, and where it is tied (`root`)
    const flows = A.signature.rigidity !== undefined ? { rigidity: A.signature.rigidity } : {};
    const el = sig.element ? sig.element : sig; (Array.isArray(el) ? el : [el]).forEach((m, i) => { const { root, ...mm } = m; out[`adorn.${A.id}.sig${i}`] = { ...mm, group: m.group ?? A.signature.group, layer: 3, ...flows, ...(flows.rigidity !== undefined && root ? { root } : {}) }; });
    (sig.links || []).forEach((m, i) => { out[`adorn.${A.id}.link${i}`] = { ...m, group: A.signature.group, layer: 3 }; });
    const As = A.share ? byShare(fig.mesh.parts[A.part], A).s : A.s;
    const dom = A.rigid && recipe && As ? dominance(recipe.parts[A.part]) : null; const bones = dom ? As.map((s) => dom(s)) : null;   // a strap has no window: it rides its pin
    record.push({ id: A.id, mode: A.mode, carrier: A.part, over: A.over || [], mugen: A.mugen, signature: A.signature.kind, rigid: !!A.rigid, bone: bones ? bones.map((b) => `${b.bone}@${b.w.toFixed(2)}`).join('..') : 'skin (inherits)' });
    meta[A.id] = { g, side };
    // STACKING: the next adornment's beneath includes this one — unless it declares `stack: false` (lamellar rows keep a
    // sawtooth: each row's standoff is its own, never lifted over the row before)
    if (A.stack !== false) fig = { ...fig, parts: { ...fig.parts, ...Object.fromEntries(Object.entries(out).filter(([n]) => n === `adorn.${A.id}` || n.startsWith(`adorn.${A.id}.`))) } }; }
  return { parts: out, record, meta }; }

/** ONE RECOGNIZABLE VISUAL ELEMENT: the signature must READ (exposed ≥ 0.25 from some view) and be a real share of
 * its adornment's picture; otherwise the adornment has not justified itself (advisory, never a refusal). `src` is a
 * mesh with provenance and part layers (a compiled layered mesh or a render source). */
export function justify(src, record, { res = 384 } = {}) { const L = layeredExposure({ vertices: src.vertices, faces: src.faces, provenance: src.provenance, parts: src.parts }, { minLayer: 3, res }).parts;
  return record.map((r) => { const sig = Object.keys(L).filter((k) => k.startsWith(`adorn.${r.id}.sig`)).sort((a, b) => Number(a.split('sig')[1]) - Number(b.split('sig')[1]));
    if (!sig.length || !L[`adorn.${r.id}`]) return { ...r, sigExposed: 0, sigShare: 0, adornExposed: L[`adorn.${r.id}`]?.exposed ?? 0, verdict: 'unjustified' };
    const best = Math.max(...sig.map((k) => L[k].exposed)); const base = L[`adorn.${r.id}`];
    const views = Object.keys(L[sig[0]].pixels); const sigPx = Math.max(...views.map((v) => sig.reduce((t, k) => t + L[k].pixels[v], 0))); const basePx = Math.max(...Object.values(base.pixels)); const share = sigPx / Math.max(1, sigPx + basePx);
    return { ...r, sigExposed: +best.toFixed(2), sigShare: +share.toFixed(2), adornExposed: base.exposed, verdict: best >= 0.25 && share >= 0.08 ? 'justified' : best >= 0.25 ? 'reads, but small' : 'unjustified' }; }); }

// ─── the bake ───
/** the carrier address an adornment rides: its `pin` if given ([s, t, side]), else the middle of its window / path */
function pinAddress(L1, A) {
  if (A.pin) return address(L1, A.pin[3] ?? A.part, A.pin[0], A.pin[1], A.pin[2] ?? 'R');   // a pin may name another carrier: shaped on the arm, riding the torso
  if (A.path) { const z = A.path[Math.floor(A.path.length / 2)]; return address(L1, A.part, z[0], z[1], z[2]); }
  A = byShare(L1[A.part], A); const s = (A.s[0] + A.s[1]) / 2; const P = L1[A.part]; const H = P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
  return A.t === 'wrap' ? address(L1, A.part, s, H / 2, A.side || 'R') : address(L1, A.part, s, (A.t[0] + A.t[1]) / 2, A.side || 'R');
}
/** Wear a kit over a detailed figure and write every adornment part into the recipe as a pinned L3 part: the
 * adornment, its signature and its links share ONE pin (the adornment's carrier address), so they ride together. */
export function bakeAdorn(recipe, fig, kit, { source } = {}) {
  const worn = wear(fig, kit, { recipe: source ?? recipe }); const L1 = compileLayered(recipe, {}, { details: false, creases: false }).parts;
  for (const A of kit) { const pin = pinAddress(L1, A); for (const [name, part] of Object.entries(worn.parts)) if (name === `adorn.${A.id}` || name.startsWith(`adorn.${A.id}.`)) recipe.parts[name] = { ...bakePart(L1, part, pin, 3, { follow: true }), ...(part.rigidity !== undefined ? { rigidity: part.rigidity, ...(part.root ? { root: part.root } : {}) } : {}) }; }   // a flowing signature says so (hero-flow.js)
  return { recipe, worn };
}

/** Error strings for a KIT (form only). */
export function validateKit(kit, parts) {
  if (!Array.isArray(kit)) return ['adorn: a list of adornments'];
  const errs = []; const ids = new Set(); const l1 = (p) => parts[p] && (parts[p].layer ?? 1) === 1;
  for (const [i, A] of kit.entries()) { const at = `adorn[${i}]${A?.id ? ` (${A.id})` : ''}`;
    if (!A || typeof A !== 'object') { errs.push(`${at}: an adornment object`); continue; }
    if (typeof A.id !== 'string' || !/^[A-Za-z][\w-]*$/.test(A.id)) errs.push(`${at}.id: a word`); else if (ids.has(A.id)) errs.push(`${at}.id: '${A.id}' twice`); else ids.add(A.id);
    if (!ADORN_MODES.includes(A.mode)) errs.push(`${at}.mode: one of ${ADORN_MODES.join(' / ')}`);
    if (!l1(A.part)) errs.push(`${at}.part: '${A.part}' is not an L1 part`);
    for (const o of A.over || []) if (!l1(o)) errs.push(`${at}.over: '${o}' is not an L1 part`);
    if (A.mode === 'strap') { if (!Array.isArray(A.path) || A.path.length < 2) errs.push(`${at}.path: two or more [s, t, side] addresses`); if (!Number.isFinite(A.width)) errs.push(`${at}.width: metres`); }
    else if (A.mode) { if (!Array.isArray(A.s) || A.s.length !== 2) errs.push(`${at}.s: [s0, s1]`); if (!(A.t === 'wrap' || (Array.isArray(A.t) && A.t.length === 2))) errs.push(`${at}.t: 'wrap' or [t0, t1]`); }
    for (const k of ['mugen', 'thick']) if (!Number.isFinite(A[k])) errs.push(`${at}.${k}: metres`);
    if (A.seat !== undefined && (A.mode !== 'shell' || !Number.isFinite(A.seat) || A.seat < 0)) errs.push(`${at}.seat: metres ≥ 0 (a shell filled down to it off the body)`);
    if (A.edge !== undefined && (A.mode === 'strap' || !['roll', 'flat'].includes(A.edge))) errs.push(`${at}.edge: 'roll' | 'flat' (a shell drawn as a plate: a thin wall, its edge rolled or flat)`);
    for (const k of ['wall', 'crown', 'keel']) if (A[k] !== undefined && (A.edge === undefined || !Number.isFinite(A[k]) || A[k] < 0)) errs.push(`${at}.${k}: metres ≥ 0, on a shell with an \`edge\``);
    if (A.slab !== undefined && (A.edge === undefined || !(Number.isFinite(A.slab) && A.slab > 0))) errs.push(`${at}.slab: metres > 0 (a plate clears only what lies within that slab along its part: moulded under a form), on a shell with an \`edge\``);
    if (A.hover !== undefined && typeof A.hover !== 'boolean') errs.push(`${at}.hover: true | false (the plate's stand-off is a gap the within law keeps)`);
    if (A.within !== undefined && (A.edge === undefined || !Number.isFinite(A.within) || A.within < 0)) errs.push(`${at}.within: metres ≥ 0 (how far a plate may stand past the figure's own width), on a shell with an \`edge\``);
    if (A.bead !== undefined && (A.edge === undefined || !(A.bead > 0 && A.bead < 0.5))) errs.push(`${at}.bead: the edge band's share of the window (0 … 0.5), on a shell with an \`edge\``);
    if (A.liner !== undefined && (A.edge === undefined || typeof A.liner !== 'object' || typeof A.liner.group !== 'string' || (A.liner.seat !== undefined && !(Number.isFinite(A.liner.seat) && A.liner.seat >= 0)))) errs.push(`${at}.liner: { group, seat? } (what fills the gap under a plate, recessed in its shadow), on a shell with an \`edge\``);
    if (A.interior !== undefined && (A.edge === undefined || typeof A.interior !== 'string')) errs.push(`${at}.interior: a group (the inside of a plate's wall), on a shell with an \`edge\``);
    if (A.rim !== undefined && (typeof A.rim !== 'object' || typeof A.rim.group !== 'string' || (A.rim.at !== undefined && !['low', 'high', 'both'].includes(A.rim.at)))) errs.push(`${at}.rim: { group, at?: 'low' | 'high' | 'both', w?, wt?, ends? } (a shell's painted edge)`);
    if (A.stack !== undefined && typeof A.stack !== 'boolean') errs.push(`${at}.stack: true | false (false: later adornments are not lifted over it)`);
    if (!A.signature || typeof A.signature !== 'object' || !SIGNATURES[A.signature.kind]) errs.push(`${at}.signature: { kind: ${Object.keys(SIGNATURES).join(' | ')}, group, …numbers } — every adornment names the one element that justifies it`);
    else errs.push(...rigidityErrors(A.signature.rigidity, `${at}.signature.rigidity`));
  }
  return errs;
}
