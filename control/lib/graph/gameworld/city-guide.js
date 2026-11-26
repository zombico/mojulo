/**
 * THE CITY'S GUIDE — what a played town or district says as it opens, and where to go: the page's guide
 * (scene/channels/guide.js: an intro, the controls as lessons with the hero in hand, then THE WAY ON, a line with an
 * arrow and the metres to it and a pillar of light where it stands), read off the level's own recipe so it never says a
 * thing the level does not have. The way on is the game's loop made visible: a car to get into (the nearest one the
 * level stands), then a job's pick-up and its hand-in (the errand's legs, errand.js: its trade and its deliver, where
 * the level laid them); a STANDING job (`repeat`) goes round again from its pick-up. With no job the city is simply
 * open, and says so.
 *
 *   CITY_GUIDE                 its numbers and its words
 *   jobsOf(mechanics)          → a level's jobs, each its steps in order (see below)
 *   jobQuests(mechanics)       → the same jobs as the journal's quests (playscape/ui/quests.js)
 *   cityGuide(manifest)        → { intro, lessons, steps: [{ id, say, kind, at, radius, says? }], loop?, rounds?, done } | null:
 *                              a level manifest (its title, entities, game.mechanics); null where it stands no car
 *
 * Pure: the level's recipe in, the guide out.
 */
export const CITY_GUIDE = Object.freeze({
  // how near a car is "reached" (m): its door's reach
  car: 3.4,
  // the controls, taught in order with the hero in hand (guide.js lessons: `fact` what the pilot does to pass one)
  lessons: Object.freeze([
    Object.freeze({ keys: 'W A S D  walk', fact: 'move' }),
    Object.freeze({ keys: 'E  get into a car · E  get out when stopped' }),
    Object.freeze({ keys: 'W  drive · S  brake · A D  steer' }),
  ]),
  open: 'The city is open: take any car',
  // the key a driving job's pile is held at (scene/channels/job-stops.js)
  hold: 'F',
});

const words = (item) => String(item).replace(/-/g, ' ');
// a store card's id as the shop people call it: 'gun-store' the gun store, 'pharmacy' the pharmacy, 'apparel' the apparel shop
const shop = (card) => { const w = words(card); return /(store|shop|pharmacy|diner|market|bakery|cafe|bar)$/.test(w) ? w : `${w} shop`; };
/** A contact as it is called: the level's one unnamed contact 'Your contact', a named one its word ('Dispatch'). */
export const contactName = (id) => (!id || id === 'contact' ? 'Your contact' : `${words(id)[0].toUpperCase()}${words(id).slice(1)}`);
/** A phone app as it is called: 'taskfu' TaskFu, 'jobsified' Jobsified (the city's driving jobs, jobsified.js), any
 * other its word ('Runner'). */
export const APP_NAMES = Object.freeze({ taskfu: 'TaskFu', jobsified: 'Jobsified' });
export const appName = (id) => APP_NAMES[id] ?? `${words(id)[0].toUpperCase()}${words(id).slice(1)}`;
const r3 = (v) => Math.round(v * 1000) / 1000;
const at3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2] ?? 0)];

/**
 * A level's JOBS, read off its laid errand legs (errand.js layErrand: its trades and its hand-ins, each where it
 * stands): each job its hand-in's, its steps in the order they are done (what it asks for after what that is had for,
 * then the hand-in), each a line of what to do and where. What the guide leads through and what the journal keeps
 * (jobQuests) are these, so the two never say different things.
 *   → [{ id, name, repeat, steps: [{ id, say, at, radius, says?, flag?, take? }], starts?, called?, contact?, app? }]
 * (`starts`: the flag that begins it, where it is given; `called`: given by phone; `contact`: who gives it; `app`: the
 * phone app that gives it, in place of anyone; `faction`: the side whose board posts it, its one step an act done in a zone)
 */
