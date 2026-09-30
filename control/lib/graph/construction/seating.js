// construction/seating — what a sofa (or any piece with seat cushions) is checked for beyond furniture: how it sits,
// what its soft parts are made of, and whether a sitter can tip it. Advisory arithmetic: it stamps, it never refuses.
//
// A seat is a cushion lying flat that goes in downward (soft.js), its top 300–650 mm up. What it measures (throw pillows
// move, so they are not the back):
//   · seat height: the cushion's top; the height a sitter sits at is that less the cushion's sink under them (soft.js
//     sinkMm) and the deck's give (20 mm on sinuous springs, 5 on a board);
//   · seat depth: the seat's front to the face of what the back leans on, 100 mm above the seat; the back's angle to
//     the seat from that face; the arms' height over where the sitter sits; the seat's width a sitter.
//     Ranges are the furniture trade's usual ones for a living-room sofa, not a standard: seat 400–480 mm high, 480–600
//     deep, the back 100–115° to the seat, arms 180–260 mm over the sitter, 550 mm or more a sitter;
//   · soft parts: seat foam lighter than 35 kg/m³ loses its height within a few years;
//   · springs: a span over 500 mm on lighter wire than 8 gauge sags; springs more than 130 mm apart let the sitter feel
//     them;
//   · legs: a leg taller than 150 mm on one hanger bolt levers it out of its insert when the sofa is dragged;
//   · tipping, three scenarios of ours (named as such, not a standard's): a 75 kg sitter perched on the front edge of
//     an end seat; the same sitter leaning back hard (a 300 N push at the top of the back, their weight on the seat);
//     and sitting on an arm.
import * as dmath from '../../util/dmath.js';

const G = 9.81;
const SITTER = 75;
const PUSH = 300;
export const COMFORT = Object.freeze({
  seatHeightMm: [400, 480], depthMm: [480, 600], backAngleDeg: [100, 115], armAboveSeatMm: [180, 260], widthPerSitterMm: [550, Infinity],
});
const mm = (v) => Math.round(v * 1000);
const r1 = (v) => Math.round(v * 10) / 10;

/** Is this lowered soft part a seat cushion? */
const isSeat = (L) => L.row.kind === 'cushion' && L.row.sinkMm !== undefined && L.frame.hi[2] >= 0.3 && L.frame.hi[2] <= 0.65;

/** The y of a soft part's front face at height z (m), and that face's outward normal. */
function frontAt(L, z, x) {
  const Fr = L.frame; let best = null;
  for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) { const n = Fr.axes[i].map((v) => v * sg); if (!best || n[1] < best.n[1]) best = { n, h: Fr.size[i] / 2 }; }
  const p0 = Fr.c.map((v, k) => v + best.n[k] * best.h);
  const y = p0[1] - (best.n[2] * (z - p0[2]) + best.n[0] * (x - p0[0])) / best.n[1];
  return { y, n: best.n };
}

/**
 * seatingReport({ soft, members, boxes, J, kg, com, hull, dials }) → the report's `seating`, or null when nothing is a
 * seat. `soft` are the lowered parts (soft.js lowerSoft), `boxes` the members' world boxes, `hull` the footprint.
 */
