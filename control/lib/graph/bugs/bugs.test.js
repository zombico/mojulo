import { describe, it, expect } from 'vitest';
import { BUG_SPECIES, bugPlan, bugParams, resolveBug, traitsOf, assembleBug, buildBug } from './species.js';
import { piece, SHAPES } from './pieces.js';
import { LEG_FORMS, ORDER_PRIORS } from './forms.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../polygonizer/station-loft.js';

const mesh = (plan) => compileLayered(expandPlan(plan));
const signedVolume = (p) => { let v = 0; for (const f of Object.values(p.faces)) { const [a, b, c] = f.map((k) => p.points[k]);
  v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); } return v / 6; };

describe('bug builder', () => {
  it('every worked bug is deterministic, closed, wound outward, grounded, its feet planted and its length exact', () => {
    for (const id of Object.keys(BUG_SPECIES)) {
      expect(JSON.stringify(bugPlan(id))).toBe(JSON.stringify(bugPlan(id)));   // recipes, not renders
      const { plan, readout } = assembleBug(bugParams(id)), M = mesh(plan), L = readout.length;
      expect(Object.entries(auditLayered(M)).filter(([, r]) => !r.pass).map(([n]) => n), id).toEqual([]);
      expect(Object.entries(M.parts).filter(([, p]) => signedVolume(p) <= 0).map(([n]) => n), id).toEqual([]);
      expect(Math.abs(Math.min(...M.vertices.map((v) => v[2]))), id).toBeLessThanOrEqual(0.01 * L);
      const ys = (n) => Object.values(M.parts[n].points).map((p) => p[1]);
      expect(Math.abs(Math.max(...ys(M.parts.head ? 'head' : 'trunk')) - Math.min(...ys('tail')) - L) / L, id).toBeLessThan(0.01);
      for (const g of readout.legs.filter((x) => x.ground)) for (const s of ['R', 'L']) {
        const z = Math.min(...Object.entries(M.parts).filter(([n]) => new RegExp(`^leg${g.pair}(Tarsus\\d+|Claw\\d+)${s}$`).test(n)).flatMap(([, p]) => Object.values(p.points).map((q) => q[2])));
        expect(Math.abs(z), `${id} leg ${g.pair}${s}`).toBeLessThanOrEqual(0.02 * L);
      }
    }
  });

  it('pieces: carrot, banana, chili and bulb are closed and outward at any bend, flatness and size', () => {
    for (const shape of Object.keys(SHAPES)) for (const [bend, flat, r] of [[0, 1, 0.01], [0.3, 0.4, 0.002], [-0.2, 0.7, 3e-6]]) {
      const plan = { schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' }, joints: {}, dials: {}, segments: [piece('p', [0, 0, 0.1], [0.05, 0.08, 0.12], { shape, r, flat, bend, toward: [0, 0, 1], group: 'G' })] };
      const M = mesh(plan); expect(auditLayered(M).p.pass, `${shape} ${bend} ${flat}`).toBe(true); expect(signedVolume(M.parts.p)).toBeGreaterThan(0);
    }
  });

  it('parts are shared by form, not by family: the bee and the fly stand on the same leg, the grasshopper wears the jumper', () => {
    expect(traitsOf(BUG_SPECIES.honeyBee).legs).toBe('walker');
    expect(traitsOf(BUG_SPECIES.houseFly).legs).toBe('walker');
    expect(traitsOf(BUG_SPECIES.grasshopper).hindLegs).toBe('jumper');
    for (const id of Object.keys(BUG_SPECIES)) { const t = traitsOf(BUG_SPECIES[id]); for (const k of ['legs', 'foreLegs', 'hindLegs']) expect(LEG_FORMS[t[k]], `${id} ${k}`).toBeDefined(); }
  });

  it('the trunk repeats: leg pairs follow segments × legsPer', () => {
    expect(assembleBug(bugParams('honeyBee')).readout.legPairs).toBe(3);
    expect(assembleBug(bugParams('gardenSpider')).readout.legPairs).toBe(4);
    expect(assembleBug(bugParams('greenCrab')).readout.legPairs).toBe(5);
    expect(assembleBug(bugParams('woodlouse')).readout.legPairs).toBe(7);
    expect(assembleBug(bugParams('centipede')).readout.legPairs).toBe(15);
    expect(assembleBug(bugParams('millipede')).readout.legPairs).toBeGreaterThan(50);
  });

  it('resolves a bug nobody has built to the closest worked one, wearing the asked forms', () => {
    const wasp = resolveBug({ order: 'Hymenoptera', traits: { tail: 'gaster' }, length: 0.018 });
    expect(wasp.basis).toBe('honeyBee'); expect(wasp.bauplan.tail).toBe('gaster'); expect(wasp.bauplan.length).toBe(0.018);
    expect(wasp.bauplan.extras.map((x) => x.kind)).toEqual(['sting']);
    expect(BUG_SPECIES[resolveBug({ order: 'Astacidea', length: 0.09 }).basis].order).toBe('Astacidea');   // a worked bug of the order wins
    const crayfish = resolveBug({ order: 'Astacidea', like: 'greenCrab', length: 0.09 });   // forced basis: the order's forms worn over it
    expect(crayfish.basis).toBe('greenCrab'); expect(crayfish.bauplan.trunk).toBe('cylinder'); expect(crayfish.bauplan.extras.map((x) => x.kind)).toEqual(['fan']);
    expect(resolveBug({ order: 'Coleoptera', traits: { hindLegs: 'jumper' } }).bauplan.legs.hind.form).toBe('jumper');
    expect(resolveBug({ like: 'grasshopper', traits: { antennae: 'whip' } }).basis).toBe('grasshopper');
    for (const order of Object.keys(ORDER_PRIORS)) { const r = resolveBug({ order }); const M = mesh(buildBug(r.bauplan));
      expect(Object.values(auditLayered(M)).every((x) => x.pass), order).toBe(true); }
    expect(() => resolveBug({ order: 'Dragons' })).toThrow(/order 'Dragons'/);
    expect(() => resolveBug({ like: 'unicorn' })).toThrow(/not a worked bug/);
  });

  it('top-level legs keys are defaults for every pair, under the role and pair overrides', () => {
    const B = bugParams('honeyBee'), base = JSON.stringify(buildBug(B));
    const withYaw = buildBug({ ...B, legs: { ...B.legs, yaw: 0 } });
    expect(JSON.stringify(withYaw)).not.toBe(base);
    // a role's own value wins over the shared default
    const roles = { ...B.legs, fore: { ...(B.legs.fore || {}), yaw: 20 }, mid: { ...(B.legs.mid || {}), yaw: -6 }, hind: { ...(B.legs.hind || {}), yaw: -40 } };
    expect(JSON.stringify(buildBug({ ...B, legs: { ...roles, yaw: 77 } }))).toBe(JSON.stringify(buildBug({ ...B, legs: roles })));
  });

  it('the jumping leg folds along its own flank: no hind foot crosses the midline', () => {
    const M = mesh(bugPlan('grasshopper'));
    for (const [n, p] of Object.entries(M.parts)) if (/^leg2(Tibia|Tarsus\d+|Claw\d+)R$/.test(n)) expect(Math.min(...Object.values(p.points).map((q) => q[0])), n).toBeGreaterThan(0);
  });

  it('opt-in knobs build closed and grounded: neck + forelegs on it, trunk pitch, fine wings with veins, flush elytra, a belly, leg turns', () => {
    const variants = [
      { ...bugParams('prayingMantis'), neck: { len: 0.25, pitch: 40 }, legs: { ...bugParams('prayingMantis').legs, fore: { ...bugParams('prayingMantis').legs.fore, on: 'neck', at: 0.8 } } },
      { ...bugParams('dragonfly'), trunk: { ...bugParams('dragonfly').trunk, pitch: 25 } },
      { ...bugParams('monarch'), wings: { ...bugParams('monarch').wings, pairs: bugParams('monarch').wings.pairs.map((w) => ({ ...w, slots: 'ring20', stations: 14 })) }, markings: [{ on: 'wingFore', kind: 'veins', count: 6, group: 'Vein', color: '#111' }] },
      { ...bugParams('ladybird'), tail: { ...bugParams('ladybird').tail, belly: 0.4 }, wings: { pairs: [{ ...bugParams('ladybird').wings.pairs[0], seam: 0.2, stations: 16, slots: 'ring20' }] } },
      { ...bugParams('greenCrab'), legs: { ...bugParams('greenCrab').legs, fore: { ...bugParams('greenCrab').legs.fore, turn: { tarsus: -70 } } } },
      // unequal claws: a fiddler-crab left cheliped twice the size
      { ...bugParams('greenCrab'), legs: { ...bugParams('greenCrab').legs, fore: { ...bugParams('greenCrab').legs.fore, left: { reach: 2 } } } },
    ];
    for (const B of variants) { const { plan, readout } = assembleBug(B), M = mesh(plan);
      expect(Object.entries(auditLayered(M)).filter(([, r]) => !r.pass).map(([n]) => n), B.name).toEqual([]);
      expect(Math.abs(Math.min(...M.vertices.map((v) => v[2]))), B.name).toBeLessThanOrEqual(0.01 * readout.length); }
    expect(buildBug(variants[0]).segments.some((g) => g.name === 'neck')).toBe(true);
    expect(buildBug(variants[2]).paint.filter((p) => p.group === 'Vein')).toHaveLength(6);
    // the unequal pair is built per side; its left leg reaches further from the body than its right
    const ux = (side) => { const M = mesh(buildBug(variants[5])); return Math.max(...Object.entries(M.parts).filter(([n]) => new RegExp(`^leg0.*${side}$`).test(n)).flatMap(([, q]) => Object.values(q.points).map((v) => Math.hypot(...v)))); };
    expect(ux('L')).toBeGreaterThan(ux('R') * 1.2);
  });

  it('absent opt-ins add nothing: no markings, no paint', () => {
    const B = bugParams('honeyBee'); delete B.markings; expect(buildBug(B).paint).toBeUndefined();
    expect(() => buildBug({ ...bugParams('honeyBee'), legs: { form: 'hexapus' } })).toThrow(/legs\[0\] form 'hexapus'/);
  });
});
