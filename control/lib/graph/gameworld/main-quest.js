/**
 * THE MAIN QUEST — a game's spine: its beginning, its middle and its end (when it has one), as acts of beats. Not a game
 * type: its outcome is the flow and the sequence, and the levels and maps are laid from it. Each beat is played AS one
 * of the book's structures, so any long game composes on it: a level, a walled-core dungeon's space, a quest open
 * world's quest, a gauntlet, an errand, a tactics book's epoch, or a story moment.
 *
 * The recipe (a gameworld's `mainQuest`):
 *   { length?: 'short' | 'medium' | 'long' | { hours },   how long the main path plays
 *     periods?: [{ id, name?, passage?: 'overlay' | 'eras' }],   the times it spans (one, if none): a period past the
 *                                                       first is the world aged, a chapter overlay (built) or an era
 *     acts: [{ id, name?, period?, goal: '<words>', turn?, beats: [{ id, goal: '<words>', as?, gains?, foes?, who?, built? }] }],
 *       | chapters: [ …the same… ],                    the progression's shape: ACTS, the arc (a beginning, a middle and
 *                                                       an end), or CHAPTERS, a long game told chapter on chapter, more
 *                                                       than an arc (the time facet's chapters: each turns the world,
 *                                                       its `turn` a world difference a happening makes, carried on)
 *     ending?: { beat, stakes? },                       the climax it builds toward; a quest being built may have none
 *     sides?: { looseness: 'tight' | 'loose' | 'free' } }   how far side quests stand from the path
 *   a beat's `as` is one of { level } (or { level, region }: a region of a glyph-map level) { wcd: '<space>' } { qow: '<quest>' } { gauntlet: '<level>' } { errand } { epoch: n }
 *   { scene: '<moment>' }; `gains` the hero's powers gained on it, `foes` the bestiary's it fields, `who` the cast in it;
 *   `built: false` a beat planned and not made yet: what it names may not exist yet, and a run never makes it.
 *
 * Refused (malformed): an unknown key, a duplicate id, an act with no beats, a built beat played as what the world lacks.
 * A power, a foe or a cast member the book does not hold yet is said (the `held` law): the quest is often written first.
 * Advised (laws, never refusing; each { law, holds, says }): see LAWS. They map the quest into the book: an act is a
 * stage of the hero's progression (early, mid, late, by its place among the acts), so the actions page and the quest
 * say the same thing (the first act early, the last late).
 *
 *   readMainQuest(Q, ctx)        → the quest, read (ctx: what the world holds, mainQuestContext)
 *   mainQuestContext(W)          → { levels, powers, stages, foes, cast, errands, qow, wcd, story, gauntlets, regions }
 *   mainQuestLaws(Q, ctx)        → [{ law, holds, says }]
 *   mainQuestReport(Q, ctx)      → { shape, acts | chapters, beats, built, planned, length?, ending?, laws } (the readout's)
 *   partsOf(Q)                   → its acts, or its chapters (a read quest's `shape` says which)
 *   stageOfAct(i, n)             → 'early' | 'mid' | 'late' for the act at i of n
 *
 * Pure: the recipe in, the reading out.
 */
import { readGrid } from '../level/grid.js';

// a glyph-map level's regions (glyph → name), read as its map reads them; none for another level, or for a grid the
// world's own read refuses (that read says why)
const GRID_WORDS = ['tile', 'rows', 'key', 'regions', 'plan', 'segments'];
function glyphRegions(g) {
  if (!g || typeof g !== 'object' || (!g.regions && !g.plan)) return null;
  let G; try { G = readGrid(Object.fromEntries(GRID_WORDS.filter((k) => g[k] !== undefined).map((k) => [k, g[k]]))); } catch { return null; }
  return G.regions ? Object.fromEntries(Object.entries(G.regions).map(([k, v]) => [k, v?.name ?? k])) : null;
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]{0,47}$/;
const fail = (m) => new Error(`mainQuest${m}`);

