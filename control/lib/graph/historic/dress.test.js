import { describe, it, expect } from 'vitest';
import { wardrobeAt, cardOf } from './dress.js';
import { checkRecord } from './record.js';
import { HISTORIC_CULTURES } from './cultures/index.js';
import { historicOptions } from './historic-kind.js';
import { drawable } from './lineage.js';
import { DRESS } from './miniatures.js';

const shirts = (gs) => gs.map((g) => g.shirt);

describe('historic dress: what the people wear, read from the record at a year', () => {
  it('every culture\'s dress entries are sound, and every look covers the torso', () => {
    for (const [id, K] of Object.entries(HISTORIC_CULTURES)) {
      const dress = (K.record ? K.record.entries : []).filter((e) => e.kind === 'dress');
      expect(checkRecord(dress).filter((f) => f.level === 'error'), id).toEqual([]);
      for (const e of dress) for (const l of e.looks) expect(l.shirt, e.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('dresses every wearer of every culture from a record at its own year', () => {
    for (const id of Object.keys(HISTORIC_CULTURES)) {
      const W = wardrobeAt(id);
      for (const w of ['man', 'woman', 'hand']) { expect(W[w].length, `${id} ${w}`).toBeGreaterThan(0); expect(W.from[w], `${id} ${w}`).not.toBe('table'); }
    }
  });

  it('Pompeii at 79 wears every look of the hand-made table, and the cloak and the veil besides', () => {
    const W = wardrobeAt('pompeii', 79), strip = (gs) => gs.map(({ dress, ...g }) => g);
    for (const w of ['man', 'woman', 'hand']) expect(strip(W[w]).slice(0, DRESS.pompeii[w].length), w).toEqual(DRESS.pompeii[w]);
    expect(W.hand.some((g) => g.cloak)).toBe(true);
    expect(W.woman.some((g) => g.headwear === 'veil')).toBe(true);
    expect(W.man.some((g) => g.cloak)).toBe(false);   // the citizen's paenula is a 3rd-century fashion
    expect(wardrobeAt('pompeii', 250).man.some((g) => g.cloak)).toBe(true);
  });

  it('the cloaks and hats come and go with their spans', () => {
    expect(wardrobeAt('lindos', -400).man.some((g) => g.cloak)).toBe(true);    // the chlamys
    expect(wardrobeAt('lindos', -180).man.some((g) => g.cloak)).toBe(false);
    expect(wardrobeAt('lindos', -180).hand.some((g) => g.headwear === 'brim')).toBe(true);   // the petasos
    expect(wardrobeAt('qin', -212).hand.some((g) => g.headwear === 'cap')).toBe(true);       // the black headcloth
    expect(wardrobeAt('qin', -300).hand.some((g) => g.headwear)).toBe(false);
  });

  it('Rome: the toga everyday in the Republic, formal by 79; the stola gone by the 2nd century; trousers from 301', () => {
    const rep = wardrobeAt('pompeii', -100), flav = wardrobeAt('pompeii', 79), late = wardrobeAt('pompeii', 150), tet = wardrobeAt('pompeii', 320);
    const togas = (W) => W.man.filter((g) => g.dress.startsWith('rm-toga')).length;
    expect(togas(rep)).toBe(3);
    expect(togas(flav)).toBe(1);
    expect(flav.woman.some((g) => g.dress === 'rm-stola') && !flav.woman.some((g) => g.dress === 'rm-long-tunic')).toBe(true);
    expect(late.woman.some((g) => g.dress === 'rm-long-tunic') && !late.woman.some((g) => g.dress === 'rm-stola')).toBe(true);
    expect(tet.hand.some((g) => g.dress === 'rm-bracae') && !tet.hand.some((g) => g.dress === 'rm-work-tunic')).toBe(true);
  });

  it('draws what a culture does not record from the culture it draws its dress from, at the same year', () => {
    expect(wardrobeAt('forum', 79).from).toEqual({ man: 'pompeii', woman: 'pompeii', hand: 'pompeii' });
    expect(shirts(wardrobeAt('forum', 79).man)).toEqual(shirts(wardrobeAt('pompeii', 79).man));
    expect(wardrobeAt('thebes', -1250).from.man).toBe('thebes');
    expect(wardrobeAt('thebes', -2500).from).toEqual({ man: 'giza', woman: 'giza', hand: 'giza' });
    expect(wardrobeAt('pompeii', -600).from.man).toBe('lindos');   // before the Roman record starts: the Greek tradition
    expect(wardrobeAt('pompeii', -2000).from.man).toBe('table');   // nothing recorded anywhere it draws from
  });

  it('Greece: the Archaic man\'s long chiton; the Hellenistic woman out of the peplos', () => {
    expect(wardrobeAt('lindos', -600).man.every((g) => g.cut === 'ankle')).toBe(true);
    expect(wardrobeAt('lindos', -180).woman.some((g) => g.dress === 'gr-peplos')).toBe(false);
    expect(wardrobeAt('lindos', -400).woman.some((g) => g.dress === 'gr-peplos')).toBe(true);
  });

  it('Sumer: net skirts in the Uruk period, the kaunakes in the Early Dynastic, the fringed shawl under Akkad', () => {
    expect(wardrobeAt('sumer', -3200).man.every((g) => g.dress === 'su-net-skirt')).toBe(true);
    expect(wardrobeAt('sumer', -2500).man.every((g) => ['su-kaunakes', 'su-sheepskin'].includes(g.dress))).toBe(true);
    expect(wardrobeAt('sumer', -2300).man.some((g) => g.dress === 'su-fringed-shawl')).toBe(true);
  });

  it('a land names its culture (the farm\'s and the works\' egypt is Thebes)', () => {
    expect(cardOf('egypt')[0]).toBe('thebes');
    expect(wardrobeAt('egypt').from.man).toBe('thebes');
  });

  it('the lineage brief lists the dress a relation carries', () => {
    const forum = drawable('forum').find((r) => r.from === 'pompeii');
    expect(forum.dress.map((e) => e.id)).toContain('rm-toga');
  });

  it('the historic kind takes people.year, a whole year with no year 0', () => {
    expect(historicOptions({ culture: 'pompeii', people: { year: -100 } }).opts.people.year).toBe(-100);
    expect(() => historicOptions({ culture: 'pompeii', people: { year: 0 } })).toThrow(/people.year/);
    expect(() => historicOptions({ culture: 'pompeii', people: { year: 1.5 } })).toThrow(/people.year/);
  });
});
