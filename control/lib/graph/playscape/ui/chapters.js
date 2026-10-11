/**
 * CHAPTERS — the same world at a later point. A chapter is a difference against the base world, applied when a
 * happening turns it, and carried into the levels after it through the game store. It adds nothing to the runtime:
 * a chapter lowers to cues (cues.js) and, when it carries, to a few rows of the level contract (game.on → setFlag).
 *
 *   play.chapters: [{ id,
 *     when:  a cue's when (cues.js: use, take, arrive, down, a var, any bus event …) | { after: '<chapter id>' }
 *     world: { spawn?: [who], vanish?: [who], set?: { var: value }, weather?: state, do?: [cue effect, …] }
 *     open?: '<menu id>'                                     what presents the turn (a menu, until shots exist)
 *   }]
 *   play.carry?: '<flags slice>'                             the store slice the chapters ride between levels
 *
 * A chapter turns once, live, and never again once carried. Its happening adds one to the bus var `chapter-<id>-n`;
 * the turn fires when that var is exactly 1: it applies the world, sets `chapter-<id>` to 1 (for the play's own
 * cues), presents (`open`) and emits `chapter-<id>`, which a chapter `after` it waits on and which, when the play
 * carries, the level contract maps to setFlag `chapter:<id>` on the carry slice. A level that starts with that flag
 * set applies the same world at once (the game channel pushes `chapter-<id>-carried`) and sets the counter past 1, so
 * the happening, met again, turns nothing: the world is simply as it was left, and nothing is presented or written.
 *
 *   readChapters(play)               → [{ id, when | null, after | null, world: [effect], open }] or throws, teaching
 *   chapterCues(play)                → the cues the chapters lower to (lowerPlay appends them to play.cues)
 *   chapterBus(play)                 → the bus rows beside them: each happening's count (lowerPlay merges them)
 *   withChapterCues(play)            → play with those cues appended (the same object when it has no chapters)
 *   chapterContract(game, play)      → the level contract with the carry rows added (idempotent; the same object
 *                                      when the play does not carry)
 *   chapterKey(id) / chapterVar(id)  the store flag and the bus var a chapter writes
 *
 * Absent `chapters` ⇒ not a byte changes anywhere.
 */
const ID = /^[a-z][a-z0-9-]*$/;
const WORLD_KEYS = ['spawn', 'vanish', 'set', 'weather', 'do'];
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x) => typeof x === 'string' && x.length > 0;

export const chapterKey = (id) => `chapter:${id}`;
export const chapterVar = (id) => `chapter-${id}`;
const turnEvent = (id) => `chapter-${id}`;
const carriedEvent = (id) => `chapter-${id}-carried`;
const askEvent = (id) => `chapter-${id}-asked`;
const countVar = (id) => `chapter-${id}-n`;
const CARRIED = 100;   // a carried chapter's count: past 1, so its turn never fires

function readWorld(w, where) {
  if (w === undefined) return [];
  if (!isObj(w)) throw new Error(`${where} is { ${WORLD_KEYS.join(', ')} }: the world at this chapter, as a difference`);
  for (const k of Object.keys(w)) if (!WORLD_KEYS.includes(k)) throw new Error(`${where}.${k} is not a world change (${WORLD_KEYS.join(', ')})`);
  const out = [];
  for (const k of ['spawn', 'vanish']) {
    if (w[k] === undefined) continue;
    const who = Array.isArray(w[k]) ? w[k] : [w[k]];
    if (!who.every(isStr)) throw new Error(`${where}.${k} is a character's id or a list of them`);
    for (const x of who) out.push({ [k]: x });
  }
  if (w.set !== undefined) {
    if (!isObj(w.set)) throw new Error(`${where}.set is { var: value }`);
    for (const [v, to] of Object.entries(w.set)) out.push({ set: v, to });
  }
  if (w.weather !== undefined) out.push({ weather: w.weather });
  if (w.do !== undefined) {
    if (!Array.isArray(w.do)) throw new Error(`${where}.do is a list of cue effects`);
    out.push(...w.do);
  }
  return out;
}

