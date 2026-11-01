/**
 * THE CASTING CALL — a cast of foes PROPOSED for a world that keeps no bestiary, from what the world already says: what
 * game it is (its intent's cube: the Mind gem's values and its combat), how its effects are drawn and timed (its
 * register and flavor, juice.js) and when it is set (its kit's era, cast-setting.js). It proposes and never writes: the
 * agent writes the words (`patch`) through design_game, and the creator approves them on the cast sheet.
 *
 *   castingCall(world) → null (the game fights nothing, keeps a bestiary already, or has no walk or building to stand a foe on) or
 *     { foes, levels, patch, roles: [{ id, role, class, rank, skill?, skin?, score, why: [...] }], variants: [{ id, of, class,
 *       ooze }], from, reasons }
 *     foes     the bestiary proposed, in the bestiary's own words (foes.js readBestiary takes it)
 *     levels   { <level id>: <its foes words> } for each walk or building that names none
 *     patch    the JSON Pointer ops that write both (design_game { patch })
 *     from     { genre, flavor, register, era, people?, dress?, oozes?, mind: { <axis>: value } } what was read
 *
 * The cast is ROLES (one row each): the grunt the hero cuts through, the harrier that hurts from where the grunt cannot,
 * the elite that tests what the hero learned, the boss a level ends on. Each role takes the class that scores best
 * against the world (`score`): its mind against the cube's Mind values (motivation, aggressiveness, perception,
 * pathing, a pack's squad), its attack against the cube's combat, its toll against the flavor (a platformer's stomp, a
 * realistic game's blows), whether the world's people can play it and what the intent's target engine carries; a class the cube's own
 * `mind.foes` names is cast before any it does not. Ties go
 * to the class's order. A role's people is rolled once for the world from its era's peoples (one force, not a zoo), on
 * a class that stands on two legs; a platformer's and a pinball table's cast stays the stand-in beasts. A person cast is
 * dressed as one crew (ERA_DRESS: its faction by era, a soldier's for a game whose minds are soldiers', its colourway
 * rolled), each role the kind its class reads as by what the kind carries. A beast cast is grown by the world's oozes (ELEMENT_OOZE, ERA_OOZES): a variant of each
 * beast role per ooze, and its boss grown dire.
 *
 * Pure and deterministic: the people, the crew and its colours are the world's seed's (mulberry32), nothing else is rolled.
 */
