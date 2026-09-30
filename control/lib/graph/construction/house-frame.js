// construction/house-frame — the structure under a house's skin, read from the house itself. A house (floorplan kind,
// `storeys` or `levels`) carries `framing: { system, view?, … }`; this module walks the storeys, wall runs, openings,
// stair voids and roof the house generator already computed and lays the members a builder would, as `frames` entries
// (frame.js) in feet, the house's unit. Nothing here designs a structure: the framing follows the plan it is given, and
// what it cannot follow it says in `notes`.
//
// Systems:
//   · 'platform' — the North American stick frame: studs at 16 in on a bottom plate under a doubled top plate, king
//     and jack studs, a header sized to the opening, cripples over it and under a window's rough sill; each floor a rim
//     and joists on the walls below, with a flush girder where the span passes 16 ft and trimmers and headers round a
//     stair; the lowest floor on a sill plate, a concrete stem wall and a reinforced footing, its girder on posts.
//   · 'masonry' — outer walls of brick a brick thick (English bond), openings under soldier courses; floors and roof
//     in timber bearing on the brickwork; inner walls stud partitions.
//   · 'post-and-beam' — a Western timber frame: 8×8 posts at the corners and at most 12 ft apart round the walls and
//     along the girder lines, girts at each floor, plates at the top, knee braces at the plates, all mortise and tenon.
//   · 'kigumi' — the Japanese frame: a dodai sill on the foundation, 4-sun hinoki posts at no more than one ken
//     (6 shaku) along every wall and beside every opening, hozo into the dodai and the top beams, nuki through the posts
//     at three heights, sugi hari across at each ken, neda joists at one shaku; the roof a wagoya: koyazuka struts on
//     the hari carrying moya purlins, a munagi ridge and taruki rafters.
//   · 'steel' — HEA columns on base plates and pads at a grid of at most 16 ft, IPE beams bolted to them round each
//     floor and along the grid lines, IPE joists at 4 ft under a meshed concrete deck; the roof in steel.
//   · 'concrete' — a reinforced concrete frame at the same grid: columns, beams and slabs with their cages; a pitched
//     roof in timber on the ring beam.
// The roof follows the house's roof style: gable-family forms frame as a gable, hip-family as a hip (commons, hips,
// jacks), shed and butterfly as mono-pitches, flat forms as joists; no roof, just ceiling joists.
import { lowerFrame, FRAME_DETAILS } from './frame.js';
import { TRADITION_KEYS, TRADITION_OF, TRADITIONS, CATALOG } from './catalog.js';
import { planLinings, STAGES } from './linings.js';
import { planWiring } from './wiring.js';
import { elementFaces } from './elements.js';
import { instanceGroups } from './instancing.js';
import { buildConstructionModel } from './bim.js';
import { ROOF_STYLES } from '../architecture/roof.js';
import { layCovering, COVERINGS } from './roofing.js';

export const FRAMING_SYSTEMS = Object.freeze(['platform', 'masonry', 'post-and-beam', 'kigumi', 'steel', 'concrete']);
export const FRAMING_VIEWS = Object.freeze(['framed', 'cutaway']);

const IN = 1 / 12;                      // an inch, in feet
const SHAKU = 0.303 / 0.3048;           // one shaku (尺), in feet
const KEN = 6 * SHAKU;                  // one ken (間): the Japanese bay
const MM = 1 / 304.8;                   // a millimetre, in feet
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const pt3 = (p) => p.map(r4);

/** Validate a `framing` value → string[]. */
export function validateFraming(f, at = 'framing') {
  if (f === undefined || f === false) return [];
  if (f === true) return [];
  if (!f || typeof f !== 'object') return [`${at}: true, or { system?, view?, species?, figure?, joints? }`];
  const e = [];
  if (f.system !== undefined && !FRAMING_SYSTEMS.includes(f.system)) e.push(`${at}.system: one of ${FRAMING_SYSTEMS.join(', ')}`);
  if (f.view !== undefined && !FRAMING_VIEWS.includes(f.view)) e.push(`${at}.view: one of ${FRAMING_VIEWS.join(', ')}`);
  if (f.figure !== undefined && !['flat', 'coarse', 'full'].includes(f.figure)) e.push(`${at}.figure: flat, coarse or full`);
  if (f.joints !== undefined && typeof f.joints !== 'boolean') e.push(`${at}.joints: true or false`);
  if (f.cut !== undefined && !(Number.isFinite(f.cut) && f.cut > 0 && f.cut < 1)) e.push(`${at}.cut: a fraction of the footprint's width, 0–1`);
  if (f.detail !== undefined && !FRAME_DETAILS.includes(f.detail)) e.push(`${at}.detail: one of ${FRAME_DETAILS.join(', ')}`);
  if (f.instance !== undefined && typeof f.instance !== 'boolean') e.push(`${at}.instance: true or false`);
  if (f.stage !== undefined && !STAGES.includes(f.stage)) e.push(`${at}.stage: one of ${STAGES.join(', ')}`);
  if (f.tradition !== undefined && !TRADITION_KEYS.includes(f.tradition)) e.push(`${at}.tradition: one of ${TRADITION_KEYS.join(', ')}`);
  return e;
}

/** The framing a house asks for, with its defaults. */
export function framingOf(f) {
  const g = f === true ? {} : f;
  const system = g.system || 'platform';
  return {
    system, view: g.view || 'framed', figure: g.figure || 'flat', joints: g.joints !== false, cut: Number.isFinite(g.cut) ? g.cut : 0.5,
    species: g.species, finish: g.finish, detail: g.detail || 'auto', instance: g.instance !== false,
    stage: g.stage || 'frame', tradition: g.tradition || TRADITION_OF[system],
  };
}

// ── members ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A frame under construction: members, joints, masonry; `add` returns the new member's id. */
function makeFrame(id, extra = {}) {
  const F = { id, unit: 'ft', members: [], joints: [], ...extra };
  let n = 0;
  F.add = (prefix, from, to, spec) => {
    const mid = `${prefix}-${n++}`;
    F.members.push({ id: mid, from: pt3(from), to: pt3(to), ...spec });
    return mid;
  };
  F.join = (type, a, b, opts = {}) => { F.joints.push({ type, a, b, ...opts }); };
  return F;
}
const finishFrame = (F) => { const { add, join, ...spec } = F; if (!spec.joints.length) delete spec.joints; return spec; };

/** A point on a wall run: `s` along it, `off` across it (toward +y or +x), `z` up. */
const runPoint = (run, s, off, z) => (run.orientation === 'h' ? [s, run.at + off, z] : [run.at + off, s, z]);
const runNormal = (run) => (run.orientation === 'h' ? [0, 1, 0] : [1, 0, 0]);

/** A run's ends, drawn back where another wall passes through (or, at an L corner, where the cross-wall runs past). */
function runEnds(run, runs, depthOf) {
  const trimAt = (s, sign) => {
    for (const q of runs) {
      if (q === run || q.orientation === run.orientation) continue;
      if (Math.abs(q.at - s) > 0.05 || run.at < q.along[0] - 0.05 || run.at > q.along[1] + 0.05) continue;
      const through = q.along[0] + 0.05 < run.at && run.at < q.along[1] - 0.05;
      if (through || run.orientation === 'v') return (sign * depthOf(q)) / 2;
    }
    return 0;
  };
  return [run.along[0] + trimAt(run.along[0], 1), run.along[1] + trimAt(run.along[1], -1)];
}

/** Openings on a run clipped to [s0, s1], with sill and head relative to the storey floor. */
function runOpenings(run, s0, s1, H, headroom) {
  return (run.openings || [])
    .filter((op) => op.b > s0 + 0.2 && op.a < s1 - 0.2)
    .map((op) => ({ a: Math.max(op.a, s0 + 0.25), b: Math.min(op.b, s1 - 0.25), sill: op.sill || 0, top: Math.min(op.top ?? H, H - headroom) }))
    .sort((p, q) => p.a - q.a);
}

/** Positions from s0 to s1 at `step`, both ends included, never closer than `min` to the last. */
function layout(s0, s1, step, inset = 0, min = 0.25) {
  const out = [s0 + inset];
  for (let s = s0 + step; s < s1 - inset - min; s += step) out.push(s);
  if (s1 - inset - out[out.length - 1] > 0.05) out.push(s1 - inset);
  return out;
}
/** `n` equal bays from a to b → the n + 1 lines. */
const bays = (a, b, maxBay) => { const n = Math.max(1, Math.ceil((b - a) / maxBay - 1e-9)); return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n); };

// ── walls ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const STUD = { ext: { stock: '2x6', d: 5.5 * IN }, int: { stock: '2x4', d: 3.5 * IN } };
const headerDepth = (w) => (w <= 3.5 ? 7.25 : w <= 5 ? 9.25 : 11.25) * IN;

