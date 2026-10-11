/**
 * structure/trades — the frame, the wiring and the rainwater read as data for the S-, E- and P-sheets.
 *
 * The kernels already plan all three (construction/house-frame.js `planHouseFraming`, wiring.js `planWiring`,
 * drainage.js `planDrainage`) and keep only their faces. These readers ask the same planners again, purely, and
 * return what a framing, electrical or rainwater plan draws: members as plan lines with a role and a size, devices as
 * points, gutters and downpipes as runs, with the reports beside them. Nothing here reaches a world.
 *
 * Members are drawn as a framing plan draws them: a singular member (a footing, a post, a beam, a header, a ridge)
 * carries a type tag keyed on its role and size (B1, H2 …, as `tagTypes` keys windows); a repeated one (joists,
 * rafters) is a field: one span arrow labelled with its size and spacing, as a framer reads it.
 */

import { planHouseFraming, framingOf } from '../construction/house-frame.js';
import { planWiring } from '../construction/wiring.js';
import { planDrainage } from '../construction/drainage.js';
import { tagTypes } from './tags.js';

const r2 = (n) => Math.round(n * 100) / 100;
const p2 = (p) => p.map(r2);

/** What each role is on a framing plan. `tag`: a type letter; `field`: drawn as a span arrow; `wall`: a wall line;
 *  `band`: a poched run (a stem or a grade beam); otherwise a plain line. Unknown roles are lines. */
export const ROLES = {
  footing: { tag: 'F', name: 'footing' }, pad: { tag: 'F', name: 'pad footing' },
  post: { tag: 'P', name: 'post' }, hashira: { tag: 'P', name: 'hashira (post)' }, column: { tag: 'C', name: 'column' },
  girder: { tag: 'B', name: 'girder' }, beam: { tag: 'B', name: 'beam' }, keta: { tag: 'B', name: 'keta (beam)' },
  koyabari: { tag: 'B', name: 'koyabari (roof beam)' }, tie: { tag: 'B', name: 'tie beam' }, nuki: { tag: 'B', name: 'nuki (tie)' },
  header: { tag: 'H', name: 'header' }, kamoi: { tag: 'H', name: 'kamoi (head)' },
  ridge: { tag: 'R', name: 'ridge' }, hip: { tag: 'R', name: 'hip' }, valley: { tag: 'R', name: 'valley' }, moya: { tag: 'R', name: 'moya (purlin)' },
  joist: { field: true, name: 'joists' }, 'ceiling-joist': { field: true, name: 'ceiling joists' }, rafter: { field: true, name: 'rafters', slope: true },
  koyazuka: { field: true, name: 'koyazuka (struts)', point: true },
  plate: { wall: true, name: 'plate' }, 'top-plate': { wall: true, name: 'top plate' }, 'wall-plate': { wall: true, name: 'wall plate' },
  dodai: { wall: true, name: 'dodai (sill)' }, shikii: { wall: true, name: 'shikii (sill)' },
  stem: { band: true, name: 'stem wall' }, 'grade-beam': { band: true, name: 'grade beam' },
  stud: { stud: true, name: 'studs' }, king: { stud: true, name: 'king studs' }, jack: { stud: true, name: 'jack studs' }, cripple: { stud: true, name: 'cripples' },
  sill: { name: 'sill' }, rim: { name: 'rim' }, brace: { name: 'brace' }, sheet: { skip: true, name: 'sheathing' }, slab: { slab: true, name: 'slab' },
};

const roleOf = (id) => id.replace(/-\d+$/, '');

// ── sizes, as a framer names them ──

const NOMINAL = { 1.5: 2, 3.5: 4, 5.5: 6, 7.25: 8, 9.25: 10, 11.25: 12 };
/** Inches to the eighth, as a size writes them: 4 1/2, 12 1/2, 20. */
export function inchText(inch) {
  const e = Math.round(inch * 8);
  const whole = Math.floor(e / 8), rest = e % 8;
  if (!rest) return String(whole);
  const g = rest % 4 === 0 ? 4 : rest % 2 === 0 ? 2 : 1;
  return `${whole ? `${whole} ` : ''}${rest / g}/${8 / g}`;
}
/** A member's size: the stock name it was given ("2x6"), the nominal name its dressed size matches (1 1/2 × 11 1/4 is
 *  2x12), or its actual inches. */