export function seatingReport({ soft, boxes, J, kg, com, hull, seats: declared }) {
  const seatParts = soft.filter(isSeat);
  if (!seatParts.length) return null;
  const top = Math.max(...seatParts.map((L) => L.frame.hi[2]));
  const front = Math.min(...seatParts.map((L) => L.frame.lo[1]));
  const x0 = Math.min(...seatParts.map((L) => L.frame.lo[0])), x1 = Math.max(...seatParts.map((L) => L.frame.hi[0]));
  const cx = (x0 + x1) / 2;
  const springs = J.report.filter((r) => r.type === 'springs');
  const deckGive = springs.length ? 0.02 : 0.005;
  const sink = Math.max(...seatParts.map((L) => L.row.sinkMm)) / 1000;
  const sit = top - sink - deckGive;
  // what the back leans on: soft parts standing behind the seat and over it
  const backs = soft.filter((L) => !seatParts.includes(L) && L.row.kind !== 'pillow' && L.frame.hi[2] > top + 0.15 && L.frame.c[1] > (front + Math.max(...seatParts.map((S) => S.frame.hi[1]))) / 2 && L.frame.lo[0] < x1 && L.frame.hi[0] > x0);
  let depth = null, backAngle = null;
  if (backs.length) {
    const faces = backs.map((L) => ({ L, ...frontAt(L, top + 0.1, Math.min(Math.max(cx, L.frame.lo[0]), L.frame.hi[0])) }));
    const f = faces.reduce((a, b) => (b.y < a.y ? b : a));
    depth = f.y - front;
    backAngle = 90 + (dmath.asin(Math.max(-1, Math.min(1, f.n[2]))) * 180) / Math.PI;
  }
  // arms: soft parts beside the seat standing over it
  const arms = soft.filter((L) => !seatParts.includes(L) && (L.frame.hi[0] <= x0 + 0.005 || L.frame.lo[0] >= x1 - 0.005) && L.frame.hi[2] > top);
  const armTop = arms.length ? Math.max(...arms.map((L) => L.frame.hi[2])) : null;
  const sitters = declared || Math.max(1, Math.round((x1 - x0) / 0.6));
  const measured = {
    seatHeightMm: mm(top), sitHeightMm: mm(sit), ...(depth !== null ? { depthMm: mm(depth), backAngleDeg: r1(backAngle) } : {}),
    ...(armTop !== null ? { armAboveSeatMm: mm(armTop - sit) } : {}), widthPerSitterMm: mm((x1 - x0) / sitters),
  };
  const out = Object.entries(COMFORT).filter(([k, [lo, hi]]) => measured[k] !== undefined && (measured[k] < lo || measured[k] > hi)).map(([k]) => k);
  // soft parts, springs and legs
  const foam = seatParts.filter((L) => /^foam-/.test(L.row.fill) && Number(L.row.fill.match(/\d+/)[0]) < 35).map((L) => ({ id: L.row.id, fill: L.row.fill }));
  const springRows = springs.map((r) => ({ joint: r.joint, spanMm: r.spanMm, gauge: r.gauge, pitchMm: r.pitchMm, ...(r.spanMm > 500 && r.gauge > 8 ? { light: true } : {}), ...(r.pitchMm > 130 ? { wide: true } : {}) })).filter((r) => r.light || r.wide);
  const legs = J.report.filter((r) => r.type === 'hanger-bolt' && r.legMm > 150).map((r) => ({ leg: r.a, legMm: r.legMm }));
  // ── tipping
  const H = hull; const tips = {};
  if (H.length >= 3) {
    const hy0 = Math.min(...H.map((q) => q[1])), hy1 = Math.max(...H.map((q) => q[1])), hx0 = Math.min(...H.map((q) => q[0])), hx1 = Math.max(...H.map((q) => q[0]));
    const end = seatParts.reduce((a, b) => (b.frame.lo[0] < a.frame.lo[0] ? b : a));
    const yP = front + 0.05;
    const over = yP < hy0 ? SITTER * G * (hy0 - yP) : 0, restore = kg * G * (com[1] - hy0);
    tips.perch = { atMm: [mm(end.frame.c[0]), mm(yP)], overturnNm: r1(over), restoreNm: r1(restore), tips: over > restore };
    if (backs.length) {
      const h = Math.max(...backs.map((L) => L.frame.hi[2]));
      const ys = (front + Math.max(...seatParts.map((S) => S.frame.hi[1]))) / 2;
      const o2 = PUSH * h, r2 = kg * G * (hy1 - com[1]) + SITTER * G * (hy1 - ys);
      tips.leanBack = { pushN: PUSH, atMm: mm(h), overturnNm: r1(o2), restoreNm: r1(r2), tips: o2 > r2 };
    }
    if (arms.length) {
      const worst = arms.map((L) => {
        const x = L.frame.c[0]; const left = x < com[0]; const edge = left ? hx0 : hx1;
        const o3 = Math.max(0, SITTER * G * (left ? edge - x : x - edge)), r3 = kg * G * Math.abs(com[0] - edge);
        return { arm: L.row.id, overturnNm: r1(o3), restoreNm: r1(r3), tips: o3 > r3 };
      }).sort((a, b) => (b.overturnNm - b.restoreNm) - (a.overturnNm - a.restoreNm))[0];
      tips.arm = worst;
    }
  }
  return { sitters, ...measured, ranges: COMFORT_ROWS, out, ...(foam.length ? { foam } : {}), ...(springRows.length ? { springs: springRows } : {}), ...(legs.length ? { legs } : {}), tips };
}
const COMFORT_ROWS = Object.fromEntries(Object.entries(COMFORT).map(([k, [lo, hi]]) => [k, hi === Infinity ? [lo] : [lo, hi]]));

const NAMES = { seatHeightMm: 'seat height', depthMm: 'seat depth', backAngleDeg: 'back angle to the seat', armAboveSeatMm: 'arm height over the sitter', widthPerSitterMm: 'width a sitter' };
const UNIT = { backAngleDeg: '°' };

/** The lines a mint stamps for a seating report. */
export function seatingStamps(s, label) {
  const out = [];
  for (const k of s.out) { const [lo, hi] = s.ranges[k]; out.push(`${label}: ${NAMES[k]} ${s[k]}${UNIT[k] || ' mm'} is outside the usual ${hi === undefined ? `${lo}${UNIT[k] || ' mm'} or more` : `${lo}–${hi}${UNIT[k] || ' mm'}`} for a sofa (a rule of thumb from the trade${k === 'depthMm' ? '; a lounge seat runs deeper on purpose' : ''})`); }
  for (const f of s.foam || []) out.push(`${label}: ${f.id} is ${f.fill}: seat foam under 35 kg/m³ loses its height early — high-resilience 35 or 40`);
  for (const r of s.springs || []) {
    if (r.light) out.push(`${label}: ${r.joint}: ${r.spanMm} mm of seat on ${r.gauge} gauge springs sags — 8 gauge past 500 mm`);
    if (r.wide) out.push(`${label}: ${r.joint}: springs ${r.pitchMm} mm apart are felt through the cushion — 130 mm or closer`);
  }
  for (const l of s.legs || []) out.push(`${label}: ${l.leg} is ${l.legMm} mm tall on one hanger bolt: dragging the sofa levers it out — a leg plate, or a leg under 150 mm`);
  const t = s.tips;
  if (t.perch && t.perch.tips) out.push(`${label}: tips forward with a 75 kg sitter perched on the front edge of the end seat (${t.perch.overturnNm} N·m against ${t.perch.restoreNm}; our scenario) — legs nearer the front`);
  if (t.leanBack && t.leanBack.tips) out.push(`${label}: tips back when leaned on hard (a 300 N push at ${t.leanBack.atMm} mm: ${t.leanBack.overturnNm} N·m against ${t.leanBack.restoreNm}; our scenario) — legs further back, or a lower back`);
  if (t.arm && t.arm.tips) out.push(`${label}: tips sideways with a 75 kg sitter on ${t.arm.arm} (${t.arm.overturnNm} N·m against ${t.arm.restoreNm}; our scenario) — legs under the arms`);
  return out;
}
