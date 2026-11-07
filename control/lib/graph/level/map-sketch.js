/**
 * THE MAP SKETCH — a planned map (plan.js) decided in miniature before it is built: the level's CONCEPT (its pitch and its
 * journey, beat by beat, each on a segment) and, a segment at a time, its SKETCH: what the ground is tile by tile (wood,
 * rocks, a cliff, water…), how high each tile stands, and what is MARKED on it (an encounter, loot, a landmark, a secret).
 * Each segment is planned on its own from its brief (segmentBriefs: the subtask), drawn at once in the miniature
 * (worldmap-view.js, worldmap-model.js) and approved by the creator; only then is it built. Not an RPG's: any action
 * quest's map.
 *
 *   sketch: {
 *     concept?: { pitch?, hold?, journey: [{ id, say, kind, at: '<segment>', teach?, faces? }] },
 *     segments?: { <S>: { status?: 'draft' | 'approved', ground?: [rows], height?: [rows], marks?: [mark], notes? } },
 *   }
 *   ground   a glyph a tile (SKETCH_GROUND): f forest, g grove, m meadow, r rocks, c cliff, w water, s scrub; '.' its
 *            region's own
 *   height   a digit a tile, 0-9: its height in steps of SKETCH.step metres over its region's rise
 *   mark     { at: [row, col] in its segment, kind (SKETCH_MARKS), say, foes?: { kind?, count? }, item? }
 *   teach    a beat's verbs (TEACH): the controls the hero learns there, shown by the guide while it is the way on
 *   faces    the arrival's: the id of the beat its page sets out facing (the first look: the place the level is about)
 *   hold     true: a page's ways out are held while its fights stand (leaving is graduation: gameworld/levels.js)
 *
 *   readSketch(sketch, P, at?)       → the sketch read (P: readPlan's or readGrid's `plan` readout); throws, teaching
 *   sketchRise(G, S)                 → the grid's rise with each sketched tile's height over its region's (G: readGrid's)
 *   sketchLaws(G, S)                 → [{ law, ok, value }]: it advises, never refuses
 *   segmentBriefs(G, S, { level? })  → { <segment>: brief }: each segment's subtask, what its planner is given
 *   sketchStatus(S, P)               → { <segment>: 'approved' | 'draft' | 'unplanned' }
 *   beatTile(G, S, beat)             → [row, col] where a beat stands on the map: its mark (BEAT_PLACE), a climax at the
 *                                      goal's place, else its segment's middle
 *   levelGrid(level, at?)            → readGrid's read of the level's grid with its APPROVED segments' sketch lowered
 *                                      (THE GEOCUBE of a segment): their heights in its rise, `sketch` the rest of what
 *                                      the build reads ({ approved, ground: Map('r,c' → glyph), marks, laid, unlaid });
 *                                      a level with no approved segment, readGrid's read as it was
 *
 * LOWERED (only an approved segment's): height → the tile's rise in the level's one land; ground f g m s → the kit's own
 * flora (SKETCH_BIOCUBE: forest, grove, meadow, upland); r → boulders on a path tile (SKETCH_BOULDERS); c and w → none
 * yet (no tile builder lays a cliff or water: `unlaid` names them); marks → a marker on the page, told on hover.
 * Pure.
 */
import { gateTile } from './plan.js';
import { readGrid, mapStart } from './grid.js';
import { paceOf, paceLaws } from './pace.js';

const readGridOf = (level, at) => readGrid(level.grid, at);

