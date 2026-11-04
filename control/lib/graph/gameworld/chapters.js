/**
 * THE CHAPTERS — the game book as the studio works it: each page of the book a CHAPTER, each chapter in one of the
 * studio's six departments, each with its contract:
 *
 *   { id, department, name,
 *     paths     the recipe it owns, as JSON Pointers (the deepest that holds a path is its owner: /characters/hero is the
 *               hero's, /characters/hero/motion the motion's)
 *     parts     the review parts it answers (review.js, character-review.js, foe-cast.js): an id, or `<prefix>:*`
 *     steps     the steps a run makes for it (runner.js): a key, `<prefix>-*`, or a figure's pool (guard, guard-2 …)
 *     cards     the manual it is written from (gameworld-cards.js): an id, or `<prefix>-*`
 *     reads     the chapters upstream: what it is derived from, so what must settle first
 *     outcome   the rail's outcome its parts are drawn under (rail/gameworld.js GAMEWORLD_OUTCOMES) }
 *
 * Derived from what the book already is, never a new truth: the pages are the cards' loop (gameworld-guide), the parts
 * the stamps the readers give, the steps the runner's, the reads the ready table (characterReady) and the cards' own
 * "from the pages above it". A new page, part, step or card belongs to exactly one chapter, or chapters.test.js fails:
 * a capability joins a department (CLAUDE.md). The last chapter, the build, reads every other: the compile.
 *
 *   chaptersOfPath(pointer)  → the chapters a write at `pointer` touches (its owner, or every chapter under it)
 *   chapterOfPart(id) · chapterOfStep(key) · chapterOfCard(id)  → the chapter, or null
 *   chapterBook(world, { stamps })  → each chapter the world holds: its state, its open parts, what it waits on
 *
 * Pure: no database, no clock. `stamps` are the readers' (reviewState, characterState, foeState), passed in.
 */

export const DEPARTMENTS = Object.freeze([
  { id: 'worlds', name: 'Worlds and levels' },
  { id: 'characters', name: 'Characters, props and vehicles' },
  { id: 'play', name: 'Play modes, animation and sound' },
  { id: 'foes', name: 'Foes and bosses' },
  { id: 'cinematics', name: 'Cinematics' },
  { id: 'production', name: 'Game design and production' },
]);

// the figures a quick game rolls in pools (runner.js: `guard`, `guard-2` …)
const POOLED = new Set(['guard', 'foe', 'tower', 'farmhand', 'keeper', 'athlete']);

const C = (id, department, name, { paths = [], parts = [], steps = [], cards = [], reads = [], outcome = null } = {}) =>
  Object.freeze({ id, department, name, paths: Object.freeze(paths), parts: Object.freeze(parts), steps: Object.freeze(steps), cards: Object.freeze(cards), reads: Object.freeze(reads), outcome });

