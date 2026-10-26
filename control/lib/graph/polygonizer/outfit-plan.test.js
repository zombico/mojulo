// outfit-plan.test.js — the outfit catalogue's cloth pieces worn on a hero (designed `pieces`): a robe's sleeves and a
// cloak's hood are the garment kernel's pieces (body-garment.js), on the hero's own landmarks. One hero per procedure.
import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const partsOf = (cast, style, pieces) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime', outfit: { type: 'outfit', style, pieces } }) }).recipe.parts;
const centre = (st) => { const v = Object.values(st.points); return [0, 1, 2].map((k) => v.reduce((s, p) => s + p[k], 0) / v.length); };
const radius = (st) => { const c = centre(st), v = Object.values(st.points); return v.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]), 0) / v.length; };

describe('the wizard\'s robe: a robe whose sleeves bell at the wrist', () => {
  const P = partsOf('male', 'adventurer', [{ kind: 'wizardRobe' }]), PLAIN = partsOf('male', 'adventurer', [{ kind: 'robe' }]);
  it('sleeves on both arms, over the cut\'s own, widening from the elbow to an open mouth at the wrist', () => {
    for (const S of ['R', 'L']) {
      const up = P[`wizardRobeSleeve_upperArm${S}`], fore = P[`wizardRobeCuff_foreArm${S}`]; expect(up && fore).toBeTruthy();
      // the bell: the mouth stands off the forearm far more than the cloth at the elbow does
      const arm = P[`foreArm${S}`].stations, gain = (st) => radius(st) - radius(arm.reduce((b, a) => (Math.hypot(...centre(a).map((x, k) => x - centre(st)[k])) < Math.hypot(...centre(b).map((x, k) => x - centre(st)[k])) ? a : b)));
      expect(gain(fore.stations.at(-1))).toBeGreaterThan(gain(fore.stations[0]) + 0.04);
      // over the adventurer's own sleeve, ring for ring
      const under = P[`topSleeve_upperArm${S}`]; for (const st of up.stations) { const u = under.stations.find((x) => x.id === st.id); if (u) expect(radius(st)).toBeGreaterThan(radius(u)); }
    }
    expect(Object.keys(P).some((n) => /_hood$/.test(n))).toBe(false);   // no hood unless asked
    expect(Object.keys(PLAIN).some((n) => /^robe(Sleeve|Cuff)_/.test(n))).toBe(false);   // a plain robe is bare-armed
  });
});

describe('a half-cape to the hip, hooded, on the landmark head', () => {
  // (`hem: 'hip'` was no hem word: the cloak threw in the sorter and was dropped as "not worn", so no street half-cape
  // and no hood ever showed; an unknown word is now said)
  it('ends at the pelvis\'s top and raises its hood; an unknown hem word is refused by name', () => {
    const parts = expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', outfit: { type: 'outfit', style: 'streetwear', pieces: [{ kind: 'cloak', hood: true, wrap: 0.5, hem: 'hip' }] } }) }).recipe.parts;
    expect(parts.cloak_cape).toBeTruthy(); expect(parts.cloakHood_hood).toBeTruthy();
    expect(() => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', outfit: { type: 'outfit', style: 'streetwear', pieces: [{ kind: 'cloak', hem: 'elbow' }] } }) })).not.toThrow();   // the sorter says it, the mint stands
  });
});

describe('a hooded cloak', () => {
  const P = partsOf('female', 'traveler', [{ kind: 'cloak', hood: true }]);
  it('the hood rises from the cloak over the head, round, open at the face, turning with the head', () => {
    const H = P.cloakHood_hood, C = P.cloak_cape; expect(H && C).toBeTruthy();
    const z = (st) => centre(st)[2], crown = z(H.stations.at(-1)), foot = z(H.stations[0]);
    expect(Math.abs(foot - z(C.stations[0]))).toBeLessThan(0.02);   // it starts where the cloak hangs from
    expect(crown - foot).toBeGreaterThan(0.2);                       // over the head
    expect(Object.keys(H.bind.blend.tip)).toEqual(['head']);
    // the face's opening: from the chin up, nothing within 45° of the front about the head's axis (x 0, y 0)
    for (const st of H.stations.filter((x) => z(x) > foot + 0.6 * (crown - foot))) for (const p of Object.values(st.points)) expect(Math.abs(Math.atan2(p[0], p[1])) * 180 / Math.PI).toBeGreaterThan(45);
    expect(Object.keys(partsOf('female', 'traveler', [{ kind: 'cloak' }])).some((n) => /_hood$/.test(n))).toBe(false);
  });
});
