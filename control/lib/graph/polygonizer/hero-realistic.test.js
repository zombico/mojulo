// hero-realistic.test.js — the realistic form at the hero door: `form: 'realistic'` slices the hero's body onto the form
// field (body-relational.js) once its plan is a recipe, dialled by a `physique` stored with its laws; absent, the hero
// as it was; what the realistic body does not wear yet refuses by name. (Beside the slice, not in the critical tier: a
// realistic mint takes seconds.)
import { describe, it, expect } from 'vitest';

import { heroDermisSpec } from '../epidermis/dermal-hero.js';
import { heroRecord, expandLayeredManifest, planLayered, HERO_FORMS, REALISTIC_LAWS_VERSION } from '../../mcp/tools/layered.js';
import { readDermis, skinBase } from '../epidermis/dermal-map.js';

const refused = (spec) => { try { heroRecord(spec); return null; } catch (e) { return e.message; } };

describe('the realistic hero at the door', () => {
  it('records the form and its physique with the laws; absent, nothing is stored', () => {
    expect(HERO_FORMS).toContain('realistic');
    expect(heroRecord({ cast: 'male' })).not.toHaveProperty('physique');
    expect(heroRecord({ cast: 'male', form: 'realistic' }).physique).toEqual({ from: 'athletic', laws: REALISTIC_LAWS_VERSION });
    expect(heroRecord({ cast: 'female', form: 'realistic', physique: 'jacked' }).physique).toEqual({ from: 'jacked', laws: REALISTIC_LAWS_VERSION });
    expect(heroRecord({ cast: 'male', form: 'realistic', physique: { from: 'skinny', height: 0.5 } }).physique).toEqual({ from: 'skinny', height: 0.5, laws: REALISTIC_LAWS_VERSION });
  });

  it('refuses by name what the realistic body does not take', () => {
    expect(refused({ cast: 'male', physique: 'jacked' })).toMatch(/physique: dials the realistic body/);
    expect(refused({ cast: 'male', form: 'realistic', physique: 'brawny' })).toMatch(/unknown physique 'brawny'/);
    expect(refused({ cast: 'male', form: 'realistic', physique: { bulk: 3 } })).toMatch(/outside/);
    expect(refused({ cast: 'male', form: 'realistic', head: 'anime' })).toMatch(/head: the realistic body/);
    expect(refused({ cast: 'male', form: 'realistic', detail: 'clothed' })).toMatch(/detail: not worn on the realistic body yet/);
    expect(refused({ cast: 'male', form: 'realistic', body: { waist: 0.2 } })).toMatch(/body: the realistic body's girths/);
    expect(refused({ cast: { pole: 'male', build: 'brute' }, form: 'realistic' })).toMatch(/cast: the realistic body/);
  });

  it('depicts adults: a child asked of it is the stylized western figure of that cast, its colours keyed the same', () => {
    const r = heroRecord({ cast: 'child', form: 'realistic', physique: 'lean', skin: { tone: 7 }, palette: { Hair: '#2a1d14' }, outfit: ['tee', 'trousers'] });
    expect(r.form).toBeUndefined(); expect(r.physique).toBeUndefined(); expect(r.skin).toBeUndefined();
    expect(r.cast).toBe('child'); expect(r.head).toBe('landmark');
    // (the skin's colour as the dermis reads its tone, the palette's own keys as given, the dress as asked)
    expect(r.palette).toEqual({ Hair: '#2a1d14', Skin: heroDermisSpec({ cast: 'male', skin: { tone: 7 } }).base });
    expect(r.outfit).toEqual(['tee', 'trousers']);
    // (the build form too, and a palette's own Skin stands)
    const b = heroRecord({ cast: { pole: 'female', build: 'child' }, form: 'realistic', skin: { tone: 3 }, palette: { Skin: '#e0b090' } });
    expect(b.form).toBeUndefined(); expect(b.palette.Skin).toBe('#e0b090');
    // (an adult stays realistic, and a cast the realistic body does not build is still refused by name)
    expect(heroRecord({ cast: 'female', form: 'realistic' }).form).toBe('realistic');
    expect(refused({ cast: 'brute', form: 'realistic' })).toMatch(/cast: the realistic body/);
  });

  it('mints: the body re-sampled (no pectoral parts, the correctives carried) and gated; a new physique re-slices', () => {
    const hero = heroRecord({ cast: 'male', form: 'realistic' }), m = expandLayeredManifest({ kind: 'layered', hero });
    expect(Object.keys(m.recipe.parts).filter((k) => /^(pectoral|bust)[RL]$/.test(k))).toEqual([]);
    expect(m.recipe.correctives?.length).toBeGreaterThan(0);
    expect(m.recipe.parts.torso.slots.length).toBe(48);
    expect(() => planLayered(m)).not.toThrow();
    // THE CONTRACT (docs/realistic-body.md): the station ids, the correctives' shape, the rig's additions
    for (const p of ['torso', 'neck', 'pelvis', 'upperArmR', 'thighR', 'shankR', 'footR', 'toesR']) for (const s of m.recipe.parts[p].stations) expect(s.id, p).toMatch(/^st\d+(_st\d+_\d{3})?$/);
    for (const c of m.recipe.correctives) {
      expect(c.driver.from).toBeLessThan(c.driver.full); expect(m.recipe.rig.joints[c.driver.joint]).toBeTruthy(); expect(m.recipe.rig.joints[c.driver.to]).toBeTruthy();
      for (const [k, v] of Object.entries(c.d)) { expect(k).toMatch(/^(torso|upperArm[RL])\/st[\w]+\.(front|back|s\d\d[RL])$/); expect(v).toHaveLength(3); }
    }
    expect(m.recipe.correctives.map((c) => c.id).sort()).toEqual(['pauldronBag', 'pauldronCap', 'pauldronDeltoid', 'shoulderLevel', 'shoulderOverhead'].flatMap((x) => [`${x}L`, `${x}R`]).sort());
    const bones = new Set(m.recipe.rig.bones.map((b) => b.id));
    for (const b of ['scapulaR', 'scapulaL', 'shoulderFoldR', 'kneeCreaseR', 'elbowCreaseL']) expect(bones.has(b), b).toBe(true);
    // the same hero again: the same recipe (from the kept slice)
    expect(JSON.stringify(expandLayeredManifest({ kind: 'layered', hero }).recipe)).toBe(JSON.stringify(m.recipe));
    // a physique patch moves the body
    const heavy = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', physique: 'heavyset' }) });
    const front = (r) => Math.max(...r.parts.torso.stations.map((s) => s.points.front[1]));
    expect(front(heavy.recipe)).toBeGreaterThan(front(m.recipe) + 0.02);
  }, 120_000);

  it('wears its skin: the door\'s `skin` (the palette\'s Skin its tone when it names none) on the recipe, the palette\'s Skin its base; refused by name', () => {
    expect(refused({ cast: 'male', skin: { tone: 7 } })).toMatch(/skin: the realistic body's skin.*add form: 'realistic'/);
    expect(refused({ cast: 'male', form: 'realistic', skin: { sex: 'female' } })).toMatch(/skin\.sex: the skin's sex is the cast's/);
    expect(refused({ cast: 'male', form: 'realistic', skin: { tone: 11 } })).toMatch(/skin: tone 11/);
    expect(refused({ cast: 'male', form: 'realistic', skin: { glow: 1 } })).toMatch(/skin: unknown dial 'glow'/);
    expect(refused({ cast: 'male', form: 'realistic', skin: { tone: 7 }, palette: { Skin: '#ffeedd' } })).toMatch(/skin\.tone and palette\.Skin both name/);
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', skin: { tone: 8, undertone: 'warm', freckles: 0.4 } }) }).recipe;
    expect(r.dermis).toEqual({ from: 'female', tone: 8, undertone: 'warm', freckles: 0.4 });
    expect(r.palette.Skin).toBe(skinBase(readDermis(r.dermis)));
    const p = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', palette: { Skin: '#8d5524' } }) }).recipe;
    expect(p.dermis.tone).toBe('#8d5524'); expect(p.palette.Skin).toBe('#8d5524');
    // undressed, the body wears its suit (Top, Bottom, Shoes); an outfit takes it off, the body under it skin, the feet shod
    expect(r.parts.torso.group).toBe('Top');
    const d = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: ['fittedTee'] }) }).recipe;
    for (const k of ['torso', 'pelvis', 'foreArmR', 'thighL']) expect(d.parts[k].group, k).toBe('Skin');
    expect(d.parts.footR.group).toBe('Shoes');
  }, 240_000);

  it('dressed, wears its whole head: the parts of the face the plan has no name for kept, the fit its skin maps back by', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: ['fittedShirt'] }) }).recipe;
    for (const k of ['cranium', 'jaw', 'visage', 'nose', 'eyeR', 'eyeL', 'earR', 'earL']) expect(r.parts[k], k).toBeTruthy();
    expect(r.headFit).toMatchObject({ sex: 'female' });
    for (const k of ['k', 'ty', 'men']) expect(Number.isFinite(r.headFit[k]), k).toBe(true);
  }, 120_000);
});
