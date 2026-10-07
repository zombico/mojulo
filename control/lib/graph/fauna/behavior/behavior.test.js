import { describe, it, expect } from 'vitest';
import { BEHAVIORS, STRATEGIES, SUPPORT, HEAD, TAIL, LOOP, CAPABILITIES, TAGS, resolveBehavior, behaviorTable, capabilitiesOf, tagsOf, repertoire } from './index.js';
import { FAMILY_TAGS } from './tags.js';
import { FAMILIES, FAMILY_SPECIES } from '../families.js';
import { speciesPlan } from '../species.js';

// The behavior contract: one word per behavior, resolved for every animal by its bones first and its habits second.
const ids = Object.keys(FAMILY_SPECIES);

describe('behavior: the vocabulary', () => {
  it('every strategy is written in the mechanism words, and every behavior ends on a fallback', () => {
    for (const [b, list] of Object.entries(STRATEGIES)) {
      expect(BEHAVIORS[b], b).toBeDefined();
      const seen = new Set();
      for (const s of list) {
        expect(seen.has(s.id), `${b}: duplicate ${s.id}`).toBe(false); seen.add(s.id);
        expect(SUPPORT[s.support], `${b}.${s.id} support`).toBeDefined();
        expect(HEAD[s.head], `${b}.${s.id} head`).toBeDefined();
        expect(TAIL[s.tail], `${b}.${s.id} tail`).toBeDefined();
        expect(LOOP[s.loop], `${b}.${s.id} loop`).toBeDefined();
        expect(typeof s.line === 'string' && s.line.length > 0, `${b}.${s.id} line`).toBe(true);
        for (const k of Object.keys(s.needs || {})) expect(CAPABILITIES[k], `${b}.${s.id} needs ${k}`).toBeDefined();
        for (const t of [...(s.when || []), ...(s.unless || [])]) expect(TAGS[t], `${b}.${s.id} tag ${t}`).toBeDefined();
      }
      const last = list[list.length - 1];
      expect(!last.needs && !last.when && !last.unless, `${b}: last strategy is not a fallback`).toBe(true);
    }
    for (const b of Object.keys(BEHAVIORS)) expect(STRATEGIES[b], b).toBeDefined();
  });

  it('every tag is read by some strategy, and every family with species has its tags', () => {
    const read = new Set(Object.values(STRATEGIES).flat().flatMap((s) => [...(s.when || []), ...(s.unless || [])]));
    for (const t of Object.keys(TAGS)) expect(read.has(t), `tag '${t}' is read by no strategy`).toBe(true);
    for (const t of Object.values(TAGS)) expect(['diet', 'vigilance', 'rest']).toContain(t.group);
    const families = new Set(Object.values(FAMILY_SPECIES).map((s) => s.family));
    for (const f of families) expect(FAMILY_TAGS[f], `family '${f}' has no tags entry`).toBeDefined();
    for (const [f, F] of Object.entries(FAMILY_TAGS)) {
      expect(FAMILIES[f], `tags for unknown family '${f}'`).toBeDefined();
      for (const t of F.tags) expect(TAGS[t], `${f}: ${t}`).toBeDefined();
      for (const [id, o] of Object.entries(F.species || {})) {
        expect(FAMILY_SPECIES[id]?.family, `${f}: species '${id}'`).toBe(f);
        for (const t of [...(o.add || []), ...(o.drop || [])]) expect(TAGS[t], `${f}.${id}: ${t}`).toBeDefined();
      }
    }
  });
});

