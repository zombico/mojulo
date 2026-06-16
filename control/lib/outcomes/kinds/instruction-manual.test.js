// End-to-end tests for the instruction_manual publication kind. Real SQLite
// (in-memory), real filesystem (temp dir), real markdown + SVG render. Mirrors
// the posture of comic.test.js.

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
import { renderSketchToSvg } from '../../graph/sketch-svg.js';
import {
  writeInstructionManualOutcome, INSTRUCTION_MANUAL_VERSION, _internals,
} from './instruction-manual.js';

function tinyManifest(label) {
  return {
    viewBox: { width: 320, height: 200 },
    stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
    edges: [],
  };
}

// A manifest carrying a default-colored text mark (no explicit `color`), so its
// fill comes from the theme var — the case that regressed to invisible white.
function labelledManifest(value) {
  return {
    viewBox: { width: 320, height: 200 },
    marks: [
      { kind: 'line', x1: 20, y1: 100, x2: 300, y2: 100, stroke: '#1a1a1a', strokeWidth: 2 },
      { kind: 'text', x: 160, y: 60, value, size: 14, anchor: 'middle' },
    ],
  };
}

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-immanual-e2e-'));
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

describe('instruction_manual — pure helpers (_internals)', () => {
  it('splitMarkdownHeader pulls the leading # title', () => {
    const { title, rest } = _internals.splitMarkdownHeader('# Attach the legs\n\nFlip the panel over.');
    expect(title).toBe('Attach the legs');
    expect(rest).toBe('Flip the panel over.');
  });

  it('peelTrailingFinePrint extracts a trailing blockquote as fine print', () => {
    const { body, finePrint } = _internals.peelTrailingFinePrint(
      'Press the dowel home.\n\n> Do not overtighten — the cam can strip.',
    );
    expect(body).toBe('Press the dowel home.');
    expect(finePrint).toBe('Do not overtighten — the cam can strip.');
  });

  it('peelTrailingFinePrint leaves body untouched when there is no trailing quote', () => {
    const { body, finePrint } = _internals.peelTrailingFinePrint('Just a step, no warning.');
    expect(body).toBe('Just a step, no warning.');
    expect(finePrint).toBe('');
  });
});

