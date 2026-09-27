import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Saved provider keys and tokens are AES-256-GCM encrypted under:
//   - sha256(API_KEY_ENCRYPTION_KEY) when that variable is set, else
//   - a random 32-byte key made on first use at $MOJULO_HOME/secret.key
//     (mode 0600). The MCP server, the dashboard and the CLI bins all resolve
//     the same MOJULO_HOME (scripts/mojulo-paths.mjs; default ~/.mojulo), so
//     they share the file. Deleting it makes every saved key unreadable.
// Before 2.2.0 the fallback was a key built into this file. Values saved
// under it still decrypt, and migrateLegacyCiphertext re-encrypts them under
// the per-install key; the built-in key is never used to encrypt.
const LEGACY_BUILT_IN_KEY = crypto.createHash('sha256').update('mojulo-lite-local-dev').digest();

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;

export function secretKeyPath() {
  const home = process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
  return path.join(home, 'secret.key');
}

function readKeyFile(file) {
  const key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`${file} does not hold a ${KEY_BYTES}-byte key`);
  }
  return key;
}

// Write the key under a temp name, then link() it into place: link refuses to
// replace an existing file, so when two processes start together the loser
// reads the winner's key, and no reader ever sees a half-written file.
function createKeyFile(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const key = crypto.randomBytes(KEY_BYTES);
  const body = `${key.toString('base64')}\n`;
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o600, flag: 'wx' });
  try {
    fs.linkSync(tmp, file);
    return key;
  } catch (err) {
    if (err.code === 'EEXIST') return readKeyFile(file);
    if (err.code !== 'EPERM' && err.code !== 'ENOTSUP' && err.code !== 'EXDEV') throw err;
    // No hard links on this filesystem: exclusive create is the next best.
    try {
      fs.writeFileSync(file, body, { mode: 0o600, flag: 'wx' });
      return key;
    } catch (createErr) {
      if (createErr.code === 'EEXIST') return readKeyFile(file);
      throw createErr;
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

let cachedInstallKey = null; // { file, key }

// The per-install key. With create:false, null when the file does not exist
// yet (so reading a value never creates the file).
function installKey({ create }) {
  const file = secretKeyPath();
  if (cachedInstallKey?.file === file) return cachedInstallKey.key;
  let key;
  try {
    key = readKeyFile(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (!create) return null;
    key = createKeyFile(file);
  }
  cachedInstallKey = { file, key };
  return key;
}

function envKey() {
  const value = process.env.API_KEY_ENCRYPTION_KEY;
  return value ? crypto.createHash('sha256').update(value).digest() : null;
}

function decryptWith(key, encrypted) {
  const data = Buffer.from(encrypted, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// { plaintext, legacy } where legacy means only the pre-2.2 built-in key
// opened it. With API_KEY_ENCRYPTION_KEY set, only that key is tried.
function decryptDetailed(encrypted) {
  const fromEnv = envKey();
  if (fromEnv) return { plaintext: decryptWith(fromEnv, encrypted), legacy: false };

  let firstError = null;
  try {
    const key = installKey({ create: false });
    if (key) return { plaintext: decryptWith(key, encrypted), legacy: false };
  } catch (err) {
    firstError = err;
  }
  try {
    return { plaintext: decryptWith(LEGACY_BUILT_IN_KEY, encrypted), legacy: true };
  } catch (err) {
    throw firstError || err;
  }
}

export function encryptApiKey(plaintext) {
  const key = envKey() || installKey({ create: true });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptApiKey(encrypted) {
  return decryptDetailed(encrypted).plaintext;
}

/**
 * A value saved under the pre-2.2 built-in key, re-encrypted under the
 * per-install key; null for anything else (already current, undecryptable,
 * or API_KEY_ENCRYPTION_KEY is set). ApiKeyRepository runs this over the
 * api_keys rows once per process.
 */
export function migrateLegacyCiphertext(encrypted) {
  if (envKey()) return null;
  let result;
  try {
    result = decryptDetailed(encrypted);
  } catch {
    return null;
  }
  return result.legacy ? encryptApiKey(result.plaintext) : null;
}

export function generateApiKey() {
  return `bot_${crypto.randomBytes(24).toString('hex')}`;
}
