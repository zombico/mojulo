/**
 * THE BACKDROP — narrative lore, extracted: what a setting's text says happened, who was in it, how the world stands
 * where the text stops, and what it leaves open. The lorecube's narrative outcome: it feeds Time (the pre-game, a
 * place's starting state, what the cast remembers), never a mechanic. It is saved on a game (a gameworld's `backdrop`)
 * and handed to the game book chapter by chapter.
 *
 * IT EXTRACTS, IT NEVER AUTHORS. The principles it is held to:
 *   1. No event, name, motive, order or structure the text does not hold. A label the tool needs to point at something
 *      (a stretch of events) is a `handle`, never a name
 *   2. Every reading carries its BASIS: stated (in the text), inferred (and from what), asked (the author answered)
 *   3. What cannot be placed stays visible (`unknowns`); a contradiction is listed, never settled
 *   4. A clarification is a PATCH (`clarifyBackdrop`): it resolves named unknowns and touches nothing it does not name
 *   5. Nothing is projected past where the text stops
 *   6. The author's choices are GIVEN, never derived: where play begins, whose point of view, the route (`play`, whose
 *      basis is never `inferred`)
 *
 * WHAT A LORE DROP HOLDS (the statement kinds):
 *   actors     [{ id, name, kind: people | force, says? }]        a force is something no one commands
 *   events     [{ n, says, who?: [actor], at?: [place], from?: [n], stretch?, order?: 'unsaid' }]   in order; `from` the
 *              earlier events it comes from; `order: 'unsaid'` when the text does not say when it happened against the
 *              others (it is put after what it must follow, and said to be so)
 *   stretches  [{ id, handle, span?, agency: acted | watched | studied }]   runs of events; `agency` whether anyone in
 *              it can act, as the text says
 *   places     [{ id, name, state, who?: [actor] }]              the world as it stands where the text stops
 *   moves      [{ from, to, says, basis, because? }]             what passes between places
 *   texture    [words]                                           what living there is like; nothing follows from it
 *   wants      [{ who, wants, over?, basis, because?, state? }]  `over` the thing wanted, a word two wants can share
 *   conflicts  [{ id, between: [actor], over, state: resolved | open, basis, because?, stretch? }]
 *   threads    [words]                                           planted and not returned to
 *   unknowns   [words]                                           what the text does not say
 *   resolved   [words]                                           unknowns the author has since answered
 *   play       { begins?: { after: n }, pov?: { who }, route?: [{ place, shows: [n] }], basis: stated | asked }
 *
 * MADE IN PASSES (passes.js), a backdrop's ladder five rungs:
 *   premise    title, actors and events: what happened and who was in it. A raw-new pass's, and where it stops
 *   ordered    stretches, and every event in one
 *   present    places (and moves, texture): the world as it stands
 *   reading    wants, conflicts, threads, unknowns: what the tool reads in it, each with its basis
 *   play       the author's choices
 *
 *   newBackdrop({ title?, actors, events })          a RAW-NEW pass
 *   intensifyBackdrop(B, add) → { backdrop, open }   an INTENSIFICATION, rungs in order
 *   clarifyBackdrop(B, { resolves, …patches }) → backdrop   the author's answer, as a patch
 *   extendBackdrop(B, more) → backdrop               the author's FURTHER TEXT: lore comes in more than one drop. It adds
 *                                                    what the new text holds (actors, places, events set in after an
 *                                                    earlier one, a stretch for them, moves, texture, wants, conflicts,
 *                                                    threads, unknowns) and renumbers; what was there keeps its words.
 *                                                    Adding is the author's: the tool never extends a backdrop itself
 *   settleOrder(B, { events: [n], after: n, stretch? }) → backdrop   the author now says WHEN: events whose order was
 *                                                    unsaid are set after the event named (into the stretch named, if
 *                                                    it differs), marked no longer unsaid; renumbered, every reference
 *                                                    following; a cause must still come before what it causes
 *   readBackdrop(v)                                  a stored backdrop at any depth: read, or throws, teaching
 *   BACKDROP                                         the part (passes.js)
 *   backdropReport(B) → { uncaused, unordered, stretches, derived, open, placeEvents, coverage?, depth }
 *       what the tool works out, each reported and none decided: events with no stated cause; each stretch's events
 *       and whether anyone acts; conflicts two wants imply that are not listed (`derived`); the conflicts open where
 *       the text stops; the events that touch each place; given a route, how much of the backdrop it meets and what it
 *       misses; and how much there is (`depth`: stretches where someone acts, open conflicts) for the author to choose
 *       one story or several by. And `stakes`, from what passes between places: for each of the people, the places it
 *       is in, what those places give and what they need, whom it leans on (every place its own draw from, all the way
 *       up), who leans on it, and the open conflicts it is party to. Counted from the text's own moves, never weighed
 *   backdropLaws(B) → [{ law, ok, value }]           advice: known-refs, every-basis, in-order, caused, placed
 *   chapterDigest(B) → { <chapter id>: slice }       the game book's shapes: each chapter its own part of the backdrop
 *
 * Pure and deterministic.
 */
