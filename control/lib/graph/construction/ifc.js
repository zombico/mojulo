// construction/ifc — a house as an IFC4 file (ISO 10303-21, the STEP text form), for the BIM tools: Bonsai (Blender),
// Revit, ArchiCAD, IfcOpenShell. Everything in metres, z up.
//
// What goes in:
//   · the spatial tree: project, site, building, one storey per level at its elevation; the rooms as spaces (their
//     glyph's name, their role, their floor area);
//   · an unframed house: its walls (openings voiding them, doors and windows filling them), a floor slab under each
//     storey less its stair voids, the roof as an IfcRoof aggregating one slab per plane;
//   · a framed house (its `construction` model): every member as its section extruded along its centreline (a
//     rectangle for timber and concrete, the rolled profile for steel), every masonry wall with its openings, every
//     lining, sheet, box and cable as its box, the roof deck or covering as its plane; doors and windows as panels;
//     circuits as IfcDistributionCircuit, each grouping its boxes and cable;
//   · drainage (either): gutters as their section swept along the eave, downpipes, chains and drains swept along their
//     paths, outlets and chambers as boxes, all assigned to a rainwater system.
// Every product is associated with its catalog material (colour as a surface style) and carries a `Mojulo_Element`
// property set naming its key, so an element found in a BIM tool leads back to the recipe.
//
// Deterministic: GlobalIds come from each element's key namespaced by the sketch ref (the same house always writes the
// same ids, two houses never share one), and nothing reads a clock — the header's time stamp is fixed.
import { ifcGuid } from './elements.js';
import { CATALOG } from './catalog.js';
import { byCodeUnit } from './bim.js';
import { SECTIONS } from './sections.js';
import { memberFrame } from './members.js';
import { planeFrame } from './roofing.js';
import { ARCHETYPES } from '../polygonizer/floorplan-glyphs.js';
import { structurizeHouse, storeyLevels, FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { roofPlanes, ROOF_STYLES } from '../architecture/roof.js';
import { coveringOf } from './roofing.js';
import * as dmath from '../../util/dmath.js';

const FT = 0.3048;

// ── STEP encoding ────────────────────────────────────────────────────────────────────────────────────────────────────
// An argument is: a number (a REAL); '$' or '*'; a reference ('#n'); { s } a string; { e } an enumeration; { i } an
// integer; { b } a boolean; { t, v } a typed value; an array (a list).
const real = (v) => {
  let r = Math.round(v * 1e6) / 1e6; if (Object.is(r, -0)) r = 0;
  let s = String(r); if (/e/i.test(s)) s = r.toFixed(9).replace(/0+$/, '');
  return s.includes('.') ? s : `${s}.`;
};
const text = (t) => `'${[...String(t)].map((ch) => {
  const c = ch.codePointAt(0);
  if (ch === "'") return "''";
  if (ch === '\\') return '\\\\';
  if (c >= 32 && c < 127) return ch;
  return c <= 0xffff ? `\\X2\\${c.toString(16).toUpperCase().padStart(4, '0')}\\X0\\` : `\\X4\\${c.toString(16).toUpperCase().padStart(8, '0')}\\X0\\`;
}).join('')}'`;
function enc(v) {
  if (v === null || v === undefined) return '$';
  if (typeof v === 'number') return real(v);
  if (typeof v === 'string') return v;                                  // '$', '*' or a reference
  if (Array.isArray(v)) return `(${v.map(enc).join(',')})`;
  if ('s' in v) return text(v.s);
  if ('e' in v) return `.${v.e}.`;
  if ('i' in v) return String(Math.round(v.i));
  if ('b' in v) return v.b ? '.T.' : '.F.';
  if ('t' in v) return `${v.t}(${enc(v.v)})`;
  throw new Error(`ifc: cannot encode ${JSON.stringify(v)}`);
}
const S = (s) => ({ s }), E = (e) => ({ e }), I = (i) => ({ i });

/** An entity list: `add` numbers each entity, sharing one id among identical geometry. */
class Step {
  constructor() { this.lines = []; this.shared = new Map(); }
  add(type, args, unique = false) { return this.put(`${type}(${args.map(enc).join(',')})`, unique); }
  put(body, unique = false) {
    if (!unique && this.shared.has(body)) return this.shared.get(body);
    const id = `#${this.lines.length + 1}`;
    this.lines.push(`${id}=${body};`);
    if (!unique) this.shared.set(body, id);
    return id;
  }
  /** A copy of an entity under its own id (a shared solid that must take a second style). */
  copy(id) { const line = this.lines[Number(id.slice(1)) - 1]; return this.put(line.slice(line.indexOf('=') + 1, -1), true); }
}

// predefined types each class accepts; anything else is USERDEFINED with the name as its ObjectType
const ENUMS = {
  IfcBeam: ['BEAM', 'JOIST', 'HOLLOWCORE', 'LINTEL', 'SPANDREL', 'T_BEAM'],
  IfcColumn: ['COLUMN', 'PILASTER'],
  IfcMember: ['BRACE', 'CHORD', 'COLLAR', 'MEMBER', 'MULLION', 'PLATE', 'POST', 'PURLIN', 'RAFTER', 'STRINGER', 'STRUT', 'STUD'],
  IfcPlate: ['CURTAIN_PANEL', 'SHEET'],
  IfcWall: ['MOVABLE', 'PARAPET', 'PARTITIONING', 'PLUMBINGWALL', 'SHEAR', 'SOLIDWALL', 'STANDARD', 'POLYGONAL', 'ELEMENTEDWALL'],
  IfcFooting: ['CAISSON_FOUNDATION', 'FOOTING_BEAM', 'PAD_FOOTING', 'PILE_CAP', 'STRIP_FOOTING'],
  IfcSlab: ['FLOOR', 'ROOF', 'LANDING', 'BASESLAB'],
  IfcCovering: ['CEILING', 'FLOORING', 'CLADDING', 'ROOFING', 'MOLDING', 'SKIRTINGBOARD', 'INSULATION', 'MEMBRANE', 'SLEEVING', 'WRAPPING'],
  IfcCableSegment: ['CABLESEGMENT', 'CONDUCTORSEGMENT', 'CORESEGMENT', 'BUSBARSEGMENT'],
  IfcOutlet: ['AUDIOVISUALOUTLET', 'COMMUNICATIONSOUTLET', 'POWEROUTLET', 'DATAOUTLET', 'TELEPHONEOUTLET'],
  IfcSwitchingDevice: ['CONTACTOR', 'DIMMERSWITCH', 'EMERGENCYSTOP', 'KEYPAD', 'MOMENTARYSWITCH', 'SELECTORSWITCH', 'STARTER', 'SWITCHDISCONNECTOR', 'TOGGLESWITCH'],
  IfcJunctionBox: ['DATA', 'POWER'],
  IfcLightFixture: ['POINTSOURCE', 'DIRECTIONSOURCE', 'SECURITYLIGHTING'],
  IfcElectricDistributionBoard: ['CONSUMERUNIT', 'DISTRIBUTIONBOARD', 'MOTORCONTROLCENTRE', 'SWITCHBOARD'],
  IfcPipeSegment: ['CULVERT', 'FLEXIBLESEGMENT', 'RIGIDSEGMENT', 'GUTTER', 'SPOOL'],
  IfcPipeFitting: ['BEND', 'CONNECTOR', 'ENTRY', 'EXIT', 'JUNCTION', 'OBSTRUCTION', 'TRANSITION'],
  IfcWasteTerminal: ['FLOORTRAP', 'FLOORWASTE', 'GULLYSUMP', 'GULLYTRAP', 'ROOFDRAIN', 'WASTEDISPOSALUNIT', 'WASTETRAP'],
  IfcDistributionChamberElement: ['FORMEDDUCT', 'INSPECTIONCHAMBER', 'INSPECTIONPIT', 'MANHOLE', 'METERCHAMBER', 'SUMP', 'TRENCH', 'VALVECHAMBER'],
  IfcBuildingElementProxy: ['COMPLEX', 'ELEMENT', 'PARTIAL', 'PROVISIONFORVOID', 'PROVISIONFORSPACE'],
  IfcDoor: ['DOOR', 'GATE', 'TRAPDOOR'],
  IfcWindow: ['WINDOW', 'SKYLIGHT', 'LIGHTDOME'],
  IfcRoof: ['FLAT_ROOF', 'SHED_ROOF', 'GABLE_ROOF', 'HIP_ROOF', 'HIPPED_GABLE_ROOF', 'GAMBREL_ROOF', 'MANSARD_ROOF', 'BARREL_ROOF', 'RAINBOW_ROOF', 'BUTTERFLY_ROOF', 'PAVILION_ROOF', 'DOME_ROOF', 'FREEFORM'],
  IfcOpeningElement: ['OPENING', 'RECESS'],
};
const ROOF_TYPE = { gable: 'GABLE_ROOF', hip: 'HIP_ROOF', pyramid: 'PAVILION_ROOF', gambrel: 'GAMBREL_ROOF', mansard: 'MANSARD_ROOF', saltbox: 'GABLE_ROOF', shed: 'SHED_ROOF', butterfly: 'BUTTERFLY_ROOF', 'flat-deck': 'FLAT_ROOF', 'stacked-room': 'FLAT_ROOF' };

// the unframed house's own surfaces (not catalog materials: the plan names no construction)
const PLAN_RGB = { 'wall:exterior': [214, 206, 192], 'wall:interior': [232, 228, 220], 'wall:floor': [150, 136, 110], glazing: [176, 206, 225], door: [122, 92, 62] };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = dmath.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const m3 = (p) => p.map((v) => v * FT);

/** An open polyline [[y, z]…] thickened by `t` to one side → a closed ring (a thin-walled section). */
function thicken(pts, t) {
  const segN = []; for (let i = 0; i + 1 < pts.length; i++) { const dy = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], l = dmath.hypot(dy, dz) || 1; segN.push([-dz / l, dy / l]); }
  const inner = pts.map((p, i) => {
    const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)];
    let n = [a[0] + b[0], a[1] + b[1]]; const l = dmath.hypot(n[0], n[1]) || 1; n = [n[0] / l, n[1] / l];
    const k = Math.max(0.3, n[0] * b[0] + n[1] * b[1]);
    return [p[0] + (n[0] * t) / k, p[1] + (n[1] * t) / k];
  });
  return [...pts, ...inner.reverse()];
}

