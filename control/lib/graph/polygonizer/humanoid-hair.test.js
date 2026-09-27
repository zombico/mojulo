// humanoid-hair.test.js — the HAIR LIBRARY: the hairstyle lab's styles and controls as closed, address-following masses on
// the landmark head. The legacy pin (crop / swept / bob are the bytes the head grew before the library), every style on
// both heads at its defaults and at both combined extremes (finite, closed, the eyes read, a cap reads from the back, the
// head itself unchanged), what each control means, and the resolver's words.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { humanoidHead, humanoidAnchors, HAIR_STYLES } from './humanoid-head.js';
import { HAIR, HAIR_KEYS, HAIR_RANGES, HAIR_LIBRARY, HAIR_STYLE_NAMES, HAIR_COLLECTIONS, resolveHair, validateHair, hairWarnings } from './humanoid-hair.js';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const PRESETS = ['male', 'female'];
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const closed = (recipe, dials = {}) => Object.entries(auditLayered(compileLayered(recipe, dials))).filter(([, r]) => !r.pass).map(([n]) => n);
const isHair = (k) => k.startsWith('hair');
const HAIR_PARTS = ['hairCap', 'hairFall', 'hairTail'];
const lo = Object.fromEntries(HAIR_KEYS.map((k) => [k, HAIR_RANGES[k][0]])), hi = Object.fromEntries(HAIR_KEYS.map((k) => [k, HAIR_RANGES[k][1]]));
/** the world-space points of one pinned part */
const world = (head, part) => { const m = compileLayered(head); return m.pointIds.map((id, i) => (id.startsWith(`${part}/`) ? m.vertices[i] : null)).filter(Boolean); };
/** a part's RING points: its two cap points left out (the cap's crown point is a fixed constant, never a measure) */
const rings = (head, part) => { const m = compileLayered(head); return m.pointIds.map((id, i) => (id.startsWith(`${part}/st`) ? m.vertices[i] : null)).filter(Boolean); };
/** the radius of one ring of a pinned part: the largest distance of its points from their centroid */
const ringR = (head, part, st) => { const m = compileLayered(head); const ps = m.pointIds.map((id, i) => (id.startsWith(`${part}/${st}.`) ? m.vertices[i] : null)).filter(Boolean); const c = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]); return Math.max(...ps.map((p) => Math.hypot(...p.map((v, k) => v - c[k])))); };
const zMin = (pts) => Math.min(...pts.map((p) => p[2])), zMax = (pts) => Math.max(...pts.map((p) => p[2])), yMin = (pts) => Math.min(...pts.map((p) => p[1]));
const withoutHair = (head) => Object.fromEntries(Object.entries(head.parts).filter(([k]) => !isHair(k)));
const locksOf = (head) => Object.keys(head.parts).filter((k) => k.startsWith('hairLock'));

// the bytes `hairMass` grew on 2026-09-26, before the library: the same three styles at every control 1 must be these
const LEGACY = {
  'male/crop/round': 'e737200d57a586a27fdca89ce06ecb73ea0dc11daa67f3e6ea0760af50fe7195',
  'male/crop/lowpoly': 'e737200d57a586a27fdca89ce06ecb73ea0dc11daa67f3e6ea0760af50fe7195',
  'male/swept/round': '48e8e5d55b44a8da5e5f54735f296e26ac11b82a90735ba318d3867b92fbe4c7',
  'male/swept/lowpoly': '48e8e5d55b44a8da5e5f54735f296e26ac11b82a90735ba318d3867b92fbe4c7',
  'male/bob/round': '7978bacfe674e919e6a5c19cd1089459a6ef66f0b4ccde76f4644074f1802ce9',
  'male/bob/lowpoly': '7978bacfe674e919e6a5c19cd1089459a6ef66f0b4ccde76f4644074f1802ce9',
  'female/crop/round': 'ca2e64c673e2cfd42fe8f4d8c4a441a557b08d51c70e69763137d3764a02b246',
  'female/crop/lowpoly': 'ca2e64c673e2cfd42fe8f4d8c4a441a557b08d51c70e69763137d3764a02b246',
  'female/swept/round': '0d17745228d2ba9e512a3c4bef01c5c80943d757d10f3b4143e45522d7919715',
  'female/swept/lowpoly': '0d17745228d2ba9e512a3c4bef01c5c80943d757d10f3b4143e45522d7919715',
  'female/bob/round': '1cd4ccfd520970de645d2b36aea9a6f1f73b41a2ac913ee93bd4279289341d23',
  'female/bob/lowpoly': '1cd4ccfd520970de645d2b36aea9a6f1f73b41a2ac913ee93bd4279289341d23',
};

