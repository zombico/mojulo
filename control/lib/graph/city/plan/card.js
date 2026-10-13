/**
 * THE CITY CARD: what a city plan may say, and the reader that holds a recipe to it. A plan is laid on a BOARD of square
 * cells seen from above: columns A, B, C… across (x), rows 1, 2, 3… down (y), named as on a map ('C4'), a block of
 * cells by its corners ('C4:H9'), a stroke by the cells it passes ('A5>P5', 'A5>H5>H12'). The level ground's board
 * (level/ground.js) is the same idea at a smaller cell.
 *
 *   { kind: 'city', seed, grammar?, play?,
 *     board?:     { cell?, cols?, rows? },
 *     spine?:     [{ path: 'A5>P5', rank?: 'major' | 'minor', name? }],        // the main streets, laid first
 *     districts?: [{ at: 'C4:H9', use, grammar? }],                           // what a part of the city is for
 *     sites?:     [{ at: 'H5' | 'G4:H5', use, name?, height? }],              // reserved before anything grows
 *     transit?:   [{ path: 'A3>P3', mode?, name? }],
 *     lots?:      { '<lot id>': { use?, storeys? } },                         // a lot by hand, once the plan has cut it
 *     waive?:     ['<law>' | '<law>:<subject>'] }
 *
 * Anything off the card is refused by name; nothing here rolls a die.
 */
import { readCars } from './traffic.js';
import { readGreen } from './green.js';
import { readSeason } from './foliage.js';
import { readPeople } from './pedestrians.js';
import { LANDMARK_IDS, LANDMARK_ALIASES, SACRED, REF } from './landmarks.js';
import { parseCell, cellName } from '../../level/ground.js';
import { DEFAULT_GRAMMAR, PLAY_SCALES, PLAY_IDS } from './grammar.js';
import { resolveGrammar } from './grammars.js';
import { readFacade } from './facades.js';
import { readCityLook, readPaint } from './look.js';
import { readSegments } from './segments.js';
import { ENTER, readInside } from './doors.js';

export const CITY_KEYS = Object.freeze(['kind', 'seed', 'title', 'grammar', 'paint', 'play', 'board', 'spine', 'districts', 'sites', 'transit', 'lots', 'segments', 'level', 'cars', 'people', 'green', 'season', 'waive', 'fidelity', 'notes', 'cityRef', 'edifices']);
/** How the world draws it: every lot in its facade (the default), or the massing alone (a plan judged as a plan). */
export const FIDELITIES = Object.freeze(['facade', 'massing']);
/** The channels every world kind wears (world-scene.js reads them; the plan never does). */
export const WORLD_CHANNELS = Object.freeze(['audio', 'weather', 'fire', 'fog', 'clouds', 'walk', 'look']);
export const BOARD = Object.freeze({ cell: [20, 200], cols: [2, 26], rows: [2, 99], defaults: { real: { cols: 8, rows: 5 }, game: { cols: 10, rows: 6 } } });
export const RANKS = Object.freeze(['major', 'minor']);

/** What a district is for: how high it builds off the city's height field, what its ground floors hold, whether it is
 *  built at all. `k` reshapes the field's pull where the district stands. */
