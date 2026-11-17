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
 *   ui.phone: false | { title?: 'Phone' }
 *
 *   PHONE_UI                       the defaults and its words
 *   readPhoneUi(v, where?)         → errors[] (teaching)
 *   An APP is not a person (errand.js `app`; TaskFu): a tab of the phone, subscribed to there, whose tasks are taken
 *   there and are quests with a reward like any job. Nothing is met and nothing is gone back to.
 *
 *   phoneUi(manifest, ui?)         → { title, apps: [{ id, name, sub, tasks: [{ id, name, took, done, repeat, pays, steps }] }], contacts: [{ id, name, met, jobs: [{ id, name, took, done, called, says,
 *                                    paid, steps: [{ say, var }] }] }] } | null
 *                                    (`met`, `took`, `done`, a step's `var`: the bus's vars that say so); null for a
 *                                    level no one gives a job in, or `ui.phone: false`
 *   phoneThread(contact, vars, W)  → [{ who, text, call? }]: a contact's thread as the flags stand, oldest first
 *   phoneTasks(app, vars, W)       → an app's rows as the flags stand: its one row to subscribe by, or its tasks
 *                                    [{ id, name, state, lines: [{ who, text }] }] (id 'sub:<app>' | 'task:<id>')
 * Pure.
 */
import { jobsOf, contactName, appName } from './city-guide.js';

export const PHONE_UI = Object.freeze({ title: 'Phone', you: 'You', next: 'Next: ', done: 'Done. ', home: 'Bring it back to me when you have it.', again: 'There is always another.',
  // an app's words: what it is before it is subscribed to, its one row then, and a task's states
  pitch: 'Paid tasks around the city, sent to your phone. No one to meet: take one here, do it, get paid.', subscribe: 'Subscribe', open: 'Open', active: 'Active', paid: 'Paid', task: 'Task', pays: 'Pays' });
const KEYS = ['title'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readPhoneUi(v, where = 'ui.phone') {
  if (v === undefined || v === false) return [];
  if (!isObj(v)) return [`${where} is false (no phone) or { ${KEYS.join('?, ')}? }`];
  const errors = [];
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not a phone setting (${KEYS.join(', ')})`);
  if (v.title !== undefined && !(typeof v.title === 'string' && v.title.trim() && v.title.length <= 40)) errors.push(`${where}.title is what the screen is called, in words`);
  return errors;
}

export function phoneUi(manifest, ui = undefined) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [];
  if (ui === false) return null;
  const contacts = [];
  for (const J of jobsOf(M)) {
    if (!J.starts || J.app) continue;   // a job no one gives is no one's to call about; an app's is on its own tab
    const who = J.contact ?? 'contact', D = M.find((m) => m?.kind === 'deliver' && (m.id ?? 'errand') === J.id), O = M.find((m) => (m?.kind === 'offer' || m?.kind === 'call') && m.id === J.id);
    let C = contacts.find((c) => c.id === who);
    if (!C) contacts.push((C = { id: who, name: contactName(who), met: `flag-${J.starts}`, jobs: [] }));
    const hand = J.steps[J.steps.length - 1];
    C.jobs.push({ id: J.id, name: J.name, took: `flag-${J.starts}`, ...(hand?.flag ? { done: `flag-${hand.flag}` } : {}), called: J.called === true, home: D?.home === true, repeat: J.repeat,
      says: O?.says ?? '', paid: hand?.says ?? '', steps: J.steps.filter((x) => !x.take).map((x) => ({ say: x.say, ...(x.flag ? { var: `flag-${x.flag}` } : {}) })) });
  }
  // THE APPS (errand.js `app`: TaskFu): each a tab, subscribed to there; its tasks the level's own jobs, each what it
  // asks, what it pays and the flag taking it sets
  const apps = [];
  for (const J of jobsOf(M)) {
    if (!J.app) continue;
    let A = apps.find((a) => a.id === J.app);
    if (!A) apps.push((A = { id: J.app, name: appName(J.app), sub: `flag-sub-${J.app}`, tasks: [] }));
    const hand = J.steps[J.steps.length - 1], D = M.find((m) => m?.kind === 'deliver' && (m.id ?? 'errand') === J.id);
    A.tasks.push({ id: J.id, name: J.name, took: `flag-${J.starts}`, ...(hand?.flag ? { done: `flag-${hand.flag}` } : {}), repeat: J.repeat,
      pays: (D?.reward ?? []).map((r) => `${r.n ?? 1} ${String(r.item).replace(/-/g, ' ')}`).join(', '), steps: J.steps.filter((x) => !x.take).map((x) => ({ say: x.say, ...(x.flag ? { var: `flag-${x.flag}` } : {}) })) });
  }
  if (!contacts.length && !apps.length) return null;
  return { title: (isObj(ui) ? ui.title : null) ?? PHONE_UI.title, contacts, apps };
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
  if (!on(A.sub)) return [{ id: 'sub:' + A.id, name: W.subscribe, state: '', lines: [{ who: A.name, text: W.pitch }] }];
  return A.tasks.map((T) => {
    const took = on(T.took), done = on(T.done), lines = [{ who: W.task, text: T.steps.map((s, i) => (i ? s.say[0].toLowerCase() + s.say.slice(1) : s.say)).join(', then ') }];
    if (T.pays) lines.push({ who: W.pays, text: T.pays + (T.repeat ? ' each time' : '') });
    if (took) { const next = T.steps.find((s) => !on(s.var)); if (next && !(done && !T.repeat)) lines.push({ who: A.name, text: W.next + next.say }); }
    return { id: 'task:' + T.id, name: T.name, state: !took ? W.open : done && !T.repeat ? W.paid : W.active, lines };
  });
}
