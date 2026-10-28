// hero-realistic.test.js — the realistic form at the hero door: `form: 'realistic'` slices the hero's body onto the form
// field (body-relational.js) once its plan is a recipe, dialled by a `physique` stored with its laws; absent, the hero
// as it was; what the realistic body does not wear yet refuses by name. (Beside the slice, not in the critical tier: a
// realistic mint takes seconds.)
import { describe, it, expect } from 'vitest';
import { compileLayered, auditLayered } from './station-loft.js';
import { ONE_SKIN_RUNGS } from './hero-one-skin.js';

import { heroDermisSpec } from '../epidermis/dermal-hero.js';
import { heroRecord, expandLayeredManifest, planLayered, HERO_FORMS, REALISTIC_LAWS_VERSION, withRolledFace, withFaceFit, realisticFaceOf, heroReadout, heroPlanOf, validateHeroSpec, adultsOnly, ROLLED_ETHNICITIES, HERO_FACE } from '../../mcp/tools/layered.js';
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
  }, 240_000);   // (two realistic mints and a physique re-sliced: about two minutes on a four-core machine)

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
    for (const k of ['headSkin', 'mouth', 'globeR', 'globeL']) expect(lost.parts[k], k).toBeUndefined();
    expect(lost.parts.neck && lost.parts.torso && lost.parts.footR).toBeTruthy();
    const bust = carve('roman-bust');
    expect(bust.statue.crop).toBe('bust'); expect(bust.parts.headSkin && bust.parts.globeR && bust.parts.torso).toBeTruthy();
    expect(Object.keys(bust.parts).filter((k) => /upperArm|pelvis|thigh/.test(k))).toEqual([]);
  }, 240_000);

  it('dressed, wears its whole head: the parts of the face the plan has no name for kept, the fit its skin maps back by', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: ['fittedShirt'] }) }).recipe;
    // (the one skin, realistic laws 2: hero-one-skin.js)
    for (const k of ['headSkin', 'mouth', 'globeR', 'globeL', 'earR', 'earL']) expect(r.parts[k], k).toBeTruthy();
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
    // (and the mint stamps the face's own fit, solved for its relations)
    expect(Object.keys(op.value.face.fit.tune).length).toBeGreaterThan(0); expect(op.value.face.fit.of).toMatch(/^[0-9a-f]{16}$/);
    // (refused by name; a child asked of the realistic body is the stylized figure, its realistic face left off)
    expect(validateHeroSpec({ form: 'realistic', face: { want: { chin: 'square' } } })).toEqual([expect.stringMatching(/face.want.chin: one of/)]);
    expect(validateHeroSpec({ form: 'realistic', face: { ethnicity: ['western'] } })[0]).toMatch(/face.ethnicity/);
    expect(validateHeroSpec({ form: 'realistic', face: { tilt: 1 } })[0]).toMatch(/face.tilt: not a realistic face's word/);
    // (the scalp's cut by word: a style, a groom on one, or none; a cut it cannot read refused by name)
    for (const scalp of ['long', { style: 'ponytail', spacing: 0.02 }, 'none']) expect(validateHeroSpec({ form: 'realistic', face: { scalp } })).toEqual([]);
    expect(validateHeroSpec({ form: 'realistic', face: { scalp: 'mohican' } })[0]).toMatch(/^face\.scalp: unknown style 'mohican'/);
    expect(adultsOnly({ form: 'realistic', cast: 'child', face: { seed: 2 } }).face).toBeUndefined();
  }, 240_000);
  it('wears its face\'s hair: the beard (its locks under the lip on the jaw), the brows and the lashes, in the hair\'s own colour over the plan\'s', () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'male', face: { seed: 1, ethnicity: 'western' } }) });
    const P = m.recipe.parts, A = auditLayered(compileLayered(m.recipe, m.dials));
    for (const k of ['hairBeard', 'hairBrows', 'hairLashes', 'hairCap', 'hairBeardCoat', 'hairBeardCoatJaw']) { expect(P[k]?.pin.parent, k).toBe('headSkin'); expect(A[k].pass, k).toBe(true); }
    // (realistic laws 10: the scalp's locks over a shell; the short beard its sculpted coat with the moustache's band on it
    // and nothing hanging; the brows a band each; every one ONE colour, no root band)
    expect(P.hair.group).toBe('Hair'); expect(P.hairCap.group).toBe('Hair'); expect(P.hairBeardCoat.group).toBe('Beard'); expect(P.hairBeard.group).toBe('Beard'); expect(P.hairBrows.group).toBe('Brow');
    expect(Object.keys(m.recipe.palette).filter((k) => /Root$/.test(k))).toEqual([]);
    // (clipped hair, a stubble's and a fade's foot, the skin's paint: the recipe says where, dermal-texture.js)
    expect(m.recipe.hairClip.beard).toBe(true);
    // (a hero minted under laws 9 keeps its blades and their coat in the root's colour)
    const was = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'male', physique: { from: 'athletic', laws: 9 }, face: { seed: 1, ethnicity: 'western' } }) }).recipe.parts;
    expect(was.hairCap.group).toBe('HairRoot'); expect(was.hairBeardCoat.group).toBe('BeardRoot'); expect(was.hair.cardUV).toBeTruthy();
    // (the jaw's beard rides a face the jaw alone carries; the moustache's the head)
    expect(P.hairBeardCoatJaw.pin.face).not.toBe(P.hairBeardCoat.pin.face);
    // (one person's hair: the scalp's, the beard's and the brows' colours from the face's, over the plan's defaults)
    expect(m.recipe.palette.Beard).toBe(m.recipe.palette.Hair); expect(m.recipe.palette.Brow).toBe(m.recipe.palette.Hair);
    expect(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'male', palette: { Hair: '#ff0000' }, face: { seed: 1, ethnicity: 'western' } }) }).recipe.palette.Hair).toBe('#ff0000');
    // (the hair's register by word, 0 … 1; out of range refused by name)
    expect(validateHeroSpec({ form: 'realistic', face: { stylize: 1 } })).toEqual([]);
    expect(validateHeroSpec({ form: 'realistic', face: { stylize: 2 } })[0]).toMatch(/^face\.stylize: 0/);
  }, 480_000);
  it('drawn for a target: its rings its own (no split), so it compiles whole; the target reads its hair\'s rung', () => {
    const at = (target) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'male', ...(target ? { target } : {}) }) });
    const m = at('1080p'), bare = at(null);
    expect(m.recipe.parts.torso.slots).toEqual(bare.recipe.parts.torso.slots);
    const A = auditLayered(compileLayered(m.recipe, m.dials));
    expect(Object.entries(A).filter(([, a]) => a && a.pass === false).map(([k]) => k)).toEqual([]);
    // (the head's BUDGET on the target's rung, realistic laws 2: a 1080p third-person head is ~50 px tall, L0; its skin,
    // its globes and its hair's coats lighter, the whole head under half the untargeted one's)
    const faces = (r, re) => { const C = compileLayered(r.recipe, r.dials); return C.faces.filter((t) => re.test(C.provenance[t[0]].part)).length; };
    const HEAD = /^(headSkin|globe[RL]|mouth|ear[RL]|hair\w*|jewel\w*)$/;
    expect(m.recipe.headFit.skinFaces).toBe(ONE_SKIN_RUNGS.L0.faces); expect(bare.recipe.headFit.skinFaces).toBeUndefined();
    expect(faces(m, /^headSkin$/)).toBeLessThan(ONE_SKIN_RUNGS.L0.faces * 1.15);
    expect(faces(m, HEAD)).toBeLessThan(faces(bare, HEAD) / 2);
  }, 300_000);
  it('its face\'s own fit: worn while it is the fit of its words, the pole\'s once they change', () => {
    const spec = withFaceFit({ form: 'realistic', cast: 'male', face: { seed: 4, ethnicity: 'western' } });
    const own = realisticFaceOf(heroRecord(spec)), pole = realisticFaceOf(heroRecord({ ...spec, face: { seed: 4, ethnicity: 'western' } }));
    expect(own.tune).toEqual(spec.face.fit.tune); expect(pole.tune).toBeUndefined();
    // (a stamp for other words is not worn: the face's words changed since it was solved)
    expect(realisticFaceOf(heroRecord({ ...spec, face: { ...spec.face, seed: 5 } })).tune).toBeUndefined();
    const fitted = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }).recipe;
    expect(fitted.headFit.tune).toEqual(spec.face.fit.tune);
    expect(validateHeroSpec({ form: 'realistic', face: { fit: { tune: { zz: 1 }, of: 'x' } } })[0]).toMatch(/face.fit/);
  }, 300_000);
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
  }, 240_000);
  it('its face shapes its head and lies under its skin: the composed relations on the relational head, the ancestry\'s tone, the hero\'s own skin over it', () => {
    const at = (face, extra = {}) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'male', ...(face ? { face } : {}), ...extra }) }).recipe;
    const plain = at(null), a = at({ seed: 1, ethnicity: 'african' }), b = at({ seed: 2, ethnicity: 'african' });
    expect(a.parts.headSkin).not.toEqual(plain.parts.headSkin); expect(a.parts.headSkin).not.toEqual(b.parts.headSkin);
    expect(a.headFit.relations).toBeTruthy(); expect(plain.headFit.relations).toBeUndefined();
    // (the ancestry's deep tone, unless the hero's skin or palette names one)
    expect(a.dermis.tone).toBeGreaterThanOrEqual(6); expect(a.dermis.undertone).toBeTruthy();
    expect(at({ seed: 1, ethnicity: 'african' }, { skin: { tone: 2 } }).dermis.tone).toBe(2);
    // (four heroes minted whole under laws 10, their hair and their face's hair grown: ~6 minutes on one core)
  }, 480_000);
  it('wears its face\'s piercings and its scalp: pinned to the skin, closed, in their colours; no piercings where the face rolled none', () => {
    const at = (face) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast: 'female', ...(face ? { face } : {}) }) });
    const m = at({ seed: 6, ethnicity: 'western' }), P = m.recipe.parts, C = realisticFaceOf(heroRecord({ form: 'realistic', cast: 'female', face: { seed: 6, ethnicity: 'western' } }));
    expect(C.piercings.length).toBeGreaterThan(0);
    expect(P.jewel.pin.parent).toBe('headSkin');
    expect(m.recipe.palette[P.jewel.group]).toMatch(/^#[0-9a-f]{6}$/);
    const A = auditLayered(compileLayered(m.recipe, m.dials));
    expect(A.jewel.pass).toBe(true);
    // (and its scalp: the cut's cards on the head, closed, in the hair's colour)
    expect(P.hair.pin.parent).toBe('headSkin'); expect(A.hair.pass).toBe(true);
    expect(m.recipe.palette.Hair).toMatch(/^#[0-9a-f]{6}$/);
    // (a face that rolled no piercings, and a hero with no face, wear none)
    expect(Object.keys(at(null).recipe.parts).some((k) => /^(jewel|hair)/.test(k))).toBe(false);
    expect(Object.keys(at({ seed: 2, ethnicity: 'western' }).recipe.parts).some((k) => /^jewel/.test(k))).toBe(false);
  }, 300_000);
});