/** The book's chapters, in the order a book is written (every chapter after the ones it reads). */
export const CHAPTERS = Object.freeze([
  C('intent', 'production', 'What game it is', { paths: ['/id', '/name', '/seed', '/intent', '/brief', '/quick'], parts: ['intent'], cards: ['gameworld-guide', 'gameworld-intent', 'gameworld-intent-*', 'gameworld-quick'], outcome: 'intent' }),
  C('world', 'worlds', 'The world', { paths: ['/style', '/civilizations', '/grade'], parts: ['world', 'nature', 'civilizations', 'key', 'tech:*'], cards: ['gameworld-world'], reads: ['intent'], outcome: 'world' }),
  C('levels', 'worlds', 'The levels', { paths: ['/levels', '/links', '/start', '/hub', '/topology', '/wcd', '/qow'], parts: ['level:*'], steps: ['level-*', 'map-*'], cards: ['gameworld-wcd', 'gameworld-qow'], reads: ['world'], outcome: 'levels' }),
  C('direction', 'characters', 'The direction', { paths: ['/characters/direction'], parts: ['characters:direction'], cards: ['gameworld-direction'], reads: ['intent', 'world'], outcome: 'characters' }),
  C('hero', 'characters', 'The hero', { paths: ['/characters/hero'], parts: ['hero:body', 'hero:head', 'hero:hair', 'hero:colour', 'hero:base'], steps: ['hero'], cards: ['gameworld-looks'], reads: ['direction'], outcome: 'characters' }),
  C('motion', 'play', 'The motion', { paths: ['/characters/hero/motion', '/moves'], parts: ['hero:motion'], cards: ['gameworld-motion'], reads: ['hero'], outcome: 'characters' }),
  C('feel', 'play', 'The feel and the juice', { paths: ['/feel', '/juice', '/tempo'], cards: ['gameworld-feel', 'gameworld-juice'], reads: ['intent', 'motion'] }),
  C('actions', 'play', 'The actions', { paths: ['/characters/hero/actions'], parts: ['hero:actions'], cards: ['gameworld-actions'], reads: ['intent', 'hero'], outcome: 'characters' }),
  C('adornment', 'characters', 'The adornment', { paths: ['/characters/hero/adornment'], parts: ['hero:adornment'], steps: ['hero-equipped'], cards: ['gameworld-adornment'], reads: ['hero', 'actions'], outcome: 'characters' }),
  C('systems', 'play', 'The systems', { paths: ['/mechanics'], parts: ['mechanics:*'], steps: ['systems'], cards: ['gameworld-systems'], reads: ['hero', 'actions', 'motion'], outcome: 'systems' }),
  C('equipment', 'characters', 'The equipment', { paths: ['/equipment', '/mounts'], parts: ['equipment'], steps: ['gear-*', 'stock-*', 'ride'], cards: ['gameworld-equipment', 'gameworld-mounts'], reads: ['adornment', 'systems'], outcome: 'systems' }),
  C('battles', 'play', 'The battles', { paths: ['/battles', '/minigames'], steps: ['keeper'], cards: ['gameworld-battles'], reads: ['systems', 'levels'] }),
  C('cast', 'characters', 'The cast', { paths: ['/characters/cast', '/characters/casting', '/characters/folk'], parts: ['cast', 'characters:cast'], steps: ['casting', 'cast-*', 'folk-*', 'farmhand', 'athlete', 'fighter-*'], cards: ['gameworld-folk'], reads: ['direction', 'levels'], outcome: 'characters' }),
  C('foes', 'foes', 'The foes', { paths: ['/foes'], parts: ['foes:*'], steps: ['foes-*', 'foe-*', 'foe', 'guard', 'tower'], cards: ['gameworld-foes'], reads: ['intent', 'levels'], outcome: 'foes' }),
  C('story', 'cinematics', 'The story', { paths: ['/story', '/quests', '/errands'], parts: ['story', 'quests'], cards: ['gameworld-story'], reads: ['cast', 'levels'], outcome: 'story' }),
  C('camera', 'cinematics', 'The camera', { paths: ['/camera', '/xr'], reads: ['intent', 'levels'] }),
  C('build', 'production', 'The build', { paths: ['/mode', '/review', '/made', '/screen', '/front', '/book'], steps: ['game', 'audit-level-*'], cards: ['gameworld-next', 'gameworld-studio'], reads: ['intent', 'world', 'levels', 'direction', 'hero', 'motion', 'feel', 'actions', 'adornment', 'systems', 'equipment', 'battles', 'cast', 'foes', 'story', 'camera'], outcome: 'play' }),
]);

const BY_ID = new Map(CHAPTERS.map((c) => [c.id, c]));

/**
 * The book's chapters in WAVES: each wave the chapters whose upstream (`reads`) is all in the waves before it, so the
 * chapters of a wave can be worked side by side (a department each, or a subagent each) once the waves before it are
 * settled, and the build is the last. Derived from the reads alone: a chapter that reads another is in a later wave.
 * → [[chapter id, …], …]
 */
export function chapterWaves() {
  const wave = new Map();
  for (const c of CHAPTERS) wave.set(c.id, c.reads.length ? 1 + Math.max(...c.reads.map((r) => wave.get(r))) : 0);
  const out = [];
  for (const c of CHAPTERS) (out[wave.get(c.id)] ??= []).push(c.id);
  return out;
}
export const chapterById = (id) => BY_ID.get(id) ?? null;

/** Does `pattern` (an id, `<prefix>:*` or `<prefix>-*`) name `id`? */
const named = (pattern, id) => (pattern.endsWith(':*') || pattern.endsWith('-*') ? id.startsWith(pattern.slice(0, -1)) && id.length > pattern.length - 1 : pattern === id);
const one = (pick) => { const hits = CHAPTERS.filter(pick); return hits.length === 1 ? hits[0] : null; };

/** The chapter a review part answers. */
export const chapterOfPart = (id) => (typeof id === 'string' ? one((c) => c.parts.some((p) => named(p, id))) : null);
/** The chapter a run's step is made for (a figure's pool, `guard-2`, is its figure's). */
export function chapterOfStep(key) {
  if (typeof key !== 'string') return null;
  const m = /^([a-z]+)-\d+$/.exec(key), base = m && POOLED.has(m[1]) ? m[1] : key;
  return one((c) => c.steps.some((s) => named(s, base)));
}
/** The chapter a card is the manual of. */
export const chapterOfCard = (id) => (typeof id === 'string' ? one((c) => c.cards.some((p) => named(p, id))) : null);

