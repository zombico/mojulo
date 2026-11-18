/**
 * THE SCALES — the first primitive of an exhibit: the size of the thing it shows. The base is the HUMAN point of view
 * (what a person could stand beside); below it the micro, the atomic and molecular, the subatomic; above it the macro,
 * the geo, the planetary, outer space. The two ends are conceptual: nobody has stood there, and the picture is a model.
 * Two things stand beside the ladder, with no rung: a PLACE IN HISTORY (the historical views: a real place at its
 * period, whose cultures are the primitives of what can be shown) and an IDEA (a theorem, a method), which has no size.
 *
 * The exhibit determines its scale: a concept lives at a rung, or spans several (a dam is macro, why its turbine turns
 * is human, why current flows is atomic), and each rung it needs is a ROOM. The agent reads the concept and names the
 * rungs; this says what each rung shows naturally, how a world at it is made new, and which samples in the halls are
 * like it.
 *
 *   SCALES            { <id>: { name, rung, says, shows, made, laws, samples, conceptual? } }, smallest first
 *     rung      its place on the ladder: 0 the human base, negative below, positive above; null beside it (a place
 *               in history, an idea)
 *     shows     the ways a stop explains that come naturally there (tour.js TOUR_SHAPES)
 *     made      how a world at this scale is made new: the primitive, in words
 *     view      how a room at this scale opens, in the camera's own words (shoot/frame.js OBJECT_SIZES by how much of
 *               the frame the thing fills, shoot/framing.js ANGLES): the macro is the bigger view from above, the geo
 *               a map of the place from overhead
 *     laws      the science worlds' law tables that can compose it (science-worlds: quantum | microscopic | classical |
 *               relativistic); none: it is composed, not simulated from a law table
 *     samples   exhibits in the halls that are LIKE it: read for their form, never offered as the thing to make
 *   SCALE_IDS         the ladder's rungs, smallest first, then what stands beside it
 *   readScales(v)     → [<id>] as named, the home rung first, none twice; throws, teaching
 *   scaleReport(ids)  → { home, rungs: [{ id, name, says, view, shows, made, laws, samples, conceptual? }], spans,
 *                     zoom: [{ from, to, way: 'in' | 'out' | 'aside', steps, move? }], says }
 *     zoom      between each room and the next, the way the visitor goes: in (smaller), out (larger), or aside (to or
 *               from what stands beside the ladder), how many rungs, and the camera's named move for it
 *               (shoot/moves.js MOVES: a push in, a pull out; a crane up to a view from above, a crane down from one;
 *               aside is a cut, no move)
 *
 * Pure data and pure functions.
 */
import { TOUR_SHAPES } from './tour.js';

const row = (o) => Object.freeze({ ...o, view: Object.freeze(o.view), shows: Object.freeze(o.shows), laws: Object.freeze(o.laws), samples: Object.freeze(o.samples) });

