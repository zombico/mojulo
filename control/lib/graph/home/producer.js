/**
 * THE HOME'S PRODUCER — the seat that faces a person with a home of their own (a room to redo, a flat they just moved
 * into, a house they would build, plans to hand on, a shop to fit out), before anything is made. It asks only what they
 * alone can answer, ONE QUESTION A TURN, reads what they brought before asking anything it says (intake.js), says back
 * the rail it starts from and what it lacks (rails.js), then hands off the steps that make it.
 *
 *   what      a room, the home they have, a new house, plans to build from, or a shop? → the rail (the agent's reading)
 *   place     the plan, measurements or a photo of the room?          none: drawn from the seed
 *   living    who lives there and how?                                 bedrooms, uses, the rooms to design
 *   look      what should it feel like?                                their words; the agent names the style card
 *   brought   anything else: pictures, furniture kept, what cannot change?
 *
 * A plain ask (a rail and a look, nothing of their place, their household or their material) is made at once: nothing
 * is asked. The producer leads when they speak of their own place, their household, or bring something (`needsProducer`).
 *
 * The making is the house's and the interior's doors, built already: this names their calls and runs none. The house's
 * own machine gate (its `next` by outcome, the interior's review) is read in the steps, never solved again here. It
 * never writes what they did not say: a room they did not name is not designed, a budget is never priced.
 *
 *   HOME_QUESTIONS               the five, in order: { id, ask }
 *   readStart(v)                 → { what?, place?, living?, look?, brought? } checked; throws, teaching
 *   needsProducer(start)         → does the person speak of their own home (true), or just ask for one (false)?
 *   homeHandOff({ rail, start }) → [{ step, door?, says, … }]: the calls that make it, in order, proposed
 *   homeStart(start) → { ok, readout: 'start', built: false, says, producer: { seat, ask, step, holds } | null,
 *                        next: [{ step, ask? | read? … }], rails | rail, lacks, intake?, plain? }
 *
 * Builds nothing and stores nothing. Pure.
 */
import { HOME_RAILS, HOME_RAIL_IDS, HOME_LACKS, HOME_BRIDGES, homeRailOf } from './rails.js';
import { readHomeIntake, homeIntakeReport } from './intake.js';
import { STYLE_NAMES } from '../interior/styles.js';
import { FUNCTION_NAMES } from '../interior/functions.js';
import { HOUSE_STYLE_NAMES } from '../polygonizer/floorplan-styles.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`mint_building: start${m}`);
const line = (v) => typeof v === 'string' && !!v.trim() && v.length <= SAYS_MAX;
const SAYS_MAX = 400;

// (the ids and their order are intake.js's QUESTION_IDS: a thing brought names the questions it answers by them)
export const HOME_QUESTIONS = Object.freeze([
  Object.freeze({ id: 'what', ask: `what would you like to make: ${HOME_RAIL_IDS.map((r) => HOME_RAILS[r].name).join(', ')}?` }),
  Object.freeze({ id: 'place', ask: 'do you have the floor plan, measurements or a photo of the place? (none is fine: I will draw one)' }),
  Object.freeze({ id: 'living', ask: 'who lives there and how: how many bedrooms, working from home, children, guests, and which rooms matter most?' }),
  Object.freeze({ id: 'look', ask: 'what should it feel like, in your own words (warm, calm, bright, a look you love)?' }),
  Object.freeze({ id: 'brought', ask: 'anything else: pictures of rooms you love, furniture you are keeping, something that cannot change?' }),
]);
const KEYS = HOME_QUESTIONS.map((q) => q.id);
// (living on a shop or a café: who uses it, not who lives there)
const ASK_FOR = { 'fit-out': { living: 'what is it for and who comes: the trade, how many seats or counters, the staff behind?' } };

export const PLACE_FROM = Object.freeze({
  plan: 'a floor plan the agent reads to the inch (rooms[] / levels[], card house-layout)',
  measurements: "a room or a house by tape (section.size, or width / height in feet)",
  photo: 'a photo of the room: capture_reference recovers where its windows and doors are',
  house: 'a house already made here: its ref',
});

function readPlace(v) {
  if (v === 'none') return 'none';
  const P = typeof v === 'string' ? { from: v } : v;
  if (!isObj(P) || !PLACE_FROM[P.from]) throw fail(`.place is 'none' or { from: ${Object.keys(PLACE_FROM).join(' | ')}, ref?, size? } (a word alone is its from)`);
  for (const k of Object.keys(P)) if (!['from', 'ref', 'size', 'says'].includes(k)) throw fail(`.place.${k} is not one (from, ref, size, says)`);
  if (P.from === 'house' && (typeof P.ref !== 'string' || !P.ref)) throw fail(".place from 'house' names its ref (a mint_building row)");
  if (P.size !== undefined && (!Array.isArray(P.size) || P.size.length !== 2 || P.size.some((s) => !(typeof s === 'number' && s > 0) && !line(s)))) throw fail(".place.size is [width, depth]: feet as numbers, or with their unit ('14ft', '4.2m')");
  if (P.says !== undefined && !line(P.says)) throw fail(`.place.says is what it shows, in a line`);
  return { ...P };
}

