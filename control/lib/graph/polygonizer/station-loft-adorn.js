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

const { sub, add, mul, dot, cross, unit, mean } = vec;
const lerp = (a, b, t) => a + (b - a) * t;
export const ADORN_MODES = ['shell', 'band', 'strap'];

// ─── beneath: what an adornment stands off ───
/** the points beneath an adornment: its carrier and `over` parts (L1) plus every detail/adornment part whose
 * name mentions one of them, minus the ones that declare they poke through */
export function beneathOf(fig, names, { pokes = /^(spur|spine)/ } = {}) { const pts = []; const L1 = fig.mesh.parts;
  for (const n of names) if (L1[n]) pts.push(...Object.values(L1[n].points));
  for (const [k, p] of Object.entries(fig.parts)) if (!pokes.test(k) && names.some((n) => k.includes(n))) pts.push(...Object.values(p.points));
  return pts; }
/** height of the beneath hull above an address, along its normal, within a lateral radius */
export function hullHeight(pts, p, n, rad) { let h = 0; for (const v of pts) { const d = sub(v, p), up = dot(d, n); if (up <= h) continue; const lat = Math.hypot(...sub(d, mul(n, up))); if (lat < rad) h = up; } return h; }
/** the circumferential sample list: a t window on one half, or the whole wrap (R half out, L half back) */
function around(P, t, side, nt) { const H = P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
  if (t === 'wrap') { const r = Array.from({ length: nt }, (_, k) => [H * k / nt, 'R']); const l = Array.from({ length: nt }, (_, k) => [H * (1 - k / nt), 'L']); return { list: [...r, ...l], closed: true }; }
  return { list: Array.from({ length: nt + 1 }, (_, k) => [lerp(t[0], t[1], k / nt), side]), closed: false }; }

// ─── modes ───
/** SHELL: the carrier's (s, t) window lifted by the smoothed beneath hull + mugen; a thick wall. Wrapped → a torus
 * (ringLoft); partial → a capped loft. The mugen field ramps away from the `support` station (snug where it hangs). */
export function shell(fig, A, side) { const L1 = fig.mesh.parts; const P = L1[A.part]; const beneath = beneathOf(fig, [A.part, ...(A.over || [])]);
  const { list, closed } = around(P, A.t, side, A.nt ?? 12); const S = Array.from({ length: (A.ns ?? 4) + 1 }, (_, j) => lerp(A.s[0], A.s[1], j / (A.ns ?? 4)));
  const F = list.map(([t, sd]) => S.map((s) => frameAt(L1, A.part, [s, t], sd)));
  let H = F.map((row) => row.map((f) => hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05)));
  const nb = (k, j) => [[k, j], [k - 1, j], [k + 1, j], [k, j - 1], [k, j + 1]].map(([a, b]) => [closed ? (a + H.length) % H.length : Math.min(H.length - 1, Math.max(0, a)), Math.min(S.length - 1, Math.max(0, b))]);
  H = H.map((row, k) => row.map((_, j) => Math.max(...nb(k, j).map(([a, b]) => H[a][b])))); H = H.map((row, k) => row.map((_, j) => mean(nb(k, j).map(([a, b]) => [H[a][b]]))[0]));   // min-shield: max, then mean
  const mug = (s) => A.mugen * (1 + (A.ramp ?? 0) * (A.support == null ? 0 : Math.abs(s - A.support) / Math.max(1e-9, Math.abs(A.s[1] - A.s[0]))));
  const inner = F.map((row, k) => row.map((f, j) => add(f.origin, mul(f.normal, H[k][j] + mug(S[j]))))); const outer = inner.map((row, k) => row.map((p, j) => add(p, mul(F[k][j].normal, A.thick))));
  const sections = inner.map((row, k) => [...row, ...[...outer[k]].reverse()]);
  const mesh = closed ? ringLoft(sections) : loftParts(sections, mean(sections[0]), mean(sections[sections.length - 1]));
  return { mesh: { ...mesh, group: A.group }, grid: { inner, outer, F, S, list } }; }
