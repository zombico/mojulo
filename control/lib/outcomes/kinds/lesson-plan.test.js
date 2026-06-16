// End-to-end tests for the lesson_plan publication kind. Real SQLite
// (in-memory), real filesystem (temp dir), real markdown + SVG render. Mirrors
// the posture of instruction-manual.test.js / comic.test.js.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb } from '../../db/index.js';
import { StashRepository } from '../../db/repositories/stashes.js';
import { SketchRepository } from '../../db/repositories/sketches.js';
import { cookHandler, recommendKindHandler } from '../../mcp/tools/cook.js';
import { LESSON_PLAN_VERSION, _internals } from './lesson-plan.js';

function tinyManifest(label) {
  return {
    viewBox: { width: 320, height: 200 },
    stations: [{ id: 's', kind: 'input', label, x: 40, y: 60, w: 240, h: 80 }],
    edges: [],
  };
}

let tmpRoot;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-lesson-e2e-'));
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

describe('lesson_plan — pure helpers (_internals)', () => {
  it('splitMarkdownHeader pulls the leading # title', () => {
    const { title, rest } = _internals.splitMarkdownHeader('# Warm up\n\nAct out the verb.');
    expect(title).toBe('Warm up');
    expect(rest).toBe('Act out the verb.');
  });

  it('peelTrailingAnswer extracts a trailing > **Answer:** blockquote', () => {
    const { questionMd, answer } = _internals.peelTrailingAnswer(
      'What gas do plants release?\n\n> **Answer:** Oxygen.',
    );
    expect(questionMd).toBe('What gas do plants release?');
    expect(answer).toBe('Oxygen.');
  });

  it('peelTrailingAnswer leaves the body untouched when the blockquote is not an answer', () => {
    const { questionMd, answer } = _internals.peelTrailingAnswer(
      'Discuss in pairs.\n\n> A hint, not a key.',
    );
    expect(questionMd).toBe('Discuss in pairs.\n\n> A hint, not a key.');
    expect(answer).toBe('');
  });

  it('splitAnswer prefers a structured metadata.lesson.answer over an in-body block', () => {
    const { questionMd, answer } = _internals.splitAnswer({
      bodyMd: 'Name the capital.\n\n> **Answer:** in body',
      metadata: { lesson: { answer: 'Structured wins' } },
    });
    expect(answer).toBe('Structured wins');
    expect(questionMd).toContain('Name the capital.');
  });

  it('itemAudience honors an explicit valid audience, else falls to the drawer default', () => {
    expect(_internals.itemAudience({ metadata: { audience: 'learner' } }, 'both')).toBe('learner');
    expect(_internals.itemAudience({ metadata: { audience: 'bogus' } }, 'teacher')).toBe('teacher');
    expect(_internals.itemAudience({ metadata: {} }, 'both')).toBe('both');
  });

  it('audienceIncludes gates faces correctly', () => {
    expect(_internals.audienceIncludes('teacher', 'teacher')).toBe(true);
    expect(_internals.audienceIncludes('teacher', 'learner')).toBe(false);
    expect(_internals.audienceIncludes('both', 'learner')).toBe(true);
    expect(_internals.audienceIncludes('learner', 'teacher')).toBe(false);
  });

  it('humanizeBand renders a readable label', () => {
    expect(_internals.humanizeBand('lower_primary')).toBe('Lower Primary');
  });

  it('buildSections orders overview first, reserved drawers in anatomy order, unknown last', () => {
    const full = {
      stash: { title: 't' },
      drawers: [{ id: 1, name: 'activities' }, { id: 2, name: 'objectives' }, { id: 3, name: 'myextra' }],
      items: [
        { id: 10, type: 'markdown', drawer: 'activities', bodyMd: 'a' },
        { id: 11, type: 'markdown', drawer: 'objectives', bodyMd: 'o' },
        { id: 12, type: 'markdown', drawer: null, bodyMd: 'root' },
        { id: 13, type: 'markdown', drawer: 'myextra', bodyMd: 'x' },
      ],
    };
    const { sections, skipped } = _internals.buildSections(full, null);
    expect(sections.map((s) => s.key)).toEqual(['overview', 'objectives', 'activities', 'myextra']);
    expect(skipped).toEqual([]);
  });
});

