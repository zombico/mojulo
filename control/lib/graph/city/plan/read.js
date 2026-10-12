/**
 * THE CITY, READ: one read model over a designed city, and the one table of what it has not reached yet. The mint's
 * reply, the plan book and `next` all read these, so the readout and the book name the same concerns, the same fields,
 * the same laws. Pure; nothing here is stored.
 *
 * The outcomes are what people come to a city plan for: Layout (does it read as a city: spine, districts, places),
 * Walk (can it be walked and ridden), Look (what it is built of and how high), Play (can it be played as levels).
 */
import { designCity } from './design.js';
import { DISTRICT_USES, SITE_USES } from './card.js';

export const CITY_OUTCOMES = Object.freeze([
  { id: 'layout', name: 'Layout', question: 'does it read as a city: its main streets, its districts, its places', tabs: ['Plan', 'Districts', 'Lots'] },
  { id: 'walk', name: 'Walk', question: 'can it be walked and ridden', tabs: ['Walk', 'Transit'] },
  { id: 'look', name: 'Look', question: 'what is it built of, and how high', tabs: ['Massing'] },
  { id: 'play', name: 'Play', question: 'can it be played as levels', tabs: ['Segments'] },
]);
export const CITY_CARD = 'city-plan';

const lawOf = (read, id) => read.laws.find((l) => l.id === id);
const at = (read, id) => (lawOf(read, id)?.findings || []).map((f) => f.at);

/**
 * Each concern: its outcome and tab, the field that answers it (`add`), what that adds. A concern reads the recipe as
 * written (`m`) and its read; `notes.inferred` names what the mint handed it.
 */
