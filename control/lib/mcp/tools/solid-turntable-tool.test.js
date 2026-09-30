// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * The solid turntable's mint. Claims under test: a crystal surface belongs to the crystal shape, and is refused on any
 * other (it used to mint ok and then fail every render); an unknown gem or cut is refused with the known lists instead
 * of being stored and spun as quartz.
 */
import { describe, expect, it } from 'vitest';

import { mintSolidTurntable } from './solid-turntable-tool.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';

describe('mint the solid turntable', () => {
  it('refuses a crystal surface on a shape that is not the crystal', () => {
    expect(() => mintSolidTurntable({ shape: 'octahedron', surface: 'crystal' })).toThrow(/surface 'crystal' is the crystal shape's own: give shape: 'crystal'.*vexar, solid, glow for a octahedron/);
    const r = mintSolidTurntable({ shape: 'crystal', surface: 'crystal', gem: 'ruby' });
    expect(r.stats.surface).toBe('crystal'); expect(SketchRepository.getByRef(r.ref).manifest.gem).toBe('ruby');
  });
  it('refuses a gem or cut the crystal does not know, naming the ones it does', () => {
    expect(() => mintSolidTurntable({ shape: 'crystal', gem: 'emerald' })).toThrow(/gem must be one of .*quartz.*\(got "emerald"\)/);
    expect(() => mintSolidTurntable({ shape: 'crystal', gem: 'ruby', cut: 'princess' })).toThrow(/cut must be one of natural, brilliant, cabochon \(got "princess"\)/);
    expect(mintSolidTurntable({ shape: 'crystal', gem: 'diamond', cut: 'brilliant' }).stats).toMatchObject({ gem: 'diamond', cut: 'brilliant' });
  });
});