export const SKETCH = Object.freeze({ step: 3, steps: 9 });
export const SKETCH_GROUND = Object.freeze({
  f: 'forest: a dense wood, the way through it a corridor',
  g: 'grove: trees spaced, sight lines between them',
  m: 'meadow: open grass, long sight',
  r: 'rocks: boulders and outcrops, cover',
  c: 'cliff: a sheer rise, a wall the walk goes round or up',
  w: 'water: a pond or a stream, not walked',
  s: 'scrub: low brush and bare ground',
});
export const SKETCH_MARKS = Object.freeze({
  encounter: 'a fight: who, how many',
  loot: 'something to find: what',
  landmark: 'a thing seen from afar that the walk steers by',
  secret: 'something off the way, for those who look',
  rest: 'a safe place: a camp, a well, a save',
  hazard: 'a danger that is not a foe: a fall, a trap, a current',
  npc: 'someone met',
});
export const JOURNEY_KINDS = Object.freeze(['arrival', 'traverse', 'encounter', 'find', 'vista', 'secret', 'rest', 'meet', 'climb', 'puzzle', 'climax']);
const STATUS = ['draft', 'approved'];
// THE VERBS A BEAT TEACHES (`teach`), each the keys the guide shows while that beat is the way on: a control taught where
// it is first needed, never a list up front (the controls themselves are the hero's: gameworld/levels.js)
export const TEACH = Object.freeze({
  look: { keys: 'mouse  look around', say: 'looking round' },
  strike: { keys: 'click  strike', say: 'the blow' },
  sprint: { keys: 'F  sprint · the green bar is your stamina', say: 'the sprint' },
  dodge: { keys: 'F F  dodge', say: 'the dodge' },
  lock: { keys: 'C  lock on to a foe', say: 'the lock-on' },
  jump: { keys: 'Space  jump', say: 'the jump' },
});
// (the mark each kind of beat stands at, by preference: the guide's place for it and the first look's)
export const BEAT_PLACE = Object.freeze({ meet: ['npc'], encounter: ['encounter'], climax: ['encounter'], find: ['loot', 'secret'], secret: ['secret', 'loot'], rest: ['rest'], vista: ['landmark'], puzzle: ['hazard', 'landmark'], climb: ['hazard', 'landmark'] });
// (what a sketched ground is built as: the kit's own flora presets, era/biocube.js)
export const SKETCH_BIOCUBE = Object.freeze({ f: 'forest', g: 'grove', m: 'meadow', s: 'upland' });
export const SKETCH_BOULDERS = 8;
// (the marks a beat's kind needs; a kind not named here needs some mark)
const BEAT_MARKS = Object.freeze({ encounter: ['encounter'], climax: ['encounter'], find: ['loot', 'secret'], secret: ['secret'], rest: ['rest'] });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const strip = (r) => (typeof r === 'string' ? r.replace(/\s+/g, '') : '');
const fail = (m) => new Error(`level: ${m}`);

