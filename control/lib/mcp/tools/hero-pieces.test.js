// hero-pieces.test.js — the outfit's designed pieces on a hero (layered.js designedPieces, sortPieces): a piece the
// outfit already wears is said and left off, never refused at the rig gate as a name worn twice; a piece built on a
// creature's landmarks says plainly that it is left off and why. The cases: a `belt` piece over the card that wears one
// (the card chosen in code: the first seeded card whose expansion wears a belt), and the medallion.
import { describe, expect, it } from 'vitest';

import { heroRecord, heroPlanOf, sortPieces, expandLayeredManifest } from './layered.js';
import { SEEDED_OUTFITS } from '../../graph/outfit/styles.js';
import { compileLayered } from '../../graph/polygonizer/station-loft.js';
import { bindLayered } from '../../graph/polygonizer/station-loft-rig.js';

const outfit = (style, pieces) => ({ type: 'outfit', style, pieces });
const belted = Object.keys(SEEDED_OUTFITS).find((style) => heroPlanOf(heroRecord({ cast: 'male', outfit: outfit(style, []) })).adorn?.some((A) => A.id === 'belt'));

describe('a hero\'s designed pieces', () => {
  it('a belt over a card that wears one: the card\'s is kept, the piece said and left off, and the hero binds', () => {
    expect(belted).toBeTruthy();
    const bare = heroPlanOf(heroRecord({ cast: 'male', outfit: outfit(belted, []) }));
    const { worn, unworn } = sortPieces(bare, { pieces: [{ kind: 'belt' }, { kind: 'satchel' }] }, { once: true });
    expect(worn.map((p) => p.kind)).toEqual(['satchel']);
    expect(unworn).toEqual([{ kind: 'belt', why: expect.stringMatching(/already wears a belt .*kept and this one left off/) }]);
    // (without `once`, a plan the pieces are already worn over: each piece read on its own, as before)
    expect(sortPieces(bare, { pieces: [{ kind: 'belt' }] }).unworn).toEqual([]);
    const hero = heroRecord({ cast: 'male', outfit: outfit(belted, [{ kind: 'belt' }]) }), ids = heroPlanOf(hero).adorn.map((A) => A.id);
    expect(ids.filter((id) => id === 'belt')).toHaveLength(1);
    const m = expandLayeredManifest({ kind: 'layered', hero });
    expect(() => bindLayered(compileLayered(m.recipe), m.recipe)).not.toThrow();
  });
  it('the medallion, built on a creature\'s neck chain: left off on a hero, and the readout says so plainly', () => {
    const bare = heroPlanOf(heroRecord({ cast: 'female', outfit: outfit(belted, []) }));
    const { worn, unworn } = sortPieces(bare, { pieces: [{ kind: 'medallion' }] }, { once: true });
    expect(worn).toEqual([]);
    expect(unworn).toEqual([{ kind: 'medallion', why: expect.stringMatching(/^its medallion hangs on a creature's landmarks .*so it is left off$/) }]);
  });
});
