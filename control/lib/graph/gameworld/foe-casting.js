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
 * realistic game's blows) and whether the world's people can play it; a class the cube's own
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
import { FOE_CLASSES } from '../foes/index.js';
import { ATTACKS, MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { peopleSeed } from '../foes/people.js';
import { LINEAGES } from '../egocube/ancestry.js';
import { HEIGHT } from '../egocube/plan.js';
import { ARMORY_ARMS } from '../equipment/armory.js';
import { fitOfPeople } from '../foes/fit.js';
import { AGGRESSIVENESS } from '../mind/vocab.js';
import { mulberry32 } from '../vegetation/grow.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { ITEMS } from '../cosmos/packs/comic-hero/items.js';
import { bookRail, gameBody } from './game-bodies.js';
import { arsenalOfGame } from './arsenal.js';
import { arsenalFor } from './combos.js';

/** The dress words a crew takes from the body its game puts in its henchmen (`characters.direction.body`: a rail, 'game',
 * or { rail, style?, muscle? }): { rail, body?, muscle? }, `body` 'realistic' where the rail draws its henchman on the
 * realistic body in the world's tradition and look; null when the book names no body, or its game's kind no rail. */
export function henchmenOf(G) {
  const R = bookRail(G); if (!R) return null;
  const look = G.juice && typeof G.juice === 'object' ? G.juice.look ?? null : null;
  const B = gameBody(R.rail, 'henchman', { tradition: G.characters.direction.tradition, look, ...(R.style ? { style: R.style } : {}) });
  return { rail: R.rail, ...(B.spec.form === 'realistic' ? { body: 'realistic' } : {}), ...(R.muscle !== undefined ? { muscle: R.muscle } : {}) };
}

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
  rustic: ['goblin', 'orcish', 'lupine', 'sylvan'],
  modern: ['human'],
  future: ['insectoid', 'human'],
});
/** What a people that swings a blow carries in its right hand, by lineage (equipment/armory.js rows): its rank and
 * file's arm and its leaders' (the elite, the boss). A lineage with no row fights with what its own roll gives it; a
 * new people's arms is a row. */
const CLUBS = Object.freeze({ file: 'cudgel', lead: 'spiked-club' });
export const PEOPLE_ARMS = Object.freeze({ goblin: CLUBS, orcish: CLUBS });
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

/** A class whose mind stuffs a raw swing with a charge (mind/vocab.js AGGRESSIVENESS knobs.tackleGuard: beaten only by
 * a roll, never by a string). */
