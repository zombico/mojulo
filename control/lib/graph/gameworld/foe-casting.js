/**
 * THE CASTING CALL — a cast of foes PROPOSED for a world that keeps no bestiary, from what the world already says: what
 * game it is (its intent's cube: the Mind gem's values and its combat), how its effects are drawn and timed (its
 * register and flavor, juice.js) and when it is set (its kit's era, cast-setting.js). It proposes and never writes: the
 * agent writes the words (`patch`) through design_game, and the creator approves them on the cast sheet.
 *
 *   castingCall(world) → null (the game fights nothing, keeps a bestiary already, or has no walk or building to stand a foe on) or
 *     { foes, levels, patch, roles: [{ id, role, class, rank, skill?, skin?, score, why: [...] }], from, reasons }
 *     foes     the bestiary proposed, in the bestiary's own words (foes.js readBestiary takes it)
 *     levels   { <level id>: <its foes words> } for each walk or building that names none
 *     patch    the JSON Pointer ops that write both (design_game { patch })
 *     from     { genre, flavor, register, era, people?, mind: { <axis>: value } } what was read, and from where
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
 * rolled), each role a kind of it.
 *
 * Pure and deterministic: the people, the crew and its colours are the world's seed's (mulberry32), nothing else is rolled.
 */
import { readGameworld } from './world.js';
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
  // (its kinds by weight, the cast's roles taking them in turn; the boss the heaviest build's)
  const kinds = F ? Object.entries(F.kinds).sort((a, b) => b[1].weight - a[1].weight).map(([k]) => k) : [];
  const kindOf = (role, k) => (role === 'boss' ? kinds.find((x) => F.kinds[x].builds.includes('brute')) ?? kinds[0] : kinds[k % kinds.length]);
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
  for (const [k, [role, x]] of Object.entries(cast).entries()) {
    const rank = role === 'boss' ? bossRank : ROLES[role].rank;
    const skin = people && fitOfPeople(x.c.id, { people }).ok ? { people, ...(F ? { dress: { faction, kind: kindOf(role, k), colourway } } : {}) } : null;
    const entry = { class: x.c.id, ...(rank !== 'minion' ? { rank } : {}), ...(skill ? { skill } : {}), ...(skin ? { skin } : {}) };
    // (a summoner calls the grunt; a grunt that is itself a summoner never stands, so it always has one to call)
    if (x.c.id === 'summoner') entry.summons = { foe: 'grunt' };
    foes[role] = entry;
    roles.push({ id: role, role: ROLES[role].line, class: x.c.id, rank, ...(skill ? { skill } : {}), ...(skin ? { skin } : {}), score: x.s, why: x.why.length ? x.why : ['the best of what is left'] });
  }

  // where they stand: the grunt and the harrier on every walk, the elite from the middle on (the first of two), the boss alone on the last (one of it), won by clearing it
  const levels = {}, n = walks.length, open = walks.filter((id) => G.levels[id].foes === undefined);
  walks.forEach((id, k) => {
    if (!open.includes(id)) return;
    const last = k === n - 1 && n > 1, from = last ? ['boss'] : ['grunt', 'harrier', ...(k >= Math.floor((n - 1) / 2) ? ['elite'] : []), ...(n === 1 ? ['boss'] : [])];
    levels[id] = { from: from.filter((r) => foes[r]), ...(last ? { count: 1, win: 'clear' } : {}) };
  });
  const patch = [{ op: 'add', path: '/foes', value: foes }, ...Object.entries(levels).map(([id, v]) => ({ op: 'add', path: `/levels/${id}/foes`, value: v }))];
  const reasons = [
    genre ? `a ${genre} (the intent's cube), its minds ${Object.entries(mind).filter(([k]) => k !== 'foes').map(([k, v]) => `${k} ${v}`).join(', ') || 'unsaid'}` : 'no genre: the cube\'s own values',
    `a ${style.flavor} game in the ${style.register} register (${style.from})`,
    people ? `set in the ${era} era: the cast is ${people === 'human' ? 'people' : `${people} folk`} where a class stands on two legs` : `${era ? `the ${era} era names no people for a ${style.flavor} cast` : 'no era'}: every foe on its class's stand-in beast`,
    ...(F ? [`dressed as one crew, ${F.name.toLowerCase()} in ${F.colourways[colourway].reads}${MILITARY.includes(genre) ? `: a ${genre}'s soldiers` : ''}; each role a kind of it, the boss the heaviest`] : []),
    ...(bossRank !== 'boss' ? [`the boss stands as a ${bossRank}, the cube's rank`] : []),
    ...(skill ? [`every foe at ${skill} skill, the cube's`] : []),
  ];
  return { foes, levels, patch, roles, from: { genre, flavor: style.flavor, register: style.register, era, ...(people ? { people } : {}), ...(F ? { dress: { faction, colourway } } : {}), mind: { ...mind } }, reasons };
}
