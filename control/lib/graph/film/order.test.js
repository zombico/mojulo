import { describe, it, expect } from 'vitest';
import { orderErrors, filmOfOrder, orderBriefErrors, draftScript, isDraft, orderReadout, DELIVERIES, ORDER_STATES } from './order.js';
import { filmErrors, sceneStamp } from './film.js';
import { filmReadout } from './readout.js';
import { ADVICE_HOME, departmentOfPath } from './departments.js';

// a cutscene made to a client's ORDER: its characters, its places and its notes in, a film out, tracked by event
const ORDER = {
  title: 'The meeting', from: 'sk_game', for: 'the prologue',
  cast: { ada: 'sk_ada', jon: { hero: 'sk_jon', style: 'thespian' } },
  places: { field: 'sk_field' },
  events: [
    { id: 'arrival', place: 'field', notes: 'Ada finds Jon waiting.' },
    { id: 'parting', who: ['ada'], notes: 'Ada leaves.', script: 'ADA: Goodbye.' },
  ],
};

describe('an order', () => {
  it('becomes a film: the client\'s characters its cast, its places the sets, an event a scene, the brief kept', () => {
    const F = filmOfOrder(ORDER, { kindOf: (ref) => (ref === 'sk_ada' ? 'persona' : 'hero') });
    expect(filmErrors(F)).toEqual([]);
    expect(F.cast).toEqual({ ada: { persona: 'sk_ada' }, jon: { hero: 'sk_jon', style: 'thespian' } });
    expect(F.sets).toEqual({ field: 'sk_field' });
    expect(F.scenes.map((S) => [S.id, S.set, Object.keys(S.cast)])).toEqual([['arrival', 'field', ['ada', 'jon']], ['parting', undefined, ['ada']]]);
    expect(F.edit.order).toEqual(['arrival', 'parting']);
    expect(F.order).toEqual({ from: 'sk_game', for: 'the prologue', deliver: 'animatic', events: [{ id: 'arrival', notes: 'Ada finds Jon waiting.', place: 'field', who: ['ada', 'jon'] }, { id: 'parting', notes: 'Ada leaves.', who: ['ada'] }] });
    // an event the client wrote keeps its screenplay; one given as notes only holds them in its place
    expect(F.scenes[1].script).toBe('ADA: Goodbye.');
    expect(F.scenes[0].script).toBe(draftScript('Ada finds Jon waiting.'));
    expect(isDraft(F, 'arrival')).toBe(true);
    expect(isDraft(F, 'parting')).toBe(false);
    expect(JSON.stringify(filmOfOrder(ORDER))).toBe(JSON.stringify(filmOfOrder(ORDER)));
  });

  it('is refused, teaching, when it names what it does not have', () => {
    expect(orderErrors(ORDER)).toEqual([]);
    expect(orderErrors({ ...ORDER, cast: {} }).join()).toMatch(/characters the client hands over/);
    expect(orderErrors({ ...ORDER, events: [{ id: 'x', notes: 'n', place: 'moon' }] }).join()).toMatch(/'moon' is not one of the order's places \(field\)/);
    expect(orderErrors({ ...ORDER, events: [{ id: 'x', notes: 'n', who: ['zed'] }] }).join()).toMatch(/each one of the order's cast/);
    expect(orderErrors({ ...ORDER, events: [{ id: 'x' }] }).join()).toMatch(/what happens, in the client's words/);
    expect(orderErrors({ ...ORDER, deliver: 'gif' }).join()).toMatch(new RegExp(DELIVERIES.join(' \\| ').replace(/\|/g, '\\|')));
    expect(() => filmOfOrder({ cast: { ada: 'sk' } })).toThrow(/order refused/);
  });

  it('a film\'s brief names its own scenes; a film with no order is as it was', () => {
    const F = filmOfOrder(ORDER);
    expect(orderBriefErrors(F.order, { ...F, scenes: F.scenes.slice(1) }).join()).toMatch(/event 'arrival' has no scene/);
    const { order: _o, ...plain } = F;
    expect(filmErrors(plain)).toEqual([]);
    expect(orderReadout(plain, [])).toBe(null);
  });

  it('says how far each event has got, and when the client can have it back', () => {
    const F = filmOfOrder(ORDER), stamp = (id) => sceneStamp(F, id), rows = F.scenes.map((S) => ({ id: S.id, stamp: stamp(S.id), board: 'open' }));
    const at = (made, progress) => orderReadout(F, rows, { made, progress });
    expect(at({}).events.map((e) => e.state)).toEqual(['unwritten', 'written']);
    expect(at({}).ready).toBe(false);
    const boarded = { storyboard: { scenes: { parting: { stamp: stamp('parting') } } } };
    expect(at(boarded).events[1].state).toBe('boarded');
    expect(at({ ...boarded, animatic: { motion_ref: 'mo_x' } }).events[1].state).toBe('cut');
    // (a board drawn from an older script does not count)
    expect(at({ storyboard: { scenes: { parting: { stamp: 'old' } } }, animatic: {} }).events[1].state).toBe('written');
    // written and cut, both: ready for an animatic; an order for the rendered film waits for the render
    const W = { ...F, scenes: [{ ...F.scenes[0], script: 'ADA: You came.\nJON: I did.' }, F.scenes[1]] }, rowsW = W.scenes.map((S) => ({ id: S.id, stamp: sceneStamp(W, S.id), board: 'open' }));
    const made = { storyboard: { scenes: Object.fromEntries(rowsW.map((r) => [r.id, { stamp: r.stamp }])) }, animatic: {} };
    expect(orderReadout(W, rowsW, { made })).toMatchObject({ ready: true, waiting: [], deliver: 'animatic' });
    const asFilm = { ...W, order: { ...W.order, deliver: 'film' } };
    expect(orderReadout(asFilm, rowsW, { made }).waiting).toEqual(['arrival', 'parting']);
    expect(orderReadout(asFilm, rowsW, { made, progress: { scenes: { arrival: { encoded: 'a.mp4' }, parting: { encoded: 'b.mp4' } } } }).ready).toBe(true);
    for (const e of at({}).events) expect(ORDER_STATES).toContain(e.state);
  });

  it('the readout advises the unwritten event with the client\'s notes, in the script department, and never calls it broken', () => {
    const F = filmOfOrder(ORDER);
    const R = filmReadout(F, { arrival: { error: 'no line to speak' }, parting: { error: 'x' } }, {});
    expect(R.advice.filter((a) => a.scene === 'arrival').map((a) => a.id)).toEqual(['unwritten']);
    expect(R.advice.find((a) => a.id === 'unwritten').says).toMatch(/Ada finds Jon waiting/);
    expect(R.advice.some((a) => a.id === 'scene-refused' && a.scene === 'parting')).toBe(true);
    expect(ADVICE_HOME.unwritten).toBe('script');
    expect(departmentOfPath('/order')).toBe('script');
    expect(R.order.events.map((e) => e.state)).toEqual(['unwritten', 'written']);
  });
});
