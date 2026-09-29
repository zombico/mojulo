// construction/bim — the building model of a framed house: every member, masonry wall, lining, box and cable run as an
// element with a stable IFC GlobalId, an IFC class and predefined type, a catalog material, its storey and its
// quantities; the relations between them; and what a builder reads off a model — a cut list, a sheet count, the panel
// schedule, a takeoff by material, and the checks. It extends the house's plan model (floorplan-bim.js: spaces, walls,
// openings) down to the parts, and is what an IFC export would write.
import { ifcGuid } from './elements.js';
import { CATALOG } from './catalog.js';

const MM_PER_FT = 304.8;
const r1 = (v) => Math.round(v * 10) / 10;

/** A frame member's IFC class and predefined type, read from the part it plays (its id's prefix) and its material. */
const MEMBER_CLASS = {
  stud: ['IfcMember', 'STUD'], king: ['IfcMember', 'STUD'], jack: ['IfcMember', 'STUD'], cripple: ['IfcMember', 'STUD'],
  plate: ['IfcMember', 'PLATE'], 'top-plate': ['IfcMember', 'PLATE'], sill: ['IfcMember', 'PLATE'], 'wall-plate': ['IfcMember', 'PLATE'],
  header: ['IfcBeam', 'LINTEL'], joist: ['IfcBeam', 'JOIST'], rim: ['IfcBeam', 'JOIST'], 'roof-joist': ['IfcBeam', 'JOIST'], 'ceiling-joist': ['IfcBeam', 'JOIST'],
  girder: ['IfcBeam', 'BEAM'], beam: ['IfcBeam', 'BEAM'], tie: ['IfcBeam', 'BEAM'], keta: ['IfcBeam', 'BEAM'], koyabari: ['IfcBeam', 'BEAM'], dodai: ['IfcBeam', 'BEAM'],
  ridge: ['IfcBeam', 'BEAM'], valley: ['IfcBeam', 'BEAM'], moya: ['IfcBeam', 'BEAM'], munagi: ['IfcBeam', 'BEAM'],
  rafter: ['IfcMember', 'RAFTER'], hip: ['IfcMember', 'RAFTER'], brace: ['IfcMember', 'BRACE'],
  post: ['IfcColumn', 'COLUMN'], hashira: ['IfcColumn', 'COLUMN'], column: ['IfcColumn', 'COLUMN'], koyazuka: ['IfcColumn', 'COLUMN'],
  nuki: ['IfcMember', 'MEMBER'], kamoi: ['IfcMember', 'MEMBER'], shikii: ['IfcMember', 'MEMBER'],
  sheet: ['IfcPlate', 'SHEET'], stem: ['IfcWall', 'SOLIDWALL'], 'grade-beam': ['IfcFooting', 'STRIP_FOOTING'], footing: ['IfcFooting', 'STRIP_FOOTING'],
  pad: ['IfcFooting', 'PAD_FOOTING'], slab: ['IfcSlab', 'FLOOR'],
};
const memberClass = (id) => MEMBER_CLASS[id.replace(/-\d+$/, '')] || ['IfcBuildingElementProxy', 'NOTDEFINED'];
const memberMaterial = (m, spec) => (m.section ? `steel:${m.section}` : m.material === 'concrete' ? 'concrete:grey' : m.finish && m.finish.paint ? 'board:osb-19' : `timber:${m.species || spec.species || 'douglas-fir'}`);

/**
 * buildConstructionModel({ frames, reports, elements, wiring, levels }) → { elements, relations, schedules, checks,
 * summary }. `frames` are the framing plan's specs (unit ft), `reports` their lowered reports by id, `elements` the
 * linings' and wiring's element records, `wiring` the wiring plan.
 */
