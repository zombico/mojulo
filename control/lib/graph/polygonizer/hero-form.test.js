// hero-form.test.js — the TUNE: the body proportion lab's checker transposed onto the hero form. Identity, composition,
// thickness is radial about the ring's own centre, lengths move joints only, the head scales uniformly, every move on
// every cast in every register closes and stands. The canonical JSON byte pin lives with the docs (test-hero.mjs).
import { describe, it, expect } from 'vitest';
import { heroPlan, HERO_CASTS, HERO_MOVES, HERO_MOVE_NAMES, REGISTERS, TUNE_KEYS, TUNE_GROUPS, TUNE_RANGES, resolveTune, validateTune, tuneWarnings, BODY_DEFAULTS, BUST_MAX_OF_CHEST } from './hero-form.js';
const castChest = (cast) => HERO_CASTS[cast]?.body?.chest ?? BODY_DEFAULTS.chest;
import { CAST_PRESET_NAMES } from './figure-cast.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';

const casts = [...CAST_PRESET_NAMES, ...Object.keys(HERO_CASTS)];
const seg = (plan, name) => plan.segments.find((s) => s.name === name);
const closed = (recipe, dials = {}) => { const m = compileLayered(recipe, dials); return Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n); };
const sole = (recipe) => Math.min(...compileLayered(recipe).vertices.map((v) => v[2]));
const crown = (plan) => plan.joints.headBase[2];
/** every ring radius of a segment, flattened, in a stable order */
const radii = (s) => s.kind === 'segment' ? [s.rA, s.rB, s.rMid ?? []].flat(2) : s.stations.flatMap((st) => (Array.isArray(st.r) ? st.r : [st.r]));
const centres = (s) => s.kind === 'segment' ? [s.from, s.to] : s.kind === 'loft' ? s.stations.map((st) => st.at) : s.stations.map((st) => st.z);
/** a plan without its frame note (the note says what was tuned, so a tune and its equivalent scale differ there alone) */
const geometry = ({ frame: _f, ...plan }) => plan;
const cmp = (a, b, f) => (f > 1 ? a >= b - 1e-9 : a <= b + 1e-9);