/** A stud wall along one run: plates, studs at 16 in, and each opening's kings, jacks, header, cripples and sill. */
function studWall(F, run, runs, zb, H, timber) {
  const kind = run.interior ? STUD.int : STUD.ext;
  const [s0, s1] = runEnds(run, runs, (q) => (q.interior ? STUD.int.d : STUD.ext.d));
  if (s1 - s0 < 0.5) return;
  const N = runNormal(run), P = (s, z) => runPoint(run, s, 0, z);
  const pt = 1.5 * IN, t = 1.5 * IN;
  const flat = { stock: kind.stock, up: N, ...timber };
  const onEdge = (depth) => ({ stock: [kind.d, depth], up: [0, 0, 1], ...timber });
  const vert = { stock: kind.stock, up: N, ...timber };
  const ops = runOpenings(run, s0, s1, H, 2 * pt + 0.5);
  // bottom plate, cut out at each door
  let cur = s0;
  for (const op of ops.filter((o) => o.sill <= 1e-6)) { if (op.a - t - cur > 0.1) F.add('plate', P(cur, zb + pt / 2), P(op.a - t, zb + pt / 2), flat); cur = op.b + t; }
  if (s1 - cur > 0.1) F.add('plate', P(cur, zb + pt / 2), P(s1, zb + pt / 2), flat);
  F.add('top-plate', P(s0, zb + H - pt / 2), P(s1, zb + H - pt / 2), flat);
  F.add('top-plate', P(s0, zb + H - 1.5 * pt), P(s1, zb + H - 1.5 * pt), flat);
  const z0 = zb + pt, z1 = zb + H - 2 * pt;
  const commons = layout(s0, s1, 16 * IN, t / 2);
  const busy = (s) => ops.some((op) => s > op.a - 2 * t - 0.2 * IN && s < op.b + 2 * t + 0.2 * IN);
  for (const s of commons) if (!busy(s)) F.add('stud', P(s, z0), P(s, z1), vert);
  for (const op of ops) {
    const hd = Math.min(headerDepth(op.b - op.a), z1 - (zb + op.top) - 0.05);
    for (const [s, side] of [[op.a, -1], [op.b, 1]]) {
      F.add('king', P(s + side * 1.5 * t, z0), P(s + side * 1.5 * t, z1), vert);
      F.add('jack', P(s + side * 0.5 * t, z0), P(s + side * 0.5 * t, zb + op.top), vert);
    }
    if (hd > 0.1) F.add('header', P(op.a - t, zb + op.top + hd / 2), P(op.b + t, zb + op.top + hd / 2), onEdge(hd));
    const inside = commons.filter((s) => s > op.a + 0.1 && s < op.b - 0.1);
    const zh = zb + op.top + Math.max(hd, 0);
    if (z1 - zh > 1.5 * IN) for (const s of inside) F.add('cripple', P(s, zh), P(s, z1), vert);
    if (op.sill > 0) {
      F.add('sill', P(op.a, zb + op.sill - pt / 2), P(op.b, zb + op.sill - pt / 2), flat);
      if (zb + op.sill - pt - z0 > 1.5 * IN) for (const s of inside) F.add('cripple', P(s, z0), P(s, zb + op.sill - pt), vert);
    }
  }
}

/**
 * One brick wall up a whole outer wall line, from the foundation to the eaves: the storeys' runs on that line give its
 * length and each storey's openings, set at their height above the wall's foot (the masonry lays its own lintels).
 */
function brickWall(F, line, zFoot, zTop) {
  const s0 = Math.min(...line.map(({ run }) => run.along[0])), s1 = Math.max(...line.map(({ run }) => run.along[1]));
  const run = line[0].run;
  const openings = line.flatMap(({ run: r, zb, H }) => runOpenings(r, s0, s1, H, 0.25)
    .map((op) => ({ at: r4(op.a - s0), width: r4(op.b - op.a), height: r4(op.top - op.sill), sill: r4(op.sill + (zb - zFoot)) })));
  F.walls = F.walls || [];
  F.walls.push({ id: `brick-${F.walls.length}`, from: pt3(runPoint(run, s0, 0, zFoot)), to: pt3(runPoint(run, s1, 0, zFoot)), height: r4(zTop - zFoot), bond: 'english', body: 'red', joint: 'struck', openings });
}

// ── floors ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A floor under `zTop`: rim, joists across the short span at `spacing`, girders splitting spans past `maxSpan`,
 * trimmers and headers round each hole, and a subfloor in 4 × 8 sheets. Returns the girder lines (for posts).
 */
function joistFloor(F, fp, zTop, depth, holes, { joist, girder, spacing, maxSpan = 16, rim = true, deck = 'sheets', edgeOut = 2 * IN, under = false }) {
  const along = fp.x1 - fp.x0 >= fp.y1 - fp.y0 ? 'x' : 'y';          // girders run along the long side
  // local (u along the joists, v across them): joists span the short direction
  const [u0, u1, v0, v1] = along === 'x' ? [fp.y0, fp.y1, fp.x0, fp.x1] : [fp.x0, fp.x1, fp.y0, fp.y1];
  const W = (u, v, z) => (along === 'x' ? [v, u, z] : [u, v, z]);
  const sub = deck === 'sheets' ? 0.75 * IN : 0;
  const zj = zTop - sub - depth / 2;
  const t = joist.t;
  const up = { up: [0, 0, 1] };
  const e = edgeOut;
  const uIn0 = u0 - e + (rim ? t : 0), uIn1 = u1 + e - (rim ? t : 0);
  if (rim) {
    F.add('rim', W(u0 - e + t / 2, v0 - e, zj), W(u0 - e + t / 2, v1 + e, zj), { ...joist.spec, ...up });
    F.add('rim', W(u1 + e - t / 2, v0 - e, zj), W(u1 + e - t / 2, v1 + e, zj), { ...joist.spec, ...up });
  }
  const gl = bays(u0, u1, maxSpan).slice(1, -1);                      // girder lines, across u
  const gT = girder.t;
  // holes in (u, v)
  const H = holes.map((h) => (along === 'x' ? { u0: h.y0, u1: h.y1, v0: h.x0, v1: h.x1 } : { u0: h.x0, u1: h.x1, v0: h.y0, v1: h.y1 }));
  // girders, cut where a hole crosses them
  for (const g of gl) {
    let spans = [[v0 - e + (rim ? t : 0), v1 + e - (rim ? t : 0)]];
    for (const h of H) if (g > h.u0 - gT && g < h.u1 + gT) spans = spans.flatMap(([a, b]) => [[a, Math.min(b, h.v0 - 3 * IN)], [Math.max(a, h.v1 + 3 * IN), b]]).filter(([a, b]) => b - a > 0.3);
    // a flush girder takes the joists' ends; one `under` them (the obiki under the neda) carries them whole
    const zg = under ? zj - depth / 2 - girder.spec.stock[1] / 2 : zj;
    for (const [a, b] of spans) F.add('girder', W(g, a, zg), W(g, b, zg), { ...girder.spec, ...up });
  }
  // joists, each as the pieces between rims, girders and hole headers
  const vs = layout(v0 - e + (rim ? t : 0), v1 + e - (rim ? t : 0), spacing, t / 2);
  const trimmerV = H.flatMap((h) => [h.v0 - t / 2, h.v0 - 1.5 * t, h.v1 + t / 2, h.v1 + 1.5 * t]);
  const all = [...vs.filter((v) => !H.some((h) => v > h.v0 - 2 * t - 0.05 && v < h.v1 + 2 * t + 0.05)), ...trimmerV].sort((a, b) => a - b);
  const stops = under ? [] : gl.map((g) => [g - gT / 2, g + gT / 2]);
  for (const v of all) {
    let spans = [[uIn0, uIn1]];
    for (const [a, b] of stops) spans = spans.flatMap(([p, q]) => (a > p && b < q ? [[p, a], [b, q]] : [[p, q]]));
    for (const h of H) if (v > h.v0 && v < h.v1) spans = spans.flatMap(([p, q]) => [[p, Math.min(q, h.u0 - 2 * t)], [Math.max(p, h.u1 + 2 * t), q]]);
    for (const [p, q] of spans) if (q - p > 0.3) F.add('joist', W(p, v, zj), W(q, v, zj), { ...joist.spec, ...up });
  }
  for (const h of H) for (const u of [h.u0 - 0.5 * t, h.u0 - 1.5 * t, h.u1 + 0.5 * t, h.u1 + 1.5 * t]) F.add('header', W(u, h.v0 - t, zj), W(u, h.v1 + t, zj), { ...joist.spec, ...up });
  if (deck === 'sheets') subfloor(F, fp, zTop - sub / 2, holes, e);
  return { along, lines: gl, zj, W };
}

