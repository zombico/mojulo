/**
 * THE ROUND'S BOSSES — the climax each kind of story calls for (gmn.js LABOURS: what the round asks of the player), a
 * starter each, written out whole in the world's battles so the person edits it like any other row.
 *
 *   ROUND_BOSSES   <foe id> → { labours: [labour ids], speaks, lines: { start, half } }   the foe a preset
 *                  (playscape/rpg/presets.js FOE_PRESETS: its numbers, its telegraphed blow, its second form), its look
 *                  and its arms battles.js FOE_LOOKS and FOE_ARMS, its height FOE_HEIGHT; `lines` what is said as its fight
 *                  begins and as it falls under half its HP (`{place}` the core it waits in), in its own voice where it
 *                  `speaks`, else told
 *   bossOfLabour(labour)  → the boss its story calls for (the drake for any it does not name)
 *   roundBossBattles(id, { era, place })  → the battles' own rows for it: { boss, bossPages, foes, looks, heights }:
 *                  its whole definition (`foes.<id>`, renamed in its era), its look (its era's where it has one), a
 *                  beast's height and its fight's pages. A composed world writes them out, so each is the person's to change: its
 *                  numbers, its pattern and phases, its look, its size, its lines; or `battles.boss` names another foe,
 *                  a preset or one of the world's own.
 *
 * Each boss is held to the boss law (boss-law.deep.test.js). A new story's boss is a preset foe and a row here. Pure.
 */
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { FOE_LOOKS, FOE_HEIGHT } from './battles.js';

export const ROUND_BOSSES = Object.freeze({
  // (the citadel's guardian, and the innermost cave's)
  drake: Object.freeze({ labours: Object.freeze(['storm-the-citadel', 'campbellian-journey']), speaks: true,
    lines: Object.freeze({ start: 'None who come into {place} leave it.', half: Object.freeze(['You burn brighter than the others did.', 'Then burn out!']) }) }),
  // (what waits at the far shore)
  leviathan: Object.freeze({ labours: Object.freeze(['cross-the-great-sea']), speaks: false,
    lines: Object.freeze({ start: 'The water round {place} begins to churn.', half: Object.freeze(['The great serpent shrieks, and the waves answer.']) }) }),
  // (the champion in the final hall)
  champion: Object.freeze({ labours: Object.freeze(['be-the-best']), speaks: true,
    lines: Object.freeze({ start: 'So you are the one who fought their way to {place}. Show me.', half: Object.freeze(['Good. At last, a real fight.', 'No more holding back!']) }) }),
  // (the last stronghold still holding out)
  warlord: Object.freeze({ labours: Object.freeze(['conquer-the-map']), speaks: true,
    lines: Object.freeze({ start: 'Every land has bowed to me. {place} will be your grave.', half: Object.freeze(['Enough!', 'Now you face my true strength!']) }) }),
  // (the rarest of them, at the end of the map)
  roc: Object.freeze({ labours: Object.freeze(['catch-them-all']), speaks: false,
    lines: Object.freeze({ start: 'A cry splits the sky over {place}.', half: Object.freeze(['The storm gathers round the great bird.']) }) }),
  // (what opens only when every task is done)
  colossus: Object.freeze({ labours: Object.freeze(['hundred-percent']), speaks: false,
    lines: Object.freeze({ start: 'Something ancient stirs beneath {place}.', half: Object.freeze(['Light pours from the cracks in its body.']) }) }),
});
export const ROUND_BOSS_IDS = Object.freeze(Object.keys(ROUND_BOSSES));

export const bossOfLabour = (labour) => ROUND_BOSS_IDS.find((id) => ROUND_BOSSES[id].labours.includes(labour)) ?? 'drake';

/** The battles' own rows for a story's boss, in its era (round-eras.js row, or null), at its core (`place`). */
export function roundBossBattles(id, { era = null, place } = {}) {
  const B = ROUND_BOSSES[id], E = era?.foes?.[id], name = E?.name ?? FOE_PRESETS[id].name;
  const at = (t) => t.split('{place}').join(place);
  const who = B.speaks ? { who: name } : {};
  return {
    boss: [id],
    bossPages: [
      { when: { start: true }, ...who, say: at(B.lines.start) },
      { when: { foe: id, hpBelow: 0.5 }, ...who, say: B.lines.half.map(at) },
    ],
    foes: { [id]: { ...structuredClone(FOE_PRESETS[id]), name } },
    looks: { [id]: structuredClone(E?.look ?? FOE_LOOKS[id]) },
    // (a beast's height; a people stands at its own)
    heights: FOE_HEIGHT[id] ? { [id]: FOE_HEIGHT[id] } : {},
  };
}