describe('instruction_manual — cook end-to-end', () => {
  it('pairs each step with the sketch gathered right after it, and renders parts + fine print', async () => {
    const stash = StashRepository.mint({ title: 'Assemble the Foo desk' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'part-1-prepare' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'part-2-assemble' });

    const sk1 = SketchRepository.create({ title: 'd1', manifest: tinyManifest('legs') });
    const sk2 = SketchRepository.create({ title: 'd2', manifest: tinyManifest('top') });

    // Part 1: a single prep step + its diagram.
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'part-1-prepare',
      type: 'markdown',
      bodyMd: '# Lay out the parts\n\nUnpack and count the hardware.\n\n> Keep small parts away from children.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'part-1-prepare',
      type: 'sketch',
      metadata: { sketch_ref: sk1.ref, label: 'inventory' },
    });

    // Part 2: a step + its diagram.
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'part-2-assemble',
      type: 'markdown',
      bodyMd: '# Attach the top\n\nLower the top onto the frame and drive the four screws.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      drawer: 'part-2-assemble',
      type: 'sketch',
      metadata: { sketch_ref: sk2.ref, label: 'top' },
    });

    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Assemble the Foo desk',
      report_md: 'A flat-pack desk. ~20 minutes, one person.',
      publication: { kind: 'instruction_manual' },
    });

    expect(result.ok).toBe(true);
    expect(result.template_version).toBe(INSTRUCTION_MANUAL_VERSION);

    const files = (await fs.readdir(result.outcome_dir)).sort();
    expect(files).toEqual([
      'index.html',
      'manifest.json',
      'report.md',
      'step-001.svg',
      'step-002.svg',
    ]);

    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('Assemble the Foo desk');               // cover title
    expect(html).toContain('A flat-pack desk.');                   // cover blurb
    expect(html).toContain('class="part-eyebrow">Part 1');         // numbered part divider
    expect(html).toContain('class="part-eyebrow">Part 2');
    expect(html).toContain('class="page step-page"');              // step pages
    expect(html).toContain('Keep small parts away from children'); // trailing > → fine print
    expect(html).toContain('class="fine-print"');
    expect(html).toContain('--viewer-aspect: 7 / 10');             // portrait default

    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.template).toBe('instruction_manual');
    expect(manifest.template_version).toBe(INSTRUCTION_MANUAL_VERSION);
    expect(manifest.part_count).toBe(2);
    expect(manifest.step_count).toBe(2);
    expect(manifest.diagram_count).toBe(2);
    // Each step picked up the sketch gathered right after it.
    expect(manifest.parts[0].steps[0]).toMatchObject({ number: 1, title: 'Lay out the parts', has_diagram: true });
    expect(manifest.parts[1].steps[0]).toMatchObject({ number: 2, title: 'Attach the top', has_diagram: true });
    expect(manifest.skipped_items).toEqual([]);
  });

  it('opens a diagram-only page when a sketch has no preceding step', async () => {
    const stash = StashRepository.mint({ title: 'orphan diagram' });
    const sk = SketchRepository.create({ title: 'd', manifest: tinyManifest('overview') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'overview' },
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'orphan',
      publication: { kind: 'instruction_manual' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.step_count).toBe(1);
    expect(manifest.parts[0].steps[0]).toMatchObject({ number: 1, title: null, has_diagram: true });
  });

  it('renders a placeholder for dangling sketch refs', async () => {
    const stash = StashRepository.mint({ title: 'dangling' });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'markdown',
      bodyMd: '# Step\n\nDo the thing.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: 'sk_doesnotexist0', label: 'ghost' },
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'dangling',
      publication: { kind: 'instruction_manual' },
    });
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('missing diagram');
    expect(html).toContain('sk_doesnotexist0');
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.diagram_count).toBe(0); // dangling refs write no file
    expect(manifest.parts[0].steps[0].dangling).toBe(true);
  });

  it('skips non-accepted item types and records them', async () => {
    const stash = StashRepository.mint({ title: 'mixed' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Step\n\nbody' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'link', title: 'ref', sourceUrl: 'https://example.com' });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'mixed',
      publication: { kind: 'instruction_manual' },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.step_count).toBe(1);
    expect(manifest.skipped_items).toHaveLength(1);
    expect(manifest.skipped_items[0]).toMatchObject({ type: 'link' });
  });

  it('refuses an empty manual (no items)', async () => {
    const stash = StashRepository.mint({ title: 'empty' });
    await expect(
      cookHandler({
        slices: [{ stash_ref: stash.stashRef }],
        aim: 'empty',
        publication: { kind: 'instruction_manual' },
      }),
    ).rejects.toThrow(/0 items/);
  });
});

describe('sketch render surface theming (primitive)', () => {
  it('default (dark) surface resolves text vars to white', async () => {
    const svg = await renderSketchToSvg(labelledManifest('READ ME'));
    expect(svg).toContain('READ ME');
    expect(svg).toContain('#ffffff');     // --text-primary → white on dark
  });

  it('light surface resolves text vars to dark ink (legible on a light band)', async () => {
    const svg = await renderSketchToSvg(labelledManifest('READ ME'), { surface: 'light' });
    expect(svg).toContain('READ ME');
    expect(svg).toContain('#161616');     // --text-primary → dark on light
    // The default-colored label must NOT come out white on the light band.
    expect(svg).not.toMatch(/<text[^>]*fill="#ffffff"/);
  });
});

