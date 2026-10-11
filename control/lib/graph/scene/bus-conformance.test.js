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
    expect(STORE_SCENARIOS.map((s) => s.id)).toEqual(['store-campaign']);
    expect(randomStoreScenarios(3, 1).every((s) => s.store && s.ops.length)).toBe(true);
    const snaps = runStoreScenario(STORE_SCENARIOS[0]);
    expect(snaps.slice(0, 3)).toEqual(['false', 'false', 'true']);
    expect(snaps.join('\n')).toMatch(/does not accept \\"setFlag\\"/);
    expect(snaps.join('\n')).toMatch(/exceeds produces max for grant→bag \(max 2\)/);
    expect(snaps.join('\n')).toMatch(/contractVersion 2 ≠ shell contract version 1/);
  });

  it('exercises what the port has to get right', () => {
    const text = JSON.stringify(all);
    for (const k of ['"ne":', '"lte":', '"gt":', '"entity":', '"all":', '"any":', '"count":', '"do":"spawn"', '"do":"impulse"', '"do":"ctrl"', '"await":{"timer"', '"while":', '"walkers":', '"budget":', '"depthCap":', 'event.missing']) {
      expect(text, k).toContain(k);
    }
    expect(SCENARIOS.map((s) => s.id)).toEqual(['billiards', 'vault', 'storm', 'verbs', 'floats', 'undefined', 'numbers']);
    // the corpus reaches the caps it names, prints a sum in full, and keeps an undefined as null
    const snap = (id) => runScenario(all.find((s) => s.id === id));
    expect(snap('numbers').join('')).toMatch(/e-324|e\+21|e-7/);
    expect(snap('storm').at(-1)).toMatch(/"op":"cap","reason":"(depth|budget)"/);
    expect(snap('floats').join('')).toMatch(/\d\.\d{15,}/);
    expect(snap('undefined')[1]).toMatch(/"p":null/);
  });
});

describe.skipIf(!GODOT)('the Godot kernel', () => {
  it('runs the corpus equal to the web, frame by frame', async () => {
    const { runGodotBus, compare } = await import('../../../scripts/godot-bus-conformance.mjs');
    const scenarios = corpus();
    const { out, errors } = runGodotBus(scenarios, GODOT);
    expect(errors).toEqual([]);
    const unequal = compare(scenarios, out).filter((r) => !r.equal);
    expect(unequal).toEqual([]);
  }, 120000);
});
