// SCENES AND QUESTS ON ROBLOX: the Roblox kernel's scene runner (roblox-kernel/scenes.luau) and quest journal
// (quests.luau) run the scenes corpus (scenes-conformance.js) under Lune, equal to the web's runner and journal step by
// step, and every bug planted in the run's kernel copy is caught. Skipped without MOJULO_LUNE.
import { describe, it, expect } from 'vitest';
import { scenariosOf, compare } from './conformance.js';
import { runCorpus } from './runners.js';

const LUNE = process.env.MOJULO_LUNE;

describe('scenes and quests on Roblox (MOJULO_LUNE)', () => {
  it.skipIf(!LUNE)('kernel/scenes.luau and quests.luau are equal to the web\'s, step by step, the fixed scenarios and two seeds of random ones', () => {
    for (const opts of [{}, { random: 24, seed: 7 }, { random: 24, seed: 11 }]) {
      const c = scenariosOf('scenes', opts);
      const { out, errors } = runCorpus('roblox', 'scenes', c, { bin: LUNE });
      expect(errors, JSON.stringify(opts)).toEqual([]);
      const rows = compare('scenes', c, out, opts);
      expect(rows.filter((r) => !r.equal), JSON.stringify(opts)).toEqual([]);
      expect(rows.length).toBeGreaterThan(8);
    }
  }, 300000);

  // a corpus is only as good as what it catches: each plant breaks the kernel copy the run uses, never the source
  const PLANTS = [
    { file: 'scenes.luau', name: 'a condition that reads only numbers', from: 'gte = function(a, b) return js.rel(a, b, ">=") end,', to: 'gte = function(a, b) return type(a) == "number" and type(b) == "number" and a >= b end,' },
    { file: 'scenes.luau', name: 'a line typed faster', from: 'local RATE, HOLD, BARS = 40, 0.6, 4', to: 'local RATE, HOLD, BARS = 41, 0.6, 4' },
    { file: 'scenes.luau', name: 'a skip past a choice', from: '\t\t\tchoose(A, b)\n\t\t\treturn\n\t\tend\n\t\tj += 1', to: '\t\tend\n\t\tj += 1' },
    { file: 'scenes.luau', name: 'a line cut by code points, not UTF-16 units', from: 'local w = c > 0xFFFF and 2 or 1', to: 'local w = 1' },
    { file: 'scenes.luau', name: 'a scene played again and again', from: 'S.played[id] = (truthy(S.played[id]) and S.played[id] or 0) + 1', to: '' },
    { file: 'scenes.luau', name: 'a choice that only moves down', from: 'A.sel = (A.sel + (js.rel(mv, 0, ">") and 1 or -1) + n) % n', to: 'A.sel = (A.sel + 1) % n' },
    { file: 'scenes.luau', name: 'a condition\'s gte read as gt', from: 'gte = function(a, b) return js.rel(a, b, ">=") end', to: 'gte = function(a, b) return js.rel(a, b, ">") end' },
    { file: 'scenes.luau', name: 'a held key that never adds up', from: 'and A.holdT + dt or 0', to: 'and dt or 0' },
    { file: 'quests.luau', name: 'every step shown at once', from: '\t\t\tif not d then\n\t\t\t\tbreak\n\t\t\tend', to: '' },
    { file: 'quests.luau', name: 'a step\'s news one step late', from: 'j = k - 1', to: 'j = k' },
  ];
  it.skipIf(!LUNE)('every planted bug in the runner and the journal is caught', () => {
    const c = scenariosOf('scenes', {});
    for (const p of PLANTS) {
      const { out } = runCorpus('roblox', 'scenes', c, { bin: LUNE, mutate: [{ file: p.file, from: p.from, to: p.to }] });
      expect(!out || compare('scenes', c, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 300000);
});
