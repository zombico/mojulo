// End-to-end tests for the comic publication kind. Real SQLite (in-memory),
// real filesystem (temp dir), real markdown + SVG render. Mirrors the
// posture of cook.test.js's picture_book block.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb } from '../../db/index.js';
import { StashRepository } from '../../db/repositories/stashes.js';
import { SketchRepository } from '../../db/repositories/sketches.js';
import { cookHandler, recommendKindHandler, sketchStashHandler } from '../../mcp/tools/cook.js';
import { writeComicOutcome, _internals, FIDELITY_LEVELS } from './comic.js';

function tinyManifest(label) {
  return {
    viewBox: { width: 320, height: 200 },
    stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
    edges: [],
  };
}

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-comic-e2e-'));
  process.env.MOJULO_OUTCOMES_DIR = tmpRoot;
  const db = getDb();
  db.exec(
    'DELETE FROM stash_cooks; DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes; DELETE FROM sketches;',
  );
});

afterEach(async () => {
  delete process.env.MOJULO_OUTCOMES_DIR;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('comic — defaults (american-comic, nemu)', () => {
  it('materializes a single-stash comic with chapter dividers and per-page fidelity', async () => {
    const stash = StashRepository.mint({ title: 'A small heist' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-1-opening' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-2-the-job' });

    const sk1 = SketchRepository.create({ title: 'p1', manifest: tinyManifest('open') });
    const sk2 = SketchRepository.create({ title: 'p2', manifest: tinyManifest('plan') });
    const sk3 = SketchRepository.create({ title: 'p3', manifest: tinyManifest('go') });

    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'ch-1-opening',
      type: 'sketch',
      metadata: { sketch_ref: sk1.ref, label: 'opening' },
      bodyMd: 'we enter the diner',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'ch-2-the-job',
      type: 'sketch',
      metadata: { sketch_ref: sk2.ref, label: 'plan' },
      bodyMd: 'the plan is laid out',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'ch-2-the-job',
      type: 'sketch',
      metadata: { sketch_ref: sk3.ref, label: 'go' },
      bodyMd: 'we move',
    });

    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'A small heist',
      report_md: 'A short comic for a long bus ride.',
      publication: { kind: 'comic' },
    });

    expect(result.ok).toBe(true);
    expect(result.template_version).toBe('comic-1');

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
    expect(html).toContain('A small heist');                           // cover title
    expect(html).toContain('A short comic for a long bus ride.');      // cover blurb
    expect(html).toContain('ch-1-opening');                            // chapter heading
    expect(html).toContain('ch-2-the-job');
    expect(html).toContain('data-format="american-comic"');            // body data attrs
    expect(html).toContain('data-pagination="pages"');
    expect(html).toContain('data-reading-direction="ltr"');
    expect(html).toContain('data-fidelity="nemu"');                    // initial fidelity
    expect(html).toContain('class="fidelity-dial"');                   // dial is in the page

    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.template).toBe('comic');
    expect(manifest.template_version).toBe('comic-1');
    expect(manifest.page_count).toBe(3);
    expect(manifest.publication).toEqual({
      kind: 'comic',
      format: 'american-comic',
      fidelity: 'nemu',
      pagination: 'pages',
      reading_direction: 'ltr',
    });
    expect(manifest.chapters).toHaveLength(2);
    expect(manifest.chapters[0].name).toBe('ch-1-opening');
    expect(manifest.chapters[1].pages).toHaveLength(2);
    expect(manifest.skipped_items).toEqual([]);
    // Each page wrapper in the HTML carries its own data-fidelity, set from
    // the publication default since nothing was overridden per-page.
    expect((html.match(/<section class="page" data-viewer-page data-fidelity="nemu"/g) || []).length).toBe(3);
  });

  it('refuses an empty book (no sketch items)', async () => {
    const stash = StashRepository.mint({ title: 'empty' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'just a note' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'empty',
        publication: { kind: 'comic' },
      }),
    ).rejects.toThrow(/no sketch items/);
  });

  it('refuses item_ids on a comic slice (whole-stash kind)', async () => {
    const stash = StashRepository.mint({ title: 's' });
    const sk = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    const item = StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
    });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef, item_ids: [item.id] }],
        aim: 'partial',
        publication: { kind: 'comic' },
      }),
    ).rejects.toThrow(/whole-stash slice/);
  });

  it('refuses multiple slices on comic', async () => {
    const a = StashRepository.mint({ title: 'a' });
    const b = StashRepository.mint({ title: 'b' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: a.stashRef }, { stash_ref: b.stashRef }],
        aim: 'two',
        publication: { kind: 'comic' },
      }),
    ).rejects.toThrow(/exactly one slice/);
  });

  it('skips non-sketch items and records them in manifest.skipped_items', async () => {
    const stash = StashRepository.mint({ title: 'mixed' });
    const sk = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
      bodyMd: 'the only page',
    });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'note, not a page' });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'mixed',
      publication: { kind: 'comic' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.page_count).toBe(1);
    expect(manifest.skipped_items).toHaveLength(1);
    expect(manifest.skipped_items[0]).toMatchObject({ type: 'text' });
  });

  it('renders a placeholder for dangling sketch refs', async () => {
    const stash = StashRepository.mint({ title: 'dangling' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: 'sk_doesnotexist0', label: 'ghost' },
      bodyMd: 'page with a missing illustration',
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'dangling',
      publication: { kind: 'comic' },
    });
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('missing illustration');
    expect(html).toContain('sk_doesnotexist0');
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.chapters[0].pages[0].dangling).toBe(true);
  });
});

