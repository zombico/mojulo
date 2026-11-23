/**
 * PILOT SCHOOL — the realistic flight rail's starter: a licence earned lesson by lesson, each a level flown for its tasks
 * (flight-goal.js) and graded bronze to gold (game/grade.js) by how long it took and how cleanly it held its bands. The
 * syllabus is a light trainer's, on one island airfield, flown on the sim assist (the bank holds where it is put, the
 * stall is real), its lessons in order:
 *
 *   lesson-1  First flight              the throttle, the take-off, the first rings, leveling off over the field
 *   lesson-2  Straight and level, turns  the runway heading held, then turns to new headings, each held
 *   lesson-3  Climbs and descents       climbed to a height and held, descended under a speed and held, leveled
 *
 * A lesson's numbers are said against the airfield (flight-goal.js: `height` over the runway, `turn` from its heading),
 * so they hold on any seed's island. A crash ends the attempt; the instructor's words are each task's text, said as it
 * begins. The rest of the syllabus (the circuit and the landing, the stall, the cross-country, the crosswind, the check
 * ride and the licence) is laid by later lessons on the same words.
 *
 *   PILOT_SCHOOL                    the school's craft, assist and airfield
 *   LESSONS                         the lessons, in order: { id, name, brief, tasks, grade }
 *   lessonLevel(lesson)             → a gameworld level: its airspace and its flight goal
 *   pilotSchoolStart(world)         → { world }: the rail's starter, the first lessons under what the creator wrote
 *
 * Pure: the same school lays the same lessons.
 */

export const PILOT_SCHOOL = Object.freeze({
  craft: 'trainer', assist: 'sim',
  airfield: Object.freeze({ pads: Object.freeze([Object.freeze({ kind: 'runway', at: Object.freeze([0.5, 0.25]) })]) }),
});

// a lift-off: the wheels off and climbing, three seconds clear of the ground
const LIFT_OFF = Object.freeze({ band: Object.freeze({ agl: Object.freeze([20, null]) }), seconds: 3 });

export const LESSONS = Object.freeze([
  Object.freeze({
    id: 'lesson-1', name: 'First flight', brief: 'Take off, climb out over the field, fly the first rings and level off.',
    tasks: Object.freeze([
      { ...LIFT_OFF, text: 'Open the throttle with W (it stays where you leave it). At 55 knots, ease the nose up with Space' },
      { gates: [1, 2], text: 'Fly through the first two rings: A and D bank, Space and Shift move the nose' },
      { band: { height: [180, 260] }, seconds: 10, text: 'Level off between 180 and 260 m over the field, and hold it' },
    ]),
    grade: Object.freeze({ time: [120, 180, 300], slip: [4, 10, 25] }),
  }),
  Object.freeze({
    id: 'lesson-2', name: 'Straight and level, and turns', brief: 'Hold a height and a heading, then turn to new ones and hold those.',
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
    tasks: Object.freeze([
      { ...LIFT_OFF, text: 'Take off as before' },
      { band: { height: [370, 430] }, seconds: 10, text: 'Climb to 400 m: full throttle, the nose a little up, then level off and hold it' },
      { band: { height: [180, 240], speed: [null, 105] }, seconds: 10, text: 'Throttle back (S) and descend to 200 m, under 105 knots, and hold it' },
      { band: { height: [180, 240], climb: [-1.5, 1.5] }, seconds: 10, text: 'Hold it level: no climbing, no sinking' },
    ]),
    grade: Object.freeze({ time: [140, 210, 320], slip: [5, 12, 30] }),
  }),
]);

/** A lesson as a gameworld level: the school's airfield, its craft on the sim assist, the course its rings are, and its
 *  tasks graded. */
export function lessonLevel(lesson) {
  return {
    name: lesson.name,
    airspace: { map: { craft: PILOT_SCHOOL.craft }, ground: { pads: PILOT_SCHOOL.airfield.pads.map((p) => ({ kind: p.kind, at: [...p.at] })) }, course: true, assist: PILOT_SCHOOL.assist },
    goal: { flight: { tasks: lesson.tasks.map((t) => JSON.parse(JSON.stringify(t))), crash: 'fail', grade: JSON.parse(JSON.stringify(lesson.grade)) } },
  };
}

/** The rail's starter: the first lessons, under what the creator wrote (every key they wrote wins). */
export function pilotSchoolStart(world, { lessons = 3 } = {}) {
  const levels = Object.fromEntries(LESSONS.slice(0, lessons).map((L) => [L.id, lessonLevel(L)]));
  return {
    world: {
      mode: 'autonomous', style: { kit: 'trail-valley' }, intent: { from: 'flight-sim' }, start: LESSONS[0].id,
      ...world, levels,
    },
  };
}
