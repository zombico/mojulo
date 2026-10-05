/**
 * The Forum Romanum kit (79 CE): the buildings of the square, each built in its own frame (front toward −y, as every
 * asset) from the orders (./orders.js) at the record's numbers (../record/forum.js). Every asset is a placeholder
 * (`designed: false`): massing to the record and the card, not yet checked against reference sheets.
 *
 * The repeated parts (columns, entablature runs, arcade bays) are not built into a building's masses: the build lists
 * them as instances (`inst`: { key, make, low, x, y, z, turn }), points in its frame, and the layout gathers them so
 * the World page draws each part once and stands it everywhere (`repeats`). `make` builds the detailed part, `low` a
 * light stand-in for the CSS page; `turn` (0–3, quarter turns as kit.js orientBox turns 'n', 'e', 's', 'w') is the
 * way the part faces in the building's frame. A column is the same from every side, so it never turns.
 */
import { column, entablature, entablatureBands, lathe, panel } from './orders.js';
import { flight } from './kit.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const sbox = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, solid: 'frustum', x, y, w, d, z0, z1, top: { x, y, w, d }, tint, ...o });
const beamOf = (kind, a, b, t, tint) => ({ kind, solid: 'beam', a, b, t, tint, x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), d: Math.abs(a[1] - b[1]), z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]) });

// ── turning parts (instance templates are baked lit, so a part that faces another way is its own template) ──
const turnPt = ([x, y], k) => [[x, y], [-y, x], [-x, -y], [y, -x]][((k % 4) + 4) % 4];
const turnRect = (r, k) => {
  const ps = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map((p) => turnPt(p, k)), xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
};
/** A part's masses turned `k` quarter turns about its origin (the turn kit.js orientBox gives 'n', 'e', 's', 'w'). */
export function turnMasses(ms, k) {
  if (!k) return ms;
  return ms.map((m) => {
    const o = { ...m, ...turnRect(m, k) };
    if (m.top) o.top = turnRect(m.top, k);
    if (m.pts) o.pts = m.pts.map(([x, y, z]) => [...turnPt([x, y], k), z]);
    if (m.out) o.out = [...turnPt([m.out[0], m.out[1]], k), m.out[2]];
    if (m.a) o.a = [...turnPt([m.a[0], m.a[1]], k), m.a[2]];
    if (m.b) o.b = [...turnPt([m.b[0], m.b[1]], k), m.b[2]];
    return o;
  });
}


// ── the tiled roof ───────────────────────────────────────────────────────────────────────────────────
const hash01 = (i) => ((Math.imul(i + 1, 2654435761) >>> 0) % 997) / 997;   // a tile's own shade: deterministic, no dice
/**
 * A tiled roof slope from its four corners (two at the eave, two higher up; the order the roof panel used): the bed
 * of tegulae, the imbrices (half-round cover tiles, read as square beams) running from eave to top every `pitch`
 * metres, each a shade of its own; an antefix standing at the foot of each row (`antefix`); the ridge's cover tiles
 * along the top (`ridge`). Kit numbers: ../style/pompeii.js `kit.tile` (tegula 0.6 × 0.45, imbrex 0.16).
 */
export function tiled(pts, P, { tint = P.tile, pitch = 0.62, antefix = true, ridge = false, kind = 'roof' } = {}) {
  const n = pts.length, lowZ = Math.min(...pts.map((p) => p[2]));
  let i0 = 0;
  for (let i = 0; i < n; i++) if (Math.abs(pts[i][2] - lowZ) < 1e-6 && Math.abs(pts[(i + 1) % n][2] - lowZ) < 1e-6) i0 = i;
  const e0 = pts[i0], e1 = pts[(i0 + 1) % n], r1 = pts[(i0 + 2) % n], r0 = pts[(i0 + 3) % n];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const u = sub3(e1, e0), v = sub3(r0, e0);
  let nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (nrm[2] < 0) nrm = nrm.map((c) => -c);
  const nl = Math.hypot(...nrm); nrm = nrm.map((c) => c / nl);
  // the bed, and its underside (the eaves' soffit, seen from below: a slope is drawn from its lit side only)
  const out = [panel(kind, pts, nrm, scaleHex(tint, 0.9)), panel('soffit', pts.map((p) => p.map((c, k) => c - nrm[k] * 0.15)), nrm.map((c) => -c), scaleHex(tint, 0.7))];
  const len = Math.hypot(...u), rows = Math.max(1, Math.floor(len / pitch)), lift = (p, h) => p.map((c, k) => c + nrm[k] * h);
  // outward at the eave, level: from the top edge's middle to the eave's
  const om = sub3(lerp(e0, e1, 0.5), lerp(r0, r1, 0.5)), oh = Math.hypot(om[0], om[1]) || 1, ox = om[0] / oh, oy = om[1] / oh;
  for (let k = 0; k < rows; k++) {
    const t = (k + 0.5) / rows, a = lift(lerp(e0, e1, t), 0.09), b = lift(lerp(r0, r1, t), 0.09);
    out.push({ kind, solid: 'beam', a, b, t: 0.18, tint: scaleHex(tint, 0.94 + 0.14 * hash01(k)), ...bboxAB(a, b) });
    if (antefix) {
      // a palmette antefix: an upright pentagon at the row's foot, facing out
      const c = lerp(e0, e1, t), sx = u[0] / len, sy = u[1] / len, w = 0.17, h = 0.34;
      const q = [[c[0] - sx * w, c[1] - sy * w, c[2]], [c[0] + sx * w, c[1] + sy * w, c[2]], [c[0] + sx * w, c[1] + sy * w, c[2] + h * 0.6], [c[0], c[1], c[2] + h], [c[0] - sx * w, c[1] - sy * w, c[2] + h * 0.6]];
      out.push(panel('antefix', q, [ox, oy, 0], scaleHex(tint, 1.08)));
    }
  }
  if (ridge) { const a = lift(r0, 0.12), b = lift(r1, 0.12); out.push({ kind, solid: 'beam', a, b, t: 0.32, tint: scaleHex(tint, 0.96), ...bboxAB(a, b) }); }
  return out;
}
const bboxAB = (a, b) => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), d: Math.abs(a[1] - b[1]), z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]) });

// ── the instanced parts ──────────────────────────────────────────────────────────────────────────────
const r2 = (v) => Math.round(v * 100) / 100;
/** A column instance at (x, y, z) in the building's frame. */
export function colInst(order, D, H, tint, x, y, z) {
  const key = `col:${order}:${r2(D)}:${r2(H)}:${tint}`;
  return {
    key, x, y, z, turn: 0,
    make: () => column(order, { D, H, tint }).masses,
    low: () => [{ kind: 'column', solid: 'drum', x: -D / 2, y: -D / 2, w: D, d: D, z0: 0, z1: H, tint, sides: 8 }],
  };
}
/** An entablature run `span` long from (x, y, z), its face toward the frame's `turn` (0 = −y). */
export function entInst(order, D, span, deep, tint, x, y, z, turn, frieze = null) {
  const key = `ent:${order}:${r2(D)}:${r2(span)}:${r2(deep)}:${tint}:${frieze || '-'}:${turn}`;
  const e = () => entablature(order, { D, span, deep, tint, frieze });
  return {
    key, x, y, z, turn,
    make: () => turnMasses(e().masses, turn),
    low: () => turnMasses([sbox('entablature', 0, -0.5 * D, span, deep + 0.5 * D, 0, e().height, tint)], turn),
  };
}
const entHeight = (order, D) => entablature(order, { D, span: 1, deep: 1, tint: '#ffffff', dentils: false }).height;

/**
 * One bay of a two-storey arcade (the basilicas, the Tabularium's gallery), `b` wide, front on y = 0, `pd` deep: a
 * pier with an engaged Tuscan half-column on its front, the arch beside it (its spandrels stepped round the curve
 * through the pier's depth), the storey's entablature across; `storeys` of them, each order `upper` the one below.
 * The bay's right pier is the next bay's; a run ends with `arcadeEnd`.
 */
