// Jobsified laid in a played district (jobsified.js, levels.js): Hijack City's starter, its bin round. A whole district
// made (minutes), so the e2e tier. The laws: the shift is laid at the works yard nearest the start, its cabs the yard's
// own garbage trucks among the level's bodies, its stops places of the district's apart from each other and the yard,
// its task on Jobsified; the guide leads its round, and the errand proof drives it on the bus to its pay.
import { describe, it, expect } from 'vitest';
import { hijackCityWorld } from './hijack-city.js';
import { runSteps } from './runner.js';
import { cityGuide } from './city-guide.js';
import { phoneUi } from './phone-ui.js';
import { proveErrands, lastStageManifests } from './errand-proof.js';
import { SHIFT, SHIFTS } from './jobsified.js';

const world = hijackCityWorld(), steps = runSteps(world, { ref: 'hc' }), level = steps.find((x) => x.key.startsWith('level-')).order.manifest, M = level.game.mechanics;
const Sh = M.find((m) => m.kind === 'shift' && m.id === 'bin-round'), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('Hijack City\'s bin round, laid', () => {
  it('stands at the works yard, its cabs the yard\'s garbage trucks among the level\'s bodies', () => {
    expect(Sh).toMatchObject({ vehicle: SHIFTS.garbage.vehicle, yard: 'works yard', repeat: true, after: 'took-bin-round', reward: [{ item: 'coin', n: 40 }] });
    expect(Sh.cabs.length).toBeGreaterThan(0);
    for (const id of Sh.cabs) {
      const e = level.entities.find((x) => x.id === id);
      expect(e?.mount?.cab).toBe(true);
      expect(e.mount.pool.model).toBe('loft:refuseTruck');
      for (const i of [0, 1]) expect(Math.abs(e.transform.pos[i] - Sh.depot[i])).toBeLessThan(Sh.half[i]);
    }
  });
  it('its stops are the district\'s places, apart from each other and from the yard; its task is Jobsified\'s', () => {
    expect(Sh.stops).toHaveLength(SHIFTS.garbage.stops);
    for (const q of Sh.stops) { expect(typeof q.place).toBe('string'); expect(d(q.at, Sh.depot)).toBeGreaterThanOrEqual(SHIFT.apart); }
    for (let i = 0; i < Sh.stops.length; i++) for (let j = i + 1; j < Sh.stops.length; j++) expect(d(Sh.stops[i].at, Sh.stops[j].at)).toBeGreaterThanOrEqual(SHIFT.apart);
    expect(M.find((m) => m.kind === 'task' && m.id === 'bin-round')).toMatchObject({ app: 'jobsified', name: 'Jobsified', subscribe: true });
    expect(phoneUi(level).apps.map((a) => a.name)).toEqual(['TaskFu', 'Jobsified']);
    expect(level.play.quests.some((q) => q.id === 'bin-round')).toBe(true);
  });
  it('the guide leads its round when it is taken; the errand proof drives it to its pay (the getting in given)', () => {
    const g = cityGuide(level);
    expect(g.rounds).toHaveLength(1);
    expect(g.steps[g.rounds[0].at].id).toBe('clock-bin-round');
    const P = proveErrands(world, lastStageManifests(steps)).find((x) => x.errand === 'bin-round');
    expect(P.proved).toBe(true);
    expect(P.assumed[0]).toMatch(/garbage truck/);
  });
});
