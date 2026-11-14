import { pageLight, shadowToLight } from '../scene/page-light.js';
import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';

// A GLYPH MAP built whole through the kit's own builder (the map world kind): a crossing, a bend, an end and a building
// on one page, and its laws, measured on the page as built, say it is one walkable level.

describe('a glyph map, built', () => {
  it('is one page whose seams meet, whose paths and doors are clear, its paths one network', async () => {
    const level = { kit: 'isekai-meadow', seed: 4, grid: { tile: 32, rows: ['. # .', '# # h', '. # .', '. # #'], key: { h: { use: 'dwelling' } } } };
    const { payload: P } = await resolveWorldScene({ ref: 'glyph-map', manifest: { kind: 'map', level } });
    expect(P.map.cells.filter((c) => c.kind === 'path').map((c) => c.shape)).toEqual(['end', 'end', 'X', 'I', 'L', 'end']);
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    // (the building stands, its door toward the crossing; the trail's ribbon runs on every path tile)
    expect(P.anchors.some((a) => /h-1-2/.test(JSON.stringify(a)))).toBe(true);
    expect(P.faces.filter((f) => /trail/.test(f.group || '')).length).toBeGreaterThan(100);
  }, 300000);

  it('is one page when planned as segments and written in them: the plan\'s fill and an author\'s segment, stitched', async () => {
    // (three segments of 3 × 3 tiles: the town, the woods written by its author (a crossing, its lookouts on the map's
    // north and east edges, its own sides), the shrine at its temple)
    const plan = { size: 3, rows: ['A B', '. C'], route: ['A', 'B', 'C'], key: { A: { name: 'the town' }, B: { name: 'the woods', rise: 4 }, C: { name: 'the shrine', rise: 8, goal: { use: 'temple' } } } };
    const segments = { B: { rows: ['. # .', '# # #', '. # .'] } };
    const level = { kit: 'isekai-meadow', seed: 4, grid: { tile: 24, plan, segments } };
    const { payload: P } = await resolveWorldScene({ ref: 'planned-map', manifest: { kind: 'map', level } });
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    expect(Object.values(P.map.regions).map((r) => r.name)).toEqual(['the town', 'the woods', 'the shrine']);
    expect(P.anchors.some((a) => /temple|G-4-4/.test(JSON.stringify(a)))).toBe(true);
  }, 300000);

  it('lays its water across the tiles, a beach and a cliff at its edge, and its ways by rank, its laws held', async () => {
    // (a pond under a risen bluff on the east, a town's house on the west: a road by the house, a track on, the shore's
    // beach on the low side and its cliff under the bluff)
    const level = { kit: 'isekai-meadow', seed: 6, grid: { tile: 24, rows: ['h # # #', '. ~ ~ #', '. . # #'], key: { h: { use: 'dwelling' } }, regions: { rows: ['. . . R', '. . . R', '. . . R'], key: { R: { name: 'the bluff', rise: 4 } } } } };
    const { payload: P } = await resolveWorldScene({ ref: 'glyph-water', manifest: { kind: 'map', level } });
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    expect(P.map.water[0].shore.beach).toBeGreaterThan(0);
    expect(P.map.water[0].shore.cliff).toBeGreaterThan(0);
    expect(P.faces.some((f) => f.group === 'isekai:water')).toBe(true);
    expect(P.faces.some((f) => f.group === 'isekai:sand')).toBe(true);
    expect(P.faces.some((f) => f.group === 'isekai:cliff')).toBe(true);
    expect(Object.keys(P.map.ways.count)).toContain('road');
  }, 300000);

  it('read in gen-7 is the form render\'s: its land read, its plants grown as form, a range of mountains round it', async () => {
    // (one small map a geocube paints, read in each era; and one no cube paints, read in gen-7)
    const level = (era) => ({ seed: 5, geocube: { from: 'valley-morning', era }, grid: { tile: 24, rows: ['# # #', '. ~ #'] } });
    const { payload: P7 } = await resolveWorldScene({ ref: 'glyph-gen7', manifest: { kind: 'map', level: level('gen-7') } });
    expect(P7.form?.land?.far).toEqual(['isekai:ridge']);
    expect(P7.form.land.haze).toBeDefined();
    expect(P7.form.flora).toBeDefined();
    expect(P7.map.form).toMatchObject({ read: true, plants: true, far: 'range' });
    // (its far is the range, real ground standing hundreds of metres out; no tile's painted curtains)
    const far = P7.faces.filter((f) => f.group === 'isekai:ridge');
    expect(Math.max(...far.flatMap((f) => f.corners.map((c) => Math.hypot(c[0] - 36, c[1] + 24))))).toBeGreaterThan(500);
    expect(P7.faces.some((f) => f.group === 'isekai:cloud')).toBe(false);
    // (gen-6: the painted read, its first tile's far ring round the map, no form)
    const { payload: P6 } = await resolveWorldScene({ ref: 'glyph-gen6', manifest: { kind: 'map', level: level('gen-6') } });
    expect(P6.form).toBeUndefined();
    expect(P6.map.form).toBeUndefined();
    expect(P6.faces.some((f) => f.group === 'isekai:ridge')).toBe(true);
    // (a map no cube paints, read in gen-7: paint under the live light, and it says why)
    // (THE HERO ON IT: the body a player pilots is read lit and carries the cast rig solved from the land's cube, the
    // land's one sun its key; in gen-6, and a body nobody pilots, as they were)
    const piloted = (era, pilotable = true) => ({ kind: 'map', level: level(era), figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
      entities: [{ id: 'p1', ...(pilotable ? { pilotable: true } : {}), rule: { type: pilotable ? 'walk' : 'static' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [12, -12, 2], heading: 0 } }] });
    const { payload: H7 } = await resolveWorldScene({ ref: 'glyph-hero7', manifest: piloted('gen-7') });
    expect(H7.figures.hero.cast).toMatchObject({ register: 'western', surface: 'form', key: { toLight: H7.form.land.sun } });
    expect(H7.figures.hero.cast.key.linear).toEqual(H7.form.land.light.sun);
    // (one sun a page, scene/page-light.js: the record is the land's sun, and a shadow is cast along it)
    const PLR = pageLight(H7);
    expect([PLR.from, PLR.toLight]).toEqual(['land', H7.form.land.sun]);
    expect(shadowToLight(PLR, H7.shadows)).toEqual(H7.form.land.sun);
    expect((await resolveWorldScene({ ref: 'glyph-hero6', manifest: piloted('gen-6') })).payload.figures.hero.cast).toBeUndefined();
    expect((await resolveWorldScene({ ref: 'glyph-extra7', manifest: piloted('gen-7', false) })).payload.figures.hero.cast).toBeUndefined();
    const { payload: Pk } = await resolveWorldScene({ ref: 'glyph-kit7', manifest: { kind: 'map', level: { seed: 5, kit: 'isekai-meadow', grid: { tile: 24, rows: ['# # #'] } } } }, { era: 'gen-7' });
    expect(Pk.form).toBeUndefined();
    expect(Pk.map.form).toMatchObject({ read: false, why: expect.stringMatching(/geocube/) });
  }, 600000);
});

