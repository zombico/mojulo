// construction/furniture-joints — where two panels (or a panel and a rail) meet in a piece of furniture, and the
// hardware that holds them: dowels, cam locks, confirmats, screws, shelf pins, angle brackets, a housing (dado), and a
// back captured in a groove.
//
// Casework meets EDGE TO FACE: one member's edge (or end) lies on the other's face. The contact decides the rest: the
// FACE member is the one whose thinnest side is square to the contact (the side panel), the EDGE member the other (the
// shelf). Fittings sit along the contact's long side, 37 mm in from each end and no more than `spacing` apart (the
// 32 mm system's front setback), centred on the edge member's thickness. Every fitting is a catalog part
// (hardware.js): it is placed as a loose piece and the members lose the hole it asks for (`boreTerm`), so a
// countersink fits its head and a pilot its thread. Members are axis-aligned here (boxes), as casework is.
//
// Each joint records how firmly it holds the corner against racking (`rigidity`): 'moment' (a bracket; any dowel,
// screw, confirmat or dado joint that is also glued, `glue: true`), 'shear' (a back in a groove, the carcass's
// diagonal), 'pin' (the knock-down fittings: they hold the parts together but let the corner turn), 'none' (a shelf on
// pins).
import { toLocal } from './members.js';
import { perpBasisZ } from '../polygonizer/solid-frame.js';
import { hardwarePart, partPolys, boreTerm, bracketHoles, BOLT_LENGTHS } from './hardware.js';
import { tubePolys } from './prims.js';
import { SHEETS } from './sheets.js';
import { TIMBERS } from './timber.js';

const MM = 0.001;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const axisVec = (k, s = 1) => { const v = [0, 0, 0]; v[k] = s; return v; };
const r1 = (v) => Math.round(v * 10) / 10;

export const FURNITURE_JOINTS = Object.freeze(['dowel', 'cam-lock', 'confirmat', 'screwed', 'shelf-pin', 'bracket', 'dado', 'groove', 'hinge', 'slide', 'dovetail', 'finger', 'insert-bolt', 'hanger-bolt', 'springs']);
export const RIGIDITY = Object.freeze({
  'mortise-tenon': 'moment', hozo: 'pin', nuki: 'moment', 'kanawa-tsugi': 'moment', lap: 'moment', notch: 'pin',
  welded: 'moment', bolted: 'moment', 'base-plate': 'moment',
  dowel: 'pin', 'cam-lock': 'pin', confirmat: 'pin', screwed: 'pin', 'shelf-pin': 'none', bracket: 'moment', dado: 'pin', groove: 'shear',
  hinge: 'none', slide: 'none', dovetail: 'moment', finger: 'moment', 'insert-bolt': 'pin', 'hanger-bolt': 'pin', springs: 'none',
});

/** A member's world box (metres): { lo, hi, c, size }. */
export function worldBox(M) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [M.xMin, M.xMax]) for (const y of [-M.W / 2, M.W / 2]) for (const z of [-M.D / 2, M.D / 2]) {
    const p = [0, 1, 2].map((i) => M.F.origin[i] + M.F.ex[i] * x + M.F.ey[i] * y + M.F.ez[i] * z);
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  }
  return { lo, hi, c: lo.map((v, k) => (v + hi[k]) / 2), size: lo.map((v, k) => hi[k] - v) };
}
/** Is axis k the member's thinnest world extent (within 0.1 mm)? */
const thinOn = (b, k) => b.size[k] <= Math.min(...b.size) + 1e-4;

/** What a hole in M bites into: the pilot table's key. */
export function materialClass(M) {
  if (SHEETS[M.material]) return M.material === 'mfc' ? 'particleboard' : M.material;
  if (M.material === 'steel') return 'steel';
  if (M.material === 'concrete') return 'concrete';
  return TIMBERS[M.species] && TIMBERS[M.species].group === 'softwood' ? 'softwood' : 'hardwood';
}

/**
 * The contact between a and b → { F, E, k, s, n, plane, rect: { lo, hi } (the two other axes' world ranges), run, across,
 * overlap }. `n` is the unit world vector from the face member into the edge member; `plane` the face member's
 * surface coordinate on axis k. `prefer` ('a' | 'b') names the face member when both or neither qualify.
 */
function contact(J, A, B, prefer = 'b') {
  const a = worldBox(A), b = worldBox(B);
  const ov = [0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]));
  const k = [0, 1, 2].reduce((m, i) => (ov[i] < ov[m] ? i : m), 0);
  if (ov[k] < -0.002) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} do not touch (${r1(-ov[k] * 1000)} mm apart) — a ${J.type} joins an edge to a face`);
  if ([0, 1, 2].some((i) => i !== k && ov[i] <= 0.0005)) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} meet only at an edge or corner — a ${J.type} joins an edge to a face`);
  const aThin = thinOn(a, k), bThin = thinOn(b, k);
  let faceIsB = bThin && !aThin ? true : aThin && !bThin ? false : J.through === 'a' ? false : J.through === 'b' ? true : prefer === 'b';
  if (aThin && bThin && J.through === undefined) faceIsB = b.size[k] <= a.size[k];     // face to face: through the thinner
  const [F, E, fb, eb] = faceIsB ? [B, A, b, a] : [A, B, a, b];
  const s = Math.sign(eb.c[k] - fb.c[k]) || 1;
  const n = axisVec(k, s);
  const plane = s > 0 ? fb.hi[k] : fb.lo[k];
  const others = [0, 1, 2].filter((i) => i !== k);
  const rect = { lo: others.map((i) => Math.max(a.lo[i], b.lo[i])), hi: others.map((i) => Math.min(a.hi[i], b.hi[i])) };
  const ext = others.map((_, j) => rect.hi[j] - rect.lo[j]);
  const run = ext[0] >= ext[1] ? others[0] : others[1], across = run === others[0] ? others[1] : others[0];
  const ri = others.indexOf(run), ci = others.indexOf(across);
  return {
    F, E, fb, eb, k, s, n, plane, overlap: ov[k],
    run, across, runLo: rect.lo[ri], runHi: rect.hi[ri], acLo: rect.lo[ci], acHi: rect.hi[ci],
    point: (rho, ac) => { const p = [0, 0, 0]; p[k] = plane; p[run] = rho; p[across] = ac; return p; },
  };
}

