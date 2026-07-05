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