/**
 * houseToIfc(house, { name, ns, wallThickness, exteriorThickness, floorDrop, roofPlanes, roofForm, roofMaterial }) →
 * the IFC4 file as a string. `house` is structurizeHouse()'s result (levels with their wall graphs and cells; its
 * `construction` when framed past `frame`; its `drainage`); `roofPlanes` the finished roof's planes (roofPlanes in
 * architecture/roof.js) for an unframed house.
 */
export function houseToIfc(house, o = {}) {
  const st = new Step();
  const ns = o.ns || 'mojulo';
  const G = (key) => S(ifcGuid(`${ns}|${key}`));
  const name = o.name || 'mojulo house';
  const tInt = o.wallThickness ?? 0.42, tExt = o.exteriorThickness ?? 0.67, drop = o.floorDrop ?? 1.1;

  // ── context, units, the spatial tree ──
  const pt = (p) => st.add('IFCCARTESIANPOINT', [p.map((v) => v)]);
  const dir = (v) => st.add('IFCDIRECTION', [unit3(v).map((x) => Math.round(x * 1e9) / 1e9)]);
  const place = (loc, axis = null, ref = null) => st.add('IFCAXIS2PLACEMENT3D', [pt(loc), axis ? dir(axis) : '$', ref ? dir(ref) : '$']);
  const origin = place([0, 0, 0]);
  const ctx = st.add('IFCGEOMETRICREPRESENTATIONCONTEXT', ['$', S('Model'), I(3), 1e-5, origin, '$'], true);
  const body = st.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', [S('Body'), S('Model'), '*', '*', '*', '*', ctx, '$', E('MODEL_VIEW'), '$'], true);
  const units = st.add('IFCUNITASSIGNMENT', [[['LENGTHUNIT', 'METRE'], ['AREAUNIT', 'SQUARE_METRE'], ['VOLUMEUNIT', 'CUBIC_METRE'], ['PLANEANGLEUNIT', 'RADIAN']].map(([t, n]) => st.add('IFCSIUNIT', ['*', E(t), '$', E(n)]))]);
  const project = st.add('IFCPROJECT', [G('project'), '$', S(name), '$', '$', '$', '$', [ctx], units], true);
  const sitePl = st.add('IFCLOCALPLACEMENT', ['$', origin], true);
  const site = st.add('IFCSITE', [G('site'), '$', S('Site'), '$', '$', sitePl, '$', '$', E('ELEMENT'), '$', '$', '$', '$', '$'], true);
  const bldgPl = st.add('IFCLOCALPLACEMENT', [sitePl, origin], true);
  const building = st.add('IFCBUILDING', [G('building'), '$', S(name), '$', '$', bldgPl, '$', '$', E('ELEMENT'), '$', '$', '$'], true);
  st.add('IFCRELAGGREGATES', [G('rel:project'), '$', '$', '$', project, [site]], true);
  st.add('IFCRELAGGREGATES', [G('rel:site'), '$', '$', '$', site, [building]], true);
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const storeys = new Map();
  const ROLE = { basement: 'Basement', ground: 'Ground floor' };
  for (const l of levels) {
    const elev = l.baseZ * FT;
    const pl = st.add('IFCLOCALPLACEMENT', [bldgPl, place([0, 0, elev])], true);
    const nm = ROLE[l.role] || (l.index > 0 ? `Level ${l.index + 1}` : `Level ${l.index}`);
    const id = st.add('IFCBUILDINGSTOREY', [G(`storey:${l.index}`), '$', S(nm), '$', '$', pl, '$', '$', E('ELEMENT'), elev], true);
    storeys.set(l.index, { id, pl, elev, lvl: l, contained: [], spaces: [] });
  }
  st.add('IFCRELAGGREGATES', [G('rel:building'), '$', '$', '$', building, [...storeys.values()].map((s) => s.id)], true);
  const storeyOf = (i) => storeys.get(i) || storeys.get(levels[0].index);

  // ── geometry ──
  const shape = (items, kind = 'SweptSolid') => st.add('IFCPRODUCTDEFINITIONSHAPE', ['$', '$', [st.add('IFCSHAPEREPRESENTATION', [body, S('Body'), S(kind), items])]]);
  const extrude = (profile, depth) => st.add('IFCEXTRUDEDAREASOLID', [profile, origin, dir([0, 0, 1]), Math.max(1e-3, depth)]);
  const rect = (x, y, cx = 0, cy = 0) => st.add('IFCRECTANGLEPROFILEDEF', [E('AREA'), '$', st.add('IFCAXIS2PLACEMENT2D', [st.add('IFCCARTESIANPOINT', [[cx, cy]]), '$']), Math.max(1e-3, x), Math.max(1e-3, y)]);
  const poly2 = (pts) => st.add('IFCPOLYLINE', [[...pts, pts[0]].map((p) => st.add('IFCCARTESIANPOINT', [[p[0], p[1]]]))]);
  const polyProfile = (pts, holes = []) => (holes.length
    ? st.add('IFCARBITRARYPROFILEDEFWITHVOIDS', [E('AREA'), '$', poly2(pts), holes.map(poly2)])
    : st.add('IFCARBITRARYCLOSEDPROFILEDEF', [E('AREA'), '$', poly2(pts)]));
  const boxGeom = (lo, hi, elev) => {
    const a = m3(lo), b = m3(hi);
    const d = [0, 1, 2].map((i) => Math.max(1e-3, b[i] - a[i]));
    return { placeAt: [a[0], a[1], a[2] - elev], solid: extrude(rect(d[0], d[1], d[0] / 2, d[1] / 2), d[2]) };
  };

  // ── materials, colours, property sets ──
  const materials = new Map();                                           // name → { id, style, members: [] }
  const materialOf = (mname) => {
    if (!materials.has(mname)) {
      const c = CATALOG[mname];
      const rgb = (c && c.rgb) || PLAN_RGB[mname] || [180, 180, 180];
      const id = st.add('IFCMATERIAL', [S(mname), c && c.label ? S(c.label) : '$', S(c ? c.kind : mname.split(':')[0])], true);
      const style = st.add('IFCSURFACESTYLE', [S(mname), E('BOTH'), [st.add('IFCSURFACESTYLERENDERING', [st.add('IFCCOLOURRGB', ['$', rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]), c && c.kind === 'paper' ? 0.35 : 0, '$', '$', '$', '$', '$', '$', E('NOTDEFINED')])]]);
      materials.set(mname, { id, style, members: [] });
    }
    return materials.get(mname);
  };
  const counts = {};
  const byKey = new Map();                                               // element key → its entity id
  const styledAs = new Map();                                            // solid → the style it wears
  /**
   * One product: `cls` its class, `key` its stable key, `storey` its storey index, `at` its placement ([x,y,z] metres
   * relative to the storey, optional axis and ref direction), `items` its solids; `tail` the class's attributes after
   * Tag (default: its predefined type).
   */
  const product = (cls, { key, nm, type = 'NOTDEFINED', objectType = null, storey, at, axis = null, ref = null, items = [], kind = 'SweptSolid', material = null, props = null, tail = null, contain = true }) => {
    const s = storeyOf(storey);
    const ok = type === 'NOTDEFINED' || (ENUMS[cls] || []).includes(type);
    const ot = objectType || (ok ? null : type);
    const pl = st.add('IFCLOCALPLACEMENT', [s.pl, place(at, axis, ref)]);
    if (material) {
      // an item takes one style: a solid shared with an element of another material is copied
      const style = materialOf(material).style;
      items = items.map((it) => { const had = styledAs.get(it); if (had && had !== style) return st.copy(it); return it; });
      for (const it of items) { styledAs.set(it, style); st.add('IFCSTYLEDITEM', [it, [style], '$']); }
    }
    const rep = items.length ? shape(items, kind) : '$';
    const args = [G(key), '$', S(nm || key), '$', ot ? S(ot) : '$', pl, rep, S(key), ...(tail || [E(ok ? type : 'USERDEFINED')])];
    const id = st.add(cls.toUpperCase(), args, true);
    byKey.set(key, id);
    if (contain) s.contained.push(id);
    if (material) materialOf(material).members.push(id);
    if (props) {
      const ps = Object.entries(props).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => st.add('IFCPROPERTYSINGLEVALUE', [S(k), '$', typeof v === 'number' ? { t: 'IFCREAL', v } : { t: 'IFCLABEL', v: S(String(v)) }, '$']));
      if (ps.length) st.add('IFCRELDEFINESBYPROPERTIES', [G(`pset:${key}`), '$', '$', '$', [id], st.add('IFCPROPERTYSET', [G(`psetdef:${key}`), '$', S('Mojulo_Element'), '$', ps], true)], true);
    }
    counts[cls] = (counts[cls] || 0) + 1;
    return id;
  };

  // ── spaces ──
  for (const l of levels) {
    const s = storeyOf(l.index);
    for (const c of (l.structure && l.structure.cells) || []) {
      const key = `space:L${l.index}:${Math.round(c.x * 100) / 100},${Math.round(c.y * 100) / 100}`;
      const g = boxGeom([c.x, c.y, l.baseZ], [c.x + c.w, c.y + c.h, l.baseZ + l.height], s.elev);
      const role = c.role || null;
      const nm = (ARCHETYPES[c.glyph] && ARCHETYPES[c.glyph].name) || role || 'space';
      const pl = st.add('IFCLOCALPLACEMENT', [s.pl, place(g.placeAt)]);
      const id = st.add('IFCSPACE', [G(key), '$', S(nm), '$', '$', pl, shape([g.solid]), role ? S(role) : '$', E('ELEMENT'), E('INTERNAL'), '$'], true);
      s.spaces.push(id);
      const area = st.add('IFCQUANTITYAREA', [S('NetFloorArea'), '$', '$', Math.round(c.w * c.h * FT * FT * 100) / 100, '$']);
      st.add('IFCRELDEFINESBYPROPERTIES', [G(`qto:${key}`), '$', '$', '$', [id], st.add('IFCELEMENTQUANTITY', [G(`qtodef:${key}`), '$', S('Qto_SpaceBaseQuantities'), '$', '$', [area]], true)], true);
      counts.IfcSpace = (counts.IfcSpace || 0) + 1;
    }
  }

  const model = house.construction || null;
  const openingsOf = (l) => ((l.structure && l.structure.wallGraph && l.structure.wallGraph.runs) || []).flatMap((run) => (run.openings || []).map((op) => ({ run, op })));

  // doors and windows: panels in their openings (an unframed house also cuts the openings in its walls)
  const fillings = (l, run, op, t, hostWall = null) => {
    const s = storeyOf(l.index);
    const top = Math.min(op.top ?? l.height, l.height), sill = op.sill || 0;
    const window = sill > 1e-6;
    const key = `${window ? 'window' : 'door'}:L${l.index}:${run.orientation}${Math.round(run.at * 100) / 100}:${Math.round(op.a * 100) / 100}`;
    const along = run.orientation === 'h';
    const lo = along ? [op.a, run.at - t / 2, l.baseZ + sill] : [run.at - t / 2, op.a, l.baseZ + sill];
    const hi = along ? [op.b, run.at + t / 2, l.baseZ + top] : [run.at + t / 2, op.b, l.baseZ + top];
    let opening = null;
    if (hostWall) {
      const g = boxGeom(along ? [lo[0], lo[1] - 0.1, lo[2]] : [lo[0] - 0.1, lo[1], lo[2]], along ? [hi[0], hi[1] + 0.1, hi[2]] : [hi[0] + 0.1, hi[1], hi[2]], s.elev);
      opening = product('IfcOpeningElement', { key: `opening:${key}`, nm: 'opening', type: 'OPENING', storey: l.index, at: g.placeAt, items: [g.solid], contain: false });
      st.add('IFCRELVOIDSELEMENT', [G(`void:${key}`), '$', '$', '$', hostWall, opening], true);
    }
    const panelT = window ? 0.12 : 0.15;
    const plo = along ? [lo[0], run.at - panelT / 2, lo[2]] : [run.at - panelT / 2, lo[1], lo[2]], phi = along ? [hi[0], run.at + panelT / 2, hi[2]] : [run.at + panelT / 2, hi[1], hi[2]];
    const g = boxGeom(plo, phi, s.elev);
    const W = (op.b - op.a) * FT, H = (top - sill) * FT;
    const id = product(window ? 'IfcWindow' : 'IfcDoor', { key, nm: window ? 'window' : op.entry ? 'entry door' : 'door', storey: l.index, at: g.placeAt, items: [g.solid], material: window ? 'glazing' : 'door', tail: [H, W, E(window ? 'WINDOW' : 'DOOR'), E('NOTDEFINED'), '$'] });
    if (opening) st.add('IFCRELFILLSELEMENT', [G(`fill:${key}`), '$', '$', '$', opening, id], true);
  };

  if (!model) {
    // ── an unframed house: walls, openings, slabs ──
    for (const l of levels) {
      const s = storeyOf(l.index);
      for (const run of (l.structure && l.structure.wallGraph && l.structure.wallGraph.runs) || []) {
        const t = run.interior ? tInt : tExt;
        const [s0, s1] = run.along;
        const key = `wall:L${l.index}:${run.orientation}:${Math.round(run.at * 100) / 100}:${Math.round(s0 * 100) / 100}-${Math.round(s1 * 100) / 100}`;
        const ext = run.interior ? 0 : t / 2;
        const lo = run.orientation === 'h' ? [s0 - ext, run.at - t / 2, l.baseZ] : [run.at - t / 2, s0 - ext, l.baseZ];
        const hi = run.orientation === 'h' ? [s1 + ext, run.at + t / 2, l.baseZ + l.height] : [run.at + t / 2, s1 + ext, l.baseZ + l.height];
        const g = boxGeom(lo, hi, s.elev);
        const id = product('IfcWall', { key, nm: run.interior ? 'partition' : 'exterior wall', type: run.interior ? 'PARTITIONING' : 'SOLIDWALL', storey: l.index, at: g.placeAt, items: [g.solid], material: run.interior ? 'wall:interior' : 'wall:exterior', props: { IsExternal: run.interior ? 'false' : 'true' } });
        for (const op of run.openings || []) fillings(l, run, op, t, id);
      }
      // the floor under the storey, less its stair voids
      const fp = house.footprint;
      const holes = ((l.structure && l.structure.slabHoles) || []).map((h) => [[h.x0, h.y0], [h.x1, h.y0], [h.x1, h.y1], [h.x0, h.y1]].map((p) => m3([p[0], p[1], 0]).slice(0, 2)));
      const outer = [[fp.x0, fp.y0], [fp.x1, fp.y0], [fp.x1, fp.y1], [fp.x0, fp.y1]].map((p) => m3([p[0], p[1], 0]).slice(0, 2));
      product('IfcSlab', { key: `slab:L${l.index}`, nm: 'floor slab', type: 'FLOOR', storey: l.index, at: [0, 0, -drop * FT], items: [extrude(polyProfile(outer, holes), drop * FT)], material: 'wall:floor' });
    }
    // ── the finished roof: one slab per plane, aggregated under the roof ──
    if (o.roofPlanes && o.roofPlanes.length) {
      const top = levels[levels.length - 1];
      const parts = [];
      o.roofPlanes.forEach((pl, i) => {
        const F = planeFrame(pl.corners);
        const e = F ? F.e : [1, 0, 0];
        const n = F ? F.n : [0, 0, 1];
        const y = cross(n, e);
        const O = pl.corners[0];
        const pts = pl.corners.map((c) => { const r = sub(c, O); return [dot(r, e) * FT, dot(r, y) * FT]; });
        const s = storeyOf(top.index);
        parts.push(product('IfcSlab', { key: `roof:${pl.key || i}`, nm: 'roof plane', type: 'ROOF', storey: top.index, at: [O[0] * FT, O[1] * FT, O[2] * FT - s.elev], axis: n, ref: e, items: [extrude(polyProfile(pts), 0.15)], material: o.roofMaterial || 'roofing:membrane', contain: false }));
      });
      // the walls the roof closes over the top storey: each polygon stood in its plane, a wall thick
      (o.roofPlanes.gables || []).forEach((poly, i) => {
        const ps = poly.filter((p, k) => k === 0 || dmath.hypot(p[0] - poly[k - 1][0], p[1] - poly[k - 1][1], p[2] - poly[k - 1][2]) > 1e-6);
        const e = unit3(sub(ps[1], ps[0])), n0 = unit3(cross(e, [0, 0, 1])), y = cross(n0, e);
        const O = ps[0], sdt = storeyOf(top.index);
        const pts = ps.map((c) => { const r = sub(c, O); return [dot(r, e) * FT, dot(r, y) * FT]; });
        const t = tExt * FT;
        product('IfcWall', { key: `gable:${i}`, nm: 'gable', type: 'SOLIDWALL', storey: top.index, at: [O[0] * FT - n0[0] * t / 2, O[1] * FT - n0[1] * t / 2, O[2] * FT - sdt.elev], axis: n0, ref: e, items: [extrude(polyProfile(pts), t)], material: 'wall:exterior', props: { IsExternal: 'true' } });
      });
      const roof = product('IfcRoof', { key: 'roof', nm: 'roof', type: ROOF_TYPE[o.roofForm] || 'NOTDEFINED', storey: top.index, at: [0, 0, 0] });
      st.add('IFCRELAGGREGATES', [G('rel:roof'), '$', '$', '$', roof, parts], true);
    }
  } else {
    // ── a framed house: its building model ──
    for (const el of model.elements) {
      const s = storeyOf(el.storey);
      const g = el.geom || {};
      const props = { Key: el.key, CatalogMaterial: el.material, ...(el.circuit ? { Circuit: el.circuit } : {}), ...(el.quantities && el.quantities.lengthFt ? { LengthM: Math.round(el.quantities.lengthFt * FT * 1000) / 1000 } : {}) };
      const common = { key: el.key, nm: el.key.split(':').slice(-2).join(':'), type: el.type, objectType: el.objectType || null, storey: el.storey, material: el.material, props };
      if (g.kind === 'member') {
        const a = m3(g.from), b = m3(g.to);
        const F = memberFrame(a, b, g.up);
        let profile;
        const sec = g.section && SECTIONS[g.section];
        const mm = (v) => v / 1000;
        if (sec && sec.shape === 'I') profile = st.add('IFCISHAPEPROFILEDEF', [E('AREA'), S(g.section), '$', mm(sec.b), mm(sec.h), mm(sec.tw), mm(sec.tf), '$', '$', '$']);
        else if (sec && sec.shape === 'C') profile = st.add('IFCUSHAPEPROFILEDEF', [E('AREA'), S(g.section), '$', mm(sec.h), mm(sec.b), mm(sec.tw), mm(sec.tf), '$', '$', '$']);
        else if (sec && sec.shape === 'L') profile = st.add('IFCLSHAPEPROFILEDEF', [E('AREA'), S(g.section), '$', mm(sec.h), mm(sec.b), mm(sec.t), '$', '$', '$']);
        else if (sec && sec.shape === 'SHS') profile = st.add('IFCRECTANGLEHOLLOWPROFILEDEF', [E('AREA'), S(g.section), '$', mm(sec.b), mm(sec.h), mm(sec.t), '$', '$']);
        else if (sec && sec.shape === 'CHS') profile = st.add('IFCCIRCLEHOLLOWPROFILEDEF', [E('AREA'), S(g.section), '$', mm(sec.h) / 2, mm(sec.t)]);
        else if (sec) profile = rect(mm(sec.b), mm(sec.h));
        else { const [w, d] = g.sectionMm || [100, 100]; profile = rect(w / 1000, d / 1000); }
        product(el.ifc, { ...common, at: [a[0], a[1], a[2] - s.elev], axis: F.ex, ref: F.ey, items: [extrude(profile, F.L)] });
      } else if (g.kind === 'wall') {
        const a = m3(g.from), b = m3(g.to);
        const along = unit3(sub(b, a)), L = dmath.hypot(b[0] - a[0], b[1] - a[1]);
        const T = g.thicknessMm / 1000, H = g.height * FT;
        // the wall's local frame: x along it, y across, z up — a box from its start, openings voiding it
        const id = product('IfcWall', { ...common, at: [a[0], a[1], a[2] - s.elev], axis: [0, 0, 1], ref: along, items: [extrude(rect(L, T, L / 2, 0), H)] });
        (g.openings || []).forEach((op, k) => {
          const oat = [a[0] + along[0] * op.at * FT, a[1] + along[1] * op.at * FT, a[2] + op.sill * FT - s.elev];
          const oid = product('IfcOpeningElement', { key: `${el.key}:opening:${k}`, nm: 'opening', type: 'OPENING', storey: el.storey, at: oat, axis: [0, 0, 1], ref: along, items: [extrude(rect(op.width * FT, T + 0.2, (op.width * FT) / 2, 0), op.height * FT)], contain: false });
          st.add('IFCRELVOIDSELEMENT', [G(`void:${el.key}:${k}`), '$', '$', '$', id, oid], true);
        });
      } else if (g.kind === 'plane') {
        const F = planeFrame(g.corners);
        const e = F ? F.e : [1, 0, 0], n = F ? F.n : [0, 0, 1], y = cross(n, e), O = g.corners[0];
        const pts = g.corners.map((c) => { const r = sub(c, O); return [dot(r, e) * FT, dot(r, y) * FT]; });
        product(el.ifc, { ...common, at: [O[0] * FT, O[1] * FT, O[2] * FT - s.elev], axis: n, ref: e, items: [extrude(polyProfile(pts), (g.thicknessMm || 10) / 1000)] });
      } else if (el.ifc === 'IfcDoor' || el.ifc === 'IfcWindow') {
        const gb = boxGeom(g.lo, g.hi, s.elev);
        const d = [0, 1, 2].map((i) => (g.hi[i] - g.lo[i]) * FT);
        product(el.ifc, { ...common, at: gb.placeAt, items: [gb.solid], tail: [d[2], Math.max(d[0], d[1]), E(el.ifc === 'IfcDoor' ? 'DOOR' : 'WINDOW'), E(el.ifc === 'IfcDoor' ? (el.type === 'SLIDING' ? 'SLIDING_TO_LEFT' : 'NOTDEFINED') : 'NOTDEFINED'), '$'] });
      } else if (g.lo && g.hi) {
        const gb = boxGeom(g.lo, g.hi, s.elev);
        product(el.ifc, { ...common, at: gb.placeAt, items: [gb.solid] });
      }
    }
    // doors and windows of the plan, as panels in the frame's openings (no voids: the frame is not one solid) —
    // unless the linings already fitted them (fusuma and shoji)
    if (!model.elements.some((e) => e.ifc === 'IfcDoor' || e.ifc === 'IfcWindow')) for (const l of levels) for (const { run, op } of openingsOf(l)) fillings(l, run, op, run.interior ? tInt : tExt);
    // circuits: each groups its boxes and cable, on the panel's building
    const byCircuit = new Map();
    for (const el of model.elements) if (el.circuit) { if (!byCircuit.has(el.circuit)) byCircuit.set(el.circuit, []); byCircuit.get(el.circuit).push(el.key); }
    for (const c of (model.schedules && model.schedules.panel) || []) {
      const objs = (byCircuit.get(c.no) || []).map((k) => byKey.get(k)).filter(Boolean);
      const circ = st.add('IFCDISTRIBUTIONCIRCUIT', [G(`circuit:${c.no}`), '$', S(`Circuit ${c.no}`), '$', '$', S([c.use, ...(c.rooms || [])].filter(Boolean).join(' · ') || `circuit ${c.no}`), E('ELECTRICAL')], true);
      if (objs.length) st.add('IFCRELASSIGNSTOGROUP', [G(`assign:circuit:${c.no}`), '$', '$', '$', objs, '$', circ], true);
      st.add('IFCRELSERVICESBUILDINGS', [G(`serves:circuit:${c.no}`), '$', '$', '$', circ, [building]], true);
      counts.IfcDistributionCircuit = (counts.IfcDistributionCircuit || 0) + 1;
    }
  }

  // ── drainage: gutters, downpipes and chains, outlets, drains, on one rainwater system ──
  // (a house shown framed or at a construction stage has no gutters yet, so no system)
  const rainwater = !!(house.drainage && house.drainage.elements && house.drainage.elements.length);
  if (rainwater) {
    const members = [];
    for (const el of house.drainage.elements) {
      const s = storeyOf(el.storey);
      const props = { Key: el.key, CatalogMaterial: el.material, ...(el.lengthFt ? { LengthM: Math.round(el.lengthFt * FT * 1000) / 1000 } : {}) };
      const common = { key: el.key, nm: el.key.replace(/^drain:/, ''), type: el.type, objectType: el.objectType || null, storey: el.storey, material: el.material, props };
      let id;
      if (el.sweep && el.sweep.path) {
        const r = Math.max(...el.sweep.section.map(([a, b]) => dmath.hypot(a, b))) * FT;
        const path = st.add('IFCPOLYLINE', [el.sweep.path.map((p) => pt([p[0] * FT, p[1] * FT, p[2] * FT - s.elev]))]);
        id = product(el.ifc, { ...common, at: [0, 0, 0], items: [st.add('IFCSWEPTDISKSOLID', [path, r, '$', '$', '$'])], kind: 'AdvancedSweptSolid' });
      } else if (el.sweep) {
        const a = m3(el.sweep.from), b = m3(el.sweep.to);
        const Z = unit3(sub(b, a)), X = unit3(cross([0, 0, 1], Z));
        const across = Math.abs(Z[0]) > 0.5 ? [0, 1, 0] : [1, 0, 0];
        const sign = dot(X, across) >= 0 ? 1 : -1;
        const ring = thicken(el.sweep.section.map(([y, z]) => [sign * y * FT, z * FT]), 0.0015);
        id = product(el.ifc, { ...common, at: [a[0], a[1], a[2] - s.elev], axis: Z, ref: X, items: [extrude(polyProfile(ring), dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))] });
      } else {
        const gb = boxGeom(el.lo, el.hi, s.elev);
        id = product(el.ifc, { ...common, at: gb.placeAt, items: [gb.solid] });
      }
      members.push(id);
    }
    const sys = st.add('IFCDISTRIBUTIONSYSTEM', [G('system:rainwater'), '$', S('Rainwater'), '$', '$', S(`rainwater (${house.drainage.tradition})`), E('RAINWATER')], true);
    st.add('IFCRELASSIGNSTOGROUP', [G('assign:rainwater'), '$', '$', '$', members, '$', sys], true);
    st.add('IFCRELSERVICESBUILDINGS', [G('serves:rainwater'), '$', '$', '$', sys, [building]], true);
  }

  // ── containment and materials ──
  for (const [i, s] of storeys) {
    if (s.spaces.length) st.add('IFCRELAGGREGATES', [G(`rel:spaces:${i}`), '$', '$', '$', s.id, s.spaces], true);
    if (s.contained.length) st.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [G(`rel:contains:${i}`), '$', '$', '$', s.contained, s.id], true);
  }
  for (const [mname, m] of [...materials].sort((a, b) => byCodeUnit(a[0], b[0]))) {
    if (m.members.length) st.add('IFCRELASSOCIATESMATERIAL', [G(`rel:material:${mname}`), '$', '$', '$', m.members, m.id], true);
  }

  const out = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');",
    `FILE_NAME(${text(`${o.fileName || 'model.ifc'}`)},'1970-01-01T00:00:00',(${text('mojulo')}),(${text('mojulo')}),'mojulo','mojulo','');`,
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
    ...st.lines,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n');
  return { text: out, counts, entities: st.lines.length, framed: !!model, rainwater };
}