/** STRAP: a path of addresses (each [s, t, side] on the carrier), lifted over the beneath hull, as a flat band */
export function strap(fig, A) { const L1 = fig.mesh.parts; const beneath = beneathOf(fig, [A.part, ...(A.over || [])]); const pts = [], ns = [];
  for (let i = 0; i + 1 < A.path.length; i++) { const [a, b] = [A.path[i], A.path[i + 1]]; const n = a[2] === b[2] ? 4 : 1; for (let k = 0; k < n; k++) { const u = k / n; const at = a[2] === b[2] ? [lerp(a[0], b[0], u), lerp(a[1], b[1], u)] : [a[0], a[1]]; const f = frameAt(L1, A.part, at, a[2]); pts.push(add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05) + A.mugen))); ns.push(f.normal); } }
  { const z = A.path[A.path.length - 1]; const f = frameAt(L1, A.part, [z[0], z[1]], z[2]); pts.push(add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05) + A.mugen))); ns.push(f.normal); }
  const rings = pts.map((p, i) => { const along = unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)])); const n = unit(sub(ns[i], mul(along, dot(ns[i], along)))); const lat = mul(unit(cross(n, along)), A.width / 2);
    return [sub(p, lat), add(p, lat), add(add(p, lat), mul(n, A.thick)), add(sub(p, lat), mul(n, A.thick))]; });
  return { mesh: { ...loftParts(rings, sub(pts[0], mul(unit(sub(pts[1], pts[0])), 0.01)), add(pts[pts.length - 1], mul(unit(sub(pts[pts.length - 1], pts[pts.length - 2])), 0.01))), group: A.group }, pts, ns }; }
/** HANG: a chain from an anchor under gravity, kept `clear` off the beneath points (a few relaxation passes that
 * keep link length), ending in a pendant; links alternate orientation */
export function clearOf(p, surfaces, out, clear) { for (const S of surfaces) { let hit; try { hit = projectOnto(S, p, out); } catch { continue; } const d = dot(sub(p, hit), out); if (d < clear) p = add(p, mul(out, clear - d)); } return p; }
export function hang(beneath, anchor, { links, len, clear, r, surfaces = [], out = [0, 1, 0] }) { let P = Array.from({ length: links + 1 }, (_, i) => add(anchor, [0, 0, -len * i]));
  for (let it = 0; it < 12; it++) { for (let i = 1; i < P.length; i++) { for (const v of beneath) { const d = sub(P[i], v), l = Math.hypot(...d); if (l < clear && l > 1e-9) P[i] = add(v, mul(d, clear / l)); } P[i] = clearOf(P[i], surfaces, out, clear); }
    for (let i = 1; i < P.length; i++) { const d = sub(P[i], P[i - 1]), l = Math.hypot(...d); P[i] = add(P[i - 1], mul(d, len / l)); } }
  const meshes = P.slice(0, -1).map((p, i) => { const c = mean([p, P[i + 1]]), ax = unit(sub(P[i + 1], p)); const side = unit(cross(ax, i % 2 ? [1, 0, 0] : [0, 1, 0]));
    return ringLoft(Array.from({ length: 10 }, (_, k) => { const a = 2 * Math.PI * k / 10; const q = add(c, add(mul(ax, Math.cos(a) * len * 0.55), mul(side, Math.sin(a) * len * 0.3))); const t = unit(add(mul(ax, -Math.sin(a) * 0.55), mul(side, Math.cos(a) * 0.3))); return ringAt(q, t, r, 5); })); });
  return { P, meshes }; }
/** a flat disc (medallion, boss, buckle plate) facing n: two rings and a raised face */
export function disc(c, n, r, h, m = 12, rim = 0.8) { const ring = (rr, z) => ringAt(add(c, mul(n, z)), n, rr, m); return loftParts([ring(r, 0), ring(r, h * 0.6), ring(r * rim, h)], sub(c, mul(n, 0.002)), add(c, mul(n, h * 1.15))); }

// ─── the signature library: one recognizable element, as data ───
/** a grid point of a shell: `k` a row index (a number, 'mid', or negative from the end), or `{ t, side, tol }` / `{ after, side }`
 * to find the first row at that ring parameter; `j` a station index (negative from the end; default the middle) */
function gridAt(g, sig, side) { const L = g.list.length, n = g.S.length; const idx = (v, N, dflt) => (v === undefined ? dflt : v === 'mid' ? Math.floor(N / 2) : v < 0 ? N + v : v);
  const sd = sig.side ?? side; let k;
  if (sig.t !== undefined) k = g.list.findIndex(([t, s]) => s === sd && Math.abs(t - sig.t) < (sig.tol ?? 0.2));
  else if (sig.after !== undefined) k = Math.max(0, g.list.findIndex(([t, s]) => s === sd && t > sig.after));
  else k = idx(sig.k, L, 0);
  const j = idx(sig.j, n, Math.floor(n / 2)); return [k, j]; }