function arcadeBay({ b, pd, D, storeys = 2, upper = 0.85, tint, floor = true, depth = 0, frieze = null, columns = true }) {
  const out = [], pw = Math.max(1.2, 1.5 * D);
  let z = 0, d = D;
  for (let s = 0; s < storeys; s++) {
    const H = 7 * d, eh = entHeight('tuscan', d), open = b - pw, r = open / 2, spring = Math.max(0.6 * H, H - r - 0.35 * d);
    out.push(sbox('pier', 0, 0, pw, pd, z, z + H, tint));
    if (columns) for (const m of column('tuscan', { D: d, H, tint }).masses) out.push(shift(m, pw / 2, 0, z));
    // the arch: stepped spandrels round the curve, the crown block over it to the entablature
    const n = 12;
    for (let k = 1; k <= n; k++) {
      const z0 = spring + (r * (k - 1)) / n, z1 = spring + (r * k) / n, hw = Math.sqrt(Math.max(0, r * r - (z1 - spring) ** 2)), fill = r - hw;
      if (fill > 0.01) out.push(sbox('arch', pw, 0, fill, pd, z + z0, z + z1, tint), sbox('arch', b - fill, 0, fill, pd, z + z0, z + z1, tint));
    }
    out.push(sbox('arch', pw, 0, open, pd, z + spring + r, z + H, tint));
    // the archivolt and the impost: a band round the opening's face, a moulding at the springing
    if (columns) for (let k = 0; k <= 8; k++) { const t = (Math.PI * k) / 8, cx = pw + r + Math.cos(t) * (r + 0.12), cz = spring + Math.sin(t) * (r + 0.12); out.push(sbox('archivolt', cx - 0.18, -0.08, 0.36, 0.1, z + cz - 0.18, z + cz + 0.18, tint)); }
    out.push(sbox('impost', pw - 0.1, -0.1, 0.1, pd + 0.2, z + spring - 0.25, z + spring, tint), sbox('impost', b, -0.1, 0.1, pd + 0.2, z + spring - 0.25, z + spring, tint));
    if (columns) for (const m of entablature('tuscan', { D: d, span: b, deep: pd - 0.1, tint, dentils: false, frieze: s === 0 ? frieze : null }).masses) out.push(shift(m, 0, -d * 0.4, z + H));   // `frieze`: the lower storey's
    else out.push(sbox('band', 0, -0.08, b, pd + 0.16, z + H, z + H + entHeight('tuscan', d), tint));   // an inner arcade: a plain band where the order's entablature runs outside
    z += H + eh;
    // the gallery floor behind the arcade, and the ceiling over the top storey
    if (floor && depth > pd) out.push(sbox('floor', 0, pd, b, depth - pd, z - 0.5, z, tint, { underside: true }));
    d *= upper;
  }
  return { masses: out, height: z };
}
const shift = (m, dx, dy, dz) => ({ ...m, x: m.x + dx, y: m.y + dy, z0: m.z0 + dz, z1: m.z1 + dz, ...(m.top ? { top: { ...m.top, x: m.top.x + dx, y: m.top.y + dy } } : {}), ...(m.pts ? { pts: m.pts.map(([x, y, z]) => [x + dx, y + dy, z + dz]) } : {}), ...(m.a ? { a: [m.a[0] + dx, m.a[1] + dy, m.a[2] + dz], b: [m.b[0] + dx, m.b[1] + dy, m.b[2] + dz] } : {}) });   // a beam's ends move too
export function arcadeHeight(D, storeys = 2, upper = 0.85) { let z = 0, d = D; for (let s = 0; s < storeys; s++) { z += 7 * d + entHeight('tuscan', d); d *= upper; } return z; }
/** An arcade bay instance at (x, y, z), facing `turn`. */
export function bayInst(opts, x, y, z, turn) {
  const { b, pd, D, storeys = 2, upper = 0.85, tint, depth = 0, frieze = null, columns = true } = opts;
  const key = `bay:${r2(b)}:${r2(pd)}:${r2(D)}:${storeys}:${upper}:${r2(depth)}:${tint}:${frieze || '-'}:${columns ? 'o' : 'i'}:${turn}`;
  return {
    key, x, y, z, turn,
    make: () => turnMasses(arcadeBay(opts).masses, turn),
    low: () => {
      const h = arcadeHeight(D, storeys, upper), pw = Math.max(1.2, 1.5 * D);
      return turnMasses([sbox('pier', 0, 0, pw, pd, 0, h, tint), sbox('arch', pw, 0, b - pw, pd, h * 0.42, h, tint)], turn);
    },
  };
}

// ── the temple ───────────────────────────────────────────────────────────────────────────────────────
/**
 * A Roman podium temple in a W × D frame (front −y): the podium with its base and crown mouldings, the stair cut into
 * its front between cheek walls (a tribunal part way up where `tribunal` is given, as at Castor), the columns
 * (`front` across; prostyle with `flank` more down each side, or `peripteral` all round with `flankN` down each side),
 * the cella walls with the door, the entablature on all four sides, the roof's two slopes with the pediments, their
 * raking cornices and the acroteria.
 */
