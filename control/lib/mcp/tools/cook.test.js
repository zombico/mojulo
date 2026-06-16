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
import { SketchRepository } from '../../db/repositories/sketches.js';
import { PRESENTATION_THEMES } from '../../visual-language/themes.js';
import {
  cookHandler,
  getCookHandler,
  listCooksHandler,
  recommendKindHandler,
  forgePublicationsHandler,
  archiveCookHandler,
  sketchStashHandler,
} from './cook.js';

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-cook-e2e-'));
  process.env.MOJULO_OUTCOMES_DIR = tmpRoot;
  // Clear all slice-2 + slice-1 rows between tests.
  const db = getDb();
  db.exec(
    'DELETE FROM stash_cooks; DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes; DELETE FROM sketches;',
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

describe('cook handler — picture_book template', () => {
  // Minimal valid sketch manifest. Real rendering exercises CreationMap; we
  // just need the writer to find a manifest and call renderSketchToSvg on it.
  function tinyManifest(label) {
    return {
      viewBox: { width: 320, height: 200 },
      stations: [
        {
          id: 's',
          kind: 'input',
          label,
          x: 40,
          y: 60,
          w: 240,
          h: 80,
        },
      ],
      edges: [],
    };
  }

  it('materializes a single-stash picture book with chapters and captions', async () => {
    const stash = StashRepository.mint({ title: 'Fox who learns to share' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-1-the-finding' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-2-the-sharing' });

    const sk1 = SketchRepository.create({ title: 'Page 1', manifest: tinyManifest('Once upon a time') });
    const sk2 = SketchRepository.create({ title: 'Page 2', manifest: tinyManifest('A small fox') });
    const sk3 = SketchRepository.create({ title: 'Page 3', manifest: tinyManifest('A hungry crow') });

    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'ch-1-the-finding',
      type: 'sketch',
      metadata: { sketch_ref: sk1.ref, label: 'opening' },
      bodyMd: 'Once upon a time, a fox who would not share.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'ch-1-the-finding',
      type: 'sketch',
      metadata: { sketch_ref: sk2.ref, label: 'fox' },
      bodyMd: 'He kept his berries *all* to himself.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'ch-2-the-sharing',
      type: 'sketch',
      metadata: { sketch_ref: sk3.ref, label: 'crow' },
      bodyMd: 'Then a hungry crow came along.',
    });

    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Fox who learns to share',
      report_md: 'A small story for a small reader.',
      template: 'picture_book',
    });

    expect(result.ok).toBe(true);
    expect(result.template_version).toBe('pb-1');

    const files = (await fs.readdir(result.outcome_dir)).sort();
    expect(files).toEqual([
      'index.html',
      'manifest.json',
      'page-001.svg',
      'page-002.svg',
      'page-003.svg',
      'report.md',
    ]);

    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Fox who learns to share'); // cover title
    expect(html).toContain('A small story for a small reader.'); // cover blurb
    expect(html).toContain('would not share'); // page 1 caption
    expect(html).toContain('<em>all</em>'); // page 2 caption markdown
    expect(html).toContain('a hungry crow'); // page 3 caption
    expect(html).toContain('ch-1-the-finding'); // chapter heading
    expect(html).toContain('ch-2-the-sharing');
    // Each page SVG is inlined (xmlns is the tell — added by renderSketchToSvg).
    expect((html.match(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) || []).length).toBe(3);

    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.template).toBe('picture_book');
    expect(manifest.template_version).toBe('pb-1');
    expect(manifest.page_count).toBe(3);
    expect(manifest.chapters).toHaveLength(2);
    expect(manifest.chapters[0].name).toBe('ch-1-the-finding');
    expect(manifest.chapters[0].pages).toHaveLength(2);
    expect(manifest.chapters[0].pages[0].sketch_ref).toBe(sk1.ref);
    expect(manifest.chapters[0].pages[0].filename).toBe('page-001.svg');
    expect(manifest.chapters[1].name).toBe('ch-2-the-sharing');
    expect(manifest.chapters[1].pages[0].filename).toBe('page-003.svg');
    expect(manifest.skipped_items).toEqual([]);
  });

  it('skips non-sketch items and records them in manifest.skipped_items', async () => {
    const stash = StashRepository.mint({ title: 'mixed' });
    const sk = SketchRepository.create({ title: 'P1', manifest: tinyManifest('p1') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
      bodyMd: 'the only page',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'text',
      body: 'this is a note, not a page',
    });

    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'mixed',
      template: 'picture_book',
    });

    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.page_count).toBe(1);
    expect(manifest.skipped_items).toHaveLength(1);
    expect(manifest.skipped_items[0]).toMatchObject({ type: 'text' });
  });

  it('renders a placeholder when a sketch_ref is dangling', async () => {
    const stash = StashRepository.mint({ title: 'dangling' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: 'sk_doesnotexist0', label: 'ghost' },
      bodyMd: 'page with a missing illustration',
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'dangling refs',
      template: 'picture_book',
    });

    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('missing illustration');
    expect(html).toContain('sk_doesnotexist0');

    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.chapters[0].pages[0].dangling).toBe(true);
    // No standalone .svg file written for a dangling page.
    const files = await fs.readdir(result.outcome_dir);
    expect(files.some((f) => f.startsWith('page-'))).toBe(false);
  });

  it('refuses an empty book (no sketch items at all)', async () => {
    const stash = StashRepository.mint({ title: 'no sketches' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'just a note' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'empty',
        template: 'picture_book',
      }),
    ).rejects.toThrow(/no sketch items/);
  });

  it('refuses multiple slices on picture_book', async () => {
    const a = StashRepository.mint({ title: 'a' });
    const b = StashRepository.mint({ title: 'b' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: a.stashRef }, { stash_ref: b.stashRef }],
        aim: 'two stashes',
        template: 'picture_book',
      }),
    ).rejects.toThrow(/exactly one slice/);
  });

  it('refuses item_ids on a picture_book slice', async () => {
    const stash = StashRepository.mint({ title: 's' });
    const sk = SketchRepository.create({ title: 'P1', manifest: tinyManifest('p1') });
    const item = StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
    });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef, item_ids: [item.id] }],
        aim: 'partial book',
        template: 'picture_book',
      }),
    ).rejects.toThrow(/whole-stash slice/);
  });

  it('refuses `visuals` on picture_book', async () => {
    const stash = StashRepository.mint({ title: 'v' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'v',
        template: 'picture_book',
        visuals: [{ filename: 'x.svg', type: 'svg', body: '<svg/>' }],
      }),
    ).rejects.toThrow(/does not accept `visuals`/);
  });

  it('rejects an unknown template kind', async () => {
    const stash = StashRepository.mint({ title: 's' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'x',
        template: 'made_up_template',
      }),
    ).rejects.toThrow(/not a valid cook template/);
  });
});

