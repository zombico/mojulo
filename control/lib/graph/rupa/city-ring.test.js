import { describe, it, expect } from 'vitest';
import { assembleGeocityScene, RING, RING_MAX } from '../geocity/scene.js';
import { shellBlocks } from './shell-blocks.js';
import { loadAudit } from './index.js';
import { matterOfWord } from './look-matter.js';

// the smallest metro that still rings (geocity/scene.test.js's), built once physical and once not
const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity };
const phys = assembleGeocityScene({ ...M, destruction: 'physical' }), plain = assembleGeocityScene(M);
const houses = (P) => P.physicalRing.map((b) => ({ min: b.min, max: b.max, of: `${b.id}:house`, eave: b.eave, group: b.group, coarse: true, ...(b.word ? { word: b.word } : {}), ...(b.flat ? { flat: true } : {}) }));

describe('the geocity\'s physical ring', () => {
  it('its nearest buildings to the walk\'s start, within a city block, are handed over; the city is drawn the same', () => {
    const R = phys.physicalRing, eye = phys.walk.spawn;
    expect(R.length).toBeGreaterThan(0);
    expect(R.length).toBeLessThanOrEqual(RING_MAX);
    const d = (b) => Math.hypot(Math.max(b.min[0] - eye[0], 0, eye[0] - b.max[0]), Math.max(b.min[1] - eye[1], 0, eye[1] - b.max[1]));
    expect(R.every((b) => d(b) <= RING)).toBe(true);
    expect(R.every((b) => b.word && matterOfWord(b.word))).toBe(true);   // each breaks as its finish is drawn
    expect(JSON.stringify(phys.faces)).toBe(JSON.stringify(plain.faces));
    expect(plain.physicalRing).toBeUndefined();
  });

  it('each becomes walls in coarse panels and a roof (a flat one a slab of its walls), in its own faces, standing at minute zero', () => {
    const S = shellBlocks({ faces: phys.faces, colliders: houses(phys) });
    const b0 = phys.physicalRing[0], own = S.breakables.filter((b) => b.id.startsWith(`${b0.id}:`));
    expect(own.some((b) => /:wall-/.test(b.id)) && own.some((b) => /:roof$/.test(b.id))).toBe(true);
    expect(own.filter((b) => /:wall-/.test(b.id)).every((b) => b.matter === matterOfWord(b0.word).matter)).toBe(true);
    if (b0.flat) expect(own.find((b) => /:roof$/.test(b.id))).toMatchObject({ matter: matterOfWord(b0.word).matter });
    // its faces go with it, and only its own groups
    const claimed = S.faces.filter((f) => typeof f.node === 'string' && f.node.startsWith(`${b0.id}:`));
    expect(claimed.length).toBeGreaterThan(0);
    expect(phys.faces.filter((f, i) => S.faces[i].node && S.faces[i].node.startsWith(`${b0.id}:`)).every((f) => f.group === b0.group || f.group === `${b0.group}:roof`)).toBe(true);
    // a tower stays a few hundred blocks at most
    expect(S.groups.every((g) => g.blocks <= 4 * 4 * 6 + 1 + 16)).toBe(true);
    expect(loadAudit(S.breakables, { colliders: S.colliders })).toMatchObject({ loose: [], crush: [], span: [] });
  });

  it('it takes play: a hero, destruction, matter (any other key is still refused)', () => {
    expect(() => assembleGeocityScene({ ...M, entities: [], matter: { power: 'heroic' } })).not.toThrow();
    expect(() => assembleGeocityScene({ ...M, rooms: [] })).toThrow(/not a setting/);
  });
});

// (the ring in a whole world, resolved through world-scene, is city-ring.e2e.test.js: the e2e tier's, it takes minutes)
