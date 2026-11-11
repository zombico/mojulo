/**
 * ONE CHAPTER'S READOUT — design_game({ ref, chapter }): the book as one department works it. A projection of the
 * door's whole readout onto one chapter (chapters.js), so the two never disagree: its own parts with their stamps and
 * advice, its own pages (the recipe at its paths, a deeper chapter's left to that chapter), the chapters upstream it
 * reads as a digest (each one's state and the print of its pages: moved since you last read it, read it again), the
 * next moves that are its own, what a run made for it, and the whole book as one line a chapter. A department (an
 * agent's session, or a subagent given only this) works its chapter from this and its cards, never the whole book.
 *
 *   chapterView(full, world, id, { ran?, pending?, patched? }) → { chapter, pages, reads, book, next, … }
 *     id       a chapter, or one level (`level:<id>`, chapters.js unitOf): the levels chapter narrowed to that level, its
 *              part, its page, its links in and out, its steps; the unit the studio works one at a time
 *     full     the door's readout (design-game.js readout + its run's additions)
 *     ran      the run's steps (its own are kept; the rest counted)
 *     patched  the JSON Pointers this call wrote: one outside the chapter is said (advice, never a refusal)
 *
 * Pure: the readout and the world in, the view out.
 */
import { CHAPTERS, chapterById, chapterOfPart, chapterOfStep, chaptersOfPath, unitOf, levelStep, LEVEL_PAGE_CARDS } from './chapters.js';
import { fingerprint } from './review.js';
import { chapterDigest } from '../lorecube/backdrop.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const at = (world, q) => q.slice(1).split('/').reduce((v, k) => (isObj(v) ? v[k] : undefined), world);
// every path some chapter owns: a page's key a deeper chapter owns is that chapter's, not this one's
const OWNED = new Set(CHAPTERS.flatMap((c) => c.paths));

/** A chapter's pages: the recipe at each of its paths, a deeper chapter's keys left out. */
export function chapterPages(world, id) {
  const c = chapterById(id), out = {};
  for (const q of c?.paths ?? []) {
    const v = at(world ?? {}, q);
    if (v === undefined || v === null) continue;
    out[q] = isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => !OWNED.has(`${q}/${k}`))) : v;
    if (isObj(out[q]) && !Object.keys(out[q]).length) delete out[q];
  }
  return out;
}

// the readout's next moves, each by the chapter it is (gameworld-next's step ids); a move naming parts is each part's
const MOVE = { req: 'build', composite: 'build', play: 'build', playthrough: 'build', share: 'build', run: 'build', rerun: 'build', compile: 'build', adornment: 'adornment', intent: 'intent', target: 'intent', feel: 'feel', juice: 'feel', foes: 'foes', story: 'story', advice: 'intent' };
/** The chapter a next move is, or null (a review names parts: each its own; a wait names its chapter; a form ask its
 * field, which is a chapter's id). */
export function chapterOfMove(move) {
  if (!isObj(move) || typeof move.step !== 'string') return null;
  if (move.step === 'wait') return chapterById(move.on);
  if (move.step === 'req') return unitOf(move.unit)?.chapter ?? chapterById('build');   // the unit's, else the director's
  if (move.step === 'form') return null;   // its asks are each their own (chapterView splits them)
  if (move.step === 'review' || move.step === 'advised') return null;   // its parts are each their own
  return chapterById(MOVE[move.step]);
}
export const MOVE_STEPS = Object.freeze([...Object.keys(MOVE), 'wait', 'form', 'review', 'advised']);

// the readout's sections and advice, each by its chapter
const SECTION = { intent: 'intent', composed: 'intent', concept: 'intent', feel: 'feel', juice: 'feel', numbers: 'systems', story: 'story', audits: 'build', fight: 'cast', first_frame: 'build', resonance: 'build', comparison: 'intent', compile: 'build', errand_proof: 'story', gauntlet_proof: 'levels', mainQuest: 'main-quest', loop: 'intent', goalposts: 'build' };
const ADVICE = { authorship: 'intent', sameness: 'intent', questions: 'intent', land: 'world', wcd: 'levels', qow: 'levels', mainQuest: 'main-quest', loop: 'intent' };
// where a chapter's parts are drawn: its bible (the character book's chapters in the character bible, the foes in the cast sheet)
// (equipment: a game that fights with guns has them played in its combat book, the gym; else the character bible)
const BOOK = { direction: 'characterBible', hero: 'characterBible', motion: 'characterBible', actions: 'characterBible', adornment: 'characterBible', systems: 'characterBible', equipment: ['combatBook', 'characterBible'], feel: 'feelBook', foes: 'foeBook' };

const also = (ran, own) => ran.filter((r) => (r.action === 'make' || r.action === 'remake') && !own(r.key)).map((r) => r.key);

