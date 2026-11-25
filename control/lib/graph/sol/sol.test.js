/**
 * The children of Sol (sol/): one row per body, its handles reaching the drawers that show it whole, in a space level's
 * sky, under foot, and flown over (a giant, which has no ground). One case per procedure: a rocky world with air (Mars), an
 * airless one with a world in its sky (the Moon), a world with no sun seen (Venus), a ringed giant flown (Saturn).
 */
import { describe, expect, it } from 'vitest';

import { SOL_BODIES, SOL_ORDER, SOL_GEOCUBE_IDS, SOL_FLIGHT_IDS, solId, solBody, solHandles } from './roster.js';
import { GIANT_SKIES } from './skies.js';
import { flightSky } from '../skyscape/sky.js';
import { airspaceOf } from '../skyscape/airspace.js';
import { seatCraft } from '../skyscape/craft.js';
import { flightSkyScript } from '../scene/channels/flight-sky.js';
import { SOL_WORLDS } from './worlds.js';
import { SOL_GEOCUBES, SOL_GEOCUBE_PALETTES, SOL_GEOCUBE_BUILDINGS } from './geocubes.js';
import { PLANET_KINDS, generatePlanet, pickKind } from '../skyscape/planet-gen.js';
import { planBackdrop } from '../skyscape/backdrop.js';
import { planSaturnScene, SATURN_PLANETS, SOL_MODELS } from '../views/science/saturn-view.js';
import { GEOCUBE_PRESETS, GEOCUBE_PALETTES, GEOCUBE_BUILDINGS, readGeocube, lowerGeocube } from '../era/geocube.js';
import { readHeavens, heavensCard } from '../era/heavens.js';
import { skyDomeScript } from '../scene/channels/sky-dome.js';
import { spaceBackdropScript } from '../scene/channels/space-backdrop.js';
import { mulberry32 } from '../city/plan/dice.js';
import { lookOf } from '../era/style/looks.js';

const no = (m) => { throw new Error(m); };

describe('the roster', () => {
  it('names every body in order out from the Sun, the Moon beside the Earth, Pluto last', () => {
    expect(SOL_ORDER[0]).toBe('mercury');
    expect(SOL_ORDER.indexOf('moon')).toBe(SOL_ORDER.indexOf('earth') + 1);
    expect(SOL_ORDER.at(-1)).toBe('pluto');
    expect(SOL_MODELS).toEqual(SOL_ORDER);
  });

  it('reaches a body by the words people say, and teaches a word that names none', () => {
    expect(solId('the Red Planet')).toBe('mars');
    expect(solId('Luna')).toBe('moon');
    expect(solId('the moon')).toBe('moon');
    expect(solBody('Saturn').label).toBe('Saturn');
    expect(() => solBody('vulcan')).toThrow(/not a child of Sol/);
  });

  it('gives every body a handle into each drawer: a surface where it has ground, a flight where it has none', () => {
    for (const id of SOL_ORDER) {
      const B = SOL_BODIES[id];
      expect(SOL_MODELS, id).toContain(B.model);
      expect(SOL_WORLDS[B.world], id).toBeTruthy();
      if (B.geocube) expect(SOL_GEOCUBES[B.geocube], id).toBeTruthy();
      if (B.flight) expect(GIANT_SKIES[B.flight], id).toBeTruthy();
      expect(!!(B.geocube && B.flight), id).toBe(false);
    }
    expect(SOL_BODIES.earth.geocube).toBeNull();
    expect(SOL_FLIGHT_IDS).toEqual(['jupiter', 'saturn', 'uranus', 'neptune']);
    expect(SOL_GEOCUBE_IDS).not.toContain('earth');
    expect(Object.keys(SOL_GEOCUBES).sort()).toEqual([...SOL_GEOCUBE_IDS].sort());
  });

  it('hands a game what it needs: a view of the model, the world for a sky, the surface', () => {
    const S = solHandles('saturn', { view: 'rings' }), M = solHandles('the red planet', { view: 'rings' });
    expect(S.model).toEqual({ kind: 'saturn-view', planet: 'saturn', scenario: 'rings' });
    expect(M.model.scenario).toBe('close');   // (no rings: the close pass)
    expect(M.backdrop).toEqual({ worlds: ['mars'] });
    expect(M.geocube).toBe('mars');
    expect(M.flight).toBeNull();
    expect(S.geocube).toBeNull();
    expect(S.flight).toMatchObject({ kind: 'airspace', sky: { world: 'saturn' }, fly: true });
    expect(() => solHandles('mars', { view: 'aerial' })).toThrow(/view is/);
  });
});

