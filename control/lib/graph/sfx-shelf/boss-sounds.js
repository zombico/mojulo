/**
 * sfx-shelf/boss-sounds — a boss fight heard, for every boss on the director (boss/: its moves as patterns, each a
 * wind-up told and a strike that lands), and what a metroidvania's held gates do (a boss's room shut and opened, a gate
 * broken by what opens it, a secret wall struck down). Every answer is a shelf word (roster.js); the new ones are
 * `recorded` rows (BOSS_ROWS) heard as their `standIn` until the sound library records them.
 *
 *   BOSS_PATTERN_SOUNDS   pattern → { tell, strike }: the wind-up as it is told, the strike as it lands (a new pattern is a row)
 *   BOSS_VOICE_EVENTS     what a boss's VOICE says: `roar` (it wakes, its phase turns, its second form rises), `hurt` (struck,
 *                         held apart), `fall` (its last form down): its class's alert, hurt and death (animal-voices.js)
 *   BOSS_SHARED           what every boss shares: `shed` (a form cut down into its next), `fall` (its body felled)
 *   GATE_SOUNDS           a held gate's moments: `shut` (a boss's room barred), `open` (barred no more), and a break by its
 *                         gate's kind (a cracked wall, a secret wall, a grate, a lock, a boss's seal); `break` any other wall
 *   BOSS_VOICE_OF         a boss's figure by what it is → its voice class: a people's (animal-sounds.js PEOPLE_VOICE), a
 *                         species', a dragon for a winged form (bossVoice)
 *   bossVoice({ skin?, voice?, second? }) → a voice class (animal-voices.js) or null
 *   bossSounds(own?)      → { patterns, shared, gates }: the shelf's words, a game's own over them (`own`: { patterns?:
 *                         { <pattern>: { tell?, strike? } }, shed?, fall?, gates?: { <event | kind>: word | false } })
 *
 * Pure data and pure functions; timeless.
 */
import { peopleVoice, animalVoice } from './animal-sounds.js';

const row = (id, category, family, slot, label, aliases, matter, standIn) => Object.freeze({ id, category, family, slot, label, aliases, matter, ...(standIn ? { standIn } : {}) });

export const BOSS_ROWS = Object.freeze([
  // the wind-ups: a heavy weapon drawn back, a body gathering to spring, a power gathering, a throat swelling
  row('boss-windup', 'melee', 'swing', 'on', 'a boss\'s heavy weapon drawn back: steel grinding, its weight shifting', ['boss windup', 'heavy windup', 'weapon drawn back'], ['metal'], 'swing'),
  row('boss-crouch', 'movement', null, 'on', 'a boss gathering to spring: claws scraping stone, a body coiling low', ['boss crouch', 'gathers to spring'], ['stone', 'creature'], 'dodge'),
  row('boss-gather', 'magic', null, 'on', 'a boss\'s power gathering: a rising ominous hum', ['boss charge up', 'power gathering', 'ominous hum'], ['energy'], 'spell-cast'),
  row('venom-gather', 'creature', null, 'on', 'a throat swelling with venom: a wet gurgling hiss', ['venom gather', 'throat swelling'], ['water', 'creature'], 'spell-cast'),
  // the strikes
  row('boss-cleave', 'melee', 'strike', 'on', 'a huge blade cleaving down into a stone floor', ['boss cleave', 'great cleave', 'blade slams down'], ['metal', 'stone'], 'strike'),
  row('great-swing', 'melee', 'swing', 'on', 'a huge weapon swung in a wide arc: a heavy rushing whoosh', ['great swing', 'wide arc', 'scythe sweep'], ['air', 'metal'], 'swing'),
  row('boss-lunge', 'movement', null, 'on', 'a great body lunging: a rush of air, its feet pounding stone', ['boss lunge', 'boss rush', 'boss charge'], ['air', 'stone'], 'dodge'),
  row('tail-sweep', 'melee', 'swing', 'on', 'a heavy tail sweeping across a stone floor', ['tail sweep', 'tail lash'], ['flesh', 'stone'], 'swing'),
  row('great-bell-toll', 'world', null, 'on', 'a great cracked bronze bell tolling, its ring sweeping out', ['bell toll', 'great bell', 'knell'], ['metal'], 'boxing-bell'),
  row('shockwave', 'explosion', null, 'on', 'a shockwave pulsing out: a deep thump and a rushing ripple', ['shockwave', 'pulse wave', 'ring wave'], ['air', 'energy'], 'grenade-blast'),
  row('falling-debris', 'world', null, 'on', 'stones and debris crashing down from above', ['falling debris', 'rocks falling', 'ceiling falls'], ['stone'], 'stone-impact'),
  // what every boss shares
  row('boss-transform', 'magic', null, 'on', 'a boss rising into its second form: a surge of dark power, flesh and bone wrenching', ['boss transform', 'second form', 'true form'], ['energy', 'creature'], 'curse'),
  row('boss-collapse', 'explosion', 'death', 'on', 'a great body collapsing: a heavy crash and its bulk crumbling away', ['boss collapse', 'boss falls', 'giant falls'], ['stone', 'flesh'], 'big-explosion'),
  // the held gates
  row('portcullis-rise', 'world', 'door', 'on', 'an iron portcullis winched up: chains rattling, iron grinding', ['portcullis rise', 'gate rises', 'bars lift'], ['metal'], 'portcullis'),
  row('wall-crumble', 'world', null, 'on', 'a cracked wall struck down: stone bursting and tumbling', ['wall crumble', 'cracked wall breaks', 'wall broken'], ['stone'], 'stone-break'),
  row('secret-wall', 'world', null, 'on', 'a secret wall broken: a hollow crack and stones falling away into a hidden space', ['secret wall', 'hidden wall', 'false wall'], ['stone'], 'stone-break'),
  row('grate-open', 'world', 'door', 'on', 'an iron grate scraped aside', ['grate open', 'grate', 'iron grate'], ['metal'], 'metal-creak'),
  row('seal-break', 'magic', null, 'on', 'a magic seal shattering: a crack of light and a falling shimmer', ['seal break', 'seal shatters', 'ward breaks'], ['energy', 'glass'], 'shield-break'),
]);

