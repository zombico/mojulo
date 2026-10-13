/**
 * sign_asset / verify_asset: the creator's receipt for an exported file (docs/asset-receipts.md).
 *
 * sign_asset hashes a file mojulo exported, signs that hash with this install's creator key and
 * writes `<file>.proof.json` beside it. The file itself is never touched, so every export stays
 * byte-identical. verify_asset reads a file and its receipt back and reports which checks hold.
 * Nothing signs unless the operator asks: the feature is opt-in by use.
 */

import fs from 'node:fs';
import path from 'node:path';
import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { getServerVersion } from '@/lib/server-version';
import {
  assetOf, archiveReceipt, creatorId, creatorKey, findArchivedReceipt, sidecarPath, signReceipt, verifyReceipt,
} from '@/lib/provenance/receipt';

// What a receipt does and does not establish, said on every result so it travels with the answer.
const PROVES = 'The holder of this creator key signed these exact bytes. Dates are the signer\'s own clock. '
  + 'A receipt is evidence for a licence you grant, not a claim of legal ownership.';

function readFileArg(file, tool) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error(`${tool} requires \`path\` — an absolute path to the file`);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    throw new Error(`${tool}: no file at ${file}`);
  }
  if (!stat.isFile()) throw new Error(`${tool}: ${file} is not a file`);
  return fs.readFileSync(file);
}

// The ref the receipt names: the one given, else the outcome folder the file sits in (data/outcomes/<ref>/).
function sketchFor(file, ref) {
  if (ref != null) {
    if (typeof ref !== 'string' || !ref.trim()) throw new Error('`ref` must be a non-empty string if provided');
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) throw new Error(`No sketch exists at ref '${ref}'`);
    return sketch;
  }
  return SketchRepository.getByRef(path.basename(path.dirname(file))) || null;
}

export async function signAssetHandler(input) {
  const { path: file, ref = null } = input && typeof input === 'object' ? input : {};
  if (typeof file === 'string' && file.endsWith('.proof.json')) throw new Error('sign_asset: that is a receipt; pass the asset it belongs to');
  const bytes = readFileArg(file, 'sign_asset');
  const sketch = sketchFor(file, ref);
  const key = creatorKey({ create: true });
  const receipt = signReceipt({ bytes, name: path.basename(file), asset: assetOf(sketch), version: getServerVersion(), key });
  const sidecar = sidecarPath(file);
  fs.writeFileSync(sidecar, `${JSON.stringify(receipt, null, 2)}\n`);
  const kept = archiveReceipt(receipt);
  return {
    ok: true,
    receipt: sidecar,
    kept,
    creator_id: receipt.creator.id,
    file_sha256: receipt.file.sha256,
    asset: receipt.asset,
    signed_at: receipt.signed_at,
    proves: PROVES,
    note: 'Send the receipt with the file. Verify with verify_asset({ path }). '
      + `Back up ${key.file}: it is the only proof the creator id is yours, and losing it cannot be undone.`,
  };
}

export async function verifyAssetHandler(input) {
  const { path: file, receipt: receiptInput = null } = input && typeof input === 'object' ? input : {};
  const bytes = readFileArg(file, 'verify_asset');
  let receipt = null;
  let source = null;
  if (receiptInput != null) {
    if (typeof receiptInput === 'object') {
      receipt = receiptInput;
      source = 'given';
    } else if (typeof receiptInput === 'string' && path.isAbsolute(receiptInput)) {
      receipt = JSON.parse(fs.readFileSync(receiptInput, 'utf8'));
      source = receiptInput;
    } else {
      throw new Error('`receipt` is the receipt object or an absolute path to a .proof.json');
    }
  } else if (fs.existsSync(sidecarPath(file))) {
    receipt = JSON.parse(fs.readFileSync(sidecarPath(file), 'utf8'));
    source = sidecarPath(file);
  } else {
    const archived = findArchivedReceipt(bytes);
    if (archived) {
      receipt = archived.receipt;
      source = archived.file;
    }
  }
  if (!receipt) {
    return {
      ok: true,
      valid: false,
      reason: `No receipt found: none beside the file (${path.basename(sidecarPath(file))}), and this install never signed these bytes. Pass \`receipt\` if you were sent one.`,
    };
  }
  const { valid, checks, reason } = verifyReceipt({ bytes, receipt });
  // `yours` reads the key without making one: verifying never creates a creator identity
  const own = creatorKey({ create: false });
  return {
    ok: true,
    valid,
    checks,
    ...(reason ? { reason } : {}),
    receipt_source: source,
    creator_id: receipt.creator?.id ?? null,
    yours: own ? creatorId(own.publicKey) === receipt.creator?.id : false,
    asset: receipt.asset ?? null,
    signed_at: receipt.signed_at ?? null,
    proves: PROVES,
  };
}

export function registerAssetReceiptTools() {
  registerTool({
    name: 'sign_asset',
    description:
      "Sign an exported file with this install's creator key: `<file>.proof.json` beside it (file sha256, ref, recipe "
      + 'hash, mint date, signing time, pseudonymous creator id), the file unchanged. Call ONLY when the operator asks '
      + "to sign, prove or license a file; never unprompted after an export. Proves who signed, not legal ownership.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the exported file (an export result `path`).' },
        ref: { type: 'string', description: 'The source sketch. Defaults to the outcome folder name.' },
      },
      required: ['path'],
    },
    handler: signAssetHandler,
  });

  registerTool({
    name: 'verify_asset',
    description:
      'Check a file against its creator receipt: bytes, signature and creator id, plus the ref, recipe hash and dates '
      + "it names. Reads `<file>.proof.json`, a passed `receipt`, or this install's kept copy; `yours` if this install signed it.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file to check.' },
        receipt: {
          description: 'The receipt object or its absolute path. Default `<path>.proof.json`.',
          oneOf: [{ type: 'object' }, { type: 'string' }],
        },
      },
      required: ['path'],
    },
    handler: verifyAssetHandler,
  });
}