export function sizeText(stock) {
  if (typeof stock === 'string') return stock;
  if (!Array.isArray(stock) || stock.length < 2) return '';
  const [a, b] = stock.map((ft) => Math.round(ft * 12 * 8) / 8);
  if (NOMINAL[a] && NOMINAL[b]) return `${NOMINAL[a]}x${NOMINAL[b]}`;
  return `${inchText(a)} x ${inchText(b)}`;
}
/** A member's plan width in feet: the narrow face of its stock as it lies (a stud wall is its plate's width). */
export function stockWidth(stock) {
  if (Array.isArray(stock)) return stock[0];
  const m = /^(\d+)x(\d+)$/.exec(String(stock || ''));
  if (!m) return 0.125;
  const dressed = { 2: 1.5, 4: 3.5, 6: 5.5, 8: 7.25, 10: 9.25, 12: 11.25 };
  return (dressed[Number(m[1])] ?? Number(m[1])) / 12;
}
const stockDepth = (stock) => (Array.isArray(stock) ? stock[1] : stockWidth(typeof stock === 'string' ? stock.split('x').reverse().join('x') : stock));

/** The storey a frame belongs to: the foundation the lowest, the roof the top, `storey-N` its own. */
function frameStorey(id, levels) {
  if (id === 'foundation') return levels[0].index;
  if (id === 'roof') return levels[levels.length - 1].index;
  const m = /^storey-(-?\d+)$/.exec(id);
  return m ? Number(m[1]) : levels[0].index;
}

/** A member's plan axis: 'x' or 'y' when it runs level along one, 'z' when it stands, 'd' on a diagonal. */
function axisOf(from, to) {
  const dx = Math.abs(to[0] - from[0]), dy = Math.abs(to[1] - from[1]), dz = Math.abs(to[2] - from[2]);
  const h = Math.hypot(dx, dy);
  if (h < 0.05 || dz > 3 * h) return 'z';
  if (dy < 0.02 * h) return 'x';
  if (dx < 0.02 * h) return 'y';
  return 'd';
}

/** Spacing on centre of a run of parallel members (ft): the median gap between their offsets, to the inch. */
function spacingOf(offsets) {
  const s = [...new Set(offsets.map((v) => Math.round(v * 96) / 96))].sort((a, b) => a - b);
  if (s.length < 2) return null;
  const gaps = s.slice(1).map((v, i) => v - s[i]).sort((a, b) => a - b);
  return Math.round(gaps[Math.floor(gaps.length / 2)] * 12) / 12;
}

/** A field of repeated members: one entry per run of a role and size in one direction and bay. */
function fieldsOf(members) {
  const groups = new Map();
  for (const m of members) {
    const R = ROLES[m.role];
    if (!R || !R.field || m.axis === 'z') continue;
    const along = m.axis === 'x' ? 0 : 1;
    const lo = Math.min(m.from[along], m.to[along]), hi = Math.max(m.from[along], m.to[along]);
    // rafters fall to an eave: one field per fall direction; a joist field is one bay (its bearings)
    const fall = R.slope ? Math.sign((m.from[2] > m.to[2] ? m.to : m.from)[along] - (m.from[2] > m.to[2] ? m.from : m.to)[along]) : 0;
    const key = R.slope ? `${m.role}|${m.size}|${m.axis}|${fall}` : `${m.role}|${m.size}|${m.axis}|${Math.round(lo * 2) / 2}|${Math.round(hi * 2) / 2}`;
    if (!groups.has(key)) groups.set(key, { role: m.role, size: m.size, axis: m.axis, fall, members: [] });
    groups.get(key).members.push({ m, lo, hi });
  }
  const out = [];
  for (const g of groups.values()) {
    const across = g.axis === 'x' ? 1 : 0, along = 1 - across;
    const offs = g.members.map(({ m }) => m.from[across]);
    const sorted = [...g.members].sort((a, b) => a.m.from[across] - b.m.from[across]);
    const mid = sorted[Math.floor(sorted.length / 2)];
    out.push({
      role: g.role, size: g.size, axis: g.axis, count: g.members.length,
      spacing: spacingOf(offs),
      from: r2(Math.min(...offs)), to: r2(Math.max(...offs)),
      span: [r2(Math.min(...g.members.map((x) => x.lo))), r2(Math.max(...g.members.map((x) => x.hi)))],
      at: r2(mid.m.from[across]),
      ...(g.fall ? { fall: g.fall } : {}),
    });
  }
  return out.sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : 0) || a.axis.localeCompare(b.axis) || a.span[0] - b.span[0] || a.at - b.at);
}

