/**
 * PARTY — the characters who join the pilot. A member is one of the level's entities, run by the escort motive
 * (worlds/controllable/mind.js: `rule: { type: 'ai', mind: { motivation: 'escort' }, escort: '<pilot id>' }`, on a team of its own): it keeps
 * near the pilot, walks back when left behind, and fights what is hittable and not of its team. Until it joins, it is
 * held where it stands, or not there at all; it joins when its flag is set here (`flag:<name>`: a scene's sets, an
 * answer) or carried in (`flag-carried:<name>`), and stays joined.
 *
 *   play.party: [{ who, joins?: '<flag>', at?: '<spot>' }]   (no joins: with the pilot from the start)
 *     at    held at that spot until it joins (a walk there, `then: stay`); without it the entity is minted asleep
 *           (`dormant: true`) and wakes where it was placed
 *
 * With `play.carry` the flag rides between levels as the scenes' flags do, so a member who joined in one level is
 * there from the start of the next.
 *
 *   readParty(play)    → [{ who, joins?, at? }] or throws, teaching
 *   partyFlags(play)   → the flags they join on
 *   partyCues(play)    → the cues: the hold at start, the join (stop or spawn) on the flag, set here or carried in
 *   withPartyCues(play) → play with those cues appended (the same object without a party)
 */
const ID = /^[a-z][a-z0-9_-]*$/i;
const FLAG = /^[a-z][a-z0-9-]{0,47}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`play.party${m}`);

export function readParty(play) {
  const P = play && play.party;
  if (P === undefined) return [];
  if (!Array.isArray(P)) throw err(' is a list of { who, joins?, at? }: the characters who join the pilot');
  const seen = new Set();
  return P.map((p, i) => {
    const at = `[${i}]`;
    if (!isObj(p)) throw err(`${at} is { who, joins?, at? }`);
    for (const k of Object.keys(p)) if (!['who', 'joins', 'at'].includes(k)) throw err(`${at}.${k} is not part of a member (who, joins, at)`);
    if (typeof p.who !== 'string' || !ID.test(p.who)) throw err(`${at}.who is the member's entity id`);
    if (seen.has(p.who)) throw err(`${at}.who '${p.who}' appears twice`);
    seen.add(p.who);
    if (p.joins !== undefined && !FLAG.test(p.joins)) throw err(`${at}.joins is the flag that makes them join (a lowercase name: joined-teodor); leave it out for one with the pilot from the start`);
    if (p.at !== undefined && !(typeof p.at === 'string' && p.at)) throw err(`${at}.at is the spot they wait at until they join`);
    if (p.at !== undefined && p.joins === undefined) throw err(`${at}.at is where one waits to join; a member with the pilot from the start waits nowhere`);
    return { who: p.who, ...(p.joins ? { joins: p.joins } : {}), ...(p.at ? { at: p.at } : {}) };
  });
}

export const partyFlags = (play) => [...new Set(readParty(play).filter((p) => p.joins).map((p) => p.joins))].sort();

export function partyCues(play) {
  const cues = [];
  for (const p of readParty(play)) {
    // with the pilot from the start: woken as the level starts
    if (!p.joins) { cues.push({ id: `party-${p.who}-start`, when: { start: true }, then: { spawn: p.who } }); continue; }
    if (p.at) cues.push({ id: `party-${p.who}-wait`, when: { start: true }, then: { walk: { who: p.who, to: p.at, then: 'stay' } } });
    const join = p.at ? { stop: p.who } : { spawn: p.who };
    // set here, or carried in: either joins, and joining twice is harmless (a stop or a spawn of one already there)
    cues.push({ id: `party-${p.who}-joins`, when: { on: `flag:${p.joins}` }, then: join });
    cues.push({ id: `party-${p.who}-joined`, when: { on: `flag-carried:${p.joins}` }, then: join });
  }
  return cues;
}

export function withPartyCues(play) {
  if (!play || play.party === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...partyCues(play)] };
}
