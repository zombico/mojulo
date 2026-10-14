// The suggestion's LAWS, over a generated grid of scenes: every mood word and every stage kit as the place, crossed
// with the goals, the mechanics, the last level, the time and the weather. Worked examples of today's answers are
// characterization (score-suggest.char.test.js); these hold whatever the tuning.
import { describe, it, expect } from 'vitest';
import { suggestScore, levelScoreContext, scoreBrief, sceneFlavour, MOOD_PLANE, CLUB_PLANE, MOVES, REACH } from './score-suggest.js';
import { suggestFieldScore } from './field-cue.js';
import { SCORE_MOODS, fieldScore } from './field-score.js';
import { CLUB_MOODS, clubScore } from './club-score.js';
import { STAGE_KITS } from '../era/stage.js';
import { CLIMATE_NAMES } from '../weather/weather.js';

const MOMENTS = ['prayer', 'sorrow', 'betrayal', 'ceremony'];
const FIGHT_GOALS = ['battle', 'shoot', 'defend'];
const PLACES = [
  ...Object.keys(SCORE_MOODS).map((w) => ({ base: 'terrain', title: w })),
  ...Object.keys(STAGE_KITS).map((kit) => ({ kind: 'stage', kit, title: 'run' })),
  { base: 'dungeon' }, { base: 'city' }, { base: 'floorplan-world', title: 'apartment' },
];
const PLAYS = [
  {}, { goal: 'sneak' }, { goal: 'race' }, { goal: 'avoid' }, { goal: 'collect' }, { goal: 'battle' },
  { mechanics: ['hazard-damage'] }, { mechanics: ['hp-pool'] }, { mechanics: ['laps'] },
];
const grid = (fn) => {
  for (const place of PLACES) for (const play of PLAYS) for (const final of [false, true]) for (const time of [undefined, 'night']) for (const climate of ['', CLIMATE_NAMES[1]]) {
    fn({ mechanics: [], ...place, ...play, final, time, climate });
  }
};
const isFight = (c) => FIGHT_GOALS.includes(c.goal) || (c.mechanics || []).some((k) => ['hp-pool', 'defeat-all', 'waves'].includes(k));