describe('comic — format selection', () => {
  function singlePageStash() {
    const stash = StashRepository.mint({ title: 's' });
    const sk = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
      bodyMd: 'first page',
    });
    return stash.stashRef;
  }

  it('manga-tankobon writes pages pagination + rtl reading direction', async () => {
    const stashRef = singlePageStash();
    const result = await cookHandler({
      slices: [{ stash_ref: stashRef }],
      aim: 'manga test',
      publication: { kind: 'comic', format: 'manga-tankobon' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication.format).toBe('manga-tankobon');
    expect(manifest.publication.pagination).toBe('pages');
    expect(manifest.publication.reading_direction).toBe('rtl');
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('data-reading-direction="rtl"');
  });

  it('webtoon writes vertical_scroll pagination and omits reading_direction', async () => {
    const stashRef = singlePageStash();
    const result = await cookHandler({
      slices: [{ stash_ref: stashRef }],
      aim: 'webtoon test',
      publication: { kind: 'comic', format: 'webtoon' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication.format).toBe('webtoon');
    expect(manifest.publication.pagination).toBe('vertical_scroll');
    expect(manifest.publication.reading_direction).toBeUndefined();
  });

  it('rejects an unknown format', async () => {
    const stashRef = singlePageStash();
    await expect(
      cookHandler({
        slices: [{ stash_ref: stashRef }],
        aim: 'bad',
        publication: { kind: 'comic', format: 'underground-zine' },
      }),
    ).rejects.toThrow(/unknown format/);
  });
});

describe('comic — fidelity', () => {
  function buildStash() {
    const stash = StashRepository.mint({ title: 's' });
    const sk1 = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    const sk2 = SketchRepository.create({ title: 'p2', manifest: tinyManifest('p2') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk1.ref, label: 'p1' },
      bodyMd: 'first',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk2.ref, label: 'p2', comic: { fidelity: 'pencils' } },
      bodyMd: 'override me',
    });
    return stash.stashRef;
  }

  it('applies the publication-level fidelity to pages without an override', async () => {
    const stashRef = buildStash();
    const result = await cookHandler({
      slices: [{ stash_ref: stashRef }],
      aim: 'fid test',
      publication: { kind: 'comic', fidelity: 'breakdown' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication.fidelity).toBe('breakdown');
    expect(manifest.chapters[0].pages[0].fidelity_override).toBeUndefined();
    expect(manifest.chapters[0].pages[1].fidelity_override).toBe('pencils');

    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('data-fidelity="breakdown"');                                      // first page
    expect(html).toContain('data-fidelity="pencils" data-fidelity-locked="true"');            // override on second
    expect(html).toContain('override: pencils');                                              // visible badge
  });

  it('rejects an unknown fidelity', async () => {
    const stashRef = buildStash();
    await expect(
      cookHandler({
        slices: [{ stash_ref: stashRef }],
        aim: 'bad fid',
        publication: { kind: 'comic', fidelity: 'rendered' },
      }),
    ).rejects.toThrow(/unknown fidelity/);
  });

  it('exposes FIDELITY_LEVELS in the canonical order', () => {
    expect(FIDELITY_LEVELS).toEqual(['nemu', 'breakdown', 'pencils', 'inks']);
  });
});

describe('comic — spreads', () => {
  function spreadStash() {
    const stash = StashRepository.mint({ title: 's' });
    const sk1 = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    const sk2 = SketchRepository.create({ title: 'p2', manifest: tinyManifest('p2') });
    const sk3 = SketchRepository.create({ title: 'p3', manifest: tinyManifest('p3') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk1.ref, label: 'standalone' },
      bodyMd: 'first',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk2.ref, label: 'spread-l', comic: { spread: 'left' } },
      bodyMd: 'left',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk3.ref, label: 'spread-r', comic: { spread: 'right' } },
      bodyMd: 'right',
    });
    return stash.stashRef;
  }

  it('pairs adjacent left+right pages into a spread section', async () => {
    const stashRef = spreadStash();
    const result = await cookHandler({
      slices: [{ stash_ref: stashRef }],
      aim: 'spread test',
      publication: { kind: 'comic' },
    });
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('<section class="spread"');
    expect(html).toContain('class="spread-half first"');
    expect(html).toContain('class="spread-half second"');
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    // Per-page spread metadata flows through.
    expect(manifest.chapters[0].pages.filter((p) => p.spread === 'left')).toHaveLength(1);
    expect(manifest.chapters[0].pages.filter((p) => p.spread === 'right')).toHaveLength(1);
    expect(manifest.skipped_spreads).toBeUndefined();
  });

  it('records an orphan left-page (no right follows) in skipped_spreads', async () => {
    const stash = StashRepository.mint({ title: 's' });
    const sk1 = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    const sk2 = SketchRepository.create({ title: 'p2', manifest: tinyManifest('p2') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk1.ref, label: 'orphan-l', comic: { spread: 'left' } },
      bodyMd: 'left',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk2.ref, label: 'not-r' },
      bodyMd: 'normal',
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'orphan',
      publication: { kind: 'comic' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.skipped_spreads).toHaveLength(1);
    expect(manifest.skipped_spreads[0]).toMatchObject({ page_number: 1, spread: 'left' });
  });

  it('webtoon ignores spread pairing (no page boundaries to pair)', async () => {
    const stashRef = spreadStash();
    const result = await cookHandler({
      slices: [{ stash_ref: stashRef }],
      aim: 'webtoon spread test',
      publication: { kind: 'comic', format: 'webtoon' },
    });
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).not.toContain('<section class="spread"');
    // No skipped_spreads either — they're simply ignored in vertical_scroll.
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.skipped_spreads).toBeUndefined();
  });
});