describe('cook handler — publication arg (new vocabulary)', () => {
  it("accepts `publication: { kind: 'essay' }` and writes the kind into the manifest", async () => {
    const s = StashRepository.mint({ title: 's' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    const r = await cookHandler({
      slices: [{ stash_ref: s.stashRef }],
      aim: 'q',
      report_md: '# r',
      publication: { kind: 'essay' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication).toEqual({ kind: 'essay' });
  });

  it("accepts `publication: { kind: 'picture_book' }` (new vocabulary) and routes to the picture-book writer", async () => {
    const stash = StashRepository.mint({ title: 's' });
    const sk = SketchRepository.create({
      title: 'P1',
      manifest: {
        viewBox: { width: 320, height: 200 },
        stations: [{ id: 's', kind: 'input', label: 'p1', x: 40, y: 60, w: 240, h: 80 }],
        edges: [],
      },
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
      bodyMd: 'only page',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'kinds matter',
      publication: { kind: 'picture_book' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication).toEqual({ kind: 'picture_book' });
    expect(manifest.template).toBe('picture_book'); // legacy field still present
  });

  it("legacy `template: 'standard'` soft-aliases to `publication.kind = 'essay'`", async () => {
    const s = StashRepository.mint({ title: 's' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    const r = await cookHandler({
      slices: [{ stash_ref: s.stashRef }],
      aim: 'q',
      report_md: '# r',
      template: 'standard',
    });
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication).toEqual({ kind: 'essay' });
  });

  it('refuses both `publication` and `template` passed together', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        report_md: '# r',
        publication: { kind: 'essay' },
        template: 'standard',
      }),
    ).rejects.toThrow(/not both/);
  });

  it('rejects an unknown publication.kind', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        report_md: '# r',
        publication: { kind: 'made_up_kind' },
      }),
    ).rejects.toThrow(/is not a known kind/);
  });

  it('rejects a malformed publication object', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        report_md: '# r',
        publication: {},
      }),
    ).rejects.toThrow(/publication\.kind is required/);
  });
});