export const LENGTHS = Object.freeze({ short: 'under three hours', medium: 'three to fifteen hours', long: 'fifteen hours and more' });
export const LOOSENESS = Object.freeze({ tight: 'side quests branch from the path\'s beats', loose: 'side quests stand near the path', free: 'side quests stand anywhere on the map' });
export const PASSAGES = Object.freeze({ overlay: 'the world aged by a chapter overlay (built)', eras: 'the same map at another period (the time facet\'s eras: not built yet)' });
export const BEAT_AS = Object.freeze(['level', 'wcd', 'qow', 'gauntlet', 'errand', 'epoch', 'scene']);
const RANK_ORDER = ['minion', 'elite', 'miniboss', 'boss'];
const QUEST_KEYS = ['length', 'periods', 'acts', 'chapters', 'ending', 'sides'];
const ACT_KEYS = ['id', 'name', 'period', 'goal', 'turn', 'beats'];
/** The progression's shapes: the arc's acts, or a long game's chapters. */
export const SHAPES = Object.freeze({ acts: 'the arc: a beginning, a middle and an end', chapters: 'a long game told chapter on chapter, each turning the world: more than an arc' });
export const partsOf = (Q) => Q[Q.shape ?? 'acts'];
const BEAT_KEYS = ['id', 'goal', 'as', 'gains', 'foes', 'who', 'built'];

/** The act at i of n as a stage of the hero's progression, by its place between the first and the last: the first act is
 * always early and the last always late (the end is the late game), the middle mid (three acts: early, mid, late; four:
 * early, mid, mid, late; five: early, early, mid, late, late). */
export function stageOfAct(i, n) {
  if (n <= 1) return 'early';
  const x = (2 * i) / (n - 1);
  return x < 2 / 3 ? 'early' : x > 4 / 3 ? 'late' : 'mid';
}

/** What the world holds that a quest may name, from the raw recipe (read before the quest is). */
export function mainQuestContext(W = {}) {
  const A = W.characters?.hero?.actions;
  const stages = {};
  for (const p of (isObj(A) && Array.isArray(A.progression) ? A.progression : [])) for (const g of p?.gains ?? []) stages[g] = p.stage;
  const foes = Object.fromEntries(Object.entries(isObj(W.foes) ? W.foes : {}).map(([id, e]) => [id, e?.rank ?? 'minion']));
  const levels = Object.keys(isObj(W.levels) ? W.levels : {});
  return {
    levels,
    powers: (isObj(A) && Array.isArray(A.powers) ? A.powers : []).map((p) => p?.id).filter(Boolean),
    stages,
    foes,
    cast: Object.keys(isObj(W.characters?.cast) ? W.characters.cast : {}),
    errands: (Array.isArray(W.errands) ? W.errands : []).map((e) => e?.id).filter(Boolean),
    qow: (Array.isArray(W.qow?.quests) ? W.qow.quests : []).map((q) => q?.id).filter(Boolean),
    wcd: Object.keys(isObj(W.wcd?.spaces) ? W.wcd.spaces : {}),
    story: (Array.isArray(W.story) ? W.story : []).map((m) => m?.id).filter(Boolean),
    gauntlets: levels.filter((id) => W.levels[id]?.goal?.gauntlet !== undefined),
    // (each glyph-map level's regions: glyph → name, as its map reads them, level/grid.js: a planned map's segments too)
    regions: Object.fromEntries(levels.map((id) => [id, glyphRegions(W.levels[id]?.glyphs)]).filter(([, R]) => R)),
  };
}

const unknown = (o, keys, at) => { for (const k of Object.keys(o)) if (!keys.includes(k)) throw fail(`${at}.${k} is not a setting (${keys.join(', ')})`); };
const words = (v, at) => { if (typeof v !== 'string' || !v.trim()) throw fail(`${at} is the words it is about`); };

/** The beat's `as`, read: → { kind, at } (at undefined for an epoch given by number). */
function readAs(as, at, built, C) {
  // (a level written as a glyph map is the whole chapter: a beat plays one of its REGIONS, `{ level, region }`, by the
  // region's name or its glyph)
  if (isObj(as) && Object.keys(as).length === 2 && as.level !== undefined && as.region !== undefined) {
    const L = readAs({ level: as.level }, at, built, C), R = C.regions?.[as.level] ?? {};
    if (typeof as.region !== 'string' || !as.region) throw fail(`${at}.as.region is the name (or the glyph) of a region of the level's map`);
    const names = Object.entries(R).flatMap(([k, n]) => [k, n]);
    if (built && !names.includes(as.region)) throw fail(`${at}.as.region '${as.region}' is not a region of '${as.level}' (${Object.values(R).join(', ') || 'its map names none'})`);
    return { ...L, region: R[as.region] ?? as.region };
  }
  if (!isObj(as) || Object.keys(as).length !== 1 || !BEAT_AS.includes(Object.keys(as)[0])) throw fail(`${at}.as is one of ${BEAT_AS.map((k) => `{ ${k} }`).join(' ')} (or { level, region } on a glyph map)`);
  const [kind, v] = Object.entries(as)[0];
  if (kind === 'epoch') { if (!(Number.isInteger(v) && v >= 1)) throw fail(`${at}.as.epoch is the epoch's number, from 1`); return { kind, at: v }; }
  if (typeof v !== 'string' || !v) throw fail(`${at}.as.${kind} is the id of what it is played as`);
  const have = { level: C.levels, wcd: C.wcd, qow: C.qow, gauntlet: C.gauntlets, errand: C.errands, scene: C.story }[kind];
  // a planned beat may name what the world does not hold yet: the quest is written before its levels are
  if (built && !have.includes(v)) throw fail(`${at}.as.${kind} '${v}' is not one of the world's (${have.join(', ') || 'none yet'}); a beat not made yet is built: false`);
  return { kind, at: v };
}

