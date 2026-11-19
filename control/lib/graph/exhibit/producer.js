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
 *   readStart(v)                 → { concept?, people?, time?, brought?, scales?, wants? } checked; throws, teaching
 *   needsProducer(start)         → does the person fit it to people, a time or material (true), or just ask to see
 *                                something (false: make it at once)?
 *   exhibitStart(start) → { ok, readout: 'start', built: false, says, producer: { seat, ask, step, holds } | null,
 *                                next: [{ step, ask? … }], like, fit? }
 *     next      the questions not yet answered, in order; once the four are answered, `make`: the fit's door and
 *               the hand-off's `steps` (exhibitHandOff), a room at a time
 *     like      where the samples are, and that they are samples
 *     fit       once the time is known (people: everyone until said)
 *     scale     the rungs the concept lives at (scales.js), once the agent has named them (`scales`): what each shows,
 *               how a world at it is made new, its samples; a concept that spans rungs is a room a rung
 *     map       with a fit: the exhibit's map, a spine and its sequences (one page, or a lobby of rooms each stepped
 *               through), each room's scale and stops, the zoom between rooms
 *     intake    what they brought, read back (intake.js): what was placed and where, what was set aside, which of
 *               the questions their own material answered. Such a question is not asked: its step says `read`
 *
 * Builds nothing and stores nothing. Pure.
 */
import { exhibitFit, readTime, TIMES, TIME_IDS, EXHIBIT_SIZES } from './fit.js';
import { AUDIENCES, AUDIENCE_WORDS } from './brief.js';
import { readExhibitIntake, exhibitIntakeReport } from './intake.js';
import { SCALE_IDS, readScales, scaleReport } from './scales.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`create_exhibit: start${m}`);

// (the ids and their order are intake.js's QUESTION_IDS: a thing brought names the questions it answers by them)
export const EXHIBIT_QUESTIONS = Object.freeze([
  Object.freeze({ id: 'concept', ask: 'what should people leave understanding?' }),
  Object.freeze({ id: 'people', ask: `who is it for: ${AUDIENCES.map((a) => AUDIENCE_WORDS[a].toLowerCase()).join(', ')}, or more than one?` }),
  Object.freeze({ id: 'time', ask: `roughly how long do they have with it: ${TIME_IDS.map((k) => TIMES[k].name).join(', ')}?` }),
  Object.freeze({ id: 'brought', ask: 'do you have material for it: sources, label text, learning goals, pictures?' }),
]);
const KEYS = [...EXHIBIT_QUESTIONS.map((q) => q.id), 'scales', 'wants'];
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
    try { readExhibitIntake(v.brought); } catch (e) { throw fail(`.${e.message.replace(/^exhibit: /, '')}`); }
    out.brought = v.brought;
  }
  // (the rungs the concept lives at, scales.js: the agent's reading of the concept, never a question for the person)
  if (v.scales !== undefined) { try { out.scales = readScales(v.scales); } catch (e) { throw fail(`.${e.message.replace(/^exhibit: /, '')}`); } }
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

/**
 * THE HAND-OFF: where the producer's work ends and the making begins. Once the four are answered and the fit is said
 * back, the steps that make it, in order, a room at a time: the world made new at its scale, its tour and curation set
 * on it, then what joins the rooms, the machine gate, and the person's look. It PROPOSES: nothing is run, and nothing
 * the person did not say is written for them (an aim, a caption and a claim are theirs).
 *
 *   exhibitHandOff({ start, fit, scale }) → [{ step, room?, at?, … }]
 *     world    a room's world: how it is made at its scale (scales.js `made`), how it opens (its `view`), its parts
 *              named so a stop can light them
 *     tour     that world's tour and curation, set by update_sketch: how many stops the time holds, what the curation
 *              carries from what was said (the audiences, what was brought), and what only they can give (the aims,
 *              the claims and their sources)
 *     states   with `wants.compare`: the world at several settings, switched
 *     gallery  more than one room: the rooms joined, and the move between each two
 *     audit    the machine gate: get_exhibit({ ref, audit: true })
 *     sheet    a toured room's contact sheet (create_exhibit({ contact: ref })): every stop as a visitor meets it,
 *              what the agent looks at first and the person before the tour is finished
 *     show     the eyes gate, the person's; and the accuracy gate, the expert's
 */