export const SIGNATURES = {
  /** a disc on the shell's outer skin: { r, h, m?, rim? } at a grid point */
  boss: (fig, g, _b, S) => { const [k, j] = gridAt(g, S, S.side); return disc(g.outer[k][j], g.F[k][j].normal, S.r, S.h, S.m ?? 12, S.rim ?? 0.55); },
  /** a horn standing out of the shell, raised toward +z by `rise`: { len: [3], r: [3], rise, sink?, m? } */
  spike: (fig, g, _b, S) => { const [k, j] = gridAt(g, { k: 'mid', j: -2, ...S }, S.side); const p = g.outer[k][j], n = g.F[k][j].normal; const up = unit(add(n, [0, 0, S.rise ?? 1.2]));
    return sweep([sub(p, mul(n, S.sink ?? 0.01)), ...S.len.map((l) => add(p, mul(up, l)))], S.r, S.m ?? 6); },
  /** a rectangular frame of four bars, upright on the shell: { w, h, bar, standoff? } */
  buckle: (fig, g, _b, S) => { let p, n, up;
    if (g.pts) { const i = Math.floor(g.pts.length / 2) + (S.shift ?? 0); p = g.pts[i]; n = g.ns[i]; const d = sub(g.pts[Math.min(i + 1, g.pts.length - 1)], g.pts[Math.max(i - 1, 0)]); up = unit(sub(d, mul(n, dot(d, n)))); }   // on a strap: upright along it
    else { const [k, j] = gridAt(g, { k: 0, j: 1, ...S }, S.side); p = g.outer[k][j]; n = g.F[k][j].normal; up = [0, 0, 1]; }
    const lat = unit(cross(up, n)); const W = S.w, Hh = S.h;
    const path = [[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh]].flatMap(([a, b], i, arr) => { const [c, d] = arr[(i + 1) % 4]; return [0, 0.5].map((u) => [lerp(a, c, u), lerp(b, d, u)]); });
    return ringLoft(path.map(([a, b], i) => { const q = add(add(add(p, mul(lat, a)), mul(up, b)), mul(n, S.standoff ?? 0.01)); const nx = path[(i + 1) % path.length], pv = path[(i - 1 + path.length) % path.length]; const tan = unit(add(mul(lat, nx[0] - pv[0]), mul(up, nx[1] - pv[1]))); return ringAt(q, tan, S.bar, 4, Math.PI / 4); })); },
  /** a torus on a strap's path, tipped by `lean`: { R, r, lean?, standoff?, m?, rm? } */
  ring: (fig, g, _b, S) => { const i = Math.floor(g.pts.length / 2) - 1 + (S.shift ?? 0); const c = g.pts[i]; const n = unit(sub(c, [0, 0, c[2]])); const f = unit(add(n, S.lean ?? [0, 0.4, 0])); const m = S.m ?? 14;
    return ringLoft(Array.from({ length: m }, (_, k) => { const a = 2 * Math.PI * k / m; const u = unit(cross(f, [0, 0, 1])), v = cross(f, u); const q = add(add(c, mul(f, S.standoff ?? 0.02)), add(mul(u, Math.cos(a) * S.R), mul(v, Math.sin(a) * S.R))); return ringAt(q, unit(add(mul(u, -Math.sin(a)), mul(v, Math.cos(a)))), S.r, S.rm ?? 6); })); },
  /** a disc hanging on a chain in front of `surfaces`: { links, len, clear, link, drop, dropClear, face, r, h, m?, rim?, anchor?, out?, surfaces } */
  medallion: (fig, g, beneath, S) => { const [k, j] = gridAt(g, { k: 0, j: 0, ...S }, S.side); const a = g.outer[k][j]; const surfaces = (S.surfaces || []).map((n) => fig.mesh.parts[n]); const out = S.out ?? [0, 1, 0];
    const { P, meshes } = hang(beneath, add(a, S.anchor ?? [0, 0.01, -0.01]), { links: S.links, len: S.len, clear: S.clear, r: S.link, surfaces, out }); const c = clearOf(add(P[P.length - 1], [0, 0, -S.drop]), surfaces, out, S.dropClear);
    return { links: meshes, element: disc(c, unit(S.face ?? [0, 1, 0.15]), S.r, S.h, S.m ?? 14, S.rim ?? 0.6) }; },
  /** a fan of flattened sweeps from one grid point: { spine: [[x,y,z]…] (x scaled by each `spread`), spread, r, m?, squash? } */
  plume: (fig, g, _b, S) => { const [k, j] = gridAt(g, { k: 0, j: 2, ...S }, S.side); const p = g.outer[k][j];
    return S.spread.map((x) => sweep(S.spine.map(([a, b, c]) => add(p, [a * x, b, c])), S.r, S.m ?? 6, { squash: S.squash ?? [1, 0.45] })); },
  /** a bell on a short chain from the shell's rim: { after, side, links, len, clear, link, profile, r, top, step, m?, capTop, capBottom } */
  bell: (fig, g, beneath, S) => { const [k] = gridAt(g, S, S.side); const a = g.outer[k][g.S.length - 1]; const { P, meshes } = hang(beneath, a, { links: S.links, len: S.len, clear: S.clear, r: S.link }); const e = P[P.length - 1];
    return { links: meshes, element: loftParts(S.profile.map((q, i) => ringAt(add(e, [0, 0, -S.top - S.step * i]), [0, 0, 1], S.r * q, S.m ?? 10)), add(e, [0, 0, -S.capTop]), add(e, [0, 0, -S.capBottom])) }; },
  /** a disc set on the LIFTED outer skin where it faces `dir` (the eye's direction; x mirrors on the L side): { dir, r, h,
   * m?, rim? }. A shell's frame normal is its carrier's, so on a cap lifted over the arm every address still faces up;
   * the outer skin's own normal knows better (fantasy armour: the focal boss that hid on the crown). */
  facing: (fig, g, _b, S) => { const O = g.outer, K = O.length, J = O[0].length; const want = unit(S.side === 'L' ? [-S.dir[0], S.dir[1], S.dir[2]] : S.dir); let best = null;
    for (let k = Math.min(1, K - 1); k < Math.max(1, K - 1); k++) for (let j = Math.min(1, J - 1); j < Math.max(1, J - 1); j++) {
      let n = unit(cross(sub(O[Math.min(K - 1, k + 1)][j], O[Math.max(0, k - 1)][j]), sub(O[k][Math.min(J - 1, j + 1)], O[k][Math.max(0, j - 1)])));
      if (dot(n, g.F[k][j].normal) < 0) n = mul(n, -1); const score = dot(n, want); if (!best || score > best.score) best = { score, c: O[k][j], n }; }
    return disc(best.c, best.n, S.r, S.h, S.m ?? 14, S.rim ?? 0.5); },
  /** flat BOARDS hung from the shell's bottom edge (`bottom`: 'j0' | 'jN', the window end they hang from), a shell
   * following its carrier can never be flat (lamellar sode, kusazuri): { n, len, thick, tilt, stand?, dm?, bow?, widen?,
   * wide?, cords?, cordR?, cordGroup? }. Row i hangs `len/n` lower and `dm·i` further out, its bottom edge `tilt` out
   * (the sawtooth); `bow` curves a row across its width, `widen` grows lower rows, `wide` scales the edge's span. With
   * `cords`, lacing columns ride each row's outer face in their own group (`cordGroup`). */
  boards: (fig, g, _b, S) => { const O = g.outer, K = O.length, J = O[0].length, jb = S.bottom === 'j0' ? 0 : J - 1, mid = Math.floor(K / 2);
    const front = O[0][jb], back = O[K - 1][jb], n0 = unit(g.F[mid][jb].normal), along = unit(sub(back, front));
    let down = unit(cross(along, n0)); if (down[2] > 0) down = mul(down, -1); let N = unit(cross(down, along)); if (dot(N, n0) < 0) N = mul(N, -1);
    const c = add(O[mid][jb], mul(N, S.stand ?? 0)), W0 = Math.hypot(...sub(back, front)) * (S.wide ?? 1), step = S.len / S.n, h = step * 1.3, out = [];
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
    if (S.shape === 'crescent') { const P = arc((u) => { const a = (u - 0.5) * 2.3; return [base[0] + S.w * Math.sin(a), base[1], base[2] + S.z + S.w * 0.55 * (1 - Math.cos(a))]; });
      return sweep(P, P.map((_, i) => Math.max(minR, S.r * Math.sin(Math.PI * (0.06 + 0.88 * i / (N - 1))) ** 0.8)), 10, flat); }
    if (S.shape === 'kuwagata') return [1, -1].map((sd) => { const P = arc((u) => [base[0] + sd * (S.r + S.w * 0.55 * u ** 1.3), base[1] + S.r * 1.5 * u, base[2] + S.r * 0.7 + S.z * 3.2 * u]);
      return sweep(P, P.map((_, i) => Math.max(minR, S.r * 0.8 * (1 - 0.7 * i / (N - 1)))), 10, flat); });
    return disc([base[0], base[1] + S.r * 0.4, base[2] + S.z * 1.6], [0, 1, 0.12], S.w * 0.28, Math.max(minR, S.r * 0.55), 20, 0.85); },
  /** a row of studs along a strap or a shell row: { r, h, count, from?, to?, m? } */
  studs: (fig, g, _b, S) => { const j = g.pts ? 0 : gridAt(g, S, S.side)[1];
    const row = g.pts ? g.pts.map((p) => ({ p, n: unit(sub(p, [0, 0, p[2]])) })) : g.list.map((_, k) => ({ p: g.outer[k][j], n: g.F[k][j].normal }));
    const a = S.from ?? 0, b = S.to ?? row.length - 1; return Array.from({ length: S.count }, (_, q) => { const e = row[Math.round(lerp(a, b, S.count === 1 ? 0.5 : q / (S.count - 1)))]; return disc(e.p, e.n, S.r, S.h, S.m ?? 8, S.rim ?? 0.7); }); },
};

