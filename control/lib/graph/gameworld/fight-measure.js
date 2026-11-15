/**
 * THE FIGHT, MEASURED — a world's sideways maps (a quick brawl's streets, a composed world's `sideways` levels) fought
 * down by the measure's bots before anyone plays them (brawl/brawl-measure.js: the fight laws). The play department's
 * machine gate for a map's encounters, beside the feel's and the range's: read in design_game's readout, a law lost
 * advised as a `fight` step, never a refusal. It says nothing of whether the fight is fun: that is a person's.
 *
 *   fightMeasured(world) → null (no sideways map) | { maps: [{ id, name, play, runs, lost: [{ law, advice }] }], lost, worst }
 *
 * The two decisive cases only (the floor player on easy, a careful one as written), over three takes: the whole table
 * is the measure's own (`measureMap`, scripts/spikes/brawler/measure.mjs). The player is a stand-in (an all-rounder, or
 * the roster's first style): the world's own fighters are not made yet when this is read. Measured once a map (kept by
 * its words), since a readout is asked for often.
 */
import { brawlStreets, streetPlay } from './quick.js';
import { readSideways } from './sideways-read.js';
import { brawlLevel } from '../brawl/brawl-levels.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { measureStreet, fightLaws } from '../brawl/brawl-measure.js';
import { solveFighter, ARCHETYPES } from '../versus/versus-solver.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const CASES = Object.freeze([['masher', 'easy'], ['careful', 'medium']]);
const kept = new Map();
const standIn = (style) => { const a = ARCHETYPES[style] ? style : 'all-rounder'; return { recipe: { ...solveFighter({ id: 'player', archetype: a }).recipe, archetype: a }, style: a }; };

function measured(id, name, belt, S, style) {
  const street = { belt, players: [standIn(style)], waves: S.waves, things: S.things ?? [], ...(S.play === 'gun' ? { gunner: { guns: [S.guns[0]], grenades: S.grenades ?? 3 } } : {}) };
  const key = JSON.stringify([belt, S.waves, S.things, S.play, S.guns?.[0], S.grenades, style]);
  if (!kept.has(key)) { const runs = CASES.map(([bot, tier]) => measureStreet(street, { bot, tier, takes: 3, secs: 240 })); kept.set(key, { runs, laws: fightLaws(runs) }); if (kept.size > 64) kept.delete(kept.keys().next().value); }
  const M = kept.get(key);
  return { id, name, play: S.play ?? 'brawl', runs: M.runs.map((r) => ({ bot: r.bot, tier: r.tier, result: r.result, won: `${r.won}/${r.takes}`, seconds: r.seconds, health: r.health })), lost: M.laws.filter((l) => !l.ok).map((l) => ({ law: l.id, advice: l.advice })) };
}

export function fightMeasured(world) {
  const maps = [];
  try {
    const Q = world?.quick;
    if (isObj(Q) && Q.goal === 'brawl') {
      for (const s of brawlStreets(Q)) { const B = s.manifest.brawl; maps.push(measured(s.id, s.name, B.belt, B.street, Q.roster?.[0]?.style)); }
    } else for (const [id, L] of Object.entries(world?.levels ?? {})) {
      if (L?.sideways === undefined || L.sideways === false) continue;
      const S = readSideways(L.sideways, { foes: world.foes ?? null, where: `levels.${id}.sideways` }), B = brawlLevel(S.ground).brawl;
      const types = Object.keys(S.cast ?? {}).filter((t) => CROWD_TYPES[t]);
      maps.push(measured(id, L.name ?? id, B.belt, streetPlay(S.play, B.belt, { waves: S.waves, things: S.things, types: types.length ? types : null, setting: B.dress?.setting ?? null, guns: S.guns, grenades: S.grenades })));
    }
  } catch { return null; }   // (a world that does not read yet is said by its own reader, not here)
  if (!maps.length) return null;
  const lost = maps.reduce((n, m) => n + m.lost.length, 0), worst = maps.find((m) => m.lost.length) ?? null;
  return { maps, lost, ...(worst ? { worst: { map: worst.id, ...worst.lost[0] } } : {}) };
}
