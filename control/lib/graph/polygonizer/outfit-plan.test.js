// outfit-plan.test.js — the outfit catalogue's cloth pieces worn on a hero (designed `pieces`): a robe's sleeves and a
// cloak's hood are the garment kernel's pieces (body-garment.js), on the hero's own landmarks. One hero per procedure.
import { describe, expect, it } from 'vitest';
import { heroRecord, heroPlanOf, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileOutfit } from './outfit-plan.js';
import { compileLayered } from './station-loft.js';

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
  // (the bell a row stamped with outfit laws 1 keeps; under laws 2 the hood is draped: mcp/tools/hero-hood.test.js)
  const P = expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime', outfit: { type: 'outfit', style: 'traveler', laws: 1, pieces: [{ kind: 'cloak', hood: true }] } }) }).recipe.parts;
  it('outfit laws 1: the hood rises from the cloak over the head, round, open at the face, turning with the head', () => {
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

describe('a robe\'s bodice and sleeves name their parts as a card\'s pieces do (outfit laws 2)', () => {
  // (2026-11-14: laws 1 named a bare part string, which the realistic body's tailor (body-relational-wear.js reads a
  // one-item list) passed by, so the bodice was drawn on the skin and the card's shirt over it; laws 2 name a list, and
  // the tailor makes them a layer over the shirt. The game body reads either alike)
  const plan = (laws) => ((B) => compileOutfit({ ...B, outfit: { laws, pieces: [{ kind: 'robe', sleeve: 'long' }] } }))(heroPlanOf(heroRecord({ cast: 'female', outfit: { type: 'outfit', style: 'adventurer', pieces: [] } })));
  const of = (P, id) => P.garments.find((g) => g.id === id)?.part;
  it('laws 2: a one-item list each; laws 1: the bare name', () => {
    const two = plan(2), one = plan(1);
    for (const [id, part] of [['robeBodice', 'torso'], ['robeSleeve', 'upperArm'], ['robeCuff', 'foreArm']]) { expect(of(two, id), id).toEqual([part]); expect(of(one, id), id).toBe(part); }
  });
});

describe('a skirt\'s hem work lies on its hem (outfit laws 2)', () => {
  // (2026-11-14: laws 1 read the hem work's window as shares of every ring of the skirt, the hem turned up inside it
  // counted too, so it landed on the lining at the knees, standing 2–20 cm off the cloth that shows. Laws 2 address it on
  // the outer rings, st0 the waist … st11 the hem, in the skirt's own `u`)
  const robe = (laws) => ({ cast: 'female', register: 'round', outfit: { type: 'outfit', style: 'adventurer', laws, pieces: [{ kind: 'robe', trim: { hem: 'embroidery' } }] } });
  const kitOf = (laws) => compileOutfit({ ...heroPlanOf(heroRecord(robe(laws))), outfit: { laws, pieces: [{ kind: 'robe', trim: { hem: 'embroidery' } }] } }).adorn.find((A) => A.id === 'robeHemWork');
  it('laws 2: on the skirt\'s outer rings just above its hem, in its own u; laws 1 as it was', () => {
    const two = kitOf(2), one = kitOf(1);
    expect(two).toMatchObject({ part: 'robeSkirt_skirt', share: false }); expect(two.s[0]).toBeGreaterThan(8); expect(two.s[1]).toBeLessThan(11);
    expect(one).toMatchObject({ part: 'robeSkirt_skirt', share: true, s: [0.82, 0.97] });
  });
  it('the work lies on the cloth at the hem: within the 2.5 cm it must lie within to ride the flowing skirt', () => {
    const recipe = expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(robe(2)) }).recipe, mesh = compileLayered(recipe), V = mesh.vertices, part = (i) => mesh.provenance[i].part;
    const skirt = V.filter((_, i) => part(i) === 'robeSkirt_skirt'), work = V.filter((_, i) => /^adorn\.robeHemWork\./.test(part(i)));
    expect(work.length).toBeGreaterThan(20);
    const zs = skirt.map((p) => p[2]), lo = Math.min(...zs), hi = Math.max(...zs);
    for (const p of work) expect(p[2], 'in the lowest fifth of the skirt').toBeLessThan(lo + 0.2 * (hi - lo));
    // (its distance to the skirt's outer surface: the radius there round the skirt's axis, at its height and bearing)
    const S = recipe.parts.robeSkirt_skirt, outer = S.stations.filter((st) => (st.u ?? 0) <= 11), c = [0, 1].map((k) => skirt.reduce((t, p) => t + p[k], 0) / skirt.length);
    const rAt = (p) => { const th = Math.atan2(p[0] - c[0], p[1] - c[1]); let best = null, bd = Infinity;
      for (const st of outer) for (const q of Object.values(st.points)) { const d = Math.abs(q[2] - p[2]) + 0.3 * Math.abs(Math.atan2(Math.sin(Math.atan2(q[0] - c[0], q[1] - c[1]) - th), Math.cos(Math.atan2(q[0] - c[0], q[1] - c[1]) - th))); if (d < bd) { bd = d; best = Math.hypot(q[0] - c[0], q[1] - c[1]); } } return best; };
    const off = work.map((p) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - rAt(p))).sort((a, b) => a - b);
    expect(off[Math.floor(off.length / 2)], 'the median off the cloth').toBeLessThan(0.025);
  });
});

