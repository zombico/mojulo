import { describe, expect, it } from 'vitest';

import { buildGameStoreKernel } from './store-kernel.js';

// ── THE STORE CONTRACT (game-metacontext.plan.md → doctrine) ────────────────────
// Closed vocabulary, atomic envelopes, pure reducers, byte-identical save
// round-trips. These tests are the standalone artifact's trust model in miniature:
// whatever passes here is exactly what the shipped shell executes (the kernel is
// emitted via .toString(), so Node tests the same closure the browser runs).

const K = buildGameStoreKernel();

const SCHEMA = {
  slices: [
    { name: 'hero', kind: 'character', init: { stats: { hp: 100, str: 5 } } },
    { name: 'bag', kind: 'inventory', init: { items: { potion: 3 } } },
    { name: 'army', kind: 'party', init: { roster: { rook: { name: 'Rook', stats: { hp: 25 } } } } },
    { name: 'campaign', kind: 'progression' },
    { name: 'world', kind: 'flags', init: { flags: { intro: true } } },
  ],
};

const CONTRACT = {
  levelRef: 'crypt-1',
  produces: {
    results: ['success', 'fail', 'abort'],
    events: [
      { type: 'grant', slice: 'bag', max: 3 },
      { type: 'setStat', slice: 'hero' },
      { type: 'promote', slice: 'campaign' },
    ],
  },
};

function envelope(events, result = 'success') {
  return { contractVersion: K.CONTRACT_VERSION, levelRef: 'crypt-1', seed: 7, result, events };
}

describe('createStore', () => {
  it('initializes every slice kind with defaults + declared init', () => {
    const s = K.createStore(SCHEMA);
    expect(s.hero).toEqual({ level: 1, xp: 0, stats: { hp: 100, str: 5 } });
    expect(s.bag).toEqual({ items: { potion: 3 } });
    expect(s.army.roster.rook).toEqual({ name: 'Rook', level: 1, xp: 0, stats: { hp: 25 }, tags: [] });
    expect(s.campaign).toEqual({ completed: {}, unlocked: [] });
    expect(s.world).toEqual({ flags: { intro: true } });
  });

  it('throws teaching errors on unknown kinds and duplicate names', () => {
    expect(() => K.createStore({ slices: [{ name: 'x', kind: 'nope' }] })).toThrow(/unknown slice kind/);
    expect(() => K.createStore({ slices: [{ name: 'a', kind: 'flags' }, { name: 'a', kind: 'flags' }] })).toThrow(/duplicate/);
  });
});

describe('applyEvents — the generated reducers', () => {
  it('applies the whole vocabulary', () => {
    const s0 = K.createStore(SCHEMA);
    const r = K.applyEvents(SCHEMA, s0, [
      { type: 'grant', slice: 'bag', item: 'rune-key' },
      { type: 'consume', slice: 'bag', item: 'potion', count: 2 },
      { type: 'setStat', slice: 'hero', stat: 'hp', delta: -12 },
      { type: 'levelUp', slice: 'hero', xp: 250 },
      { type: 'recruit', slice: 'army', member: { id: 'vex', name: 'Vex' } },
      { type: 'levelUp', slice: 'army', id: 'vex', by: 2 },
      { type: 'dismiss', slice: 'army', id: 'rook' },
      { type: 'promote', slice: 'campaign', ref: 'crypt-1' },
      { type: 'setFlag', slice: 'world', key: 'drawbridge-down' },
    ]);
    expect(r.ok).toBe(true);
    expect(r.state.bag.items).toEqual({ potion: 1, 'rune-key': 1 });
    expect(r.state.hero).toMatchObject({ level: 2, xp: 250, stats: { hp: 88 } });
    expect(r.state.army.roster).toEqual({ vex: { name: 'Vex', level: 3, xp: 0, stats: {}, tags: [] } });
    expect(r.state.campaign).toEqual({ completed: { 'crypt-1': 'success' }, unlocked: ['crypt-1'] });
    expect(r.state.world.flags['drawbridge-down']).toBe(true);
  });

  it('is atomic: one bad event rejects the whole batch and mutates nothing', () => {
    const s0 = K.createStore(SCHEMA);
    const frozen = JSON.stringify(s0);
    const r = K.applyEvents(SCHEMA, s0, [
      { type: 'grant', slice: 'bag', item: 'gold', count: 100 },
      { type: 'consume', slice: 'bag', item: 'potion', count: 99 },   // overdraw → reject all
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/cannot consume 99/);
    expect(JSON.stringify(s0)).toBe(frozen);
  });

  it('enforces the kind × event matrix (closed vocabulary)', () => {
    const s0 = K.createStore(SCHEMA);
    expect(K.applyEvents(SCHEMA, s0, [{ type: 'grant', slice: 'hero', item: 'x' }]).errors.join(' ')).toMatch(/does not accept "grant"/);
    expect(K.applyEvents(SCHEMA, s0, [{ type: 'explode', slice: 'bag' }]).errors.join(' ')).toMatch(/not a typed event/);
    expect(K.applyEvents(SCHEMA, s0, [{ type: 'setFlag', slice: 'nope', key: 'k' }]).errors.join(' ')).toMatch(/not a declared slice/);
    expect(K.applyEvents(SCHEMA, s0, [{ type: 'recruit', slice: 'army', member: { id: 'rook' } }]).errors.join(' ')).toMatch(/already in the roster/);
  });

  it('is pure and deterministic: same input state + events → identical output, input untouched', () => {
    const s0 = K.createStore(SCHEMA);
    const events = [{ type: 'grant', slice: 'bag', item: 'gem' }, { type: 'setStat', slice: 'hero', stat: 'str', value: 7 }];
    const a = K.applyEvents(SCHEMA, s0, events);
    const b = K.applyEvents(SCHEMA, s0, events);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.state).not.toBe(s0);
    expect(s0.bag.items.gem).toBeUndefined();
  });
});

