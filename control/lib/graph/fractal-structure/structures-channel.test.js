import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { structureFaces } from './index.js';

// the smallest world the channel can ride: two chambers and a tunnel
const DUNGEON = {
  kind: 'dungeon',
  chambers: [{ id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 }, { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 }],
  tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }],
};
const resolve = (manifest) => resolveWorldScene({ ref: 'sk_structures', title: 'structures', manifest });

describe('the structures world channel', () => {
  it('absent, the world is untouched; present, exactly the structures\' faces join it', async () => {
    const bare = (await resolve(DUNGEON)).payload;
    const list = [{ preset: 'turning', at: [30, 0], size: 6 }];
    const withIt = (await resolve({ ...DUNGEON, structures: list })).payload;
    const own = structureFaces(list).faces;
    expect(withIt.faces.length).toBe(bare.faces.length + own.length);
    expect(withIt.faces.slice(0, bare.faces.length)).toEqual(bare.faces);
    expect(withIt.faces.filter((f) => String(f.group).startsWith('structure:')).length).toBe(own.length);
    expect(JSON.stringify((await resolve(DUNGEON)).payload)).toBe(JSON.stringify(bare));
  });

  it('refuses a structure whose words do not read, pointing at the card', async () => {
    await expect(resolve({ ...DUNGEON, structures: [{ preset: 'cathedral', at: [0, 0] }] })).rejects.toThrow(/get_view_vocab\(\{ id: 'structures' \}\)[\s\S]*preset: one of/);
  });
});