function readLiving(v) {
  if (line(v)) return { says: v.trim() };
  if (!isObj(v) || !Object.keys(v).length) throw fail('.living is their words in a line, or { says?, beds?, uses?, rooms?, seats? }');
  for (const k of Object.keys(v)) if (!['says', 'beds', 'uses', 'rooms', 'seats'].includes(k)) throw fail(`.living.${k} is not one (says, beds, uses, rooms, seats)`);
  if (v.says !== undefined && !line(v.says)) throw fail('.living.says is their words, in a line');
  for (const k of ['beds', 'seats']) if (v[k] !== undefined && !(Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= 400)) throw fail(`.living.${k} is a count`);
  if (v.uses !== undefined && (!Array.isArray(v.uses) || v.uses.some((u) => !FUNCTION_NAMES.includes(u)))) throw fail(`.living.uses are a room's jobs: ${FUNCTION_NAMES.join(', ')}`);
  if (v.rooms !== undefined && (!Array.isArray(v.rooms) || !v.rooms.length || v.rooms.some((r) => !line(r)))) throw fail(".living.rooms are the rooms they named, as they said them ('the living room', 'the big bedroom')");
  return { ...v };
}

function readLook(v) {
  if (line(v)) return { says: v.trim() };
  if (!isObj(v) || !Object.keys(v).length) throw fail('.look is their words in a line, or { says?, style?, accent?, house? }');
  for (const k of Object.keys(v)) if (!['says', 'style', 'accent', 'house'].includes(k)) throw fail(`.look.${k} is not one (says, style, accent, house)`);
  for (const k of ['style', 'accent']) if (v[k] !== undefined && !STYLE_NAMES.includes(v[k])) throw fail(`.look.${k} is a room's style card (your reading of their words): ${STYLE_NAMES.join(', ')}`);
  if (v.house !== undefined && !HOUSE_STYLE_NAMES.includes(v.house)) throw fail(`.look.house is a house's style family: ${HOUSE_STYLE_NAMES.join(', ')}`);
  if (v.says !== undefined && !line(v.says)) throw fail('.look.says is their words, in a line');
  return { ...v };
}

