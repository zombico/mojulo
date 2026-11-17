/**
 * THE FIGHT, MEASURED — a world's streets (a quick brawl's, a designed game's `street` levels) fought
 * down by the measure's bots before anyone plays them (brawl/brawl-measure.js: the fight laws). The play department's
 * machine gate for a map's encounters, beside the feel's and the range's: read in design_game's readout, a law lost
 * advised as a `fight` step, never a refusal. It says nothing of whether the fight is fun: that is a person's.
 *
 *   fightMeasured(world) → null (no street) | { maps: [{ id, name, play, runs, lost: [{ law, advice }] }], lost, worst }
 *
 * The two decisive cases only (the floor player on easy, a careful one as written), over three takes: the whole table
 * is the measure's own (`measureMap`, scripts/spikes/brawler/measure.mjs). The player is a stand-in (an all-rounder, or
 * the roster's first style): the world's own fighters are not made yet when this is read. Measured once a map (kept by
 * its words), since a readout is asked for often.
 */
import { brawlStreets, brawlByDesign, brawlAsStreets, STREET_LAY } from './quick.js';
import { streetLevel } from './brawl-cast.js';
import { brawlYardData } from '../brawl/brawl-page.js';
import { measureStreet, fightLaws } from '../brawl/brawl-measure.js';
import { solveFighter, ARCHETYPES } from '../versus/versus-solver.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const CASES = Object.freeze([['masher', 'easy'], ['careful', 'medium']]);
const kept = new Map();
const standIn = (style) => { const a = ARCHETYPES[style] ? style : 'all-rounder'; return { recipe: { ...solveFighter({ id: 'player', archetype: a }).recipe, archetype: a }, style: a }; };

function measured(id, name, belt, S, style, more = {}) {
  const street = { ...more, belt, players: [standIn(style)], waves: S.waves, things: S.things ?? [], ...(S.play === 'gun' ? { gunner: { guns: [S.guns[0]], grenades: S.grenades ?? 3 } } : {}) };
  const key = JSON.stringify([belt, S.waves, S.things, S.play, S.guns?.[0], S.grenades, style, more]);
  if (!kept.has(key)) { const runs = CASES.map(([bot, tier]) => measureStreet(street, { bot, tier, takes: 3, secs: 240 })); kept.set(key, { runs, laws: fightLaws(runs) }); if (kept.size > 64) kept.delete(kept.keys().next().value); }
  const M = kept.get(key);
  return { id, name, play: S.play ?? 'brawl', runs: M.runs.map((r) => ({ bot: r.bot, tier: r.tier, result: r.result, won: `${r.won}/${r.takes}`, seconds: r.seconds, health: r.health })), lost: M.laws.filter((l) => !l.ok).map((l) => ({ law: l.id, advice: l.advice })) };
}

export function fightMeasured(world) {
  const maps = [];
  try {
    const Q = world?.quick;
    if (isObj(Q) && (Q.goal === 'brawl' || Q.goal === 'rungun') && !brawlByDesign(Q, !!(world.foes && Object.keys(world.foes).length))) {
      for (const s of brawlStreets(brawlAsStreets(Q))) { const B = s.manifest.brawl; maps.push(measured(s.id, s.name, B.belt, B.street, Q.roster?.[0]?.style)); }
    } else for (const [id, L] of Object.entries(world?.levels ?? {})) {
      // (a designed game's street level, brawl-cast.js: its stops and its boss cast from the world's own, on its place,
      // read as its page reads it: its waves, its things, its lives, its tuning, a run & gun's guns)
      if (L?.street === undefined || L.street === false) continue;
      const M = streetLevel(world, L.street, { title: L.name ?? id, ...STREET_LAY }).manifest, Y = brawlYardData(M.brawl), ST = Y.street;
      maps.push(measured(id, L.name ?? id, M.brawl.belt, { waves: ST.waves, things: Y.things, ...(ST.play === 'gun' ? { play: 'gun', guns: ST.guns, grenades: ST.grenades } : {}) }, null, { lives: ST.lives, ...(ST.tune ? { tune: ST.tune } : {}) }));
    }
  } catch { return null; }   // (a world that does not read yet is said by its own reader, not here)
  if (!maps.length) return null;
  const lost = maps.reduce((n, m) => n + m.lost.length, 0), worst = maps.find((m) => m.lost.length) ?? null;
  return { maps, lost, ...(worst ? { worst: { map: worst.id, ...worst.lost[0] } } : {}) };
}
