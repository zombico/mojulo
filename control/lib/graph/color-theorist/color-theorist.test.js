import { describe, it, expect } from 'vitest';
import { oklch, lchOf, hexToRgb, rgbToHex, rgbToOklab, oklabToRgb, contrast, deltaE, simulate, CVD_KINDS } from './oklab.js';
import { readPaletteSpec, solvePalette, rampOf, scriptShift, PALETTE_SCHEME_IDS, PALETTE_ROLES, PALETTE_LAWS, PALETTE_SCRIPTS, PALETTE_PRESETS } from './solve.js';
import { assembleStageScene } from '../era/stage.js';
import { novelSeed, nearestRecent, palettesIn, signatureOf, paletteDistance } from './ledger.js';
import { thumbnail, contactSheet, sheetStats } from './contact.js';
import { gameTheme, coverPalette, landSwatches, interiorPalette, lightOf } from './adapters.js';
import { paletteLook } from './look.js';
import { stampWorldPalette, stampInteriorPalette, stampLookPalette } from './stamp.js';
import { resolveLookSpec } from '../era/look.js';
import { terrainField } from '../terrain/terrain-field.js';
import { atlasField, ATLAS_CLIMATES } from '../terrain/terrain-atlas.js';
import { stampTerrainPalette, resolveStagePalette } from './stamp.js';
import { recolourFaces, recolourCard, roleOf } from './recolour.js';
import { natureColours } from './adapters.js';
import { assembleNatureScene } from '../era/nature.js';
import { SIXTH_GEN_LOOK_IDS } from '../era/sixth-gen.js';
import { compileInterior, interiorErrors } from '../interior/compile.js';
import { STYLE_CARDS } from '../interior/styles.js';
import { SWATCHES } from '../era/style/swatches.js';
import { lookOf } from '../era/style/looks.js';
import { STYLE_TOKENS } from '../game/hud-widgets.js';
import { readGameworld } from '../gameworld/world.js';
import { gameStages } from '../gameworld/levels.js';
import { MEADOWMARK } from '../gameworld/examples.js';

const L = (hex) => lchOf(hexToRgb(hex))[0];
const mid = (r) => r[Math.floor(r.length / 2)];
// a kit whose accent ramp is a made one (paint) and one whose accent is a land one (a glow): the two ways a kit names it
const kitsByAccent = () => {
  const ids = Object.keys(SWATCHES).filter((k) => SWATCHES[k].land?.grass);
  return [ids.find((k) => SWATCHES[k].made?.[SWATCHES[k].accent[0]]), ids.find((k) => SWATCHES[k].land[SWATCHES[k].accent[0]])];
};

describe('the colour space', () => {
  it('OKLab round-trips sRGB, and a colour asked for out of gamut is brought in by chroma at its lightness', () => {
    for (const hex of ['#8a5a38', '#5fb0ff', '#0b1220', '#f5f0e6']) expect(rgbToHex(oklabToRgb(rgbToOklab(hexToRgb(hex))))).toBe(hex);
    const c = oklch(0.7, 0.4, 145);   // far outside sRGB
    expect(c.every((v) => v >= 0 && v <= 255)).toBe(true);
    expect(Math.abs(lchOf(c)[0] - 0.7)).toBeLessThan(0.02);
  });
  it('contrast is WCAG 2 (black on white 21:1); a colour-blind simulation pulls red toward green', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(deltaE(simulate([200, 40, 40], 'deutan'), simulate([60, 140, 40], 'deutan'))).toBeLessThan(deltaE([200, 40, 40], [60, 140, 40]));
    expect(CVD_KINDS).toEqual(['protan', 'deutan', 'tritan']);
  });
});