const CONCERNS = [
  { id: 'spine', outcome: 'layout', tab: 'Plan', when: (m) => (m.notes?.inferred || []).some((i) => i.field === 'spine'),
    add: (m, r) => `spine: [{ path: 'A${Math.ceil(r.board.rows / 3)}>${String.fromCharCode(64 + r.board.cols)}${Math.ceil(r.board.rows / 3)}', rank: 'major' }, …] (strokes of cells; a bend is a third cell)`,
    adds: 'your own main streets, laid first: the grid is cut from what they leave, a bend or a diagonal runs over it' },
  { id: 'districts', outcome: 'layout', tab: 'Districts', when: (m) => !(m.districts || []).length,
    add: "districts: [{ at: 'D2:F4', use: 'core' }, { at: 'A4:C6', use: 'residential' }, …]",
    adds: `what each part is for (${Object.keys(DISTRICT_USES).join(', ')}); left out, the height field decides: core near the crossing, residential far out` },
  { id: 'sites', outcome: 'layout', tab: 'Plan', when: (m) => !(m.sites || []).length,
    add: "sites: [{ at: 'E3', use: 'plaza' }, { at: 'G2:H3', use: 'landmark', landmark: 'big-ben' }, { at: 'B6', use: 'civic', building: 'church' }]",
    adds: `ground reserved before the grid grows (${Object.keys(SITE_USES).join(', ')}): the streets go round it and every one that meets it gains a beat; a landmark site stands one of the library's (landmark), a civic one a church, mosque, temple or rotunda (building), either your own edifice (from: '<ref>', made with mint_solid({ kind: 'edifice' }))` },
  { id: 'landmark-fits', outcome: 'layout', tab: 'Plan', when: (m, r) => !lawOf(r, 'landmark-fits').ok,
    add: "give the landmark's site more cells (sites[i].at: 'G2:J5'), or name a smaller landmark",
    adds: 'a landmark at its real size against the streets: shrunk to fit its site it reads as a model of itself' },
  { id: 'lots', outcome: 'layout', tab: 'Lots', when: (m) => !Object.keys(m.lots || {}).length,
    add: "lots: { '<lot id>': { use?, storeys? } } (ids on the book's Lots sheet)", adds: 'a lot by hand: its use or its height, the rest of its block untouched' },
  { id: 'crossings', outcome: 'walk', tab: 'Walk', when: (m, r) => !lawOf(r, 'crossing-every').ok,
    add: (m, r) => (r.play === 'real' ? "play: 'game' (it compresses the blocks), or a spine or a site across the long block" : `a spine stroke or a site across ${at(r, 'crossing-every').slice(0, 2).join(', ')}; or waive: ['crossing-every:<street>']`),
    adds: (m, r) => `a crossing where a block runs too long (${lawOf(r, 'crossing-every').findings.length} street${lawOf(r, 'crossing-every').findings.length === 1 ? '' : 's'} now)` },
  { id: 'beats', outcome: 'walk', tab: 'Walk', when: (m, r) => !lawOf(r, 'beat-every').ok,
    add: (m, r) => `a commercial district or a site along ${at(r, 'beat-every').slice(0, 2).join(', ')}; or waive: ['beat-every:<street>'] (an edge of town may be quiet)`,
    adds: (m, r) => `something to meet along every walk: ${lawOf(r, 'beat-every').findings.slice(0, 2).map((f) => f.detail).join('; ')}` },
  { id: 'transit', outcome: 'walk', tab: 'Transit', when: (m, r) => !(m.transit || []).length && (r.stats.walkAcross?.minutes ?? 0) > 5,
    add: (m, r) => `transit: [{ path: 'A${Math.ceil(r.board.rows / 2)}>${String.fromCharCode(64 + r.board.cols)}${Math.ceil(r.board.rows / 2)}', mode: '${r.modes[0]}' }] (along a street's cells)`,
    adds: (m, r) => `a line and its stops: crossing the city on foot takes ${Math.round(r.stats.walkAcross.minutes)} minutes now` },
  { id: 'transit-reach', outcome: 'walk', tab: 'Transit', when: (m, r) => !lawOf(r, 'transit-reach').ok,
    add: 'another line through the lots it misses', adds: (m, r) => lawOf(r, 'transit-reach').findings[0].detail },
  { id: 'transit-on-street', outcome: 'walk', tab: 'Transit', when: (m, r) => !lawOf(r, 'transit-on-street').ok,
    add: "a line's path along a street's cells (the spine's, or a grid street's)", adds: (m, r) => lawOf(r, 'transit-on-street').findings[0].detail },
  { id: 'segments', outcome: 'play', tab: 'Segments', when: (m) => !m.segments,
    add: 'segments: { levels: true } (or { across: [lo, hi] metres, levels })', adds: 'the city cut along its spine and avenues into pieces a level can hold, each joined to its neighbours at a portal on a street; with levels, a level per segment minted beside the city and the order create_game takes' },
  { id: 'levels', outcome: 'play', tab: 'Segments', when: (m) => !!m.segments && !m.segments.levels,
    add: 'segments.levels: true', adds: (m, r) => `a level per segment (${r.segments.length} now), each reading the city by ref, and the map game's order for create_game` },
  { id: 'game', outcome: 'play', tab: 'Segments', when: (m) => !!(m.segments && m.segments.levels), export: 'create_game',
    add: "create_game with the mint's game.create_game (its levels, their exits, a progression slice)", adds: 'the city played as a map: each segment a level, left by its streets into its neighbours' },
];

const val = (x, m, r) => (typeof x === 'function' ? x(m, r) : x);
const ORDER = new Map(CITY_OUTCOMES.map((o, i) => [o.id, i]));

/** What the city has not reached, in outcome order: { id, outcome, tab, field, adds, card }. */
export function openCityConcerns(m, read) {
  return CONCERNS.filter((c) => c.when(m, read)).map((c) => ({ id: c.id, outcome: c.outcome, tab: c.tab, field: val(c.add, m, read), adds: val(c.adds, m, read), card: CITY_CARD, ...(c.export ? { export: c.export } : {}) }))
    .sort((a, b) => ORDER.get(a.outcome) - ORDER.get(b.outcome));
}
/** The readout's `next`: each open step once. */
export const cityNextSteps = (m, read) => openCityConcerns(m, read).map((c) => ({ id: c.id, outcome: c.outcome, ...(c.export ? { call: c.export } : {}), add: c.field, card: c.card }));