describe('lesson_plan — cook end-to-end', () => {
  async function buildLessonStash() {
    const stash = StashRepository.mint({ title: 'Photosynthesis' });
    for (const name of ['objectives', 'references', 'activities', 'assessment', 'teacher_notes']) {
      StashRepository.mintDrawer({ stashRef: stash.stashRef, name });
    }
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'objectives', type: 'markdown',
      bodyMd: '# Objective\n\nStudents will be able to explain photosynthesis.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'references', type: 'link',
      sourceUrl: 'https://example.org/photosynthesis', title: 'Photosynthesis overview',
    });
    const sk = SketchRepository.create({ title: 'leaf', manifest: tinyManifest('leaf') });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'activities', type: 'markdown',
      bodyMd: '# Observe a leaf\n\nHold the leaf to the light and describe what you see.',
      metadata: { lesson: { timing: '10 min', teacher_note: 'Watch for the common chlorophyll mixup.' } },
    });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'activities', type: 'sketch',
      bodyMd: 'cross-section', metadata: { sketch_ref: sk.ref, label: 'leaf cross-section' },
    });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'assessment', type: 'markdown',
      bodyMd: 'What gas do plants release?\n\n> **Answer:** Oxygen — the secret key.',
    });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'teacher_notes', type: 'markdown',
      bodyMd: 'Pace this over two periods if the class is large.',
    });
    // An unaccepted type — should be skipped with a record.
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'activities', type: 'script',
      body: 'console.log(1)', metadata: { language: 'js' },
    });
    return stash;
  }

  it('renders two faces, routes items by audience, strips the answer key + teacher matter from the handout', async () => {
    const stash = await buildLessonStash();
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Photosynthesis basics',
      report_md: 'A one-period intro to how plants make food.',
      publication: { kind: 'lesson_plan', style: { learner_band: 'middle' } },
    });

    expect(result.ok).toBe(true);
    expect(result.template_version).toBe(LESSON_PLAN_VERSION);

    const files = (await fs.readdir(result.outcome_dir)).sort();
    expect(files).toEqual([
      'figure-001.svg',
      'handout.html',
      'index.html',
      'manifest.json',
      'report.md',
    ]);

    const teacher = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    const handout = await fs.readFile(path.join(result.outcome_dir, 'handout.html'), 'utf8');

    // Shared spine on both faces.
    expect(teacher).toContain('Photosynthesis basics');
    expect(handout).toContain('Photosynthesis basics');
    expect(teacher).toContain('Students will be able to explain photosynthesis.');
    expect(handout).toContain('Students will be able to explain photosynthesis.');
    expect(teacher).toContain('Photosynthesis overview');   // reference card
    expect(handout).toContain('Photosynthesis overview');
    expect(teacher).toContain('What gas do plants release?');
    expect(handout).toContain('What gas do plants release?');

    // Teacher-only richness — present on teacher, absent from handout.
    expect(teacher).toContain('10 min');                            // timing badge
    expect(handout).not.toContain('10 min');
    expect(teacher).toContain('Watch for the common chlorophyll'); // teacher note
    expect(handout).not.toContain('Watch for the common chlorophyll');
    expect(teacher).toContain('Oxygen — the secret key');          // answer key
    expect(handout).not.toContain('Oxygen — the secret key');
    expect(teacher).toContain('Pace this over two periods');       // teacher_notes drawer
    expect(handout).not.toContain('Pace this over two periods');
    expect(teacher).toContain('Teacher notes');                    // section heading
    expect(handout).not.toContain('Teacher notes');

    // Band scaffolding hook on the handout root.
    expect(handout).toContain('data-band="middle"');

    // Cross-links between the two faces.
    expect(teacher).toContain('href="handout.html"');
    expect(handout).toContain('href="index.html"');

    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.template).toBe('lesson_plan');
    expect(manifest.face).toBe('both');
    expect(manifest.learner_band).toBe('middle');
    expect(manifest.drawer_audience.teacher_notes).toBe('teacher');
    expect(manifest.skipped_items).toEqual([
      expect.objectContaining({ type: 'script', reason: expect.stringContaining('lesson_plan does not render') }),
    ]);
    // The teacher_notes section has a teacher item but zero learner items.
    const tn = manifest.sections.find((s) => s.key === 'teacher_notes');
    expect(tn.teacher_item_count).toBe(1);
    expect(tn.learner_item_count).toBe(0);
  });

  it('defaults to the secondary band when no learner_band is given', async () => {
    const stash = StashRepository.mint({ title: 'tiny' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'activities' });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'activities', type: 'markdown',
      bodyMd: '# Step\n\nDo the thing.',
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Tiny lesson',
      publication: { kind: 'lesson_plan' },
    });
    const handout = await fs.readFile(path.join(result.outcome_dir, 'handout.html'), 'utf8');
    expect(handout).toContain('data-band="secondary"');
    const manifest = JSON.parse(await fs.readFile(path.join(result.outcome_dir, 'manifest.json'), 'utf8'));
    expect(manifest.learner_band).toBe('secondary');
  });

  it('rejects an unknown learner_band', async () => {
    const stash = StashRepository.mint({ title: 'bad band' });
    StashRepository.gather({
      stashRef: stash.stashRef, type: 'markdown', bodyMd: '# X\n\nbody',
    });
    await expect(cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Bad band',
      publication: { kind: 'lesson_plan', style: { learner_band: 'kindergarten' } },
    })).rejects.toThrow(/learner_band/);
  });

  it('per-item audience override moves an item off the default face', async () => {
    const stash = StashRepository.mint({ title: 'override' });
    StashRepository.mintDrawer({ stashRef: stash.stashRef, name: 'activities' });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'activities', type: 'markdown',
      bodyMd: '# Teacher only\n\nSetup the projector before class.',
      metadata: { audience: 'teacher' },
    });
    StashRepository.gather({
      stashRef: stash.stashRef, drawer: 'activities', type: 'markdown',
      bodyMd: '# Learner only\n\nOpen your workbook to page 4.',
      metadata: { audience: 'learner' },
    });
    const result = await cookHandler({
      slices: [{ stash_ref: stash.stashRef }],
      aim: 'Override lesson',
      publication: { kind: 'lesson_plan' },
    });
    const teacher = await fs.readFile(path.join(result.outcome_dir, 'index.html'), 'utf8');
    const handout = await fs.readFile(path.join(result.outcome_dir, 'handout.html'), 'utf8');
    expect(teacher).toContain('Setup the projector');
    expect(teacher).not.toContain('Open your workbook');
    expect(handout).toContain('Open your workbook');
    expect(handout).not.toContain('Setup the projector');
  });

  it('recommend_kind surfaces lesson_plan for a lesson-shaped stash', async () => {
    const stash = await buildLessonStash();
    const out = await recommendKindHandler({ stash_ref: stash.stashRef, limit: 16 });
    const lp = out.recommendations.find((r) => r.kind === 'lesson_plan');
    expect(lp).toBeTruthy();
    expect(lp.score).toBeGreaterThan(0);
  });
});
