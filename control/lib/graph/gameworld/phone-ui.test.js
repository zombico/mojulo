// THE PHONE: a job's giver, once met, is a contact; the first job is taken where they stand, each one after it comes
// as a call; a thread is the level's own flags read in order. Hosted on mana-ui, in the theme's look alone.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { phoneUi, phoneThread, readPhoneUi, PHONE_UI } from './phone-ui.js';
import { phoneScript, phoneSpec } from '../scene/channels/phone-channel.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { readUi } from '../playscape/ui/interface-look.js';
import { lowerCall } from '../game/errand-mechanics.js';
import { MECHANIC_KINDS } from '../game/mechanics.js';

const LEVEL = { game: { mechanics: [{ kind: 'bag', slice: 'bag' },
  { kind: 'trade', item: 'gadget', job: 'parcel', at: [70, 2, 0], flag: 'had-gadget', after: 'took-parcel', place: 'electronics' },
  { kind: 'deliver', id: 'parcel', wants: [{ item: 'gadget', min: 1 }], reward: [{ item: 'coin', n: 30 }], at: [10, 8, 0], home: true, place: 'diner', flag: 'done-parcel', after: 'took-parcel' },
  { kind: 'trade', item: 'passenger', job: 'fare', at: [20, 0, 0], flag: 'had-passenger', after: 'took-fare' },
  { kind: 'deliver', id: 'fare', repeat: true, wants: [{ item: 'passenger', min: 1 }], reward: [{ item: 'coin', n: 12 }], at: [60, 0, 0], flag: 'done-fare', after: 'took-fare' },
  { kind: 'offer', id: 'parcel', at: [10, 8, 0], flag: 'took-parcel', says: 'The shop is waiting on this.', place: 'diner', contact: 'dispatch' },
  { kind: 'call', id: 'fare', flag: 'took-fare', on: 'errand:done:parcel', from: 'Dispatch', says: 'Fares are waiting.', contact: 'dispatch' }] } };

describe('the phone', () => {
  it('a level\'s givers are its contacts, each with their jobs in order: the first met, the rest called', () => {
    const G = phoneUi(LEVEL);
    expect(G.title).toBe('Phone');
    expect(G.contacts).toHaveLength(1);
    expect(G.contacts[0]).toMatchObject({ id: 'dispatch', name: 'Dispatch', met: 'flag-took-parcel' });
    expect(G.contacts[0].jobs.map((j) => [j.id, j.took, j.done, j.called, j.home])).toEqual([['parcel', 'flag-took-parcel', 'flag-done-parcel', false, true], ['fare', 'flag-took-fare', 'flag-done-fare', true, false]]);
    expect(phoneUi(LEVEL, { title: 'Burner' }).title).toBe('Burner');
    // (a level no one gives a job in has no phone; nor one that says so)
    expect(phoneUi({ game: { mechanics: LEVEL.game.mechanics.filter((m) => m.kind !== 'offer' && m.kind !== 'call') } })).toBeNull();
    expect(phoneUi(LEVEL, false)).toBeNull();
    expect(readPhoneUi({ title: 'Burner' })).toEqual([]);
    expect(readPhoneUi({ ring: 'loud' })[0]).toMatch(/not a phone setting/);
    expect(readUi({ phone: { title: '' } })[0]).toMatch(/ui.phone.title/);
  });
  it('a thread is the flags read in order: what was said, what is next, each step done, what was paid, then the call', () => {
    const C = phoneUi(LEVEL).contacts[0], T = (vars) => phoneThread(C, vars, PHONE_UI).map((m) => m.text);
    expect(T({})).toEqual([]);
    expect(T({ 'flag-took-parcel': 1 })).toEqual(['The shop is waiting on this. Bring it back to me when you have it.', 'Next: Pick up the gadget at the electronics shop']);
    expect(T({ 'flag-took-parcel': 1, 'flag-had-gadget': 1 })).toEqual(['The shop is waiting on this. Bring it back to me when you have it.', 'Pick up the gadget at the electronics shop ✓', 'Next: Bring the gadget back to dispatch at the diner']);
    const all = phoneThread(C, { 'flag-took-parcel': 1, 'flag-had-gadget': 1, 'flag-done-parcel': 1, 'flag-took-fare': 1 }, PHONE_UI);
    expect(all.map((m) => m.text)).toEqual(['The shop is waiting on this. Bring it back to me when you have it.', 'Pick up the gadget at the electronics shop ✓', 'Done. Paid 30 coin.', 'Fares are waiting.', 'Next: Pick up the passenger']);
    expect(all[3]).toMatchObject({ who: 'Dispatch', call: true });
    expect(all[1].who).toBe('You');
  });
  it('the call is a mechanic: on the job before it done its flag is set, once, and the caller\'s words said', () => {
    const { world, emits } = lowerCall(LEVEL.game.mechanics.at(-1), { i: 0, player: 'hero' });
    expect(MECHANIC_KINDS).toContain('call');
    expect(emits).toEqual(['call:fare']);
    expect(world.vars).toEqual({ 'flag-took-fare': 0 });
    expect(world.reactions[0]).toEqual({ on: 'errand:done:parcel', if: { var: 'flag-took-fare', eq: 0 }, do: 'emit', type: 'call:fare' });
    expect(world.hud[0]).toMatchObject({ on: 'call:fare', as: 'toast', text: 'Dispatch: Fares are waiting.' });
    expect(() => lowerCall({ id: 'fare', flag: 'took-fare' }, { i: 0 })).toThrow(/on is the event/);
  });
  it('the page hosts it on mana-ui: the contacts met beside the thread of the one in focus, in the theme\'s look alone', () => {
    const G = phoneUi(LEVEL), spec = phoneSpec(G);
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    const S = { phone: { contacts: [{ id: 'dispatch', name: 'Dispatch', state: 'Parcel', thread: [{ who: 'Dispatch', text: 'The shop is waiting on this.' }, { who: 'Dispatch', text: 'Next: Pick up the gadget' }] }] } };
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act() {}, now: () => 0 });
    rt.open('phone');
    const html = rt.view();
    for (const s of ['Phone', 'Contacts', 'Dispatch', 'Parcel', 'The shop is waiting on this.', 'Next: Pick up the gadget', 'data-icon="person"']) expect(html).toContain(s);
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    S.phone = { contacts: [] }; rt.tick();
    expect(rt.view()).toContain('No one yet');
    const src = phoneScript(G, 'console');
    for (const s of ['__mojPhone', 'KeyP', 'unread']) expect(src).toContain(s);
    let bad = null;
    try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { bad = String(e.stderr || e.message).slice(0, 300); }
    expect(bad).toBe(null);
    expect(phoneScript(null)).toBe('');
    expect(phoneScript({ contacts: [] })).toBe('');
  });
});
