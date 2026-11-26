import { describe, expect, it } from 'vitest';

import { foeAudit } from './foe-audit.js';

const hero = { id: 'hero', pilotable: true, body: { type: 'figure-rig', figure: 'hero' }, rule: { type: 'platform' } };
const blow = (start) => ({ loadout: [{ name: 'blow', strike: 'melee', strikeContact: [start, start + 0.1] }], meleeSeek: true });
const foe = (id, body, rule = {}, extra = {}) => ({ id, team: 'foes', body: { hittable: true, ...body }, rule: { type: 'ai', ...rule }, ...extra });
const law = (A, id) => A.laws.find((l) => l.law === id);

describe('the foe audit: how a level\'s foes are drawn on its page', () => {
  it('no foe on the page: nothing to say', () => {
    expect(foeAudit({ entities: [hero], figures: { hero: { clips: {} } } })).toBeNull();
    expect(foeAudit(null)).toBeNull();
  });

  it('a box, a figure the page was not given and a figure: only the figure is bodied', () => {
    const A = foeAudit({ entities: [hero, foe('a', { type: 'mesh', shape: 'box' }), foe('b', { type: 'figure-rig', figure: 'gone' }), foe('c', { type: 'figure-rig', figure: 'grunt' })], figures: { hero: { clips: {} }, grunt: { clips: { idle: {}, forward: {} } } } });
    expect(A.foes.map((r) => r.body)).toEqual(['box', 'unmade', 'figure']);
    expect(law(A, 'foe-bodied').ok).toBe(false);
    expect(law(A, 'foe-bodied').value).toMatch(/2 of 3/);
  });

  it('lit by the land\'s cast rig or the room\'s lamps; else baked, whatever the hero is', () => {
    const figs = { hero: { cast: {}, clips: {} }, lit: { cast: {}, clips: { idle: {}, forward: {} } }, baked: { clips: { idle: {}, forward: {} } } };
    const A = foeAudit({ entities: [hero, foe('a', { type: 'figure-rig', figure: 'lit' }), foe('b', { type: 'figure-rig', figure: 'baked' })], figures: figs });
    expect(A.hero.light).toBe('cast');
    expect(A.foes.map((r) => r.light)).toEqual(['cast', 'baked']);
    expect(law(A, 'foe-lit').ok).toBe(false);
    const R = foeAudit({ entities: [foe('b', { type: 'figure-rig', figure: 'baked' })], figures: figs, form: { room: { figures: true } } });
    expect(R.foes[0].light).toBe('room');
    expect(law(R, 'foe-lit').ok).toBe(true);
  });

  it('a blow needs its swing, a charge its wind-up; a gun its fire; a rock its lift', () => {
    const figs = { f: { clips: { idle: {}, forward: {}, swing_neutral: {} } } };
    const A = foeAudit({ entities: [
      foe('blow', { type: 'figure-rig', figure: 'f' }, blow(0.55)),
      foe('charge', { type: 'figure-rig', figure: 'f' }, { foe: { move: 'rush', rush: { brace: 0.5, recover: 0.5 } } }),
      foe('gun', { type: 'figure-rig', figure: 'f' }, {}, { weapon: { fireClass: 'rifle' } }),
      foe('rock', { type: 'figure-rig', figure: 'f' }, { foe: { move: 'pace', rock: { every: 3, lift: 0.8 } } }),
    ], figures: figs });
    expect(A.foes.map((r) => r.missing)).toEqual([[], ['wind'], ['fire'], ['lift']]);
    expect(law(A, 'foe-moves').value).toMatch(/wind \(1\), fire \(1\), lift \(1\)/);
  });

  it('a foe whose figure plays every state it needs passes all three', () => {
    const A = foeAudit({ entities: [hero, foe('a', { type: 'figure-rig', figure: 'g' }, blow(0.5))], figures: { hero: { cast: {}, clips: {} }, g: { cast: {}, clips: { idle: {}, forward: {}, swing_neutral: {} } } } });
    expect(A.laws.every((l) => l.ok)).toBe(true);
  });

  it('a blow thrown at a zone passes its weapon through it; one that swings past it, or carries no measure, is said', () => {
    const figs = { g: { clips: { idle: {}, forward: {}, swing_neutral: {} } } };
    const slot = (blade) => ({ ...blow(0.5), loadout: [{ ...blow(0.5).loadout[0], zone: { id: 'legs', band: [0.17, 0.85] }, ...(blade ? { blade } : {}) }] });
    const at = (b) => foeAudit({ entities: [foe('a', { type: 'figure-rig', figure: 'g' }, slot(b))], figures: figs });
    expect(law(at({ low: 0.3, high: 0.7 }), 'foe-zone').ok).toBe(true);
    expect(law(at({ low: 1.1, high: 1.5 }), 'foe-zone').value).toMatch(/past their zone/);
    expect(law(at(null), 'foe-zone').value).toMatch(/no measured weapon/);
    expect(law(foeAudit({ entities: [foe('a', { type: 'figure-rig', figure: 'g' }, blow(0.5))], figures: figs }), 'foe-zone')).toBeUndefined();
  });
});