/** Subfloor sheets, 4 × 8 ft, long side across the joists, rows staggered by half a sheet, cut round holes. */
function subfloor(F, fp, zc, holes, e) {
  const along = fp.x1 - fp.x0 >= fp.y1 - fp.y0 ? 'x' : 'y';
  const [a0, a1, b0, b1] = along === 'x' ? [fp.x0 - e, fp.x1 + e, fp.y0 - e, fp.y1 + e] : [fp.y0 - e, fp.y1 + e, fp.x0 - e, fp.x1 + e];
  const gap = 0.125 * IN;
  const osb = { stock: [0, 0.75 * IN], finish: { paint: '#c9a46a' }, up: [0, 0, 1] };
  for (let b = b0, row = 0; b < b1 - 0.05; b += 4, row++) {
    for (let a = a0 - (row % 2) * 4; a < a1 - 0.05; a += 8) {
      let rects = [[Math.max(a, a0), Math.min(a + 8, a1), b, Math.min(b + 4, b1)]];
      for (const h of holes) {
        const [h0, h1, k0, k1] = along === 'x' ? [h.x0, h.x1, h.y0, h.y1] : [h.y0, h.y1, h.x0, h.x1];
        rects = rects.flatMap(([p, q, r, s]) => {
          if (h1 <= p || h0 >= q || k1 <= r || k0 >= s) return [[p, q, r, s]];
          return [[p, h0, r, s], [h1, q, r, s], [Math.max(p, h0), Math.min(q, h1), r, k0], [Math.max(p, h0), Math.min(q, h1), k1, s]];
        });
      }
      for (const [p, q, r, s] of rects) {
        if (q - p < 0.2 || s - r < 0.2) continue;
        const c = (r + s) / 2, w = s - r - gap;
        const P = (x) => (along === 'x' ? [x, c, zc] : [c, x, zc]);
        F.add('sheet', P(p + gap / 2), P(q - gap / 2), { ...osb, stock: [r4(w), r4(0.75 * IN)] });
      }
    }
  }
}

// ── foundation ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A perimeter stem wall and footing under `zTopOfStem`, with pads under the girder lines' posts. */
function foundation(F, fp, zStemTop, { stemH = 2.5, posts = [], postSpec = null, zPostTop = null }) {
  const stem = 8 * IN, foot = [20 * IN, 10 * IN];
  const zF = zStemTop - stemH;
  const c = { material: 'concrete', up: [0, 0, 1] };
  const edges = [
    [[fp.x0 - stem / 2, fp.y0], [fp.x1 + stem / 2, fp.y0]], [[fp.x0 - stem / 2, fp.y1], [fp.x1 + stem / 2, fp.y1]],
    [[fp.x0, fp.y0 + stem / 2], [fp.x0, fp.y1 - stem / 2]], [[fp.x1, fp.y0 + stem / 2], [fp.x1, fp.y1 - stem / 2]],
  ];
  for (const [[ax, ay], [bx, by]] of edges) {
    F.add('stem', [ax, ay, zF + stemH / 2], [bx, by, zF + stemH / 2], { ...c, stock: [r4(stem), r4(stemH)] });
    const ext = (foot[0] - stem) / 2;
    const dx = Math.sign(bx - ax) * ext, dy = Math.sign(by - ay) * ext;
    F.add('footing', [ax - dx, ay - dy, zF - foot[1] / 2], [bx + dx, by + dy, zF - foot[1] / 2], { ...c, stock: foot.map(r4) });
  }
  for (const [x, y] of posts) {
    F.add('pad', [x - 1, y, zF - 5 * IN], [x + 1, y, zF - 5 * IN], { ...c, stock: [2, r4(10 * IN)] });
    if (postSpec) F.add('post', [x, y, zF], [x, y, zPostTop], postSpec);
  }
  return zF;
}

// ── roofs ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The house's roof style → { form, pitch, eave, framedAs } or null. */
export function roofFraming(roof) {
  if (!roof) return null;
  const spec = roof && typeof roof === 'object' ? { style: roof.style || 'bungalow', ...roof } : { style: typeof roof === 'string' ? roof : 'bungalow' };
  const st = { ...(ROOF_STYLES[spec.style] || ROOF_STYLES.bungalow), ...spec };
  const framedAs = ['gable', 'gambrel', 'saltbox'].includes(st.form) ? 'gable'
    : ['hip', 'pyramid', 'mansard'].includes(st.form) ? 'hip'
      : ['shed', 'butterfly'].includes(st.form) ? st.form : 'flat';
  return { form: st.form, pitch: st.pitch, eave: st.eave, framedAs };
}

/**
 * Rafters over the wall-top rectangle at `ze`: commons to a ridge, hips and jacks on a hip, a mono-pitch for a shed,
 * two for a butterfly, level joists for a flat roof. `r` = { spec, d, spacing, ridge?, hip? } (member specs + depth).
 */
function roofFrame(F, fp, ze, roof, r, { ceiling = null } = {}) {
  const longX = fp.x1 - fp.x0 >= fp.y1 - fp.y0;
  const [wA0, wA1, wC0, wC1] = longX ? [fp.x0, fp.x1, fp.y0, fp.y1] : [fp.y0, fp.y1, fp.x0, fp.x1];
  const Pw = (a, c, z) => (longX ? [a, c, z] : [c, a, z]);
  const acm = (wC0 + wC1) / 2, half = (wC1 - wC0) / 2;
  const p = roof.pitch || 0, oh = roof.eave ?? 1;
  const cos = 1 / Math.hypot(1, p);
  const lift = r.d / 2 / cos;                                         // the rafter's centreline over its seat
  const zAt = (dist) => ze + lift + p * dist;                         // dist: plan distance in from the eave wall
  const spec = { ...r.spec, up: [0, 0, 1] };
  const rafter = (a0, c0, d0, a1, c1, d1, s = spec) => F.add('rafter', Pw(a0, c0, zAt(d0)), Pw(a1, c1, zAt(d1)), s);
  const as = layout(wA0, wA1, r.spacing, 0.75 * IN);
  const out = { framedAs: roof.framedAs, rafters: 0, planes: [] };
  // the planes over the rafters' backs, where the deck and the covering go
  const zT = (dist) => ze + p * dist + r.d / cos;
  const plane = (key, pts) => out.planes.push({ key, corners: pts.map(([a, c, z]) => pt3(Pw(a, c, z))) });
  if (roof.framedAs === 'flat' || p <= 0.01) {
    for (const a of as) F.add('roof-joist', Pw(a, wC0 - oh, ze + r.d / 2), Pw(a, wC1 + oh, ze + r.d / 2), spec);
    plane('flat', [[wA0, wC0 - oh, ze + r.d], [wA1, wC0 - oh, ze + r.d], [wA1, wC1 + oh, ze + r.d], [wA0, wC1 + oh, ze + r.d]]);
    return out;
  }
  if (roof.framedAs === 'gable') for (const [k, c] of [['near', wC0 - oh], ['far', wC1 + oh]]) plane(k, [[wA0, c, zT(-oh)], [wA1, c, zT(-oh)], [wA1, acm, zT(half)], [wA0, acm, zT(half)]]);
  else if (roof.framedAs === 'hip') {
    const r0 = wA0 + half, r1 = wA1 - half;
    const e = zT(-oh), t = zT(half);
    plane('near', [[wA0 - oh, wC0 - oh, e], [wA1 + oh, wC0 - oh, e], [r1, acm, t], [r0, acm, t]]);
    plane('far', [[wA0 - oh, wC1 + oh, e], [wA1 + oh, wC1 + oh, e], [r1, acm, t], [r0, acm, t]]);
    plane('end0', [[wA0 - oh, wC0 - oh, e], [r0, acm, t], [wA0 - oh, wC1 + oh, e]]);
    plane('end1', [[wA1 + oh, wC0 - oh, e], [wA1 + oh, wC1 + oh, e], [r1, acm, t]]);
  } else if (roof.framedAs === 'shed') plane('shed', [[wA0, wC0 - oh, zT(-oh)], [wA1, wC0 - oh, zT(-oh)], [wA1, wC1 + oh, zT(2 * half + oh)], [wA0, wC1 + oh, zT(2 * half + oh)]]);
  else {
    const zV = (dist) => ze + p * (half - dist) + r.d / cos;
    for (const [k, c] of [['near', wC0 - oh], ['far', wC1 + oh]]) plane(k, [[wA0, c, zV(-oh)], [wA1, c, zV(-oh)], [wA1, acm, zV(half)], [wA0, acm, zV(half)]]);
  }
  const ridgeT = r.ridge ? r.ridge.t : 1.5 * IN;
  if (roof.framedAs === 'gable') {
    for (const a of as) { rafter(a, wC0 - oh, -oh, a, acm - ridgeT / 2, half - ridgeT / 2); rafter(a, wC1 + oh, -oh, a, acm + ridgeT / 2, half - ridgeT / 2); }
    if (r.ridge) F.add('ridge', Pw(wA0, acm, zAt(half) + r.ridge.lift), Pw(wA1, acm, zAt(half) + r.ridge.lift), { ...r.ridge.spec, up: [0, 0, 1] });
  } else if (roof.framedAs === 'hip') {
    const r0 = wA0 + half, r1 = wA1 - half;
    for (const a of as) {
      if (a >= r0 && a <= r1) { rafter(a, wC0 - oh, -oh, a, acm - ridgeT / 2, half - ridgeT / 2); rafter(a, wC1 + oh, -oh, a, acm + ridgeT / 2, half - ridgeT / 2); continue; }
      const d = a < r0 ? a - wA0 : wA1 - a;                             // how far in the hip line sits here
      if (d > 0.3) { rafter(a, wC0 - oh, -oh, a, wC0 + d, d); rafter(a, wC1 + oh, -oh, a, wC1 - d, d); }
    }
    for (const c of layout(wC0, wC1, r.spacing, 0.75 * IN)) {
      const d = Math.min(c - wC0, wC1 - c);
      if (d > 0.3) { rafter(wA0 - oh, c, -oh, wA0 + d, c, d); rafter(wA1 + oh, c, -oh, wA1 - d, c, d); }
    }
    const hip = r.hip || { ...spec };
    for (const [sa, sc, a0, c0] of [[1, 1, wA0, wC0], [1, -1, wA0, wC1], [-1, 1, wA1, wC0], [-1, -1, wA1, wC1]]) {
      const ra = sa > 0 ? r0 : r1;
      F.add('hip', Pw(a0 - sa * oh, c0 - sc * oh, zAt(-oh)), Pw(ra, acm, zAt(half)), { ...hip, up: [0, 0, 1] });
    }
    if (r.ridge && r1 - r0 > 0.3) F.add('ridge', Pw(r0, acm, zAt(half) + r.ridge.lift), Pw(r1, acm, zAt(half) + r.ridge.lift), { ...r.ridge.spec, up: [0, 0, 1] });
  } else if (roof.framedAs === 'shed') {
    for (const a of as) rafter(a, wC0 - oh, -oh, a, wC1 + oh, 2 * half + oh);
  } else {                                                            // butterfly: two sheds falling to a valley
    const zV = (dist) => ze + lift + p * (half - dist);
    for (const a of as) for (const [c0, s] of [[wC0, -1], [wC1, 1]]) F.add('rafter', Pw(a, c0 + s * oh, zV(-oh)), Pw(a, acm + s * ridgeT / 2, zV(half - ridgeT / 2)), spec);
    if (r.ridge) F.add('valley', Pw(wA0, acm, ze + lift - r.ridge.lift), Pw(wA1, acm, ze + lift - r.ridge.lift), { ...r.ridge.spec, up: [0, 0, 1] });
  }
  if (ceiling) for (const a of as) F.add('ceiling-joist', Pw(a, wC0, ze + ceiling.d / 2), Pw(a, wC1, ze + ceiling.d / 2), { ...ceiling.spec, up: [0, 0, 1] });
  out.rafters = F.members.filter((m) => /^(rafter|hip)-/.test(m.id)).length;
  return out;
}

