/**
 * THE ERRAND'S MECHANICS — sent out with a list, home with the goods (the escape room's opposite pole). Three verbs, each
 * lowered onto the bag's guarded transfer (playscape/ui/items.js lowerMove: `held:bag:<item>` on the bus, `in:` / `out:`
 * said for the store to keep, so what is carried rides from level to level), no runtime of their own:
 *
 *   trade    (emitter)  a place where an item is had: walk in holding its `needs` and they are spent for it (`count` of
 *                       it into the bag). With no needs it is a source (a shelf, a crate). It gives again only once the
 *                       bag holds none of it, so a spoiled cargo is fetched again (the shelf restocks).
 *                       { item, at, count? (1), needs?: [{ item, n? (1) }], radius?, flag? }   (`flag`: a quest's
 *                       step, set when it is had: playscape/ui/quests.js; the hand-in's `flag` the same)
 *   cargo    (emitter)  what a carried item's condition is: its count in the bag. Fragile: each hit the carrier takes and
 *                       each fall (the fall policy's catch) loses one; perishable: one every `perishable` seconds while
 *                       any is held. A bar on the HUD; `cargo:lost:<item>` a unit, said as a toast.
 *                       { item, fragile?: true, perishable?: <seconds>, max? (the bar's top) }
 *   bounty   (emitter)  a foe's fall drops its proof into the bag (dead, the default: a pelt, a badge, a head): each fall
 *                       of a foe matching `who` (a glob over the cast's `down`), or each `enemy:down` (an hp-pool's)
 *                       without one. Alive is a variation of fetching: the captive carried as cargo (not built yet).
 *                       { item, who?, n? (1) }
 *   deliver  (terminal) the giver's hand-in: walk in holding each asked item, at least its `min`, and the `min` of each is
 *                       handed over, the `reward` given into the bag, ending the level (`errand:done:<id>` → success);
 *                       short of any, a toast says so (`errand:short:<id>`) and nothing is taken. A bounty board is a
 *                       giver that wants proofs.
 *                       { id?, at, wants: [{ item, min? (1) }], reward?: [{ item, n? (1) }], radius?, planar?, repeat? }
 *                       `repeat: true`: a standing job's, which pays each time and ends nothing; `open: true`: a
 *                       one-off's in a level a standing job keeps open, which pays and ends nothing either; `clean: true`:
 *                       a story mission's, handed in only with no stars (the law's `wanted`)
 *
 * Names (recipe-derived, for a handoff): a trade's zone and marker `trade-<item>`, a deliver's zone `deliver-<id>`.
 * A deliver's audit is the walk to it (what the walk must hold first is the errand's order: gameworld/errand.js).
 *
 *   offer    (emitter)  where a job is taken: coming to its giver sets its flag, once, and says the giver's words; a
 *                       trade `after` that flag is had only once it is set.   { id, at, flag, says?, radius? }
 *
 *   call     (emitter)  a job offered by phone, by a giver already met: on its event (the job before it done) its
 *                       flag is set, once, and the caller's words are said.   { id, flag, on, from?, says? }
 *
 *   shift    (emitter)  a DRIVING JOB in a city vehicle (gameworld/jobsified.js), by its `mode`. In every mode, getting into
 *                       one of its vehicles (`cabs`, the bus's `mounted`) once the job is taken (`after`) clocks in, and
 *                       out of it nothing counts. Each pays into the bag (`errand:done:<id>`); a standing one (`repeat`)
 *                       is worked again.
 *                       route    its stops in order: the next one held at (`hold` seconds, its doors open) is made; the
 *                                last made pays, and a standing one begins again
 *                       collect  a pile (`stops`) is taken on by holding at it (`shift:hold:<id>` … `shift:let:<id>`, the
 *                                page's key) for `hold` seconds, `load` of them filling the vehicle; full, it is emptied
 *                                at `unload` (the dump; the depot where none), which pays; every pile taken, all are
 *                                laid again
 *                       haul     driven to its `site`, it is delivered and paid; got out of there, it is taken back to
 *                                `back` (its spot by the yard) for the next. A haul of several `calls` ({ cab, site,
 *                                back, vehicle }: a heavy call's) works them in turn (`call-<id>`), only the vehicle
 *                                called counting; the last back, the first is called again
 *                       sweep    its `stops` heaps of litter, each driven over in the vehicle once a round; every
 *                                one swept pays, and a standing one's are laid again
 *                       mow      a ROUND on a lawn in its mower: got into, its clock starts at `time` seconds and
 *                                its `stops` (cells of long grass, { at, half }) are long again; each driven over in
 *                                it cut once; `goal` of them (a share) cut pays; the clock run out ends it unpaid;
 *                                got out of, the mower goes back to `back` (its shed) and the round with it
 *                       dig      an operated machine (an excavator): the page says each scoop and each tip
 *                                (`shift:scoop:<id>`, `shift:tip:<id>`); a full bucket tipped is a load, `loads` of
 *                                them pay and the truck goes off empty
 *                       { id, mode?: 'route', depot: [x, y, z], radius? | half?, cabs: [entity id], stops?: [{ at, radius? }], loads?,
 *                         load?, hold?, unload?: { at, half }, site?: { at, half | radius }, back?: [x, y, z],
 *                         reward?, repeat?, after?, vehicle?, yard?, done?, pitch?, time?, goal? }
 *                       Flags (the guide's and the journal's): `on-<id>` clocked in; `stop-<id>-<k>` a stop or a pile;
 *                       `full-<id>` a collect's vehicle full; `done-<id>` paid.

 *   lowerTrade, lowerCargo, lowerBounty, lowerDeliver, lowerOffer, lowerCall, lowerTask, lowerJoin, lowerAct, lowerShift   (game/mechanics.js registers them)
 *
 * Pure, no dice.
 */
import { lowerMove, heldVar, itemKey, NOWHERE } from '../playscape/ui/items.js';

const BAG = 'bag';
const WORD = /^[a-z][a-z0-9-]{0,31}$/;
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const posInt = (v) => Number.isInteger(v) && v >= 1;

// one guard after another (the bus's `if` takes one predicate): `on` → … → `ok` when every guard holds; each failing guard
// emits `no`
function chain(reactions, on, guards, ok, no) {
  guards.forEach((g, k) => {
    const src = k ? `${ok}:${k}` : on, dst = k === guards.length - 1 ? ok : `${ok}:${k + 1}`;
    reactions.push({ on: src, if: g, do: 'emit', type: dst });
    if (no) reactions.push({ on: src, if: { var: g.var, lt: g.gte }, do: 'emit', type: no });
  });
}

