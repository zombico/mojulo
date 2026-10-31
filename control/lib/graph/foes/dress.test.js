// A person's dress: the words read and refused by name, the order the hero door makes it from (the faction's dress, the
// crew's colours, the same seed the same soldier), the pack's baked light left off, the realistic body on its word. One
// faction and one kind, chosen in code from the pack.
import { describe, it, expect } from 'vitest';
import { readDress, dressOrders, lookOfDress, DRESS_BODIES } from './dress.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { resolveFoe } from './resolve.js';
import { FOE_CLASSES } from './index.js';
import { fitOfPeople } from './fit.js';

const faction = Object.keys(GRUNT_STYLES).find((f) => Object.keys(GRUNT_STYLES[f].colourways).length > 1);
const F = GRUNT_STYLES[faction], kind = Object.keys(F.kinds)[0], colourway = Object.keys(F.colourways)[1];
const skin = { people: 'human', dress: { faction, kind, colourway } };

describe('a dress', () => {
  it('reads its words, refusing a faction, a kind, a colourway or a body it does not have, by name', () => {
    expect(readDress({ faction, kind })).toEqual({ faction, kind });
    expect(() => readDress({ faction: 'pirates' })).toThrow(/no faction 'pirates'/);
    expect(() => readDress({ faction, kind: 'astronaut' })).toThrow(/has no 'astronaut'/);
    expect(() => readDress({ faction, colourway: 'tartan' })).toThrow(/wears/);
    expect(() => readDress({ faction, body: 'clay' })).toThrow(new RegExp(DRESS_BODIES.join(' \\| ')));
    expect(() => readDress({ faction, hat: true })).toThrow(/not a dress setting/);
  });

  it('orders the hero door\'s grunt in its kind\'s dress and its crew\'s colours, the same seed the same soldier', () => {
    const O = dressOrders(skin, { seed: 9, tradition: 'western', title: 'w a' });
    expect(O.grunt).toMatchObject({ style: faction, kind, colourway });
    expect(O.mint).toMatchObject({ kind: 'layered', via: 'hero', title: 'w a', spec: { outfit: { type: 'outfit' } } });
    expect(O.mint.spec.palette).toMatchObject(F.colourways[colourway].palette);
    expect(dressOrders(skin, { seed: 9, tradition: 'western' })).toEqual(dressOrders(skin, { seed: 9, tradition: 'western' }));
    // (the pack's western stop bakes its own golden light; a foe stands in its world's)
    expect(lookOfDress(undefined, 'western')).toBe('dcau-golden');
    expect(O.mint.spec.geocube).toBeUndefined();
    expect(dressOrders({ ...skin, dress: { ...skin.dress, body: 'realistic' } }, { seed: 9 }).mint.spec.form).toBe('realistic');
  });

  it('a dressed person stands on any class a person fits', () => {
    const cls = Object.values(FOE_CLASSES).find((c) => fitOfPeople(c.id, { people: 'human' }).ok);
    expect(resolveFoe({ class: cls.id, skin }).skin).toMatchObject({ people: 'human', dress: { faction } });
  });
});