export function podiumTemple({ W, D }, o) {
  const { ph, order, colD, colH, front, flank = 2, peripteral = false, flankN = 0, tribunal = 0, cella = true, z = 0, P, tint = P.luna, roofPitch = 13, roofTint = P.tile, frieze = null, dedication = null, festival = false, sideStairs = false, vaults = false, open = null } = o;
  const out = [], inst = [], grounds = [], e = colD * 1.05, rTop = (colD / 2) * 0.85;
  // the stair cut into the front between cheek walls, 0.3 m risers on 0.36 m treads; with a tribunal, a first flight
  // to it, the platform, a second flight to the stylobate
  const run = (h) => Math.ceil(h / 0.3) * 0.36, sw = W - 2 * e + colD * 1.4, sx = (W - sw) / 2;
  const t1 = tribunal ? run(tribunal) : 0, t2 = run(ph - tribunal), pl = tribunal ? Math.max(2.5, 0.08 * D) : 0, sd = Math.min(D * 0.35, t1 + pl + t2);
  if (tribunal && sideStairs) {
    // Castor's: the platform's front a sheer face (a speakers' platform), "two narrow staircases, at the ends and not
    // in front" up to it (P&A), a balustrade along its edge
    const nw = 2.6;
    for (const x of [sx, W - sx - nw]) out.push(...stairUp({ x, y: 0, w: nw, d: t1 }, z, z + tribunal, tint));
    out.push(box('tribunal', sx + nw, 0, sw - 2 * nw, t1 + pl, z, z + tribunal, tint), box('tribunal', sx, t1, sw, pl, z, z + tribunal, tint));
    out.push(sbox('balustrade', sx + nw, 0, sw - 2 * nw, 0.35, z + tribunal, z + tribunal + 1.05, tint));
  } else if (tribunal) {
    out.push(...stairUp({ x: sx, y: 0, w: sw, d: t1 }, z, z + tribunal, tint));
    out.push(box('tribunal', sx, t1, sw, pl, z, z + tribunal, tint));
  }
  out.push(...stairUp({ x: sx, y: t1 + pl, w: sw, d: sd - t1 - pl }, z + tribunal, z + ph, tint));
  // the podium: base moulding, die and crown moulding (a little proud), round the body and down the cheek walls
  const mould = (x, y, w, d, z0, z1) => out.push(box('podium', x, y, w, d, z + z0, z + z1, tint));
  for (const [inset, z0, z1] of [[-0.25, 0, 0.7], [0, 0.7, ph - 0.55], [-0.2, ph - 0.55, ph]]) {
    mould(inset, sd + inset, W - 2 * inset, D - sd - 2 * inset, z0, z1);
    if (sx > 0.6) for (const cx of [inset, W - sx]) mould(cx, inset, sx - inset, sd - inset, z0, z1);
  }
  // `vaults`: the chambers in the podium's flanks, opening outward behind metal grilles (Castor's banks and strongrooms)
  if (vaults) for (const [x, sg] of [[-0.42, -1], [W + 0.3, 1]]) for (let y = sd + 2.2; y + 2.6 < D - 1.5; y += 4.4) {
    out.push(sbox('vault', x, y, 0.12, 2.6, z + 0.7, z + 3.2, P.door));
    for (let k = 0; k <= 6; k++) out.push(sbox('grille', x + (sg < 0 ? -0.06 : 0.06), y + k * 0.43, 0.06, 0.06, z + 0.7, z + 3.2, P.bronze));
    for (const zz of [1.5, 2.4]) out.push(sbox('grille', x + (sg < 0 ? -0.06 : 0.06), y, 0.06, 2.6, z + zz, z + zz + 0.06, P.bronze));
  }
  // the columns
  const zs = z + ph, x0 = e, x1 = W - e, pitch = (x1 - x0) / (front - 1), fy = sd + e;
  const cols = [];
  for (let i = 0; i < front; i++) cols.push([x0 + i * pitch, fy]);
  let backY;
  if (peripteral) {
    const by = D - e, py = (by - fy) / (flankN - 1);
    for (let j = 1; j < flankN; j++) { cols.push([x0, fy + j * py], [x1, fy + j * py]); }
    for (let i = 1; i < front - 1; i++) cols.push([x0 + i * pitch, by]);
    backY = by;
  } else {
    for (let j = 1; j <= flank; j++) cols.push([x0, fy + j * pitch], [x1, fy + j * pitch]);
    backY = D - e;
  }
  for (const [x, y] of cols) inst.push(colInst(order, colD, colH, tint, x, y, zs));
  // `festival`: garlands swung between the front columns under the architrave
  if (festival) for (let i = 0; i + 1 < front; i++) out.push(...festoon([x0 + i * pitch, fy - colD * 0.55, zs + colH * 0.88], [x0 + (i + 1) * pitch, fy - colD * 0.55, zs + colH * 0.88], colH * 0.08, P));
  // the cella: walls flush with the column lines of a prostyle temple, inside the peristyle of a peripteral one
  const top = zs + colH;
  if (cella) {
    const cx0 = peripteral ? x0 + pitch * 0.9 : x0 - colD * 0.4, cx1 = peripteral ? x1 - pitch * 0.9 : x1 + colD * 0.4;
    const cy0 = peripteral ? fy + Math.max(pitch * 2, (backY - fy) * 0.28) : fy + (flank + 0.5) * pitch, cy1 = peripteral ? backY - pitch * 0.9 : backY + colD * 0.4;
    if (!open) {
      out.push(box('cella', cx0, cy0, cx1 - cx0, cy1 - cy0, zs, top, tint));
      out.push(box('door', W / 2 - pitch * 0.4, cy0 - 0.06, pitch * 0.8, 0.1, zs, zs + colH * 0.58, P.door, { skin: null }));
    } else {
      // the cella opened: at the record's size (`open.cella`), its walls with the doorway, the bronze leaves swung back,
      // the floor, the smaller order along its side walls, the coffered ceiling
      const c = open.cella || { w: cx1 - cx0, d: cy1 - cy0 }, qx0 = W / 2 - c.w / 2, qx1 = W / 2 + c.w / 2, qy1 = cy1, qy0 = cy1 - c.d, t = 1.2;
      const dw = Math.min(5, c.w * 0.3), dh = colH * 0.62, mx = W / 2;
      out.push(box('cella', qx0, qy0, t, c.d, zs, top, tint), box('cella', qx1 - t, qy0, t, c.d, zs, top, tint), box('cella', qx0, qy1 - t, c.w, t, zs, top, tint));
      out.push(box('cella', qx0 + t, qy0, mx - dw / 2 - qx0 - t, t, zs, top, tint), box('cella', mx + dw / 2, qy0, qx1 - t - mx - dw / 2, t, zs, top, tint), box('cella', mx - dw / 2, qy0, dw, t, zs + dh, top, tint));
      for (const sg of [-1, 1]) out.push(sbox('door-leaf', mx + sg * dw / 2 - (sg > 0 ? 0.14 : 0), qy0 + t, 0.14, dw / 2, zs, zs + dh, P.bronze));
      grounds.push({ kind: 'floor', x: qx0 + t, y: qy0 + t, w: c.w - 2 * t, d: c.d - 2 * t, z: zs + 0.12, fill: P.luna, surface: open.floor || 'tessellatum' });
      if (open.inner) {
        const { D: iD, H: iH, n, tint: it } = open.inner, iy0 = qy0 + t + 2.4, iy1 = qy1 - t - 1.4;
        for (let k = 0; k < n; k++) for (const x of [qx0 + t + 1.1, qx1 - t - 1.1]) inst.push(colInst('corinthian', iD, iH, it, x, iy0 + ((iy1 - iy0) * k) / (n - 1), zs + 0.12));
        for (const x of [qx0 + t, qx1 - t - 1.7]) out.push(sbox('inner-cornice', x, qy0 + t, 1.7, c.d - 2 * t, zs + 0.12 + iH, zs + 0.12 + iH + 0.7, tint));
      }
      // `open.statues`: the cult statues on a base against the back wall
      if (open.statues) { const by = qy1 - t - 1.6; out.push(...statueBase(mx, by, 5, 1.8, 1.6, P.luna).map((m) => ({ ...m, z0: m.z0 + zs + 0.12, z1: m.z1 + zs + 0.12 }))); for (const sg of [-1, 1]) out.push(...figure(mx + sg * 1.2, by, zs + 1.72, 3.4, open.statues, { dir: Math.PI, raised: sg > 0 })); }
      // the coffered ceiling, seen from below: the panel and a grid of beams
      out.push(sbox('ceiling', qx0 + t, qy0 + t, c.w - 2 * t, c.d - 2 * t, top - 0.5, top, tint, { underside: true }));
      for (let x = qx0 + t + 1.9; x < qx1 - t - 0.5; x += 1.9) out.push(sbox('coffer', x - 0.15, qy0 + t, 0.3, c.d - 2 * t, top - 0.85, top - 0.5, tint, { underside: true }));
      for (let y = qy0 + t + 1.9; y < qy1 - t - 0.5; y += 1.9) out.push(sbox('coffer', qx0 + t, y - 0.15, c.w - 2 * t, 0.3, top - 0.85, top - 0.5, tint, { underside: true }));
      // the pronaos floor, white marble, from the front columns to the doorway
      grounds.push({ kind: 'floor', x: x0 - rTop, y: fy - rTop, w: x1 - x0 + 2 * rTop, d: qy0 - fy + rTop, z: zs + 0.12, fill: P.luna, surface: 'flagstone' });
    }
  }
  // the entablature on all four sides, over the column lines: front and back runs from column to column, the sides likewise
  const eh = entHeight(order, colD), deep = colD * 1.2;
  // `frieze`: a skin for the frieze all round (a carved scroll); `dedication`: the front's frieze only (a dedication in letters)
  const runX = (y, turn, skin = frieze) => { // along x at the line y; turn 0 faces −y, 2 faces +y
    const xs = [x0 - e, ...Array.from({ length: front }, (_, i) => x0 + i * pitch), x1 + e];
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i], bb = xs[i + 1], span = bb - a;
      inst.push(turn === 0 ? entInst(order, colD, span, deep, tint, a, y - rTop, top, 0, skin) : entInst(order, colD, span, deep, tint, bb, y + rTop, top, 2, skin));
    }
  };
  runX(fy, 0); runX(backY, 2);
  // `dedication`: one band of letters across the whole front frieze, a hair proud of it (the runs are instances: a skin on
  // them would start again at every column)
  if (dedication) { const { ha, hf } = entablatureBands(order, colD); out.push(sbox('dedication', x0 - e, fy - rTop - 0.03, x1 - x0 + 2 * e, 0.03, top + ha + 0.04, top + ha + hf - 0.04, tint, { skin: dedication })); }
  const sideYs = (() => { const ys = [fy - e]; const n = Math.max(1, Math.round((backY - fy) / pitch)); for (let j = 0; j <= n; j++) ys.push(fy + ((backY - fy) * j) / n); ys.push(backY + e); return ys; })();
  for (let j = 0; j + 1 < sideYs.length; j++) {
    const a = sideYs[j], bb = sideYs[j + 1], span = bb - a;
    inst.push(entInst(order, colD, span, deep, tint, x0 - rTop, bb, top, 3, frieze));   // the left side, facing −x
    inst.push(entInst(order, colD, span, deep, tint, x1 + rTop, a, top, 1, frieze));    // the right side, facing +x
  }
  // the roof's base fills the entablature ring; the roof rises over it to the ridge
  out.push(sbox('roof-base', x0 - rTop + 0.05, fy - rTop + 0.05, x1 - x0 + 2 * rTop - 0.1, backY - fy + 2 * rTop - 0.1, top, top + eh - 0.05, tint));
  const ez = top + eh, rx0 = x0 - rTop - 0.7 * colD, rx1 = x1 + rTop + 0.7 * colD, ry0 = fy - rTop - 0.6 * colD, ry1 = backY + rTop + 0.6 * colD;
  const rh = ((rx1 - rx0) / 2) * Math.tan((roofPitch * Math.PI) / 180), mx = (rx0 + rx1) / 2;
  out.push(...tiled([[rx0, ry0, ez], [mx, ry0, ez + rh], [mx, ry1, ez + rh], [rx0, ry1, ez]], P, { tint: roofTint, ridge: true }));
  out.push(...tiled([[mx, ry0, ez + rh], [rx1, ry0, ez], [rx1, ry1, ez], [mx, ry1, ez + rh]], P, { tint: roofTint }));
  for (const [y, sgn] of [[ry0, -1], [ry1, 1]]) {
    // the tympanum set back, the raking cornices along the slopes, the horizontal cornice under it, the acroteria
    const ty = y - sgn * 0.5 * colD;
    out.push(panel('tympanum', [[rx0 + 0.6, ty, ez], [rx1 - 0.6, ty, ez], [mx, ty, ez + rh - 0.4]], [0, sgn, 0], P.tympanum || tint));
    for (const [a, bb] of [[[rx0, y, ez], [mx, y, ez + rh]], [[mx, y, ez + rh], [rx1, y, ez]]]) out.push(beamOf('raking-cornice', [a[0], a[1] - sgn * 0.25 * colD, a[2] + 0.12 * colD], [bb[0], bb[1] - sgn * 0.25 * colD, bb[2] + 0.12 * colD], 0.55 * colD, tint));
    out.push(sbox('acroterion', mx - 0.5 * colD, y - sgn * 0.4 * colD - 0.5 * colD, colD, colD, ez + rh, ez + rh + 1.6 * colD, P.gilt));
    for (const ax of [rx0 + 0.3, rx1 - 0.3 - 0.8 * colD]) out.push(sbox('acroterion', ax, y - sgn * 0.4 * colD - 0.4 * colD, 0.8 * colD, 0.8 * colD, ez, ez + 1.2 * colD, P.gilt));
  }
  return { boxes: out, inst, grounds, height: ez + rh };
}
/** A stair rising toward +y across the rect from z0 to z1, 0.3 m risers. */
function stairUp(r, z0, z1, tint) { return flight(r, z0, z1, tint, 'y', Math.max(1, Math.round((z1 - z0) / 0.3))); }