describe("cook handler — publication.kind 'slide_deck'", () => {
  function tinyManifest(label) {
    return {
      viewBox: { width: 320, height: 200 },
      stations: [
        { id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 },
      ],
      edges: [],
    };
  }

  it('renders a deck with a mix of slide kinds, drawer sections, and a cover blurb', async () => {
    const stash = StashRepository.mint({ title: 'Why mojulo is a substrate' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'act-1' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'act-2' });

    const sk = SketchRepository.create({ title: 'opener', manifest: tinyManifest('opening shape') });

    // Root item — markdown title+body slide.
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# What is a substrate?\n\n- Stateful\n- Composable\n- Audit-trail-first',
    });
    // act-1 — a sketch (visual slide) and a text slide.
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'act-1',
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'opening' },
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'act-1',
      type: 'text',
      body: 'A note, framed as a single thought.',
    });
    // act-2 — an SVG slide.
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'act-2',
      type: 'svg',
      bodySvg: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="teal"/></svg>',
      title: 'closing shape',
    });

    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Why mojulo is a substrate',
      report_md: 'A short framing of the deck.',
      publication: { kind: 'slide_deck' },
    });

    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('sd-1');

    const files = (await fs.readdir(r.outcome_dir)).sort();
    expect(files).toContain('index.html');
    expect(files).toContain('manifest.json');
    expect(files).toContain('report.md');
    // sketch + svg slides each write a standalone .svg file.
    expect(files.filter((f) => f.startsWith('slide-')).length).toBe(2);

    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Why mojulo is a substrate'); // cover
    expect(html).toContain('A short framing of the deck.'); // cover blurb
    expect(html).toContain('What is a substrate?'); // markdown title
    expect(html).toContain('Composable'); // markdown body bullet
    expect(html).toContain('act-1'); // section divider
    expect(html).toContain('act-2'); // section divider
    expect(html).toContain('fill="teal"'); // SVG inlined

    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication).toEqual({ kind: 'slide_deck' });
    expect(manifest.template).toBe('slide_deck');
    expect(manifest.template_version).toBe('sd-1');
    expect(manifest.slide_count).toBe(4);
    expect(manifest.sections).toHaveLength(3); // root + act-1 + act-2
    expect(manifest.sections[0].name).toBeNull();
    expect(manifest.sections[1].name).toBe('act-1');
    expect(manifest.sections[2].name).toBe('act-2');
    expect(manifest.skipped_items).toEqual([]);
  });

  it('a presentation theme sets the page chrome AND re-tints the embedded sketch', async () => {
    const paper = PRESENTATION_THEMES.paper;
    const stash = StashRepository.mint({ title: 'themed deck' });
    const sk = SketchRepository.create({ title: 'opener', manifest: tinyManifest('opening shape') });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', metadata: { sketch_ref: sk.ref, label: 'opening' } });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'a thought' });

    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Themed deck',
      report_md: 'cover',
      publication: { kind: 'slide_deck', style: { theme: 'paper' } },
    });
    expect(r.ok).toBe(true);

    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    // chrome: a body-level override block carries the theme's doc vars, so the
    // dark visual band (#0b1220) is replaced by the theme backdrop.
    expect(html).toContain('<style>body {');
    // The override block sits AFTER the template :root, so its body-level vars
    // win for everything in <body> (the template's #0b1220 default stays in
    // :root as text but is superseded at render).
    expect(html).toContain(`--visual-bg: ${paper.bg};`);
    expect(html).toContain(`--paper: ${paper.chrome.pageBg};`);
    const overrideBlock = html.slice(html.indexOf('<style>body {'));
    expect(overrideBlock).toContain(`--visual-bg: ${paper.bg};`);

    // embedded sketch: rendered on the light surface, so the standalone slide
    // SVG carries dark paper ink, not the dark-theme default white.
    const slideSvg = await fs.readFile(path.join(r.outcome_dir, 'slide-001.svg'), 'utf8');
    expect(slideSvg).not.toContain('#ffffff');
  });

  it('rejects a theme on a kind that is not theme-wired, and an unknown theme', async () => {
    const stash = StashRepository.mint({ title: 'no theme here' });
    const sk = SketchRepository.create({ title: 'p', manifest: tinyManifest('p') });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', metadata: { sketch_ref: sk.ref, label: 'p' } });

    // picture_book is not in THEMED_KINDS yet → clear redirect to accent.
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'x',
        publication: { kind: 'picture_book', style: { theme: 'paper' } },
      }),
    ).rejects.toThrow(/theme is supported for/);

    // unknown token on a themed kind.
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'x',
        report_md: 'c',
        publication: { kind: 'slide_deck', style: { theme: 'neon' } },
      }),
    ).rejects.toThrow(/unknown presentation theme 'neon'/);
  });

  it('skips unsupported item types and records them in manifest.skipped_items', async () => {
    const stash = StashRepository.mint({ title: 'mixed' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'a slide' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'link',
      sourceUrl: 'https://example.com',
      title: 'a link',
    });

    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'mixed types',
      publication: { kind: 'slide_deck' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.slide_count).toBe(1);
    expect(manifest.skipped_items).toHaveLength(1);
    expect(manifest.skipped_items[0]).toMatchObject({ type: 'link' });
  });

  it('honors item_ids cleaving for slide_deck', async () => {
    const stash = StashRepository.mint({ title: 'cherry-pick' });
    const a = StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'first' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'second' });
    const c = StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'third' });

    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef, item_ids: [a.id, c.id] }],
      aim: 'two of three',
      publication: { kind: 'slide_deck' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.slide_count).toBe(2);
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('first');
    expect(html).not.toContain('second');
    expect(html).toContain('third');
  });

  it('refuses an empty deck (no supported items)', async () => {
    const stash = StashRepository.mint({ title: 'links only' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'link',
      sourceUrl: 'https://example.com',
      title: 'just a link',
    });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'nothing usable',
        publication: { kind: 'slide_deck' },
      }),
    ).rejects.toThrow(/produced 0 slides/);
  });

  it('refuses multiple slices on slide_deck', async () => {
    const a = StashRepository.mint({ title: 'a' });
    const b = StashRepository.mint({ title: 'b' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: a.stashRef }, { stash_ref: b.stashRef }],
        aim: 'two stashes',
        publication: { kind: 'slide_deck' },
      }),
    ).rejects.toThrow(/exactly one slice/);
  });

  it('refuses `visuals` on slide_deck', async () => {
    const stash = StashRepository.mint({ title: 'v' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'v',
        publication: { kind: 'slide_deck' },
        visuals: [{ filename: 'x.svg', type: 'svg', body: '<svg/>' }],
      }),
    ).rejects.toThrow(/does not accept `visuals`/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Template-library batch (flyer, brief, resume, newsletter, field_guide, pamphlet)
// ─────────────────────────────────────────────────────────────────────────────

function tinyManifestForLibrary(label) {
  return {
    viewBox: { width: 320, height: 200 },
    stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
    edges: [],
  };
}

describe('sketch_stash — vibe-to-items scaffold', () => {
  it('returns a picture_book proposal with chapter drawers + sketch slots', async () => {
    const r = await sketchStashHandler({
      intent: 'A children\'s book about a fox who learns to share',
      target_kind: 'picture_book',
    });
    expect(r.target_kind).toBe('picture_book');
    expect(r.proposed.title).toContain('fox');
    expect(r.proposed.drawers).toHaveLength(3);
    expect(r.proposed.drawers.map((d) => d.name)).toEqual(['ch-1-opening', 'ch-2-development', 'ch-3-closing']);
    expect(r.proposed.items.some((it) => it.type === 'sketch')).toBe(true);
    // The script ends with a cook call.
    expect(r.suggested_steps[r.suggested_steps.length - 1]).toContain("cook(");
    expect(r.suggested_steps[r.suggested_steps.length - 1]).toContain("kind: \"picture_book\"");
  });

  it('returns a resume proposal with identity/skills/education drawers', async () => {
    const r = await sketchStashHandler({
      intent: 'A 1-page CV for a junior programmer',
      target_kind: 'resume',
    });
    expect(r.target_kind).toBe('resume');
    const drawerNames = r.proposed.drawers.map((d) => d.name);
    expect(drawerNames).toContain('identity');
    expect(drawerNames).toContain('skills');
    expect(drawerNames).toContain('education');
  });

  it('falls back to an essay proposal when no target_kind is given', async () => {
    const r = await sketchStashHandler({
      intent: 'something about migration patterns',
    });
    expect(r.target_kind).toBe('essay');
    // next_actions nudges toward recommend_kind.
    expect(r.next_actions.some((a) => /recommend_kind/.test(a))).toBe(true);
  });

  it('refuses an unknown target_kind', async () => {
    await expect(sketchStashHandler({ intent: 'x', target_kind: 'made_up' })).rejects.toThrow(/target_kind/);
  });

  it('refuses an empty intent', async () => {
    await expect(sketchStashHandler({ intent: '' })).rejects.toThrow(/intent/);
    await expect(sketchStashHandler({ intent: '   ' })).rejects.toThrow(/intent/);
  });

  it('truncates very long intents to a reasonable stash title', async () => {
    const long = 'an exhaustive walkthrough of every single one of the publisher kinds shipped in v1 of the substrate plus the meta-tooling layer';
    const r = await sketchStashHandler({ intent: long, target_kind: 'essay' });
    expect(r.proposed.title.length).toBeLessThanOrEqual(80);
    expect(r.proposed.title.endsWith('…')).toBe(true);
  });
});

describe('publication.style.accent — accent override injected into the rendered HTML', () => {
  it('accepts a named color and injects it as a body --accent override', async () => {
    const s = StashRepository.mint({ title: 's' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    const r = await cookHandler({
      slices: [{ stash_ref: s.stashRef }],
      aim: 'styled',
      report_md: '# r',
      publication: { kind: 'essay', style: { accent: 'rose' } },
    });
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('body { --accent: #be123c');
  });

  it('accepts a hex color', async () => {
    const stash = StashRepository.mint({ title: 'f' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Hello\n\nWorld.' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'link', sourceUrl: 'https://example.com', title: 'cta' });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'hex',
      publication: { kind: 'flyer', style: { accent: '#0ea5e9' } },
    });
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('body { --accent: #0ea5e9');
  });

  it('omits the override block when style is not provided', async () => {
    const s = StashRepository.mint({ title: 's' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    const r = await cookHandler({
      slices: [{ stash_ref: s.stashRef }],
      aim: 'no style',
      report_md: '# r',
      publication: { kind: 'essay' },
    });
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).not.toContain('body { --accent:');
  });

  it('refuses an unknown accent name', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'bad',
        report_md: '# r',
        publication: { kind: 'essay', style: { accent: 'definitely-not-a-color' } },
      }),
    ).rejects.toThrow(/known color name or 3.6-digit hex/);
  });

  it('refuses a non-hex accent value', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'bad',
        report_md: '# r',
        publication: { kind: 'essay', style: { accent: '#ZZZ' } },
      }),
    ).rejects.toThrow(/known color name or 3.6-digit hex/);
  });
});