describe('the legacy pin: crop, swept and bob are the bytes the head grew before the library', () => {
  for (const [key, hash] of Object.entries(LEGACY)) {
    const [preset, hair, register] = key.split('/');
    it(key, () => {
      expect(sha(humanoidHead({ preset, hair, register }).parts.hairCap)).toBe(hash);
      expect(sha(humanoidHead({ preset, hair: { style: hair }, register }).parts.hairCap)).toBe(hash);
      expect(humanoidHead({ preset, hair, register }).parts.hairFall).toBeUndefined();
    });
  }
});

describe('the words', () => {
  it('the library: every style has a collection, a base and its controls; the id list is the head\'s HAIR_STYLES', () => {
    expect([...HAIR_STYLES]).toEqual([...HAIR_STYLE_NAMES]); expect(HAIR_STYLES).toContain('none');
    for (const [id, s] of Object.entries(HAIR_LIBRARY)) { expect(['any', 'male', 'female']).toContain(s.collection); expect(['none', 'cap', 'fall', 'tail', 'locks']).toContain(s.base); for (const c of s.controls) expect(HAIR_KEYS).toContain(c); if (id !== 'none') { expect(s.low).toHaveLength(9); expect(s.controls).toContain('definition'); } if (s.collection === 'female') expect(s.controls).toContain('part'); }
    expect(HAIR_COLLECTIONS.male).toContain('taper'); expect(HAIR_COLLECTIONS.male).toContain('animeShort'); expect(HAIR_COLLECTIONS.female).toContain('ponytail'); expect(HAIR_COLLECTIONS.female).toContain('animeBob');
    expect(HAIR_KEYS).toHaveLength(19);
    expect(validateHair({ style: 'animeBob', asymmetry: 0, lineup: 0 })).toEqual([]);   // the two that may switch off
    expect(validateHair({ style: 'bob', volume: 0 })[0]).toMatch(/> 0/);
  });
  it('resolves a word, an object or a list; the style defaults to swept; controls compose by product', () => {
    expect(resolveHair('ponytail')).toMatchObject({ style: 'ponytail', length: 1, tail: 1 });
    expect(resolveHair({ style: 'bob', length: 1.2 })).toMatchObject({ style: 'bob', length: 1.2 });
    expect(resolveHair(['long', { length: 1.2 }, { length: 1.1, fringe: 0.8 }])).toMatchObject({ style: 'long', length: 1.32, fringe: 0.8 });
    expect(resolveHair({ fall: 1.1 })).toMatchObject({ style: 'swept', length: 1.1, graduation: 1.1, wave: 1.1 });
    expect(resolveHair(undefined).style).toBe('swept');
  });
  it('refuses an unknown style or control or a bad ratio by name; ranges and idle controls advise', () => {
    expect(validateHair('mohawk')[0]).toMatch(/unknown style 'mohawk'/);
    expect(validateHair({ style: 'bob', lenght: 1.1 })[0]).toMatch(/unknown control/);
    expect(validateHair(['bob', { length: 0 }])[0]).toMatch(/> 0/);
    expect(validateHair(['bob', { length: 1.2 }])).toEqual([]);
    expect(hairWarnings(resolveHair(['bob', { length: 1.2 }]))).toEqual([]);
    expect(hairWarnings(resolveHair(['bob', { length: 1.8 }]))[0]).toMatch(/hair\.length 1\.8 .*\[0\.6, 1\.5\]/);
    expect(hairWarnings(resolveHair(['buzz', { length: 1.2, tail: 1.2 }]))[0]).toMatch(/hair\.length, hair\.tail have no effect on 'buzz'/);
    expect(() => humanoidHead({ hair: 'mohawk' })).toThrow(/unknown hair/);
  });
});