/** A round temple (Vesta): a round podium with a front stair, `n` columns round the cella, a ring entablature, the conical roof with its smoke hole. */
export function roundTemple({ W, D }, { ph, n, colD, colH, P, tint = P.luna }) {
  const out = [], inst = [], cx = W / 2, R = Math.min(W, D) / 2, cy = D - R;
  out.push(...lathe('podium', cx, cy, [[R, 0], [R, 0.5], [R - 0.15, 0.6], [R - 0.15, ph - 0.4], [R, ph - 0.3], [R, ph]], tint, { sides: 40, cap: true }));
  out.push(...stairUp({ x: cx - 2.4, y: cy - R - ph * 1.2, w: 4.8, d: ph * 1.2 + 0.4 }, 0, ph, tint));
  const rc = R - colD * 0.9;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / 2; inst.push(colInst('corinthian', colD, colH, tint, cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, ph)); }
  const rcell = rc - colD * 2.2, top = ph + colH;
  out.push(...lathe('cella', cx, cy, [[rcell, ph], [rcell, top]], tint, { sides: 32 }));
  out.push(box('door', cx - 0.9, cy - rcell - 0.15, 1.8, 0.3, ph, ph + colH * 0.6, P.door));
  // the entablature as a ring: architrave, frieze, cornice; then the cone and its opening
  const re = rc + colD * 0.45;
  out.push(...lathe('entablature', cx, cy, [[rc - colD * 0.5, top], [re, top], [re, top + colD * 0.7], [re - 0.05, top + colD * 0.72], [re - 0.05, top + colD * 1.3], [re + colD * 0.45, top + colD * 1.45], [re + colD * 0.45, top + colD * 1.7]], tint, { sides: 40 }));
  const ez = top + colD * 1.7;
  out.push(...lathe('roof', cx, cy, [[re + colD * 0.45, ez], [1.2, ez + R * 0.75], [0.9, ez + R * 0.75]], P.bronze, { sides: 40 }));
  // the cone's ribs: bronze cover strips from the eave to the smoke hole
  for (let i = 0; i < 40; i++) {
    const a = ((i + 0.5) / 40) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), r0 = re + colD * 0.45, h = R * 0.75;
    const A = [cx + c * r0, cy + sn * r0, ez + 0.08], B = [cx + c * 1.25, cy + sn * 1.25, ez + h + 0.06];
    out.push({ kind: 'roof', solid: 'beam', a: A, b: B, t: 0.14, tint: scaleHex(P.bronze, 0.95 + 0.1 * hash01(i)), ...bboxAB(A, B) });
  }
  return { boxes: out, inst, height: ez + R * 0.75 };
}

// ── the halls ────────────────────────────────────────────────────────────────────────────────────────
/**
 * A basilica in a W × D frame, its forum front on −y: the two-storey arcade bays along the front (and the short
 * sides where `sides`), the aisle behind them under the gallery, the nave block rising to its clerestory with a
 * band of dark windows, the timber roof's tiled slopes. `shops`: a wall of shop doors at the back of the front
 * portico (the Tabernae Novae).
 */
export function basilica({ W, D }, { bays, D: colD, pd = 1.4, aisle = 7.5, sides = true, shops = false, frieze = null, captives = false, festival = false, P, tint = P.luna }) {
  const out = [], inst = [], b = W / bays, h = arcadeHeight(colD);
  const opts = { b, pd, D: colD, tint, depth: aisle, frieze };
  for (let i = 0; i < bays; i++) inst.push(bayInst(opts, i * b, 0, 0, 0));
  out.push(sbox('pier', W - 1.5 * colD, 0, 1.5 * colD, pd, 0, h, tint));   // the run's last pier
  const pw = Math.max(1.2, 1.5 * colD), spring1 = Math.max(0.6 * 7 * colD, 7 * colD - (b - pw) / 2 - 0.35 * colD);
  // `captives`: an attic over the arcade, a kneeling captive in coloured marble over each pier, a portrait shield between
  if (captives) {
    out.push(sbox('attic', 0, 0, W, pd, h, h + 2.4, tint));
    for (let i = 0; i <= bays; i++) {
      const x = Math.min(W - pw / 2, i * b + pw / 2);
      out.push(...figure(x, -0.45, h, 2.9, i % 2 ? P.giallo : P.pavonazzetto, { kneel: true, raised: true }));
      if (i < bays) out.push(...clipeus(i * b + b / 2 + pw / 2, -0.02, h + 1.2, [0, -1], 0.75, { ...P, gilt: P.luna }, 'portrait-shield'));
    }
  }
  // `festival`: a gilded shield hung on each lower pier's face, as the aediles hung them for a procession
  if (festival) for (let i = 0; i <= bays; i++) out.push(...clipeus(Math.min(W - pw / 2, i * b + pw / 2), -0.62 * colD, spring1 + 0.4, [0, -1], 0.62, P));
  if (sides) {
    const nb = Math.max(1, Math.round((D * 0.5) / b)), sb = (D * 0.5) / nb, so = { b: sb, pd, D: colD, tint, depth: aisle };
    for (let i = 0; i < nb; i++) { inst.push(bayInst(so, 0, (i + 1) * sb, 0, 3)); inst.push(bayInst(so, W, i * sb, 0, 1)); }
  }
  if (shops) {
    out.push(box('shop-wall', 0, aisle, W, 0.8, 0, h, P.travertine));
    for (let i = 0; i < bays; i++) out.push(box('door', i * b + b * 0.25, aisle - 0.06, b * 0.5, 0.1, 0, 3.4, P.shop));
  }
  // the nave: behind the aisle, rising past the arcade to the clerestory
  const ny = aisle + (shops ? 0.8 : 0), nh = h + 8;
  out.push(box('hall-wall', 0, ny, W, D - ny, 0, h + 1.2, tint));
  out.push(box('clerestory', W * 0.08, ny + 2, W * 0.84, D - ny - 4, h + 1.2, nh, tint));
  for (let x = W * 0.1; x < W * 0.9; x += 4.2) out.push(box('window', x, ny + 1.94, 1.8, 0.1, h + 3, h + 6, P.shop, { skin: null }));
  // the aisle's lean-to roof over the gallery, and the nave's gable
  out.push(...tiled([[0, -0.6, h], [W, -0.6, h], [W, ny + 2, h + 1.6], [0, ny + 2, h + 1.6]], P));
  // the galleries' ceilings, seen from below through the upper arches (a roof's slope is drawn from above only)
  out.push(box('ceiling', 0, 0, W, ny, h - 0.35, h, tint));
  if (sides) for (const x of [0, W - aisle]) out.push(box('ceiling', x, ny, aisle, D - ny, h - 0.35, h, tint));
  // the side aisles' lean-to roofs, over the short sides' galleries
  if (sides) for (const [xa, xb, sgn] of [[-0.6, aisle + 2, -1], [W + 0.6, W - aisle - 2, 1]]) out.push(...tiled([[xa, -0.6, h], [xa, D + 0.6, h], [xb, D + 0.6, h + 1.6], [xb, -0.6, h + 1.6]], P));
  const ry = ny + 2, rd = D - ny - 4, rh = (rd / 2) * Math.tan((14 * Math.PI) / 180);
  out.push(...tiled([[W * 0.06, ry - 0.5, nh], [W * 0.94, ry - 0.5, nh], [W * 0.94, ry + rd / 2, nh + rh], [W * 0.06, ry + rd / 2, nh + rh]], P, { ridge: true }));
  out.push(...tiled([[W * 0.06, ry + rd / 2, nh + rh], [W * 0.94, ry + rd / 2, nh + rh], [W * 0.94, ry + rd + 0.5, nh], [W * 0.06, ry + rd + 0.5, nh]], P));
  for (const x of [W * 0.06, W * 0.94]) out.push(panel('gable', [[x, ry - 0.5, nh], [x, ry + rd + 0.5, nh], [x, ry + rd / 2, nh + rh]], [x < W / 2 ? -1 : 1, 0, 0], tint));
  return { boxes: out, inst, height: nh + rh };
}

