/**
 * THE PHONE — once a job's giver is met they are a CONTACT: they reach the hero by phone, with what a job's next step
 * is, with word of each step done, and with the next job (errand.js `contact`: the first job of a contact is taken
 * where they stand, each one after it comes as a call when the one before is done; a one-off is brought back to them,
 * and that is the only time they need be gone back to). This lays the phone as a screen for mana-ui (control/lib/mana-ui:
 * the contacts beside the thread of the one in focus); the page hosts it (scene/channels/phone-channel.js), opened with
 * a key. Everything in it is read off the level's own mechanics, so it never says a job the level does not have, and a
 * thread is the level's flags read in order: nothing of its own to save. How it is dressed is the interface's to say
 * (a gameworld's `ui.phone`), every word optional and none a colour: the look is the game's theme.
 *
 *   ui.phone: false | { title?: 'Phone', apps?: { <app>: { name?, tags?: [word] } } }
 *       apps    the phone's apps, each a tab: what it is called and the TAGS it carries (ride, food, courier). A game
 *               may have several; a task (an errand with `tags`) is listed by every app that carries one of its tags.
 *               Unsaid, a game's tagged tasks are all TaskFu's
 *
 *   PHONE_UI                       the defaults and its words
 *   readPhoneUi(v, where?)         → errors[] (teaching)
 *   An APP is not a person (errand.js `app`; TaskFu): a tab of the phone, subscribed to there, whose tasks are taken
 *   there and are quests with a reward like any job. Nothing is met and nothing is gone back to.
 *
 *   A FACTION's board (factions.js) is a tab while the hero is with it: what it posts at the hero's standing, each an
 *   act, taken there like a task.
 *
 *   phoneUi(manifest, ui?)         → { title, factions: [{ id, name, in, standing, postings }], apps: [{ id, name, sub, tasks: [{ id, name, took, done, repeat, pays, steps }] }], contacts: [{ id, name, met, jobs: [{ id, name, took, done, called, says,
 *                                    paid, steps: [{ say, var }] }] }] } | null
 *                                    (`met`, `took`, `done`, a step's `var`: the bus's vars that say so); null for a
 *                                    level no one gives a job in, or `ui.phone: false`
 *   taskApps(job, apps?)           → the apps a job is on: its own `app`, and each that lists one of its `tags`
 *   appTitle(id, apps?)            → an app's name
 *   phoneBoard(faction, vars, W)   → a faction's board as the flags stand: its standing, then its postings at it
 *   phoneThread(contact, vars, W)  → [{ who, text, call? }]: a contact's thread as the flags stand, oldest first
 *   phoneTasks(app, vars, W)       → an app's rows as the flags stand: its one row to subscribe by, or its tasks
 *                                    [{ id, name, state, lines: [{ who, text }] }] (id 'sub:<app>' | 'task:<id>')
 * Pure.
 */
import { jobsOf, contactName, appName } from './city-guide.js';

export const PHONE_UI = Object.freeze({ title: 'Phone', you: 'You', next: 'Next: ', done: 'Done. ', home: 'Bring it back to me when you have it.', again: 'There is always another.',
  // an app's words: what it is before it is subscribed to, its one row then, and a task's states
  pitch: 'Paid tasks around the city, sent to your phone. No one to meet: take one here, do it, get paid.', subscribe: 'Subscribe', open: 'Open', active: 'Active', paid: 'Paid', task: 'Task', pays: 'Pays', tags: 'Tags', carries: 'Carries',
  // a faction's board
  standing: 'Standing', with: 'You are with ', job: 'Job', locked: ' more at higher standing', finished: 'Done', leave: 'Leave', leaving: 'Take this row to walk away. Your standing is kept, and any faction\'s contact will have you.' });
