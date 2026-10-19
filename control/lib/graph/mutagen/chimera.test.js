import { describe, it, expect } from 'vitest';
import { graftsAt, graftTail, GRAFTS } from './chimera.js';
import { resolveMutagen, oozeFauna } from './index.js';
import { buildFauna } from '../fauna/build.js';
import { SPECIES, speciesParams } from '../fauna/species.js';
import { PER_RIG } from '../fauna/test-cases.js';

// The chimera dial, read on one ring-headed quadruped and one winged species, each chosen in code from the roster.
const id = PER_RIG[0], P = speciesParams(id);
const winged = Object.keys(SPECIES).find((s) => speciesParams(s).wings && speciesParams(s).torso);
const at = (sp, c, ooze = [], seed) => { const r = {}; const plan = oozeFauna(speciesParams(sp), resolveMutagen(ooze, { key: sp, seed, stylism: { register: 'mythic', chimera: c } }), r); return { plan, notes: r.notes }; };
const horns = (plan) => (plan.heads?.[0]?.plan?.ornaments || []).filter((o) => /^ooze(Horn|Crown)$/.test(o.name)).map((o) => o.name);

describe('the chimera dial', () => {
  it('the grafts come in the order they break the silhouette', () => {
    expect(GRAFTS.map(([g]) => g)).toEqual(['horns', 'plates', 'tail', 'wings', 'crown']);
    expect(graftsAt(0)).toEqual([]);
    expect(graftsAt(0.33)).toEqual(['horns']);
    expect(graftsAt(0.66)).toEqual(['horns', 'plates', 'tail', 'wings']);
    expect(graftsAt(1)).toEqual(['horns', 'plates', 'tail', 'wings', 'crown']);
  });

  it('pure keeps the animal\'s own extremities; touched brings horns; chimera a crown', () => {
    expect(horns(at(id, 'pure').plan)).toEqual([]);
    expect(horns(at(id, 'touched').plan)).toEqual(['oozeHorn']);
    expect(horns(at(id, 'chimera').plan)).toEqual(['oozeHorn', 'oozeCrown']);
  });

  it('hybrid grafts a tail rooted where the old one was, a ridge of plates standing in for the crest, and wings', () => {
    const { plan, notes } = at(id, 'hybrid', ['dire']), pure = at(id, 'pure', ['dire']).plan, base = buildFauna(P);
    const tail = (p) => p.segments.find((g) => g.name === 'tail').stations;
    expect(tail(plan)[0].at).toEqual(tail(pure)[0].at);   // rooted where the old tail was
    expect(JSON.stringify(tail(plan))).not.toBe(JSON.stringify(tail(pure)));
    expect(plan.segments.some((g) => g.name.startsWith('oozePlate'))).toBe(true);
    expect(plan.segments.some((g) => g.name.startsWith('oozeHackle'))).toBe(false);   // one hook, never two
    expect(plan.include.some((i) => i.name === 'wings')).toBe(true);
    expect(base.include?.some((i) => i.name === 'wings') ?? false).toBe(false);
    expect(notes.filter((n) => n.stage === 'chimera').map((n) => n.technique)).toEqual(expect.arrayContaining(['horns', 'plates', 'membrane wings']));
  });

  it('a winged animal keeps its own wings', () => {
    const { plan, notes } = at(winged, 'hybrid');
    expect(plan.include.filter((i) => i.name === 'wings')).toHaveLength(1);
    expect(notes.some((n) => n.technique === 'wings (its own)')).toBe(true);
  });

  it('no species joint moves: the grafts stand on joints of their own (and the wing root)', () => {
    const plain = at(id, 'pure', ['dire']).plan.joints, { plan } = at(id, 'chimera', ['dire']);
    for (const [j, v] of Object.entries(plain)) { if (j.startsWith('throat') || j.startsWith('ooze')) continue; expect(plan.joints[j], j).toEqual(v); }
    expect(Object.keys(plan.joints).filter((j) => !(j in plain)).every((j) => j.startsWith('ooze') || j.startsWith('wingRoot'))).toBe(true);
  });

  it('the seed and the motif choose among the grafts: two chimeras of one species differ', () => {
    const kind = (seed) => at(id, 'hybrid', [], seed).notes.find((n) => / tail$/.test(n.technique)).technique;
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(kind)).size).toBeGreaterThan(1);
    expect(kind(3)).toBe(kind(3));
  });

  it('every tail stands off the ground and narrows along its length', () => {
    for (const kind of ['serpent', 'scorpion', 'lion', 'dragon']) {
      const T = graftTail(kind, [0, -0.5, 0.8], 1, 0.08);
      for (const p of [...T.tail, ...T.tip]) expect(p[2], kind).toBeGreaterThan(0);
      expect(T.tail.at(-1)[3], kind).toBeLessThan(T.tail[0][3]);
    }
  });
});
