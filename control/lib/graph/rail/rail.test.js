// rail — one read over every recipe on a rail. The laws: a rail's open concerns are exactly its own table's (the one
// `next` reads), so the dashboard and the readout never disagree; a concern that has not arisen is open, never given;
// a law that finds something advises, and one held by a waiver says so; a reviewed part's settlement says whose gate
// settled it and never lends the machine's to the eyes; parts are named as their mint names them and are fresh only
// when the store holds what was made; a part on a rail of its own carries its outcomes in brief; a recipe on no rail
// has none, and a broken one says what broke rather than throwing.

import { describe, it, expect } from 'vitest';
import { readRail, railFor, railIds, CONCERN_STATES } from './index.js';
import { readStructure } from '../structure/read.js';
import { openConcerns } from '../structure/open.js';
import { readCity, openCityConcerns } from '../city/plan/read.js';
import { inferCity } from '../city/plan/card.js';
import { cityGameOrder } from '../city/plan/game.js';
import { MEADOWMARK_HERO, runSteps, fingerprint, approve } from '../gameworld/index.js';
import { quickWorld } from '../gameworld/quick.js';

const HOUSE = { kind: 'floorplan', title: 'Bare', seed: 3, windows: true };
const CITY = { kind: 'city', ...inferCity({ seed: 3, grammar: 'new-york', board: { cols: 20, rows: 14 } }).recipe };
const SEGMENTED = { ...CITY, segments: { levels: true } };
const WORLD = { kind: 'gameworld', ...MEADOWMARK_HERO };

const flat = (rail) => rail.outcomes.flatMap((o) => o.concerns);
const stateOf = (rail, id) => flat(rail).find((c) => c.id === id)?.state;
const store = (rows) => (r) => (rows[r] ? { kind: rows[r].kind, manifest: rows[r] } : null);

describe('the rails', () => {
  it('each recipe finds its rail; a recipe on none has none', () => {
    expect(railIds()).toEqual(['structure', 'city', 'gameworld', 'solid']);
    expect(railFor(HOUSE).id).toBe('structure');
    expect(railFor(CITY).id).toBe('city');
    expect(railFor(WORLD).id).toBe('gameworld');
    expect(railFor({ kind: 'scad', source: 'cube(10);' }).id).toBe('solid');
    expect(railFor({ kind: 'terrain', seed: 1 })).toBeNull();
    expect(readRail({ kind: 'fractal-city', seed: 1 })).toBeNull();
  });

  it('a rail\'s open concerns are its own table\'s, the one `next` reads, and every state is one of four', () => {
    const house = readRail(HOUSE, { ref: 'sk_h' });
    const notGiven = (r) => flat(r).filter((c) => c.state === 'open' || c.state === 'advised').map((c) => c.id);
    expect(notGiven(house)).toEqual(expect.arrayContaining(openConcerns(HOUSE, readStructure(HOUSE)).map((c) => c.id)));
    const city = readRail(CITY, { ref: 'sk_c' });
    expect(notGiven(city)).toEqual(expect.arrayContaining(openCityConcerns(CITY, readCity(CITY).read).filter((c) => !c.export).map((c) => c.id)));
    for (const r of [house, city]) for (const c of flat(r)) expect(CONCERN_STATES).toContain(c.state);
    expect(house.exits).toEqual([{ id: 'book', href: '/api/sketches/sk_h/bible' }, { id: 'walk', href: '/api/sketches/sk_h/world' }]);
  });

  it('a concern that has not arisen is open, never given', () => {
    expect(stateOf(readRail(HOUSE), 'covering')).toBe('open');
    expect(stateOf(readRail(CITY), 'segments')).toBe('open');
    expect(stateOf(readRail(CITY), 'levels')).toBe('open');
    expect(stateOf(readRail(SEGMENTED), 'levels')).toBe('given');
  });

  it('a law that finds something advises; held by a waiver, it is waived', () => {
    const advised = flat(readRail(CITY)).find((c) => c.state === 'advised' && c.id === 'beats');
    expect(advised).toBeTruthy();
    expect(stateOf(readRail({ ...CITY, waive: ['beat-every'] }), 'beats')).toBe('waived');
  });

  it('is pure: the same recipe and store read the same', () => {
    expect(JSON.stringify(readRail(SEGMENTED, { ref: 'sk_c' }))).toBe(JSON.stringify(readRail(SEGMENTED, { ref: 'sk_c' })));
  });
});

