// A beast-kin's detail as form (lib/graph/beast/detail.js, topology.js's abdomen): a crest of spines down the back and
// the tail, a ruff of tufts round the neck's root, an insect's abdomen on the tail's bones. Kins are chosen in code by the
// procedure they run.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig } from '../polygonizer/station-loft-rig.js';

const kinBy = (pred) => Object.entries(BEAST_KINS).find(([, c]) => pred(c))[0];
const RIDGED = kinBy((c) => c.ridge === 'spines' && c.tail !== 'none'), RUFFED = kinBy((c) => c.ruff === 'ruff'), GASTER = kinBy((c) => c.abdomen === 'gaster');
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const kin = (id, extra = {}) => mint({ cast: 'male', beast: { kin: id, ...extra } });
const parts = (p, re) => p.segments.filter((s) => re.test(s.name));
const tipOf = (p, s) => p.joints[s.to], rootOf = (p, s) => p.joints[s.from];

describe('a beast-kin\'s detail as form', () => {
  it('its ridge: flat spines up the neck, down the back\'s centre and the tail\'s top, each raked toward the tail on the bone it stands on', () => {
    const p = heroPlanOf(kin(RIDGED)), neck = parts(p, /^spineNeck/), back = parts(p, /^spineBack/), tail = parts(p, /^spineTail/);
    expect(neck.length).toBeGreaterThan(0); expect(back.length).toBeGreaterThan(2); expect(tail.length).toBeGreaterThan(0);
    for (const s of [...neck, ...back, ...tail]) {
      expect(rootOf(p, s)[0]).toBeCloseTo(0, 6); expect(tipOf(p, s)[0]).toBeCloseTo(0, 6);   // on the midline
      expect(s.rA[0]).toBeLessThan(s.rA[1] / 2);                                               // thin across, wide along
      expect(tipOf(p, s)[1]).toBeLessThan(rootOf(p, s)[1] + 0.02);                              // out behind or up, never forward
    }
    // (down the back in order, each riding the bone at its height; behind the trunk's back-centre)
    const z = back.map((s) => rootOf(p, s)[2]);
    for (let i = 1; i < z.length; i++) expect(z[i]).toBeLessThan(z[i - 1]);
    expect(new Set(back.map((s) => s.bind.bone))).toEqual(new Set(['torso', 'lumbar', 'pelvis'].filter((b) => back.some((s) => s.bind.bone === b))));
    expect(back[0].bind.bone).toBe('torso');
    for (const s of tail) expect(s.bind.bone).toMatch(/^tail\d$/);
    for (const s of back) expect(tipOf(p, s)[2]).toBeLessThan(rootOf(p, s)[2] + 1e-9);          // raked down toward the tail
  });

  it('its ruff: tufts round the back and the sides of the neck\'s root, hanging out and down, mirrored, riding the torso', () => {
    const p = heroPlanOf(kin(RUFFED)), tufts = parts(p, /^ruff/), hub = p.rig.joints.neckHub.at;
    expect(tufts.length).toBeGreaterThan(4);
    for (const s of tufts) {
      const a = rootOf(p, s), b = tipOf(p, s);
      expect(s.bind.bone).toBe('torso');
      expect(b[2]).toBeLessThan(a[2]);                     // hanging down
      expect(Math.abs(a[2] - hub[2])).toBeLessThan(0.15);  // at the neck's root
      expect(a[1]).toBeLessThan(hub[1] + 0.05);            // round the back and the sides, never across the throat
      expect(s.name.endsWith('R') ? s.mirror : 'mid').toBe(s.name.endsWith('R') ? 'name' : 'mid');
    }
  });

  it('an insect\'s abdomen: a full ovoid on the tail\'s bones, out behind the pelvis; a tail and an abdomen both refused', () => {
    const p = heroPlanOf(kin(GASTER)), g = p.segments.find((s) => s.name === 'tail'), J = p.joints;
    expect(g.kind).toBe('loft');
    const r = g.stations.map((st) => st.r), widest = Math.max(...r);
    expect(r.indexOf(widest)).toBeGreaterThan(0); expect(r.indexOf(widest)).toBeLessThan(r.length - 1);   // full in its middle
    expect(g.stations.at(-1).at[1]).toBeLessThan(J.hip[1]);                                                // behind
    expect(validateHeroSpec({ cast: 'male', beast: { kin: GASTER, tail: 'thin' } }).join()).toMatch(/tail or an abdomen/);
    expect(validateHeroSpec({ cast: 'male', beast: { kin: GASTER, tail: 'thin', abdomen: 'none' } })).toEqual([]);
  });

  it('the operator\'s words over the kin\'s: none takes each away, and an unknown word is refused', () => {
    expect(parts(heroPlanOf(kin(RIDGED, { ridge: 'none' })), /^spine/)).toEqual([]);
    expect(parts(heroPlanOf(kin(RUFFED, { ruff: 'none' })), /^ruff/)).toEqual([]);
    expect(heroPlanOf(kin(GASTER, { abdomen: 'none' })).segments.some((s) => s.name === 'tail')).toBe(false);
    expect(parts(heroPlanOf(kin(GASTER, { ridge: 'spines' })), /^spineBack/).length).toBeGreaterThan(0);   // any kin may carry them
    for (const [w, v] of [['ridge', 'fins'], ['ruff', 'mane'], ['abdomen', 'sting']]) expect(validateHeroSpec({ cast: 'male', beast: { kin: RIDGED, [w]: v } }).join()).toMatch(new RegExp(`beast.${w}`));
  });

  it('it binds and rigs whole with every detail on', () => {
    const H = kin(RIDGED, { ruff: 'ruff' }), { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero: H }), R = validateRig(recipe.rig);
    const mesh = compileLayered(recipe, dials), skin = bindLayered(mesh, recipe, R);
    const A = auditRig(mesh, skin, R);
    expect(A.badWeights).toBe(0); expect(A.restIdentity).toBeLessThan(1e-9);
  }, 60_000);
});
