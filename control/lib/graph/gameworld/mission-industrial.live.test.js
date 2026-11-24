// AN INDUSTRIAL LEVEL, WHOLE (the e2e tier: it resolves the place, a building on its land). One world, the default
// yard. The concepts: what was planned with nothing resolved is what the geocube builds: the building's floor stands
// where it was asked, each container the design stood is a mass on the page, each barrier a low one, the yard fenced,
// its tower a deck a level up with its stairs' steps under a body's step, the ground wet under no rain; and the mission laid before it was built
// is played on it: the gunner walks the place's own colliders and its tasks are met. Machine gate only.
import { describe, expect, it } from 'vitest';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { playMission, proveMissions } from './mission-proof.js';
import { SEAT } from './mission-industrial.js';
import { RISE } from '../arena-map/blocks.js';
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
    expect(Pg.form.room.reflect.wet).toMatchObject({ rain: 0 });
    expect(Pg.form.room.reflect.wet.amount).toBeGreaterThan(0.5);
    // (its tower: a deck whose top stands a level over the floor, and stairs whose every step is under a body's step)
    const tower = Pg.colliders.filter((c) => typeof c.of === 'string' && c.of.endsWith(':tower')), tops = [...new Set(tower.map((c) => Math.round(c.max[2] * 1000) / 1000))].sort((a, b) => a - b);
    expect(tops).toContain(SEAT.floor + RISE);
    const steps = tops.filter((z) => z <= SEAT.floor + RISE + 1e-6);
    for (let k = 1; k < steps.length; k++) expect(steps[k] - steps[k - 1]).toBeLessThan(0.3);
    // (a stack stands where the design put it: the first, carried from the plan onto the land)
    const [sx, sy] = P.seat.toWorld(Y.stacks[0].at);
    expect(tall.some((c) => sx > c.min[0] - 0.01 && sx < c.max[0] + 0.01 && sy > c.min[1] - 0.01 && sy < c.max[1] + 0.01)).toBe(true);
    // (its crew on the page: each body carries the hold it fires in, a clip played once and held, the weapon come up
    // from where it hangs: both hands end over the chest, forward of the body)
    const crew = Object.values(Pg.figures).filter((f) => f.clips?.fire);
    expect(crew.length).toBeGreaterThan(0);
    for (const f of crew) {
      const C = f.clips.fire, nb = f.bones.length, at = (bone, key) => C.b.slice((key * nb + f.bones.findIndex((b) => b.id === bone)) * 7 + 4, (key * nb + f.bones.findIndex((b) => b.id === bone)) * 7 + 7);
      expect(C.once).toBe(true);
      for (const hand of ['handR', 'handL']) { expect(at(hand, C.k - 1)[2]).toBeGreaterThan(at(hand, 0)[2] + 0.3); expect(at(hand, C.k - 1)[1]).toBeGreaterThan(0.2); }
    }
    // (heard on its page: its events wired to cues that are there, the wind, a score and the fight's, the meter that
    // changes between them)
    for (const id of Object.values(Pg.audio.on)) expect(Pg.audio.cues[id], id).toBeTruthy();
    expect(Pg.audio.wind).toBeTruthy();
    expect(Pg.audio.soundtrack && Pg.audio.combat && Pg.audio.tension).toBeTruthy();
    // (played on the place: its result said, never forced; a still player does not win; and through the run's gate)
    const R = playMission(Pg, P.mission, { seconds: 240 });
    expect(R.tasks.length).toBeGreaterThan(0);
    expect(playMission(Pg, P.mission, { player: 'still', seconds: 20 }).won).toBe(false);
    const [X] = proveMissions(W, { yard: O.args.manifest }, { payloads: { yard: Pg } });
    expect(X).toMatchObject({ level: 'yard', proved: true });
    expect(X.play).toMatch(/^gunner: /);
    // (the place built whole and played in Chrome: some 550 to 710 s on a quiet machine, past 900 s on a loaded runner)
  }, 1800000);
});