export function chapterView(full, world, id, { ran, pending, patched = [] } = {}) {
  const unit = unitOf(id);
  if (!unit) throw new Error(`design_game: chapter is one of ${CHAPTERS.map((x) => x.id).join(', ')}, or one level as 'level:<id>'`);
  const c = unit.chapter, lv = unit.level;
  if (lv !== null && !isObj(world?.levels?.[lv])) throw new Error(`design_game: no level '${lv}' in this world (its levels: ${Object.keys(world?.levels ?? {}).join(', ') || 'none'})`);
  // a level's unit: its own part, steps and page only (the chapter's other levels are other units)
  const ownPart = (pid) => (lv !== null ? pid === `level:${lv}` : chapterOfPart(pid) === c);
  const ownStep = lv !== null ? ((k) => levelStep(lv).test(k)) : ((k) => chapterOfStep(k) === c);
  const book = full.chapters ?? [];
  const mine = book.find((x) => x.id === c.id);
  const parts = (full.parts ?? []).filter((p) => ownPart(p.id));
  // its next moves: a review of its own parts, a wait on it, a form ask for it, its own steps; a run left pending is
  // every chapter's (the build has to finish before anything plays)
  const next = [];
  for (const m of full.next ?? []) {
    if (m.step === 'review' || m.step === 'advised') {
      const own = (m.parts ?? []).filter((p) => ownPart(p));
      if (own.length) next.push({ ...m, parts: own });
    } else if (m.step === 'form') {
      const own = (m.asks ?? []).filter((a) => a.for === c.id || a.field === c.id);
      if (own.length) next.push({ ...m, asks: own });
    } else if (m.step === 'req') {
      // the unit being worked: in its own view, and the build's (the director's)
      if (m.unit === id || id === 'build') next.push(m);
    } else if (m.step === 'compile') {
      // what the build would hit: the build's to see whole, each other chapter its own
      const own = (full.compile?.blockers ?? []).filter((b) => b.chapter === c.id && (lv === null || !b.step || ownStep(b.step)));
      if (id === 'build' || own.length) next.push({ ...m, blockers: id === 'build' ? m.blockers : own.length });
    } else if ((m.step === 'run' && m.pending) || chapterOfMove(m) === c) next.push(m);
  }
  const advice = Object.fromEntries(Object.entries(full.advice ?? {}).filter(([k]) => ADVICE[k] === c.id));
  // the pre-compile check: the build sees it whole, a chapter its own blockers
  const mineOf = (b) => b.chapter === c.id && (lv === null || !b.step || ownStep(b.step));
  const blockers = (full.compile?.blockers ?? []).filter(mineOf);
  const unfinishable = (full.compile?.advises ?? []).filter(mineOf);
  const sections = Object.fromEntries(Object.entries(full).filter(([k, v]) => SECTION[k] === c.id && v !== undefined));
  const made = Object.fromEntries(Object.entries(full.made ?? {}).filter(([k]) => ownStep(k)));
  const mineRan = (ran ?? []).filter((r) => ownStep(r.key));
  // the writes this call made outside the chapter: said, never refused (a department may reach past its pages)
  const inLevel = (p) => p === `/levels/${lv}` || p.startsWith(`/levels/${lv}/`);
  const outside = patched.filter((p) => (lv !== null ? !inLevel(p) : !chaptersOfPath(p).includes(c))).map((p) => `${p}: ${chaptersOfPath(p).map((x) => x.id).join(', ') || 'no chapter'}'s, not ${id}'s`);
  const read = [BOOK[id] ?? 'bible'].flat().map((k) => full[k]).find(Boolean) ?? full.bible;
  const anchor = parts[0]?.id ? `#${parts[0].id.replace(':', '-')}` : '';
  return {
    ref: full.ref,
    chapter: lv !== null
      // a level's state is its part's stamp; the chapter it belongs to is named
      ? { id, of: c.id, name: world.levels[lv].name ?? lv, department: c.department, state: parts[0]?.status ?? 'empty', ...(mine?.waits ? { waits: mine.waits } : {}), cards: [...LEVEL_PAGE_CARDS, ...c.cards.filter((x) => !x.endsWith('-*'))] }
      : { id, name: c.name, department: c.department, state: mine?.state ?? 'empty', ...(mine?.waits ? { waits: mine.waits } : {}), cards: c.cards.filter((x) => !x.endsWith('-*')) },
    parts,
    pages: lv !== null ? { [`/levels/${lv}`]: world.levels[lv] } : chapterPages(world, id),
    // a level's way in and out: the links that name it
    ...(lv !== null && Array.isArray(world.links) && world.links.some((e) => e?.from === lv || e?.to === lv) ? { links: world.links.filter((e) => e?.from === lv || e?.to === lv) } : {}),
    // upstream: what it is derived from, each its state and the print of its pages (moved: read that chapter again)
    reads: c.reads.map((r) => ({ id: r, state: book.find((x) => x.id === r)?.state ?? 'empty', print: fingerprint(chapterPages(world, r)) })),
    // the setting's backdrop, as this chapter reads it (lorecube/backdrop.js chapterDigest): its own part, never the whole
    ...(lv === null && world?.backdrop != null && chapterDigest(world.backdrop)[c.id] ? { backdrop: chapterDigest(world.backdrop)[c.id] } : {}),
    ...(Object.keys(advice).length ? { advice } : {}),
    ...(id !== 'build' && blockers.length ? { blockers } : {}),
    ...(id !== 'build' && unfinishable.length ? { advises: unfinishable } : {}),
    ...sections,
    ...(Object.keys(made).length ? { made } : {}),
    // (and what the run made for it in other chapters: the steps its orders name, a level's pilot, its foes)
    ...(ran ? { ran: mineRan, run: { steps: ran.length, made: ran.filter((r) => r.action === 'make' || r.action === 'remake').length, ...(also(ran, ownStep).length ? { also: also(ran, ownStep) } : {}), ...(pending?.length ? { pending: pending.length } : {}) } } : {}),
    ...(outside.length ? { outside } : {}),
    ...(read ? { read: `${read}${anchor}` } : {}),
    // the whole book, one word a chapter: where the others stand
    book: Object.fromEntries(book.map((x) => [x.id, x.state])),
    next,
  };
}
