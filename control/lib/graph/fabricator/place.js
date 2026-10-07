// fabricator/place — the plan's cuts written into OpenSCAD at the points the need names, so the agent places a joint by
// saying where it is, not by working out a cutter's translate and rotate.
//
// A need may say (all optional; a need that says neither `at` nor `parts` is left to the agent, as before):
//   at     the points it happens at, one per placement, in the model's mm: [[x, y, z], …], or
//          [{ at: [x, y, z], axis }, …] where each point turns its own way (a shaft's two bearings face apart)
//   axis   the way the cut runs INTO the material at every point: 'z-' (default, straight down), 'z+', 'x+', 'x-',
//          'y+', 'y-'. For a two-part joint it is the bolt's way, head toward tip, and the points sit on the MATING
//          plane where the two parts meet
//   parts  which of the source's `parts` takes which side: { into, head, hub }; `part: 'base'` is { into: 'base' }
//
// Each cut gets one RULE by its strategy and module:
//   into   the cutter at the point, running along the axis (a pilot, a seat, a groove, a hole through a wall);
//   head   in the part the bolt head bears on: entering from that part's outer face, the call's depth back from the
//          mating plane, running along the axis (a counterbore);
//   flip   in the other part of a located pair: at the mating plane, running against the axis (a slip-fit pin hole);
//   pair   half the count in each part: one into, one flipped (two magnets that meet);
//   add    positive geometry built at the point (a board's standoffs), not cut.
// A cut with no rule (a nut trap's far face, a gland's rim path, a groove on a bought shaft) is said in `manual`
// with where it goes; so is a cut whose part or points are missing. Nothing is guessed.
//
// The block is two modules, `fab_cuts(part)` and `fab_adds(part)`, between two marker lines. The source calls them
// (`difference() { base(); fab_cuts("base"); }`); fabricate_solid writes the block into the stored source and a
// re-plan rewrites it, so the cuts follow the needs. Pure and deterministic.

export const PLACE_BEGIN = '// <fabricate placement>';
export const PLACE_END = '// </fabricate placement>';
export const AXES = Object.freeze(['z-', 'z+', 'x+', 'x-', 'y+', 'y-']);