export function readMainQuest(Q, C = mainQuestContext()) {
  if (!isObj(Q)) throw fail(' is { length?, periods?, acts | chapters, ending?, sides? }: the game\'s acts (or chapters), a beat at a time');
  unknown(Q, QUEST_KEYS, '');
  if (Q.length !== undefined && !LENGTHS[Q.length] && !(isObj(Q.length) && Number.isFinite(Q.length.hours) && Q.length.hours > 0 && Object.keys(Q.length).length === 1)) {
    throw fail(`.length is ${Object.entries(LENGTHS).map(([k, v]) => `${k} (${v})`).join(', ')}, or { hours }`);
  }
  const periods = Q.periods ?? [];
  if (!Array.isArray(periods)) throw fail('.periods is [{ id, name?, passage? }]');
  const periodIds = [];
  periods.forEach((p, i) => {
    if (!isObj(p) || !ID.test(p.id ?? '')) throw fail(`.periods[${i}] is { id, name?, passage? }`);
    unknown(p, ['id', 'name', 'passage'], `.periods[${i}]`);
    if (p.passage !== undefined && !PASSAGES[p.passage]) throw fail(`.periods[${i}].passage is ${Object.keys(PASSAGES).join(' or ')}`);
    if (periodIds.includes(p.id)) throw fail(`.periods: '${p.id}' twice`);
    periodIds.push(p.id);
  });
  if (Q.acts !== undefined && Q.chapters !== undefined) throw fail(' is shaped as acts or as chapters, not both: acts, the arc (a beginning, a middle and an end); chapters, a long game told chapter on chapter');
  const shape = Q.chapters !== undefined ? 'chapters' : 'acts', unit = shape === 'chapters' ? 'chapter' : 'act';
  if (!Array.isArray(Q[shape]) || !Q[shape].length) throw fail(shape === 'acts' ? '.acts is [{ id, goal, beats }]: at least one act (a long game has three: a beginning, a middle and an end), or chapters for a game told chapter on chapter' : '.chapters is [{ id, goal, turn?, beats }]: at least one chapter');
  const ids = new Set();
  const acts = Q[shape].map((A, i) => {
    const at = `.${shape}[${i}]`;
    if (!isObj(A) || !ID.test(A.id ?? '')) throw fail(`${at} is { id, name?, period?, goal, turn?, beats }`);
    unknown(A, ACT_KEYS, at);
    if (ids.has(A.id)) throw fail(`${at}: '${A.id}' twice (${shape} and beats share their ids)`);
    ids.add(A.id);
    words(A.goal, `${at}.goal`);
    if (A.period !== undefined && !periodIds.includes(A.period)) throw fail(`${at}.period '${A.period}' is none of the periods (${periodIds.join(', ') || 'none written'})`);
    if (A.turn !== undefined) words(A.turn, `${at}.turn`);
    if (!Array.isArray(A.beats) || !A.beats.length) throw fail(`${at}.beats is [{ id, goal, as?, gains?, foes?, who?, built? }]: at least one (a ${unit} is played a beat at a time)`);
    const beats = A.beats.map((B, j) => {
      const bt = `${at}.beats[${j}]`;
      if (!isObj(B) || !ID.test(B.id ?? '')) throw fail(`${bt} is { id, goal, as?, gains?, foes?, who?, built? }`);
      unknown(B, BEAT_KEYS, bt);
      if (ids.has(B.id)) throw fail(`${bt}: '${B.id}' twice (${shape} and beats share their ids)`);
      ids.add(B.id);
      words(B.goal, `${bt}.goal`);
      if (B.built !== undefined && B.built !== false) throw fail(`${bt}.built is false (a beat planned, not made yet), or left out`);
      const built = B.built !== false;
      const as = B.as === undefined ? null : readAs(B.as, bt, built, C);
      const list = (k, have, what) => {
        const v = B[k];
        if (v === undefined) return [];
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw fail(`${bt}.${k} is [${what} id]`);
        // (a name the book does not hold yet is said, not refused: the quest is often written before the powers, the foes
        // and the cast it names; the `held` law says what is still to write)
        return v;
      };
      return { id: B.id, goal: B.goal, ...(as ? { as } : {}), gains: list('gains', C.powers, 'power'), foes: list('foes', Object.keys(C.foes), 'bestiary'), who: list('who', C.cast, 'cast member'), built };
    });
    return { id: A.id, ...(A.name !== undefined ? { name: String(A.name) } : {}), goal: A.goal, ...(A.period ? { period: A.period } : {}), ...(A.turn ? { turn: A.turn } : {}), beats };
  });
  let ending = null;
  if (Q.ending !== undefined) {
    if (!isObj(Q.ending) || typeof Q.ending.beat !== 'string') throw fail('.ending is { beat, stakes? }: the climax it builds toward');
    unknown(Q.ending, ['beat', 'stakes'], '.ending');
    if (!acts.some((A) => A.beats.some((B) => B.id === Q.ending.beat))) throw fail(`.ending.beat '${Q.ending.beat}' is none of the beats`);
    ending = { beat: Q.ending.beat, ...(Q.ending.stakes !== undefined ? { stakes: String(Q.ending.stakes) } : {}) };
  }
  if (Q.sides !== undefined) {
    if (!isObj(Q.sides) || !LOOSENESS[Q.sides.looseness]) throw fail(`.sides is { looseness: ${Object.keys(LOOSENESS).join(' | ')} }`);
    unknown(Q.sides, ['looseness'], '.sides');
  }
  return {
    shape,
    ...(Q.length !== undefined ? { length: Q.length } : {}),
    periods: periods.map((p) => ({ id: p.id, ...(p.name ? { name: p.name } : {}), passage: p.passage ?? 'overlay' })),
    [shape]: acts,
    ...(ending ? { ending } : {}),
    ...(Q.sides ? { sides: { looseness: Q.sides.looseness } } : {}),
  };
}