/** Wagoya purlins and struts under a pitched roof seated at `ze`: moya every `step` in from each eave, koyazuka on the tie beams. */
function wagoya(F, fp, ze, roof, r, { step, ties, strut, moya }) {
  const longX = fp.x1 - fp.x0 >= fp.y1 - fp.y0;
  const [wA0, wA1, wC0, wC1] = longX ? [fp.x0, fp.x1, fp.y0, fp.y1] : [fp.y0, fp.y1, fp.x0, fp.x1];
  const Pw = (a, c, z) => (longX ? [a, c, z] : [c, a, z]);
  const half = (wC1 - wC0) / 2, p = roof.pitch;
  const cos = 1 / Math.hypot(1, p);
  const hip = roof.framedAs === 'hip';
  // the underside of the rafters at plan distance d in from the eave wall
  const under = (d) => ze + p * d;
  for (let d = step; d <= half + 1e-6; d += step) {
    const zM = under(d) - (moya / 2) / cos + 0.02;
    for (const c of d >= half - 1e-6 ? [(wC0 + wC1) / 2] : [wC0 + d, wC1 - d]) {
      const a0 = hip ? wA0 + d : wA0 - roof.eave * 0.5, a1 = hip ? wA1 - d : wA1 + roof.eave * 0.5;
      if (a1 - a0 < 0.5) continue;
      F.add(d >= half - 1e-6 ? 'munagi' : 'moya', Pw(a0, c, zM), Pw(a1, c, zM), { stock: [r4(moya), r4(moya)], ...r.spec, up: [0, 0, 1] });
      for (const a of ties) if (a > a0 + 0.2 && a < a1 - 0.2 && zM - moya / 2 - ze > 0.2) F.add('koyazuka', Pw(a, c, ze), Pw(a, c, zM - moya / 2), strut);
    }
  }
}

// ── the systems ────────────────────────────────────────────────────────────────────────────────────────────────────

const TIMBER_DEFAULT = { platform: 'douglas-fir', masonry: 'pine', 'post-and-beam': 'douglas-fir', kigumi: 'hinoki', steel: 'douglas-fir', concrete: 'pine' };

/**
 * planHouseFraming(house, framing, o) → { frames: [frame spec…], notes: string[], roof } in feet. `house` is
 * structurizeHouse()'s result; `o` its resolved options (floorDrop, roof, view).
 */