/** Fitting positions along [lo, hi] (m): `inset` from each end, at most `spacing` apart; one in the middle if short. */
export function fittingPositions(lo, hi, { inset = 0.037, spacing = 0.3 } = {}) {
  const len = hi - lo;
  if (len < 2 * inset + 0.03) return [(lo + hi) / 2];
  const n = Math.max(2, Math.ceil((len - 2 * inset) / spacing - 1e-9) + 1);
  return Array.from({ length: n }, (_, i) => lo + inset + ((len - 2 * inset) * i) / (n - 1));
}

/** The edge member's face a cam or bracket sits on → its outward world normal. */
function chooseFace(E, eb, k, want) {
  const thin = [0, 1, 2].filter((i) => i !== k && thinOn(eb, i));
  const ax = thin.length ? thin[0] : [0, 1, 2].filter((i) => i !== k).reduce((m, i) => (eb.size[i] < eb.size[m] ? i : m));
  const NAMES = { top: [2, 1], bottom: [2, -1], front: [1, -1], back: [1, 1], left: [0, -1], right: [0, 1] };
  if (typeof want === 'string') {
    const m = /^([+-])([xyz])$/.exec(want); const [i, s] = m ? ['xyz'.indexOf(m[2]), m[1] === '+' ? 1 : -1] : (NAMES[want] || []);
    if (i === ax) return axisVec(ax, s);
  }
  // the hidden side: a horizontal member's underside, else the side toward the back (+y), else toward +x
  if (ax === 2) return axisVec(2, -1);
  return axisVec(ax, 1);
}

/** Convert a world point / direction to member M's local frame (the frame its subs and pieces live in). */
const L = (M, p) => toLocal(M.F, p);
const Ld = (M, v) => [dot(v, M.F.ex), dot(v, M.F.ey), dot(v, M.F.ez)];

/** Place part `code` at world `at` along world `axis`, seated in `host` → a piece; cut its bore from `cuts` members. */
function place(out, J, { code, part, at, axis, spin, host, cuts = [], through = 0, material, idx, pre, needs }) {
  const P = part || hardwarePart(code);
  const id = `${J.label}:${P.family}${idx !== undefined ? idx + 1 : ''}`;
  out.pieces.push({ id, kind: P.family, host, material: 'hardware', finish: P.finish, code: P.code, massG: P.massG, polys: partPolys(P, { at: L(host, at), axis: Ld(host, axis), ...(spin ? { spin: Ld(host, spin) } : {}) }), ...(pre ? { pre } : {}) });
  for (const M of cuts) {
    const t = boreTerm(P, { at: L(M, at), axis: Ld(M, axis), through, material: material || materialClass(M) });
    if (t) M.subs.push(t);
  }
  // a fitting seated in one part before assembly goes in along its axis; a screw after the parts it crosses
  out.edges.push({ a: id, b: host.id, dirs: [axis], piece: true, needs: needs || (pre ? [host.id] : [...new Set([host.id, ...cuts.map((M) => M.id)])]) });
  return id;
}
/** A plain round hole in M (world `at`, `axis`, from s0 to s1 mm along it, ⌀ mm): the cam bolt's passage. */
function holeIn(M, at, axis, s0, s1, d) {
  const a = L(M, add(at, scl(axis, s0 * MM))), b = L(M, add(at, scl(axis, s1 * MM)));
  M.subs.push({ kind: 'lathe', axisFrom: a, axisTo: b, profile: [{ t: 0, radius: (d / 2) * MM }, { t: 1, radius: (d / 2) * MM }] });
}

/** The dowel a panel thickness takes (mm): 6 in thin stock, 8 in 16–21 mm, 10 above. */
const dowelFor = (tMm) => (tMm < 15 ? 'dowel-6x30' : tMm < 22 ? 'dowel-8x35' : 'dowel-10x40');

/** A fastener's report row: how far it bites, whether it pokes out, whether it goes into an edge. */
function fastenerRow(P, c, { throughMm, into = c.E, intoEdge = true }) {
  const len = P.length;
  const ib = worldBox(into);
  const avail = ib.size[c.k] * 1000;
  const pen = len - throughMm;
  return { code: P.code, into: into.id, material: materialClass(into), intoEdge, throughMm: r1(throughMm), penMm: r1(pen), pokeMm: r1(Math.max(0, pen - avail)), edgeMm: r1(Math.min(...[0, 1, 2].filter((i) => i !== c.k).map((i) => ib.size[i] * 1000)) / 2 - (P.d || 0) / 2) };
}

// ─── the joints ────────────────────────────────────────────────────────────────────────────────────────────────────

function dowelJoint(J, A, B, out) {
  const c = contact(J, A, B);
  const tE = Math.min(...[0, 1, 2].filter((i) => i !== c.k).map((i) => c.eb.size[i])) * 1000;
  const P = hardwarePart(J.dowel || dowelFor(tE));
  const tF = c.fb.size[c.k] * 1000;
  const intoF = Math.min(P.length / 2, Math.max(6, tF * 0.65));
  const ac = (c.acLo + c.acHi) / 2;
  const pos = fittingPositions(c.runLo, c.runHi, { inset: 0.032, spacing: J.spacing ? J.spacing * MM : 0.15 });
  const rows = [];
  pos.forEach((rho, i) => {
    const at = add(c.point(rho, ac), scl(c.n, (P.length / 2 - intoF) * MM));
    place(out, J, { part: P, at, axis: c.n, host: c.E, cuts: [c.E, c.F], idx: i, pre: c.E.id });
    rows.push(fastenerRow(P, c, { throughMm: intoF }));
  });
  out.edges.push({ a: c.E.id, b: c.F.id, dirs: [scl(c.n, -1)] });
  out.report.push({ joint: J.label, type: 'dowel', a: A.id, b: B.id, face: c.F.id, edge: c.E.id, fasteners: summarize(rows), rigidity: rigidityOf(J) });
}