const pair = (tell, strike) => Object.freeze({ tell, strike });
export const BOSS_PATTERN_SOUNDS = Object.freeze({
  cleave: pair('boss-windup', 'boss-cleave'),
  scythe: pair('boss-windup', 'great-swing'),
  quake: pair('boss-windup', 'ground-crack'),
  boulder: pair('boss-windup', 'stone-impact'),
  toss: pair('boss-windup', 'stone-impact'),
  lunge: pair('boss-crouch', 'boss-lunge'),
  charge: pair('boss-crouch', 'boss-lunge'),
  coil: pair('boss-crouch', 'tail-sweep'),
  swoop: pair('wings-heavy', 'boss-lunge'),
  dive: pair('wings-heavy', 'ground-crack'),
  toll: pair('boss-gather', 'great-bell-toll'),
  ring: pair('boss-gather', 'shockwave'),
  rain: pair('boss-gather', 'falling-debris'),
  lances: pair('boss-gather', 'stone-rise'),
  volley: pair('boss-gather', 'arrow-volley'),
  venom: pair('venom-gather', 'poison-bolt'),
  sweep: pair('boss-gather', 'beam-cannon-shot'),
  fan: pair('boss-gather', 'shoot'),
  barrage: pair('boss-gather', 'shoot'),
  grid: pair('boss-gather', 'explosion'),
  lock: pair('lock-on', 'explosion'),
  strafe: pair('lock-on', 'machine-gun-shot'),
  kamehameha: pair('beam-charge', 'beam-charged-shot'),
});
export const BOSS_PATTERN_IDS = Object.freeze(Object.keys(BOSS_PATTERN_SOUNDS));
export const BOSS_VOICE_EVENTS = Object.freeze({ roar: 'alert', hurt: 'hurt', fall: 'death' });
export const BOSS_SHARED = Object.freeze({ shed: 'boss-transform', fall: 'boss-collapse', wake: 'boss-appear' });
export const GATE_SOUNDS = Object.freeze({ shut: 'portcullis', open: 'portcullis-rise', break: 'stone-break', 'wall-break': 'wall-crumble', secret: 'secret-wall', form: 'grate-open', key: 'key-unlock', boss: 'seal-break' });
export const GATE_EVENTS = Object.freeze(Object.keys(GATE_SOUNDS));

/** A boss's voice class (animal-voices.js): its own `voice`, else its people's, its species', a winged second form a dragon's. */
export function bossVoice({ skin = null, voice = null, second = false } = {}) {
  if (typeof voice === 'string' && voice) return voice;
  if (second) return 'dragon';
  if (skin && typeof skin === 'object') return peopleVoice(skin.people) ?? (skin.species ? animalVoice(String(skin.species)) : null) ?? (skin.animal ? animalVoice(String(skin.animal)) : null);
  return null;
}

/** The boss kit's words, a game's own over them. */
export function bossSounds(own = null) {
  const O = own && typeof own === 'object' ? own : {};
  const patterns = Object.fromEntries(Object.entries(BOSS_PATTERN_SOUNDS).map(([p, S]) => [p, { ...S, ...(O.patterns?.[p] ?? {}) }]));
  const pick = (base, o) => Object.fromEntries(Object.entries({ ...base, ...(o ?? {}) }).filter(([, w]) => w !== false));
  return { patterns, shared: pick(BOSS_SHARED, { ...(O.shed !== undefined ? { shed: O.shed } : {}), ...(O.fall !== undefined ? { fall: O.fall } : {}) }), gates: pick(GATE_SOUNDS, O.gates) };
}
