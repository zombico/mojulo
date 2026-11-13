// The work room: a quick work world opens it at the practice door; it stands the line as counters, puts a stand-in (or
// the world's hero) on a feel template's rule, lays the shift's use zones, measures the shift at the template's run,
// and offers the presets to choose from.
import { describe, it, expect } from 'vitest';
import { workRoom, workOf, everydayFeel, WORK_CASTS, WORK_CAST } from './work-room.js';
import { isMascotPlan } from '../egocube/mascot-pilot.js';
import { FORM_MEASURES } from '../egocube/mascot-form.js';
import { practiceFor, practiceRoomOf } from './practice.js';
import { POLES, POLE_IDS } from './feel/cards.js';
import { feelRule } from './feel/lower.js';
import { SCENARIOS } from '../worksim/scenarios.js';

const G = { id: 'shift', name: 'Shift', quick: { goal: 'work' } };

describe('the work room', () => {
  it('opens at the practice door for a world that works a shift, and only then', () => {
    expect(workOf(G)).toEqual({ card: 'kitchen', challenge: 'beginner' });
    expect(practiceFor(G).rooms).toContain('work');
    expect(workOf({ id: 'x', quick: { goal: 'farm' } })).toBeNull();
    expect(practiceFor({ id: 'x' }).rooms).not.toContain('work');
  });
  it('the everyday walker is the realistic template that runs slowest', () => {
    const f = everydayFeel(), real = POLE_IDS.filter((id) => POLES[id].base === 'realistic');
    expect(real).toContain(f);
    for (const id of real) expect(feelRule(f).speed).toBeLessThanOrEqual(feelRule(id).speed);
  });
  it('the worker is a mascot of a form from the presets, carried inline, on the template\'s rule, the shift measured and won', () => {
    expect(WORK_CASTS).toEqual(Object.keys(FORM_MEASURES));
    const form = WORK_CASTS.find((c) => c !== WORK_CAST);
    const r = practiceRoomOf(G, 'work', { cast: form });
    const M = r.manifest, hero = M.entities[0];
    expect(r.hero).toBe('mascot');
    expect(r.mascot.form).toBe(form);
    expect(isMascotPlan(M.figures.hero.layered.plan)).toBe(true);
    expect(M.figures.hero.heroRef).toBeUndefined();
    // its own body's capsule, the template's run, moving up the screen under the overhead camera
    expect(hero.rule.collideHeight).toBeCloseTo(M.figures.hero.layered.plan.mascot.height, 2);
    expect(hero.rule.speed).toBe(feelRule(everydayFeel()).speed);
    expect(M.camera.rule).toBe('overhead');
    expect(hero.rule.move).toBe('world');
    expect(() => workRoom(G, { cast: 'female' })).toThrow(/mascot form/);
    // a counter a place: each station slot, crate, shelf and the hand-in (the floor's four walls besides)
    const places = Object.values(r.layout.stations).flat().length + Object.keys(r.layout.crates).length + Object.keys(r.layout.shelves).length + 1;
    expect(M.colliders.length).toBe(places + 4);
    expect(M.events.sources.filter((z) => z.use).length).toBeGreaterThan(places);
    expect(r.measured.won).toBe(true);
  });
  it('shows the work: the floor is the recipe, and pips stand over every station slot and shelf', () => {
    const r = workRoom(G), M = r.manifest;
    const flow = M.faces.filter((f) => f.group === 'room:flow');
    // an arrow (a strip and its head) at least into every station slot that takes something
    const takers = Object.values(r.layout.stations).flat().length;
    expect(flow.length).toBeGreaterThanOrEqual(2 * takers);
    expect(M.faces.some((f) => f.group === 'room:floor')).toBe(false);
    const pips = M.events.entities.filter((e) => e.type === 'work-pip');
    expect(pips.length).toBeGreaterThanOrEqual(5 * takers);
    expect(pips.every((p) => p.on === false)).toBe(true);
  });
  it('a card with a site stands its line on a deck, the hand-in on the ground below a real ladder, walked by the proof', () => {
    const [id, card] = Object.entries(SCENARIOS).find(([, c]) => c.site);
    const r = workRoom({ id: 'up', quick: { goal: 'work', card: id } }), up = card.site.up, M = r.manifest;
    const climbable = M.entities.filter((e) => e.rule?.type === 'climbable');
    expect(climbable.length).toBe(1);
    expect(r.site.top[2]).toBe(up);
    expect(r.site.bottom[2]).toBe(0);
    expect(r.layout.serve[2]).toBe(0);
    for (const at of Object.values(r.layout.stations).flat()) expect(at[2]).toBe(up);
    expect(M.entities[0].transform.pos[2]).toBe(up);
    // the recipe's arrow from the deck runs to the climb, and on from its foot to the bin on the ground
    expect(M.faces.some((f) => f.group === 'room:flow' && f.corners[0][2] < 0.1)).toBe(true);
    // the deck: a block as high as the site, under every place on it
    expect(M.colliders.some((c) => c.max[2] === up && c.min[2] === 0 && c.max[0] - c.min[0] > 4)).toBe(true);
    expect(r.measured.won).toBe(true);
  });
  it('a template chosen from the presets moves the hero, and the presets are every template and both bodies', () => {
    const fast = POLE_IDS.reduce((a, b) => (feelRule(b).speed > feelRule(a).speed ? b : a));
    const r = workRoom(G, { feel: fast });
    expect(r.feel).toBe(fast);
    expect(r.manifest.entities[0].rule.speed).toBe(feelRule(fast).speed);
    expect(r.choices.feels.map((f) => f.id)).toEqual(POLE_IDS);
    expect(r.choices.casts).toEqual(WORK_CASTS);
    expect(workRoom(G, { refs: { hero: 'sk_hero' } }).hero).toBe('own');
  });
  it('the page resolves the inline mascot as a rigged body, and refuses an inline recipe that cannot pilot', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const r = workRoom(G);
    const { payload } = await resolveWorldScene({ ref: 'work-room-test', manifest: r.manifest }, {});
    const hero = payload.entities.find((e) => e.pilotable);
    expect(hero.body.type).toBe('figure-rig');
    expect(payload.figures?.hero ?? payload.figureRigs?.hero ?? hero.body.figure).toBeTruthy();
    const bad = { ...r.manifest, figures: { hero: { ...r.manifest.figures.hero, layered: { plan: { stations: [] } } } } };
    await expect(resolveWorldScene({ ref: 'work-room-bad', manifest: bad }, {})).rejects.toThrow(/inline layered recipe/);
  }, 60000);
});