function camJoint(J, A, B, out) {
  const c = contact(J, A, B);
  const cam = hardwarePart('cam-15'), bolt = hardwarePart('cam-bolt-15');
  const m = chooseFace(c.E, c.eb, c.k, J.face);
  const mk = m.findIndex((v) => v !== 0);
  const tE = c.eb.size[mk] * 1000;
  const eMid = (c.eb.lo[mk] + c.eb.hi[mk]) / 2;
  const withDowels = J.dowels !== false;
  const dw = hardwarePart(dowelFor(tE));
  const tF = c.fb.size[c.k] * 1000;
  const intoF = Math.min(dw.length / 2, Math.max(6, tF * 0.65));
  const pos = fittingPositions(c.runLo, c.runHi, { inset: 0.037, spacing: J.spacing ? J.spacing * MM : 0.3 });
  const mid = (c.runLo + c.runHi) / 2;
  const rows = []; const camRows = [];
  pos.forEach((rho, i) => {
    const p = c.point(rho, eMid);
    // the cam: its centre `edgeDist` into the edge member, flush with the chosen face
    const camAt = add(add(p, scl(c.n, cam.edgeDist * MM)), scl(m, (tE / 2) * MM));
    place(out, J, { part: cam, at: camAt, axis: scl(m, -1), host: c.E, cuts: [c.E], idx: i, pre: c.E.id });
    // the bolt: screwed into the face member, its ball reaching the cam through a ⌀8 passage in the edge
    place(out, J, { part: bolt, at: p, axis: scl(c.n, -1), host: c.F, cuts: [c.F], idx: i, pre: c.F.id, material: materialClass(c.F) });
    holeIn(c.E, p, c.n, -0.5, cam.edgeDist, 8);
    camRows.push({ floorMm: r1(tE - cam.bore.depth) });
    rows.push({ ...fastenerRow(bolt, c, { throughMm: 0, into: c.F, intoEdge: false }), penMm: bolt.into, pokeMm: r1(Math.max(0, bolt.into + 2 - tF)) });
    if (withDowels && pos.length > 1) {
      const rd = rho + Math.sign(mid - rho) * 0.032;
      const at = add(c.point(rd, eMid), scl(c.n, (dw.length / 2 - intoF) * MM));
      place(out, J, { part: dw, at, axis: c.n, host: c.F, cuts: [c.E, c.F], idx: i, pre: c.F.id });
      rows.push(fastenerRow(dw, c, { throughMm: intoF }));
    }
  });
  out.edges.push({ a: c.E.id, b: c.F.id, dirs: [scl(c.n, -1)] });
  out.report.push({ joint: J.label, type: 'cam-lock', a: A.id, b: B.id, face: c.F.id, edge: c.E.id, camFace: faceName(m), cams: pos.length, camFloorMm: Math.min(...camRows.map((r) => r.floorMm)), fasteners: summarize(rows), rigidity: rigidityOf(J) });
}

/** A screw through the face member into the edge member: a confirmat or a wood screw. */
function screwJoint(J, A, B, out, kind) {
  const c = contact(J, A, B);
  const tF = c.fb.size[c.k] * 1000;
  const tE = Math.min(...[0, 1, 2].filter((i) => i !== c.k).map((i) => c.eb.size[i])) * 1000;
  const intoEdge = !thinOn(c.eb, c.k);
  let code = J.screw;
  if (!code) {
    if (kind === 'confirmat') code = tF <= 19 ? 'confirmat-7x50' : 'confirmat-7x70';
    else {
      // long enough to bite 5 diameters (4 at least, and 12 mm), never so long it comes out of the far side of a
      // face-to-face; a thinner screw before a short one
      const cap = intoEdge ? Infinity : tF + c.eb.size[c.k] * 1000 - 3;
      const Ls = [16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80].filter((l) => l <= cap);
      const pick = (want) => { for (const d of tF <= 6 ? [3.5, 3] : [4, 3.5, 3]) { const L = Ls.find((l) => l >= tF + Math.max(want * d, 12)); if (L) return `wood-${d}x${L}`; } return null; };
      code = pick(5) || pick(4) || `wood-3x${Ls[Ls.length - 1] || 16}`;
    }
  }
  const P = hardwarePart(code);
  const ac = (c.acLo + c.acHi) / 2;
  const pos = fittingPositions(c.runLo, c.runHi, { inset: kind === 'confirmat' ? 0.05 : 0.04, spacing: J.spacing ? J.spacing * MM : kind === 'confirmat' ? 0.3 : 0.2 });
  const rows = [];
  pos.forEach((rho, i) => {
    const outer = add(c.point(rho, ac), scl(c.n, -tF * MM));        // the face member's far face, where the head sits
    place(out, J, { part: P, at: outer, axis: c.n, host: c.F, cuts: [c.F, c.E], through: tF, material: materialClass(c.E), idx: i });
    rows.push(fastenerRow(P, c, { throughMm: tF, intoEdge }));
  });
  out.edges.push({ a: c.E.id, b: c.F.id, dirs: [scl(c.n, -1)] });
  out.report.push({ joint: J.label, type: kind, a: A.id, b: B.id, face: c.F.id, edge: c.E.id, edgeThickMm: r1(tE), fasteners: summarize(rows), rigidity: rigidityOf(J) });
}

function shelfPinJoint(J, A, B, out) {
  // a is the shelf, b the side it rests against
  const c = contact({ ...J, through: 'b' }, A, B);
  const P = hardwarePart('shelf-pin-5');
  const pos = fittingPositions(c.runLo, c.runHi, { inset: 0.037, spacing: 1 });
  // the pin under the shelf: its axis at the shelf's underside less its radius (a horizontal shelf: across is z)
  const acPin = c.acLo - (P.d / 2) * MM;
  // pins go in when the shelf does (a builder sets the height then), not before the carcass is up
  pos.forEach((rho, i) => place(out, J, { part: P, at: c.point(rho, acPin), axis: scl(c.n, -1), host: c.F, cuts: [c.F], idx: i, needs: [c.F.id, c.E.id] }));
  const runV = axisVec(c.run, 1);
  out.edges.push({ a: c.E.id, b: c.F.id, dirs: [runV, scl(runV, -1), [0, 0, -1]] });
  // the 32 mm system: holes on a line 37 mm from the front, 32 mm apart from the side's foot
  const foot = c.fb.lo[2];
  const hMm = (acPin - foot) * 1000; const off = r1(((hMm - 37) % 32 + 32) % 32);
  out.report.push({ joint: J.label, type: 'shelf-pin', a: A.id, b: B.id, pins: pos.length, heightMm: r1(hMm), gridOffMm: off > 16 ? r1(off - 32) : off, rigidity: rigidityOf(J) });
}

