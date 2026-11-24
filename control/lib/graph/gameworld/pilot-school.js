/**
 * PILOT SCHOOL — the realistic flight rail's starter: a licence earned lesson by lesson, each a level flown for its tasks
 * (flight-goal.js) and graded bronze to gold (game/grade.js) by how long it took and how cleanly it held its bands. The
 * syllabus is a light trainer's, on one island airfield in farmed country (a market town, villages, lanes, a line of
 * pylons: skyscape/country.js), flown on the sim assist (the bank holds where it is put, the
 * stall is real), its lessons in order:
 *
 *   lesson-1  First flight              the throttle, the take-off, the first rings, leveling off over the field
 *   lesson-2  Straight and level, turns  the runway heading held, then turns to new headings, each held
 *   lesson-3  Climbs and descents       climbed to a height and held, descended under a speed and held, leveled
 *   lesson-4  Night circuit             after dark: a left-hand circuit at 280 m (upwind, crosswind, downwind, base,
 *                                       final) and a landing on the runway lights, its touchdown graded by its sink
 *
 * A lesson's numbers are said against the airfield (flight-goal.js: `height` over the runway, `turn` from its heading),
 * so they hold on any seed's island. A crash ends the attempt; the instructor's words are each task's text, said as it
 * begins. The rest of the syllabus (the stall, the cross-country, the crosswind, the check ride and the licence) is laid by
 * later lessons on the same words.
 *
 * Its game runs on mana-ui, as Rebel Storm's does: its title, its lessons, its pause and each lesson's graded result in
 * the logbook's look (the shell remembers each lesson's best medal), and each lesson opens with the instructor's brief over
 * its field as it loads (gameworld/lesson-brief.js: where it stands in the syllabus, its sky, its tasks, what earns each
 * medal), the lesson held until Start, so the clock its grade reads starts with the student.
 *
 *   PILOT_SCHOOL                    the school's craft, assist and airfield
 *   PILOT_SCHOOL_LOOK               the look mana-ui draws it in: the `logbook` theme card
 *   LESSONS                         the lessons, in order: { id, name, brief, sky, tasks, grade } (sky: the lesson's
 *                                   weather, skyscape/sky.js)
 *   lessonLevel(lesson, { n, of }?) → a gameworld level: its airspace (its brief as `lesson`) and its flight goal
 *   pilotSchoolStart(world)         → { world }: the rail's starter, its lessons under what the creator wrote
 *
 * Pure: the same school lays the same lessons.
 */

// (a training logbook on a sectional chart: the theme card mana-ui draws its menus, its pause, its results and the
// lesson briefs in; nothing drawn across the view out of the canopy)
export const PILOT_SCHOOL_LOOK = 'logbook';

export const PILOT_SCHOOL = Object.freeze({
  craft: 'trainer', assist: 'sim',
  // (the island round the field is farmed country, skyscape/country.js: a market town, two villages, the lanes between
  // them and the field, a line of pylons and a mast; a student learns to fly over somewhere)
  airfield: Object.freeze({ pads: Object.freeze([Object.freeze({ kind: 'runway', at: Object.freeze([0.5, 0.25]) })]), country: Object.freeze({ towns: 1, villages: 2 }) }),
});

// a lift-off: the wheels off and climbing, three seconds clear of the ground
const LIFT_OFF = Object.freeze({ band: Object.freeze({ agl: Object.freeze([20, null]) }), seconds: 3 });