// THE SCENARIO (`scenario`, in place of a concept): the level beat by beat, each beat whole in one place: where it stands
// (its segment, and its tile there), what it is, its one line, its foes or its find, what it teaches, how it feels (its
// `pace`) and whether winning it opens the page's ways out (`opens`). Read into the concept (the journey) and a mark per
// beat on its tile (its `beat` the id), so what reads a concept and its marks reads it unchanged, and nothing pairs a
// beat with a mark by its kind or its order.
export const SCENARIO_KINDS = Object.freeze(['arrival', 'vista', 'meet', 'fight', 'traverse', 'find', 'rest', 'secret', 'climb', 'climax']);
export const PACES = Object.freeze(['calm', 'tension', 'peak', 'rest']);
const BEAT_JOURNEY = Object.freeze({ fight: 'encounter' });
const BEAT_MARK = Object.freeze({ arrival: 'landmark', vista: 'landmark', meet: 'npc', fight: 'encounter', traverse: 'landmark', find: 'loot', rest: 'rest', secret: 'secret', climb: 'hazard', climax: 'encounter' });
function readScenario(sc, segs, n, segments, at) {
  if (!isObj(sc)) throw fail(`${at} is { pitch?, beats }: the level beat by beat`);
  for (const k of Object.keys(sc)) if (!['pitch', 'beats'].includes(k)) throw fail(`${at}.${k} is not a scenario's word (pitch, beats)`);
  if (sc.pitch !== undefined && typeof sc.pitch !== 'string') throw fail(`${at}.pitch is the level in a sentence`);
  if (!Array.isArray(sc.beats) || !sc.beats.length) throw fail(`${at}.beats is the level's beats in order: [{ id, at, tile?, kind, say, foes?, item?, teach?, faces?, pace?, opens? }]`);
  const KEYS = ['id', 'at', 'tile', 'kind', 'say', 'foes', 'item', 'teach', 'faces', 'pace', 'opens'];
  sc.beats.forEach((b, i) => {
    const w = `${at}.beats[${i}]`;
    if (!isObj(b)) throw fail(`${w} is { id, at, tile?, kind, say, … }`);
    for (const k of Object.keys(b)) if (!KEYS.includes(k)) throw fail(`${w}.${k} is not a beat's word (${KEYS.join(', ')})`);
    if (!SCENARIO_KINDS.includes(b.kind)) throw fail(`${w}.kind is ${SCENARIO_KINDS.join(', ')}`);
    if (b.tile !== undefined && !(Array.isArray(b.tile) && b.tile.length === 2 && b.tile.every((t) => Number.isInteger(t) && t >= 0 && t < n))) throw fail(`${w}.tile is [row, col], a tile of its segment (0 to ${n - 1})`);
    if (b.foes !== undefined && !(isObj(b.foes) && Object.keys(b.foes).length && Object.values(b.foes).every((c) => Number.isInteger(c) && c >= 1 && c <= 12))) throw fail(`${w}.foes is { <bestiary id>: how many } (1 to 12 each)`);
    if (b.foes !== undefined && b.kind !== 'fight' && b.kind !== 'climax') throw fail(`${w}.foes: only a fight or the climax stands foes (its kind is ${b.kind})`);
    if (b.kind === 'fight' && b.foes === undefined) throw fail(`${w} is a fight: its foes, { <bestiary id>: how many }`);
    if (b.item !== undefined && (typeof b.item !== 'string' || !['find', 'secret'].includes(b.kind))) throw fail(`${w}.item is a find's (or a secret's): what is picked up, in words`);
    if (b.pace !== undefined && !PACES.includes(b.pace)) throw fail(`${w}.pace is ${PACES.join(', ')}: how the beat feels`);
    if (b.opens !== undefined && (b.opens !== true || !b.foes)) throw fail(`${w}.opens is true on a beat with foes: winning it opens its page's ways out`);
    if ((b.foes || b.item || ['meet', 'find', 'rest', 'secret'].includes(b.kind)) && !b.tile) throw fail(`${w}.tile: a ${b.kind} stands on a tile of its segment ([row, col])`);
  });
  // (the journey: its checks are the concept's, read by the concept's reader)
  const journey = sc.beats.map((b) => ({ id: b.id, say: b.say, kind: BEAT_JOURNEY[b.kind] ?? b.kind, at: b.at, ...(b.teach !== undefined ? { teach: b.teach } : {}), ...(b.faces !== undefined ? { faces: b.faces } : {}) }));
  const { concept } = readSketch({ concept: { ...(sc.pitch !== undefined ? { pitch: sc.pitch } : {}), ...(sc.beats.some((b) => b.opens) ? { hold: true } : {}), journey } }, { at: Object.fromEntries(segs.map((x) => [x, true])), size: n }, at);
  concept.journey.forEach((j, i) => { const b = sc.beats[i]; j.pace = b.pace ?? 'calm'; if (b.opens) j.opens = true; if (b.tile) j.tile = [...b.tile]; });
  // (a mark a beat on its tile, one a foe kind for a fight of several kinds)
  const out = { ...segments };
  for (const b of sc.beats) {
    if (!b.tile) continue;
    const S = b.at, base = { at: [...b.tile], kind: b.foes ? 'encounter' : BEAT_MARK[b.kind], say: b.say, beat: b.id, ...(b.item ? { item: b.item } : {}) };
    const marks = b.foes ? Object.entries(b.foes).map(([kind, count]) => ({ ...base, foes: { kind, count } })) : [base];
    out[S] = out[S] ? { ...out[S], marks: [...out[S].marks, ...marks] } : { status: 'draft', ground: null, height: null, marks, notes: null };
  }
  return { concept, segments: out, scenario: { pitch: sc.pitch ?? null, beats: concept.journey } };
}