const counters = (c) => !!AGGRESSIVENESS[resolveFoe({ class: c.id }).mind.mind.aggressiveness]?.knobs?.tackleGuard;
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
  // (and a world map's scenario: its fights' beats, gameworld/world-map.js)
  const mapped = G.ids.filter((id) => G.levels[id].glyphs?.plan && G.levels[id].glyphs?.sketch?.scenario);
  if (!walks.length && !mapped.length) return null;
  const { cube, from: genre } = cubeOfWorld(world), mind = cube.mind ?? {}, combat = [].concat(cube.power?.combat ?? []);
  const named = [].concat(mind.foes ?? []);
  // (a genre that fights only turn by turn meets its foes as the party battles' packs, battles.js: none stand beside them)
  if (combat.includes('turn-based') && !combat.some((k) => FIGHTS.combat.includes(k))) return null;
  if (!named.length && !combat.some((k) => FIGHTS.combat.includes(k)) && !FIGHTS.motivation.includes(mind.motivation)) return null;
  const style = castStyleOf(G), era = settingOfGame(G).era ?? null;
  // the people the cast is drawn as: one for the world, rolled from its era's
  const rnd = mulberry32(peopleSeed(G.seed, 'casting-call'));
  const peoples = !BEAST_FLAVORS.includes(style.flavor) && ERA_PEOPLES[era] ? ERA_PEOPLES[era] : null;
  const people = peoples ? peoples[Math.floor(rnd() * peoples.length)] : null;
  // (a person cast is dressed as one crew: its faction by era and genre, its colours the world's roll)
  const factions = people === 'human' ? ERA_DRESS[era] ?? null : null;
  const faction = factions ? (MILITARY.includes(genre) ? factions[0] : factions[Math.floor(rnd() * factions.length)]) : null;
  const F = faction ? GRUNT_STYLES[faction] : null, colourways = F ? Object.keys(F.colourways) : [];
  // (the body its game puts in its henchmen, where the book names one (game-bodies.js, characters.direction.body): the
  // crew dressed on it, the realistic body where the rail draws one; a book that names none dresses the crew as before)
  const hench = F ? henchmenOf(G) : null;
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
  const ctx = { mind: { ...mind, foes: named }, combat, flavor: style.flavor, people };
  // (the hero's kit: the world's arsenal, else the kit its feel's template carries; strings where the cube plays them)
  const kit = arsenalOfGame(world)?.arsenal ?? (world.feel ? arsenalFor(world.feel)?.arsenal ?? null : null);
  const strings = cube.power?.moveset === 'strings' || !!kit;
  const scored = Object.values(FOE_CLASSES).map((c, k) => ({ c, k, ...scoreOf(c, ctx) }));

  // the roles, each its best class
  const cast = {}, taken = [];
  const take = (role, ok, ...fallback) => {
    const x = pick(scored, ok, taken, named) ?? fallback.reduce((y, f) => y ?? pick(scored, f, taken, named), null);
    if (x) { cast[role] = x; taken.push(x.c.id); }
  };
  if (strings) {
    // A HERO THAT PLAYS STRINGS (the cube's moveset, or the kit its world or its feel's template carries) meets its foes
    // blade to blade: the grunt, the elite and the boss come within the blade's reach on the ground (no flier: a blade
    // never reaches one) and answer a string by being cut (no counter that stuffs every swing it sees: a mind with
    // `tackleGuard`, beaten only by a roll). The harrier hurts from afar only where the hero's sidearm answers a shot as
    // a shot does, straight and at once (an automatic's hitscan, combos.js SIDEARM_MODES `auto`: an arrow's flight and
    // drop is no answer to a rifle at thirty metres), and then it stands where it is; else it is a flanker on foot. The
    // boss is cast before the elite, the heaviest such body its own.
    // EACH SWINGS A BLOW OF ITS OWN (a `strike`: a wind-up, a contact, a recovery the hero reads and trades with), from
    // the first foe on: a charge down a line and a touch are a beast's lessons (step aside, stomp it), not the blade's.
    // The elite is such a class a rank up, the grunt's own where no other is left (the bigger one of its kind), never
    // the boss's heavier body. Where the shelf has no such class left, one that meets the blade as before.
    const meets = (c) => reachOf(c) === 'near' && !counters(c) && !MOVES[c.move]?.rule?.flier;
    const swings = (c) => meets(c) && c.attack.kind === 'strike';
    const answers = (kit?.ranged ?? []).some((G) => G.mode === 'auto');
    take('grunt', (c) => c.threat <= 3 && swings(c), (c) => c.threat <= 3 && meets(c), (c) => c.threat <= 3 && reachOf(c) !== 'calls');
    take('harrier', answers ? (c) => c.threat <= 3 && reachOf(c) === 'far' && c.move === 'hold' : (c) => c.threat <= 3 && swings(c),
      (c) => c.threat <= 3 && meets(c), (c) => c.threat <= 3 && reachOf(c) !== 'calls' && reachOf(c) !== reachOf(cast.grunt.c));
    take('boss', (c) => c.threat >= 3 && meets(c), (c) => c.threat >= 3);
    take('elite', (c) => c.threat >= 2 && c.threat <= 3 && swings(c), (c) => c.threat >= 2 && meets(c), (c) => c.threat >= 2);
  } else {
    take('grunt', (c) => c.threat <= 3 && reachOf(c) !== 'calls');
    take('harrier', (c) => c.threat <= 3 && reachOf(c) !== 'calls' && reachOf(c) !== reachOf(cast.grunt.c));
    take('elite', (c) => c.threat >= 2);
    take('boss', (c) => c.threat >= 3);
  }

  // (a people's RANK AND FILE stands at its lineage's smallest build, its elite and its boss at their own roll grown by
  // their rank: the goblin under the orc. A person dressed as a crew takes its build from its dress)
  const small = people && !F && LINEAGES[people]?.builds?.length ? [...LINEAGES[people].builds].sort((a, b) => HEIGHT[a] - HEIGHT[b])[0] : null;
  const bossRank = ['miniboss', 'boss'].includes(mind.rank) ? mind.rank : 'boss';
  const skill = mind.skill && mind.skill !== 'regular' ? mind.skill : null;
  const foes = {}, roles = [];
  // (said in the roles' order of record, whichever was cast first)
  for (const [role, x] of Object.keys(ROLES).filter((r) => cast[r]).map((r) => [r, cast[r]])) {
    const rank = role === 'boss' ? bossRank : ROLES[role].rank;
    const file = rank === 'minion' && small && fitOfPeople(x.c.id, { people, facets: { build: small } }).ok ? { facets: { build: small } } : {};
    // (a people that swings a blow carries its lineage's arm: PEOPLE_ARMS; a dressed person carries its crew's kit)
    const arm = !F && x.c.attack.kind === 'strike' ? PEOPLE_ARMS[people]?.[rank === 'minion' ? 'file' : 'lead'] : null;
    const armed = arm ? { gear: { right: { ...ARMORY_ARMS[arm], laws: 2 } } } : {};
    const skin = people && fitOfPeople(x.c.id, { people }).ok ? { people, ...file, ...armed, ...(F ? { dress: { faction, kind: kindOf(role, x.c), colourway, ...(hench ?? {}) } } : {}) } : null;
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
  // (a WORLD MAP, gameworld/world-map.js: one planned map whose scenario stands each fight's foes by role, every role
  // fielded from it; its beats say where and how many)
  for (const id of mapped.filter((x) => G.levels[x].foes === undefined)) {
    levels[id] = { from: Object.keys(ROLES).filter((r) => foes[r]).flatMap((r) => [r, ...(r !== 'boss' ? variantsOf(r) : [])]) };
  }
  order.forEach((id, k) => {
    if (!open.includes(id)) return;
    // (the variants from the second level on; where the boss's is the second, from the first)
    const last = k === n - 1 && n > 1, deeper = k >= Math.min(1, Math.max(0, n - 2));
    const roles0 = last ? ['boss'] : ['grunt', 'harrier', ...(k >= Math.floor((n - 1) / 2) ? ['elite'] : []), ...(n === 1 ? ['boss'] : [])];
    const from = roles0.flatMap((r) => [r, ...(deeper && r !== 'boss' ? variantsOf(r) : [])]);
    levels[id] = { from: from.filter((r) => foes[r]), ...(last ? { count: 1, win: 'clear' } : {}) };
  });
  const patch = [{ op: 'set', path: '/foes', value: foes }, ...Object.entries(levels).map(([id, v]) => ({ op: 'set', path: `/levels/${id}/foes`, value: v }))];
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
