import { describe, it, expect } from 'vitest';
import { STYLES, POSTURE_OF, POSTURES, DEFAULT_STYLE, checkProduction, styleOf, postureOf, roleOf, isPillar, checkpointLevels, maySettle, checkRecommendation, productionSummary } from './production.js';

// How a game is run (production.js): the director's style sets the assistant director's posture; the creator sees the
// pillars and the vertical slice, then the checkpoints they set; the director settles the rest; each job sits in a
// stable role.

describe('the director\'s style and the assistant\'s posture', () => {
  it('each style sets one posture, each posture its question; auteur when none is set', () => {
    expect(POSTURE_OF).toEqual({ yeoman: 'assistive', auteur: 'strict', 'avant-garde': 'elevating' });
    for (const s of Object.keys(STYLES)) expect(POSTURES[POSTURE_OF[s]], s).toEqual(expect.any(String));
    expect(DEFAULT_STYLE).toBe('auteur');
    expect(styleOf({}, null)).toBe('auteur');
    expect(styleOf({}, { style: 'yeoman' })).toBe('yeoman');
    // a req's own style wins over the world's: an avant-garde finale in an auteur game
    expect(postureOf({ style: 'avant-garde' }, { style: 'auteur' })).toBe('elevating');
  });

  it('a production setting is a style and checkpoints, nothing else', () => {
    expect(() => checkProduction({ style: 'auteur', checkpoints: ['act'] })).not.toThrow();
    expect(() => checkProduction({ style: 'maverick' })).toThrow(/a style is yeoman, auteur, avant-garde/);
    expect(() => checkProduction({ checkpoints: ['weekly'] })).toThrow(/checkpoints are \[act \| every\]/);
    expect(() => checkProduction({ style: 'auteur', budget: 1 })).toThrow(/not budget/);
  });
});

describe('what the creator always sees, and what the director may settle', () => {
  it('the pillars: what game it is, the main quest, the hero\'s direction and look; never a level', () => {
    for (const u of ['intent', 'main-quest', 'direction', 'hero']) expect(isPillar(u), u).toBe(true);
    for (const u of ['level:crypt', 'foes', 'feel', 'world']) expect(isPillar(u), u).toBe(false);
  });

  it('before the slice, nothing; after it, anything outside the pillars and the checkpoints', () => {
    expect(maySettle({ units: ['level:crypt'], slice: false })).toEqual({ may: false, why: expect.stringMatching(/before the vertical slice is accepted/) });
    expect(maySettle({ units: ['level:crypt', 'foes'], slice: true })).toEqual({ may: true });
    expect(maySettle({ units: ['hero'], slice: true }).why).toMatch(/hero is a pillar/);
    expect(maySettle({ units: ['level:crypt'], slice: true, checkpoints: ['every'] }).why).toMatch(/every unit/);
    expect(maySettle({ units: ['level:crypt'], slice: true, checkpoints: ['act'], checkpointed: ['crypt'] }).why).toMatch(/level:crypt is a checkpoint/);
  });

  it('an act\'s checkpoint is the level of its last built beat', () => {
    const quest = { acts: [{ id: 'a', beats: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3', built: false }] }, { id: 'c', beats: [{ id: 'b4' }] }] };
    const plays = { b1: 'l1', b2: 'l2', b4: 'l4' };
    expect(checkpointLevels(['act'], { quest, plays })).toEqual(['l2', 'l4']);
    expect(checkpointLevels([], { quest, plays })).toEqual([]);
  });
});

describe('roles and the assistant\'s recommendation', () => {
  it('a job sits in a stable seat by its kind and its unit\'s department; a diverge author is an author', () => {
    expect(roleOf('gw', 'author', 'level:crypt')).toBe('gw:author:worlds');
    expect(roleOf('gw', 'diverge', 'level:crypt')).toBe('gw:author:worlds');
    expect(roleOf('gw', 'author', 'foes')).toBe('gw:author:foes');
    expect(roleOf('gw', 'critic', 'level:crypt')).toBe('gw:critic:worlds');
    expect(roleOf('gw', 'assistant', 'level:crypt')).toBe('gw:assistant');
  });

  it('the assistant recommends with reasons, and never decides', () => {
    expect(() => checkRecommendation({ recommend: 'elevate', reasons: ['it repeats the last level'], bolder: 'flood it' })).not.toThrow();
    expect(() => checkRecommendation({ recommend: 'accept', reasons: ['x'] })).toThrow(/recommends pass-up, rework, elevate/);
    expect(() => checkRecommendation({ recommend: 'rework', reasons: [] })).toThrow(/gives its reasons/);
  });

  it('the readout says the style, whether it was set, the slice, and who saw what', () => {
    expect(productionSummary(null)).toMatchObject({ style: 'auteur', defaulted: true, posture: 'strict', slice: expect.stringMatching(/^not yet/), seen: { accepted: 0, directed: 0 } });
    expect(productionSummary({ style: 'yeoman', checkpoints: ['act'] }, { slice: true, accepted: 1, directed: 2 })).toMatchObject({ style: 'yeoman', posture: 'assistive', checkpoints: ['act'], seen: { accepted: 1, directed: 2 } });
  });
});
