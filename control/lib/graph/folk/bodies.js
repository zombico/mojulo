/**
 * THE FOLK'S BODIES: who of a town gets a body of their own, and what everyone wears. A town of a hundred people is not
 * a hundred minted heroes: the people the player goes to (a service's lot's first person: the keeper, the master, the
 * elder, the captain) each get their OWN body; everyone else is POOLED, as a quick game's crowd is (gameworld/runner.js
 * castOf): per pool, the first few people are minted as themselves and the rest wear one of theirs. Pure: this says
 * what to mint and who wears what; the level mints it.
 *
 *   folkBodies(folk, { kit?, setting?, pool? })  → { kit, pool, mints, people, uniforms, pending }
 *     folk      a folk sheet (folk.js folkOfTown), rolled in the same setting
 *     kit       the town's kit: its world's underlayer is what the folk wear (hero-looks.js UNDERLAYERS), unless the era
 *               dresses each person as their rolled look (a modern or a future world: egocube/plan.js KIT_ERAS)
 *     pool      how many people a pool mints as themselves (FOLK_POOL)
 *   mints     [{ key, of, tier, spec, toon? }]   one per body to make: `of` the person it was rolled for
 *   people    [{ path, tier, body }]             every person and the mint they wear
 *   uniforms  { <service>: key }                 the mint whose clothes a service's people wear
 *
 * THE DRESS. The CULTURE is the town's: its kit's underlayer and the ramps of its setting colour every person, so the
 * same role in two worlds dresses two ways. The ROLE is the service's: a uniform service (services.js) is worn by all
 * its people as its first person (in lot order) wears it, each on their own face (cast-setting.js wearUniform): two
 * keepers in a town are one shop's colours, two faces. The watch carries the guard's gear for the era.
 *
 * THE POOLS are keyed by what a body cannot lend: its uniform (a watchman never wears a townie's clothes) and its
 * stage (a child never wears a grown body). A pooled person wears a mint of their own pole when the pool has one.
 * Mints are keyed by the path they were rolled for, and pools fill in people order, so a town only grows.
 */
import { planFromSheet, KIT_ERAS } from '../egocube/plan.js';
import { UNDERLAYERS } from '../gameworld/hero-looks.js';
import { wearUnderlayer, wearUniform, QUICK_FIGURES } from '../gameworld/cast-setting.js';
import { SERVICES } from './services.js';
import { FOLK_POOL } from './folk.js';

export const TIERS = Object.freeze({
  own: 'a body of their own: the people the player goes to (a service\'s first person)',
  pooled: 'one of a few bodies their pool mints: the households, the apprentices, the watch',
});

const hash = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
/** A mint's key: the person it was rolled for, short and stable. */
export const mintKey = (path) => `folk-${hash(path).toString(36)}`;

const tierOf = (p) => (!p.parent && p.service ? 'own' : 'pooled');
const stageOf = (p) => (p.sheet.facets.age === 'child' ? 'child' : 'grown');

export function folkBodies(folk, { kit, setting, pool = FOLK_POOL.default } = {}) {
  if (!folk || !Array.isArray(folk.people)) throw new Error('folk bodies: give a folk sheet (folk.js folkOfTown)');
  if (!(Number.isInteger(pool) && pool >= 1 && pool <= FOLK_POOL.max)) throw new Error(`folk bodies: pool is a whole number from 1 to ${FOLK_POOL.max}`);
  const era = setting?.era;
  const rail = era && KIT_ERAS.includes(era) ? null : UNDERLAYERS[kit] ?? null;
  const guard = QUICK_FIGURES.guard, gear = guard.era?.[era] ?? guard.gear;
  const pending = new Set();
  // a person's own body, dressed: the world's underlayer, the watch's gear, a uniform's clothes over its own face
  const uniformSpec = {}, uniforms = {};
  const dress = (p) => {
    const P = planFromSheet(p.sheet);
    for (const r of P.ledger) if (r.pending && r.from.startsWith('setting.')) pending.add(`${r.channel}: ${r.pending}`);
    let spec = P.create.spec;
    if (rail) spec = wearUnderlayer(spec, rail);
    if (p.service === 'watch' && stageOf(p) === 'grown') spec = { ...spec, gear };
    if (p.uniform && SERVICES[p.uniform]?.uniform) {
      if (uniformSpec[p.uniform]) spec = wearUniform(spec, uniformSpec[p.uniform]);
      else { uniformSpec[p.uniform] = spec; uniforms[p.uniform] = mintKey(p.path); }
    }
    return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}) };
  };
  const mints = [], people = [], pools = {};
  for (const p of folk.people) {
    const tier = tierOf(p);
    if (tier === 'own') {
      const key = mintKey(p.path);
      mints.push({ key, of: p.path, tier, ...dress(p) });
      people.push({ path: p.path, tier, body: key });
      continue;
    }
    const P = (pools[`${p.uniform ?? 'plain'}:${stageOf(p)}`] ??= { mints: [], worn: 0 });
    if (P.mints.length < pool) {
      const key = mintKey(p.path);
      mints.push({ key, of: p.path, tier, ...dress(p) });
      P.mints.push({ key, pole: p.sheet.facets.pole });
      people.push({ path: p.path, tier, body: key });
      continue;
    }
    // past the pool: one of its mints, of the person's own pole when it has one, taken in turn
    const same = P.mints.filter((m) => m.pole === p.sheet.facets.pole), from = same.length ? same : P.mints;
    people.push({ path: p.path, tier, body: from[P.worn++ % from.length].key });
  }
  return { kit: kit ?? null, pool, mints, people, uniforms, pending: [...pending] };
}