/**
 * manifestToIfc(manifest, { ref, title }) → { text, counts, entities, framed, rainwater } for a house (a floorplan
 * manifest with `levels` or `storeys`), built exactly as the World builds it; null for a single-floor plan.
 */
export function manifestToIfc(m, { ref = 'mojulo', title = null } = {}) {
  const stacked = Array.isArray(m.levels) && m.levels.length;
  const stack = stacked ? null : storeyLevels(m);
  if (!stacked && !stack) return null;
  const opts = { ...m, walk: false, _model: true };
  const house = structurizeHouse(stacked ? m : { ...m, ...stack }, opts);
  const o = { ...FLOORPLAN_DEFAULTS, ...m };
  let planes = null, form = null, material = null;
  // a framed house writes its model (the frame, at any stage); an unframed one its plan and finished roof
  if (!house.construction && (m.roof || m.view === 'exterior')) {
    const spec = m.roof && typeof m.roof === 'object' ? { style: m.roof.style || 'bungalow', ...m.roof } : { style: typeof m.roof === 'string' ? m.roof : 'bungalow' };
    const st = { ...(ROOF_STYLES[spec.style] || ROOF_STYLES.bungalow), ...spec };
    const fp = house.footprint, top = [...house.levels].sort((a, b) => b.index - a.index)[0];
    planes = roofPlanes({ x: fp.x0, y: fp.y0, w: fp.x1 - fp.x0, d: fp.y1 - fp.y0, z: top.baseZ + top.height }, { ...spec, roomHeight: o.wallHeight });
    form = st.form;
    material = spec.covering ? coveringOf(spec.covering, st.material).material : st.material && CATALOG[`roofing:${st.material}`] ? `roofing:${st.material}` : 'roofing:membrane';
  }
  return houseToIfc(house, { name: title || m.title || 'mojulo house', ns: ref, wallThickness: o.wallThickness, exteriorThickness: o.exteriorThickness, floorDrop: o.floorDrop, roofPlanes: planes, roofForm: form, roofMaterial: material });
}
