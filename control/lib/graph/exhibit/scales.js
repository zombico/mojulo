/**
 * THE SCALES — the first primitive of an exhibit: the size of the thing it shows. The base is the HUMAN point of view
 * (what a person could stand beside); below it the micro, the atomic and molecular, the subatomic; above it the macro,
 * the geo, the planetary, outer space. The two ends are conceptual: nobody has stood there, and the picture is a model.
 * An IDEA (a theorem, a method) has no scale and stands beside the ladder.
 *
 * The exhibit determines its scale: a concept lives at a rung, or spans several (a dam is macro, why its turbine turns
 * is human, why current flows is atomic), and each rung it needs is a ROOM. The agent reads the concept and names the
 * rungs; this says what each rung shows naturally, how a world at it is made new, and which samples in the halls are
 * like it.
 *
 *   SCALES            { <id>: { name, rung, says, shows, made, laws, samples, conceptual? } }, smallest first
 *     rung      its place on the ladder: 0 the human base, negative below, positive above; null for an idea
 *     shows     the ways a stop explains that come naturally there (tour.js TOUR_SHAPES)
 *     made      how a world at this scale is made new: the primitive, in words
 *     laws      the science worlds' law tables that can compose it (science-worlds: quantum | microscopic | classical |
 *               relativistic); none: it is composed, not simulated from a law table
 *     samples   exhibits in the halls that are LIKE it: read for their form, never offered as the thing to make
 *   SCALE_IDS         the ladder's rungs, smallest first, then `idea`
 *   readScales(v)     → [<id>] as named, the home rung first, none twice; throws, teaching
 *   scaleReport(ids)  → { home, rungs: [{ id, name, says, shows, made, laws, samples, conceptual? }], spans, zoom:
 *                     [{ from, to, way: 'in' | 'out' | 'aside', steps }], says }
 *     zoom      between each room and the next, the way the visitor goes: in (smaller), out (larger), or aside (to or
 *               from an idea), and how many rungs
 *
 * Pure data and pure functions.
 */
import { TOUR_SHAPES } from './tour.js';

const row = (o) => Object.freeze({ ...o, shows: Object.freeze(o.shows), laws: Object.freeze(o.laws), samples: Object.freeze(o.samples) });

export const SCALES = Object.freeze({
  subatomic: row({ name: 'subatomic', rung: -3, conceptual: true, says: 'inside the atom: a nucleus splitting, a particle in a well', shows: ['process'],
    made: 'a demo composed from the quantum law table; a nuclear event drawn as a model, said to be one', laws: ['quantum'], samples: ['science/fission', 'science/fusion', 'science/cascade', 'science/cherenkov'] }),
  atomic: row({ name: 'atomic and molecular', rung: -2, says: 'atoms and the molecules they make: what a thing is built of', shows: ['structure'],
    made: 'a structure built from its atoms and bonds; why a bond forms from the quantum table, molecules that move from the microscopic', laws: ['quantum', 'microscopic'], samples: ['science/atom', 'life/molecule', 'life/dna'] }),
  micro: row({ name: 'micro', rung: -1, says: 'cells and what happens in them: dividing, binding, diffusing', shows: ['process', 'structure'],
    made: 'a demo composed from the microscopic law table, or a cell\'s structure drawn', laws: ['microscopic'], samples: ['life/cellular', 'life/dna-process', 'life/energy-cycle'] }),
  human: row({ name: 'human', rung: 0, says: 'the base: what a person could stand beside. Simulations and experiments, a place walked', shows: ['quantity', 'process'],
    made: 'a demo composed from the classical law table, or a world composed and walked', laws: ['classical'], samples: ['science/mechanics', 'science/windmill', 'science/fluid', 'history/pompeii'] }),
  macro: row({ name: 'macro', rung: 1, says: 'the bigger view from above: a machine, a site, a landscape feature whole', shows: ['process', 'structure'],
    made: 'the world seen from further up: an aerial camera over it', laws: [], samples: ['earth/hydro', 'science/airplane', 'science/rocket', 'earth/waterfall'] }),
  geo: row({ name: 'geo', rung: 2, says: 'the land itself: terrain, water, weather over a region', shows: ['stratified', 'structure'],
    made: 'a geocube: terrain modelled', laws: [], samples: ['earth/ocean', 'earth/atmosphere', 'earth/beach'] }),
  planetary: row({ name: 'planetary', rung: 3, says: 'a planet whole, and what goes round it', shows: ['structure', 'process'],
    made: 'the planetary views: a body hung in its sky, an orbit', laws: [], samples: ['space/saturn', 'space/comet'] }),
  space: row({ name: 'outer space', rung: 4, conceptual: true, says: 'stars, galaxies and spacetime itself', shows: ['process', 'structure'],
    made: 'the space views; spacetime round a mass from the relativistic law table', laws: ['relativistic'], samples: ['space/star-surface', 'space/star-birth', 'space/pulsar', 'space/galaxy', 'space/gravity-wave'] }),
  idea: row({ name: 'an idea', rung: null, says: 'a theorem, a method, a relation: it has no size', shows: ['formal', 'quantity'],
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

const way = (a, b) => {
  const ra = SCALES[a].rung, rb = SCALES[b].rung;
  if (ra === null || rb === null) return { from: a, to: b, way: 'aside', steps: 0 };
  return { from: a, to: b, way: rb < ra ? 'in' : 'out', steps: Math.abs(rb - ra) };
};

export function scaleReport(ids) {
  const list = readScales(ids);
  const rungs = list.map((id) => { const S = SCALES[id]; return { id, name: S.name, says: S.says, shows: [...S.shows], made: S.made, laws: [...S.laws], samples: [...S.samples], ...(S.conceptual ? { conceptual: true } : {}) }; });
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
