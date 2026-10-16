import { describe, it, expect } from 'vitest';
import { runSteps, decide, childRef, readMade, readGameworld, fingerprint, MEADOWMARK, MEADOWMARK_HERO } from './index.js';

describe('the runner\'s plan', () => {
  it('a world before its people lays its levels, waiting on its parts; with a hero, the hero first, the systems and every filled class after', () => {
    // no character book: each stage a level walked in first person, then the game; gated and unreviewed, all wait
    const W = runSteps(MEADOWMARK, { ref: 'gw' });
    expect(W.length).toBeGreaterThan(1);
    expect(W.at(-1).key).toBe('game');
    expect(W.every((s) => s.ready === false && s.waiting.length > 0)).toBe(true);
    // autonomous: settled by the machine gate, every level and the game ready at once
    expect(runSteps({ ...MEADOWMARK, mode: 'autonomous', review: undefined }, { ref: 'gw' }).every((s) => s.ready)).toBe(true);
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

  it('the game\'s destruction degree rides onto every level it makes; without one, no level says it', () => {
    const levels = (w) => runSteps(w, { ref: 'gw' }).filter((s) => s.key.startsWith('level-'));
    expect(levels(MEADOWMARK_HERO).every((s) => s.order.manifest.destruction === undefined)).toBe(true);
    const W = { ...MEADOWMARK_HERO, mechanics: { ...MEADOWMARK_HERO.mechanics, destruction: 'objects' } };
    const L = levels(W);
    expect(L.length).toBeGreaterThan(0);
    expect(L.every((s) => s.order.manifest.destruction === 'objects')).toBe(true);
    // and what breaks stays broken: each level keeps its breaks in the world's aftermath slice
    expect(L.every((s) => s.order.manifest.game.mechanics.some((m) => m.kind === 'aftermath' && m.slice === 'aftermath'))).toBe(true);
    const game = runSteps(W, { ref: 'gw' }).find((s) => s.key === 'game');
    expect(game.order.store.slices).toContainEqual({ name: 'aftermath', kind: 'flags' });
    expect(levels(MEADOWMARK_HERO).some((s) => s.order.manifest.game.mechanics.some((m) => m.kind === 'aftermath'))).toBe(false);
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
