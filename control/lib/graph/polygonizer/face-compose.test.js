import { describe, it, expect } from 'vitest';

import { RELATION_POLES } from './head-relational.js';
import { BROW_SHAPES } from '../epidermis/epidermis.js';
import { composeFace, FACE_SHAPES, FACE_FEATURES, FACE_BUCKETS, FACE_PROPORTIONS, FACE_LIMITS, FACE_GROOMS, FACE_NOSE, FACE_HAIRLINE, FACE_HAIR, FACE_GROOM_SEX, FACE_HAIR_MALE, FACE_BEARD, HYBRID_TRAITS, LID_FOLD } from './face-compose.js';
import { EYE_SHAPES } from '../epidermis/dermal-looks.js';
import { readDermis } from '../epidermis/dermal-map.js';
import { readScalp } from '../epidermis/dermal-hair.js';

describe('the face composer', () => {
  it('is deterministic: the same seed composes the same face', () => {
    expect(composeFace({ seed: 7 })).toEqual(composeFace({ seed: 7 }));
  });
  it('composes different faces from different seeds, every one over the pole', () => {
    const faces = Array.from({ length: 24 }, (_, i) => composeFace({ seed: i + 1 }));
    const kinds = new Set(faces.map((f) => JSON.stringify(f.picks)));
    expect(kinds.size).toBeGreaterThan(12);
    for (const f of faces) for (const k of Object.keys(RELATION_POLES.female)) expect(Number.isFinite(f.relations[k])).toBe(true);
  });
  it('takes the shapes nearest its character, and an accent from far off', () => {
    // (each feature's shape nearest a corner of the plane, taken from the table: the composer must favour it there)
    const corner = [1, -1];
    const nearest = (f) => Object.entries(FACE_SHAPES[f]).sort(([, a], [, b]) => Math.hypot(a.at[0] - corner[0], a.at[1] - corner[1]) - Math.hypot(b.at[0] - corner[0], b.at[1] - corner[1]))[0][0];
    const hits = Object.fromEntries(FACE_FEATURES.map((f) => [f, 0]));
    for (let s = 1; s <= 40; s++) { const face = composeFace({ seed: s, character: corner, accent: false }); for (const f of FACE_FEATURES) hits[f] += face.picks[f] === nearest(f) ? 1 : 0; }
    for (const f of FACE_FEATURES) expect(hits[f]).toBeGreaterThan(20);
    const accented = composeFace({ seed: 3, character: corner, accent: 'chin' }), at = FACE_SHAPES.chin[accented.picks.chin].at;
    expect(Math.hypot(at[0] - corner[0], at[1] - corner[1])).toBeGreaterThanOrEqual(1);
  });
  it('rolls its tone and hair from its bucket\'s ancestries, and refuses what it does not know', () => {
    expect(FACE_BUCKETS.western.ancestry).toContain(composeFace({ seed: 2 }).ancestry);
    expect(() => composeFace({ bucket: 'nowhere' })).toThrow(/bucket/);
    expect(() => composeFace({ accent: 'ears' })).toThrow(/accent/);
  });

  it('sets a bucket\'s base before its rolls, and keeps the rolls within it', () => {
    const B = FACE_BUCKETS['east-asian'].base, pole = RELATION_POLES.female;
    for (let seed = 1; seed <= 12; seed++) {
      const f = composeFace({ bucket: 'east-asian', seed });
      // (a relation only the base moves lands on the pole plus the base; one the proportions roll stays within their reach)
      expect(f.relations.forehead).toBeCloseTo(pole.forehead + B.forehead, 9);
      expect(Math.abs(f.relations.cephalic - (pole.cephalic + B.cephalic))).toBeLessThanOrEqual(FACE_PROPORTIONS.cephalic + 1e-9);
      for (const [k, [lo, hi]] of Object.entries(FACE_LIMITS)) { expect(f.relations[k]).toBeGreaterThanOrEqual(lo); expect(f.relations[k]).toBeLessThanOrEqual(hi); }
    }
  });
  it('rolls a lid cover where the bucket has one, and the cover owns the fold', () => {
    const lids = FACE_BUCKETS['east-asian'].lids;
    for (let seed = 1; seed <= 16; seed++) {
      const f = composeFace({ bucket: 'east-asian', seed });
      expect(Object.keys(lids)).toContain(f.picks.lid);
      expect(['deep', 'hooded']).not.toContain(f.picks.eyes);
      for (const ch of LID_FOLD) if (EYE_SHAPES[f.picks.lid][ch] !== undefined) expect(f.eyes[ch]).toBe(EYE_SHAPES[f.picks.lid][ch]);
      expect(composeFace({ bucket: 'western', seed }).picks.lid).toBeUndefined();
    }
  });

  it('rolls the brows\' and the lashes\' weight per face, after its face (a seed keeps its relations)', () => {
    const shares = { brows: [], lashes: [] };
    for (let seed = 1; seed <= 16; seed++) {
      const f = composeFace({ bucket: 'western', seed });
      for (const [g, dials] of Object.entries(FACE_GROOMS)) for (const [k, [lo, hi]] of Object.entries(dials)) {
        const share = f.proportions[`${g}.${k}`];
        expect(share).toBeGreaterThanOrEqual(lo - 0.01); expect(share).toBeLessThanOrEqual(hi + 0.01);
        expect(Number.isFinite(f.epidermis.hair[g][k])).toBe(true);
        shares[g].push(share);
      }
    }
    for (const g of Object.keys(shares)) expect(new Set(shares[g]).size).toBeGreaterThan(8);
  });

  it('rolls the nose\'s axis per face, each bucket leaning its own way and reaching both ends', () => {
    const rolls = (bucket) => Array.from({ length: 60 }, (_, i) => composeFace({ bucket, seed: i + 1 }).proportions.nose);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const west = rolls('western'), asia = rolls('east-asian');
    expect(mean(asia)).toBeLessThan(mean(west) - 0.3);
    for (const r of [west, asia]) { expect(Math.min(...r)).toBeLessThan(0); expect(Math.max(...r)).toBeGreaterThan(0); }
    // (the ends move the nose the way they name: shorter and less projected, or longer and more)
    const short = composeFace({ seed: 5, nose: -1 }).relations, long = composeFace({ seed: 5, nose: 1 }).relations;
    expect(short.noseProjection).toBeLessThan(long.noseProjection);
    expect(short.nasionDrop).toBeGreaterThan(long.nasionDrop);
    expect(Math.sign(FACE_NOSE.short.noseSize)).toBe(-1);
  });

  it('composes every bucket inside the head\'s working range, a blend as one of its buckets\' own faces', () => {
    for (const bucket of Object.keys(FACE_BUCKETS)) for (let seed = 1; seed <= 6; seed++) {
      const f = composeFace({ bucket, seed });
      for (const [k, [lo, hi]] of Object.entries(FACE_LIMITS)) { expect(f.relations[k]).toBeGreaterThanOrEqual(lo); expect(f.relations[k]).toBeLessThanOrEqual(hi); }
      if (FACE_BUCKETS[bucket].blend) {
        expect(Object.keys(FACE_BUCKETS[bucket].blend)).toContain(f.bucket);
        const { blend: _b, ...own } = f;
        expect(own).toEqual(composeFace({ bucket: f.bucket, seed }));
      }
    }
  });
  it('lets a lid roll name the rig\'s own lid, which lays no cover', () => {
    const plain = Array.from({ length: 30 }, (_, i) => composeFace({ bucket: 'african', seed: i + 1 })).filter((f) => f.picks.lid === 'none');
    expect(plain.length).toBeGreaterThan(10);
    for (const f of plain) for (const ch of LID_FOLD) expect(f.eyes[ch] === undefined || FACE_SHAPES.eyes[f.picks.eyes].eyes?.[ch] !== undefined).toBe(true);
  });

  it('mixes: each face one of its buckets, or that one with a share of a second, the bases between theirs', () => {
    const M = FACE_BUCKETS.equatorial.mix, faces = Array.from({ length: 40 }, (_, i) => composeFace({ bucket: 'equatorial', seed: i + 1 }));
    const pairs = faces.filter((f) => f.mixed.with);
    expect(pairs.length).toBeGreaterThan(10); expect(pairs.length).toBeLessThan(30);
    for (const f of faces) {
      expect(Object.keys(M.buckets)).toContain(f.mixed.of);
      if (!f.mixed.with) continue;
      expect(f.mixed.with).not.toBe(f.mixed.of);
      expect(f.mixed.share).toBeGreaterThanOrEqual(M.share[0]); expect(f.mixed.share).toBeLessThanOrEqual(M.share[1]);
      // (the forehead: a base's own, rolled by nothing else — between the two bases', at the share)
      const a = FACE_BUCKETS[f.mixed.of].base.forehead ?? 0, c = FACE_BUCKETS[f.mixed.with].base.forehead ?? 0, pole = RELATION_POLES.female.forehead;
      expect(f.relations.forehead).toBeCloseTo(pole + a + (c - a) * f.mixed.share, 2);
    }
  });

  it('holds a bucket\'s tones to its intent, within its ancestries', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const f = composeFace({ bucket: 'equatorial', seed }), [lo, hi] = FACE_BUCKETS.equatorial.tones;
      expect(f.dermis.tone).toBeGreaterThanOrEqual(lo); expect(f.dermis.tone).toBeLessThanOrEqual(hi);
      expect(composeFace({ bucket: 'western', seed }).dermis.tone).toBeUndefined();
    }
  });

  it('rolls the hairline per face, a dermis the map reads, and the hair\'s loss by sex and by the bucket\'s prevalence', () => {
    const lossOf = (bucket, sex) => Array.from({ length: 200 }, (_, i) => composeFace({ bucket, sex, seed: i + 1 }).dermis.bald ?? 0);
    for (let seed = 1; seed <= 12; seed++) {
      const f = composeFace({ seed }), D = f.dermis;
      expect(() => readDermis({ from: 'female', ...D })).not.toThrow();
      expect(D.hairline).toBeGreaterThanOrEqual(FACE_HAIRLINE.hairline.female[0]); expect(D.hairline).toBeLessThanOrEqual(FACE_HAIRLINE.hairline.female[1]);
      expect(!!f.scalp).toBe(D.peak !== undefined);
    }
    const share = (a) => a.filter((b) => b > 0).length / a.length;
    expect(share(lossOf('western', 'male'))).toBeGreaterThan(0.3);
    expect(share(lossOf('western', 'female'))).toBeLessThan(0.15);
    expect(share(lossOf('east-asian', 'male'))).toBeLessThan(share(lossOf('western', 'male')));
    // (an open dial: set it, and the face keeps everything else)
    const a = composeFace({ sex: 'male', seed: 4 }), b = composeFace({ sex: 'male', seed: 4, bald: 0.8 });
    expect(b.dermis.bald).toBe(0.8); expect(b.relations).toEqual(a.relations);
  });

  it('rolls a man about his pole: the hairline lower, the peak more often and without the women\'s groom, the brows heavier', () => {
    let peaks = 0, wb = 0, mb = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const m = composeFace({ sex: 'male', seed }), w = composeFace({ sex: 'female', seed });
      expect(m.dermis.hairline).toBeGreaterThanOrEqual(FACE_HAIRLINE.hairline.male[0]); expect(m.dermis.hairline).toBeLessThanOrEqual(FACE_HAIRLINE.hairline.male[1]);
      expect(m.scalp?.moves ?? []).not.toContain('framed-layers');
      if (m.dermis.peak !== undefined) peaks++;
      expect(m.epidermis.hair.brows.thickness).toBeCloseTo(BROW_SHAPES[m.epidermis.hair.brows.shape].thickness * m.proportions['brows.thickness'] * FACE_GROOM_SEX.male.brows.thickness, 1);   // (the share is read to the hundredth)
      wb += w.epidermis.hair.brows.thickness; mb += m.epidermis.hair.brows.thickness;
    }
    expect(peaks).toBeGreaterThan(12); expect(mb).toBeGreaterThan(wb * 1.3);
  });

  it('gives a man his cut and his facial hair by his bucket, a dermis and a groom the maps read; a woman neither', () => {
    const men = (bucket) => Array.from({ length: 40 }, (_, i) => composeFace({ sex: 'male', bucket, seed: i + 1 }));
    for (const f of men('western')) {
      expect(() => readDermis({ from: 'male', ...f.dermis })).not.toThrow();
      if (f.scalp) expect(() => readScalp({ ...f.scalp })).not.toThrow();
      expect(Object.keys(FACE_BEARD.styles)).toContain(f.picks.beard);
      expect(f.dermis.beardStyle === undefined).toBe(f.picks.beard === 'clean');
    }
    // (every pool's cut is a groom the hair reads)
    for (const P of Object.values(FACE_HAIR_MALE)) for (const cuts of Object.values(P)) for (const c of cuts) expect(() => readScalp(c)).not.toThrow();
    // (East Asian beards sparser and more often shaven than the West's)
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(men('north-asian').map((f) => f.dermis.beard))).toBeLessThan(mean(men('western').map((f) => f.dermis.beard)));
    expect(men('north-asian').filter((f) => f.picks.beard === 'clean').length).toBeGreaterThan(men('levantine').filter((f) => f.picks.beard === 'clean').length);
    // (the plucked shapes rarer on a man)
    const thin = (sex) => Array.from({ length: 120 }, (_, i) => composeFace({ sex, seed: i + 1 }).picks.brows).filter((b) => b === 'thin' || b === 'arched').length;
    expect(thin('male')).toBeLessThan(thin('female'));
    const w = composeFace({ sex: 'female', seed: 3 });
    expect(w.dermis.beardStyle).toBeUndefined(); expect(w.picks.beard).toBeUndefined();
  });

  it('cuts the hair from its bucket\'s pool for the rolled texture, a groom the hair reads', () => {
    let cuts = 0;
    for (const bucket of ['mena', 'south-asian', 'latin', 'african']) for (let seed = 1; seed <= 16; seed++) {
      const f = composeFace({ bucket, seed });
      if (!f.scalp?.style) continue;
      cuts++;
      expect(() => readScalp(f.scalp)).not.toThrow();
      const B = FACE_BUCKETS[f.mixed?.of ?? f.bucket], pools = Object.values(FACE_HAIR[B.hair]).flat().map((c) => c.style);
      expect(pools).toContain(f.scalp.style);
    }
    expect(cuts).toBeGreaterThan(20);
    // (a woman of the Levant or the Maghreb never draws the big round afro)
    for (let seed = 1; seed <= 40; seed++) expect(composeFace({ bucket: 'mena', seed }).scalp?.style).not.toBe('afro');
  });

  it('composes a hybrid trait by trait: each group from one parent or blended, the face naming its sources', () => {
    const groups = Object.keys(HYBRID_TRAITS), seen = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const f = composeFace({ bucket: 'mixed', seed }), H = f.hybrid;
      expect(H.of).not.toBe(H.with);
      expect(Object.keys(H.traits).sort()).toEqual([...groups].sort());
      for (const [g, src] of Object.entries(H.traits)) {
        expect([H.of, H.with].includes(src) || src.startsWith('blend')).toBe(true);
        seen.add(src.startsWith('blend') ? 'blend' : src === H.of ? 'of' : 'with');
        // (a group inherited whole carries that parent's base: the forehead, which only a base moves)
        if (g === 'skull' && !src.startsWith('blend')) expect(f.relations.forehead).toBeCloseTo(RELATION_POLES.female.forehead + (FACE_BUCKETS[src].base?.forehead ?? 0), 9);
      }
      for (const [k, [lo, hi]] of Object.entries(FACE_LIMITS)) { expect(f.relations[k]).toBeGreaterThanOrEqual(lo); expect(f.relations[k]).toBeLessThanOrEqual(hi); }
    }
    expect([...seen].sort()).toEqual(['blend', 'of', 'with']);
    // (named parents make any face a hybrid of them; a parent must be a base bucket)
    const f = composeFace({ parents: { western: 1, 'north-asian': 1 }, seed: 2 });
    expect(['western', 'north-asian']).toContain(f.hybrid.of);
    expect(() => composeFace({ parents: { western: 1, asian: 1 } })).toThrow(/base buckets/);
  });
});
