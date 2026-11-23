/**
 * rank.js — A LEVEL'S RANK: how well it was played, said as one letter on its results. A stylish action game's own
 * verdict: not whether the level was won (the result says that) but how. Three marks, each 0 … 1, and their mean:
 *
 *   time    at or under the par: 1; falling to 0 at twice the par (a level with no par has no time mark)
 *   style   the highest tier the style meter reached, of its top (worlds/controllable/style.js `peak`)
 *   clean   the hits taken, of the hits a life holds: none, 1; a life's worth, 0
 *
 *   rankOf({ seconds, par?, peak, tiers, hurt, lives? }) → { rank: '<a tier's name>', score, marks: { time?, style, clean } }
 *     tiers   the meter's own names, lowest first: the rank is one of them
 *     lives   the hits a life holds (10)
 *   levelRank(style, seconds, par?) → { rank, kept: [{ label, value, best, unit? }] } what a level's envelope carries
 *     (`stats.rank`, and its figures beside the level's own kept numbers: the time, the style earned, the longest combo;
 *     the play shell keeps each one's best); style: the meter's record (style.js `styleOf`), null → null
 *
 * Import-free (the level's page runs both by source, scene/channels/game.js); there only on a level whose game carries
 * a `rank`.
 */
export function rankOf({ seconds, par, peak, tiers, hurt, lives }) {
  const n = Array.isArray(tiers) && tiers.length > 1 ? tiers.length : 5, c = (v) => Math.max(0, Math.min(1, v));
  const marks = { style: c((peak || 0) / (n - 1)), clean: c(1 - (hurt || 0) / (lives > 0 ? lives : 10)) };
  if (par > 0 && seconds >= 0) marks.time = c(2 - seconds / par);
  const vs = Object.keys(marks).map((k) => marks[k]), score = vs.reduce((a, b) => a + b, 0) / vs.length;
  const names = Array.isArray(tiers) && tiers.length > 1 ? tiers : ['D', 'C', 'B', 'A', 'S'];
  return { rank: names[Math.min(n - 1, Math.floor(score * n))], score: Math.round(score * 1000) / 1000, marks };
}

export function levelRank(style, seconds, par) {
  if (!style) return null;
  const R = rankOf({ seconds, par, peak: style.peak, tiers: style.tiers, hurt: style.hurt });
  return { rank: R.rank, kept: [{ label: 'Time', value: Math.round(seconds * 10) / 10, best: 'low', unit: 's' }, { label: 'Style', value: Math.round(style.earned), best: 'high' }, { label: 'Combo', value: style.best, best: 'high' }] };
}