function bracketJoint(J, A, B, out) {
  const c = contact(J, A, B);
  const P = hardwarePart(J.bracket || 'bracket-L40');
  const m = chooseFace(c.E, c.eb, c.k, J.face);
  const mk = m.findIndex((v) => v !== 0);
  const faceAt = m[mk] > 0 ? c.eb.hi[mk] : c.eb.lo[mk];
  const halfW = (P.width / 2) * MM;
  const pos = fittingPositions(c.runLo + halfW, c.runHi - halfW, { inset: 0.06, spacing: J.spacing ? J.spacing * MM : 0.6 });
  // each leg's screw: the catalog's, or shorter where it would come out of the far side of a thin part
  const screwFor = (thickMm) => { const s0 = hardwarePart(P.screw); if (s0.length - P.t <= thickMm - 3) return s0; const L = [10, 12, 14, 16, 20].filter((l) => l - P.t <= thickMm - 3).pop() || 10; return hardwarePart(`wood-3x${L}`); };
  const rows = [];
  pos.forEach((rho, i) => {
    const at = c.point(rho, 0); at[mk] = faceAt;
    const axis = scl(c.n, -1);
    place(out, J, { part: P, at, axis, host: c.E, idx: i });
    // partPolys takes the bracket's frame: `axis` into surface 1 (the face member), `spin` along surface 2's normal
    out.pieces[out.pieces.length - 1].polys = partPolys(P, { at: L(c.E, at), axis: Ld(c.E, axis), spin: Ld(c.E, m) });
    bracketHoles(P, { at, axis, spin: m }).forEach((h, j) => {
      const into = h.leg === 1 ? c.F : c.E;
      const screw = screwFor(worldBox(into).size[h.leg === 1 ? c.k : mk] * 1000);
      place(out, J, { part: screw, at: h.at, axis: h.axis, host: into, cuts: [into], idx: i * 4 + j });
      rows.push({ code: screw.code, into: into.id, material: materialClass(into), intoEdge: false, penMm: r1(screw.length - P.t), pokeMm: r1(Math.max(0, screw.length - P.t - worldBox(into).size[h.leg === 1 ? c.k : mk] * 1000)) });
    });
  });
  out.edges.push({ a: c.E.id, b: c.F.id, dirs: [scl(c.n, -1)] });
  out.report.push({ joint: J.label, type: 'bracket', a: A.id, b: B.id, face: c.F.id, edge: c.E.id, brackets: pos.length, code: P.code, fasteners: summarize([...pos.map(() => ({ code: P.code })), ...rows]), rigidity: rigidityOf(J) });
}

/** The edge member housed in a trench across the face member, a third of its thickness deep. */
function dadoJoint(J, A, B, out) {
  const c = contact(J, A, B);
  const tF = c.fb.size[c.k];
  const depth = c.overlap > 0.0005 ? c.overlap : (J.depth ? J.depth * MM : tF / 3);
  // the housing, in world: the contact footprint, `depth` into the face member (plus a working clearance across)
  const lo = [0, 0, 0], hi = [0, 0, 0];
  lo[c.run] = c.runLo - 0.002; hi[c.run] = c.runHi + 0.002;
  lo[c.across] = c.acLo - 0.0002; hi[c.across] = c.acHi + 0.0002;
  const inner = c.plane - c.s * depth;
  lo[c.k] = Math.min(inner, c.plane + c.s * 0.001); hi[c.k] = Math.max(inner, c.plane + c.s * 0.001);
  c.F.subs.push(localBox(c.F, lo, hi));
  if (!(c.overlap > 0.0005)) {
    const elo = lo.slice(), ehi = hi.slice(); elo[c.run] = c.runLo; ehi[c.run] = c.runHi; elo[c.across] = c.acLo; ehi[c.across] = c.acHi;
    elo[c.k] = Math.min(inner + c.s * 0.0005, c.plane + c.s * 0.001); ehi[c.k] = Math.max(inner + c.s * 0.0005, c.plane + c.s * 0.001);
    c.E.adds.push(localBox(c.E, elo, ehi));
  }
  const runV = axisVec(c.run, 1);
  out.edges.push({ a: c.E.id, b: c.F.id, dirs: [scl(c.n, -1), runV, scl(runV, -1)] });
  out.report.push({ joint: J.label, type: 'dado', a: A.id, b: B.id, face: c.F.id, edge: c.E.id, depthMm: r1(depth * 1000), leftMm: r1((tF - depth) * 1000), rigidity: rigidityOf(J) });
}

/** a (a back, a drawer bottom) runs into a groove in b: b loses the overlap, a slides along the groove. */
function grooveJoint(J, A, B, out) {
  const a = worldBox(A), b = worldBox(B);
  const lo = [0, 1, 2].map((k) => Math.max(a.lo[k], b.lo[k])), hi = [0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]));
  if ([0, 1, 2].some((k) => hi[k] - lo[k] <= 0.0005)) throw new Error(`joint ${J.label}: ${A.id} must run into ${B.id} by the groove's depth — author ${A.id}'s box ${Math.round(Math.min(...b.size) * 1000 / 3)} mm or so into ${B.id}`);
  const thin = [0, 1, 2].reduce((m, k) => (a.size[k] < a.size[m] ? k : m), 0);
  // the groove's depth is the shallower of the two overlaps across a's face; its run the longer
  const depthAx = [0, 1, 2].filter((k) => k !== thin).reduce((m, k) => (hi[k] - lo[k] < hi[m] - lo[m] ? k : m));
  const runAx = [0, 1, 2].find((k) => k !== thin && k !== depthAx);
  const glo = lo.slice(), ghi = hi.slice();
  glo[thin] -= 0.0003; ghi[thin] += 0.0003;
  // clearance past a's edge at the groove's bottom; open through b's face where a enters
  if (a.hi[depthAx] < b.hi[depthAx] - 1e-6) ghi[depthAx] += 0.0005; else ghi[depthAx] += 0.001;
  if (a.lo[depthAx] > b.lo[depthAx] + 1e-6) glo[depthAx] -= 0.0005; else glo[depthAx] -= 0.001;
  // run the groove out through b where a reaches b's end
  if (a.lo[runAx] <= b.lo[runAx] + 1e-6) glo[runAx] -= 0.002;
  if (a.hi[runAx] >= b.hi[runAx] - 1e-6) ghi[runAx] += 0.002;
  B.subs.push(localBox(B, glo, ghi));
  // a slides along the groove, or drops straight into it (toward b across the depth); it bears nothing
  const runV = axisVec(runAx, 1);
  const into = axisVec(depthAx, Math.sign(b.c[depthAx] - a.c[depthAx]) || 1);
  out.edges.push({ a: A.id, b: B.id, dirs: [runV, scl(runV, -1), into], bears: false });
  out.report.push({ joint: J.label, type: 'groove', a: A.id, b: B.id, widthMm: r1((a.size[thin] + 0.0006) * 1000), depthMm: r1((hi[depthAx] - lo[depthAx]) * 1000), rigidity: rigidityOf(J) });
}

