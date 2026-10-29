// The relational creature head WORN on the tiered body (creature-heads/worn.js, beast/head.js creatureHeadPlan): the laws
// of the joint, on one wolf-kin. The word swaps the library head for one skin, its globes, a mouth and its ears; the neck
// ends on a ring the skin is sealed to point for point; the jaw bone carries the lower lip and the chin, never the crown;
// the rig's jaw sits on the head's own hinge and chin; the cover runs onto the skin and the ears; the word is refused
// by name when it names what is not; without it the kin keeps its library head.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest, validateHeroSpec } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { beastWords } from '../beast/tiered.js';
import { relationalHeadErrors } from '../beast/head.js';
import { coverMap } from '../beast/cover.js';
import { beastCoverStyleOf, beastCoatOf } from '../beast/cover.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { relationalCreatureHead } from './relational.js';

const spec = (beast) => withDefaultWalk(beastWords(withDefaultForm({ cast: 'female', beast })));
const mint = (beast) => { const hero = heroRecord(spec(beast)), { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }); return { hero, recipe, dials }; };
const W = { kin: 'lupine', head: { relational: 'wolf' } };

describe('the relational creature head, worn', () => {
  it('swaps the library head for one skin, its globes, a mouth and its ears; without the word the kin keeps its skull', () => {
    const { recipe } = mint(W), P = recipe.parts;
    for (const k of ['headSkin', 'mouth', 'globeR', 'globeL', 'earR', 'earL']) expect(P[k]?.mesh, k).toBeTruthy();
    for (const k of ['cranium', 'jaw', 'nape']) expect(P[k], k).toBeUndefined();
    expect(recipe.creatureHead.preset).toBe('wolf');
    const plain = mint({ kin: 'lupine' }).recipe.parts;
    expect(plain.cranium).toBeTruthy(); expect(plain.headSkin).toBeUndefined();
  }, 120_000);

  it('seals the skin to the neck\'s last ring: each of its points a point of the skin', () => {
    const { recipe } = mint(W), neck = recipe.parts.neck, top = neck.stations.at(-1), pts = Object.values(recipe.parts.headSkin.mesh.points);
    expect(neck.stations.length).toBeGreaterThanOrEqual(2);
    for (const s of neck.slots) { const q = top.points[s]; expect(Math.min(...pts.map((p) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))), s).toBeLessThan(1e-6); }
  }, 120_000);

  it('the jaw bone carries the lower lip and the chin, never the crown; the rig\'s jaw on the head\'s hinge and chin', () => {
    const { recipe } = mint(W), m = recipe.parts.headSkin.mesh, blend = recipe.parts.headSkin.bind.blend, F = recipe.creatureHead.fit;
    const jawOf = (id) => blend[`st0.${id}`]?.jaw ?? 0, ids = Object.keys(m.points), z = (id) => m.points[id][2];
    const H = relationalCreatureHead({ preset: 'wolf' }), hero = (p) => [p.x * F.k, p.y * F.k + F.ty, p.z * F.k + F.men];
    const gn = hero(H.points.gn), crown = hero(H.points.crown), sto = hero(H.points.sto);
    // (the chin's points the jaw's, the crown's the head's alone)
    const near = (q, r) => ids.filter((id) => Math.hypot(...m.points[id].map((x, i) => x - q[i])) < r);
    const chin = near(gn, 0.012), top = near(crown, 0.03);
    expect(chin.length).toBeGreaterThan(3); expect(top.length).toBeGreaterThan(3);
    expect(chin.every((id) => jawOf(id) > 0.5)).toBe(true);
    expect(top.every((id) => jawOf(id) === 0)).toBe(true);
    // (the lips parted: under the mouth's line at its front the jaw's, over it the head's)
    const front = ids.filter((id) => m.points[id][1] > sto[1] - 0.01 && Math.abs(m.points[id][0]) < 0.01);
    const lower = front.filter((id) => z(id) < sto[2] - 0.004 && z(id) > sto[2] - 0.02), upper = front.filter((id) => z(id) > sto[2] + 0.004);
    expect(lower.length).toBeGreaterThan(3); expect(upper.length).toBeGreaterThan(3);
    expect(lower.every((id) => jawOf(id) > 0.5)).toBe(true);
    expect(upper.every((id) => jawOf(id) < 0.5)).toBe(true);
    const J = recipe.rig.joints, at = (j) => (Array.isArray(J[j]) ? J[j] : J[j].at);
    expect(Math.hypot(...at('jawTip').map((x, i) => x - gn[i]))).toBeLessThan(1e-5);
    expect(recipe.rig.bones.some((b) => b.id === 'jaw' && b.head === 'jawHinge')).toBe(true);
  }, 120_000);

  it('the cover runs onto the skin and the ears (the box chart), not the eyes or the nose\'s pad', () => {
    const { hero, recipe, dials } = mint(W), mesh = compileLayered(recipe, dials), C = coverMap(mesh, recipe, null, beastCoverStyleOf(hero), beastCoatOf(hero));
    const partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part, hit = {};
    mesh.faces.forEach((_, fi) => { const u = C.uvAt(fi, 0), p = partOf(fi), g = mesh.groups[fi]; if (u[0] !== C.uvAt(-1, 0)[0] || u[1] !== C.uvAt(-1, 0)[1]) hit[`${p}:${g}`] = (hit[`${p}:${g}`] ?? 0) + 1; });
    expect(hit['headSkin:Skin']).toBeGreaterThan(1000); expect(hit['earR:Skin']).toBeGreaterThan(100);
    for (const k of Object.keys(hit)) expect(k).not.toMatch(/globe|NosePad|EarInner/);
  }, 120_000);

  it('teeth and gums: a row on each bone, all inside the shut skin, the canine the longest, the felid\'s fewer', () => {
    const { recipe } = mint(W), P = recipe.parts, F = recipe.creatureHead.fit;
    expect(P.teethU.bind).toBe('head'); expect(P.gumU.bind).toBe('head'); expect(P.teethL.bind).toBe('jaw'); expect(P.gumL.bind).toBe('jaw');
    const H = relationalCreatureHead({ preset: 'wolf', globes: false, ears: false }), fH = (q) => H.field({ x: q[0] / F.k, y: (q[1] - F.ty) / F.k, z: (q[2] - F.men) / F.k }) * F.k;
    const pts = [...Object.values(P.teethU.mesh.points), ...Object.values(P.teethL.mesh.points), ...P.gumU.stations.flatMap((st) => Object.values(st.points)), ...P.gumL.stations.flatMap((st) => Object.values(st.points))];
    expect(pts.length).toBeGreaterThan(500);
    expect(Math.max(...pts.map(fH))).toBeLessThan(0);
    // (each tooth's length, root to tip, by its tip's id: the canines the longest of each row)
    for (const row of [P.teethU, P.teethL]) {
      const m = row.mesh.points, tips = Object.keys(m).filter((k) => k.endsWith('tip')), len = (t) => { const i = t.slice(0, -3); return Math.hypot(...m[`${i}tip`].map((x, j) => x - m[`${i}base`][j])); };
      expect(tips.length).toBe(18);
      const sorted = [...tips].sort((a, b) => len(b) - len(a)), x = (t) => m[t][0];
      expect(Math.sign(x(sorted[0]))).toBe(-Math.sign(x(sorted[1])));   // (the two longest a pair, one either side)
    }
    const cat = mint({ kin: 'feline', head: { relational: 'felid' } }).recipe.parts;
    expect(Object.keys(cat.teethU.mesh.points).filter((k) => k.endsWith('tip')).length).toBe(12);
  }, 180_000);

  it('refuses a skull or a relation it does not know, by name', () => {
    expect(relationalHeadErrors({ relational: 'shark' }).join()).toMatch(/wolf \| felid/);
    expect(relationalHeadErrors({ relational: 'wolf', relations: { snout: 1 } }).join()).toMatch(/relations\.snout/);
    expect(relationalHeadErrors({ relational: 'felid', relations: { pupil: 'square' } }).join()).toMatch(/'round' \| 'slit'/);
    expect(relationalHeadErrors({ relational: 'felid', relations: { dentition: 'shark' } }).join()).toMatch(/'canid' \| 'felid'/);
    expect(validateHeroSpec({ cast: 'female', beast: W })).toEqual([]);
  });
});
