/**
 * The level page's loader (export-game.js pageLoader): its banks fetched at once, their bytes counted as they stream in,
 * and the shell told how far it has got and what it is on (level-contract.js MSG_LOADING), the percent never going back,
 * then that it is building its world once every bank is in hand.
 */
import { describe, expect, it } from 'vitest';

import { pageLoader } from './export-game.js';
import { MSG_LOADING } from '../../graph/game/level-contract.js';

// (a page's script in a stub of its window: fetch serves each bank in chunks, the shell's messages kept)
async function run(banks, chunk = 7) {
  const said = [], sizes = Object.fromEntries(Object.entries(banks).map(([u, v]) => [u, Buffer.byteLength(JSON.stringify(v))]));
  const fetch = async (u) => {
    const bytes = new TextEncoder().encode(JSON.stringify(banks[u]));
    let o = 0;
    return { ok: true, status: 200, body: { getReader: () => ({ read: async () => (o >= bytes.length ? { done: true } : { done: false, value: bytes.slice(o, (o += chunk)) }) }) } };
  };
  const window = { parent: { postMessage: (m) => said.push(m) } };
  const get = new Function('window', 'fetch', `${pageLoader(sizes)}\nreturn __mojGet;`)(window, fetch);
  const got = {};
  for (const u of Object.keys(banks)) got[u] = await get(u);
  return { said, got };
}

describe('the level page\'s loader', () => {
  it('serves each bank as written, telling the shell how far it is in a percent that never goes back, then that it builds', async () => {
    const banks = { '../assets/geometry/groups-1.json': { faces: Array.from({ length: 40 }, (_, i) => i) }, '../assets/figures/person-1.json': { rig: true, bones: ['a', 'b'] } };
    const { said, got } = await run(banks);
    expect(got).toEqual(banks);
    expect(said.every((m) => m.moj === MSG_LOADING)).toBe(true);
    const pcs = said.map((m) => m.progress);
    expect(pcs[0]).toBe(10);
    expect(pcs.every((p, i) => i === 0 || p >= pcs[i - 1])).toBe(true);
    expect(said.some((m) => /^downloading the (world|people) · \d+ of \d+ MB$/.test(m.step))).toBe(true);
    expect(said.at(-1)).toEqual({ moj: MSG_LOADING, progress: 88, step: 'building the world' });
  });
});
