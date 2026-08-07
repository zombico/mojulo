// End-to-end tests for the photojournal publication kind. Real SQLite
// (in-memory), real filesystem (temp dirs for both outcomes and stored media),
// real markdown render. Mirrors the posture of instruction-manual.test.js.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb } from '../../db/index.js';
import { StashRepository } from '../../db/repositories/stashes.js';
import { uploadFile } from '../../storage/index.js';
import { writePhotojournalOutcome, PHOTOJOURNAL_VERSION, _internals } from './photojournal.js';
import { extFromMime } from '../resolvers/image.js';

// Tiny opaque "photo" bytes — the resolver only reads bytes, it doesn't decode.
function fakePhotoBytes(tag) {
  return Buffer.from(`\x89PNG fake-photo ${tag}`, 'binary');
}

// Gather an image item, uploading its bytes into stored media first so the
// resolver can read them back. Returns the item id.
async function gatherPhoto({ stashRef, drawer, key, mime = 'image/jpeg', caption, label }) {
  await uploadFile(key, fakePhotoBytes(key));
  const item = StashRepository.gather({
    stashRef,
    drawer,
    type: 'image',
    title: label || key,
    bodyMd: caption,
    mediaRef: key,
    metadata: { mime, width: 1200, height: 800, content_hash: `sha256-${key}`, label },
  });
  return item.id;
}

let tmpRoot;
let storageRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-photojournal-e2e-'));
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-photojournal-store-'));
  process.env.MOJULO_OUTCOMES_DIR = tmpRoot;
  process.env.STORAGE_ROOT = storageRoot;
  const db = getDb();
  db.exec(
    'DELETE FROM stash_cooks; DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes;',
  );
});

afterEach(async () => {
  delete process.env.MOJULO_OUTCOMES_DIR;
  delete process.env.STORAGE_ROOT;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe('photojournal — pure helpers (_internals)', () => {
  it('extFromMime maps common image mimes and falls back to the subtype', () => {
    expect(extFromMime('image/jpeg')).toBe('jpg');
    expect(extFromMime('image/png')).toBe('png');
    expect(extFromMime('image/webp')).toBe('webp');
    expect(extFromMime('image/heic')).toBe('heic'); // unknown → subtype
    expect(extFromMime(null)).toBe('img');
  });

  it('planJournalFromStash lifts the first image as the cover and groups drawers as sections', () => {
    const items = [
      { id: 1, type: 'image', drawerId: null, mediaRef: 'a', metadata: { mime: 'image/jpeg' }, bodyMd: 'cap a' },
      { id: 2, type: 'markdown', drawerId: null, bodyMd: 'an interlude' },
      { id: 3, type: 'image', drawerId: 9, mediaRef: 'b', metadata: { mime: 'image/png' }, bodyMd: 'cap b' },
      { id: 4, type: 'svg', drawerId: 9, body: '<svg/>' },
    ];
    const full = { drawers: [{ id: 9, name: 'day two' }], items };
    const plan = _internals.planJournalFromStash(full);
    expect(plan.cover.stashItemId).toBe(1);
    // section 0 = root (the markdown interlude); section 1 = the 'day two' drawer (photo b)
    expect(plan.sections.map((s) => s.name)).toEqual([null, 'day two']);
    expect(plan.sections[0].entries[0]).toMatchObject({ kind: 'prose', stashItemId: 2 });
    expect(plan.sections[1].entries[0]).toMatchObject({ kind: 'photo', stashItemId: 3 });
    expect(plan.skippedItems).toEqual([
      { id: 4, type: 'svg', reason: expect.stringContaining('image (photo) and markdown') },
    ]);
  });
});

describe('photojournal — cook end-to-end', () => {
  it('renders a cover photo + scroll of captioned photos, writing one file per photo', async () => {
    const stash = StashRepository.mint({ title: 'Lisbon, October' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'alfama' });

    await gatherPhoto({ stashRef: stash.stashRef, key: 'cover-shot', mime: 'image/jpeg', caption: 'the river at dawn', label: 'Tagus' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: 'Notes from the first morning.' });
    await gatherPhoto({ stashRef: stash.stashRef, drawer: 'alfama', key: 'tiles', mime: 'image/png', caption: 'azulejo wall' });
    await gatherPhoto({ stashRef: stash.stashRef, drawer: 'alfama', key: 'tram', mime: 'image/webp', caption: 'the 28 climbing' });

    const res = await writePhotojournalOutcome({
      cookRef: 'cook_pjtest01',
      aim: 'Lisbon, October',
      stashRef: stash.stashRef,
      reportMd: 'A week of light and tile.',
    });

    expect(res.templateVersion).toBe(PHOTOJOURNAL_VERSION);
    expect(res.photoCount).toBe(3); // cover + 2 flow photos

    const html = await fs.readFile(res.indexPath, 'utf8');
    // Cover photo, title, blurb.
    expect(html).toContain('class="cover-photo" src="cover.jpg"');
    expect(html).toContain('Lisbon, October');
    expect(html).toContain('A week of light and tile.');
    // Section divider from the drawer.
    expect(html).toContain('<h2>alfama</h2>');
    // Flow photos rendered as files, not the cover.
    expect(html).toContain('src="photo-001.png"');
    expect(html).toContain('src="photo-002.webp"');
    expect(html).toContain('azulejo wall');
    // Prose interlude.
    expect(html).toContain('Notes from the first morning.');
    // Print-direct chrome stripping is present in the template.
    expect(html).toContain('@media print');

    // Files on disk.
    const dir = res.outcomeDir;
    const onDisk = await fs.readdir(dir);
    expect(onDisk).toEqual(expect.arrayContaining([
      'cover.jpg', 'photo-001.png', 'photo-002.webp', 'index.html', 'report.md', 'manifest.json',
    ]));

    const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.template).toBe('photojournal');
    expect(manifest.cover.filename).toBe('cover.jpg');
    expect(manifest.photo_count).toBe(3);
  });

  it('throws when the stash has no image items', async () => {
    const stash = StashRepository.mint({ title: 'just words' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: 'no photos here' });
    await expect(
      writePhotojournalOutcome({ cookRef: 'cook_pjtest02', aim: 'empty', stashRef: stash.stashRef }),
    ).rejects.toThrow(/no image items/);
  });

  it('renders a placeholder (dangling) when a photo\'s media is missing', async () => {
    const stash = StashRepository.mint({ title: 'broken media' });
    // Gather an image whose bytes were never uploaded → media_ref dangles.
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'image',
      title: 'ghost',
      mediaRef: 'never-uploaded',
      metadata: { mime: 'image/jpeg', width: 10, height: 10, content_hash: 'x' },
    });
    const res = await writePhotojournalOutcome({
      cookRef: 'cook_pjtest03', aim: 'broken', stashRef: stash.stashRef,
    });
    const html = await fs.readFile(res.indexPath, 'utf8');
    expect(html).toContain('missing cover photo');
    const manifest = JSON.parse(await fs.readFile(path.join(res.outcomeDir, 'manifest.json'), 'utf8'));
    expect(manifest.cover.dangling).toBe(true);
  });
});
