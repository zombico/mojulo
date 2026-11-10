// A city's massing in the form render (geocity/scene.js under ctx.formBuildings; form/sun-light.js): its faces baked with
// their colour and their light apart, as a town's are, the sun's shadow the page's own where it takes live shadows and
// baked where it takes none. One small city, read four ways.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const CITY = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity: { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [900, 800], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.45] } };
const KEPT = ['geocity:glass', 'geocity:night-window', 'geocity:facade'];
const walls = (P) => P.faces.filter((f) => f.cornerLight !== undefined && Math.abs(f.normal[2]) < 0.3);

describe('a city\'s massing in the form render', () => {
  const paint = assembleGeocityScene(CITY, { form: true, liveSun: true }), live = assembleGeocityScene(CITY, { form: true, formBuildings: true, liveSun: true });

  it('asked for, its massing carries its light apart from its colour; not asked for, the city is as it was', () => {
    expect(paint.form).toBeUndefined();
    expect(paint.faces.some((f) => f.cornerLight !== undefined)).toBe(false);
    const lit = live.faces.filter((f) => f.cornerLight !== undefined);
    expect(lit.length).toBeGreaterThan(0);
    // (the same faces in the same places; the glass, a lit window, a detail lot's skin and the land's ground left as they came)
    expect(live.faces.map((f) => f.group)).toEqual(paint.faces.map((f) => f.group));
    expect(lit.some((f) => KEPT.includes(f.group) || f.group === 'isekai:ground')).toBe(false);
    // (the sun its one lamp, along the cube's solved sun)
    const T = live.form.town, d = T.lights[0].at, l = Math.hypot(...d);
    expect(T.lights).toHaveLength(1);
    expect(d[2] / l).toBeGreaterThan(0.05);
    expect(T.keep).toEqual(KEPT);
    expect(JSON.stringify(assembleGeocityScene(CITY, { form: true, formBuildings: true, liveSun: true }).form)).toBe(JSON.stringify(live.form));
  }, 120_000);

  it('on a page with live shadows the sun\'s shadow is the page\'s: every corner the sun faces carries its share; with none it is baked', () => {
    const d = live.form.town.lights[0].at, faces = (f) => f.normal[0] * d[0] + f.normal[1] * d[1] + f.normal[2] * d[2] > 1e3;
    const sunward = walls(live).filter(faces);
    expect(sunward.length).toBeGreaterThan(0);
    expect(sunward.every((f) => f.sunShare.every((s) => s > 0))).toBe(true);
    // (a face turned from the sun has none of it, either way)
    expect(walls(live).filter((f) => !faces(f) && f.normal[0] * d[0] + f.normal[1] * d[1] < 0).every((f) => f.sunShare.every((s) => s === 0))).toBe(true);
    const baked = assembleGeocityScene(CITY, { form: true, formBuildings: true });
    expect(walls(baked).filter(faces).some((f) => f.sunShare.some((s) => s === 0))).toBe(true);
  }, 120_000);

  it('a street\'s repeated frontage is baked a template: one base a part whatever its facing, its light by the facing; the page\'s instances read it', () => {
    const front = (P) => (P.repeats || []).filter((r) => r.group.startsWith('geocity:front-'));
    expect(front(paint).length).toBeGreaterThan(0);
    expect(front(paint).some((r) => r.template.some((f) => f.cornerLight !== undefined))).toBe(false);
    const F = front(live);
    expect(F.map((r) => [r.group, r.transforms.length])).toEqual(front(paint).map((r) => [r.group, r.transforms.length]));
    expect(F.every((r) => r.template.every((f) => f.cornerLight !== undefined && f.sunShare !== undefined))).toBe(true);
    // (the same piece each way: the same colours, a different light)
    const byGroup = new Map();
    for (const r of F) { if (!byGroup.has(r.group)) byGroup.set(r.group, []); byGroup.get(r.group).push(r); }
    const two = [...byGroup.values()].find((l) => l.length > 1);
    expect(two).toBeDefined();
    expect(two[0].template.map((f) => f.fill)).toEqual(two[1].template.map((f) => f.fill));
    expect(JSON.stringify(two[0].template.map((f) => f.cornerLight))).not.toBe(JSON.stringify(two[1].template.map((f) => f.cornerLight)));
    // (the page: a baked template's light rides its instances' one geometry; a page with none carries none of it)
    const floor = { corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888', group: 'geocity:walk' };
    const page = (repeats, form) => emitThreeWorld({ faces: [floor], repeats, ...(form ? { form } : {}), inline: true });
    const one = [{ ...two[0], transforms: two[0].transforms.slice(0, 1), near: undefined }], town = { town: { ...live.form.town, maps: {} } };
    expect(page(one, town)).toContain("if (r.lt) geo.setAttribute('aLit'");
    expect(page(one, null)).not.toContain("if (r.lt)");
    expect(page([{ ...front(paint)[0], transforms: front(paint)[0].transforms.slice(0, 1) }], town)).not.toContain("if (r.lt)");
  }, 120_000);

  it('at night it stays paint', () => {
    const night = assembleGeocityScene({ ...CITY, hour: 'night' }, { form: true, formBuildings: true, liveSun: true });
    expect(night.form).toBeUndefined();
    expect(night.faces.some((f) => f.cornerLight !== undefined)).toBe(false);
  }, 120_000);

  it('a city with no industry is made (its wires\' word read only where it has them)', () => {
    expect(paint.counts?.industry === undefined || typeof paint.counts.industry === 'object').toBe(true);
    expect(paint.faces.length).toBeGreaterThan(0);
  });
});