/**
 * A door on a side: a concealed cup hinge 100 mm from each end of the door (more on a tall door: 3 past 900 mm, 4 past
 * 1600, 5 past 2000), the cup 21.5 mm in from the door's edge on the hinge side, the plate on the side's inside face
 * 37 mm back. a is the door, b the side it hangs on; the door clips on toward the side.
 */
function hingeJoint(J, A, B, out) {
  const c = contact({ ...J, through: 'a' }, A, B);                  // the door's face on the side's front edge
  const P = hardwarePart('hinge-35'); const screw = hardwarePart(P.screw);
  const door = c.fb, side = c.eb;
  const H = door.size[2], Hmm = H * 1000;
  const n = Hmm > 2000 ? 5 : Hmm > 1600 ? 4 : Hmm > 900 ? 3 : 2;
  const zs = Array.from({ length: n }, (_, i) => door.lo[2] + 0.1 + ((H - 0.2) * i) / (n - 1));
  // the hinge edge: the door's edge over this side; the cup sits inward from it, the plate on the side's inner face
  const toward = Math.sign(door.c[0] - side.c[0]) || 1;               // from the side toward the door's middle
  const edgeX = toward > 0 ? door.lo[0] : door.hi[0];
  const innerX = toward > 0 ? side.hi[0] : side.lo[0];
  const rows = [];
  zs.forEach((z, i) => {
    const cup = [0, 0, 0]; cup[0] = edgeX + toward * P.edgeDist * MM; cup[c.k] = c.plane; cup[2] = z;
    const plate = [innerX, c.plane + c.s * P.setback * MM, z];
    const spin = [plate[0] - cup[0], plate[1] - cup[1], plate[2] - cup[2]];
    place(out, J, { part: P, at: cup, axis: scl(c.n, -1), spin, host: c.F, cuts: [c.F], idx: i });
    for (const [j, dz] of [[0, -0.016], [1, 0.016]]) {
      place(out, J, { part: screw, at: [innerX, plate[1], z + dz], axis: [-toward, 0, 0], host: c.E, cuts: [c.E], idx: i * 2 + j, needs: [c.E.id, c.F.id] });
      rows.push({ code: screw.code, into: c.E.id, material: materialClass(c.E), intoEdge: false, penMm: screw.length, pokeMm: r1(Math.max(0, screw.length - side.size[0] * 1000)) });
    }
  });
  out.edges.push({ a: c.F.id, b: c.E.id, dirs: [c.n], bears: false });
  out.report.push({ joint: J.label, type: 'hinge', a: A.id, b: B.id, hinges: n, fasteners: summarize([...zs.map(() => ({ code: P.code })), ...rows]), rigidity: rigidityOf(J) });
}

/**
 * A drawer runs on a ball-bearing slide: a is the drawer's side, b the carcass side beside it, 12.7 mm apart (the
 * slide's thickness). The slide is the longest standard one that fits the drawer's depth; the drawer slides in from
 * the front.
 */
function slideJoint(J, A, B, out) {
  const a = worldBox(A), b = worldBox(B);
  const gap = Math.max(a.lo[0] - b.hi[0], b.lo[0] - a.hi[0]);
  if (!(gap > 0.005 && gap < 0.03)) throw new Error(`joint ${J.label}: a drawer side runs 12.7 mm from the carcass side it slides on — ${A.id} is ${r1(gap * 1000)} mm from ${B.id}`);
  const depth = a.size[1] * 1000;
  const Ls = [250, 300, 350, 400, 450, 500, 550];
  const len = J.length || [...Ls].reverse().find((l) => l <= depth) || 250;
  const P = hardwarePart(`slide-${len}`);
  const toward = Math.sign(a.c[0] - b.c[0]);
  const faceX = toward > 0 ? b.hi[0] : b.lo[0];
  const at = [faceX, a.lo[1] + 0.002, a.c[2]];
  place(out, J, { part: P, at, axis: [-toward, 0, 0], spin: [0, 1, 0], host: B, needs: [B.id], pre: B.id });
  out.edges.push({ a: A.id, b: B.id, dirs: [[0, 1, 0]], bears: false });
  out.report.push({ joint: J.label, type: 'slide', a: A.id, b: B.id, slide: P.code, gapMm: r1(gap * 1000), ...(Math.abs(gap * 1000 - P.t) > 1 ? { advice: `the slide wants ${P.t} mm; the drawer side is ${r1(gap * 1000)} mm off the carcass` } : {}), fasteners: [{ code: P.code, count: 1 }], rigidity: rigidityOf(J) });
}

/**
 * A corner of two boards that overlap there (each authored through the other's thickness): the overlap is split along
 * the boards' shared width into cells, and each board loses the other's.
 *   · 'dovetail' — a carries the tails, b the pins: trapezoids in the plane of a's face that widen toward a's end at
 *     `slope` (1:6 softwood, 1:8 hardwood, 1:7 a sheet), half pins at both edges, `tails` of them (default one per
 *     ~2.5 thicknesses of width). a goes on across its own face, the only way a dovetail assembles; pulled along
 *     its length it locks — what the joint is for.
 *   · 'finger' — square fingers, `fingers` of them (odd; b keeps the outer two); it goes together either way.
 */