describe('a medallion hangs over the bodice (outfit laws 2)', () => {
  // (2026-11-14: the chain was laid on the body's own chest, so a tunic's bodice drawn over it hid the pendant; laws 2
  // clear the close cloth worn on the chest, and lie the chain at the neck's root behind)
  const recipeOf = (laws) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'stout', register: 'round', outfit: { type: 'outfit', style: 'adventurer', laws, pieces: [{ kind: 'tunic', sleeve: 'long' }, { kind: 'medallion' }] } }) }).recipe;
  const read = (laws) => { const mesh = compileLayered(recipeOf(laws)), V = mesh.vertices, part = (i) => mesh.provenance[i].part;
    const pendant = V.filter((_, i) => /^adorn\.medallionPendant\./.test(part(i))), bodice = V.filter((_, i) => part(i) === 'tunicBodice_torso');
    const z = pendant.reduce((t, p) => t + p[2], 0) / pendant.length, front = Math.max(...bodice.filter((p) => Math.abs(p[2] - z) < 0.03 && Math.abs(p[0]) < 0.05).map((p) => p[1]));
    return { n: pendant.length, mid: pendant.reduce((t, p) => t + p[1], 0) / pendant.length, front }; };
  it('the pendant stands in front of the tunic\'s bodice at its height (laws 1 leave a hero\'s necklace off)', () => {
    const two = read(2);
    expect(two.n).toBeGreaterThan(8); expect(two.mid, 'its middle before the bodice').toBeGreaterThan(two.front + 0.002);
    expect(read(1).n).toBe(0);
  });
});

describe('gloves', () => {
  it('paint the hands and the fingers the body has the glove\'s colour, a cuff at each wrist', () => {
    const plan = heroPlanOf(heroRecord({ cast: 'male', head: 'anime', outfit: { type: 'outfit', style: 'adventurer', pieces: [{ kind: 'gloves' }] } }));
    const C = compileOutfit(plan), P = C.paint.find((x) => [x.part].flat().includes('hand'));
    const has = new Set(plan.segments.map((s) => s.name.replace(/[RL]$/, '')));
    expect([P.part].flat().every((n) => has.has(n))).toBe(true);
    expect(C.adorn.filter((A) => /^glove[RL]$/.test(A.id)).map((A) => A.part).sort()).toEqual(['foreArmL', 'foreArmR']);
    const bare = compileOutfit(heroPlanOf(heroRecord({ cast: 'male', head: 'anime', outfit: { type: 'outfit', style: 'adventurer', pieces: [{ kind: 'gloves', cuff: false }] } })));
    expect(bare.adorn.some((A) => /^glove/.test(A.id))).toBe(false);
  });
});
