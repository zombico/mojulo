import { describe, it, expect } from 'vitest';
import { buildAdorned } from './tech-adornment.js';
import { craftTech } from './tech-crafter.js';
import { rankOf, useOf, MOTIF_IDS } from './tech-direction.js';
import { BODY_PLANS, variantOf } from './tech-bodyplan.js';

// every body plan, by the words that reach it, through every motif and every camera: the solver's proof
const BRIEFS = [['vehicle', 'an armoured walker'], ['vehicle', 'a cargo walker'], ['vehicle', 'a battle tank'], ['vehicle', 'a tracked crawler'], ['vehicle', 'a hovercraft'], ['vehicle', 'a war galley'], ['vehicle', 'a sailing frigate'], ['vehicle', 'a steamship'],
  ['structure', 'a tall lattice relay tower beacon'], ['structure', 'a lighthouse'], ['structure', 'a radar watchtower'], ['structure', 'a city gate'], ['structure', 'a forcefield gate'],
  ['weapon', 'a turret'], ['weapon', 'a sentry gatling turret'], ['weapon', 'a field cannon'], ['weapon', 'a twin cannon'],
  // combined machines: every variant of the wheeled, rail, drawn and two-wheeled rows
  ['vehicle', 'a car'], ['vehicle', 'a cargo truck'], ['vehicle', 'a city bus'], ['vehicle', 'an armoured car'], ['vehicle', 'a steam locomotive'], ['vehicle', 'a passenger train'],
  ['vehicle', 'a farm cart'], ['vehicle', 'a covered wagon'], ['vehicle', 'a war chariot'], ['vehicle', 'a stagecoach'], ['vehicle', 'a bicycle'], ['vehicle', 'a motorcycle']];
const LIST = { vehicle: 'vehicles', structure: 'structures', weapon: 'weapons' };

describe('the solver, swept', () => {
  it('every brief reaches a body plan, and every plan and variant is reached', () => {
    const forms = new Set(BRIEFS.map(([k, i]) => `${k}/${craftTech(k, i).plan.form}`));
    expect([...forms].sort()).toEqual(Object.keys(BODY_PLANS).sort());
    const reached = new Set(BRIEFS.map(([k, i]) => { const t = craftTech(k, i).plan; return `${k}/${t.form}/${variantOf(BODY_PLANS[`${k}/${t.form}`], t).variant}`; }));
    for (const [id, row] of Object.entries(BODY_PLANS)) for (const v of row.variants ?? []) expect(reached, `${id}/${v.name}`).toContain(`${id}/${v.name}`);
  });

  it('every brief × motif × camera, met by its use, holds every law at person scale, or names the conflict that stops it', () => {
    let held = 0, n = 0;
    const named = [];
    for (const [kind, intent] of BRIEFS) {
      const t = { ...craftTech(kind, intent).plan, intent }, rank = rankOf(LIST[kind], t).rank, use = useOf(LIST[kind], t).use;
      for (const motif of MOTIF_IDS) for (const camera of ['third-person', 'top-down', 'first-person']) {
        const a = buildAdorned(t, { kind, direction: { motif, camera }, rank, use });
        n++;
        if (a.held) { held++; continue; }
        expect(a.conflict, `${intent} ${motif} ${camera}: ${JSON.stringify(a.laws.filter((l) => !l.ok))}`).toBeTruthy();
        named.push(`${intent} ${motif} ${camera}`);
      }
    }
    // designed at person scale, with a budget by use, its rounds shaded smooth and held to their outline: every one
    // holds, a driven hull seen from its own cockpit included
    expect(named, named.join(' | ')).toEqual([]);
    expect(held).toBe(n);
  }, 600000);
});