describe('the tune resolves like a cast', () => {
  it('identity: an empty tune and a unit ratio change no bytes on any cast', () => {
    for (const cast of casts) {
      const base = heroPlan({ cast });
      expect(heroPlan({ cast, tune: {} })).toEqual(base);
      expect(heroPlan({ cast, tune: Object.fromEntries(TUNE_KEYS.map((k) => [k, 1])) })).toEqual(base);
      expect(heroPlan({ cast, tune: [] })).toEqual(base);
    }
  });
  it('is deterministic', () => {
    const a = JSON.stringify(heroPlan({ cast: 'female', tune: ['athletic', { legs: 1.08 }] }));
    expect(JSON.stringify(heroPlan({ cast: 'female', tune: ['athletic', { legs: 1.08 }] }))).toBe(a);
  });
  it('composes by product, left to right; a move names itself in `from`', () => {
    const t = resolveTune(['athletic', { shoulders: 1.05 }]);
    expect(t.shoulders).toBeCloseTo(1.18 * 1.05, 6); expect(t.waist).toBe(0.94); expect(t.legs).toBe(1); expect(t.from).toBe('athletic');
    expect(resolveTune(['athletic', 'long-legs']).from).toBe('athletic+long-legs');
    expect(resolveTune('full-limbs')).toMatchObject(HERO_MOVES['full-limbs'].tune);
  });
  it('a group word expands first and an explicit key in the same object wins', () => {
    expect(resolveTune({ limbs: 1.2, calf: 1 })).toMatchObject({ upperArm: 1.2, forearm: 1.2, thigh: 1.2, calf: 1 });
    expect(resolveTune({ arms: 1.3 })).toMatchObject({ upperArm: 1.3, forearm: 1.3, thigh: 1, calf: 1 });
    expect(resolveTune({ lengths: 1.1 })).toMatchObject({ torso: 1.1, neck: 1.1, legs: 1.1, stature: 1 });
    expect(resolveTune({ widths: 0.9 })).toMatchObject({ shoulders: 0.9, waist: 0.9, hips: 0.9, depth: 0.9 });
  });
  it('the groups cover every key exactly once', () => {
    const all = Object.values(TUNE_GROUPS).flat();
    expect(new Set(all).size).toBe(all.length); expect(all).toEqual([...TUNE_KEYS]);
    for (const k of TUNE_KEYS) expect(TUNE_RANGES[k]).toHaveLength(2);
  });
  it('refuses an unknown control, an unknown move or a ratio that is not a positive number; heroPlan carries the refusal', () => {
    expect(validateTune({ shoulder: 1.1 })[0]).toMatch(/unknown control .*shoulders/);
    expect(validateTune('athletic-ish')[0]).toMatch(/unknown move/);
    expect(validateTune({ legs: 0 })[0]).toMatch(/> 0/); expect(validateTune({ legs: 'tall' })[0]).toMatch(/> 0/);
    expect(validateTune(['athletic', { hips: -1 }])[0]).toMatch(/tune\[1\]\.hips/);
    expect(validateTune(['athletic', { hips: 1.1 }])).toEqual([]);
    expect(() => heroPlan({ cast: 'male', tune: { waists: 1.1 } })).toThrow(/unknown control/);
    expect(() => heroPlan({ cast: 'nobody' })).toThrow(/unknown preset .*or a hero cast/);
  });
  it('ranges advise and never refuse', () => {
    expect(tuneWarnings(resolveTune({ shoulders: 1.2 }))).toEqual([]);
    const w = tuneWarnings(resolveTune({ shoulders: 1.4, calf: 0.5 }));
    expect(w).toHaveLength(2); expect(w[0]).toMatch(/tune\.shoulders 1\.4 .*\[0\.8, 1\.25\]/);
    expect(() => heroPlan({ cast: 'male', tune: { shoulders: 1.4, calf: 0.5 } })).not.toThrow();
  });
});

describe('thickness is radial: a limb thickens about its own rings, joints and neighbours stay', () => {
  // the segments a thickness may touch: its own, and the thigh loft's knee ring for the calf (the knee is shared)
  const allowed = { upperArm: ['upperArmR'], forearm: ['foreArmR'], thigh: ['thighR'], calf: ['shankR', 'thighR'] };
  for (const key of TUNE_GROUPS.limbs) for (const f of TUNE_RANGES[key]) {
    it(`${key} ${f}`, () => {
      for (const cast of ['male', 'female']) {
        const base = heroPlan({ cast }), t = heroPlan({ cast, tune: { [key]: f } });
        expect(t.joints).toEqual(base.joints); expect(t.rig.joints).toEqual(base.rig.joints);
        for (const s of base.segments) {
          const u = seg(t, s.name);
          if (!allowed[key].includes(s.name)) { expect(u).toEqual(s); continue; }
          expect(centres(u)).toEqual(centres(s)); expect(u.caps).toEqual(s.caps);
          const a = radii(s), b = radii(u); expect(b).toHaveLength(a.length);
          b.forEach((v, i) => expect(cmp(v, a[i], f)).toBe(true));
          if (s.name === allowed[key][0]) expect(b.some((v, i) => v !== a[i])).toBe(true);
        }
        if (key === 'upperArm') { const s = seg(base, 'upperArmR'), u = seg(t, 'upperArmR'); s.rA.forEach((r, i) => expect(u.rA[i]).toBeCloseTo(r * f, 5)); }
        if (key === 'forearm') { expect(seg(t, 'foreArmR').rB).toEqual(seg(base, 'foreArmR').rB); expect(seg(t, 'upperArmR')).toEqual(seg(base, 'upperArmR')); }
        expect(closed(expandPlan(t))).toEqual([]);
      }
    });
  }
  it('the yoke stays when the upper arm thickens: the shoulder attachment ring is the torso\'s, not the arm\'s', () => {
    expect(seg(heroPlan({ cast: 'male', tune: { upperArm: 1.5 } }), 'torso')).toEqual(seg(heroPlan({ cast: 'male' }), 'torso'));
  });
});