export const SCALES = Object.freeze({
  subatomic: row({ view: { size: 'full', angle: 'eye' }, name: 'subatomic', rung: -3, conceptual: true, says: 'inside the atom: a nucleus splitting, a particle in a well', shows: ['process'],
    made: 'a demo composed from the quantum law table; a nuclear event drawn as a model, said to be one', laws: ['quantum'], samples: ['science/fission', 'science/fusion', 'science/cascade', 'science/cherenkov'] }),
  atomic: row({ view: { size: 'full', angle: 'eye' }, name: 'atomic and molecular', rung: -2, says: 'atoms and the molecules they make: what a thing is built of', shows: ['structure'],
    made: 'a structure built from its atoms and bonds; why a bond forms from the quantum table, molecules that move from the microscopic', laws: ['quantum', 'microscopic'], samples: ['science/atom', 'life/molecule', 'life/dna'] }),
  micro: row({ view: { size: 'full', angle: 'eye' }, name: 'micro', rung: -1, says: 'cells and what happens in them: dividing, binding, diffusing', shows: ['process', 'structure'],
    made: 'a demo composed from the microscopic law table, or a cell\'s structure drawn', laws: ['microscopic'], samples: ['life/cellular', 'life/dna-process', 'life/energy-cycle'] }),
  human: row({ view: { size: 'full', angle: 'eye' }, name: 'human', rung: 0, says: 'the base: what a person could stand beside. Simulations and experiments', shows: ['quantity', 'process'],
    made: 'a demo composed from the classical law table, or a world composed and walked', laws: ['classical'], samples: ['science/mechanics', 'science/windmill', 'science/fluid'] }),
  macro: row({ view: { size: 'wide', angle: 'high' }, name: 'macro', rung: 1, says: 'the bigger view from above: a machine, a site, a landscape feature whole', shows: ['process', 'structure'],
    made: 'the world seen from further up: an aerial camera over it', laws: [], samples: ['earth/hydro', 'science/airplane', 'science/rocket', 'earth/waterfall'] }),
  geo: row({ view: { size: 'extreme-wide', angle: 'overhead' }, name: 'geo', rung: 2, says: 'the land itself: terrain, water, weather over a region', shows: ['stratified', 'structure'],
    made: 'a geocube: terrain modelled', laws: [], samples: ['earth/ocean', 'earth/atmosphere', 'earth/beach'] }),
  planetary: row({ view: { size: 'full', angle: 'eye' }, name: 'planetary', rung: 3, says: 'a planet whole, and what goes round it', shows: ['structure', 'process'],
    made: 'the planetary views: a body hung in its sky, an orbit', laws: [], samples: ['space/saturn', 'space/comet'] }),
  space: row({ view: { size: 'wide', angle: 'eye' }, name: 'outer space', rung: 4, conceptual: true, says: 'stars, galaxies and spacetime itself', shows: ['process', 'structure'],
    made: 'the space views; spacetime round a mass from the relativistic law table', laws: ['relativistic'], samples: ['space/star-surface', 'space/star-birth', 'space/pulsar', 'space/galaxy', 'space/gravity-wave'] }),
  // (beside the ladder: a place in time, and an idea. The historic cultures are the PRIMITIVES of the historical views,
  // not samples: what can be shown is one of them at its period)
  history: row({ view: { size: 'wide', angle: 'high' }, name: 'a place in history', rung: null, says: 'a real place at its period, walked: the historical views', shows: ['structure', 'stratified'],
    made: 'one of the historic cultures at its period, its parts named so a stop can light them. The cultures are the primitives here: what is shown is one of them', laws: [], samples: ['history/pompeii', 'history/sumer'] }),
  idea: row({ view: { size: 'full', angle: 'eye' }, name: 'an idea', rung: null, says: 'a theorem, a method, a relation: it has no size', shows: ['formal', 'quantity'],
    made: 'a formal explainer: the idea drawn so it can be turned and stepped', laws: [], samples: ['math/derivative', 'math/pythagoras', 'math/transformer'] }),
});
export const SCALE_IDS = Object.freeze(Object.keys(SCALES));
export const HOME_SCALE = 'human';

const fail = (m) => new Error(`exhibit: scales${m}`);

export function readScales(v) {
  const list = Array.isArray(v) ? v : [v];
  if (!list.length || list.some((s) => !SCALES[s])) throw fail(` are the rungs the concept lives at, its home first: ${SCALE_IDS.map((s) => `${s} (${SCALES[s].says})`).join('; ')}`);
  if (new Set(list).size !== list.length) throw fail(' names a rung twice: a rung is one room');
  return [...list];
}

// a room seen from above (its view's angle is no eye-level one): going up to it is the boom, coming down from it too
const aerial = (id) => SCALES[id].view.angle !== 'eye';
const way = (a, b) => {
  const ra = SCALES[a].rung, rb = SCALES[b].rung;
  if (ra === null || rb === null) return { from: a, to: b, way: 'aside', steps: 0 };
  const out = rb > ra;
  const move = out ? (aerial(b) && !aerial(a) ? 'crane_up' : 'pull_out') : (aerial(a) && !aerial(b) ? 'crane_down' : 'push_in');
  return { from: a, to: b, way: out ? 'out' : 'in', steps: Math.abs(rb - ra), move };
};

export function scaleReport(ids) {
  const list = readScales(ids);
  const rungs = list.map((id) => { const S = SCALES[id]; return { id, name: S.name, says: S.says, view: { ...S.view }, shows: [...S.shows], made: S.made, laws: [...S.laws], samples: [...S.samples], ...(S.conceptual ? { conceptual: true } : {}) }; });
  const zoom = list.slice(1).map((id, i) => way(list[i], id));
  const home = SCALES[list[0]];
  return {
    home: list[0], rungs, spans: list.length > 1, zoom,
    says: list.length === 1
      ? `It lives at the ${home.name} scale: ${home.says}.`
      : `It spans ${list.length} scales, a room each: ${list.map((id) => SCALES[id].name).join(', then ')}. The visitor ${zoom.map((z) => (z.way === 'aside' ? 'steps aside' : `zooms ${z.way}`)).join(', then ')}.`,
  };
}

// (every shape a rung shows is one a tour's stop can take)
for (const [id, S] of Object.entries(SCALES)) for (const sh of S.shows) if (!TOUR_SHAPES.includes(sh)) throw new Error(`exhibit: scale '${id}' shows '${sh}', which no tour stop takes`);
