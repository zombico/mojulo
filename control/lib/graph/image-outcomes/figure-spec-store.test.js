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

  // A pinned `npx -y mojulo@<new>` installs into its own _npx/<hash> folder; the old version's
  // specs are in the folder beside it, not in this package.
  it('under npx, copies specs from an earlier version folder beside this one', async () => {
    const npx = path.join(root, 'cache', '_npx');
    const oldPkg = path.join(npx, 'aaa111', 'node_modules', 'mojulo');
    const legacy = plantLegacy(oldPkg, 'fs_npx');
    const current = path.join(npx, 'bbb222', 'node_modules', 'mojulo');
    mkdirSync(current, { recursive: true });
    mkdirSync(path.join(npx, 'ccc333', 'node_modules', 'other'), { recursive: true });
    const target = path.join(root, 'home4', 'figure-specs');
    process.env.MOJULO_CONTROL_DIR = current;
    process.env.MOJULO_FIGURE_SPECS_DIR = target;

    expect((await listSpecs({ status: SPEC_STATUS.PENDING })).map((s) => s.ref)).toEqual(['fs_npx']);
    expect((await readSpec('fs_npx')).preview_png).toBe(path.join(target, 'fs_npx.preview.png'));
    expect(existsSync(path.join(legacy, 'fs_npx.json'))).toBe(true);
  });

  it('outside _npx, reads no folder but its own package', async () => {
    const oldPkg = path.join(root, 'lib', 'aaa111', 'node_modules', 'mojulo');
    plantLegacy(oldPkg, 'fs_elsewhere');
    const current = path.join(root, 'lib', 'bbb222', 'node_modules', 'mojulo');
    mkdirSync(current, { recursive: true });
    process.env.MOJULO_CONTROL_DIR = current;
    process.env.MOJULO_FIGURE_SPECS_DIR = path.join(root, 'home5', 'figure-specs');
    expect(await listSpecs()).toEqual([]);
  });

  it('reads no legacy folder outside a bin (no MOJULO_CONTROL_DIR)', async () => {
    delete process.env.MOJULO_CONTROL_DIR;
    const target = path.join(root, 'home3', 'figure-specs');
    process.env.MOJULO_FIGURE_SPECS_DIR = target;
    expect(await listSpecs()).toEqual([]);
    expect(existsSync(target)).toBe(true);
  });
});