const KEYS = ['title', 'apps'];
const APP_KEYS = ['name', 'tags'], WORD = /^[a-z][a-z0-9-]{0,31}$/;
/** The app every game has unless it names its own: it carries any tag no other app lists. */
export const DEFAULT_APP = 'taskfu';
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readPhoneUi(v, where = 'ui.phone') {
  if (v === undefined || v === false) return [];
  if (!isObj(v)) return [`${where} is false (no phone) or { ${KEYS.join('?, ')}? }`];
  const errors = [];
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not a phone setting (${KEYS.join(', ')})`);
  if (v.title !== undefined && !(typeof v.title === 'string' && v.title.trim() && v.title.length <= 40)) errors.push(`${where}.title is what the screen is called, in words`);
  if (v.apps !== undefined) {
    if (!isObj(v.apps) || !Object.keys(v.apps).length) errors.push(`${where}.apps is { <app>: { name?, tags?: [word] } }: the phone's apps, each a tab (taskfu: { name: 'TaskFu', tags: ['ride'] })`);
    else for (const [id, A] of Object.entries(v.apps)) {
      if (!WORD.test(id)) errors.push(`${where}.apps.${id}: an app's id is one lower-case word`);
      if (!isObj(A)) { errors.push(`${where}.apps.${id} is { ${APP_KEYS.join('?, ')}? }`); continue; }
      for (const k of Object.keys(A)) if (!APP_KEYS.includes(k)) errors.push(`${where}.apps.${id}.${k}: not an app setting (${APP_KEYS.join(', ')})`);
      if (A.name !== undefined && !(typeof A.name === 'string' && A.name.trim() && A.name.length <= 24)) errors.push(`${where}.apps.${id}.name is what the app is called, in words`);
      if (A.tags !== undefined && (!Array.isArray(A.tags) || !A.tags.length || A.tags.some((t) => typeof t !== 'string' || !WORD.test(t)))) errors.push(`${where}.apps.${id}.tags is the kinds of task it carries, lower-case words (ride, food, courier)`);
    }
  }
  return errors;
}

/** The apps a job is on (errand.js `app`, `tags`): the one it names, and every app that lists one of its tags; a
 * tagged job no app lists is on the default app. None for a job a person gives.   → [app id], its own first */
export function taskApps(job, apps = undefined) {
  const out = [], add = (a) => { if (a && !out.includes(a)) out.push(a); }, tags = Array.isArray(job?.tags) ? job.tags : [];
  add(job?.app);
  if (tags.length && isObj(apps)) for (const [id, A] of Object.entries(apps)) if ((A?.tags ?? []).some((t) => tags.includes(t))) add(id);
  if (tags.length && !out.length) add(DEFAULT_APP);
  return out;
}
/** An app's name: the interface's (`ui.phone.apps.<id>.name`), else its word's (city-guide.js appName). */
export const appTitle = (id, apps = undefined) => (isObj(apps) && typeof apps[id]?.name === 'string' && apps[id].name.trim() ? apps[id].name.trim() : appName(id));

export function phoneUi(manifest, ui = undefined) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [];
  if (ui === false) return null;
  const contacts = [];
  for (const J of jobsOf(M)) {
    if (!J.starts || J.app || J.faction) continue;   // a job no one gives is no one's to call about; an app's is on its own tab
    const who = J.contact ?? 'contact', D = M.find((m) => m?.kind === 'deliver' && (m.id ?? 'errand') === J.id), O = M.find((m) => (m?.kind === 'offer' || m?.kind === 'call') && m.id === J.id);
    let C = contacts.find((c) => c.id === who);
    if (!C) contacts.push((C = { id: who, name: contactName(who), met: `flag-${J.starts}`, jobs: [] }));
    const hand = J.steps[J.steps.length - 1];
    C.jobs.push({ id: J.id, name: J.name, took: `flag-${J.starts}`, ...(hand?.flag ? { done: `flag-${hand.flag}` } : {}), called: J.called === true, home: D?.home === true, repeat: J.repeat,
      says: O?.says ?? '', paid: hand?.says ?? '', steps: J.steps.filter((x) => !x.take).map((x) => ({ say: x.say, ...(x.flag ? { var: `flag-${x.flag}` } : {}) })) });
  }
  // THE APPS (errand.js `app`: TaskFu): each a tab, subscribed to there; its tasks the level's own jobs, each what it
  // asks, what it pays and the flag taking it sets
  const apps = [], conf = isObj(ui) ? ui.apps : undefined;
  for (const J of jobsOf(M)) {
    if (!J.app) continue;
    // (what it pays: its hand-in's, or a driving job's own, a shift's: jobsified.js)
    const hand = J.steps[J.steps.length - 1], D = M.find((m) => (m?.kind === 'deliver' || m?.kind === 'shift') && (m.id ?? 'errand') === J.id);
    const task = { id: J.id, name: J.name, took: `flag-${J.starts}`, ...(hand?.flag ? { done: `flag-${hand.flag}` } : {}), repeat: J.repeat, ...(J.tags?.length ? { tags: J.tags.slice() } : {}),
      pays: (D?.reward ?? []).map((r) => `${r.n ?? 1} ${String(r.item).replace(/-/g, ' ')}`).join(', '), steps: J.steps.filter((x) => !x.take).map((x) => ({ say: x.say, ...(x.flag ? { var: `flag-${x.flag}` } : {}) })) };
    // (a task is on each app its tags put it on, the same task: taken on one, it is taken)
    for (const id of J.apps ?? [J.app]) {
      let A = apps.find((a) => a.id === id);
      if (!A) apps.push((A = { id, name: appTitle(id, conf), sub: `flag-sub-${id}`, ...(conf?.[id]?.tags?.length ? { tags: conf[id].tags.slice() } : {}), tasks: [] }));
      A.tasks.push(task);
    }
  }
  // THE FACTIONS (factions.js): each a tab while the hero is with it, its BOARD: what it posts at the hero's standing
  const pay = (r) => (r ?? []).map((x) => `${x.n ?? 1} ${String(x.item).replace(/-/g, ' ')}`).join(', ');
  const factions = M.filter((m) => m?.kind === 'join').map((Jn) => ({ id: Jn.faction, name: Jn.name ?? Jn.faction, in: `flag-in-${Jn.faction}`, standing: `standing-${Jn.faction}`,
    postings: M.filter((a) => a?.kind === 'act' && a.faction === Jn.faction).map((a) => ({ id: a.id, name: a.title ?? a.id, line: a.line ?? a.verb, took: `flag-${a.flag}`, done: `flag-${a.done}`, rank: a.rank ?? 0, standing: a.standing ?? 1, pays: pay(a.reward), ...(a.says ? { says: a.says } : {}) })) }));
  if (!contacts.length && !apps.length && !factions.length) return null;
  return { title: (isObj(ui) ? ui.title : null) ?? PHONE_UI.title, contacts, apps, factions };
}

