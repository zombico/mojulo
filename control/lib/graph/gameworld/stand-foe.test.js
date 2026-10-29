// The stand step every hostile goes through (foes.js standFoe): a class's mind said in words (mind/vocab.js SIGHTS, GAZES,
// COVER) lowered onto its rule, layer 0's package on every one stood, and a game type's own numbers laid last; a
// shooter's hunters and a sneak's guards stood through it.
import { describe, it, expect } from 'vitest';
import { standFoe } from './foes.js';
import { shootCast } from './quick.js';
import { resolveFoe } from '../foes/resolve.js';
import { validateClass } from '../foes/index.js';
import { SIGHTS, GAZES, COVER, sightKnobs } from '../mind/vocab.js';

const BEATS = [{ beat: 'trailhead', at: [0, 0, 0] }, { beat: 'a', at: [10, 0, 0] }, { beat: 'b', at: [20, 0, 0] }, { beat: 'exit', at: [30, 0, 0] }];
const ENDS = { spawn: [0, 0, 0], exit: [30, 0, 0], beats: BEATS };

describe('how a mind sees, in words', () => {
  it('a sight, a gaze and cover lower to the knobs the runtime reads, and nothing for none', () => {
    expect(sightKnobs({ sight: 'narrow', gaze: 'sweep', cover: true })).toEqual({ ...SIGHTS.narrow.knobs, ...GAZES.sweep.knobs, ...COVER.knobs });
    expect(sightKnobs({})).toEqual({});
    expect(resolveFoe({ class: 'guard' }).entity.rule).toMatchObject(sightKnobs({ sight: 'narrow', gaze: 'sweep' }));
    expect(resolveFoe({ class: 'hunter' }).entity.rule).toMatchObject(sightKnobs({ sight: 'wide', cover: true }));
  });
  it('a class naming a word the mind lacks is refused by name', () => {
    const row = { id: 'x', reads: 'x', move: 'hold', attack: { kind: 'none' }, mind: { aggressiveness: 'bold', sight: 'hawk' }, fits: {}, presence: 1, toll: { downs: 1, harm: 0 }, stomp: 'blow', threat: 1, standIn: 'wolf' };
    expect(() => validateClass(row)).toThrow(/unknown 'x' mind.sight 'hawk'/);
  });
});

describe('the stand step', () => {
  it('lays layer 0 on whatever it stands, and a game\'s own numbers last', () => {
    const part = { figures: {}, entities: [] };
    const e = standFoe(null, part, { id: 'g', entry: { class: 'guard', skin: { people: 'human' } }, at: [1, 2, 0], heading: 0 }, { figure: { heroRef: 'own' }, tune: { team: 'guards', body: { hittable: false } } });
    expect(part.figures.g).toEqual({ heroRef: 'own' });
    expect(e).toMatchObject({ team: 'guards', body: { hittable: false, hpBar: 'target', vanish: expect.any(Object), targetRim: expect.any(Array) } });
    expect(e.rule).toMatchObject(sightKnobs({ sight: 'narrow', gaze: 'sweep' }));
  });

  it('a shooter\'s foes are hunters: their sight and cover the class\'s, their gun and health the shooter\'s', () => {
    const X = shootCast({ goal: 'shoot', foes: 2 }, ENDS, 'fig');
    expect(X.entities).toHaveLength(2);
    for (const e of X.entities) {
      expect(e.rule).toMatchObject({ ...sightKnobs({ sight: 'wide', cover: true }), mind: { motivation: 'hunt', perception: 'memory', pathing: 'navmesh' }, standoff: 12 });
      expect(e.weapon).toMatchObject({ fireClass: 'sight', magazine: 6 });
      expect(e.body).toMatchObject({ hp: 4, hittable: true, vanish: expect.any(Object) });
    }
  });
});
