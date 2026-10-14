// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { pickPaletteHandler } from './pick-palette.js';
import { themeOf } from './create-game.js';
import { createCoverHandler } from './cover.js';
import { designGameHandler } from './design-game.js';
import { designInteriorHandler } from './interior.js';
import { pixelTheme } from './pixelizer-game.js';
import { MEADOWMARK } from '@/lib/graph/gameworld/examples.js';
import { STYLE_DEFAULTS } from '@/lib/graph/game/hud-widgets.js';

beforeEach(() => { closeDb(); });
// a world that names no kit and no look: the default a palette replaces
const { kit: _kit, ...unkitted } = MEADOWMARK.style;
const UNNAMED = { ...MEADOWMARK, style: unkitted };

describe('pick_palette', () => {
  it('answers the spec to pass on, its roles, HUD, cover and checks; variants come from consecutive seeds', () => {
    const r = pickPaletteHandler({ intent: 'a drowned town at dusk', heat: -0.5, weight: 0.6, seed: 40, variants: 3 });
    expect(r.palettes.map((p) => p.palette.seed)).toEqual([40, 41, 42]);
    expect(r.palettes[0].palette).toEqual({ intent: 'a drowned town at dusk', heat: -0.5, weight: 0.6, seed: 40 });
    expect(Object.keys(r.palettes[0].ui).sort()).toEqual(['accent', 'accent2', 'bg', 'ink', 'line', 'panel']);
    expect(r.palettes[0].checks).toMatch(/of 10 laws hold/);
    expect(r.use).toMatch(/design_game world.style.palette/);
    // the same spec, the same answer
    expect(pickPaletteHandler({ seed: 40, heat: -0.5, weight: 0.6, intent: 'a drowned town at dusk' }).palettes[0].roles).toEqual(r.palettes[0].roles);
    // no seed: one is rolled and returned
    expect(Number.isInteger(pickPaletteHandler({}).palettes[0].palette.seed)).toBe(true);
  });
  it('refuses what is not a spec, and teaches', () => {
    expect(() => pickPaletteHandler({ variants: 9 })).toThrow(/variants is 1 to 6/);
    expect(() => pickPaletteHandler({ weight: 3 })).toThrow(/weight is −1 to 1/);
  });
});

describe('a game\'s HUD', () => {
  it('with no theme and no palette, one is solved for the game (its ref\'s), never the stock navy', () => {
    const a = themeOf(undefined, undefined, 'game-a'), b = themeOf(undefined, undefined, 'game-a');
    expect(a.theme).toEqual(b.theme);
    expect(a.theme.bg).not.toBe(STYLE_DEFAULTS.bg);
    expect(themeOf(undefined, undefined, 'game-b').theme).not.toEqual(a.theme);
  });
  it('a theme alone is kept as it was; a palette sits under the theme\'s own tokens; false keeps the stock HUD', () => {
    expect(themeOf({ accent: '#ff0000' }, undefined, 'g')).toEqual({ theme: { accent: '#ff0000' }, palette: null });
    const t = themeOf({ accent: '#ff0000', font: 'mono' }, { seed: 3 }, 'g');
    expect(t.theme).toMatchObject({ accent: '#ff0000', font: 'mono' });
    expect(t.theme.panel).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.palette.spec).toEqual({ seed: 3 });
    expect(themeOf(undefined, false, 'g')).toEqual({ theme: undefined, palette: null });
  });
});