/**
 * readFraming(house, framing, o, plan?) → { system, tradition, stage, frames: [{ id, storey, members, fields }], types } in feet.
 * `members`: { id, role, from, to, size, width, axis, tag? } (sheathing left out); `types`: the tagged member types
 * [{ tag, role, size, count, frames }]. The same plan the world lowers, so a member here is a member in the GLB.
 */
export function readFraming(house, framing, o, plan = planHouseFraming(house, framing, o)) {
  const f = framingOf(framing);
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const frames = plan.frames.map((fr) => ({
    id: fr.id, storey: frameStorey(fr.id, levels),
    members: fr.members.filter((m) => !ROLES[roleOf(m.id)]?.skip).map((m) => {
      const stock = m.stock ?? m.section ?? null;
      return { id: m.id, role: roleOf(m.id), from: p2(m.from), to: p2(m.to), size: sizeText(stock), width: r2(stockWidth(stock)), depth: r2(stockDepth(stock)), axis: axisOf(m.from, m.to), ...(m.material ? { material: m.material } : {}) };
    }),
  }));
  // one type tag per role letter and size, across the whole frame (B1 is the same beam on every sheet)
  const tagged = frames.flatMap((fr) => fr.members.filter((m) => ROLES[m.role]?.tag).map((m) => ({ id: `${fr.id}/${m.id}`, m })));
  const byLetter = new Map();
  for (const t of tagged) { const L = ROLES[t.m.role].tag; if (!byLetter.has(L)) byLetter.set(L, []); byLetter.get(L).push(t); }
  const types = [];
  for (const L of [...byLetter.keys()].sort()) {
    const list = byLetter.get(L);
    // keyed on role and size in feet to the eighth inch, ordered by the key, so a type keeps its tag across re-reads
    const tt = tagTypes(list.map((t) => ({ id: t.id, key: `${t.m.role}|${String(Math.round(t.m.width * 96)).padStart(5, '0')}|${String(Math.round(t.m.depth * 96)).padStart(5, '0')}` })), (x) => x.key, (i) => `${L}${i + 1}`);
    for (const t of list) t.m.tag = tt.typeOf.get(t.id);
    for (const ty of tt.types) {
      const of = list.filter((t) => t.m.tag === ty.type);
      types.push({ tag: ty.type, role: of[0].m.role, size: of[0].m.size, count: of.length, frames: [...new Set(of.map((t) => t.id.split('/')[0]))] });
    }
  }
  for (const fr of frames) fr.fields = fieldsOf(fr.members);
  // the studs, by size: a wall's stud size and spacing, as the framing key states it
  for (const fr of frames) {
    const studs = fr.members.filter((m) => m.role === 'stud' && m.axis === 'z');
    const bySize = new Map();
    for (const s of studs) { if (!bySize.has(s.size)) bySize.set(s.size, []); bySize.get(s.size).push(s); }
    fr.studs = [...bySize.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([size, list]) => {
      // spacing along each wall line: the median over the lines with three or more studs
      const lines = new Map();
      for (const s of list) {
        const k = `${Math.round(s.from[0] * 4)}|*`, k2 = `*|${Math.round(s.from[1] * 4)}`;
        for (const kk of [k, k2]) { if (!lines.has(kk)) lines.set(kk, []); lines.get(kk).push(kk.startsWith('*') ? s.from[0] : s.from[1]); }
      }
      const sp = [...lines.values()].filter((v) => v.length >= 3).map(spacingOf).filter(Boolean).sort((a, b) => a - b);
      return { size, count: list.length, spacing: sp.length ? sp[Math.floor(sp.length / 2)] : null };
    });
  }
  return { system: f.system, tradition: f.tradition, stage: f.stage, frames, types, notes: plan.notes };
}

const centre = (e) => [r2((e.lo[0] + e.hi[0]) / 2), r2((e.lo[1] + e.hi[1]) / 2), r2((e.lo[2] + e.hi[2]) / 2)];