describe('the man\'s hips (realistic laws 9)', async () => {
  const { coreMeasures, CORE_BANDS } = await import('./hero-core-measures.js');
  const read = (spec) => { const hero = heroRecord({ form: 'realistic', head: 'none', ...spec }), m = expandLayeredManifest({ kind: 'layered', hero }), J = m.recipe.rig.joints;
    return { core: coreMeasures(heroPlanOf(hero), compileLayered(m.recipe, m.dials)), hipX: (J.hipR.at ?? J.hipR)[0] }; };
  it('brings a man\'s hip sockets in, out of the woman\'s band; laws 8 as it was, a woman as she is', () => {
    const now = read({ cast: 'male' }), before = read({ cast: 'male', physique: { from: 'athletic', laws: 8 } });
    expect(now.hipX).toBeLessThan(before.hipX * 0.9);
    expect(before.core.waistToHip).toBeLessThan(CORE_BANDS.female.waistToHip[1]);
    expect(now.core.waistToHip).toBeGreaterThan(CORE_BANDS.female.waistToHip[1] + 0.02);
    expect(now.core.hip_m).toBeLessThan(before.core.hip_m - 0.03);
    const her = read({ cast: 'female' }), herBefore = read({ cast: 'female', physique: { from: 'athletic', laws: 8 } });
    expect(her.hipX).toBe(herBefore.hipX); expect(her.core).toEqual(herBefore.core);
  }, 120_000);
});