/** A contact's thread as the flags stand (`vars`: the bus's): what they said as each job was taken (a call, after the
 * first), what is to do next, word of each step done, and what a job paid. Oldest first. Inlined by the page. */
export function phoneThread(C, vars, W) {
  const on = (v) => !!v && Number(vars[v]) >= 1, out = [];
  for (const J of C.jobs) {
    if (!on(J.took)) break;
    out.push({ who: C.name, text: (J.says || J.name) + (J.home ? ' ' + W.home : ''), call: J.called });
    const ended = on(J.done);
    for (const s of J.steps) {
      if (on(s.var) || ended) { if (s !== J.steps[J.steps.length - 1]) out.push({ who: W.you, text: s.say + ' ✓' }); continue; }
      out.push({ who: C.name, text: W.next + s.say });
      break;
    }
    if (ended) out.push({ who: C.name, text: W.done + (J.paid ? J.paid + '.' : '') + (J.repeat ? ' ' + W.again : '') });
  }
  return out;
}

/** An app's rows as the flags stand: before it is subscribed to, the one row that subscribes; after, its tasks, each
 * what it asks step by step, what it pays and where it stands (open, active, paid). Inlined by the page. */
export function phoneTasks(A, vars, W) {
  const on = (v) => !!v && Number(vars[v]) >= 1;
  if (!on(A.sub)) return [{ id: 'sub:' + A.id, name: W.subscribe, state: '', lines: [{ who: A.name, text: W.pitch }].concat(A.tags && A.tags.length ? [{ who: W.carries, text: A.tags.join(' · ') }] : []) }];
  return A.tasks.map((T) => {
    const took = on(T.took), done = on(T.done), lines = [{ who: W.task, text: T.steps.map((s, i) => (i ? s.say[0].toLowerCase() + s.say.slice(1) : s.say)).join(', then ') }];
    if (T.tags && T.tags.length) lines.push({ who: W.tags, text: T.tags.join(' · ') });
    if (T.pays) lines.push({ who: W.pays, text: T.pays + (T.repeat ? ' each time' : '') });
    if (took) { const next = T.steps.find((s) => !on(s.var)); if (next && !(done && !T.repeat)) lines.push({ who: A.name, text: W.next + next.say }); }
    return { id: 'task:' + T.id, name: T.name, state: !took ? W.open : done && !T.repeat ? W.paid : W.active, lines };
  });
}

/** A faction's board as the flags stand: the hero's standing with it, then what it posts at that standing (a posting
 * above it is not listed, only counted), each what is to be done, what it pays and where it stands. Inlined by the page. */
export function phoneBoard(F, vars, W) {
  const on = (v) => !!v && Number(vars[v]) >= 1, standing = Number(vars[F.standing]) || 0, open = F.postings.filter((P) => P.rank <= standing), locked = F.postings.length - open.length;
  const head = { id: 'side:' + F.id, name: W.standing, state: String(standing), lines: [{ who: F.name, text: W.with + F.name + '.' }].concat(locked ? [{ who: F.name, text: locked + W.locked }] : [], [{ who: W.leave, text: W.leaving }]) };
  return [head].concat(open.map((P) => {
    const lines = [{ who: W.job, text: P.line }];
    if (P.says) lines.push({ who: F.name, text: P.says });
    lines.push({ who: W.pays, text: (P.pays ? P.pays + ' · ' : '') + 'standing +' + P.standing });
    return { id: 'task:' + P.id, name: P.name, state: on(P.done) ? W.finished : on(P.took) ? W.active : W.open, lines };
  }));
}