describe('archive_cook — soft-delete + list_cooks status filter', () => {
  it('archives a cook idempotently and hides it from the default list', async () => {
    const s = StashRepository.mint({ title: 'arc' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    const cooked = await cookHandler({
      slices: [{ stash_ref: s.stashRef }],
      aim: 'archive me',
      report_md: '# r',
      publication: { kind: 'essay' },
    });
    const cookRef = cooked.cook_ref;

    // Default list includes it.
    let listed = await listCooksHandler({ limit: 20 });
    expect(listed.cooks.some((c) => c.cook_ref === cookRef)).toBe(true);

    // Archive it.
    const a1 = await archiveCookHandler({ cook_ref: cookRef });
    expect(a1.archived).toBe(true);
    expect(a1.already_archived).toBe(false);

    // Default list (status=open) hides it.
    listed = await listCooksHandler({ limit: 20 });
    expect(listed.cooks.some((c) => c.cook_ref === cookRef)).toBe(false);

    // status=archived surfaces it.
    listed = await listCooksHandler({ limit: 20, status: 'archived' });
    expect(listed.cooks.some((c) => c.cook_ref === cookRef)).toBe(true);

    // status=all also includes it.
    listed = await listCooksHandler({ limit: 20, status: 'all' });
    expect(listed.cooks.some((c) => c.cook_ref === cookRef)).toBe(true);

    // Idempotent on already-archived.
    const a2 = await archiveCookHandler({ cook_ref: cookRef });
    expect(a2.archived).toBe(false);
    expect(a2.already_archived).toBe(true);

    // Unarchive restores it.
    const u = await archiveCookHandler({ cook_ref: cookRef, unarchive: true });
    expect(u.unarchived).toBe(true);
    listed = await listCooksHandler({ limit: 20 });
    expect(listed.cooks.some((c) => c.cook_ref === cookRef)).toBe(true);
  });

  it('refuses unknown cook_ref', async () => {
    await expect(archiveCookHandler({ cook_ref: 'cook_does_not_exist' })).rejects.toThrow(/not found/);
  });

  it('refuses unknown status filter', async () => {
    await expect(listCooksHandler({ status: 'made_up' })).rejects.toThrow(/status/);
  });
});

describe('forge_publications — cook multiple kinds in one call', () => {
  function tinyManifestForForge(label) {
    return {
      viewBox: { width: 320, height: 200 },
      stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
      edges: [],
    };
  }

  it('forges three publications of distinct kinds, each as a real cook row', async () => {
    const stash = StashRepository.mint({ title: 'forge demo' });
    const sk = SketchRepository.create({ title: 'hero', manifest: tinyManifestForForge('hero') });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', metadata: { sketch_ref: sk.ref, label: 'hero' } });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Article\n\nBody.' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Another\n\nBody.' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'link', sourceUrl: 'https://example.com', title: 'a link' });

    const r = await forgePublicationsHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'compare three shapes',
      report_md: 'Shared opener for all three.',
      kinds: ['slide_deck', 'newsletter', 'brief'],
    });

    expect(r.ok).toBe(true);
    expect(r.forge_id).toMatch(/^forge_[a-f0-9]{10}$/);
    expect(r.cooks).toHaveLength(3);
    expect(r.cooks.map((c) => c.kind).sort()).toEqual(['brief', 'newsletter', 'slide_deck']);

    // Each cook has a unique cook_ref and a real outcome_url.
    const refs = new Set(r.cooks.map((c) => c.cook_ref));
    expect(refs.size).toBe(3);
    for (const c of r.cooks) {
      expect(c.outcome_url).toBe(`/outcomes/${c.cook_ref}/`);
      expect(typeof c.template_version).toBe('string');
    }

    // Rows landed in the DB.
    const listed = await listCooksHandler({ limit: 20 });
    const listedRefs = new Set(listed.cooks.map((c) => c.cook_ref));
    for (const c of r.cooks) expect(listedRefs.has(c.cook_ref)).toBe(true);
  });

  it('refuses fewer than 2 kinds', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      forgePublicationsHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        kinds: ['essay'],
      }),
    ).rejects.toThrow(/2.4/);
  });

  it('refuses more than 4 kinds', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      forgePublicationsHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        kinds: ['essay', 'flyer', 'brief', 'resume', 'newsletter'],
      }),
    ).rejects.toThrow(/2.4/);
  });

  it('refuses duplicate kinds', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      forgePublicationsHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        kinds: ['essay', 'essay'],
      }),
    ).rejects.toThrow(/distinct/);
  });

  it('refuses an unknown kind', async () => {
    const s = StashRepository.mint({ title: 's' });
    await expect(
      forgePublicationsHandler({
        slices: [{ stash_ref: s.stashRef }],
        aim: 'q',
        kinds: ['essay', 'made_up_kind'],
      }),
    ).rejects.toThrow(/not a known publication kind/);
  });

  it('returns partial results when some kinds fail (errors recorded)', async () => {
    const stash = StashRepository.mint({ title: 'partial' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'one item' });
    // essay needs report_md → will fail; flyer should succeed.
    const r = await forgePublicationsHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'partial run',
      kinds: ['essay', 'flyer'],
    });
    expect(r.cooks.length + (r.errors?.length || 0)).toBe(2);
    expect(r.cooks.some((c) => c.kind === 'flyer')).toBe(true);
    expect(r.errors?.some((e) => e.kind === 'essay')).toBe(true);
  });
});

