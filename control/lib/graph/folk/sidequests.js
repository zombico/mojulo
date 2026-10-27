/**
 * SIDEQUESTS: a checklist a town's person gives the player, and the chains they make. A sidequest is a quest of the
 * level's journal (playscape/ui/quests.js), its giver one of the folk and its steps the things to do: talk to another of
 * them (who is then part of the chain), or go to a house. Done, the player goes back to the giver to finish it (unless
 * `back: false`). A sidequest `after` another is offered only once that one is finished: a chain, giver to giver.
 *
 *   folk.sidequests: [{ id, giver, name?, ask?, thanks?, after?, back?, steps: [{ talk: who, say?, log? } | { reach: house, log? }] }]
 *     who     a person of the town: their role ('keeper', the first), a role and its count ('townie-3'), their path, or
 *             a recurring person's id ('jenny')
 *     house   one of the town's houses as the street stands them ('town-hall-1')
 *     ask     what the giver asks, `thanks` what they say at the end, a talk step's `say` what that person says: the
 *             operator's words. Left out, the ask is a slot (`[Keeper: the errand]`) and the rest the book's plain words.
 *     name, log   the journal's; left out, its plain words ('Talk to the Smith', 'Return to the Keeper')
 *
 *   readSidequests(list)                     → the sidequests, read (shape only), or throws, teaching
 *   whoOf(folk, word)                        → the person a word names in a town, or null
 *   sidequestsOn(list, folk, houses)         → the ones this town can hold: every who and house in it
 *   lowerSidequests(list, folk, { idOf, houseAt, speakerOf })
 *        → { quests, menus, cues, talks }: the journal's quests, their menus and cues; `talks` per entity id, the cues
 *          its talk dispatches to (dispatchCues)
 *
 * THE FLAGS. A sidequest `<id>` is begun by `sq-<id>` (the giver's offer taken), each step done by `sq-<id>-<n>`, and it
 * is finished by `sq-<id>-back` (or its last step's when it has no way back). A step is open only once the step
 * before it is done, so the checklist is walked in order. Pure.
 */
const R = (o) => Object.freeze(o);
const ID = /^[a-z][a-z0-9-]{0,37}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const err = (m) => new Error(`folk: sidequests${m}`);

export const SIDEQUEST_KEYS = R(['id', 'giver', 'name', 'ask', 'thanks', 'after', 'back', 'steps']);
export const MAX_STEPS = 11;   // the journal's 12 with the way back

/** The plain words a sidequest says when the operator gives none: what moves it on, never what it is about. */
export const PLAIN = R({
  take: "I'll help.", leave: 'Not now.',
  step: R(['Oh, you\'re here about that? Consider it done.', 'Right, I\'ll see to it. Tell them.', 'Ah. Yes, I know about that. Done.']),
  thanks: R(['That\'s everything. Thank you.', 'You\'ve been a great help.', 'Done already? Thank you.']),
});

