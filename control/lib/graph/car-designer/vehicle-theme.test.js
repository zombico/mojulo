// A vehicle's theme (vehicle-theme.js) and the race machines wearing it. The concepts, each on a starter chosen in code
// by what it carries: the card read and refused (a name, a card, a card over a starter, a variation); a series' variation
// (the card itself first, the hues turned within the spread, the trim's metal never, the liveries in turn); the finish as
// material rows. On a racer: the theme's shape read in place of the driver's, its parts preferred over the fits but under
// a pin, a family left off, its palette on the slots, its finish on the form render's rows, the colours that glow shining
// as a lamp; no theme, no key. A field in a series, each its own variation, the lean keeping to the theme's parts. On a
// supercar: the palette as its paint and livery, the spec's own surface over the theme's, the trim's metal on its alloy,
// a glowing stripe. A quick race's `series` and a supercar entry's `theme`.
import { describe, it, expect } from 'vitest';
import { THEMES, THEME_IDS, FINISHES, readTheme, themeVariant, seriesTheme, themeMaterials, trimTint, glowRow } from './vehicle-theme.js';
import { VEHICLE_MATERIALS } from './vehicle-surface-finish.js';
import { KART_MATERIALS } from './racer-shade.js';
import { racerSpec, racerOf, solveRoster } from './roster.js';
import { supercarFigure, supercarOfSpec } from './supercar-figure.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';
import { readQuick, quickSupercars } from '../gameworld/quick.js';

const pick = (want) => THEME_IDS.find((id) => want(THEMES[id]));
const GLOW = pick((t) => t.finish?.glow?.includes('accent') && t.finish.glow.includes('skin'));
const LEAVES = pick((t) => Object.values(t.prefer ?? {}).includes(null));
const LISTED = pick((t) => t.vary?.livery && t.palette?.body);
const hueGap = (a, b) => { const d = Math.abs(hexLch(a)[2] - hexLch(b)[2]) % 360; return Math.min(d, 360 - d); };

describe('a theme', () => {
  it('is read from a name, a card, or a card over a starter, and refuses what it does not know', () => {
    expect(readTheme(GLOW)).toMatchObject({ name: GLOW, finish: THEMES[GLOW].finish });
    const own = readTheme({ palette: { body: 'cobalt', accent: '#FF0000' }, finish: { paint: 'matte' } });
    expect(own.palette).toEqual({ body: '#1b559a', accent: '#ff0000' });
    const over = readTheme({ from: LISTED, palette: { body: '#20304a' }, finish: { trim: 'copper' } });
    expect(over.palette).toEqual({ ...THEMES[LISTED].palette, body: '#20304a' });
    expect(over.finish).toEqual({ ...THEMES[LISTED].finish, trim: 'copper' });
    expect(over.prefer).toEqual(THEMES[LISTED].prefer);
    expect(() => readTheme('tartan')).toThrow(/no theme 'tartan'/);
    expect(() => readTheme({ colour: 'red' })).toThrow(/has no 'colour'/);
    expect(() => readTheme({ palette: { body: 'red' } })).toThrow(/'#rrggbb' or a paint/);
    expect(() => readTheme({ finish: { paint: 'velvet' } })).toThrow(/finish.paint is one of/);
    expect(() => readTheme({ finish: { glow: ['body'] } })).toThrow(/finish.glow is a list of accent, skin/);
    expect(() => readTheme({ prefer: { wheel: null } })).toThrow(/cannot be left off/);
    expect(() => readTheme({ prefer: { wheel: 'square' } })).toThrow(/no wheel 'square'/);
    expect(() => readTheme({ shape: { motif: 'lace' } })).toThrow(/shape.motif is one of/);
    expect(() => readTheme({ from: GLOW, variant: -1 })).toThrow(/whole number/);
  });
  it('varies across a series: the card first, its hues turned within the spread, its metal never, its liveries in turn', () => {
    const T = readTheme(LISTED), spread = T.vary.hue;
    expect(themeVariant(T, 0)).toBe(T);
    const vs = [1, 2, 3, 4].map((k) => themeVariant(T, k));
    expect(new Set(vs.map((v) => v.palette.body)).size).toBe(4);
    for (const v of vs) {
      expect(hueGap(v.palette.body, T.palette.body)).toBeLessThanOrEqual(spread + 1);
      if (T.palette.trim) expect(v.palette.trim).toBe(T.palette.trim);
      expect(T.vary.livery).toContain(v.livery);
    }
    expect(vs.map((v) => v.livery)).not.toEqual(vs.map(() => vs[0].livery));
    expect(readTheme({ from: LISTED, variant: 2 })).toEqual(vs[1]);
    expect(seriesTheme(LISTED, 0)).toBe(LISTED);
    expect(seriesTheme(LISTED, 3)).toEqual({ from: LISTED, variant: 3 });
  });
  it('finishes the material rows: its paint, its trim\'s metal on the alloy and the chrome, each glow in its colour', () => {
    expect(themeMaterials(KART_MATERIALS, readTheme({ palette: { body: '#102030' } }))).toBe(KART_MATERIALS);
    const T = readTheme(GLOW), M = themeMaterials(KART_MATERIALS, T);
    expect(M.paint).toEqual(FINISHES.paint[T.finish.paint]);
    expect(M.alloy).toEqual(FINISHES.trim[T.finish.trim].row);
    expect(M.chrome).toEqual(M.alloy);
    for (const g of T.finish.glow) expect(M[glowRow(g)]).toMatchObject({ emissive: T.palette[g] });
    expect(themeMaterials(VEHICLE_MATERIALS, T).chrome).toBeUndefined();
    expect(trimTint(T)).toBe(FINISHES.trim[T.finish.trim].tint);
  });
});

