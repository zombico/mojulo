import { describe, expect, it } from 'vitest';

import { FOE_CLASSES } from './index.js';
import { bodyOf, fitOf, fitOfPeople, fitOfModel, topologyOf, TOPOLOGIES } from './fit.js';
import { isKin } from './packs.js';
import { PEOPLE } from './people.js';

describe('a foe body\'s topology: the shape the shelves that move it key it by', () => {
  it('a species by what holds it up, wings first; one case per support, picked from the classes\' stand-ins', () => {
    const species = [...new Set(Object.values(FOE_CLASSES).map((c) => c.standIn))];
    const bySupport = {};
    for (const s of species) { const b = bodyOf(s); (bySupport[b.wings ? 'wings' : b.support] ??= s); }
    for (const [support, s] of Object.entries(bySupport)) {
      const t = topologyOf(bodyOf(s));
      expect(TOPOLOGIES, `${s} (${support})`).toContain(t);
      if (support === 'wings') expect(t).toBe('winged');
      if (support === 'four') expect(t).toBe('quadruped');
    }
  });

  it('a people is a person or a kin, a model a person; every fit carries its body\'s topology', () => {
    const kin = PEOPLE.find((p) => isKin(p)), person = PEOPLE.find((p) => !isKin(p));
    const cls = Object.keys(FOE_CLASSES).find((c) => fitOfPeople(c, { people: kin }).ok);
    expect(fitOfPeople(cls, { people: kin }).body.topology).toBe('kin');
    expect(fitOfPeople(cls, { people: person }).body.topology).toBe('person');
    expect(fitOfModel(cls, { meshRef: 'm', height: 1.8 }).body.topology).toBe('person');
    const c0 = Object.values(FOE_CLASSES)[0];
    expect(fitOf(c0.id, c0.standIn).body.topology).toBe(topologyOf(bodyOf(c0.standIn)));
  });
});
