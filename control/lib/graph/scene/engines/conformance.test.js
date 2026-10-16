// THE CONFORMANCE PROTOCOL, engine-neutral (conformance.js) and per engine (runners.js). The neutral half needs no
// engine: an engine's output is compared to the web's, frame by frame. The Roblox kernel's corpus runs under Lune
// (MOJULO_LUNE), the Godot kernel's under Godot (MOJULO_GODOT, in the godot-*.test.js beside the corpora).
import { describe, it, expect } from 'vitest';
import { CORPORA, scenariosOf, compare, firstDifference } from './conformance.js';
import { RUNNERS, runCorpus, kernelFiles } from './runners.js';
import { MARKED_ENGINES } from './registry.js';

const LUNE = process.env.MOJULO_LUNE;

describe('the neutral half', () => {
  it('names each corpus\'s kernel modules by module id, and every engine with marks has a runner', () => {
    expect(Object.keys(CORPORA)).toEqual(['bus', 'combat', 'mind', 'level', 'rules', 'scenes']);
    for (const c of Object.values(CORPORA)) expect(c.kernel).toContain('bus');
    expect(Object.keys(RUNNERS).sort()).toEqual([...MARKED_ENGINES].sort());
  });

  it('compares an engine\'s output to the web\'s: equal, then the first difference with context', () => {
    const scenarios = scenariosOf('bus', { random: 0 }).filter((sc) => !sc.store && !sc.stats).slice(0, 3);
    const web = CORPORA.bus.web(scenarios);
    expect(compare('bus', scenarios, web).every((r) => r.equal)).toBe(true);
    const [first] = scenarios, bent = { ...web, [first.id]: web[first.id].map((s, i) => (i === 1 ? s.replace('"processed":', '"processed":9') : s)) };
    const rows = compare('bus', scenarios, bent);
    expect(rows.find((r) => r.id === first.id)).toMatchObject({ equal: false, first: { frame: 1 } });
    expect(compare('bus', scenarios, {}).every((r) => !r.equal)).toBe(true);   // no output is never equal
    expect(firstDifference('abcdef', 'abcxef')).toMatchObject({ at: 3 });
  });

  it('names what a kernel lacks before it runs anything', () => {
    expect(kernelFiles('godot', 'bus').files).toEqual(['bus.gd', 'json_exact.gd', 'store.gd', 'stats.gd']);
    expect(kernelFiles('godot', 'bus').missing).toEqual([]);
    expect(kernelFiles('roblox', 'bus')).toEqual({ files: ['js.luau', 'bus.luau', 'json.luau', 'store.luau', 'stats.luau'], missing: [] });
    expect(kernelFiles('roblox', 'rules').missing).toEqual(['rules.luau']);
    const r = runCorpus('roblox', 'rules', [], { bin: '/nonexistent/lune' });
    expect(r).toMatchObject({ out: null, status: null });
    expect(r.errors[0]).toMatch(/not in the roblox kernel yet: rules\.luau/);
    expect(runCorpus('godot', 'bus', [], { bin: null }).errors[0]).toMatch(/no godot runner found/);
  });
});

