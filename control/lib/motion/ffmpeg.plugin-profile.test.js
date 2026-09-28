// Under the Claude plugin profile (lib/mcp/plugin-profile.js) the ffmpeg resolver never downloads:
// it uses MOJULO_FFMPEG or an ffmpeg on the PATH, and otherwise answers with how to install one. No
// network here: the download is a stub that must never be called.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveFfmpeg, _resetFfmpegCache } from './ffmpeg.js';

const KEYS = ['PATH', 'MOJULO_FFMPEG', 'MOJULO_FFMPEG_DIR', 'MOJULO_DISTRIBUTION'];
const saved = {};
let dir;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-ffmpeg-profile-'));
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.PATH = dir; // no ffmpeg on PATH
  delete process.env.MOJULO_FFMPEG;
  process.env.MOJULO_FFMPEG_DIR = dir;
  process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  _resetFfmpegCache();
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  _resetFfmpegCache();
});

describe('resolveFfmpeg under the Claude plugin profile', () => {
  it('never downloads, and says how to install ffmpeg instead', async () => {
    const get = vi.fn();
    const err = await resolveFfmpeg({ get }).catch((e) => e);
    expect(get).not.toHaveBeenCalled();
    expect(err.message).toMatch(/does not download one/);
    expect(err.message).toMatch(/brew install ffmpeg/);
    expect(err.message).toMatch(/MOJULO_FFMPEG/);
    expect(err.message).not.toMatch(/github\.com|npx/);
  });

  it.skipIf(process.platform === 'win32')('uses the ffmpeg MOJULO_FFMPEG names', async () => {
    const bin = path.join(dir, 'my-ffmpeg');
    writeFileSync(bin, '#!/bin/sh\necho "ffmpeg version fixture"\n');
    chmodSync(bin, 0o755);
    process.env.MOJULO_FFMPEG = bin;
    const get = vi.fn();
    await expect(resolveFfmpeg({ get })).resolves.toBe(bin);
    expect(get).not.toHaveBeenCalled();
  });
});
