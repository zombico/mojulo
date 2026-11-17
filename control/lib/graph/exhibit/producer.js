/**
 * THE EXHIBIT'S PRODUCER — the seat that faces a person with a concept to display (an educator, a curator: someone
 * with the right to exhibit and the knowledge), before anything is made. It asks only what they alone can answer, ONE
 * QUESTION A TURN, then says back the fit (fit.js): what their time and their people hold.
 *
 *   concept   what should people leave understanding?
 *   people    who is it for, and at what degrees of learning?
 *   time      roughly how long do they have with it?
 *   brought   what material do they bring: sources, label text, learning goals, pictures?
 *
 * A plain request to see something is made at once: nothing is asked. The producer leads only when the person speaks of
 * their people, their time, several subjects, or brings material (`needsProducer`).
 *
 * It never writes a claim or a source for them: it records what they said and lists what is open. Whether a claim is
 * true is the expert's (brief.js, the accuracy gate), never the agent's and never this readout's.
 *
 *   EXHIBIT_QUESTIONS            the four, in order: { id, ask }
 *   readStart(v)                 → { concept?, people?, time?, brought?, wants? } checked; throws, teaching
 *   needsProducer(start)         → does the person fit it to people, a time or material (true), or just ask to see
 *                                something (false: make it at once)?
 *   nearestExhibits(text, cards, n?) → [{ id, name, matched }] the exhibits whose own words the concept uses, most
 *                                first. A heuristic over words, said to be one: the agent, the real reader, picks, or
 *                                searches (semantic_search({ kinds: ['view_vocab'] })). `cards`: the exhibit catalog
 *                                (Map '<hall>/<id>' → card), handed in
 *   exhibitStart(start, { cards }) → { ok, readout: 'start', built: false, says, producer: { seat, ask, step, holds } |
 *                                null, next: [{ step, ask? … }], nearest?, uncovered?, fit? }
 *     next      the questions not yet answered, in order; with a concept, `place` (the exhibits it points at); once the
 *               four are answered, `make` (the fit's door)
 *     uncovered no exhibit's words match the concept: search, or compose a demo from laws, or say nothing makes it
 *     fit       once the time is known (people: everyone until said)
 *
 * Builds nothing and stores nothing. Pure: the catalog is handed in.
 */
import { exhibitFit, readTime, TIMES, TIME_IDS } from './fit.js';
import { AUDIENCES, AUDIENCE_WORDS } from './brief.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`get_exhibit: start${m}`);

export const EXHIBIT_QUESTIONS = Object.freeze([
  Object.freeze({ id: 'concept', ask: 'what should people leave understanding?' }),
  Object.freeze({ id: 'people', ask: `who is it for: ${AUDIENCES.map((a) => AUDIENCE_WORDS[a].toLowerCase()).join(', ')}, or more than one?` }),
  Object.freeze({ id: 'time', ask: `roughly how long do they have with it: ${TIME_IDS.map((k) => TIMES[k].name).join(', ')}?` }),
  Object.freeze({ id: 'brought', ask: 'do you have material for it: sources, label text, learning goals, pictures?' }),
]);
const KEYS = [...EXHIBIT_QUESTIONS.map((q) => q.id), 'wants'];
const CONCEPT_MAX = 600;