describe('recommend_kind — rules-based scan of a stash', () => {
  function tinyManifestForReco(label) {
    return {
      viewBox: { width: 320, height: 200 },
      stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
      edges: [],
    };
  }

  it('ranks picture_book high when the stash is mostly sketches with captions across drawers', async () => {
    const stash = StashRepository.mint({ title: 'b' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-1' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-2' });
    for (let i = 0; i < 4; i++) {
      const sk = SketchRepository.create({ title: `sk${i}`, manifest: tinyManifestForReco(`sk${i}`) });
      StashRepository.gather({
        stashRef: stash.stashRef,
        drawer: i < 2 ? 'ch-1' : 'ch-2',
        type: 'sketch',
        metadata: { sketch_ref: sk.ref, label: `s${i}` },
        bodyMd: `caption ${i}`,
      });
    }
    const r = await recommendKindHandler({ stash_ref: stash.stashRef });
    expect(r.recommendations[0].kind).toBe('picture_book');
    expect(r.recommendations[0].score).toBeGreaterThan(50);
    expect(r.scan.type_counts.sketch).toBe(4);
    expect(r.scan.drawer_count).toBe(2);
    expect(r.scan.sketches_with_bodymd).toBe(4);
  });

  it('ranks newsletter high when there is a mix of markdown + links + a hero sketch', async () => {
    const stash = StashRepository.mint({ title: 'n' });
    const sk = SketchRepository.create({ title: 'hero', manifest: tinyManifestForReco('hero') });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', metadata: { sketch_ref: sk.ref, label: 'hero' } });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Story 1\n\nBody.' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Story 2\n\nBody.' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'Pull quote' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'link', sourceUrl: 'https://a.example', title: 'a' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'link', sourceUrl: 'https://b.example', title: 'b' });
    const r = await recommendKindHandler({ stash_ref: stash.stashRef });
    const top3 = r.recommendations.map((x) => x.kind);
    expect(top3).toContain('newsletter');
    // newsletter or slide_deck should top the list given this content mix
    expect(['newsletter', 'slide_deck']).toContain(r.recommendations[0].kind);
  });

  it('ranks resume high when an identity drawer is present', async () => {
    const stash = StashRepository.mint({ title: 'cv' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'identity' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'skills' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'identity',
      type: 'markdown',
      bodyMd: '# Name\ntagline\nsummary',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'skills',
      type: 'markdown',
      bodyMd: '# Skills\n- a\n- b',
    });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Experience\nstuff' });
    const r = await recommendKindHandler({ stash_ref: stash.stashRef });
    expect(r.recommendations[0].kind).toBe('resume');
    expect(r.recommendations[0].fit_notes.some((n) => /identity/i.test(n))).toBe(true);
  });

  it('emits an essay-fallback recommendation when nothing else fits well', async () => {
    const stash = StashRepository.mint({ title: 'empty-ish' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'a single thought' });
    const r = await recommendKindHandler({ stash_ref: stash.stashRef, aim: 'something' });
    const kinds = r.recommendations.map((x) => x.kind);
    expect(kinds).toContain('essay');
  });

  it('refuses an unknown stash_ref', async () => {
    await expect(recommendKindHandler({ stash_ref: 'st_nope' })).rejects.toThrow(/not found/);
  });

  it('limit truncates the recommendation list', async () => {
    const stash = StashRepository.mint({ title: 'm' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# A\n\n.' });
    const r = await recommendKindHandler({ stash_ref: stash.stashRef, limit: 2 });
    expect(r.recommendations).toHaveLength(2);
  });
});

describe('cook handler — skipped_items surfaced in response + message', () => {
  function tinyManifest(label) {
    return {
      viewBox: { width: 320, height: 200 },
      stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
      edges: [],
    };
  }

  it('returns skipped_items array + appends a warning to the message when items are dropped', async () => {
    const stash = StashRepository.mint({ title: 'mixed' });
    const sk = SketchRepository.create({ title: 'P1', manifest: tinyManifest('p1') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
      bodyMd: 'pageable',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'text',
      body: 'this gets skipped by picture_book',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Also skipped\n\nMd is not a picture_book ingredient.',
    });

    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'mixed bag',
      publication: { kind: 'picture_book' },
    });

    expect(r.skipped_items).toHaveLength(2);
    expect(r.skipped_items.map((s) => s.type).sort()).toEqual(['markdown', 'text']);
    expect(r.message).toContain('⚠ 2 item(s) dropped');
    expect(r.message).toMatch(/text|markdown/);
  });

  it('does NOT include a dropped-items warning when nothing is skipped', async () => {
    const s = StashRepository.mint({ title: 's' });
    StashRepository.gather({ stashRef: s.stashRef, type: 'text', body: 'x' });
    const r = await cookHandler({
      slices: [{ stash_ref: s.stashRef }],
      aim: 'q',
      report_md: '# r',
      publication: { kind: 'essay' },
    });
    expect(r.skipped_items).toEqual([]);
    expect(r.message).not.toContain('dropped');
  });
});