/** The sketch read against its plan. */
export function readSketch(sketch, P, at = 'level.sketch') {
  if (sketch === undefined) return null;
  if (!isObj(sketch)) throw fail(`${at} is { scenario? | concept?, segments? }: the level decided in miniature before it is built`);
  for (const k of Object.keys(sketch)) if (!['scenario', 'concept', 'segments'].includes(k)) throw fail(`${at}.${k} is not a sketch's word (scenario, concept, segments)`);
  if (sketch.scenario !== undefined && sketch.concept !== undefined) throw fail(`${at} is written as a scenario or as a concept, not both (the scenario says the concept and its marks)`);
  if (!P) throw fail(`${at} sketches a planned map (level.grid.plan): its segments are what is sketched`);
  const segs = Object.keys(P.segments ?? P.at), n = P.size;
  const out = { concept: null, segments: {} };
  if (sketch.concept !== undefined) {
    const C = sketch.concept;
    if (!isObj(C)) throw fail(`${at}.concept is { pitch?, journey }: the level's flow, beat by beat`);
    if (C.pitch !== undefined && typeof C.pitch !== 'string') throw fail(`${at}.concept.pitch is the level in a sentence`);
    for (const k of Object.keys(C)) if (!['pitch', 'journey', 'hold'].includes(k)) throw fail(`${at}.concept.${k} is not a concept's word (pitch, journey, hold)`);
    if (C.hold !== undefined && C.hold !== true) throw fail(`${at}.concept.hold is true (a page's ways out held while its fights stand), or left out`);
    if (!Array.isArray(C.journey) || !C.journey.length) throw fail(`${at}.concept.journey is the beats of the way, in order: [{ id, say, kind, at }]`);
    const ids = new Set();
    C.journey.forEach((b, i) => {
      const w = `${at}.concept.journey[${i}]`;
      if (!isObj(b) || typeof b.id !== 'string' || typeof b.say !== 'string') throw fail(`${w} is { id, say, kind, at }: a beat, what happens in it, its kind and its segment`);
      if (ids.has(b.id)) throw fail(`${w}.id '${b.id}' is another beat's`);
      ids.add(b.id);
      if (!JOURNEY_KINDS.includes(b.kind)) throw fail(`${w}.kind is ${JOURNEY_KINDS.join(', ')}`);
      if (!segs.includes(b.at)) throw fail(`${w}.at is a segment of the plan (${segs.join(', ')})`);
      const teach = b.teach === undefined ? [] : Array.isArray(b.teach) ? b.teach : [b.teach];
      for (const v of teach) if (!TEACH[v]) throw fail(`${w}.teach is a verb the hero learns here (${Object.keys(TEACH).join(', ')}), or a list of them`);
      if (b.faces !== undefined && ((b.kind !== 'arrival' && i > 0) || typeof b.faces !== 'string')) throw fail(`${w}.faces is an arrival's (or the first beat's): the id of the beat its page sets out facing`);
    });
    for (const [i, b] of C.journey.entries()) if (b.faces !== undefined && !C.journey.some((x) => x.id === b.faces && x !== b)) throw fail(`${at}.concept.journey[${i}].faces '${b.faces}' is no other beat of the journey`);
    out.concept = { pitch: C.pitch ?? null, ...(C.hold ? { hold: true } : {}), journey: C.journey.map((b) => ({ id: b.id, say: b.say, kind: b.kind, at: b.at, ...(b.teach !== undefined ? { teach: Array.isArray(b.teach) ? [...b.teach] : [b.teach] } : {}), ...(b.faces !== undefined ? { faces: b.faces } : {}) })) };
  }
  if (sketch.segments !== undefined) {
    if (!isObj(sketch.segments)) throw fail(`${at}.segments is { <segment>: { status?, ground?, height?, marks?, notes? } }`);
    for (const [S, v] of Object.entries(sketch.segments)) {
      const w = `${at}.segments.${S}`;
      if (!segs.includes(S)) throw fail(`${w}: no such segment in the plan (${segs.join(', ')})`);
      if (!isObj(v)) throw fail(`${w} is { status?, ground?, height?, marks?, notes? }`);
      for (const k of Object.keys(v)) if (!['status', 'ground', 'height', 'marks', 'notes'].includes(k)) throw fail(`${w}.${k} is not a segment sketch's word (status, ground, height, marks, notes)`);
      if (v.status !== undefined && !STATUS.includes(v.status)) throw fail(`${w}.status is ${STATUS.join(' or ')}`);
      const layer = (name, ok, says) => {
        if (v[name] === undefined) return null;
        const rows = Array.isArray(v[name]) ? v[name].map(strip) : null;
        if (!rows || rows.length !== n || rows.some((r) => r.length !== n)) throw fail(`${w}.${name} is ${n} rows of ${n} glyphs (the plan's segment size)`);
        rows.forEach((r, ri) => [...r].forEach((g, ci) => { if (!ok(g)) throw fail(`${w}.${name}[${ri}] column ${ci + 1}: '${g}' is not ${says}`); }));
        return rows;
      };
      const ground = layer('ground', (g) => g === '.' || Object.hasOwn(SKETCH_GROUND, g), `a ground (${Object.keys(SKETCH_GROUND).join(', ')}, or '.' the region's own)`);
      const height = layer('height', (g) => /^[0-9]$/.test(g), 'a height, a digit 0 to 9 (steps over the region\'s rise)');
      const marks = v.marks === undefined ? [] : v.marks;
      if (!Array.isArray(marks)) throw fail(`${w}.marks is [{ at: [row, col], kind, say, foes?, item? }]`);
      marks.forEach((m, i) => {
        const wm = `${w}.marks[${i}]`;
        if (!isObj(m) || !Array.isArray(m.at) || m.at.length !== 2 || !m.at.every((t) => Number.isInteger(t) && t >= 0 && t < n)) throw fail(`${wm}.at is [row, col], a tile of the segment (0 to ${n - 1})`);
        if (!Object.hasOwn(SKETCH_MARKS, m.kind)) throw fail(`${wm}.kind is ${Object.keys(SKETCH_MARKS).join(', ')}`);
        if (typeof m.say !== 'string') throw fail(`${wm}.say is what it is, in words`);
      });
      out.segments[S] = { status: v.status ?? 'draft', ground, height, marks: marks.map((m) => ({ ...m, at: [...m.at] })), notes: v.notes ?? null };
    }
  }
  if (sketch.scenario !== undefined) Object.assign(out, readScenario(sketch.scenario, segs, n, out.segments, `${at}.scenario`));
  return out;
}

