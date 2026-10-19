// A WHOLE LEVEL IN THE ROBLOX KERNEL (roblox-kernel/level.luau over cast.luau, combat.luau, mind.luau, scenes.luau):
// the levelcast corpus (level-conformance.js castCorpus) plays real composed levels on the web (level-equivalence.js
// playScript over a steered script) and feeds the kernel only the pilot's pose each frame (a Roblox Humanoid is the
// pilot); the kernel runs the zone facts, the cast's facts, the bus, its ops, the scenes, the fight and the minds, and
// the bus's hash and every other ruled body's pose must be the web's, frame by frame, under Lune (MOJULO_LUNE). Then
// the corpus's teeth: each plant bends the level's orchestration in the copy of the kernel a run uses (never the
// source) and must make some level unequal.
import { describe, it, expect } from 'vitest';
import { scenariosOf, compare } from './conformance.js';
import { runCorpus, kernelFiles } from './runners.js';
import { CAST_LEVELS, castRun } from '../level-conformance.js';

const LUNE = process.env.MOJULO_LUNE;
const F = 'level.luau';
const count = (id, pred) => JSON.parse(castRun(id).keys.at(-1).split('|')[0]).log.filter((e) => e && typeof e.type === 'string' && pred(e)).length;

describe('a whole level in the Roblox kernel, the pilot fed (MOJULO_LUNE)', () => {
  it('names the modules the levelcast corpus copies, none missing', () => {
    const { files, missing } = kernelFiles('roblox', 'levelcast');
    expect(missing).toEqual([]);
    for (const m of ['cast', 'combat', 'mind', 'nav', 'group', 'rules', 'scenes', 'quests', 'level', 'game', 'bus']) expect(files).toContain(`${m}.luau`);
  });

  it('on the web, each level does what it is there for: spotted, foes felled, the pilot bitten, the cast cued, each won', () => {
    expect(CAST_LEVELS.map((l) => castRun(l.id).outcome)).toEqual(CAST_LEVELS.map(() => 'success'));
    expect(count('stealth-guards', (e) => e.type === 'seen')).toBeGreaterThan(0);
    // the guards only watch: minds and no fight, as a sneaking game's are
    expect(scenariosOf('levelcast').find((sc) => sc.id === 'stealth-guards').bus).toMatchObject({ minds: expect.any(Object) });
    expect(scenariosOf('levelcast').find((sc) => sc.id === 'stealth-guards').bus.combat).toBeUndefined();
    expect(count('melee-fight', (e) => e.type === 'enemy:down')).toBe(2);
    expect(count('melee-fight', (e) => e.type === 'down')).toBeGreaterThan(0);
    expect(count('ambush', (e) => e.type === 'hit:hero')).toBeGreaterThan(0);
    for (const t of ['arrive', 'gone', 'spawned']) expect(count('cast-cues', (e) => e.type === t), t).toBeGreaterThan(0);
    expect(count('cast-cues', (e) => e.type.startsWith('scene-end:'))).toBe(1);
    // the pilot is input: every frame carries its pose, and the key never names it
    for (const sc of scenariosOf('levelcast')) {
      expect(sc.frames.every((f) => f.pilot && f.pilot.id === 'hero' && f.pilot.pos.length === 3)).toBe(true);
      expect(sc.ids).not.toContain('hero');
      expect(sc.bus.cast.length).toBeGreaterThan(1);
    }
  });

  it.skipIf(!LUNE)('kernel/level.luau plays every level equal to the web, frame by frame (MOJULO_LUNE)', () => {
    const scenarios = scenariosOf('levelcast');
    const { out, errors } = runCorpus('roblox', 'levelcast', scenarios, { bin: LUNE });
    expect(errors).toEqual([]);
    const rows = compare('levelcast', scenarios, out);
    expect(rows.filter((r) => !r.equal)).toEqual([]);
    expect(rows.length).toBe(CAST_LEVELS.length);
    expect(rows.reduce((n, r) => n + r.frames, 0)).toBeGreaterThan(800);
  }, 300000);

  // each a real line of the level's orchestration, bent
  const PLANTS = [
    { name: 'an op the bus queued not handed to the cast', mutate: [{ file: F, from: '\tif #ctrl.ops > 0 then\n\t\tK.cast.ops(L.cast, ctrl.ops)\n\tend', to: '' }] },
    { name: 'the cast\'s facts read after the bus, not before', mutate: [
      { file: F, from: '\tif L.cast then\n\t\tfor _, e in ipairs(K.cast.facts(L.cast)) do\n\t\t\ttable.insert(incoming, e)\n\t\tend\n\tend\n', to: '' },
      { file: F, from: '\tbus.frame(st, incoming, dt, L.stats)\n', to: '\tbus.frame(st, incoming, dt, L.stats)\n\tif L.cast then\n\t\tbus.processEvents(st, K.cast.facts(L.cast))\n\tend\n' }] },
    { name: 'the minds stepped before the pilot is placed (it placed after the fight)', mutate: [
      { file: F, from: 'pose, part == "hero" and "hero" or "all")', to: 'nil, part == "hero" and "hero" or "all")' },
      { file: F, from: 'if not (F and hero and id == hero.id) then', to: 'if true then' }] },
    // the web steps the pilot in its turn: a mind listed before it sees where it stood (the ambush's first biter)
    { name: 'the pilot placed before the fight, so every mind sees where it stands', mutate: [
      { file: F, from: '\t\tlocal pose = hw and poseOf(hw) or nil\n', to: '\t\tlocal pose = hw and poseOf(hw) or nil\n\t\tif hero and pose then\n\t\t\thero.pos = pose.pos\n\t\t\thero.heading = pose.heading\n\t\tend\n\t\tpose = nil\n' }] },
    { name: 'a body sent away still zoned', mutate: [{ file: F, from: 'position = e.pos, gone = e.gone', to: 'position = e.pos, gone = false' }] },
    { name: 'a downed body taken out of the zones', mutate: [{ file: F, from: 'position = e.pos, gone = e.gone', to: 'position = e.pos, gone = e.gone or e.downed' }] },
    { name: 'the zone facts over the host\'s walkers only, not the cast', mutate: [{ file: F, from: '\tlocal zoned = walkers\n\tif L.cast then', to: '\tlocal zoned = walkers\n\tif false then' }] },
    { name: 'the cast\'s walks and clock never stepped', mutate: [{ file: F, from: '\tK.cast.step(st, dt)\n', to: '' }] },
    { name: 'a scene\'s beats never reach the bus', mutate: [{ file: F, from: '\t\t\tbus.processEvents(st, fire)\n', to: '' }] },
    { name: 'the pilot never held while a scene plays', mutate: [{ file: F, from: 'local pilotIn = (view and truthy(get(view, "on"))) and obj() or inp', to: 'local pilotIn = inp' }] },
    { name: 'the fight deaf to the pilot\'s input', mutate: [{ file: F, from: 'world(L, mine, first, pilotIn, dt,', to: 'world(L, mine, first, obj(), dt,' }] },
    { name: 'the minds on a plain at 0, not the level\'s land', mutate: [{ file: F, from: '\t\t\tif g then\n\t\t\t\tF.groundFn = g\n\t\t\tend\n', to: '' }] },
    // a level whose guards only watch ships minds and no fight: its pilot is the host's walker
    { name: 'the pilot only the fight\'s hero, so watching guards look for no one', mutate: [{ file: F, from: 'local hid = L.hero or L.pilot or first', to: 'local hid = L.hero' }] },
    { name: 'the pilot\'s heading not read', mutate: [{ file: F, from: 'heading = js.finite(get(w, "heading")) and w.heading or 0.0', to: 'heading = 0.0' }] },
  ];
  it.skipIf(!LUNE)('every planted bug in the level\'s orchestration is caught (MOJULO_LUNE)', () => {
    const scenarios = scenariosOf('levelcast');
    for (const p of PLANTS) {
      const { out } = runCorpus('roblox', 'levelcast', scenarios, { bin: LUNE, mutate: p.mutate });
      expect(!out || compare('levelcast', scenarios, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 600000);
});
