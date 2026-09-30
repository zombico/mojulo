process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import { mintSolidHandler } from './mint-solid.js';

// Two armour paths that used to reach an internal error: a head piece on the anime head (its helm is addressed
// on the landmark cranium), and a theme named for an Object prototype key. Both refuse by name.
describe('armour on the hero door refuses by name', () => {
  const hero = (spec) => mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', ...spec } });

  it('a helm, a kabuto or a theme helm on the anime head names the head piece and the heads it fits', async () => {
    for (const adorn of [
      { type: 'armor', style: 'armored-hero', dials: { coverage: 0 } },
      { type: 'armor', style: 'aka' },
      { type: 'armor', style: 'knight', theme: 'death-knight' },
    ]) {
      await expect(hero({ head: 'anime', adorn })).rejects.toThrow(/head piece .* is not fitted to the anime head yet; wear it with head 'landmark' or 'none'/);
    }
  }, 120_000);

  it('the same armour on the landmark head, and plate with no head piece on the anime head, still mint', async () => {
    expect((await hero({ adorn: { type: 'armor', style: 'aka' } })).ok).toBe(true);
    expect((await hero({ head: 'anime', adorn: { type: 'armor', style: 'knight' } })).ok).toBe(true);
  }, 120_000);

  it('a theme named for an Object prototype key is not a theme', async () => {
    for (const theme of ['constructor', 'toString', '__proto__']) {
      await expect(hero({ adorn: { type: 'armor', style: 'knight', theme } })).rejects.toThrow(new RegExp(`adorn\\.theme: '${theme}' is not a theme`));
    }
  }, 120_000);
});