export const DISTRICT_USES = Object.freeze({
  core: { read: 'the downtown: the height field\'s top, towers, offices over shops', built: true, k: (k) => Math.max(k, 0.8), towers: true, uses: ['office', 'mixed'], shopfront: 0.7 },
  commercial: { read: 'shops and offices off the core: mid-rise, shopfronts on every street', built: true, k: (k) => k, towers: true, uses: ['mixed'], shopfront: 0.6 },
  residential: { read: 'homes: walk-ups and apartment blocks, the odd corner shop, no towers', built: true, k: (k) => k * 0.55, towers: false, uses: ['residential'], shopfront: 0.12 },
  industrial: { read: 'sheds and yards on wide lots, low, few doors on the street', built: true, k: () => 0, towers: false, uses: ['industrial'], shopfront: 0.02, low: true },
  civic: { read: 'a public district: halls, schools, a library on generous lots', built: true, k: (k) => Math.min(k, 0.35), towers: false, uses: ['civic'], shopfront: 0.2 },
  park: { read: 'a park: open ground, the streets go round it', built: false },
  water: { read: 'water: a harbour, a lake, a river\'s width; only the spine bridges it', built: false },
});
export const DISTRICT_IDS = Object.freeze(Object.keys(DISTRICT_USES));
export const SITE_USES = Object.freeze({
  plaza: { read: 'a paved square: a place to stop, a beat on every street that meets it' },
  park: { read: 'a small park, a green the block gives up' },
  landmark: { read: 'the city\'s mark: a tower or a monument on its own ground, a plaza ring round it' },
  civic: { read: 'a public building on its own ground: a hall, a station, a museum' },
});
export const SITE_IDS = Object.freeze(Object.keys(SITE_USES));
export const LOT_USES = Object.freeze(['office', 'mixed', 'residential', 'industrial', 'civic', 'parking']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`city: ${msg}`); };

/** A cell or a block of cells ('C4', 'C4:H9') → { c0, c1, r0, r1 } (columns 0-based, rows 1-based), held to the board. */
export function cellsOf(v, at, board) {
  if (typeof v !== 'string') no(`${at} is a cell ('C4') or a block of cells by its corners ('C4:H9')`);
  const parts = v.split(':');
  const p = parseCell(parts[0]), q = parts.length === 2 ? parseCell(parts[1]) : p;
  if (!p || !q || parts.length > 2) no(`${at} '${v}' is a cell ('C4') or a block of cells by its corners ('C4:H9')`);
  const out = { c0: Math.min(p.c, q.c), c1: Math.max(p.c, q.c), r0: Math.min(p.r, q.r), r1: Math.max(p.r, q.r) };
  if (board && (out.c1 >= board.cols || out.r1 > board.rows)) no(`${at} '${v}' is off the board (A1 to ${cellName(board.cols - 1, board.rows)})`);
  return out;
}
/** A stroke of cells ('A5>P5' or ['A5', 'P5']) → [{ c, r }, …], held to the board. */
export function pathOf(v, at, board) {
  const list = typeof v === 'string' ? v.split('>') : v;
  if (!Array.isArray(list) || list.length < 2) no(`${at} is two or more cells, 'A5>P5' or ['A5', 'H5', 'H12']`);
  return list.map((s) => {
    const p = parseCell(s);
    if (!p) no(`${at}: '${s}' is not a cell ('B3')`);
    if (board && (p.c >= board.cols || p.r > board.rows)) no(`${at}: '${s}' is off the board (A1 to ${cellName(board.cols - 1, board.rows)})`);
    return p;
  });
}

const whole = (v, [lo, hi]) => Number.isInteger(v) && v >= lo && v <= hi;