/** The grid's rise with the sketch's heights: each sketched tile its region's rise and its steps over it. */
export function sketchRise(G, S) {
  if (!S || !G.plan) return G.rise ?? null;
  const base = G.rise ?? { tile: G.tile, cols: G.cols, rows: G.rows, z: G.cells.map(() => 0) };
  const z = [...base.z];
  for (const [seg, v] of Object.entries(S.segments)) {
    if (!v.height) continue;
    const [r0, c0] = G.plan.segments[seg].at;
    v.height.forEach((row, r) => [...row].forEach((d, c) => { z[(r0 + r) * G.cols + c0 + c] += Number(d) * SKETCH.step; }));
  }
  return { ...base, z };
}

const sideName = { n: 'north', e: 'east', s: 'south', w: 'west' };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

/** What the sketch says, as laws: they advise. */
export function sketchLaws(G, S) {
  const P = G.plan, laws = [];
  if (!S) return laws;
  const n = P.size, rise = sketchRise(G, S), zAt = (r, c) => rise?.z[r * G.cols + c] ?? 0;
  // THE JOURNEY: every segment on the walk has a beat; the beats follow the walk
  if (S.concept) {
    const bare = P.route.filter((seg) => !S.concept.journey.some((b) => b.at === seg));
    laws.push({ law: 'journey-covers', ok: !bare.length, value: bare.length ? `no beat in ${bare.join(', ')} (a segment on the walk with nothing happening)` : `${S.concept.journey.length} beats over the ${P.route.length} segments of the walk` });
    const order = S.concept.journey.map((b) => P.route.indexOf(b.at)).filter((i) => i >= 0);
    const back = order.findIndex((v, i) => i && v < order[i - 1]);
    laws.push({ law: 'journey-follows', ok: back < 0, value: back < 0 ? 'the beats follow the walk' : `beat ${back + 1} goes back along the walk (a return is a beat of its own kind, or a join)` });
  }
  // THE BEATS MARKED: each sketched segment marks what its beats need (a fight its encounter, a find its loot or secret,
  // a secret its secret; any other beat some mark to stage it on)
  if (S.concept) {
    const bare = [];
    for (const [seg, v] of Object.entries(S.segments)) {
      const beats = S.concept.journey.filter((b) => b.at === seg);
      for (const b of beats) {
        const want = BEAT_MARKS[b.kind], has = want ? v.marks.some((m) => want.includes(m.kind)) : v.marks.length > 0;
        if (!has) bare.push(`${seg}: '${b.say}' (${b.kind}) ${want ? `wants ${want.length > 1 ? 'a ' + want.join(' or a ') : 'an ' + want[0]} mark` : 'has no mark to stage it on'}`);
      }
    }
    const sketched = Object.keys(S.segments).length;
    if (sketched) laws.push({ law: 'beats-marked', ok: !bare.length, value: bare.length ? bare.join('; ') : `every beat of the ${sketched} sketched segment${sketched === 1 ? '' : 's'} staged on a mark` });
  }
  // THE CLIMB: no path steps more than one sketch step between neighbouring tiles
  let steep = null;
  for (const x of G.cells) for (const s of x.open ?? []) {
    if (s !== 'e' && s !== 's') continue;
    const r2 = x.r + (s === 's' ? 1 : 0), c2 = x.c + (s === 'e' ? 1 : 0), d = Math.abs(zAt(x.r, x.c) - zAt(r2, c2));
    if (d > SKETCH.step + 0.01 && (!steep || d > steep.d)) steep = { d, at: `row ${x.r + 1} column ${x.c + 1} to row ${r2 + 1} column ${c2 + 1}` };
  }
  laws.push({ law: 'climb', ok: !steep, value: steep ? `a path climbs ${steep.d} m between neighbouring tiles at ${steep.at} (one step, ${SKETCH.step} m, at most: a stair or a ramp is a step at a time)` : 'every path climbs a step at a time at most' });
  // THE SEAMS: at each gate both sides stand within a step
  const seams = P.gates.filter((g) => Math.abs(zAt(...g.tiles[0]) - zAt(...g.tiles[1])) > SKETCH.step + 0.01).map((g) => `${g.from}–${g.to}`);
  laws.push({ law: 'gate-heights', ok: !seams.length, value: seams.length ? `the two sides of a gate stand more than a step apart: ${seams.join(', ')}` : 'every gate\'s two sides within a step' });
  // GROUND THE WALK CANNOT TAKE: no path on water or a cliff
  const blocked = [];
  for (const [seg, v] of Object.entries(S.segments)) {
    if (!v.ground) continue;
    const [r0, c0] = P.segments[seg].at;
    v.ground.forEach((row, r) => [...row].forEach((g, c) => { const x = G.at(r0 + r, c0 + c); if ((g === 'w' || g === 'c') && x?.kind === 'path') blocked.push(`${seg} row ${r + 1} column ${c + 1}`); }));
  }
  laws.push({ law: 'ground-walkable', ok: !blocked.length, value: blocked.length ? `a path runs on water or a cliff: ${blocked.join(', ')}` : 'no path on water or a cliff' });
  if (S.concept) laws.push(...firstZoneLaws(G, S, rise));
  // (a scenario's pace, pace.js: dead air, its shape, each segment's interest)
  if (S.scenario) laws.push(...paceLaws(paceOf(G, S, beatTile)));
  return laws;
}