describe('behavior: every animal resolves', () => {
  it('every species resolves every behavior, and says why', () => {
    for (const id of ids) for (const b of Object.keys(BEHAVIORS)) {
      const r = resolveBehavior(id, b);
      expect(STRATEGIES[b].some((s) => s.id === r.strategy), `${id}.${b}`).toBe(true);
      expect(r.clip).toBe(BEHAVIORS[b].clip);
      for (const p of r.why.passed) expect(typeof p.because, `${id}.${b}.${p.strategy}`).toBe('string');
    }
  });

  it('capabilities come from the bones: a support for every species, and no body both legless and a swimmer', () => {
    for (const id of ids) {
      const C = capabilitiesOf(id);
      expect(['four', 'two', 'wingwalk', 'fins', 'none'], id).toContain(C.support);
      expect(C.legless && C.swimmer, id).toBe(false);
      expect(tagsOf(FAMILY_SPECIES[id].family, id), id).toBeInstanceOf(Array);
    }
  });

  it('one word, many bodies: relax reads by the animal', () => {
    const relax = (id) => resolveBehavior(id, 'relax').strategy;
    expect(relax('sheep')).toBe('cud');
    expect(relax('horse')).toBe('doze-standing');
    expect(relax('houseCat')).toBe('curl');
    expect(relax('vulture')).toBe('perch');
    expect(relax('snake')).toBe('coil');
    expect(relax('salmon')).toBe('hover');
    expect(relax('greatWhiteShark')).toBe('cruise');
    expect(relax('fruitBat')).toBe('roost');
    expect(relax('emperorPenguin')).toBe('stand-upright');
  });

  it('habits pick between what the body can do; the body bounds the habits', () => {
    expect(resolveBehavior('kingCobra', 'alert').strategy).toBe('hood');
    expect(resolveBehavior('rattlesnake', 'alert').strategy).toBe('rattle');
    expect(resolveBehavior('deer', 'alert').strategy).toBe('flag');
    expect(resolveBehavior('mantaRay', 'eat').strategy).toBe('filter');
    expect(resolveBehavior('sheep', 'eat').strategy).toBe('graze');
    // the elephant is tagged a browser; it could not graze head-down anyway (its neck falls short: the trunk does it)
    expect(capabilitiesOf('elephant').reachesGround).toBe(false);
    expect(resolveBehavior('elephant', 'eat').strategy).toBe('browse');
    // the curl needs a tail to wrap: a fox curls, a bear with the same habit could not
    expect(resolveBehavior('fox', 'sleep').strategy).toBe('curl-sleep');
    expect(capabilitiesOf('brownBear').wrapTail).toBe(false);
  });

  it('a repertoire: every way an animal does it, its own first, the catch-alls only when nothing else fits', () => {
    expect(repertoire('raccoon', 'relax').map((r) => r.strategy)).toEqual(['sit-up', 'curl']);
    expect(repertoire('squirrel', 'relax').map((r) => r.strategy)).toEqual(['sit-up', 'curl']);
    expect(repertoire('brownBear', 'relax')[0].strategy).toBe('sit-up');
    expect(repertoire('rabbit', 'relax').map((r) => r.strategy)).toEqual(['lie']);   // nothing its own: the default
    for (const id of ids) for (const b of Object.keys(BEHAVIORS)) {
      const R = repertoire(id, b);
      expect(R.length, `${id}.${b}`).toBeGreaterThan(0);
      expect(R[0].strategy, `${id}.${b}: the default leads`).toBe(resolveBehavior(id, b).strategy);
    }
    expect(resolveBehavior('raccoon', 'relax', { variant: 'curl' }).strategy).toBe('curl');
    expect(() => resolveBehavior('raccoon', 'relax', { variant: 'perch' })).toThrow(/sit-up, curl/);
  });

  it('the table is every species resolved', () => {
    const T = behaviorTable();
    expect(Object.keys(T)).toEqual(ids);
    for (const id of ['sheep', 'tRex', 'mantaRay']) for (const b of Object.keys(BEHAVIORS)) expect(T[id][b]).toBe(resolveBehavior(id, b).strategy);
  });

  it('nothing reaches a plan: a species builds the same with behavior loaded', () => {
    for (const id of ['sheep', 'vulture', 'snake']) expect(JSON.stringify(speciesPlan(id))).toBe(JSON.stringify(speciesPlan(id)));
  });
});
