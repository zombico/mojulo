/**
 * THE LESSON BRIEF — Pilot School's instructor at the desk before each lesson, on mana-ui, over the lesson's own field as
 * it loads: the way a space campaign's mission is told on the holo table before it is flown (campaign/briefing-page.js),
 * in a flying school's words. The student reads where the lesson stands in the syllabus, what it teaches, the sky it is
 * flown in, the tasks in the order they come (the instructor's words, each said again in the air as it begins), and what
 * earns gold, silver and bronze; then Start. Until Start the lesson is held behind it (the pause the shell's own pause
 * uses), so the clock a grade reads starts with the student, not with the page.
 *
 *   LESSON_LOOK                     the look when none is said: the `logbook` theme card (a training logbook on a chart)
 *   readLessonBrief(v, at?)         → errors[] (teaching): an airspace level's `lesson` { n, of, name, brief?, sky?,
 *                                   tasks: [text], grade? }
 *   lessonBriefData(L)              → the brief's words: { kicker, name, brief, sky, tasks: [{ n, text }], medals:
 *                                   [{ medal, line }] }
 *
 * Drawn by the page's lesson channel (scene/channels/lesson-brief.js: its mana-ui spec, the lesson held until Start).
 *
 * Pure: the same lesson, the same brief.
 */
import { FLIGHT_SKIES, DEFAULT_HOUR, readSkyAsk } from '../skyscape/sky.js';

export const LESSON_LOOK = 'logbook';
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** An airspace level's `lesson`: every fault said. */
export function readLessonBrief(v, at = 'airspace.lesson') {
  if (!isObj(v)) return [`${at} is { n, of, name, brief?, sky?, tasks: [text], grade? }: the lesson's brief, told before it is flown`];
  const e = [];
  for (const k of Object.keys(v)) if (!['n', 'of', 'name', 'brief', 'sky', 'tasks', 'grade'].includes(k)) e.push(`${at}.${k} is not a lesson brief's (n, of, name, brief, sky, tasks, grade)`);
  if (!(Number.isInteger(v.n) && v.n >= 1)) e.push(`${at}.n is the lesson's place in the syllabus, from 1`);
  if (!(Number.isInteger(v.of) && v.of >= (v.n || 1))) e.push(`${at}.of is how many lessons the syllabus has, at least n`);
  if (typeof v.name !== 'string' || !v.name.trim()) e.push(`${at}.name is the lesson's name`);
  if (v.brief !== undefined && typeof v.brief !== 'string') e.push(`${at}.brief is a line: what the lesson teaches`);
  if (v.sky !== undefined) e.push(...readSkyAsk(v.sky, `${at}.sky`));
  if (!(Array.isArray(v.tasks) && v.tasks.length && v.tasks.every((t) => typeof t === 'string' && t.trim()))) e.push(`${at}.tasks are the tasks' words, in order (at least one)`);
  if (v.grade !== undefined && !(isObj(v.grade) && Object.entries(v.grade).every(([k, b]) => ['time', 'slip', 'sink'].includes(k) && Array.isArray(b) && b.length === 3 && b.every(Number.isFinite)))) e.push(`${at}.grade is { time?, slip?, sink? }, each [gold, silver, bronze] (the flight goal's grade)`);
  return e;
}

// (a time in minutes and seconds)
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
// (the sky in a student's words: its weather, the time of day, the wind in knots, the moon at night)
function skyWords(sky) {
  const S = typeof sky === 'string' ? { kind: sky } : isObj(sky) ? sky : {};
  const kind = S.kind ?? 'fair', K = FLIGHT_SKIES[kind] ?? FLIGHT_SKIES.fair, hour = S.hour ?? DEFAULT_HOUR;
  const what = K.read.split(': ')[1]?.split(',')[0] ?? kind, h = Math.floor(hour), m = Math.round((hour - h) * 60);
  const part = hour < 4.5 || hour >= 19.5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const kt = Math.round((S.wind?.speed ?? K.wind) * 1.944);
  return [`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}, ${part}`, `${kind[0].toUpperCase() + kind.slice(1)}, ${what}`, kt ? `wind ${kt} kt` : 'calm',
    ...(part === 'night' && Number.isFinite(S.moon) ? [S.moon > 0.6 ? 'a bright moon' : S.moon > 0.25 ? 'a half moon' : 'no moon to speak of'] : [])].join(' · ');
}
// (what earns a medal, by each criterion graded: the time, the seconds out of a band, the touchdown's sink)
function medalLines(grade) {
  const G = isObj(grade) ? grade : {};
  return ['gold', 'silver', 'bronze'].map((medal, i) => ({ medal, line: [
    ...(G.time ? [`under ${clock(G.time[i])}`] : []),
    ...(G.slip ? [`out of your bands under ${G.slip[i]} s`] : []),
    ...(G.sink ? [`touch down under ${G.sink[i]} m/s`] : []),
  ].join(', ') || 'the lesson done' }));
}

/** The brief's words, from an airspace level's `lesson`. */
export function lessonBriefData(L) {
  return {
    kicker: `Lesson ${L.n} of ${L.of}`, name: L.name, brief: L.brief ?? '', sky: skyWords(L.sky),
    tasks: L.tasks.map((text, i) => ({ n: `${i + 1}`, text })), medals: L.grade ? medalLines(L.grade) : [],
  };
}
