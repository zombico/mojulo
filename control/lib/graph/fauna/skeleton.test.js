import { describe, it, expect } from 'vitest';
import { faunaSkeleton } from './skeleton.js';
import { SPECIES, speciesPlan } from './species.js';
import { locomotionFor, RIGS } from './locomotion/index.js';

// The skeleton contract: every species gets one connected bone tree with its family's spine counts, every plan part
// rides a real bone, and the limbs carry the roles a gait solver (or a clip library) maps by.
const len = (b) => Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
const count = (S, prefix) => S.bones.filter((b) => new RegExp(`^${prefix}\\d+$`).test(b.id)).length;

describe('fauna skeleton', () => {
  for (const id of Object.keys(SPECIES)) {
    it(`${id}: one tree, the family's spine counts, every part bound, limbs with roles`, () => {
      const S = faunaSkeleton(id), L = locomotionFor(SPECIES[id].family, id);
      expect(S.rig).toBe(L.rig);
      const ids = S.bones.map((b) => b.id);
      expect(new Set(ids).size, 'bone ids are unique').toBe(ids.length);
      // one root, every parent listed before its child
      expect(S.bones.filter((b) => !b.parent).map((b) => b.id)).toEqual(['spine0']);
      S.bones.forEach((b, i) => { if (b.parent) expect(ids.indexOf(b.parent), `${b.id} → ${b.parent}`).toBeGreaterThanOrEqual(0); if (b.parent) expect(ids.indexOf(b.parent) < i, `${b.parent} before ${b.id}`).toBe(true); });
      for (const b of S.bones) expect(len(b), `${b.id} has length`).toBeGreaterThan(1e-4);
      // the family's fixed spine counts (a tail only where the body has one)
      expect(count(S, 'spine')).toBe(L.spine.trunk);
      expect(count(S, 'neck')).toBe(L.spine.neck);
      expect([0, L.spine.tail]).toContain(count(S, 'tail'));
      expect(ids).toContain('head');
      // every plan part rides bones that exist
      const plan = speciesPlan(id), known = new Set(ids);
      for (const p of plan.segments) {
        const b = S.bind[p.name]; expect(b, `${p.name} is bound`).toBeDefined();
        const named = typeof b === 'string' ? [b] : b.stations || [b.from, b.to];
        for (const n of named) expect(known.has(n), `${p.name} → ${n}`).toBe(true);
      }
      // left mirrors right
      for (const b of S.bones.filter((x) => x.id.endsWith('R') && x.parent && !/^(spine|neck|tail)\d/.test(x.id))) {
        const l = S.bones.find((x) => x.id === b.id.replace(/R$/, 'L'));
        expect(l, `${b.id} has a left`).toBeDefined();
        expect(l.head).toEqual([-b.head[0] + 0, b.head[1], b.head[2]]);
      }
      // limb roles by rig: four-legged rigs have both girdles, two-legged the hind, the body-wave none required
      const roles = new Set(S.bones.filter((b) => b.role).map((b) => b.role));
      const legs = RIGS[L.rig].legs;
      if (legs.includes('LH') || legs.includes('L')) expect(roles.has('hind.femur'), `${id} hind.femur`).toBe(true);
      if (legs.includes('LF') && L.rig !== 'wingwalker') expect(roles.has('fore.humerus'), `${id} fore.humerus`).toBe(true);
    });
  }

  it('is deterministic and leaves the plan alone', () => {
    for (const id of ['wolf', 'horse', 'snake', 'salmon', 'chicken', 'elasmosaurus']) {
      const before = JSON.stringify(speciesPlan(id));
      expect(JSON.stringify(faunaSkeleton(id))).toBe(JSON.stringify(faunaSkeleton(id)));
      expect(JSON.stringify(speciesPlan(id))).toBe(before);
    }
  });

  it('binds by region and by tube: the torso never rides the neck; a stripe rides its leg, a teat the body', () => {
    for (const id of Object.keys(SPECIES)) {
      const t = faunaSkeleton(id).bind.torso;
      if (t?.stations) for (const b of t.stations) expect(b, `${id} torso`).toMatch(/^(spine|tail)\d+$/);
    }
    expect(faunaSkeleton('zebra').bind.foreArmBand0R).toBe('foreArmR');
    expect(faunaSkeleton('dairyCow').bind.teatR).toMatch(/^(spine|tail)\d+$/);
    expect(faunaSkeleton('camel').bind.neckUp.stations.at(-1)).toBe('neck2');   // the lofted neck rises to the head
  });

  it('carves a tail only from an all-axis body', () => {
    expect(count(faunaSkeleton('salmon'), 'tail')).toBe(2);
    expect(count(faunaSkeleton('snake'), 'tail')).toBe(3);
    expect(count(faunaSkeleton('wombat'), 'tail')).toBe(0);   // no tail part, a four-legged body: no tail bones
  });

  it('unknown species: null', () => { expect(faunaSkeleton('unicorn')).toBeNull(); });
});