describe('the body whole (saturn-view)', () => {
  it('draws the Moon and Pluto; the eight\'s gallery stays eight, the Sol gallery steps through every body', () => {
    expect(planSaturnScene({ planet: 'pluto' }).stats.planet).toBe('pluto');
    expect(planSaturnScene({ gallery: true }).raymarch.steps).toHaveLength(SATURN_PLANETS.length);
    expect(planSaturnScene({ gallery: 'sol' }).raymarch.steps.map((s) => s.label.toLowerCase())).toEqual(SOL_MODELS);
  });

  it('comes close only when asked: the finer weather and the near camera on the close passes, none on the globe', () => {
    const globe = planSaturnScene({ planet: 'jupiter' }).raymarch, close = planSaturnScene({ planet: 'jupiter', scenario: 'close' }).raymarch;
    expect(globe.customUniforms.uDetail).toBeUndefined();
    expect(globe.minDistance).toBeUndefined();
    expect(close.customUniforms.uDetail).toBe(1);
    expect(Math.hypot(...close.cameraStart)).toBeLessThan(2);
    // a pass through the rings is a ringed world's; a ringless one gets the close pass
    expect(planSaturnScene({ planet: 'saturn', scenario: 'rings' }).stats.scenario).toBe('rings');
    expect(planSaturnScene({ planet: 'mars', scenario: 'rings' }).stats.scenario).toBe('close');
  });
});

describe('the body in a space level\'s sky (planet-gen)', () => {
  it('is the real body: its knobs and colours fixed whatever the dice, its tilt and rings its own', () => {
    const a = generatePlanet('saturn', mulberry32(1)), b = generatePlanet('saturn', mulberry32(99));
    const { seed: _a, ...A } = a, { seed: _b, ...B } = b;
    expect(A).toEqual(B);
    expect(a).toMatchObject({ sol: true, gas: 1, tilt: SOL_WORLDS.saturn.tilt, band0: SOL_WORLDS.saturn.colors.band0 });
    expect(a.rings).toMatchObject({ inner: 1.24, outer: 2.27 });
  });

  it('is never drawn by the dice', () => {
    const rnd = mulberry32(4);
    for (let i = 0; i < 400; i++) expect(PLANET_KINDS[pickKind(rnd, i % 2 ? 'large' : 'any')].sol).toBeUndefined();
  });

  it('far off, lies at its own tilt (Uranus on its side)', () => {
    const P = planBackdrop({ star: [1, 0, 0.3], seed: 2, worlds: ['uranus'], planets: 1 }).planets[0];
    expect(P.kind).toBe('uranus');
    expect(P.axis[0]).toBeCloseTo(SOL_WORLDS.uranus.tilt % 180, 2);
  });

  it('held near, a ringed world draws its rings live; a page with none carries none of their code', () => {
    const live = planBackdrop({ star: [1, 0, 0.3], seed: 2, worlds: ['saturn'], proximity: 'near', planets: 1 });
    expect(live.planets[0].live).toBe(true);
    expect(spaceBackdropScript(live)).toContain('RINGL');
    expect(spaceBackdropScript(planBackdrop({ star: [1, 0, 0.3], seed: 2, worlds: ['mars'], proximity: 'near', planets: 1 }))).not.toContain('RINGL');
  });
});

describe('the body under foot (geocubes)', () => {
  it('is a geocube preset with its palette and its colony\'s buildings', () => {
    for (const id of SOL_GEOCUBE_IDS) {
      expect(GEOCUBE_PRESETS[id], id).toBe(SOL_GEOCUBES[id]);
      expect(GEOCUBE_PALETTES[id], id).toBe(SOL_GEOCUBE_PALETTES[id]);
      expect(GEOCUBE_BUILDINGS[id], id).toBe(SOL_GEOCUBE_BUILDINGS[id]);
    }
  });

  it('an airless world: the stars by day, its sun at its width, the body nearest in its sky with its face', () => {
    const L = findCard(lowerGeocube(readGeocube('moon'), 'outside'));
    expect(L.void.stars).toBe(1);
    expect(L.void.companion.color).toEqual([0x3a, 0x6a, 0xb8]);
    expect(L.void.companion.spots).toHaveLength(2);
  });

  it('a world with air drops the void and keeps its companion; a lid of cloud shows no sun', () => {
    const mars = findCard(lowerGeocube(readGeocube('mars'), 'outside')), venus = findCard(lowerGeocube(readGeocube('venus'), 'outside'));
    expect(mars.void).toBeUndefined();
    expect(mars.companion).toBeTruthy();
    expect(venus.sun).toBeNull();
  });
});

