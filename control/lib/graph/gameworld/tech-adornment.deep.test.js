import { describe, it, expect } from 'vitest';
import { buildAdorned } from './tech-adornment.js';
import { craftTech } from './tech-crafter.js';
import { rankOf, useOf, MOTIF_IDS } from './tech-direction.js';
import { BODY_PLANS, variantOf } from './tech-bodyplan.js';

// every body plan, by the words that reach it, through every camera, the motifs walked across them so every motif meets
// every camera: the solver's proof
const BRIEFS = [['vehicle', 'an armoured walker'], ['vehicle', 'a cargo walker'], ['vehicle', 'a battle tank'], ['vehicle', 'a tracked crawler'], ['vehicle', 'a hovercraft'], ['vehicle', 'a war galley'], ['vehicle', 'a sailing frigate'], ['vehicle', 'a steamship'],
  ['structure', 'a tall lattice relay tower beacon'], ['structure', 'a lighthouse'], ['structure', 'a radar watchtower'], ['structure', 'a city gate'], ['structure', 'a forcefield gate'],
  ['weapon', 'a turret'], ['weapon', 'a sentry gatling turret'], ['weapon', 'a field cannon'], ['weapon', 'a twin cannon'],
  // combined machines: every variant of the wheeled, rail, drawn and two-wheeled rows
  ['vehicle', 'a car'], ['vehicle', 'a cargo truck'], ['vehicle', 'a city bus'], ['vehicle', 'an armoured car'], ['vehicle', 'a steam locomotive'], ['vehicle', 'a passenger train'],
  ['vehicle', 'a farm cart'], ['vehicle', 'a covered wagon'], ['vehicle', 'a war chariot'], ['vehicle', 'a stagecoach'], ['vehicle', 'a bicycle'], ['vehicle', 'a motorcycle']];
const LIST = { vehicle: 'vehicles', structure: 'structures', weapon: 'weapons' };
const CAMERAS = ['third-person', 'top-down', 'first-person'];
const reachOf = ([k, i]) => { const t = craftTech(k, i).plan; return `${k}/${t.form}/${variantOf(BODY_PLANS[`${k}/${t.form}`], t).variant}`; };
// one brief per body plan and variant it reaches: the solver runs the same for two words that land on the same row
const ONE_PER_ROW = [];
for (const b of BRIEFS) if (!ONE_PER_ROW.some((x) => reachOf(x) === reachOf(b))) ONE_PER_ROW.push(b);

describe('the solver, swept', () => {
  it('every brief reaches a body plan, and every plan and variant is reached', () => {
    const forms = new Set(BRIEFS.map(([k, i]) => `${k}/${craftTech(k, i).plan.form}`));
    expect([...forms].sort()).toEqual(Object.keys(BODY_PLANS).sort());
    const reached = new Set(BRIEFS.map(reachOf));
    for (const [id, row] of Object.entries(BODY_PLANS)) for (const v of row.variants ?? []) expect(reached, `${id}/${v.name}`).toContain(`${id}/${v.name}`);
  });

  // each row is seen through every camera, the motifs walked across the rows so every motif meets every camera
  const motifOf = (i, j) => MOTIF_IDS[(i + j) % MOTIF_IDS.length];
  it('the rows, between them, see every motif through every camera', () => {
    const pairs = new Set(ONE_PER_ROW.flatMap((_, i) => CAMERAS.map((camera, j) => `${motifOf(i, j)}/${camera}`)));
    expect(pairs.size).toBe(MOTIF_IDS.length * CAMERAS.length);
  });

  // designed at person scale, with a budget by use, its rounds shaded smooth and held to their outline: every one
  // holds, a driven hull seen from its own cockpit included (a conflict, were there one, is named, never silent)
  ONE_PER_ROW.forEach(([kind, intent], i) => {
    it(`${intent}, through every camera, met by its use, holds every law at person scale`, () => {
      const t = { ...craftTech(kind, intent).plan, intent }, rank = rankOf(LIST[kind], t).rank, use = useOf(LIST[kind], t).use;
      CAMERAS.forEach((camera, j) => {
        const motif = motifOf(i, j), a = buildAdorned(t, { kind, direction: { motif, camera }, rank, use });
        if (!a.held) expect(a.conflict, `${intent} ${motif} ${camera}: ${JSON.stringify(a.laws.filter((l) => !l.ok))}`).toBeTruthy();
        expect(a.held, `${intent} ${motif} ${camera}: ${a.conflict?.why ?? ''}`).toBe(true);
      });
    });
  });
});