describe('parts', () => {
  it('a city\'s levels and insides are named as its mint names them, missing until stored, its edifices by ref', () => {
    const order = cityGameOrder(readCity(SEGMENTED).design, 'sk_c');
    const named = [...order.sketches.map((s) => s.ref), ...order.interiors.map((x) => x.ref)];
    const none = readRail(SEGMENTED, { ref: 'sk_c' });
    expect(none.parts.map((p) => p.ref)).toEqual(named);
    expect(none.parts.every((p) => p.state === 'missing')).toBe(true);
    const rows = Object.fromEntries(order.sketches.map((s) => [s.ref, s.manifest]));
    const some = readRail(SEGMENTED, { ref: 'sk_c', row: store({ ...rows, sk_c: SEGMENTED }) });
    expect(some.parts.filter((p) => p.role === 'level').every((p) => p.state === 'fresh')).toBe(true);
  });

  it('a segment\'s level is shown on its city\'s rail, with no parts of its own', () => {
    const seg = readCity(SEGMENTED).design.segments[0].id;
    const rail = readRail({ kind: 'city', city: 'sk_c', level: { segment: seg } }, { ref: `sk_c-${seg}`, row: store({ sk_c: SEGMENTED }) });
    expect(rail).toMatchObject({ rail: 'city', parent: 'sk_c', parts: [] });
    expect(rail.exits[0]).toEqual({ id: 'book', href: '/api/sketches/sk_c/bible' });
  });

  it('a part on a rail of its own carries its outcomes in brief, one level deep', () => {
    const order = cityGameOrder(readCity(SEGMENTED).design, 'sk_c');
    const inside = order.interiors[0];
    expect(inside).toBeTruthy();
    const rail = readRail(SEGMENTED, { ref: 'sk_c', row: store({ [inside.ref]: inside.manifest }) });
    const part = rail.parts.find((p) => p.ref === inside.ref);
    expect(part.state).toBe('fresh');
    expect(part.rail.map((o) => o.id)).toEqual(['concept', 'layout', 'drawings', 'build']);
    expect(part.rail.reduce((n, o) => n + o.given + o.open + o.advised + o.waived, 0)).toBeGreaterThan(0);
  });
});

describe('the gameworld rail', () => {
  const world = readRail(WORLD, { ref: 'gw' });

  it('groups the book\'s parts into what a game asks of its maker; a world that writes no intent has it open', () => {
    expect(world.outcomes.map((o) => o.id)).toEqual(['intent', 'world', 'characters', 'systems', 'levels', 'story', 'play']);
    expect(stateOf(world, 'intent')).toBe('open');
    expect(world.outcomes.find((o) => o.id === 'levels').concerns.length).toBeGreaterThan(0);
  });

  it('the creator\'s approval is the eyes gate; the agent\'s is the machine\'s, settled but never approved', () => {
    const approved = readRail({ ...WORLD, review: approve(MEADOWMARK_HERO, 'key') }, { ref: 'gw' });
    expect(flat(approved).find((c) => c.id === 'key')).toMatchObject({ state: 'given', gate: 'eyes' });
    const auto = readRail({ kind: 'gameworld', ...quickWorld({ id: 'q', mode: 'autonomous', quick: { goal: 'reach' } }) }, { ref: 'q' });
    const settled = flat(auto).filter((c) => c.state === 'given');
    expect(settled.length).toBeGreaterThan(0);
    for (const c of settled) expect(c.gate).toBe('machine');
  });

  it('what a run made is fresh only when the store holds what it left; missing before', () => {
    expect(world.parts[0]).toMatchObject({ ref: 'gw-hero', role: 'hero', state: 'missing' });
    const [hero] = runSteps(MEADOWMARK_HERO, { ref: 'gw' });
    const stored = { kind: 'layered', marker: 1 };
    const made = { hero: { ref: hero.ref, order: hero.print, stored: fingerprint(stored) } };
    const after = readRail({ ...WORLD, made }, { ref: 'gw', row: store({ [hero.ref]: stored }) });
    expect(after.parts[0].state).toBe('fresh');
    const edited = readRail({ ...WORLD, made }, { ref: 'gw', row: store({ [hero.ref]: { ...stored, marker: 2 } }) });
    expect(edited.parts[0].state).toBe('edited');
  });
});

describe('the solid rail', () => {
  it('an ask caps the rungs; the ladder\'s fields are open at the rung that wants them', () => {
    const capped = readRail({ kind: 'scad', source: 'cube(10);', units: 'mm', ask: 'function' }, { ref: 'sk_s' });
    expect(capped.outcomes.map((o) => o.id)).toEqual(['look', 'fit', 'function']);
    expect(stateOf(capped, 'strength')).toBe('open');
    expect(readRail({ kind: 'scad', source: 'cube(10);' }).outcomes.map((o) => o.id)).toEqual(['look', 'fit', 'function', 'engineered']);
  });
});

describe('a broken recipe', () => {
  it('says what broke rather than throwing', () => {
    const rail = readRail({ kind: 'gameworld', id: 'x', levels: 'not a map' }, { ref: 'x' });
    expect(rail.rail).toBe('gameworld');
    expect(rail.errors.length).toBeGreaterThan(0);
  });
});