/** The Tabularium's front in a W × D frame (front −y): the tall blank wall with its small windows, the gallery of arches over it, a parapet. */
export function tabularium({ W, D }, { arches = 11, wall = 9, colD = 1.25, P }) {
  const out = [], inst = [], b = W / arches, tint = P.peperino;
  out.push(box('tabularium-wall', 0, 0, W, D, 0, wall, tint));
  for (let i = 0; i < arches; i++) out.push(box('window', i * b + b / 2 - 0.45, -0.06, 0.9, 0.1, wall * 0.55, wall * 0.55 + 1.4, P.shop, { skin: null }));
  const opts = { b, pd: 2.2, D: colD, storeys: 1, tint, depth: 5 };
  for (let i = 0; i < arches; i++) inst.push(bayInst(opts, i * b, 0, wall, 0));
  const h = wall + arcadeHeight(colD, 1);
  out.push(sbox('pier', W - 1.5 * colD, 0, 1.5 * colD, 2.2, wall, h, tint));
  out.push(box('gallery-back', 0, 5, W, D - 5, wall, h, tint));
  out.push(box('parapet', 0, 0, W, D, h, h + 1.6, tint));
  return { boxes: out, inst, height: h + 1.6 };
}

/** The Rostra in a W × D frame (front −y): the marble-faced platform, two rows of bronze beaks on its face, the balustrade, the curved stair behind read as straight flights. */
export function rostra({ W, D }, { h = 3, P }) {
  const out = [];
  out.push(box('rostra', 0, 0, W, D - 3, 0, h, P.luna));
  out.push(...flight({ x: 0, y: D - 3, w: W, d: 3 }, 0, h, P.travertine, 'y', 10).map((s) => ({ ...s, y: 2 * (D - 3) + 3 - s.y - s.d })));
  // the beaks: bronze rams in two rows across the face
  for (const [zr, off] of [[h * 0.62, 0], [h * 0.3, 0.5]]) for (let x = 1 + off * 2; x < W - 1; x += 2.1) out.push(beamOf('beak', [x, -0.1, zr], [x, -1.3, zr - 0.15], 0.45, P.bronze));
  // the balustrade, open in the middle
  for (const [x0, x1] of [[0, W / 2 - 1.5], [W / 2 + 1.5, W]]) out.push(sbox('balustrade', x0, 0, x1 - x0, 0.35, h, h + 1.05, P.luna));
  return { boxes: out, inst: [] };
}

/** The Arch of Augustus in a W × D frame (front −y, the passages along y): the tall vaulted middle bay, the flat-lintelled side bays under pediments, half-columns, the attic, the quadriga, the Parthians. */
export function augustusArch({ W, D }, { P, colD = 0.62 }) {
  const out = [], inst = [], tint = P.luna, [p0, p1] = [1.35, 2.95], side = 2.55, mid = 4.05;
  const xs = [0, p0, p0 + side, p0 + side + p1, p0 + side + p1 + mid, p0 + side + p1 + mid + p1, W - p0];
  const hMid = 9.4, hSide = 6.2, top = 11.6;
  for (const [x0, x1] of [[xs[0], xs[1]], [xs[2], xs[3]], [xs[4], xs[5]], [xs[6], W]]) out.push(sbox('pier', x0, 0, x1 - x0, D, 0, top, tint));
  // the side bays: flat lintels, a pediment over each on both faces
  for (const [x0, x1] of [[xs[1], xs[2]], [xs[5], xs[6]]]) {
    out.push(sbox('lintel', x0, 0, x1 - x0, D, hSide, top, tint));
    for (const [y, sgn] of [[-0.3, -1], [D + 0.3, 1]]) out.push(panel('pediment', [[x0 - 0.4, y, hSide + 0.6], [x1 + 0.4, y, hSide + 0.6], [(x0 + x1) / 2, y, hSide + 1.8]], [0, sgn, 0], tint));
  }
  // the Fasti: tablets on the side bays' passage walls (record: fasti-arch, its place disputed)
  for (const [x0, x1] of [[xs[1], xs[2]], [xs[5], xs[6]]]) for (const [x, n] of [[x0 + 0.02, 1], [x1 - 0.08, -1]]) out.push(sbox('fasti', x, 0.4, 0.06, D - 0.8, 1.2, hSide - 0.5, tint, { skin: 'fasti' }));
  // the middle bay's arch: stepped spandrels
  const r = mid / 2, spring = hMid - r;
  for (let k = 1; k <= 12; k++) { const z0 = spring + (r * (k - 1)) / 12, z1 = spring + (r * k) / 12, hw = Math.sqrt(Math.max(0, r * r - (z1 - spring) ** 2)), f = r - hw; if (f > 0.01) out.push(sbox('arch', xs[3], 0, f, D, z0, z1, tint), sbox('arch', xs[4] - f, 0, f, D, z0, z1, tint)); }
  out.push(sbox('arch', xs[3], 0, mid, D, hMid, top, tint));
  // half-columns on the middle piers, both faces
  for (const x of [xs[2] + p1 / 2, xs[4] + p1 / 2]) for (const y of [0, D]) inst.push(colInst('corinthian', colD, top - 1.6 - 0.2, tint, x, y, 0));
  out.push(sbox('cornice', -0.3, -0.4, W + 0.6, D + 0.8, top - 1.6, top, tint));
  // the attic over the middle bay, the quadriga on it, the Parthians over the side bays
  out.push(sbox('attic', xs[2], 0, xs[5] - xs[2], D, top, top + 2.4, tint));
  out.push(sbox('quadriga', W / 2 - 2.2, D / 2 - 1.3, 4.4, 2.6, top + 2.4, top + 5.2, P.gilt));
  for (const x of [xs[1] + side / 2, xs[5] + side / 2]) out.push(sbox('statue', x - 0.4, D / 2 - 0.4, 0.8, 0.8, top, top + 2.2, P.bronze));
  return { boxes: out, inst };
}

/** A single-bay arch (Tiberius): piers, the vault, the attic with its statue group. */
export function singleArch({ W, D }, { P }) {
  const out = [], tint = P.luna, open = W * 0.45, pw = (W - open) / 2, r = open / 2, spring = 6.5, top = spring + r + 1.8;
  out.push(sbox('pier', 0, 0, pw, D, 0, top, tint), sbox('pier', W - pw, 0, pw, D, 0, top, tint));
  for (let k = 1; k <= 12; k++) { const z0 = spring + (r * (k - 1)) / 12, z1 = spring + (r * k) / 12, f = r - Math.sqrt(Math.max(0, r * r - (z1 - spring) ** 2)); if (f > 0.01) out.push(sbox('arch', pw, 0, f, D, z0, z1, tint), sbox('arch', W - pw - f, 0, f, D, z0, z1, tint)); }
  out.push(sbox('arch', pw, 0, open, D, spring + r, top, tint));
  out.push(sbox('cornice', -0.3, -0.3, W + 0.6, D + 0.6, top - 0.8, top, tint), sbox('attic', 0.4, 0.4, W - 0.8, D - 0.8, top, top + 2.2, tint));
  out.push(sbox('statue', W / 2 - 1.6, D / 2 - 0.9, 3.2, 1.8, top + 2.2, top + 4.6, P.gilt));
  return { boxes: out, inst: [] };
}

/** The Curia (front −y): a tall hall on a low platform, a columned porch across its front, the gable with a Victory on the apex. */
export function curia({ W, D }, { P, h = 21 }) {
  const out = [], inst = [], tint = P.luna, porch = 4.5, plat = 1.2, colD = 0.75, colH = 9 * colD;
  out.push(box('podium', 0, 0, W, D, 0, plat, P.travertine));
  out.push(box('hall-wall', 0, porch, W, D - porch, plat, h, P.stucco));
  out.push(box('door', W / 2 - 1.6, porch - 0.06, 3.2, 0.1, plat, plat + 5.9, P.bronze, { skin: null }));
  for (let i = 0; i < 6; i++) inst.push(colInst('ionic', colD, colH, tint, 0.8 + (i * (W - 1.6)) / 5, 0.8, plat));
  out.push(sbox('porch-roof', 0, 0, W, porch, plat + colH, plat + colH + 1.2, tint));
  const rh = (W / 2) * Math.tan((16 * Math.PI) / 180);
  out.push(...tiled([[-0.4, porch - 0.4, h], [W / 2, porch - 0.4, h + rh], [W / 2, D + 0.4, h + rh], [-0.4, D + 0.4, h]], P, { ridge: true }));
  out.push(...tiled([[W / 2, porch - 0.4, h + rh], [W + 0.4, porch - 0.4, h], [W + 0.4, D + 0.4, h], [W / 2, D + 0.4, h + rh]], P));
  out.push(panel('gable', [[0, porch, h], [W, porch, h], [W / 2, porch, h + rh]], [0, -1, 0], P.stucco));
  out.push(...figure(W / 2, porch, h + rh, 2.2, P.gilt, { raised: true }));   // the Victory on her globe at the apex
  out.push(...lathe('globe', W / 2, porch, [[0.1, h + rh - 0.02], [0.45, h + rh + 0.1], [0.45, h + rh + 0.3], [0.1, h + rh + 0.42]], P.gilt, { sides: 10, cap: true }).map((m) => ({ ...m, z0: m.z0 - 0.42, z1: m.z1 - 0.42, pts: m.pts.map(([x, y, z]) => [x, y, z - 0.42]) })));
  for (const x of [0.6, W - 0.6]) out.push(...figure(x, 0.6, plat + colH + 1.2, 2.1, P.bronze));   // the statues at the porch's ends (the coin of 29–27 BCE)
  return { boxes: out, inst };
}