/** Where a beat stands on the map, [row, col] (a tile's, or a segment's middle): a climax at the goal's place in its
 * segment, else its kind's mark there (BEAT_PLACE), else its segment's middle. */
export function beatTile(G, S, b) {
  const P = G.plan, n = P.size, [r0, c0] = P.segments[b.at].at, marks = S?.segments[b.at]?.marks ?? [];
  if (b.tile) return [r0 + b.tile[0], c0 + b.tile[1]];
  if (b.kind === 'climax') { const x = G.cells.find((y) => y.kind === 'place' && y.place?.goal && y.r >= r0 && y.r < r0 + n && y.c >= c0 && y.c < c0 + n); if (x) return [x.r, x.c]; }
  for (const k of BEAT_PLACE[b.kind] ?? []) { const m = marks.find((x) => x.kind === k); if (m) return [r0 + m.at[0], c0 + m.at[1]]; }
  return [r0 + (n - 1) / 2, c0 + (n - 1) / 2];
}

// how high a place stands that the first look looks for (a keep's gate, a tower: the top of what is seen), and the eye
export const LOOK = Object.freeze({ eye: 1.7, place: 6 });

/** A FIRST ZONE'S LAWS (a journey that teaches, or whose arrival faces a beat): what a fight asks is taught before it,
 * the first fight one foe, and the place the arrival faces seen from the start over the land as planned. */