import { definePart } from './passes.js';

const fail = (m) => new Error(`lorecube: backdrop${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim().length > 0;

export const BASES = Object.freeze(['stated', 'inferred', 'asked']);
export const AGENCIES = Object.freeze({ acted: 'people act', watched: 'no one can act', studied: 'people watch and learn' });
export const ACTOR_KINDS = Object.freeze(['people', 'force']);
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const KEYS = ['title', 'part', 'actors', 'events', 'stretches', 'places', 'moves', 'texture', 'wants', 'conflicts', 'threads', 'unknowns', 'resolved', 'play'];

const only = (o, keys, at) => { for (const k of Object.keys(o)) if (!keys.includes(k)) throw fail(`${at}.${k} is not part of it (${keys.join(', ')})`); };
const list = (v, at, what) => { if (!Array.isArray(v)) throw fail(`${at} is a list of ${what}`); return v; };
const wordsOf = (v, at) => list(v, at, 'sentences').map((w, i) => { if (!str(w)) throw fail(`${at}[${i}] is a sentence`); return w.trim(); });
function basisOf(o, at) {
  if (!BASES.includes(o.basis)) throw fail(`${at}.basis is how it is known: ${BASES.join(', ')}`);
  if (o.basis === 'inferred' && !str(o.because)) throw fail(`${at} is inferred: say from what (because)`);
  return { basis: o.basis, ...(str(o.because) ? { because: o.because.trim() } : {}) };
}

/** A stored backdrop at any depth. */
export function readBackdrop(v) {
  if (!isObj(v)) throw fail(' is { title?, actors, events, stretches?, places?, moves?, texture?, wants?, conflicts?, threads?, unknowns?, resolved?, play? }');
  only(v, KEYS, '');
  const out = {};
  for (const k of ['title', 'part']) if (v[k] !== undefined) { if (!str(v[k])) throw fail(`.${k} is a few words`); out[k] = v[k].trim(); }

  out.actors = list(v.actors, '.actors', '{ id, name, kind, says? }').map((a, i) => {
    const at = `.actors[${i}]`;
    if (!isObj(a)) throw fail(`${at} is { id, name, kind, says? }`);
    only(a, ['id', 'name', 'kind', 'says'], at);
    if (!str(a.id) || !ID.test(a.id)) throw fail(`${at}.id is a short lower-case word`);
    if (!str(a.name)) throw fail(`${at}.name is what the text calls it`);
    if (!ACTOR_KINDS.includes(a.kind)) throw fail(`${at}.kind is people, or a force no one commands: ${ACTOR_KINDS.join(', ')}`);
    return { id: a.id, name: a.name.trim(), kind: a.kind, ...(str(a.says) ? { says: a.says.trim() } : {}) };
  });
  const actorIds = out.actors.map((a) => a.id);
  if (new Set(actorIds).size !== actorIds.length) throw fail('.actors: two share an id');
  const actor = (id, at) => { if (!actorIds.includes(id)) throw fail(`${at} '${id}' is no actor of this backdrop (${actorIds.join(', ')})`); return id; };

  const stretchIds = (Array.isArray(v.stretches) ? v.stretches : []).map((s) => s?.id);
  const placeIds = (Array.isArray(v.places) ? v.places : []).map((p) => p?.id);
  if (!Array.isArray(v.events) || !v.events.length) throw fail('.events is a list of { n, says, who?, at?, from?, stretch? }, in the order they happened');
  out.events = v.events.map((e, i) => {
    const at = `.events[${i}]`;
    if (!isObj(e)) throw fail(`${at} is { n, says, who?, at?, from?, stretch? }`);
    only(e, ['n', 'says', 'who', 'at', 'from', 'stretch', 'order'], at);
    if (e.n !== i + 1) throw fail(`${at}.n is ${i + 1}: events are numbered from 1 in the order they happened`);
    if (!str(e.says)) throw fail(`${at}.says is what happened`);
    const ev = { n: e.n, says: e.says.trim() };
    if (e.who !== undefined) ev.who = list(e.who, `${at}.who`, 'actors').map((w) => actor(w, `${at}.who`));
    if (e.at !== undefined) ev.at = list(e.at, `${at}.at`, 'places').map((p) => { if (!placeIds.includes(p)) throw fail(`${at}.at '${p}' is no place of this backdrop`); return p; });
    if (e.from !== undefined) ev.from = list(e.from, `${at}.from`, 'earlier events').map((n) => { if (!Number.isInteger(n) || n < 1 || n >= e.n) throw fail(`${at}.from ${n} is not an earlier event: a cause comes before what it causes`); return n; });
    if (e.stretch !== undefined) { if (!stretchIds.includes(e.stretch)) throw fail(`${at}.stretch '${e.stretch}' is no stretch of this backdrop`); ev.stretch = e.stretch; }
    if (e.order !== undefined) { if (e.order !== 'unsaid') throw fail(`${at}.order is 'unsaid' (the text does not say when it happened against the others), or left out`); ev.order = 'unsaid'; }
    return ev;
  });
  const nMax = out.events.length;

  if (v.stretches !== undefined) {
    out.stretches = list(v.stretches, '.stretches', '{ id, handle, span?, agency }').map((s, i) => {
      const at = `.stretches[${i}]`;
      if (!isObj(s)) throw fail(`${at} is { id, handle, span?, agency }`);
      if (s.name !== undefined) throw fail(`${at}.name: a stretch has a handle, not a name: the tool points at it, it does not title the author's eras`);
      only(s, ['id', 'handle', 'span', 'agency'], at);
      if (!str(s.id) || !ID.test(s.id)) throw fail(`${at}.id is a short lower-case word`);
      if (!str(s.handle)) throw fail(`${at}.handle is a few words to point at it by`);
      if (!AGENCIES[s.agency]) throw fail(`${at}.agency is whether anyone in it can act: ${Object.keys(AGENCIES).join(', ')}`);
      return { id: s.id, handle: s.handle.trim(), ...(str(s.span) ? { span: s.span.trim() } : {}), agency: s.agency };
    });
    if (new Set(stretchIds).size !== stretchIds.length) throw fail('.stretches: two share an id');
    const loose = out.events.filter((e) => !e.stretch).map((e) => e.n);
    if (loose.length) throw fail(`.stretches: events ${loose.join(', ')} are in none`);
    // a stretch is a run: its events are consecutive, and the stretches follow the events' order
    const order = out.events.map((e) => e.stretch).filter((s, i, a) => s !== a[i - 1]);
    if (new Set(order).size !== order.length) throw fail('.stretches: a stretch is one unbroken run of events');
  }

  if (v.places !== undefined) {
    out.places = list(v.places, '.places', '{ id, name, state, who? }').map((p, i) => {
      const at = `.places[${i}]`;
      if (!isObj(p)) throw fail(`${at} is { id, name, state, who? }`);
      only(p, ['id', 'name', 'state', 'who'], at);
      if (!str(p.id) || !ID.test(p.id)) throw fail(`${at}.id is a short lower-case word`);
      if (!str(p.name) || !str(p.state)) throw fail(`${at} has a name and the state it is in where the text stops`);
      return { id: p.id, name: p.name.trim(), state: p.state.trim(), ...(p.who !== undefined ? { who: list(p.who, `${at}.who`, 'actors').map((w) => actor(w, `${at}.who`)) } : {}) };
    });
    if (new Set(placeIds).size !== placeIds.length) throw fail('.places: two share an id');
  }
  const place = (id, at) => { if (!placeIds.includes(id)) throw fail(`${at} '${id}' is no place of this backdrop`); return id; };
  if (v.moves !== undefined) {
    out.moves = list(v.moves, '.moves', '{ from, to, says, basis }').map((m, i) => {
      const at = `.moves[${i}]`;
      if (!isObj(m)) throw fail(`${at} is { from, to, says, basis, because? }`);
      only(m, ['from', 'to', 'says', 'basis', 'because'], at);
      if (!str(m.says)) throw fail(`${at}.says is what passes`);
      return { from: place(m.from, `${at}.from`), to: place(m.to, `${at}.to`), says: m.says.trim(), ...basisOf(m, at) };
    });
  }
  for (const k of ['texture', 'threads', 'unknowns', 'resolved']) if (v[k] !== undefined) out[k] = wordsOf(v[k], `.${k}`);

  if (v.wants !== undefined) {
    out.wants = list(v.wants, '.wants', '{ who, wants, over?, basis, state? }').map((w, i) => {
      const at = `.wants[${i}]`;
      if (!isObj(w)) throw fail(`${at} is { who, wants, over?, basis, because?, state? }`);
      only(w, ['who', 'wants', 'over', 'basis', 'because', 'state'], at);
      if (!str(w.wants)) throw fail(`${at}.wants is what it is after`);
      return { who: actor(w.who, `${at}.who`), wants: w.wants.trim(), ...(str(w.over) ? { over: w.over.trim() } : {}), ...basisOf(w, at), ...(str(w.state) ? { state: w.state.trim() } : {}) };
    });
  }
  if (v.conflicts !== undefined) {
    out.conflicts = list(v.conflicts, '.conflicts', '{ id, between, over, state, basis }').map((c, i) => {
      const at = `.conflicts[${i}]`;
      if (!isObj(c)) throw fail(`${at} is { id, between, over, state, basis, because?, stretch? }`);
      only(c, ['id', 'between', 'over', 'state', 'basis', 'because', 'stretch'], at);
      if (!str(c.id) || !ID.test(c.id)) throw fail(`${at}.id is a short lower-case word`);
      if (!Array.isArray(c.between) || c.between.length < 2) throw fail(`${at}.between is two actors or more`);
      if (!str(c.over)) throw fail(`${at}.over is what it is over`);
      if (c.state !== 'resolved' && c.state !== 'open') throw fail(`${at}.state is resolved or open, where the text stops`);
      if (c.stretch !== undefined && !stretchIds.includes(c.stretch)) throw fail(`${at}.stretch '${c.stretch}' is no stretch of this backdrop`);
      return { id: c.id, between: c.between.map((w) => actor(w, `${at}.between`)), over: c.over.trim(), state: c.state, ...basisOf(c, at), ...(c.stretch ? { stretch: c.stretch } : {}) };
    });
  }

  if (v.play !== undefined) {
    const P = v.play;
    if (!isObj(P)) throw fail('.play is the author\'s choices: { begins?, pov?, route?, basis }');
    only(P, ['begins', 'pov', 'route', 'basis'], '.play');
    if (P.basis !== 'stated' && P.basis !== 'asked') throw fail('.play.basis is stated or asked: where play begins, whose eyes and the route are the author\'s to give, never the tool\'s to infer');
    const play = { basis: P.basis };
    if (P.begins !== undefined) { if (!isObj(P.begins) || !Number.isInteger(P.begins.after) || P.begins.after < 0 || P.begins.after > nMax) throw fail(`.play.begins is { after: an event, 0 to ${nMax} } (0: before any of it)`); play.begins = { after: P.begins.after }; }
    if (P.pov !== undefined) { if (!isObj(P.pov) || !str(P.pov.who)) throw fail('.play.pov is { who }: whose eyes, in the author\'s words'); play.pov = { who: P.pov.who.trim() }; }
    if (P.route !== undefined) {
      play.route = list(P.route, '.play.route', '{ place, shows }').map((r, i) => {
        const at = `.play.route[${i}]`;
        if (!isObj(r)) throw fail(`${at} is { place, shows: [events] }`);
        only(r, ['place', 'shows'], at);
        const shows = list(r.shows ?? [], `${at}.shows`, 'events').map((n) => { if (!Number.isInteger(n) || n < 1 || n > nMax) throw fail(`${at}.shows ${n} is no event of this backdrop`); return n; });
        return { place: place(r.place, `${at}.place`), shows };
      });
    }
    out.play = play;
  }
  return out;
}