describe('a cover\'s colours', () => {
  it('its own { bg, accent, ink } as given; else solved, from a spec or rolled; false is the stock cover', () => {
    const own = createCoverHandler({ title: 'Own', ref: 'cv-own', palette: { bg: '#000000', accent: '#ff0000', ink: '#ffffff' } });
    expect(SketchRepository.getByRef(own.ref).manifest.artDirection.palette).toEqual({ bg: '#000000', accent: '#ff0000', ink: '#ffffff' });
    createCoverHandler({ title: 'Solved', ref: 'cv-spec', palette: { seed: 5, heat: 0.8 } });
    createCoverHandler({ title: 'Rolled', ref: 'cv-roll' });
    createCoverHandler({ title: 'Stock', ref: 'cv-stock', palette: false });
    const pal = (r) => SketchRepository.getByRef(r).manifest.artDirection.palette;
    expect(pal('cv-spec').bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(pal('cv-roll')).not.toEqual(pal('cv-spec'));
    expect(pal('cv-stock')).toEqual({ bg: '#1a1420', accent: '#e8c14a', ink: '#f5f0e6' });
  });
});

describe('a gameworld\'s palette, settled where it is written', () => {
  it('a new world naming no kit or look gets one rolled; an edit keeps it; a world naming its kit is as written', async () => {
    await createSketchHandler({ title: 'Unnamed', manifest: { kind: 'gameworld', ...UNNAMED }, ref: 'gw-pal' });
    const seed = SketchRepository.getByRef('gw-pal').manifest.style.palette.seed;
    expect(Number.isInteger(seed)).toBe(true);
    await updateSketchHandler({ ref: 'gw-pal', manifest: { kind: 'gameworld', ...UNNAMED, name: 'Renamed' } });
    expect(SketchRepository.getByRef('gw-pal').manifest.style.palette).toEqual({ seed });
    await createSketchHandler({ title: 'Named', manifest: { kind: 'gameworld', ...MEADOWMARK }, ref: 'gw-kit' });
    expect(SketchRepository.getByRef('gw-kit').manifest.style.palette).toBeUndefined();
  });
  it('design_game: the same recipe re-sent writes nothing (its rolled palette kept)', async () => {
    await designGameHandler({ ref: 'gw-dg', world: UNNAMED });
    const before = SketchRepository.getByRef('gw-dg');
    await designGameHandler({ ref: 'gw-dg', world: UNNAMED });
    const after = SketchRepository.getByRef('gw-dg');
    expect(after.manifest).toEqual(before.manifest);
    expect(after.updated_at ?? after.updatedAt).toEqual(before.updated_at ?? before.updatedAt);
  });
});

describe('a room\'s palette, settled where it is written', () => {
  const section = { room: 'living', size: ['14ft', '18ft'], windows: ['S'], doors: [{ wall: 'W', to: 'hall' }] };
  it('a new room naming no style gets one rolled and says so; a revision keeps it; a style named is the card\'s', async () => {
    const r = await designInteriorHandler({ title: 'Rolled room', ref: 'in-rolled', section });
    const seed = SketchRepository.getByRef('in-rolled').manifest.palette.seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(r.interior.style).toMatch(/in palette pal-/);
    await designInteriorHandler({ ref: 'in-rolled', brief: { focal: 'window' } });
    expect(SketchRepository.getByRef('in-rolled').manifest.palette).toEqual({ seed });
    await designInteriorHandler({ title: 'Japandi room', ref: 'in-card', section, style: 'japandi' });
    expect(SketchRepository.getByRef('in-card').manifest.palette).toBeUndefined();
  });
});

describe('a room stage\'s art palette from a palette', () => {
  it('art.palette { from } is solved where it is written into the ramps the build reads; the other items roll as ever', async () => {
    const { starter } = await import('@/lib/graph/era/entries.js');
    const ROOMS = { ...starter('gothic-stone'), rooms: starter('gothic-stone').rooms.slice(0, 2), links: starter('gothic-stone').links.slice(0, 1) };
    await createSketchHandler({ title: 'Crypt', ref: 'st-pal', manifest: { ...ROOMS, art: { palette: { from: { heat: -0.4, scheme: 'triad' } } } } });
    const A = SketchRepository.getByRef('st-pal').manifest.art;
    expect(A.palette.family).toMatch(/^palette pal-/);
    expect(Number.isInteger(A.palette.from.seed)).toBe(true);
    expect(A.palette.from).toMatchObject({ heat: -0.4, scheme: 'triad' });
    for (const k of ['stone', 'floor', 'vault', 'trim', 'wood', 'accent']) expect(A.palette[k]).toHaveLength(5);
    expect(A.palette.light).toHaveLength(3);
    for (const k of ['materials', 'architecture', 'motifs', 'doodads', 'atmosphere']) expect(A[k]).toBeTruthy();
    // an edit leaves it as stored
    await updateSketchHandler({ ref: 'st-pal', manifest: { ...SketchRepository.getByRef('st-pal').manifest, title: 'Crypt 2' } });
    expect(SketchRepository.getByRef('st-pal').manifest.art.palette).toEqual(A.palette);
  });
});

describe('a stage\'s tone from a palette', () => {
  it('tone { preset?, from } is solved where it is written into the preset\'s own ramps; the tone reads; its own fields win', async () => {
    const { starter } = await import('@/lib/graph/era/entries.js');
    const { readTone, TONE_PRESETS } = await import('@/lib/graph/era/tone.js');
    const ROOMS = { ...starter('gothic-stone'), rooms: starter('gothic-stone').rooms.slice(0, 2), links: starter('gothic-stone').links.slice(0, 1) };
    await createSketchHandler({ title: 'Toned', ref: 'st-tone', manifest: { ...ROOMS, tone: { preset: 'isekai', from: { seed: 12, key: 'low' }, steps: 3 } } });
    const T = SketchRepository.getByRef('st-tone').manifest.tone;
    expect(Object.keys(T.ramps).sort()).toEqual(Object.keys(TONE_PRESETS.isekai.ramps).sort());
    expect(T.palette).toMatch(/^pal-/);
    expect(T.key).toBe(0.34);
    expect(T.steps).toBe(3);
    expect(readTone(T).ramps.stone).toEqual(T.ramps.stone);
    expect(T.ramps.stone).not.toEqual(TONE_PRESETS.isekai.ramps.stone);
    // with no preset named, flat's ramps
    await createSketchHandler({ title: 'Flat', ref: 'st-tone2', manifest: { ...ROOMS, tone: { from: { seed: 12 } } } });
    expect(Object.keys(SketchRepository.getByRef('st-tone2').manifest.tone.ramps).sort()).toEqual(Object.keys(TONE_PRESETS.flat.ramps).sort());
  });
});

describe('pixel palettes', () => {
  it('pick_palette answers palettes at the 8bit and 16bit budgets; a pixelizer game takes its accents from a palette', () => {
    const p = pickPaletteHandler({ seed: 8 }).palettes[0];
    expect(p.pixel['8bit']).toHaveLength(3);
    expect(p.pixel['16bit'].length).toBeLessThanOrEqual(15);
    expect(p.pixel['16bit'].length).toBeGreaterThanOrEqual(12);
    expect(p.pixel['8bit']).toContain(p.roles.accent[2]);
    expect(pixelTheme(undefined, { seed: 8 })).toEqual({ accent: p.ui.accent, accent2: p.ui.accent2, style: 'hud' });
    expect(pixelTheme({ accent: '#ffffff' }, { seed: 8 }).accent).toBe('#ffffff');
    expect(pixelTheme({ accent: '#ffffff' }, undefined)).toEqual({ accent: '#ffffff' });
  });
});
