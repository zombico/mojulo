// hero-realistic.test.js — the realistic form at the hero door: `form: 'realistic'` slices the hero's body onto the form
// field (body-relational.js) once its plan is a recipe, dialled by a `physique` stored with its laws; absent, the hero
// as it was; what the realistic body does not wear yet refuses by name. (Beside the slice, not in the critical tier: a
// realistic mint takes seconds.)
import { describe, it, expect } from 'vitest';

import { heroDermisSpec } from '../epidermis/dermal-hero.js';
import { heroRecord, expandLayeredManifest, planLayered, HERO_FORMS, REALISTIC_LAWS_VERSION, withRolledFace, realisticFaceOf, heroReadout, heroPlanOf, validateHeroSpec, adultsOnly, ROLLED_ETHNICITIES, HERO_FACE } from '../../mcp/tools/layered.js';
import { heroRemakeOps } from '../../mcp/tools/hero-mint.js';
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
    expect(refused({ cast: 'male', form: 'realistic', detail: 'clothed' })).toMatch(/detail: the authored body's own clothing.*dressed by an outfit/);
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

  it('carved: a statue in one material, no skin; a lost head takes the realistic head\'s face with it; a bust without the arms\' stumps', () => {
    const carve = (statue) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', statue }) }).recipe;
    const lost = carve({ type: 'statue', style: 'archaic', lose: ['head'] });
    expect(new Set(Object.values(lost.palette)).size).toBe(1); expect(lost.dermis).toBeUndefined();
    for (const k of ['cranium', 'jaw', 'visage', 'nose', 'eyeR']) expect(lost.parts[k], k).toBeUndefined();
    expect(lost.parts.neck && lost.parts.torso && lost.parts.footR).toBeTruthy();
    const bust = carve('roman-bust');
    expect(bust.statue.crop).toBe('bust'); expect(bust.parts.visage && bust.parts.nose && bust.parts.torso).toBeTruthy();
    expect(Object.keys(bust.parts).filter((k) => /upperArm|pelvis|thigh/.test(k))).toEqual([]);
  }, 240_000);

  it('dressed, wears its whole head: the parts of the face the plan has no name for kept, the fit its skin maps back by', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: ['fittedShirt'] }) }).recipe;
    for (const k of ['cranium', 'jaw', 'visage', 'nose', 'eyeR', 'eyeL', 'earR', 'earL']) expect(r.parts[k], k).toBeTruthy();
    expect(r.headFit).toMatchObject({ sex: 'female' });
    for (const k of ['k', 'ty', 'men']) expect(Number.isFinite(r.headFit[k]), k).toBe(true);
  }, 120_000);

  it('its face: rolled at mint where nothing bounds it, bounded by what is named, kept on a remake; refused by name', () => {
    // (nothing decided: the seed, the ethnicity and the sex rolled and stamped)
    const bare = withRolledFace({ form: 'realistic' });
    expect(Number.isInteger(bare.face.seed)).toBe(true); expect(ROLLED_ETHNICITIES).toContain(bare.face.ethnicity); expect(['male', 'female']).toContain(bare.cast);
    // (named words bound the roll: the cast and the ethnicity kept, a want carried)
    const named = withRolledFace({ form: 'realistic', cast: 'female', face: { ethnicity: 'latin', want: { eyes: 'almond' } } });
    expect(named).toMatchObject({ cast: 'female', face: { ethnicity: 'latin', want: { eyes: 'almond' } } }); expect(Number.isInteger(named.face.seed)).toBe(true);
    // (another form, or the landmark head, rolls nothing; a remake keeps its stamped face and the cast it came with)
    for (const spec of [{ form: 'tiered' }, { form: 'realistic', head: 'landmark' }]) expect(withRolledFace(spec)).toBe(spec);
    expect(withRolledFace({ form: 'realistic' }, { face: { seed: 9, ethnicity: 'african' }, cast: 'female' })).toEqual({ form: 'realistic', face: { seed: 9, ethnicity: 'african' }, cast: 'female' });
    const [op] = heroRemakeOps({ spec: { form: 'realistic', physique: 'jacked' } }, { hero: { form: 'realistic', cast: 'female', face: { seed: 9, ethnicity: 'african' } } });
    expect(op.value).toMatchObject({ cast: 'female', face: { seed: 9, ethnicity: 'african' } });
    // (refused by name; a child asked of the realistic body is the stylized figure, its realistic face left off)
    expect(validateHeroSpec({ form: 'realistic', face: { want: { chin: 'square' } } })).toEqual([expect.stringMatching(/face.want.chin: one of/)]);
    expect(validateHeroSpec({ form: 'realistic', face: { ethnicity: ['western'] } })[0]).toMatch(/face.ethnicity/);
    expect(validateHeroSpec({ form: 'realistic', face: { tilt: 1 } })[0]).toMatch(/face.tilt: not a realistic face's word/);
    expect(adultsOnly({ form: 'realistic', cast: 'child', face: { seed: 2 } }).face).toBeUndefined();
  });
  it('its face composed on every read: the heroic baseline, the readout\'s roll, a mix of ethnicities', () => {
    const hero = heroRecord({ form: 'realistic', cast: 'female', face: { seed: 3, ethnicity: 'east-asian', want: { nose: 'button' } } });
    expect(hero.face).toEqual({ seed: 3, ethnicity: 'east-asian', want: { nose: 'button' } });
    const F = realisticFaceOf(hero);
    expect(F.picks.nose).toBe('button'); expect(F).toEqual(realisticFaceOf({ ...hero }));
    expect(realisticFaceOf({ ...hero, face: { ...hero.face, beauty: HERO_FACE.beauty } }).relations).toEqual(F.relations);
    const ro = heroReadout(hero, heroPlanOf(hero), null, []).realisticFace;
    expect(ro).toMatchObject({ words: hero.face, ethnicity: 'east-asian', picks: F.picks, ancestry: F.ancestry });
    expect(realisticFaceOf({ ...hero, face: { seed: 3, ethnicity: ['western', 'african'] } }).hybrid).toBeTruthy();
    expect(realisticFaceOf({ form: 'realistic', head: 'relational', cast: 'male' })).toBeNull();
  });
  it('its face shapes its head and lies under its skin: the composed relations on the relational head, the ancestry\'s tone, the hero\'s own skin over it', () => {
    const at = (face, extra = {}) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'male', ...(face ? { face } : {}), ...extra }) }).recipe;
    const plain = at(null), a = at({ seed: 1, ethnicity: 'african' }), b = at({ seed: 2, ethnicity: 'african' });
    expect(a.parts.visage).not.toEqual(plain.parts.visage); expect(a.parts.visage).not.toEqual(b.parts.visage);
    expect(a.headFit.relations).toBeTruthy(); expect(plain.headFit.relations).toBeUndefined();
    // (the ancestry's deep tone, unless the hero's skin or palette names one)
    expect(a.dermis.tone).toBeGreaterThanOrEqual(6); expect(a.dermis.undertone).toBeTruthy();
    expect(at({ seed: 1, ethnicity: 'african' }, { skin: { tone: 2 } }).dermis.tone).toBe(2);
  }, 300_000);
});