/** A plain block under a tile gable (the Regia, the House of the Vestals' ranges). */
export function block({ W, D }, { h, tint, P, door = true }) {
  const out = [box('hall-wall', 0, 0, W, D, 0, h, tint)], rh = (Math.min(W, D) / 2) * Math.tan((16 * Math.PI) / 180);
  if (door) out.push(box('door', W / 2 - 1.1, -0.06, 2.2, 0.1, 0, 3.6, P.door, { skin: null }));
  if (W >= D) {
    out.push(...tiled([[-0.3, -0.4, h], [W + 0.3, -0.4, h], [W + 0.3, D / 2, h + rh], [-0.3, D / 2, h + rh]], P, { ridge: true }));
    out.push(...tiled([[-0.3, D / 2, h + rh], [W + 0.3, D / 2, h + rh], [W + 0.3, D + 0.4, h], [-0.3, D + 0.4, h]], P));
    for (const x of [0, W]) out.push(panel('gable', [[x, 0, h], [x, D, h], [x, D / 2, h + rh]], [x ? 1 : -1, 0, 0], tint));
  } else {
    out.push(...tiled([[-0.4, -0.3, h], [W / 2, -0.3, h + rh], [W / 2, D + 0.3, h + rh], [-0.4, D + 0.3, h]], P, { ridge: true }));
    out.push(...tiled([[W / 2, -0.3, h + rh], [W + 0.4, -0.3, h], [W + 0.4, D + 0.3, h], [W / 2, D + 0.3, h + rh]], P));
    for (const y of [0, D]) out.push(panel('gable', [[0, y, h], [W, y, h], [W / 2, y, h + rh]], [0, y ? 1 : -1, 0], tint));
  }
  return { boxes: out, inst: [] };
}

/** The Temple of Divus Julius: its rostra platform with the niche round the altar in front, the temple on it (a podium temple raised). */
export function divusJulius({ W, D }, { P, festival = false }) {
  const out = [], tint = P.luna, ph = 3.5, niche = 8.3;
  // the platform, open at the front in the niche; side stairs up to it
  const nx = W / 2 - niche / 2;
  out.push(box('podium', 0, niche / 2, W, D - niche / 2, 0, ph, tint), box('podium', 0, 0, nx, niche / 2, 0, ph, tint), box('podium', nx + niche, 0, W - nx - niche, niche / 2, 0, ph, tint));
  out.push(...lathe('altar', W / 2, niche / 2 - 0.2, [[1.6, 0], [1.6, 1.1], [1.75, 1.2], [1.75, 1.35]], P.travertine, { sides: 16, cap: true }));
  // the beaks on the platform's face either side of the niche
  for (const [a, bb] of [[0.8, nx - 0.6], [nx + niche + 0.6, W - 0.8]]) for (let x = a; x < bb; x += 2.2) out.push(beamOf('beak', [x, -0.1, ph * 0.6], [x, -1.2, ph * 0.6 - 0.15], 0.4, P.bronze));
  const t = podiumTemple({ W: W - 4, D: D - niche / 2 - 1 }, { ph: 2.36, order: 'ionic', colD: 1.18, colH: 10.6, front: 6, flank: 2, z: ph, P, tint, frieze: 'acanthus-frieze', dedication: 'bronze-letters', festival });   // record: divus-julius-frieze
  const dx = 2, dy = niche / 2 + 1;
  for (const m of t.boxes) out.push(shift(m, dx, dy, 0));
  return { boxes: out, inst: t.inst.map((i) => ({ ...i, x: i.x + dx, y: i.y + dy })) };
}

// ── monuments: statues, columns, shrines (the forum's furniture at 79: ../record/forum.js) ─────────────
const beam = (kind, a, b, t, tint) => ({ kind, solid: 'beam', a, b, t, tint, ...bboxAB(a, b) });
/** A moulded statue base: plinth, die, crown, `h` high on a `w` × `d` foot centred on (cx, cy). */
export function statueBase(cx, cy, w, d, h, tint) {
  return [sbox('base', cx - w / 2, cy - d / 2, w, d, 0, 0.25, tint), sbox('base', cx - w / 2 + 0.1, cy - d / 2 + 0.1, w - 0.2, d - 0.2, 0.25, h - 0.22, tint), sbox('base', cx - w / 2 - 0.04, cy - d / 2 - 0.04, w + 0.08, d + 0.08, h - 0.22, h, tint)];
}
/**
 * A draped figure `h` tall standing at (cx, cy, z) facing `dir` (radians, 0 = −y): the robe turned as a lathe falling to
 * its hem, the shoulders, the head; one arm raised (`raised`) or held out; `kneel` folds it to a kneeling captive's
 * height. A big read at walking distance: a statue, not a portrait.
 */