export const LESSONS = Object.freeze([
  Object.freeze({
    id: 'lesson-1', name: 'First flight', brief: 'Take off, climb out over the field, fly the first rings and level off.',
    // (a still morning, a few fair-weather clouds: the sky a first flight is booked for)
    sky: Object.freeze({ kind: 'fair', cover: 0.1, hour: 9.5, wind: Object.freeze({ speed: 3 }) }),
    tasks: Object.freeze([
      { ...LIFT_OFF, text: 'Open the throttle with W (it stays where you leave it). At 55 knots, ease the nose up with Space' },
      { gates: [1, 2], text: 'Fly through the first two rings: A and D bank, Space and Shift move the nose' },
      { band: { height: [180, 260] }, seconds: 10, text: 'Level off between 180 and 260 m over the field, and hold it' },
    ]),
    grade: Object.freeze({ time: [120, 180, 300], slip: [4, 10, 25] }),
  }),
  Object.freeze({
    id: 'lesson-2', name: 'Straight and level, and turns', brief: 'Hold a height and a heading, then turn to new ones and hold those.',
    sky: 'fair',
    tasks: Object.freeze([
      { ...LIFT_OFF, text: 'Take off as before' },
      { band: { height: [200, 260], turn: [-10, 10] }, seconds: 15, text: 'Climb to 230 m and hold it on the runway heading' },
      { band: { height: [200, 260], turn: [80, 100] }, seconds: 12, text: 'Turn right 90 degrees, keep your height, and hold the new heading' },
      { band: { height: [200, 260], turn: [170, 190] }, seconds: 12, text: 'Turn right again, back the way you came, and hold it' },
    ]),
    grade: Object.freeze({ time: [110, 170, 280], slip: [5, 12, 30] }),
  }),
  Object.freeze({
    id: 'lesson-3', name: 'Climbs and descents', brief: 'Climb to a height and hold it; come down under a speed and hold that.',
    // (an afternoon under mid-level cloud: plenty of room to climb under it)
    sky: Object.freeze({ kind: 'high', hour: 16 }),
    tasks: Object.freeze([
      { ...LIFT_OFF, text: 'Take off as before' },
      { band: { height: [370, 430] }, seconds: 10, text: 'Climb to 400 m: full throttle, the nose a little up, then level off and hold it' },
      { band: { height: [180, 240], speed: [null, 105] }, seconds: 10, text: 'Throttle back (S) and descend to 200 m, under 105 knots, and hold it' },
      { band: { height: [180, 240], climb: [-1.5, 1.5] }, seconds: 10, text: 'Hold it level: no climbing, no sinking' },
    ]),
    grade: Object.freeze({ time: [140, 210, 320], slip: [5, 12, 30] }),
  }),
  Object.freeze({
    id: 'lesson-4', name: 'Night circuit', brief: 'Fly a circuit of the field after dark and land on the runway lights.',
    // (a clear night, a bright moon, the town's lights to the north and the runway's own: no wind to speak of)
    sky: Object.freeze({ kind: 'clear', hour: 21.5, moon: 0.85, wind: Object.freeze({ speed: 2 }) }),
    // a left-hand circuit at 280 m over the runway: upwind, crosswind, downwind, base, final, the landing
    tasks: Object.freeze([
      { ...LIFT_OFF, text: 'Take off between the white edge lights; the green bar falls behind you' },
      { band: { height: [120, 400], turn: [-10, 10] }, seconds: 4, text: 'Climb straight out on the runway heading, past 120 m' },
      { band: { height: [230, 330], turn: [-100, -80] }, seconds: 15, text: 'Turn left onto crosswind and climb to circuit height, 280 m' },
      { band: { height: [250, 310], turn: [170, 190] }, seconds: 40, text: 'Turn left onto downwind and hold 280 m: the runway and its blue taxiway lights run past on your left' },
      { band: { height: [170, 290], turn: [80, 100] }, seconds: 3, text: 'Turn left onto base, throttle back and start down' },
      { band: { height: [90, 260], turn: [-12, 12] }, seconds: 4, text: 'Turn final: line up the approach lights; on the slope the PAPI left of the runway shows two white, two red' },
      { land: true, text: 'Keep the PAPI two white, two red down to the green bar, flare, and touch down soft' },
    ]),
    grade: Object.freeze({ time: [260, 330, 450], slip: [6, 14, 30], sink: [1.2, 2, 2.8] }),
  }),
]);

/** A lesson as a gameworld level: the school's airfield, its craft on the sim assist, its sky, the course its rings are
 *  (only a lesson that flies rings lays them), and its tasks graded. */
export function lessonLevel(lesson, { n = LESSONS.indexOf(lesson) + 1 || 1, of = LESSONS.length } = {}) {
  // (its brief, the instructor's before it is flown: where it stands in the syllabus, its sky, its tasks' words, its medals)
  const brief = { n, of, name: lesson.name, ...(lesson.brief ? { brief: lesson.brief } : {}), ...(lesson.sky ? { sky: JSON.parse(JSON.stringify(lesson.sky)) } : {}), tasks: lesson.tasks.map((t) => t.text), ...(lesson.grade ? { grade: JSON.parse(JSON.stringify(lesson.grade)) } : {}) };
  return {
    name: lesson.name,
    airspace: { map: { craft: PILOT_SCHOOL.craft }, ...(lesson.sky ? { sky: JSON.parse(JSON.stringify(lesson.sky)) } : {}), ground: { pads: PILOT_SCHOOL.airfield.pads.map((p) => ({ kind: p.kind, at: [...p.at] })), country: { ...PILOT_SCHOOL.airfield.country } }, course: lesson.tasks.some((t) => t.gates !== undefined), assist: PILOT_SCHOOL.assist, lesson: brief },
    goal: { flight: { tasks: lesson.tasks.map((t) => JSON.parse(JSON.stringify(t))), crash: 'fail', grade: JSON.parse(JSON.stringify(lesson.grade)) } },
  };
}

/** The rail's starter: the first lessons, under what the creator wrote (every key they wrote wins). */
export function pilotSchoolStart(world, { lessons = LESSONS.length } = {}) {
  const levels = Object.fromEntries(LESSONS.slice(0, lessons).map((L, i) => [L.id, lessonLevel(L, { n: i + 1, of: LESSONS.length })]));
  // (its title, its lessons, its pause and each lesson's graded result drawn by mana-ui in the logbook's look; each lesson
  // briefed by the instructor as it loads; the creator's own `ui` wins)
  return {
    world: {
      mode: 'autonomous', style: { kit: 'trail-valley' }, intent: { from: 'flight-sim' }, ui: { theme: PILOT_SCHOOL_LOOK }, start: LESSONS[0].id,
      ...world, levels,
    },
  };
}
