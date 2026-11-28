// THE CITY'S MAP: a scene's plan laid on mana-ui's map (shapes from 0 to 1, north up, a metre a metre both ways), what
// stands on it as markers with icons; what it shows is the interface's to say (`ui.map`), checked; its page parses.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { cityMap, readMapUi, CITY_MAP, planMap } from './city-map.js';
import { worldMapLevel } from './world-map.js';
import { mapScript, mapSpec } from '../scene/channels/map-channel.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { readUi } from '../playscape/ui/interface-look.js';

const PLAN = { box: [0, 0, 200, 100], shapes: [{ kind: 'road', r: [0, 0, 200, 100] }, { kind: 'block', r: [20, 10, 60, 40], tall: 0.45 }, { kind: 'park', r: [100, 60, 180, 90] }], places: [{ at: [40, 10], kind: 'shop', card: 'pharmacy' }, { at: [50, 40], kind: 'shop', card: 'apparel' }] };
const LEVEL = { game: { mechanics: [{ kind: 'trade', item: 'fee', at: [40, 8, 0], place: 'pharmacy' }, { kind: 'deliver', id: 'parcel', wants: [{ item: 'fee' }], at: [150, 55, 0], place: 'apparel' }] } };

describe('the city\'s map', () => {
  it('lays the plan on a square, north up: a metre the same both ways, the world\'s north the map\'s top', () => {
    const M = cityMap(PLAN, LEVEL);
    expect(M.side).toBe(200);
    // (200 by 100 on a 200 square: the plan sits in its middle band)
    expect(M.shapes[0]).toMatchObject({ kind: 'road', x: 0, y: 0.25, w: 1, h: 0.5 });
    const block = M.shapes[1];
    expect(block).toMatchObject({ kind: 'block', tall: 0.45 });
    expect(block.w).toBeCloseTo(0.2); expect(block.h).toBeCloseTo(0.15);
    // (its north edge, y 40 of 100, is above its south edge on the map)
    expect(block.y).toBeCloseTo(1 - (40 + 50) / 200);
    // (the corner sees its radius round you: a plan smaller than that is seen whole)
    expect(M.zoom).toBe(1);
    expect(cityMap({ ...PLAN, box: [0, 0, 2000, 1000] }, LEVEL).zoom).toBeCloseTo(2000 / (2 * CITY_MAP.radius), 3);
  });
  it('marks its shops and each job\'s stops with the icons the interface names, a key to them beside', () => {
    const M = cityMap(PLAN, LEVEL);
    expect(M.markers.filter((m) => m.icon === 'shop').map((m) => m.label)).toEqual(['pharmacy', 'apparel shop']);
    expect(M.markers.filter((m) => m.icon === 'flag').map((m) => m.label)).toEqual(['Parcel: Pick up the fee at the pharmacy', 'Parcel: Deliver the fee to the apparel shop']);
    expect(M.key.map((k) => k.icon)).toEqual(['target', 'flag', 'shop', 'car']);
    const own = cityMap(PLAN, LEVEL, { icons: { shop: 'home', job: 'star' }, shops: true, cars: false, corner: 'plan', views: ['miniature', 'plan'], radius: 50 });
    expect(own.markers.map((m) => m.icon)).toEqual(['home', 'home', 'star', 'star']);
    expect(own).toMatchObject({ corner: 'plan', views: ['miniature', 'plan'], cars: false, zoom: 2 });
    expect(own.key.map((k) => k.icon)).toEqual(['target', 'star', 'home']);
    expect(cityMap(PLAN, LEVEL, { shops: false }).markers.every((m) => m.icon === 'flag')).toBe(true);
    expect(cityMap(PLAN, LEVEL, false)).toBeNull();
    expect(cityMap(null, LEVEL)).toBeNull();
  });
  it('the interface\'s map setting is read, each word taught', () => {
    expect(readMapUi(undefined)).toEqual([]);
    expect(readMapUi(false)).toEqual([]);
    expect(readMapUi({ corner: 'follow', views: ['plan'], radius: 100, icons: { car: 'vehicle' } })).toEqual([]);
    expect(readMapUi({ corner: 'spin' })[0]).toMatch(/corner is follow/);
    expect(readMapUi({ views: ['plan', 'plan'] })[0]).toMatch(/each once/);
    expect(readMapUi({ icons: { shop: 'spaceship' } })[0]).toMatch(/not a pictogram/);
    expect(readMapUi({ colour: '#fff' })[0]).toMatch(/not a map setting/);
    expect(readUi({ map: { corner: false } })).toEqual([]);
    expect(readUi({ map: { radius: 9 } })[0]).toMatch(/ui.map.radius/);
  });
  it('the page hosts it on mana-ui: a radar where it is asked for, the map opened on M, in the theme\'s look alone', () => {
    const M = cityMap(PLAN, LEVEL), spec = mapSpec(M);
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    expect(spec.hud.children.map((c) => c.use)).toEqual(['radar-corner']);
    expect(mapSpec(cityMap(PLAN, LEVEL, { corner: false })).hud.children).toEqual([]);
    const src = mapScript(M, 'console');
    for (const s of ['__mojMap', 'map-screen', 'KeyM', 'KeyV']) expect(src).toContain(s);
    let bad = null;
    try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { bad = String(e.stderr || e.message).slice(0, 300); }
    expect(bad).toBe(null);
    expect(mapScript(null)).toBe('');
    // (the map is drawn from above, turned to a heading, and tilted as a miniature with its tall shapes raised)
    const S = { map: { shapes: M.shapes, all: M.markers, near: M.markers, you: { x: 0.5, y: 0.5 }, focus: { x: 0.5, y: 0.5 }, heading: 90, north: 0, zoom: 2, view: 'miniature', key: M.key } };
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act() {}, now: () => 0 });
    expect(rt.view()).toContain('rotate(-90deg)');
    rt.open('map');
    expect(rt.view()).toContain('data-view="miniature"');
    expect(rt.view()).toContain('mana-map-roof');
    expect(rt.view()).toContain('data-icon="shop"');
    // (no colour of its own anywhere in what it draws: the theme's)
    expect(rt.view()).not.toMatch(/#[0-9a-f]{6}/i);
  });
});