describe('a palette spec', () => {
  it('is checked where it is written, and teaches', () => {
    expect(readPaletteSpec(false)).toBe(false);
    expect(readPaletteSpec('auto')).toBe('auto');
    expect(() => readPaletteSpec({ heat: 2 })).toThrow(/heat is −1 to 1 \(cool to warm\)/);
    expect(() => readPaletteSpec({ scheme: 'rainbow' })).toThrow(/scheme is one of analogous/);
    expect(() => readPaletteSpec({ hue: 'chartreuse-ish' })).toThrow(/colour word \(rust/);
    expect(() => readPaletteSpec({ lock: { far: '#112233' } })).toThrow(/lock.far is not a role/);
    expect(() => readPaletteSpec({ mood: 'sad' })).toThrow(/mood is not part of a palette spec/);
    // a contract handed back is read as its spec
    const K = solvePalette({ seed: 3 });
    expect(readPaletteSpec(K)).toEqual({ seed: 3 });
  });
});

describe('the solve', () => {
  it('is deterministic: the same spec solves the same contract', () => {
    const a = JSON.stringify(solvePalette({ seed: 11, heat: 0.4 }));
    expect(JSON.stringify(solvePalette({ heat: 0.4, seed: 11 }))).not.toBe('');
    expect(JSON.stringify(solvePalette({ seed: 11, heat: 0.4 }))).toBe(a);
  });

  it('every scheme solves to every role, checked by every law, the value laws holding', () => {
    for (const scheme of PALETTE_SCHEME_IDS) {
      const K = solvePalette({ seed: 5, scheme });
      expect(K.read.scheme).toBe(scheme);
      expect(Object.keys(K.roles).sort()).toEqual([...PALETTE_ROLES].sort());
      expect(K.checks.map((c) => c.law)).toEqual(PALETTE_LAWS.filter((l) => !l.air || l.air.includes('full')).map((l) => l.law));
      for (const law of ['ramps-climb', 'shade-is-colour', 'sky-brightest', 'ui-contrast']) expect(K.checks.find((c) => c.law === law), `${scheme} ${law}`).toMatchObject({ ok: true });
    }
  });

  it('the key moves the values: a low key sits darker than a high one', () => {
    const lo = solvePalette({ seed: 8, key: 'low' }), hi = solvePalette({ seed: 8, key: 'high' });
    expect(L(mid(lo.roles.ground))).toBeLessThan(L(mid(hi.roles.ground)) - 0.1);
    // a high key turns the HUD over: dark ink on light panels
    expect(L(hi.ui.panel)).toBeGreaterThan(L(hi.ui.ink));
    expect(L(lo.ui.panel)).toBeLessThan(L(lo.ui.ink));
  });

  it('activity is the chroma ceiling; mono-accent spends it only on the accent', () => {
    const C = (hex) => lchOf(hexToRgb(hex))[1];
    expect(C(mid(solvePalette({ seed: 9, activity: -1, scheme: 'triad' }).roles.ground))).toBeLessThan(C(mid(solvePalette({ seed: 9, activity: 1, scheme: 'triad' }).roles.ground)));
    const M = solvePalette({ seed: 9, scheme: 'mono-accent', activity: 1 });
    expect(C(mid(M.roles.accent))).toBeGreaterThan(C(mid(M.roles.ground)) * 2);
  });

  it('a hue named holds; a locked role keeps its colour exactly at its middle', () => {
    const K = solvePalette({ seed: 4, hues: { sky: 'violet' }, lock: { ground: '#8a5a38' } });
    expect(mid(K.roles.ground)).toBe('#8a5a38');
    expect(Math.abs(((lchOf(hexToRgb(mid(K.roles.sky)))[2] - lchOf([118, 92, 168])[2] + 540) % 360) - 180)).toBeLessThan(25);
  });

  it('rampOf solves a role again at any length, the ends the same band', () => {
    const K = solvePalette({ seed: 2 }), r3 = rampOf(K, 'ground', 3), r7 = rampOf(K, 'ground', 7);
    expect(r3).toHaveLength(3); expect(r7).toHaveLength(7);
    expect(rgbToHex(r3[0])).toBe(rgbToHex(r7[0]));
    expect(() => rampOf(K, 'lava', 5)).toThrow(/not a role/);
  });
});

describe('the adapters', () => {
  it('a game theme is the HUD tokens; a cover is { bg, accent, ink } that read', () => {
    const K = solvePalette({ seed: 6 }), T = gameTheme(K), C = coverPalette(K);
    expect(Object.keys(T).sort()).toEqual(STYLE_TOKENS.filter((k) => k !== 'font').sort());
    expect(Object.keys(C).sort()).toEqual(['accent', 'bg', 'ink']);
    expect(contrast(hexToRgb(C.ink), hexToRgb(C.bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('a kit recoloured keeps every ramp at its length, its accent ramp the accent\'s', () => {
    const K = solvePalette({ seed: 12 });
    for (const kit of kitsByAccent()) {
      const sw = SWATCHES[kit], out = landSwatches(K, sw);
      for (const part of ['land', 'made']) for (const [k, r] of Object.entries(sw[part])) expect(Array.isArray(r) ? out[part][k].length : out[part][k], `${kit} ${part}.${k}`).toEqual(Array.isArray(r) ? r.length : r);
      const [ramp, stop] = sw.accent, acc = out.made[ramp] ?? out.land[ramp];
      expect(rgbToHex(acc[Math.min(stop, acc.length - 1)])).not.toBe(rgbToHex((sw.made[ramp] ?? sw.land[ramp])[stop]));
      expect(out.accent).toEqual(sw.accent);
    }
  });
});

describe('a palette on a kit', () => {
  it('registers a look the land laws hold for, under one id per spec and base', () => {
    const [kit] = kitsByAccent();
    const a = paletteLook({ seed: 21 }, { base: kit, name: 'test' }), b = paletteLook({ seed: 21 }, { base: kit, name: 'test' });
    expect(a.id).toBe(b.id);
    expect(lookOf(a.id).base).toBe(kit);
    expect(a.laws.filter((l) => !l.ok)).toEqual([]);
    expect(paletteLook({ seed: 22 }, { base: kit, name: 'test' }).id).not.toBe(a.id);
  });
  it('refuses a kit with no land ramps to start from', () => {
    const plain = Object.keys(SWATCHES).find((k) => !SWATCHES[k].land?.grass);
    expect(() => paletteLook({ seed: 1 }, { base: plain })).toThrow(/a palette recolours a kit with land ramps/);
  });
});

describe('a gameworld\'s palette', () => {
  it('recolours the world\'s kit, and every stage is drawn in it; absent, the world reads as it did', () => {
    const plain = readGameworld(MEADOWMARK);
    expect(plain.style.kit).toBe('isekai-meadow');
    expect(plain.style.colours).toBeUndefined();
    const W = { ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 42 } } }, G = readGameworld(W);
    expect(G.style.kit).not.toBe('isekai-meadow');
    expect(G.style.colours).toMatchObject({ base: 'isekai-meadow', look: G.style.kit });
    // the stages drawn in the world's kit are drawn in its recolouring (a level naming its own kit keeps it)
    const kits = gameStages(W).filter((s) => s.manifest?.kind === 'stage').map((s) => s.manifest.kit);
    expect(kits).toContain(G.style.kit);
    expect(kits).not.toContain('isekai-meadow');
    expect(readGameworld({ ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: false } }).style.kit).toBe('isekai-meadow');
    expect(() => readGameworld({ ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 0 } } })).toThrow(/gameworld: style.palette.seed is a whole number/);
  });
});

describe('the stamp', () => {
  const fresh = () => 777, world = { kind: 'gameworld', id: 'w', levels: {} };
  it('rolls a seed for a new world that names no kit or look, and for \'auto\' or a spec with none', () => {
    expect(stampWorldPalette(world, null, fresh).style.palette).toEqual({ seed: 777 });
    expect(stampWorldPalette({ ...world, style: { palette: 'auto' } }, null, fresh).style.palette).toEqual({ seed: 777 });
    expect(stampWorldPalette({ ...world, style: { palette: { heat: 1 } } }, null, fresh).style.palette).toEqual({ heat: 1, seed: 777 });
  });
  it('leaves what is named: a kit, a look, a geocube, a quick game, false, a seeded spec', () => {
    for (const style of [{ kit: 'isekai-meadow' }, { look: 'rust plains' }, { geocube: 'x' }, { palette: false }, { palette: { seed: 3 } }]) {
      const m = { ...world, style };
      expect(stampWorldPalette(m, null, fresh)).toBe(m);
    }
    const q = { ...world, quick: { goal: 'reach' } };
    expect(stampWorldPalette(q, null, fresh)).toBe(q);
  });
  it('an edit keeps the palette the world had, and never gives an old world one', () => {
    expect(stampWorldPalette(world, { style: { palette: { seed: 5 } } }, fresh).style.palette).toEqual({ seed: 5 });
    expect(stampWorldPalette(world, { id: 'w' }, fresh)).toBe(world);
  });
});

describe('a room in a palette', () => {
  const HOUSE = {
    kind: 'floorplan', title: 'three rooms', windows: true, furnish: true,
    rooms: [{ x: 0, y: 0, w: 18, h: 14, glyph: 'L' }, { x: 18, y: 0, w: 5, h: 14, glyph: 'H' }, { x: 23, y: 0, w: 12, h: 14, glyph: 'B' }],
    doors: [{ x: 18, y: 10, edge: 'W' }, { x: 23, y: 4, edge: 'E' }, { x: 20, y: 14, edge: 'S', entry: true }],
  };
  // a card whose casework is a material (a wood) and one whose casework is a paint colour
  const woodCard = Object.keys(STYLE_CARDS).find((k) => /oak|walnut|teak/.test(STYLE_CARDS[k].palette.casework));
  const paintCard = Object.keys(STYLE_CARDS).find((k) => STYLE_CARDS[k].palette.casework === 'white');

  it('the 60-30-10 from the palette: quiet light walls (dark in a low key), a material casework kept', () => {
    const hi = interiorPalette(solvePalette({ seed: 3, key: 'high' }), STYLE_CARDS[woodCard].palette), lo = interiorPalette(solvePalette({ seed: 3, key: 'low' }), STYLE_CARDS[paintCard].palette);
    expect(Object.keys(hi).sort()).toEqual(['accent', 'casework', 'rug', 'trim', 'upholstery', 'walls']);
    expect(L(hi.walls)).toBeGreaterThan(0.85);
    expect(L(lo.walls)).toBeLessThan(0.45);
    expect(hi.casework).toBe(STYLE_CARDS[woodCard].palette.casework);
    expect(lo.casework).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a room keeps its card\'s forms and wears the palette; the operator\'s words win; absent, it is as it was', () => {
    const room = { kind: 'interior', house: HOUSE, room: 'lounge', style: woodCard };
    const plain = compileInterior(room, HOUSE).readout.style, K = solvePalette({ seed: 9 });
    const worn = compileInterior({ ...room, palette: { seed: 9 } }, HOUSE).readout.style;
    expect(worn.id).toBe(plain.id);
    expect(worn.solved).toMatchObject({ id: K.id });
    expect(worn.palette.walls).toBe(interiorPalette(K, STYLE_CARDS[woodCard].palette).walls);
    expect(worn.palette.walls).not.toBe(plain.palette.walls);
    expect(compileInterior({ ...room, style: { name: woodCard, palette: { walls: 'sage' } }, palette: { seed: 9 } }, HOUSE).readout.style.palette.walls).toBe('sage');
    expect(plain.solved).toBeUndefined();
    expect(interiorErrors({ ...room, palette: { heat: 5 } }).join(' ')).toMatch(/palette.heat is −1 to 1/);
  });

  it('stamped: a new room naming no style gets one rolled; a style named, or an edit of an old room, is left', () => {
    const fresh = () => 99, room = { kind: 'interior', house: 'h', room: 'L' };
    expect(stampInteriorPalette(room, null, fresh).palette).toEqual({ seed: 99 });
    expect(stampInteriorPalette({ ...room, style: 'japandi' }, null, fresh)).toEqual({ ...room, style: 'japandi' });
    expect(stampInteriorPalette(room, { kind: 'interior' }, fresh)).toBe(room);
    expect(stampInteriorPalette(room, { palette: { seed: 4 } }, fresh).palette).toEqual({ seed: 4 });
    expect(stampInteriorPalette({ kind: 'stage' }, null, fresh)).toEqual({ kind: 'stage' });
  });
});

describe('a palette world\'s buildings', () => {
  const withInn = (W) => ({ ...W, levels: { ...W.levels, 'the-inn': { name: 'The inn', building: { use: 'tavern', seed: 2 } } } });
  const inn = (W) => gameStages(W).find((s) => s.section === 'building').manifest;
  it('a room kit that takes art direction gets one rolled from the palette and the stage, in the world\'s palette, the same every read', () => {
    const W = withInn({ ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 42 } } }), a = inn(W), b = inn(JSON.parse(JSON.stringify(W)));
    expect(a.art.palette.from).toEqual({ seed: 42 });
    expect(a.art.palette.family).toBe(`palette ${solvePalette({ seed: 42 }).id}`);
    expect(Object.values(a.art.status).every((s) => s === 'auto')).toBe(true);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
  it('a world with no palette lays its buildings as it did', () => {
    expect(inn(withInn(MEADOWMARK)).art).toBeUndefined();
  });
});

describe('a sixth-gen look in a palette', () => {
  it('the card\'s palette, light and air recoloured; its placements and contrast kept; absent, the card as written', () => {
    const id = SIXTH_GEN_LOOK_IDS[0], plain = resolveLookSpec(id).ref, K = solvePalette({ seed: 14 });
    const worn = resolveLookSpec({ id, palette: { seed: 14 } }).ref;
    expect(worn.palette).toEqual({ base: K.roles.ground[2], accent: K.roles.accent[2], warm: K.light });
    expect(worn.air.fog.color).toBe(K.fog);
    expect(worn.air.fog.density).toBe(plain.air.fog.density);
    expect(worn.light.placed).toEqual(plain.light.placed);
    expect(worn.light.ambient).not.toBe(plain.light.ambient);
    expect(resolveLookSpec(id).ref).toBe(plain);
    expect(() => resolveLookSpec({ id, palette: { scheme: 'plaid' } })).toThrow(/look.palette.scheme is one of/);
  });
  it('stamped: a look palette with no seed gets one where it is written', () => {
    expect(stampLookPalette({ kind: 'x', look: { id: 'gothic-night', palette: 'auto' } }, () => 6).look.palette).toEqual({ seed: 6 });
    const m = { kind: 'x', look: { id: 'gothic-night', palette: { seed: 2 } } };
    expect(stampLookPalette(m, () => 6)).toBe(m);
  });
});

describe('the ground in a palette', () => {
  const FROM = { heartbeat: 'rocky-irregular', splatch: 'verdure-trio', seed: 'field',
    landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 3, side: 'right' }, { op: 'strata', thickness: 0.6 }, { op: 'talus', retreat: 0.3 }] };
  it('a painted terrain\'s soil, stone, scree and every bed are the palette\'s; its height is not touched; absent, as it was', () => {
    const plain = terrainField({ from: FROM, detail: false }), worn = terrainField({ from: FROM, detail: false, palette: { seed: 3 } });
    expect(worn.K.ramps.beds).toHaveLength(plain.K.ramps.beds.length);
    expect(worn.K.ramps.soil.stops).not.toEqual(plain.K.ramps.soil.stops);
    expect(worn.heightAt(3, 4)).toBe(plain.heightAt(3, 4));
    const n = worn.normalAt(3, 4, 0.5), z = worn.heightAt(3, 4);
    expect(worn.colorAt(3, 4, z, n)).not.toEqual(plain.colorAt(3, 4, z, n));
    expect(JSON.stringify(terrainField({ from: FROM, detail: false }).K.ramps)).toBe(JSON.stringify(plain.K.ramps));
    expect(() => terrainField({ from: FROM, palette: { heat: 9 } })).toThrow(/palette.heat is −1 to 1/);
  });
  it('a composed world keeps its climate\'s snowline and treeline; its ground and sky are the palette\'s', () => {
    const W = { features: [{ feature: 'lake', size: 'tarn' }], seed: 'ground' };
    const plain = atlasField({ world: W }), worn = atlasField({ world: W, palette: { seed: 3, key: 'high' } });
    expect(worn.K.zones).toEqual(plain.K.zones);
    expect(Object.keys(worn.K.ramps).sort()).toEqual(Object.keys(ATLAS_CLIMATES.temperate.ramps).sort());
    expect(worn.K.ramps.low.stops).not.toEqual(plain.K.ramps.low.stops);
    expect(worn.meta.sky.zenith).not.toEqual(plain.meta.sky.zenith);
    expect(worn.meta.sky.day).toBe(plain.meta.sky.day);
    expect(plain.K.ramps).toBe(ATLAS_CLIMATES.temperate.ramps);
  });
  it('an isekai ground\'s bake starts from the palette\'s own ramps, not the card\'s tints', () => {
    const [kit] = kitsByAccent(), L = paletteLook({ seed: 31 }, { base: kit, name: 'tint' }), card = lookOf(L.id).card;
    const grass = lookOf(L.id).swatches.land.grass;
    expect(card.tint.ground).toEqual(grass[Math.round(0.7 * (grass.length - 1))].map((v) => Math.round((v / 255) * 1000) / 1000));
  });
  it('stamped: a terrain palette with no seed gets one; a terrain world names its palette or keeps its painting\'s', () => {
    expect(stampTerrainPalette({ kind: 'terrain', palette: 'auto' }, () => 5).palette).toEqual({ seed: 5 });
    const m = { kind: 'terrain', from: {} };
    expect(stampTerrainPalette(m, () => 5)).toBe(m);
  });
});