// ─── wear: build up the figure ───
/** Wear a KIT over a figure `{ mesh, parts }` (the compiled mesh and its detail parts). Each adornment:
 * `{ id, mode: 'shell' | 'band' | 'strap', part, over?, side?, s, t | path, nt?, ns?, mugen, thick, rad?, support?, ramp?,
 *    width? (strap), group, rigid?, signature: { kind, group, beneath?, …numbers } }`. STACKING: each adornment's beneath
 * includes the ones worn before it. `recipe` (the unrefined source) names the bone a rigid adornment rides. */
export function wear(fig, kit, { recipe } = {}) { const out = {}; const record = []; const meta = {};
  for (const A of kit) { const side = A.side || 'R'; let g, mesh; const mode = A.mode === 'band' ? 'shell' : A.mode;
    if (mode === 'shell') { ({ mesh, grid: g } = shell(fig, A, side)); } else if (mode === 'strap') { const r = strap(fig, A); mesh = r.mesh; g = r; } else throw new Error(`adorn: ${A.id} mode must be one of ${ADORN_MODES.join(' / ')}`);
    out[`adorn.${A.id}`] = { ...mesh, layer: 3 };
    // the signature is built on the adornment (so it rides it); what it hangs past is its own beneath
    const beneath = beneathOf({ mesh: fig.mesh, parts: { ...fig.parts, ...out } }, A.signature.beneath || [A.part]);
    const make = typeof A.signature.build === 'function' ? A.signature.build : SIGNATURES[A.signature.kind];
    if (!make) throw new Error(`adorn: ${A.id} signature kind '${A.signature.kind}' is not in the library (have ${Object.keys(SIGNATURES).join(', ')})`);
    const sig = make(fig, g, beneath, { side, ...A.signature });
    // a signature is its ELEMENT (what must read) plus whatever carries it (chain links), named apart
    // an element may carry its own group (a board's lacing cords); absent, the signature's
    const el = sig.element ? sig.element : sig; (Array.isArray(el) ? el : [el]).forEach((m, i) => { out[`adorn.${A.id}.sig${i}`] = { ...m, group: m.group ?? A.signature.group, layer: 3 }; });
    (sig.links || []).forEach((m, i) => { out[`adorn.${A.id}.link${i}`] = { ...m, group: A.signature.group, layer: 3 }; });
    const dom = A.rigid && recipe && A.s ? dominance(recipe.parts[A.part]) : null; const bones = dom ? A.s.map((s) => dom(s)) : null;   // a strap has no window: it rides its pin
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
  const s = (A.s[0] + A.s[1]) / 2; const P = L1[A.part]; const H = P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
  return A.t === 'wrap' ? address(L1, A.part, s, H / 2, A.side || 'R') : address(L1, A.part, s, (A.t[0] + A.t[1]) / 2, A.side || 'R');
}
/** Wear a kit over a detailed figure and write every adornment part into the recipe as a pinned L3 part: the
 * adornment, its signature and its links share ONE pin (the adornment's carrier address), so they ride together. */
export function bakeAdorn(recipe, fig, kit, { source } = {}) {
  const worn = wear(fig, kit, { recipe: source ?? recipe }); const L1 = compileLayered(recipe, {}, { details: false, creases: false }).parts;
  for (const A of kit) { const pin = pinAddress(L1, A); for (const [name, part] of Object.entries(worn.parts)) if (name === `adorn.${A.id}` || name.startsWith(`adorn.${A.id}.`)) recipe.parts[name] = bakePart(L1, part, pin, 3, { follow: true }); }
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
    if (A.stack !== undefined && typeof A.stack !== 'boolean') errs.push(`${at}.stack: true | false (false: later adornments are not lifted over it)`);
    if (!A.signature || typeof A.signature !== 'object' || !SIGNATURES[A.signature.kind]) errs.push(`${at}.signature: { kind: ${Object.keys(SIGNATURES).join(' | ')}, group, …numbers } — every adornment names the one element that justifies it`);
  }
  return errs;
}