describe('every style on both heads, at its defaults and at both combined extremes', () => {
  for (const preset of PRESETS) for (const style of HAIR_STYLE_NAMES) for (const [label, controls] of [['defaults', {}], ['all low', lo], ['all high', hi]]) {
    it(`${preset} · ${style} · ${label}`, () => {
      const bare = humanoidHead({ preset, hair: 'none' }), head = humanoidHead({ preset, hair: [style, controls] });
      const base = HAIR_LIBRARY[style].base;
      expect(!!head.parts.hairCap).toBe(base !== 'none'); expect(!!head.parts.hairFall).toBe(base === 'fall'); expect(!!head.parts.hairTail).toBe(base === 'tail');
      expect(locksOf(head).length).toBe(base === 'locks' ? (style === 'animeShort' ? 25 : 20) : 0);
      expect(withoutHair(head)).toEqual(withoutHair(bare));   // hair adds parts; it never moves the head
      expect(head.joints).toEqual(bare.joints);
      for (const part of Object.keys(head.parts).filter(isHair)) for (const o of Object.values(head.parts[part].offsets)) expect(o.every(Number.isFinite)).toBe(true);
      expect(closed(head)).toEqual([]); expect(closed(head, { jawOpen: 25 })).toEqual([]);
      const ex = layeredExposure(compileLayered(head), { res: 256 });
      for (const eye of ['eyeR', 'eyeL']) expect(ex.parts[eye].flag).toBe('reads');
      if (head.parts.hairCap && label === 'defaults') expect(ex.parts.hairCap.visible.back).toBeGreaterThan(0.25);
      if (base !== 'none') { expect(head.hairMeasures.top_m).toBeGreaterThan(0); expect(Number.isFinite(head.hairMeasures.hem_m)).toBe(true); }
      expect(head.hair.style).toBe(style);
    });
  }
  it('the hero wears every style: the plan closes and the hair never moves a joint', () => {
    const plain = humanoidPlan({ preset: 'female', hair: 'none' });
    for (const style of ['buzz', 'undercut', 'angled', 'wavy', 'ponytail', 'bun', 'braid', 'animeBob']) {
      const plan = humanoidPlan({ preset: 'female', hair: [style, { length: 1.3 }] });
      expect(plan.joints).toEqual(plain.joints); expect(closed(expandPlan(plan))).toEqual([]);
      expect(plan.include[0].hair.style).toBe(style); expect(plan.include[0].hairMeasures.top_m).toBeGreaterThan(0);
    }
  });
});

