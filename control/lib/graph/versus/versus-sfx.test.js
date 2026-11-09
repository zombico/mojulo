import { describe, it, expect } from 'vitest';
import { FIGHT_SFX, fightCues, fightAudio, FIGHT_MIX } from './versus-sfx.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { versusSource, VERSUS_PAGE_MODULES } from './versus-page.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';

// THE FIGHT'S SOUNDS: the SFX shelf's families at their dials, one cue a thing a fight does, on the page's audio channel
// under a fight game's register; the runtime says which cue an event plays, by what landed.
const src = [...VERSUS_PAGE_MODULES, 'versus-runtime.client.js'].map(versusSource).join('\n');
// the runtime as the page inlines it, the audio channel's two names stood in for: every cue it is asked to play, recorded
const play = () => {
  const heard = [];
  const R = new Function('window', 'navigator', '__AUDIO', '__beatsCue', `${src}\nreturn { newMatch, stepMatch, fightCue };`)({}, {}, { cues: fightCues() }, (cue, gain) => heard.push([Object.keys(fightCues()).find((k) => fightCues()[k] === cue), gain]));
  return { R, heard };
};

describe('versus sfx: the fight sounds the library', () => {
  it('every cue is the shelf\'s, built, and a world\'s audio takes them on the fight\'s bus', () => {
    const C = fightCues();
    expect(Object.keys(C)).toEqual(Object.keys(FIGHT_SFX));
    for (const [id, g] of Object.entries(C)) expect(g.length, id).toBeGreaterThan(0);
    // (deterministic: the same dials, the same sound)
    expect(JSON.stringify(fightCues())).toBe(JSON.stringify(C));
    const A = resolveWorldAudio(fightAudio({ register: 'western' }), {});
    expect(A.cues).toEqual(C);
    expect(A.mix).toEqual({ ...FIGHT_MIX });
    expect(A.vary).toBe(true);
    // a heavier blow layers more than a light one
    expect(C['hit-heavy'].length).toBeGreaterThan(C['hit-light'].length);
  });

  it('only a fight game sounds the library: an arena without a register carries nothing', () => {
    expect(fightAudio({})).toBeNull();
    expect(fightAudio({ register: 'neon' })).toBeNull();
  });

  it('what landed says what is heard: a fist by its weight, a foot, a blade, a counter; a spark once', () => {
    const { R } = play();
    const cue = (e) => R.fightCue(e)?.[0];
    expect([0, 1, 2, 3].map((w) => cue({ t: 'hit', w, limb: 'fist' }))).toEqual(['hit-light', 'hit-medium', 'hit-heavy', 'hit-heavy']);
    expect([cue({ t: 'hit', w: 0, limb: 'foot' }), cue({ t: 'hit', w: 2, limb: 'knee' })]).toEqual(['kick-light', 'kick-heavy']);
    expect([cue({ t: 'hit', w: 2, limb: 'blade' }), cue({ t: 'hit', limb: 'shot' }), cue({ t: 'block', limb: 'blade' })]).toEqual(['blade-heavy', 'shot-hit', 'clash']);
    expect(cue({ t: 'counter', w: 1 })).toBe('counter');
    // (a spark's blow sounds as the spark, not twice)
    expect([cue({ t: 'spark' }), cue({ t: 'hit', spark: 1 }), cue({ t: 'counter', spark: 1 })]).toEqual(['spark', undefined, undefined]);
    // every cue the runtime can name is a cue the board holds
    for (const t of ['hit', 'counter', 'spark', 'block', 'clash', 'parry', 'riposte', 'armor', 'crush', 'throw', 'tech', 'land', 'bound', 'burst', 'reset', 'super', 'lock', 'fireball', 'ko']) {
      const c = R.fightCue({ t, w: 1, limb: 'fist' });
      if (c) expect(FIGHT_SFX[c[0]], t).toBeTruthy();
    }
  });

  it('a match played hears its blows from the library', () => {
    const { R, heard } = play();
    const F = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe);
    const m = R.newMatch({ fighters: [F, F], names: ['A', 'B'], colors: ['#e0503a', '#3a9be0'], schemes: ['modern', 'modern'], mode: 'watch', level: 1, rules: {}, seed: 5 });
    for (let k = 0; k < 900 && !heard.some(([id]) => /^(hit|kick)-/.test(id)); k++) R.stepMatch(m);
    expect(heard.some(([id]) => /^(hit|kick)-/.test(id))).toBe(true);
    for (const [id, gain] of heard) { expect(FIGHT_SFX[id], id).toBeTruthy(); expect(gain).toBeGreaterThan(0); }
  });
});