/** A city recipe against the card → the plan as the designer reads it: every default filled, every cell parsed. */
export function readCityPlan(rec) {
  if (!isObj(rec)) no('give a plan as { grammar?, play?, board?, spine?, districts?, sites?, transit?, lots?, waive? }');
  for (const k of Object.keys(rec)) if (!CITY_KEYS.includes(k) && !WORLD_CHANNELS.includes(k)) no(`'${k}' is not a city setting (${CITY_KEYS.filter((x) => x !== 'kind' && x !== 'notes').join(', ')})`);
  const grammar = rec.grammar ?? DEFAULT_GRAMMAR;
  const G = resolveGrammar(grammar);
  readCityLook(rec.look);
  readPaint(rec.paint);
  if (rec.cars !== undefined) readCars(rec.cars);
  if (rec.green !== undefined) readGreen(rec.green, null);
  if (rec.season !== undefined) readSeason(rec.season);
  if (rec.people !== undefined) readPeople(rec.people);
  const fidelity = rec.fidelity ?? 'facade';
  if (!FIDELITIES.includes(fidelity)) no(`fidelity is ${FIDELITIES.join(' or ')} (got ${JSON.stringify(rec.fidelity)})`);
  const play = rec.play ?? 'game';
  if (!PLAY_SCALES[play]) no(`play is ${PLAY_IDS.join(' or ')}: 'game' compresses what a walker covers, 'real' keeps real-world lengths (got ${JSON.stringify(rec.play)})`);
  const seed = rec.seed ?? 1;
  if (!Number.isInteger(seed)) no(`seed is a whole number (got ${JSON.stringify(rec.seed)})`);

  const b = rec.board ?? {};
  if (!isObj(b)) no('board is { cell?, cols?, rows? }');
  for (const k of Object.keys(b)) if (!['cell', 'cols', 'rows'].includes(k)) no(`board.${k} is not a board setting (cell, cols, rows)`);
  const D = BOARD.defaults[play];
  const board = { cell: b.cell ?? PLAY_SCALES[play].cell, cols: b.cols ?? D.cols, rows: b.rows ?? D.rows };
  if (typeof board.cell !== 'number' || board.cell < BOARD.cell[0] || board.cell > BOARD.cell[1]) no(`board.cell is metres a side, ${BOARD.cell[0]}–${BOARD.cell[1]}`);
  if (!whole(board.cols, BOARD.cols)) no(`board.cols is a whole number ${BOARD.cols[0]}–${BOARD.cols[1]} (columns A to Z)`);
  if (!whole(board.rows, BOARD.rows)) no(`board.rows is a whole number ${BOARD.rows[0]}–${BOARD.rows[1]}`);

  const list = (v, at) => { if (v === undefined) return []; if (!Array.isArray(v)) no(`${at} is a list`); return v; };
  const keys = (o, at, allowed) => { if (!isObj(o)) no(`${at} is { ${allowed.join(', ')} }`); for (const k of Object.keys(o)) if (!allowed.includes(k)) no(`${at}.${k} is not a setting (${allowed.join(', ')})`); };

  const spine = list(rec.spine, 'spine').map((s, i) => {
    const at = `spine[${i}]`;
    keys(s, at, ['path', 'rank', 'name']);
    const rank = s.rank ?? 'major';
    if (!RANKS.includes(rank)) no(`${at}.rank is ${RANKS.join(' or ')}`);
    return { path: pathOf(s.path, `${at}.path`, board), rank, ...(s.name ? { name: String(s.name) } : {}) };
  });
  const districts = list(rec.districts, 'districts').map((d, i) => {
    const at = `districts[${i}]`;
    keys(d, at, ['at', 'use', 'grammar', 'name']);
    if (!DISTRICT_USES[d.use]) no(`${at}.use is one of ${DISTRICT_IDS.join(', ')} (got ${JSON.stringify(d.use)})`);
    if (d.grammar !== undefined) no(`${at}.grammar: a district in its own grammar is not laid yet; the plan's grammar holds city-wide`);
    return { cells: cellsOf(d.at, `${at}.at`, board), use: d.use, ...(d.name ? { name: String(d.name) } : {}) };
  });
  const sites = list(rec.sites, 'sites').map((s, i) => {
    const at = `sites[${i}]`;
    keys(s, at, ['at', 'use', 'name', 'height', 'landmark', 'building', 'variant', 'from']);
    if (!SITE_USES[s.use]) no(`${at}.use is one of ${SITE_IDS.join(', ')} (got ${JSON.stringify(s.use)})`);
    if (s.height !== undefined && !(typeof s.height === 'number' && s.height >= 4 && s.height <= 900)) no(`${at}.height is metres, 4–900`);
    if (s.height !== undefined && s.use !== 'landmark' && s.use !== 'civic') no(`${at}.height: only a landmark or a civic building stands to a height`);
    // what stands on it (landmarks.js): a library landmark, a sacred or civic building, or an edifice of the operator's own
    if ([s.landmark, s.building, s.from].filter((v) => v !== undefined).length > 1) no(`${at}: a site stands one thing: a landmark, a building or an edifice (from)`);
    if (s.landmark !== undefined) {
      if (s.use !== 'landmark') no(`${at}.landmark stands on a landmark site (use: 'landmark')`);
      if (!LANDMARK_IDS.includes(s.landmark) && !LANDMARK_ALIASES[s.landmark]) no(`${at}.landmark is one of the library's: ${LANDMARK_IDS.join(', ')} (got ${JSON.stringify(s.landmark)}); a landmark of your own is an edifice: mint_solid({ kind: 'edifice' }), then from: '<its ref>'`);
      if (s.height !== undefined) no(`${at}.height: a library landmark stands at its real height`);
    }
    if (s.building !== undefined) {
      if (s.use !== 'civic') no(`${at}.building stands on a civic site (use: 'civic')`);
      if (!SACRED[s.building]) no(`${at}.building is one of ${Object.keys(SACRED).join(', ')} (got ${JSON.stringify(s.building)})`);
      if (s.variant !== undefined && !SACRED[s.building].variants.includes(s.variant)) no(`${at}.variant: a ${s.building} is ${SACRED[s.building].variants.join(', ')} (got ${JSON.stringify(s.variant)})`);
    } else if (s.variant !== undefined) no(`${at}.variant is a building's (give it building: ${Object.keys(SACRED).join(' | ')})`);
    if (s.from !== undefined) {
      if (s.use !== 'landmark' && s.use !== 'civic') no(`${at}.from stands an edifice on a landmark or civic site`);
      if (typeof s.from !== 'string' || !REF.test(s.from)) no(`${at}.from is an edifice's ref (mint one with mint_solid({ kind: 'edifice' }))`);
      if (s.height !== undefined) no(`${at}.height: an edifice stands at its own height`);
    }
    return { cells: cellsOf(s.at, `${at}.at`, board), use: s.use, ...(s.name ? { name: String(s.name) } : {}), ...(s.height !== undefined ? { height: s.height } : {}), ...Object.fromEntries(['landmark', 'building', 'variant', 'from'].filter((k) => s[k] !== undefined).map((k) => [k, s[k]])) };
  });
  const modes = G.transit.modes;
  const transit = list(rec.transit, 'transit').map((t, i) => {
    const at = `transit[${i}]`;
    keys(t, at, ['path', 'mode', 'name']);
    const mode = t.mode ?? modes[0];
    if (!modes.includes(mode)) no(`${at}.mode is one the grammar runs: ${modes.join(', ')} (got ${JSON.stringify(t.mode)})`);
    return { path: pathOf(t.path, `${at}.path`, board), mode, ...(t.name ? { name: String(t.name) } : {}) };
  });
  const lots = rec.lots ?? {};
  if (!isObj(lots)) no("lots is { '<lot id>': { use?, storeys?, facade? } } with ids the plan cut (read them off the book's Lots sheet)");
  for (const [id, o] of Object.entries(lots)) {
    keys(o, `lots['${id}']`, ['use', 'storeys', 'facade', 'enter', 'inside']);
    if (o.enter !== undefined && !ENTER.includes(o.enter)) no(`lots['${id}'].enter is 'walk' (its ground storey a lobby, part of the map) or 'door' (a door to a level of its own)`);
    if (o.inside !== undefined && o.enter !== 'door') no(`lots['${id}'].inside is the level behind a door: give it enter: 'door'`);
    readInside(o.inside, `lots['${id}'].inside`);
    if (o.facade !== undefined) readFacade(o.facade, `lots['${id}'].facade`);
    if (o.use !== undefined && !LOT_USES.includes(o.use)) no(`lots['${id}'].use is one of ${LOT_USES.join(', ')}`);
    if (o.storeys !== undefined && !whole(o.storeys, [1, 160])) no(`lots['${id}'].storeys is a whole number 1–160`);
  }
  const segments = readSegments(rec.segments, play);
  let level = null;
  if (rec.level !== undefined) {
    keys(rec.level, 'level', ['segment', 'refs', 'route', 'ways']);
    if (!segments) no('level: a city is played by its segments: give it segments: true (or { across })');
    if (typeof rec.level.segment !== 'string') no("level.segment is the segment this level plays ('r1c2': the book's Segments sheet names them)");
    if (rec.level.refs !== undefined && !(isObj(rec.level.refs) && Object.values(rec.level.refs).every((v) => typeof v === 'string'))) no("level.refs is { <segment id>: <its level's ref> }, for neighbours whose levels are not '<city ref>-<segment id>'");
    // a route (a line of levels): the segment it is entered from and the one it leads on to, or its end with none
    if (rec.level.route !== undefined) {
      const r = rec.level.route;
      if (!isObj(r) || Object.keys(r).some((k) => !['from', 'to'].includes(k)) || ['from', 'to'].some((k) => r[k] !== undefined && typeof r[k] !== 'string')) no("level.route is { from?, to? }: the segment it is entered from and the one it leads on to (none: it ends at its farthest crossing)");
    }
    // a map world's own ways out of the city: each an exit at the segment's start or at its farthest crossing
    if (rec.level.ways !== undefined) {
      const w = rec.level.ways;
      if (!Array.isArray(w) || !w.every((x) => isObj(x) && typeof x.id === 'string' && typeof x.to === 'string' && ['start', 'end'].includes(x.at) && Object.keys(x).every((k) => ['id', 'to', 'at', 'gate'].includes(k)))) no("level.ways is [{ id, to, at: 'start' | 'end', gate? }]: the world's ways out of the city, at the segment's start or its farthest crossing");
    }
    level = rec.level;
  }
  const waive = list(rec.waive, 'waive');
  if (!waive.every((w) => typeof w === 'string' && w.length)) no("waive is a list of '<law>' or '<law>:<subject>'");
  if (rec.city !== undefined) no(`city: a segment level reads its city by ref ('${rec.city}'); resolve it first (plan/ref.js withCityRef)`);
  return { seed, grammar, play, board, spine, districts, sites, transit, lots, waive, fidelity, ...(segments ? { segments } : {}), ...(level ? { level } : {}), ...(rec.look !== undefined ? { look: rec.look } : {}), ...(rec.paint !== undefined ? { paint: rec.paint } : {}), ...(rec.cars !== undefined ? { cars: rec.cars } : {}), ...(rec.green !== undefined ? { green: rec.green } : {}), ...(rec.season !== undefined ? { season: rec.season } : {}), ...(rec.people !== undefined ? { people: rec.people } : {}), ...(rec.edifices !== undefined ? { edifices: rec.edifices } : {}) };
}