export function readSidequests(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw err(' is a list of { id, giver, steps: [{ talk: who } | { reach: house }], name?, ask?, thanks?, after?, back? }');
  const seen = new Set();
  const out = list.map((q, i) => {
    const at = `[${i}]`;
    if (!isObj(q)) throw err(`${at} is { id, giver, steps, … }`);
    for (const k of Object.keys(q)) if (!SIDEQUEST_KEYS.includes(k)) throw err(`${at}.${k} is not part of a sidequest (${SIDEQUEST_KEYS.join(', ')})`);
    if (typeof q.id !== 'string' || !ID.test(q.id)) throw err(`${at}.id is a lowercase id ("lost-ring"), up to 38 letters`);
    if (seen.has(q.id)) throw err(`${at}.id '${q.id}' appears twice`);
    seen.add(q.id);
    if (!words(q.giver)) throw err(`${at}.giver is who gives it: a role ('keeper'), a role and its count ('townie-3'), or a person's path`);
    for (const k of ['name', 'ask', 'thanks']) if (q[k] !== undefined && !words(q[k])) throw err(`${at}.${k} is words`);
    if (q.back !== undefined && typeof q.back !== 'boolean') throw err(`${at}.back is false to finish it at its last step, without going back to the giver`);
    if (!Array.isArray(q.steps) || !q.steps.length || q.steps.length > MAX_STEPS) throw err(`${at}.steps is 1 to ${MAX_STEPS} things to do, in order: { talk: who } or { reach: house }`);
    const steps = q.steps.map((s, j) => {
      const sat = `${at}.steps[${j}]`;
      if (!isObj(s) || (s.talk === undefined) === (s.reach === undefined)) throw err(`${sat} is { talk: who, say?, log? } or { reach: house, log? }`);
      for (const k of Object.keys(s)) if (!['talk', 'reach', 'say', 'log'].includes(k)) throw err(`${sat}.${k} is not part of a step (talk, reach, say, log)`);
      if (s.talk !== undefined && !words(s.talk)) throw err(`${sat}.talk is who to talk to (a role, a role and its count, or a path)`);
      if (s.reach !== undefined && !(typeof s.reach === 'string' && /^town-[a-z]+-\d+$/.test(s.reach))) throw err(`${sat}.reach is one of the town's houses ('town-hall-1')`);
      if (s.say !== undefined && (s.reach !== undefined || !words(s.say))) throw err(`${sat}.say is what the person talked to says (a talk step's)`);
      if (s.log !== undefined && !words(s.log)) throw err(`${sat}.log is the journal's words for it`);
      return { ...(s.talk !== undefined ? { talk: s.talk.trim() } : { reach: s.reach }), ...(s.say ? { say: s.say.trim() } : {}), ...(s.log ? { log: s.log.trim() } : {}) };
    });
    return { id: q.id, giver: q.giver.trim(), ...(q.name ? { name: q.name.trim() } : {}), ...(q.ask ? { ask: q.ask.trim() } : {}), ...(q.thanks ? { thanks: q.thanks.trim() } : {}), ...(q.after ? { after: q.after } : {}), back: q.back !== false, steps };
  });
  for (const q of out) if (q.after !== undefined && (!seen.has(q.after) || q.after === q.id)) throw err(`: '${q.id}'.after is another sidequest's id (${[...seen].filter((x) => x !== q.id).join(', ') || 'none'})`);
  // a chain never loops back on itself
  for (const q of out) { let k = q, n = 0; while (k?.after && n++ <= out.length) k = out.find((x) => x.id === k.after); if (n > out.length) throw err(`: '${q.id}' is after itself, round a chain`); }
  return out;
}

/** The person a word names: a path, a recurring person's id, a role (its first in the town), or a role and its count
 * ('townie-3'). */
export function whoOf(folk, word) {
  const byPath = folk.people.find((p) => p.path === word || p.recurring === word);
  if (byPath) return byPath;
  const m = /^([a-z]+)(?:-(\d+))?$/.exec(word);
  if (!m) return null;
  return folk.people.filter((p) => p.role === m[1])[(m[2] ? +m[2] : 1) - 1] ?? null;
}

/** The sidequests a town can hold: its giver and every person and house of its steps in it, and what it is after too. */
export function sidequestsOn(list, folk, houses) {
  const holds = (q) => whoOf(folk, q.giver) && q.steps.every((s) => (s.talk ? whoOf(folk, s.talk) : houses.has(s.reach)));
  const ok = new Set(list.filter(holds).map((q) => q.id));
  let moved = true;
  while (moved) { moved = false; for (const q of list) if (ok.has(q.id) && q.after && !ok.has(q.after)) { ok.delete(q.id); moved = true; } }
  return list.filter((q) => ok.has(q.id));
}

const flagOf = (q) => `sq-${q.id}`;
const stepFlag = (q, j) => `sq-${q.id}-${j + 1}`;
const endFlag = (q) => (q.back ? `sq-${q.id}-back` : stepFlag(q, q.steps.length - 1));
const set = (f) => ({ var: `flag-${f}`, eq: 1 }), unset = (f) => ({ var: `flag-${f}`, eq: 0 });
const pick = (list, k) => list[k % list.length];