const under = (path, root) => path === root || path.startsWith(`${root}/`);
/** The chapters a write at `pointer` touches: the chapter owning the deepest path above it, or, for a pointer above
 * every path (the character book whole, `/characters`; the root, ''), every chapter whose paths lie under it. */
export function chaptersOfPath(pointer) {
  if (typeof pointer !== 'string') return [];
  const p = pointer.replace(/\/$/, '');
  let best = null, depth = -1;
  for (const c of CHAPTERS) for (const q of c.paths) if (under(p, q) && q.length > depth) { best = c; depth = q.length; }
  if (best) return [best];
  return CHAPTERS.filter((c) => c.paths.some((q) => p === '' || under(q, p)));
}

/** Does the world write anything at this chapter's paths (a path owned by a deeper chapter is that one's)? */
function writes(world, c) {
  const at = (q) => q.slice(1).split('/').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), world);
  return c.paths.some((q) => {
    const v = at(q);
    if (v === undefined || v === null) return false;
    // the hero's page is its own keys, not its motion's, actions' or adornment's
    if (q === '/characters/hero' && v && typeof v === 'object') return Object.keys(v).some((k) => !['motion', 'actions', 'adornment'].includes(k));
    return true;
  });
}

// a stamp as the studio reads it (the rail's stampState, said of one part): settled, advised or open
const stampOf = (s) => (s.status === 'approved' || s.status === 'auto' ? 'settled' : s.status === 'changed' || (s.status === 'revise' && s.machine?.length) ? 'advised' : 'open');
const WORST = ['open', 'advised', 'settled'];

/**
 * Each chapter the world holds, in the book's order: `state` settled (every part approved or settled by its machine
 * gate), advised (a part the machine gate or an upstream change sent back), open (a part waiting on the creator), or
 * written (pages with no review of their own: their advice is their gate); `parts` how many of its parts are settled;
 * `open` the ones not settled, once some are; `waits` the chapters it reads that are open or advised. A chapter the world neither writes nor stamps is left out.
 */
export function chapterBook(world, { stamps = [] } = {}) {
  const out = [], state = {};
  for (const c of CHAPTERS) {
    const mine = stamps.filter((s) => chapterOfPart(s.id) === c);
    if (!mine.length && !writes(world ?? {}, c)) continue;
    const marks = mine.map(stampOf);
    const st = mine.length ? WORST.find((w) => marks.includes(w)) : 'written';
    state[c.id] = st;
    const open = mine.filter((s, i) => marks[i] !== 'settled').map((s) => s.id);
    const waits = c.reads.filter((r) => state[r] === 'open' || state[r] === 'advised');
    // (its open parts named once some are settled: with none settled they are all its parts, `parts` says how many)
    const settled = marks.filter((m) => m === 'settled').length;
    out.push({ id: c.id, department: c.department, state: st, ...(mine.length ? { parts: `${settled}/${mine.length}` } : {}), ...(open.length && settled ? { open } : {}), ...(waits.length ? { waits } : {}) });
  }
  return out;
}

/**
 * A chapter's run (design_game { ref, chapter, run: true }): the run's steps cut to the chapter's own and everything
 * their orders name (a level's pilot, the foes and folk that stand in it, a cast member's casting row: a step whose ref
 * an order carries), so a department proofs its chapter without making the whole book. A step that waits on approvals
 * is made AHEAD of them: ready, with `ahead` the parts it did not wait for, at its own ref from its own order, so the
 * build keeps it when its approvals come and the book has not moved, and remakes it when the book has. The build (the
 * game, its walks) is never a need: the build chapter's run is the whole run.
 */
export function chapterSteps(steps, id) {
  const c = chapterById(id);
  if (!c) throw new Error(`chapter is one of ${CHAPTERS.map((x) => x.id).join(', ')}`);
  if (id === 'build') return steps;
  const build = chapterById('build');
  const want = new Set(steps.filter((s) => chapterOfStep(s.key) === c).map((s) => s.key));
  const text = new Map(steps.map((s) => [s.key, JSON.stringify(s.order ?? {})]));
  for (let grew = true; grew;) {
    grew = false;
    for (const s of steps) {
      if (want.has(s.key) || chapterOfStep(s.key) === build) continue;
      const quoted = JSON.stringify(s.ref);
      if ([...want].some((k) => text.get(k).includes(quoted))) { want.add(s.key); grew = true; }
    }
  }
  return steps.filter((s) => want.has(s.key)).map((s) => {
    if (s.ready) return s;
    const { waiting = [], ...rest } = s;
    return { ...rest, ready: true, ahead: waiting.map((w) => `${w.id} (${w.status})`) };
  });
}
