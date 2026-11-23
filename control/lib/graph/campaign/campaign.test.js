import { describe, it, expect } from 'vitest';
import { readPlace, placeLine, orrery, roman, readTheatre } from './theatre.js';
import { readMission, missionLaws, compileMission } from './mission.js';
import { briefingData } from './briefing.js';
import { briefingPage, briefingSpec } from './briefing-page.js';
import { craftMini, capitalMini, stationMini, miniFamily } from './holo-minis.js';
import { readSortie } from '../gameworld/flight-sortie.js';
import { MISSION_DESIGNS, missionLevel, MISSIONS, rebelStormStart } from '../gameworld/rebel-storm.js';
import { readMissions, withMissions, missionsReadout, applyMissionEdit } from './designer.js';
import { readGameworld } from '../gameworld/world.js';

// Rebel Storm's world as its rail lays it, its approved missions laid as their levels
const storm = () => withMissions({ id: 'storm', ...rebelStormStart({}).world });

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
    expect(C.level.airspace).toMatchObject({ cockpit: true, space: { backdrop: { worlds: ['barren'], toward: { bearing: 10, elevation: 5 } } } });
    // the capital ships and the station laid off the fleet where the briefing shows them
    expect(C.level.airspace.space.fleet).toEqual([
      { id: 'station', station: 'outpost', at: { side: 0, ahead: -800, up: 0 }, heading: 0 },
      { id: 'ship', capital: 'corvette', at: { side: 800, ahead: 2400, up: 0 }, heading: 180 },
    ]);
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
  it('reads, meets its laws; approved, its level is compiled from it; a mission with no design keeps its sortie', () => {
    const M = readMission(MISSION_DESIGNS['mission-1']);
    expect(placeLine(M.place)).toBe('Kessa System | Varn Cluster | Vigil Station | Moon IV');
    expect(missionLaws(M).filter((L) => !L.ok)).toEqual([]);
    expect(M.status).toBe('approved');
    const L = storm().levels['mission-1'], C = compileMission(M, { design: MISSION_DESIGNS['mission-1'] }).level;
    expect([L.airspace, L.goal]).toEqual([C.airspace, C.goal]);
    // (briefed on the holo table as its level loads: the design itself rides the level, read again by the page)
    expect(readMission(L.airspace.briefing)).toEqual(M);
    expect(L.airspace.space.fleet.map((f) => f.id)).toEqual(['station', 'kestrel', 'dominion']);
    // (a mission with no design keeps its sortie)
    expect(storm().levels['mission-3']).toEqual(missionLevel(MISSIONS[2]));
  });
  it('its game is drawn by mana-ui in the campaign\'s look, the creator\'s own ui winning', () => {
    expect(rebelStormStart({}).world.ui).toEqual({ theme: { from: 'orbit', overlay: 'none' } });
    expect(rebelStormStart({ ui: { theme: 'static' } }).world.ui).toEqual({ theme: 'static' });
  });
});

describe('Rebel Storm: mission 2 designed on beacons', () => {
  it('reads its beacons, meets its laws, compiles them into its sortie, and draws them on the briefing', () => {
    const M = readMission(MISSION_DESIGNS['mission-2']);
    expect(M.status).toBe('approved');
    expect(missionLaws(M).filter((L) => !L.ok)).toEqual([]);
    const S = compileMission(M).level.goal.flight.sortie;
    expect(S.beacons.map((b) => [b.id, !!b.lit])).toEqual([['rendezvous', false], ['home', true]]);
    expect(S.groups.find((g) => g.id === 'convoy').arrive).toMatchObject({ reach: 'rendezvous' });
    expect(() => readSortie(S)).not.toThrow();
    const D = briefingData(M);
    expect(D.things.filter((t) => t.kind === 'beacon').map((t) => [t.id, !!t.dark])).toEqual([['rendezvous', false], ['home', true]]);
    expect(D.goals.map((g) => g.text)).toContain('Reach: Harrow approach');
    // approved, its level is laid from it
    expect(storm().levels['mission-2'].goal.flight.sortie.beacons.map((b) => b.id)).toEqual(['rendezvous', 'home']);
  });
  it('teaches a beacon no step shows, and one a goal names that is not there', () => {
    const D = JSON.parse(JSON.stringify(MISSION_DESIGNS['mission-2']));
    D.steps = D.steps.map((st) => ({ ...st, show: st.show.filter((id) => id !== 'home') })).filter((st) => st.show.length);
    expect(missionLaws(readMission(D)).find((L) => L.law === 'beacons-told').ok).toBe(false);
    const E = JSON.parse(JSON.stringify(MISSION_DESIGNS['mission-2']));
    E.goals.push({ reach: 'nowhere' });
    expect(() => compileMission(readMission(E))).toThrow(/no beacon of the sortie/);
  });
});

describe('the mission designer: a game\'s missions drafted, edited on the table and approved', () => {
  const draft = () => ({ ...JSON.parse(JSON.stringify(MISSION_DESIGNS['mission-2'])), status: 'draft' });
  it('reads a world\'s missions, teaching; lays an approved one as its level and leaves a draft\'s level alone', () => {
    expect(() => readMissions({ 'mission-2': { ...draft(), id: 'other' } })).toThrow(/a mission's id is its key/);
    expect(() => readMissions({ m: { ...draft(), steps: [] } })).toThrow(/missions\.m/);
    const W = { id: 'w', ...rebelStormStart({}).world, missions: { 'mission-2': draft() } };
    expect(withMissions(W).levels['mission-2']).toEqual(W.levels['mission-2']);
    expect(withMissions({ ...W, missions: { 'mission-2': { ...draft(), status: 'approved' } } }).levels['mission-2'].goal.flight.sortie.beacons).toBeTruthy();
    // (the world reader does the same: an approved mission's level, a new level if none had its id)
    const G = readGameworld({ ...W, missions: { 'mission-9': { ...draft(), id: 'mission-9', status: 'approved' } } });
    expect(G.ids).toContain('mission-9');
    expect(G.levels['mission-9'].airspace).toBeTruthy();
  });
  it('says each mission: its state, the laws it fails, where the person sees it and edits it', () => {
    const R = missionsReadout({ missions: { 'mission-2': draft() } }, { ref: 'storm' });
    expect(R[0]).toMatchObject({ mission: 'mission-2', status: 'draft', laws: [], briefing: '/api/sketches/storm/bible?book=briefing&mission=mission-2', editor: '/api/sketches/storm/bible?book=briefing&mission=mission-2&edit=1' });
  });
  it('saves the person\'s edit from the table: read and compiled, approved or a draft again', () => {
    const m0 = { kind: 'gameworld', id: 'w', missions: { 'mission-2': { ...draft(), status: 'approved' } } };
    const moved = draft(); moved.beacons[0].at = [300, 1500, 40];
    const A = applyMissionEdit(m0, { mission: 'mission-2', design: moved });
    expect(A.status).toBe('draft');
    expect(A.manifest.missions['mission-2'].beacons[0].at).toEqual([300, 1500, 40]);
    expect(applyMissionEdit(m0, { mission: 'mission-2', design: moved, approve: true }).status).toBe('approved');
    const bad = draft(); bad.goals.push({ reach: 'nowhere' });
    expect(() => applyMissionEdit(m0, { mission: 'mission-2', design: bad })).toThrow(/no beacon/);
  });
});
