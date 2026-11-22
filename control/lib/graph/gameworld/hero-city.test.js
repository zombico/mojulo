import { describe, it, expect } from 'vitest';
import { heroCityWorld, heroCityStart, HERO_CITY } from './hero-city.js';
import { hijackCityWorld } from './hijack-city.js';
import { readGameworld, CITY_CALM } from './world.js';
import { runSteps } from './runner.js';
import { powerSidearm } from './hero-powers.js';
import { pitchStart } from './pitch-start.js';
import { cityGuide } from './city-guide.js';

describe('Hero City', () => {
  it('is Hijack City\'s district and missions with a hero\'s power, the crews and a mastermind, and no law', () => {
    const W = heroCityWorld({ power: 'nova' }), H = hijackCityWorld();
    expect(() => readGameworld(W)).not.toThrow();
    expect(W.levels.district.geocity).toEqual(H.levels.district.geocity);
    for (const k of ['law', 'shops', 'factions']) expect(W).not.toHaveProperty(k);
    // each mission is a bounty on a foe the district fields, told by one contact, the last the end
    const fielded = W.levels.district.foes.from;
    for (const e of W.errands) { expect(e.contact).toBe('reyes'); expect(fielded).toContain(e.list[0].from.foe); }
    expect(W.errands.filter((e) => e.mission.final)).toHaveLength(1);
    expect(W.foes.mastermind).toMatchObject({ class: 'summoner', summons: { foe: 'thug' } });
    expect(W.characters.hero.kit.ranged).toBe('nova');
    expect(() => heroCityWorld({ power: 'wall' })).toThrow(/power is one of/);
  });
  it('lays its district calm, its hero armed with the power and the crews and the mastermind standing in it', () => {
    const steps = runSteps(heroCityWorld(), { ref: 'hc' });
    for (const id of ['thug', 'criminal', 'mercenary', 'mastermind']) expect(steps.some((s) => s.key === `foes-${id}`)).toBe(true);
    const lv = steps.find((s) => /^level-/.test(s.key)), m = lv.order.args ? lv.order.args.manifest : lv.order.manifest;
    expect(m).toMatchObject(CITY_CALM);
    const ids = m.entities.filter((e) => e.team === 'foes').map((e) => e.id);
    expect(ids.some((id) => /mastermind/.test(id))).toBe(true);
    const hero = m.entities.find((e) => e.pilotable);
    expect(JSON.stringify(hero.rule)).toContain(`"id":"${powerSidearm('beam').id}"`);
    // a hero on a line takes no car: the district's cars are scenery, and the guide leads to the jobs on foot
    expect(m.entities.some((e) => e.mount?.cab)).toBe(false);
    const g = cityGuide(m);
    expect(g.steps[0].id).not.toBe('car');
    expect(g.lessons.map((l) => l.keys).join()).not.toMatch(/car|drive/);
  }, 300_000);
  it('starts a locked pitch with no level, the creator\'s own words winning', () => {
    const S = heroCityStart({ name: 'Nightwatch', foes: { thug: { class: 'brute' } } });
    expect(S.world.name).toBe('Nightwatch');
    expect(S.world.foes).toEqual({ thug: { class: 'brute' } });
    expect(heroCityStart({ levels: {} })).toBeNull();
    expect(S.says).toContain(HERO_CITY);
    // the vigilante rail's locked pitch lays it
    const P = pitchStart({ name: 'Nightwatch', rail: { from: 'vigilante-justice', locked: true } });
    expect(P.laid.by).toBe('hero-city');
    expect(P.world.levels).toHaveProperty('district');
  });
});
