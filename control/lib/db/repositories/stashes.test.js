// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../index.js';
import { StashRepository, _internals } from './stashes.js';

const { ITEM_TYPES } = _internals;

function reset() {
  const db = getDb();
  db.exec('DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes;');
}

describe('StashRepository', () => {
  beforeEach(() => reset());

  it('mints, lists, and renames stashes', () => {
    const s = StashRepository.mint({ title: 'Wax cylinder research' });
    expect(s.stashRef).toMatch(/^st_[0-9a-f]{12}$/);
    expect(s.title).toBe('Wax cylinder research');
    expect(s.status).toBe('open');

    const list = StashRepository.list();
    expect(list).toHaveLength(1);
    expect(list[0].stashRef).toBe(s.stashRef);

    const renamed = StashRepository.rename(s.stashRef, 'Cylinder phonograph history');
    expect(renamed.title).toBe('Cylinder phonograph history');

    expect(StashRepository.archive(s.stashRef)).toBe(true);
    expect(StashRepository.list({ status: 'archived' })).toHaveLength(1);
    expect(StashRepository.list({ status: 'open' })).toHaveLength(0);
  });

  it('rejects an unknown type at the gate', () => {
    const s = StashRepository.mint({ title: 'x' });
    expect(() =>
      StashRepository.gather({ stashRef: s.stashRef, type: 'audio', body: 'hi' }),
    ).toThrow(/not a valid stash item type/);
  });

  it('gathers each well-formed item type', () => {
    const s = StashRepository.mint({ title: 'mixed' });

    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'plain' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'markdown', bodyMd: '# hi' });
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'image',
      mediaRef: 'doc_abc',
      metadata: { mime: 'image/png', width: 100, height: 50, content_hash: 'sha256:deadbeef' },
    });
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'svg',
      bodySvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    });
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'script',
      body: 'console.log(1)',
      metadata: { language: 'js' },
    });
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'pointer',
      metadata: { node_ref: 'meta_node_42', label: 'Bot factory architecture node' },
    });
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'link',
      title: 'Edison archive',
      sourceUrl: 'https://example.org/edison',
    });

    const items = StashRepository.listItems(s.stashRef);
    expect(items).toHaveLength(7);
    expect(new Set(items.map((i) => i.type))).toEqual(ITEM_TYPES);
  });

  it('rejects per-type contract violations precisely', () => {
    const s = StashRepository.mint({ title: 'gate' });

    // text without body
    expect(() => StashRepository.gather({ stashRef: s.stashRef, type: 'text' })).toThrow(
      /non-empty `body`/,
    );

    // image missing required metadata
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'image',
        mediaRef: 'doc_x',
        metadata: { mime: 'image/png', width: 100, height: 100 }, // missing content_hash
      }),
    ).toThrow(/content_hash/);

    // image with wrong mime family
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'image',
        mediaRef: 'doc_x',
        metadata: {
          mime: 'application/pdf',
          width: 100,
          height: 100,
          content_hash: 'h',
        },
      }),
    ).toThrow(/image\//);

    // svg that doesn't look like XML
    expect(() =>
      StashRepository.gather({ stashRef: s.stashRef, type: 'svg', bodySvg: 'not actually svg' }),
    ).toThrow(/<\?xml or <svg/);

    // script with disallowed language
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'script',
        body: 'x',
        metadata: { language: 'rust' },
      }),
    ).toThrow(/language/);

    // pointer without node_ref
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'pointer',
        metadata: { label: 'no ref' },
      }),
    ).toThrow(/node_ref/);

    // link without source_url
    expect(() =>
      StashRepository.gather({ stashRef: s.stashRef, type: 'link', title: 'no url' }),
    ).toThrow(/source_url/);
  });

  it('mints drawers idempotently and gathers into them', () => {
    const s = StashRepository.mint({ title: 'organized' });
    const d1 = StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'primary' });
    const d2 = StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'primary' }); // same name
    expect(d1.id).toBe(d2.id);

    StashRepository.gather({
      stashRef: s.stashRef,
      drawer: 'primary',
      type: 'text',
      body: 'in the drawer',
    });
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'text',
      body: 'at the root',
    });

    expect(StashRepository.listItems(s.stashRef, { drawer: 'primary' })).toHaveLength(1);
    expect(StashRepository.listItems(s.stashRef, { drawer: null })).toHaveLength(1);
    expect(StashRepository.listItems(s.stashRef)).toHaveLength(2);
  });

  it('refuses to gather into a nonexistent drawer', () => {
    const s = StashRepository.mint({ title: 'x' });
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        drawer: 'never-minted',
        type: 'text',
        body: 'x',
      }),
    ).toThrow(/Drawer 'never-minted' does not exist/);
  });

  it('getFull returns drawers and items grouped by drawer name', () => {
    const s = StashRepository.mint({ title: 'full' });
    StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'A' });
    StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'B' });

    StashRepository.gather({ stashRef: s.stashRef, drawer: 'A', type: 'text', body: 'in A' });
    StashRepository.gather({ stashRef: s.stashRef, drawer: 'B', type: 'text', body: 'in B' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'at root' });

    const full = StashRepository.getFull(s.stashRef);
    expect(full.drawers.map((d) => d.name).sort()).toEqual(['A', 'B']);
    const byDrawer = Object.fromEntries(full.items.map((it) => [it.body, it.drawer]));
    expect(byDrawer['in A']).toBe('A');
    expect(byDrawer['in B']).toBe('B');
    expect(byDrawer['at root']).toBe(null);
  });

  it('returns null on unknown stash_ref', () => {
    expect(StashRepository.getByRef('st_nope')).toBe(null);
    expect(StashRepository.getFull('st_nope')).toBe(null);
    expect(StashRepository.rename('st_nope', 'x')).toBe(null);
  });
});