describe('the Roblox kernel is equal to the web (MOJULO_LUNE)', () => {
  it.skipIf(!LUNE)('kernel/bus.luau, stats.luau and store.luau run the bus corpus equal to the web, frame by frame (MOJULO_LUNE)', () => {
    for (const seed of [7, 11]) {
      const scenarios = scenariosOf('bus', { random: 24, seed });
      const { out, errors } = runCorpus('roblox', 'bus', scenarios, { bin: LUNE });
      expect(errors, `seed ${seed}`).toEqual([]);
      const rows = compare('bus', scenarios, out);
      expect(rows.filter((r) => !r.equal), `seed ${seed}`).toEqual([]);
      expect(rows.filter((r) => scenarios.find((s) => s.id === r.id)?.store).length).toBeGreaterThan(4);
      expect(rows.filter((r) => scenarios.find((s) => s.id === r.id)?.stats).length).toBeGreaterThan(2);
    }
  });

  // a corpus is only as good as what it catches: each plant breaks the kernel copy the run uses, never the source
  const PLANTS = [
    { file: 'bus.luau', name: 'the depth cap one level early', from: 'if depth > cap.depthCap then', to: 'if depth >= cap.depthCap then' },
    { file: 'bus.luau', name: 'every emit counted twice', from: 'state.metrics.emitted += 1', to: 'state.metrics.emitted += 2' },
    { file: 'bus.luau', name: 'gte read as gt', from: 'if has(p, "gte") then ok = ok and js.rel(v, p.gte, ">=") end', to: 'if has(p, "gte") then ok = ok and js.rel(v, p.gte, ">") end' },
    { file: 'js.luau', name: 'a hash over bytes, not UTF-16 units', from: 'for _, u in ipairs(units(s)) do', to: 'for _, u in ipairs({ string.byte(s, 1, -1) }) do' },
    { file: 'js.luau', name: 'keys in byte order of their length', from: 'table.sort(ks, js.lt)', to: 'table.sort(ks, function(a, b) return #a < #b end)' },
    { file: 'stats.luau', name: 'a level-up that skips its gifts', from: 'give(cfg, S, h, L.each, out)', to: '' },
    { file: 'stats.luau', name: 'a purchase that does not pay', from: 'pay(vars, h, cost)\n\t\tvars[key(h, sid)] = rank + 1', to: 'vars[key(h, sid)] = rank + 1' },
    { file: 'store.luau', name: 'a consume that leaves the emptied item', from: 's.items[ev.item] = nil', to: 's.items[ev.item] = 0' },
    { file: 'store.luau', name: 'a gate that ignores its count', from: 'js.isNullish(get(gate, "count")) and 1 or gate.count', to: '1' },
  ];
  it.skipIf(!LUNE)('every planted bug in the bus, the JS semantics, the stats and the store is caught (MOJULO_LUNE)', () => {
    const scenarios = scenariosOf('bus', { random: 24, seed: 7 });
    for (const p of PLANTS) {
      const { out } = runCorpus('roblox', 'bus', scenarios, { bin: LUNE, mutate: [{ file: p.file, from: p.from, to: p.to }] });
      expect(!out || compare('bus', scenarios, out).some((r) => !r.equal), p.name).toBe(true);
    }
  });

  it.skipIf(!LUNE)('kernel/level.luau and game.luau play every level of the level corpus equal to the web over its track (MOJULO_LUNE)', () => {
    const scenarios = scenariosOf('level', { random: 6, seed: 7 });
    const { out, errors } = runCorpus('roblox', 'level', scenarios, { bin: LUNE });
    expect(errors).toEqual([]);
    expect(compare('level', scenarios, out).filter((r) => !r.equal)).toEqual([]);
  });

  const LEVEL_PLANTS = [
    { file: 'game.luau', name: 'an end heard after the level ended', from: 'if not ch.ended then\n\t\t\t\t\tch.ended = true', to: 'if true then\n\t\t\t\t\tch.ended = true' },
    { file: 'game.luau', name: 'a door left by more than once', from: 'if not ch.ended and not ch.leaving then', to: 'if not ch.ended then' },
    { file: 'game.luau', name: 'the exit not named', from: 'ch.exit = x', to: 'ch.exit = nil' },
    { file: 'game.luau', name: 'an {event} left unnamed', from: 'o[k] = ev.type', to: 'o[k] = v' },
    { file: 'game.luau', name: 'the patterns read in sorted order, not as written', from: 'local pats = js.keys(on)', to: 'local pats = js.sortedKeys(on)' },
    { file: 'game.luau', name: 'a kept number unrounded', from: 'js.round(n * s * 1000) / 1000', to: 'n * s' },
    { file: 'level.luau', name: 'the session\'s start events dropped', from: 'L.first = game.start(L.channel)', to: 'L.first = arr()' },
    { file: 'level.luau', name: 'the warps the bus queued never handed back', from: 'return { ops = ctrl.ops, warps = ctrl.warps, bodies = bodies }', to: 'return { ops = ctrl.ops, warps = obj(), bodies = bodies }' },
  ];
  it.skipIf(!LUNE)('every planted bug in the level step and the game channel is caught (MOJULO_LUNE)', () => {
    const scenarios = scenariosOf('level', { random: 0 });
    for (const p of LEVEL_PLANTS) {
      const { out } = runCorpus('roblox', 'level', scenarios, { bin: LUNE, mutate: [{ file: p.file, from: p.from, to: p.to }] });
      expect(!out || compare('level', scenarios, out).some((r) => !r.equal), p.name).toBe(true);
    }
  });
});