describe("cook handler — publication.kind 'flyer'", () => {
  it('materializes a flyer with hero sketch + headline markdown + CTA link', async () => {
    const stash = StashRepository.mint({ title: 'fl' });
    const sk = SketchRepository.create({ title: 'hero', manifest: tinyManifestForLibrary('hero shape') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'hero' },
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Big Headline\n\nSome body text explaining the offer.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'link',
      sourceUrl: 'https://example.com',
      title: 'Sign up',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Spring open house',
      publication: { kind: 'flyer' },
    });
    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('fl-1');
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Big Headline'); // markdown headline wins over aim
    expect(html).toContain('Some body text');
    expect(html).toContain('Sign up'); // CTA
    expect(html).toContain('https://example.com');
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication).toEqual({ kind: 'flyer' });
    expect(manifest.cta_count).toBe(1);
  });

  it('refuses multiple slices on flyer', async () => {
    const a = StashRepository.mint({ title: 'a' });
    const b = StashRepository.mint({ title: 'b' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: a.stashRef }, { stash_ref: b.stashRef }],
        aim: 'two',
        publication: { kind: 'flyer' },
      }),
    ).rejects.toThrow(/exactly one slice/);
  });
});

describe("cook handler — publication.kind 'brief'", () => {
  it('materializes a brief with executive summary, points, sidebar figure, callout', async () => {
    const stash = StashRepository.mint({ title: 'b' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Recommendation\n\nWe should ship the refactor.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Risk\n\nMinor regressions in three downstream consumers.',
    });
    const sk = SketchRepository.create({ title: 'shape', manifest: tinyManifestForLibrary('shape') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'flow' },
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'text',
      body: 'Quick aside in the margin.',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Q3 refactor brief',
      report_md: 'Ship the refactor.',
      publication: { kind: 'brief' },
    });
    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('br-1');
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Executive summary');
    expect(html).toContain('Recommendation');
    expect(html).toContain('Risk');
    expect(html).toContain('Quick aside');
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.point_count).toBe(2);
    expect(manifest.figure_count).toBe(1);
    expect(manifest.callout_count).toBe(1);
  });
});