export function jobsOf(mechanics) {
  const M = Array.isArray(mechanics) ? mechanics : [], out = [];
  for (const J of M.filter((m) => m && m.kind === 'deliver' && Array.isArray(m.at))) {
    const steps = [];
    // (what it asks for, each after what it is had for: a price is picked up before the counter it is spent at)
    const seen = new Set(), had = (item) => {
      if (seen.has(item)) return;
      seen.add(item);
      const T = M.find((m) => m && m.kind === 'trade' && m.item === item && Array.isArray(m.at));
      if (!T) return;
      for (const n of T.needs ?? []) had(n.item);
      // (bought over a counter where it has a price, `needs`; picked up otherwise; `place` the shop it stands at or in)
      steps.push({ id: `pick-${T.item}`, say: `${T.needs?.length ? 'Buy' : 'Pick up'} the ${words(T.item)}${T.place ? ` ${T.till ? 'in' : 'at'} the ${shop(T.place)}` : ''}`, at: at3(T.at), radius: T.radius ?? 2, says: `${words(T.item)[0].toUpperCase()}${words(T.item).slice(1)} ${T.needs?.length ? 'bought' : 'aboard'}`, ...(T.flag ? { flag: T.flag } : {}) });
    };
    // (taken first, where it is offered: its giver before a shop; lowerOffer)
    const O = M.find((m) => m && m.kind === 'offer' && m.id === (J.id ?? 'errand') && Array.isArray(m.at));
    // (a job that comes by phone, lowerCall, is taken nowhere: it starts when the call comes)
    const Cl = O ? null : M.find((m) => m && m.kind === 'call' && m.id === (J.id ?? 'errand'));
    const who = J.contact ?? O?.contact ?? Cl?.contact;
    // (a phone app's task, lowerTask: taken on the phone, wherever the hero is; the guide waits on it, `when`, its light
    // where the task begins)
    const Tk = O || Cl ? null : M.find((m) => m && m.kind === 'task' && m.id === (J.id ?? 'errand'));
    if (Tk) steps.push({ id: `app-${Tk.id}`, say: `Take the ${words(Tk.id)} task on ${Tk.name ?? appName(Tk.app)} · P`, at: null, radius: 0, when: `flag-${Tk.flag}`, take: true });
    if (O) steps.push({ id: `take-${O.id}`, say: `Meet ${contactName(O.contact).toLowerCase()}${O.place ? ` at the ${shop(O.place)}` : ''}`, at: at3(O.at), radius: O.radius ?? 2.5, ...(O.says ? { says: O.says } : {}), take: true });
    for (const w of J.wants ?? []) had(w.item);
    const paid = (J.reward ?? []).map((r) => `${r.n ?? 1} ${words(r.item)}`).join(', '), id = J.id ?? 'errand';
    // (a one-off is brought home: back to who gave it)
    steps.push({ id: `deliver-${id}`, say: J.home ? `Bring the ${(J.wants ?? []).map((w) => words(w.item)).join(', ') || 'goods'} back to ${contactName(who).toLowerCase()}${J.place ? ` at the ${shop(J.place)}` : ''}` : `Deliver the ${(J.wants ?? []).map((w) => words(w.item)).join(', ') || 'goods'}${J.place ? ` to the ${shop(J.place)}` : ''}`, at: at3(J.at), radius: J.radius ?? 2, ...(paid ? { says: `Paid ${paid}` } : {}), ...(J.flag ? { flag: J.flag } : {}) });
    if (Tk) { const first = steps.find((x) => x.at); steps[0].at = first ? first.at.slice() : at3(J.at); }
    out.push({ id, name: `${words(id)[0].toUpperCase()}${words(id).slice(1)}`, repeat: J.repeat === true, steps, ...(O ? { starts: O.flag } : Cl ? { starts: Cl.flag, called: true } : Tk ? { starts: Tk.flag, app: Tk.app, ...(Tk.apps ? { apps: Tk.apps } : {}), ...(Tk.tags ? { tags: Tk.tags } : {}) } : {}), ...(who ? { contact: who } : {}) });
  }
  // (a DRIVING JOB, lowerShift (jobsified.js), by its mode: taken on its app, then into its vehicle, then its work in
  // it. Each step waits on its own flag (`when`), since being at a place on foot is not doing it, but a standing job's
  // last, reached by coming to it (its flags open again as it is paid). `loop`: the step a standing one goes round from)
  for (const Sh of M.filter((m) => m && m.kind === 'shift' && Array.isArray(m.depot))) {
    const Tk = M.find((m) => m && m.kind === 'task' && m.id === Sh.id), depot = at3(Sh.depot), r = Sh.radius ?? 9, cap = (w) => `${w[0].toUpperCase()}${w.slice(1)}`, mode = Sh.mode ?? 'route';
    const yard = Sh.yard ?? 'depot', vehicle = Sh.vehicle ?? 'vehicle', paid = (Sh.reward ?? []).map((x) => `${x.n ?? 1} ${words(x.item)}`).join(', '), steps = [];
    const reach = (Z) => (Array.isArray(Z.half) ? Math.max(...Z.half) : Z.radius ?? 7);
    const last = (x) => ({ ...x, ...(Sh.repeat ? {} : { when: `flag-done-${Sh.id}` }), ...(paid ? { says: `Paid ${paid}` } : {}), flag: `done-${Sh.id}` });
    if (Tk) steps.push({ id: `app-${Tk.id}`, say: `Take the ${words(Sh.name ?? Sh.id).toLowerCase()} on ${Tk.name ?? appName(Tk.app)} · P`, at: depot, radius: 0, when: `flag-${Tk.flag}`, take: true });
    // (an issued vehicle, `back` its spot: taken where it stands; a depot's own: got into at the yard)
    const clock = { id: `clock-${Sh.id}`, say: Sh.back ? `Take the ${vehicle}${Sh.place ? ` outside the ${shop(Sh.place)}` : ''}${Sh.yard ? ` by the ${yard}` : ''}` : `Get in a ${vehicle} at the ${yard}`, at: depot, radius: r, when: `flag-on-${Sh.id}`, flag: `on-${Sh.id}` };
    steps.push(clock);
    let loop = steps.length;
    if (mode === 'route') {
      // (its stops in order, each held at; the last pays, so it is the job's last step)
      const N = Sh.stops.length, say = (q) => `${Sh.stop ?? 'Make the stop'}${q.place ? ` by the ${shop(q.place)}` : ''} · hold ${CITY_GUIDE.hold}`;
      Sh.stops.slice(0, -1).forEach((q, k) => steps.push({ id: `stop-${Sh.id}-${k + 1}`, say: say(q), at: at3(q.at), radius: q.radius ?? 7, when: `flag-stop-${Sh.id}-${k + 1}`, flag: `stop-${Sh.id}-${k + 1}` }));
      const q = Sh.stops[N - 1];
      steps.push(last({ id: `stop-${Sh.id}-${N}`, say: say(q), at: at3(q.at), radius: q.radius ?? 7 }));
    } else if (mode === 'collect') {
      // (the piles: the way to the nearest not yet taken, `near`; done when the vehicle is full)
      steps.push({ id: `collect-${Sh.id}`, say: `${Sh.stop ?? 'Collect'} · hold ${CITY_GUIDE.hold}`, at: at3(Sh.stops[0].at), radius: 0, near: Sh.stops.map((q, k) => ({ at: at3(q.at), v: `flag-stop-${Sh.id}-${k + 1}` })), when: `flag-full-${Sh.id}`, flag: `full-${Sh.id}` });
      const U = Sh.unload ?? { at: Sh.depot, radius: r };
      steps.push(last({ id: `unload-${Sh.id}`, say: `Take the full ${vehicle} to ${Sh.unload ? 'the dump' : `the ${yard}`}`, at: at3(U.at), radius: reach(U) }));
    } else if (Array.isArray(Sh.calls) && Sh.calls.length > 1) {
      // (a heavy call: each call its vehicle taken where it stands and driven to its site, in turn, each waited on by its
      // own flags; the round from the first)
      steps.pop();
      loop = steps.length;
      Sh.calls.forEach((C, k) => {
        const w = C.vehicle ?? vehicle;
        steps.push({ id: `clock-${Sh.id}-${k + 1}`, say: `Take the ${w}${C.place ? ` outside the ${shop(C.place)}` : ''}${Sh.yard ? ` by the ${yard}` : ''}`, at: at3(C.back ?? Sh.depot), radius: r, when: `flag-on-${Sh.id}-${k + 1}`, flag: `on-${Sh.id}-${k + 1}` });
        steps.push({ id: `haul-${Sh.id}-${k + 1}`, say: `Drive the ${w} to the ${C.site.to ?? (C.site.place ? shop(C.site.place) : 'job')}`, at: at3(C.site.at), radius: reach(C.site), when: `flag-done-${Sh.id}-${k + 1}`, ...(paid ? { says: `Paid ${paid}` } : {}), flag: `done-${Sh.id}-${k + 1}` });
      });
    } else {
      loop = steps.length - 1;
      steps.push(last({ id: `haul-${Sh.id}`, say: `Drive the ${vehicle} to the ${Sh.site.to ?? (Sh.site.place ? shop(Sh.site.place) : 'job')}`, at: at3(Sh.site.at), radius: reach(Sh.site) }));
    }
    out.push({ id: Sh.id, name: Sh.name ?? cap(words(Sh.id)), repeat: Sh.repeat === true, steps, shift: true, loop, ...(Tk ? { starts: Tk.flag, app: Tk.app, ...(Tk.apps ? { apps: Tk.apps } : {}), ...(Tk.tags ? { tags: Tk.tags } : {}) } : {}) });
  }
  // (a faction's POSTINGS, lowerAct: each one step, an act done somewhere in a zone; taken on the phone, on its board)
  for (const A of M.filter((m) => m && m.kind === 'act' && Array.isArray(m.at))) out.push({ id: A.id, name: A.title ?? `${words(A.id)[0].toUpperCase()}${words(A.id).slice(1)}`, repeat: false, faction: A.faction, starts: A.flag,
    steps: [{ id: `act-${A.id}`, say: A.line ?? words(A.verb), at: at3(A.at), radius: A.radius ?? 2, flag: A.done, zone: true }] });
  return out;
}

