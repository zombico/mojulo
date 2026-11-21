// A MISSION ON A GEOCUBE'S SITE, WHOLE (the e2e tier: it resolves the place, a building on its land, twice). One site,
// the default: a warehouse on its yard by night in the rain, a walker parked in its hall. The concepts: the level is the
// geocube's own recipe with the mission's cast on it; the map is read off the place as it stands, one ground with the
// hall in it; the place is drawn by the form render with its floods and its wet; what is parked stands in the hall; the
// tasks are proved on the bus and the gunner plays it on the place's own colliders. Machine gate only.
import { describe, expect, it } from 'vitest';
import { missionSiteLevel } from './mission-site.js';
import { proveMission, playMission } from './mission-proof.js';
import { readGameworld } from './world.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { mapLaws } from '../arena-map/laws.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const G = readGameworld({ id: 'ms', name: 'MS', seed: 1, feel: SHOOTER, start: 'one', levels: { one: { name: 'Site', mission: true } } });

describe('a mission on a geocube\'s site', () => {
  it('is the place as the geocube builds it, the mission laid on it as it stands, proved and played', async () => {
    const L = await missionSiteLevel(G, {}), m = L.manifest;
    expect(m.kind).toBe('geocube');
    expect(m.parked).toHaveLength(L.site.parked.length);
    expect(m.entities.filter((e) => e.team === 'foes').length).toBeGreaterThan(0);
    // (the map: one ground, read off the colliders; its edge open, said)
    const laws = mapLaws(L.map).laws;
    expect(laws.find((l) => l.law === 'connected').holds).toBe(true);
    expect(L.laws.filter((l) => !l.holds).every((l) => l.law.startsWith('map:'))).toBe(true);
    expect(L.mission.frame.floors).toHaveLength(1);
    expect(proveMission(m)).toMatchObject({ proved: true, done: L.mission.sections.map((S) => S.id) });
    const { payload: P } = await resolveWorldScene({ ref: 'ms-site', title: 'Site', manifest: m }, { era: 'gen-7', live: true });
    expect(P.form.room.reflect.floods).toHaveLength(L.site.floods);
    expect(P.form.room.reflect.wet).toMatchObject({ rain: 1 });
    expect(P.weather).toBeTruthy();
    // (what is parked stands inside the hall, the building's tallest room)
    const A = P.anchors.find((a) => a.kind === 'building'), hall = A.rooms.reduce((a, b) => (b.box.max[2] - b.box.min[2] > a.box.max[2] - a.box.min[2] ? b : a)), at = m.parked[0].at;
    expect(at[0] > hall.box.min[0] && at[0] < hall.box.max[0] && at[1] > hall.box.min[1] && at[1] < hall.box.max[1]).toBe(true);
    // (played on the place's own colliders: its result said, never forced; a still player does not win)
    const R = playMission(P, L.mission, { seconds: 240 });
    expect(R.tasks.length).toBeGreaterThan(0);
    expect(playMission(P, L.mission, { player: 'still', seconds: 20 }).won).toBe(false);
  }, 900000);
});
