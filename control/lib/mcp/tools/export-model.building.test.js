// export_model on a building level: a stage whose `program` is its building program (`{ use, seed }`, era/programs.js)
// exports as the stage it is. The exporter used to read every row's `program` as the code kind's and refused each one
// ("program.source must be a non-empty string"), while the game page played them.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-building-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { hasCodeProgram } from '@/lib/graph/worlds/workbench-program';
import { exportModelHandler } from './sketch-model-export.js';

describe('export_model on a building level', () => {
  it('a stage\'s building program is not a code program; a workbench\'s is', () => {
    expect(hasCodeProgram({ kind: 'stage', program: { use: 'crypt', seed: 1 } })).toBe(false);
    expect(hasCodeProgram({ kind: 'workbench', program: { source: 'return { lathes: [] };' } })).toBe(true);
    // a workbench program missing its source is still the code kind's, and still refused there with its teaching error
    expect(hasCodeProgram({ kind: 'workbench', program: {} })).toBe(true);
    expect(hasCodeProgram({ kind: 'stage' })).toBe(false);
  });

  it('exports a stage laid from its use to html', async () => {
    SketchRepository.create({ ref: 'sk_crypt_level', title: 'crypt', manifest: { kind: 'stage', kit: 'gothic-stone', dress: false, program: { use: 'crypt', seed: 1 } } });
    const out = await exportModelHandler({ ref: 'sk_crypt_level', format: 'html' });
    expect(out.ok).toBe(true);
    expect(out.kind).toBe('stage');
    expect(out.code).toBeUndefined();   // no code ledger: nothing ran in the code realm
  }, 120000);
});
