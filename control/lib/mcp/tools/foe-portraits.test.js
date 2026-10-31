process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// The cast sheet's photographs: a foe whose figure no run has made is said, not photographed; a foe made by no step and
// standing on nothing (the stand-ins) is passed by; a world that fields none has none. (A photograph itself is the table
// game's photographer, tested there; it needs a browser.)
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import { foePortraits } from './foe-portraits.js';

beforeEach(() => { closeDb(); getDb(); });

const walk = { walk: { nodes: { a: { trail: {} } } } };
const world = (made) => ({ id: 'w', foes: { a: { class: 'walker' } }, levels: { one: { ...walk, foes: true } }, ...(made ? { made } : {}) });

describe('the cast sheet\'s photographs', () => {
  it('a figure not made yet is said, and nothing is photographed; a world without foes has none', async () => {
    const out = await foePortraits(world({ 'foes-a': { ref: 'w-foes-a', order: '0000000a', stored: '0000000b' } }));
    expect(out.portraits).toEqual({});
    expect(out.missing).toEqual([{ foe: 'a', why: expect.stringMatching(/not made yet/) }]);
    expect((await foePortraits(world())).missing).toEqual([]);
    expect(await foePortraits({ id: 'w', levels: { one: { ...walk } } })).toEqual({ portraits: {}, key: '', missing: [] });
  });
});
