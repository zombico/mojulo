/**
 * THE FOLK'S LINES: what a person says when the player talks to them. Not the story: chitchat and a service's own talk,
 * written from a line book by what the person is (their role, their service, their age, their temperament), who they
 * live with (domicile.js) and what their town is (its size, its open needs). The plot is never written here: a quest
 * giver's lines, a scene's, anything that moves the game on, stay slots (`placeholderLine`, Time's) for the operator.
 *
 *   linesFor(person, folk, { say? })   → { speaker, lines: [text, …] } the person's talk, seeded by their path
 *     say   the operator's words, by a person's path or a role: they replace the book's
 *   speakerOf(person)                  → the name the talk box shows (a recurring person's name, 'Keeper', 'Villager', 'Child')
 *   LINE_BOOK                          the book: greetings by temperament, a word on their work by role, on their house
 *                                      by its shape, on the town by its size and by what it is missing, a farewell
 *
 * Every line is picked on the person's own die (their path), so the same town says the same things, and a person's
 * lines never move when another's do. English: a world in another locale hears these until the book is in the
 * catalogs (a gap, said on the sheet).
 */
import { mulberry32 } from '../vegetation/grow.js';

const hash = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const F = (o) => Object.freeze(o);

export const LINE_BOOK = F({
  // how they meet a stranger: the archetype's light, or its shadow (egocube.js reading)
  greeting: F({
    light: F(['Morning to you.', 'Oh, hello there.', 'Welcome, traveller.', 'A new face! Good.', 'Well met.', 'Hello, friend.']),
    turning: F(['Can I help you with something?', 'You\'re not from here, are you?', 'Hm? Oh, hello.', 'Yes?']),
    shadow: F(['What do you want?', 'Make it quick.', 'I don\'t know you.', 'You\'re in my way.']),
    child: F(['Hi!', 'Are you an adventurer?', 'Hello! What\'s that you\'re carrying?', 'I\'m not supposed to talk to strangers. Hi.']),
  }),
  // a word on what they do, by role
  work: F({
    townie: F(['It\'s a quiet life here, and that suits me.', 'I keep the house and the garden. Plenty to do.', 'Market days are the best days.', 'The road brings all sorts through here.']),
    keeper: F(['Fair prices and honest weights, always.', 'Business is steady, thank the roads.', 'If you need something I don\'t have, ask. I might know who does.', 'Everything here was made or grown nearby.']),
    master: F(['Mind the sparks.', 'Good work takes time. Bad work takes longer.', 'There\'s always something that needs mending.', 'My hands know this trade better than my head does.']),
    apprentice: F(['I\'m learning the trade. Slowly.', 'The master says I\'m getting better. I think.', 'One day this bench will be mine.']),
    farmhand: F(['The fields don\'t tend themselves.', 'Rain\'s coming, I can feel it.', 'Up before the sun, every day.', 'Good soil here. Good soil.']),
    elder: F(['I\'ve seen this village through good years and lean ones.', 'Everyone here comes to the hall sooner or later.', 'We look after our own.', 'Sit a while, if you have the time.']),
    captain: F(['Keep your weapons sheathed in town and we\'ll get along.', 'The watch keeps the peace here.', 'Quiet days are the ones we work hardest for.']),
    watch: F(['All quiet.', 'Move along, nothing to see.', 'I\'ve got the night watch again.', 'Stay out of trouble.']),
    child: F(['Want to see how fast I can run?', 'I found a beetle this big yesterday.', 'Nothing ever happens here.', 'I\'m going to be a hero when I grow up.']),
  }),
  // a word on their house, by its shape (domicile.js)
  house: F({
    alone: F(['It\'s just me at home. I like the quiet.', 'I live on my own. Suits me fine.']),
    couple: F(['My partner\'s about somewhere.', 'We\'ve been here together a long while now.']),
    family: F(['The children keep us busy.', 'Mine are around here somewhere, getting into something.']),
    single: F(['It\'s just me and the little ones.', 'Raising them on my own. We manage.']),
  }),
  // a word on the town, by its size (out-town.js HEARTBEATS)
  town: F({
    hamlet: F(['Everyone knows everyone here.', 'Not much of a place, but it\'s ours.']),
    village: F(['It\'s a good village. Mostly.', 'News travels fast in a place this size.']),
    market: F(['Market\'s the heart of this town.', 'Busy town, this. Always someone coming or going.']),
    burgh: F(['The walls keep us safe, and keep us close.', 'So many people. I still get lost in the lanes.']),
  }),
  // a word on what the town is missing (folk.js needs): its open needs said aloud, by the one who has the need (`own`)
  // or second-hand by anyone else (`about`)
  need: F({
    supplier: F({ own: F(['Hard to stock a shop when nobody round here grows or makes much.']), about: F(['The shop\'s shelves are thin. Nobody round here makes enough to sell.']) }),
    buyer: F({ own: F(['Good work, and nowhere to sell it. Shame.']), about: F(['The workshop turns out good things, and no one sells them.']) }),
    market: F({ own: F(['Crops to sell and no market to sell them at.']), about: F(['The farms have more than they can sell here.']) }),
    'answers-to': F({ own: F(['The watch has no one to answer to here. Makes you wonder.']), about: F(['The watch answers to no one here. Makes some folk uneasy.']) }),
    village: F({ own: F(['A hall with hardly anyone to gather in it.']), about: F(['The hall stands half empty most days.']) }),
    provisions: F({ own: F(['Nobody here sells anything. We trade over the fence.']), about: F(['Nobody here sells anything. Folk trade over the fence.']) }),
  }),
  // one met in every town (folk.js RECURRING): the family likeness, said for them
  recurring: F(['You look like you\'ve met my cousin.', 'Everyone says I look just like someone in the last town.', 'Family resemblance. We get that a lot.', 'My sister works the same job, two towns over.']),
  farewell: F({
    light: F(['Safe travels.', 'Take care of yourself.', 'Come back any time.', 'Good luck out there.']),
    turning: F(['Right then.', 'Off you go.', 'See you around.']),
    shadow: F(['Finally.', 'Don\'t come back.', 'Go on.']),
    child: F(['Bye!', 'Come back and play!', 'Bye bye!']),
  }),
});