function cornerJoint(J, A, B, out, kind) {
  const a = worldBox(A), b = worldBox(B);
  const lo = [0, 1, 2].map((k) => Math.max(a.lo[k], b.lo[k])), hi = [0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]));
  if ([0, 1, 2].some((k) => hi[k] - lo[k] <= 0.0005)) throw new Error(`joint ${J.label}: a ${kind} needs ${A.id} and ${B.id} to overlap at the corner — run each board through the other's thickness`);
  const thinA = [0, 1, 2].reduce((m, k) => (a.size[k] < a.size[m] ? k : m), 0), thinB = [0, 1, 2].reduce((m, k) => (b.size[k] < b.size[m] ? k : m), 0);
  if (thinA === thinB) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} lie in parallel planes — a ${kind} joins boards at a corner`);
  const r = [0, 1, 2].find((k) => k !== thinA && k !== thinB);          // the shared width the cells run along
  const W = hi[r] - lo[r], tb = hi[thinB] - lo[thinB];
  // along b's thickness, which way is a's end (outward): away from a's body
  const out1 = Math.sign((lo[thinB] + hi[thinB]) / 2 - a.c[thinB]) || 1;
  const inner = out1 > 0 ? lo[thinB] : hi[thinB];                        // b's inner face: where the tails are narrowest
  const cellsB = [], cellsA = [];                                        // polygons in (r, thinB), world
  const P = (rr, t) => [rr, t];
  if (kind === 'finger') {
    let n = Number.isInteger(J.fingers) && J.fingers >= 3 ? J.fingers : Math.max(3, Math.round(W / Math.max(tb, 0.006)));
    if (n % 2 === 0) n += 1;
    for (let i = 0; i < n; i++) {
      const r0 = lo[r] + (W * i) / n, r1 = lo[r] + (W * (i + 1)) / n;
      const poly = [P(r0, lo[thinB]), P(r1, lo[thinB]), P(r1, hi[thinB]), P(r0, hi[thinB])];
      (i % 2 === 0 ? cellsB : cellsA).push(poly);                         // b keeps the even (outer) fingers
    }
  } else {
    const soft = A.material === 'timber' && TIMBERS[A.species] && TIMBERS[A.species].group === 'softwood';
    const slope = Number.isFinite(J.slope) ? J.slope : A.material !== 'timber' ? 1 / 7 : soft ? 1 / 6 : 1 / 8;
    const n = Number.isInteger(J.tails) && J.tails >= 1 ? J.tails : Math.max(1, Math.round(W / (2.5 * tb)));
    const p = W / n, half = 0.3 * p;                                     // a tail is 60 % of its pitch at b's inner face
    const edges = [];
    for (let i = 0; i < n; i++) {
      const c = lo[r] + p * (i + 0.5), flare = slope * tb;
      const inL = c - half, inR = c + half, outL = inL - flare, outR = inR + flare;
      const tIn = inner, tOut = inner + out1 * tb;
      cellsA.push([P(inL, tIn), P(inR, tIn), P(outR, tOut), P(outL, tOut)]);
      edges.push({ inL, inR, outL, outR });
    }
    // pins (and a half pin at each edge) between the tails, what a loses
    const tIn = inner, tOut = inner + out1 * tb;
    const bounds = [{ inR: lo[r] - 0.001, outR: lo[r] - 0.001 }, ...edges, { inL: hi[r] + 0.001, outL: hi[r] + 0.001 }];
    for (let i = 0; i + 1 < bounds.length; i++) {
      const L0 = bounds[i], R0 = bounds[i + 1];
      cellsB.push([P(L0.inR, tIn), P(R0.inL, tIn), P(R0.outL, tOut), P(L0.outR, tOut)]);
    }
  }
  // each cell is a prism through the overlap along a's thickness, built in the member it cuts; a loses b's, b loses a's
  const prismOf = (poly, M) => {
    const pts = poly.map(([rr, t]) => { const v = [0, 0, 0]; v[r] = rr; v[thinB] = t; return v; });
    const c = pts.reduce((sum, v) => add(sum, v), [0, 0, 0]).map((x) => x / pts.length);
    const from = c.slice(), to = c.slice(); from[thinA] = lo[thinA] - 0.001; to[thinA] = hi[thinA] + 0.001;
    return extrudeTerm(L(M, from), L(M, to), pts.map((v) => Ld(M, [v[0] - c[0], v[1] - c[1], v[2] - c[2]])));
  };
  for (const poly of cellsB) A.subs.push(prismOf(poly, A));
  for (const poly of cellsA) B.subs.push(prismOf(poly, B));
  const along = axisVec(thinA, Math.sign(b.c[thinA] - a.c[thinA]) || 1);  // a onto b, across a's face
  const alongB = axisVec(thinB, -out1);
  out.edges.push({ a: A.id, b: B.id, dirs: kind === 'finger' ? [along, alongB] : [along] });
  out.report.push({ joint: J.label, type: kind, a: A.id, b: B.id, ...(kind === 'finger' ? { fingers: cellsA.length + cellsB.length } : { tails: cellsA.length }), widthMm: r1(W * 1000), rigidity: rigidityOf(J) });
}

/**
 * An extruded prism from `from` to `to` (M-local) whose cross-section corners are `corners` (offsets square to the
 * axis): the kernel reads a profile in perpBasisZ(axis) coordinates, so the corners are projected onto it.
 */
function extrudeTerm(from, to, corners) {
  const d = sub(to, from); const l = Math.hypot(d[0], d[1], d[2]) || 1; const u = [d[0] / l, d[1] / l, d[2] / l];
  const [e1, e2] = perpBasisZ({ x: u[0], y: u[1], z: u[2] });
  const U = [e1.x, e1.y, e1.z], V = [e2.x, e2.y, e2.z];
  const q = (v) => Math.round(v * 1e5) / 1e5;
  return { kind: 'extrude', axisFrom: from, axisTo: to, profile: { points: corners.map((c) => [q(dot(c, U)), q(dot(c, V))]) } };
}

/** A world-axis-aligned box (lo, hi) as a box term in M's local frame (M is axis-aligned). */
function localBox(M, lo, hi) {
  const a = L(M, lo), b = L(M, hi);
  return { kind: 'box', center: a.map((v, i) => (v + b[i]) / 2), size: a.map((v, i) => Math.abs(b[i] - v)) };
}

const faceName = (m) => ({ '0,0,-1': 'bottom', '0,0,1': 'top', '0,-1,0': 'front', '0,1,0': 'back', '-1,0,0': 'left', '1,0,0': 'right' })[m.join(',')] || m.join(',');

/** Rows → the joint's fastener summary: counts by code, and the worst bite / poke / edge. */
/**
 * A knock-down bolt: an M8 socket bolt through a (its face against b) with a washer under its head, into a screw-in
 * threaded insert set in b — how an upholstered section bolts to the next (an arm to the seat, a back to it). The
 * bolt is the longest standard one that stops inside the insert. `size` (M6 | M8 | M10), `spacing` (mm).
 */
function insertBoltJoint(J, A, B, out) {
  const a = worldBox(A), b = worldBox(B);
  const ov = [0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]));
  const k = [0, 1, 2].reduce((m, i) => (ov[i] < ov[m] ? i : m), 0);
  if (ov[k] < -0.002 || [0, 1, 2].some((i) => i !== k && ov[i] <= 0.0005)) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} do not meet face to face — an insert-bolt passes through a into b`);
  if (!thinOn(a, k)) throw new Error(`joint ${J.label}: the bolt would run the length of ${A.id} — a is the part the bolt passes through, square to its face`);
  const s = Math.sign(b.c[k] - a.c[k]) || 1; const dir = axisVec(k, s);
  const plane = s > 0 ? a.hi[k] : a.lo[k];
  const size = J.size ? `M${String(J.size).replace(/^M/, '')}` : 'M8';
  const ins = hardwarePart(`insert-${size}`), wa = hardwarePart(`washer-${size}`);
  const tA = a.size[k] * 1000, depthB = b.size[k] * 1000;
  const L = [...BOLT_LENGTHS].reverse().find((l) => l <= tA + wa.length + ins.length - 1) || BOLT_LENGTHS[0];
  const bolt = hardwarePart(`${size}x${L}-socket`);
  const others = [0, 1, 2].filter((i) => i !== k);
  const ext = others.map((i) => ov[i]); const run = ext[0] >= ext[1] ? others[0] : others[1], across = run === others[0] ? others[1] : others[0];
  const lo = Math.max(a.lo[run], b.lo[run]), hi = Math.min(a.hi[run], b.hi[run]);
  const ac = (Math.max(a.lo[across], b.lo[across]) + Math.min(a.hi[across], b.hi[across])) / 2;
  const pos = fittingPositions(lo, hi, { inset: 0.06, spacing: J.spacing ? J.spacing * MM : 0.35 });
  const rows = [];
  pos.forEach((rho, i) => {
    const p = [0, 0, 0]; p[k] = plane; p[run] = rho; p[across] = ac;
    const far = add(p, scl(dir, -tA * MM));                          // a's far face, where the washer and head sit
    place(out, J, { part: ins, at: p, axis: dir, host: B, cuts: [B], idx: i, pre: B.id });
    place(out, J, { part: wa, at: far, axis: dir, host: A, cuts: [], idx: i, needs: [A.id, B.id] });
    place(out, J, { part: bolt, at: add(far, scl(dir, -wa.length * MM)), axis: dir, host: A, cuts: [A], through: tA, material: 'steel', idx: i, needs: [A.id, B.id] });
    rows.push({ code: bolt.code, into: B.id, penMm: r1(L - tA - wa.length), pokeMm: 0 }, { code: ins.code, into: B.id, penMm: ins.length, pokeMm: r1(Math.max(0, ins.length + 2 - depthB)) });
  });
  out.edges.push({ a: A.id, b: B.id, dirs: [dir] });
  out.report.push({ joint: J.label, type: 'insert-bolt', a: A.id, b: B.id, bolts: pos.length, bolt: bolt.code, insert: ins.code, fasteners: summarize(rows), rigidity: rigidityOf(J) });
}

