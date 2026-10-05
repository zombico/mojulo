// hero-dress.test.js — the dragon's BODY DETAIL and ADORNMENT passes (station-loft-body.js, station-loft-adorn.js) on
// their second body, the hero, through the plan grammar's `body` / `adorn` blocks. The dragon's own byte identity and
// rules live with its examples (docs/examples/body-detail, docs/examples/adornment); these are the same rules here.
import { describe, it, expect } from 'vitest';
import { humanoidPlan } from './humanoid-plan.js';
import { heroPlan, REGISTERS } from './hero-form.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, auditRig, layeredClip } from './station-loft-rig.js';
import { detailBody, dominance, RIGID } from './station-loft-body.js';
import { justify, SIGNATURES } from './station-loft-adorn.js';
import { clothedBody, rangerKit, dressContext, dressPlan, validateDress, DETAIL_WORDS, KIT_WORDS } from './hero-dress.js';
import { refineSlot, clone } from './station-loft-detail.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n);
const dressed = (opts) => { const plan = humanoidPlan({ detail: 'clothed', adorn: 'ranger', ...opts }); const recipe = expandPlan(plan); return { plan, recipe, mesh: compileLayered(recipe) }; };
const cache = {}; const figure = (preset, register) => (cache[`${preset}/${register}`] ??= dressed({ preset, register }));

describe('absent is zero bytes', () => {
  it("no detail, no adornment, or 'none' for both: the plan and the recipe are the undressed hero's", () => {
    for (const preset of ['male', 'female']) {
      const plain = humanoidPlan({ preset });
      expect(humanoidPlan({ preset, detail: 'none', adorn: 'none' })).toEqual(plain);
      expect(JSON.stringify(expandPlan(humanoidPlan({ preset, detail: 'none' })))).toBe(JSON.stringify(expandPlan(plain)));
    }
    expect(dressPlan(heroPlan({ cast: 'male' }), {})).toEqual(heroPlan({ cast: 'male' }));
  });
});

describe('the passes on the second body: every register, both casts', () => {
  for (const preset of ['male', 'female']) for (const register of Object.keys(REGISTERS)) {
    it(`${preset} · ${register}: every part closes, the rig gates hold, every adornment justifies itself`, () => {
      const { plan, recipe, mesh } = figure(preset, register);
      expect(failures(mesh)).toEqual([]);
      const names = Object.keys(recipe.parts);
      expect(names.filter((n) => n.startsWith('tile.quiltFront.torso.')).length).toBeGreaterThan(8);   // both quilt panels grow
      expect(names.filter((n) => n.startsWith('tile.quiltBack.torso.')).length).toBeGreaterThan(8);
      expect(names.filter((n) => n.startsWith('adorn.')).length).toBeGreaterThanOrEqual(plan.adorn.length * 2);
      const R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R); for (const keys of Object.values(recipe.clips)) layeredClip(keys, R);
      const a = auditRig(mesh, skin, R, Object.values(recipe.clips).flat());
      expect(a.badWeights).toBe(0); expect(a.restIdentity).toBeLessThan(1e-9); expect(a.maxPlantedDrift).toBeLessThan(1e-9);
      for (const r of justify(mesh, plan.adorn.map((A) => ({ id: A.id, signature: A.signature.kind })))) expect(r.verdict, `${r.id}: exposed ${r.sigExposed}, share ${r.sigShare}`).toBe('justified');
    });
  }
  it('deterministic', () => {
    expect(JSON.stringify(dressed({ preset: 'female', register: 'lowpoly' }).recipe)).toBe(JSON.stringify(figure('female', 'lowpoly').recipe));
  });
  it('the part set never depends on a dial, and the detail closes at every dial extreme', () => {
    const { recipe } = figure('male', 'round'); const rest = Object.keys(compileLayered(recipe).parts);
    for (const [k, d] of Object.entries(recipe.dials)) for (const v of [d.min, d.max]) { if (!Number.isFinite(v)) continue; const m = compileLayered(recipe, { [k]: v });
      expect(Object.keys(m.parts)).toEqual(rest); expect(failures(m), `${k} ${v}`).toEqual([]); }
  });
});