describe("cook handler — publication.kind 'resume'", () => {
  it('materializes a resume with identity drawer + sidebar + main sections', async () => {
    const stash = StashRepository.mint({ title: 'cv' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'identity' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'skills' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'identity',
      type: 'markdown',
      bodyMd: '# Ada Lovelace\nProgrammer · Mathematician\nNotes on the Analytical Engine.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'skills',
      type: 'markdown',
      bodyMd: '# Skills\n- Analytical Engine\n- Calculus',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Experience\n## Babbage Lab, 1843\nCollaborated on the Analytical Engine.',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'CV draft',
      publication: { kind: 'resume' },
    });
    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('re-1');
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Programmer'); // tagline
    expect(html).toContain('Skills');
    expect(html).toContain('Experience');
    expect(html).toContain('Analytical Engine');
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.name).toBe('Ada Lovelace');
    expect(manifest.sidebar_section_count).toBe(1);
    expect(manifest.main_section_count).toBe(1);
  });
});

describe("cook handler — publication.kind 'newsletter'", () => {
  it('materializes a newsletter with hero, articles, pull quote, links', async () => {
    const stash = StashRepository.mint({ title: 'Weekly' });
    const sk = SketchRepository.create({ title: 'hero', manifest: tinyManifestForLibrary('hero') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'this week' },
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Story One\n\nThe headline story for this issue.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'text',
      body: 'A quote worth pulling out.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'link',
      sourceUrl: 'https://example.com/post',
      title: 'A linked article',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Issue #1',
      report_md: 'The opening note from the editor.',
      publication: { kind: 'newsletter' },
    });
    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('nl-1');
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Issue #1');
    expect(html).toContain('Story One');
    expect(html).toContain('A quote worth pulling out');
    expect(html).toContain('A linked article');
    expect(html).toContain('In case you missed it'); // links section header
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.article_count).toBe(2); // article + pull quote
    expect(manifest.link_count).toBe(1);
  });
});

