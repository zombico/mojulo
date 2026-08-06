import { describe, expect, it } from 'vitest';

import { validateGameManifest, normalizeGameManifest } from './game-manifest.js';
import { validateLevelContract, normalizeLevelContract, CONTRACT_VERSION } from './level-contract.js';
import { getGameVocabCatalog, listGameVocab } from './slice-cards/loader.js';
import { buildGameStoreKernel } from './store-kernel.js';

const K = buildGameStoreKernel();

const GAME = {
  kind: 'game',
  title: 'Crypt Campaign',
  store: {
    slices: [
      { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
      { name: 'bag', kind: 'inventory' },
      { name: 'campaign', kind: 'progression' },
      { name: 'world', kind: 'flags' },
    ],
  },
  levels: [
    { ref: 'crypt-1', title: 'The Door' },
    { ref: 'crypt-2', gate: { completed: 'crypt-1' } },
    { ref: 'crypt-3', gate: { flag: 'drawbridge-down' } },
  ],
};

const LEVEL = {
  levelRef: 'crypt-1',
  consumes: [{ slice: 'hero' }, { slice: 'bag', pick: { max: 4 } }],
  produces: {
    events: [
      { type: 'grant', slice: 'bag', max: 5 },
      { type: 'promote', slice: 'campaign', max: 1 },
    ],
  },
  on: {
    'pickup:*': { emit: { type: 'grant', slice: 'bag', item: 'coin' } },
    'goal:reached': { end: 'success' },
  },
};

describe('game manifest', () => {
  it('accepts the well-formed campaign and normalizes level titles + contractVersion', () => {
    expect(validateGameManifest(GAME)).toEqual({ ok: true, errors: [] });
    const n = normalizeGameManifest(GAME);
    expect(n.contractVersion).toBe(CONTRACT_VERSION);
    expect(n.levels[1].title).toBe('crypt-2');
    expect(GAME.levels[1].title).toBeUndefined(); // never mutates input
  });

  it('teaches on bad slices, duplicate refs, and dangling / mistyped gates', () => {
    const bad = (patch) => validateGameManifest(JSON.parse(JSON.stringify({ ...GAME, ...patch })));
    expect(bad({ store: { slices: [{ name: 'x', kind: 'wallet' }] } }).errors.join(' ')).toMatch(/kind must be one of/);
    expect(bad({ levels: [{ ref: 'a' }, { ref: 'a' }] }).errors.join(' ')).toMatch(/duplicated/);
    expect(bad({ levels: [{ ref: 'a', gate: { completed: 'ghost' } }] }).errors.join(' ')).toMatch(/not a level of this game/);
    expect(bad({ levels: [{ ref: 'a', gate: { flag: 'f', completed: 'a' } }] }).errors.join(' ')).toMatch(/exactly one of/);
    // a flag gate pointing at a non-flags slice is caught at mint time
    expect(bad({ levels: [{ ref: 'a', gate: { flag: 'f', slice: 'bag' } }] }).errors.join(' ')).toMatch(/must be a flags slice/);
    // gate needs a slice of the right kind to exist at all
    const noFlags = JSON.parse(JSON.stringify(GAME));
    noFlags.store.slices = noFlags.store.slices.filter((s) => s.kind !== 'flags');
    noFlags.levels = [{ ref: 'a', gate: { flag: 'f' } }];
    expect(validateGameManifest(noFlags).errors.join(' ')).toMatch(/needs a flags slice/);
    // init shape faults surface as validation errors, not throws
    expect(bad({ store: { slices: [{ name: 'x', kind: 'character', init: 'lots' }] } }).ok).toBe(false);
  });
});

describe('music bed level (the volume keys)', () => {
  const withMusic = (music) => validateGameManifest({ ...GAME, music });

  it('accepts 0..1 volumes (volume + per-context overrides)', () => {
    expect(withMusic({ menu: 'sk_m', volume: 0.5 })).toEqual({ ok: true, errors: [] });
    expect(withMusic({ menu: 'sk_m', battle: ['sk_b'], menuVolume: 0.55, battleVolume: 0.35 })).toEqual({ ok: true, errors: [] });
    expect(withMusic({ menu: 'sk_m', volume: 0 })).toEqual({ ok: true, errors: [] });   // silent is a valid bed
  });

  it('teaches on out-of-range / non-numeric volumes', () => {
    expect(withMusic({ menu: 'sk_m', volume: 1.5 }).errors.join(' ')).toMatch(/between 0 and 1/);
    expect(withMusic({ menu: 'sk_m', battleVolume: -0.2 }).errors.join(' ')).toMatch(/between 0 and 1/);
    expect(withMusic({ menu: 'sk_m', menuVolume: 'quiet' }).errors.join(' ')).toMatch(/between 0 and 1/);
  });
});

describe('setup presentation (the pre-level screens)', () => {
  const partyGame = () => {
    const g = JSON.parse(JSON.stringify(GAME));
    g.store.slices.push({ name: 'party', kind: 'party', init: { roster: { a: { name: 'A' } } } });
    return g;
  };
  const withSetup = (setup) => validateGameManifest({ ...partyGame(), setup });

  it('accepts hangar + count styles on party slices', () => {
    expect(withSetup({
      party: { style: 'hangar', label: 'select your machine', cards: { a: { portrait: 'sk_h', preview: 'sk_p', stats: { hull: 900, armament: 'RIFLE' }, blurb: 'the ace machine' } } },
    })).toEqual({ ok: true, errors: [] });
    expect(withSetup({ party: { style: 'count', label: 'how many', blurb: 'drawn at random' } })).toEqual({ ok: true, errors: [] });
  });

  it('teaches on unknown slices, non-party slices, bad styles, and bad cards', () => {
    expect(withSetup({ ghost: { style: 'count' } }).errors.join(' ')).toMatch(/not a declared slice/);
    expect(withSetup({ bag: { style: 'count' } }).errors.join(' ')).toMatch(/party slices/);
    expect(withSetup({ party: { style: 'carousel' } }).errors.join(' ')).toMatch(/'hangar'.+'count'/);
    expect(withSetup({ party: { style: 'hangar', cards: { a: { portrait: 42 } } } }).errors.join(' ')).toMatch(/sketch ref/);
    expect(withSetup({ party: { style: 'hangar', cards: { a: { stats: { hp: {} } } } } }).errors.join(' ')).toMatch(/string or number/);
  });

  it('normalizes through untouched (refs stay refs in the stored row)', () => {
    const g = partyGame();
    g.setup = { party: { style: 'hangar', cards: { a: { portrait: 'sk_h' } } } };
    expect(normalizeGameManifest(g).setup).toEqual(g.setup);
  });
});

describe('level contract', () => {
  it('accepts the contract against the game schema and normalizes defaults', () => {
    expect(validateLevelContract(LEVEL, GAME.store)).toEqual({ ok: true, errors: [] });
    const n = normalizeLevelContract(LEVEL);
    expect(n.produces.results).toEqual(['success', 'fail', 'abort']);
    expect(n.presets.default).toEqual({});
  });

  it('teaches on undeclared slices, kind × event mismatches, and on-map drift', () => {
    const check = (patch) => validateLevelContract({ ...JSON.parse(JSON.stringify(LEVEL)), ...patch }, GAME.store);
    expect(check({ levelRef: undefined }).errors.join(' ')).toMatch(/levelRef is required/);
    expect(check({ consumes: [{ slice: 'ghost' }] }).errors.join(' ')).toMatch(/not declared in the game's store schema/);
    expect(check({ consumes: [{ slice: 'bag', pick: { max: 0 } }] }).errors.join(' ')).toMatch(/positive integer/);
    expect(check({ produces: { events: [{ type: 'setFlag', slice: 'bag' }] } }).errors.join(' ')).toMatch(/does not accept "setFlag"/);
    expect(check({ produces: { results: ['victory'], events: [] } }).errors.join(' ')).toMatch(/not a result/);
    // an on-map emit outside produces is an authoring error at mint time, not a play-time rejection
    expect(check({ on: { 'pickup:*': { emit: { type: 'setStat', slice: 'hero', stat: 'hp', delta: 1 } } } }).errors.join(' ')).toMatch(/not declared in game.produces.events/);
    expect(check({ on: { 'goal:reached': { end: 'victory' } } }).errors.join(' ')).toMatch(/end must be one of/);
    expect(check({ produces: undefined }).errors.join(' ')).toMatch(/produces is required/);
  });

  it('the contract vocabulary and the kernel vocabulary are the same object', () => {
    // level-contract delegates to the kernel — no second event list to drift.
    expect(CONTRACT_VERSION).toBe(K.CONTRACT_VERSION);
  });
});

describe('slice cards', () => {
  it('loads one card per slice kind plus the typed-events card, frontmatter valid', () => {
    const catalog = getGameVocabCatalog();
    for (const kind of K.SLICE_KINDS) expect(catalog.has(`slice-${kind}`), `slice-${kind} card`).toBe(true);
    expect(catalog.has('typed-events')).toBe(true);
    for (const card of listGameVocab()) {
      expect(card.summary.length).toBeGreaterThan(20);
      expect(card.when.length).toBeGreaterThan(10);
    }
  });

  it('every typed event in the kernel is documented on the typed-events card', () => {
    const body = getGameVocabCatalog().get('typed-events').body;
    for (const type of K.EVENT_TYPES) expect(body).toContain(`\`${type}\``);
  });
});