export function lowerTrade(p, ctx) {
  const at0 = `trade[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  if (typeof p.item !== 'string' || !WORD.test(itemKey(p.item))) fail('item is what is had here, one lower-case word (eggs, coin, a rune-key)');
  if (!isVec(p.at)) fail('at is [x, y, z]: where it is had');
  const count = p.count === undefined ? 1 : p.count;
  if (!posInt(count)) fail('count is how many are had, a whole number from 1');
  const needs = p.needs === undefined ? [] : p.needs;
  if (!Array.isArray(needs) || needs.some((n) => !n || typeof n.item !== 'string' || (n.n !== undefined && !posInt(n.n)))) fail('needs is [{ item, n? }]: what is spent for it');
  if (needs.some((n) => itemKey(n.item) === itemKey(p.item))) fail('an item cannot be its own price');
  const key = itemKey(p.item), zone = `trade-${key}`, frag = { vars: { [heldVar(BAG, key)]: 0 }, reactions: [], hud: [] };
  const want = `trade:${key}`;
  // (a leg of a job that is offered, `after`: had only once the job is taken, its flag set: lowerOffer)
  if (typeof p.after === 'string' && p.after) { frag.vars[`flag-${p.after}`] ??= 0; frag.reactions.push({ on: 'enter', match: { zone }, if: { var: `flag-${p.after}`, gte: 1 }, do: 'emit', type: `${want}:try` }); }
  else frag.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: `${want}:try` });
  // only while the bag holds none of it (a shelf restocks for a carton spoiled on the way)
  frag.reactions.push({ on: `${want}:try`, if: { var: heldVar(BAG, key), eq: 0 }, do: 'emit', type: want });
  let paid = want;
  if (needs.length) {
    const guards = needs.map((n) => ({ var: heldVar(BAG, n.item), gte: n.n ?? 1 }));
    for (const n of needs) frag.vars[heldVar(BAG, n.item)] ??= 0;
    paid = `${want}:paid`;
    chain(frag.reactions, want, guards, paid, `${want}:short`);
    frag.hud.push({ on: `${want}:short`, as: 'toast', text: `${key.replace(/-/g, ' ')} costs ${needs.map((n) => `${n.n ?? 1} ${itemKey(n.item).replace(/-/g, ' ')}`).join(', ')}`, ttl: 1.6 });
    // the price spent (each guard held, so each move goes through), then the item given
    for (const n of needs) lowerMove({ item: n.item, n: n.n ?? 1, from: BAG, to: NOWHERE, on: paid }, frag);
  }
  lowerMove({ item: key, n: count, from: NOWHERE, to: BAG, on: paid }, frag);
  frag.reactions.push({ on: paid, do: 'emit', type: `pickup:${key}` });
  // (a leg of a quest, `flag`: had, its flag is set: playscape/ui/quests.js)
  if (typeof p.flag === 'string' && p.flag) frag.reactions.push({ on: paid, do: 'emit', type: `flag:${p.flag}` });
  return {
    world: {
      ...frag,
      sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 1.6, planar: p.planar !== false, watch: ctx.player }],
      entities: [{ id: zone, type: 'trade', on: true, position: p.at.slice(), radius: 0.4, color: '#e0a03a' }],
    },
    produces: [{ type: 'grant', slice: BAG }, ...(needs.length ? [{ type: 'consume', slice: BAG }] : [])],
    emits: [`pickup:${key}`],
  };
}

export function lowerCargo(p, ctx) {
  const at0 = `cargo[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  if (typeof p.item !== 'string' || !WORD.test(itemKey(p.item))) fail('item is the carried thing, one lower-case word');
  if (p.fragile === undefined && p.perishable === undefined) fail('a cargo is fragile: true, or perishable: <seconds a unit lasts>, or both');
  if (p.fragile !== undefined && p.fragile !== true) fail('fragile is true');
  if (p.perishable !== undefined && !(Number.isFinite(p.perishable) && p.perishable > 0)) fail('perishable is the seconds a unit lasts while carried, above 0');
  const key = itemKey(p.item), held = heldVar(BAG, key), jolt = `cargo:jolt:${key}`, frag = { vars: { [held]: 0 }, reactions: [], hud: [], timers: [] };
  if (p.fragile) {
    frag.reactions.push({ on: `hit:${ctx.player}`, do: 'emit', type: jolt });
    // the fall policy's catch (game/mechanics.js composeMechanics): a fall is a jolt too
    frag.reactions.push({ on: 'enter', match: { zone: '__catch__' }, do: 'emit', type: jolt });
  }
  // a perishable unit goes off each period while any is carried
  if (p.perishable) frag.timers.push({ every: p.perishable, emit: { type: jolt }, while: { var: held, gte: 1 } });
  const { ok } = lowerMove({ item: key, n: 1, from: BAG, to: NOWHERE, on: jolt }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: `cargo:lost:${key}` });
  frag.hud.push(
    { var: held, label: key.replace(/-/g, ' '), as: 'bar', max: posInt(p.max) ? p.max : 12 },
    { on: `cargo:lost:${key}`, as: 'toast', text: p.perishable && !p.fragile ? `the ${key.replace(/-/g, ' ')} spoils a little` : `some ${key.replace(/-/g, ' ')} broke`, ttl: 1.2 },
  );
  return { world: frag, produces: [{ type: 'consume', slice: BAG }], emits: [`cargo:lost:${key}`] };
}

export function lowerBounty(p, ctx) {
  const at0 = `bounty[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  if (typeof p.item !== 'string' || !WORD.test(itemKey(p.item))) fail('item is the proof a fall drops, one lower-case word (pelt, badge, head)');
  if (p.who !== undefined && !(typeof p.who === 'string' && p.who)) fail("who is a glob over the foes whose fall counts ('dire-wolf', 'bandit-*')");
  const n = p.n === undefined ? 1 : p.n;
  if (!posInt(n)) fail('n is how many a fall drops, from 1');
  const key = itemKey(p.item), frag = { vars: { [heldVar(BAG, key)]: 0 }, reactions: [], hud: [] }, fell = `bounty:${key}`;
  frag.reactions.push(p.who ? { on: 'down', match: { entity: p.who }, do: 'emit', type: fell } : { on: 'enemy:down', do: 'emit', type: fell });
  lowerMove({ item: key, n, from: NOWHERE, to: BAG, on: fell }, frag);
  frag.hud.push({ on: fell, as: 'toast', text: `${key.replace(/-/g, ' ')} taken`, ttl: 1.4 });
  return { world: frag, produces: [{ type: 'grant', slice: BAG }], emits: [fell], ...(p.who ? {} : { needs: ['enemy:down'] }) };
}

/** THE OFFER (an emitter): where a job is TAKEN. Coming to its giver sets the job's flag, once (`flag:<flag>`: its quest
 * begins in the journal, playscape/ui/quests.js; its legs, `after` that flag, can be had), and the giver's words are said.
 *   { id, at, flag, says?, radius?, planar? } */
export function lowerOffer(p, ctx) {
  const at0 = `offer[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the job\'s name, lower-case');
  if (!isVec(p.at)) fail('at is [x, y, z]: where its giver stands');
  if (typeof p.flag !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p.flag)) fail('flag is the flag taking it sets (took-parcel)');
  if (p.says !== undefined && (typeof p.says !== 'string' || !p.says.trim())) fail('says is what its giver says, in words');
  if (p.after !== undefined && (typeof p.after !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p.after))) fail('after is the flag it opens on (told-materials)');
  const zone = `offer-${p.id}`, took = `offer:${p.id}`, v = `flag-${p.flag}`;
  // (one that opens on a flag, `after`: taken there only once it is set, a call's)
  const open = p.after ? [{ on: 'enter', match: { zone }, if: { var: `flag-${p.after}`, gte: 1 }, do: 'emit', type: `${took}:open` }, { on: `${took}:open`, if: { var: v, eq: 0 }, do: 'emit', type: took }] : [{ on: 'enter', match: { zone }, if: { var: v, eq: 0 }, do: 'emit', type: took }];
  return {
    world: {
      vars: { [v]: 0, ...(p.after ? { [`flag-${p.after}`]: 0 } : {}) },
      reactions: [...open, { on: took, do: 'set', var: v, to: 1 }, { on: took, do: 'emit', type: `flag:${p.flag}` }],
      hud: p.says ? [{ on: took, as: 'toast', text: p.says, ttl: 3.2 }] : [],
      sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2.5, planar: p.planar !== false, watch: ctx.player }],
    },
    emits: [took],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}

/** THE CALL (an emitter): a job offered BY PHONE, by a giver already met. When its event comes (`on`: the job before it
 * done), its flag is set, once (its quest begins, its legs open), and the caller's words are said.
 *   { id, flag, on: '<event type>', from?, says? } */
