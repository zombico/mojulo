import { describe, it, expect } from 'vitest';
import { motionSpec, createAnimalHandler } from '@/lib/mcp/tools/animal';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { resolveLayeredDials } from '@/lib/graph/polygonizer/station-loft';
import { planLayered } from '@/lib/mcp/tools/layered';
import { speciesPlan } from '@/lib/graph/fauna/species';
import { withMotion } from '@/lib/graph/fauna/rig';
import { expandPlan } from '@/lib/graph/polygonizer/station-loft-plan';

// `motion` on a species mint: read as its gaits, refused with the species' own list, gated at mint.
describe('animal motion', () => {
  it('reads true, a word, a list and { gaits, keys }', () => {
    expect(motionSpec('wolf', undefined)).toBeNull();
    expect(motionSpec('wolf', false)).toBeNull();
    expect(motionSpec('wolf', true)).toEqual({ gaits: ['walk', 'trot', 'gallop'], keys: 24 });
    expect(motionSpec('wolf', 'all')).toEqual({ gaits: ['walk', 'trot', 'gallop'], keys: 24 });
    expect(motionSpec('wolf', 'trot')).toEqual({ gaits: ['trot'], keys: 24 });
    expect(motionSpec('elephant', ['walk', 'amble'])).toEqual({ gaits: ['walk', 'amble'], keys: 24 });
    expect(motionSpec('snake', { gaits: 'slither', keys: 12 })).toEqual({ gaits: ['slither'], keys: 12 });
  });

  it('reads behavior words beside gait words, `behaviors: all`, and variants', () => {
    expect(motionSpec('wolf', ['trot', 'relax'])).toEqual({ gaits: ['trot'], keys: 24, behaviors: ['relax'] });
    expect(motionSpec('wolf', 'sleep')).toEqual({ gaits: [], keys: 24, behaviors: ['sleep'] });
    expect(motionSpec('sheep', { behaviors: 'all', keys: 12 })).toEqual({ gaits: [], keys: 12, behaviors: ['relax', 'alert', 'eat', 'sleep'] });
    expect(motionSpec('raccoon', { gaits: 'walk', behaviors: ['relax'], variants: { relax: 'curl' } })).toEqual({ gaits: ['walk'], keys: 24, behaviors: ['relax'], variants: { relax: 'curl' } });
    expect(() => motionSpec('fruitBat', 'sleep')).toThrow(/not posed yet.*'fruitBat' moves: .*; does: none posed yet/);
    expect(() => motionSpec('raccoon', { behaviors: 'relax', variants: { relax: 'graze' } })).toThrow(/its ways: sit-up, curl/);
  });

  it('the mint gate checks the behaviors and reports them as clips', () => {
    const plan = withMotion(speciesPlan('horse'), 'horse', ['walk'], 24, { behaviors: ['sleep'] });
    const { stats } = planLayered({ kind: 'layered', plan, recipe: expandPlan(plan) });
    expect(stats.layered.rig).toMatchObject({ species: 'horse', clips: ['walk', 'sleep'] });
    const bad = { ...plan, motion: { ...plan.motion, behaviors: ['dance'] } };
    expect(() => planLayered({ kind: 'layered', plan: bad, recipe: expandPlan(bad) })).toThrow(/animal motion: no behavior 'dance'/);
  });

  it('the World plays a behavior-only motion as the figure\'s clips', async () => {
    const plan = withMotion(speciesPlan('sheep'), 'sheep', [], 8, { behaviors: ['relax', 'eat'] }), recipe = expandPlan(plan);
    const m = { kind: 'layered', recipe, plan, dials: resolveLayeredDials(recipe.dials || {}, {}), units: 'm' };
    const { payload } = await resolveWorldScene({ ref: 's', title: 's', manifest: m });
    expect(Object.keys(payload.figures.body.clips)).toEqual(['relax', 'eat']);
    expect(payload.figures.body.preview.clips).toEqual(['relax', 'eat']);
  });

  it("refuses a gait the species does not have, naming the ones it does", () => {
    expect(() => motionSpec('elephant', 'gallop')).toThrow(/'elephant' moves: walk, amble/);
    expect(() => motionSpec('wolf', { keys: 2 })).toThrow(/keys/);
  });

  it('the mint gate binds the species and reports its rig', () => {
    const plan = withMotion(speciesPlan('horse'), 'horse', ['walk', 'gallop']);
    const { stats } = planLayered({ kind: 'layered', plan, recipe: expandPlan(plan) });
    expect(stats.layered.rig).toMatchObject({ species: 'horse', clips: ['walk', 'gallop'] });
    expect(stats.layered.rig.bones).toBeGreaterThan(20);
    expect(stats.layered.rig.blendedVertices).toBeGreaterThan(0);
  });

  it('a still species carries no rig', () => {
    const plan = speciesPlan('horse');
    expect(planLayered({ kind: 'layered', plan, recipe: expandPlan(plan) }).stats.layered.rig).toBeUndefined();
  });

  it('a species carved: its layered manifest carries the statue, the World carves it on a base; never with motion', async () => {
    await expect(createAnimalHandler({ title: 't', species: 'wolf', statue: true, motion: 'trot' })).rejects.toThrow(/statue stands still/);
    await expect(createAnimalHandler({ title: 't', species: 'wolf', statue: 'lion' })).rejects.toThrow(/carved as sculpture/);
    const plan = speciesPlan('wolf'), recipe = expandPlan(plan);
    const plain = { kind: 'layered', recipe, plan, dials: resolveLayeredDials(recipe.dials || {}, {}), units: 'm' };
    const faces = async (m) => (await resolveWorldScene({ ref: 'w', title: 'w', manifest: m })).payload.faces.filter((f) => !f.studio);
    const a = await faces(plain), b = await faces({ ...plain, statue: { type: 'statue', material: 'bronze' } });
    expect(a.some((f) => f.group === 'base' || f.pbr)).toBe(false);   // absent: the wolf as it was
    const base = b.filter((f) => f.group === 'base'), body = b.filter((f) => f.group !== 'base');
    expect(base.length).toBeGreaterThan(0);
    expect(body.every((f) => f.pbr && f.pbr[0] === 1)).toBe(true);   // every face the bronze
  });
});