export function buildConstructionModel({ frames, reports = {}, elements = [], wiring = null, levels }) {
  const sorted = [...levels].sort((a, b) => a.index - b.index);
  const storeyOf = (frameId) => (frameId === 'foundation' || frameId === 'infill' ? sorted[0].index : frameId === 'roof' ? sorted[sorted.length - 1].index : Number(frameId.replace('storey-', '')));
  const out = [];
  const relations = [];
  for (const spec of frames) {
    const S = storeyOf(spec.id);
    const rep = reports[spec.id];
    const lens = new Map(rep ? rep.members.map((m) => [m.id, m]) : []);
    for (const m of spec.members || []) {
      const [ifc, type] = memberClass(m.id);
      const r = lens.get(m.id);
      const lengthFt = r ? r.lengthMm / MM_PER_FT : Math.hypot(m.to[0] - m.from[0], m.to[1] - m.from[1], m.to[2] - m.from[2]);
      const key = `${spec.id}:${m.id}`;
      const stockMm = r && r.stockMm ? r.stockMm : null;
      out.push({ guid: ifcGuid(key), key, ifc, type, material: memberMaterial(m, spec), storey: S, quantities: { lengthFt: r1(lengthFt), ...(stockMm ? { sectionMm: stockMm } : {}), ...(r && r.massKg ? { massKg: r.massKg } : {}), ...(m.section ? { section: m.section } : {}) } });
    }
    for (const w of spec.walls || []) {
      const key = `${spec.id}:${w.id}`;
      const rw = rep && (rep.walls || []).find((x) => x.id === w.id);
      out.push({ guid: ifcGuid(key), key, ifc: 'IfcWall', type: 'SOLIDWALL', material: w.unit === 'cmu' ? 'block:cmu' : `brick:${w.body || 'red'}`, storey: S, quantities: { lengthFt: r1(Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1])), heightFt: r1(w.height), units: rw ? rw.units : null, openings: (w.openings || []).length } });
    }
    for (const j of spec.joints || []) relations.push({ kind: 'connects', joint: j.type, a: `${spec.id}:${j.a}`, ...(j.b ? { b: `${spec.id}:${j.b}` } : {}) });
  }
  for (const el of elements) {
    const d = [0, 1, 2].map((i) => el.hi[i] - el.lo[i]).sort((a, b) => b - a);
    const q = el.ifc === 'IfcCableSegment' ? { lengthFt: r1(el.lengthFt || d[0]) } : el.ifc === 'IfcCovering' || el.ifc === 'IfcWall' || el.ifc === 'IfcPlate' ? { areaSqFt: r1(d[0] * d[1]), thicknessMm: Math.round(d[2] * MM_PER_FT) } : { sizeMm: d.map((v) => Math.round(v * MM_PER_FT)) };
    out.push({ guid: ifcGuid(el.key), key: el.key, ifc: el.ifc, type: el.type, material: el.material, storey: el.storey, quantities: q, ...(el.circuit ? { circuit: el.circuit } : {}), ...(el.host ? { host: el.host } : {}) });
    if (el.host) relations.push({ kind: 'covers', a: el.key, b: el.host });
  }
  if (wiring) for (const c of wiring.circuits) relations.push({ kind: 'feeds', a: 'panel', b: `circuit:${c.no}`, rooms: c.rooms });
  for (const e of out) relations.push({ kind: 'contained-in', a: e.key, b: `storey:${e.storey}` });

  // ── schedules ──
  const cut = new Map();
  for (const e of out) {
    if (!e.material.startsWith('timber:') || !e.quantities.sectionMm) continue;
    const inches = Math.round(e.quantities.lengthFt * 12 * 8) / 8;          // to the eighth
    const k = `${e.material}|${e.quantities.sectionMm.join('×')}|${inches}`;
    cut.set(k, (cut.get(k) || 0) + 1);
  }
  const cutList = [...cut.entries()].map(([k, n]) => { const [material, section, inches] = k.split('|'); return { material, sectionMm: section, lengthIn: Number(inches), count: n }; })
    .sort((a, b) => (a.material + a.sectionMm).localeCompare(b.material + b.sectionMm) || b.lengthIn - a.lengthIn);
  const sheets = new Map();
  for (const e of out) {
    const m = CATALOG[e.material];
    if (!m || m.kind !== 'board' || !e.quantities.areaSqFt) continue;
    const s = sheets.get(e.material) || { material: e.material, pieces: 0, areaSqFt: 0 };
    s.pieces++; s.areaSqFt += e.quantities.areaSqFt; sheets.set(e.material, s);
  }
  const sheetSchedule = [...sheets.values()].map((s) => {
    const [w, h] = CATALOG[s.material].sheet || [1219, 2438];
    const full = (w * h) / (MM_PER_FT * MM_PER_FT);
    return { ...s, areaSqFt: r1(s.areaSqFt), sheetsToBuy: Math.ceil((s.areaSqFt * 1.1) / full) };   // ten per cent for waste
  });
  const takeoff = new Map();
  for (const e of out) {
    const t = takeoff.get(e.material) || { material: e.material, count: 0, lengthFt: 0, areaSqFt: 0 };
    t.count++; t.lengthFt += e.quantities.lengthFt || 0; t.areaSqFt += e.quantities.areaSqFt || 0;
    takeoff.set(e.material, t);
  }
  const byClass = {};
  for (const e of out) byClass[e.ifc] = (byClass[e.ifc] || 0) + 1;
  const unknown = [...new Set(out.map((e) => e.material))].filter((m) => !CATALOG[m]);
  const checks = [...(wiring ? wiring.checks : []), { rule: 'materials-in-catalog', ok: unknown.length === 0, ...(unknown.length ? { unknown } : {}) }];
  return {
    elements: out, relations,
    schedules: {
      cutList, sheets: sheetSchedule,
      panel: wiring ? wiring.circuits : [],
      takeoff: [...takeoff.values()].map((t) => ({ ...t, lengthFt: r1(t.lengthFt), areaSqFt: r1(t.areaSqFt) })).sort((a, b) => a.material.localeCompare(b.material)),
    },
    checks,
    summary: { elements: out.length, byClass, relations: relations.length, ...(wiring ? { circuits: wiring.circuits.length, holes: wiring.holes } : {}), failed: checks.filter((c) => c.ok === false).length },
  };
}