export function lowerCall(p, ctx) {
  const at0 = `call[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the job\'s name, lower-case');
  if (typeof p.flag !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p.flag)) fail('flag is the flag the call sets (took-fare)');
  if (typeof p.on !== 'string' || !p.on) fail('on is the event the call comes on (errand:done:parcel)');
  const call = `call:${p.id}`, v = `flag-${p.flag}`, who = typeof p.from === 'string' && p.from ? `${p.from}: ` : '';
  return {
    world: {
      vars: { [v]: 0 },
      reactions: [{ on: p.on, if: { var: v, eq: 0 }, do: 'emit', type: call }, { on: call, do: 'set', var: v, to: 1 }, { on: call, do: 'emit', type: `flag:${p.flag}` }],
      hud: typeof p.says === 'string' && p.says ? [{ on: call, as: 'toast', text: `${who}${p.says}`, ttl: 4 }] : [],
    },
    emits: [call],
  };
}

/** THE TASK (an emitter): a job given by a phone APP, with no one to meet. An app is subscribed to on the phone
 * (`app:sub:<app>` sets `flag-sub-<app>`; one task of an app carries that, `subscribe`), and a task is taken there
 * (`app:take:<id>` sets its flag, once: its quest begins, its legs open). A task may be on several apps (`apps`: the
 * ones its `tags` put it on); taken on any, it is taken.
 *   { id, app, flag, name?, apps?: [app], tags?: [word], subscribe?: true | [{ app, name? }] } */
export function lowerTask(p, ctx) {
  const at0 = `task[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the task\'s name, lower-case');
  if (typeof p.app !== 'string' || !WORD.test(p.app)) fail('app is the phone app that gives it, lower-case (taskfu)');
  if (typeof p.flag !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p.flag)) fail('flag is the flag taking it sets (took-fare)');
  const apps = p.apps ?? [p.app];
  if (!Array.isArray(apps) || !apps.length || apps.some((a) => typeof a !== 'string' || !WORD.test(a))) fail('apps is the apps it is on, lower-case words');
  if (p.tags !== undefined && (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== 'string' || !WORD.test(t)))) fail('tags is what kind of task it is, lower-case words');
  const name = typeof p.name === 'string' && p.name ? p.name : p.app, subs = p.subscribe === true ? [{ app: p.app, name }] : Array.isArray(p.subscribe) ? p.subscribe : [];
  for (const s of subs) if (!s || typeof s.app !== 'string' || !WORD.test(s.app)) fail('subscribe is true, or [{ app, name? }]: the apps this task carries the subscribing of');
  const took = `task:${p.id}`, v = `flag-${p.flag}`;
  // (a task that asks for papers, `needs`: { item, name } (a licence, gameworld/shops.js FORGED): taken only while the bag
  // holds them; without, the app says what it asks for)
  const N = p.needs && typeof p.needs.item === 'string' ? p.needs : null, held = N ? heldVar(BAG, N.item) : null;
  return {
    world: {
      vars: { [v]: 0, ...Object.fromEntries(apps.map((a) => [`flag-sub-${a}`, 0])), ...(N ? { [held]: 0 } : {}) },
      reactions: [
        ...subs.map((s) => ({ on: `app:sub:${s.app}`, do: 'set', var: `flag-sub-${s.app}`, to: 1 })),
        ...(N ? [{ on: `app:take:${p.id}`, if: { var: v, eq: 0 }, do: 'emit', type: `${took}:try` }, { on: `${took}:try`, if: { var: held, gte: 1 }, do: 'emit', type: took }, { on: `${took}:try`, if: { var: held, eq: 0 }, do: 'emit', type: `task:needs:${p.id}` }]
          : [{ on: `app:take:${p.id}`, if: { var: v, eq: 0 }, do: 'emit', type: took }]),
        { on: took, do: 'set', var: v, to: 1 }, { on: took, do: 'emit', type: `flag:${p.flag}` },
      ],
      hud: [...subs.map((s) => ({ on: `app:sub:${s.app}`, as: 'toast', text: `${s.name ?? s.app}: subscribed. Tasks come to your phone.`, ttl: 3.2 })), { on: took, as: 'toast', text: `${name}: task taken`, ttl: 3.2 },
        ...(N ? [{ on: `task:needs:${p.id}`, as: 'toast', text: `${name}: this one needs a ${N.name ?? N.item.replace(/-/g, ' ')}`, ttl: 3.2 }] : [])],
    },
    emits: [took],
  };
}

/** THE JOIN (an emitter): a FACTION joined, where its contact stands, by the player's own say. Its contact is OPEN only
 * once its `after` flag is set (the first job done: the faction has heard of the player, and says so); coming to them
 * then ASKS (a word on the screen: the key to join, or walk on), and only the key (`key`, Y) joins, while the player
 * stands there and is with no one. Joining sets `flag-in-<faction>`; it is left on the phone (`app:leave:<faction>`),
 * its standing (`standing-<faction>`) kept. Absent `after`, open from the start.
 *   { faction, at, radius?, name?, says?, ask?, others?: [faction], after?, key? } */
