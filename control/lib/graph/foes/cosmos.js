/**
 * The Mind facet's `foes` setting, as the cosmos registry reads it: one value per foe class (./index.js FOE_CLASSES),
 * its status and each engine's mark FOUND from its move and its attack (classStatus), never written here. A class is
 * built only when everything it does runs; the note names what does not yet.
 *
 *   foeClassValues() → { [class]: { status, lowers, note?, effort?, pkg?, [engine]: mark } }
 *
 * A class short of built belongs to the hostile-encounters package (cosmos/packages.js) and carries its effort, as
 * every packaged value does (the words it waits on are sized in ./vocab.js). Pure; reads the shelf only (no fauna).
 */
import { FOE_CLASSES, classStatus } from './index.js';
import { PACKAGES } from '../cosmos/packages.js';

const MODULE = 'lib/graph/foes/resolve.js';
const PKG = 'hostile-encounters';

export function foeClassValues() {
  const out = {};
  for (const c of Object.values(FOE_CLASSES)) {
    const { status, marks, short } = classStatus(c);
    const row = { status, lowers: MODULE, ...marks };
    row.note = [c.reads, ...short].join('; ');
    if (status !== 'built') Object.assign(row, { effort: PACKAGES[PKG].effort, pkg: PKG });
    out[c.id] = row;
  }
  return out;
}
