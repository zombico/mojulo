/**
 * pack-stamp — what a scene's Blender film pack IS, as a short hash of the files a build and a render read: scene.json,
 * the shot files, the pack's scripts, the actors' GLBs, the sound and the set's pack. The render worker
 * (scripts/render-film.mjs) writes it into render.json; a pack made again (the scene edited, the scripts a newer
 * mojulo's) has another stamp, so the worker builds and renders it again rather than taking the old film.blend and
 * frames for the new scene, and the door's readout does not show the old render as this scene's.
 *
 *   packStamp(dir) → a 12-hex stamp, or null where dir holds no scene.json
 *
 * What a build and a render WRITE (film.blend, film/, render.json, the gates) is not read.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const MADE = new Set(['film.blend', 'film.blend1', 'film', 'render.json', 'film-gate.json']);
/** a set's pack: its models and scripts (its importer writes its gate and its notes beside them) */
const SET_READS = /\.(glb|gltf|bin|py)$/;

function filesOf(dir, rel = '', keep = () => true) {
  const out = [];
  for (const f of readdirSync(path.join(dir, rel)).sort()) {
    const r = rel ? `${rel}/${f}` : f;
    if (!rel && MADE.has(f)) continue;
    if (statSync(path.join(dir, r)).isDirectory()) out.push(...filesOf(dir, r, r === 'set' || r.startsWith('set/') ? (x) => SET_READS.test(x) : keep));
    else if (keep(f)) out.push(r);
  }
  return out;
}

export function packStamp(dir) {
  if (!existsSync(path.join(dir, 'scene.json'))) return null;
  const h = createHash('sha1');
  for (const f of filesOf(dir)) { h.update(f); h.update('\0'); h.update(readFileSync(path.join(dir, f))); h.update('\0'); }
  return h.digest('hex').slice(0, 12);
}
