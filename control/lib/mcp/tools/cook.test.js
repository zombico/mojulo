// End-to-end test for the `cook` MCP handler: real SQLite (in-memory), real
// filesystem (temp dir), real markdown renderer. The MCP transport itself is
// not exercised — the handler is the boundary that matters.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb } from '../../db/index.js';
import { StashRepository } from '../../db/repositories/stashes.js';
import { CookRepository } from '../../db/repositories/cooks.js';
import { cookHandler, getCookHandler, listCooksHandler } from './cook.js';

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-cook-e2e-'));
  process.env.MOJULO_OUTCOMES_DIR = tmpRoot;
  // Clear all slice-2 + slice-1 rows between tests.
  const db = getDb();
  db.exec(
    'DELETE FROM stash_cooks; DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes;',
  );
});

afterEach(async () => {
  delete process.env.MOJULO_OUTCOMES_DIR;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('cook handler — end to end', () => {
  it('cooks across two stashes with cleaved + whole slices, materializes the folder, inserts a row', async () => {
    const a = StashRepository.mint({ title: 'Plan paradigm notes' });
    const b = StashRepository.mint({ title: 'Stash paradigm notes' });
    const aItem1 = StashRepository.gather({ stashRef: a.stashRef, type: 'text', body: 'plans converge' });
    const aItem2 = StashRepository.gather({ stashRef: a.stashRef, type: 'text', body: 'plans compile' });
    StashRepository.gather({ stashRef: a.stashRef, type: 'text', body: 'unused-in-slice' });
    StashRepository.gather({ stashRef: b.stashRef, type: 'text', body: 'stashes accrete' });

    const result = await cookHandler({
      slices: [
        { stash_ref: a.stashRef, item_ids: [aItem1.id, aItem2.id] }, // cleaved
        { stash_ref: b.stashRef }, // whole-stash
      ],
      aim: 'How does Cook differ from forge_plan?',
      report_md:
        '# Findings\n\nCook **emits** an outcome artifact; forge_plan **seals** a plan. Different dispositions.\n\n- Cook: divergent\n- forge_plan: convergent',
      suggested_lens: 'collider',
      visuals: [
        {
          filename: 'shape.svg',
          type: 'svg',
          body:
            '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="purple"/></svg>',
          caption: 'A circle',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.cook_ref).toMatch(/^cook_[0-9a-f]{12}$/);
    expect(result.outcome_url).toBe(`/outcomes/${result.cook_ref}/`);
    expect(result.suggested_lens).toBe('collider');
    expect(result.file_count).toBeGreaterThan(0);

    // Row landed with the slice manifest verbatim.
    const row = CookRepository.getByRef(result.cook_ref);
    expect(row.aim).toBe('How does Cook differ from forge_plan?');
    expect(row.slices).toEqual([
      { stash_ref: a.stashRef, item_ids: [aItem1.id, aItem2.id] },
      { stash_ref: b.stashRef },
    ]);
    expect(row.stashRefs).toEqual([a.stashRef, b.stashRef]);
    expect(row.suggestedLens).toBe('collider');

    // Folder is on disk with the expected files.
    const files = (await fs.readdir(result.outcome_dir)).sort();
    expect(files).toEqual(['index.html', 'manifest.json', 'report.md', 'shape.svg']);

    // index.html: report rendered, SVG inlined, slice chips correct.
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('<strong>emits</strong>');
    expect(html).toContain('<strong>seals</strong>');
    expect(html).toContain('fill="purple"');
    expect(html).toContain('Plan paradigm notes');
    expect(html).toContain('2 of 3 items'); // cleaved slice
    expect(html).toContain('whole · 1 item'); // whole-stash slice (b)

    // manifest carries the resolved slice manifest including item_ids.
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.aim).toBe('How does Cook differ from forge_plan?');
    expect(manifest.slices[0]).toMatchObject({
      stash_ref: a.stashRef,
      whole: false,
      item_count: 2,
      item_ids: [aItem1.id, aItem2.id],
      total: 3,
    });
    expect(manifest.slices[1]).toMatchObject({ stash_ref: b.stashRef, whole: true, item_count: 1 });

    // get_cook round-trips.
    const fetched = await getCookHandler({ cook_ref: result.cook_ref });
    expect(fetched.cook_ref).toBe(result.cook_ref);
    expect(fetched.aim).toBe('How does Cook differ from forge_plan?');
    expect(fetched.slices).toEqual(row.slices);
    expect(fetched.stash_refs).toEqual([a.stashRef, b.stashRef]);

    // list_cooks sees it.
    const listed = await listCooksHandler({});
    expect(listed.total).toBe(1);
    expect(listed.cooks[0].cook_ref).toBe(result.cook_ref);
    expect(listed.cooks[0].slice_count).toBe(2);
  });

  it('refuses to cook against an unknown stash_ref', async () => {
    await expect(
      cookHandler({
        slices: [{ stash_ref: 'st_does_not_exist' }],
        aim: 'q',
        report_md: '# r',
      }),
    ).rejects.toThrow(/not found/);
  });

  it('refuses to cook against an item_id not in the named stash', async () => {
    const a = StashRepository.mint({ title: 'A' });
    const b = StashRepository.mint({ title: 'B' });
    const bItem = StashRepository.gather({ stashRef: b.stashRef, type: 'text', body: 'b-only' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: a.stashRef, item_ids: [bItem.id] }],
        aim: 'q',
        report_md: 'r',
      }),
    ).rejects.toThrow(/not an item in stash/);
  });

  it('requires slices, aim, and report_md', async () => {
    await expect(cookHandler({ slices: [], aim: 'q', report_md: 'r' })).rejects.toThrow(/slices/);
    const s = StashRepository.mint({ title: 'x' });
    await expect(cookHandler({ slices: [{ stash_ref: s.stashRef }], aim: '', report_md: 'r' })).rejects.toThrow(/aim/);
    await expect(cookHandler({ slices: [{ stash_ref: s.stashRef }], aim: 'q', report_md: '' })).rejects.toThrow(/report_md/);
  });

  it('rejects malformed slice shapes', async () => {
    const s = StashRepository.mint({ title: 'x' });
    await expect(cookHandler({ slices: [{}], aim: 'q', report_md: 'r' })).rejects.toThrow(/stash_ref string/);
    await expect(
      cookHandler({ slices: [{ stash_ref: s.stashRef, item_ids: [] }], aim: 'q', report_md: 'r' }),
    ).rejects.toThrow(/item_ids/);
    await expect(
      cookHandler({ slices: [{ stash_ref: s.stashRef, item_ids: ['not-an-int'] }], aim: 'q', report_md: 'r' }),
    ).rejects.toThrow(/integers/);
  });

  it('rejects an unknown suggested_lens', async () => {
    const s = StashRepository.mint({ title: 'x' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        report_md: 'r',
        suggested_lens: 'made_up_lens',
      }),
    ).rejects.toThrow(/suggested_lens/);
  });
});
