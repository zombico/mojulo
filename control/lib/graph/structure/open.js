// structure/open — what a house has not reached yet, by outcome. One table read by the structure book's Open tab and by
// the `next` that mint_building, create_sketch and update_sketch answer with, so the readout and the book name the same
// concerns, the same fields, the same cards. Pure.
//
// The four outcomes are what people come to a house for: Concept (what does it look like, does it sit right), Layout
// (does it live well), Drawings (can I show or hand this on), Build (can it be built, what does it take). Each has a
// card holding its questions from zero, its laws, and the fields that open each tab.

import { unreachedLevels, stairCrowding, isWaived } from './tables.js';

export const OUTCOMES = Object.freeze([
  { id: 'concept', name: 'Concept', card: 'house-concept', question: 'what does it look like, and does it sit right', tabs: ['Cover', 'Site', 'Massing', 'Walk'] },
  { id: 'layout', name: 'Layout', card: 'house-livability', question: 'does it live well', tabs: ['Plan', 'Rooms', 'Objects'] },
  { id: 'drawings', name: 'Drawings', card: 'house-drawings', question: 'can I show or hand this on', tabs: ['Elements'] },
  { id: 'build', name: 'Build', card: 'house-build', question: 'can it be built, and what does it take', tabs: ['Structure', 'Services', 'Quantities', 'Checks'] },
]);
export const OUTCOME_CARDS = Object.freeze(Object.fromEntries(OUTCOMES.map((o) => [o.id, o.card])));
const cardOf = (outcome) => OUTCOME_CARDS[outcome];

// The walkway and stair-clearance findings a house's own rules have not waived.
function livabilityFindings(m, read) {
  const out = [];
  for (const c of stairCrowding(read)) {
    if (!isWaived(read, 'stair-clearance', c.room)) out.push({ rule: 'stair-clearance', at: c.room ?? '', gapFt: c.gapFt, wantFt: c.wantFt, what: c.type, stair: c.stair });
  }
  for (const f of read.design?.findings || []) {
    const at = /^([a-z]+):/.exec(String(f))?.[1] ?? '';
    if (!isWaived(read, 'walkway', at)) out.push({ rule: 'walkway', at, finding: String(f) });
  }
  return out;
}

const hasDesignPass = (m) => !!(m.design && typeof m.design === 'object' && m.design.repair && m.design.clearance);

/**
 * Each concern: `id` (the readout's `next` id and the Open card's anchor), its outcome and tab, the field that adds it
 * (`add`), what that adds, and, when it is not a field but a call, `export`. `follows` names the concern whose field
 * also answers this one, so the readout names that field once.
 */
