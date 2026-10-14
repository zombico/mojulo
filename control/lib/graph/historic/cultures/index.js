/**
 * The historic cultures, one line each: what `planHistoricCity`, the `historic` world kind and the encyclopedia
 * entries (../entries.js) read. A culture is its card (./<id>.js): palette, skins, patterns, its asset kit and the entry's
 * contract lines; its town is solved from its form (../form/towns.js, or the culture its card's `form` names).
 *
 * Adding one: `node scripts/new-culture.mjs <id> --like <culture>` writes a card spread from another culture and
 * adds its line here; the guide is docs/historic/README.md. Order is the order entries list in.
 */
import { SUMER } from './sumer.js';
import { THEBES } from './thebes.js';
import { GIZA } from './giza.js';
import { LINDOS, POLIS } from './lindos.js';
import { QIN } from './qin.js';
import { POMPEII } from './pompeii.js';
import { FORUM } from './forum.js';

/**
 * The land a culture's farm and works are drawn from (`land` on its card, an id in ../land-kits.js
 * FARM_CULTURES / WORKS_CULTURES): its own id when the card says nothing, none when it says null.
 */
export function landOf(id) {
  const K = HISTORIC_CULTURES[id];
  return !K ? null : K.land === undefined ? id : K.land;
}

export const HISTORIC_CULTURES = {
  sumer: SUMER,
  thebes: THEBES,
  giza: GIZA,
  lindos: LINDOS,
  polis: POLIS,
  qin: QIN,
  pompeii: POMPEII,
  forum: FORUM,
};
