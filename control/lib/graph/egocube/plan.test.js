import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { planFromSheet, shade } from './plan.js';
import { LINEAGES, HUMAN_IDS } from './ancestry.js';
import { HEAD_LIBRARY, HEAD_IDS, headPlan, headFor } from '../creature-heads/index.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { validateHead, headFromPlan } from '../polygonizer/station-loft-head.js';
import { validateHeroSpec } from '@/lib/mcp/tools/layered.js';

describe('the creature head library', () => {
  it('holds heads that read as plan data, each serving its people', () => {
    for (const id of HEAD_IDS) {
      const plan = headPlan(id);
      expect(() => validateHead(plan), id).not.toThrow();
      expect(() => headFromPlan(plan), id).not.toThrow();
      expect(plan.landmarks.nape, id).toHaveLength(3);
      for (const lineage of HEAD_LIBRARY[id].serves) expect(LINEAGES[lineage], `${id} serves ${lineage}`).toBeTruthy();
    }
  });
  it('hands out a fresh copy, a palette over the head\'s own, and a head per people', () => {
    const a = headPlan('wolf'), b = headPlan('wolf', { palette: { Skull: '#ffffff' } });
    expect(b.palette.Skull).toBe('#ffffff');
    expect(a.palette.Skull).not.toBe('#ffffff');
    expect(headPlan('wolf').palette.Skull).toBe(a.palette.Skull);
    expect(headFor('lupine')).toEqual({ id: 'wolf', provisional: false });
    expect(headFor('feline')).toEqual({ id: 'wolf', provisional: true });
    expect(headFor('avian')).toBe(null);
    expect(() => headPlan('cat')).toThrow(/unknown head 'cat'.*wolf/);
    expect(() => headPlan('wolf', { palette: { Skull: 'white' } })).toThrow(/#rrggbb/);
  });
});

describe('planFromSheet', () => {
  it('compiles every people into a call its door accepts (seeds 1–2; the deep sweep takes 1–10) into a call its door accepts', () => {
    for (const anc of [...Object.keys(LINEAGES), ...HUMAN_IDS]) for (let seed = 1; seed <= 2; seed++) {
      const sheet = rollEgocube({ seed, facets: { ancestry: anc } }), p = planFromSheet(sheet);
      expect(p.door, `${anc} ${seed}`).toBe(sheet.ancestry.door);
      if (p.door === 'creature') {
        expect(p.create.as).toBe('creature');
        expect(() => expandPlan(p.create.spec.plan), `${anc} seed ${seed}`).not.toThrow();
      } else {
        expect(p.create.as).toBe('hero');
        expect(validateHeroSpec(p.create.spec), `${anc} seed ${seed}`).toEqual([]);
      }
    }
  }, 60000);
  it('writes the Pale Warden\'s thesis from its roll, as it was written by hand', () => {
    const p = planFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'lupine' } }));
    expect(p.thesis).toBe('barrel · digitigrade biped, leaning forward · long muzzle (wolf) · a ruff of fur at the neck and shoulders · 2 m');
    const plan = p.create.spec.plan;
    expect(plan.heads[0].plan.name).toBe('wolf');
    expect(plan.body.tiles.map((t) => t.id)).toEqual(['ruff', 'ruffNeck', 'forearm', 'thigh', 'tail']);
    expect(plan.adorn.map((a) => a.id)).toEqual(expect.arrayContaining(['belt', 'cord', 'pack', 'satchelR', 'satchelL', 'wrapR', 'wrapL']));
    expect(plan.adorn.filter((a) => a.signature.group === 'Emblem')).toHaveLength(1);
    expect(p.after).toEqual([{ op: 'set', path: '/dials/lean', value: 18 }]);
  });
  it('wears the named library head, else the people\'s, else none and says so', () => {
    const dragon = planFromSheet(rollEgocube({ facets: { ancestry: 'draconic', humanity: 0.2 } }));
    expect(dragon.thesis).toMatch(/long snout \(dragon\)/);
    const bear = planFromSheet(rollEgocube({ facets: { ancestry: 'ursine', humanity: 0.3 } }));
    expect(bear.thesis).toMatch(/short muzzle \(bear\)/);
    const cat = planFromSheet(rollEgocube({ facets: { ancestry: 'feline', humanity: 0.4 } }));
    expect(cat.thesis).toMatch(/\(wolf, provisional\)/);
    const bird = planFromSheet(rollEgocube({ facets: { ancestry: 'avian', humanity: 0.3 } }));
    expect(bird.thesis).toMatch(/head pending \(the dragon stands in\)/);
    expect(bird.ledger.filter((r) => r.channel === 'structure').every((r) => /no library head for avian yet: the dragon head stands in/.test(r.pending))).toBe(true);
  });
  it('scales a head authored in metres with its horns on it, and strips a stand-in to a neutral skull', () => {
    const dragon = planFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'draconic' } })).create.spec.plan.heads[0].plan;
    expect(dragon.ornaments.filter((o) => o.name === 'horn').map((o) => o.space)).toEqual(['head']);
    expect(dragon.units.scale).toBeLessThan(1);
    const bird = planFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'avian' } })).create.spec.plan.heads[0].plan;
    expect(bird.ornaments.some((o) => o.name === 'horn')).toBe(false);
    expect(bird.midline).toBeUndefined();
  });
  it('lands every note once, in the call or as pending with a reason', () => {
    for (const [anc, seed] of [['lupine', 3], ['draconic', 5], ['european', 2], ['infernal', 4]]) {
      const sheet = rollEgocube({ seed, facets: { ancestry: anc } }), p = planFromSheet(sheet);
      expect(p.ledger).toHaveLength(Object.values(sheet.notes).flat().length);
      for (const r of p.ledger) expect(Boolean(r.at) !== Boolean(r.pending), `${anc} ${r.line}`).toBe(true);
    }
    const tiefling = planFromSheet(rollEgocube({ seed: 4, facets: { ancestry: 'infernal' } }));
    expect(tiefling.door).toBe('hero');
    expect(tiefling.ledger.find((r) => /horns/.test(r.line)).pending).toMatch(/hero grammar/);
  });
  it('is pure: the same sheet, the same call', () => {
    const sheet = rollEgocube({ seed: 7, facets: { ancestry: 'draconic' } });
    expect(JSON.stringify(planFromSheet(sheet))).toBe(JSON.stringify(planFromSheet(sheet)));
  });
  it('takes the hero door\'s amounts from the sheet\'s directions, inside the channel ranges', () => {
    const p = planFromSheet(rollEgocube({ brief: 'a weary paladin' }));
    expect(p.create.spec.expression.browTilt).toBeGreaterThan(0);
    expect(p.create.spec.gesture).toBe('guard');
    expect(shade('#808080', 0.5)).toBe('#c0c0c0');
    expect(shade('#808080', -0.5)).toBe('#404040');
  });
});