/** A level's jobs as its QUESTS (playscape/ui/quests.js: the journal's, a step done when its flag is set): each job
 * whose every step carries a flag, its steps' lines the guide's own. */
export function jobQuests(mechanics) {
  // (a job that is offered begins when it is taken, `starts`: it is not in the journal before; taking it is no step)
  return jobsOf(mechanics).map((J) => ({ ...J, steps: J.steps.filter((x) => !x.take) })).filter((J) => J.steps.every((x) => x.flag)).map((J) => ({ id: J.id, name: J.name, ...(J.starts ? { starts: J.starts } : {}), steps: J.steps.map((x) => ({ log: x.say, done: x.flag })) }));
}

export function cityGuide(manifest) {
  const M = manifest ?? {}, entities = Array.isArray(M.entities) ? M.entities : [];
  const hero = entities.find((e) => e && e.pilotable && e.transform), cabs = entities.filter((e) => e?.mount?.cab && !e.mount.spare && e.transform);
  if (!hero || !cabs.length) return null;
  const from = hero.transform.pos, d = (e) => Math.hypot(e.transform.pos[0] - from[0], e.transform.pos[1] - from[1]);
  const car = cabs.reduce((m, e) => (d(e) < d(m) ? e : m), cabs[0]);
  // (the car is reached by being in one, whichever: standing beside it is not it. `cab`: scene/channels/guide.js)
  const steps = [{ id: 'car', say: 'Get into a car', kind: 'find', at: at3(car.transform.pos), radius: CITY_GUIDE.car, cab: true }];
  // each job's steps in the order it is done; the first standing job goes round again from its pick-up
  let loop = null;
  const jobs = jobsOf(M.game?.mechanics), rounds = [];
  for (const J of jobs) {
    if (J.faction) continue;   // (a faction's posting is a side taken, never the way on: its board, the journal and the map say it)
    // (a DRIVING JOB, a shift: its own ROUND, guide.js `rounds`. Taken on the phone, the guide goes to its first step
    // after the taking; a standing one goes back to its first stop after its way back)
    if (J.shift) {
      const at = steps.length + (J.steps[0]?.take ? 1 : 0);
      if (J.starts) rounds.push({ when: `flag-${J.starts}`, at, ...(J.repeat ? { from: steps.length + J.loop, end: steps.length + J.steps.length } : {}) });
    } else if (J.repeat && loop === null) loop = steps.length + (J.steps[0]?.take ? 1 : 0);   // (a standing job goes round again from its pick-up: it is taken once)
    for (const { flag: _flag, take: _take, ...x } of J.steps) steps.push({ ...x, kind: 'find' });
  }
  const job = jobs.some((J) => !J.faction);
  return {
    // (the game's name: a level's title is `<game> · <level> · <stage>`)
    intro: `${M.title ? `${String(M.title).split(' · ')[0]}. ` : ''}${job ? 'Take any car. A job waits where the light stands.' : 'Take any car. The city is open.'}`,
    lessons: CITY_GUIDE.lessons.map((l) => ({ ...l })),
    steps,
    ...(loop !== null ? { loop } : {}),
    ...(rounds.length ? { rounds } : {}),
    done: CITY_GUIDE.open,
  };
}