describe('instruction_manual — diagram band is light-surfaced + scroll-safe', () => {
  it('renders step diagrams with dark ink and a scroll-safe container-type', async () => {
    const stash = StashRepository.mint({ title: 'labelled build' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Step one\n\nDo it.' });
    const sk = SketchRepository.create({ title: 'd', manifest: labelledManifest('PART A') });
    StashRepository.gather({
      stashRef: stash.stashRef,
      type: 'sketch',
      metadata: { sketch_ref: sk.ref, label: 'part a' },
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'labelled build',
      publication: { kind: 'instruction_manual' },
    });

    // The diagram's default-colored label renders dark, not invisible white.
    const svg = await fs.readFile(path.join(result.outcome_dir, 'step-001.svg'), 'utf8');
    expect(svg).toContain('PART A');
    expect(svg).not.toMatch(/<text[^>]*fill="#ffffff"/);

    // Template guards against the scroll-mode collapse: step pages size from
    // content by default; only the active viewer page gets size containment.
    const html = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    expect(html).toContain('container-type: inline-size');
    expect(html).toMatch(/\.step-page\.viewer-active\s*\{\s*container-type:\s*size/);
    expect(html).not.toMatch(/\.step-page\s*\{[^}]*container-type:\s*size\b/);
  });
});

describe('instruction_manual — recommend_kind scorer', () => {
  it('scores instruction_manual highly for step markdown + diagrams across parts', async () => {
    const stash = StashRepository.mint({ title: 'build a shelf' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'part-1' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'part-2' });
    for (let i = 0; i < 5; i++) {
      StashRepository.gather({
        stashRef: stash.stashRef,
        drawer: i < 2 ? 'part-1' : 'part-2',
        type: 'markdown',
        bodyMd: `# Step ${i}\n\ndo it`,
      });
      const sk = SketchRepository.create({ title: `d${i}`, manifest: tinyManifest(`d${i}`) });
      StashRepository.gather({
        stashRef: stash.stashRef,
        drawer: i < 2 ? 'part-1' : 'part-2',
        type: 'sketch',
        metadata: { sketch_ref: sk.ref, label: `d${i}` },
      });
    }
    const r = await recommendKindHandler({ stash_ref: stash.stashRef, limit: 14 });
    const im = r.recommendations.find((x) => x.kind === 'instruction_manual');
    expect(im).toBeDefined();
    expect(im.score).toBeGreaterThan(50);
  });

  it('scores instruction_manual at 0 with neither markdown nor sketches', async () => {
    const stash = StashRepository.mint({ title: 'just text' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'text', body: 'a note' });
    const r = await recommendKindHandler({ stash_ref: stash.stashRef, limit: 14 });
    const im = r.recommendations.find((x) => x.kind === 'instruction_manual');
    expect(im).toBeDefined();
    expect(im.score).toBe(0);
  });
});

describe('instruction_manual — sketch_stash recipe', () => {
  it('returns the instruction_manual recipe with Part drawers + step/diagram slots', async () => {
    const r = await sketchStashHandler({ intent: 'assemble a desk', target_kind: 'instruction_manual' });
    expect(r.target_kind).toBe('instruction_manual');
    expect(r.proposed.drawers).toHaveLength(3);
    expect(r.proposed.drawers[0].name).toBe('part-1-prepare');
    expect(r.proposed.items.map((i) => i.type)).toEqual(['markdown', 'sketch', 'text']);
    expect(JSON.stringify(r.proposed.items)).toMatch(/assembly-line-art/); // the diagram slot's hint
    expect(r.suggested_steps[r.suggested_steps.length - 1]).toContain('kind: "instruction_manual"');
  });
});

describe('instruction_manual — direct writer (bypassing cook)', () => {
  it('writes the expected folder layout when called directly', async () => {
    const stash = StashRepository.mint({ title: 'direct' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'markdown', bodyMd: '# Only step\n\nbody' });
    const result = await writeInstructionManualOutcome({
      cookRef: 'cook_direct000001',
      aim: 'direct write',
      stashRef: stash.stashRef,
    });
    expect(result.templateVersion).toBe(INSTRUCTION_MANUAL_VERSION);
    expect(result.stepCount).toBe(1);
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcomeDir, 'manifest.json'), 'utf8'));
    expect(manifest.template).toBe('instruction_manual');
    expect(manifest.part_count).toBe(0); // no drawers → no numbered parts
  });
});
