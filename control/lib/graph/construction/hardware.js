// construction/hardware — standard fasteners and fittings by code: what each one is, the tool it takes, what it
// weighs, how it draws, and the hole it asks for in each material it passes through.
//
// A part is a row from its standard plus a length; its geometry is a pure function of the row. A joint never sizes a
// hole: it names a part and asks it (`bore`) for the cutter, so the countersink fits the head it was cut for.
//
// Codes (lengths in mm):
//   'M6x30-hex' | '-socket' | '-button' | '-csk'   ISO 4017 / 4762 / 7380 / 10642, M3–M24 coarse (ISO 261)
//   'nut-M6', 'nyloc-M6'                           ISO 4032 / 7040
//   'washer-M6', 'washer-M6-large'                 ISO 7089 / 7093
//   'wood-4x30' | 'wood-4x30-pan'                  chipboard / wood screw, countersunk (or pan) Pozidriv, 3–6 mm
//   'confirmat-7x50' | 'confirmat-7x70'            one-piece furniture connector (maker drawings, `est`)
//   'dowel-8x35'                                   fluted beech dowel, 6 / 8 / 10 mm
//   'cam-15', 'cam-bolt-15'                        eccentric cam connector and its bolt (maker drawings, `est`)
//   'shelf-pin-5'                                  5 mm shelf support pin
//   'bracket-L40' | 'bracket-L60'                  angle bracket, pressed steel, two screw holes a leg
//   'hinge-35'                                     concealed cup hinge: ⌀35 cup in the door, arm, mounting plate (`est`)
//   'slide-250' … 'slide-550'                      ball-bearing drawer slide, a pair of rails, 45 mm tall, 12.7 mm a side
// Dimensions follow the standards' nominal values; a KD fitting follows one maker's published drawing and is marked
// `est` (another maker's differs by a millimetre or two).
//
// Geometry is in the caller's frame: `at` is where the part seats (the underside of a head, a washer's face, a
// dowel's middle), `axis` the unit direction its shank points into the work. Plain level of detail: heads, shanks and
// bodies as prisms and frustums, no threads.
import { prismPolys, frustumPolys, ngon, boxPolys, across } from './prims.js';

const MM = 0.001;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const HARDWARE_FINISHES = Object.freeze({
  zinc: [196, 200, 206], 'yellow-zinc': [206, 184, 118], 'black-oxide': [58, 60, 64], stainless: [196, 200, 204],
  brass: [200, 164, 88], galvanized: [174, 180, 184], nickel: [210, 212, 214], zamak: [170, 172, 176],
  'white-plastic': [236, 234, 228], 'brown-plastic': [118, 86, 60], black: [44, 44, 46], beech: [214, 184, 140],
});

