/**
 * The novelty ledger's source (color-theorist/ledger.js): the palette specs of the rows written last. A seed rolled
 * where a palette is written looks away from these. Imported by the doors that roll one.
 */
import { setPaletteSource, palettesIn } from '@/lib/graph/color-theorist/ledger.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const RECENT_ROWS = 40;
setPaletteSource(() => SketchRepository.recent({ limit: RECENT_ROWS }).flatMap((r) => palettesIn(r.manifest)));
