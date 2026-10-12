process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import { tieredGarments, tieredKit } from './tiered-form.js';
import { heroRecord, heroPlanOf, createLayeredPlanHandler } from '@/lib/mcp/tools/layered';

// the tiered form's dress: garments over the bridges and split with their parts, a kit over the joints
const planOf = (spec) => heroPlanOf(heroRecord({ cast: 'female', form: 'tiered', ...spec }));
const ids = (plan) => plan.garments.map((g) => g.id);

describe('tiered dress: garments', () => {
  it('a garment covering both limbs of a joint covers its bridge, worn just after the upper piece', () => {
    const plan = planOf({ outfit: ['shirt', 'trousers'] });
    expect(ids(plan)).toContain('shirtSleeveElbow');
    expect(ids(plan)).toContain('trousersLegKnee');
    expect(ids(plan).indexOf('shirtSleeveElbow')).toBe(ids(plan).indexOf('shirtSleeve') + 1);
    expect(plan.garments.find((g) => g.id === 'shirtSleeveElbow')).toMatchObject({ part: ['elbowBridge'], group: 'Top' });
    // the cuff stops short of the wrist: no wrist piece
    expect(ids(plan).some((id) => /Wrist$/.test(id))).toBe(false);
  });

  it('a short sleeve leaves the elbow bare, and another form wears its garments as written', () => {
    expect(ids(planOf({ outfit: ['tee', 'trousers'] })).some((id) => /Elbow$/.test(id))).toBe(false);
    const plain = heroPlanOf(heroRecord({ cast: 'female', outfit: ['shirt', 'trousers'] }));
    expect(plain.garments.some((g) => /(Elbow|Knee)$/.test(g.id))).toBe(false);
  });

  it('a garment joins every refine entry that names its part', () => {
    const plan = planOf({ outfit: ['shirt', 'trousers'], target: '1080p' });
    const refined = new Set(plan.body.refine.flatMap((e) => e.parts));
    for (const p of ['thighR', 'thighL', 'torso']) if (refined.has(p)) for (const g of plan.garments.filter((x) => !x.fit && x.part.some((n) => n === p.replace(/[RL]$/, '') || n === p))) expect(refined.has(`${g.id}_${p}`), `${g.id}_${p}`).toBe(true);
    expect(tieredGarments({ segments: [] })).toEqual({ segments: [] });
  });

  it('a compiled garment has its part\'s sides and stations at every target', async () => {
    for (const target of ['720p', '1080p']) {
      const hero = heroRecord({ cast: 'female', form: 'tiered', outfit: ['shirt', 'trousers'], target });
      let recipe; await createLayeredPlanHandler({ plan: heroPlanOf(hero), hero, title: 't', ref: `td_${target}` }, { onPlanned: (p) => { recipe = p.recipe; } });
      for (const [g, host] of [['shirt_torso', 'torso'], ['shirtSleeve_upperArmR', 'upperArmR'], ['trousersLeg_thighR', 'thighR'], ['shirtSleeveElbow_elbowBridgeR', 'elbowBridgeR'], ['trousersLegKnee_kneeBridgeR', 'kneeBridgeR']]) {
        expect(recipe.parts[g].slots.length, `${target} ${g}`).toBe(recipe.parts[host].slots.length);
      }
    }
  }, 300_000);
});

describe('tiered dress: a kit over the joints', () => {
  const plan = planOf({});
  it('a piece over a joint stands off its bridge and rides it; an authored pin is kept', () => {
    const [couter, poleyn, pinned] = tieredKit([
      { id: 'upperArmR-couter', part: 'upperArmR', over: ['foreArmR'], side: 'R', s: [1.6, 2], t: [2, 4], rigid: true },
      { id: 'thighL-poleyn', part: 'thighL', over: ['shankL'], side: 'L', s: [3.45, 4], t: [0, 2.2], rigid: true },
      { id: 'thighR-tasset', part: 'thighR', over: ['shankR'], side: 'R', s: [0.1, 1.4], t: [0, 2], rigid: true, pin: [0.4, 0.8, 'R', 'torso'] },
    ], plan);
    expect(couter.over).toEqual(['foreArmR', 'elbowBridgeR']);
    expect(couter.pin[3]).toBe('elbowBridgeR');
    expect(couter.pin.slice(1, 3)).toEqual([3, 'R']);
    expect(poleyn.over).toEqual(['shankL', 'kneeBridgeL']);
    expect(poleyn.pin[3]).toBe('kneeBridgeL');
    expect(pinned.pin).toEqual([0.4, 0.8, 'R', 'torso']);
  });

  it('what the torso or the neck carries stands off the shoulders\' balls', () => {
    const [gorget, pauldron, greave] = tieredKit([
      { id: 'neck-gorget', part: 'neck', over: ['torso'] },
      { id: 'torso-pauldronR', part: 'torso', over: ['upperArmR'] },
      { id: 'shankR-greave', part: 'shankR' },
    ], plan);
    expect(gorget.over).toEqual(['torso', 'shoulderBallR', 'shoulderBallL']);
    expect(pauldron.over).toEqual(['upperArmR', 'shoulderBallR', 'shoulderBallL']);
    expect(greave.over).toBeUndefined();
  });
});
