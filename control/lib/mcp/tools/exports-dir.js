import path from 'node:path';

// On-disk location for written exports (.glb from tools/sketches.js, .wav from
// tools/beats.js). A small shared module so neither tool file imports the
// other for plumbing (B9). Overridable for tests / alternate data roots;
// defaults beside the other generated artifacts under control/data/.
export function exportsBaseDir() {
  return process.env.MOJULO_EXPORTS_DIR || path.join(process.cwd(), 'data', 'exports');
}