export function exhibitHandOff({ start, fit, scale }) {
  const rooms = fit.size === 'gallery' ? fit.rooms : 1;
  const others = fit.audiences.filter((a) => a !== 'general');
  const curation = { aims: 'theirs: what a visitor should leave understanding, in their words (one to six)', ...(fit.audiences.length > 1 ? { audiences: fit.audiences } : {}), claims: 'theirs: what it states as fact, each with where it comes from; none is written for them', ...(start.brought !== undefined ? { brought: start.brought } : {}) };
  const steps = [];
  for (let i = 0; i < rooms; i++) {
    const R = scale?.rungs[i] ?? null, room = rooms > 1 ? { room: i + 1 } : {};
    steps.push({ step: 'world', ...room, ...(R ? { at: R.id, made: R.made, view: R.view, like: R.samples } : { made: 'a world made new from the primitives, at the scale the concept lives at' }), says: 'make it new, for their concept; name its parts, so a stop can light the one it speaks of' });
    if (fit.size !== 'view') {
      steps.push({ step: 'tour', ...room, stops: fit.stops, door: 'update_sketch({ ref, patch: [{ op: \'set\', path: \'/curation\', value }, { op: \'set\', path: \'/tour\', value: { stops } }] })',
        says: `up to ${fit.stops.about} stops (the time said holds no more). The first stands alone: someone who only passes leaves with the point. Each caption from what they said${others.length ? `, and said again for ${others.map((a) => AUDIENCE_WORDS[a].toLowerCase()).join(' and for ')} (the stop's \`captions\`)` : ''}; each stop frames the part it speaks of. Manual: get_view_vocab({ id: 'tour' })` });
    } else {
      steps.push({ step: 'tour', ...room, door: 'update_sketch({ ref, patch: [{ op: \'set\', path: \'/curation\', value }] })', says: 'no tour: the time holds one view. Its one sentence is the first aim, in their words' });
    }
  }
  steps[1].curation = curation;
  if (fit.states) steps.push({ step: 'states', door: EXHIBIT_SIZES.states.door, says: fit.states.says });
  if (rooms > 1) steps.push({ step: 'gallery', door: EXHIBIT_SIZES.gallery.door, ...(scale?.zoom.length ? { zoom: scale.zoom } : {}), says: 'the rooms joined, in the order told: a lobby lists them, each walked in turn. The wing\'s own aims ride the gallery\'s curation' });
  steps.push({ step: 'audit', door: 'get_exhibit({ ref, audit: true })', says: 'the machine gate: is there a story, is each claim graded and cited, can a stop be read in its time, does each stop show something' });
  if (fit.size !== 'view') steps.push({ step: 'sheet', door: 'create_exhibit({ contact: ref })', says: 'each room\'s contact sheet: every stop as a visitor meets it, a row a stop. Look at it yourself first, mend the stops in words (three rounds at most), then put it in front of them' });
  steps.push({ step: 'show', says: 'the person looks: the eyes gate is theirs, never claimed. Whether a claim is true is the expert\'s: their sign-off is recorded only when they say they signed' });
  return steps;
}

const HOLDS = 'one question a turn: ask this, wait for the answer, call again with what they said; write nothing for them';

export function exhibitStart(start) {
  const S = readStart(start ?? {});
  const open = EXHIBIT_QUESTIONS.filter((q) => S[q.id] === undefined);
  const leads = needsProducer(S);
  // THE SCALE (scales.js): the exhibit determines it. The agent names the rungs the concept lives at; a concept that
  // spans several is a room a rung, so the fit's rooms are the rungs unless they asked for a number of their own
  const scale = S.scales ? scaleReport(S.scales) : null;
  const wants = scale?.spans && S.wants?.rooms === undefined ? { ...(S.wants ?? {}), rooms: S.scales.length } : S.wants;
  const fit = S.time !== undefined ? exhibitFit({ time: S.time, people: S.people, wants }) : null;
  // THE MAP: a spine and its sequences. One page stepped through, or a lobby of rooms each stepped through, walked in
  // order (a kiosk walks it by itself); between rooms at different scales the visitor zooms. Nothing branches
  const map = fit ? {
    form: fit.size === 'gallery' ? 'a spine of rooms: a lobby that lists them, each a page stepped through in order' : fit.size === 'tour' ? 'one page, stepped through in order' : 'one page',
    rooms: (fit.size === 'gallery' ? Array.from({ length: fit.rooms }, (_, i) => i) : [0]).map((i) => ({ ...(scale?.rungs[i] ? { at: scale.rungs[i].id } : {}), stops: fit.stops.about })),
    ...(scale?.zoom.length && fit.size === 'gallery' ? { zoom: scale.zoom } : {}),
  } : null;
  // (what they brought, intake.js: a question their own material answered is never asked: it is READ, the agent writing
  // the answer from the item and calling again with it)
  const intake = exhibitIntakeReport(S.brought);
  const read = (q) => (intake && !intake.none ? intake.answered[q] ?? null : null);
  const next = [
    ...(S.concept && !scale ? [{ step: 'scale', says: 'read the concept and name the rungs it lives at, its home first (a concept that spans several is a room a rung): call again with `scales`. Yours to read, never a question for them', rungs: SCALE_IDS }] : []),
    ...open.map((q) => (read(q.id) ? { step: q.id, read: read(q.id), says: `their own material says it (${read(q.id).join(', ')}): write it as \`${q.id}\` from what it says and call again; do not ask them again` } : { step: q.id, ask: q.ask })),
    ...(!open.length && fit ? [{ step: 'make', size: fit.size, door: fit.door, says: `${fit.says} Say it back; with their yes, make it new from the primitives. The stops and the claims are written from what they said, never for them`, steps: exhibitHandOff({ start: S, fit, scale }) }] : []),
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
    ...(scale ? { scale } : {}),
    ...(map ? { map } : {}),
    ...(intake ? { intake } : {}),
    ...(fit ? { fit } : {}),
    ...(plain ? { plain: true } : {}),
  };
}
