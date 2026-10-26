/**
 * The live light on by default where it pays (scene/live-light.js liveLightDefaults). Claims under test:
 *   · a hero's level takes the actors' shadows unless its recipe says otherwise; a world that is neither a hero's
 *     level nor gen-7, and asks nothing, keeps its recipe's own values (the same objects) and no tier: its page as it was;
 *   · a world whose geocube names the seventh generation takes actors, the hour's map and occlusion, each overridable;
 *   · the tier, by the screen the game is made for: a phone half without the default occlusion, off none of it;
 *   · the page: the tier sizes the maps and the occlusion, and only a page with a tier carries the budget probe;
 *   · the hour map's receiver bias grows with the receiver's slope, capped;
 *   · the outdoor kits write the sun's share only when asked, their colours untouched by it (the island's cel faces
 *     from their band; the city's from its key's Lambert).
 * The budget's counts and the moire's pixels are in live-light.chrome.test.js.
 */
import { describe, expect, it } from 'vitest';

import { liveLightDefaults, heroLevel, spectatedBattle, readLightTier, tierFor, receiverBias, OCCLUSION_DEFAULTS } from './live-light.js';
import { emitThreeWorld } from './scene-three.js';

const HERO = { id: 'h', pilotable: true, rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.4, 1.8] }, transform: { pos: [2, 2, 0], heading: 0 } };
const CAMERA = { rule: 'follow', target: 'h' };
const floor = (extra = {}) => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888', ...extra });

describe('live light defaults: who takes what', () => {
  it('a hero is a pilot with a body; a first-person walker and a spectated battle are not', () => {
    expect(heroLevel({ entities: [HERO] })).toBe(true);
    expect(heroLevel({ entities: [{ ...HERO, body: { type: 'none' } }] })).toBe(false);
    expect(heroLevel({ entities: [HERO], spectate: true })).toBe(false);
    expect(heroLevel({ entities: [{ ...HERO, pilotable: false }] })).toBe(false);
    expect(heroLevel({})).toBe(false);
  });
  it('a spectated battle\'s fighters cast as a hero does; a battle with no bodies takes nothing', () => {
    const FIGHTER = { ...HERO, pilotable: false };
    expect(spectatedBattle({ entities: [FIGHTER], spectate: true })).toBe(true);
    expect(spectatedBattle({ entities: [FIGHTER] })).toBe(false);
    expect(spectatedBattle({ entities: [{ ...FIGHTER, body: { type: 'none' } }], spectate: true })).toBe(false);
    expect(liveLightDefaults({ entities: [FIGHTER], spectate: true })).toMatchObject({ shadows: { actors: true }, from: { actors: 'spectate' } });
    expect(liveLightDefaults({ entities: [FIGHTER], spectate: true, shadows: false }).shadows).toBe(false);
  });
  it('neither a hero nor gen-7: the recipe\'s own values, the same objects, and no tier', () => {
    for (const shadows of [undefined, { torch: 'soft' }, true, { cast: true }]) {
      const m = { kind: 'stage', shadows }, L = liveLightDefaults(m);
      expect(L.shadows).toBe(shadows);
      expect(L.occlusion).toBeUndefined();
      expect(L.tier).toBeNull();
      expect(L.from).toEqual({});
    }
    // its own ask is its own, and it costs at the tier
    expect(liveLightDefaults({ shadows: { actors: true } })).toMatchObject({ shadows: { actors: true }, tier: { tier: 'full', mapSize: 2048, ao: 1 }, from: {} });
  });
  it('a hero\'s level takes the actors\' shadows beside a stage\'s bake keys, unless the recipe says otherwise', () => {
    expect(liveLightDefaults({ entities: [HERO] })).toEqual({ shadows: { actors: true }, occlusion: undefined, tier: { tier: 'full', mapSize: 2048, ao: 1 }, from: { actors: 'hero' } });
    expect(liveLightDefaults({ entities: [HERO], shadows: { torch: 'soft', sun: 1 } }).shadows).toEqual({ torch: 'soft', sun: 1, actors: true });
    expect(liveLightDefaults({ entities: [HERO], shadows: { hour: true } }).shadows).toEqual({ hour: true, actors: true });
    // said otherwise: none, the suit's blob (as asked, or tuned), the cast channel, actors off
    for (const shadows of [false, true, { r: 14, alpha: 0.5 }, { cast: true }, { actors: false }]) {
      const L = liveLightDefaults({ entities: [HERO], shadows });
      expect(L.shadows).toBe(shadows);
      expect(L.tier).toBeNull();
    }
  });
  it('the seventh generation turns on the actors, the hour and occlusion, each the recipe\'s own where it names it', () => {
    expect(liveLightDefaults({}, { era: 'gen-7' })).toEqual({ shadows: { actors: true, hour: true }, occlusion: true, tier: { tier: 'full', mapSize: 2048, ao: 1 }, from: { actors: 'gen-7', hour: 'gen-7', occlusion: 'gen-7' } });
    expect(liveLightDefaults({ entities: [HERO] }, { era: 'gen-7' }).from).toEqual({ actors: 'hero', hour: 'gen-7', occlusion: 'gen-7' });
    expect(liveLightDefaults({ shadows: { hour: false } }, { era: 'gen-7' }).shadows).toEqual({ hour: false, actors: true });
    expect(liveLightDefaults({ occlusion: false }, { era: 'gen-7' }).occlusion).toBe(false);
    expect(liveLightDefaults({ occlusion: { strength: 0.3 } }, { era: 'gen-7' }).occlusion).toEqual({ strength: 0.3 });
    expect(liveLightDefaults({ shadows: false, occlusion: false }, { era: 'gen-7' })).toMatchObject({ shadows: false, occlusion: false, tier: null });
    // gen-6, the default, adds nothing
    expect(liveLightDefaults({}, { era: 'gen-6' })).toMatchObject({ shadows: undefined, occlusion: undefined, tier: null });
  });
});

