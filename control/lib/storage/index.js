import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const STORAGE_ROOT =
  process.env.STORAGE_ROOT || path.join(process.cwd(), 'data', 'storage');

function resolveStoragePath(key) {
  // Prevent traversal escape
  const safe = key.replace(/^\/+/, '').replace(/\.\./g, '_');
  return path.join(STORAGE_ROOT, safe);
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function uploadFile(key, buffer, _legacyIgnored, _opts = {}) {
  const dest = resolveStoragePath(key);
  await ensureDir(dest);
  await fs.writeFile(dest, buffer);
  return { storagePath: key };
}

/** The same write, synchronously: for a door that files a picture inside a synchronous handler. */
export function uploadFileSync(key, buffer) {
  const dest = resolveStoragePath(key);
  fsSync.mkdirSync(path.dirname(dest), { recursive: true });
  fsSync.writeFileSync(dest, buffer);
  return { storagePath: key };
}

export async function downloadToBuffer(key) {
  const source = resolveStoragePath(key);
  return fs.readFile(source);
}

export async function deleteFile(key) {
  const target = resolveStoragePath(key);
  try {
    await fs.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export function getStorageRoot() {
  return STORAGE_ROOT;
}
