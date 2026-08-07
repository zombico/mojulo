// End-to-end + unit tests for the `site` publication kind. Real SQLite
// (in-memory), real filesystem (temp outcomes dir), real markdown render.
// Mirrors the posture of lesson-plan.test.js / photojournal.test.js so it runs
// in the DEFAULT vitest config (the demo generator is *.gen.test.js, excluded).

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb } from '../../db/index.js';
import { StashRepository } from '../../db/repositories/stashes.js';
import { writeSiteOutcome, SITE_VERSION, _internals } from './site.js';

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-site-e2e-'));
  process.env.MOJULO_OUTCOMES_DIR = tmpRoot;
  const db = getDb();
  db.exec('DELETE FROM stash_cooks; DELETE FROM stash_items; DELETE FROM stash_drawers; DELETE FROM stashes;');
});

afterEach(async () => {
  delete process.env.MOJULO_OUTCOMES_DIR;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

// Build a small three-page site fixture. Returns { stashRef }.
function buildFixture() {
  const stash = StashRepository.mint({ title: 'Acme Co' });
  const stashRef = stash.stashRef;
  const g = (o) => StashRepository.gather({ stashRef, ...o });

  g({ type: 'text', title: 'We build the thing', body: 'A one-line pitch.', metadata: { role: 'hero', site: { name: 'Acme Co', tagline: 'The thing, built well' } } });
  g({ type: 'link', title: 'Get started', sourceUrl: 'contact.html', metadata: { role: 'cta' } });
  g({ type: 'text', title: 'Fast', body: 'Very fast.', metadata: { role: 'feature' } });
  g({ type: 'text', title: 'Reliable', body: 'Always up.', metadata: { role: 'feature' } });
  g({ type: 'markdown', bodyMd: '## Why us\n\nBecause we care.' });

  StashRepository.mintDrawer({ stashRef, name: 'About' });
  g({ type: 'markdown', drawer: 'About', bodyMd: '# About\n\nWe started in a garage.' });

  StashRepository.mintDrawer({ stashRef, name: 'Contact' });
  g({ type: 'markdown', drawer: 'Contact', bodyMd: '# Contact', metadata: { seo: { description: 'Reach Acme Co.' } } });
  g({ type: 'link', drawer: 'Contact', title: 'mail us', sourceUrl: 'mailto:hi@acme.co' });

  g({ type: 'text', title: 'Acme Co', body: 'HQ: Nowhere', metadata: { role: 'footer' } });
  return { stashRef };
}

describe('site — pure helpers', () => {
  it('slug normalizes drawer names and never empties', () => {
    expect(_internals.slug('Our Services!')).toBe('our-services');
    expect(_internals.slug('  A/B  ')).toBe('a-b');
    expect(_internals.slug('')).toBe('page');
    expect(_internals.slug('***')).toBe('page');
  });

  it('splitHeading lifts a leading # heading', () => {
    expect(_internals.splitHeading('# Title\n\nbody')).toEqual({ title: 'Title', rest: 'body' });
    expect(_internals.splitHeading('no heading here').title).toBe('');
  });

  it('firstParagraph strips markdown to a plain lede', () => {
    expect(_internals.firstParagraph('# H\n\nHello **world**')).toBe('Hello world');
    expect(_internals.firstParagraph('')).toBe('');
  });

  it('planPages puts root items on home and one page per drawer, in order', () => {
    const { stashRef } = buildFixture();
    const full = StashRepository.getFull(stashRef);
    const skipped = [];
    const pages = _internals.planPages(full, skipped);
    expect(pages.map((p) => p.slug)).toEqual(['home', 'about', 'contact']);
    expect(pages[0].isHome).toBe(true);
    expect(pages[0].file).toBe('index.html');
    expect(pages[1].file).toBe('about.html');
  });
});

describe('site — end-to-end', () => {
  it('writes one HTML file per page + report.md + manifest.json', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_test1', aim: 'Acme Co site', stashRef, preset: 'business' });
    expect(res.templateVersion).toBe(SITE_VERSION);
    expect(res.pageCount).toBe(3);
    const files = await fs.readdir(res.outcomeDir);
    for (const f of ['index.html', 'about.html', 'contact.html', 'report.md', 'manifest.json']) {
      expect(files).toContain(f);
    }
    const manifest = JSON.parse(await fs.readFile(path.join(res.outcomeDir, 'manifest.json'), 'utf8'));
    expect(manifest.preset).toBe('business');
    expect(manifest.pages.map((p) => p.slug)).toEqual(['home', 'about', 'contact']);
  });

  it('every page has nav, footer, preset attr, and the site name in <title>', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_test2', aim: 'Acme', stashRef, preset: 'marketing' });
    for (const page of ['index.html', 'about.html', 'contact.html']) {
      const html = await fs.readFile(path.join(res.outcomeDir, page), 'utf8');
      expect(html).toContain('class="site-nav"');
      expect(html).toContain('class="site-footer"');
      expect(html).toContain('data-preset="marketing"');
      expect(html).toContain('<title>');
      expect(html).toContain('Acme Co'); // site name (from metadata.site.name)
    }
  });

  it('home renders a hero (from role=hero) with a CTA button and a feature grid', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_test3', aim: 'Acme', stashRef, preset: 'marketing' });
    const home = await fs.readFile(path.join(res.outcomeDir, 'index.html'), 'utf8');
    expect(home).toContain('class="hero"');
    expect(home).toContain('We build the thing');   // hero title
    expect(home).toContain('class="btn"');           // CTA
    expect(home).toContain('class="grid"');          // feature cards
    expect(home).toContain('Get started');
  });

  it('PORTABILITY: no absolute internal links, no baked /outcomes/ origin', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_test4', aim: 'Acme', stashRef, preset: 'personal' });
    for (const page of ['index.html', 'about.html', 'contact.html']) {
      const html = await fs.readFile(path.join(res.outcomeDir, page), 'utf8');
      expect(html).not.toContain('/outcomes/');
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const href of hrefs) {
        if (!/^(https?:|mailto:|tel:|#)/.test(href)) {
          expect(href.startsWith('/'), `absolute internal href: ${href}`).toBe(false);
        }
      }
    }
  });

  it('footer-role items are site-global (render on every page)', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_test5', aim: 'Acme', stashRef, preset: 'business' });
    for (const page of ['index.html', 'about.html', 'contact.html']) {
      const html = await fs.readFile(path.join(res.outcomeDir, page), 'utf8');
      expect(html, `${page} footer contact`).toContain('HQ: Nowhere');
    }
  });

  it('applies an accent override INLINE on <body> (beats the preset token block)', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_accent', aim: 'x', stashRef, preset: 'personal', accent: '#0F5257' });
    const home = await fs.readFile(path.join(res.outcomeDir, 'index.html'), 'utf8');
    // Inline style on body wins over the preset's own --accent (specificity 1,0,0,0).
    expect(home).toMatch(/<body[^>]*style="--accent: #0F5257"/);
    expect(home).toContain('data-preset="personal"'); // preset still applied
  });

  it('ignores a non-hex accent (belt-and-suspenders; cook resolves names to hex upstream)', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_accent2', aim: 'x', stashRef, accent: 'javascript:alert(1)' });
    const home = await fs.readFile(path.join(res.outcomeDir, 'index.html'), 'utf8');
    expect(home).not.toContain('javascript:');
    expect(home).toMatch(/<body data-preset="business" data-page="home">/);
  });

  it('rejects an unknown preset', async () => {
    const { stashRef } = buildFixture();
    await expect(writeSiteOutcome({ cookRef: 'cook_bad', aim: 'x', stashRef, preset: 'neon' }))
      .rejects.toThrow(/preset 'neon' is not a known preset/);
  });

  it('defaults to the business preset when none is given', async () => {
    const { stashRef } = buildFixture();
    const res = await writeSiteOutcome({ cookRef: 'cook_def', aim: 'x', stashRef });
    expect(res.preset).toBe('business');
  });

  it('throws when the stash has no renderable items', async () => {
    const stash = StashRepository.mint({ title: 'Empty' });
    await expect(writeSiteOutcome({ cookRef: 'cook_empty', aim: 'x', stashRef: stash.stashRef }))
      .rejects.toThrow(/0 renderable items/);
  });
});