describe('lengths move joints only; the soles stay on the ground', () => {
  for (const [key, joint] of [['legs', 'hip'], ['torso', 'neckHub'], ['neck', 'headBase']]) {
    it(`${key} 1.15 raises ${joint} and the crown, changes no radius`, () => {
      for (const cast of ['male', 'canonical']) {
        const base = heroPlan({ cast }), t = heroPlan({ cast, tune: { [key]: 1.15 } });
        expect(t.joints[joint][2]).toBeGreaterThan(base.joints[joint][2]); expect(crown(t)).toBeGreaterThan(crown(base));
        for (const s of base.segments) { const u = seg(t, s.name); expect(u.kind).toBe(s.kind); if (s.name !== 'head') expect(radii(u)).toEqual(radii(s)); }
        expect(Math.abs(sole(expandPlan(t)))).toBeLessThan(0.02);
      }
    });
  }
  it('legs 0.85 lowers the crown and keeps the soles', () => {
    const t = heroPlan({ cast: 'female', tune: { legs: 0.85 } });
    expect(crown(t)).toBeLessThan(crown(heroPlan({ cast: 'female' }))); expect(Math.abs(sole(expandPlan(t)))).toBeLessThan(0.02);
  });
});

describe('the bust has a ceiling on every cast', () => {
  // a runaway body.bust (5 m) used to build a mound metres wide; the ceiling is a share of the chest it sits on
  it('refuses a bust past 0.4 × the chest radius by name, on every cast; at and under it the plan builds', () => {
    for (const cast of Object.keys(HERO_CASTS)) {
      const chest = castChest(cast);
      expect(() => heroPlan({ cast, body: { bust: 5 } })).toThrow(new RegExp(`body\\.bust 5 is past its ceiling: at most 0\\.4 × the chest radius, ${+(0.4 * chest).toFixed(6)} m`));
      expect(() => heroPlan({ cast, body: { bust: BUST_MAX_OF_CHEST * chest * 1.01 } })).toThrow(/body\.bust .* is past its ceiling/);
      expect(heroPlan({ cast, body: { bust: BUST_MAX_OF_CHEST * chest } }).segments.some((sg) => sg.name === 'bustR')).toBe(true);
    }
    // the ceiling follows a chest override and the anime casts, and a figure cast reads the default chest
    expect(() => heroPlan({ cast: 'female', body: { chest: 0.25, bust: 0.09 } })).not.toThrow();
    expect(() => heroPlan({ cast: 'female', proportions: 'anime', body: { bust: 0.09 } })).toThrow(/past its ceiling/);
    expect(heroPlan({ cast: 'female', body: { bust: 0.05 } }).segments.some((sg) => sg.name === 'bustR')).toBe(true);
  });
});

describe('scales', () => {
  it('stature is the uniform scale', () => {
    expect(geometry(heroPlan({ cast: 'male', tune: { stature: 1.1 } }))).toEqual(geometry(heroPlan({ cast: 'male', scale: 1.1 })));
    expect(geometry(heroPlan({ cast: 'female', tune: { stature: 0.9 } }))).toEqual(geometry(heroPlan({ cast: 'female', scale: HERO_CASTS.female.scale * 0.9 })));
  });
  it('head scales the blank head trunk uniformly about the atlas and moves nothing below it', () => {
    const base = heroPlan({ cast: 'male' }), t = heroPlan({ cast: 'male', tune: { head: 1.15 } });
    expect(t.joints).toEqual(base.joints);
    for (const s of base.segments) if (s.name !== 'head') expect(seg(t, s.name)).toEqual(s);
    const hb = base.joints.headBase[2]; const h0 = seg(base, 'head'), h1 = seg(t, 'head');
    h0.stations.forEach((st, i) => { st.r.forEach((r, k) => expect(h1.stations[i].r[k]).toBeCloseTo(r * 1.15, 5)); expect(h1.stations[i].z - hb).toBeCloseTo((st.z - hb) * 1.15, 5); });
    expect(geometry(heroPlan({ cast: 'male', tune: { head: 1.15 } }))).toEqual(geometry(heroPlan({ cast: 'male', headScale: 1.15 })));
  });
});