/** A city recipe read whole: the design and its summary. `design` is kept for the book and the scene; the summary is
 *  what a reply carries. */
export function readCity(m) {
  const d = designCity(m);
  const uses = {};
  for (const l of d.lots) uses[l.use] = (uses[l.use] || 0) + 1;
  const read = {
    grammar: { id: typeof d.plan.grammar === 'string' ? d.plan.grammar : `${d.plan.grammar.from}+`, label: d.grammar.label, locale: d.grammar.locale, ...(typeof d.plan.grammar === 'string' ? {} : { document: true }) },
    play: d.plan.play, board: d.plan.board, fidelity: d.plan.fidelity,
    frame: { w: d.frame.W, d: d.frame.D, km2: d.stats.km2 },
    modes: d.grammar.transit.modes,
    field: { core: [d.field.cx, d.field.cy], reach: d.field.lambda },
    spine: d.streets.filter((s) => s.source === 'spine').map((s) => s.id),
    districts: d.districts.map((x) => ({ id: x.id, use: x.use, ...(x.name ? { name: x.name } : {}) })),
    sites: d.sites.map((s) => ({ id: s.id, use: s.use, ...(s.name ? { name: s.name } : {}), ...(s.mass ? { height: s.mass.h } : {}), ...(s.mass?.landmark ? { landmark: s.mass.landmark } : {}), ...(s.mass?.building ? { building: `${s.mass.building} (${s.mass.variant})` } : {}), ...(s.mass?.from ? { from: s.mass.from } : {}), ...(s.mass?.scale !== undefined && s.mass.scale < 1 ? { scale: s.mass.scale } : {}) })),
    transit: d.transit.map((t) => ({ id: t.id, mode: t.mode, km: Math.round(t.length) / 1000, stops: t.stops.length })),
    uses, stats: d.stats,
    ...(d.segments ? { segments: d.segments.map((x) => ({ id: x.id, size: [Math.round(x.rect.x1 - x.rect.x0), Math.round(x.rect.y1 - x.rect.y0)], lots: x.lots.length, neighbours: x.neighbours.map((n) => ({ id: n.id, side: n.side, street: n.portal.street })) })) } : {}),
    laws: d.laws.map((l) => ({ id: l.id, layer: l.layer, ok: l.ok, findings: l.findings, ...(l.waived ? { waived: l.waived } : {}) })),
  };
  return { read, design: d };
}

/** The reply a mint or an edit answers with: the summary, its laws in brief, and the next steps. */
export function cityReadout(m) {
  const { read } = readCity(m);
  return {
    city: {
      grammar: read.grammar.id, look: read.grammar.label, play: read.play, board: `${read.board.cols} × ${read.board.rows} cells of ${read.board.cell} m`, frame: `${read.frame.w} × ${read.frame.d} m`,
      blocks: read.stats.blocks, lots: read.stats.lots, towers: read.stats.towers, heights: read.stats.height, pitch: read.stats.pitch,
      walkAcross: read.stats.walkAcross, streetKm: read.stats.streetKm, stops: read.stats.stops,
      ...(read.segments ? { segments: read.segments.map((x) => `${x.id} ${x.size[0]}×${x.size[1]} m, ${x.lots} lots, to ${x.neighbours.map((n) => n.id).join(' ')}`) } : {}),
    },
    laws: read.laws.map((l) => (l.ok ? { id: l.id, ok: true, ...(l.waived ? { waived: l.waived } : {}) } : { id: l.id, ok: false, findings: l.findings.length, first: l.findings.slice(0, 2).map((f) => f.detail), ...(l.waived ? { waived: l.waived } : {}) })),
    next: cityNextSteps(m, read),
  };
}