describe('the rules the passes hold themselves to', () => {
  const plan = humanoidPlan({ preset: 'male' }); const src = expandPlan(plan); const body = clothedBody(dressContext(plan.style));
  const B = detailBody(src, body, {});
  it('rigid on rigid: every quilt tile sits where one bone dominates its whole footprint', () => {
    const tiles = Object.values(B.parts).filter((p) => p.rigidW !== undefined);
    expect(tiles.length).toBeGreaterThan(20);
    for (const t of tiles) { expect(t.rigidW).toBeGreaterThanOrEqual(RIGID - 1e-12); expect(t.bone).toBe('torso'); }
  });
  it('refinement extends the SKIN weights: a refined joint station is the blend of its neighbours', () => {
    const { recipe } = figure('male', 'round'); const b = recipe.parts.upperArmR.bind.blend;
    expect(b.st0_st1_50).toEqual({ torso: 0.25, upperArmR: 0.75 });
    // on the structured arm st2's neighbour is the biceps' shaping ring (hero-form ARM_FORM: st1_st2_<k>), which takes
    // the elbow's share by its u (refined: by u too); the ring refined between it and st2 is the blend of the two
    const biceps = Object.keys(b).filter((id) => /^st1_st2_\d+$/.test(id)).at(-1), ref = b[`${biceps}_st2_50`];
    expect(ref.foreArmR).toBeCloseTo((b[biceps].foreArmR + 0.5) / 2, 5); expect(ref.foreArmR + ref.upperArmR).toBeCloseTo(1, 5);
    expect(dominance(src.parts.torso)(2.5)).toEqual({ w: 1, bone: 'torso' });
  });
  it('the refined ring keeps its cyclic order on both halves (the left half mirrors the right)', () => {
    const P = B.r.parts.foreArmR; const half = P.slots.length / 2;
    const right = P.slots.slice(1, half), left = P.slots.slice(half + 1).reverse();
    expect(left).toEqual(right.map((s) => s.replace(/R$/, 'L')));
    const r = clone(src); refineSlot(r, 'shankR', 'front', 'front', 'x'); expect(r.parts.shankR.slots.at(-1)).toBe('xL');   // the wrap pair: after frontL, not before it
  });
  it('adornment is a separate layer: wearing it never changes the figure beneath', () => {
    const detail = expandPlan(humanoidPlan({ preset: 'female', register: 'lowpoly', detail: 'clothed', palette: figure('female', 'lowpoly').recipe.palette }));
    const worn = figure('female', 'lowpoly').recipe;
    for (const [k, p] of Object.entries(detail.parts)) expect(JSON.stringify(worn.parts[k]), k).toBe(JSON.stringify(p));
    expect(Object.keys(worn.parts).filter((k) => !(k in detail.parts)).every((k) => k.startsWith('adorn.'))).toBe(true);
  });
  it('a rigid adornment rides one bone: the pauldron the torso (the arm moves beneath it), the bracer its forearm', () => {
    const { recipe } = figure('male', 'round');
    expect(recipe.parts['adorn.pauldron'].pin.parent).toBe('torso'); expect(recipe.parts['adorn.pauldron.sig0'].pin).toEqual(recipe.parts['adorn.pauldron'].pin);
    expect(recipe.parts['adorn.bracer'].pin.parent).toBe('foreArmL');
  });
});

