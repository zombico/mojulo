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
 * THE EXHIBIT IS MADE NEW. The agent composes it from the primitives a world is made of, for this person's concept: the
 * halls' exhibits are SAMPLES of what one is like (how a tour steps, how a part is lit, how a claim is graded), read for
 * their form and never offered as the thing to make. So nothing here matches a concept's words to a catalog: the agent
 * is the reader, and the maker.
 *
 * It never writes a claim or a source for them: it records what they said and lists what is open. Whether a claim is
 * true is the expert's (brief.js, the accuracy gate), never the agent's and never this readout's.
 *
 *   EXHIBIT_QUESTIONS            the four, in order: { id, ask };  LIKE  where the samples are, and what they are for
 *   readStart(v)                 → { concept?, people?, time?, brought?, wants? } checked; throws, teaching
 *   needsProducer(start)         → does the person fit it to people, a time or material (true), or just ask to see
 *                                something (false: make it at once)?
 *   exhibitStart(start) → { ok, readout: 'start', built: false, says, producer: { seat, ask, step, holds } | null,
 *                                next: [{ step, ask? … }], like, fit? }
 *     next      the questions not yet answered, in order; once the four are answered, `make` (the fit's door)
 *     like      where the samples are, and that they are samples
 *     fit       once the time is known (people: everyone until said)
 *
 * Builds nothing and stores nothing. Pure.
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

/** Where the samples are, and what they are for. */
export const LIKE = Object.freeze({
  says: 'the halls hold exhibits already made: SAMPLES of what one is like (how a tour steps, how a part is lit, how a claim is graded and cited). Read one for its form; make theirs new, from the primitives, for their concept',
  read: 'get_exhibit() lists the halls, get_exhibit({ hall }) one hall, get_exhibit({ id }) a sample in full; the tour and the curation: get_view_vocab({ id: \'tour\' })',
});

const HOLDS = 'one question a turn: ask this, wait for the answer, call again with what they said; write nothing for them';

export function exhibitStart(start) {
  const S = readStart(start ?? {});
  const open = EXHIBIT_QUESTIONS.filter((q) => S[q.id] === undefined);
  const leads = needsProducer(S);
  const fit = S.time !== undefined ? exhibitFit({ time: S.time, people: S.people, wants: S.wants }) : null;
  const next = [
    ...open.map((q) => ({ step: q.id, ask: q.ask })),
    ...(!open.length && fit ? [{ step: 'make', size: fit.size, door: fit.door, says: `${fit.says} Say it back; with their yes, make it new from the primitives. The stops and the claims are written from what they said, never for them` }] : []),
  ];
  const lead = next.find((s) => typeof s.ask === 'string');
  // a bare ask (a concept and nothing of people, time or material): made at once, the questions there if they are an exhibitor
  const plain = !!S.concept && !leads;
  return {
    ok: true, readout: 'start', built: false,
    says: plain
      ? 'Nothing is made yet. A plain request to see something is made at once, new, from the primitives: no questions. If they are fitting it to their people and a time (a class, a gallery, visitors), you are its PRODUCER: ask the one question (`producer.ask`).'
      : 'Nothing is made yet. You are this exhibit\'s PRODUCER: the person has the knowledge and the people; ask only what they alone can answer, one question a turn (`producer.ask`), then say back the fit before anything is made. The exhibit is made new, for their concept.',
    producer: lead ? { seat: 'producer', ask: lead.ask, step: lead.step, holds: HOLDS } : null,
    next,
    like: LIKE,
    ...(fit ? { fit } : {}),
    ...(plain ? { plain: true } : {}),
  };
}