describe('a nature kit in a palette', () => {
  const P = { from: { seed: 7, key: 'mid' }, ...natureColours(solvePalette({ seed: 7, key: 'mid' })) };
  it('a face keeps its lightness and takes its role\'s hue; a tiled face wears its even twin; a card stays a card', () => {
    const faces = [
      { group: 'trail:ground', texture: 'soil-dirt', tint: [1.4, 1.3, 1.06] },
      { group: 'trail:rock', tint: [0.6, 0.55, 0.5] },
      { group: 'trail:bough', texture: 'card:bough', tint: [0.9, 1, 0.9] },
      { group: 'trail:shadow', tint: [0, 0, 0] },
    ];
    const [trail, rock, bough, shadow] = recolourFaces(faces, P);
    expect(trail.texture).toBe('even:soil-dirt');
    expect(bough.texture).toBe('even:card:bough');
    expect(shadow).toBe(faces[3]);
    expect(roleOf(trail)).toBe('soil'); expect(roleOf(bough)).toBe('foliage'); expect(roleOf(rock)).toBe('rock');
    const L = (t) => lchOf(t.map((v) => v * 255))[0];
    expect(Math.abs(L(rock.tint) - L(faces[1].tint))).toBeLessThan(0.02);
    expect(Math.abs(((lchOf(rock.tint.map((v) => v * 255))[2] - lchOf(hexToRgb(P.roles.rock))[2] + 540) % 360) - 180)).toBeLessThan(12);
  });
  it('a trail-valley stage in a palette builds; its sky and sun are the palette\'s; without one it is as it was', () => {
    const plain = assembleNatureScene({ style: 'nature-trail' }, { unshaded: true });
    const worn = assembleNatureScene({ style: 'nature-trail', palette: P }, { unshaded: true });
    expect(worn.faces.length).toBe(plain.faces.length);
    expect(worn.sky.zenith).toEqual(P.sky.zenith);
    expect(worn.faces.some((f) => typeof f.texture === 'string' && f.texture.startsWith('even:card:'))).toBe(true);
    expect(worn.cutouts.every((k) => /^(even:)?card:/.test(k))).toBe(true);
    expect(JSON.stringify(assembleNatureScene({ style: 'nature-trail' }, { unshaded: true }).faces.slice(0, 50))).toBe(JSON.stringify(plain.faces.slice(0, 50)));
    expect(recolourCard({ light: { key: {} }, air: { fog: {}, dome: {} }, grade: { tint: [1.02, 1, 0.86], lift: [0.03, 0.04, 0.02] } }, P).grade.tint).toEqual([1, 1, 1]);
  });
  it('solved where it is written; a room kit refuses a stage palette and says where its palette goes', () => {
    const m = resolveStagePalette({ kind: 'stage', kit: 'trail-valley', palette: { heat: 0.5 } }, () => 9);
    expect(m.palette.from).toEqual({ heat: 0.5, seed: 9 });
    expect(Object.keys(m.palette.roles)).toEqual(expect.arrayContaining(['ground', 'soil', 'rock', 'foliage', 'bark', 'accent']));
    expect(resolveStagePalette(m, () => 1)).toBe(m);
    expect(() => resolveStagePalette({ kind: 'stage', kit: 'gothic-stone', palette: { seed: 1 } })).toThrow(/art: \{ palette: \{ from \} \}/);
  });
  it('a palette world on trail-valley keeps its kit and hands its stages the palette', () => {
    const W = { ...MEADOWMARK, style: { ...MEADOWMARK.style, kit: 'trail-valley', palette: { seed: 7, key: 'mid' } } };
    const G = readGameworld(W);
    expect(G.style.kit).toBe('trail-valley');
    expect(G.style.colours).toMatchObject({ painted: true, base: 'trail-valley' });
    const st = gameStages(W).find((s) => s.manifest?.kind === 'stage' && s.manifest.kit === 'trail-valley');
    expect(st.manifest.palette).toEqual(P);
  });
});

