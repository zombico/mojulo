import { describe, it, expect } from 'vitest';
import { readPlace, placeLine, orrery, roman, readTheatre } from './theatre.js';
import { readMission, missionLaws, compileMission } from './mission.js';
import { briefingData } from './briefing.js';
import { briefingPage, briefingSpec } from './briefing-page.js';
import { craftMini, capitalMini, stationMini, miniFamily } from './holo-minis.js';
import { readSortie } from '../gameworld/flight-sortie.js';
import { MISSION_DESIGNS, missionLevel, MISSIONS, rebelStormStart } from '../gameworld/rebel-storm.js';

// the smallest design that runs every path: a pilot's flight, a foe group at a nav point, one arriving, a capital ship
const design = (over = {}) => ({
  id: 'm', name: 'Test', place: { system: 'Tor', cluster: 'Ash', station: 'Hale', moon: 2 },
  theatre: { moon: { kind: 'barren', bearing: 10, elevation: 5 }, station: { kind: 'outpost', at: [0, -800, 0] }, nav: { nav1: { name: 'Nav 1', at: [0, 1500, 0] } } },
  cast: [
    { id: 'red', name: 'Red', side: 'friend', count: 2, pilot: true },
    { id: 'foe', name: 'Foe', side: 'foe', count: 2, at: 'nav1' },
    { id: 'late', name: 'Late', side: 'foe', count: 1, at: [400, 2000, 100], arrive: { down: 'foe' } },
    { id: 'ship', name: 'Ship', side: 'foe', capital: 'corvette', at: [800, 2400, 0], heading: 180 },
  ],
  goals: [{ destroy: ['foe', 'late'] }],
  steps: [
    { title: 'You', say: 'Red flight.', show: ['red', 'station'] },
    { title: 'Them', say: 'Foes at Nav 1, more later.', show: ['foe', 'late', 'ship'], routes: [['start', 'nav1']] },
    { title: 'Orders', say: 'Destroy them.', show: ['red', 'foe', 'late'] },
  ],
  ...over,
});

