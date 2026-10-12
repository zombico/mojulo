import { describe, it, expect } from 'vitest';
import { buildAdorned } from './tech-adornment.js';
import { craftTech } from './tech-crafter.js';
import { rankOf, MOTIF_IDS } from './tech-direction.js';
import { BODY_PLANS } from './tech-bodyplan.js';

// every body plan, by the words that reach it, through every motif and every camera: the solver's proof
const BRIEFS = [['vehicle', 'an armoured walker'], ['vehicle', 'a cargo walker'], ['vehicle', 'a battle tank'], ['vehicle', 'a tracked crawler'], ['vehicle', 'a hovercraft'], ['vehicle', 'a war galley'], ['vehicle', 'a sailing frigate'], ['vehicle', 'a steamship'],
  ['structure', 'a tall lattice relay tower beacon'], ['structure', 'a lighthouse'], ['structure', 'a radar watchtower'], ['structure', 'a city gate'], ['structure', 'a forcefield gate'],
  ['weapon', 'a turret'], ['weapon', 'a sentry gatling turret'], ['weapon', 'a field cannon'], ['weapon', 'a twin cannon']];
const LIST = { vehicle: 'vehicles', structure: 'structures', weapon: 'weapons' };

describe('the solver, swept', () => {
  it('every brief reaches a body plan, and every plan is reached', () => {
    const forms = new Set(BRIEFS.map(([k, i]) => `${k}/${craftTech(k, i).plan.form}`));
    expect([...forms].sort()).toEqual(Object.keys(BODY_PLANS).sort());
  });

  it('every brief × motif × camera holds every law, or names the conflict that stops it', () => {
    let held = 0, n = 0;
    const named = [];
    for (const [kind, intent] of BRIEFS) {
      const t = { ...craftTech(kind, intent).plan, intent }, rank = rankOf(LIST[kind], t).rank;
      for (const motif of MOTIF_IDS) for (const camera of ['third-person', 'top-down', 'first-person']) {
        const a = buildAdorned(t, { kind, direction: { motif, camera }, rank });
        n++;
        if (a.held) { held++; continue; }
        expect(a.conflict, `${intent} ${motif} ${camera}: ${JSON.stringify(a.laws.filter((l) => !l.ok))}`).toBeTruthy();
        named.push(`${intent} ${motif} ${camera}`);
      }
    }
    // the conflicts are the close camera's: a walker met at arm's length cannot round its masses under the hero's lead
    expect(named.every((x) => x.endsWith('first-person'))).toBe(true);
    expect(held / n).toBeGreaterThan(0.97);
  }, 600000);
});