/**
 * A leg on a hanger bolt: a is the leg, b what it screws up under (a corner block, a rail). The bolt's wood thread goes
 * into the leg's top (fitted first), its machine thread into an insert in b; the leg turns on by hand. A leg on one bolt
 * is a lever on it: the report gives the leg's height, and the seating check flags a tall one.
 */
function hangerBoltJoint(J, A, B, out) {
  const a = worldBox(A), b = worldBox(B);
  if (Math.abs(a.hi[2] - b.lo[2]) > 0.002) throw new Error(`joint ${J.label}: ${A.id}'s top must meet ${B.id}'s underside — a hanger bolt screws a leg up under what it carries`);
  const ov = [0, 1].map((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]));
  if (ov.some((v) => v <= 0.005)) throw new Error(`joint ${J.label}: ${A.id} is not under ${B.id}`);
  const legMm = a.size[2] * 1000, legW = Math.min(a.size[0], a.size[1]) * 1000;
  const size = legW < 32 ? 'M6' : 'M8';
  const hb = hardwarePart(J.bolt || (size === 'M6' ? 'hanger-bolt-M6x50' : 'hanger-bolt-M8x70')), ins = hardwarePart(`insert-${hb.size}`);
  const at = [(Math.max(a.lo[0], b.lo[0]) + Math.min(a.hi[0], b.hi[0])) / 2, (Math.max(a.lo[1], b.lo[1]) + Math.min(a.hi[1], b.hi[1])) / 2, a.hi[2]];
  place(out, J, { part: ins, at, axis: [0, 0, 1], host: B, cuts: [B], pre: B.id });
  place(out, J, { part: hb, at, axis: [0, 0, -1], host: A, cuts: [A], pre: A.id, material: materialClass(A) });
  out.edges.push({ a: A.id, b: B.id, dirs: [[0, 0, 1]] });
  const rows = [{ code: hb.code, into: A.id, penMm: hb.wood, pokeMm: r1(Math.max(0, hb.wood + 2 - legMm)) }, { code: ins.code, into: B.id, penMm: ins.length, pokeMm: r1(Math.max(0, ins.length + 2 - b.size[2] * 1000)) }];
  out.report.push({ joint: J.label, type: 'hanger-bolt', a: A.id, b: B.id, legMm: r1(legMm), bolt: hb.code, fasteners: summarize(rows), rigidity: rigidityOf(J) });
}