describe('a palette moved (shift) and a colour script', () => {
  it('a shift keeps the identity (the candidate, the scheme) and moves the values, the hues and the chroma', () => {
    const K = solvePalette({ seed: 5 }), night = solvePalette({ seed: 5, shift: { light: -1 } }), turned = solvePalette({ seed: 5, shift: { turn: 90 } });
    expect(night.read).toMatchObject({ candidate: K.read.candidate, scheme: K.read.scheme, shift: { light: -1 } });
    expect(night.id).not.toBe(K.id);
    expect(L(mid(night.roles.ground))).toBeLessThan(L(mid(K.roles.ground)) - 0.05);
    const hueOf = (C, r) => lchOf(hexToRgb(mid(C.roles[r])))[2], gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    // the scheme holds: the ground and the sky stay as far apart on the wheel as they were
    expect(Math.abs(gap(hueOf(turned, 'ground'), hueOf(turned, 'sky')) - gap(hueOf(K, 'ground'), hueOf(K, 'sky')))).toBeLessThan(12);
    expect(gap(hueOf(turned, 'ground'), hueOf(K, 'ground'))).toBeGreaterThan(60);
    // a shift that moves nothing is the palette itself
    expect(solvePalette({ seed: 5, shift: {} }).roles).toEqual(K.roles);
    for (const law of ['ramps-climb', 'shade-is-colour', 'sky-brightest', 'ui-contrast']) expect(night.checks.find((c) => c.law === law).ok).toBe(true);
  });
  it('a script is a world\'s: it solves nothing itself; each arc moves the levels from its first keyframe to its last', () => {
    expect(solvePalette({ seed: 5, script: 'dusk' }).roles).toEqual(solvePalette({ seed: 5 }).roles);
    for (const arc of Object.keys(PALETTE_SCRIPTS)) {
      const K = PALETTE_SCRIPTS[arc].keys, first = scriptShift(arc, 0, 4), last = scriptShift(arc, 3, 4);
      expect(first ?? {}).toEqual(K[0][1]);
      expect(last ?? {}).toEqual(K.at(-1)[1]);
    }
    expect(scriptShift('descent', 0, 1)).toBeNull();
    expect(() => readPaletteSpec({ shift: { light: 2 } })).toThrow(/shift.light is -1 to 1/);
    expect(() => readPaletteSpec({ shift: { hue: 2 } })).toThrow(/shift.hue is not part of a shift/);
    expect(() => readPaletteSpec({ script: 'noir' })).toThrow(/script is a world's colour script/);
  });
  it('a gameworld\'s script moves its levels in order; a level\'s { shift } moves the world\'s palette there alone', () => {
    const W = { ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 42, script: 'descent' } } }, G = readGameworld(W);
    const [first, last] = G.ids;
    expect(G.levels[first].style.palette).toBeUndefined();
    expect(G.levels[last].style.palette).toEqual({ seed: 42, shift: scriptShift('descent', 1, 2) });
    // recoloured from the kit it started from: its own, else the world's base (never the world's recoloured kit)
    expect(G.levels[last].style.colours.base).toBe(MEADOWMARK.levels[last].style?.kit ?? 'isekai-meadow');
    const kits = new Set(gameStages(W).filter((s) => s.manifest?.kind === 'stage').map((s) => s.manifest.kit));
    expect(kits.size).toBe(2);
    const own = { ...MEADOWMARK, style: { ...MEADOWMARK.style, palette: { seed: 42 } }, levels: { ...MEADOWMARK.levels, [first]: { ...MEADOWMARK.levels[first], style: { palette: { shift: { warm: 0.5 } } } } } };
    expect(readGameworld(own).levels[first].style.palette).toEqual({ seed: 42, shift: { warm: 0.5 } });
    expect(() => readGameworld({ ...own, style: MEADOWMARK.style })).toThrow(/moves the world's palette: give the world style.palette/);
  });
});