export function planHouseFraming(house, framing, o = {}) {
  const f = framingOf(framing);
  const sys = f.system;
  const species = f.species || TIMBER_DEFAULT[sys];
  const timber = { species, ...(f.finish ? { finish: f.finish } : {}) };
  const fp = house.footprint;
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const drop = o.floorDrop ?? 1.1;
  const notes = [];
  const frames = [];
  const base = { figure: f.figure, species, seed: 1, ...(f.detail !== 'auto' ? { detail: f.detail } : {}) };
  const joistD = drop - 0.75 * IN;
  const J = (t, spec) => ({ t, spec });
  const holesOf = (lvl) => (lvl.structure && lvl.structure.slabHoles) || [];
  const grid = { xs: bays(fp.x0, fp.x1, sys === 'kigumi' ? 2 * KEN : 16), ys: bays(fp.y0, fp.y1, sys === 'kigumi' ? 2 * KEN : 16) };
  const inHole = (x, y) => levels.some((l) => holesOf(l).some((h) => x > h.x0 - 1 && x < h.x1 + 1 && y > h.y0 - 1 && y < h.y1 + 1));
  const lowest = levels[0];
  const top = levels[levels.length - 1];
  const ze = top.baseZ + top.height;
  const roof = roofFraming(o.roof || (o.view === 'exterior' ? 'bungalow' : null));

  // ── foundation and the lowest floor ──
  const fnd = makeFrame('foundation', base);
  const floorSys = sys === 'steel' || sys === 'concrete' ? 'slab' : 'joists';
  if (floorSys === 'joists') {
    const longX = fp.x1 - fp.x0 >= fp.y1 - fp.y0;
    const girderLines = bays(longX ? fp.y0 : fp.x0, longX ? fp.y1 : fp.x1, 16).slice(1, -1);
    const posts = girderLines.flatMap((g) => bays(longX ? fp.x0 : fp.y0, longX ? fp.x1 : fp.y1, 8).slice(1, -1).map((s) => (longX ? [s, g] : [g, s])));
    const zG = lowest.baseZ - 0.75 * IN - joistD;
    const joist = J(1.5 * IN, { stock: [r4(1.5 * IN), r4(joistD)], ...timber }), girder = J(4.5 * IN, { stock: [r4(4.5 * IN), r4(joistD)], ...timber });
    if (sys === 'kigumi') {
      // a continuous footing under the dodai; neda on obiki at three shaku
      foundation(fnd, fp, lowest.baseZ - KIGUMI.floor - KIGUMI.post, {});
      joistFloor(fnd, fp, lowest.baseZ, 45 * MM, [], { joist: J(45 * MM, { stock: [r4(45 * MM), r4(45 * MM)], ...timber }), girder: J(90 * MM, { stock: [r4(90 * MM), r4(90 * MM)], ...timber }), spacing: SHAKU, maxSpan: 3 * SHAKU, rim: false, deck: 'none', edgeOut: -KIGUMI.post / 2, under: true });
    } else if (sys === 'masonry') {
      // the brickwork starts on the stem wall; the joists bear into it
      foundation(fnd, fp, lowest.baseZ - drop - 1.5 * IN, { posts, postSpec: { stock: '6x6', ...timber }, zPostTop: zG });
      joistFloor(fnd, fp, lowest.baseZ, joistD, [], { joist, girder, spacing: 16 * IN, rim: false, edgeOut: -0.2 });
    } else {
      const zSill = lowest.baseZ - drop - 1.5 * IN;
      foundation(fnd, fp, zSill, { posts, postSpec: { stock: '6x6', ...timber }, zPostTop: zG });
      for (const [[ax, ay], [bx, by]] of [[[fp.x0, fp.y0], [fp.x1, fp.y0]], [[fp.x0, fp.y1], [fp.x1, fp.y1]], [[fp.x0, fp.y0 + 2.75 * IN], [fp.x0, fp.y1 - 2.75 * IN]], [[fp.x1, fp.y0 + 2.75 * IN], [fp.x1, fp.y1 - 2.75 * IN]]]) {
        fnd.add('sill', [ax, ay, zSill + 0.75 * IN], [bx, by, zSill + 0.75 * IN], { stock: '2x6', up: ay === by ? [0, 1, 0] : [1, 0, 0], ...timber, finish: { stain: '#6f7a4e' } });
      }
      joistFloor(fnd, fp, lowest.baseZ, joistD, [], { joist, girder, spacing: 16 * IN });
    }
  } else {
    // a slab on grade over a thickened edge
    const zS = lowest.baseZ - 5 * IN;
    fnd.add('grade-beam', [fp.x0 - 0.5, fp.y0, zS - 0.75], [fp.x1 + 0.5, fp.y0, zS - 0.75], { material: 'concrete', stock: [1, 1.5], up: [0, 0, 1] });
    fnd.add('grade-beam', [fp.x0 - 0.5, fp.y1, zS - 0.75], [fp.x1 + 0.5, fp.y1, zS - 0.75], { material: 'concrete', stock: [1, 1.5], up: [0, 0, 1] });
    fnd.add('grade-beam', [fp.x0, fp.y0 + 0.5, zS - 0.75], [fp.x0, fp.y1 - 0.5, zS - 0.75], { material: 'concrete', stock: [1, 1.5], up: [0, 0, 1] });
    fnd.add('grade-beam', [fp.x1, fp.y0 + 0.5, zS - 0.75], [fp.x1, fp.y1 - 0.5, zS - 0.75], { material: 'concrete', stock: [1, 1.5], up: [0, 0, 1] });
    for (const y0 of bays(fp.y0, fp.y1, 12).slice(0, -1)) {
      const y1 = y0 + (fp.y1 - fp.y0) / Math.ceil((fp.y1 - fp.y0) / 12 - 1e-9);
      fnd.add('slab', [fp.x0, (y0 + y1) / 2, lowest.baseZ - 2.5 * IN], [fp.x1, (y0 + y1) / 2, lowest.baseZ - 2.5 * IN], { material: 'concrete', stock: [r4(y1 - y0 - 0.02), r4(5 * IN)], up: [0, 0, 1], rebar: { mesh: [8, 200], cover: 30 } });
    }
  }
  if (sys === 'masonry') {
    const lines = new Map();
    for (const lvl of levels) for (const run of (lvl.structure && lvl.structure.wallGraph && lvl.structure.wallGraph.runs) || []) {
      if (run.interior) continue;
      const key = `${run.orientation}:${r4(run.at)}`;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ run, zb: lvl.baseZ, H: lvl.height });
    }
    for (const line of lines.values()) brickWall(fnd, line, lowest.baseZ - drop - 1.5 * IN, ze);
  }
  frames.push(finishFrame(fnd));

  // ── storeys ──
  const colSteel = { section: 'HEA160', finish: 'primer' }, beamSteel = { section: 'IPE240', finish: 'primer' }, joistSteel = { section: 'IPE160', finish: 'primer' };
  const colRC = { material: 'concrete', stock: [1, 1] }, beamRC = { material: 'concrete', stock: [1, 1.6] };
  for (const lvl of levels) {
    const L = makeFrame(`storey-${lvl.index}`, base);
    const zb = lvl.baseZ, H = lvl.height;
    const runs = (lvl.structure && lvl.structure.wallGraph && lvl.structure.wallGraph.runs) || [];
    const above = levels.find((l) => l.index === lvl.index + 1);
    const zNext = above ? above.baseZ : ze;                          // the top of this storey's structure
    if (sys === 'platform') {
      for (const run of runs) studWall(L, run, runs, zb, H, timber);
    } else if (sys === 'masonry') {
      for (const run of runs) if (run.interior) studWall(L, run, runs, zb, H, timber);
      if (lvl === top) for (const run of runs.filter((q) => !q.interior)) L.add('wall-plate', runPoint(run, run.along[0], 0, ze + 0.75 * IN), runPoint(run, run.along[1], 0, ze + 0.75 * IN), { stock: '2x6', up: runNormal(run), ...timber });
    } else if (sys === 'post-and-beam') {
      timberFrame(L, fp, zb, H, drop, grid, f.joints, timber, inHole);
      for (const run of runs) if (run.interior) studWall(L, run, runs, zb, H, timber);
    } else if (sys === 'kigumi') {
      kigumiStorey(L, runs, zb, H, drop, lvl === lowest, f.joints, { species: f.species || 'hinoki' }, notes);
    } else {
      // steel or concrete: columns at the grid on pads, beams round each floor and along the grid lines, their tops
      // under the slab (steel) or flush with it (concrete)
      const steel = sys === 'steel';
      const slabT = 5 * IN, half = steel ? 0.3937 : 0.8;
      const zBeam = steel ? zNext - (above ? slabT : 0) - half : zNext - half;
      const zPad = lowest.baseZ - drop - 0.8;
      const z0 = lvl === lowest ? zPad : (steel ? zb - slabT : zb);
      const cols = new Map();
      for (const x of grid.xs) for (const y of grid.ys) {
        if (inHole(x, y)) continue;
        const id = L.add('column', [x, y, z0], [x, y, zBeam + half], steel ? { ...colSteel, up: [1, 0, 0] } : { ...colRC });
        cols.set(`${x},${y}`, id);
        if (lvl === lowest) {
          const pad = L.add('pad', [x - 1.25, y, zPad - 0.6], [x + 1.25, y, zPad - 0.6], { material: 'concrete', stock: [2.5, 1.2], up: [0, 0, 1] });
          if (steel && f.joints) L.join('base-plate', id, pad);
        }
      }
      const beam = (a, b, key0, key1) => {
        const id = L.add('beam', a, b, steel ? { ...beamSteel } : { ...beamRC });
        if (steel && f.joints) for (const k of [key0, key1]) if (cols.has(k)) L.join('bolted', id, cols.get(k));
      };
      for (const y of grid.ys) for (let i = 0; i + 1 < grid.xs.length; i++) beam([grid.xs[i], y, zBeam], [grid.xs[i + 1], y, zBeam], `${grid.xs[i]},${y}`, `${grid.xs[i + 1]},${y}`);
      for (const x of grid.xs) for (let j = 0; j + 1 < grid.ys.length; j++) beam([x, grid.ys[j], zBeam], [x, grid.ys[j + 1], zBeam], `${x},${grid.ys[j]}`, `${x},${grid.ys[j + 1]}`);
      for (const run of runs.filter((q) => q.interior)) studWall(L, run, runs, zb, H, timber);
    }
    // the floor over this storey (the next storey's) or the ceiling under the roof
    if (above) {
      if (floorSys === 'slab') slabFloor(L, fp, above.baseZ, holesOf(above), grid, sys === 'steel', joistSteel);
      else if (sys === 'kigumi') {
        joistFloor(L, fp, above.baseZ, 45 * MM, holesOf(above), { joist: J(45 * MM, { stock: [r4(45 * MM), r4(45 * MM)], species: 'sugi' }), girder: J(120 * MM, { stock: [r4(120 * MM), r4(240 * MM)], species: 'sugi' }), spacing: SHAKU, maxSpan: KEN, rim: false, deck: 'none', edgeOut: 0, under: true });
      } else {
        joistFloor(L, fp, above.baseZ, joistD, holesOf(above), { joist: J(1.5 * IN, { stock: [r4(1.5 * IN), r4(joistD)], ...timber }), girder: J(4.5 * IN, { stock: [r4(4.5 * IN), r4(joistD)], ...timber }), spacing: 16 * IN, edgeOut: sys === 'masonry' ? -0.2 : 2 * IN, rim: sys !== 'masonry' });
      }
    }
    frames.push(finishFrame(L));
  }

  // ── the roof ──
  const R = makeFrame('roof', base);
  const rfp = fp;
  let roofOut = null;
  if (roof) {
    const halfSpan = Math.min(fp.x1 - fp.x0, fp.y1 - fp.y0) / 2;
    if (sys === 'steel') {
      roofOut = roofFrame(R, rfp, ze, roof, { spec: { section: 'IPE160', finish: 'primer' }, d: 0.525, spacing: 4, ridge: { t: 0.4, lift: 0, spec: { section: 'IPE240', finish: 'primer' } }, hip: { section: 'IPE200', finish: 'primer' } });
    } else if (sys === 'kigumi') {
      // wagoya: koyabari across on the keta, koyazuka up to moya, taruki over them
      const tr = 60 * MM, tieD = Math.max(240, Math.min(360, halfSpan * 20)) * MM;
      const zr = ze + KIGUMI.beam + tieD;
      const longX = fp.x1 - fp.x0 >= fp.y1 - fp.y0;
      const ties = bays(longX ? fp.x0 : fp.y0, longX ? fp.x1 : fp.y1, KEN);
      for (const a of ties) R.add('koyabari', longX ? [a, fp.y0 - 0.3, zr - tieD / 2] : [fp.x0 - 0.3, a, zr - tieD / 2], longX ? [a, fp.y1 + 0.3, zr - tieD / 2] : [fp.x1 + 0.3, a, zr - tieD / 2], { stock: [r4(120 * MM), r4(tieD)], species: 'sugi', up: [0, 0, 1] });
      roofOut = roofFrame(R, rfp, zr, roof, { spec: { stock: [r4(45 * MM), r4(tr)], species: 'sugi' }, d: tr, spacing: 1.5 * SHAKU, hip: { stock: [r4(105 * MM), r4(150 * MM)], species: 'sugi' } });
      wagoya(R, fp, zr, roof, { spec: { species: 'sugi' } }, { step: 3 * SHAKU, ties, strut: { stock: [r4(90 * MM), r4(90 * MM)], species: 'sugi', up: longX ? [1, 0, 0] : [0, 1, 0] }, moya: 90 * MM });
    } else {
      const rd = (halfSpan <= 10 ? 7.25 : halfSpan <= 14 ? 9.25 : 11.25) * IN;
      const ceiling = sys === 'post-and-beam' ? null : { d: 7.25 * IN, spec: { stock: '2x8', ...timber } };
      roofOut = roofFrame(R, rfp, ze + (sys === 'masonry' ? 1.5 * IN : sys === 'concrete' ? 0 : 0), roof,
        { spec: { stock: [r4(1.5 * IN), r4(rd)], ...timber }, d: rd, spacing: sys === 'post-and-beam' ? 24 * IN : 16 * IN, ridge: { t: 1.5 * IN, lift: 0.1, spec: { stock: [r4(1.5 * IN), r4(rd + 2 * IN)], ...timber } }, hip: { stock: [r4(1.5 * IN), r4(rd + 2 * IN)], ...timber } },
        { ceiling });
    }
    if (roofOut && roofOut.framedAs !== roof.form && !(roof.form === 'pyramid' && roofOut.framedAs === 'hip')) notes.push(`the ${roof.form} roof is framed as a ${roofOut.framedAs}`);
  } else if (floorSys === 'slab') {
    slabFloor(R, fp, ze + 0.5, [], grid, sys === 'steel', joistSteel);
  } else {
    joistFloor(R, fp, ze + joistD, joistD, [], { joist: J(1.5 * IN, { stock: [r4(1.5 * IN), r4(joistD)], ...timber }), girder: J(4.5 * IN, { stock: [r4(4.5 * IN), r4(joistD)], ...timber }), spacing: 16 * IN, deck: 'none' });
    notes.push('the house has no roof, so its top storey is capped with ceiling joists');
  }
  if (R.members.length) frames.push(finishFrame(R));
  return { frames, notes, roof: roof ? { form: roof.form, framedAs: roofOut ? roofOut.framedAs : null } : null, roofPlanes: roofOut ? roofOut.planes : [] };
}

