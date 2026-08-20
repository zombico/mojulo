// OutcomeWriter integration test — exercises the full materialization path:
// folder creation, report.md, visual files, template fill, manifest.json. Uses
// a per-test temp directory so we never touch the dev DB or real outcomes dir.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeOutcome, TEMPLATE_VERSION, _internals } from './essay.js';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';

const { validateVisual, headline, FILENAME_SAFE } = _internals;

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-outcomes-'));
  process.env.MOJULO_OUTCOMES_DIR = tmpRoot;
});

afterEach(async () => {
  delete process.env.MOJULO_OUTCOMES_DIR;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('outcomeDirFor / outcomeUrlFor', () => {
  it('resolves the folder under MOJULO_OUTCOMES_DIR', () => {
    expect(outcomeDirFor('cook_abc')).toBe(path.join(tmpRoot, 'cook_abc'));
  });
  it('produces a URL under /outcomes/', () => {
    expect(outcomeUrlFor('cook_abc')).toBe('/outcomes/cook_abc/');
  });
});

describe('writeOutcome', () => {
  const baseArgs = {
    cookRef: 'cook_test12345',
    aim: 'How do Stashes and Plans relate?',
    slices: [
      { stashRef: 'st_aaa', title: 'Plan paradigm notes', whole: false, itemIds: [1, 2, 3], itemCount: 3, total: 12 },
      { stashRef: 'st_bbb', title: 'Stash paradigm notes', whole: true, itemCount: 7 },
    ],
    reportMd: [
      '# Ideation',
      '',
      'Plans converge; Stashes accrete. **Cook** is the collider that emits an Outcome.',
      '',
      '- Plans want a terminus.',
      '- Stashes do not.',
    ].join('\n'),
  };

  it('writes report.md, index.html, manifest.json, and returns the metadata', async () => {
    const r = await writeOutcome(baseArgs);
    expect(r.outcomeDir).toBe(path.join(tmpRoot, 'cook_test12345'));
    expect(r.indexPath).toBe(path.join(r.outcomeDir, 'index.html'));
    expect(r.templateVersion).toBe(TEMPLATE_VERSION);

    const files = (await fs.readdir(r.outcomeDir)).sort();
    expect(files).toEqual(['index.html', 'manifest.json', 'report.md']);

    const md = await fs.readFile(path.join(r.outcomeDir, 'report.md'), 'utf8');
    expect(md).toBe(baseArgs.reportMd);

    const manifest = JSON.parse(await fs.readFile(path.join(r.outcomeDir, 'manifest.json'), 'utf8'));
    expect(manifest.cook_ref).toBe('cook_test12345');
    expect(manifest.template_version).toBe(TEMPLATE_VERSION);
    expect(manifest.aim).toBe('How do Stashes and Plans relate?');
    expect(manifest.slices).toEqual([
      { stash_ref: 'st_aaa', title: 'Plan paradigm notes', whole: false, item_count: 3, item_ids: [1, 2, 3], total: 12 },
      { stash_ref: 'st_bbb', title: 'Stash paradigm notes', whole: true, item_count: 7 },
    ]);
    expect(manifest.files.sort()).toEqual(['index.html', 'report.md']);

    const html = await fs.readFile(path.join(r.outcomeDir, 'index.html'), 'utf8');
    expect(html).toContain('<title>How do Stashes and Plans relate?</title>');
    expect(html).toContain('<h1>How do Stashes and Plans relate?</h1>');
    expect(html).toContain('<strong>Cook</strong>');
    expect(html).toContain('Plan paradigm notes');
    expect(html).toContain('3 of 12 items'); // cleaved-slice chip
    expect(html).toContain('whole · 7 items'); // whole-stash chip
    expect(html).toContain('cook_test12345');
    expect(html).toContain(`mojulo cook / outcome template v${TEMPLATE_VERSION}`);
  });

  it('writes visual files and inlines SVG bodies into index.html', async () => {
    const svgBody = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="red"/></svg>';
    const r = await writeOutcome({
      ...baseArgs,
      cookRef: 'cook_visual0001',
      visuals: [{ filename: 'diagram.svg', type: 'svg', body: svgBody, caption: 'The shape' }],
    });

    const files = (await fs.readdir(r.outcomeDir)).sort();
    expect(files).toContain('diagram.svg');

    const svgFile = await fs.readFile(path.join(r.outcomeDir, 'diagram.svg'), 'utf8');
    expect(svgFile).toBe(svgBody);

    const html = await fs.readFile(path.join(r.outcomeDir, 'index.html'), 'utf8');
    // SVG inlined into index.html.
    expect(html).toContain('<rect width="50" height="50" fill="red"/>');
    expect(html).toContain('The shape');
    expect(html).toContain('<section class="visuals">');
  });

  it('writes PNG visuals as files and references them by relative URL', async () => {
    // tiny 1x1 transparent PNG
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const r = await writeOutcome({
      ...baseArgs,
      cookRef: 'cook_png00000001',
      visuals: [{ filename: 'pixel.png', type: 'png', data_base64: tinyPng, caption: 'one pixel' }],
    });

    const pngBytes = await fs.readFile(path.join(r.outcomeDir, 'pixel.png'));
    expect(pngBytes.length).toBeGreaterThan(0);

    const html = await fs.readFile(path.join(r.outcomeDir, 'index.html'), 'utf8');
    expect(html).toContain('<img src="pixel.png" alt="one pixel">');
  });

  it('rejects malformed visuals before writing anything', async () => {
    await expect(
      writeOutcome({
        ...baseArgs,
        cookRef: 'cook_bad00000001',
        visuals: [{ filename: '../../escape.svg', type: 'svg', body: '<svg/>' }],
      }),
    ).rejects.toThrow(/safe/);

    await expect(
      writeOutcome({
        ...baseArgs,
        cookRef: 'cook_bad00000002',
        visuals: [{ filename: 'fine.svg', type: 'svg', body: 'not svg' }],
      }),
    ).rejects.toThrow(/<\?xml or <svg/);
  });

  it('escapes raw HTML in the report markdown (no script injection)', async () => {
    const r = await writeOutcome({
      ...baseArgs,
      cookRef: 'cook_safe00000001',
      reportMd: '# Hi\n\n<script>alert(1)</script>',
    });
    const html = await fs.readFile(path.join(r.outcomeDir, 'index.html'), 'utf8');
    expect(html).toContain('&lt;script&gt;');
    // Allowlist the template's own <script>-free chrome: the only "script"
    // substring should be the escaped one.
    const scriptHits = html.match(/<script[\s>]/g);
    expect(scriptHits).toBe(null);
  });

  it('renders the lens chip when provided', async () => {
    const r = await writeOutcome({ ...baseArgs, cookRef: 'cook_lens0000001', suggestedLens: 'collider' });
    const html = await fs.readFile(path.join(r.outcomeDir, 'index.html'), 'utf8');
    expect(html).toContain('>collider<');
  });

  it('headline truncates long queries', () => {
    expect(headline('short')).toBe('short');
    expect(headline('x'.repeat(100), 20)).toMatch(/^x{19}…$/);
  });

  it('FILENAME_SAFE rejects path traversal and odd extensions', () => {
    expect(FILENAME_SAFE.test('foo.svg')).toBe(true);
    expect(FILENAME_SAFE.test('chart-1.png')).toBe(true);
    expect(FILENAME_SAFE.test('../escape.svg')).toBe(false);
    expect(FILENAME_SAFE.test('weird.js')).toBe(false);
    expect(FILENAME_SAFE.test('.hidden.svg')).toBe(false);
  });

  it('validateVisual catches missing fields', () => {
    expect(() => validateVisual({}, 0)).toThrow(/filename/);
    expect(() => validateVisual({ filename: 'x.svg', type: 'svg' }, 0)).toThrow(/body/);
    expect(() => validateVisual({ filename: 'x.png', type: 'png' }, 0)).toThrow(/data_base64/);
    expect(() => validateVisual({ filename: 'x.svg', type: 'xml', body: '<svg/>' }, 0)).toThrow(/type/);
  });
});