const pick = (v, keys) => (isObj(v) ? Object.fromEntries(keys.filter((k) => v[k] !== undefined).map((k) => [k, v[k]])) : null);
const reads = (v) => { try { return readBackdrop(v); } catch { return null; } };
// the premise: the events as told (what happened, who was in it), without the rungs laid on them later
const bare = (v) => (isObj(v) && Array.isArray(v.events) ? { ...pick(v, ['title', 'part', 'actors']), events: v.events.map((e) => pick(e, ['n', 'says', 'who', 'order'])) } : null);
const RUNGS = { ordered: ['stretches'], present: ['places'], reading: ['wants', 'conflicts', 'threads', 'unknowns'], play: ['play'] };
const EXTRA = { present: ['moves', 'texture'], reading: ['resolved'] };

export const BACKDROP = definePart({
  id: 'backdrop',
  rungs: [
    { id: 'premise', rawNew: true, holds: (v) => !!bare(v) && !!reads(bare(v)), view: bare },
    ...Object.entries(RUNGS).map(([id, keys]) => ({
      id, holds: (v) => keys.every((k) => v[k] !== undefined) && !!reads(v), open: (v) => keys.filter((k) => v?.[k] === undefined),
      view: (v) => ({ ...pick(v, [...keys, ...(EXTRA[id] ?? [])]), ...(id === 'ordered' ? { in: v.events.map((e) => [e.stretch, e.from ?? []]) } : {}), ...(id === 'present' ? { at: v.events.map((e) => e.at ?? []) } : {}) }),
    })),
  ],
});

