import { describe, expect, it } from 'vitest';

import { readLessonBrief, lessonBriefData, LESSON_LOOK } from './lesson-brief.js';
import { lessonBriefSpec, lessonChannelScript } from '../scene/channels/lesson-brief.js';
import { LESSONS, PILOT_SCHOOL_LOOK, lessonLevel, pilotSchoolStart } from './pilot-school.js';
import { readGameworld } from './world.js';
import { THEME_CARDS } from '../playscape/ui/theme-cards/loader.js';
import { MSG_PAUSE } from '../game/level-contract.js';

// ── the lesson brief (gameworld/lesson-brief.js; its page, scene/channels/lesson-brief.js): Pilot School's instructor
// before each lesson, on mana-ui, the lesson held until Start; and the school's game on mana-ui in the logbook's look ──
// (a graded lesson flown at night, and one not graded: the brief's two shapes)
const night = LESSONS.find((L) => L.sky && L.sky.hour >= 19.5 && L.grade);

describe('the lesson brief', () => {
  it('reads an airspace level\'s lesson, teaching each fault', () => {
    expect(readLessonBrief(lessonLevel(night).airspace.lesson)).toEqual([]);
    const bad = (v, m) => expect(readLessonBrief(v).join(' ')).toMatch(m);
    bad(null, /\{ n, of, name/);
    bad({ n: 0, of: 4, name: 'x', tasks: ['a'] }, /place in the syllabus/);
    bad({ n: 3, of: 2, name: 'x', tasks: ['a'] }, /how many lessons/);
    bad({ n: 1, of: 1, name: 'x', tasks: [] }, /tasks' words/);
    bad({ n: 1, of: 1, name: 'x', tasks: ['a'], sky: 'fog' }, /must be one of/);
    bad({ n: 1, of: 1, name: 'x', tasks: ['a'], grade: { stars: [1, 2, 3] } }, /\{ time\?, slip\?, sink\? \}/);
    bad({ n: 1, of: 1, name: 'x', tasks: ['a'], why: 1 }, /not a lesson brief's/);
  });

  it('says the lesson in a student\'s words: its place in the syllabus, its sky, its tasks in order, what earns each medal', () => {
    const L = lessonLevel(night, { n: 4, of: 6 }).airspace.lesson, D = lessonBriefData(L);
    expect(D.kicker).toBe('Lesson 4 of 6');
    expect(D.name).toBe(night.name);
    // (the night's hour, its weather, the wind in knots, its moon)
    expect(D.sky).toMatch(/night/);
    expect(D.sky).toMatch(/kt|calm/);
    expect(D.sky).toMatch(/moon/);
    expect(D.tasks.map((t) => t.text)).toEqual(night.tasks.map((t) => t.text));
    expect(D.tasks.map((t) => t.n)).toEqual(night.tasks.map((_, i) => `${i + 1}`));
    // (gold, silver, bronze, each by every criterion the lesson is graded on, the time as minutes and seconds)
    expect(D.medals.map((m) => m.medal)).toEqual(['gold', 'silver', 'bronze']);
    const g = night.grade.time[0];
    expect(D.medals[0].line).toContain(`under ${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`);
    if (night.grade.sink) expect(D.medals[0].line).toContain(`${night.grade.sink[0]} m/s`);
    // (an ungraded lesson has no medals to say; a morning's sky says its morning)
    expect(lessonBriefData({ n: 1, of: 1, name: 'x', tasks: ['a'], sky: { kind: 'fair', hour: 9.5 } })).toMatchObject({ medals: [], sky: expect.stringMatching(/^09:30, morning/) });
  });

  it('is drawn by mana-ui, its one screen ending on Start; its page holds the lesson until then', () => {
    const spec = lessonBriefSpec();
    expect(spec.start).toBe('brief');
    expect(JSON.stringify(spec.screens.brief)).toContain('lesson:start');
    const js = lessonChannelScript({ data: lessonBriefData(lessonLevel(night).airspace.lesson) });
    expect(() => new Function(js)).not.toThrow();
    // (held on the pause sidecar the shell's own pause uses, let go on Start; no dice)
    expect(js).toContain(JSON.stringify(MSG_PAUSE));
    expect(js).toContain('__mojLesson');
    expect(js).not.toMatch(/Math\.random/);
  });
});

describe('Pilot School on mana-ui', () => {
  it('dresses its game in the logbook\'s look (the creator\'s own ui wins), and briefs each lesson as it loads', () => {
    expect(THEME_CARDS[PILOT_SCHOOL_LOOK]).toBeTruthy();
    expect(LESSON_LOOK).toBe(PILOT_SCHOOL_LOOK);
    const W = pilotSchoolStart({}).world;
    expect(W.ui).toEqual({ theme: PILOT_SCHOOL_LOOK });
    expect(pilotSchoolStart({ ui: { theme: 'static' } }).world.ui).toEqual({ theme: 'static' });
    // (every lesson carries its brief: its place among them all, its words, the same tasks its goal flies)
    const ids = Object.keys(W.levels);
    ids.forEach((id, i) => {
      const L = W.levels[id];
      expect(L.airspace.lesson).toMatchObject({ n: i + 1, of: LESSONS.length, name: L.name });
      expect(L.airspace.lesson.tasks).toEqual(L.goal.flight.tasks.map((t) => t.text));
    });
    // (the world reads it as written, and a broken brief is refused naming its field)
    expect(() => readGameworld({ id: 'school', name: 'School', ...W })).not.toThrow();
    const broken = { ...W, levels: { ...W.levels, [ids[0]]: { ...W.levels[ids[0]], airspace: { ...W.levels[ids[0]].airspace, lesson: { n: 1, of: 4, name: 'x', tasks: [] } } } } };
    expect(() => readGameworld({ id: 'school', name: 'School', ...broken })).toThrow(/airspace\.lesson\.tasks/);
  });
});
