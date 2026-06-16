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
  db.exec(
    'DELETE FROM stash_bindings; DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes; DELETE FROM stash_cooks;',
  );
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
    StashRepository.gather({
      stashRef: s.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: 'sk_abc123def0', label: 'Volumizer flow diagram' },
    });

    const items = StashRepository.listItems(s.stashRef);
    expect(items).toHaveLength(8);
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

    // sketch without sketch_ref
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'sketch',
        metadata: { label: 'no ref' },
      }),
    ).toThrow(/sketch_ref/);

    // sketch with badly-shaped ref
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'sketch',
        metadata: { sketch_ref: 'definitely-not-a-sketch', label: 'x' },
      }),
    ).toThrow(/sk_/);

    // sketch missing label
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'sketch',
        metadata: { sketch_ref: 'sk_abc123def0' },
      }),
    ).toThrow(/label/);
  });

  it('accepts an optional body_md caption on a sketch item (picture-book pages)', () => {
    const s = StashRepository.mint({ title: 'picture book' });
    const caption = 'Once upon a time, a fox who would not share met a hungry crow.';
    const item = StashRepository.gather({
      stashRef: s.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: 'sk_abc123def0', label: 'page 1' },
      bodyMd: caption,
    });
    expect(item.type).toBe('sketch');
    expect(item.bodyMd).toBe(caption);
    expect(item.metadata.sketch_ref).toBe('sk_abc123def0');

    // round-trip via list
    const fetched = StashRepository.listItems(s.stashRef);
    expect(fetched).toHaveLength(1);
    expect(fetched[0].bodyMd).toBe(caption);
  });

  it('rejects a non-string body_md on a sketch item', () => {
    const s = StashRepository.mint({ title: 'bad caption' });
    expect(() =>
      StashRepository.gather({
        stashRef: s.stashRef,
        type: 'sketch',
        metadata: { sketch_ref: 'sk_abc123def0', label: 'p' },
        bodyMd: { not: 'a string' },
      }),
    ).toThrow(/body_md must be a string/);
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

  // ---------------------------------------------------------------------------
  // citable-atom verbs — update_item / archive_item
  // (lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md step 1)
  // ---------------------------------------------------------------------------

  it('updateItem mutates body and metadata in place, gate re-runs', () => {
    const s = StashRepository.mint({ title: 'mutable' });
    const original = StashRepository.gather({
      stashRef: s.stashRef,
      type: 'markdown',
      title: 'note',
      bodyMd: '# first draft',
    });

    const updated = StashRepository.updateItem({
      itemId: original.id,
      bodyMd: '# second draft',
      title: 'note (revised)',
    });
    expect(updated.id).toBe(original.id);
    expect(updated.bodyMd).toBe('# second draft');
    expect(updated.title).toBe('note (revised)');

    // gate must reject an update that violates the type contract
    expect(() =>
      StashRepository.updateItem({ itemId: original.id, bodyMd: '' }),
    ).toThrow(/non-empty `body_md`/);
  });

  it('updateItem on svg revalidates the XML-shape rule', () => {
    const s = StashRepository.mint({ title: 'svg-mut' });
    const item = StashRepository.gather({
      stashRef: s.stashRef,
      type: 'svg',
      bodySvg: '<svg><rect/></svg>',
    });
    expect(() =>
      StashRepository.updateItem({ itemId: item.id, bodySvg: 'not actually svg' }),
    ).toThrow(/<\?xml or <svg/);
    const ok = StashRepository.updateItem({
      itemId: item.id,
      bodySvg: '<?xml version="1.0"?><svg><circle/></svg>',
    });
    expect(ok.body).toMatch(/circle/);
  });

  it('updateItem on image re-validates required metadata', () => {
    const s = StashRepository.mint({ title: 'img-mut' });
    const item = StashRepository.gather({
      stashRef: s.stashRef,
      type: 'image',
      mediaRef: 'doc_a',
      metadata: { mime: 'image/png', width: 10, height: 10, content_hash: 'h1' },
    });
    // Sending metadata: {} drops required keys → gate rejects
    expect(() =>
      StashRepository.updateItem({ itemId: item.id, metadata: {} }),
    ).toThrow(/content_hash|width|height|mime/);
  });

  it('archiveItem soft-deletes and hides from default list', () => {
    const s = StashRepository.mint({ title: 'archive' });
    const it1 = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'keep' });
    const it2 = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'archive' });

    const result = StashRepository.archiveItem({ itemId: it2.id });
    expect(result.archived).toBe(true);
    expect(result.alreadyArchived).toBe(false);

    // Default list hides archived
    const visible = StashRepository.listItems(s.stashRef);
    expect(visible.map((i) => i.id)).toEqual([it1.id]);
    expect(StashRepository.countItems(s.stashRef)).toBe(1);

    // includeArchived surfaces them
    const all = StashRepository.listItems(s.stashRef, { includeArchived: true });
    expect(all).toHaveLength(2);
    expect(StashRepository.countItems(s.stashRef, { includeArchived: true })).toBe(2);

    // getItemById always resolves (citable-atoms posture)
    const resolved = StashRepository.getItemById(it2.id);
    expect(resolved.id).toBe(it2.id);
    expect(resolved.archivedAt).toBeGreaterThan(0);
  });

  it('archiveItem is idempotent on already-archived items', () => {
    const s = StashRepository.mint({ title: 'idem' });
    const item = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    StashRepository.archiveItem({ itemId: item.id });
    const second = StashRepository.archiveItem({ itemId: item.id });
    expect(second.archived).toBe(false);
    expect(second.alreadyArchived).toBe(true);
  });

  it('scanItemReferences finds cooks that cite the item id in slice manifest', () => {
    const s = StashRepository.mint({ title: 'cited' });
    const cited = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'a' });
    const uncited = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'b' });

    // Fake a cook row directly — we don't need the cook repo for this test.
    const db = getDb();
    db.prepare(
      `INSERT INTO stash_cooks (cook_ref, slices_json, aim, outcome_dir)
       VALUES (?, ?, ?, ?)`,
    ).run(
      'cook_abc',
      JSON.stringify([{ stash_ref: s.stashRef, item_ids: [cited.id] }]),
      'test',
      '/tmp/test',
    );
    // Whole-stash slice (no item_ids) does NOT count — it's not a per-item cite.
    db.prepare(
      `INSERT INTO stash_cooks (cook_ref, slices_json, aim, outcome_dir)
       VALUES (?, ?, ?, ?)`,
    ).run('cook_whole', JSON.stringify([{ stash_ref: s.stashRef }]), 'test', '/tmp/test');

    expect(StashRepository.scanItemReferences(cited.id).cooks).toEqual(['cook_abc']);
    expect(StashRepository.scanItemReferences(uncited.id).cooks).toEqual([]);
  });

  it('getFull excludes archived items by default but surfaces them with includeArchived', () => {
    const s = StashRepository.mint({ title: 'full-archive' });
    const a = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'live' });
    const b = StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'gone' });
    StashRepository.archiveItem({ itemId: b.id });

    const defaultView = StashRepository.getFull(s.stashRef);
    expect(defaultView.items.map((i) => i.id)).toEqual([a.id]);

    const fullView = StashRepository.getFull(s.stashRef, { includeArchived: true });
    expect(fullView.items.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('updateItem throws on unknown item id', () => {
    expect(() =>
      StashRepository.updateItem({ itemId: 99999, bodyMd: 'x' }),
    ).toThrow(/not found/);
  });

  it('archiveItem throws on unknown item id', () => {
    expect(() => StashRepository.archiveItem({ itemId: 99999 })).toThrow(/not found/);
  });

  // ---------------------------------------------------------------------------
  // adjacency layer — stash_bindings
  // (lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md step 2)
  // ---------------------------------------------------------------------------

  it('binds a stash to a bot and lists in both directions', () => {
    const a = StashRepository.mint({ title: 'corpus' });
    const b = StashRepository.mint({ title: 'sidekick' });
    const binding = StashRepository.bind({
      stashRef: a.stashRef,
      boundKind: 'bot',
      boundRef: 'dep_xyz',
      role: 'corpus',
    });
    StashRepository.bind({ stashRef: b.stashRef, boundKind: 'bot', boundRef: 'dep_xyz' });
    expect(binding.boundKind).toBe('bot');
    expect(binding.boundRef).toBe('dep_xyz');
    expect(binding.role).toBe('corpus');

    // forward: bindings for stash a
    const forward = StashRepository.listBindings({ stashRef: a.stashRef });
    expect(forward).toHaveLength(1);
    expect(forward[0].boundRef).toBe('dep_xyz');

    // reverse: stashes linked to dep_xyz — both stashes show up
    const reverse = StashRepository.listBindings({ boundKind: 'bot', boundRef: 'dep_xyz' });
    expect(reverse.map((r) => r.stashRef).sort()).toEqual([a.stashRef, b.stashRef].sort());
  });

  it('bind is idempotent on PK; rebind updates the role', () => {
    const s = StashRepository.mint({ title: 'rebind' });
    StashRepository.bind({ stashRef: s.stashRef, boundKind: 'plan', boundRef: 'plan_1', role: 'working_memory' });
    StashRepository.bind({ stashRef: s.stashRef, boundKind: 'plan', boundRef: 'plan_1', role: 'reference' });
    const bindings = StashRepository.listBindings({ stashRef: s.stashRef });
    expect(bindings).toHaveLength(1);
    expect(bindings[0].role).toBe('reference');
  });

  it('rejects unknown bound_kind and role', () => {
    const s = StashRepository.mint({ title: 'gated' });
    expect(() =>
      StashRepository.bind({ stashRef: s.stashRef, boundKind: 'unicorn', boundRef: 'x' }),
    ).toThrow(/bound_kind 'unicorn' is not valid/);
    expect(() =>
      StashRepository.bind({
        stashRef: s.stashRef,
        boundKind: 'plan',
        boundRef: 'plan_1',
        role: 'pantry',
      }),
    ).toThrow(/role 'pantry' is not valid/);
  });

  it('unbind drops the row and is graceful on missing rows', () => {
    const s = StashRepository.mint({ title: 'unbinder' });
    StashRepository.bind({ stashRef: s.stashRef, boundKind: 'app', boundRef: 'app_a' });
    expect(
      StashRepository.unbind({ stashRef: s.stashRef, boundKind: 'app', boundRef: 'app_a' }),
    ).toBe(true);
    expect(
      StashRepository.unbind({ stashRef: s.stashRef, boundKind: 'app', boundRef: 'app_a' }),
    ).toBe(false);
    expect(StashRepository.listBindings({ stashRef: s.stashRef })).toHaveLength(0);
  });

  it('cascade-deletes bindings when the stash is hard-deleted', () => {
    // stash archive is soft, but if we ever hard-delete a stash row the FK
    // cascade should clean up its bindings.
    const s = StashRepository.mint({ title: 'cascading' });
    StashRepository.bind({ stashRef: s.stashRef, boundKind: 'bot', boundRef: 'dep_z' });
    const db = getDb();
    db.prepare('DELETE FROM stashes WHERE stash_ref = ?').run(s.stashRef);
    expect(
      StashRepository.listBindings({ boundKind: 'bot', boundRef: 'dep_z' }),
    ).toHaveLength(0);
  });

  it('tolerates dangling bound_ref (no FK validation)', () => {
    // Deliberate substrate posture: bindings are navigational, not enforced.
    const s = StashRepository.mint({ title: 'dangling' });
    const binding = StashRepository.bind({
      stashRef: s.stashRef,
      boundKind: 'bot',
      boundRef: 'dep_definitely_not_a_real_bot',
    });
    expect(binding.boundRef).toBe('dep_definitely_not_a_real_bot');
  });

  it('listBindings with no filter returns everything', () => {
    const a = StashRepository.mint({ title: 'a' });
    const b = StashRepository.mint({ title: 'b' });
    StashRepository.bind({ stashRef: a.stashRef, boundKind: 'plan', boundRef: 'plan_1' });
    StashRepository.bind({ stashRef: b.stashRef, boundKind: 'bot', boundRef: 'dep_1' });
    const all = StashRepository.listBindings();
    expect(all).toHaveLength(2);
  });

  it('accepts sketch as a binding kind (the adjacency-layer extension)', () => {
    const s = StashRepository.mint({ title: 'adjacent' });
    const binding = StashRepository.bind({
      stashRef: s.stashRef,
      boundKind: 'sketch',
      boundRef: 'sk_abc123def0',
      role: 'reference',
    });
    expect(binding.boundKind).toBe('sketch');
    expect(binding.boundRef).toBe('sk_abc123def0');
    const reverse = StashRepository.listBindings({
      boundKind: 'sketch',
      boundRef: 'sk_abc123def0',
    });
    expect(reverse).toHaveLength(1);
    expect(reverse[0].stashRef).toBe(s.stashRef);
  });

  it('listBindings rejects an invalid boundKind filter', () => {
    expect(() => StashRepository.listBindings({ boundKind: 'something' })).toThrow(
      /bound_kind 'something' is not valid/,
    );
  });

  // ---------------------------------------------------------------------------
  // view-layer verbs — unarchive / renameDrawer / moveItem
  // (lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md step 1)
  // ---------------------------------------------------------------------------

  it('unarchive flips an archived stash back to open', () => {
    const s = StashRepository.mint({ title: 'flip' });
    StashRepository.archive(s.stashRef);
    expect(StashRepository.unarchive(s.stashRef)).toBe(true);
    expect(StashRepository.getByRef(s.stashRef).status).toBe('open');
    // idempotent on already-open
    expect(StashRepository.unarchive(s.stashRef)).toBe(false);
  });

  it('renameDrawer scoped to (stashRef, oldName); throws on collision', () => {
    const s = StashRepository.mint({ title: 'rename-drawer' });
    StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'foo' });
    StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'bar' });
    const renamed = StashRepository.renameDrawer({
      stashRef: s.stashRef,
      oldName: 'foo',
      newName: 'baz',
    });
    expect(renamed.name).toBe('baz');
    const names = StashRepository.listDrawers(s.stashRef).map((d) => d.name).sort();
    expect(names).toEqual(['bar', 'baz']);

    expect(() =>
      StashRepository.renameDrawer({ stashRef: s.stashRef, oldName: 'bar', newName: 'baz' }),
    ).toThrow(/already exists/);

    // no-op on identical names
    const sameAgain = StashRepository.renameDrawer({
      stashRef: s.stashRef,
      oldName: 'baz',
      newName: 'baz',
    });
    expect(sameAgain.name).toBe('baz');

    // null on unknown source
    expect(
      StashRepository.renameDrawer({ stashRef: s.stashRef, oldName: 'never', newName: 'whatever' }),
    ).toBe(null);
  });

  it('moveItem moves between drawers, to root, and rejects cross-stash moves', () => {
    const s = StashRepository.mint({ title: 'movable' });
    StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'A' });
    StashRepository.mintDrawer({ stashRef: s.stashRef, name: 'B' });
    const item = StashRepository.gather({
      stashRef: s.stashRef,
      drawer: 'A',
      type: 'text',
      body: 'travel',
    });

    const moved = StashRepository.moveItem({
      stashRef: s.stashRef,
      itemId: item.id,
      drawer: 'B',
    });
    expect(moved.drawerId).not.toBeNull();
    expect(StashRepository.listItems(s.stashRef, { drawer: 'B' })).toHaveLength(1);

    // back to root
    const movedRoot = StashRepository.moveItem({
      stashRef: s.stashRef,
      itemId: item.id,
      drawer: null,
    });
    expect(movedRoot.drawerId).toBeNull();

    // unknown target drawer
    expect(() =>
      StashRepository.moveItem({ stashRef: s.stashRef, itemId: item.id, drawer: 'nope' }),
    ).toThrow(/does not exist/);

    // cross-stash rejection
    const other = StashRepository.mint({ title: 'other' });
    expect(() =>
      StashRepository.moveItem({ stashRef: other.stashRef, itemId: item.id, drawer: null }),
    ).toThrow(/does not belong to stash/);
  });
});