/** A raw-new pass: what happened and who was in it, and nothing read into it. */
export function newBackdrop(v) {
  if (!isObj(v)) throw fail(' is made from { title?, actors, events }');
  const more = Object.keys(v).filter((k) => KEYS.includes(k) && !['title', 'part', 'actors', 'events'].includes(k));
  if (more.length) throw fail(`.${more[0]} is not a raw-new pass's: it sets down what happened and who was in it and stops; ${more.join(', ')} ${more.length === 1 ? 'is' : 'are'} the next passes' (intensifyBackdrop)`);
  for (const e of Array.isArray(v.events) ? v.events : []) for (const k of ['at', 'from', 'stretch']) if (isObj(e) && e[k] !== undefined) throw fail(`.events: '${k}' is not a raw-new pass's (an event's cause, place and stretch are the next passes')`);
  return readBackdrop(v);
}

/** An intensification: the next rungs, in order. `events` may add each event's stretch, causes and places (by n). */
export function intensifyBackdrop(B, add = {}) {
  const base = readBackdrop(B);
  if (!isObj(add)) throw fail(' is intensified with the rungs that are missing');
  const next = { ...base };
  for (const [k, val] of Object.entries(add)) {
    if (['title', 'part', 'actors'].includes(k)) throw fail(`.${k} is its premise: an intensification adds under it and never changes it`);
    if (k === 'events') {
      if (!isObj(val)) throw fail('.events, in an intensification, is { <n>: { stretch?, from?, at? } }: what a later rung lays on an event, never its words');
      next.events = base.events.map((e) => {
        const a = val[e.n];
        if (a === undefined) return e;
        only(a, ['stretch', 'from', 'at'], `.events.${e.n}`);
        for (const f of Object.keys(a)) if (e[f] !== undefined) throw fail(`.events.${e.n}.${f} is already said`);
        return { ...e, ...a };
      });
      for (const n of Object.keys(val)) if (!base.events.some((e) => String(e.n) === n)) throw fail(`.events.${n} is no event of this backdrop`);
      continue;
    }
    if (!KEYS.includes(k)) throw fail(`.${k} is not part of a backdrop (${KEYS.join(', ')})`);
    if (base[k] !== undefined) throw fail(`.${k} is already said: an intensification adds the rungs that are missing and changes none (a correction is clarifyBackdrop)`);
    next[k] = val;
  }
  const backdrop = readBackdrop(next);
  const ids = Object.keys(RUNGS), held = ids.map((r) => RUNGS[r].every((k) => backdrop[k] !== undefined));
  const some = ids.map((r) => [...RUNGS[r], ...(EXTRA[r] ?? [])].some((k) => backdrop[k] !== undefined));
  const gap = held.findIndex((h, i) => !h && some.slice(i + 1).some(Boolean));
  if (gap >= 0) throw fail(`: its ${ids[some.lastIndexOf(true)]} is said before its ${ids[gap]} (${RUNGS[ids[gap]].filter((k) => backdrop[k] === undefined).join(', ')}): the rungs go in order`);
  const at = held.indexOf(false);
  return { backdrop, open: at < 0 ? [] : RUNGS[ids[at]].filter((k) => backdrop[k] === undefined) };
}

