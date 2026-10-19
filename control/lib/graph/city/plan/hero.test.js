// A city segment played by a HERO (`level.hero`, the city stalker): the player slot's platform rule, tuned in metres and
// turned into the city's units once; a made character drawn at 1 / unit or a stand-in box; a chase camera; the
// segment's edges risen to the sky; and its roofs ground. Absent, the walker plays it as before.
import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { withCityLevel, CITY_HERO, ruleInUnits, CITY_LEVEL } from './level.js';
import { simLevel } from '../../game/level-sim.js';
import { faceGround } from '../../game/level-equivalence.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

const recipe = inferCity({ seed: 3, grammar: 'new-york', board: { cols: 12, rows: 9 }, segments: true }).recipe;
const d = designCity(recipe), s = d.segments[0];
const lower = (level) => withCityLevel({ kind: 'city', ...recipe, cityRef: 'sk_city', level: { segment: s.id, ...level } }, d, `sk_city-${s.id}`);

describe('a city segment played by a hero', () => {
  it('is the walker\'s, byte for byte, without one', () => {
    const m = lower({});
    expect(m.entities).toHaveLength(1);
    expect(m.entities[0].rule.type).toBe('walk');
    expect(m.camera.rule).toBe('eye');
    expect(m.figures).toBeUndefined();
    expect(Math.max(...m.colliders.filter((c) => c.of.startsWith('edge')).map((c) => c.max[2]))).toBeCloseTo(CITY_LEVEL.wall / U, 2);
  });

  it('runs, jumps and falls in the city\'s units what it was tuned to in metres', () => {
    const r = lower({ hero: {} }).entities[0].rule;
    expect(r.type).toBe('platform');
    for (const k of ['speed', 'jumpSpeed', 'gravity', 'maxFall', 'collideRadius']) expect(r[k] * U).toBeCloseTo(CITY_HERO.rule[k], 1);
    // a rule's times, turns and fractions are no lengths: the unit leaves them alone
    expect(ruleInUnits({ coyote: 0.1, turn: 2.6, airControl: 0.7, speed: U })).toEqual({ coyote: 0.1, turn: 2.6, airControl: 0.7, speed: 1 });
  });

  it('is a made character drawn at 1 / unit, or a stand-in box standing on the street', () => {
    const made = lower({ hero: { ref: 'sk_hero', gaits: ['jog'] } });
    expect(made.figures.hero).toMatchObject({ heroRef: 'sk_hero' });
    expect(made.entities[0].body).toEqual({ type: 'figure-rig', figure: 'hero', scale: Math.round(1000 / U) / 1000 });
    expect(made.entities[0].transform.pos[2]).toBe(0);
    const stand = lower({ hero: {} });
    expect(stand.figures).toBeUndefined();
    expect(stand.entities[0].body.type).toBe('mesh');
    // a box is drawn about its point: the point at its half height stands it on the street
    expect(stand.entities[0].transform.pos[2]).toBeCloseTo(stand.entities[0].body.size[2] / 2, 3);
  });

  it('is chased by a follow camera, arrives where it came in, and is walled to the sky', () => {
    const m = lower({ hero: {} });
    expect(m.camera).toMatchObject({ rule: 'follow', target: 'hero' });
    expect(m.events.reactions.every((x) => x.target === 'hero')).toBe(true);
    const tallest = Math.max(...m.colliders.filter((c) => c.of.startsWith('lot:')).map((c) => c.max[2]));
    for (const c of m.colliders.filter((x) => x.of.startsWith('edge'))) expect(c.max[2]).toBeGreaterThan(tallest);
  });

  it('stands on a lot\'s roof: the box top is ground', () => {
    const m = lower({ hero: {} }), lot = m.colliders.find((c) => /^lot:[^:]+$/.test(c.of) && c.max[2] * U > 20);
    const [x0, y0] = lot.min, [x1, y1, top] = lot.max;
    // the lot as the page has it: its roof a face over its box, and the street at 0
    const faces = [
      { corners: [[x0, y0, top], [x1, y0, top], [x1, y1, top], [x0, y1, top]] },
      { corners: [[x0 - 50, y0 - 50, 0], [x1 + 50, y0 - 50, 0], [x1 + 50, y1 + 50, 0], [x0 - 50, y1 + 50, 0]] },
    ];
    const hero = m.entities[0], eye = hero.rule.eye;
    const sim = simLevel({ entities: [{ ...hero, transform: { pos: [(x0 + x1) / 2, (y0 + y1) / 2, top + 3 / U + eye], heading: 0 } }], colliders: [lot] }, { ground: faceGround(faces) });
    sim.run(2);
    const h = sim.world.byId.hero;
    expect(h.grounded).toBe(true);
    expect(h.transform.pos[2] - eye).toBeCloseTo(top, 2);
  });

  it('is asked for as { ref?, gaits? }, and nothing else', () => {
    const plan = (hero) => readCityPlan({ ...recipe, level: { segment: s.id, hero } });
    expect(() => plan({})).not.toThrow();
    expect(() => plan({ ref: 'sk_hero', gaits: ['jog'] })).not.toThrow();
    expect(() => plan(true)).toThrow(/level.hero is \{ ref\?, gaits\? \}/);
    expect(() => plan({ ref: 3 })).toThrow(/level.hero/);
    expect(() => plan({ speed: 9 })).toThrow(/level.hero/);
  });
});