describe('campaign: the place', () => {
  it('is named widest first, the moon by its numeral', () => {
    expect(placeLine(readPlace({ system: 'Kessa', cluster: 'Varn', station: 'Vigil', moon: 4 }))).toBe('Kessa System | Varn Cluster | Vigil Station | Moon IV');
    expect(placeLine(readPlace({ system: 'Kessa System', cluster: 'Varn Cluster', station: 'Vigil', moon: 9 }))).toBe('Kessa System | Varn Cluster | Vigil Station | Moon IX');
    expect(roman(12)).toBe('XII');
  });
  it('teaches a fault', () => {
    expect(() => readPlace({ system: 'Kessa', cluster: 'Varn', station: 'Vigil' })).toThrow(/moon is the moon's number/);
    expect(() => readTheatre({ moon: { kind: 'cheese', bearing: 0, elevation: 0 }, station: { kind: 'outpost', at: [0, 0, 0] } })).toThrow(/moon.kind is a kind of world/);
  });
  it('the orrery has the moon it names, and is the same for the same place', () => {
    const P = readPlace({ system: 'Tor', cluster: 'Ash', station: 'Hale', moon: 5 }), O = orrery(P);
    expect(O.planets[O.home].moons.length).toBeGreaterThanOrEqual(5);
    expect(O.planets[O.home].moons[4].kind).toBe('barren');
    expect(orrery(P)).toEqual(O);
  });
});

describe('campaign: a mission designed', () => {
  it('reads a design, its station in the cast under the place\'s name', () => {
    const M = readMission(design());
    expect(M.status).toBe('draft');
    expect(M.cast[0]).toMatchObject({ id: 'station', name: 'Hale Station', station: 'outpost' });
  });
  it('teaches a fault, naming the field', () => {
    expect(() => readMission(design({ steps: [{ title: 'A', say: 'b', show: ['nobody'] }, { title: 'B', say: 'c', show: ['red'] }] }))).toThrow(/steps\[0\]\.show: 'nobody'/);
    expect(() => readMission(design({ cast: design().cast.map(({ pilot, ...c }) => c) }))).toThrow(/pilot: true/);
    expect(() => readMission(design({ cast: [...design().cast, { id: 'x', name: 'X', side: 'foe', at: [0, 9000, 0] }] }))).toThrow(/inside the field/);
  });
  it('its laws say what a briefing leaves untold, advising', () => {
    expect(missionLaws(readMission(design())).every((L) => L.ok)).toBe(true);
    const M = readMission(design({ steps: [design().steps[0], { title: 'Orders', say: 'Go.', show: ['red', 'foe'] }] }));
    const by = Object.fromEntries(missionLaws(M).map((L) => [L.law, L.ok]));
    expect(by).toMatchObject({ 'foes-introduced': false, 'arrivals-told': false, 'goals-last': false });
  });
  it('compiles onto a sortie the level reads, the pilot\'s flight its wingmen, the fleet left to the build', () => {
    const C = compileMission(readMission(design()));
    const S = C.level.goal.flight.sortie;
    expect(() => readSortie(S)).not.toThrow();
    expect(S.groups.map((g) => [g.id, g.count])).toEqual([['red', 1], ['foe', 2], ['late', 1]]);
    expect(S.groups[1].at).toEqual({ side: 0, ahead: 1500, up: 0 });
    expect(C.level.airspace).toMatchObject({ cockpit: true, space: { backdrop: { worlds: ['barren'] } } });
    expect(C.build.fleet.map((f) => f.id)).toEqual(['station', 'ship']);
    expect(C.approved).toBe(false);
  });
});

describe('campaign: the holo briefing', () => {
  it('opens on the place, then tells the design\'s steps; each thing a miniature', () => {
    const D = briefingData(readMission(design()));
    expect(D.steps.map((s) => s.stage)).toEqual(['orrery', 'orrery', 'orrery', 'theatre', 'theatre', 'theatre']);
    expect(D.things.find((t) => t.id === 'late')).toMatchObject({ arrives: true, kind: 'group' });
    expect(D.things.find((t) => t.id === 'ship').mini.parts.length).toBeGreaterThan(5);
  });
  it('a craft stands as its family, a ship and a station as the fleet\'s pieces', () => {
    expect(miniFamily('strikeFoil')).toBe('foil');
    expect(miniFamily('starliner')).toBe('liner');
    expect(craftMini('twinPanel').parts.length).toBeGreaterThan(2);
    expect(capitalMini('frigate').length).toBe(280);
    expect(stationMini('outpost').parts.every((p) => p.box.length === 6)).toBe(true);
  });
  it('is one page that loads nothing from anywhere, the same for the same design', () => {
    const M = readMission(design()), html = briefingPage(M);
    expect(html).not.toMatch(/\b(src|href)=["']?https?:/);
    expect(html).toContain('"three":"data:text/javascript');
    expect(briefingPage(M)).toBe(html);
    expect(briefingPage(M, { cdn: true })).toContain('cdn.jsdelivr.net/npm/three@');
    expect(briefingSpec().defs).toHaveProperty('briefing-steps');
  });
});

describe('Rebel Storm: mission 1 designed', () => {
  it('reads, meets its laws, and compiles; a draft leaves its sortie as it was', () => {
    const M = readMission(MISSION_DESIGNS['mission-1']);
    expect(placeLine(M.place)).toBe('Kessa System | Varn Cluster | Vigil Station | Moon IV');
    expect(missionLaws(M).filter((L) => !L.ok)).toEqual([]);
    expect(() => compileMission(M)).not.toThrow();
    expect(M.status).toBe('draft');
    expect(missionLevel(MISSIONS[0]).goal.flight.sortie).toEqual(JSON.parse(JSON.stringify(MISSIONS[0].sortie)));
  });
  it('its game is drawn by mana-ui in the campaign\'s look, the creator\'s own ui winning', () => {
    expect(rebelStormStart({}).world.ui).toEqual({ theme: 'orbit' });
    expect(rebelStormStart({ ui: { theme: 'static' } }).world.ui).toEqual({ theme: 'static' });
  });
});