import { readGameworld } from './world.js';
import { playOrder } from './graph.js';
import { cubeOfWorld } from './intent.js';
import { castStyleOf } from './foe-cast.js';
import { settingOfGame } from './cast-setting.js';
import { FOE_CLASSES, classStatus } from '../foes/index.js';
import { ATTACKS, MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { peopleSeed } from '../foes/people.js';
import { fitOfPeople } from '../foes/fit.js';
import { AGGRESSIVENESS } from '../mind/vocab.js';
import { mulberry32 } from '../vegetation/grow.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { ITEMS } from '../cosmos/packs/comic-hero/items.js';

/** The cast's roles, in the order they are cast: the rank each stands at and what it is for. */
export const ROLES = Object.freeze({
  grunt: { rank: 'minion', line: 'the bulk the hero cuts through' },
  harrier: { rank: 'minion', line: 'a second threat the grunt is not: it hurts from where the grunt cannot' },
  elite: { rank: 'elite', line: 'the test of what the hero has learned' },
  boss: { rank: 'boss', line: 'the encounter a level ends on' },
});
/** The peoples each era fields its foes from (egocube/ancestry.js lineages); an era without a row fields beasts. */
export const ERA_PEOPLES = Object.freeze({
  myth: ['undead', 'skeleton', 'infernal'],
  rustic: ['orcish', 'lupine', 'sylvan'],
  modern: ['human'],
  future: ['insectoid', 'human'],
});
/** The crews a person cast is dressed as, by era (foes/dress.js: the comic hero pack's grunt factions); a game whose
 * minds hunt or guard as soldiers do (MILITARY) takes the first, any other one rolled from the row. */
export const ERA_DRESS = Object.freeze({
  modern: ['privateMilitary', 'corporateSecurity', 'streetGang'],
  future: ['privateMilitary', 'corporateSecurity'],
});
/** The oozes a world grows its beasts by (mutagen/oozes): its character book's leading and supporting elements first
 * (element-words.js), then its era's. Each beast role takes one VARIANT per ooze (at most MAX_VARIANTS): the same class
 * on the same stand-in, grown by it, met from the second level on; the boss is grown itself, dire and its world's first. */
export const ELEMENT_OOZE = Object.freeze({ wind: 'storm', air: 'storm', flame: 'fire', fire: 'fire', ember: 'fire', lava: 'fire', ice: 'frost', frost: 'frost', storm: 'storm', lightning: 'storm', thunder: 'storm', shadow: 'shadow', dark: 'shadow', earth: 'crystal', stone: 'crystal' });
export const ERA_OOZES = Object.freeze({ myth: ['skeletal', 'shadow'], rustic: ['mythical'], future: ['techno', 'transmetal'] });
export const BOSS_OOZE = 'dire';
export const MAX_VARIANTS = 2;
const MILITARY = ['shooter', 'stealth', 'arena-shooter', 'survival-horror', 'tactics', 'rts', 'city-stalker', 'co-op-scroller'];
/** The flavors whose cast stays beasts on their stand-ins (a stomp, a bop, a pop are a critter's). */
const BEAST_FLAVORS = ['platformer', 'pinball'];
/** What says a game fights: a combat of its own, or a mind that hunts, guards or holds ground. */
const FIGHTS = { combat: ['melee', 'ranged'], motivation: ['hunt', 'guard', 'territorial', 'frag'] };

const reachOf = (c) => (c.attack.kind === 'call' ? 'calls' : ['shot', 'lob', 'spray'].includes(c.attack.kind) ? 'far' : 'near');
const level = (a) => AGGRESSIVENESS[a]?.level;

// one class against the world: its score and why
function scoreOf(c, ctx) {
  const f = resolveFoe({ class: c.id }), M = f.mind.mind, own = c.mind ?? {}, why = [];
  let s = 0;
  const add = (n, w) => { s += n; if (n > 0) why.push(w); };
  if (ctx.mind.foes?.includes(c.id)) add(1, 'the intent names it (mind.foes)');
  if (ctx.mind.motivation && M.motivation === ctx.mind.motivation) add(3, `its motivation is the game's (${M.motivation})`);
  if (ctx.mind.aggressiveness && level(M.aggressiveness) !== undefined) add(2 - Math.abs(level(M.aggressiveness) - level(ctx.mind.aggressiveness)), `${M.aggressiveness}, near the game's ${ctx.mind.aggressiveness}`);
  if (ctx.mind.perception && own.perception === ctx.mind.perception) add(2, `perceives by ${own.perception}`);
  if (ctx.mind.pathing === 'navmesh' && own.pathing === 'navmesh') add(1, 'finds its way round obstacles');
  if (ctx.mind.squad === 'pack' && MOVES[c.move].group) add(2, 'hunts as a pack');
  const far = reachOf(c) === 'far';
  if (ctx.combat.includes('ranged') && far) add(2, 'hurts from range, as the game fights');
  if (ctx.combat.includes('melee') && !far && ATTACKS[c.attack.kind]?.verb === 'melee') add(1, 'a blow at close quarters, as the game fights');
  if (BEAST_FLAVORS.includes(ctx.flavor)) add(c.stomp === 'blow' && ATTACKS[c.attack.kind]?.verb === 'contact' ? 2 : 0, `a ${ctx.flavor}'s foe: a touch hurts, a stomp downs it`);
  if (ctx.flavor === 'realistic' && ATTACKS[c.attack.kind]?.verb === 'contact') add(-2, '');
  if (ctx.people && fitOfPeople(c.id, { people: ctx.people }).ok) add(1, `the world's people can play it (two legs)`);
  if (ctx.target) add(classStatus(c).marks?.[ctx.target] === 'absent' ? -1 : 1, `${ctx.target} carries it`);
  return { s, why };
}

// the best class for a role, from those the role takes: one the intent names first, then one the cast does not hold
// yet, then any
function pick(scored, ok, taken, named) {
  const pool = scored.filter((x) => ok(x.c)), fresh = pool.filter((x) => !taken.includes(x.c.id));
  const own = fresh.filter((x) => named.includes(x.c.id));
  return (own.length ? own : fresh.length ? fresh : pool).sort((a, b) => b.s - a.s || a.k - b.k)[0] ?? null;
}

export function castingCall(world) {
  const G = readGameworld(world);
  if (G.foes !== undefined || world.quick) return null;
  // (where a foe can stand: a walk's trails, a building's rooms)
  const walks = G.ids.filter((id) => G.levels[id].walk !== undefined || (G.levels[id].building !== undefined && G.levels[id].building?.ref === undefined));
  if (!walks.length) return null;
  const { cube, from: genre } = cubeOfWorld(world), mind = cube.mind ?? {}, combat = [].concat(cube.power?.combat ?? []);
  const named = [].concat(mind.foes ?? []);
  if (!named.length && !combat.some((k) => FIGHTS.combat.includes(k)) && !FIGHTS.motivation.includes(mind.motivation)) return null;
  const style = castStyleOf(G), era = settingOfGame(G).era ?? null, target = world.intent?.target ?? null;
  // the people the cast is drawn as: one for the world, rolled from its era's
  const rnd = mulberry32(peopleSeed(G.seed, 'casting-call'));
  const peoples = !BEAST_FLAVORS.includes(style.flavor) && ERA_PEOPLES[era] ? ERA_PEOPLES[era] : null;
  const people = peoples ? peoples[Math.floor(rnd() * peoples.length)] : null;
  // (a person cast is dressed as one crew: its faction by era and genre, its colours the world's roll)
  const factions = people === 'human' ? ERA_DRESS[era] ?? null : null;
  const faction = factions ? (MILITARY.includes(genre) ? factions[0] : factions[Math.floor(rnd() * factions.length)]) : null;
  const F = faction ? GRUNT_STYLES[faction] : null, colourways = F ? Object.keys(F.colourways) : [];
  const colourway = F ? colourways[Math.floor(rnd() * colourways.length)] : null;
  // (each role the kind its class reads as, by what the kind carries: a class on watch the kind whose arms are stowed, one
  // that fires the kind with a long gun at the ready in its hands, the boss or a heavy class the heaviest build; the rest,
  // and any match taken, the faction's kinds by weight)
  const kinds = F ? Object.entries(F.kinds).sort((a, b) => b[1].weight - a[1].weight).map(([k]) => k) : [];
  const held = (kind) => F.kinds[kind].items.map((set) => set.filter((i) => ITEMS[i]?.slot === 'right'));
  const KIND_READS = {
    watch: (kind) => held(kind)[0].length === 0,
    fire: (kind) => held(kind).some((set) => set.some((i) => ITEMS[i]?.family === 'longGun')),
    heavy: (kind) => F.kinds[kind].builds.includes('brute'),
  };
  const usedKinds = [];
  const kindOf = (role, c) => {
    const read = role === 'boss' || c.toll.downs >= 3 ? 'heavy' : (c.mind.motivation ?? MOVES[c.move].mind?.motivation) === 'guard' ? 'watch' : reachOf(c) === 'far' ? 'fire' : null;
    const fits = read ? kinds.filter(KIND_READS[read]) : [];
    const k = fits.find((x) => !usedKinds.includes(x)) ?? fits[0] ?? kinds.find((x) => !usedKinds.includes(x)) ?? kinds[0];
    usedKinds.push(k);
    return k;
  };
  const ctx = { mind: { ...mind, foes: named }, combat, flavor: style.flavor, target, people };
  const scored = Object.values(FOE_CLASSES).map((c, k) => ({ c, k, ...scoreOf(c, ctx) }));

  // the roles, each its best class
  const cast = {}, taken = [];
  const take = (role, ok) => { const x = pick(scored, ok, taken, named); if (x) { cast[role] = x; taken.push(x.c.id); } };
  take('grunt', (c) => c.threat <= 3 && reachOf(c) !== 'calls');
  take('harrier', (c) => c.threat <= 3 && reachOf(c) !== 'calls' && reachOf(c) !== reachOf(cast.grunt.c));
  take('elite', (c) => c.threat >= 2);
  take('boss', (c) => c.threat >= 3);

  const bossRank = ['miniboss', 'boss'].includes(mind.rank) ? mind.rank : 'boss';
  const skill = mind.skill && mind.skill !== 'regular' ? mind.skill : null;
  const foes = {}, roles = [];
  for (const [role, x] of Object.entries(cast)) {
    const rank = role === 'boss' ? bossRank : ROLES[role].rank;
    const skin = people && fitOfPeople(x.c.id, { people }).ok ? { people, ...(F ? { dress: { faction, kind: kindOf(role, x.c), colourway } } : {}) } : null;
    const entry = { class: x.c.id, ...(rank !== 'minion' ? { rank } : {}), ...(skill ? { skill } : {}), ...(skin ? { skin } : {}) };
    // (a summoner calls the grunt; a grunt that is itself a summoner never stands, so it always has one to call)
    if (x.c.id === 'summoner') entry.summons = { foe: 'grunt' };
    foes[role] = entry;
    roles.push({ id: role, role: ROLES[role].line, class: x.c.id, rank, ...(skill ? { skill } : {}), ...(skin ? { skin } : {}), score: x.s, why: x.why.length ? x.why : ['the best of what is left'] });
  }

  // the beasts' VARIANTS: each beast role grown by each of the world's oozes, kept where the grown body still fits its
  // class (foes/fit.js, through the resolver); the boss grown itself
  const D = G.characters?.direction ?? {};
  const oozes = [...new Set([D.primary, D.secondary].map((w) => ELEMENT_OOZE[w]).filter(Boolean).concat(ERA_OOZES[era] ?? []))].slice(0, MAX_VARIANTS);
  const grows = (cls, species, ooze) => { try { resolveFoe({ class: cls, skin: { species, ooze } }); return true; } catch { return false; } };
  const variants = [], unfit = [];
  for (const r of [...roles]) {
    if (foes[r.id].skin) continue;
    const species = FOE_CLASSES[r.class].standIn;
    if (r.id === 'boss') {
      // (dire and the world's first ooze, else either alone, as the grown body still fits)
      const tries = [[BOSS_OOZE, ...oozes.slice(0, 1)], [BOSS_OOZE], ...oozes.slice(0, 1).map((o) => [o])];
      const ooze = tries.find((t) => grows(r.class, species, t));
      if (ooze) { foes.boss = { ...foes.boss, skin: { species, ooze } }; r.skin = foes.boss.skin; }
      if (ooze?.length !== tries[0].length) unfit.push(`boss: ${tries[0].join(' and ')}${ooze ? `, grown ${ooze.join(' and ')} instead` : ''}`);
      continue;
    }
    for (const o of oozes) {
      if (!grows(r.class, species, [o])) { unfit.push(`${r.id}: ${o}`); continue; }
      const id = `${r.id}-${o}`;
      foes[id] = { ...foes[r.id], skin: { species, ooze: [o] } };
      variants.push({ id, of: r.id, class: r.class, ooze: o });
    }
  }
  const variantsOf = (role) => variants.filter((v) => v.of === role).map((v) => v.id);

  // where they stand, in the order the levels are played: the grunt and the harrier on every walk, the elite from the
  // middle on (the first of two), their variants from the second on (the first, of two), the boss alone on the last
  // (one of it), won by clearing it
  const order = playOrder(G).filter((id) => walks.includes(id));
  const levels = {}, n = order.length, open = order.filter((id) => G.levels[id].foes === undefined);
  order.forEach((id, k) => {
    if (!open.includes(id)) return;
    // (the variants from the second level on; where the boss's is the second, from the first)
    const last = k === n - 1 && n > 1, deeper = k >= Math.min(1, Math.max(0, n - 2));
    const roles0 = last ? ['boss'] : ['grunt', 'harrier', ...(k >= Math.floor((n - 1) / 2) ? ['elite'] : []), ...(n === 1 ? ['boss'] : [])];
    const from = roles0.flatMap((r) => [r, ...(deeper && r !== 'boss' ? variantsOf(r) : [])]);
    levels[id] = { from: from.filter((r) => foes[r]), ...(last ? { count: 1, win: 'clear' } : {}) };
  });
  const patch = [{ op: 'add', path: '/foes', value: foes }, ...Object.entries(levels).map(([id, v]) => ({ op: 'add', path: `/levels/${id}/foes`, value: v }))];
  const reasons = [
    genre ? `a ${genre} (the intent's cube), its minds ${Object.entries(mind).filter(([k]) => k !== 'foes').map(([k, v]) => `${k} ${v}`).join(', ') || 'unsaid'}` : 'no genre: the cube\'s own values',
    `a ${style.flavor} game in the ${style.register} register (${style.from})`,
    people ? `set in the ${era} era: the cast is ${people === 'human' ? 'people' : `${people} folk`} where a class stands on two legs` : `${era ? `the ${era} era names no people for a ${style.flavor} cast` : 'no era'}: every foe on its class's stand-in beast`,
    ...(F ? [`dressed as one crew, ${F.name.toLowerCase()} in ${F.colourways[colourway].reads}${MILITARY.includes(genre) ? `: a ${genre}'s soldiers` : ''}; each role the kind its class reads as (on watch, arms stowed; firing, a long gun at the ready; the boss the heaviest)`] : []),
    ...(variants.length || foes.boss?.skin?.ooze ? [`its beasts grown by the world's oozes (${oozes.map((o) => `${o}${Object.values([D.primary, D.secondary]).some((w) => ELEMENT_OOZE[w] === o) ? ', its element' : `, the ${era} era`}`).join('; ') || 'none'}): ${variants.length ? `a variant of each beast role per ooze, met deeper in (from the second level, or the first of two)` : 'no variant fits'}${foes.boss?.skin?.ooze ? `; the boss grown ${foes.boss.skin.ooze.join(' and ')}` : ''}`] : []),
    ...(unfit.length ? [`left ungrown, the grown body no longer fitting its class: ${unfit.join(', ')}`] : []),
    ...(bossRank !== 'boss' ? [`the boss stands as a ${bossRank}, the cube's rank`] : []),
    ...(skill ? [`every foe at ${skill} skill, the cube's`] : []),
  ];
  return { foes, levels, patch, roles, variants, from: { genre, flavor: style.flavor, register: style.register, era, ...(people ? { people } : {}), ...(F ? { dress: { faction, colourway } } : {}), ...(oozes.length ? { oozes } : {}), mind: { ...mind } }, reasons };
}
