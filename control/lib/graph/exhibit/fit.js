/**
 * THE FIT — what a person's time and people hold, said back before anything is made. The exhibit's producer faces
 * someone with a concept to display (an educator, a curator): they have the time and the people, and the knowledge. The
 * fit turns two of their answers (how long people have with it, and who they are) into the SIZE of what is made and a
 * budget of stops, so nobody writes a twenty-stop tour for a glance in passing.
 *
 * The exhibit is made NEW, by the agent, from the primitives a world is composed of: the halls' exhibits are samples of
 * what one is like, never the thing to pick. Every size here rides any world (a tour and a curation are opt-in keys of
 * any world's recipe; a gallery's room and a prepared state are any world), so the fit adds nothing a world could not
 * already be. Its arithmetic is the
 * tour's own (audit.js `holdSeconds`: a stop is held as long as its caption takes to read), so the fit and the exhibit's
 * machine gate agree on what a span of time holds.
 *
 *   EXHIBIT_SIZES      what is made, least first: view (one exhibit, one sentence), tour (one exhibit stepped through),
 *                      states (one exhibit at several settings, beside its tour), gallery (rooms, a tour each)
 *   TIMES              the words a person says for how long: glance | visit | sitting, each its span in seconds
 *   STOP               a stop's hold: { min, max, usual } seconds (holdSeconds at an empty, a usual and a long caption)
 *   ROOM_SECONDS       how long one room holds a visitor before the subject reads better as another room
 *   readTime(v)        → { time, seconds }: a TIMES word, a number of seconds, or { seconds | minutes }; throws, teaching
 *   exhibitFit({ time, people?, wants? }) → { size, door, time, seconds, stops: { min, about, max }, rooms?, states?,
 *                      audiences, layers: { glance, visit, study }, says, next? }
 *     people   who it is for (brief.js AUDIENCES; everyone when none is said): more than one is a caption per audience
 *              at every stop. A visitor reads one, so it adds words to write and no time to the visit
 *     wants    what the agent infers they want beyond a tour: { compare?: true } (one thing at several settings: the
 *              states), { rooms?: n } (several subjects: a gallery of n rooms)
 *     stops    what the span holds, read end to end (a ceiling to plan under: people also look, turn it and talk): `about` at a usual caption (never past the span), `max` at the shortest, `min`
 *              the fewest that fill it;
 *              for a gallery, each room's
 *     layers   what the fit serves at three depths of attention: the glance (the first view and its one sentence,
 *              standing alone), the visit (the tour in the time said), the study (what is there for someone who stays)
 *     next     the size up, and what it would add
 *
 * Advice, never a refusal: the person may ask for more or for less.
 * Pure and deterministic.
 */
import { holdSeconds } from './audit.js';
import { AUDIENCES, AUDIENCE_WORDS } from './brief.js';
import { TOUR_LIMITS } from './tour.js';
import { GALLERY_LIMITS } from './gallery.js';

const row = (o) => Object.freeze(o);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`exhibit: a fit's ${m}`);

/** What is made, least first, and how: each rides a world the agent makes new. */
export const EXHIBIT_SIZES = Object.freeze({
  view: row({ name: 'one exhibit', door: 'a world made new from the primitives, its parts named', says: 'one thing to look at and turn, with one sentence that stands alone' }),
  tour: row({ name: 'a toured exhibit', door: 'that world, then update_sketch({ ref, patch: [set /tour, set /curation] })', says: 'one exhibit stepped through: at each stop the view moves, a caption explains, the part it speaks of is lit' }),
  states: row({ name: 'an exhibit at several settings', door: "the world made once a setting, then create_sketch({ manifest: { kind: 'exhibit-states', states: [{ ref, label }] } })", says: 'the same thing prepared several ways and switched, so a visitor sees what changes' }),
  gallery: row({ name: 'a gallery of rooms', door: 'a toured world a room, then create_exhibit({ rooms: [refs] })', says: 'several exhibits walked as one, a room a subject, each with its own tour' }),
});
export const EXHIBIT_SIZE_IDS = Object.freeze(Object.keys(EXHIBIT_SIZES));

/** How long people have with it, in the words a person says. */
export const TIMES = Object.freeze({
  glance: row({ name: 'a glance', says: 'seen in passing: under a minute', seconds: Object.freeze([10, 60]), at: 30 }),
  visit: row({ name: 'a visit', says: 'a stop of a few minutes', seconds: Object.freeze([60, 600]), at: 180 }),
  sitting: row({ name: 'a sitting', says: 'a lesson, a talk, a session: ten minutes to an hour', seconds: Object.freeze([600, 3600]), at: 1800 }),
});
export const TIME_IDS = Object.freeze(Object.keys(TIMES));

// a usual caption: a sentence or two, well under the audit's long-caption line
const USUAL_WORDS = 28;
const caption = (n) => Array.from({ length: n }, () => 'word').join(' ');
/** A stop's hold in seconds, as the page holds it (audit.js holdSeconds): at an empty, a usual and a long caption. */
export const STOP = Object.freeze({ min: holdSeconds(''), usual: holdSeconds(caption(USUAL_WORDS)), max: holdSeconds(caption(400)) });
/** How long one room holds a visitor before the subject reads better as another room: four minutes of one tour. */
export const ROOM_SECONDS = 240;