/**
 * Sinuous springs from a (the front seat rail) to b (the back one): zigzag wire hooked into a clip on each rail's top,
 * `pitch` (mm, default 110) apart across the seat, arched `arc` (20 mm) above the rails. The wire is the trade's rule
 * of thumb for the span: 8 gauge past 500 mm, 9 under (`gauge` to choose). The springs carry the seat into the rails.
 */
function springsJoint(J, A, B, out) {
  const a = worldBox(A), b = worldBox(B);
  const [F, K, fb, kb] = a.c[1] <= b.c[1] ? [A, B, a, b] : [B, A, b, a];
  const x0 = Math.max(fb.lo[0], kb.lo[0]), x1 = Math.min(fb.hi[0], kb.hi[0]);
  if (x1 - x0 < 0.1) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} do not face each other across a seat`);
  const clip = hardwarePart('spring-clip');
  const y0 = fb.hi[1] - (clip.length / 2) * MM, y1 = kb.lo[1] + (clip.length / 2) * MM;
  const zTop = Math.max(fb.hi[2], kb.hi[2]);
  const span = y1 - y0;
  const gauge = J.gauge || (span > 0.5 ? 8 : 9);
  const P = hardwarePart(`sinuous-${gauge}g`);
  if (!P) throw new Error(`joint ${J.label}: gauge ${gauge} — a sinuous spring is 8, 9, 10, 11 or 12 gauge`);
  const pitch = (J.pitch || 110) * MM, arc = (J.arc !== undefined ? J.arc : 20) * MM;
  const xs = fittingPositions(x0, x1, { inset: 0.05, spacing: pitch });
  const amp = 0.028, period = 0.05, rw = (P.d / 2) * MM;
  const z0 = zTop + clip.h * MM * 0.6;
  let wireM = 0;
  xs.forEach((x, i) => {
    const n = Math.max(24, Math.round((span / period) * 12));
    const path = []; let wire = 0;
    for (let j = 0; j <= n; j++) {
      const t = j / n, y = y0 + t * span, env = Math.min(1, Math.min(t, 1 - t) * span / 0.03);   // straight into each clip
      path.push([x + amp * env * Math.sin((2 * Math.PI * (y - y0)) / period), y, z0 + arc * 4 * t * (1 - t)]);
      if (j) wire += Math.hypot(...path[j].map((v, q) => v - path[j - 1][q]));
    }
    const id = `${J.label}:spring${i + 1}`;
    out.pieces.push({ id, kind: 'spring', host: F, material: 'hardware', finish: P.finish, code: P.code, massG: Math.round(P.gPerM * wire), polys: tubePolys(path, rw, { sides: 6 }).map((q) => ({ corners: q.corners.map((c) => L(F, c)), n: Ld(F, q.n) })) });
    out.edges.push({ a: id, b: F.id, dirs: [[0, 0, -1]], piece: true, needs: [F.id, K.id] });
    place(out, J, { part: clip, at: [x, y0, fb.hi[2]], axis: [0, 0, -1], spin: [0, 1, 0], host: F, idx: 2 * i, needs: [F.id, K.id] });
    place(out, J, { part: clip, at: [x, y1, kb.hi[2]], axis: [0, 0, -1], spin: [0, 1, 0], host: K, idx: 2 * i + 1, needs: [F.id, K.id] });
    wireM = wire;
  });
  const wireMm = Math.round(wireM * 1000);
  out.report.push({ joint: J.label, type: 'springs', a: A.id, b: B.id, springs: xs.length, gauge, code: P.code, spanMm: Math.round(span * 1000), pitchMm: xs.length > 1 ? Math.round(((xs[xs.length - 1] - xs[0]) / (xs.length - 1)) * 1000) : null, arcMm: Math.round(arc * 1000), wireMm, rigidity: rigidityOf(J) });
}

function summarize(rows) {
  const by = new Map();
  for (const r of rows) {
    const e = by.get(r.code) || { code: r.code, count: 0 }; e.count++;
    for (const k of ['penMm', 'edgeMm']) if (r[k] !== undefined) e[k] = e[k] === undefined ? r[k] : Math.min(e[k], r[k]);
    if (r.pokeMm !== undefined) e.pokeMm = Math.max(e.pokeMm || 0, r.pokeMm);
    for (const k of ['into', 'material', 'intoEdge', 'throughMm']) if (r[k] !== undefined && e[k] === undefined) e[k] = r[k];
    by.set(r.code, e);
  }
  return [...by.values()];
}

/** How a joint holds its corner: its type's rigidity, or 'moment' when a fastened joint is glued. */
export const rigidityOf = (J) => (J.glue === true && ['dowel', 'confirmat', 'screwed', 'dado'].includes(J.type) ? 'moment' : RIGIDITY[J.type] || 'pin');

/** Apply one furniture joint (joints.js dispatches here). */
export function applyFurnitureJoint(J, A, B, out) {
  switch (J.type) {
    case 'dowel': return dowelJoint(J, A, B, out);
    case 'cam-lock': return camJoint(J, A, B, out);
    case 'confirmat': return screwJoint(J, A, B, out, 'confirmat');
    case 'screwed': return screwJoint(J, A, B, out, 'screwed');
    case 'shelf-pin': return shelfPinJoint(J, A, B, out);
    case 'bracket': return bracketJoint(J, A, B, out);
    case 'dado': return dadoJoint(J, A, B, out);
    case 'groove': return grooveJoint(J, A, B, out);
    case 'hinge': return hingeJoint(J, A, B, out);
    case 'slide': return slideJoint(J, A, B, out);
    case 'dovetail': return cornerJoint(J, A, B, out, 'dovetail');
    case 'finger': return cornerJoint(J, A, B, out, 'finger');
    case 'insert-bolt': return insertBoltJoint(J, A, B, out);
    case 'hanger-bolt': return hangerBoltJoint(J, A, B, out);
    case 'springs': return springsJoint(J, A, B, out);
    default: throw new Error(`unknown furniture joint '${J.type}'`);
  }
}