const beatsOf = (Q) => partsOf(Q).flatMap((A, i) => A.beats.map((B) => ({ ...B, act: A.id, i })));
const rankOf = (r) => RANK_ORDER.indexOf(r);

/** The laws: what a long game's spine holds to, measured on the quest and the book, said, never refused. */
export const LAWS = Object.freeze([
  { law: 'held', says: 'every power, foe and cast member the quest names is one the book holds' },
  { law: 'arc', says: 'a beginning, a middle and an end: three acts at least (one is a short game, or one still being planned)' },
  { law: 'chaptered', says: 'a game told in chapters runs past an arc: more than three chapters (three or fewer, acts tell it)' },
  { law: 'turns', says: 'each chapter after the first turns the world: a `turn` (what a happening changes, carried on) or a new period' },
  { law: 'ends-last', says: 'the ending, when there is one, is the last act\'s last beat' },
  { law: 'gained-on-path', says: 'every power the hero\'s actions name is gained on a beat of the quest' },
  { law: 'stage-matches', says: 'a power is gained in the act its progression stage puts it in (early, mid, late)' },
  { law: 'escalates', says: 'the foes an act fields rise in rank act on act, never fall back' },
  { law: 'varied', says: 'no two acts in a row are played as the same structure in the same place' },
  { law: 'buildable-first', says: 'the first beat can be made now: built, and played as a level the world holds or laid from its own words' },
  { law: 'periods-drawn', says: 'a period past the first is one the time facet draws (a chapter overlay); an era is not built yet' },
]);
const SAYS = Object.fromEntries(LAWS.map((l) => [l.law, l.says]));