export function readTime(v) {
  if (typeof v === 'string') {
    if (!TIMES[v]) throw fail(`time is how long people have with it: ${TIME_IDS.map((k) => `${k} (${TIMES[k].says})`).join('; ')}; or seconds, or { minutes }`);
    return { time: v, seconds: TIMES[v].at };
  }
  const seconds = typeof v === 'number' ? v : isObj(v) && Object.keys(v).length === 1 && typeof v.seconds === 'number' ? v.seconds : isObj(v) && Object.keys(v).length === 1 && typeof v.minutes === 'number' ? v.minutes * 60 : NaN;
  if (!(Number.isFinite(seconds) && seconds > 0)) throw fail(`time is ${TIME_IDS.join(' | ')}, a number of seconds, or { seconds } or { minutes }`);
  const time = TIME_IDS.find((k) => seconds < TIMES[k].seconds[1]) ?? TIME_IDS[TIME_IDS.length - 1];
  return { time, seconds: Math.round(seconds) };
}

function readPeople(v) {
  if (v === undefined || v === null) return ['general'];
  const list = Array.isArray(v) ? v : [v];
  if (!list.length || list.some((a) => !AUDIENCES.includes(a))) throw fail(`people are who it is for: [${AUDIENCES.map((a) => `${a} (${AUDIENCE_WORDS[a]})`).join(' | ')}]`);
  // (everyone is always written for: the caption is theirs, the others say it their way)
  return AUDIENCES.filter((a) => a === 'general' || list.includes(a));
}

function readWants(w) {
  if (w === undefined || w === null) return {};
  if (!isObj(w)) throw fail('wants are { compare?, rooms? }');
  for (const k of Object.keys(w)) if (!['compare', 'rooms'].includes(k)) throw fail(`wants.${k} is not one (compare, rooms)`);
  if (w.compare !== undefined && typeof w.compare !== 'boolean') throw fail('wants.compare is true when they want to show what changes between settings');
  if (w.rooms !== undefined && !(Number.isInteger(w.rooms) && w.rooms >= 1 && w.rooms <= GALLERY_LIMITS.rooms)) throw fail(`wants.rooms is how many subjects it has: 1 to ${GALLERY_LIMITS.rooms}`);
  return { ...(w.compare ? { compare: true } : {}), ...(w.rooms > 1 ? { rooms: w.rooms } : {}) };
}

// what a span of seconds holds as stops: the fewest that fill it, about how many at a usual caption, the most that fit
const budget = (seconds) => ({ min: Math.max(1, Math.ceil(seconds / STOP.max)), about: Math.max(1, Math.floor(seconds / STOP.usual)), max: Math.max(1, Math.floor(seconds / STOP.min)) });
const cap = (b, top) => ({ min: Math.min(b.min, top), about: Math.min(b.about, top), max: Math.min(b.max, top) });
const span = (s) => (s < 90 ? `${s} seconds` : `${Math.round(s / 60)} minutes`);
const many = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function exhibitFit({ time, people, wants } = {}) {
  const T = readTime(time), audiences = readPeople(people), W = readWants(wants);
  const whole = budget(T.seconds);
  // a span that holds no second stop is one view; one longer than a room holds a visitor is rooms
  const rooms = W.rooms ?? (T.seconds > ROOM_SECONDS ? Math.min(GALLERY_LIMITS.rooms, Math.ceil(T.seconds / ROOM_SECONDS)) : 1);
  const size = rooms > 1 ? 'gallery' : whole.about < 2 ? 'view' : 'tour';
  const stops = size === 'view' ? { min: 0, about: 1, max: 1 } : cap(budget(T.seconds / rooms), TOUR_LIMITS.stops);
  const states = W.compare === true;
  const others = audiences.filter((a) => a !== 'general');
  // (what the span HOLDS, read end to end: a ceiling to plan under, since people also look, turn it and talk)
  const made = size === 'gallery' ? `up to ${many(rooms, 'room')}, up to ${many(stops.about, 'stop')} each` : size === 'tour' ? `one exhibit with up to ${many(stops.about, 'stop')}` : 'one exhibit with one sentence';
  const up = size === 'view' ? 'tour' : size === 'tour' ? 'gallery' : null;
  return {
    size, door: EXHIBIT_SIZES[size].door, time: T.time, seconds: T.seconds, stops,
    ...(size === 'gallery' ? { rooms } : {}),
    ...(states ? { states: { door: EXHIBIT_SIZES.states.door, says: size === 'gallery' ? 'one room shows what changes between settings' : 'beside it, the same exhibit at several settings: a visitor switches and sees what changes' } } : {}),
    audiences,
    layers: {
      glance: 'the first view and its one sentence stand alone: someone who only passes still leaves with the point',
      visit: size === 'view' ? 'there is no more than the glance: the time said holds one view' : `the tour${size === 'gallery' ? 's' : ''}, in the time said: ${made}`,
      study: [others.includes('specialist') ? 'each stop said in depth for those who stay' : null, states ? 'the settings to switch' : null, 'the sources behind each claim, in its catalogue'].filter(Boolean).join('; '),
    },
    says: `${span(T.seconds)} holds ${made}${others.length ? `, each stop said ${others.length + 1} ways (${audiences.map((a) => AUDIENCE_WORDS[a].toLowerCase()).join(', ')})` : ''}${states ? '; and one at several settings to switch' : ''}.`,
    ...(up ? { next: { size: up, name: EXHIBIT_SIZES[up].name, says: EXHIBIT_SIZES[up].says } } : {}),
  };
}
