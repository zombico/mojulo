/**
 * THE TECH TREE ON SPELLS AND ATTACKS's rows (tree.js): each a STRING the hero strikes or a SPELL it casts for MP,
 * written in the combo manifest's words (combos.js: moves, and the beats that chain them), added to the hero's own
 * strings (the moveset its feel lowers, feel/lower.js feelCombos) and held shut by the runtime until it is learned
 * (worlds/controllable/trees.js; combat-melee.js takes a beat only where a learned string, or the hero's own, runs).
 *
 *   an ATTACK   a string on the light and the heavy: the heavy's thrust, a launcher back on the heavy, a finisher
 *               forked off the hero's own string (`after`: the beats of the hero's string it forks from, its moves
 *               the hero's own), a plunge from the air
 *   a SPELL     a blow that costs MP (the moveset's `mp`, filled at a save room): on the special (S), or a press with
 *               the modifier held (mS, mH); a burst all round, a dashing cut, a spiral
 *
 *   TECHS        { <id>: { kind: attack | spell, read, beats, after?, air?, moves: { <id>: a move } } }
 *   techCombos(base, ids) → { manifest, gated: { <combo>: <tech> } }   the hero's own manifest with each tech's moves
 *                and its string added (its `after` beats played by the hero's own moves), and which string each tech is
 *
 * A new attack or spell is a row. Pure.
 */
import { readCombos } from '../combos.js';

export const TECH_KINDS = Object.freeze({
  attack: 'a string on the light and the heavy: a thrust, a launcher, a finisher forked off the hero\'s own string',
  spell: 'a blow that costs MP: on the special, or a press with the modifier held',
});

export const TECHS = Object.freeze({
  // ── attacks ──
  thrust: Object.freeze({ kind: 'attack', read: 'a lunging thrust on the heavy', beats: Object.freeze(['H']),
    moves: Object.freeze({ thrust: Object.freeze({ swing: 'forward', role: 'opener', frames: 26, travel: Object.freeze({ kind: 'lunge', m: 0.6 }), damage: 1.6, cooldown: 18 }) }) }),
  cleave: Object.freeze({ kind: 'attack', read: 'the string forked on its third press into a two-handed cleave that knocks down', after: Object.freeze(['L', 'L']), beats: Object.freeze(['H']),
    moves: Object.freeze({ cleave: Object.freeze({ swing: 'back', role: 'finisher', frames: 34, plant: 0.6, damage: 2.6, impact: 2.5, topple: true }) }) }),
  'rising-cut': Object.freeze({ kind: 'attack', read: 'pulled back on the heavy: a cut that throws the foe up, the hero rising with it while the heavy is held', beats: Object.freeze(['bH']),
    moves: Object.freeze({ 'rising-cut': Object.freeze({ swing: 'neutral', role: 'launcher', frames: 30, damage: 1.2, launch: 8.5, rise: true, cooldown: 30 }) }) }),
  plunge: Object.freeze({ kind: 'attack', read: 'in the air, the heavy: a blow down that drives the foe into the ground', air: true, beats: Object.freeze(['H']),
    moves: Object.freeze({ plunge: Object.freeze({ swing: 'back', role: 'finisher', frames: 30, damage: 2, impact: 2, topple: true, slam: 14, air: true }) }) }),
  // ── spells ──
  'soul-burst': Object.freeze({ kind: 'spell', read: 'a burst all round her on the special, throwing back what it strikes', beats: Object.freeze(['S']),
    moves: Object.freeze({ 'soul-burst': Object.freeze({ swing: 'back', role: 'finisher', frames: 36, plant: 0.4, arc: 360, reach: 3.5, damage: 2, knock: 'heavy', mp: 10 }) }) }),
  'crescent-dash': Object.freeze({ kind: 'spell', read: 'with the modifier, the special: a cut carried four metres in a glide', beats: Object.freeze(['mS']),
    moves: Object.freeze({ 'crescent-dash': Object.freeze({ swing: 'forward', role: 'finisher', frames: 30, travel: Object.freeze({ kind: 'dash', m: 4 }), damage: 2.4, mp: 8 }) }) }),
  'blood-spiral': Object.freeze({ kind: 'spell', read: 'with the modifier, the heavy: two turns of the blade all round her', beats: Object.freeze(['mH']),
    moves: Object.freeze({ 'blood-spiral': Object.freeze({ swing: 'left', role: 'finisher', frames: 48, spin: 2, arc: 360, reach: 3, damage: 3, impact: 2, mp: 16 }) }) }),
});
export const TECH_IDS = Object.freeze(Object.keys(TECHS));

/** The hero's own manifest with the techs' strings added, and which string each tech is. */
export function techCombos(base, ids) {
  const M = structuredClone(base), gated = {};
  for (const id of ids) {
    const T = TECHS[id];
    if (!T) throw new Error(`trees: '${id}' is no attack or spell (${TECH_IDS.join(', ')})`);
    for (const [mid, mv] of Object.entries(T.moves)) {
      if (M.moves[mid]) throw new Error(`trees: ${id}'s move '${mid}' is one the hero has already`);
      M.moves[mid] = structuredClone(mv);
    }
    // (forked off the hero's own string: its beats played by the hero's own moves, found on the string that opens on them)
    const after = T.after ?? [], own = after.length ? M.combos.find((c) => !c.air && after.every((b, k) => c.beats[k] === b)) : null;
    if (after.length && !own) throw new Error(`trees: ${id} forks off the hero's string on ${after.join(' ')}, and the hero has none that opens so`);
    const combo = `tech:${id}`;
    M.combos.push({ id: combo, name: id, ...(T.air ? { air: true } : {}), beats: [...after, ...T.beats], moves: [...(own ? own.moves.slice(0, after.length) : []), ...Object.keys(T.moves)] });
    gated[combo] = id;
  }
  readCombos(M);
  return { manifest: M, gated };
}
