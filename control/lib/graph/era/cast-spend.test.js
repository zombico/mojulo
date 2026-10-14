import { describe, it, expect } from 'vitest';
import { castSpend, tierOf, REGIONS, REGION_SHARES } from './cast-spend.js';

// a mesh of one triangle per entry, each part at its own height: [part, z, triangles]
function meshOf(rows) {
  const vertices = [], faces = [], provenance = [];
  for (const [part, z, n] of rows) for (let i = 0; i < n; i++) {
    const b = vertices.length;
    for (const v of [[0, 0, z], [0.01, 0, z], [0, 0.01, z]]) { vertices.push(v); provenance.push({ part }); }
    faces.push([b, b + 1, b + 2]);
  }
  return { vertices, faces, provenance };
}
const PLAN = { joints: { headBase: [0, 0, 1.5] } };

describe('cast spend', () => {
  it('reads the tiers by the figure\'s pixel height', () => {
    expect(tierOf(100).id).toBe('T0');
    expect(tierOf(360).id).toBe('T2');
    expect(tierOf(5000).id).toBe('T4');
  });

  it('charges what is worn to clothing wherever it sits: a helm is not the head, a garment is not its body part', () => {
    const s = castSpend(meshOf([['torso', 1.2, 10], ['cranium', 1.6, 6], ['adorn.cranium-hachi', 1.6, 4], ['shirt_torso', 1.2, 3], ['shirtSleeve_upperArmR', 1.3, 2]]), PLAN, '1080p');
    expect(s.regions.head.triangles).toBe(6);
    expect(s.regions.body.triangles).toBe(10);
    expect(s.regions.clothing.triangles).toBe(9);
  });

  it('charges the anime head\'s face to the head where it wraps below the head\'s base', () => {
    const s = castSpend(meshOf([['torso', 1.2, 10], ['face', 1.45, 7], ['cranium', 1.6, 3]]), PLAN, '1080p');
    expect(s.regions.head.triangles).toBe(10);
    expect(s.regions.clothing.triangles).toBe(0);
  });

  it('reads hair by its name\'s start, not by a word inside another part\'s', () => {
    const s = castSpend(meshOf([['hairCap', 1.7, 5], ['hairLock0', 1.6, 2], ['tailR', 1.6, 1], ['adorn.torso-blockade', 1.2, 3]]), PLAN, '1080p');
    expect(s.regions.hair.triangles).toBe(8);
    expect(s.regions.clothing.triangles).toBe(3);
  });

  it('counts carried gear as its own region, in the total and the heaviest; absent, no gear key', () => {
    const mesh = meshOf([['torso', 1.2, 10]]);
    const bare = castSpend(mesh, PLAN, '1080p');
    expect(Object.keys(bare.regions)).toEqual(REGIONS);
    const held = castSpend(mesh, PLAN, '1080p', { gear: [{ slot: 'right', item: 'sword', triangles: 30 }] });
    expect(held.triangles).toBe(40);
    expect(held.regions.gear).toEqual({ triangles: 30, share: 0.75, reserve: REGION_SHARES.T2.gear, at: 'over' });
    expect(held.heaviest[0]).toEqual({ part: 'gear.right', item: 'sword', triangles: 30, region: 'gear' });
    expect(held.advice.some((a) => /^gear spends 75%/.test(a))).toBe(true);
  });

  it('reserves no floor for gear: a hero may carry nothing', () => {
    for (const t of Object.values(REGION_SHARES)) expect(t.gear[0]).toBe(0);
  });

  it('reads a creature by its own names: the muzzle below the head\'s base is the head, the paw the hands, the shin and tail the body, its tiles the cover when asked', () => {
    const RIG = { rig: { joints: { headBase: { at: [0, 0.15, 1.86] } } } };
    const s = castSpend(meshOf([['cranium', 1.9, 4], ['whisker0R', 1.72, 3], ['toothU.1L', 1.72, 2], ['tongue.0', 1.73, 2], ['surroundL', 1.85, 5],
      ['shinR', 0.4, 6], ['metaL', 0.2, 2], ['metaBridgeR', 0.25, 2], ['tail3', 0.9, 3], ['clawF0R', 0.01, 1], ['fingerB2R', 0.7, 2], ['pad.handL', 0.72, 1], ['clawH1R', 0.58, 1],
      ['tile.ruffNeck.neck.L.0.3', 1.6, 4], ['tile0R.2.1', 1.0, 2], ['adorn.belt', 1.0, 3]]), RIG, '1080p', { cover: true });
    expect(s.regions.head.triangles).toBe(16);
    expect(s.regions.body.triangles).toBe(14);
    expect(s.regions.hands.triangles).toBe(4);
    expect(s.regions.cover).toEqual({ triangles: 6, share: 0.140, reserve: [0, REGION_SHARES.T2.hair[1]], at: 'in' });
    expect(s.regions.clothing.triangles).toBe(3);
    // a hero's tiles are a garment's: without `cover` they stay clothing, and there is no cover key
    const hero = castSpend(meshOf([['torso', 1.2, 10], ['tile.quiltBack.torso.L.1.0', 1.3, 4]]), PLAN, '1080p');
    expect(Object.keys(hero.regions)).toEqual(REGIONS);
    expect(hero.regions.clothing.triangles).toBe(4);
  });
});