/** The name the talk box shows. */
export const speakerOf = (p) => p.name ?? (p.sheet.facets.age === 'child' ? 'Child' : p.role === 'townie' ? 'Villager' : p.title);

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
// the person's temper for the book: a child's own, else the archetype's reading (light, turning, shadow)
const temperOf = (p) => (p.sheet.facets.age === 'child' ? 'child' : p.sheet.reading?.reads === 'shadow' ? 'shadow' : p.sheet.reading?.reads === 'turning' ? 'turning' : 'light');

export function linesFor(person, folk, { say } = {}) {
  const speaker = speakerOf(person);
  const own = say?.[person.path] ?? say?.[person.role];
  if (own !== undefined) return { speaker, lines: [].concat(own), said: true };
  const rand = mulberry32(hash(`${folk.seed}::lines::${person.path}`));
  const temper = temperOf(person), child = temper === 'child';
  // every die is thrown whether its line is used or not, so one line's rule never moves another's pick
  const greet = pick(rand, LINE_BOOK.greeting[temper]);
  const work = pick(rand, LINE_BOOK.work[child ? 'child' : person.role] ?? LINE_BOOK.work.townie);
  const home = folk.domiciles?.find((d) => d.dweller === person.path);
  const houseLine = home ? pick(rand, LINE_BOOK.house[home.shape]) : (rand(), null);
  const open = (folk.needs ?? []).filter((n) => !n.met);
  const need = open.length ? open[Math.floor(rand() * open.length)] : (rand(), null);
  const needLine = need ? pick(rand, LINE_BOOK.need[need.need][need.role === person.role ? 'own' : 'about']) : (rand(), null);
  const townLine = folk.heartbeat && LINE_BOOK.town[folk.heartbeat] ? pick(rand, LINE_BOOK.town[folk.heartbeat]) : (rand(), null);
  const bye = pick(rand, LINE_BOOK.farewell[temper]), coin = rand();
  // what they say past their work: their house if they keep one, else what the town lacks, else the town itself;
  // a child says nothing of either
  const kin = pick(rand, LINE_BOOK.recurring);
  const middle = person.recurring ? kin : child ? null : houseLine && coin < 0.5 ? houseLine : needLine || townLine || houseLine;
  return { speaker, lines: [greet, work, ...(middle ? [middle] : []), bye] };
}