export function mainQuestLaws(Q, C = mainQuestContext()) {
  const out = [];
  const law = (id, holds, why) => out.push({ law: id, holds, says: holds ? SAYS[id] : `${SAYS[id]}: ${why}` });
  const parts = partsOf(Q), n = parts.length, beats = beatsOf(Q), chaptered = Q.shape === 'chapters';
  const unheld = [...new Set([...beats.flatMap((B) => B.gains.filter((g) => !C.powers.includes(g)).map((g) => `power ${g}`)), ...beats.flatMap((B) => B.foes.filter((f) => !(f in C.foes)).map((f) => `foe ${f}`)), ...beats.flatMap((B) => B.who.filter((w) => !C.cast.includes(w)).map((w) => `cast member ${w}`))])];
  if (beats.some((B) => B.gains.length || B.foes.length || B.who.length)) law('held', !unheld.length, `${unheld.join(', ')} still to write (the actions, the bestiary, the cast)`);
  if (!chaptered) law('arc', n >= 3, `${n} act${n === 1 ? '' : 's'}`);
  else {
    law('chaptered', n > 3, `${n} chapter${n === 1 ? '' : 's'}`);
    let period = parts[0].period;
    const still = parts.slice(1).filter((A) => { const moved = A.turn || (A.period && A.period !== period); if (A.period) period = A.period; return !moved; }).map((A) => `'${A.id}'`);
    if (n > 1) law('turns', !still.length, `${still.join(', ')} ${still.length === 1 ? 'turns' : 'turn'} nothing in the world`);
  }
  if (Q.ending) { const last = parts[n - 1].beats.at(-1).id; law('ends-last', Q.ending.beat === last, `the ending is '${Q.ending.beat}', the last beat is '${last}'`); }
  if (C.powers.length) {
    const gained = new Map(beats.flatMap((B) => B.gains.map((g) => [g, B])));
    const missing = C.powers.filter((p) => !gained.has(p));
    law('gained-on-path', !missing.length, `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} gained on no beat`);
    const off = [...gained].filter(([p, B]) => C.stages[p] && C.stages[p] !== stageOfAct(B.i, n)).map(([p, B]) => `${p} on '${B.id}' (${chaptered ? 'chapter' : 'act'} ${B.i + 1} of ${n}, ${stageOfAct(B.i, n)}) but its stage is ${C.stages[p]}`);
    if (Object.keys(C.stages).length) law('stage-matches', !off.length, off.join('; '));
  }
  const ranks = parts.map((A) => Math.max(-1, ...A.beats.flatMap((B) => B.foes.filter((f) => f in C.foes).map((f) => rankOf(C.foes[f])))));
  if (ranks.some((r) => r >= 0)) {
    const falls = [];
    let top = -1;
    ranks.forEach((r, i) => { if (r >= 0 && r < top) falls.push(`${chaptered ? 'chapter' : 'act'} ${i + 1} fields ${RANK_ORDER[r]}s after an act of ${RANK_ORDER[top]}s`); if (r > top) top = r; });
    law('escalates', !falls.length, falls.join('; '));
  }
  const sign = (A) => JSON.stringify([...new Set(A.beats.map((B) => (B.as ? `${B.as.kind}:${B.as.at}` : 'unset')))].sort());
  const same = parts.slice(1).map((A, i) => [parts[i], A]).filter(([a, b]) => sign(a) === sign(b) && !sign(a).includes('unset')).map(([a, b]) => `'${a.id}' and '${b.id}'`);
  if (n > 1) law('varied', !same.length, `${same.join(', ')} are played the same`);
  const first = parts[0].beats[0];
  // (a beat with no structure named is laid its own level at a run: main-quest-lay.js)
  law('buildable-first', first.built && (!first.as || (first.as.kind === 'level' && C.levels.includes(first.as.at))), `the first beat '${first.id}' is ${!first.built ? 'planned, not built' : first.as.kind !== 'level' ? `played as a ${first.as.kind}, not a level` : `a level the world does not hold ('${first.as.at}')`}`);
  if (Q.periods.length > 1) {
    const eras = Q.periods.slice(1).filter((p) => p.passage === 'eras').map((p) => p.id);
    law('periods-drawn', !eras.length, `${eras.join(', ')} ${eras.length === 1 ? 'asks' : 'ask'} for eras (time.passage=eras), which the time facet does not draw yet`);
  }
  return out;
}

export function mainQuestReport(Q, C = mainQuestContext()) {
  const beats = beatsOf(Q), laws = mainQuestLaws(Q, C);
  return {
    shape: Q.shape,
    [Q.shape]: partsOf(Q).map((A, i, all) => ({ id: A.id, stage: stageOfAct(i, all.length), beats: A.beats.length, planned: A.beats.filter((B) => !B.built).length, ...(A.turn ? { turn: A.turn } : {}) })),
    beats: beats.length,
    built: beats.filter((B) => B.built).length,
    planned: beats.filter((B) => !B.built).length,
    ...(Q.length !== undefined ? { length: Q.length } : {}),
    ...(Q.ending ? { ending: Q.ending.beat } : { ending: null }),
    laws: laws.filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`),
  };
}