/** A concrete floor slab in strips over the grid (steel: on IPE joists at 4 ft between the grid beams). */
function slabFloor(F, fp, zTop, holes, grid, steel, joistSteel) {
  const t = 5 * IN;
  const longX = fp.x1 - fp.x0 >= fp.y1 - fp.y0;
  if (steel) {
    for (let i = 0; i + 1 < grid.xs.length; i++) for (let j = 0; j + 1 < grid.ys.length; j++) {
      const [x0, x1, y0, y1] = [grid.xs[i], grid.xs[i + 1], grid.ys[j], grid.ys[j + 1]];
      for (const x of bays(x0, x1, 4).slice(1, -1)) {
        if (holes.some((h) => x > h.x0 - 0.3 && x < h.x1 + 0.3 && y1 > h.y0 && y0 < h.y1)) continue;
        F.add('joist', [x, y0 + 0.2, zTop - t - 0.27], [x, y1 - 0.2, zTop - t - 0.27], { ...joistSteel });
      }
    }
  }
  // the slab in strips along the long side, cut round holes
  const [a0, a1, b0, b1] = longX ? [fp.x0, fp.x1, fp.y0, fp.y1] : [fp.y0, fp.y1, fp.x0, fp.x1];
  for (const bb of bays(b0, b1, 8).slice(0, -1)) {
    const bw = (b1 - b0) / Math.ceil((b1 - b0) / 8 - 1e-9);
    let spans = [[a0, a1]];
    for (const h of holes) {
      const [h0, h1, k0, k1] = longX ? [h.x0, h.x1, h.y0, h.y1] : [h.y0, h.y1, h.x0, h.x1];
      if (k1 > bb && k0 < bb + bw) spans = spans.flatMap(([p, q]) => [[p, Math.min(q, h0)], [Math.max(p, h1), q]]);
    }
    for (const [p, q] of spans) {
      if (q - p < 0.5) continue;
      const c = bb + bw / 2;
      F.add('slab', longX ? [p, c, zTop - t / 2] : [c, p, zTop - t / 2], longX ? [q, c, zTop - t / 2] : [c, q, zTop - t / 2], { material: 'concrete', stock: [r4(bw - 0.02), r4(t)], up: [0, 0, 1], rebar: { mesh: [10, 200], cover: 25 } });
    }
  }
}

/**
 * A Western timber frame storey: posts on the grid, plates along x at every grid line (each post tenoned into its
 * plate), tie beams along y lapped over them, and knee braces from post to plate on the x lines.
 */
function timberFrame(F, fp, zb, H, drop, grid, joints, timber, inHole) {
  const post = { stock: '8x8', ...timber }, beam = { stock: '8x10', ...timber }, brace = { stock: '4x6', ...timber };
  const pw = 7.25 * IN, bd = 9.25 * IN;
  const z0 = zb - drop, zPlate = zb + H - bd / 2;
  const xs = grid.xs, ys = grid.ys;
  const edge = (x, y) => x === xs[0] || x === xs[xs.length - 1] || y === ys[0] || y === ys[ys.length - 1];
  const ids = new Map();
  for (const x of xs) for (const y of ys) if (edge(x, y) || !inHole(x, y)) ids.set(`${x},${y}`, F.add('post', [x, y, z0], [x, y, zPlate], { ...post, up: [1, 0, 0] }));
  const plates = ys.map((y) => F.add('plate', [xs[0] - pw / 2, y, zPlate], [xs[xs.length - 1] + pw / 2, y, zPlate], { ...beam, up: [0, 0, 1] }));
  const ties = xs.map((x) => F.add('tie', [x, ys[0] - pw / 2, zPlate], [x, ys[ys.length - 1] + pw / 2, zPlate], { ...beam, up: [0, 0, 1] }));
  if (!joints) return;
  ys.forEach((y, j) => xs.forEach((x, i) => {
    const k = `${x},${y}`;
    F.join('lap', ties[i], plates[j]);
    if (!ids.has(k)) return;
    F.join('mortise-tenon', ids.get(k), plates[j]);
    // knee braces three feet each way along the plate, toward each neighbouring post
    for (const dir of [-1, 1]) {
      const n = xs[i + dir];
      if (n === undefined || !ids.has(`${n},${y}`)) continue;
      const br = F.add('brace', [x, y, zPlate - 3], [x + dir * 3, y, zPlate], { ...brace, up: [0, 1, 0] });
      F.join('mortise-tenon', br, ids.get(k)); F.join('mortise-tenon', br, plates[j]);
    }
  }));
}

const KIGUMI = { post: 120 * MM, beam: 240 * MM, floor: 0.35 };

