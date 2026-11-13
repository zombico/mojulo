// The work room: a quick work world opens it at the practice door; it stands the line as counters, puts a stand-in (or
// the world's hero) on a feel template's rule, lays the shift's use zones, measures the shift at the template's run,
// and offers the presets to choose from.
import { describe, it, expect } from 'vitest';
import { workRoom, workOf, everydayFeel } from './work-room.js';
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
  it('stands the line as counters, the hero on the template\'s rule, the shift on the bus, measured and won', () => {
    const r = practiceRoomOf(G, 'work', { cast: 'female' });
    const M = r.manifest, hero = M.entities[0];
    expect(r.hero).toBe('stand-in');
    expect(M.figures.hero.hero).toEqual({ cast: 'female' });
    expect(hero.rule.speed).toBe(feelRule(everydayFeel()).speed);
    // a counter a place: each station slot, crate, shelf and the hand-in (the floor's four walls besides)
    const places = Object.values(r.layout.stations).flat().length + Object.keys(r.layout.crates).length + Object.keys(r.layout.shelves).length + 1;
    expect(M.colliders.length).toBe(places + 4);
    expect(M.events.sources.filter((z) => z.use).length).toBeGreaterThan(places);
    expect(r.measured.won).toBe(true);
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
    expect(r.choices.casts).toEqual(['male', 'female']);
    expect(workRoom(G, { refs: { hero: 'sk_hero' } }).hero).toBe('own');
  });
});