describe('mana-ui once a page, and legends that say their keys', () => {
  it('a page with the HUD and a screen carries the runtime once; each host names it; the HUD alone carries its own', async () => {
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    const { bagUi } = await import('./bag-ui.js');
    const quad = { corners: [[-9, -9, 0], [9, -9, 0], [9, 9, 0], [-9, 9, 0]], normal: [0, 0, 1], fill: '#777777', group: 'ground' };
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } };
    const events = { hud: [{ var: 'coins', label: 'coins', as: 'counter', slot: 'top-right' }], reactions: [{ on: 'x', do: 'inc', var: 'coins', by: 1 }], vars: { coins: 0 } };
    const manaHud = { rows: 'events', theme: 'console' };
    const count = (html) => html.split('function buildManaUi').length - 1;
    const alone = emitThreeWorld({ faces: [quad], entities: [hero], events, manaHud });
    expect(count(alone)).toBe(1);
    expect(alone).not.toContain('window.__mojMana');
    const both = emitThreeWorld({ faces: [quad], entities: [hero], events, manaHud, cityMap: cityMap(PLAN, LEVEL), bagUi: bagUi({ game: { mechanics: [{ kind: 'bag', slice: 'bag' }, ...LEVEL.game.mechanics] } }) });
    expect(count(both)).toBe(1);
    expect(both.split('window.__mojMana').length - 1).toBeGreaterThanOrEqual(4);
    for (const s of ['__mojMap', '__mojBag', 'moj-mana-hud']) expect(both).toContain(s);
    const src = [...both.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    let bad = null;
    try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { bad = String(e.stderr || e.message).slice(0, 300); }
    expect(bad).toBe(null);
  });
  it('the map\'s legend names its keys, never an action\'s name', () => {
    const M = cityMap(PLAN, LEVEL), spec = mapSpec(M);
    const S = { map: { shapes: M.shapes, all: M.markers, near: [], you: { x: 0.5, y: 0.5 }, focus: { x: 0.5, y: 0.5 }, heading: 0, north: 0, zoom: 1, view: 'plan', key: M.key } };
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act() {}, now: () => 0 });
    rt.glyphs({ keys: { tabNext: 'V', up: '+', down: '−', back: 'M' } }); rt.input('keys');
    rt.open('map');
    const html = rt.view();
    for (const k of ['>V<', '>+<', '>M<', 'View', 'Zoom']) expect(html).toContain(k);
    for (const k of ['TABNEXT', 'ACCEPT', 'BACK<']) expect(html).not.toContain(k);
  });
});

