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
 *   mints     [{ key, of, tier, spec, toon?, recurring? }]   one per body to make: `of` the person it was rolled for
 *   people    [{ path, tier, body, idle? }]      every person, the mint they wear and how they stand (folk/garb.js:
 *                                                'own' their stand held, 'library' the shared idle, 'crouch')
 *   uniforms  { <service>: key }                 the mint whose clothes a service's people wear
 *
 * THE DRESS. The CULTURE is the town's: its kit's underlayer and the ramps of its setting colour every person, so the
 * same role in two worlds dresses two ways; the CUT is the person's (folk/garb.js): their role's garb (the keeper's
 * vest, the elder's long coat, the work floor's short sleeves), varied by their own dice, and the stand they hold. The ROLE is the service's: a uniform service (services.js) is worn by all
 * its people as its first person (in lot order) wears it, each on their own face (cast-setting.js wearUniform): two
 * keepers in a town are one shop's colours, two faces. The watch carries the guard's gear for the era.
 *
 * THE POOLS are keyed by what a body cannot lend: its uniform (a watchman never wears a townie's clothes), its stage (a
 * child never wears a grown body) and its sex (a woman never wears a man's body). Past a pool's own mints, a pooled
 * person wears the one nearest them, their age first and then their skin's lightness, the nearest few in turn: a pale
 * youth's body is not lent to a dark-skinned elder while a nearer one stands in the pool.
 * Mints are keyed by the path they were rolled for, and pools fill in people order, so a town only grows.
 */
import { planFromSheet, KIT_ERAS } from '../egocube/plan.js';
import { UNDERLAYERS } from '../gameworld/hero-looks.js';
import { wearUnderlayer, wearUniform, QUICK_FIGURES } from '../gameworld/cast-setting.js';
import { SERVICES } from './services.js';
import { FOLK_POOL } from './folk.js';
import { garbOf, stanceOf } from './garb.js';
import { baseOf } from '../era/style/looks.js';

export const TIERS = Object.freeze({
  own: 'a body of their own: the people the player goes to (a service\'s first person) and the ones met in every town',
  pooled: 'one of a few bodies their pool mints: the households, the apprentices, the watch',
});

const hash = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
/** A mint's key: the person it was rolled for, short and stable. */
export const mintKey = (path) => `folk-${hash(path).toString(36)}`;

// how near a pooled person's body must be to their own to stand in for it: an age step outweighs any skin (lightness
// runs 0 to 255), so the age decides and the skin chooses among the bodies of the nearest age; NEAR the skin's slack
const NEAR = 24, AGE_STEP = 300, AGES = ['child', 'youth', 'adult', 'seasoned', 'elder'];
const ageOf = (p) => Math.max(0, AGES.indexOf(p.sheet.facets.age ?? 'adult'));
// a body's skin as its lightness (0 to 255): what a pooled body is matched on beside the age
const skinOf = (spec) => { const h = spec?.palette?.Skin; if (typeof h !== 'string' || !/^#[0-9a-f]{6}$/i.test(h)) return 128; const n = parseInt(h.slice(1), 16); return Math.round(0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); };
const tierOf = (p) => (!p.parent && (p.service || p.recurring) ? 'own' : 'pooled');
const stageOf = (p) => (p.sheet.facets.age === 'child' ? 'child' : 'grown');

export function folkBodies(folk, { kit, setting, pool = FOLK_POOL.default } = {}) {
  if (!folk || !Array.isArray(folk.people)) throw new Error('folk bodies: give a folk sheet (folk.js folkOfTown)');
  if (!(Number.isInteger(pool) && pool >= 1 && pool <= FOLK_POOL.max)) throw new Error(`folk bodies: pool is a whole number from 1 to ${FOLK_POOL.max}`);
  const era = setting?.era;
  // (a kit a geocube painted is its look's base's: its underlayer is the base kit's)
  const rail = era && KIT_ERAS.includes(era) ? null : UNDERLAYERS[kit] ?? UNDERLAYERS[baseOf(kit)] ?? null;
  const guard = QUICK_FIGURES.guard, gear = guard.era?.[era] ?? guard.gear;
  const pending = new Set();
  // a person's own body, dressed: the world's underlayer, the watch's gear, a uniform's clothes over its own face
  const uniformSpec = {}, uniforms = {};
  const dress = (p) => {
    const P = planFromSheet(p.sheet);
    for (const r of P.ledger) if (r.pending && r.from.startsWith('setting.')) pending.add(`${r.channel}: ${r.pending}`);
    let spec = P.create.spec;
    // (the culture's underlayer, cut for the person: their role's garb by their own dice, folk/garb.js; and the stand
    // they hold, minted into their body)
    if (rail) spec = { ...wearUnderlayer(spec, { ...rail, language: garbOf(p, rail) }), gesture: stanceOf(p).gesture };
    if (p.service === 'watch' && stageOf(p) === 'grown') spec = { ...spec, gear };
    if (p.uniform && SERVICES[p.uniform]?.uniform) {
      if (uniformSpec[p.uniform]) spec = wearUniform(spec, uniformSpec[p.uniform]);
      else { uniformSpec[p.uniform] = spec; uniforms[p.uniform] = mintKey(p.path); }
    }
    return { spec, ...(P.create.toon ? { toon: P.create.toon } : {}) };
  };
  // (how each stands while they stand: their stand held, the shared idle, or crouched; folk/garb.js. Only where the
  // culture dresses them: a world the era dresses keeps the shared idle)
  const idleOf = (p) => (rail ? { idle: stanceOf(p).idle } : {});
  const mints = [], people = [], pools = {};
  for (const p of folk.people) {
    const tier = tierOf(p);
    if (tier === 'own') {
      const key = mintKey(p.path);
      mints.push({ key, of: p.path, tier, ...(p.recurring ? { recurring: p.recurring } : {}), ...dress(p) });
      people.push({ path: p.path, tier, body: key, ...idleOf(p) });
      continue;
    }
    // (a pool for each sex too: a woman never wears a man's body for want of a woman's)
    const P = (pools[`${p.uniform ?? 'plain'}:${stageOf(p)}:${p.sheet.facets.pole ?? '-'}`] ??= { mints: [], worn: {} });
    if (P.mints.length < pool) {
      const key = mintKey(p.path), d = dress(p);
      mints.push({ key, of: p.path, tier, ...d });
      P.mints.push({ key, age: ageOf(p), skin: skinOf(d.spec) });
      people.push({ path: p.path, tier, body: key, ...idleOf(p) });
      continue;
    }
    // past the pool: the mint nearest the person (their age, then their skin's lightness), the nearest few taken in
    // turn so the same body does not stand twice in a row where another is as near
    const me = { age: ageOf(p), skin: skinOf(planFromSheet(p.sheet).create.spec) };
    const far = (m) => Math.abs(m.age - me.age) * AGE_STEP + Math.abs(m.skin - me.skin);
    const ranked = [...P.mints].sort((a, b) => far(a) - far(b)), best = far(ranked[0]);
    const near = ranked.filter((m) => far(m) <= best + NEAR), k = near.map((m) => m.key).join();
    people.push({ path: p.path, tier, body: near[(P.worn[k] = (P.worn[k] ?? -1) + 1) % near.length].key, ...idleOf(p) });
  }
  return { kit: kit ?? null, pool, mints, people, uniforms, pending: [...pending] };
}
