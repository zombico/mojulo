/**
 * read-path — a model on THIS machine's disk read into the canonical GLB (import/to-glb.js): the file a person pointed
 * at (in the desktop app, a folder they chose; in a cloud session, the file they uploaded into it), or the folder
 * holding it. The neighbours a model names (a .gltf's .bin and images, an OBJ's .mtl and textures) are read from beside
 * it, never above the folder it was found in: a name that climbs out is refused by to-glb's `safeRelative` before it
 * reaches the disk, and a resolved path is checked to stay under its root.
 *
 *   readModelPath(path, { entry?, up? }) → { bytes, from: { …, path, root }, ledger }
 *     path    a model file, a zip, or a folder (the one model in it; several → name it as `entry`)
 *
 * Reads only: nothing is written, nothing fetched. A URL is refused here: mojulo reads what is on the machine, and the
 * agent brings a file there.
 */
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { toGlb, pickEntry } from './to-glb.js';

/** An input file's byte ceiling: past it, the file is refused before it is read (a scan to decimate first). */
export const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_LISTED = 4000;

const fail = (m) => new Error(`import: ${m}`);

/** The files under a folder, by their posix path relative to it (dot folders and `__MACOSX` skipped), bounded. */
function listUnder(root, depth = 4) {
  const out = [];
  const walk = (dir, rel, d) => {
    if (out.length >= MAX_LISTED) return;
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (e.name.startsWith('.') || e.name === '__MACOSX' || e.name === 'node_modules') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (d > 0) walk(path.join(dir, e.name), r, d - 1); } else if (e.isFile()) out.push(r);
      if (out.length >= MAX_LISTED) return;
    }
  };
  walk(root, '', depth);
  return out;
}

/** A resolver for the neighbours of the model at `file`, kept under `root`. */
function diskResolver(root, file) {
  const base = path.dirname(file);
  const rootAbs = path.resolve(root);
  return (rel) => {
    const abs = path.resolve(base, ...rel.split('/'));
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
    if (!existsSync(abs)) return null;
    const st = statSync(abs);
    if (!st.isFile() || st.size > MAX_INPUT_BYTES) return null;
    return readFileSync(abs);
  };
}

/** A model on disk as the canonical GLB (see the header). */
export async function readModelPath(p, { entry = null, up = null } = {}) {
  if (typeof p !== 'string' || !p.trim()) throw fail('`from` is the path of a model file, a zip or a folder on this machine');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) throw fail(`'${p}' is a URL: mojulo reads a file on this machine. Download it there first (or save it from the chat to a folder), then give its path`);
  const abs = path.resolve(p.replace(/^~(?=$|\/)/, process.env.HOME || '~'));
  if (!existsSync(abs)) throw fail(`'${p}' is not on this machine (looked for ${abs})`);
  const st = statSync(abs);
  let file, root;
  if (st.isDirectory()) {
    root = abs;
    const names = listUnder(abs);
    file = path.join(abs, ...pickEntry(names, entry, `the folder '${p}'`).split('/'));
  } else {
    file = abs;
    root = path.dirname(abs);
  }
  const fst = statSync(file);
  if (fst.size > MAX_INPUT_BYTES) throw fail(`'${path.basename(file)}' is ${Math.round(fst.size / 1048576)} MB, past the ${MAX_INPUT_BYTES / 1048576} MB an import reads: decimate it first`);
  const bytes = readFileSync(file);
  const out = await toGlb(bytes, path.basename(file), { resolve: diskResolver(root, file), entry: st.isDirectory() ? null : entry, up });
  return { ...out, from: { ...out.from, path: file, root } };
}