export function lowerJoin(p, ctx) {
  const at0 = `join[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.faction !== 'string' || !WORD.test(p.faction)) fail('faction is the side joined, lower-case');
  if (!isVec(p.at)) fail('at is [x, y, z]: where its contact stands');
  const others = p.others ?? [];
  if (!Array.isArray(others) || others.some((o) => typeof o !== 'string' || !WORD.test(o) || o === p.faction)) fail('others is the other factions, left on joining this one');
  if (p.after !== undefined && (typeof p.after !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p.after))) fail('after is the flag its contact opens on (done-parcel): the first job done');
  const key = typeof p.key === 'string' && /^[a-z]$/.test(p.key) ? p.key : 'y';
  const f = p.faction, zone = `join-${f}`, joined = `join:${f}`, v = `flag-in-${f}`, near = `join-near-${f}`, open = `join-open-${f}`, name = typeof p.name === 'string' && p.name ? p.name : f;
  const free = [{ var: v, eq: 0 }, ...others.map((o) => ({ var: `flag-in-${o}`, eq: 0 }))];
  // (a guard chain: each guard a hop of its own, the last the event)
  const chain = (from, guards, type, hop) => guards.map((g, k) => ({ on: k ? `${hop}:${k}` : from.on, ...(k ? {} : from.match ? { match: from.match } : {}), if: g, do: 'emit', type: k === guards.length - 1 ? type : `${hop}:${k + 1}` }));
  const reactions = [
    { on: 'enter', match: { zone }, do: 'set', var: near, to: 1 }, { on: 'exit', match: { zone }, do: 'set', var: near, to: 0 },
    // (coming to its contact, open and with no one: it asks)
    ...chain({ on: 'enter', match: { zone } }, [{ var: open, gte: 1 }, ...free], `join-ask:${f}`, `asking:${f}`),
    // (the key, said there: joined)
    ...chain({ on: `join-yes:${f}` }, [{ var: near, gte: 1 }, { var: open, gte: 1 }, ...free], joined, `joining:${f}`),
    { on: joined, do: 'set', var: v, to: 1 }, { on: joined, do: 'emit', type: `flag:in-${f}` },
    { on: `app:leave:${f}`, do: 'set', var: v, to: 0 },
    // (opened by the first job done: the faction has heard of the player)
    ...(p.after ? [{ on: `flag:${p.after}`, if: { var: open, eq: 0 }, do: 'emit', type: `join-open:${f}` }, { on: `join-open:${f}`, do: 'set', var: open, to: 1 }] : []),
  ];
  const ask = typeof p.ask === 'string' && p.ask ? p.ask : 'We could use someone like you.';
  return {
    world: {
      vars: { [v]: 0, [`standing-${f}`]: 0, [near]: 0, [open]: p.after ? 0 : 1, ...(p.after ? { [`flag-${p.after}`]: 0 } : {}), ...Object.fromEntries(others.map((o) => [`flag-in-${o}`, 0])) },
      reactions,
      inputs: [{ on: 'key', key, once: true, emit: { type: `join-yes:${f}` } }],
      hud: [
        ...(p.after ? [{ on: `join-open:${f}`, as: 'toast', text: `${name} have heard about you. Their contact is on the map, if you want in.`, ttl: 5 }] : []),
        { on: `join-ask:${f}`, as: 'toast', text: `${name}: ${ask} ${key.toUpperCase()} to join, or walk on.`, ttl: 6 },
        { on: joined, as: 'toast', text: `${name}: ${typeof p.says === 'string' && p.says ? p.says : 'you are with us now'}`, ttl: 3.6 },
        { on: `app:leave:${f}`, as: 'toast', text: `You have left ${name}`, ttl: 3.2 },
      ],
      sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2.5, planar: p.planar !== false, watch: ctx.player }],
    },
    emits: [joined, `join-ask:${f}`, ...(p.after ? [`join-open:${f}`] : [])],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}

/** THE ACT (an emitter): a faction's POSTING, finished by something done and not by something carried. It is taken on
 * the phone (`app:take:<id>` sets its flag, once); when the act is done (the event `act:<verb>:<id>`, raised by
 * whatever does it: THE SEAM the action is wired behind) and it was taken, it is paid: its `reward` into the bag, its
 * `standing` onto the faction's, once.
 *   { id, faction, verb, flag, done, target?, at?, radius?, reward?: [{ item, n? }], standing?, rank?, name?, line?,
 *     fight?: { foes, at, radius?, back?, hp?, hits?, wasted? } }   (`fight`: an encounter in free roam, below; `wasted`:
 *     the event the city's own health raises at none, vitals-mechanics.js: the fight keeps none of its own and is lost with it) */
export function lowerAct(p, ctx) {
  const at0 = `act[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the posting\'s name, lower-case');
  if (typeof p.faction !== 'string' || !WORD.test(p.faction)) fail('faction is the side that posts it, lower-case');
  if (typeof p.verb !== 'string' || !WORD.test(p.verb)) fail('verb is what is done, one lower-case word');
  for (const k of ['flag', 'done']) if (typeof p[k] !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p[k])) fail(`${k} is a flag's name (took-torch, done-torch)`);
  const reward = p.reward ?? [];
  if (!Array.isArray(reward) || reward.some((r) => !r || typeof r.item !== 'string' || (r.n !== undefined && !posInt(r.n)))) fail('reward is [{ item, n? }]: what it pays');
  if (reward.length) ctx.resolve('inventory', p.slice ?? BAG, at0);
  const standing = p.standing === undefined ? 1 : p.standing;
  if (!posInt(standing)) fail('standing is how much standing it pays, a whole number from 1');
  const took = `posting:${p.id}`, did = `act:${p.verb}:${p.id}`, ok = `${did}:ok`, tv = `flag-${p.flag}`, dv = `flag-${p.done}`, sv = `standing-${p.faction}`;
  const frag = { vars: { [tv]: 0, [dv]: 0, [sv]: 0 }, reactions: [], hud: [] };
  frag.reactions.push({ on: `app:take:${p.id}`, if: { var: tv, eq: 0 }, do: 'emit', type: took }, { on: took, do: 'set', var: tv, to: 1 }, { on: took, do: 'emit', type: `flag:${p.flag}` });
  // (done only once taken, and once)
  frag.reactions.push({ on: did, if: { var: tv, gte: 1 }, do: 'emit', type: `acting:${p.id}` }, { on: `acting:${p.id}`, if: { var: dv, eq: 0 }, do: 'emit', type: ok });
  frag.reactions.push({ on: ok, do: 'set', var: dv, to: 1 }, { on: ok, do: 'inc', var: sv, by: standing });
  for (const r of reward) lowerMove({ item: r.item, n: r.n ?? 1, from: NOWHERE, to: BAG, on: ok }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: `errand:done:${p.id}` }, { on: ok, do: 'emit', type: `flag:${p.done}` });
  // A FIGHT (`fight`: an encounter in free roam). Its foes are the cast's own bodies, minted asleep. Coming to its place
  // with the posting taken wakes them, once; each one's fall is counted, and the last one's is the act done. The hero's
  // hits come off a health of its own: at none the foes are put away, the hero is put back (`back`) and it may be
  // come to again.
  //   fight: { foes: [entity id], at, radius?, back?, hp? (100), hits? (20) }
  const F = p.fight;
  if (F !== undefined) {
    if (!F || !Array.isArray(F.foes) || !F.foes.length || F.foes.some((f) => typeof f !== 'string' || !f)) fail('fight.foes is the bodies fought, by their entity ids, at least one');
    if (!isVec(F.at)) fail('fight.at is [x, y, z]: where it is fought');
    if (F.back !== undefined && !isVec(F.back)) fail('fight.back is [x, y, z]: where the hero is put after going down');
    const hp0 = Number.isFinite(F.hp) && F.hp > 0 ? F.hp : 100, hits = Number.isFinite(F.hits) && F.hits > 0 ? F.hits : 20;
    const zone = `fight-${p.id}`, on = `fight-on-${p.id}`, fell = `fight-fell-${p.id}`, hp = `fight-hp-${p.id}`, woke = `encounter:${p.id}`, lost = `encounter-lost:${p.id}`;
    Object.assign(frag.vars, { [on]: 0, [fell]: 0, [hp]: hp0 });
    frag.sources = [{ type: 'zone', zone, at: F.at.slice(), radius: Number.isFinite(F.radius) ? F.radius : 8, planar: true, watch: ctx.player }];
    frag.reactions.push({ on: 'enter', match: { zone }, if: { var: tv, gte: 1 }, do: 'emit', type: `waking:${p.id}:1` }, { on: `waking:${p.id}:1`, if: { var: dv, eq: 0 }, do: 'emit', type: `waking:${p.id}:2` }, { on: `waking:${p.id}:2`, if: { var: on, eq: 0 }, do: 'emit', type: woke });
    frag.reactions.push({ on: woke, do: 'set', var: on, to: 1 });
    for (const f of F.foes) frag.reactions.push({ on: woke, do: 'ctrl', op: 'spawn', who: f, fresh: true }, { on: 'down', match: { entity: f }, do: 'inc', var: fell, by: 1 });
    // (a fight in a city with health of its own, `wasted`: vitals-mechanics.js; it is lost when the player is, and keeps
    // no health of its own)
    const own = typeof F.wasted !== 'string' || !F.wasted;
    if (!own) delete frag.vars[hp];
    frag.watches = [{ type: did, when: { var: fell, gte: F.foes.length } }, ...(own ? [{ type: `falling:${p.id}`, when: { var: hp, lte: 0 } }] : [])];
    frag.reactions.push({ on: ok, do: 'set', var: on, to: 0 });
    if (!own) frag.reactions.push({ on: F.wasted, do: 'emit', type: `falling:${p.id}` });
    // (the hero's hits count only while it is fought)
    if (own) frag.reactions.push({ on: `hit:${ctx.player}`, if: { var: on, gte: 1 }, do: 'inc', var: hp, by: -hits, min: 0 });
    frag.reactions.push({ on: `falling:${p.id}`, if: { var: on, gte: 1 }, do: 'emit', type: lost });
    for (const f of F.foes) frag.reactions.push({ on: lost, do: 'ctrl', op: 'vanish', who: f });
    frag.reactions.push({ on: lost, do: 'set', var: fell, to: 0 }, ...(own ? [{ on: lost, do: 'set', var: hp, to: hp0 }] : []), { on: lost, do: 'set', var: on, to: 0 });
    if (F.back && own) frag.reactions.push({ on: lost, do: 'move', target: ctx.player, to: F.back.slice() });
    frag.hud.push(...(own ? [{ var: hp, label: 'health', as: 'bar', max: hp0 }] : []), { on: woke, as: 'toast', text: `${F.foes.length} of them. Put them down.`, ttl: 3 }, { on: lost, as: 'toast', text: 'You went down. They are still there.', ttl: 3.2 });
  }
  const name = typeof p.name === 'string' && p.name ? p.name : p.faction, paid = reward.map((r) => `${r.n ?? 1} ${itemKey(r.item).replace(/-/g, ' ')}`).join(', ');
  frag.hud.push({ on: took, as: 'toast', text: `${name}: job taken`, ttl: 3.2 }, { on: ok, as: 'toast', text: `${name}: done${paid ? `, paid ${paid}` : ''} · standing +${standing}`, ttl: 3.6 });
  return { world: frag, emits: [took, ok, ...(F ? [`encounter:${p.id}`, `encounter-lost:${p.id}`] : [])], ...(reward.length ? { produces: [{ type: 'grant', slice: BAG }] } : {}) };
}