describe('comic — recommend_kind scorer', () => {
  it('scores comic above picture_book when sketches carry comic metadata', async () => {
    const stash = StashRepository.mint({ title: 'authored as comic' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-1' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'ch-2' });
    for (let i = 0; i < 4; i++) {
      const sk = SketchRepository.create({ title: `p${i}`, manifest: tinyManifest(`p${i}`) });
      StashRepository.gather({
        stashRef: stash.stashRef,
        drawer: i < 2 ? 'ch-1' : 'ch-2',
        type: 'sketch',
        metadata: { sketch_ref: sk.ref, label: `p${i}`, comic: { fidelity: 'breakdown' } },
        bodyMd: `caption ${i}`,
      });
    }
    const r = await recommendKindHandler({ stash_ref: stash.stashRef, limit: 5 });
    expect(r.scan.sketches_with_comic_meta).toBe(4);
    const ranks = r.recommendations.map((x) => x.kind);
    expect(ranks.indexOf('comic')).toBeLessThan(ranks.indexOf('picture_book'));
  });

  it('scores comic at 0 when there are no sketches', async () => {
    const stash = StashRepository.mint({ title: 'no sketches' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'a note' });
    const scoredComic = _internals;
    expect(scoredComic).toBeDefined(); // placeholder — exercise the path:
    const r = await recommendKindHandler({ stash_ref: stash.stashRef, limit: 13 });
    const comic = r.recommendations.find((x) => x.kind === 'comic');
    expect(comic).toBeDefined();
    expect(comic.score).toBe(0);
  });
});

describe('comic — sketch_stash recipe', () => {
  it('returns the comic recipe with chapter drawers + sketch slots', async () => {
    const r = await sketchStashHandler({ intent: 'a heist comic', target_kind: 'comic' });
    expect(r.target_kind).toBe('comic');
    expect(r.proposed.drawers).toHaveLength(3);
    expect(r.proposed.drawers[0].name).toBe('ch-1-opening');
    expect(r.proposed.items[0].type).toBe('sketch');
    expect(r.notes.join(' ')).toMatch(/fidelity dial/);
    expect(r.suggested_steps[r.suggested_steps.length - 1]).toContain('kind: "comic"');
  });
});

describe('comic — direct writer (bypassing cook)', () => {
  it('writes the same folder layout when called directly', async () => {
    const stash = StashRepository.mint({ title: 'direct' });
    const sk = SketchRepository.create({ title: 'p1', manifest: tinyManifest('p1') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'p1' },
      bodyMd: 'first',
    });
    const dir = path.join(tmpRoot, 'direct');
    const result = await writeComicOutcome({
      cookRef: 'cook_direct000001',
      aim: 'direct write',
      stashRef: stash.stashRef,
      outcomeDir: dir,
      format: 'sunday-strip',
      fidelity: 'inks',
    });
    expect(result.format).toBe('sunday-strip');
    expect(result.fidelity).toBe('inks');
    const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.publication.format).toBe('sunday-strip');
    expect(manifest.publication.fidelity).toBe('inks');
  });
});