export function figure(cx, cy, z, h, tint, { dir = 0, raised = false, kneel = false } = {}) {
  const H = kneel ? h * 0.68 : h, r = h * 0.11, out = [];
  out.push(...lathe('statue', cx, cy, [[r * 1.15, z], [r * 1.05, z + H * 0.25], [r * 0.95, z + H * 0.55], [r * 1.12, z + H * 0.74], [r * 0.9, z + H * 0.8], [r * 0.38, z + H * 0.83]], tint, { sides: 10, cap: true }));
  out.push(...lathe('statue', cx, cy, [[r * 0.25, z + H * 0.82], [r * 0.5, z + H * 0.86], [r * 0.55, z + H * 0.93], [r * 0.4, z + H], [r * 0.12, z + H * 1.01]], tint, { sides: 8, cap: true }));
  const fx = Math.sin(dir), fy = -Math.cos(dir), sx = Math.cos(dir), sy = Math.sin(dir), sh = [cx + sx * r, cy + sy * r, z + H * 0.76];
  const hand = raised ? [sh[0] + sx * r * 0.4 + fx * r * 0.5, sh[1] + sy * r * 0.4 + fy * r * 0.5, z + H * 1.05] : [sh[0] + fx * h * 0.22, sh[1] + fy * h * 0.22, z + H * 0.62];
  out.push(beam('statue', sh, hand, r * 0.42, tint));
  return out;
}
/** A horseman at (cx, cy, z), facing `dir`: the horse's body, neck, head and four legs as beams, the rider astride, an arm raised. */
export function horseman(cx, cy, z, s, tint, { dir = 0 } = {}) {
  const fx = Math.sin(dir), fy = -Math.cos(dir), sx = Math.cos(dir), sy = Math.sin(dir), P = (f, s2, up) => [cx + fx * f + sx * s2, cy + fy * f + sy * s2, z + up];
  const out = [], L = 1.25 * s, legH = 0.95 * s;
  out.push(beam('statue', P(-L / 2, 0, legH + 0.32 * s), P(L / 2, 0, legH + 0.38 * s), 0.5 * s, tint));            // the barrel
  out.push(beam('statue', P(L / 2 - 0.05 * s, 0, legH + 0.45 * s), P(L / 2 + 0.32 * s, 0, legH + 0.98 * s), 0.26 * s, tint));   // the neck
  out.push(beam('statue', P(L / 2 + 0.26 * s, 0, legH + 1.0 * s), P(L / 2 + 0.62 * s, 0, legH + 0.78 * s), 0.2 * s, tint));     // the head
  for (const [f, s2, lift] of [[0.42, -0.15, 0.25], [0.42, 0.15, 0], [-0.45, -0.15, 0], [-0.45, 0.15, 0]]) out.push(beam('statue', P(f * L, s2 * s, legH + 0.15 * s), P(f * L + lift * s * 0.6, s2 * s, lift * s), 0.11 * s, tint));   // a foreleg raised
  out.push(beam('statue', P(-L / 2, 0, legH + 0.4 * s), P(-L / 2 - 0.18 * s, 0, legH - 0.25 * s), 0.12 * s, tint));  // the tail
  out.push(...figure(cx - fx * 0.05 * s, cy - fy * 0.05 * s, z + legH + 0.35 * s, 1.15 * s, tint, { dir, raised: true }));
  return out;
}
/** A rostral column: a base, a shaft studded with ships' beaks in tiers, a capital, and a statue on top where one is attested (`statue`). */
export function rostralColumn(cx, cy, { h, D, tint, beakTint, tiers = 3, statue = null, P }) {
  const out = [...statueBase(cx, cy, D * 1.7, D * 1.7, 1.6, P.luna)];
  out.push(...lathe('column', cx, cy, [[D * 0.62, 1.6], [D * 0.55, 1.75], [D / 2, 1.9], [D * 0.42, h - 0.8], [D * 0.5, h - 0.7], [D * 0.68, h - 0.35], [D * 0.68, h]], tint, { sides: 16, cap: true }));
  for (let t = 0; t < tiers; t++) for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + (t % 2) * Math.PI / 4, zz = 1.9 + ((h - 2.9) * (t + 0.5)) / tiers, c = Math.cos(a), s = Math.sin(a);
    out.push(beam('beak', [cx + c * D * 0.4, cy + s * D * 0.4, zz + 0.25], [cx + c * D * 1.15, cy + s * D * 1.15, zz - 0.05], 0.3, beakTint));
  }
  if (statue) out.push(...figure(cx, cy, h, statue.h, statue.tint, { raised: true }));
  return out;
}
/** The shrine of Ianus Geminus: a small roofless bronze passage, grilled side walls under an entablature, double doors at each end — shut (Vespasian closed them). */
export function ianusShrine({ W, D }, { P }) {
  const out = [], b = P.bronze, h = 4.6;
  for (const x of [0, W - 0.35]) {
    out.push(sbox('shrine', x, 0, 0.35, D, 0, 0.9, b), sbox('shrine', x, 0, 0.35, D, h - 0.9, h, b));
    for (let y = 0.3; y < D - 0.2; y += 0.42) out.push(sbox('grille', x + 0.12, y, 0.1, 0.08, 0.9, h - 0.9, scaleHex(b, 0.8)));
    for (const y of [0, D - 0.4]) out.push(sbox('shrine', x - 0.1, y, 0.55, 0.4, 0, h, b));
  }
  for (const y of [0, D - 0.12]) for (const [x0, x1] of [[0.35, W / 2], [W / 2, W - 0.35]]) out.push(sbox('door', x0, y, x1 - x0 - 0.02, 0.12, 0, h - 0.9, scaleHex(b, 0.92)));   // the doors, shut
  out.push(sbox('entablature', -0.15, -0.15, W + 0.3, D + 0.3, h, h + 0.7, b));
  return { boxes: out, inst: [] };
}
/** The shrine of Venus Cloacina: a round marble base with a projection, a metal railing round it, two female statues. */
export function cloacina(cx, cy, P) {
  const out = [...lathe('base', cx, cy, [[1.2, 0], [1.2, 0.9], [1.28, 1.0], [1.28, 1.1]], P.luna, { sides: 24, cap: true })];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; out.push({ kind: 'railing', solid: 'drum', x: cx + Math.cos(a) * 1.15 - 0.03, y: cy + Math.sin(a) * 1.15 - 0.03, w: 0.06, d: 0.06, z0: 1.1, z1: 2.0, tint: P.bronze, sides: 4 }); }
  out.push(...lathe('railing', cx, cy, [[1.12, 1.95], [1.2, 1.95], [1.2, 2.02], [1.12, 2.02]], P.bronze, { sides: 24 }));
  out.push(...figure(cx - 0.4, cy, 1.1, 1.75, P.luna, { dir: Math.PI }), ...figure(cx + 0.4, cy, 1.1, 1.75, P.luna, { dir: Math.PI, raised: true }));
  return out;
}
/** A puteal: a round well-kerb over a spot struck by lightning, its drum carved (here as mouldings). */
export function puteal(cx, cy, P) { return lathe('puteal', cx, cy, [[0.95, 0], [1.0, 0.12], [0.9, 0.2], [0.9, 0.8], [1.0, 0.88], [1.0, 0.98], [0.75, 0.98]], P.luna, { sides: 20 }); }
/** The Juturna basin by Castor with the Dioscuri and their horses on the central base. */
export function juturna({ W, D }, { P }) {
  const out = [], wall = 0.6;
  for (const [x, y, w, d] of [[0, 0, W, wall], [0, D - wall, W, wall], [0, 0, wall, D], [W - wall, 0, wall, D]]) out.push(sbox('basin', x, y, w, d, 0, 0.9, P.luna));
  out.push(sbox('water', wall, wall, W - 2 * wall, D - 2 * wall, 0, 0.55, '#5f8a96'));
  out.push(...statueBase(W / 2, D / 2, 3, 2, 1.78, P.luna));
  for (const s of [-1, 1]) {
    out.push(...figure(W / 2 + s * 0.55, D / 2, 1.78, 2.0, P.luna, { dir: s * Math.PI / 2 }));
    out.push(...horseman(W / 2 + s * 0.85, D / 2 + 0.5, 1.78, 0.9, P.luna, { dir: s * Math.PI / 2 }).slice(0, 7));   // the horse alone, led
  }
  return { boxes: out, inst: [] };
}
/** The praetor's tribunal: a timber platform on a low stone kerb, a step up, the curule chair. */
export function tribunal(cx, cy, P) {
  const out = [sbox('kerb', cx - 3, cy - 2, 6, 4, 0, 0.35, P.travertine), sbox('tribunal', cx - 2.8, cy - 1.8, 5.6, 3.6, 0.35, 1.5, P.timber)];
  out.push(sbox('step', cx - 1, cy + 1.8, 2, 0.5, 0, 0.75, P.timber), sbox('chair', cx - 0.35, cy - 0.6, 0.7, 0.6, 1.5, 2.0, P.luna));
  return out;
}
/**
 * Bronze letters set into the paving: `text` in square capitals `h` high from (x, y) along +x, each stroke a flat bronze
 * strip proud of the travertine by a centimetre (the Surdinus inscription: its letters are recorded, so it is drawn as
 * written). Arcs are cut into short straight strips.
 */
export function pavedLetters(text, x, y, h, P, { z = 0.06, glyphs }) {
  const out = [], sw = h * 0.14;
  let cx = x;
  for (const ch of text) {
    if (ch === ' ' || ch === '·') { if (ch === '·') out.push(sbox('letter', cx + h * 0.08, y + h * 0.45, sw, sw, z, z + 0.012, P.bronze)); cx += h * 0.42; continue; }
    const g = glyphs[ch] || [], w = h * ({ M: 1.15, I: 0.25, A: 0.95, N: 0.9, V: 0.95, D: 0.88 }[ch] || 0.72);
    for (const st of g) {
      const segs = st[0] === 'arc'
        ? Array.from({ length: 8 }, (_, i) => { const [, ax, ay, rx, ry, a0, a1] = st, end = a1 >= 2 ? a0 + 2 : a1, t0 = a0 + ((end - a0) * i) / 8, t1 = a0 + ((end - a0) * (i + 1)) / 8; return [ax + rx * Math.cos(t0 * Math.PI), ay + ry * Math.sin(t0 * Math.PI), ax + rx * Math.cos(t1 * Math.PI), ay + ry * Math.sin(t1 * Math.PI)]; })
        : [st];
      for (const [u0, v0, u1, v1] of segs) out.push(beam('letter', [cx + u0 * w, y + v0 * h, z + 0.004], [cx + u1 * w, y + v1 * h, z + 0.004], sw, P.bronze));
    }
    cx += w + h * 0.25;
  }
  return out;
}
/** Festival dressing: a gilded round shield (clipeus) hung on a pier face at (x, y, z), facing `n` ([nx, ny]). */
export function clipeus(x, y, z, n, r, P, kind = 'shield') {
  const s = [-n[1], n[0]], pts = (rr, off) => Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return [x + n[0] * off + s[0] * Math.cos(a) * rr, y + n[1] * off + s[1] * Math.cos(a) * rr, z + Math.sin(a) * rr]; });
  return [panel(kind, pts(r, 0.06), [n[0], n[1], 0], P.gilt), panel(kind, pts(r * 0.32, 0.1), [n[0], n[1], 0], scaleHex(P.gilt, 1.12))];
}
/** Festival dressing: a garland swung between two points, sagging `sag` m, as a chain of short green beams with ribbons at its ends. */
export function festoon(a, b, sag, P) {
  const out = [], n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)];
    out.push(beam('garland', p(t0), p(t1), 0.22, i % 2 ? '#5f7a3a' : '#6d8a42'));
  }
  for (const e of [a, b]) out.push(beam('ribbon', e, [e[0], e[1], e[2] - 0.9], 0.06, P.minium));
  return out;
}