describe('suggestScore: laws over the grid', () => {
  it('is deterministic: the same scene, the same answer', () => {
    grid((c) => expect(suggestScore(c)).toEqual(suggestScore(c)));
  });

  it('with no play it is the place\'s answer, unchanged', () => {
    for (const place of PLACES) for (const time of [undefined, 'night']) {
      const c = { ...place, time, style: 'field' }, p = suggestFieldScore(c), s = suggestScore(c);
      if (!p) { expect(s).toBeNull(); continue; }
      const { brief, ...rest } = s;
      expect(rest).toEqual({ ...p, place: p.mood });
    }
  });

  it('closure: a field answer is a field mood (never a stinger or a one-moment story cue); a club answer a club mood', () => {
    grid((c) => {
      const f = suggestScore({ ...c, style: 'field' }), k = suggestScore({ ...c, style: 'club' });
      if (f) {
        expect(SCORE_MOODS[f.mood]).toBeTruthy();
        expect(SCORE_MOODS[f.mood].stinger).toBeFalsy();
        expect(MOMENTS).not.toContain(f.mood);
        // a fight plays the scene's own music and changes to the fight's (audio.combat); anything else plays its mood
        expect(f.audio).toEqual(f.explore ? { soundtrack: `field:${f.explore}`, combat: `field:${f.mood}` } : { soundtrack: `field:${f.mood}` });
      }
      if (k) { expect(CLUB_MOODS[k.mood]).toBeTruthy(); expect(k.audio).toEqual(k.explore ? { soundtrack: `club:${k.explore}`, combat: `club:${k.mood}` } : { soundtrack: `club:${k.mood}` }); }
    });
  });

  it('a fight is fight music in either style, the last fight the hardest; nothing else is', () => {
    grid((c) => {
      const f = suggestScore({ ...c, style: 'field' }), k = suggestScore({ ...c, style: 'club' });
      if (!f) return;
      expect(['battle', 'boss'].includes(f.mood), JSON.stringify(c)).toBe(isFight(c));
      expect(['rave', 'peak'].includes(k.mood) && !(k.mood === 'peak' && !isFight(c)), JSON.stringify(c)).toBe(isFight(c));
      if (isFight(c)) { expect(f.mood).toBe(c.final ? 'boss' : 'battle'); expect(k.mood).toBe(c.final ? 'peak' : 'rave'); }
    });
  });

  it('a fight\'s explore score is the same scene\'s answer without the fight, and never fight music itself', () => {
    grid((c) => {
      if (!isFight(c)) return;
      for (const style of ['field', 'club']) {
        const s = suggestScore({ ...c, style });
        if (!s || !s.explore) continue;
        const calm = suggestScore({ ...c, style, goal: FIGHT_GOALS.includes(c.goal) ? undefined : c.goal, mechanics: c.mechanics.filter((k) => !['hp-pool', 'defeat-all', 'waves'].includes(k)) });
        expect(s.explore, JSON.stringify(c)).toBe(calm.mood);
        expect(['battle', 'boss', 'rave', 'peak']).not.toContain(s.explore);
      }
    });
  });

  it('play moves a place only toward an energy mood; triumph and the peak belong to the last level', () => {
    grid((c) => {
      const f = suggestScore({ ...c, style: 'field' });
      if (!f || isFight(c)) return;
      expect([f.place, ...MOVES, ...(c.final ? ['triumph'] : [])], JSON.stringify(c)).toContain(f.mood);
      const k = suggestScore({ ...c, style: 'club' });
      if (k.mood === 'peak') expect(c.final).toBe(true);
      expect([...REACH[sceneFlavour(c) ?? 'any'], ...(c.final ? ['peak'] : [])]).toContain(k.mood);
    });
  });

  it('direction: danger, a race, the clock or the last level never calm the music; stealth never brightens it', () => {
    const raise = [{ mechanics: ['hazard-damage'] }, { goal: 'race' }, { goal: 'avoid' }, { final: true }];
    for (const place of PLACES) for (const time of [undefined, 'night']) {
      const base = suggestScore({ mechanics: [], ...place, time, style: 'field' });
      if (!base) continue;
      for (const push of raise) {
        const moved = suggestScore({ mechanics: [], ...place, time, ...push, style: 'field' });
        expect(MOOD_PLANE[moved.mood][1], `${JSON.stringify(place)} + ${JSON.stringify(push)}`).toBeGreaterThanOrEqual(MOOD_PLANE[base.mood][1]);
      }
      const sneak = suggestScore({ mechanics: [], ...place, time, goal: 'sneak', style: 'field' });
      expect(MOOD_PLANE[sneak.mood][0], `${JSON.stringify(place)} sneak`).toBeLessThanOrEqual(MOOD_PLANE[base.mood][0]);
    }
  });

  it('reachability: every field mood a level can play, and every club mood, is some scene\'s answer', () => {
    const field = new Set(), club = new Set();
    grid((c) => {
      const f = suggestScore({ ...c, style: 'field' }), k = suggestScore({ ...c, style: 'club' });
      if (f) field.add(f.mood);
      if (k) club.add(k.mood);
    });
    for (const p of [{ title: 'corner cafe' }, { title: 'underwater reef' }, { title: 'neon lab' }]) for (const play of PLAYS) {
      const k = suggestScore({ mechanics: [], base: 'terrain', ...p, ...play });
      if (k) club.add(k.mood);
    }
    const playable = Object.keys(SCORE_MOODS).filter((m) => !SCORE_MOODS[m].stinger && !MOMENTS.includes(m));
    expect(playable.filter((m) => !field.has(m))).toEqual([]);
    expect(Object.keys(CLUB_MOODS).filter((m) => !club.has(m))).toEqual([]);
  });

  it('every mood has a point on its plane', () => {
    expect(Object.keys(MOOD_PLANE).sort()).toEqual(Object.keys(SCORE_MOODS).sort());
    expect(Object.keys(CLUB_PLANE).sort()).toEqual(Object.keys(CLUB_MOODS).sort());
  });
});

describe('the brief agrees with the generator', () => {
  const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 3);
  it('every generated cue\'s tempo lies inside its brief\'s band, field and club', () => {
    for (const mood of Object.keys(SCORE_MOODS)) {
      const [lo, hi] = scoreBrief(mood).tempo;
      for (const seed of SEEDS) { const bpm = fieldScore(mood, { seed }).bpm; expect(bpm >= lo && bpm <= hi, `${mood} ${seed}: ${bpm} in ${lo}–${hi}`).toBe(true); }
    }
    for (const mood of Object.keys(CLUB_MOODS)) {
      const [lo, hi] = scoreBrief(mood, 'club').tempo;
      for (const seed of SEEDS) { const bpm = clubScore(mood, { seed }).bpm; expect(bpm >= lo && bpm <= hi, `${mood} ${seed}`).toBe(true); }
    }
  });
});

describe('levelScoreContext', () => {
  it('reads every stage kit to a place: a level laid on any kit gets a suggestion', () => {
    for (const kit of Object.keys(STAGE_KITS)) expect(suggestScore(levelScoreContext({ kind: 'stage', kit, title: 'x · run · path' })), kit).not.toBeNull();
  });

  it('carries the scene\'s time, weather and the kinds of its mechanics through', () => {
    const c = levelScoreContext({ kind: 'stage', time: 'night', weather: { climate: CLIMATE_NAMES[0] }, game: { mechanics: [{ kind: 'hp-pool' }, { kind: 'reach-exit' }] } }, { goal: 'battle', final: true });
    expect(c).toMatchObject({ time: 'night', climate: CLIMATE_NAMES[0], mechanics: ['hp-pool', 'reach-exit'], goal: 'battle', final: true });
    expect(levelScoreContext({ weather: { climate: { rain: 2, clear: 1 } } }).climate).toBe('rain clear');
  });
});