describe('outcome envelopes — one write per session, contract-checked', () => {
  it('accepts an envelope whose events the contract declares', () => {
    const s0 = K.createStore(SCHEMA);
    const r = K.applyOutcome(SCHEMA, s0, CONTRACT, envelope([
      { type: 'grant', slice: 'bag', item: 'loot' },
      { type: 'promote', slice: 'campaign', ref: 'crypt-1' },
    ]));
    expect(r.ok).toBe(true);
    expect(r.state.campaign.unlocked).toEqual(['crypt-1']);
  });

  it('rejects undeclared event pairs, over-max counts, bad results, version drift', () => {
    expect(K.validateEnvelope(CONTRACT, envelope([{ type: 'setFlag', slice: 'world', key: 'k' }])).errors.join(' ')).toMatch(/not declared in the level contract/);
    const four = Array.from({ length: 4 }, (_, i) => ({ type: 'grant', slice: 'bag', item: 'g' + i }));
    expect(K.validateEnvelope(CONTRACT, envelope(four)).errors.join(' ')).toMatch(/exceeds produces max/);
    expect(K.validateEnvelope(CONTRACT, envelope([], 'victory')).errors.join(' ')).toMatch(/not allowed/);
    const stale = { ...envelope([]), contractVersion: 999 };
    expect(K.validateEnvelope(CONTRACT, stale).errors.join(' ')).toMatch(/contractVersion/);
  });
});

describe('gates', () => {
  it('evaluates flag and completed predicates (default: first slice of the kind)', () => {
    const s0 = K.createStore(SCHEMA);
    expect(K.evalGate(SCHEMA, s0, undefined)).toBe(true);
    expect(K.evalGate(SCHEMA, s0, { flag: 'intro' })).toBe(true);
    expect(K.evalGate(SCHEMA, s0, { flag: 'drawbridge-down' })).toBe(false);
    expect(K.evalGate(SCHEMA, s0, { completed: 'crypt-1' })).toBe(false);
    const { state } = K.applyEvents(SCHEMA, s0, [{ type: 'promote', slice: 'campaign', ref: 'crypt-1' }]);
    expect(K.evalGate(SCHEMA, state, { completed: 'crypt-1' })).toBe(true);
    // a fail promote records the attempt but does not unlock
    const failed = K.applyEvents(SCHEMA, s0, [{ type: 'promote', slice: 'campaign', ref: 'crypt-1', result: 'fail' }]).state;
    expect(K.evalGate(SCHEMA, failed, { completed: 'crypt-1' })).toBe(false);
  });
});

describe('saves — portable and byte-identical round-trips', () => {
  it('export → import → export is byte-identical, runLog intact', () => {
    const s0 = K.createStore(SCHEMA);
    const runLog = [envelope([{ type: 'grant', slice: 'bag', item: 'loot' }])];
    const text = K.makeSave(s0, runLog);
    const parsed = K.parseSave(text);
    expect(parsed.ok).toBe(true);
    expect(K.makeSave(parsed.save.storeState, parsed.save.runLog)).toBe(text);
  });

  it('rejects malformed and version-drifted saves with legible errors', () => {
    expect(K.parseSave('{not json').ok).toBe(false);
    expect(K.parseSave(JSON.stringify({ contractVersion: 999, storeState: {}, runLog: [] })).errors.join(' ')).toMatch(/contractVersion/);
    expect(K.parseSave(JSON.stringify({ contractVersion: K.CONTRACT_VERSION, runLog: [] })).errors.join(' ')).toMatch(/storeState/);
  });
});

describe('emit discipline', () => {
  it('the kernel is a self-contained closure (toString() re-evaluates to a working kernel)', () => {
    // eslint-disable-next-line no-eval
    const K2 = (0, eval)(`(${buildGameStoreKernel.toString()})`)();
    const s = K2.createStore(SCHEMA);
    const r = K2.applyEvents(SCHEMA, s, [{ type: 'grant', slice: 'bag', item: 'gem' }]);
    expect(r.ok).toBe(true);
    expect(K2.CONTRACT_VERSION).toBe(K.CONTRACT_VERSION);
  });
});
