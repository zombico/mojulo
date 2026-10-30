/**
 * THE CAST SHEET'S READ — a world's bestiary read once into what its cast sheet (foe-cast-html.js, `/bible?book=foes`)
 * shows: each foe the world fields as a card, its tier, its stats in the words of the game's flavor, its mind as the Mind
 * gem resolves it on its body, its shelves (modes, states, death, relations), where it stands and what an engine keeps.
 * Nothing is computed here that the resolver (foes/resolve.js) and the bestiary (foes.js) do not already say: this reads.
 *
 *   foeCastOf(world)    → { G, register, flavor, words, tiers, foes, hero, from } or null (the world fields no foe and keeps no
 *                         bestiary): `foes` [card], in the bestiary's order, the fielded first; `tiers` [{ rank, name, ids }]
 *                         minion first; `words` the flavor's stat words (STAT_WORDS) and the register's (REGISTER_WORDS)
 *   castable(world)     → the world keeps a bestiary or a level stands foes (the sheet has a cast to show)
 *   foeParts(world, cast?)   → the sheet's parts for the gate (review.js): `foes:cast` (who stands where) and
 *                         `foes:<id>` for each foe (its words and its death), each with its print
 *   foeState(world, { cast? })   → each part's stamp, the machine gate the resolver's advisories on each foe
 *   approveFoe(world, part, note?)   → the review entry to write for the creator's approval of a part
 *   STAT_WORDS          per flavor (juice-style.js JUICE_FLAVORS): how a foe's toll is said in that game type
 *   REGISTER_WORDS      per register (anime | western): the sheet's title and each rank's tier
 *
 * A card: { id, name, class, reads, rank, skill, tier, skin: { kind, says }, element?, stats, attack, mind, modes, states,
 *   death, relations, levels, fielded, status, marks, advisories, figure }. `figure` the step a run makes its figure at
 *   (`foes-<id>`, runner.js), or a model's own ref; null for a mode or a relation a level never reaches.
 *
 * Pure and deterministic: no dice.
 */
import { readGameworld } from './world.js';
import { fingerprint, checkReviewEntry, stampPart, MODES, FOE_CAST_PART } from './review.js';
import { bestiaryOf, fieldedIds, modeChain, readLevelFoes, SUMMON, isModel, isPeople, isDressed } from './foes.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { vanishOf, VANISHES } from './vanish.js';
import { juiceOfGame, juiceSuggestion } from './juice.js';
import { settingOfGame } from './cast-setting.js';
import { flavorFor } from './feel/flavor.js';
import { QUICK_GENRE } from './intent.js';
import { foeClass } from '../foes/index.js';
import { MOVES, ATTACKS, STOMPS, PACES, HERO } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { FOE_STATES } from '../foes/states.js';
import { MOTIVATIONS, AGGRESSIVENESS, RANKS, SWITCHES, SIGHTS, GAZES, COVER, SITUATIONS } from '../mind/vocab.js';
import { JUICE_FLAVORS, JUICE_REGISTERS } from '../scene/juice-style.js';

const FPS = 60;
const r2 = (v) => Math.round(v * 100) / 100;
const words = (id) => id.replace(/-/g, ' ');
// the entry as the foe resolver takes it (foes.js specOf)
const specOf = ({ class: c, rank, skill, skin }) => ({ class: c, ...(rank !== undefined ? { rank } : {}), ...(skill !== undefined ? { skill } : {}), ...(skin !== undefined ? { skin } : {}) });

/**
 * How a game type says a foe's toll. `downs` the blows of the hero's it takes, `harm` the hits of the hero's it costs
 * (vocab.js HERO: a blow is 20 of a foe's health, a hit 10 of the hero's 100); `health` true where the game shows the
 * numbers themselves (a realistic game's health and damage), false where it counts.
 */