/**
 * The Basilica Julia opened (W × D, front −y, standing on its podium of `podium` m; the place lifts it): a flight of steps
 * along the front; the façade arcade on all four sides; inside, the aisles all round (two deep along the long sides, one
 * at the ends: P&A's five aisles), the inner pier arcades on two storeys carrying the galleries, the nave rising to its
 * clerestory windows under a trussed timber roof. Floors as grounds: coloured marble in the nave (opus sectile), white
 * marble in the aisles, the gaming boards in the front aisle. Record: basilica-julia (101 × 49; nave 82 × 16; aisles 7.5).
 */
export function openBasilica({ W, D }, { D: colD, bays, ends = 8, aisle = 7.5, nave = { w: 82, d: 16 }, pd = 1.4, podium = 0.9, festival = false, P, tint = P.luna }) {
  const out = [], inst = [], grounds = [], h = arcadeHeight(colD), h1 = 7 * colD + entHeight('tuscan', colD), b = W / bays, sb = D / ends;
  const outer = { b, pd, D: colD, tint, depth: 0 }, outerS = { ...outer, b: sb };
  // the façade: front and back runs, the two ends
  for (let i = 0; i < bays; i++) { inst.push(bayInst(outer, i * b, 0, 0, 0)); inst.push(bayInst(outer, (i + 1) * b, D, 0, 2)); }
  for (let i = 0; i < ends; i++) { inst.push(bayInst(outerS, 0, (i + 1) * sb, 0, 3)); inst.push(bayInst(outerS, W, i * sb, 0, 1)); }
  for (const [x, y] of [[W - 1.5 * colD, 0], [0, D - pd]]) out.push(sbox('pier', x, y, 1.5 * colD, pd, 0, h, tint));
  // `festival`: a gilded shield on each front pier, as for a procession
  if (festival) { const pw = Math.max(1.2, 1.5 * colD), spring1 = Math.max(0.6 * 7 * colD, 7 * colD - (b - pw) / 2 - 0.35 * colD); for (let i = 0; i <= bays; i++) out.push(...clipeus(Math.min(W - pw / 2, i * b + pw / 2), -0.62 * colD, spring1 + 0.4, [0, -1], 0.62, P)); }
  // the steps up from the street to the podium, along the front, outside the frame
  out.push(...flight({ x: -1, y: -2.4, w: W + 2, d: 2.4 }, -podium, 0, P.luna, 'y', 5));
  // the inner arcades: piers and arches on two storeys, no order (the order is the façade's)
  const nx0 = (W - nave.w) / 2, nx1 = nx0 + nave.w, ny0 = (D - nave.d) / 2, ny1 = ny0 + nave.d, a1 = pd + aisle;
  const inner = (len) => ({ b: len / Math.max(1, Math.round(len / b)), pd: 1.2, D: colD, tint, depth: 0, columns: false });
  const run = (x0, y0, len, turn) => { const o = inner(len), n = Math.round(len / o.b); for (let i = 0; i < n; i++) inst.push(bayInst(o, turn === 0 ? x0 + i * o.b : x0, turn === 0 ? y0 : y0 + (i + 1) * o.b, 0, turn)); return o; };
  // the line between the outer and inner aisles (long sides), and the nave's own arcades (long sides and ends)
  for (const y of [a1, D - a1 - 1.2]) run(nx0, y, nave.w, 0);
  for (const y of [ny0 - 1.2, ny1]) run(nx0, y, nave.w, 0);
  for (const x of [nx0 - 1.2, nx1]) run(x, ny0 - 1.2, nave.d + 2.4, 3);
  // the galleries' floors over the aisles, and their roofs: the outer ring under the façade's lean-to, the inner aisles
  // stepping up to the nave wall
  for (const [x, y, w, d] of [[0, pd, W, aisle], [0, D - pd - aisle, W, aisle], [0, a1, nx0, D - 2 * a1], [nx1, a1, W - nx1, D - 2 * a1], [nx0, a1, nave.w, ny0 - a1], [nx0, ny1, nave.w, D - a1 - ny1]]) {
    out.push(sbox('floor', x, y, w, d, h1 - 0.5, h1, tint, { underside: true }), sbox('ceiling', x, y, w, d, h - 0.4, h, tint, { underside: true }));
  }
  // the nave walls above the arcades: the clerestory, its windows bright with the sky seen through them
  const nh = h + 9;
  for (const [y, sg] of [[ny0 - 1.2, -1], [ny1, 1]]) {
    out.push(box('clerestory', nx0 - 1.2, y, nave.w + 2.4, 1.2, h, nh, tint));
    for (let x = nx0 + 2; x < nx1 - 2; x += 4.1) for (const yy of [y - 0.06, y + 1.16]) out.push(box('window', x, yy, 2, 0.1, h + 2.5, h + 6.5, yy < y + 0.5 === (sg < 0) ? P.shop : P.sky, { skin: null }));
  }
  for (const x of [nx0 - 1.2, nx1]) out.push(box('clerestory', x, ny0 - 1.2, 1.2, nave.d + 2.4, h, nh, tint));
  // the roofs: the outer lean-tos, and the nave's gable on its trusses
  for (const pts of [[[-0.6, -0.6, h], [W + 0.6, -0.6, h], [W + 0.6, ny0 - 1.2, h + 2.2], [-0.6, ny0 - 1.2, h + 2.2]], [[-0.6, ny1 + 1.2, h + 2.2], [W + 0.6, ny1 + 1.2, h + 2.2], [W + 0.6, D + 0.6, h], [-0.6, D + 0.6, h]]]) out.push(...tiled(pts, P));
  const rh = ((nave.d + 2.4) / 2) * Math.tan((16 * Math.PI) / 180), my = (ny0 + ny1) / 2;
  out.push(...tiled([[nx0 - 2, ny0 - 1.8, nh], [nx1 + 2, ny0 - 1.8, nh], [nx1 + 2, my, nh + rh], [nx0 - 2, my, nh + rh]], P, { ridge: true }));
  out.push(...tiled([[nx0 - 2, my, nh + rh], [nx1 + 2, my, nh + rh], [nx1 + 2, ny1 + 1.8, nh], [nx0 - 2, ny1 + 1.8, nh]], P));
  for (const x of [nx0 - 1.2, nx1 + 1.2]) out.push(panel('gable', [[x, ny0 - 1.2, nh], [x, ny1 + 1.2, nh], [x, my, nh + rh]], [x < W / 2 ? -1 : 1, 0, 0], tint), panel('gable', [[x, ny0 - 1.2, nh], [x, my, nh + rh], [x, ny1 + 1.2, nh]], [x < W / 2 ? 1 : -1, 0, 0], tint));
  for (let x = nx0 + 2; x < nx1; x += 5.5) {
    // a truss: the tie-beam across the nave, the rafters up to the ridge, the king post
    out.push(beam('truss', [x, ny0 - 0.6, nh - 0.3], [x, ny1 + 0.6, nh - 0.3], 0.45, P.timber), beam('truss', [x, ny0 - 0.6, nh], [x, my, nh + rh - 0.4], 0.35, P.timber), beam('truss', [x, my, nh + rh - 0.4], [x, ny1 + 0.6, nh], 0.35, P.timber), beam('truss', [x, my, nh - 0.3], [x, my, nh + rh - 0.4], 0.3, P.timber));
  }
  // the floors (a hand's breadth over the podium's top, or the far depth test loses them to it): the nave's coloured
  // marble, the aisles' white marble, the gaming boards in the front aisle
  grounds.push({ kind: 'floor', x: nx0, y: ny0, w: nave.w, d: nave.d, z: 0.12, fill: P.luna, surface: 'opus-sectile' });
  grounds.push({ kind: 'floor', x: pd, y: pd, w: W - 2 * pd, d: aisle - 0.01, z: 0.12, fill: P.luna, surface: 'lusoria' });
  for (const [x, y, w, d] of [[pd, pd + aisle, W - 2 * pd, ny0 - pd - aisle], [pd, ny1, W - 2 * pd, D - pd - ny1], [pd, ny0, nx0 - pd, nave.d], [nx1, ny0, W - pd - nx1, nave.d]]) grounds.push({ kind: 'floor', x, y, w, d, z: 0.12, fill: P.luna, surface: 'flagstone' });
  // the podium under it all, its face a moulded base along the street
  out.push(box('podium', -0.3, -0.3, W + 0.6, D + 0.6, -podium, 0, tint));
  return { boxes: out, inst, grounds, height: nh + rh };
}
