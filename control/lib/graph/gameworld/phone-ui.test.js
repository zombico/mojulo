// THE PHONE: a job's giver, once met, is a contact; the first job is taken where they stand, each one after it comes
// as a call; a thread is the level's own flags read in order. Hosted on mana-ui, in the theme's look alone.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { phoneUi, phoneThread, phoneTasks, readPhoneUi, PHONE_UI } from './phone-ui.js';
import { phoneScript, phoneSpec } from '../scene/channels/phone-channel.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { readUi } from '../playscape/ui/interface-look.js';
import { lowerCall, lowerTask } from '../game/errand-mechanics.js';
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
  it('an app is not a person: TaskFu is subscribed to on the phone, and its tasks, taken there, are quests with a reward', async () => {
    const { jobsOf, jobQuests, cityGuide, appName } = await import('./city-guide.js');
    const M = [{ kind: 'bag', slice: 'bag' }, { kind: 'trade', item: 'passenger', job: 'fare', at: [20, 0, 0], flag: 'had-passenger', after: 'took-fare' },
      { kind: 'deliver', id: 'fare', repeat: true, app: 'taskfu', wants: [{ item: 'passenger', min: 1 }], reward: [{ item: 'coin', n: 12 }], at: [60, 0, 0], flag: 'done-fare', after: 'took-fare' },
      { kind: 'task', id: 'fare', app: 'taskfu', flag: 'took-fare', name: 'TaskFu', subscribe: true }];
    expect([appName('taskfu'), appName('runner')]).toEqual(['TaskFu', 'Runner']);
    expect(jobsOf(M)[0]).toMatchObject({ id: 'fare', starts: 'took-fare', app: 'taskfu' });
    // (a quest like any job's, begun by taking it; the guide waits on that, wherever the hero is)
    expect(jobQuests(M)).toEqual([{ id: 'fare', name: 'Fare', starts: 'took-fare', steps: [{ log: 'Pick up the passenger', done: 'had-passenger' }, { log: 'Deliver the passenger', done: 'done-fare' }] }]);
    const hero = { id: 'hero', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 } }, car = { id: 'car-1', mount: { cab: true }, transform: { pos: [3, 0, 0], heading: 0 } };
    const G = cityGuide({ entities: [hero, car], game: { mechanics: M } });
    expect(G.steps[1]).toMatchObject({ id: 'app-fare', say: 'Take the fare task on TaskFu · P', when: 'flag-took-fare', at: [20, 0, 0] });
    expect(G.loop).toBe(2);
    // (the phone: no contact, one app; before it is subscribed to, the one row that subscribes; then its tasks)
    const P = phoneUi({ game: { mechanics: M } });
    expect(P.contacts).toEqual([]);
    expect(P.apps).toMatchObject([{ id: 'taskfu', name: 'TaskFu', sub: 'flag-sub-taskfu', tasks: [{ id: 'fare', took: 'flag-took-fare', done: 'flag-done-fare', repeat: true, pays: '12 coin' }] }]);
    expect(phoneTasks(P.apps[0], {}, PHONE_UI)).toEqual([{ id: 'sub:taskfu', name: 'Subscribe', state: '', lines: [{ who: 'TaskFu', text: PHONE_UI.pitch }] }]);
    const open = phoneTasks(P.apps[0], { 'flag-sub-taskfu': 1 }, PHONE_UI);
    expect(open).toEqual([{ id: 'task:fare', name: 'Fare', state: 'Open', lines: [{ who: 'Task', text: 'Pick up the passenger, then deliver the passenger' }, { who: 'Pays', text: '12 coin each time' }] }]);
    const active = phoneTasks(P.apps[0], { 'flag-sub-taskfu': 1, 'flag-took-fare': 1, 'flag-had-passenger': 1 }, PHONE_UI)[0];
    expect(active.state).toBe('Active');
    expect(active.lines.at(-1)).toEqual({ who: 'TaskFu', text: 'Next: Deliver the passenger' });
    // (the mechanic: subscribing and taking are events the phone raises on the level's bus)
    const { world } = lowerTask(M[3], { i: 0 });
    expect(world.vars).toEqual({ 'flag-took-fare': 0, 'flag-sub-taskfu': 0 });
    expect(world.reactions.map((r) => r.on)).toEqual(['app:sub:taskfu', 'app:take:fare', 'task:fare', 'task:fare']);
    expect(lowerTask({ ...M[3], subscribe: false }, { i: 0 }).world.reactions.map((r) => r.on)).toEqual(['app:take:fare', 'task:fare', 'task:fare']);
    expect(MECHANIC_KINDS).toContain('task');
  });
  it('a game may have several fus: each app lists the tags it carries, and a tagged task is on every app that lists one', async () => {
    const { taskApps, appTitle } = await import('./phone-ui.js');
    const APPS = { ridefu: { name: 'RideFu', tags: ['ride'] }, dropfu: { name: 'DropFu', tags: ['courier', 'food'] } };
    expect(taskApps({ tags: ['ride'] }, APPS)).toEqual(['ridefu']);
    expect(taskApps({ tags: ['food', 'ride'] }, APPS)).toEqual(['ridefu', 'dropfu']);
    // (its own app first; a tag no app lists is TaskFu's; a job with neither is a person's)
    expect(taskApps({ app: 'taskfu', tags: ['courier'] }, APPS)).toEqual(['taskfu', 'dropfu']);
    expect(taskApps({ tags: ['odd'] }, APPS)).toEqual(['taskfu']);
    expect(taskApps({ tags: ['ride'] })).toEqual(['taskfu']);
    expect(taskApps({ contact: 'fixer' }, APPS)).toEqual([]);
    expect([appTitle('ridefu', APPS), appTitle('taskfu', APPS)]).toEqual(['RideFu', 'TaskFu']);
    const M = [{ kind: 'trade', item: 'passenger', job: 'fare', at: [20, 0, 0], flag: 'had-passenger', after: 'took-fare' },
      { kind: 'deliver', id: 'fare', repeat: true, wants: [{ item: 'passenger', min: 1 }], reward: [{ item: 'coin', n: 12 }], at: [60, 0, 0], flag: 'done-fare', after: 'took-fare' },
      { kind: 'task', id: 'fare', app: 'ridefu', apps: ['ridefu', 'dropfu'], tags: ['food', 'ride'], flag: 'took-fare', name: 'RideFu', subscribe: [{ app: 'ridefu', name: 'RideFu' }, { app: 'dropfu', name: 'DropFu' }] }];
    const P = phoneUi({ game: { mechanics: M } }, { apps: APPS });
    expect(P.apps.map((a) => [a.id, a.name, a.tags, a.tasks.map((t) => t.id)])).toEqual([['ridefu', 'RideFu', ['ride'], ['fare']], ['dropfu', 'DropFu', ['courier', 'food'], ['fare']]]);
    // (the same task on both: taken on one, it is taken on the other)
    expect(P.apps[0].tasks[0].took).toBe(P.apps[1].tasks[0].took);
    expect(phoneTasks(P.apps[1], {}, PHONE_UI)[0].lines.at(-1)).toEqual({ who: 'Carries', text: 'courier · food' });
    expect(phoneTasks(P.apps[1], { 'flag-sub-dropfu': 1 }, PHONE_UI)[0].lines).toContainEqual({ who: 'Tags', text: 'food · ride' });
    const { world } = lowerTask(M[2], { i: 0 });
    expect(world.vars).toEqual({ 'flag-took-fare': 0, 'flag-sub-ridefu': 0, 'flag-sub-dropfu': 0 });
    expect(world.reactions.filter((r) => r.on.startsWith('app:sub:')).map((r) => r.var)).toEqual(['flag-sub-ridefu', 'flag-sub-dropfu']);
    expect(world.hud.map((h) => h.text)).toContain('DropFu: subscribed. Tasks come to your phone.');
    expect(readPhoneUi({ apps: APPS })).toEqual([]);
    expect(readPhoneUi({ apps: { ridefu: { tags: ['Ride'] } } })[0]).toMatch(/tags is the kinds of task/);
    expect(readPhoneUi({ apps: { ridefu: { colour: 'red' } } })[0]).toMatch(/not an app setting/);
  });
  it('a faction\'s board is a tab while the hero is with it: its standing, and what it posts at that standing, each an act paid in money and standing', async () => {
    const { phoneBoard } = await import('./phone-ui.js'), { lowerJoin, lowerAct } = await import('../game/errand-mechanics.js'), { jobQuests, cityGuide } = await import('./city-guide.js');
    const M = [{ kind: 'bag', slice: 'bag' },
      { kind: 'join', faction: 'reds', at: [10, 8, 0], name: 'Reds', says: 'In.', others: ['dockers'], colour: '#c0392b', turf: [0, 50, 100, 100] },
      { kind: 'act', id: 'torch', faction: 'reds', verb: 'torch', target: 'car', flag: 'took-torch', done: 'done-torch', at: [40, 20, 0], radius: 30, reward: [{ item: 'coin', n: 50 }], standing: 1, rank: 0, name: 'Reds', title: 'Torch', line: 'Torch a car on Dockers turf' },
      { kind: 'act', id: 'tag', faction: 'reds', verb: 'tag', flag: 'took-tag', done: 'done-tag', at: [40, 80, 0], radius: 30, standing: 2, rank: 1, name: 'Reds', title: 'Tag', line: 'Tag' }];
    const P = phoneUi({ game: { mechanics: M } });
    expect(P.contacts).toEqual([]); expect(P.apps).toEqual([]);
    expect(P.factions).toMatchObject([{ id: 'reds', name: 'Reds', in: 'flag-in-reds', standing: 'standing-reds', postings: [{ id: 'torch', rank: 0, pays: '50 coin' }, { id: 'tag', rank: 1, standing: 2 }] }]);
    // (at no standing: the one posting at rank 0, the other only counted)
    const b0 = phoneBoard(P.factions[0], { 'flag-in-reds': 1 }, PHONE_UI);
    expect(b0.map((r) => [r.id, r.name, r.state])).toEqual([['side:reds', 'Standing', '0'], ['task:torch', 'Torch', 'Open']]);
    expect(b0[0].lines.map((l) => l.text)).toContain('1 more at higher standing');
    expect(b0[0].lines.at(-1).who).toBe('Leave');
    expect(b0[1].lines).toEqual([{ who: 'Job', text: 'Torch a car on Dockers turf' }, { who: 'Pays', text: '50 coin · standing +1' }]);
    const b1 = phoneBoard(P.factions[0], { 'flag-in-reds': 1, 'standing-reds': 1, 'flag-took-torch': 1, 'flag-done-torch': 1 }, PHONE_UI);
    expect(b1.map((r) => [r.id, r.state])).toEqual([['side:reds', '1'], ['task:torch', 'Done'], ['task:tag', 'Open']]);
    // (a posting is a quest begun by taking it, its one step the act; the guide never leads to one)
    expect(jobQuests(M)).toEqual([{ id: 'torch', name: 'Torch', starts: 'took-torch', steps: [{ log: 'Torch a car on Dockers turf', done: 'done-torch' }] }, { id: 'tag', name: 'Tag', starts: 'took-tag', steps: [{ log: 'Tag', done: 'done-tag' }] }]);
    const hero = { id: 'hero', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 } }, car = { id: 'car-1', mount: { cab: true }, transform: { pos: [3, 0, 0], heading: 0 } };
    expect(cityGuide({ entities: [hero, car], game: { mechanics: M } }).steps.map((x) => x.id)).toEqual(['car']);
    // (the mechanics: joining one leaves the others; an act pays once, only when taken, on THE SEAM act:<verb>:<id>)
    const J = lowerJoin({ ...M[1], after: 'done-parcel' }, { i: 0, player: 'hero' }).world;
    expect(J.vars).toMatchObject({ 'flag-in-reds': 0, 'standing-reds': 0, 'flag-in-dockers': 0, 'join-open-reds': 0, 'join-near-reds': 0 });
    expect(J.inputs).toEqual([{ on: 'key', key: 'y', once: true, emit: { type: 'join-yes:reds' } }]);
    expect(J.reactions).toContainEqual({ on: 'app:leave:reds', do: 'set', var: 'flag-in-reds', to: 0 });
    expect(J.reactions).toContainEqual({ on: 'flag:done-parcel', if: { var: 'join-open-reds', eq: 0 }, do: 'emit', type: 'join-open:reds' });
    const A = lowerAct(M[2], { i: 0, resolve() {} }).world;
    expect(A.reactions.filter((r) => r.on === 'act:torch:torch')).toEqual([{ on: 'act:torch:torch', if: { var: 'flag-took-torch', gte: 1 }, do: 'emit', type: 'acting:torch' }]);
    expect(A.reactions).toContainEqual({ on: 'act:torch:torch:ok', do: 'inc', var: 'standing-reds', by: 1 });
    expect(A.reactions).toContainEqual({ on: 'app:take:torch', if: { var: 'flag-took-torch', eq: 0 }, do: 'emit', type: 'posting:torch' });
    expect(MECHANIC_KINDS).toEqual(expect.arrayContaining(['join', 'act']));
  });
  it('the page hosts it on mana-ui: the contacts met beside the thread of the one in focus, in the theme\'s look alone', () => {
    const G = phoneUi(LEVEL), spec = phoneSpec(G);
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    const S = { phone: { pages: [{ label: 'Contacts', empty: 'No one yet.', rows: [{ id: 'c:dispatch', icon: 'person', name: 'Dispatch', state: 'Parcel', lines: [{ who: 'Dispatch', text: 'The shop is waiting on this.' }, { who: 'Dispatch', text: 'Next: Pick up the gadget' }] }] },
      { label: 'TaskFu', empty: '', rows: [{ id: 'task:fare', icon: 'box', name: 'Fare', state: 'Open', lines: [{ who: 'Pays', text: '12 coin each time' }] }] }] } };
    const acts = [];
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act(e) { acts.push(e); }, now: () => 0 });
    rt.open('phone');
    const html = rt.view();
    for (const s of ['Phone', 'Contacts', 'TaskFu', 'Dispatch', 'Parcel', 'The shop is waiting on this.', 'Next: Pick up the gadget', 'data-icon="person"']) expect(html).toContain(s);
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    // (the app's tab: its task in focus, taken with accept: the row's id is what the page raises on the bus)
    rt.press('tabNext');
    expect(rt.view()).toContain('12 coin each time');
    rt.press('accept');
    expect(acts.find((e) => e.emit === 'pick')).toMatchObject({ row: 'task:fare' });
    S.phone = { pages: [{ label: 'Contacts', empty: 'No one yet.', rows: [] }] }; rt.tick();
    expect(rt.view()).toContain('No one yet');
    const src = phoneScript(G, 'console');
    for (const s of ['__mojPhone', 'KeyP', 'unread', 'app:take:']) expect(src).toContain(s);
    let bad = null;
    try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { bad = String(e.stderr || e.message).slice(0, 300); }
    expect(bad).toBe(null);
    expect(phoneScript(null)).toBe('');
    expect(phoneScript({ contacts: [], apps: [] })).toBe('');
  });
});