describe('widths', () => {
  it('shoulders carries the arm chain outward and widens the yoke; nothing else moves', () => {
    const base = heroPlan({ cast: 'male' }), t = heroPlan({ cast: 'male', tune: { shoulders: 1.2 } });
    for (const j of ['shoulder', 'elbow', 'wrist', 'knuckles']) expect(t.joints[j][0]).toBeGreaterThan(base.joints[j][0]);
    for (const j of ['hip', 'knee', 'ankle', 'neckHub', 'headBase']) expect(t.joints[j]).toEqual(base.joints[j]);
    expect(seg(t, 'torso').stations[3].r[0]).toBeGreaterThan(seg(base, 'torso').stations[3].r[0]);
    for (const s of base.segments) if (!['torso', 'upperArmR', 'foreArmR', 'handR'].includes(s.name)) expect(seg(t, s.name)).toEqual(s);
    for (const name of ['upperArmR', 'foreArmR', 'handR']) expect(radii(seg(t, name))).toEqual(radii(seg(base, name)));
  });
  it('streamlined: waist narrows the trunk\'s lower rings and the thigh crest; hips widens the pelvis without deepening it; depth deepens without widening', () => {
    const S = { cast: 'female', core: 'streamlined' }, base = heroPlan(S);
    const w = heroPlan({ ...S, tune: { waist: 0.85 } });
    expect(w.joints).toEqual(base.joints);
    expect(seg(w, 'torso').stations[0].r[0]).toBeLessThan(seg(base, 'torso').stations[0].r[0]); expect(seg(w, 'torso').stations[0].r[1]).toBe(seg(base, 'torso').stations[0].r[1]);
    expect(seg(w, 'thighR').stations[0].r[0]).toBeLessThan(seg(base, 'thighR').stations[0].r[0]);
    for (const s of base.segments) if (!['torso', 'thighR'].includes(s.name)) expect(seg(w, s.name)).toEqual(s);
    const h = heroPlan({ ...S, tune: { hips: 1.2 } });
    expect(h.joints).toEqual(base.joints);
    expect(seg(h, 'thighR').stations[1].r[0]).toBeGreaterThan(seg(base, 'thighR').stations[1].r[0]); expect(seg(h, 'thighR').stations[1].r[1]).toBe(seg(base, 'thighR').stations[1].r[1]);
    for (const s of base.segments) if (s.name !== 'thighR') expect(seg(h, s.name)).toEqual(s);
    const d = heroPlan({ ...S, tune: { depth: 1.2 } });
    expect(d.joints).toEqual(base.joints);
    seg(base, 'torso').stations.slice(0, 4).forEach((st, i) => { expect(seg(d, 'torso').stations[i].r[0]).toBe(st.r[0]); expect(seg(d, 'torso').stations[i].r[1]).toBeCloseTo(st.r[1] * 1.2, 5); });
    expect(seg(d, 'torso').stations[4]).toEqual(seg(base, 'torso').stations[4]);
    expect(seg(d, 'thighR').stations[1].r[1]).toBeCloseTo(seg(base, 'thighR').stations[1].r[1] * 1.2, 5); expect(seg(d, 'thighR').stations[1].r[0]).toBe(seg(base, 'thighR').stations[1].r[0]);
    for (const s of base.segments) if (!['torso', 'thighR'].includes(s.name)) expect(seg(d, s.name)).toEqual(s);
  });  it('structured (the default): waist narrows the hem, the pelvis\'s top and the socket ring; hips widens the pelvis and the trochanter, never deepening; depth deepens, never widening', () => {
    const base = heroPlan({ cast: 'female' }), others = (t, names) => { for (const s of base.segments) if (!names.includes(s.name)) expect(seg(t, s.name), s.name).toEqual(s); };
    const w = heroPlan({ cast: 'female', tune: { waist: 0.85 } });
    expect(w.joints).toEqual(base.joints);
    expect(seg(w, 'torso').stations[0].r[0]).toBeLessThan(seg(base, 'torso').stations[0].r[0]); expect(seg(w, 'torso').stations[0].r[1]).toBe(seg(base, 'torso').stations[0].r[1]);
    expect(seg(w, 'pelvis').stations[5].r[0]).toBeLessThan(seg(base, 'pelvis').stations[5].r[0]);
    expect(seg(w, 'thighR').stations[0].r[0]).toBeLessThan(seg(base, 'thighR').stations[0].r[0]);
    others(w, ['torso', 'pelvis', 'thighR']);
    const h = heroPlan({ cast: 'female', tune: { hips: 1.2 } });
    expect(h.joints).toEqual(base.joints);
    expect(seg(h, 'thighR').stations[1].r[0]).toBeGreaterThan(seg(base, 'thighR').stations[1].r[0]); expect(seg(h, 'pelvis').stations[2].r[0]).toBeGreaterThan(seg(base, 'pelvis').stations[2].r[0]);
    for (const n of ['pelvis', 'thighR']) seg(base, n).stations.forEach((st, i) => expect(seg(h, n).stations[i].r[1], `${n} st${i} depth`).toBe(st.r[1]));
    others(h, ['pelvis', 'thighR']);
    const d = heroPlan({ cast: 'female', tune: { depth: 1.2 } });
    expect(d.joints).toEqual(base.joints);
    seg(base, 'torso').stations.slice(0, 4).forEach((st, i) => { expect(seg(d, 'torso').stations[i].r[0]).toBe(st.r[0]); expect(seg(d, 'torso').stations[i].r[1]).toBeCloseTo(st.r[1] * 1.2, 5); });
    for (const n of ['pelvis', 'thighR']) seg(base, n).stations.slice(0, 4).forEach((st, i) => { expect(seg(d, n).stations[i].r[0], `${n} st${i} width`).toBe(st.r[0]); expect(seg(d, n).stations[i].r[1]).toBeGreaterThan(st.r[1]); });
    others(d, ['torso', 'pelvis', 'thighR']);
  });

});

