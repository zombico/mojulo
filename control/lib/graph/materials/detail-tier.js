// The detail tier: how much a world spends at runtime on its water and ground, never what its recipe or its exports
// are. One key shared by every world that grows tiers (beaches first; ponds, snow fields next):
//   still      the baked look; a frozen frame of anything animated (what an export always carries)
//   animated   closed-form motion only — waves, swash, the wet band that follows it; no simulation
//   touch      a simulated window around the player: footprints, wakes, splashes (tier 2)
//   showpiece  touch plus the expensive extras: kicked grains, spray, rain, persistent foam (tier 3)
export const DETAIL_TIERS = ['still', 'animated', 'touch', 'showpiece'];

/** A recipe's `detail` as a tier name; an unknown or absent value falls back to the world's own default. */
export function normalizeDetail(v, fallback = 'animated') {
  return DETAIL_TIERS.includes(v) ? v : fallback;
}

/** True when tier `a` includes everything tier `b` does. */
export const detailAtLeast = (a, b) => DETAIL_TIERS.indexOf(a) >= DETAIL_TIERS.indexOf(b);
