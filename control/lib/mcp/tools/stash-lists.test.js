// The lists of stashes and cooks are their getters with no ref (list_stashes / list_cooks, the folded names, answer the same).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { mintStashHandler, getStashHandler, listStashesHandler } from './stash-mode.js';
import { getCookHandler, listCooksHandler } from './cook.js';

beforeEach(() => closeDb());

describe('get_stash / get_cook — one by ref, or the list', () => {
  it('get_stash with no stash_ref lists the stashes, by status; with one it reads it', async () => {
    const a = await mintStashHandler({ title: 'notes' });
    await mintStashHandler({ title: 'more notes' });
    expect(await getStashHandler({})).toEqual(await listStashesHandler({}));
    expect((await getStashHandler()).total).toBe(2);
    expect((await getStashHandler({ status: 'archived' })).total).toBe(0);
    expect((await getStashHandler({ stash_ref: a.stash_ref })).stash_ref).toBe(a.stash_ref);
    await expect(getStashHandler({ stash_ref: 7 })).rejects.toThrow(/omit it for the list of stashes/);
  });

  it('get_cook with no cook_ref is the outcomes inbox', async () => {
    expect(await getCookHandler({})).toEqual(await listCooksHandler({}));
    expect((await getCookHandler({ status: 'all', limit: 5 })).total).toBe(0);
    await expect(getCookHandler({ cook_ref: 7 })).rejects.toThrow(/omit it for the outcomes inbox/);
  });
});
