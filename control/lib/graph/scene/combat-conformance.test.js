// The Godot kernel's fight is held EQUAL to the web's controllable engine by the combat conformance corpus. The web
// side always runs (the corpus is deterministic, and each hand scenario reaches what it names); the Godot side runs
// when MOJULO_GODOT names an engine, as every engine gate does (CI has none).
import { describe, it, expect } from 'vitest';
import { corpus, runCombat, SCENARIOS, randomScenarios } from './combat-conformance.js';

const GODOT = process.env.MOJULO_GODOT;
const last = (id) => JSON.parse(runCombat(SCENARIOS.find((s) => s.id === id)).snaps.at(-1));
const ever = (id, pred) => runCombat(SCENARIOS.find((s) => s.id === id)).snaps.some((x) => pred(JSON.parse(x)));

describe('the combat conformance corpus', () => {
  it('is deterministic and plain JSON, every frame with the hero\'s pose', () => {
    const all = corpus({ random: 4 });
    expect(JSON.stringify(corpus({ random: 4 }))).toBe(JSON.stringify(all));
    expect(JSON.stringify(randomScenarios(3, 1))).not.toBe(JSON.stringify(randomScenarios(3, 2)));
    for (const sc of all) {
      expect(sc.combat, sc.id).toMatchObject({ version: 'combat/1', hero: 'hero' });
      for (const f of sc.frames) expect(Object.keys(f.hero).sort(), sc.id).toEqual(['grounded', 'heading', 'pitch', 'pos']);
    }
  });

  it('reaches what each hand scenario names', () => {
    expect(last('swing-reach-cone').bodies).toMatchObject({ front: { hits: 2 }, behind: { hits: 0 }, far: { hits: 0 } });
    expect(last('falls').bodies).toMatchObject({ reacts: { downed: true, hp: 0 }, stands: { downed: false, hp: 0 }, pal: { hits: 0 } });
    expect(ever('falls', (s) => s.bodies.pal.staggerT !== null)).toBe(true);
    expect(ever('topple-and-rise', (s) => s.bodies.egg.react === 'getup' && s.bodies.egg.invincible)).toBe(true);
    expect(last('rifle').bodies).toMatchObject({ near: { hits: 2 }, far: { hits: 0 }, hidden: { hits: 0 }, guard: { broken: true } });
    expect(last('burst-charge-heat').hero.weapon.shots).toBeGreaterThan(3);
    expect(ever('burst-charge-heat', (s) => s.hero.weapon.energyLock)).toBe(true);
    expect(last('grenades').bodies).toMatchObject({ pal: { hits: 0 } });
    expect(last('grenades').bodies.mark.hits).toBeGreaterThan(0);
    expect(last('rocket').bodies.beside.hits).toBeGreaterThan(0);
    expect(last('swept').bodies.thin.hits).toBe(1);
    expect(ever('death-blast', (s) => s.bodies.bystander.staggerT !== null && s.bodies.bystander.hits === 0)).toBe(true);
    expect(last('away-and-back').bodies).toMatchObject({ a: { downed: true }, b: { hittable: true } });
    // the reserve runs dry and the weapon stops; a rearm by 5 adds to it; a rearm with no by fills the magazine
    const rr = runCombat(SCENARIOS.find((s) => s.id === 'reserve-and-rearm')).snaps.map((x) => JSON.parse(x).hero.weapon);
    expect(rr.slice(0, 120).some((w) => w.ammo === 0 && w.reserve === 0 && !w.reloading)).toBe(true);
    expect(rr[130].reserve + rr[130].ammo).toBeGreaterThan(0);
    // the fill lands with the frame's ops: rounds again, with no reserve and no reload
    expect(rr.slice(215, 222).some((w) => w.ammo >= 2 && w.reserve === 0 && !w.reloading)).toBe(true);
  });

  it.skipIf(!GODOT)('the Godot kernel is equal to the web, frame by frame (MOJULO_GODOT)', async () => {
    const { runGodotCombat, compare } = await import('../../../scripts/godot-combat-conformance.mjs');
    const opts = { random: 12, seed: 1 }, scenarios = corpus(opts);
    const { out, errors } = runGodotCombat(scenarios, GODOT);
    expect(errors).toEqual([]);
    const rows = compare(scenarios, out, opts);
    expect(rows.filter((r) => !r.equal)).toEqual([]);
    expect(rows.length).toBe(scenarios.length);
  }, 300000);
});
