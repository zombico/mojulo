/**
 * A GAME'S FIGHTS, COMPOSED AND READ OUT (fights.js `gameworld.fights`): each kept fight composed by its kind and seed
 * for the world's brief (gameroom/needs.js) and held to its laws, and what design_game says of them.
 *   composedFights(G)      → [{ name, kind, seed, room, laws, waves }] each composed and held to its laws
 *   fightsReadout(G)       → null (the world does not fight hand to hand), or { kinds, kept: [{ name, kind, waves, lost }],
 *                            asked?: { holds, says }, suggest? }: what is kept, the laws each loses, whether the kit's
 *                            asks are all answered; `suggest`: for a world that keeps none, a fight of each kind, as a
 *                            patch (offered: a fight is the creator's to play and keep)
 * Pure.
 */
import { FIGHT_KIND_IDS, composeFight } from '../gameroom/fight.js';
import { roomNeeds } from '../gameroom/needs.js';
import { fightLaws, askedBy } from '../gameroom/laws.js';
import { fightOf, fightWaves } from './fights.js';

export function composedFights(G) {
  const needs = roomNeeds(G);
  return Object.keys(G?.fights ?? {}).map((name) => {
    const F = fightOf(G, name), room = composeFight(needs, { kind: F.kind, seed: F.seed });
    return { name, kind: F.kind, seed: F.seed, room, laws: fightLaws(room, needs), waves: fightWaves(G, F.kind, F.waves ?? null) };
  });
}

export function fightsReadout(G) {
  const needs = roomNeeds(G);
  if (!needs.fights || needs.work) return null;
  const C = composedFights(G);
  const kept = C.map((f) => ({ name: f.name, kind: f.kind, waves: f.waves.length, lost: f.laws.filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`) }));
  const asked = askedBy(C.map((f) => f.room), needs);
  const suggest = C.length ? null : { why: 'a game that fights hand to hand settles its fights in the game room before any level: one of each kind, played and kept', patch: [{ op: 'set', path: '/fights', value: Object.fromEntries(FIGHT_KIND_IDS.map((k) => [k, { kind: k }])) }] };
  return { kinds: FIGHT_KIND_IDS, kept, ...(C.length ? { asked: { holds: asked.holds, says: asked.says } } : {}), ...(suggest ? { suggest } : {}) };
}
