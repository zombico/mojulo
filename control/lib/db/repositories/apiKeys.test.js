// Isolate this test file to in-memory SQLite and a throwaway MOJULO_HOME.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDb, getDb } from '@/lib/db/index';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys';
import { decryptApiKey } from '@/lib/deployment-auth';

const ORIGINAL_HOME = process.env.MOJULO_HOME;
const ORIGINAL_ENV = process.env.API_KEY_ENCRYPTION_KEY;
let home;

beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-apikeys-test-'));
  process.env.MOJULO_HOME = home;
  delete process.env.API_KEY_ENCRYPTION_KEY;
  closeDb();
});

afterAll(() => {
  closeDb();
  if (ORIGINAL_HOME === undefined) delete process.env.MOJULO_HOME;
  else process.env.MOJULO_HOME = ORIGINAL_HOME;
  if (ORIGINAL_ENV !== undefined) process.env.API_KEY_ENCRYPTION_KEY = ORIGINAL_ENV;
  fs.rmSync(home, { recursive: true, force: true });
});

// A row as 2.1.x wrote it: encrypted under the built-in key.
const LEGACY_KEY = crypto.createHash('sha256').update('mojulo-lite-local-dev').digest();
function encryptLegacy(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', LEGACY_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

describe('ApiKeyRepository legacy-key migration', () => {
  it('re-encrypts keys saved under 2.1.x on first read, and they still decrypt', async () => {
    const legacy = encryptLegacy('sk-ant-saved-under-2.1');
    const db = getDb();
    db.prepare(
      `INSERT INTO api_keys (id, name, provider, encrypted_key, is_default, created_at)
       VALUES ('ak_legacy', 'old key', 'anthropic', ?, 1, ?)`,
    ).run(legacy, Date.now());
    db.prepare(
      `INSERT INTO api_keys (id, name, provider, encrypted_key, is_default, created_at)
       VALUES ('ak_garbage', 'broken', 'openai', 'not-ciphertext', 0, ?)`,
    ).run(Date.now());

    const record = await ApiKeyRepository.findByProvider('anthropic');
    expect(record.encryptedKey).not.toBe(legacy);
    expect(decryptApiKey(record.encryptedKey)).toBe('sk-ant-saved-under-2.1');

    const stored = db.prepare("SELECT encrypted_key FROM api_keys WHERE id = 'ak_legacy'").get();
    expect(stored.encrypted_key).toBe(record.encryptedKey);
    expect(fs.existsSync(path.join(home, 'secret.key'))).toBe(true);

    // An undecryptable row is left as it was.
    const broken = db.prepare("SELECT encrypted_key FROM api_keys WHERE id = 'ak_garbage'").get();
    expect(broken.encrypted_key).toBe('not-ciphertext');
  });
});
