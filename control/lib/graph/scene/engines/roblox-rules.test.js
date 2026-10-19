// THE ROBLOX KERNEL'S MOTION RULES (roblox-kernel/rules.luau) held EQUAL to the web's (worlds/controllable rules-*.js)
// by the rules corpus (rules-conformance.js), frame by frame, under Lune (MOJULO_LUNE): the pilot's pose and its rule's
// state, and its camera's. Then the corpus's teeth: each planted bug breaks the copy of the kernel one run uses (never
// the source) and must make some scenario unequal. A plant runs over the few scenarios that walk its path, so the web's
// side (the slow half) is stepped only there.
import { describe, it, expect } from 'vitest';
import { scenariosOf, compare } from './conformance.js';
import { runCorpus, kernelFiles } from './runners.js';

const LUNE = process.env.MOJULO_LUNE;

describe('the Roblox kernel\'s motion rules are equal to the web (MOJULO_LUNE)', () => {
  it('names the modules the rules corpus copies, none missing', () => {
    expect(kernelFiles('roblox', 'rules')).toEqual({ files: ['js.luau', 'bus.luau', 'json.luau', 'rules.luau'], missing: [] });
  });

  it.skipIf(!LUNE)('kernel/rules.luau runs the rules corpus equal to the web, frame by frame: the default corpus and a seeded one (MOJULO_LUNE)', () => {
    for (const opts of [{}, { random: 24, seed: 11 }]) {
      const scenarios = scenariosOf('rules', opts);
      const { out, errors } = runCorpus('roblox', 'rules', scenarios, { bin: LUNE });
      expect(errors, JSON.stringify(opts)).toEqual([]);
      const rows = compare('rules', scenarios, out, opts);
      expect(rows.filter((r) => !r.equal), JSON.stringify(opts)).toEqual([]);
      expect(rows.reduce((n, r) => n + r.frames, 0)).toBeGreaterThan(5000);
    }
  }, 900000);

  // a corpus is only as good as what it catches: each plant is a real line of rules.luau, bent, and the scenarios that
  // walk its path
  const OPTS = { random: 2, seed: 7 };
  const PLANTS = [
    { name: 'a tank turn the wrong way', ids: ['walk-tank'], from: 'e.heading = fmod(e.heading - inp(input, "turn") * turn * dt, TAU)', to: 'e.heading = fmod(e.heading + inp(input, "turn") * turn * dt, TAU)' },
    { name: 'a heading wrapped by Luau\'s flooring %, not JS\'s remainder', ids: ['walk-tank'], from: 'local fmod = math.fmod', to: 'local fmod = function(a, b) return a % b end' },
    { name: 'a footprint pushed out at the radius, not its square', ids: ['walk-wall'], from: 'if d2 < cr * cr and d2 > 1e-9 then', to: 'if d2 < cr and d2 > 1e-9 then' },
    { name: 'a triangle\'s third edge not checked', ids: ['random-7-0', 'random-7-1'], from: 'if u < -1e-9 or v < -1e-9 or w < -1e-9 then', to: 'if u < -1e-9 or v < -1e-9 then' },
    { name: 'the coyote grace\'s default dropped', ids: ['platform-jump'], from: 'local coyoteT = num(r, "coyote", 0.1)', to: 'local coyoteT = num(r, "coyote", 0.0)' },
    { name: 'the rise and fall gravities swapped', ids: ['platform-jump'], from: 'vel[3] - (vel[3] > 0.0 and riseG or fallG) * dt', to: 'vel[3] - (vel[3] > 0.0 and fallG or riseG) * dt' },
    { name: 'no jump cut', ids: ['platform-jump'], from: 'vel[3] = minf(vel[3], cutV)', to: 'vel[3] = vel[3]' },
    { name: 'a chase camera that looks at the pilot, not ahead (its lead dropped)', ids: ['camera-follow-reverse-pitch'], from: 'local lead = num(r, "lead", 4.0)', to: 'local lead = 0.0' },
    { name: 'the side camera on the far side of the lane', ids: ['camera-side'], from: 'want = atan2(L.ty, L.tx) + HALF_PI', to: 'want = atan2(L.ty, L.tx) - HALF_PI' },
    { name: 'a shot that never looks for a clear view', ids: ['camera-shot-ridge'], from: 'if g == g and g > z - 0.3 then', to: 'if false then' },
    { name: 'a brake that pushes', ids: ['drive-basics'], from: 'F = -brakeForce * brakeIn', to: 'F = brakeForce * brakeIn' },
    { name: 'a banked turn the wrong way', ids: ['fly-flight'], from: 'turn = (G / maxf(v, vStall)) * tan(e.bank)', to: 'turn = (G / maxf(v, vStall)) * tan(-e.bank)' },
    { name: 'every lap counted twice', ids: ['racer-loop'], from: 'e.laps = e.laps + 1', to: 'e.laps = e.laps + 2' },
  ];
  it.skipIf(!LUNE)('every planted bug in the rules is caught by the corpus (MOJULO_LUNE)', () => {
    const all = scenariosOf('rules', OPTS);
    for (const p of PLANTS) {
      const scenarios = all.filter((sc) => p.ids.includes(sc.id));
      expect(scenarios.length, p.name).toBe(p.ids.length);
      const { out } = runCorpus('roblox', 'rules', scenarios, { bin: LUNE, mutate: [{ file: 'rules.luau', from: p.from, to: p.to }] });
      expect(!out || compare('rules', scenarios, out, OPTS).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 900000);
});