function firstZoneLaws(G, S, rise) {
  const J = S.concept?.journey ?? [], laws = [], fights = (b) => b.kind === 'encounter' || b.kind === 'climax';
  // (a fight's foes: the encounter mark its segment holds for it, the segment's fights and its marks taken in order)
  const countOf = (b) => {
    // (a scenario's beat: its own marks, its foes counted)
    const own = (S.segments[b.at]?.marks ?? []).filter((m) => m.beat === b.id && m.foes);
    if (own.length) return own.reduce((t, m) => t + (m.foes.count ?? 1), 0);
    if (S.scenario) return null;
    const mine = J.filter((x) => fights(x) && x.at === b.at), marks = (S.segments[b.at]?.marks ?? []).filter((m) => m.kind === 'encounter');
    const m = marks[mine.indexOf(b)] ?? marks[0];
    return m ? m.foes?.count ?? 1 : null;
  };
  if (J.some((b) => b.teach?.length)) {
    const taught = new Set(), short = [];
    for (const b of J) {
      for (const v of b.teach ?? []) taught.add(v);
      if (!fights(b)) continue;
      const n = countOf(b) ?? 1, want = ['strike', ...(n >= 2 ? ['lock'] : [])].filter((v) => !taught.has(v));
      if (want.length) short.push(`'${b.say}' (${n} foe${n === 1 ? '' : 's'}) comes before ${want.map((v) => TEACH[v].say).join(' and ')} is taught`);
    }
    laws.push({ law: 'teaches-before-tests', ok: !short.length, value: short.length ? short.join('; ') : `every fight comes after what it asks is taught (${[...taught].join(', ')})` });
    const first = J.find((b) => fights(b) && countOf(b) != null);
    if (first) { const n = countOf(first); laws.push({ law: 'foes-ramp', ok: n <= 1, value: n <= 1 ? `the first fight, '${first.say}', is one foe: the pack comes after` : `the first fight, '${first.say}', is ${n} foes: one first, alone, then the pack` }); }
  }
  const arr = J.find((b) => b.faces);
  if (arr) {
    const tgt = J.find((b) => b.id === arr.faces), st = mapStart(G), zAt = (r, c) => rise?.z[r * G.cols + c] ?? 0;
    if (tgt && st) {
      const [tr, tc] = beatTile(G, S, tgt), a = [st.r + 0.5, st.c + 0.5, zAt(st.r, st.c) + LOOK.eye];
      const b = [tr + 0.5, tc + 0.5, zAt(Math.round(tr), Math.round(tc)) + LOOK.place], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let hid = null;
      for (let k = 1, N = Math.max(2, Math.ceil(L * 8)); k < N; k++) {
        const t = k / N, r = Math.floor(a[0] + (b[0] - a[0]) * t), c = Math.floor(a[1] + (b[1] - a[1]) * t);
        if ((r === st.r && c === st.c) || (r === Math.floor(b[0]) && c === Math.floor(b[1]))) continue;
        const over = zAt(r, c) - (a[2] + (b[2] - a[2]) * t);
        if (over > 0 && (!hid || over > hid.over)) hid = { r, c, over };
      }
      laws.push({ law: 'first-look', ok: !hid, value: hid ? `'${tgt.say}' is hidden from the start behind row ${hid.r + 1} column ${hid.c + 1} (${Math.round(hid.over * 10) / 10} m over the sight line): the first look sees no goal` : `the start sets out facing '${tgt.say}', seen over the land as planned` });
    }
  }
  return laws;
}

/** Each segment's status: approved, a draft, or not yet planned. */
export function sketchStatus(S, P) {
  return Object.fromEntries(Object.keys(P.segments ?? P.at).map((seg) => [seg, S?.segments[seg]?.status ?? 'unplanned']));
}

/** Each segment's subtask: what its planner is given and what it writes back. */
export function segmentBriefs(G, S, { title = null } = {}) {
  const P = G.plan, n = P.size, rise = sketchRise(G, S), out = {};
  for (const seg of Object.keys(P.segments)) {
    const [r0, c0] = P.segments[seg].at, own = S?.segments[seg] ?? null;
    const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => G.at(r0 + r, c0 + c).glyph).join(' '));
    const gates = P.gates.filter((g) => g.from === seg || g.to === seg).map((g) => {
      const mine = g.from === seg, side = mine ? g.side : OPP[g.side], to = mine ? g.to : g.from, [tr, tc] = gateTile(n, side), across = mine ? g.tiles[1] : g.tiles[0];
      // (the neighbour's ground there, in metres over the level's land: its region's rise and its sketched steps)
      const theirs = rise ? rise.z[across[0] * G.cols + across[1]] : 0;
      return { side: sideName[side], to, toName: G.regions?.[to]?.name ?? to, tile: [tr, tc], neighbourHeight: theirs, neighbourSketched: !!S?.segments[to]?.height, ...(g.join ? { join: true } : {}) };
    });
    out[seg] = {
      task: `Plan ${G.regions?.[seg]?.name ?? seg} (${seg}) in miniature: its ground, its heights and its marks`,
      map: title, segment: seg, name: G.regions?.[seg]?.name ?? seg, role: P.roles[seg], size: n, tile: G.tile,
      pitch: S?.concept?.pitch ?? null,
      beats: (S?.concept?.journey ?? []).filter((b) => b.at === seg),
      before: (() => { const i = P.route.indexOf(seg); return i > 0 ? P.route[i - 1] : null; })(), after: (() => { const i = P.route.indexOf(seg); return i >= 0 && i + 1 < P.route.length ? P.route[i + 1] : null; })(),
      rows, gates,
      riseBase: G.regions?.[seg]?.rise ?? 0, step: SKETCH.step,
      decide: {
        ground: `${n} rows of ${n}: ${Object.entries(SKETCH_GROUND).map(([g, s]) => `${g} ${s.split(':')[0]}`).join(', ')}, '.' the region's own`,
        height: `${n} rows of ${n} digits 0-9, steps of ${SKETCH.step} m over the region's rise`,
        marks: `[{ at: [row, col], kind, say, foes?, item? }], kind ${Object.keys(SKETCH_MARKS).join(', ')}`,
      },
      laws: ['a path climbs one step at a time at most', 'at each gate stand within a step of the neighbour (its height given where it is sketched)', 'no path on water (w) or a cliff (c)', 'every beat here is placed: an encounter, a find, a landmark as a mark'],
      current: own ? { status: own.status, ground: own.ground, height: own.height, marks: own.marks } : null,
      writes: `level.sketch.segments.${seg}: { ground, height, marks, notes? } (status stays draft until the creator approves)`,
    };
  }
  return out;
}