export function readStart(v) {
  if (!isObj(v)) throw fail(` is { ${KEYS.map((k) => `${k}?`).join(', ')} }: what the person has said so far (an empty one asks the first question)`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw fail(`.${k} is not one (${KEYS.join(', ')})`);
  const out = {};
  if (v.concept !== undefined) {
    if (typeof v.concept !== 'string' || !v.concept.trim() || v.concept.length > CONCEPT_MAX) throw fail(`.concept is what people should leave understanding, in a line or two (your reading of it, at most ${CONCEPT_MAX} characters)`);
    out.concept = v.concept.trim();
  }
  if (v.people !== undefined) {
    const list = Array.isArray(v.people) ? v.people : [v.people];
    if (!list.length || list.some((a) => !AUDIENCES.includes(a))) throw fail(`.people are who it is for: [${AUDIENCES.join(' | ')}]`);
    out.people = AUDIENCES.filter((a) => list.includes(a));
  }
  if (v.time !== undefined) { try { readTime(v.time); } catch (e) { throw fail(`.${e.message.replace(/^exhibit: a fit's /, '')}`); } out.time = v.time; }
  if (v.brought !== undefined) {
    if (v.brought !== 'none' && !(Array.isArray(v.brought) && v.brought.length)) throw fail(`.brought is 'none' (asked, they bring nothing) or the list of what they brought`);
    out.brought = v.brought;
  }
  if (v.wants !== undefined) { try { exhibitFit({ time: 'visit', wants: v.wants }); } catch (e) { throw fail(`.${e.message.replace(/^exhibit: a fit's /, '')}`); } out.wants = v.wants; }
  return out;
}

export function needsProducer(start) {
  const S = isObj(start) ? start : {};
  return S.people !== undefined || S.time !== undefined || (S.brought !== undefined && S.brought !== 'none') || isObj(S.wants) && Object.keys(S.wants).length > 0;
}

// the words that carry a concept: lower case, four letters or more, none of the words every sentence has
const COMMON = new Set(['about', 'what', 'when', 'where', 'which', 'that', 'this', 'these', 'those', 'with', 'from', 'into', 'have', 'they', 'their', 'them', 'there', 'people', 'should', 'leave', 'understand', 'understanding', 'show', 'works', 'work', 'does', 'make', 'makes', 'made', 'want', 'like', 'some', 'more', 'than', 'then', 'also', 'will', 'would', 'could', 'because', 'through', 'exhibit', 'visitor', 'visitors', 'students', 'class', 'lesson', 'learn', 'explain', 'things', 'before', 'after', 'daily', 'life']);
const wordsOf = (t) => [...new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !COMMON.has(w)))];
const textOf = (c) => ` ${[c.name, c.summary, c.when, c.id].filter((x) => typeof x === 'string').join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;

const named = (r) => (r.matched.some((w) => r.id.split('/').pop().split('-').includes(w)) ? 1 : 0);

export function nearestExhibits(text, cards, n = 3) {
  const words = wordsOf(text);
  if (!words.length || !cards) return [];
  return [...cards.entries()]
    .filter(([, c]) => c && c.index !== false)
    .map(([id, c]) => { const T = textOf(c); return { id, name: c.name, matched: words.filter((w) => T.includes(` ${w} `)) }; })
    .filter((r) => r.matched.length)
    // (most words first; then the exhibit a word NAMES, its own id, ahead of one that only mentions it)
    .sort((a, b) => b.matched.length - a.matched.length || named(b) - named(a) || a.id.localeCompare(b.id))
    .slice(0, n);
}

const HOLDS = 'one question a turn: ask this, wait for the answer, call again with what they said; write nothing for them';

export function exhibitStart(start, { cards = null } = {}) {
  const S = readStart(start ?? {});
  const open = EXHIBIT_QUESTIONS.filter((q) => S[q.id] === undefined);
  const leads = needsProducer(S);
  const nearest = S.concept ? nearestExhibits(S.concept, cards) : [];
  const fit = S.time !== undefined ? exhibitFit({ time: S.time, people: S.people, wants: S.wants }) : null;
  const next = [
    ...(S.concept ? [nearest.length
      ? { step: 'place', nearest, says: 'the exhibits the concept\'s words point at (a heuristic: pick, or search). Read one\'s manual before its params: get_exhibit({ id })' }
      : { step: 'place', says: 'no exhibit\'s own words match the concept' }] : []),
    ...open.map((q) => ({ step: q.id, ask: q.ask })),
    ...(!open.length && fit ? [{ step: 'make', size: fit.size, door: fit.door, says: `${fit.says} Say it back; with their yes, make it. The stops and the claims are written from what they said, never for them` }] : []),
  ];
  const lead = next.find((s) => typeof s.ask === 'string');
  // a bare ask (a concept and nothing of people, time or material): made at once, the questions there if they are an exhibitor
  const plain = !!S.concept && !leads;
  return {
    ok: true, readout: 'start', built: false,
    says: plain
      ? 'Nothing is made yet. A plain request to see something is made at once: make the exhibit its words point at (`place`), no questions. If they are fitting it to their people and a time (a class, a gallery, visitors), you are its PRODUCER: ask the one question (`producer.ask`).'
      : 'Nothing is made yet. You are this exhibit\'s PRODUCER: the person has the knowledge and the people; ask only what they alone can answer, one question a turn (`producer.ask`), then say back the fit before anything is made.',
    producer: lead ? { seat: 'producer', ask: lead.ask, step: lead.step, holds: HOLDS } : null,
    next,
    ...(nearest.length ? { nearest } : {}),
    ...(S.concept && !nearest.length ? { uncovered: { says: 'no exhibit names it in its own words: search (semantic_search({ kinds: [\'view_vocab\'] })); a demo no exhibit covers is composed from laws (science/classical, science/microscopic, science/quantum, science/relativistic); if nothing makes it, say so before anything is built' } } : {}),
    ...(fit ? { fit } : {}),
    ...(plain ? { plain: true } : {}),
  };
}