describe('live light defaults: the tier', () => {
  const S = (pole, orientation) => ({ pole, aspect: [9, 16], orientation });
  it('reads light.tier, and only that key of a world\'s light', () => {
    expect(readLightTier(undefined)).toBe('auto');
    expect(readLightTier({ x: 0.4, y: 0.6, z: 0.6 })).toBe('auto');   // a painted landscape's light is its own
    for (const t of ['auto', 'off', 'half', 'full']) expect(readLightTier({ tier: t })).toBe(t);
    expect(() => readLightTier({ tier: 'ultra' })).toThrow(/light\.tier is one of auto, off, half, full/);
  });
  it('auto by the screen: a phone half without the default occlusion, a tablet half, a screen or none full', () => {
    expect(tierFor('auto', S('phone', 'portrait'))).toEqual({ tier: 'half', mapSize: 1024, ao: 0.5, occlusion: false });
    expect(tierFor('auto', S('tablet', 'landscape'))).toEqual({ tier: 'half', mapSize: 1024, ao: 0.5, occlusion: true });
    expect(tierFor('auto', S('screen', 'landscape'))).toEqual({ tier: 'full', mapSize: 2048, ao: 1, occlusion: true });
    expect(tierFor('auto', null).tier).toBe('full');
    expect(tierFor('auto', S('custom', 'portrait')).tier).toBe('half');   // a frame upright reads as a phone
    expect(tierFor('full', S('phone', 'portrait')).tier).toBe('full');   // a tier named wins over the screen
    expect(tierFor('off')).toBeNull();
  });
  it('on a phone gen-7 keeps its shadows at 1024 and takes no default occlusion; the recipe\'s own occlusion stays', () => {
    const phone = S('phone', 'portrait');
    expect(liveLightDefaults({}, { era: 'gen-7', screen: phone })).toMatchObject({ shadows: { actors: true, hour: true }, occlusion: undefined, tier: { tier: 'half', mapSize: 1024, ao: 0.5 } });
    expect(liveLightDefaults({ occlusion: true }, { era: 'gen-7', screen: phone }).occlusion).toBe(true);
  });
  it('off: no live light, the defaults and the recipe\'s asks alike; its bake keys and its blob stay', () => {
    const off = { light: { tier: 'off' } };
    expect(liveLightDefaults({ ...off, entities: [HERO] }, { era: 'gen-7' })).toEqual({ shadows: undefined, occlusion: undefined, tier: null, from: {} });
    expect(liveLightDefaults({ ...off, shadows: { actors: true, torch: 'soft' }, occlusion: true }).shadows).toEqual({ torch: 'soft' });
    expect(liveLightDefaults({ ...off, shadows: { actors: true } }).shadows).toBeUndefined();
    expect(liveLightDefaults({ ...off, entities: [HERO], shadows: true }).shadows).toBe(true);
  });
});

