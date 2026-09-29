// The content-pack seam: an ABSENT pack (every release, every clean checkout) is silent; a pack that
// is present but fails to load says so. The ChatGPT Work field test saw two absence warnings on every
// process start of a clean install; the last block pins that importing the seam modules says nothing
// about the pack. It passes with the pack absent (CI) and present (a maintainer checkout) alike.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isAbsentPackModule, optionalPackModule } from './content-pack.js';

const PACK_LINE = /mobile-suit|content pack|ms-shield|arena-atmosphere|unit-swings|ms-contrast/;

describe('optionalPackModule', () => {
  const dirs = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  // A stand-in pack at <tmp>/mobile-suit/ with the given files.
  const fakePack = (files) => {
    const root = mkdtempSync(join(tmpdir(), 'content-pack-'));
    dirs.push(root);
    mkdirSync(join(root, 'mobile-suit'));
    for (const [name, src] of Object.entries(files)) writeFileSync(join(root, 'mobile-suit', name), src);
    return (name) => pathToFileURL(join(root, 'mobile-suit', name)).href;
  };

  it('returns the module when the pack file loads', async () => {
    const url = fakePack({ 'x.js': 'export const answer = 42;' });
    const mod = await optionalPackModule(() => import(url('x.js')), 'mobile-suit/x.js', 'x');
    expect(mod.answer).toBe(42);
  });

  it('is silent and returns null when the pack file is absent', async () => {
    const url = fakePack({});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await optionalPackModule(() => import(url('x.js')), 'mobile-suit/x.js', 'x')).toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  it('warns when the pack file is present but something it imports is missing', async () => {
    const url = fakePack({ 'x.js': "export { y } from './gone.js';" });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await optionalPackModule(() => import(url('x.js')), 'mobile-suit/x.js', 'x')).toBeNull();
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toMatch(/x: content pack present but mobile-suit\/x\.js failed to load/);
  });

  it('warns when the pack file is present but throws while loading', async () => {
    const url = fakePack({ 'x.js': "throw new Error('broken shelf');" });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await optionalPackModule(() => import(url('x.js')), 'mobile-suit/x.js', 'x')).toBeNull();
    expect(err.mock.calls[0][1]).toBe('broken shelf');
  });

  it("reads webpack's missing-module message as absence of the target only", () => {
    const webpack = (spec) => Object.assign(new Error(`Cannot find module '${spec}'`), { code: 'MODULE_NOT_FOUND' });
    expect(isAbsentPackModule(webpack('../mobile-suit/ms-shield.js'), 'mobile-suit/ms-shield.js')).toBe(true);
    expect(isAbsentPackModule(webpack('./shield-mount.js'), 'mobile-suit/ms-shield.js')).toBe(false);
    expect(isAbsentPackModule(new SyntaxError('Unexpected token'), 'mobile-suit/ms-shield.js')).toBe(false);
  });
});

describe('the seam modules', () => {
  it('say nothing about the content pack when they load', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('./polygonizer/figure-render.js');
    await import('./worlds/controllable-world.js');
    await import('./worlds/unit-rig.js');
    await import('./worlds/world-scene.js');
    const packLines = err.mock.calls.map((c) => c.join(' ')).filter((l) => PACK_LINE.test(l));
    err.mockRestore();
    expect(packLines).toEqual([]);
  });
});