describe('what each control means', () => {
  for (const preset of PRESETS) {
    const a = humanoidAnchors(preset);
    it(`${preset}: length lowers the hem of a fall and lengthens a tail; volume raises the top`, () => {
      const short = humanoidHead({ preset, hair: ['long', { length: 0.7 }] }), long = humanoidHead({ preset, hair: ['long', { length: 1.4 }] });
      expect(zMin(world(long, 'hairFall'))).toBeLessThan(zMin(world(short, 'hairFall')) - 0.05);
      expect(long.hairMeasures.hem_m).toBeLessThan(short.hairMeasures.hem_m);
      const t1 = humanoidHead({ preset, hair: ['ponytail', { length: 0.7 }] }), t2 = humanoidHead({ preset, hair: ['ponytail', { length: 1.4 }] });
      expect(zMin(world(t2, 'hairTail'))).toBeLessThan(zMin(world(t1, 'hairTail')) - 0.04);
      const flat = humanoidHead({ preset, hair: ['crop', { volume: 0.85 }] }), big = humanoidHead({ preset, hair: ['crop', { volume: 1.35 }] });
      expect(zMax(world(big, 'hairCap'))).toBeGreaterThan(zMax(world(flat, 'hairCap')) + 0.005);
    });
    it(`${preset}: fringe lowers the front hairline but never past the brow; fade raises the side hairline`, () => {
      const front = (h) => Math.min(...world(h, 'hairCap').filter((p) => Math.abs(p[0]) < 0.012 && p[1] > a.glabella[1] - 0.01).map((p) => p[2]));
      const up = humanoidHead({ preset, hair: ['crop', { fringe: 0.6 }] }), down = humanoidHead({ preset, hair: ['crop', { fringe: 1.4 }] });
      expect(front(down)).toBeLessThan(front(up) - 0.01);
      expect(front(down)).toBeGreaterThan(a.glabella[2] - 0.004);   // the brow stays clear
      const side = (h) => Math.min(...world(h, 'hairCap').filter((p) => Math.abs(p[0]) > 0.055 && p[1] < 0.02 && p[1] > -0.03).map((p) => p[2]));
      expect(side(humanoidHead({ preset, hair: ['crew', { fade: 1.35 }] }))).toBeGreaterThan(side(humanoidHead({ preset, hair: ['crew', { fade: 0.65 }] })) + 0.02);
    });
    it(`${preset}: tail widens the ponytail and the bun, tie raises their root; graduation lengthens the angled bob's front; wave moves the hem; braid winds`, () => {
      const width = (h) => { const p = world(h, 'hairTail'); return Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0])); };
      expect(width(humanoidHead({ preset, hair: ['ponytail', { tail: 1.5 }] }))).toBeGreaterThan(width(humanoidHead({ preset, hair: ['ponytail', { tail: 0.6 }] })) * 1.8);
      expect(width(humanoidHead({ preset, hair: ['bun', { tail: 1.5 }] }))).toBeGreaterThan(width(humanoidHead({ preset, hair: ['bun', { tail: 0.6 }] })) * 1.8);
      expect(zMax(world(humanoidHead({ preset, hair: ['bun', { tie: 1.35 }] }), 'hairTail'))).toBeGreaterThan(zMax(world(humanoidHead({ preset, hair: ['bun', { tie: 0.65 }] }), 'hairTail')) + 0.015);
      const frontHem = (h) => zMin(world(h, 'hairFall').filter((p) => p[1] > 0 && Math.abs(p[0]) > 0.03));   // the strands beside the face
      expect(frontHem(humanoidHead({ preset, hair: ['angled', { graduation: 1.5 }] }))).toBeLessThan(frontHem(humanoidHead({ preset, hair: ['angled', { graduation: 0.6 }] })) - 0.008);
      const hemX = (h) => { const p = world(h, 'hairFall').filter((q) => q[2] < zMin(world(h, 'hairFall')) + 0.03); return Math.max(...p.map((q) => Math.abs(q[0]))); };
      expect(hemX(humanoidHead({ preset, hair: ['wavy', { wave: 1.6 }] }))).not.toBeCloseTo(hemX(humanoidHead({ preset, hair: ['wavy', { wave: 0.4 }] })), 3);
      const braidX = (h) => { const p = world(h, 'hairTail'); return Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0])); };
      expect(braidX(humanoidHead({ preset, hair: 'braid' }))).toBeGreaterThan(0.03);
    });
    it(`${preset}: the part slides the groove across the front; the bun and tail sit behind the occiput`, () => {
      // the groove: on the mid ring, the parted slot sits closer to the skull than its mirror; part 1.4 parts on the
      // right (slot 3, the ala column), part 0.6 on the left (slot 15, the bridge column)
      const at = (h, id) => { const m = compileLayered(h); return m.vertices[m.pointIds.indexOf(`hairCap/${id}`)]; };
      const right = humanoidHead({ preset, hair: ['taper', { part: 1.4 }] }), left = humanoidHead({ preset, hair: ['taper', { part: 0.6 }] });
      expect(at(right, 'st3.s3')[2]).toBeLessThan(at(left, 'st3.s3')[2] - 0.003);
      expect(at(left, 'st3.s15')[2]).toBeLessThan(at(right, 'st3.s15')[2] - 0.003);
      expect(JSON.stringify(humanoidHead({ preset, hair: ['taper', { part: 0.6 }] }).parts.hairCap)).not.toBe(JSON.stringify(humanoidHead({ preset, hair: 'taper' }).parts.hairCap));
      for (const style of ['ponytail', 'bun', 'braid']) expect(yMin(world(humanoidHead({ preset, hair: style }), 'hairTail'))).toBeLessThan(yMin(world(humanoidHead({ preset, hair: 'none' }), 'cranium')) - 0.01);
    });
    it(`${preset}: the locks — lockWidth widens, taper sharpens, bend sweeps, asymmetry 0 is an exact mirror, the bangs stop at the brow`, () => {
      // lockWidth: a lock's mid ring is wider across
      expect(ringR(humanoidHead({ preset, hair: ['animeBob', { lockWidth: 1.25 }] }), 'hairLock10', 'st3')).toBeGreaterThan(ringR(humanoidHead({ preset, hair: ['animeBob', { lockWidth: 0.75 }] }), 'hairLock10', 'st3') * 1.4);
      // taper: the ring nearest the tip is thinner on a sharper taper
      expect(ringR(humanoidHead({ preset, hair: ['animeBob', { taper: 1.4 }] }), 'hairLock10', 'st7')).toBeLessThan(ringR(humanoidHead({ preset, hair: ['animeBob', { taper: 0.65 }] }), 'hairLock10', 'st7') * 0.8);
      // asymmetry 0: every left lock is the exact mirror of a right lock (the seven bangs pair 0↔6, 1↔5, 2↔4)
      const sym = humanoidHead({ preset, hair: ['animeShort', { asymmetry: 0 }] }), sm = compileLayered(sym);
      const pts = (name) => sm.pointIds.map((id, i) => (id.startsWith(`${name}/`) ? sm.vertices[i] : null)).filter(Boolean);
      for (const [a, b] of [[0, 6], [1, 5], [2, 4]]) { const A = pts(`hairLock${a}`), B = pts(`hairLock${b}`); expect(A.length).toBe(B.length); const mx = (P) => Math.max(...P.map((p) => Math.abs(p[0]))), mz = (P) => Math.min(...P.map((p) => p[2])); expect(mx(A)).toBeCloseTo(mx(B), 4); expect(mz(A)).toBeCloseTo(mz(B), 4); }
      // asymmetry 1.5 breaks the mirror
      const asy = compileLayered(humanoidHead({ preset, hair: ['animeShort', { asymmetry: 1.5 }] }));
      const zs = (name) => Math.min(...asy.pointIds.map((id, i) => (id.startsWith(`${name}/`) ? asy.vertices[i][2] : Infinity)));
      expect(Math.abs(zs('hairLock1') - zs('hairLock5'))).toBeGreaterThan(0.002);
      // bend: the bang tips sweep out and forward (the outermost right bang's reach in x)
      const tipX = (h) => Math.max(...world(h, 'hairLock6').map((p) => p[0]));
      expect(tipX(humanoidHead({ preset, hair: ['animeShort', { bend: 1.4 }] }))).toBeGreaterThan(tipX(humanoidHead({ preset, hair: ['animeShort', { bend: 0.6 }] })) + 0.003);
      // the bangs never pass the brow, even at the longest fringe
      const bangs = humanoidHead({ preset, hair: ['animeBob', { fringe: 1.4 }] });
      for (let i = 0; i < 7; i++) expect(zMin(world(bangs, `hairLock${i}`))).toBeGreaterThan(a.glabella[2] - 0.001);
      // the short's side locks reach the cheek, the bob's the jaw
      expect(zMin(world(humanoidHead({ preset, hair: 'animeBob' }), 'hairLock10'))).toBeLessThan(zMin(world(humanoidHead({ preset, hair: 'animeShort' }), 'hairLock10')) - 0.03);
    });
    it(`${preset}: the form — corners keep the parietal corners, sideBulk thins the lower sides, topSlope weights the front, lineup squares the hairline`, () => {
      const cornerLift = (h) => { const p = world(h, 'hairCap').filter((q) => Math.abs(q[0]) > 0.045 && q[2] > a.crown[2] - 0.05 && q[2] < a.crown[2] - 0.01); return Math.max(...p.map((q) => Math.abs(q[0]))); };
      expect(cornerLift(humanoidHead({ preset, hair: ['crew', { corners: 1.4 }] }))).toBeGreaterThan(cornerLift(humanoidHead({ preset, hair: ['crew', { corners: 0.6 }] })) + 0.002);
      const sideX = (h) => { const p = world(h, 'hairCap').filter((q) => q[1] < 0.02 && q[1] > -0.03 && q[2] < a.crown[2] - 0.07); return Math.max(...p.map((q) => Math.abs(q[0]))); };
      expect(sideX(humanoidHead({ preset, hair: ['taper', { sideBulk: 1.2 }] }))).toBeGreaterThan(sideX(humanoidHead({ preset, hair: ['taper', { sideBulk: 0.75 }] })) + 0.003);
      // topSlope: the crown ring's front point rises (the slope is strongest at the top)
      const frontTop = (h) => { const m = compileLayered(h); return m.vertices[m.pointIds.indexOf('hairCap/st5.s0')][2]; };
      expect(frontTop(humanoidHead({ preset, hair: ['quiff', { topSlope: 1.4 }] }))).toBeGreaterThan(frontTop(humanoidHead({ preset, hair: ['quiff', { topSlope: 0.6 }] })) + 0.005);
      // lineup: the hairline at the temple corner (the side slot's border point) is drawn up toward the front row
      const temple = (h) => { const m = compileLayered(h); return m.vertices[m.pointIds.indexOf('hairCap/st1.s6')][2]; };
      expect(temple(humanoidHead({ preset, hair: ['crew', { lineup: 1.4 }] }))).toBeGreaterThan(temple(humanoidHead({ preset, hair: ['crew', { lineup: 0 }] })) + 0.01);
      // on a legacy style the form is relative: 1 is the pinned read (the pin test says so); above 1 it acts
      expect(JSON.stringify(humanoidHead({ preset, hair: ['crop', { corners: 1.4 }] }).parts.hairCap)).not.toBe(JSON.stringify(humanoidHead({ preset, hair: 'crop' }).parts.hairCap));
    });
    it(`${preset}: definition exaggerates each style's signature — the quiff's lift, the crew's flat top, the undercut's shelf, the falls' panels, the crown ridges`, () => {
      const top = (h) => zMax(rings(h, 'hairCap'));
      expect(top(humanoidHead({ preset, hair: ['quiff', { definition: 1.5 }] }))).toBeGreaterThan(top(humanoidHead({ preset, hair: ['quiff', { definition: 0.6 }] })) + 0.005);
      expect(top(humanoidHead({ preset, hair: ['undercut', { definition: 1.5 }] }))).toBeGreaterThan(top(humanoidHead({ preset, hair: ['undercut', { definition: 0.6 }] })) + 0.003);
      expect(top(humanoidHead({ preset, hair: ['crew', { definition: 1.5 }] }))).toBeLessThan(top(humanoidHead({ preset, hair: ['crew', { definition: 0.6 }] })));
      // the falls' panels: at the hem, pairs of slots draw together (their spread in x shrinks with definition)
      const hemSpread = (h) => { const p = world(h, 'hairFall'); const z0 = zMin(p) + 0.02; const hem = p.filter((q) => q[2] < z0); return Math.max(...hem.map((q) => q[0])) - Math.min(...hem.map((q) => q[0])); };
      expect(hemSpread(humanoidHead({ preset, hair: ['long', { definition: 1.5 }] }))).not.toBeCloseTo(hemSpread(humanoidHead({ preset, hair: ['long', { definition: 0.6 }] })), 3);
      // gathered styles: the crown ridges rise with definition; a legacy style ignores definition at 1 and moves above it
      expect(JSON.stringify(humanoidHead({ preset, hair: ['ponytail', { definition: 1.5 }] }).parts.hairCap)).not.toBe(JSON.stringify(humanoidHead({ preset, hair: 'ponytail' }).parts.hairCap));
      expect(JSON.stringify(humanoidHead({ preset, hair: ['bob', { part: 1.3 }] }).parts.hairCap)).not.toBe(JSON.stringify(humanoidHead({ preset, hair: 'bob' }).parts.hairCap));
      // a female part: the lobes beside it raise the cap on a parted style, the open front raises the hairline over it
      const capTop = (h) => zMax(rings(h, 'hairCap'));
      expect(capTop(humanoidHead({ preset, hair: ['long', { definition: 1.5 }] }))).toBeGreaterThan(capTop(humanoidHead({ preset, hair: ['long', { definition: 0.6 }] })));
    });
  }
});