/**
 * A kigumi storey: a dodai on the lowest, hashira every ken and beside each opening (shared where walls meet), a
 * keta along each run on the posts (the 'v' runs' keta stop against the 'h' runs'), nuki through the posts at three
 * heights (the 'v' runs' a nuki's depth higher, so two never cross in one post), kamoi and shikii at each opening.
 */
function kigumiStorey(F, runs, zb, H, drop, lowest, joints, { species }, notes) {
  const P4 = KIGUMI.post, beamD = KIGUMI.beam;
  const post = { stock: '4sun', species }, sill = { stock: '4sun', species }, keta = { stock: [r4(P4), r4(beamD)], species: 'sugi' }, nuki = { stock: 'nuki', species };
  const zSill = zb - KIGUMI.floor - P4 / 2, zKeta = zb + H + beamD / 2;
  const zFoot = lowest ? zSill : zb - drop + beamD - 0.05;           // an upper post stands on the keta below
  const shared = new Map();                                          // (x, y) → post id, so corners take one post
  let skipped = 0;
  const nukiD = 105 * MM;
  for (const run of runs) {
    const [s0, s1] = run.along;
    const [e0, e1] = runEnds(run, runs, () => P4);
    const ops = runOpenings(run, s0, s1, H, 0.2);
    const want = new Set([...layout(s0, s1, KEN, 0).map(r4), ...ops.flatMap((op) => [r4(op.a - P4 / 2), r4(op.b + P4 / 2)])]);
    const ss = [...want].sort((a, b) => a - b).filter((s, i, a) => i === 0 || s - a[i - 1] > P4 * 1.2)
      .filter((s) => !ops.some((op) => s > op.a + 1e-3 && s < op.b - 1e-3));
    const ext = (a, b) => [a - (a === s0 && e0 === s0 ? P4 / 2 : 0), b + (b === s1 && e1 === s1 ? P4 / 2 : 0)];
    const [k0, k1] = ext(e0, e1);
    const d = lowest ? F.add('dodai', runPoint(run, k0, 0, zSill), runPoint(run, k1, 0, zSill), { ...sill, up: [0, 0, 1] }) : null;
    const k = F.add('keta', runPoint(run, k0, 0, zKeta), runPoint(run, k1, 0, zKeta), { ...keta, up: [0, 0, 1] });
    const posts = ss.map((s) => {
      const key = runPoint(run, s, 0, 0).slice(0, 2).map((v) => Math.round(v * 10)).join(',');
      if (shared.has(key)) return { s, id: shared.get(key), shared: true };
      const id = F.add('hashira', runPoint(run, s, 0, zFoot), runPoint(run, s, 0, zKeta), { ...post, up: runNormal(run) });
      shared.set(key, id);
      if (joints && s >= k0 - 1e-3 && s <= k1 + 1e-3) { F.join('hozo', id, k, { pin: true }); if (d) F.join('hozo', id, d); }   // a post past a trimmed end joins the cross-wall's beam
      return { s, id };
    });
    const lift = run.orientation === 'v' ? nukiD * 1.2 : 0;
    for (const zr of [0.12, 0.5, 0.86]) {
      const z = zb + zr * H + lift;
      let segs = [[s0, s1]];
      for (const op of ops) if (z > zb + op.sill - 0.1 && z < zb + op.top + 0.1) segs = segs.flatMap(([a, b]) => [[a, op.a], [op.b, b]]);
      for (const [a, b] of segs) {
        const through = posts.filter((p) => p.s >= a - 1e-3 && p.s <= b + 1e-3);
        if (through.length < 2) continue;
        const n = F.add('nuki', runPoint(run, through[0].s - P4 * 0.9, 0, z), runPoint(run, through[through.length - 1].s + P4 * 0.9, 0, z), { ...nuki, up: [0, 0, 1] });
        if (joints) for (const p of through) F.join('nuki', n, p.id, { drive: 'to' });
      }
    }
    for (const op of ops) {
      F.add('kamoi', runPoint(run, op.a, 0, zb + op.top + 0.08), runPoint(run, op.b, 0, zb + op.top + 0.08), { stock: [r4(P4 * 0.9), r4(45 * MM)], species, up: [0, 0, 1] });
      if (op.sill > 0) F.add('shikii', runPoint(run, op.a, 0, zb + op.sill - 0.08), runPoint(run, op.b, 0, zb + op.sill - 0.08), { stock: [r4(P4 * 0.9), r4(45 * MM)], species, up: [0, 0, 1] });
    }
    if (!posts.length) skipped++;
  }
  if (skipped) notes.push(`${skipped} wall run(s) too short for a post`);
}

// ── the cutaway ─────────────────────────────────────────────────────────────────────────────────────────────────────

const hexMix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return t < 0.5 ? a : b;
  const A = p(a), B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Faces clipped to the half-space x ≥ xc (a section through the house): a face wholly past it is kept as it was, one
 * wholly short of it dropped, one across it cut, its uv and per-corner fills carried to the cut.
 */
export function clipFacesAtX(faces, xc) {
  const out = [];
  for (const f of faces) {
    const C = f.corners;
    let lo = Infinity, hi = -Infinity;
    for (const c of C) { if (c[0] < lo) lo = c[0]; if (c[0] > hi) hi = c[0]; }
    if (lo >= xc - 1e-9) { out.push(f); continue; }
    if (hi <= xc + 1e-9) continue;
    const uv = Array.isArray(f.uv) && f.uv.length === C.length ? f.uv : null;
    const cf = Array.isArray(f.cornerFills) && f.cornerFills.length === C.length ? f.cornerFills : null;
    const nc = [], nuv = [], ncf = [];
    const push = (i) => { nc.push(C[i]); if (uv) nuv.push(uv[i]); if (cf) ncf.push(cf[i]); };
    const cut = (i, j) => {
      const t = (xc - C[i][0]) / (C[j][0] - C[i][0]);
      nc.push(C[i].map((v, k) => v + (C[j][k] - v) * t));
      if (uv) nuv.push(uv[i].map((v, k) => v + (uv[j][k] - v) * t));
      if (cf) ncf.push(hexMix(cf[i], cf[j], t));
    };
    for (let i = 0; i < C.length; i++) {
      const j = (i + 1) % C.length;
      const inI = C[i][0] >= xc, inJ = C[j][0] >= xc;
      if (inI) push(i);
      if (inI !== inJ) cut(i, j);
    }
    if (nc.length < 3) continue;
    out.push({ ...f, corners: nc, ...(uv ? { uv: nuv } : {}), ...(cf ? { cornerFills: ncf } : {}) });
  }
  return out;
}

// ── lowering ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The eyes a house is seen from, in metres: its own default cameras (the World's aerial and corner views of the
 * footprint over the whole stack), or the cameras it was given. `focalPx` is the image half-width over tan(fov / 2).
 */
export function houseEyes(fp, zLo, zHi, { cameras = null, width = 1120, unit = 0.3048 } = {}) {
  const focal = (fov) => (width / 2) / Math.tan(((fov || 60) * Math.PI) / 360);
  if (Array.isArray(cameras) && cameras.length) {
    return cameras.filter((c) => c && c.worldFraming && Array.isArray(c.worldFraming.cameraPosition))
      .map((c) => ({ pos: c.worldFraming.cameraPosition.map((v) => v * unit), focalPx: focal(c.worldFraming.horizontalFov) }));
  }
  const cx = (fp.x0 + fp.x1) / 2, w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zHi - zLo);
  return [
    { pos: [cx - 0.2 * w, fp.y0 - 1.0 * d, zHi + 0.9 * span].map((v) => v * unit), focalPx: focal(60) },
    { pos: [fp.x0 - 0.85 * w, fp.y0 - 0.85 * d, zHi + 0.4 * span].map((v) => v * unit), focalPx: focal(72) },
  ];
}

/**
 * houseFramingFaces(house, framing, o) → { faces, repeats, report }: the frames lowered (frame.js) in the house's
 * unit, at the level each earns from the house's eyes (`framing.detail`, default 'auto'), identical members and
 * bricks stamped as repeats (`framing.instance`, default true). A frame whose joints fail to cut (a member too short
 * to take its joint) lowers again without them.
 */
