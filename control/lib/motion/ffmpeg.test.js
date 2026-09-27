// The lazily fetched ffmpeg is executed, so its bytes are checked against a
// pinned SHA-256 before they are decompressed, made executable or run. No
// network here: the download is a stand-in stream over a gzipped fixture.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';

import { FFMPEG_STATIC_SHA256, fetchVerifiedStatic, resolveFfmpeg, _resetFfmpegCache } from './ffmpeg.js';

// A stand-in "ffmpeg": answers `-version` with exit 0, like the probe expects.
const SCRIPT = '#!/bin/sh\necho "ffmpeg version fixture"\n';
const GOOD_GZ = gzipSync(Buffer.from(SCRIPT));
const GOOD_SHA = createHash('sha256').update(GOOD_GZ).digest('hex');
const serve = (bytes) => vi.fn(async () => Readable.from([bytes]));

let dir;
beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-ffmpeg-'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('fetchVerifiedStatic', () => {
  it('installs bytes that match the pinned digest', async () => {
    const destBin = path.join(dir, 'ffmpeg-test');
    await fetchVerifiedStatic({ url: 'https://example.invalid/ffmpeg.gz', sha256: GOOD_SHA, destBin, get: serve(GOOD_GZ) });
    expect(readFileSync(destBin, 'utf8')).toBe(SCRIPT);
    if (process.platform !== 'win32') expect(statSync(destBin).mode & 0o111).not.toBe(0);
    expect(readdirSync(dir)).toEqual(['ffmpeg-test']); // no temp files left behind
  });

  it('refuses tampered bytes before decompressing or writing the binary', async () => {
    const tampered = Buffer.from(GOOD_GZ);
    tampered[tampered.length - 5] ^= 0xff;
    const destBin = path.join(dir, 'ffmpeg-test');
    await expect(
      fetchVerifiedStatic({ url: 'https://example.invalid/ffmpeg.gz', sha256: GOOD_SHA, destBin, get: serve(tampered) }),
    ).rejects.toMatchObject({ code: 'FFMPEG_CHECKSUM_MISMATCH' });
    expect(existsSync(destBin)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('refuses to download at all for a platform with no pin', async () => {
    const get = serve(GOOD_GZ);
    await expect(
      fetchVerifiedStatic({ url: 'https://example.invalid/ffmpeg-plan9-mips.gz', sha256: undefined, destBin: path.join(dir, 'x'), get }),
    ).rejects.toThrow(/no pinned SHA-256/);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('pinned digests', () => {
  it('covers every ffmpeg asset of the pinned release, as hex SHA-256', () => {
    expect(Object.keys(FFMPEG_STATIC_SHA256).sort()).toEqual(
      ['darwin-arm64', 'darwin-x64', 'linux-arm', 'linux-arm64', 'linux-ia32', 'linux-x64', 'win32-x64'],
    );
    for (const digest of Object.values(FFMPEG_STATIC_SHA256)) expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('resolveFfmpeg', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of ['PATH', 'MOJULO_FFMPEG', 'MOJULO_FFMPEG_DIR']) saved[k] = process.env[k];
    process.env.PATH = dir; // no ffmpeg on PATH
    delete process.env.MOJULO_FFMPEG;
    process.env.MOJULO_FFMPEG_DIR = dir;
    _resetFfmpegCache();
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    _resetFfmpegCache();
  });

  it('fails closed when the download does not match this platform\'s pin', async () => {
    await expect(resolveFfmpeg({ get: serve(GOOD_GZ) })).rejects.toThrow(/checksum mismatch|no pinned SHA-256/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('never downloads with allowFetch:false', async () => {
    const get = serve(GOOD_GZ);
    await expect(resolveFfmpeg({ allowFetch: false, get })).rejects.toThrow(/auto-fetch disabled/);
    expect(get).not.toHaveBeenCalled();
  });
});
