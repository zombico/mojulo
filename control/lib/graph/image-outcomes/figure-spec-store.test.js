// Figure specs are user state. They used to live in <package>/data/figure-specs,
// which under npx is the _npx cache, so a version bump or a cache purge lost the
// pending ones. The store now sits under $MOJULO_HOME and copies the legacy
// folder across on first use: once, only into an empty store, never deleting.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { listSpecs, readSpec, SPEC_STATUS } from '@/lib/graph/image-outcomes/figure-spec-store';

let root;
let saved;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'figspec-migrate-'));
  saved = { control: process.env.MOJULO_CONTROL_DIR, specs: process.env.MOJULO_FIGURE_SPECS_DIR };
});

afterEach(() => {
  for (const [key, value] of [['MOJULO_CONTROL_DIR', saved.control], ['MOJULO_FIGURE_SPECS_DIR', saved.specs]]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
});

function plantLegacy(pkg, ref) {
  const legacy = path.join(pkg, 'data', 'figure-specs');
  mkdirSync(legacy, { recursive: true });
  const preview = path.join(legacy, `${ref}.preview.png`);
  writeFileSync(preview, 'png-bytes');
  writeFileSync(path.join(legacy, `${ref}.json`), JSON.stringify({
    ref, kind: 'figure-spec', status: SPEC_STATUS.PENDING, created_at: '2026-09-01T00:00:00.000Z',
    title: 'wizard', preview_png: preview,
  }));
  return legacy;
}

describe('figure-spec store — legacy folder migration', () => {
  it('copies <package>/data/figure-specs into an empty store and leaves the old folder alone', async () => {
    const pkg = path.join(root, 'pkg');
    const legacy = plantLegacy(pkg, 'fs_old');
    const target = path.join(root, 'home', 'data', 'figure-specs');
    process.env.MOJULO_CONTROL_DIR = pkg;
    process.env.MOJULO_FIGURE_SPECS_DIR = target;

    const specs = await listSpecs({ status: SPEC_STATUS.PENDING });
    expect(specs.map((s) => s.ref)).toEqual(['fs_old']);
    expect(readFileSync(path.join(target, 'fs_old.preview.png'), 'utf8')).toBe('png-bytes');
    // The preview pointer follows the copy, so it survives the npx cache going away.
    expect((await readSpec('fs_old')).preview_png).toBe(path.join(target, 'fs_old.preview.png'));
    // Copy, never move.
    expect(existsSync(path.join(legacy, 'fs_old.json'))).toBe(true);
    expect(existsSync(path.join(legacy, 'fs_old.preview.png'))).toBe(true);
  });

  it('does not copy into a store that already has specs', async () => {
    const pkg = path.join(root, 'pkg');
    plantLegacy(pkg, 'fs_old');
    const target = path.join(root, 'home2', 'figure-specs');
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, 'fs_new.json'), JSON.stringify({
      ref: 'fs_new', status: SPEC_STATUS.PENDING, created_at: '2026-09-02T00:00:00.000Z',
    }));
    process.env.MOJULO_CONTROL_DIR = pkg;
    process.env.MOJULO_FIGURE_SPECS_DIR = target;

    expect((await listSpecs({ status: SPEC_STATUS.PENDING })).map((s) => s.ref)).toEqual(['fs_new']);
    expect(existsSync(path.join(target, 'fs_old.json'))).toBe(false);
  });

  it('reads no legacy folder outside a bin (no MOJULO_CONTROL_DIR)', async () => {
    delete process.env.MOJULO_CONTROL_DIR;
    const target = path.join(root, 'home3', 'figure-specs');
    process.env.MOJULO_FIGURE_SPECS_DIR = target;
    expect(await listSpecs()).toEqual([]);
    expect(existsSync(target)).toBe(true);
  });
});