describe("cook handler — publication.kind 'field_guide'", () => {
  it('materializes a field guide with sections + specimens', async () => {
    const stash = StashRepository.mint({ title: 'Field guide to local birds' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'songbirds' });
    const sk = SketchRepository.create({ title: 'finch', manifest: tinyManifestForLibrary('finch') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'songbirds',
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'House Finch' },
      bodyMd: '# House Finch\n\nA small reddish-brown bird common in suburbs.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'songbirds',
      type: 'markdown',
      bodyMd: '# Sparrow\n\nUbiquitous and unassuming.',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Birds of the backyard',
      report_md: 'A short guide to common backyard birds.',
      publication: { kind: 'field_guide' },
    });
    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('fg-1');
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Birds of the backyard');
    expect(html).toContain('songbirds'); // section divider
    expect(html).toContain('House Finch');
    expect(html).toContain('Sparrow');
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.section_count).toBe(1);
    expect(manifest.specimen_count).toBe(2);
  });
});

describe("cook handler — publication.kind 'pamphlet'", () => {
  it('materializes a tri-fold pamphlet with front + content panels + back', async () => {
    const stash = StashRepository.mint({ title: 'Walking tour' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Stop 1\n\nThe main square.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Stop 2\n\nThe old market.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Stop 3\n\nThe river crossing.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Stop 4\n\nThe lookout.',
    });
    const r = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'A short walking tour',
      report_md: 'Take an hour and follow the four stops.',
      publication: { kind: 'pamphlet' },
    });
    expect(r.ok).toBe(true);
    expect(r.template_version).toBe('pa-1');
    const html = await fs.readFile(path.join(r.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('A short walking tour'); // front
    expect(html).toContain('Stop 1');
    expect(html).toContain('Stop 4');
    expect(html).toContain('End'); // back
    const manifest = JSON.parse(await fs.readFile(path.join(r.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.panel_count).toBe(6); // 4 content + front + back
  });
});