describe('the words and the refusals', () => {
  it('detail and adorn are a word, none, or data; anything else refuses by name', () => {
    expect(DETAIL_WORDS).toEqual(['clothed', 'swimsuit', 'none']); expect(KIT_WORDS).toEqual(['ranger', 'none']);
    expect(validateDress({ detail: 'clothed', adorn: rangerKit(dressContext({})) })).toEqual([]);
    expect(validateDress({ detail: 'armoured' })).toEqual([expect.stringMatching(/^detail: 'clothed' \| 'swimsuit' \| 'none'/)]);
    expect(validateDress({ adorn: { id: 'x' } })).toEqual([expect.stringMatching(/^adorn: 'ranger' \| 'none'/)]);
  });
  it('the plan grammar refuses a pass that names no part, a signature outside the library, and two tile windows that collide', () => {
    const plan = humanoidPlan({ preset: 'male' });
    expect(() => expandPlan({ ...plan, body: { volume: [['tail', {}, {}, 0.01]] } })).toThrow(/body\.volume\[0\]: 'tail' is not an L1 part/);
    const kit = rangerKit(dressContext(plan.style)); kit[0].signature.kind = 'tassel';
    expect(() => expandPlan({ ...plan, adorn: kit })).toThrow(new RegExp(`signature: \\{ kind: ${Object.keys(SIGNATURES).join(' \\| ')}`));
    const body = clothedBody(dressContext(plan.style)); body.tiles = body.tiles.map(({ id, ...t }) => t);
    expect(() => expandPlan({ ...plan, body })).toThrow(/grown twice — give each tile window on torso its own id/);
  });
  it('the tones follow the palette, and a tone the operator names wins', () => {
    const p = humanoidPlan({ preset: 'male', detail: 'clothed', adorn: 'ranger', palette: { Top: '#203040', Leather: '#111111' } }).palette;
    expect(p.Top).toBe('#203040'); expect(p.Leather).toBe('#111111'); expect(p.TopFold).not.toBe(humanoidPlan({ preset: 'male', detail: 'clothed', adorn: 'ranger' }).palette.TopFold);
    expect(humanoidPlan({ preset: 'male', adorn: 'ranger' }).palette.Top).toBe('#56683f');   // the kit's suggestion, beneath the operator's
  });
});

describe('the swimsuit and the chest layers', () => {
  const swim = (opts) => { const plan = humanoidPlan({ detail: 'swimsuit', ...opts }); const mesh = compileLayered(expandPlan(plan)); return { plan, mesh, groups: (re) => new Set(mesh.groups.filter((_, i) => re.test(mesh.faceIds[i]))) }; };
  it('the body bare: no clothing group is left, swimwear is painted on the trunk faces in its own tone', () => {
    for (const preset of ['male', 'female']) {
      const { plan, mesh, groups } = swim({ preset });
      for (const g of ['Top', 'Bottom', 'Shoes']) expect(mesh.groups, `${preset} ${g}`).not.toContain(g);
      expect(groups(/^pelvis\//).has('Swim')).toBe(true); expect(plan.palette.Swim).toMatch(/^#[0-9a-f]{6}$/);
      expect(failures(mesh)).toEqual([]);
    }
    expect(swim({ preset: 'male' }).groups(/^torso\//)).toEqual(new Set(['Skin']));   // the male's chest is bare
    const f = swim({ preset: 'female' });
    expect(f.groups(/^bust[RL]\//)).toEqual(new Set(['Skin', 'Swim'])); expect(f.groups(/^torso\//)).toEqual(new Set(['Skin', 'Swim']));
    const B = f.mesh.faceIds.map((id, i) => [id, f.mesh.groups[i]]).filter(([id]) => /^bustR\/st/.test(id));
    expect(B.filter(([id]) => /^bustR\/st2-st3\./.test(id)).every(([, g]) => g === 'Swim')).toBe(true);   // the lower pole: the cup
    expect(B.filter(([id]) => /^bustR\/st14-st15\./.test(id)).every(([, g]) => g === 'Skin')).toBe(true);   // the upper pole melts in as skin
    expect(swim({ preset: 'female', palette: { Swim: '#112233' } }).plan.palette.Swim).toBe('#112233');
  });
  it('a child-coded figure is never bare-chested: a rash vest over the torso', () => {
    const { groups } = swim({ preset: 'female', childCoded: true });
    expect([...groups(/^torso\/st[0-2]/)]).toEqual(['Swim']);
  });
  it('a jerkin covers the pectorals (dropped from the parts and the dials); a kit on the torso stands off the chest layers', () => {
    const { plan, recipe } = dressed({ preset: 'female' });
    expect(Object.keys(recipe.parts).some((n) => /^pectoral/.test(n))).toBe(false);
    for (const d of Object.values(plan.dials)) expect((d.parts || []).some((n) => /^pectoral/.test(n))).toBe(false);
    expect(plan.adorn.find((A) => A.id === 'baldric').over).toEqual(expect.arrayContaining(['bustR', 'bustL']));
    const bare = humanoidPlan({ preset: 'male', adorn: 'ranger' });
    expect(bare.adorn.find((A) => A.id === 'pauldron').over).toEqual(expect.arrayContaining(['upperArmR', 'pectoralR', 'pectoralL']));
  });
});