export function lowerDeliver(p, ctx) {
  const at0 = `deliver[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const id = p.id === undefined ? 'errand' : p.id;
  if (typeof id !== 'string' || !WORD.test(id)) fail('id is the errand\'s name, lower-case');
  if (!isVec(p.at)) fail('at is [x, y, z]: where the giver takes it');
  const wants = Array.isArray(p.wants) ? p.wants : [];
  if (!wants.length || wants.some((w) => !w || typeof w.item !== 'string' || (w.min !== undefined && !posInt(w.min)))) fail('wants is [{ item, min? }], at least one: what the giver asked for');
  const zone = `deliver-${id}`, frag = { vars: {}, reactions: [], hud: [] }, done = `errand:done:${id}`, short = `errand:short:${id}`, ok = `${done}:ok`;
  for (const w of wants) frag.vars[heldVar(BAG, w.item)] ??= 0;
  // (a job that is offered, `after`: handed in only once it is taken, so its giver's own place says nothing of it before)
  // (a story mission's, `clean`: handed in only with no stars, game/law-mechanics.js `wanted`; with them it says so)
  // (a one-off in a level kept open, `open`: once handed in it is quiet, its giver's place asking nothing more of it)
  const once = p.open === true && p.repeat !== true, gone = `delivered-${id}`;
  if (once) { frag.vars[gone] = 0; frag.reactions.push({ on: done, do: 'set', var: gone, to: 1 }); }
  const come0 = p.clean === true ? `${zone}:come` : `${zone}:try`, come = once ? `${zone}:open` : come0;
  if (once) frag.reactions.push({ on: come, if: { var: gone, eq: 0 }, do: 'emit', type: come0 });
  if (p.clean === true) { frag.vars.wanted ??= 0; frag.reactions.push({ on: come0, if: { var: 'wanted', eq: 0 }, do: 'emit', type: `${zone}:try` }, { on: come0, if: { var: 'wanted', gte: 1 }, do: 'emit', type: `errand:hot:${id}` }); frag.hud.push({ on: `errand:hot:${id}`, as: 'toast', text: 'Not with the police on you. Lose them first.', ttl: 2.4 }); }
  if (typeof p.after === 'string' && p.after) { frag.vars[`flag-${p.after}`] ??= 0; frag.reactions.push({ on: 'enter', match: { zone }, if: { var: `flag-${p.after}`, gte: 1 }, do: 'emit', type: come }); }
  else frag.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: come });
  chain(frag.reactions, `${zone}:try`, wants.map((w) => ({ var: heldVar(BAG, w.item), gte: w.min ?? 1 })), ok, short);
  for (const w of wants) lowerMove({ item: w.item, n: w.min ?? 1, from: BAG, to: NOWHERE, on: ok }, frag);
  // every errand pays: its reward into the bag (coin for the next leg's trade)
  const reward = p.reward === undefined ? [] : p.reward;
  if (!Array.isArray(reward) || reward.some((r) => !r || typeof r.item !== 'string' || (r.n !== undefined && !posInt(r.n)))) fail('reward is [{ item, n? }]: what the giver pays');
  for (const r of reward) lowerMove({ item: r.item, n: r.n ?? 1, from: NOWHERE, to: BAG, on: ok }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: done });
  if (typeof p.flag === 'string' && p.flag) frag.reactions.push({ on: ok, do: 'emit', type: `flag:${p.flag}` });
  // (a standing job's pay is kept in view: what it has earned, counted up)
  if (p.repeat === true) for (const r of reward) frag.hud.push({ var: heldVar(BAG, r.item), label: itemKey(r.item).replace(/-/g, ' '), as: 'counter', slot: 'top-right' });
  if (p.repeat === true || p.open === true) frag.hud.push({ on: done, as: 'toast', text: reward.length ? `paid ${reward.map((r) => `${r.n ?? 1} ${itemKey(r.item).replace(/-/g, ' ')}`).join(', ')}` : 'done', ttl: 1.8 });
  frag.hud.push({ on: short, as: 'toast', text: `bring ${wants.map((w) => `${w.min ?? 1} ${itemKey(w.item).replace(/-/g, ' ')}`).join(', ')}`, ttl: 1.8 });
  const shape = Array.isArray(p.half) ? { half: p.half } : { radius: Number.isFinite(p.radius) ? p.radius : 2 };
  return {
    world: { ...frag, sources: [{ type: 'zone', zone, at: p.at.slice(), ...shape, planar: p.planar !== false, watch: ctx.player }] },
    // (a standing job, `repeat`: paid and done again, the level never ended by it)
    ...(p.repeat === true || p.open === true ? {} : { on: { [done]: { end: 'success' } } }),
    produces: [{ type: 'consume', slice: BAG }, ...(reward.length ? [{ type: 'grant', slice: BAG }] : [])],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}

/** THE SHIFT (an emitter): a driving job in one of the city's vehicles (gameworld/jobsified.js). In the vehicle is a var
 * of the job's (`in-<id>`), set by the bus's `mounted` on one of its cabs once the job is taken (and on taking it while
 * already in one) and cleared by `dismounted`: what it asks is done in the vehicle, never on foot. */
export function lowerShift(p, ctx) {
  const at0 = `shift[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const mode = p.mode ?? 'route';
  if (!['route', 'collect', 'haul', 'dig', 'sweep', 'mow'].includes(mode)) fail('mode is route, collect, haul, dig, sweep or mow');
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the job\'s name, lower-case');
  if (!isVec(p.depot)) fail('depot is [x, y, z]: the yard its vehicle is had from');
  if (!Array.isArray(p.cabs) || !p.cabs.length || p.cabs.some((c) => typeof c !== 'string' || !c)) fail('cabs is the ids of the vehicles it is done in, at least one');
  if ((mode === 'route' || mode === 'collect' || mode === 'sweep' || mode === 'mow') && (!Array.isArray(p.stops) || !p.stops.length || p.stops.some((q) => !q || !isVec(q.at)))) fail('stops is [{ at: [x, y, z] }], at least one: the round');
  // (a haul's CALLS: each a vehicle of its own (`cab`), where it is driven (`site`) and where it is taken back to (`back`),
  // worked in turn; one call is the shift's own `cabs[0]`, `site` and `back`)
  const calls = mode !== 'haul' ? [] : Array.isArray(p.calls) && p.calls.length ? p.calls : [{ cab: p.cabs[0], site: p.site, back: p.back }];
  if (calls.some((c) => !c || typeof c.cab !== 'string' || !c.site || !isVec(c.site.at))) fail('site is { at: [x, y, z], half? | radius? }: where a haul is driven (each of its calls { cab, site, back })');
  if (mode === 'collect' && !(posInt(p.load) && p.load <= p.stops.length)) fail('load is how many piles fill the vehicle, 1 to its piles');
  if (mode === 'dig' && !posInt(p.loads)) fail('loads is how many bucketfuls fill the truck, from 1');
  const reward = p.reward === undefined ? [] : p.reward;
  if (!Array.isArray(reward) || reward.some((r) => !r || typeof r.item !== 'string' || (r.n !== undefined && !posInt(r.n)))) fail('reward is [{ item, n? }]: what it pays');
  if (p.after !== undefined && (typeof p.after !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(p.after))) fail('after is the flag taking the job sets (took-bin-round)');
  const id = p.id, inV = `in-${id}`, aboard = `aboard-${id}`, n = `n-${id}`, took = p.after ? `flag-${p.after}` : null;
  const vehicle = typeof p.vehicle === 'string' && p.vehicle ? p.vehicle : 'vehicle', yard = typeof p.yard === 'string' && p.yard ? p.yard : 'depot';
  const on = `on-${id}`, done = `done-${id}`, stopFlag = (k) => `stop-${id}-${k + 1}`, ev = (w) => `shift:${w}:${id}`, stops = p.stops ?? [], N = stops.length;
  const frag = { vars: { [inV]: 0, [aboard]: 0, [n]: 0, [`flag-${on}`]: 0, [`flag-${done}`]: 0, ...Object.fromEntries(stops.map((_, k) => [`flag-${stopFlag(k)}`, 0])), ...(took ? { [took]: 0 } : {}) }, reactions: [], hud: [], timers: [] };
  const R = frag.reactions, sources = [];
  const zone = (z, at, shape) => sources.push({ type: 'zone', zone: z, at: at.slice(), ...(Array.isArray(shape?.half) && shape.half.length === 2 ? { half: shape.half.slice() } : { radius: Number.isFinite(shape?.radius) ? shape.radius : 7 }), planar: p.planar !== false, watch: ctx.player });
  const payOut = (paid) => {
    for (const r of reward) lowerMove({ item: r.item, n: r.n ?? 1, from: NOWHERE, to: BAG, on: paid }, frag);
    R.push({ on: paid, do: 'set', var: `flag-${done}`, to: 1 }, { on: paid, do: 'emit', type: `flag:${done}` }, { on: paid, do: 'emit', type: `errand:done:${id}` });
    // (paid: a card in the middle, its name over what it paid, slammed in the game's look: game/hud-mana.js banner)
    frag.hud.push({ on: paid, as: 'banner', text: typeof p.says?.banner === 'string' && p.says.banner ? p.says.banner : mode === 'haul' ? 'Delivered' : mode === 'route' ? 'Route complete' : mode === 'dig' ? 'Truck loaded' : mode === 'sweep' ? 'Streets swept' : mode === 'mow' ? 'Lawn mowed' : 'Round complete', sub: `${reward.length ? `Paid ${reward.map((r) => `${r.n ?? 1} ${itemKey(r.item).replace(/-/g, ' ')}`).join(', ')}` : 'Done'}${p.repeat === true ? ' · another when you are ready' : ''}` });
  };
  // (a one-off pays once: its way to its pay is shut once paid)
  const once = (from, to) => R.push(p.repeat === true ? { on: from, do: 'emit', type: to } : { on: from, if: { var: `flag-${done}`, eq: 0 }, do: 'emit', type: to });

  // IN THE VEHICLE: one of its cabs, got into (or the job taken while in one); out of it, nothing counts
  // (a haul of several calls: only the vehicle called now counts, `call-<id>`)
  const callVar = `call-${id}`, called = calls.length > 1;
  if (called) frag.vars[callVar] = 1;
  const board = (c) => { const k = calls.findIndex((x) => x.cab === c); return called ? ev(`board:${k + 1}`) : ev('board'); };
  for (const c of called ? calls.map((x) => x.cab) : p.cabs) {
    R.push({ on: 'mounted', match: { mount: c }, do: 'set', var: aboard, to: 1 });
    R.push(took ? { on: 'mounted', match: { mount: c }, if: { var: took, gte: 1 }, do: 'emit', type: board(c) } : { on: 'mounted', match: { mount: c }, do: 'emit', type: board(c) });
    R.push({ on: 'dismounted', match: { mount: c }, do: 'set', var: aboard, to: 0 }, { on: 'dismounted', match: { mount: c }, do: 'set', var: inV, to: 0 });
  }
  if (called) calls.forEach((_, k) => R.push({ on: ev(`board:${k + 1}`), if: { var: callVar, eq: k + 1 }, do: 'emit', type: ev('in') }, { on: ev(`board:${k + 1}`), if: { var: callVar, eq: k + 1 }, do: 'set', var: `flag-on-${id}-${k + 1}`, to: 1 }, { on: ev(`board:${k + 1}`), if: { var: callVar, eq: k + 1 }, do: 'emit', type: `flag:on-${id}-${k + 1}` }));
  else R.push({ on: ev('board'), do: 'emit', type: ev('in') });
  if (took && !called) R.push({ on: `flag:${p.after}`, if: { var: aboard, gte: 1 }, do: 'emit', type: ev('in') });
  R.push({ on: ev('in'), do: 'set', var: inV, to: 1 }, { on: ev('in'), if: { var: `flag-${on}`, eq: 0 }, do: 'emit', type: ev('clock') });
  R.push({ on: ev('clock'), do: 'set', var: `flag-${on}`, to: 1 }, { on: ev('clock'), do: 'emit', type: `flag:${on}` });
  frag.hud.push({ on: ev('clock'), as: 'toast', text: `On the clock: drive the ${vehicle}`, ttl: 2.4 });
  if (took) frag.hud.push({ on: ev('need'), as: 'toast', text: `This is done in the ${vehicle}`, ttl: 1.8 });
  // (what its giver says as it is taken, `pitch`: the parks office short of hands)
  if (took && typeof p.pitch === 'string' && p.pitch) frag.hud.push({ on: `flag:${p.after}`, as: 'toast', text: p.pitch, ttl: 6 });

  // HOLDING AT A PLACE (a collect's pile, a route's stop): in the vehicle at it, the key held (the page presses its down
  // and up: `shift:hold:<id>`, `shift:let:<id>`) for `hold` seconds; the place held at is the last one come to that is
  // open (`at-<id>`, its number). `room` guards the count (a collect's: the vehicle not full); `got` is said when done
  const hold = `hold-${id}`, prog = `prog-${id}`, at = `at-${id}`, ticks = Math.max(1, Math.round((Number.isFinite(p.hold) && p.hold > 0 ? p.hold : 1.5) / 0.1));
  const holding = (open, room = null) => {
    Object.assign(frag.vars, { [hold]: 0, [prog]: 0, [at]: 0 });
    R.push({ on: ev('hold'), do: 'set', var: hold, to: 1 }, { on: ev('let'), do: 'set', var: hold, to: 0 }, { on: ev('let'), do: 'set', var: prog, to: 0 });
    stops.forEach((q, k) => {
      const z = `shift-${id}-${k + 1}`;
      zone(z, q.at, q);
      R.push({ on: 'enter', match: { zone: z }, if: open(k), do: 'set', var: at, to: k + 1 });
      R.push({ on: 'exit', match: { zone: z }, if: { var: at, eq: k + 1 }, do: 'set', var: at, to: 0 }, { on: 'exit', match: { zone: z }, if: { var: at, eq: k + 1 }, do: 'set', var: prog, to: 0 });
    });
    frag.timers.push({ every: 0.1, emit: { type: ev('tick') }, while: { var: hold, gte: 1 } });
    // (a tick held: at a place, in the vehicle, with room; on foot, a word that it is done in the vehicle)
    R.push({ on: ev('tick'), if: { var: at, gte: 1 }, do: 'emit', type: `${ev('tick')}:at` });
    R.push({ on: `${ev('tick')}:at`, if: { var: inV, gte: 1 }, do: 'emit', type: `${ev('tick')}:in` });
    if (took) R.push({ on: `${ev('tick')}:at`, if: { var: inV, eq: 0 }, do: 'emit', type: `${ev('tick')}:afoot` }, { on: `${ev('tick')}:afoot`, if: { var: prog, eq: 0 }, do: 'emit', type: ev('need') });
    if (room) R.push({ on: `${ev('tick')}:in`, if: room.ok, do: 'inc', var: prog, by: 1 }, { on: `${ev('tick')}:in`, if: room.no, do: 'emit', type: room.say });
    else R.push({ on: `${ev('tick')}:in`, do: 'inc', var: prog, by: 1 });
    R.push({ on: `${ev('tick')}:in`, if: { var: prog, gte: ticks }, do: 'emit', type: ev('got') });
    // (done: the place held at, its own event, the hold begun again)
    stops.forEach((_, k) => R.push({ on: ev('got'), if: { var: at, eq: k + 1 }, do: 'emit', type: ev(`stop:${k + 1}`) }));
    stops.forEach((_, k) => { const hit = ev(`stop:${k + 1}`); R.push({ on: hit, do: 'set', var: `flag-${stopFlag(k)}`, to: 1 }, { on: hit, do: 'emit', type: `flag:${stopFlag(k)}` }, { on: hit, do: 'inc', var: n, by: 1 }, { on: hit, do: 'set', var: at, to: 0 }, { on: hit, do: 'set', var: prog, to: 0 }, { on: hit, do: 'emit', type: ev('took') }); });
  };

  if (mode === 'route') {
    // THE STOPS IN ORDER: the next one (`next-<id>`) held at, its doors open; the last one pays, and the round begins again
    const next = `next-${id}`, paid = ev('paid');
    frag.vars[next] = 1;
    holding((k) => ({ var: next, eq: k + 1 }));
    stops.forEach((_, k) => R.push({ on: ev(`stop:${k + 1}`), do: 'inc', var: next, by: 1 }));
    frag.hud.push({ on: ev('took'), as: 'toast', text: typeof p.done === 'string' && p.done ? p.done : 'Stop made', ttl: 1.6 });
    once(ev(`stop:${N}`), paid);
    payOut(paid);
    if (p.repeat === true) R.push({ on: paid, do: 'set', var: next, to: 1 }, { on: paid, do: 'set', var: n, to: 0 }, ...stops.map((_, k) => ({ on: paid, do: 'set', var: `flag-${stopFlag(k)}`, to: 0 })));
  }

  if (mode === 'collect') {
    // A PILE taken on by holding at it while the vehicle has room, `load` of them filling it
    const load = `load-${id}`, full = `full-${id}`, L = p.load;
    Object.assign(frag.vars, { [load]: 0, [`flag-${full}`]: 0 });
    holding((k) => ({ var: `flag-${stopFlag(k)}`, eq: 0 }), { ok: { var: load, lt: L }, no: { var: load, gte: L }, say: ev('isfull') });
    stops.forEach((_, k) => R.push({ on: ev(`stop:${k + 1}`), do: 'inc', var: load, by: 1 }));
    frag.hud.push({ on: ev('took'), as: 'toast', text: typeof p.done === 'string' && p.done ? p.done : 'Collected', ttl: 1.6 });
    // (full: a flag the guide waits on, and a word of where to take it)
    R.push({ on: ev('took'), if: { var: load, gte: L }, do: 'emit', type: ev('full') }, { on: ev('full'), do: 'set', var: `flag-${full}`, to: 1 }, { on: ev('full'), do: 'emit', type: `flag:${full}` });
    const where = p.unload ? 'the dump' : `the ${yard}`;
    frag.hud.push({ on: ev('full'), as: 'toast', text: `The ${vehicle} is full: take it to ${where}`, ttl: 3 }, { on: ev('isfull'), as: 'toast', text: `Full: take it to ${where}`, ttl: 1.2 });
    // (every pile taken: the city has made more, all laid again; counted, `swept-<id>`, never a chain of the piles' flags,
    // which runs past the bus's depth)
    const swept = `swept-${id}`;
    frag.vars[swept] = 0;
    R.push({ on: ev('took'), do: 'inc', var: swept, by: 1 }, { on: ev('took'), if: { var: swept, gte: N }, do: 'emit', type: ev('swept') });
    R.push({ on: ev('swept'), do: 'set', var: swept, to: 0 }, ...stops.map((_, k) => ({ on: ev('swept'), do: 'set', var: `flag-${stopFlag(k)}`, to: 0 })));
    // UNLOADED at the dump (the depot where there is none), in the vehicle, full: paid, emptied
    const U = p.unload && isVec(p.unload.at) ? p.unload : { at: p.depot, ...(Array.isArray(p.half) ? { half: p.half } : { radius: Number.isFinite(p.radius) ? p.radius : 9 }) }, uz = `shift-${id}-unload`, paid = ev('paid');
    zone(uz, U.at, U);
    R.push({ on: 'enter', match: { zone: uz }, if: { var: inV, gte: 1 }, do: 'emit', type: `${ev('dump')}:0` });
    once(`${ev('dump')}:0`, ev('dump'));
    R.push({ on: ev('dump'), if: { var: load, gte: L }, do: 'emit', type: paid }, { on: ev('dump'), if: { var: load, lt: L }, do: 'emit', type: `${ev('short')}:0` }, { on: `${ev('short')}:0`, if: { var: load, gte: 1 }, do: 'emit', type: ev('short') });
    frag.hud.push({ on: ev('short'), as: 'toast', text: `Not full yet: collect more before you empty the ${vehicle}`, ttl: 2.2 });
    payOut(paid);
    R.push({ on: paid, do: 'set', var: load, to: 0 }, { on: paid, do: 'set', var: `flag-${full}`, to: 0 });
  }

  if (mode === 'haul') {
    // DELIVERED: the vehicle called driven to its site, once a call; got out of it there, it is taken back to its spot by
    // the yard and the next call is open (clocked in again when its vehicle is got into); after the last, the first again
    const paid = ev('paid'), dv = `delivered-${id}`, n = calls.length;
    frag.vars[dv] = 0;
    calls.forEach((C, k) => {
      const sz = n > 1 ? `shift-${id}-site-${k + 1}` : `shift-${id}-site`, at = ev(`site:${k + 1}`);
      if (n > 1) Object.assign(frag.vars, { [`flag-on-${id}-${k + 1}`]: 0, [`flag-done-${id}-${k + 1}`]: 0 });
      zone(sz, C.site.at, C.site);
      R.push({ on: 'enter', match: { zone: sz }, if: { var: inV, gte: 1 }, do: 'emit', type: n > 1 ? `${at}:0` : at });
      if (n > 1) R.push({ on: `${at}:0`, if: { var: callVar, eq: k + 1 }, do: 'emit', type: at });
      if (took) R.push({ on: 'enter', match: { zone: sz }, if: { var: inV, eq: 0 }, do: 'emit', type: ev('afoot') });
      once(at, `${at}:1`);
      R.push({ on: `${at}:1`, if: { var: dv, eq: 0 }, do: 'emit', type: paid });
      if (n > 1) R.push({ on: `${at}:1`, if: { var: dv, eq: 0 }, do: 'set', var: `flag-done-${id}-${k + 1}`, to: 1 }, { on: `${at}:1`, if: { var: dv, eq: 0 }, do: 'emit', type: `flag:done-${id}-${k + 1}` });
      // (got out of it there: back to its spot, the next call open)
      if (isVec(C.back)) {
        const back = ev(`return:${k + 1}`);
        R.push({ on: 'dismounted', match: { mount: C.cab }, if: { var: dv, gte: 1 }, do: 'emit', type: n > 1 ? `${back}:0` : back });
        if (n > 1) R.push({ on: `${back}:0`, if: { var: callVar, eq: k + 1 }, do: 'emit', type: back });
        R.push({ on: back, do: 'move', target: C.cab, to: C.back.slice() }, { on: back, do: 'set', var: dv, to: 0 });
        if (p.repeat === true) R.push({ on: back, do: 'set', var: `flag-${on}`, to: 0 });
        if (n > 1) R.push(k + 1 < n ? { on: back, do: 'set', var: callVar, to: k + 2 } : { on: back, do: 'set', var: callVar, to: 1 });
        // (the last call back: every call open again, the round from its first)
        if (n > 1 && k + 1 === n && p.repeat === true) R.push(...calls.flatMap((_, j) => [{ on: back, do: 'set', var: `flag-on-${id}-${j + 1}`, to: 0 }, { on: back, do: 'set', var: `flag-done-${id}-${j + 1}`, to: 0 }]));
        frag.hud.push({ on: back, as: 'toast', text: `The ${C.vehicle ?? vehicle} goes back to the ${yard}.${n > 1 ? ' The next call is in' : ' Another job when you are ready'}`, ttl: 2.6 });
      }
    });
    if (took) R.push({ on: ev('afoot'), if: { var: took, gte: 1 }, do: 'emit', type: ev('need') });
    payOut(paid);
    R.push({ on: paid, do: 'set', var: dv, to: 1 });
  }
  if (mode === 'mow') {
    // A ROUND ON THE LAWN, in its mower: clocked in, the clock set and the grass long; `live` while in it on the clock
    // (one var, so a cell's cut is two steps); each cell entered then cut once; `goal` of them pays; the clock run out
    // ends it, its grass growing back; got out, the mower goes back to its shed and the round ends with it
    const paid = ev('paid'), live = `live-${id}`, left = `left-${id}`, T = Number.isFinite(p.time) && p.time > 0 ? p.time : 150;
    const G = Math.max(1, Math.min(N, Math.ceil(N * (Number.isFinite(p.goal) && p.goal > 0 && p.goal <= 1 ? p.goal : 0.85)))), over = ev('over');
    Object.assign(frag.vars, { [live]: 0, [left]: 0 });
    const regrow = (on) => [{ on, do: 'set', var: n, to: 0 }, ...stops.map((_, k) => ({ on, do: 'set', var: `flag-${stopFlag(k)}`, to: 0 }))];
    R.push({ on: ev('clock'), do: 'set', var: live, to: 1 }, { on: ev('clock'), do: 'set', var: left, to: T }, ...regrow(ev('clock')));
    stops.forEach((s0, k) => {
      const z = `shift-${id}-${k + 1}`, f = `flag-${stopFlag(k)}`, hit = ev(`stop:${k + 1}`);
      zone(z, s0.at, s0);
      R.push({ on: 'enter', match: { zone: z }, if: { var: live, gte: 1 }, do: 'emit', type: `${hit}:0` }, { on: `${hit}:0`, if: { var: f, eq: 0 }, do: 'emit', type: hit });
      R.push({ on: hit, do: 'set', var: f, to: 1 }, { on: hit, do: 'emit', type: `flag:${stopFlag(k)}` }, { on: hit, do: 'inc', var: n, by: 1 }, { on: hit, do: 'emit', type: ev('took') });
    });
    // (the clock: a second at a time while it runs)
    frag.timers.push({ every: 1, emit: { type: ev('sec') }, while: { var: live, gte: 1 } });
    R.push({ on: ev('sec'), do: 'inc', var: left, by: -1, min: 0 }, { on: ev('sec'), if: { var: left, lte: 0 }, do: 'emit', type: ev('timeout') });
    R.push({ on: ev('took'), if: { var: n, gte: G }, do: 'emit', type: `${ev('took')}:all` });
    R.push({ on: `${ev('took')}:all`, if: { var: live, gte: 1 }, do: 'emit', type: ev('won') });
    once(ev('won'), paid);
    payOut(paid);
    // (a round over, won or run out or left: off the clock, the next got into starts another)
    for (const e of [ev('won'), ev('timeout')]) R.push({ on: e, do: 'emit', type: over });
    R.push({ on: over, do: 'set', var: live, to: 0 }, { on: over, do: 'set', var: `flag-${on}`, to: 0 });
    R.push(...regrow(ev('timeout')));
    frag.hud.push({ on: ev('timeout'), as: 'toast', text: `Out of time: the grass grows back. Take the ${vehicle} out again for another round`, ttl: 3.2 });
    // (got off: the mower back in its shed; a round still running ends, its grass growing back)
    if (isVec(p.back)) {
      const back = ev('return');
      R.push({ on: 'dismounted', match: { mount: p.cabs[0] }, do: 'emit', type: back });
      R.push({ on: back, do: 'move', target: p.cabs[0], to: p.back.slice() }, { on: back, if: { var: live, gte: 1 }, do: 'emit', type: `${back}:live` });
      R.push({ on: `${back}:live`, do: 'emit', type: over }, ...regrow(`${back}:live`));
      frag.hud.push({ on: back, as: 'toast', text: `The ${vehicle} goes back in the ${yard === 'park' ? 'shed' : yard}`, ttl: 2.2 });
    }
  }

  if (mode === 'sweep') {
    // SWEPT: each heap of litter driven over in the vehicle, once a round; every one swept pays and the streets get dirty
    // again (a standing one); a word at each quarter swept
    const paid = ev('paid'), q = [1, 2, 3].map((j) => Math.ceil((N * j) / 4));
    stops.forEach((s0, k) => {
      const z = `shift-${id}-${k + 1}`, f = `flag-${stopFlag(k)}`, hit = ev(`stop:${k + 1}`);
      zone(z, s0.at, s0);
      R.push({ on: 'enter', match: { zone: z }, if: { var: inV, gte: 1 }, do: 'emit', type: `${hit}:0` }, { on: `${hit}:0`, if: { var: f, eq: 0 }, do: 'emit', type: hit });
      R.push({ on: hit, do: 'set', var: f, to: 1 }, { on: hit, do: 'emit', type: `flag:${stopFlag(k)}` }, { on: hit, do: 'inc', var: n, by: 1 }, { on: hit, do: 'emit', type: ev('took') });
    });
    for (const m of q) R.push({ on: ev('took'), if: { var: n, eq: m }, do: 'emit', type: ev(`part:${m}`) });
    q.forEach((m, j) => frag.hud.push({ on: ev(`part:${m}`), as: 'toast', text: `${['A quarter', 'Half', 'Three quarters'][j]} of the streets swept`, ttl: 1.8 }));
    // (every one swept: its count, each heap counted once by its own flag; never a chain of its flags, which runs past
    // the bus's depth for a street's worth)
    R.push({ on: ev('took'), if: { var: n, gte: N }, do: 'emit', type: `${ev('took')}:all` });
    once(`${ev('took')}:all`, paid);
    payOut(paid);
    R.push({ on: paid, do: 'set', var: n, to: 0 });
    if (p.repeat === true) R.push(...stops.map((_, k) => ({ on: paid, do: 'set', var: `flag-${stopFlag(k)}`, to: 0 })));
  }

  if (mode === 'dig') {
    // OPERATED (the page says each scoop and each tip of the machine's bucket: scene/channels/operate.js
    // `shift:scoop:<id>`, `shift:tip:<id>`), in the machine: a scoop fills an empty bucket; a full bucket tipped into the
    // truck is a load, `loads` of them fill it, which pays and it is sent off empty
    const bucket = `bucket-${id}`, load = `load-${id}`, L = p.loads, paid = ev('paid');
    Object.assign(frag.vars, { [bucket]: 0, [load]: 0 });
    R.push({ on: ev('scoop'), if: { var: inV, gte: 1 }, do: 'emit', type: `${ev('scoop')}:in` }, { on: `${ev('scoop')}:in`, if: { var: bucket, eq: 0 }, do: 'emit', type: ev('full') });
    R.push({ on: ev('full'), do: 'set', var: bucket, to: 1 });
    R.push({ on: ev('tip'), if: { var: inV, gte: 1 }, do: 'emit', type: `${ev('tip')}:in` }, { on: `${ev('tip')}:in`, if: { var: bucket, gte: 1 }, do: 'emit', type: ev('tipped') });
    R.push({ on: ev('tipped'), do: 'set', var: bucket, to: 0 }, { on: ev('tipped'), do: 'inc', var: load, by: 1 }, { on: ev('tipped'), do: 'inc', var: n, by: 1 }, { on: ev('tipped'), if: { var: load, gte: L }, do: 'emit', type: `${ev('tipped')}:full` });
    once(`${ev('tipped')}:full`, paid);
    frag.hud.push({ on: ev('full'), as: 'toast', text: 'Bucket full: swing over the tipper and open it', ttl: 2 }, { on: ev('tipped'), as: 'toast', text: typeof p.done === 'string' && p.done ? p.done : 'Tipped', ttl: 1.4 });
    payOut(paid);
    R.push({ on: paid, do: 'set', var: load, to: 0 });
  }

  return {
    world: { ...frag, sources },
    produces: reward.length ? [{ type: 'grant', slice: BAG }] : [],
    emits: [`errand:done:${id}`],
  };
}