export function readChapters(play) {
  const list = play && play.chapters;
  if (list === undefined) return [];
  if (!Array.isArray(list) || !list.length) throw new Error('play.chapters is a list of { id, when, world?, open? }');
  if (play.carry !== undefined && !isStr(play.carry)) throw new Error("play.carry is the name of the store's flags slice the chapters ride between levels");
  const ids = new Set(list.map((c) => c && c.id));
  const seen = new Set();
  const out = list.map((c, i) => {
    const where = `play.chapters[${i}]`;
    if (!isObj(c)) throw new Error(`${where} is { id, when, world?, open? }`);
    for (const k of Object.keys(c)) if (!['id', 'when', 'world', 'open'].includes(k)) throw new Error(`${where}.${k} is not a chapter field (id, when, world, open)`);
    if (!isStr(c.id) || !ID.test(c.id)) throw new Error(`${where}.id '${c.id}' is a lower-case word`);
    if (seen.has(c.id)) throw new Error(`play.chapters: two chapters called '${c.id}'`);
    seen.add(c.id);
    if (!isObj(c.when)) throw new Error(`${where}.when is what turns it: a cue's when, or { after: '<chapter id>' }`);
    let when = c.when, after = null;
    if (c.when.after !== undefined) {
      if (Object.keys(c.when).length !== 1) throw new Error(`${where}.when.after stands alone`);
      if (!ids.has(c.when.after) || c.when.after === c.id) throw new Error(`${where}.when.after '${c.when.after}' is another chapter's id (${[...ids].filter((x) => x !== c.id).join(', ') || 'none'})`);
      when = null; after = c.when.after;
    }
    if (c.open !== undefined && !isStr(c.open)) throw new Error(`${where}.open is a menu's id`);
    return { id: c.id, when, after, world: readWorld(c.world, `${where}.world`), open: c.open ?? null };
  });
  // a ring of `after`s never turns: each waits on the one before it
  const after = Object.fromEntries(list.filter((c) => c.when.after !== undefined).map((c) => [c.id, c.when.after]));
  for (const start of Object.keys(after)) {
    const path = [start];
    for (let at = after[start]; at !== undefined; at = after[at]) {
      if (path.includes(at)) throw new Error(`play.chapters: ${[...path.slice(path.indexOf(at)), at].join(' → ')} wait on each other, so none ever turns`);
      path.push(at);
    }
  }
  return out;
}

export function chapterCues(play) {
  const chapters = readChapters(play), carry = play && play.carry;
  const cues = [];
  for (const ch of chapters) {
    const mark = { set: chapterVar(ch.id), to: 1 };
    if (ch.when) cues.push({ id: `chapter-${ch.id}-ask`, when: ch.when, then: { emit: askEvent(ch.id) } });
    cues.push({ id: `chapter-${ch.id}`, when: { var: countVar(ch.id), eq: 1 }, then: [...ch.world, mark, { emit: turnEvent(ch.id) }, ...(ch.open ? [{ open: ch.open }] : [])], once: true });
    if (carry) cues.push({ id: `chapter-${ch.id}-carried`, when: { on: carriedEvent(ch.id) }, then: [...ch.world, mark, { set: countVar(ch.id), to: CARRIED }], once: true });
  }
  return cues;
}

export function chapterBus(play) {
  const chapters = readChapters(play);
  if (!chapters.length) return null;
  // a happening counts; a chapter after another counts that one's live turn (a carried chapter emits no turn)
  return { reactions: chapters.map((ch) => ({ on: ch.after ? turnEvent(ch.after) : askEvent(ch.id), do: 'inc', var: countVar(ch.id) })) };
}

export function withChapterCues(play) {
  if (!play || play.chapters === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...chapterCues(play)] };
}

export function chapterContract(game, play) {
  if (!game || typeof game !== 'object' || !play || play.chapters === undefined || play.carry === undefined) return game;
  const chapters = readChapters(play), slice = play.carry;
  const produces = isObj(game.produces) ? game.produces : {};
  const events = Array.isArray(produces.events) ? produces.events : [];
  const consumes = Array.isArray(game.consumes) ? game.consumes : [];
  const on = { ...(game.on || {}) };
  for (const ch of chapters) on[turnEvent(ch.id)] = { emit: { type: 'setFlag', slice, key: chapterKey(ch.id), value: true } };
  return {
    ...game,
    produces: { ...produces, events: events.some((e) => e && e.type === 'setFlag' && e.slice === slice) ? events : [...events, { type: 'setFlag', slice }] },
    on,
    consumes: consumes.some((c) => c && c.slice === slice) ? consumes : [...consumes, { slice }],
    chapters: { slice, carried: chapters.map((ch) => ({ key: chapterKey(ch.id), event: carriedEvent(ch.id) })) },
  };
}
