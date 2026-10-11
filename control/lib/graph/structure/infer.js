// structure/infer — the laws a new house is minted with. Each law reads the manifest the creator gave, fills one field
// the creator left out, and says why in `notes.inferred` ({ field, value, reason, tab }), which the book's Cover lists.
// The values are ordinary recipe values: a creator revises any of them with update_sketch, and an explicit value
// (even `false`) is never overwritten. Pure: no clock, no dice. Run once at mint, never at render, so every row minted
// before keeps its bytes.

import { ROOF_STYLES } from '../architecture/roof.js';

const FORMS = new Set(Object.values(ROOF_STYLES).map((s) => s.form));

const levelCount = (m) => (Array.isArray(m.levels) && m.levels.length ? new Set(m.levels.map((l) => l?.index)).size : 0);
const storeyCount = (m) => (levelCount(m) || (Number.isInteger(m.storeys ?? m.floors) ? (m.storeys ?? m.floors) : 1));

const LAWS = [
  // A house without windows fails every bedroom's egress and every room's daylight: the drawer gives a house it lays out
  // windows, and so does a house laid out by hand.
  (m) => (m.windows === undefined
    ? { field: 'windows', value: true, tab: 'plan', reason: 'every bedroom needs a window for egress and every room daylight; set windows to false for none' }
    : null),
  // A stack authored as levels[] gets no stair unless it names one (`storeys: N` gets its own): chain every level to
  // the ground, so each floor is reached.
  (m) => (levelCount(m) >= 2 && m.stairs === undefined
    ? { field: 'stairs', value: true, tab: 'plan', reason: 'a levels[] stack reaches each floor by a stair from the ground; set stairs to a list to place them, or false for none' }
    : null),
  // A stacked house is laid out with the livability pass: the plan is repaired to its walkway, and furniture keeps a
  // passage clear of the flight, its landing and the well.
  (m) => {
    if (storeyCount(m) < 2) return null;
    if (m.design === undefined) {
      return { field: 'design', value: { repair: true, clearance: true }, tab: 'plan', reason: 'a stacked house keeps a walkway past its stair and furniture a passage clear of the flight; set design.clearance to feet, or false, or waive a finding' };
    }
    if (m.design && typeof m.design === 'object' && !Array.isArray(m.design) && m.design.clearance === undefined) {
      return { field: 'design.clearance', value: { ...m.design, clearance: true }, set: 'design', tab: 'plan', reason: 'furniture keeps a passage clear of the flight, its landing and the well; set design.clearance to feet, or false' };
    }
    return null;
  },
  // Framing frames a stack, so a framed single floor is a stack of one.
  (m) => (m.framing && !levelCount(m) && storeyCount(m) < 2
    ? { field: 'levels', value: [{ index: 0 }], tab: 'structure', reason: 'framing builds a stack, so a framed single floor is a stack of one level' }
    : null),
  // A roof style that names a form (`gable`) is not a style and would draw the default hip: keep the default style
  // and take the form asked for.
  (m) => {
    const r = m.roof, style = typeof r === 'string' ? r : r && typeof r === 'object' ? r.style : undefined;
    if (typeof style !== 'string' || ROOF_STYLES[style] || !FORMS.has(style)) return null;
    const rest = typeof r === 'object' ? Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'style')) : {};
    return { field: 'roof', value: { style: 'bungalow', form: style, ...rest }, tab: 'massing', reason: `'${style}' is a roof form, not a style: the bungalow style takes the ${style} form; name a style (${Object.keys(ROOF_STYLES).slice(0, 4).join(', ')} …) to change its look` };
  },
];

/**
 * The laws applied in order, each seeing the manifest the laws before it wrote.
 * @returns {{ manifest: object, inferred: Array<{ field: string, value: unknown, reason: string, tab: string }> }}
 */
export function inferHouse(manifest) {
  if (!manifest || manifest.kind !== 'floorplan') return { manifest, inferred: [] };
  let m = manifest;
  const inferred = [];
  for (const law of LAWS) {
    const hit = law(m);
    if (!hit) continue;
    const { set, ...note } = hit;
    m = { ...m, [set ?? hit.field]: hit.value };
    inferred.push(set ? { ...note, value: hit.value.clearance } : note);
  }
  if (!inferred.length) return { manifest, inferred };
  const notes = m.notes && typeof m.notes === 'object' && !Array.isArray(m.notes) ? m.notes : {};
  return { manifest: { ...m, notes: { ...notes, inferred: [...(Array.isArray(notes.inferred) ? notes.inferred : []), ...inferred] } }, inferred };
}