const CONCERNS = [
  { id: 'site', outcome: 'concept', tab: 'Site', when: (m, r) => !r.site,
    add: 'perimeter: true', adds: 'the lot, setbacks, street, drive and garden; the site plan C-101' },
  { id: 'roof', outcome: 'concept', tab: 'Massing', when: (m, r) => !r.elements.roof,
    add: "roof: 'bungalow' (a style: mission, pavilion, farmhouse …; form: 'gable' for its shape)", adds: 'a roof on the elevations and sections, and the roof framing and drainage that hang on it' },
  { id: 'stairs', outcome: 'layout', tab: 'Plan', when: (m, r) => unreachedLevels(r).length > 0,
    add: 'stairs: true (or stairs: [{ from, to }])', adds: (m, r) => `a flight to ${unreachedLevels(r).map((s) => `L${s.number}`).join(', ')}, which nothing reaches now: its stairwell in the slab, the flight on the plans and sections, the trimmed opening in the frame` },
  { id: 'livability', outcome: 'layout', tab: 'Plan', when: (m, r) => livabilityFindings(m, r).length > 0,
    add: (m) => (hasDesignPass(m) ? "design.waive: ['stair-clearance:<room>' | 'walkway'] (the repair could not clear it in this footprint; or widen the house)" : 'design: { repair: true, clearance: true }'),
    adds: (m, r) => { const f = livabilityFindings(m, r); return `a walkway past the stair and furniture kept clear of it (${f.length} finding${f.length === 1 ? '' : 's'} now: ${f.slice(0, 2).map((x) => (x.rule === 'stair-clearance' ? `${x.what} ${Math.round(x.gapFt * 12)} in from ${x.stair}` : x.finding)).join('; ')})`; } },
  { id: 'program', outcome: 'layout', tab: 'Rooms', when: (m, r) => !!r.program?.given && r.program.beds.built < r.program.beds.asked,
    add: (m, r) => (r.program.studyTakesBed && r.program.beds.built === r.program.beds.asked - 1 ? 'tier.study: false (upstairs, a study takes the last bedroom of three or more)' : 'a larger width / height, or leave storeys and levels out so the mint fits the footprint to the program'),
    adds: (m, r) => `the bedrooms asked for: ${r.program.beds.asked} asked, ${r.program.beds.built} built in this footprint` },
  { id: 'windows', outcome: 'layout', tab: 'Plan', when: (m) => m.windows === undefined || m.windows === null,
    add: 'windows: true', adds: 'a window in every exterior room: egress for the bedrooms, daylight, the window schedule' },
  { id: 'furnishing', outcome: 'layout', tab: 'Objects', when: (m, r) => !r.objects.pieces.length,
    add: 'furnish: true, or rooms[].items [{ type } | { ref }]', adds: 'the furniture, fixtures and appliances, the FF&E schedule, a custom piece by its own ref' },
  { id: 'sheets', outcome: 'drawings', tab: 'Elements', when: () => true, export: 'sheets',
    add: "export_model({ ref, format: 'sheets' }) · format: 'schedules'", adds: 'the drawing set as SVG sheets, and every schedule as CSV and JSON' },
  { id: 'framing', outcome: 'build', tab: 'Structure', when: (m, r) => !r.construction,
    add: (m, r) => `framing: { system: 'platform' }${r.stacked ? '' : ' with levels: [{ index: 0 }] (the frame needs a stack)'}`, adds: 'the frame: foundation, floor, wall and roof framing plans, the member schedule, the takeoff and cut list' },
  { id: 'wiring', outcome: 'build', tab: 'Services', when: (m, r) => !r.wiring, follows: 'framing',
    add: 'framing (the wiring is roughed into the frame)', adds: 'the electrical plans and the panel schedule' },
  { id: 'drainage', outcome: 'build', tab: 'Services', when: (m, r) => !r.drainage,
    add: (m, r) => `drainage: true${r.elements.roof ? '' : ' (with a roof)'}${r.stacked ? '' : ' and levels: [{ index: 0 }]'}`, adds: 'gutters, downspouts and outlets; the roof drainage plan P-101' },
  { id: 'covering', outcome: 'build', tab: 'Quantities', when: (m, r) => !!r.construction && !!r.elements.roof && !(m.roof && typeof m.roof === 'object' && m.roof.covering),
    add: "roof.covering: true (or { type: 'slate' | 'asphalt-shingle' | … })", adds: 'the roof laid as courses of tiles, and its count in the takeoff' },
  { id: 'quantities', outcome: 'build', tab: 'Quantities', when: (m, r) => !r.construction, follows: 'framing',
    add: 'framing', adds: 'what it takes: cut list, sheet goods to buy, takeoff by material' },
  { id: 'ifc', outcome: 'build', tab: 'Checks', when: () => true, export: 'ifc',
    add: "export_model({ ref, format: 'ifc' })", adds: 'the house as an IFC4 building model for Bonsai, Revit or ArchiCAD' },
];
export const CONCERN_IDS = Object.freeze(CONCERNS.map((c) => c.id));

const val = (x, m, r) => (typeof x === 'function' ? x(m, r) : x);

const ORDER = new Map(OUTCOMES.map((o, i) => [o.id, i]));
const open = (m, read) => CONCERNS.filter((c) => c.when(m, read))
  .map((c) => ({ id: c.id, outcome: c.outcome, tab: c.tab, field: val(c.add, m, read), adds: val(c.adds, m, read), card: cardOf(c.outcome), ...(c.export ? { export: c.export } : {}), ...(c.follows ? { follows: c.follows } : {}) }))
  .sort((a, b) => ORDER.get(a.outcome) - ORDER.get(b.outcome));

/** Each tab the house has not reached, in outcome order: { id, outcome, tab, field, adds, card, follows? }. The book's
 *  Open tab. A call (an export) is never open: it is a step, and only the readout names it. */
export function openConcerns(m, read) {
  return open(m, read).filter((c) => !c.export);
}

/** The readout's `next`: each step once, in outcome order (a concern that follows another's field is left to it). */
export function nextSteps(m, read) {
  return open(m, read).filter((c) => !c.follows).map((c) => ({ id: c.id, outcome: c.outcome, ...(c.export ? { export: c.export } : { add: c.field }), card: c.card }));
}

/** The stair clearance as the readout carries it beside the walkway: ok, and each crowding piece in words. */
export function clearanceReadout(read) {
  if (!read.stacked && !(read.elements.stairs || []).length) return null;
  const R = read.rules || {};
  const crowd = stairCrowding(read);
  const open = crowd.filter((c) => !isWaived(read, 'stair-clearance', c.room));
  const want = R.clearance > 0 ? R.clearance : R.passage ?? 3;
  return {
    ok: open.length === 0,
    clearIn: Math.round(want * 12),
    ...(open.length ? { findings: open.slice(0, 6).map((c) => `${c.room ?? ''}: ${c.type.replace(/-/g, ' ')} ${Math.round(c.gapFt * 12)} in from the ${c.where} of ${c.stair}`) } : {}),
    ...(crowd.length > open.length ? { waived: crowd.length - open.length } : {}),
  };
}