/**
 * The author's answer, as a patch: `resolves` names the unknowns it answers (each must be one), and the rest of the
 * patch changes only what it names: an actor, an event, a place by its id (fields laid over), sentences added to
 * texture, threads or unknowns, the author's `play`. Everything it does not name is as it was.
 */
export function clarifyBackdrop(B, patch = {}) {
  const base = readBackdrop(B);
  if (!isObj(patch)) throw fail(' is clarified with { resolves, actors?, events?, places?, texture?, threads?, unknowns?, play? }');
  only(patch, ['resolves', 'actors', 'events', 'places', 'conflicts', 'texture', 'threads', 'unknowns', 'play'], '.clarify');
  const resolves = wordsOf(patch.resolves ?? [], '.clarify.resolves');
  for (const r of resolves) if (!(base.unknowns ?? []).includes(r)) throw fail(`.clarify.resolves '${r}' is not one of its unknowns: a clarification answers what was open`);
  const next = { ...base };
  const over = (key, idOf, at) => {
    if (patch[key] === undefined) return;
    if (!isObj(patch[key])) throw fail(`${at} is { <id>: the fields to lay over it }`);
    const seen = new Set();
    next[key] = (base[key] ?? []).map((x) => { const p = patch[key][idOf(x)]; if (p === undefined) return x; seen.add(String(idOf(x))); return { ...x, ...p }; });
    // a place the author names for the first time is added; an actor or an event is never invented by a patch
    for (const [id, p] of Object.entries(patch[key])) if (!seen.has(id)) { if (key !== 'places') throw fail(`${at}.${id} is none of its ${key}`); next.places = [...(next.places ?? []), { id, ...p }]; }
  };
  over('actors', (a) => a.id, '.clarify.actors');
  over('events', (e) => e.n, '.clarify.events');
  over('places', (p) => p.id, '.clarify.places');
  over('conflicts', (c) => c.id, '.clarify.conflicts');
  for (const k of ['texture', 'threads', 'unknowns']) if (patch[k] !== undefined) next[k] = [...(base[k] ?? []), ...wordsOf(patch[k], `.clarify.${k}`)];
  if (resolves.length) { next.unknowns = next.unknowns.filter((u) => !resolves.includes(u)); next.resolved = [...(base.resolved ?? []), ...resolves]; }
  if (patch.play !== undefined) next.play = { ...(base.play ?? {}), ...patch.play };
  return readBackdrop(next);
}

/**
 * The author's further text. `more`: { actors?, places?, stretches?: [{ id, handle, span?, agency, after: <stretch id> |
 * null }], events?: [{ says, who?, at?, from?, stretch?, order?, after: <n of the backdrop as it stands>, 0 for before
 * all }], moves?, texture?, wants?, conflicts?, threads?, unknowns? }. A new event's `from` names events of the
 * backdrop as it stands by their numbers, or an earlier new event as 'new:<its place in the list, from 1>'. Events are
 * renumbered; every reference to an event (a cause, the route, where play begins) follows it.
 */