/**
 * The laws that fill what a recipe left out, at mint and never at render: each fills one field and says why. A filled
 * field is written into the recipe and recorded in `notes.inferred`, so the row says what the plan was given and what
 * it was handed.
 */
export function inferCity(rec) {
  const out = { ...rec }, inferred = [];
  const plan = readCityPlan(rec);
  const { cols, rows } = plan.board;
  if (rec.play === undefined) { out.play = plan.play; inferred.push({ field: 'play', value: plan.play, reason: 'a city made to be walked: game scale compresses the ground a walker covers' }); }
  if (rec.board === undefined) { out.board = { ...plan.board }; inferred.push({ field: 'board', value: out.board, reason: `a downtown on a ${cols} × ${rows} board of ${plan.board.cell} m cells` }); }
  if (rec.spine === undefined) {
    // the row and the column nearest the middle that no site stands on: the mint never lays a spine through reserved ground
    const near = (mid, n, free) => [...Array(n).keys()].map((i) => i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b).find(free) ?? mid;
    const midR = 1 + near(Math.ceil(rows / 2) - 1, rows, (i) => !plan.sites.some((st) => i + 1 >= st.cells.r0 && i + 1 <= st.cells.r1));
    const midC = near(Math.floor((cols - 1) / 2), cols, (i) => !plan.sites.some((st) => i >= st.cells.c0 && i <= st.cells.c1));
    out.spine = [{ path: `${cellName(0, midR)}>${cellName(cols - 1, midR)}` }, { path: `${cellName(midC, 1)}>${cellName(midC, rows)}` }];
    inferred.push({ field: 'spine', value: out.spine, reason: 'two main streets crossing at the middle (clear of every site): the city grows off its crossing' });
  }
  return { recipe: out, inferred };
}