export function readStart(v) {
  if (!isObj(v)) throw fail(` is { ${KEYS.map((k) => `${k}?`).join(', ')} }: what the person has said so far (an empty one asks the first question)`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw fail(`.${k} is not one (${KEYS.join(', ')})`);
  const out = {};
  if (v.what !== undefined) { if (!HOME_RAILS[v.what]) throw fail(`.what is the rail, your reading of what they said: ${HOME_RAIL_IDS.map((r) => `${r} (${HOME_RAILS[r].name})`).join(', ')}`); out.what = v.what; }
  if (v.place !== undefined) out.place = readPlace(v.place);
  if (v.living !== undefined) out.living = readLiving(v.living);
  if (v.look !== undefined) out.look = readLook(v.look);
  if (v.brought !== undefined) { try { readHomeIntake(v.brought); } catch (e) { throw fail(`.${e.message.replace(/^home: /, '')}`); } out.brought = v.brought; }
  return out;
}

export function needsProducer(start) {
  const S = isObj(start) ? start : {};
  return S.place !== undefined || S.living !== undefined || (S.brought !== undefined && S.brought !== 'none');
}

const styleOf = (look) => (look?.style ? { name: look.style, ...(look.accent ? { accent: look.accent } : {}) } : '<the card their words read as>');
const roomsOf = (S) => S.living?.rooms ?? null;
const placeWord = (S) => (isObj(S.place) ? S.place.from : S.place ?? 'none');

// The house's first call, from what the place is: their plan read off, a house made here, or drawn from the seed.
function houseStep(S, { seed }) {
  const from = placeWord(S);
  if (from === 'house') return { step: 'house', door: 'none: it is made', ref: S.place.ref, says: 'their house is made already: read it (its page, its `next`) before anything is changed' };
  if (from === 'plan') return { step: 'house', door: "mint_building({ title, manifest: { width, height, rooms: [{ x, y, w, h, glyph }], windows: true, furnish: true, view: 'cutaway' } })", card: 'house-layout', says: 'their plan built to the inch: write each room off it (its size in feet, its glyph by what it is), the doors and windows it shows. Never a room the plan does not have' };
  if (from === 'measurements') return { step: 'house', door: 'mint_building({ title, manifest: { width, height, windows: true, furnish: true } })', card: 'house-layout', says: 'the footprint at their measurements; the plan drawn inside it, and shown to them before any room is designed' };
  return { step: 'house', door: `mint_building({ title, manifest: { ${seed} } })`, card: 'house-concept', says: 'drawn from the seed: what the mint inferred is in the reply\'s `inferred`, said back to them' };
}

const READ = { step: 'read', door: 'the reply\'s `next` (by outcome) and its `notAHome`', says: 'the house\'s own machine gate: fix what their plan really has with update_sketch (a window, a door, a stair), never invent a room; a walkway finding is `design: { repair: true, clearance: true }`' };
const REVIEW = { step: 'review', door: 'the reply\'s `refused`, `gaps` and `review`', says: 'what the solver could not place and why, said plainly; a piece moved or swapped by its id (`pieces: [{ id, at, facing, size, like, omit }]`), three rounds at most, then shown' };
const SHOW = (rail) => ({ step: 'show', says: `the first look: ${rail.first}. The eyes gate is theirs, never claimed; each change they ask for is a revision in place by ref, never a new one` });

/**
 * THE HAND-OFF: where the producer's work ends and the making begins. The calls that make it, in order, with what was
 * said filled in and the rest marked as the agent's reading. It PROPOSES: nothing is run.
 */
export function homeHandOff({ rail: id, start }) {
  const rail = homeRailOf(id), S = start ?? {};
  const style = styleOf(S.look), brief = S.living?.uses ? { uses: S.living.uses } : '<their uses, read from how they live>';
  const designRoom = (room, house = 'ref') => ({ step: 'room', room, door: `design_interior({ title, house: ${house}, room: '${room}', style, brief })`, style, brief, says: `${room === '<room>' ? 'each room they named' : room}: its jobs solved into furniture at true size, in a style read from their words (an accent beside it is fine), the walkways kept clear` });
  const rooms = roomsOf(S) ?? ['<room>'];
  const steps = [];
  if (id === 'room') {
    const from = placeWord(S);
    if (from === 'house') steps.push(designRoom(rooms[0], `'${S.place.ref}'`));
    else if (from === 'plan') { steps.push(houseStep(S, {}), READ, designRoom(rooms[0])); }
    else steps.push({ step: 'room', room: rooms[0], door: "design_interior({ title, section: { room, size: [w, d], windows: ['S'], doors: [{ wall, to }] }, style, brief })", style, brief, says: `the room from scratch: its size${S.place?.size ? ` (${S.place.size.join(' by ')})` : ' (ask it if no measurement or photo says it)'}, the walls its windows and doors are on; its house is drafted and minted first` });
    steps.push(REVIEW, { step: 'before-after', door: 'forge_motion({ title, subject: { world_ref: <room ref> } }) before a change and again after it', says: 'a change they asked for shown before and after from eye height: the revision is in place at the same ref, so the before is shot first' }, SHOW(rail));
  } else if (id === 'move-in') {
    steps.push(houseStep(S, { seed: 'seed, tier, storeys, windows: true, furnish: true' }), READ);
    for (const r of rooms) steps.push(designRoom(r));
    steps.push(REVIEW,
      { step: 'walk', door: "forge_motion({ title, subject: { world_ref: <room ref> }, shot: { motion: 'orbit' }, export: 'mp4' }) a room each, then stitch_motion({ title, clips })", card: 'world (get_motion_vocab)', says: 'a walkthrough of the rooms they named, one clip a room, stitched in the order they walk them' },
      SHOW(rail));
  } else if (id === 'new-house') {
    const beds = S.living?.beds;
    steps.push(houseStep(S, { seed: `seed, tier: { base: 'cottage' | 'house' | 'villa'${beds ? `, beds: ${beds}` : ''} }, storeys, style${S.look?.house ? `: '${S.look.house}'` : ''}, roof: { style }, perimeter: true, windows: true, furnish: true` }), READ,
      { step: 'revise', door: 'update_sketch({ ref, patch }) for each change they ask for · run_experiment_sweep( … ) for several massings side by side', says: 'the recipe is a starter, changed in place, never re-minted; a sweep only if they want to compare' },
      ...(roomsOf(S) ? roomsOf(S).map((r) => designRoom(r)) : []),
      { step: 'walk', door: "the house's page (its Walk tab at eye height) · forge_motion({ title, subject: { world_ref: ref } }) for a turntable or a flythrough · export_model({ ref, format: 'glb' })", says: 'the house as they would walk it' },
      SHOW(rail));
  } else if (id === 'plans') {
    steps.push(houseStep(S, { seed: 'seed, tier, storeys, roof: { style }' }), READ,
      { step: 'frame', door: "update_sketch({ ref, patch }) setting framing: { system: 'platform' } (with levels: [{ index: 0 }]), drainage: true, roof.covering: true", card: 'house-build', says: 'the frame, the wiring roughed in, the roof drained and laid: the takeoff and cut list come with it' },
      { step: 'drawings', door: "export_model({ ref, format: 'sheets' }) · ({ format: 'schedules' }) · ({ format: 'ifc' })", card: 'house-drawings', says: 'the drawing set as sheets, every schedule as CSV and JSON, the house as IFC4 for an architect\'s software' },
      { step: 'checks', door: 'the structure book\'s Checks tab', says: 'what the book advises, said as advice: it is no permit and no engineer\'s sign-off' },
      SHOW(rail));
  } else {
    steps.push({ step: 'building', door: "mint_building({ title, manifest: { kind: 'store', card } | { kind: 'restaurant', seed } })", card: 'building-commercial', says: 'the shop or the café read by what it is for: its rooms by role, its program graded' },
      { step: 'read', door: 'the reply\'s `grade` and its `findings`', says: 'its program\'s findings in words, mended with update_sketch, never waved away' },
      { step: 'schedules', door: "export_model({ ref, format: 'schedules' }) · ({ format: 'sheets' })", says: 'its furniture and fixtures scheduled, the drawing set' },
      SHOW(rail));
  }
  steps.push({ step: 'offer', says: 'once they have seen it, and only once: where it can go next', bridges: HOME_BRIDGES });
  return steps;
}

const HOLDS = 'one question a turn: ask this, wait for the answer, call again with what they said; write nothing for them';

export function homeStart(start) {
  const S = readStart(start ?? {});
  const rail = S.what ? homeRailOf(S.what) : null;
  const asks = ['what', ...(rail ? rail.asks : [])];
  // (in the rail's own order: a new house asks how they live before where it sits)
  const open = asks.map((id) => HOME_QUESTIONS.find((q) => q.id === id)).filter((q) => S[q.id] === undefined).map((q) => ({ ...q, ask: ASK_FOR[S.what]?.[q.id] ?? q.ask }));
  // (what they brought, intake.js: a question their own material answered is never asked: it is READ, the agent writing
  // the answer from the item and calling again with it)
  const intake = homeIntakeReport(S.brought);
  const read = (q) => (intake && !intake.none ? intake.answered[q] ?? null : null);
  const leads = needsProducer(S);
  // a bare ask (a rail and a look, nothing of their place, their household or their material): made at once
  const plain = !!rail && !leads;
  const next = [
    ...(plain ? [] : open.map((q) => (read(q.id) ? { step: q.id, read: read(q.id), says: `their own material says it (${read(q.id).join(', ')}): write it as \`${q.id}\` from what it says and call again; do not ask them again` } : { step: q.id, ask: q.ask }))),
    ...(rail && (plain || !open.length) ? [{ step: 'make', rail: rail.id, doors: rail.doors, cards: rail.cards, says: `Say it back first: ${rail.name} (${rail.like}), what it lacks, and the first look (${rail.first}). With their yes, read the cards, then make it by these steps`, steps: homeHandOff({ rail: rail.id, start: S }) }] : []),
  ];
  const lead = next.find((s) => typeof s.ask === 'string');
  return {
    ok: true, readout: 'start', built: false,
    says: plain
      ? `Nothing is made yet. A plain ask is made at once by its door (${rail.doors[0]}): no questions. If it is their own place (their plan, their household, things they keep), you are its PRODUCER: call again with what they said.`
      : 'Nothing is made yet. You are this home\'s PRODUCER: the place and the life in it are theirs; ask only what they alone can answer, one question a turn (`producer.ask`), read what they bring before asking, then say back the rail and what it lacks before anything is made.',
    producer: lead ? { seat: 'producer', ask: lead.ask, step: lead.step, holds: HOLDS } : null,
    next,
    ...(rail ? { rail: { id: rail.id, name: rail.name, like: rail.like, outcomes: rail.outcomes, first: rail.first } } : { rails: HOME_RAIL_IDS.map((r) => ({ id: r, name: HOME_RAILS[r].name, like: HOME_RAILS[r].like })) }),
    lacks: HOME_LACKS,
    ...(intake ? { intake } : {}),
    ...(plain ? { plain: true } : {}),
  };
}