export function extendBackdrop(B, more = {}) {
  const base = readBackdrop(B);
  if (!isObj(more)) throw fail(' is extended with what the further text holds: { actors?, places?, stretches?, events?, moves?, texture?, wants?, conflicts?, threads?, unknowns? }');
  only(more, ['actors', 'places', 'stretches', 'events', 'moves', 'texture', 'wants', 'conflicts', 'threads', 'unknowns'], '.extend');
  const next = { ...base };
  const addTo = (k, idOf) => {
    if (more[k] === undefined) return;
    const fresh = list(more[k], `.extend.${k}`, 'what the further text adds');
    if (idOf) for (const x of fresh) if ((base[k] ?? []).some((y) => idOf(y) === idOf(x))) throw fail(`.extend.${k} '${idOf(x)}' is already there: further text adds; a correction is clarifyBackdrop`);
    next[k] = [...(base[k] ?? []), ...fresh];
  };
  addTo('actors', (a) => a?.id); addTo('places', (p) => p?.id); addTo('moves'); addTo('wants'); addTo('conflicts', (c) => c?.id);
  for (const k of ['texture', 'threads', 'unknowns']) if (more[k] !== undefined) next[k] = [...(base[k] ?? []), ...wordsOf(more[k], `.extend.${k}`)];
  // a new stretch stands after the one it names (null: before every other)
  if (more.stretches !== undefined) {
    const out = [...(base.stretches ?? [])];
    for (const [i, st] of list(more.stretches, '.extend.stretches', '{ id, handle, span?, agency, after }').entries()) {
      if (!isObj(st) || !('after' in st)) throw fail(`.extend.stretches[${i}] says the stretch it comes after (after: an id, or null for before all)`);
      const { after, ...row } = st, at = after === null ? -1 : out.findIndex((x) => x.id === after);
      if (after !== null && at < 0) throw fail(`.extend.stretches[${i}].after '${after}' is no stretch of this backdrop`);
      out.splice(at + 1, 0, row);
    }
    next.stretches = out;
  }
  if (more.events !== undefined) {
    const fresh = list(more.events, '.extend.events', '{ says, after, who?, at?, from?, stretch?, order? }');
    for (const [i, e] of fresh.entries()) if (!isObj(e) || !Number.isInteger(e.after) || e.after < 0 || e.after > base.events.length) throw fail(`.extend.events[${i}].after is the event it follows, as the backdrop stands: 0 to ${base.events.length} (0: before all)`);
    // the new order: each old event, then the new ones set after it, in the order given
    const seq = [];
    const put = (n) => fresh.forEach((e, i) => { if (e.after === n) seq.push({ fresh: i }); });
    put(0);
    for (const e of base.events) { seq.push({ old: e.n }); put(e.n); }
    const oldTo = {}, newTo = {};
    seq.forEach((x, i) => { if (x.old !== undefined) oldTo[x.old] = i + 1; else newTo[x.fresh] = i + 1; });
    const ref = (r, at) => {
      if (Number.isInteger(r) && oldTo[r]) return oldTo[r];
      const m = /^new:(\d+)$/.exec(String(r));
      if (m && newTo[Number(m[1]) - 1]) return newTo[Number(m[1]) - 1];
      throw fail(`${at} '${r}' is an event of the backdrop as it stands (its number), or an earlier new one ('new:<its place in the list>')`);
    };
    next.events = seq.map((x, i) => {
      if (x.old !== undefined) { const e = base.events[x.old - 1]; return { ...e, n: i + 1, ...(e.from ? { from: e.from.map((r) => oldTo[r]) } : {}) }; }
      const { after: _a, ...e } = fresh[x.fresh];
      return { ...e, n: i + 1, ...(e.from ? { from: e.from.map((r) => ref(r, `.extend.events[${x.fresh}].from`)) } : {}) };
    });
    if (base.play) next.play = { ...base.play, ...(base.play.begins ? { begins: { after: base.play.begins.after === 0 ? 0 : oldTo[base.play.begins.after] } } : {}), ...(base.play.route ? { route: base.play.route.map((r) => ({ ...r, shows: r.shows.map((n) => oldTo[n]) })) } : {}) };
  }
  return readBackdrop(next);
}