/** A brief as words, for a person or an agent. */
export function briefText(B) {
  return [
    `# ${B.task}`, '',
    B.pitch ? `The level: ${B.pitch}` : null,
    `Role: ${B.role}${B.before ? `; the walk comes in from ${B.before}` : ''}${B.after ? ` and goes on to ${B.after}` : ''}. ${B.size} × ${B.size} tiles of ${B.tile} m; its land stands ${B.riseBase} m up, and a height step is ${B.step} m over that.`,
    '', '## What happens here', ...(B.beats.length ? B.beats.map((b) => `- ${b.say} (${b.kind})`) : ['- nothing yet: the journey places no beat here']),
    '', '## Its paths and places (fixed: the plan\'s)', '```', ...B.rows, '```',
    '', '## Its gates', ...B.gates.map((g) => `- ${g.side}, row ${g.tile[0]} column ${g.tile[1]}: to ${g.toName}${g.join ? ' (a join)' : ''}; the neighbour's ground across it stands ${g.neighbourHeight} m up${g.neighbourSketched ? '' : ' (not yet sketched: its region\'s rise)'}`),
    '', '## Decide', `- ground: ${B.decide.ground}`, `- height: ${B.decide.height}`, `- marks: ${B.decide.marks}`,
    '', '## Laws', ...B.laws.map((l) => `- ${l}`),
    '', `Write: ${B.writes}`,
    B.current ? `\nCurrent (${B.current.status}): ${JSON.stringify({ ground: B.current.ground, height: B.current.height, marks: B.current.marks })}` : '',
  ].filter((x) => x !== null).join('\n');
}

/** The level's grid with its approved segments' sketch lowered: the build's read (grid-scene.js, grid-ends.js). */
export function levelGrid(level, at = 'level.grid', read = null) {
  const G = read ?? null;
  const base = G ?? readGridOf(level, at);
  if (level?.sketch === undefined || !base.plan) return base;
  const K = readSketch(level.sketch, base.plan);
  const approved = Object.entries(K.segments).filter(([, v]) => v.status === 'approved');
  if (!approved.length) return base;
  const only = { ...K, segments: Object.fromEntries(approved) }, P = base.plan;
  const ground = new Map(), marks = [], laid = { height: 0, ground: 0, boulders: 0, marks: 0 }, unlaid = [];
  for (const [seg, v] of approved) {
    const [r0, c0] = P.segments[seg].at;
    if (v.height) laid.height += v.height.length * v.height.length;
    v.ground?.forEach((row, r) => [...row].forEach((g, c) => {
      if (g === '.') return;
      const x = base.at(r0 + r, c0 + c);
      ground.set(`${r0 + r},${c0 + c}`, g);
      if (SKETCH_BIOCUBE[g]) laid.ground++;
      else if (g === 'r' && x.kind === 'path') laid.boulders++;
      else unlaid.push({ tile: [r0 + r, c0 + c], says: `${seg} row ${r + 1} column ${c + 1}: ${SKETCH_GROUND[g].split(':')[0]}${g === 'r' ? ' off the path (boulders are laid along a path)' : ''}` });
    }));
    for (const m of v.marks) { marks.push({ ...m, segment: seg, tile: [r0 + m.at[0], c0 + m.at[1]] }); laid.marks++; }
  }
  return { ...base, rise: sketchRise(base, only), sketch: { approved: approved.map(([k]) => k), ground, marks, laid, unlaid } };
}
