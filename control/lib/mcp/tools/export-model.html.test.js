// grok-headless-affordances P4 — `export_model format: 'html'`, the remote eyes gate.
// A host with no browser of its own hands the operator a FILE; that file must open from
// file:// with nothing else: no server, no network, no ./model.glb fetch. This pins the
// seed-91 city the maintainer reproduced (44 buildings / 509 boxes / 45 leftover lots /
// 121 park doodads) as deterministic, self-contained bytes in the outcome folder.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-html-outcomes-'));

import { composeWorld } from './compose-world.js';
import { exportModelHandler } from './sketch-model-export.js';

const CITY = {
  base: 'city', seed: 91, ref: 'sk_nine_block_city',
  overrides: {
    context: { depth: 3, density: 0.82, baseScale: 0.7, locale: 'north-america', time: 'day' },
    region: { x: 0, y: 0, w: 36, d: 36 },
  },
};

describe('export_model format:html', () => {
  it('writes a self-contained, deterministic world.html beside recipe.json and README.md', async () => {
    const minted = composeWorld(CITY);
    expect(minted.ref).toBe('sk_nine_block_city');
    expect(minted.stats.buildings).toBe(44);
    // RE-PINNED 509 → 647 → 685 → 657 with the fractal-city `frontage` channel: a NEW mint writes
    // `elements.frontage: true` into its manifest (the one new-mint default that differs from a
    // stored row); the parking-entrance dressing on the large masses and the dead-end drop-off
    // aprons (islands, bollards, planters) are the extra boxes; the last step (685 → 657) is the
    // ramp portal losing its two outer curb-wall steps each side — four boxes fewer on each of
    // this city's seven ramps. The maintainer's stored seed-91 row (no flag) still plans the 509
    // asserted below — nothing about the city's masses, roads or blocks moved.
    expect(minted.recipe.elements.frontage).toBe(true);
    expect(minted.stats.boxes).toBe(657);
    expect(minted.stats.frontage.parking).toBeGreaterThan(0);
    expect(minted.stats.blocks).toBe(47);   // P5: the street-grid parcels the recursion filled
    const pinned = composeWorld({ ...CITY, ref: 'sk_nine_block_city_pinned', overrides: { ...CITY.overrides, asset: { elements: { frontage: false } } } });
    expect(pinned.stats.boxes).toBe(509);
    expect(pinned.stats.buildings).toBe(44);

    const a = await exportModelHandler({ ref: CITY.ref, format: 'html' });
    expect(a.ok).toBe(true);
    expect(a.format).toBe('html');
    expect(a.kind).toBe('fractal-city');
    expect(a.walk).toBe(true);
    expect(a).not.toHaveProperty('vertices');
    expect(a.url).toBe('/api/sketches/sk_nine_block_city/world?download=1');
    expect(a.path).toBe(path.join(process.env.MOJULO_OUTCOMES_DIR, CITY.ref, 'world.html'));
    expect(a.download_url).toBe('/outcomes/sk_nine_block_city/world.html');
    // cdn-default: the DEFAULT page is the CDN build — `world.html`, three.js off jsdelivr,
    // the only form an artifact host's CSP will execute. The self-contained build moved to
    // `cdn: false` → `world.offline.html` and is asserted in its own test below.
    expect(a.cdn).toBe(true);
    expect(a.note).toMatch(/file:\/\//);
    expect(a.note).toMatch(/cdn\.jsdelivr\.net/);
    expect(a.note).toMatch(/will NOT open from file:\/\//);
    expect(a).not.toHaveProperty('home');
    expect(existsSync(path.join(a.dir, 'recipe.json'))).toBe(true);
    const readme = readFileSync(path.join(a.dir, 'README.md'), 'utf8');
    expect(readme).toMatch(/`world\.html` is its deterministic derived snapshot/);
    expect(readme).toMatch(/HTML: `world\.html` is the live World page itself/);

    const html = readFileSync(a.path, 'utf8');
    expect(Buffer.byteLength(html)).toBe(a.bytes);
    // three.js rides the pinned jsdelivr importmap — NOT a `data:` module, which the artifact
    // door's `script-src` refuses at any size, and not the loopback /vendor path either.
    expect(html).toMatch(/<script type="importmap">/);
    expect(html).toMatch(/"three": ?"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.min\.js"/);
    expect(html).not.toMatch(/data:text\/javascript;base64/);
    expect(html).not.toMatch(/\/vendor\/three/);
    expect(html).not.toMatch(/127\.0\.0\.1|localhost/);
    // every external URL is on the artifact door's CDN allowlist — one origin, the pinned one
    for (const url of html.match(/https?:\/\/[^"'\s)]+/g) ?? []) {
      expect(url.startsWith('https://cdn.jsdelivr.net/npm/')).toBe(true);
    }

    // Deterministic: the same row emits the same bytes.
    const b = await exportModelHandler({ ref: CITY.ref, format: 'html' });
    expect(b.bytes).toBe(a.bytes);
    expect(readFileSync(b.path, 'utf8')).toBe(html);
  }, 120_000);

  it("cdn:false writes the self-contained world.offline.html beside it, unchanged", async () => {
    const cdnPage = await exportModelHandler({ ref: CITY.ref, format: 'html' });
    const off = await exportModelHandler({ ref: CITY.ref, format: 'html', cdn: false });
    expect(off.ok).toBe(true);
    expect(off.cdn).toBe(false);
    // its own file: the default CDN page on disk is never overwritten by the offline build
    expect(off.path).toBe(path.join(cdnPage.dir, 'world.offline.html'));
    expect(off.download_url).toBe(`/outcomes/${CITY.ref}/world.offline.html`);
    expect(existsSync(cdnPage.path)).toBe(true);
    expect(off.note).toMatch(/no server, no network/);
    const html = readFileSync(off.path, 'utf8');
    expect(html).toMatch(/"three": ?"data:text\/javascript;base64,/);
    expect(html).not.toMatch(/https?:\/\//);
    // the ~1 MB of three.js is the whole difference between the two builds
    expect(off.bytes - cdnPage.bytes).toBeGreaterThan(900_000);
    // deterministic too
    const again = await exportModelHandler({ ref: CITY.ref, format: 'html', cdn: false });
    expect(again.bytes).toBe(off.bytes);
  }, 120_000);

  it('write:false returns the bytes without touching disk', async () => {
    const r = await exportModelHandler({ ref: CITY.ref, format: 'html', write: false });
    expect(r.ok).toBe(true);
    expect(r.bytes).toBeGreaterThan(100_000);
    expect(r).not.toHaveProperty('path');
  }, 60_000);

  it('ineligible kinds answer the same { ok:false, eligible:false } as the mesh legs', async () => {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    SketchRepository.create({ ref: 'sk_html_flat', title: 'flat', manifest: { kind: 'flow', nodes: [], edges: [] } });
    const r = await exportModelHandler({ ref: 'sk_html_flat', format: 'html' });
    expect(r.ok).toBe(false);
    expect(r.eligible).toBe(false);
  });

  it('reports `home` when the cwd fallback put the file inside the package directory (P3)', async () => {
    const savedOut = process.env.MOJULO_OUTCOMES_DIR;
    const savedCtl = process.env.MOJULO_CONTROL_DIR;
    delete process.env.MOJULO_OUTCOMES_DIR;
    process.env.MOJULO_CONTROL_DIR = process.cwd();
    const dir = path.join(process.cwd(), 'data', 'outcomes', CITY.ref);
    try {
      const r = await exportModelHandler({ ref: CITY.ref, format: 'html' });
      expect(r.path).toBe(path.join(dir, 'world.html'));
      expect(r.home).toMatch(/inside the installed package directory/);
      expect(r.home).toMatch(/MOJULO_DATA_DIR/);
    } finally {
      process.env.MOJULO_OUTCOMES_DIR = savedOut;
      if (savedCtl === undefined) delete process.env.MOJULO_CONTROL_DIR;
      else process.env.MOJULO_CONTROL_DIR = savedCtl;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
