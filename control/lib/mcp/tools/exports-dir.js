import path from 'node:path';

// On-disk location for written exports (.wav from tools/beats.js; export_model
// wrote .glb/.stl here until interchange I4 moved it into the outcome folder,
// data/outcomes/<ref>/, for provenance parity with export_game). A small shared
// module so tool files don't import each other for plumbing (B9). Overridable
// for tests / alternate data roots; defaults beside the other generated
// artifacts under control/data/.
export function exportsBaseDir() {
  return process.env.MOJULO_EXPORTS_DIR || path.join(process.cwd(), 'data', 'exports');
}
