// THE INTAKE: what the creator brought, recorded before the first goalpost. The record places a thing or sets it aside,
// never drops it; only what was placed answers a goalpost; the question is asked once, of a book at its start.
import { describe, it, expect } from 'vitest';
import { INTAKE_KINDS, INTAKE_KIND_IDS, readIntake, needsIntake, intakeAdvice, intakeReport, INTAKE_SAYS } from './intake.js';
import { GOALPOSTS } from './goalposts.js';
import { gameworldCards } from './gameworld-cards.js';
import { readGameworld } from './index.js';

const POSTS = GOALPOSTS.map((g) => g.id);
const world = (extra = {}) => ({ id: 'w', levels: { one: { walk: { nodes: { path: { trail: {} } } } } }, ...extra });
const item = (extra = {}) => ({ id: 'sheet', kind: INTAKE_KIND_IDS[0], says: 'a knight in red', placed: '/characters/hero/looks', ...extra });

describe('the intake record', () => {
  it('every kind names its door and answers goalposts that exist', () => {
    for (const [id, K] of Object.entries(INTAKE_KINDS)) {
      expect(K.name && K.door, id).toBeTruthy();
      expect(K.answers.length, id).toBeGreaterThan(0);
      for (const g of K.answers) expect(POSTS, `${id} answers ${g}`).toContain(g);
    }
  });

  it('reads nothing brought, and an item placed or set aside, never both and never neither', () => {
    expect(readIntake('none')).toEqual({ none: true });
    const kind = INTAKE_KIND_IDS[0];
    expect(readIntake({ items: [item()] }).items[0]).toEqual({ id: 'sheet', kind, says: 'a knight in red', placed: '/characters/hero/looks', answers: [...INTAKE_KINDS[kind].answers], basis: 'stated' });
    expect(readIntake({ items: [item({ placed: undefined, aside: 'no page takes a power system yet' })] }).items[0].aside).toBe('no page takes a power system yet');
    expect(() => readIntake({ items: [item({ aside: 'and also set aside' })] })).toThrow(/one of the two: nothing brought is dropped/);
    expect(() => readIntake({ items: [item({ placed: undefined })] })).toThrow(/one of the two/);
  });

  it('teaches a malformed record: the shape, the kinds, the goalposts, an id said twice', () => {
    expect(() => readIntake({})).toThrow(/'none' \(asked, nothing brought\) or \{ items/);
    expect(() => readIntake({ items: [item({ kind: 'napkin' })] })).toThrow(new RegExp(INTAKE_KIND_IDS.join(', ')));
    expect(() => readIntake({ items: [item({ answers: ['fun'] })] })).toThrow(/answers are goalposts/);
    expect(() => readIntake({ items: [item(), item()] })).toThrow(/said twice/);
    expect(() => readIntake({ items: [item({ basis: 'guessed' })] })).toThrow(/stated \| inferred/);
    expect(() => readGameworld(world({ intake: { items: [item({ kind: 'napkin' })] } }))).toThrow(/gameworld: intake/);
    expect(() => readGameworld(world({ intake: 'none' }))).not.toThrow();
  });
});

describe('the intake step', () => {
  it('is asked once, of a book at its start: not of a quick game, a composed world, one that has built, or one answered', () => {
    expect(intakeAdvice(world())).toEqual({ says: INTAKE_SAYS, next: { step: 'intake', card: 'gameworld-producer' } });
    expect(needsIntake(world({ quick: { goal: 'collect' } }))).toBe(false);
    expect(needsIntake(world({ brief: { read: [] } }))).toBe(false);
    expect(needsIntake(world({ made: { game: { ref: 'g' } } }))).toBe(false);
    expect(needsIntake(world({ intake: 'none' }))).toBe(false);
    expect(intakeAdvice(world({ intake: 'none' }))).toBeNull();
  });

  it('reports what the material answered and what is open: only a placed thing answers', () => {
    expect(intakeReport(world())).toBeNull();
    expect(intakeReport(world({ intake: 'none' }))).toEqual({ none: true });
    const R = intakeReport(world({ intake: { items: [
      item({ answers: ['look'] }),
      item({ id: 'notes', answers: ['game', 'look'], basis: 'inferred' }),
      item({ id: 'magic', placed: undefined, aside: 'no page takes it yet', answers: ['play'] }),
    ] } }));
    expect(R.items).toBe(3);
    expect(R.answered).toEqual({ look: ['sheet', 'notes'], game: ['notes'] });
    expect(R.open).toEqual(POSTS.filter((g) => !['look', 'game'].includes(g)));
    expect(R.aside).toEqual([{ id: 'magic', says: 'a knight in red', aside: 'no page takes it yet' }]);
    expect(R.inferred).toEqual(['notes']);
  });

  it('has a card that teaches it, its rows the table\'s', () => {
    const body = gameworldCards().get('gameworld-producer').body;
    for (const id of INTAKE_KIND_IDS) expect(body, id).toContain(INTAKE_KINDS[id].door);
    // (the card is the producer's loop: the intake is its first step, and the patch it teaches is the door's own op)
    expect(body).toMatch(/1 HEAR \(next: intake\)/);
    expect(body).toMatch(/op: 'set', path: '\/intake'/);
    expect(body).toMatch(/as PRODUCER you ask and shape, as DIRECTOR you build/);
    expect(Buffer.byteLength(body)).toBeLessThan(4096);
  });
});