// A PLANNED MAP's map (planMap, a world map's: gameworld/world-map.js): the whole plan on a square, north up; its blocks
// the land (a ridden one open country), its ways roads, its places buildings; each block named, a town a house and the
// walk's goal a star; the names written on the opened map, the foes awake on the corner, its corner the page's one radar
describe('a planned map\'s map', () => {
  const { level: L } = worldMapLevel({ n: 3, plains: 1, town: 'storybook', names: ['the village', 'the road', 'the ruins', 'the plains', 'the town', 'the keep'] });
  const level = { grid: { tile: L.glyphs.tile, plan: L.glyphs.plan, ...(L.glyphs.segments ? { segments: L.glyphs.segments } : {}) }, sketch: L.glyphs.sketch };
  it('lays every block, named where it stands, whichever page it is opened on', () => {
    const M = planMap(level);
    expect(M.markers.map((m) => m.label).sort()).toEqual(['the keep', 'the plains', 'the road', 'the ruins', 'the town', 'the village']);
    expect(M.markers.find((m) => m.label === 'the keep').icon).toBe('star');
    expect(M.markers.find((m) => m.label === 'the village').icon).toBe('home');
    expect(M.shapes.filter((q) => q.kind === 'park')).toHaveLength(1);
    expect(M.shapes.filter((q) => q.kind === 'land').length + 1).toBe(Object.keys(L.glyphs.plan.key).length);
    for (const k of ['road', 'building']) expect(M.shapes.some((q) => q.kind === k)).toBe(true);
    for (const q of M.shapes) for (const v of [q.x, q.y, q.x + q.w, q.y + q.h]) { expect(v).toBeGreaterThanOrEqual(-1e-6); expect(v).toBeLessThanOrEqual(1 + 1e-6); }
    expect(M).toMatchObject({ names: true, foes: true, cars: false, corner: CITY_MAP.corner });
    // (the same map from a page of it: a zone's word changes nothing)
    expect(planMap({ ...level, zone: ['B', 'C'] })).toEqual(M);
    expect(planMap(level, false)).toBeNull();
    expect(planMap({ grid: { rows: ['#'] } })).toBeNull();
  });
  it('its page names its places and puts the grammar\'s scope away beside its corner; a city\'s is as it was', () => {
    const M = planMap(level), html = mapScript({ ...M, theme: null });
    expect(html).toContain('data-kind=poi]>.mana-caption{display:block}');
    expect(html).toContain('.moj-hg .mana-place[data-at=bottom-right]{display:none');
    expect(mapScript({ ...M, corner: false })).not.toContain('.moj-hg .mana-place[data-at=bottom-right]');
    const city = mapScript(cityMap(PLAN, LEVEL));
    expect(city).not.toContain('data-kind=poi]>.mana-caption{display:block}');
    expect(city).not.toContain('.moj-hg .mana-place');
  });
});
