// sign_asset / verify_asset — the creator's receipt for an exported file (docs/asset-receipts.md).

// Isolate to in-memory SQLite + a scratch MOJULO_HOME and outcomes dir — must run before any
// import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-receipts-home-'));
process.env.MOJULO_HOME = home;
const outcomes = mkdtempSync(path.join(os.tmpdir(), 'mojulo-receipts-out-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { canonicalJson, creatorKeyPath, sha256 } from '@/lib/provenance/receipt';
import { signAssetHandler, verifyAssetHandler } from './asset-receipts.js';

function exported(ref, name, body) {
  const dir = path.join(outcomes, ref);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, body);
  return file;
}

describe('canonicalJson', () => {
  it('signs the same bytes whatever the key order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: null } }))
      .toBe(canonicalJson({ a: { c: null, d: [2, { x: 0, y: 1 }] }, b: 1 }));
  });
});

describe('sign_asset / verify_asset', () => {
  it('verifying first never creates a creator key', async () => {
    const file = exported('sk_none', 'model.stl', 'solid');
    const res = await verifyAssetHandler({ path: file });
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/No receipt found/);
    expect(existsSync(creatorKeyPath(home))).toBe(false);
  });

  it('signs beside the file, leaves the file untouched, and verifies', async () => {
    SketchRepository.create({ ref: 'sk_receipt', title: 'a bracket', manifest: { kind: 'workbench', size: 3 } });
    const file = exported('sk_receipt', 'model.glb', Buffer.from('glTF bytes'));
    const before = readFileSync(file);

    const signed = await signAssetHandler({ path: file });
    expect(signed.ok).toBe(true);
    expect(readFileSync(file).equals(before)).toBe(true);
    expect(signed.receipt).toBe(`${file}.proof.json`);
    expect(signed.creator_id).toMatch(/^mjc_[0-9a-f]{32}$/);
    // the ref comes from the outcome folder, the recipe hash from the stored manifest
    expect(signed.asset.ref).toBe('sk_receipt');
    expect(signed.asset.kind).toBe('workbench');
    expect(signed.asset.recipe_sha256).toBe(sha256(canonicalJson({ kind: 'workbench', size: 3 })));
    expect(signed.asset.minted_at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(existsSync(signed.kept)).toBe(true);
    expect(statSync(creatorKeyPath(home)).mode & 0o777).toBe(0o600);

    const res = await verifyAssetHandler({ path: file });
    expect(res.valid).toBe(true);
    expect(res.checks).toEqual({ format: true, file_matches: true, creator_id_matches_key: true, signature_valid: true });
    expect(res.yours).toBe(true);
    expect(res.creator_id).toBe(signed.creator_id);
  });

  it('a changed byte, an edited field or a swapped creator id each fail their own check', async () => {
    const file = exported('sk_tamper', 'beat.wav', 'RIFF....WAVE');
    await signAssetHandler({ path: file });
    const receipt = JSON.parse(readFileSync(`${file}.proof.json`, 'utf8'));

    writeFileSync(file, 'RIFF....WAVF');
    let res = await verifyAssetHandler({ path: file, receipt });
    expect(res.valid).toBe(false);
    expect(res.checks.file_matches).toBe(false);
    expect(res.checks.signature_valid).toBe(true);
    writeFileSync(file, 'RIFF....WAVE');

    res = await verifyAssetHandler({ path: file, receipt: { ...receipt, signed_at: '2001-01-01T00:00:00.000Z' } });
    expect(res.valid).toBe(false);
    expect(res.checks.signature_valid).toBe(false);

    res = await verifyAssetHandler({ path: file, receipt: { ...receipt, creator: { ...receipt.creator, id: 'mjc_0000' } } });
    expect(res.valid).toBe(false);
    expect(res.checks.creator_id_matches_key).toBe(false);
  });

  it("finds the creator's kept copy when the sidecar is gone", async () => {
    const file = exported('sk_lost', 'model.3mf', '3mf bytes');
    const signed = await signAssetHandler({ path: file });
    const moved = path.join(outcomes, 'elsewhere.3mf');
    writeFileSync(moved, readFileSync(file));
    const res = await verifyAssetHandler({ path: moved });
    expect(res.valid).toBe(true);
    expect(res.receipt_source).toBe(signed.kept);
  });

  it('refuses a relative path, an unknown ref and a receipt as the asset', async () => {
    await expect(signAssetHandler({ path: 'model.glb' })).rejects.toThrow(/absolute path/);
    const file = exported('sk_x', 'a.stl', 'x');
    await expect(signAssetHandler({ path: file, ref: 'sk_missing' })).rejects.toThrow(/No sketch/);
    await expect(signAssetHandler({ path: `${file}.proof.json` })).rejects.toThrow(/that is a receipt/);
  });

  it('a file outside an outcome folder is signed without an asset', async () => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'mojulo-loose-')), 'loose.png');
    writeFileSync(file, 'png');
    const signed = await signAssetHandler({ path: file });
    expect(signed.asset).toBe(null);
    expect((await verifyAssetHandler({ path: file })).valid).toBe(true);
  });
});