describe('the novelty ledger', () => {
  it('a seed rolled with nothing recent is the first rolled; with recent palettes, the farthest of those tried', () => {
    const rolls = [11, 12, 13, 14], roll = () => rolls.shift() ?? 99;
    expect(novelSeed({}, { recent: [], roll })).toBe(11);
    // the recent palette is seed 21's own: the roll that IS seed 21 is never the one kept
    const recent = [signatureOf(solvePalette({ seed: 21 }))], seq = [21, 22, 23], r2 = () => seq.shift();
    const kept = novelSeed({}, { recent, tries: 3, roll: r2 });
    expect(kept).not.toBe(21);
    const d = (s) => paletteDistance(signatureOf(solvePalette({ seed: s })), recent[0]);
    expect(d(kept)).toBe(Math.max(d(22), d(23)));
    expect(nearestRecent(solvePalette({ seed: 22 }), recent)).toEqual({ id: solvePalette({ seed: 21 }).id, distance: Math.round(d(22) * 1000) / 1000 });
  });
  it('finds the palettes a recipe stores, wherever it stores them, seeded; a cover\'s colours and a kit\'s are not specs', () => {
    expect(palettesIn({ kind: 'gameworld', style: { palette: { seed: 3, heat: 0.4 } } })).toEqual([{ seed: 3, heat: 0.4 }]);
    expect(palettesIn({ kind: 'stage', art: { palette: { from: { seed: 4 } } }, tone: { from: { seed: 5 } } })).toEqual([{ seed: 4 }, { seed: 5 }]);
    expect(palettesIn({ kind: 'stage', palette: { from: { seed: 6 }, roles: {} } })).toEqual([{ seed: 6 }]);
    expect(palettesIn({ kind: 'interior', palette: { seed: 7 } })).toEqual([{ seed: 7 }]);
    expect(palettesIn({ artDirection: { palette: { bg: '#000000', accent: '#ff0000', ink: '#ffffff' } }, style: { palette: { auto: 1 } } })).toEqual([]);
  });
  it('a stream rolled through the ledger keeps every palette apart that the raw rolls let fall together', () => {
    let s = 9;
    const roll = () => { s = (Math.imul(s, 48271) % 2147483647 + 2147483647) % 2147483647 || 1; return s; };
    const sig = [], raw = [];
    for (let i = 0; i < 12; i += 1) { sig.push(signatureOf(solvePalette({ seed: novelSeed({}, { recent: sig, roll }) }))); raw.push(signatureOf(solvePalette({ seed: roll() }))); }
    const least = (g) => Math.min(...g.flatMap((a, i) => g.slice(i + 1).map((b) => paletteDistance(a, b))));
    expect(least(sig)).toBeGreaterThan(least(raw));
    expect(least(sig)).toBeGreaterThan(0.04);
  });
});

