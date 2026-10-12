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
});