describe('live light defaults: the page', () => {
  it('the tier sizes the maps where the world names none, and only a page with a tier carries the budget probe', () => {
    const base = { faces: [floor({ sunShare: 0.5 })], entities: [HERO], camera: CAMERA, shadows: { actors: true } };
    const full = emitThreeWorld(base), half = emitThreeWorld({ ...base, lightTier: { tier: 'half', mapSize: 1024, ao: 0.5 } });
    expect(full).toContain('"mapSize":2048');
    expect(full).not.toContain("live light's budget");
    expect(half).toContain('"mapSize":1024');
    expect(half).toContain("// --- live light's budget (tier 'half')");
    expect(emitThreeWorld({ ...base, shadows: { actors: true, mapSize: 4096 }, lightTier: { tier: 'half', mapSize: 1024, ao: 0.5 } })).toContain('"mapSize":4096');
    // a tier with nothing live on the page: no probe
    expect(emitThreeWorld({ faces: [floor()], lightTier: { tier: 'full', mapSize: 2048, ao: 1 } })).not.toContain("live light's budget");
  });
  it('the half tier\'s occlusion: alone, the prepass at half the frame; beside the creases, its pass at a quarter', () => {
    const T = { tier: 'half', mapSize: 1024, ao: 0.5 }, faces = [floor()];
    const full = emitThreeWorld({ faces, occlusion: true, lightTier: { ...T, tier: 'full', ao: 1 } });
    const alone = emitThreeWorld({ faces, occlusion: true, lightTier: T });
    const creased = emitThreeWorld({ faces, occlusion: true, creases: true, lightTier: T });
    expect(full).toContain('vec2 h = floor(fc * 0.5);');
    expect(full).not.toContain('__crSz.x * __dpr * 0.5');
    expect(alone).toContain('Math.round(__crSz.x * __dpr * 0.5)');
    expect(alone).toContain('vec2 h = floor(fc * 0.25);');
    expect(alone).toContain('fc = hp * 2.0 + 0.5;');
    expect(creased).not.toContain('__crSz.x * __dpr * 0.5');
    expect(creased).toContain('fc = hp * 4.0 + 1.5;');
    expect(creased).toContain('__aoRT.setSize(Math.max(1, __w >> 2), Math.max(1, __h >> 2))');
    // the full tier is the occlusion as built: the same block as a page with no tier
    const block = (p) => p.slice(p.indexOf('// --- occlusion'), p.indexOf('const __creasePrepass'));
    expect(block(full)).toBe(block(emitThreeWorld({ faces, occlusion: true })));
  });
  it('the hour map\'s bias grows with the receiver\'s slope across a texel and a half, capped at eight times its own', () => {
    expect(receiverBias([0, 0], 1 / 2048, 0.001, 0.008)).toBe(0.001);   // facing the sun: the map's own bias
    expect(receiverBias([2, 1], 1 / 1024, 0.001, 0.008)).toBeCloseTo(0.001 + 1.5 * 3 / 1024, 9);   // a slope: its climb
    expect(receiverBias([500, 0], 1 / 1024, 0.001, 0.008)).toBeCloseTo(0.009, 12);   // grazing: capped, a caster's shadow kept
    expect(emitThreeWorld({ faces: [floor()], shadows: { hour: true } })).toContain('return csLit( map, co, bias + min( 8.0 * bias, 1.5 * texel * ( abs( g.x ) + abs( g.y ) ) ), texel );');
  });
});