/** The author says when: events whose order was unsaid, set after the event named. */
export function settleOrder(B, { events, after, stretch } = {}) {
  const base = readBackdrop(B);
  const moved = list(events, '.settle.events', 'the events to place').map((n) => { if (!base.events.some((e) => e.n === n)) throw fail(`.settle.events ${n} is no event of this backdrop`); return n; });
  if (!moved.length) throw fail('.settle.events names the events the author has now placed');
  if (!Number.isInteger(after) || after < 0 || after > base.events.length || moved.includes(after)) throw fail(`.settle.after is the event they follow (0 to ${base.events.length}), and not one of them`);
  if (stretch !== undefined && !(base.stretches ?? []).some((x) => x.id === stretch)) throw fail(`.settle.stretch '${stretch}' is no stretch of this backdrop`);
  const rest = base.events.filter((e) => !moved.includes(e.n)), seq = [];
  const put = () => seq.push(...moved.map((n) => ({ ...base.events[n - 1], ...(stretch ? { stretch } : {}), settled: true })));
  if (after === 0) put();
  for (const e of rest) { seq.push(e); if (e.n === after) put(); }
  const to = Object.fromEntries(seq.map((e, i) => [e.n, i + 1]));
  const next = { ...base, events: seq.map(({ settled, order, ...e }, i) => ({ ...e, n: i + 1, ...(e.from ? { from: e.from.map((r) => to[r]) } : {}), ...(order && !settled ? { order } : {}) })) };
  for (const e of next.events) for (const r of e.from ?? []) if (r >= e.n) throw fail(`.settle: event '${e.says.slice(0, 40)}' would come before what it comes from: a cause comes first`);
  // the stretches follow the events' order
  if (base.stretches) { const first = (id) => next.events.findIndex((e) => e.stretch === id); next.stretches = [...base.stretches].filter((x) => first(x.id) >= 0).sort((x, y) => first(x.id) - first(y.id)); }
  if (base.play) next.play = { ...base.play, ...(base.play.begins ? { begins: { after: base.play.begins.after === 0 ? 0 : to[base.play.begins.after] } } : {}), ...(base.play.route ? { route: base.play.route.map((r) => ({ ...r, shows: r.shows.map((n) => to[n]) })) } : {}) };
  return readBackdrop(next);
}

/** What the tool works out: reported, never decided. */
export function backdropReport(B) {
  const V = readBackdrop(B), E = V.events;
  const uncaused = E.filter((e) => e.n > 1 && !(e.from ?? []).length).map((e) => e.n), unordered = E.filter((e) => e.order === 'unsaid').map((e) => e.n);
  const stretches = (V.stretches ?? []).map((s) => ({ id: s.id, handle: s.handle, agency: s.agency, acts: s.agency === 'acted', events: E.filter((e) => e.stretch === s.id).map((e) => e.n) }));
  // two actors after the same thing, with no conflict listing both: a conflict the wants imply
  const derived = [];
  const wants = V.wants ?? [];
  for (let i = 0; i < wants.length; i++) for (let j = i + 1; j < wants.length; j++) {
    const a = wants[i], b = wants[j];
    if (!a.over || a.over !== b.over || a.who === b.who) continue;
    if ((V.conflicts ?? []).some((c) => c.between.includes(a.who) && c.between.includes(b.who))) continue;
    if (!derived.some((d) => d.over === a.over && d.between.includes(a.who) && d.between.includes(b.who))) derived.push({ between: [a.who, b.who], over: a.over, basis: 'inferred', because: 'both want it' });
  }
  const open = (V.conflicts ?? []).filter((c) => c.state === 'open').map((c) => c.id);
  const placeEvents = Object.fromEntries((V.places ?? []).map((p) => [p.id, E.filter((e) => (e.at ?? []).includes(p.id)).map((e) => e.n)]));
  let coverage = null;
  if (V.play?.route) {
    const upTo = V.play.begins?.after ?? E.length, met = [...new Set(V.play.route.flatMap((r) => r.shows))].filter((n) => n <= upTo).sort((x, y) => x - y);
    coverage = { of: upTo, met: met.length, missed: E.map((e) => e.n).filter((n) => n <= upTo && !met.includes(n)), unvisited: (V.places ?? []).map((p) => p.id).filter((id) => !V.play.route.some((r) => r.place === id)) };
  }
  // who leans on whom: a place that receives leans on the place that gives, and on all that place leans on
  const moves = V.moves ?? [], places = V.places ?? [];
  const upstream = (id, seen = new Set()) => { for (const m of moves) if (m.to === id && !seen.has(m.from)) { seen.add(m.from); upstream(m.from, seen); } return seen; };
  const inPlace = (a) => places.filter((p) => (p.who ?? []).includes(a)).map((p) => p.id);
  const whoIn = (ids) => [...new Set(places.filter((p) => ids.includes(p.id)).flatMap((p) => p.who ?? []))];
  const stakes = V.actors.filter((a) => a.kind === 'people').map((a) => {
    const at = inPlace(a.id), up = [...new Set(at.flatMap((p) => [...upstream(p)]))].filter((p) => !at.includes(p));
    const down = places.map((p) => p.id).filter((p) => !at.includes(p) && [...upstream(p)].some((u) => at.includes(u)));
    return {
      who: a.id, in: at,
      gives: moves.filter((m) => at.includes(m.from) && !at.includes(m.to)).map((m) => m.says), needs: moves.filter((m) => at.includes(m.to) && !at.includes(m.from)).map((m) => m.says),
      // directly: whose places its own draw from, and whose draw from its own; then all the way up and down (where
      // flows loop, as demand going back does, the long reach takes in everyone: the direct one is the sharper read)
      draws_from: whoIn(moves.filter((m) => at.includes(m.to) && !at.includes(m.from)).map((m) => m.from)).filter((x) => x !== a.id),
      supplies: whoIn(moves.filter((m) => at.includes(m.from) && !at.includes(m.to)).map((m) => m.to)).filter((x) => x !== a.id),
      leans_on: whoIn(up).filter((x) => x !== a.id), leaned_on_by: whoIn(down).filter((x) => x !== a.id),
      open: (V.conflicts ?? []).filter((c) => c.state === 'open' && c.between.includes(a.id)).map((c) => c.id),
    };
  });
  return {
    uncaused, unordered, stretches, derived, open, placeEvents, ...(places.length ? { stakes } : {}), ...(coverage ? { coverage } : {}),
    depth: { stretches: stretches.length, acted: stretches.filter((s) => s.acts).length, open: open.length, says: 'how much there is: the stretches where someone acts, and the conflicts still open. One story or several is the author\'s to choose' },
  };
}

