import { describe, it, expect } from 'vitest';
import { operationBriefingData, readOperationBriefing, OPERATION_BRIEF } from './operation-brief.js';
import { warlordsOfMarsStart, OPERATIONS } from '../gameworld/warlords-of-mars.js';
import { readGameworld } from '../gameworld/world.js';

// THE OPERATION'S BRIEFING (operation-brief.js): a frame level told on the holo table. One case per concept: a design
// is read, teaching; the table is the field's own ground with every group and beacon on it; a works' field stands its
// masses; an operation with no design is told a step a task. Each case is chosen by what it has, never by its name.
const G = readGameworld({ id: 'wom', name: 'Warlords of Mars', ...warlordsOfMarsStart({}).world });
const designed = OPERATIONS.find((o) => o.briefing), plain = OPERATIONS.find((o) => !o.briefing), works = OPERATIONS.find((o) => o.briefing && ['smelter', 'refinery'].includes(o.map));

describe('the operation\'s briefing', () => {
  it('reads a design, teaching each fault', () => {
    expect(readOperationBriefing({ steps: [{ title: 'A', say: 'B', show: ['drop'] }] }, ['drop']).steps).toHaveLength(1);
    expect(() => readOperationBriefing({ steps: [] }, ['drop'])).toThrow(/1 to/);
    expect(() => readOperationBriefing({ steps: [{ title: 'A', say: 'B', show: ['nobody'] }] }, ['drop'])).toThrow(/one of drop/);
    expect(() => readOperationBriefing({ steps: [{ title: 'A', say: 'B', routes: [['drop']] }] }, ['drop'])).toThrow(/pairs/);
  });

  it('lays the field\'s own ground as the table\'s, every group where it stands and each beacon, and tells its design', () => {
    const D = operationBriefingData(G, designed.id), T = D.theatre.terrain;
    expect(T.nx * T.ny).toBe(T.z.length);
    expect(Math.min(...T.z)).toBe(0);
    expect(D.things.find((t) => t.pilot).id).toBe('drop');
    for (const g of designed.groups) expect(D.things.some((t) => t.id === g.id && t.side === 'foe' && t.mini)).toBe(true);
    const reaches = designed.tasks.filter((t) => t.reach).length;
    expect(D.things.filter((t) => t.kind === 'beacon')).toHaveLength(reaches);
    expect(D.steps.map((s) => s.title)).toEqual(designed.briefing.steps.map((s) => s.title));
    expect(D.steps.every((s) => s.stage === 'theatre')).toBe(true);
    expect(D.place.parts).toEqual(['Sol', 'Mars', designed.briefing.region, designed.name]);
    expect(D.goals).toHaveLength(designed.tasks.length);
  });

  it('stands a works\' machines on the table, its hall\'s walls left off', () => {
    const D = operationBriefingData(G, works.id), span = D.theatre.field;
    expect(D.theatre.masses.length).toBeGreaterThan(0);
    expect(D.theatre.masses.length).toBeLessThanOrEqual(OPERATION_BRIEF.masses);
    expect(D.theatre.masses.every(([, , , w, d]) => Math.max(w, d) < span * 0.7)).toBe(true);
  });

  it('tells an operation with no design a step for its field and one a task', () => {
    const D = operationBriefingData(G, plain.id);
    expect(D.steps).toHaveLength(1 + plain.tasks.length);
    expect(D.theatre.masses).toEqual([]);
  });
});