// The cutters run from z = 0 DOWN (−z); this turns −z onto each axis.
const ROT = { 'z-': null, 'z+': [180, 0, 0], 'x+': [0, -90, 0], 'x-': [0, 90, 0], 'y+': [90, 0, 0], 'y-': [-90, 0, 0] };
const DIR = { 'z-': [0, 0, -1], 'z+': [0, 0, 1], 'x+': [1, 0, 0], 'x-': [-1, 0, 0], 'y+': [0, 1, 0], 'y-': [0, -1, 0] };
const FLIP = { 'z-': 'z+', 'z+': 'z-', 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+' };

const INTO = { rule: 'into', side: 'into' };
const HEAD = { rule: 'head', side: 'head' };
const FLIPPED = { rule: 'flip', side: 'head' };
const PAIR = { rule: 'pair' };
const ADD = { rule: 'add', side: 'into' };

/** strategy → module (or module#fit for mj_hole) → rule. Anything not listed is placed by hand. */
const RULES = Object.freeze({
  'heatset-bolt': { mj_heatset_hole: INTO, mj_counterbore: HEAD },
  tapped: { mj_tapped_hole: INTO },
  'tapped-metal': { mj_tapped_hole: INTO },
  'heat-set': { mj_heatset_hole: INTO },
  'printed-thread': { mj_tapped_hole: INTO },
  'dowel-pin': { 'mj_hole#press': INTO, 'mj_hole#slip': FLIPPED },
  'ball-bearing': { mj_bearing_seat: INTO },
  'linear-bushing': { mj_bearing_seat: INTO },
  stepper: { mj_nema_mount: INTO, mj_d_bore: { rule: 'into', side: 'hub' } },
  'stepper-heavy': { mj_nema_mount: INTO },
  key: { mj_keyway_hub: INTO },
  'd-flat': { mj_d_bore: INTO },
  'set-screw': { mj_heatset_hole: INTO },
  'cable-gland': { mj_hole: INTO },
  'breather-vent': { mj_hole: INTO },
  'o-ring': { mj_oring_groove: INTO },
  magnet: { mj_hole: PAIR },
  vesa: { mj_vesa: INTO },
  't-slot': { mj_counterbore: INTO },
  rpi: { mj_board_standoffs: ADD },
  arduino: { mj_board_standoffs: ADD },
});

const moduleOf = (call) => (String(call).match(/^(mj_[a-z0-9_]+)/) || [])[1];
const fitOf = (call) => (String(call).match(/"(press|slip|running)"/) || [])[1];
/** The call's depth: its first plain number argument after the size (a counterbore's `depth`). */
const depthOf = (call) => { const n = String(call).replace(/^[^(]*\(/, '').replace(/\)\s*$/, '').split(',').slice(1).map((s) => +s.trim()).find(Number.isFinite); return n ?? 0; };
const r3 = (v) => Math.round(v * 1000) / 1000;
const vec = (p) => `[${p.map(r3).join(', ')}]`;

/** A need's points → [{ at, axis }] or an error string. */
function pointsOf(need) {
  if (need.at === undefined) return [];
  if (!Array.isArray(need.at)) return '`at` must be a list of points';
  const axis0 = need.axis ?? 'z-';
  if (!AXES.includes(axis0)) return `\`axis\` must be one of ${AXES.join(', ')}`;
  const out = [];
  for (const [i, p] of need.at.entries()) {
    const at = Array.isArray(p) ? p : p && p.at;
    const axis = (p && !Array.isArray(p) && p.axis) || axis0;
    if (!Array.isArray(at) || at.length !== 3 || !at.every(Number.isFinite)) return `at[${i}] must be [x, y, z] or { at: [x, y, z], axis }`;
    if (!AXES.includes(axis)) return `at[${i}].axis must be one of ${AXES.join(', ')}`;
    out.push({ at, axis });
  }
  return out;
}

const partsOf = (need) => ({ ...(typeof need.part === 'string' ? { into: need.part } : {}), ...(need.parts && typeof need.parts === 'object' ? need.parts : {}) });

/** One OpenSCAD line: the call at a point, turned onto an axis. */
const line = (at, axis, call) => `    translate(${vec(at)}) ${ROT[axis] ? `rotate(${vec(ROT[axis])}) ` : ''}${call};`;

/** Why a needs list's placement fields cannot be read, or null (checked with the needs). */
export function placeError(need, i) {
  const p = pointsOf(need);
  if (typeof p === 'string') return `needs[${i}].${p}`;
  if (need.parts !== undefined && (typeof need.parts !== 'object' || Array.isArray(need.parts) || !Object.values(need.parts).every((v) => typeof v === 'string'))) return `needs[${i}].parts must be { into?, head?, hub? } naming source parts`;
  return null;
}

/**
 * The plan's scad cuts at the needs' points. `cuts` are the plan's (`{ need, call, count, route, where }`), `needs`
 * the raw needs by id with their strategy. → { block, placed: [{ need, call, part, n }], manual: [{ need, call, why }] },
 * or null when no need says where.
 */
export function placementOf(cuts, needs) {
  if (!needs.some((n) => n.raw.at !== undefined || n.raw.parts !== undefined || n.raw.part !== undefined)) return null;
  const byPart = { cuts: new Map(), adds: new Map() };
  const placed = [];
  const manual = [];
  const put = (kind, part, text) => { const m = byPart[kind]; if (!m.has(part)) m.set(part, []); m.get(part).push(text); };
  for (const c of cuts) {
    if (c.route !== 'fit') continue;
    const need = needs.find((n) => n.id === c.need);
    const mod = moduleOf(c.call);
    const rules = RULES[need.strategy] || {};
    const rule = rules[`${mod}#${fitOf(c.call)}`] || rules[mod];
    const hand = (why) => manual.push({ need: c.need, call: c.call, why, where: c.where });
    if (!rule) { hand('placed by hand: its geometry depends on more than a point'); continue; }
    const points = pointsOf(need.raw);
    const parts = partsOf(need.raw);
    if (!points.length) { hand('no `at` points on the need'); continue; }
    const want = rule.rule === 'pair' ? c.count / 2 : c.count;
    if (points.length !== want) { hand(`needs ${want} \`at\` point${want === 1 ? '' : 's'}, the need gives ${points.length}`); continue; }
    const sides = rule.rule === 'pair' ? [['into', 'into'], ['head', 'flip']] : [[rule.side, rule.rule]];
    const missing = sides.map(([s]) => s).filter((s) => !parts[s]);
    if (missing.length) { hand(`name the part for its ${missing.join(' and ')} side in \`parts\``); continue; }
    for (const [side, how] of sides) {
      const part = parts[side];
      for (const { at, axis } of points) {
        if (how === 'head') {
          const back = depthOf(c.call);
          put('cuts', part, line(at.map((v, k) => v - DIR[axis][k] * back), axis, c.call));
        } else if (how === 'flip') put('cuts', part, line(at, FLIP[axis], c.call));
        else put(how === 'add' ? 'adds' : 'cuts', part, line(at, axis, c.call));
      }
      placed.push({ need: c.need, call: c.call, part, n: points.length });
    }
  }
  const mod = (name, m) => [`module ${name}(part) {`, ...[...m.keys()].sort().flatMap((p) => [`  if (part == ${JSON.stringify(p)}) {`, ...m.get(p), '  }']), '}'];
  const block = [PLACE_BEGIN, '// Written by fabricate_solid from the needs\' `at`, `axis` and `parts`; a re-plan rewrites it. Edit the needs, not this.',
    ...mod('fab_cuts', byPart.cuts), ...mod('fab_adds', byPart.adds), PLACE_END].join('\n');
  return { block, placed, manual };
}

const CALLS = /(^|[^A-Za-z0-9_])fab_(cuts|adds)\s*\(/;

/**
 * The source with the placement block written in: replacing the one already there, or put at the top when the source
 * calls fab_cuts / fab_adds. → { source, written: bool, called: bool }.
 */
export function withPlacement(source, placement) {
  const a = source.indexOf(PLACE_BEGIN);
  const b = a >= 0 ? source.indexOf(PLACE_END, a) : -1;
  const body = a >= 0 && b >= 0 ? source.slice(0, a) + source.slice(b + PLACE_END.length).replace(/^\n/, '') : source;
  const called = CALLS.test(body);
  if (!placement || !called) return { source: a >= 0 && b >= 0 && !called ? body : source, written: false, called };
  const out = a >= 0 && b >= 0 ? source.slice(0, a) + placement.block + source.slice(b + PLACE_END.length) : `${placement.block}\n${source}`;
  return { source: out, written: true, called };
}