/**
 * readWiring(house, framing, frames, o, roomTagOf) → { tradition, devices, cables, circuits, panel, checks }, or null.
 * The wiring as the frame is roughed in: a house shown at the bare frame is wired on paper as it would be at
 * rough-in (the trade is drawn before it is built), at a later stage as it stands.
 */
export function readWiring(house, framing, planFrames, o, roomTagOf = (id) => id) {
  const f = framingOf(framing);
  const w = planWiring(house, { system: f.system, tradition: f.tradition, stage: f.stage === 'frame' ? 'rough-in' : f.stage }, planFrames, o);
  if (!w) return null;
  const kind = (e) => (e.ifc === 'IfcOutlet' ? 'receptacle' : e.ifc === 'IfcSwitchingDevice' ? 'switch' : e.ifc === 'IfcJunctionBox' ? 'ceiling' : e.ifc === 'IfcElectricDistributionBoard' ? 'panel' : 'device');
  const devices = w.all.filter((e) => e.ifc !== 'IfcCableSegment').map((e) => ({ key: e.key, kind: kind(e), ifc: e.ifc, storey: e.storey, at: centre(e), material: e.material }));
  const cables = w.all.filter((e) => e.ifc === 'IfcCableSegment').map((e) => ({ key: e.key, storey: e.storey, circuit: e.circuit ?? null, lo: p2(e.lo), hi: p2(e.hi), cable: e.material }));
  const rooms = (ids) => (ids || []).map((id) => roomTagOf(id) ?? id);
  return {
    tradition: f.tradition, devices, cables,
    circuits: w.circuits.map((c) => ({ ...c, rooms: rooms(c.rooms) })),
    panel: w.panel,
    checks: w.checks.map((c) => (c.room ? { ...c, room: roomTagOf(c.room) ?? c.room } : c)),
  };
}

/**
 * readDrainage(house, drainage, o) → { report, gutters, downpipes, heads, outlets, below, chambers } or null when the house has no
 * roof. Reads `house.drainage` when the kernel planned it (a finished roof), else plans it again for the read (a
 * framed house shows no gutters in its world, but its rainwater is still designed).
 */
export function readDrainage(house, drainage, o) {
  // the kernel keeps its plan flattened (`{ ...report, elements }`); a fresh plan is `{ elements, report, faces }`
  const kept = house.drainage ? (({ elements, ...report }) => ({ elements, report }))(house.drainage) : null;
  const d = kept || (house.meru ? planDrainage({ levels: house.levels, footprint: house.footprint, meru: house.meru }, drainage, o) : null);
  if (!d) return null;
  const kindOf = (e) => (/^drain:([a-z]+):/.exec(e.key) || [])[1] || e.type;
  const ends = (e) => (e.sweep && e.sweep.path ? { from: p2(e.sweep.path[0]), to: p2(e.sweep.path[e.sweep.path.length - 1]) } : e.sweep ? { from: p2(e.sweep.from), to: p2(e.sweep.to) } : { from: p2(e.lo), to: p2(e.hi) });
  const els = d.elements || [];
  const of = (k) => els.filter((e) => kindOf(e) === k);
  return {
    report: d.report,
    gutters: of('gutter').map((e) => ({ key: e.key, material: e.material, lengthFt: r2(e.lengthFt ?? 0), ...ends(e) })),
    // a downpipe stands at its foot: the last point of its path
    downpipes: of('pipe').map((e) => ({ key: e.key, material: e.material, at: ends(e).to, lengthFt: r2(e.lengthFt ?? 0), ...(e.objectType ? { objectType: e.objectType } : {}) })),
    heads: of('head').map((e) => ({ key: e.key, at: centre(e) })),
    outlets: els.filter((e) => !['gutter', 'pipe', 'head', 'below', 'chamber'].includes(kindOf(e))).map((e) => ({ key: e.key, ifc: e.ifc, material: e.material, at: centre(e), lo: p2(e.lo), hi: p2(e.hi) })),
    below: of('below').map((e) => ({ key: e.key, lengthFt: r2(e.lengthFt ?? 0), ...ends(e) })),
    chambers: of('chamber').map((e) => ({ key: e.key, at: centre(e) })),
  };
}