describe('every move on every hero cast in every register closes at rest and at every dial extreme, soles on the ground', () => {
  const lo = Object.fromEntries(TUNE_KEYS.map((k) => [k, TUNE_RANGES[k][0]])), hi = Object.fromEntries(TUNE_KEYS.map((k) => [k, TUNE_RANGES[k][1]]));
  for (const cast of Object.keys(HERO_CASTS)) for (const tune of [...HERO_MOVE_NAMES, 'lo', 'hi']) {
    it(`${cast} · ${tune}`, () => {
      const spec = tune === 'lo' ? lo : tune === 'hi' ? hi : tune;
      for (const register of Object.keys(REGISTERS)) {
        const recipe = expandPlan(heroPlan({ cast, register, tune: spec }));
        const D = recipe.dials; const dlo = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), dhi = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]));
        for (const dials of [{}, dlo, dhi]) expect(closed(recipe, dials)).toEqual([]);
        expect(Math.abs(sole(recipe))).toBeLessThan(0.02);
      }
    });
  }
  it('the frame note says what moved, as percentages, the move first', () => {
    expect(heroPlan({ cast: 'male', tune: ['athletic', { legs: 1.08 }] }).frame.note).toMatch(/tune athletic: legs 108%, shoulders 118%, waist 94%/);
    expect(heroPlan({ cast: 'male' }).frame.note).not.toMatch(/tune/);
  });
});