/** ISO 261 coarse pitch, ISO 273 medium clearance, hex across flats (ISO 4017 / 4032), hex head and nut heights. */
const METRIC = Object.freeze({
  M3: { d: 3, P: 0.5, clear: 3.4, s: 5.5, k: 2, m: 2.4 },
  M4: { d: 4, P: 0.7, clear: 4.5, s: 7, k: 2.8, m: 3.2 },
  M5: { d: 5, P: 0.8, clear: 5.5, s: 8, k: 3.5, m: 4.7 },
  M6: { d: 6, P: 1.0, clear: 6.6, s: 10, k: 4, m: 5.2 },
  M8: { d: 8, P: 1.25, clear: 9, s: 13, k: 5.3, m: 6.8 },
  M10: { d: 10, P: 1.5, clear: 11, s: 16, k: 6.4, m: 8.4 },
  M12: { d: 12, P: 1.75, clear: 13.5, s: 18, k: 7.5, m: 10.8 },
  M16: { d: 16, P: 2.0, clear: 17.5, s: 24, k: 10, m: 14.8 },
  M20: { d: 20, P: 2.5, clear: 22, s: 30, k: 12.5, m: 18 },
  M24: { d: 24, P: 3.0, clear: 26, s: 36, k: 15, m: 21.5 },
});
/** Socket head cap (ISO 4762): head ⌀, hex key. Button (ISO 7380) and countersunk (ISO 10642): head ⌀, height, key. */
const SOCKET = { M3: [5.5, 2.5], M4: [7, 3], M5: [8.5, 4], M6: [10, 5], M8: [13, 6], M10: [16, 8], M12: [18, 10], M16: [24, 14], M20: [30, 17], M24: [36, 19] };
const BUTTON = { M3: [5.7, 1.65, 2], M4: [7.6, 2.2, 2.5], M5: [9.5, 2.75, 3], M6: [10.5, 3.3, 4], M8: [14, 4.4, 5], M10: [17.5, 5.5, 6], M12: [21, 6.6, 8] };
const CSK = { M3: [6.72, 1.86, 2], M4: [8.96, 2.48, 2.5], M5: [11.2, 3.1, 3], M6: [13.44, 3.72, 4], M8: [17.92, 4.96, 5], M10: [22.4, 6.2, 6], M12: [26.88, 7.44, 8] };
/** Washers: [inner ⌀, outer ⌀, thickness] — plain ISO 7089, large ISO 7093. */
const WASHER = { M3: [3.2, 7, 0.5], M4: [4.3, 9, 0.8], M5: [5.3, 10, 1], M6: [6.4, 12, 1.6], M8: [8.4, 16, 1.6], M10: [10.5, 20, 2], M12: [13, 24, 2.5], M16: [17, 30, 3], M20: [21, 37, 3], M24: [25, 44, 4] };
const WASHER_LARGE = { M3: [3.2, 9, 0.8], M4: [4.3, 12, 1], M5: [5.3, 15, 1.2], M6: [6.4, 18, 1.6], M8: [8.4, 24, 2], M10: [10.5, 30, 2.5], M12: [13, 37, 3], M16: [17, 50, 3], M20: [22, 60, 4] };
/** Preferred bolt lengths (ISO 4017 and friends), mm. */
export const BOLT_LENGTHS = Object.freeze([6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200]);

/**
 * Wood and chipboard screws, countersunk Pozidriv: head ⌀ ≈ 2d, 90°. Pilot ⌀ as a fraction of d by what the thread
 * bites into (rules of thumb, `est`): softwood, hardwood, particleboard face and edge, MDF, plywood.
 */
const WOOD = { 3: { dk: 6, drive: 'PZ1' }, 3.5: { dk: 7, drive: 'PZ2' }, 4: { dk: 8, drive: 'PZ2' }, 4.5: { dk: 9, drive: 'PZ2' }, 5: { dk: 10, drive: 'PZ2' }, 6: { dk: 12, drive: 'PZ3' } };
export const PILOT = Object.freeze({ softwood: 0.55, hardwood: 0.7, particleboard: 0.6, mdf: 0.7, plywood: 0.6, osb: 0.6, hardboard: 0.6 });

const DENSITY = { steel: 7850, zamak: 6700, beech: 720, brass: 8500 };
const HEX_KEY = (s) => `hex-key-${s}`;

/** Tools by drive, as the manual names them. */
export const TOOLS = Object.freeze({
  PZ1: 'Pozidriv PZ1 screwdriver', PZ2: 'Pozidriv PZ2 screwdriver', PZ3: 'Pozidriv PZ3 screwdriver',
  hammer: 'hammer', ...Object.fromEntries([2, 2.5, 3, 4, 5, 6, 8, 10, 14, 17, 19].map((s) => [HEX_KEY(s), `${s} mm hex key`])),
  ...Object.fromEntries([5.5, 7, 8, 10, 13, 16, 18, 24, 30, 36].map((s) => [`spanner-${s}`, `${s} mm spanner`])),
});

const round = (v, k = 100) => Math.round(v * k) / k;
const cyl = (r, L) => Math.PI * r * r * L;