export const STAT_WORDS = Object.freeze({
  realistic: { downs: 'health', harm: 'damage a hit', health: true, pace: 'speed', telegraph: 'wind-up' },
  action: { downs: 'blows to down', harm: 'hits it lands', health: false, pace: 'speed', telegraph: 'tell' },
  platformer: { downs: 'bops to down', harm: 'hearts a touch costs', health: false, pace: 'pace', telegraph: 'tell' },
  pinball: { downs: 'hits to pop', harm: 'knocks it deals', health: false, pace: 'pace', telegraph: 'tell' },
});
/** How a register names the sheet and the ranks it tiers the cast by (mind/vocab.js RANKS, least first). */
export const REGISTER_WORDS = Object.freeze({
  anime: { title: 'Enemy roster', lede: 'who stands against the hero, by tier', tiers: { minion: 'Mobs', elite: 'Elites', miniboss: 'Mid-bosses', boss: 'Bosses' } },
  western: { title: 'Bestiary', lede: 'what the hero will meet, field guide first', tiers: { minion: 'Rank and file', elite: 'Veterans', miniboss: 'Lieutenants', boss: 'The big bad' } },
});
for (const k of Object.keys(JUICE_FLAVORS)) if (!STAT_WORDS[k]) throw new Error(`foe-cast: no stat words for the flavor '${k}'`);
for (const k of Object.keys(JUICE_REGISTERS)) if (!REGISTER_WORDS[k]) throw new Error(`foe-cast: no sheet words for the register '${k}'`);

/** The world keeps a bestiary, or a level stands foes. */
export function castable(world) {
  const G = readGameworld(world);
  return G.foes !== undefined || G.ids.some((id) => G.levels[id].foes !== undefined);
}

/** The game's register and flavor as its effects are drawn (juice.js: its word or what 'auto' would lay). */
export function castStyleOf(G) {
  const J = juiceOfGame(G) ?? juiceSuggestion(G);
  if (J) return { register: J.fxStyle.register, flavor: J.fxStyle.flavor, from: J.why };
  // (juice: false: the register its tradition is, the flavor its genre asks for)
  const t = settingOfGame(G).tradition, genre = G.intent?.from ?? (G.quick?.goal ? QUICK_GENRE[G.quick.goal] : null), F = flavorFor({ genre });
  return { register: JUICE_REGISTERS[t] ? t : 'anime', flavor: F.flavor, from: `drawn plainly; ${F.why}` };
}

