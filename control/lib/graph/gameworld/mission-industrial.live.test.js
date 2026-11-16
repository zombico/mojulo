// AN INDUSTRIAL LEVEL, WHOLE (the e2e tier: it resolves the place, a building on its land). One world, the default
// yard. The concepts: what was planned with nothing resolved is what the geocube builds: the building's floor stands
// where it was asked, each container the design stood is a mass on the page, each barrier a low one, the yard fenced,
// a flood for each mast, the walker on the yard, the place wet under its rain; and the mission laid before it was built
// is played on it: the gunner walks the place's own colliders and its tasks are met. Machine gate only.
import { describe, expect, it } from 'vitest';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { playMission, proveMissions } from './mission-proof.js';
import { SEAT } from './mission-industrial.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const W = { id: 'il', name: 'IL', seed: 1, feel: SHOOTER, start: 'yard', levels: { yard: { name: 'The yard', industrial: true } } };

describe('an industrial level, on its page', () => {
  it('is built as it was planned, and the mission laid before it was built is played on it', async () => {
    const G = readGameworld(W), st = gameStages(W)[0], P = st.mission, O = stageLevelOrder(G, st, { ref: 'il-level-yard-0', heroRef: null }), Y = P.recipe.buildings[0].yard;
    const { payload: Pg } = await resolveWorldScene({ ref: 'il-level-yard-0', title: 'The yard', manifest: O.args.manifest }, { era: 'gen-7', live: true });
    const A = Pg.anchors.find((a) => a.kind === 'building');
    expect(A.floor).toBeCloseTo(SEAT.floor, 2);
    // (the yard's things on the page: a mass for each stack, a low one for each barrier, the fence's three runs)
    const yard = Pg.colliders.filter((c) => typeof c.of === 'string' && c.of.endsWith(':yard')), tall = yard.filter((c) => c.max[2] - c.min[2] > 2), low = yard.filter((c) => c.max[2] - c.min[2] < 1.5);
    expect(tall).toHaveLength(Y.stacks.length);
    expect(low).toHaveLength(Y.barriers.length);
    expect(Pg.colliders.filter((c) => typeof c.of === 'string' && c.of.endsWith(':fence'))).toHaveLength(3);
    expect(Pg.form.room.reflect.floods).toHaveLength(Y.masts.length);
    expect(Pg.form.room.reflect.wet).toMatchObject({ rain: 1 });
    expect(Pg.weather).toBeTruthy();
    expect(Object.keys(Pg.figures).some((k) => k.startsWith('parked'))).toBe(true);
    // (a stack stands where the design put it: the first, carried from the plan onto the land)
    const [sx, sy] = P.seat.toWorld(Y.stacks[0].at);
    expect(tall.some((c) => sx > c.min[0] - 0.01 && sx < c.max[0] + 0.01 && sy > c.min[1] - 0.01 && sy < c.max[1] + 0.01)).toBe(true);
    // (played on the place: its result said, never forced; a still player does not win; and through the run's gate)
    const R = playMission(Pg, P.mission, { seconds: 240 });
    expect(R.tasks.length).toBeGreaterThan(0);
    expect(playMission(Pg, P.mission, { player: 'still', seconds: 20 }).won).toBe(false);
    const [X] = proveMissions(W, { yard: O.args.manifest }, { payloads: { yard: Pg } });
    expect(X).toMatchObject({ level: 'yard', proved: true });
    expect(X.play).toMatch(/^gunner: /);
  }, 900000);
});
