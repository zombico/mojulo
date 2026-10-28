/**
 * THE COMIC HERO PACK'S RESONANCE: what the gameplay a cube asks for says about the look that suits it, as laws in the
 * facet law shape (cosmos/facets: `{ id, advice(cube) → words | null }`). Advice, never a verdict: a law names the stop
 * of the dial (looks.js DIAL) and the values it would set, and the operator decides. Pure and deterministic: the same
 * cube gives the same words. A law reads registry words only, so it runs on any cube, from the pack or not.
 *
 *   LAWS                  [{ id, advice }]
 *   resonance(cube)       → [{ law: 'comic-hero.<id>', says }] the laws that fire, in order; [] when none does
 */
const has = (v, x) => (Array.isArray(v) ? v.includes(x) : v === x);
const F = (cube, f) => cube?.[f] || {};

export const LAWS = Object.freeze([
  {
    // a blow drawn as a burst wants a drawn register: a comic explosion under the film's live light reads as a mistake
    id: 'bursts-want-drawn',
    advice: (cube) => {
      const P = F(cube, 'power');
      return has(P.explosions, 'comic') && has(P.combat, 'melee') && !String(F(cube, 'reality').look || '').startsWith('comic')
        ? 'power.explosions comic over melee reads as a drawn page: the dcau stop (the gritty look at golden hour, its light baked) or the anime stop, never the realistic one (reality.look comic-day or comic-night when built)'
        : null;
    },
  },
  {
    // people who talk and a story that advances want a face the light can read: the film's live light
    id: 'talk-wants-material',
    advice: (cube) => {
      const M = F(cube, 'mind'), T = F(cube, 'time');
      return M.social === 'talk' && (T.advance === 'quests' || has(T.shots, 'banter'))
        ? 'mind.social talk with time.advance quests or a banter shot reads faces: the realistic stop (the western tradition, form realistic, the seventh generation\'s live light)'
        : null;
    },
  },
  {
    // a flying hero is seen against the sky: the anime stop paints it, heaped cumulus lit in crescents; the missing
    // pieces are named
    id: 'flight-wants-sky',
    advice: (cube) => {
      const P = F(cube, 'power'), S = F(cube, 'space'), T = F(cube, 'time');
      if (!has(P.rules, 'fly')) return null;
      const missing = [S.levelForm !== 'airspace' && 'space.levelForm airspace', !has(T.shots, 'staged') && 'a staged shot at the top of the climb'].filter(Boolean);
      return `power.rules fly is seen against the sky: the anime stop (a painted sky, heaped cumulus, the anime-day look)${missing.length ? `, with ${missing.join(' and ')}` : ''}`;
    },
  },
  {
    // two heroes seen from the side with a transformation are the anime fight: its light, and the blow held as a panel
    id: 'versus-wants-panel',
    advice: (cube) => {
      const P = F(cube, 'power'), S = F(cube, 'space');
      return has(P.combat, 'versus') && S.camera === 'side'
        ? 'power.combat versus from the side is the anime fight: the anime stop, and time.shots panel (when built) to hold the landing blow'
        : null;
    },
  },
  {
    // a night city loses the figure in the dark: the frontier film's low sun puts a lit sky behind it, the figure backlit
    id: 'night-wants-backlight',
    advice: (cube) => {
      const R = F(cube, 'reality'), S = F(cube, 'space');
      return R.look === 'city-night' && S.levelForm === 'city' && has(F(cube, 'power').explosions, 'comic')
        ? 'a comic city by night loses the figure in the dark: the dcau-golden look (a low warm sun behind lit cloud, the light baked) stands it backlit against a lit sky'
        : null;
    },
  },
]);

export function resonance(cube) {
  return LAWS.map((L) => ({ law: `comic-hero.${L.id}`, says: L.advice(cube) })).filter((a) => a.says);
}
