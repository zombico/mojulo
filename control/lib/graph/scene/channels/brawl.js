// brawl channel: a brawl on the world (lib/graph/brawl), its first the practice yard. Opt-in on a world's `brawl` key
// with its `practice`; absent, it adds nothing to the page.
//
// One block, so none of the brawl's names reach the page's scope: the fight's pure modules it is made of, the controls
// (the brawl scheme, the seats), the brawl's own modules each in a scope of its own, mana-ui, and the yard's client (the
// room stepped from the seats, the bodies in the round, the belt's locked camera, the screen). It hands the page its frame
// step through `stepBrawl` (a let the page declares when the block is present) and publishes `window.__mojBrawl` for
// probes. It owns the camera (`__ctrlOwnsCamera`).
//
// cfg: brawl/brawl-page.js brawlYardData: { belt, register, roster, players, dummies, things, health, yard: { spec, css,
//      settings } }

import { safeJson } from '../emit-util.js';
import { brawlPageSource } from '../../brawl/brawl-page.js';
import { manaUiSource } from '../../../mana-ui/kernel.js';

export function brawlChannelScript(cfg) {
  return `
// ── brawl: the yard on this world ──
{
const BRAWL_YARD = ${safeJson(cfg)};
const manaUi = ${manaUiSource()};
${brawlPageSource()}
stepBrawlPage = stepBrawlYard;
}`;
}