/** Parse a code → the part, or null. Every dimension in mm; `massG` in grams. */
export function hardwarePart(code) {
  if (typeof code !== 'string') return null;
  let m;
  if ((m = /^M(\d+)x(\d+(?:\.\d+)?)-(hex|socket|button|csk)$/.exec(code))) {
    const size = `M${m[1]}`, L = +m[2], t = METRIC[size]; if (!t) return null;
    const style = m[3];
    let head, drive, std;
    if (style === 'hex') { head = { shape: 'hex', s: t.s, k: t.k }; drive = `spanner-${t.s}`; std = 'ISO 4017'; }
    else if (style === 'socket') { if (!SOCKET[size]) return null; head = { shape: 'round', dk: SOCKET[size][0], k: t.d }; drive = HEX_KEY(SOCKET[size][1]); std = 'ISO 4762'; }
    else if (style === 'button') { if (!BUTTON[size]) return null; head = { shape: 'dome', dk: BUTTON[size][0], k: BUTTON[size][1] }; drive = HEX_KEY(BUTTON[size][2]); std = 'ISO 7380'; }
    else { if (!CSK[size]) return null; head = { shape: 'csk', dk: CSK[size][0], k: CSK[size][1] }; drive = HEX_KEY(CSK[size][2]); std = 'ISO 10642'; }
    // the length of a countersunk screw includes its head; every other head sits on top of it
    const threadLen = L <= 125 ? Math.min(L, 2 * t.d + 6) : 2 * t.d + 12;
    const vol = cyl(t.d / 2, L) + (head.shape === 'hex' ? (Math.sqrt(3) / 2) * t.s * t.s * t.k : head.shape === 'csk' ? 0 : cyl(head.dk / 2, head.k) * (head.shape === 'dome' ? 0.6 : 1));
    return { code, family: 'bolt', label: `${size}×${L} ${std}`, size, d: t.d, P: t.P, length: L, threadLen: style === 'csk' || L <= 3 * t.d ? L : threadLen, head, drive, clear: t.clear, material: 'steel', finish: 'zinc', massG: round((vol * 1e-9) * DENSITY.steel * 1000, 10) };
  }
  if ((m = /^(nut|nyloc)-M(\d+)$/.exec(code))) {
    const size = `M${m[2]}`, t = METRIC[size]; if (!t) return null;
    const h = m[1] === 'nyloc' ? t.m * 1.3 : t.m;
    const vol = (Math.sqrt(3) / 2) * t.s * t.s * h - cyl(t.d / 2, h);
    return { code, family: 'nut', label: `${size} ${m[1] === 'nyloc' ? 'ISO 7040 nyloc' : 'ISO 4032'} nut`, size, d: t.d, P: t.P, s: t.s, length: h, drive: `spanner-${t.s}`, material: 'steel', finish: 'zinc', massG: round(vol * 1e-9 * DENSITY.steel * 1000, 10) };
  }
  if ((m = /^washer-M(\d+)(-large)?$/.exec(code))) {
    const size = `M${m[1]}`, row = (m[2] ? WASHER_LARGE : WASHER)[size]; if (!row) return null;
    const [di, dout, h] = row;
    return { code, family: 'washer', label: `${size} ${m[2] ? 'ISO 7093 large' : 'ISO 7089'} washer`, size, d: di, od: dout, length: h, material: 'steel', finish: 'zinc', massG: round((cyl(dout / 2, h) - cyl(di / 2, h)) * 1e-9 * DENSITY.steel * 1000, 10) };
  }
  if ((m = /^wood-(\d(?:\.\d)?)x(\d+)(-pan)?$/.exec(code))) {
    const d = +m[1], L = +m[2], row = WOOD[d]; if (!row) return null;
    const pan = !!m[3];
    const head = pan ? { shape: 'dome', dk: row.dk, k: 0.35 * row.dk } : { shape: 'csk', dk: row.dk, k: (row.dk - d) / 2 };
    return { code, family: 'wood-screw', label: `${d}×${L} ${pan ? 'pan' : 'countersunk'} wood screw`, d, core: 0.62 * d, length: L, threadLen: L <= 40 ? L - head.k : Math.round(0.6 * L), head, drive: row.drive, material: 'steel', finish: 'yellow-zinc', pointed: true, massG: round(cyl(0.4 * d, L) * 1e-9 * DENSITY.steel * 1000, 10) };
  }
  if ((m = /^confirmat-7x(50|70)$/.exec(code))) {
    const L = +m[1];
    // head ⌀10 countersunk, a ⌀7 plain neck in the face panel, then the 7 mm thread; stepped drill: ⌀7 through the face
    // panel, ⌀5 pilot in the edge, countersink
    return { code, family: 'confirmat', label: `confirmat 7×${L}`, d: 7, core: 4.8, neck: { d: 7, len: 12 }, length: L, threadLen: L - 12 - 3.5, head: { shape: 'csk', dk: 10, k: 3.5 }, drive: HEX_KEY(4), material: 'steel', finish: 'zinc', est: true, massG: round(cyl(2.8, L) * 1e-9 * DENSITY.steel * 1000, 10) };
  }
  if ((m = /^dowel-(6|8|10)x(30|35|40)$/.exec(code))) {
    const d = +m[1], L = +m[2];
    return { code, family: 'dowel', label: `dowel ${d}×${L}`, d, length: L, drive: 'hammer', material: 'beech', finish: 'beech', massG: round(cyl(d / 2, L) * 1e-9 * DENSITY.beech * 1000, 10) };
  }
  if (code === 'cam-15') {
    // eccentric cam housing: ⌀15 × 12.5 in a ⌀15 bore 13 deep, its centre 24 mm from the panel's edge (est)
    return { code, family: 'cam', label: 'cam lock ⌀15', d: 15, length: 12.5, bore: { d: 15, depth: 13 }, edgeDist: 24, drive: 'PZ2', material: 'zamak', finish: 'zamak', est: true, massG: round(cyl(7.5, 12.5) * 0.55 * 1e-9 * DENSITY.zamak * 1000, 10) };
  }
  if (code === 'cam-bolt-15') {
    // the connecting bolt: an M6 wood thread screwed 11 mm into the other panel's face, a ⌀7 shank, and the ⌀6.5 ball
    // head the cam grips, 24 mm on (est)
    return { code, family: 'cam-bolt', label: 'cam connecting bolt', d: 6, shank: 7, length: 34.5, into: 11, head: { shape: 'ball', dk: 6.5 }, drive: HEX_KEY(4), material: 'steel', finish: 'zinc', est: true, massG: round(cyl(3.5, 34.5) * 1e-9 * DENSITY.steel * 1000, 10) };
  }
  if (code === 'shelf-pin-5') {
    return { code, family: 'shelf-pin', label: 'shelf pin ⌀5', d: 5, length: 16, into: 8, tab: [10, 6, 1.2], drive: null, material: 'brass', finish: 'nickel', massG: 2 };
  }
  if (code === 'hinge-35') {
    // the 35 mm cup sinks 13 mm into the door, its centre 21.5 mm from the door's edge; the plate sits on the side
    // panel's inside face 37 mm back (the 32 mm system's line), held by two screws (est, after the common full-overlay
    // clip hinge)
    return { code, family: 'hinge', label: 'concealed hinge ⌀35', d: 35, length: 12.5, cup: { d: 35, depth: 13 }, edgeDist: 21.5, setback: 37, plate: [12, 50, 4], screw: 'wood-4x16', drive: 'PZ2', material: 'steel', finish: 'nickel', est: true, massG: 85 };
  }
  if ((m = /^slide-(250|300|350|400|450|500|550)$/.exec(code))) {
    const L = +m[1];
    return { code, family: 'slide', label: `drawer slide ${L}`, length: L, h: 45, t: 12.7, drive: 'PZ2', screw: 'wood-4x16', material: 'steel', finish: 'zinc', massG: Math.round(L * 1.4) };
  }
  if ((m = /^bracket-L(40|60)$/.exec(code))) {
    const leg = +m[1], w = leg === 40 ? 16 : 20, t = leg === 40 ? 2 : 2.5;
    const holes = [leg * 0.35, leg * 0.75];
    return { code, family: 'bracket', label: `angle bracket ${leg}×${leg}×${w}`, leg, width: w, t, holes, screw: leg === 40 ? 'wood-4x20' : 'wood-4x25', drive: null, material: 'steel', finish: 'zinc', massG: round(2 * leg * w * t * 1e-9 * DENSITY.steel * 1000, 10) };
  }
  return null;
}

