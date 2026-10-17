// The Godot kernel's event bus is held EQUAL to the web reducer by the conformance corpus. The web side always runs
// (the corpus is deterministic and covers every predicate and verb); the Godot side runs when MOJULO_GODOT names an
// engine, as every engine gate does (CI has none).
import { describe, it, expect } from 'vitest';
import { corpus, runScenario, runStoreScenario, SCENARIOS, STORE_SCENARIOS, randomScenarios, randomStoreScenarios } from './bus-conformance.js';

const GODOT = process.env.MOJULO_GODOT;

describe('the bus conformance corpus', () => {
  const all = corpus();

  it('is deterministic and plain JSON', () => {
    expect(JSON.stringify(corpus())).toBe(JSON.stringify(all));
    expect(JSON.stringify(randomScenarios(5, 3))).not.toBe(JSON.stringify(randomScenarios(5, 4)));
    for (const sc of all) expect(JSON.parse(JSON.stringify(sc)), sc.id).toEqual(sc);
  });

  it('gives every frame (every store op) a snapshot, the same on every run', () => {
    for (const sc of all) {
      const run = sc.store ? runStoreScenario : runScenario;
      const a = run(sc);
      expect(a, sc.id).toHaveLength(sc.store ? sc.ops.length : sc.frames.length);
      expect(run(sc), sc.id).toEqual(a);
    }
  });

  it('holds the store to its words: refusals, atomic writes, gates', () => {
    expect(STORE_SCENARIOS.map((s) => s.id)).toEqual(['store-campaign', 'store-travel']);   // the map's travel and a door's transit since 0.23.0
    expect(randomStoreScenarios(3, 1).every((s) => s.store && s.ops.length)).toBe(true);
    const snaps = runStoreScenario(STORE_SCENARIOS[0]);
    expect(snaps.slice(0, 3)).toEqual(['false', 'false', 'true']);
    expect(snaps.join('\n')).toMatch(/does not accept \\"setFlag\\"/);
    expect(snaps.join('\n')).toMatch(/exceeds produces max for grant→bag \(max 2\)/);
    expect(snaps.join('\n')).toMatch(/contractVersion 2 ≠ shell contract version 1/);
  });

  it('exercises what the port has to get right', () => {
    const text = JSON.stringify(all);
    for (const k of ['"ne":', '"lte":', '"gt":', '"entity":', '"all":', '"any":', '"count":', '"do":"spawn"', '"do":"impulse"', '"do":"ctrl"', '"await":{"timer"', '"while":', '"walkers":', '"if":', '"budget":', '"depthCap":', 'event.missing']) {
      expect(text, k).toContain(k);
    }
    expect(SCENARIOS.map((s) => s.id)).toEqual(['billiards', 'vault', 'storm', 'verbs', 'floats', 'undefined', 'numbers', 'guarded', 'reserved', 'text', 'text-order', 'glob-lines']);
    // words beyond ASCII reach the hash and the key order: an astral key sorts before a fullwidth one by code units
    const snap0 = (id) => runScenario(all.find((s) => s.id === id));
    expect(snap0('text').join('')).toMatch(/gem-[0-9a-z]+/);
    expect(snap0('text-order')[0].indexOf('😀beta')).toBeLessThan(snap0('text-order')[0].indexOf('Ａlpha'));
    // the corpus reaches the caps it names, prints a sum in full, and keeps an undefined as null
    const snap = (id) => runScenario(all.find((s) => s.id === id));
    expect(snap('numbers').join('')).toMatch(/e-324|e\+21|e-7/);
    expect(snap('storm').at(-1)).toMatch(/"op":"cap","reason":"(depth|budget)"/);
    expect(snap('floats').join('')).toMatch(/\d\.\d{15,}/);
    expect(snap('undefined')[1]).toMatch(/"p":null/);
  });

  it('plays every mechanic that travels, and reaches what each turns on', () => {
    const last = (id) => JSON.parse(runScenario(all.find((s) => s.id === id)).at(-1).split('|')[0]);
    const heard = (id) => last(id).log.map((l) => l.type);
    expect(last('mechanic-laps').vars).toMatchObject({ __lap_0: 2, __race_over_0: 1 });
    expect(heard('mechanic-laps')).toContain('laps:done');
    expect(last('mechanic-score').vars.score).toBeGreaterThan(0);
    expect(heard('mechanic-defeat-all')).toContain('all:defeated');
    expect(heard('mechanic-reach-exit')).toContain('goal:reached');
    expect(heard('mechanic-clock')).toContain('dawn');
    expect(last('mechanic-hazard-damage').vars.hp).toBeLessThan(100);
  });
});

describe.skipIf(!GODOT)('the Godot kernel', () => {
  it('runs the corpus equal to the web, frame by frame', async () => {
    const { runCorpus } = await import('./engines/runners.js');
    const { compare } = await import('./engines/conformance.js');
    const scenarios = corpus();
    const { out, errors } = runCorpus('godot', 'bus', scenarios, { bin: GODOT });
    expect(errors).toEqual([]);
    const unequal = compare('bus', scenarios, out).filter((r) => !r.equal);
    expect(unequal).toEqual([]);
  }, 120000);
});