describe('the contact sheet', () => {
  it('paints a palette into the same landscape from its roles alone; a page of them, with their spread', () => {
    const K = solvePalette({ seed: 3 }), svg = thumbnail(K);
    for (const c of [K.roles.sky[1], K.roles.ground[2], K.roles.accent[2], K.ui.panel, K.light]) expect(svg).toContain(c);
    expect(svg.startsWith('<svg')).toBe(true);
    const rows = [1, 2, 3].map((seed) => ({ label: `seed ${seed}`, contract: solvePalette({ seed }) }));
    const page = contactSheet([{ title: 'Three', rows }, { title: 'Quiet', rows, stats: false }]);
    expect(page).toMatch(/^<!doctype html>/);
    expect(page.match(/<figure>/g)).toHaveLength(6);
    expect(page.match(/class="stats"/g)).toHaveLength(1);
    const S = sheetStats(rows.map((r) => r.contract));
    expect(S.n).toBe(3);
    expect(S.ground.bins.reduce((a, b) => a + b, 0) + S.ground.grey).toBe(3);
    expect(S.nearest.least).toBeLessThanOrEqual(S.nearest.median);
  });
});

describe('air: a world with thin air, or none', () => {
  // a preset for each air, chosen from the table
  const presetOf = (air) => Object.keys(PALETTE_PRESETS).find((p) => (PALETTE_PRESETS[p].spec.air ?? 'full') === air);
  it('in vacuum the void is the darkest thing, the distance is not hazed, the light is near white, the laws read the air', () => {
    const K = solvePalette({ preset: presetOf('none'), seed: 3 }), air = solvePalette({ seed: 3 });
    expect(K.read).toMatchObject({ air: 'none', preset: presetOf('none') });
    const laws = K.checks.map((c) => c.law);
    expect(laws).toContain('sky-darkest');
    expect(laws).not.toContain('sky-brightest');
    expect(laws).toHaveLength(air.checks.length);
    expect(L(K.roles.sky.at(-1))).toBeLessThan(L(mid(K.roles.ground)) - 0.15);
    // the far layers the ground, a little darker: never the void's colour
    expect(L(mid(K.roles.far))).toBeLessThanOrEqual(L(mid(K.roles.ground)) + 0.005);
    expect(L(mid(K.roles.far))).toBeGreaterThan(L(K.roles.sky.at(-1)) + 0.1);
    expect(lchOf(hexToRgb(K.light))[1]).toBeLessThan(0.02);
    for (const law of ['ramps-climb', 'shade-is-colour', 'sky-darkest', 'ui-contrast', 'greyscale-read']) expect(K.checks.find((c) => c.law === law), law).toMatchObject({ ok: true });
    // the void is the void in every key
    const voidL = (key) => solvePalette({ preset: presetOf('none'), seed: 3, key }).roles.sky.map((c) => Math.round(L(c) * 50));
    expect(voidL('high')).toEqual(voidL('low'));
  });
  it('thin air: the sky is still the brightest, in the dust\'s hue and quieter; the distance half as hazed', () => {
    const K = solvePalette({ seed: 4, air: 'thin' }), F = solvePalette({ seed: 4 });
    expect(K.checks.find((c) => c.law === 'sky-brightest').ok).toBe(true);
    const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180), h = (C, r) => lchOf(hexToRgb(mid(C.roles[r])))[2];
    expect(gap(h(K, 'sky'), h(K, 'soil'))).toBeLessThan(gap(h(F, 'sky'), h(F, 'soil')) + 1);
    const toSky = (C) => deltaE(hexToRgb(mid(C.roles.far)), hexToRgb(C.roles.sky.at(-1)));
    expect(toSky(K) / deltaE(hexToRgb(mid(K.roles.ground)), hexToRgb(K.roles.sky.at(-1)))).toBeGreaterThan(toSky(F) / deltaE(hexToRgb(mid(F.roles.ground)), hexToRgb(F.roles.sky.at(-1))));
  });
  it('a preset is a spec to start from: its own fields win; an unknown preset or air teaches', () => {
    const id = presetOf('none'), K = solvePalette({ preset: id, seed: 2, key: 'high', scheme: 'triad' });
    expect(K.read).toMatchObject({ key: 'high', scheme: 'triad', air: 'none' });
    expect(K.spec).toEqual({ preset: id, seed: 2, key: 'high', scheme: 'triad' });
    // its own hues over the preset's, role by role
    const named = Object.keys(PALETTE_PRESETS).find((p) => PALETTE_PRESETS[p].spec.hues), [role] = Object.keys(PALETTE_PRESETS[named].spec.hues);
    const over = solvePalette({ preset: named, seed: 2, hues: { accent: 30 } }), base = solvePalette({ preset: named, seed: 2 });
    expect(over.params.P[role].h).toBe(base.params.P[role].h);
    expect(over.params.P.accent.h).toBe(30);
    expect(() => readPaletteSpec({ preset: 'pluto' })).toThrow(/preset is one of/);
    expect(() => readPaletteSpec({ air: 'water' })).toThrow(/air is full/);
  });
  it('in vacuum the fill is the planet\'s light, dark; with air, as before', () => {
    const V = solvePalette({ preset: presetOf('none'), seed: 3 }), light = { key: { color: '#ffffff' }, ambient: '#000000' };
    expect(L(lightOf(V, light).ambient)).toBeLessThan(0.32);
    expect(L(lightOf(solvePalette({ seed: 3 }), light).ambient)).toBeGreaterThan(0.6);
    expect(natureColours(V)).toMatchObject({ air: 'none' });
    expect(natureColours(solvePalette({ seed: 3 })).air).toBeUndefined();
  });
  it('an isekai kit in a vacuum palette: the void for a sky with the stars out, no cumulus, the haze all but gone; its land laws read the void', () => {
    const P = paletteLook({ preset: presetOf('none'), seed: 5 }, { name: 'airless' });
    for (const law of ['sky-brightest', 'aerial-perspective', 'shade-is-colour']) expect(P.laws.find((l) => l.law === law), law).toMatchObject({ ok: true });
    const card = lookOf(P.id).card;
    expect(card.void).toMatchObject({ stars: 1 });
    expect(card.cumulus).toBeNull();
    expect(card.air.fog.density).toBeLessThan(0.002);
    const m = assembleStageScene({ kind: 'stage', kit: P.id, seed: 2 });
    expect(m.sky).toMatchObject({ day: 0, stars: 1 });
    expect(m.sky.sun.dir).toHaveLength(3);
    expect(m.haze.density).toBeLessThan(0.002);
    // with air: the day sky as ever
    expect(assembleStageScene({ kind: 'stage', kit: paletteLook({ seed: 5 }, { name: 'aired' }).id, seed: 2 }).sky).toMatchObject({ day: 1, stars: 0 });
  });
  it('a nature card in a vacuum palette: no cloud deck, the void\'s fog and dome, the stars out', () => {
    const st = { light: { key: { color: '#fff' } }, air: { fog: { color: '#bcc8d0', density: 0.011 }, dome: { zenith: [1, 2, 3], horizon: [4, 5, 6] } }, clouds: { mode: 'undershot' } };
    const V = recolourCard(st, natureColours(solvePalette({ preset: presetOf('none'), seed: 3 })));
    expect(V.clouds).toBeNull();
    expect(V.air).toMatchObject({ void: true });
    expect(V.air.fog.density).toBeLessThan(0.002);
    const A = recolourCard(st, natureColours(solvePalette({ seed: 3 })));
    expect(A.clouds).toEqual(st.clouds);
    expect(A.air.void).toBeUndefined();
  });
  it('the contact sheet paints an airless palette into the cratered plain: the void, its stars, a planet in shadow', () => {
    const V = solvePalette({ preset: presetOf('none'), seed: 3 }), svg = thumbnail(V);
    expect(svg).toContain(V.roles.sky[0]);
    expect(svg).toContain(V.shadow);
    expect((svg.match(/<circle/g) ?? []).length).toBeGreaterThan(30);
    expect(thumbnail(solvePalette({ seed: 3, air: 'thin' }))).not.toContain(`fill="${V.light}" opacity`);
  });
});