/** Why a code names no part, or null. */
export const hardwareError = (code) => (hardwarePart(code) ? null : `unknown hardware '${code}' (e.g. M6x30-hex, nut-M6, washer-M6, wood-4x30, confirmat-7x50, dowel-8x35, cam-15, shelf-pin-5, bracket-L40)`);

/** The tool a part's drive needs → { key, label } or null. */
export const toolOf = (part) => (part && part.drive ? { key: part.drive, label: TOOLS[part.drive] || part.drive } : null);

/**
 * The shortest preferred bolt length that passes a `grip` (mm) with its washers and nut and leaves `proud` pitches past
 * the nut (default 2) → { length, proudMm }.
 */
export function boltLength(size, grip, { washers = 0, nut = true, proud = 2, large = false } = {}) {
  const t = METRIC[size]; const w = (large ? WASHER_LARGE : WASHER)[size];
  const need = grip + washers * (w ? w[2] : 0) + (nut ? t.m : 0) + proud * t.P;
  const length = BOLT_LENGTHS.find((L) => L >= need - 1e-9) ?? Math.ceil(need / 10) * 10;
  return { length, proudMm: round(length - (need - proud * t.P)) };
}

// ── geometry (plain) ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A part's polygons: head (or body) at `at`, shank along `axis` into the work. Metres in, metres out; the part's mm
 * are converted here. `spin` turns an asymmetric part (a bracket) about its axis: its first leg runs along `spin`.
 */
