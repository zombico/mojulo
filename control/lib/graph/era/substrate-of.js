/**
 * A stage's substrate (era/substrate.js), for an isekai stage recipe: its kit's card, its trail (or the card's own),
 * the ground a town has claimed, its land shading's formation, as the stage lays them.
 *
 *   substrateOf(manifest)   → substrateMap's { cells, nx, ny, x0, y0, cell, shares }
 */
// (the stage first, as every other reader loads it: the era's modules import one another in a ring)
import './stage.js';
import { ISEKAI_STYLES } from './isekai.js';
import { outTrailSite } from './out-trail.js';
import { natureSite } from './nature.js';
import { reserveSite } from './reserve.js';
import { lookOf } from './style/looks.js';
import { readShading } from '../local-meru/plan.js';
import { substrateMap, FORMATION_TURNS } from './substrate.js';
import { readGrade } from './grade.js';

export function substrateOf(manifest = {}) {
  const id = manifest.style ?? manifest.kit ?? 'isekai-meadow', st = ISEKAI_STYLES[id] ?? lookOf(id)?.card;
  if (!st) throw new Error(`substrate: '${id}' is no isekai style or look`);
  const seed = Number.isFinite(manifest.seed) ? manifest.seed : 1;
  const site = reserveSite(manifest.trail !== undefined ? outTrailSite(st, manifest.trail, seed, readGrade(manifest._grade)) : natureSite(st, seed), manifest._keepOut ?? null);
  const SH = readShading(manifest.shading), skin = SH?.skin;
  return substrateMap(st, site, { formation: typeof skin === 'string' && FORMATION_TURNS[skin] ? skin : null, seed });
}
