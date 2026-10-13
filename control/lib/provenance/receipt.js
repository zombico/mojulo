/**
 * Asset receipts: a signed statement that this install's creator key vouched for a file's exact bytes
 * (docs/asset-receipts.md). Opt-in by use: nothing signs until sign_asset is called, and the exported
 * file is never changed, so byte-identical re-export holds. The receipt sits beside the file as
 * `<file>.proof.json`, and a copy is kept under $MOJULO_HOME/receipts/ so the creator still holds it
 * when the sidecar is lost.
 *
 * Identity is a per-install Ed25519 keypair at $MOJULO_HOME/creator.key (mode 0600), made on first
 * sign. There is no account: the creator id is the public key's fingerprint, pseudonymous until its
 * holder chooses to say whose it is. What a receipt proves is that the key's holder signed these
 * bytes. Its dates are the signer's own clock, and it says nothing about legal ownership.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const RECEIPT_FORMAT = 'mojulo-asset-receipt/1';
export const RECEIPT_SUFFIX = '.proof.json';

export function mojuloHome(env = process.env) {
  return env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
}

export function creatorKeyPath(home = mojuloHome()) {
  return path.join(home, 'creator.key');
}

// Sorted keys at every depth, so the signed bytes never depend on insertion order.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

export function creatorId(publicKey) {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return `mjc_${sha256(der).slice(0, 32)}`;
}

function readPrivateKey(file) {
  return crypto.createPrivateKey(fs.readFileSync(file, 'utf8'));
}

/** The install's creator key. With create:false, null when none has been made yet. */
export function creatorKey({ home = mojuloHome(), create = false } = {}) {
  const file = creatorKeyPath(home);
  try {
    const privateKey = readPrivateKey(file);
    return { privateKey, publicKey: crypto.createPublicKey(privateKey), file };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (!create) return null;
  }
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  try {
    // wx: when two processes race, the loser reads the winner's key
    fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const winner = readPrivateKey(file);
    return { privateKey: winner, publicKey: crypto.createPublicKey(winner), file };
  }
  return { privateKey, publicKey, file };
}

/** A sketch's identity for the receipt: its ref, kind, title, mint time and the recipe's hash. */
export function assetOf(sketch) {
  if (!sketch) return null;
  return {
    ref: sketch.ref,
    kind: sketch.manifest?.kind ?? null,
    title: sketch.title ?? null,
    minted_at: Number.isFinite(sketch.createdAt) ? new Date(sketch.createdAt * 1000).toISOString() : null,
    recipe_sha256: sketch.manifest ? sha256(canonicalJson(sketch.manifest)) : null,
  };
}

export function signReceipt({ bytes, name, asset = null, version = null, now = new Date(), key }) {
  const body = {
    format: RECEIPT_FORMAT,
    file: { name, bytes: bytes.length, sha256: sha256(bytes) },
    asset,
    signed_at: now.toISOString(),
    mojulo_version: version,
    creator: {
      id: creatorId(key.publicKey),
      public_key: key.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    },
  };
  const signature = crypto.sign(null, Buffer.from(canonicalJson(body)), key.privateKey).toString('base64');
  return { ...body, signature };
}

/**
 * Check a receipt against a file's bytes. Every check is reported, so a mismatch says which part
 * failed: the bytes changed, the creator id was edited, or the signature does not hold.
 */
export function verifyReceipt({ bytes, receipt }) {
  if (!receipt || typeof receipt !== 'object' || receipt.format !== RECEIPT_FORMAT) {
    return { valid: false, checks: { format: false }, reason: `not a ${RECEIPT_FORMAT} receipt` };
  }
  const { signature, ...body } = receipt;
  let publicKey = null;
  try {
    publicKey = crypto.createPublicKey({ key: Buffer.from(String(receipt.creator?.public_key), 'base64'), format: 'der', type: 'spki' });
  } catch {
    // reported below as a failed key check
  }
  const keyOk = publicKey?.asymmetricKeyType === 'ed25519';
  const checks = {
    format: true,
    file_matches: receipt.file?.sha256 === sha256(bytes) && receipt.file?.bytes === bytes.length,
    creator_id_matches_key: keyOk && creatorId(publicKey) === receipt.creator?.id,
    signature_valid: keyOk && typeof signature === 'string'
      && crypto.verify(null, Buffer.from(canonicalJson(body)), publicKey, Buffer.from(signature, 'base64')),
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function sidecarPath(file) {
  return `${file}${RECEIPT_SUFFIX}`;
}

/** Keep the creator's own copy, filed by the file's hash: $MOJULO_HOME/receipts/<sha256>.json. */
export function archiveReceipt(receipt, home = mojuloHome()) {
  const dir = path.join(home, 'receipts');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${receipt.file.sha256}.json`);
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
  return file;
}

/** The creator's kept receipt for these bytes, when this install signed them. */
export function findArchivedReceipt(bytes, home = mojuloHome()) {
  const file = path.join(home, 'receipts', `${sha256(bytes)}.json`);
  try {
    return { receipt: JSON.parse(fs.readFileSync(file, 'utf8')), file };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
