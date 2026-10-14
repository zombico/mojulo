import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { CREWS, crewFaces, sceneFolk } from './crews.js';
import { historicOptions } from './historic-kind.js';
import { SUMER_FARM_ASSETS } from './assets/sumer-farm.js';
import { EGYPT_FARM_ASSETS } from './assets/egypt-farm.js';
import { SUMER_WORKS_ASSETS } from './assets/sumer-works.js';
import { EGYPT_WORKS_ASSETS } from './assets/egypt-works.js';
import { SUMER_ASSETS } from './assets/sumer.js';
import { EGYPT_ASSETS } from './assets/egypt.js';
import { GIZA_ASSETS } from './assets/giza.js';
import { LINDOS_ASSETS } from './assets/lindos.js';
import { POMPEII_ASSETS } from './assets/pompeii.js';
import { QIN_ASSETS } from './assets/qin.js';
import { POMPEII_FARM_ASSETS } from './assets/pompeii-land.js';
import { METRES_PER_UNIT, planHistoricCity, assembleHistoricCityScene } from './historic-city.js';
import { SCENES } from './solver/index.js';
import { HISTORIC_CULTURES } from './cultures/index.js';

const s = 1 / METRES_PER_UNIT;
const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex');

describe('historic crews: the people and beasts at the farm\'s and the works\' work', () => {
  it('names only assets the kits build', () => {
    const ids = new Set([SUMER_FARM_ASSETS, EGYPT_FARM_ASSETS, SUMER_WORKS_ASSETS, EGYPT_WORKS_ASSETS, SUMER_ASSETS, EGYPT_ASSETS, GIZA_ASSETS, LINDOS_ASSETS, POMPEII_ASSETS, QIN_ASSETS, POMPEII_FARM_ASSETS].flatMap((k) => Object.keys(k)));
    for (const id of Object.keys(CREWS)) expect(ids.has(id), id).toBe(true);
  });

  // the land's work is a region's activities (./solver/): a farm with its plough, the crafts by the water
  const farm = { culture: 'sumer', scene: 'slice', focus: 'farmstead' }, works = { culture: 'thebes', scene: 'region' };
  it('hitches a team at the plough\'s yoke, lifts the yoke onto their necks, and puts the ploughman at the stilts', () => {
    const plan = planHistoricCity(farm), F = sceneFolk(plan, true, s, 1, { teams: false });
    const yoke0 = plan.boxes.find((b) => b.kind === 'yoke' && b.asset === 'plough'), i = plan.boxes.indexOf(yoke0), yoke1 = F.boxes[i];
    const M = [(yoke0.a[0] + yoke0.b[0]) / 2, (yoke0.a[1] + yoke0.b[1]) / 2];
    const team = F.herd.filter((b) => b.kind === 'ox' && Math.hypot(b.x - M[0], b.y - M[1]) < 2.5);
    expect(team.length).toBe(2);
    expect(yoke1.z0).toBeGreaterThan(yoke0.z0 + 0.5);   // up at the oxen's necks
    expect(F.stats.drivers).toBeGreaterThan(0);
    expect(plan.boxes[i]).toBe(yoke0);   // the plan's own boxes are not touched
  });

  it('stands each workshop\'s crew, the same each time', () => {
    const plan = planHistoricCity(works);
    const a = crewFaces(plan, true, s, 1), b = crewFaces(plan, true, s, 1);
    expect(a.stats.crew).toBeGreaterThan(5);
    expect(hash(a.faces)).toBe(hash(b.faces));
    expect(crewFaces(plan, { crews: false }, s, 1).stats.crew).toBe(0);
  });

  it('adds nothing without people, and nothing to the CSS page', () => {
    const base = assembleHistoricCityScene({ ...farm, shade: false });
    expect(base.stats.people).toBeUndefined();
    expect(hash(assembleHistoricCityScene({ ...farm, shade: false, people: true }).faces)).toBe(hash(base.faces));   // the page: no `world`
    const world = assembleHistoricCityScene({ ...farm, shade: false, world: true }), on = assembleHistoricCityScene({ ...farm, shade: false, world: true, people: true });
    expect(hash(world.faces)).toBe(hash(base.faces));
    expect(on.faces.length).toBeGreaterThan(base.faces.length);
    expect(on.stats.people.crew + on.stats.people.hands).toBeGreaterThan(0);
  }, 180000);

  it('every town with slots its crews name stands them at their work places, after its own town pass', () => {
    const culture = Object.keys(HISTORIC_CULTURES).find((c) => Object.keys(HISTORIC_CULTURES[c].assets || {}).some((a) => CREWS[a]));
    const plan = planHistoricCity({ culture }), F = sceneFolk(plan, true, s, 1);
    expect((plan.slots || []).filter((sl) => CREWS[sl.asset]).length, culture).toBeGreaterThan(0);
    expect(F.stats.crew, culture).toBeGreaterThan(0);
    expect(sceneFolk(plan, { crews: false, beasts: false }, s, 1).stats.crew, culture).toBe(0);
  }, 120000);

  it('the historic kind takes people in every scene', () => {
    for (const scene of SCENES) expect(historicOptions({ culture: 'sumer', scene, people: true }).opts.people).toBe(true);
  });
});