describe('a racer in a theme', () => {
  const entry = { archetype: 'explorer', seed: 5 };
  const solved = (theme, extra = {}) => racerOf(racerSpec({ ...entry, ...extra, ...(theme ? { theme } : {}) }, 0, 1));
  it('reads the theme\'s shape over the driver\'s, prefers its parts over the fits and under a pin, leaves off what it leaves off', () => {
    const T = readTheme(LEAVES), { R, S } = solved(LEAVES);
    for (const [facet, value] of Object.entries(T.shape)) expect(R.reads.find((r) => r.facet === facet)).toMatchObject({ value, why: `the theme (${LEAVES})` });
    expect(R.vehicle.facets.livery).toBe(T.livery);
    const [fam, id] = Object.entries(T.prefer).find(([, v]) => typeof v === 'string');
    expect(S.ids[fam]).toBe(id);
    expect(S.chosen.find((c) => c.family === fam).why).toMatch(/the theme/);
    const off = Object.keys(T.prefer).find((k) => T.prefer[k] === null);
    expect(S.ids[off]).toBe(null);
    const other = Object.keys(S.suggestions[fam]).length ? S.suggestions[fam].map((x) => x.id).find((x) => x !== id) : null;
    if (other) expect(solved(LEAVES, { parts: { [fam]: other } }).S.ids[fam]).toBe(other);
  }, 60000);
  it('paints its palette on the slots and draws its finish in the form render, its glowing colours shining as a lamp does', () => {
    const T = readTheme(GLOW), { S } = solved(GLOW, { light: 'form' });
    const all = [...S.faces.root, ...S.faces.bones.flatMap((b) => b.faces)];
    expect(all.some((f) => f.albedo === T.palette.body)).toBe(true);
    expect(S.figure.form.materials).toEqual(S.materials);
    expect(S.materials.paint).toEqual(FINISHES.paint[T.finish.paint]);
    const glow = all.filter((f) => f.material.startsWith('glow:'));
    expect(new Set(glow.map((f) => f.material))).toEqual(new Set(T.finish.glow.map(glowRow)));
    for (const f of glow) expect(new Set(f.cornerFills).size).toBe(1);
    // the gloss wheel's lip in the trim's metal
    const lip = S.faces.wheels[0].faces.find((f) => f.material === 'chrome');
    expect(lip.albedo).toBe(trimTint(T));
    // no theme: no key in the recipe, no rows on the machine
    expect(racerSpec(entry, 0, 1).theme).toBeUndefined();
    expect(solved(null).S.materials).toBeUndefined();
  }, 60000);
  it('in a series, every racer without its own wears it, each its own variation, the lean keeping to the theme\'s parts', () => {
    const { racers, changes } = solveRoster(['hero', 'sage', { archetype: 'outlaw', theme: GLOW }], { seed: 3, series: LISTED });
    expect(racers.map((r) => r.spec.theme)).toEqual([LISTED, { from: LISTED, variant: 1 }, GLOW]);
    const prefer = (r) => readTheme(r.spec.theme).prefer ?? {};
    for (const c of changes) { const p = prefer(racers[c.racer])[c.family]; if (p !== undefined) expect([].concat(p)).toContain(c.to); }
    expect(() => solveRoster(2, { series: 'tartan' })).toThrow(/a series: no theme/);
  }, 90000);
});

describe('a supercar in a theme', () => {
  it('paints the palette as its paint and livery, under the spec\'s own surface; its trim\'s metal on the alloy; a glowing stripe', () => {
    const T = readTheme(GLOW), { car } = supercarOfSpec({ theme: GLOW });
    expect(car.headlightStyle).toBe(T.supercar.headlightStyle);
    expect(car.livery.secondary).toBe(T.palette.skin);
    expect(car.faces.body.some((f) => f.albedo === T.palette.body)).toBe(true);
    expect(supercarOfSpec({ theme: GLOW, surface: { headlightStyle: 'round', paint: 'amber' } }).car.headlightStyle).toBe('round');
    const fig = supercarFigure({ theme: GLOW, light: 'form' });
    expect(fig.form.materials[glowRow('skin')].emissive).toBe(car.livery.secondary);
    expect(JSON.stringify(fig)).toMatch(/"mats":\[[^\]]*"glow:skin"/);
    expect(fig.form.materials.alloy).toEqual(FINISHES.trim[T.finish.trim].row);
    expect(JSON.stringify(supercarFigure({}))).toBe(JSON.stringify(supercarFigure({ preset: 'razor' })));
    expect(() => supercarFigure({ theme: 'tartan' })).toThrow(/supercar: a theme: no theme/);
  }, 60000);
});

describe('a race in a series', () => {
  it('is read with a field to theme, and themes every supercar without its own', () => {
    expect(() => readQuick({ goal: 'race', series: GLOW })).toThrow(/series themes a field/);
    expect(() => readQuick({ goal: 'race', supercars: 2, series: 'tartan' })).toThrow(/\.series: no theme/);
    expect(() => readQuick({ goal: 'race', supercars: [{ theme: 'tartan' }, {}] })).toThrow(/supercars\[0\]\.theme/);
    const { field } = quickSupercars({ goal: 'race', supercars: [{}, {}, { theme: GLOW }], series: LISTED }, 2);
    expect(field.map((c) => c.spec.theme)).toEqual([LISTED, { from: LISTED, variant: 1 }, GLOW]);
    // (a themed car is painted by its theme: no solved paint in its surface)
    for (const c of field) expect(c.spec.surface.paint).toBeUndefined();
  }, 60000);
});
