/**
 * THE MAP SKETCH — a planned map (plan.js) decided in miniature before it is built: the level's CONCEPT (its pitch and its
 * journey, beat by beat, each on a segment) and, a segment at a time, its SKETCH: what the ground is tile by tile (wood,
 * rocks, a cliff, water…), how high each tile stands, and what is MARKED on it (an encounter, loot, a landmark, a secret).
 * Each segment is planned on its own from its brief (segmentBriefs: the subtask), drawn at once in the miniature
 * (worldmap-view.js, worldmap-model.js) and approved by the creator; only then is it built. Not an RPG's: any action
 * quest's map.
 *
 *   sketch: {
 *     concept?: { pitch?, journey: [{ id, say, kind, at: '<segment>' }] },
 *     segments?: { <S>: { status?: 'draft' | 'approved', ground?: [rows], height?: [rows], marks?: [mark], notes? } },
 *   }
 *   ground   a glyph a tile (SKETCH_GROUND): f forest, g grove, m meadow, r rocks, c cliff, w water, s scrub; '.' its
 *            region's own
 *   height   a digit a tile, 0-9: its height in steps of SKETCH.step metres over its region's rise
 *   mark     { at: [row, col] in its segment, kind (SKETCH_MARKS), say, foes?: { kind?, count? }, item? }
 *
 *   readSketch(sketch, P, at?)       → the sketch read (P: readPlan's or readGrid's `plan` readout); throws, teaching
 *   sketchRise(G, S)                 → the grid's rise with each sketched tile's height over its region's (G: readGrid's)
 *   sketchLaws(G, S)                 → [{ law, ok, value }]: it advises, never refuses
 *   segmentBriefs(G, S, { level? })  → { <segment>: brief }: each segment's subtask, what its planner is given
 *   sketchStatus(S, P)               → { <segment>: 'approved' | 'draft' | 'unplanned' }
 * Pure.
 */
import { gateTile } from './plan.js';

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
export const JOURNEY_KINDS = Object.freeze(['arrival', 'traverse', 'encounter', 'find', 'vista', 'secret', 'rest', 'climb', 'puzzle', 'climax']);
const STATUS = ['draft', 'approved'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const strip = (r) => (typeof r === 'string' ? r.replace(/\s+/g, '') : '');
const fail = (m) => new Error(`level: ${m}`);

/** The sketch read against its plan. */
export function readSketch(sketch, P, at = 'level.sketch') {
  if (sketch === undefined) return null;
  if (!isObj(sketch)) throw fail(`${at} is { concept?, segments? }: the level decided in miniature before it is built`);
  for (const k of Object.keys(sketch)) if (!['concept', 'segments'].includes(k)) throw fail(`${at}.${k} is not a sketch's word (concept, segments)`);
  if (!P) throw fail(`${at} sketches a planned map (level.grid.plan): its segments are what is sketched`);
  const segs = Object.keys(P.segments ?? P.at), n = P.size;
  const out = { concept: null, segments: {} };
  if (sketch.concept !== undefined) {
    const C = sketch.concept;
    if (!isObj(C)) throw fail(`${at}.concept is { pitch?, journey }: the level's flow, beat by beat`);
    if (C.pitch !== undefined && typeof C.pitch !== 'string') throw fail(`${at}.concept.pitch is the level in a sentence`);
    if (!Array.isArray(C.journey) || !C.journey.length) throw fail(`${at}.concept.journey is the beats of the way, in order: [{ id, say, kind, at }]`);
    const ids = new Set();
    C.journey.forEach((b, i) => {
      const w = `${at}.concept.journey[${i}]`;
      if (!isObj(b) || typeof b.id !== 'string' || typeof b.say !== 'string') throw fail(`${w} is { id, say, kind, at }: a beat, what happens in it, its kind and its segment`);
      if (ids.has(b.id)) throw fail(`${w}.id '${b.id}' is another beat's`);
      ids.add(b.id);
      if (!JOURNEY_KINDS.includes(b.kind)) throw fail(`${w}.kind is ${JOURNEY_KINDS.join(', ')}`);
      if (!segs.includes(b.at)) throw fail(`${w}.at is a segment of the plan (${segs.join(', ')})`);
    });
    out.concept = { pitch: C.pitch ?? null, journey: C.journey.map((b) => ({ id: b.id, say: b.say, kind: b.kind, at: b.at })) };
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