export function houseFramingFaces(house, framing, o = {}) {
  const f = framingOf(framing);
  const plan = planHouseFraming(house, framing, o);
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const drop = o.floorDrop ?? 1.1;
  const top = levels[levels.length - 1];
  const fp = house.footprint;
  const rise = plan.roof ? Math.min(fp.x1 - fp.x0, fp.y1 - fp.y0) / 2 * (roofFraming(o.roof || 'bungalow').pitch || 0) : 0;
  const eyes = f.detail === 'auto' ? houseEyes(fp, levels[0].baseZ - drop, top.baseZ + top.height + rise, { cameras: o.cameras }) : null;
  const faces = [], repeats = [];
  const takeoff = { timber: { pieces: 0, boardFeet: 0 }, steel: { pieces: 0, massKg: 0 }, concrete: { pieces: 0, cubicYards: 0, rebarKg: 0 }, masonry: { units: 0 } };
  const notes = [...plan.notes];
  const details = {};
  const reports = {};
  let jointCount = 0, degraded = null;
  for (const spec of plan.frames) {
    let out;
    const opts = { light: o.light, eyes, instance: f.instance };
    try { out = lowerFrame(spec, opts); } catch (e) {
      notes.push(`${spec.id}: its joints could not all be cut (${e.message}), so it is drawn uncut`);
      out = lowerFrame({ ...spec, joints: [] }, opts);
    }
    for (const fc of out.faces) fc.group = `framing:${spec.id}:${fc.group}`;
    faces.push(...out.faces);
    for (const r of out.repeats || []) {
      const tag = `framing:${spec.id}:${r.group}`;
      repeats.push({ ...r, group: tag, template: r.template.map((t) => ({ ...t, group: tag })) });
    }
    const r = out.report;
    reports[spec.id] = r;
    details[spec.id] = r.detail;
    jointCount += (r.joints || []).length;
    if (r.degraded) degraded = r.degraded;
    for (const m of r.members) {
      const Lm = m.lengthMm / 1000;
      if (m.material === 'steel') { takeoff.steel.pieces++; takeoff.steel.massKg += m.massKg; }
      else if (m.material === 'concrete') { takeoff.concrete.pieces++; takeoff.concrete.cubicYards += (Lm * m.stockMm[0] * m.stockMm[1]) / 1e6 * 1.30795; takeoff.concrete.rebarKg += m.rebar ? m.rebar.massKg : 0; }
      else { takeoff.timber.pieces++; takeoff.timber.boardFeet += (Lm / 0.3048) * (m.stockMm[0] / 25.4) * (m.stockMm[1] / 25.4) / 12; }
    }
    for (const w of r.walls || []) takeoff.masonry.units += w.units;
  }
  // ── the stage: what closes the frame (linings) and what runs in it (wiring), and the model of all of it ──
  let model = null, wiring = null, roofing = null;
  const roofEls = [];
  if (f.stage !== 'frame') {
    const cfg = { system: f.system, tradition: f.tradition, stage: f.stage };
    const lin = planLinings(house, cfg, plan.frames, o);
    for (const spec of lin.frames) {
      const out = lowerFrame(spec, { light: o.light, eyes, instance: f.instance });
      for (const fc of out.faces) fc.group = `framing:foundation:${spec.id}:${fc.group}`;
      faces.push(...out.faces);
      for (const r of out.repeats || []) { const tag = `framing:foundation:${spec.id}:${r.group}`; repeats.push({ ...r, group: tag, template: r.template.map((t) => ({ ...t, group: tag })) }); }
      reports[spec.id] = out.report;
      for (const w of out.report.walls || []) takeoff.masonry.units += w.units;
    }
    wiring = planWiring(house, cfg, plan.frames, o);
    const els = [...lin.elements, ...(wiring ? wiring.elements : [])];
    // each element's faces ride its storey (so an exploded read lifts them), identical ones stamped
    const efaces = elementFaces(els, { light: o.light, eyes });
    const storeyOfKey = new Map(els.map((e) => [e.key, e.storey]));
    for (const fc of efaces) fc.group = `framing:storey-${storeyOfKey.get(fc.group)}:${fc.group}`;
    if (f.instance) {
      const inst = instanceGroups(efaces, { name: 'element' });
      faces.push(...inst.faces);
      for (const { members, ...r } of inst.repeats) {
        const tag = `${/^framing:storey--?\d+:/.exec(members[0])[0]}${r.group}`;
        repeats.push({ ...r, group: tag, template: r.template.map((t) => ({ ...t, group: tag })) });
      }
    } else faces.push(...efaces);
    // the roof: decked (North American, Japanese) or felted and battened (British, metric) at rough-in; covered when lined
    if (plan.roofPlanes.length) {
      const rs = o.roof && typeof o.roof === 'object' ? { style: o.roof.style || 'bungalow', ...o.roof } : { style: typeof o.roof === 'string' ? o.roof : 'bungalow' };
      const st = { ...(ROOF_STYLES[rs.style] || ROOF_STYLES.bungalow), ...rs };
      const lined = f.stage === 'lined';
      const rstage = lined ? 'covered' : f.tradition === 'british' || f.tradition === 'metric' ? 'battens' : 'deck';
      const deckMat = f.tradition === 'japanese' ? 'board:nojiita' : 'board:osb-11';
      const cov = layCovering(plan.roofPlanes, rs.covering ?? true, { light: o.light, eyes, stage: rstage, deck: { rgb: CATALOG[deckMat].rgb }, styleTexture: st.material, group: 'framing:roof:covering', instance: f.instance });
      // cut away, the roof keeps what stands past the cut, as the finished house does
      const xc = f.view === 'cutaway' ? fp.x0 + f.cut * (fp.x1 - fp.x0) : null;
      faces.push(...(xc === null ? cov.faces : clipFacesAtX(cov.faces, xc)));
      repeats.push(...(xc === null ? cov.repeats : cov.repeats.map((r) => ({ ...r, transforms: r.transforms.filter((t) => t.pos[0] >= xc) })).filter((r) => r.transforms.length)));
      const mat = rstage === 'covered' ? cov.report.material : rstage === 'battens' ? 'roofing:felt' : deckMat;
      for (const pl of plan.roofPlanes) {
        const pts = pl.corners;
        const lo = [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])));
        const pr = cov.report.planes.find((x) => x.key === pl.key);
        roofEls.push({ key: `roof:${rstage}:${pl.key}`, ifc: rstage === 'covered' ? 'IfcCovering' : rstage === 'deck' ? 'IfcPlate' : 'IfcCovering', type: rstage === 'covered' ? 'ROOFING' : rstage === 'deck' ? 'SHEET' : 'MEMBRANE', material: mat, storey: levels[levels.length - 1].index, lo, hi, plane: pts, thicknessMm: rstage === 'covered' ? 2 * (COVERINGS[cov.report.covering].thick || 10) + (COVERINGS[cov.report.covering].depth || 0) : rstage === 'deck' ? CATALOG[deckMat].mm : 1, quantities: { areaSqFt: pr ? pr.areaSqFt : 0, ...(rstage === 'covered' && pr ? { units: pr.units } : {}) } });
      }
      roofing = cov.report;
    }
    model = buildConstructionModel({ frames: [...plan.frames, ...lin.frames], reports, elements: [...lin.elements, ...(wiring ? wiring.all : []), ...roofEls], wiring, levels: house.levels });
  }
  // the frame alone as a model, when a caller asks for one (an IFC export of a house at `frame`)
  if (!model && o._model) model = buildConstructionModel({ frames: plan.frames, reports, elements: [], wiring: null, levels: house.levels });
  const rd = (v) => Math.round(v);
  const report = {
    system: f.system, view: f.view, detail: details,
    drawn: { faces: faces.length, instances: repeats.reduce((a, r) => a + r.transforms.length, 0), templates: repeats.length },
    frames: plan.frames.map((s) => ({ id: s.id, members: s.members.length, ...(s.joints ? { joints: s.joints.length } : {}), ...(s.walls ? { walls: s.walls.length } : {}) })),
    joints: jointCount,
    takeoff: {
      timber: { pieces: takeoff.timber.pieces, boardFeet: rd(takeoff.timber.boardFeet) },
      steel: { pieces: takeoff.steel.pieces, tonnes: Math.round(takeoff.steel.massKg / 100) / 10 },
      concrete: { pieces: takeoff.concrete.pieces, cubicYards: Math.round(takeoff.concrete.cubicYards * 10) / 10, rebarKg: rd(takeoff.concrete.rebarKg) },
      masonry: { units: takeoff.masonry.units },
    },
    ...(f.stage !== 'frame' ? { stage: f.stage, tradition: f.tradition, assemblies: TRADITIONS[f.tradition] } : {}),
    ...(model ? { model: { summary: model.summary, checks: model.checks, schedules: { sheets: model.schedules.sheets, panel: model.schedules.panel, cutList: model.schedules.cutList.length } } } : {}),
    ...(plan.roof ? { roof: { ...plan.roof, ...(roofing ? { covering: roofing.covering, stage: roofing.stage, units: roofing.units, areaSqFt: roofing.areaSqFt } : {}) } } : {}),
    ...(notes.length ? { notes } : {}),
    ...(degraded ? { degraded } : {}),
  };
  return { faces, repeats, report, ...(model ? { model } : {}) };
}