export function partPolys(part, { at, axis, spin } = {}) {
  const ax = unit(axis); const back = scl(ax, -1);
  const P = (s) => add(at, scl(ax, s * MM));        // a point `s` mm along the axis from the seat
  const r = (v) => (v / 2) * MM;                    // a diameter in mm → a radius in m
  const polys = [];
  const head = part.head;
  if (part.family === 'bolt' || part.family === 'wood-screw' || part.family === 'confirmat') {
    if (head.shape === 'hex') polys.push(...prismPolys(P(-head.k), P(0), ngon(ax, (head.s / Math.sqrt(3)) * MM, 6)));
    else if (head.shape === 'round') polys.push(...prismPolys(P(-head.k), P(0), ngon(ax, r(head.dk), 16)));
    else if (head.shape === 'dome') { polys.push(...frustumPolys(P(0), P(-head.k * 0.55), r(head.dk), r(head.dk * 0.8), 16)); polys.push(...frustumPolys(P(-head.k * 0.55), P(-head.k), r(head.dk * 0.8), r(head.dk * 0.35), 16)); }
    else if (head.shape === 'csk') polys.push(...frustumPolys(P(0), P(head.k), r(head.dk), r(part.neck ? part.neck.d : part.d), 16));
    // a countersunk part's length runs from its head's top (flush at `at`); any other's from under its head
    const s0 = head.shape === 'csk' ? head.k : 0, s1 = part.length;
    if (part.neck) { polys.push(...prismPolys(P(s0), P(s0 + part.neck.len), ngon(ax, r(part.neck.d), 10))); polys.push(...prismPolys(P(s0 + part.neck.len), P(s1 - 2), ngon(ax, r(part.core), 10))); polys.push(...frustumPolys(P(s1 - 2), P(s1), r(part.core), r(part.core * 0.3), 10)); }
    else if (part.pointed) { polys.push(...prismPolys(P(s0), P(s1 - part.d), ngon(ax, r(part.d), 10))); polys.push(...frustumPolys(P(s1 - part.d), P(s1), r(part.d), 0, 10)); }
    else polys.push(...prismPolys(P(s0), P(s1), ngon(ax, r(part.d), 12)));
    return polys;
  }
  if (part.family === 'nut') return prismPolys(P(0), P(part.length), ngon(ax, (part.s / Math.sqrt(3)) * MM, 6));
  if (part.family === 'washer') return prismPolys(P(0), P(part.length), ngon(ax, r(part.od), 16));
  if (part.family === 'dowel') {
    // `at` is the dowel's middle; chamfered both ends
    const h = part.length / 2, c = 1;
    return [...frustumPolys(P(-h), P(-h + c), r(part.d - 2 * c), r(part.d), 12), ...prismPolys(P(-h + c), P(h - c), ngon(ax, r(part.d), 12)), ...frustumPolys(P(h - c), P(h), r(part.d), r(part.d - 2 * c), 12)];
  }
  if (part.family === 'cam') return prismPolys(P(0), P(part.length), ngon(ax, r(part.d), 16));   // flush with the face at `at`
  if (part.family === 'cam-bolt') {
    // `at` is the face of the panel it screws into: the thread runs `into` along axis, the collar, shank and ball head
    // stand out the other way to where the cam grips the ball
    const out = part.length - part.into;
    return [
      ...frustumPolys(P(part.into), P(part.into - 2), 0, r(part.d), 10), ...prismPolys(P(part.into - 2), P(0), ngon(ax, r(part.d), 10)),
      ...prismPolys(P(0), P(-1.5), ngon(ax, r(10), 12)),
      ...prismPolys(P(-1.5), P(-(out - part.head.dk)), ngon(ax, r(part.shank), 10)),
      ...frustumPolys(P(-(out - part.head.dk)), P(-out), r(part.head.dk), r(part.head.dk * 0.5), 10),
    ];
  }
  // `at` is the side panel's face: the pin runs `into` it along axis and stands proud of it as far again
  if (part.family === 'shelf-pin') return prismPolys(P(part.into), P(-part.into), ngon(ax, r(part.d), 10));
  if (part.family === 'hinge') {
    // `at` is the cup's centre on the door's back face, `axis` into the door; `spin` runs from `at` to the centre of the
    // mounting plate on the side (its length is the arm's reach). The plate lies on the side along the depth.
    const reach = spin || [0, 0, 0];
    const plateAt = add(at, reach);
    const up = unit([ax[1] * reach[2] - ax[2] * reach[1], ax[2] * reach[0] - ax[0] * reach[2], ax[0] * reach[1] - ax[1] * reach[0]]);
    const out = [...prismPolys(P(part.cup.depth - 0.5), P(-1), ngon(ax, r(part.d), 16))];          // the cup, its rim proud 1 mm
    const armFrom = add(at, scl(back, 4 * MM)), armTo = add(plateAt, scl(unit(reach), -0.004));
    out.push(...prismPolys(armFrom, armTo, ngon(unit([armTo[0] - armFrom[0], armTo[1] - armFrom[1], armTo[2] - armFrom[2]]), 0.007, 4)));
    const [pw, ph, pt] = part.plate.map((v) => v * MM);
    const n = unit(reach), along = unit([up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]]);
    const c = add(plateAt, scl(n, -pt / 2));
    out.push(...boxPolys([0, 0, 0], [pw, ph, pt]).map(({ corners, n: nn }) => ({ corners: corners.map((p) => add(c, add(add(scl(along, p[0]), scl(up, p[1])), scl(n, p[2])))), n: add(add(scl(along, nn[0]), scl(up, nn[1])), scl(n, nn[2])) })));
    return out;
  }
  if (part.family === 'slide') {
    // `at` is the rail's front end on the cabinet side's inside face, `axis` into that side, `spin` along the rail
    // (toward the back). Two nested rails: the cabinet member on the face, the drawer member beside it.
    const e = unit(spin || across(ax)[0]); const up = unit([ax[1] * e[2] - ax[2] * e[1], ax[2] * e[0] - ax[0] * e[2], ax[0] * e[1] - ax[1] * e[0]]);
    const L = part.length * MM, t = (part.t / 2) * MM;
    const rail = (off, h, gap) => {
      const c = add(at, add(scl(e, L / 2), scl(back, off + gap)));
      return boxPolys([0, 0, 0], [L, h * MM, t]).map(({ corners, n: nn }) => ({ corners: corners.map((p) => add(c, add(add(scl(e, p[0]), scl(up, p[1])), scl(back, p[2])))), n: add(add(scl(e, nn[0]), scl(up, nn[1])), scl(back, nn[2])) }));
    };
    return [...rail(t / 2, part.h, 0), ...rail(t * 1.5, part.h * 0.78, 0.0003)];
  }
  if (part.family === 'bracket') {
    // An inside corner between surface 1 (outward normal −axis) and surface 2 (outward normal `spin`): `at` is on the
    // corner line. Leg 1 lies on surface 1 running along `spin`; leg 2 lies on surface 2 running along −axis.
    const e1 = unit(spin || across(ax)[0]);
    const ew = unit([e1[1] * back[2] - e1[2] * back[1], e1[2] * back[0] - e1[0] * back[2], e1[0] * back[1] - e1[1] * back[0]]);
    const L = part.leg * MM, W = part.width * MM, T = part.t * MM;
    const plate = (along, thick) => {
      const c = add(at, add(scl(along, L / 2), scl(thick, T / 2)));
      return boxPolys([0, 0, 0], [L, W, T]).map(({ corners, n }) => ({
        corners: corners.map((p) => add(c, add(add(scl(along, p[0]), scl(ew, p[1])), scl(thick, p[2])))),
        n: add(add(scl(along, n[0]), scl(ew, n[1])), scl(thick, n[2])),
      }));
    };
    return [...plate(e1, back), ...plate(back, e1)];
  }
  return polys;
}