describe('live light defaults: a world resolved', () => {
  const rooms = [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 4 }];
  const PLAZA = { kind: 'stage', kit: 'island-plaza', reference: 'island-noon', dress: false, rooms };
  it('a hero\'s stage takes the actors\' shadows and bakes the share; without the hero, nothing changes', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const sk = (manifest) => ({ manifest, title: 't' });
    const hero = (await resolveWorldScene(sk({ ...PLAZA, entities: [HERO], camera: CAMERA }))).payload;
    expect(hero.shadows).toEqual({ actors: true });
    expect(hero.lightTier).toEqual({ tier: 'full', mapSize: 2048, ao: 1 });
    expect(hero.faces.some((f) => f.sunShare !== undefined)).toBe(true);
    const plain = (await resolveWorldScene(sk(PLAZA))).payload;
    expect(plain.shadows).toBeUndefined();
    expect(plain.lightTier).toBeUndefined();
    expect(plain.faces.some((f) => 'sunShare' in f)).toBe(false);
    // the hero's opt-out keeps the page it had
    const out = (await resolveWorldScene(sk({ ...PLAZA, entities: [HERO], camera: CAMERA, shadows: { actors: false } }))).payload;
    expect(out.shadows).toEqual({ actors: false });
    expect(out.lightTier).toBeUndefined();
    expect(out.faces.some((f) => 'sunShare' in f)).toBe(false);
    // the unshaded export takes none of it
    const raw = (await resolveWorldScene(sk({ ...PLAZA, entities: [HERO], camera: CAMERA }), { unshaded: true })).payload;
    expect(raw.shadows).toBeUndefined();
    expect(raw.lightTier).toBeUndefined();
  }, 60000);
  it('a world whose geocube names gen-7 takes the live light; the same cube at gen-6 takes none', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const sk = (geocube, extra = {}) => ({ manifest: { kind: 'stage', geocube, ...extra }, title: 't' });
    const g7 = (await resolveWorldScene(sk({ from: 'gothic-night', era: 'gen-7' }))).payload;
    expect(g7.shadows).toEqual({ actors: true, hour: true });
    expect(g7.occlusion).toEqual({ ...OCCLUSION_DEFAULTS });
    expect(g7.lightTier.tier).toBe('full');
    const g6 = (await resolveWorldScene(sk('gothic-night'))).payload;
    expect(g6.shadows).toBeUndefined();
    expect(g6.occlusion).toBeUndefined();
    expect(g6.lightTier).toBeUndefined();
    // on a phone: half, and no default occlusion
    const phone = (await resolveWorldScene(sk({ from: 'gothic-night', era: 'gen-7' }, { screen: 'phone' }))).payload;
    expect(phone.lightTier).toEqual({ tier: 'half', mapSize: 1024, ao: 0.5 });
    expect(phone.occlusion).toBeUndefined();
  }, 60000);
});

describe('live light defaults: every outdoor kit writes the sun\'s share', () => {
  const strip = (fs) => fs.map(({ sunShare, ...f }) => f);
  it('the island\'s bake writes it only when asked, its colours the same; a lit cel band shares, a shaded one none', async () => {
    const { assembleStageScene } = await import('../era/stage.js');
    const M = { kind: 'stage', kit: 'isekai-meadow' };
    const plain = assembleStageScene(M, {}), live = assembleStageScene(M, { liveSun: true });
    expect(plain.faces.some((f) => 'sunShare' in f)).toBe(false);
    expect(strip(live.faces)).toEqual(plain.faces);
    const cel = live.faces.filter((f) => typeof f.texture === 'string' && f.texture.startsWith('isekai:') && !f.textureLit && f.sunShare !== undefined);
    expect(cel.some((f) => f.sunShare > 0)).toBe(true);   // a lit band: what its value loses to the shade band
    expect(cel.some((f) => f.sunShare === 0)).toBe(true);   // a shaded band: never darkened again
    expect(cel.every((f) => f.sunShare >= 0 && f.sunShare < 1)).toBe(true);
  }, 60000);
  it('the city\'s faces carry their key\'s share by their normal; a lit window none', async () => {
    const { assembleCityScene } = await import('../city/plan/scene.js');
    const M = { kind: 'city', seed: 3, board: { cols: 2, rows: 2 }, cars: false, people: 0 };
    const plain = assembleCityScene(M, {}), live = assembleCityScene(M, { liveSun: true });
    expect(plain.faces.some((f) => 'sunShare' in f)).toBe(false);
    expect(strip(live.faces)).toEqual(plain.faces);
    const up = live.faces.filter((f) => f.normal && f.normal[2] > 0.99), down = live.faces.filter((f) => f.normal && f.normal[2] < -0.99);
    expect(up.length && up.every((f) => f.sunShare > 0.2 && f.sunShare < 1)).toBe(true);   // a roof, a street: the key reaches
    expect(down.every((f) => f.sunShare === 0)).toBe(true);   // an underside: the key never does
    const night = assembleCityScene({ ...M, paint: { geocube: 'city-night' } }, { liveSun: true });
    expect(night.faces.filter((f) => f.group === 'city:night-window').every((f) => f.sunShare === undefined)).toBe(true);
    expect(night.faces.some((f) => f.sunShare > 0)).toBe(true);   // the moon is the key
  }, 120000);
});
