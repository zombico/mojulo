import { describe, it, expect } from 'vitest';
import { runSteps, decide, childRef, readMade, readGameworld, fingerprint, MEADOWMARK, MEADOWMARK_HERO } from './index.js';

describe('the runner\'s plan', () => {
  it('a world without a hero makes nothing; with one, the hero first, the systems and every filled class after', () => {
    expect(runSteps(MEADOWMARK, { ref: 'gw' })).toEqual([]);
    const S = runSteps(MEADOWMARK_HERO, { ref: 'gw' });
    expect(S.map((s) => s.key)).toEqual(['hero', 'hero-equipped', 'systems', 'gear-dagger', 'gear-sword', 'gear-greatsword', 'gear-staff', 'gear-bow', 'gear-shield', 'level-meadow-ascent-0', 'level-meadow-ascent-1', 'level-meadow-ascent-2', 'level-shell-shore-0', 'level-shell-shore-1', 'game']);
    expect(S[0]).toMatchObject({ ref: 'gw-hero', ready: true });
    // the systems world names the hero at the ref the run makes it at
    expect(JSON.stringify(S[2].order)).toContain('gw-hero');
    // gated, nothing reviewed: the systems and the gear wait, and say on what
    expect(S[2]).toMatchObject({ ready: false, waiting: expect.arrayContaining([{ id: 'hero:base', status: 'proposed' }]) });
    // the equipped hero holds the table's staff in the stand that shows it, not the motion's guard
    expect(S[1].order.spec.gear.right).toMatchObject({ item: 'staff' });
    expect(S[1].order.spec.gesture).toBe('relaxed');
    expect(() => runSteps(MEADOWMARK_HERO, {})).toThrow(/derived from the gameworld's own ref/);
  });

  it('pure: the same world, the same steps and prints', () => {
    expect(JSON.stringify(runSteps(MEADOWMARK_HERO, { ref: 'gw' }))).toBe(JSON.stringify(runSteps(MEADOWMARK_HERO, { ref: 'gw' })));
  });

  it('decides: make, keep, remake when the book moved, leave a hand edit and a stranger\'s sketch unless forced', () => {
    const step = { key: 'hero', ref: 'gw-hero', ready: true, print: 'aaaaaaaa' };
    const rec = { ref: 'gw-hero', order: 'aaaaaaaa', stored: 'bbbbbbbb' };
    expect(decide({ ...step, ready: false }, rec, 'bbbbbbbb')).toBe('waiting');
    expect(decide(step, undefined, null)).toBe('make');
    expect(decide(step, rec, null)).toBe('make');
    expect(decide(step, rec, 'bbbbbbbb')).toBe('keep');
    expect(decide({ ...step, print: 'cccccccc' }, rec, 'bbbbbbbb')).toBe('remake');
    expect(decide({ ...step, print: 'cccccccc' }, rec, 'dddddddd')).toBe('edited');
    expect(decide(step, rec, 'dddddddd')).toBe('edited');
    expect(decide(step, rec, 'dddddddd', { force: true })).toBe('remake');
    expect(decide(step, undefined, 'dddddddd')).toBe('taken');
    expect(decide(step, undefined, 'dddddddd', { force: true })).toBe('remake');
  });

  it('a child ref stays within the 64 characters a ref may have, and apart from its neighbours', () => {
    expect(childRef('gw', 'gear-greatsword')).toBe('gw-gear-greatsword');
    const long = 'x'.repeat(60), a = childRef(long, 'gear-greatsword'), b = childRef(`${long}y`, 'gear-greatsword');
    expect(a.length).toBeLessThanOrEqual(64);
    expect(a).toMatch(/-gear-greatsword$/);
    expect(a).not.toBe(b);
  });

  it('the record is read with the world, and says what is wrong', () => {
    const rec = { hero: { ref: 'gw-hero', order: fingerprint(1), stored: fingerprint(2) } };
    expect(() => readGameworld({ ...MEADOWMARK_HERO, made: rec })).not.toThrow();
    expect(() => readMade({ cape: rec.hero })).toThrow(/made.cape is not something a run makes/);
    expect(() => readMade({ hero: { ref: 'gw-hero' } })).toThrow(/made.hero is \{ ref, order, stored \}/);
  });
});