/**
 * Where a part's screw holes lie on a bracket: [{ at, axis }] in the caller's frame, given the same `at`, `axis`,
 * `spin` as partPolys. Leg 1's holes drive along `axis`; leg 2's along −spin.
 */
export function bracketHoles(part, { at, axis, spin }) {
  const ax = unit(axis); const e1 = unit(spin || across(ax)[0]); const back = scl(ax, -1);
  const T = part.t * MM;
  return [
    ...part.holes.map((h) => ({ at: add(at, add(scl(e1, h * MM), scl(back, T))), axis: ax, leg: 1 })),
    ...part.holes.map((h) => ({ at: add(at, add(scl(back, h * MM), scl(e1, T))), axis: scl(e1, -1), leg: 2 })),
  ];
}

// ── bores ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The hole a part asks for, as ONE lathe cutter along its axis (the kernel's `lathe` term). The caller subtracts it
 * from every member the part passes through; each loses only what it overlaps.
 *   `through` — mm of the first member the part passes clear through (0 for a dowel's or cam bolt's own hole);
 *   `material` — what the part bites into past `through` (PILOT's keys, or 'steel' for a nut behind);
 *   `extra` — mm the hole runs past the part's tip (a blind hole's clearance, default 2).
 * `at` / `axis` as partPolys. Returns the kernel term in the caller's frame, or null for a part that cuts nothing.
 */
