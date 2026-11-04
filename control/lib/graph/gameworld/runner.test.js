import { describe, it, expect } from 'vitest';
import { runSteps, decide, childRef, readMade, readGameworld, fingerprint, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { quickWorld } from './quick.js';
import { composeGameworld } from './compose.js';

describe('the runner\'s plan', () => {
  it('an adopted hero is equipped over its own row: its field paint, strokes and bake ride; a made hero has none of its own', () => {
    const heroSpec = { cast: 'female', palette: { Top: '#0f5c4a' } };
    const fieldPaint = [{ part: 'torso', shape: 'star', group: 'Emblem', color: '#ffd400' }], strokes = [{ id: 's1' }];
    const world = { ...MEADOWMARK_HERO, mode: 'autonomous', characters: { ...MEADOWMARK_HERO.characters, hero: { ...MEADOWMARK_HERO.characters.hero, ref: 'solo' } } };
    const lookup = Object.assign(() => null, { heroSpec, head: { hero: heroSpec, fieldPaint, strokes, bake: true } });
    const eq = runSteps(world, { ref: 'gw', lookup }).find((st) => st.key === 'hero-equipped').order.spec;
    expect([eq.fieldPaint, eq.strokes, eq.bake, eq.palette.Top]).toEqual([fieldPaint, strokes, true, '#0f5c4a']);
    const made = runSteps(MEADOWMARK_HERO, { ref: 'gw' }).find((st) => st.key === 'hero-equipped').order.spec;
    expect([made.fieldPaint, made.strokes, made.bake]).toEqual([undefined, undefined, undefined]);
  });
  it('a world before its people lays its levels, waiting on its parts; with a hero, the hero first, the systems and every filled class after', () => {
    // no character book: each stage a level walked in first person, then the game; gated and unreviewed, all wait
    const W = runSteps(MEADOWMARK, { ref: 'gw' });
    expect(W.length).toBeGreaterThan(1);
    // (then one audit step a level: its levels are reach-exit, auditSteps)
    expect(W.filter((s) => !s.audit).at(-1).key).toBe('game');
    expect(W.filter((s) => s.audit).map((s) => s.key)).toEqual(W.filter((s) => s.key.startsWith('level-')).map((s) => `audit-${s.key}`));
    expect(W.every((s) => s.ready === false && s.waiting.length > 0)).toBe(true);
    // autonomous: settled by the machine gate, every level and the game ready at once
    expect(runSteps({ ...MEADOWMARK, mode: 'autonomous', review: undefined }, { ref: 'gw' }).every((s) => s.ready)).toBe(true);
    const S = runSteps(MEADOWMARK_HERO, { ref: 'gw' });
    expect(S.filter((s) => !s.audit).map((s) => s.key)).toEqual(['hero', 'hero-equipped', 'systems', 'gear-dagger', 'gear-sword', 'gear-greatsword', 'gear-staff', 'gear-bow', 'gear-shield', 'level-meadow-ascent-0', 'level-meadow-ascent-1', 'level-meadow-ascent-2', 'level-shell-shore-0', 'level-shell-shore-1', 'game']);
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

  it('the game\'s scars (cosmetic damage) ride onto every level it makes, with no aftermath: nothing breaks', () => {
    const levels = (w) => runSteps(w, { ref: 'gw' }).filter((s) => s.key.startsWith('level-'));
    expect(levels(MEADOWMARK_HERO).every((s) => s.order.manifest.scars === undefined)).toBe(true);
    const L = levels({ ...MEADOWMARK_HERO, mechanics: { ...MEADOWMARK_HERO.mechanics, scars: { wall: 'stone' } } });
    expect(L.length).toBeGreaterThan(0);
    expect(L.every((s) => s.order.manifest.scars.wall === 'stone')).toBe(true);
    expect(L.some((s) => s.order.manifest.game.mechanics.some((m) => m.kind === 'aftermath'))).toBe(false);
  });

  it('the reach and survive levels are audited after the game, one step a level; the goals the audit cannot prove have none', () => {
    const steps = (w) => runSteps(w, { ref: 'gw' });
    const audits = (w) => steps(w).filter((s) => s.audit);
    const game = (w) => steps(w).find((s) => s.key === 'game');
    // moving to the exit (a quick reach, a book's levels, a world composed from words) and lasting out a clock
    for (const w of [quickWorld({ id: 'q', quick: { goal: 'reach' } }), quickWorld({ id: 'q', quick: { goal: 'survive' } }), { ...MEADOWMARK_HERO, mode: 'autonomous', review: undefined }, composeGameworld({ prompt: 'a sunny island coast', levels: 1, seed: 3 })]) {
      const S = steps(w), levels = S.filter((s) => s.key.startsWith('level-'));
      // the game is made at once, unaudited (create_game's waiver), and never asks create_game for the walk
      expect(game(w).order).toMatchObject({ allow_unaudited: true });
      expect(game(w).order.auto_audit).toBeUndefined();
      // each level its audit step, after the game, at the level's ref, ready when the game is, its order naming both
      expect(audits(w).map((a) => a.ref)).toEqual(levels.map((l) => l.ref));
      expect(S.findIndex((s) => s.audit)).toBeGreaterThan(S.findIndex((s) => s.key === 'game'));
      for (const a of audits(w)) expect(a).toMatchObject({ key: `audit-${a.order.level}`, ready: game(w).ready, order: { game: game(w).ref } });
    }
    // a goal the audit cannot prove yet: picking up, hiding, keeping a beat, a course, a fight with foes
    for (const goal of ['collect', 'sneak', 'rhythm', 'race', 'defend', 'battle']) {
      const w = quickWorld({ id: 'q', quick: { goal } });
      expect(game(w).order.allow_unaudited, goal).toBe(true);
      expect(audits(w), goal).toEqual([]);
    }
  });

  it('an audit step is decided by what it walked: waiting until its level and game are made, walked again when they move', () => {
    const [a] = runSteps(quickWorld({ id: 'q', quick: { goal: 'reach' } }), { ref: 'gw' }).filter((s) => s.audit);
    expect(decide(a, undefined, null)).toBe('waiting');
    expect(decide(a, undefined, 'aaaaaaaa')).toBe('make');
    const record = { ref: a.ref, order: a.print, stored: 'aaaaaaaa', verdict: { completable: true, note: 'walked' } };
    expect(decide(a, record, 'aaaaaaaa')).toBe('keep');
    expect(decide(a, record, 'bbbbbbbb')).toBe('remake');
    expect(decide(a, record, 'aaaaaaaa', { force: true })).toBe('remake');
    // never 'taken' (the level's row is the runner's own) and never 'edited' (a walk is not a thing a creator edits)
    expect(decide(a, undefined, 'aaaaaaaa')).not.toBe('taken');
    expect(readMade({ [a.key]: record })).toBeTruthy();
    expect(() => readMade({ [a.key]: { ...record, verdict: { completable: 'yes', note: '' } } })).toThrow(/verdict/);
    expect(() => readMade({ 'level-x-0': { ...record } })).toThrow(/verdict is not part/);
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
