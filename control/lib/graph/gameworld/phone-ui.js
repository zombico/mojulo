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
 *   phoneUi(manifest, ui?)         → { title, contacts: [{ id, name, met, jobs: [{ id, name, took, done, called, says,
 *                                    paid, steps: [{ say, var }] }] }] } | null
 *                                    (`met`, `took`, `done`, a step's `var`: the bus's vars that say so); null for a
 *                                    level no one gives a job in, or `ui.phone: false`
 *   phoneThread(contact, vars)     → [{ who, text, call? }]: a contact's thread as the flags stand, oldest first
 * Pure.
 */
import { jobsOf, contactName } from './city-guide.js';

export const PHONE_UI = Object.freeze({ title: 'Phone', you: 'You', next: 'Next: ', done: 'Done. ', home: 'Bring it back to me when you have it.', again: 'There is always another.' });
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
    if (!J.starts) continue;   // a job no one gives is no one's to call about
    const who = J.contact ?? 'contact', D = M.find((m) => m?.kind === 'deliver' && (m.id ?? 'errand') === J.id), O = M.find((m) => (m?.kind === 'offer' || m?.kind === 'call') && m.id === J.id);
    let C = contacts.find((c) => c.id === who);
    if (!C) contacts.push((C = { id: who, name: contactName(who), met: `flag-${J.starts}`, jobs: [] }));
    const hand = J.steps[J.steps.length - 1];
    C.jobs.push({ id: J.id, name: J.name, took: `flag-${J.starts}`, ...(hand?.flag ? { done: `flag-${hand.flag}` } : {}), called: J.called === true, home: D?.home === true, repeat: J.repeat,
      says: O?.says ?? '', paid: hand?.says ?? '', steps: J.steps.filter((x) => !x.take).map((x) => ({ say: x.say, ...(x.flag ? { var: `flag-${x.flag}` } : {}) })) });
  }
  if (!contacts.length) return null;
  return { title: (isObj(ui) ? ui.title : null) ?? PHONE_UI.title, contacts };
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
