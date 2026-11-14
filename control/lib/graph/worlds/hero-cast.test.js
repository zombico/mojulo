// THE CAST RIG ON THE PILOTED HERO, ON EVERY PAGE (world-scene.js castFig, heroCastSource): the body a player pilots is
// read lit and carries the rig on any World page that draws it, not only on a form land. Its cube: the land's own though
// drawn as paint, else the hero's own, else the rig's card; its surface 'paint' and `sun: false` off a form land, so the
// page's kit makes its key. A figure nobody pilots, and the exports and unshaded reads, carry none of it.
// (a form land's hero, the rig solved from the land's own cube and sun: level/grid-scene.e2e.test.js)
import { describe, it, expect } from 'vitest';
import { resolveWorldScene, heroCastSource } from './world-scene.js';
import { castRig } from '../color-theorist/cast-rig.js';
import { castRigInput } from '../scene/channels/cast-rig.js';
import { readGeocube } from '../era/geocube.js';
import { readHour } from '../era/geocube-hours.js';

const HERO = { cast: 'male', head: 'none', register: 'lowpoly' };
const floor = { corners: [[-6, -6, 0], [6, -6, 0], [6, 6, 0], [-6, 6, 0]], fill: '#a0b0c0', group: 'floor' };
// (a small room with no land and no cube: one floor, one hero; `pilotable` false is a figure nobody plays)
const room = (hero = HERO, { pilotable = true } = {}) => ({ ref: 'sk_hero_cast', title: 'room', manifest: { kind: 'controllable', title: 'room', faces: [floor],
  figures: { hero: { hero } },
  entities: [{ id: 'p1', ...(pilotable ? { pilotable: true } : {}), rule: { type: pilotable ? 'walk' : 'static' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0.5] } }] } });
const rigOf = (cube, hour) => castRigInput(castRig(cube, { ...(hour !== undefined ? { hour } : {}), register: 'western' }));

describe('the cube a piloted hero\'s rig is solved from, off a form land', () => {
  it('the land\'s own cube drawn as paint, at its hour: a geocube\'s, a map\'s level.geocube', async () => {
    const cube = { from: 'island-noon', era: 'gen-6' };
    expect(await heroCastSource({ kind: 'geocube', cube, hour: 'dusk' }, { hero: HERO })).toEqual({ cube: readGeocube(cube), hour: readHour('dusk') });
    expect(await heroCastSource({ kind: 'map', level: { geocube: cube } }, { hero: { ...HERO, geocube: 'valley-morning' } })).toEqual({ cube: readGeocube(cube) });
  });

  it('else the hero\'s own geocube, else the card; a cube that does not read falls to the next', async () => {
    expect(await heroCastSource({ kind: 'controllable' }, { hero: { ...HERO, geocube: 'valley-morning' } })).toEqual({ cube: readGeocube('valley-morning') });
    expect(await heroCastSource({ kind: 'map', level: { grid: {} } }, { hero: HERO })).toEqual({ cube: null });
    expect(await heroCastSource({ kind: 'map', level: { geocube: 'no-such-cube' } }, { hero: HERO })).toEqual({ cube: null });
  });
});

describe('the piloted hero on a page with no form land', () => {
  it('is read lit and carries the rig: the card where nothing names a cube, the hero\'s own where it does; the same twice', async () => {
    const a = (await resolveWorldScene(room())).payload, b = (await resolveWorldScene(room())).payload;
    expect(a.figures.hero.cast).toEqual({ ...rigOf(null), surface: 'paint', sun: false });
    expect(JSON.stringify(a.figures.hero)).toBe(JSON.stringify(b.figures.hero));
    const own = (await resolveWorldScene(room({ ...HERO, geocube: 'valley-morning' }))).payload;
    expect(own.figures.hero.cast).toEqual({ ...rigOf(readGeocube('valley-morning')), surface: 'paint', sun: false });
  }, 120000);

  it('a figure nobody pilots, an export (paint) and an unshaded read: no rig, the baked body as it was', async () => {
    const plain = (await resolveWorldScene(room(HERO, { pilotable: false }))).payload.figures.hero;
    expect(plain.cast).toBeUndefined();
    for (const opts of [{ paint: true }, { unshaded: true }]) {
      const f = (await resolveWorldScene(room(), opts)).payload.figures.hero;
      expect(f.cast).toBeUndefined();
    }
    // (the lit read is the rig's alone: a body nobody pilots keeps its baked colours)
    const lit = (await resolveWorldScene(room())).payload.figures.hero;
    expect(JSON.stringify(lit.parts)).not.toBe(JSON.stringify(plain.parts));
  }, 120000);
});
