// THE WEAPON SHELF (weapon-shelf.js): a second weapon named by its row, `{ shelf }`, in a kit's weapons, its fields over
// the row's as an edit's; the hero that holds it made from its `held`. One row, picked in code: the concept, not the catalog.
import { describe, it, expect } from 'vitest';
import { WEAPON_SHELF, SHELF_IDS, shelfWeapon } from './weapon-shelf.js';
import { readGameArsenal, arsenalOfGame } from './arsenal.js';

const row = SHELF_IDS.find((id) => WEAPON_SHELF[id].held && WEAPON_SHELF[id].combos.length > 1);

describe('a weapon from the shelf', () => {
  it('is the row, its id the row\'s unless written, any field written laid over it', () => {
    const R = WEAPON_SHELF[row], W = shelfWeapon({ shelf: row });
    expect(W).toMatchObject({ id: row, name: R.name, held: R.held, reach: R.reach });
    const first = Object.keys(R.moves)[0], gone = R.combos[0].id;
    const E = shelfWeapon({ shelf: row, id: 'mine', name: 'Mine', reach: R.reach + 0.5, moves: { [first]: { damage: 9 } }, combos: [{ id: gone, drop: true }] });
    expect(E).toMatchObject({ id: 'mine', name: 'Mine', reach: R.reach + 0.5 });
    expect(E.moves[first]).toMatchObject({ ...R.moves[first], damage: 9 });
    expect(E.combos.some((c) => c.id === gone)).toBe(false);
    expect(shelfWeapon({ id: 'own', moves: {} })).toEqual({ id: 'own', moves: {} });
    expect(() => shelfWeapon({ shelf: 'no-such' })).toThrow(/weapon shelf/);
  });

  it('joins a template\'s kit or a whole kit, read as any weapon is, and the game\'s hero holds it', () => {
    const kit = { from: 'fallen-angel', weapons: [{ shelf: row }] };
    expect(() => readGameArsenal(kit)).not.toThrow();
    const A = arsenalOfGame({ arsenal: kit }).arsenal;
    expect(A.weapons.find((W) => W.id === row)).toMatchObject({ held: WEAPON_SHELF[row].held });
    expect(() => readGameArsenal({ from: 'fallen-angel', weapons: [{ shelf: 'no-such' }] })).toThrow(/weapon shelf/);
  });
});