export function boreTerm(part, { at, axis, through = 0, material = 'softwood', extra = 2 }) {
  const ax = unit(axis);
  const segs = [];                                  // [s0, s1, ⌀] mm along the axis
  const eps = 1;
  const pilot = (d) => (material === 'steel' ? part.clear || d : d * (PILOT[material] ?? 0.6));
  switch (part.family) {
    case 'bolt': {
      const s0 = part.head.shape === 'csk' ? part.head.k : 0;
      if (part.head.shape === 'csk') segs.push({ cone: [-eps, part.head.k, part.head.dk + 2 * eps, part.clear] });
      segs.push([s0, part.length + extra, part.clear]);
      break;
    }
    case 'wood-screw': case 'confirmat': {
      const k = part.head.shape === 'csk' ? part.head.k : 0;
      if (part.head.shape === 'csk') segs.push({ cone: [-eps, k, part.head.dk + 2 * eps, part.neck ? part.neck.d : part.d] });
      const clear = part.family === 'confirmat' ? part.neck.d : part.d + 0.5;
      if (through > k) segs.push([k, through, clear]);
      segs.push([Math.max(k, through), part.length + extra, part.family === 'confirmat' ? 5 : pilot(part.d)]);
      break;
    }
    case 'dowel': segs.push([-part.length / 2 - extra, part.length / 2 + extra, part.d]); break;
    case 'cam': segs.push([-eps, part.bore.depth, part.bore.d]); break;
    case 'cam-bolt': segs.push([-eps, part.into + extra, 5]); break;
    case 'shelf-pin': segs.push([-eps, part.into + extra, part.d]); break;
    case 'hinge': segs.push([-eps, part.cup.depth, part.cup.d]); break;
    default: return null;
  }
  // the meridian: radius against axial position, stepped where the hole changes; t ∈ [0, 1] over [sMin, sMax]
  const sMin = Math.min(...segs.map((g) => (Array.isArray(g) ? g[0] : g.cone[0])));
  const sMax = Math.max(...segs.map((g) => (Array.isArray(g) ? g[1] : g.cone[1])));
  const span = sMax - sMin;
  const T = (s) => Math.round(((s - sMin) / span) * 1e6) / 1e6;
  const R = (dd) => Math.round((dd / 2) * MM * 1e6) / 1e6;
  const prof = [];
  for (const g of segs.slice().sort((a, b) => (Array.isArray(a) ? a[0] : a.cone[0]) - (Array.isArray(b) ? b[0] : b.cone[0]))) {
    if (Array.isArray(g)) prof.push({ t: T(g[0]), radius: R(g[2]) }, { t: T(g[1]), radius: R(g[2]) });
    else prof.push({ t: T(g.cone[0]), radius: R(g.cone[2]) }, { t: T(g.cone[1]), radius: R(g.cone[3]) });
  }
  return { kind: 'lathe', axisFrom: add(at, scl(ax, sMin * MM)), axisTo: add(at, scl(ax, sMax * MM)), profile: prof };
}