describe('a giant flown over its cloud tops (sol/skies.js)', () => {
  it('is its own weather: a deck closing the sky under the pilot, its colours over the deck and under it', () => {
    const S = flightSky({ world: 'jupiter' }, { map: null });
    expect(S.world).toBe('jupiter');
    expect(S.layers[0]).toMatchObject({ type: 'deck', cover: 1 });
    expect(S.aloft.zenith).toEqual(S.colours.zenith);
    expect(() => flightSky({ world: 'pluto' }, { map: null })).toThrow(/a giant flown/);
    expect(() => flightSky({ world: 'saturn', kind: 'fair' }, { map: null })).toThrow(/world or kind/);
  });

  it('seats its craft aloft over the deck, with nothing to take off from', () => {
    const M = { kind: 'airspace', map: { form: 'plain', craft: 'jet', field: 6000 }, sky: { world: 'neptune' } };
    const { map, field } = airspaceOf(M), seat = seatCraft(map, field, null, {});
    const deck = GIANT_SKIES.neptune.layers[0];
    expect(seat.transform.pos[2]).toBeGreaterThan(field.groundAt(seat.transform.pos[0], seat.transform.pos[1]) + deck.base + deck.depth);
    expect(seat.rule.launchSpeed).toBeGreaterThan(0);
  });

  it('a ringed giant\'s rings arch over its sky; a sky with none carries none of their code', () => {
    const cfg = (world) => ({ ...flightSky({ world }, { map: null }) });
    expect(cfg('saturn').rings).toMatchObject({ inner: 1.24, outer: 2.27, profile: 'saturn' });
    const base = { sun: [0.4, 0.3, 0.8], sunCol: '#ffffff', zenith: [50, 70, 120], horizon: [200, 190, 160], cloudLit: '#ffffff', cloudShade: '#888888', aloft: { zenith: [1, 1, 1], horizon: [1, 1, 1], sun: '#ffffff', cloudLit: '#ffffff' }, clear: 1, wind: [1, 0], windSpeed: 5, layers: [], clouds: { n: 0, data: '' }, domain: 8000 };
    expect(flightSkyScript(base)).not.toContain('uThin');
    expect(flightSkyScript({ ...base, rings: cfg('saturn').rings })).toContain('uThin');
  });
});

describe('the heavens (era/heavens.js)', () => {
  it('teaches what it does not take', () => {
    expect(() => readHeavens({ moons: 2 }, no)).toThrow(/not one of its words/);
    expect(() => readHeavens({ disc: { size: 9 } }, no)).toThrow(/disc.size/);
    expect(() => readHeavens({ companion: { azimuth: 10, elevation: 95 } }, no)).toThrow(/elevation/);
    expect(readHeavens(undefined, no)).toBeUndefined();
  });

  it('leaves a card it says nothing of as it was', () => {
    const card = { id: 'x', sun: { size: 1, glow: 1 } };
    expect(heavensCard(card, undefined)).toBe(card);
  });

  it('draws a companion\'s face only when asked: a sky without spots carries none of their code', () => {
    const sky = { radius: 100, center: [0, 0, 0], zenith: [10, 10, 20], horizon: [40, 40, 50], day: 0, stars: 1, seed: 1, sun: { dir: [0.5, 0.2, 0.8], size: 1 } };
    expect(skyDomeScript({ ...sky, moon: { u: 0.5, h: 0.4, phase: 0.6, size: 5, color: [58, 106, 184] } })).not.toContain('companion spots');
    expect(skyDomeScript({ ...sky, moon: { u: 0.5, h: 0.4, phase: 0.6, size: 5, color: [58, 106, 184], spots: [[240, 240, 240]] } })).toContain('companion spots');
  });
});

// the outside's look card: the look the lowering registers under its kit (era/style/looks.js)
const findCard = (low) => lookOf(low.kit).card;