function skinOf(entry, f) {
  if (isModel(entry)) return { kind: 'model', says: `a model made elsewhere (${entry.skin.meshRef}), stood ${entry.skin.height ?? 1.8} m` };
  if (isDressed(entry)) {
    const D = entry.skin.dress, S = GRUNT_STYLES[D.faction], cw = D.colourway ?? Object.keys(S.colourways)[0];
    return { kind: 'people', dress: { ...D, colourway: cw }, says: `a person dressed as the ${S.name.toLowerCase()}'s ${D.kind ?? 'crew'}, ${S.colourways[cw].reads}${D.kind ? `: ${S.kinds[D.kind].reads.replace(/^the [a-z ]+: /, '')}` : ''}${entry.skin.facets?.pole ? `, ${entry.skin.facets.pole}` : ''}` };
  }
  if (isPeople(entry)) return { kind: 'people', says: `${entry.skin.people === 'human' ? 'a person' : `${entry.skin.people} folk`}${entry.skin.facets ? `, ${Object.entries(entry.skin.facets).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}` };
  const own = entry.skin?.species !== undefined;
  return { kind: 'beast', says: `${words(f.body.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase())}${f.skin.ooze ? ` grown by ${[].concat(f.skin.ooze).map((o) => (typeof o === 'string' ? o : o.id ?? 'an ooze')).join(', ')}` : ''}${own ? '' : ' (its class\'s stand-in)'}` };
}

function statsOf(f, c, W) {
  const speed = c.pace ? r2(PACES[c.pace] * HERO.run) : 0;
  return {
    downs: W.health ? f.toll.hp : f.toll.downs, harm: W.health ? f.toll.damage : f.toll.harm,
    hp: f.toll.hp, damage: f.toll.damage, pace: c.pace ?? 'still', speed, stature: f.stature, threat: f.threat,
    stomp: { word: f.stomp, says: STOMPS[f.stomp] },
  };
}

function attackOf(f) {
  const t = f.attack.timing ?? {}, W = ATTACKS[f.attack.kind];
  return {
    kind: f.attack.kind, line: W?.line ?? f.attack.kind,
    ...(t.startup !== undefined ? { telegraph: r2(t.startup / FPS) } : {}), ...(t.active !== undefined ? { active: r2(t.active / FPS) } : {}),
    ...(t.recovery !== undefined ? { recovery: r2(t.recovery / FPS) } : {}),
    ...(f.attack.reach !== undefined ? { reach: f.attack.reach } : {}), ...(f.attack.pattern ? { pattern: f.attack.pattern } : {}), ...(f.attack.zone ? { zone: f.attack.zone } : {}),
  };
}

// the Mind gem on its body: the authored axes, how it sees, what it does in each situation, how a duelist switches
function mindOf(f, c) {
  const M = f.mind.mind, own = c.mind ?? {}, lines = [];
  if (own.sight) lines.push(['sight', own.sight, SIGHTS[own.sight].line]);
  if (own.gaze) lines.push(['gaze', own.gaze, GAZES[own.gaze].line]);
  if (own.cover) lines.push(['cover', 'takes cover', COVER.line]);
  if (own.perception) lines.push(['perception', own.perception, own.perception === 'memory' ? 'remembers where it last saw the hero, and searches there' : 'sees in a cone, with a line of sight']);
  if (own.pathing) lines.push(['pathing', own.pathing, own.pathing === 'navmesh' ? 'finds its way round obstacles' : 'goes straight, sliding along walls']);
  if (MOVES[c.move].group) lines.push(['squad', 'pack', 'hunts as one pack: their sight shared, a few pressing in at a time']);
  return {
    motivation: { word: M.motivation, line: MOTIVATIONS[M.motivation] ?? '' },
    aggressiveness: { word: M.aggressiveness, line: AGGRESSIVENESS[M.aggressiveness]?.line ?? '' },
    rank: { word: M.rank, line: RANKS[M.rank].line }, skill: M.skill,
    senses: lines.map(([axis, word, line]) => ({ axis, word, line })),
    situations: Object.keys(SITUATIONS).map((s) => ({ situation: s, asks: SITUATIONS[s], does: f.mind.situations[s]?.repertoire ?? (f.mind.situations[s]?.strategy ? [f.mind.situations[s].strategy] : []), status: f.mind.situations[s]?.status ?? 'absent' })),
    switches: (f.mind.switches ?? []).map((s) => ({ word: s, line: SWITCHES[s] })),
  };
}

function relationsOf(B, id, e) {
  const out = [];
  if (e.summons) out.push({ kind: 'summons', foe: e.summons.foe, says: `calls ${e.summons.count ?? SUMMON.count} ${words(e.summons.foe)}, ${Math.min(SUMMON.at, e.summons.count ?? SUMMON.count)} at a time; ${e.summons.bound === false ? 'they fight on when it falls' : 'they fall with it'}` });
  if (e.pair) out.push({ kind: 'pair', foe: e.pair.foe, says: `stands with ${words(e.pair.foe)}: ${e.pair.cover === false ? '' : 'each covers the other reeling; '}${(e.pair.down ?? 'enrage') === 'enrage' ? 'one enrages when the other falls' : 'one keeps the other up until both are felled together'}${e.pair.swap !== undefined ? `; under ${Math.round(e.pair.swap * 100)}% one leaves and comes back` : ''}` });
  for (const [k, o] of Object.entries(B)) {
    if (o.summons?.foe === id) out.push({ kind: 'summoned', foe: k, says: `called by ${words(k)}` });
    if (o.pair?.foe === id) out.push({ kind: 'pair', foe: k, says: `stands with ${words(k)}` });
    if (o.becomes === id) out.push({ kind: 'mode-of', foe: k, says: `what ${words(k)} becomes when defeated` });
  }
  return out;
}

export function foeCastOf(world) {
  const G = readGameworld(world);
  if (!castable(G)) return null;
  const B = bestiaryOf(G), fielded = fieldedIds(G), style = castStyleOf(G);
  const W = STAT_WORDS[style.flavor] ?? STAT_WORDS.action, R = REGISTER_WORDS[style.register] ?? REGISTER_WORDS.anime;
  const levelsOf = (id) => G.ids.filter((lv) => G.levels[lv].foes !== undefined && readLevelFoes(G.levels[lv].foes, G.foes, `levels.${lv}`).from.includes(id));
  const made = world.made ?? {};
  // the fielded first, in the bestiary's order; then the rest of the bestiary (kept, never stood)
  const order = [...fielded, ...Object.keys(B).filter((id) => !fielded.includes(id))];
  const foes = order.map((id) => {
    const e = B[id], c = foeClass(e.class), f = resolveFoe(specOf(e));
    const states = Object.entries(e.states ?? {}).map(([name, s]) => ({ name, reads: FOE_STATES[name].reads, ...(s.color ? { color: s.color } : {}), elemental: s.elemental === true }));
    const element = states.find((s) => s.elemental) ? FOE_STATES[states.find((s) => s.elemental).name].element : null;
    const V = vanishOf(G, e), chain = modeChain(B, id);
    return {
      id, name: words(id), class: c.id, reads: c.reads, rank: f.rank, skill: f.skill, tier: R.tiers[f.rank],
      skin: skinOf(e, f), ...(element ? { element } : {}),
      stats: statsOf(f, c, W), attack: attackOf(f), mind: mindOf(f, c),
      modes: chain.length > 1 ? chain : [], states,
      death: { is: V.is, die: V.die, says: `${V.die === 'launch' ? 'thrown back along the blow' : V.die === 'fall' ? 'falls' : V.die === 'dismantle' ? 'comes apart at its joints' : V.die === 'cleave' ? 'is cut through' : 'is destroyed as the blow chooses'}, then ${VANISHES[V.is]}` },
      relations: relationsOf(B, id, e), levels: levelsOf(id), fielded: fielded.includes(id),
      status: f.status, marks: f.marks, advisories: f.advisories,
      figure: isModel(e) ? e.skin.meshRef : made[`foes-${id}`]?.ref ?? null,
    };
  });
  const tiers = Object.keys(RANKS).map((rank) => ({ rank, name: R.tiers[rank], ids: foes.filter((x) => x.rank === rank).map((x) => x.id) })).filter((t) => t.ids.length);
  return { G, register: style.register, flavor: style.flavor, from: style.from, words: { ...W, ...R }, tiers, foes, hero: { height: HERO.height, hp: HERO.hp } };
}

/** The cast sheet's parts: the cast as a whole, then each foe. A world with nothing to cast has none. */
export function foeParts(world, C = foeCastOf(world)) {
  if (!C) return [];
  const B = bestiaryOf(C.G);
  const parts = [{ id: FOE_CAST_PART, name: 'The cast', content: { foes: C.foes.map((x) => ({ id: x.id, fielded: x.fielded, levels: x.levels })), register: C.register, flavor: C.flavor } }];
  // (a world fielding the stand-ins keeps no bestiary: the cast is its one part)
  if (C.G.foes) for (const x of C.foes) parts.push({ id: `foes:${x.id}`, name: x.name, content: { entry: B[x.id], death: x.death } });
  return parts.map((p) => ({ ...p, print: fingerprint(p.content) }));
}

export function foeState(world, { cast } = {}) {
  const C = cast ?? foeCastOf(world), parts = foeParts(world, C), review = world.review ?? {}, mode = world.mode ?? 'gated';
  if (!MODES[mode]) throw new Error(`gameworld: mode is ${Object.keys(MODES).join(' or ')}`);
  const laws = Object.fromEntries((C?.foes ?? []).map((x) => [`foes:${x.id}`, [...x.advisories, ...(x.status !== 'built' ? [`its class is ${x.status}`] : [])]]));
  for (const p of parts) if (review[p.id] !== undefined) checkReviewEntry(p.id, review[p.id]);
  return parts.map((p) => stampPart(p, review[p.id], mode, laws[p.id] ?? []));
}

export function approveFoe(world, part, note) {
  const p = foeParts(world).find((x) => x.id === part);
  if (!p) throw new Error(`gameworld: '${part}' is not a part of the cast sheet`);
  return { ...(world.review ?? {}), [part]: { status: 'approved', print: p.print, ...(note ? { note } : {}) } };
}
