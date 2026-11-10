// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// The routing at the door (gameworld/routing.js): a book that stands on an intent says so while the ledger holds no ask,
// a refusal ends with the card its page is written from, and a game built with no ask is stamped in the build ledger
// until a run an ask links lifts it. The game is a stub row and the first-frame gate left out: no browser runs here.
vi.mock('./create-game.js', async (importOriginal) => {
  const real = await importOriginal();
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  return { ...real, createGameHandler: async ({ ref, title, levels, store }) => { SketchRepository.create({ ref, title, manifest: { kind: 'game', title, levels, store } }); return { ref }; } };
});
vi.mock('@/lib/graph/game/first-frame-check.js', async (importOriginal) => ({ ...(await importOriginal()), firstFrameReadout: async () => ({}) }));

const { closeDb } = await import('@/lib/db/index');
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { designGameHandler } = await import('./design-game.js');
const { ASK_SAYS } = await import('@/lib/graph/gameworld/routing.js');

beforeEach(() => { closeDb(); });
const made = (ref) => SketchRepository.getByRef(ref).manifest.made ?? {};
// the smallest book that stands on an intent: one level, and a bestiary a hand wrote (its class on its stand-in)
const WORLD = { id: 'yard', seed: 3, mode: 'autonomous', levels: { yard: { walk: { nodes: { a: { trail: true } } } } }, foes: { grunt: { class: 'walker' } } };

describe('design_game: the routing', () => {
  it('says a book that stands on an intent has no ask, the ask leading; an ask given answers it', async () => {
    const ref = 'yard';
    let out = await designGameHandler({ ref, world: WORLD });
    expect(out.advice.intent).toEqual([ASK_SAYS]);
    expect(out.next[0]).toEqual({ step: 'ask', card: 'gameworld-ledger' });

    // the call that cuts the ask is answered at once, and every call after it
    out = await designGameHandler({ ref, ask: { intent: 'a yard to cross past its walkers' }, patch: [{ op: 'set', path: '/name', value: 'The yard' }] });
    expect(out.ask.id).toBe('a1');
    expect(out.advice.intent).toBeUndefined();
    expect(out.next.some((n) => n.step === 'ask')).toBe(false);
    out = await designGameHandler({ ref });
    expect(out.advice.intent).toBeUndefined();
  });

  it('leaves a world that stands on no intent as it was: no advice, no move', async () => {
    const { foes: _f, ...bare } = WORLD;
    const out = await designGameHandler({ ref: 'bare', world: { ...bare, id: 'bare' } });
    expect(out.advice.intent).toBeUndefined();
    expect(out.next.some((n) => n.step === 'ask')).toBe(false);
  });

  it('ends a refusal with the card its page is written from', async () => {
    await designGameHandler({ ref: 'yard2', world: { ...WORLD, id: 'yard2' } });
    await expect(designGameHandler({ ref: 'yard2', patch: [{ op: 'set', path: '/foes/grunt/class', value: 'nope' }] }))
      .rejects.toThrow(/read first: get_game_vocab\(\{ id: 'gameworld-foes' \}\)/);
  });

  it('stamps a game built with no ask in the build ledger, and lifts it at a run an ask links', async () => {
    const ref = 'yard3';
    await designGameHandler({ ref, world: { ...WORLD, id: 'yard3' } });
    let out = await designGameHandler({ ref, run: true });
    expect(out.ran.find((r) => r.key === 'game').action).toBe('make');
    expect(made(ref).game.unasked).toBe(true);
    // the stamp is the ledger's alone: the game's own row carries nothing of it
    expect(JSON.stringify(SketchRepository.getByRef(made(ref).game.ref).manifest)).not.toMatch(/unasked/);
    // a run's advice is read whole wherever its steps gave any
    const given = out.ran.flatMap((r) => r.advises ?? []);
    expect((out.advice.run ?? []).reduce((n, a) => n + a.steps, 0)).toBe(given.length);

    out = await designGameHandler({ ref, run: true, ask: { intent: 'a yard to cross past its walkers' } });
    expect(out.ran.every((r) => r.action === 'keep')).toBe(true);
    expect(made(ref).game.unasked).toBeUndefined();
    expect(out.advice.intent).toBeUndefined();
  }, 300_000);
});