export function lowerSidequests(list, folk, { idOf, houseAt, speakerOf }) {
  const quests = [], menus = [], cues = [], talks = {};
  const talk = (id, entry) => { (talks[id] ??= []).push(entry); };
  list.forEach((q, n) => {
    const giver = whoOf(folk, q.giver), gid = idOf(giver.path), gname = speakerOf(giver);
    const begun = set(flagOf(q)), after = q.after ? [set(endFlag(list.find((x) => x.id === q.after)))] : [];
    const logOf = (s) => s.log ?? (s.talk ? `Talk to the ${speakerOf(whoOf(folk, s.talk))}` : `Go to the ${s.reach.replace(/^town-([a-z]+)-\d+$/, '$1')}`);
    quests.push({ id: `sq-${q.id}`, ...(q.name ? { name: q.name } : {}), starts: flagOf(q),
      steps: [...q.steps.map((s, j) => ({ log: logOf(s), done: stepFlag(q, j) })), ...(q.back ? [{ log: `Return to the ${gname}`, done: endFlag(q) }] : [])] });
    // the giver: the offer while it is not begun (and what it is after is finished), the thanks once its last step is
    // done; while it is under way, their chitchat (the journal says what is next)
    const ask = q.ask ?? `[${gname}: the errand]`;
    menus.push({ id: `sq-${q.id}-offer`, kind: 'talk', who: gname, lines: [ask], choices: [{ say: PLAIN.take, then: { emit: `flag:${flagOf(q)}` } }, { say: PLAIN.leave }] });
    if (q.back) {
      const last = stepFlag(q, q.steps.length - 1);
      menus.push({ id: `sq-${q.id}-thanks`, kind: 'talk', who: gname, lines: [q.thanks ?? pick(PLAIN.thanks, n)] });
      talk(gid, { rank: 0, if: [begun, set(last), unset(endFlag(q))], open: `sq-${q.id}-thanks`, emit: `flag:${endFlag(q)}` });
    }
    talk(gid, { rank: 3, if: [unset(flagOf(q)), ...after], open: `sq-${q.id}-offer` });
    // the steps: each open once the one before is done (the first once it is begun)
    q.steps.forEach((s, j) => {
      const prev = j ? set(stepFlag(q, j - 1)) : begun, when = [begun, prev, unset(stepFlag(q, j))];
      if (s.talk) {
        const who = whoOf(folk, s.talk), wid = idOf(who.path), menu = `sq-${q.id}-${j + 1}`;
        menus.push({ id: menu, kind: 'talk', who: speakerOf(who), lines: [s.say ?? pick(PLAIN.step, n + j)] });
        talk(wid, { rank: 1, if: when, open: menu, emit: `flag:${stepFlag(q, j)}` });
      } else {
        const at = houseAt(s.reach);
        cues.push({ id: `sq-${q.id}-${j + 1}-reach`, when: { near: { at, r: 3 } }, if: when, then: { emit: `flag:${stepFlag(q, j)}` } });
      }
    });
  });
  return { quests, menus, cues, talks };
}

/** At most this many sidequest entries per person: the bus runs a chain of events at most 8 deep, and opening the k-th
 * entry checks k holds on the talk press. Past it, the lowest-ranked are left out (dispatchCues `dropped`). */
export const MAX_ENTRIES = 5;

/**
 * A person's talk, dispatched. The work is split where the bus has depth to spare:
 *   HOLDS   each entry's own conditions, read into its var `folk-hold-<id>-<k>` (1 while they hold) when the level starts
 *           and whenever a flag they read is set (a watch: a fresh chain)
 *   PRESS   the use cue `useCue` (its `cue:<id>` event): the k-th entry (by rank: a hand-in, a step, an offer) opens its
 *           menu when its hold is on and every one ranked before it is off; when none is on, the chitchat
 * → { cues, dropped }
 */
export function dispatchCues(id, entries, chat, useCue) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank), kept = sorted.slice(0, MAX_ENTRIES);
  const hold = (k) => `folk-hold-${id}-${k + 1}`, re = `folk-re:${id}`, press = `cue:${useCue}`;
  const flags = [...new Set(kept.flatMap((e) => e.if.map((c) => c.var)))].sort();
  const off = (k) => ({ var: hold(k), ne: 1 });
  const cues = [
    { id: `${id}-re-0`, when: { start: true }, then: { emit: re } },
    ...flags.map((v, n) => ({ id: `${id}-re-${n + 1}`, when: { var: v, eq: 1 }, then: { emit: re } })),
    ...kept.map((e, k) => ({ id: `${id}-hold-${k + 1}`, when: { on: re }, if: e.if, then: { set: hold(k), to: 1 }, else: { set: hold(k), to: 0 } })),
    ...kept.map((e, k) => ({ id: `${id}-open-${k + 1}`, when: { on: press }, if: [{ var: hold(k), eq: 1 }, ...kept.slice(0, k).map((_, j) => off(j))], then: [{ open: e.open }, ...(e.emit ? [{ emit: e.emit }] : [])] })),
    { id: `${id}-open-chat`, when: { on: press }, ...(kept.length ? { if: kept.map((_, j) => off(j)) } : {}), then: { open: chat } },
  ];
  return { cues, dropped: sorted.slice(MAX_ENTRIES).map((e) => e.open) };
}