/** The laws a backdrop is held to: advice, never a refusal. */
export function backdropLaws(B) {
  const V = readBackdrop(B), R = backdropReport(V);
  const laws = [{ law: 'caused', ok: R.uncaused.length === 0, value: R.uncaused.join(', ') || 'every event after the first names where it comes from' }];
  if (V.places) {
    const nowhere = V.events.filter((e) => !(e.at ?? []).length).map((e) => e.n);
    laws.push({ law: 'placed', ok: nowhere.length === 0, value: nowhere.join(', ') || 'every event touches a place' });
  }
  if (V.conflicts) {
    laws.push({ law: 'derived-said', ok: R.derived.length === 0, value: R.derived.map((d) => `${d.between.join(' and ')} over ${d.over}`).join('; ') || 'none unlisted' });
    const inferred = [...(V.wants ?? []), ...V.conflicts, ...(V.moves ?? [])].filter((x) => x.basis === 'inferred').length;
    laws.push({ law: 'mostly-stated', ok: inferred <= [...(V.wants ?? []), ...V.conflicts, ...(V.moves ?? [])].length / 2, value: `${inferred} inferred` });
  }
  if (R.coverage) laws.push({ law: 'route-meets-backdrop', ok: R.coverage.missed.length === 0, value: R.coverage.missed.join(', ') || 'all' });
  return laws;
}

/** The game book's shapes: each chapter its own part of the backdrop (gameworld/chapters.js ids). */
export function chapterDigest(B) {
  const V = readBackdrop(B), R = backdropReport(V), name = Object.fromEntries(V.actors.map((a) => [a.id, a.name]));
  const upTo = V.play?.begins?.after ?? V.events.length;
  const people = V.actors.filter((a) => a.kind === 'people'), forces = V.actors.filter((a) => a.kind === 'force');
  const wantsOf = (id) => (V.wants ?? []).filter((w) => w.who === id).map((w) => ({ wants: w.wants, basis: w.basis, ...(w.state ? { state: w.state } : {}) }));
  const out = {
    // what game it is: where play begins, whose eyes, what is open, how much there is
    intent: { ...(V.title ? { title: V.title } : {}), ...(V.play ? { play: V.play } : { play: 'not given: where play begins and whose eyes are the author\'s to say' }), open: (V.conflicts ?? []).filter((c) => c.state === 'open').map((c) => ({ id: c.id, between: c.between.map((x) => name[x]), over: c.over })), depth: R.depth, ...(V.unknowns?.length ? { unknowns: V.unknowns } : {}) },
  };
  if (V.places || forces.length) out.world = { ...(V.places ? { places: V.places.map((p) => ({ id: p.id, name: p.name, state: p.state, made_by: R.placeEvents[p.id] ?? [] })) } : {}), ...(V.moves ? { moves: V.moves.map((m) => ({ from: m.from, to: m.to, says: m.says })) } : {}), ...(forces.length ? { forces: forces.map((f) => ({ name: f.name, ...(f.says ? { says: f.says } : {}) })) } : {}), ...(V.texture ? { texture: V.texture } : {}) };
  if (people.length) out.cast = { people: people.map((a) => ({ id: a.id, name: a.name, ...(a.says ? { says: a.says } : {}), wants: wantsOf(a.id) })) };
  // the story: the pre-game in order (what the opening and the cast's memory can draw on), never lines
  out.story = { before_play: V.events.filter((e) => e.n <= upTo).map((e) => ({ n: e.n, says: e.says, ...(e.stretch ? { stretch: e.stretch } : {}) })), ...(V.events.length > upTo ? { in_play: V.events.filter((e) => e.n > upTo).map((e) => ({ n: e.n, says: e.says })) } : {}), ...(R.coverage ? { coverage: R.coverage } : {}) };
  if ((V.conflicts ?? []).length || (V.threads ?? []).length) out['main-quest'] = { conflicts: (V.conflicts ?? []).map((c) => ({ id: c.id, between: c.between.map((x) => name[x]), over: c.over, state: c.state, basis: c.basis })), ...(V.threads?.length ? { threads: V.threads } : {}) };
  return out;
}
