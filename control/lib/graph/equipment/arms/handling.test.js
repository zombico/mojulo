// arms handling — the stations a hand, a cheek and an eye need, read off the arm as drawn: one case per way the support
// hand finds its part (a vertical foregrip, a handguard, a pump, a guard's loop, a handgun's wrap) and per sight (an
// optic's window, a scope's axis and relief, a bead along the receiver), chosen from the models by their parts.
import { describe, expect, it } from 'vitest';
import { armHandling, armBoxes, SIGHT_ZOOM, SCOPE_RELIEF } from './handling.js';
import { ARM_MODELS } from './models.js';
import { resolveArm } from './index.js';

const models = Object.entries(ARM_MODELS).filter(([item]) => item !== 'knife').flatMap(([item, I]) => Object.keys(I.models).map((model) => ({ item, model })));
const firstBy = (pred) => models.find((b) => pred(resolveArm(b).parts, b));

describe('arms handling', () => {
  it('each support kind lands on its own part, the fist on the grip and the index on the trigger inside the guard', () => {
    const picks = { foregrip: firstBy((p) => p.underbarrel === 'grip'), handguard: firstBy((p, b) => b.item === 'carbine'), pump: firstBy((p, b) => b.item === 'shotgun' && p.magazine === 'tube'), wrap: firstBy((p, b) => b.item === 'pistol') };
    for (const [kind, b] of Object.entries(picks)) {
      const h = armHandling(b), st = h.stations;
      expect(st.support.kind, `${b.item}/${b.model}`).toBe(kind);
      expect(st.trigger.at[2]).toBeGreaterThan(st.strong.at[2]);   // the trigger before the fist, along the bore
      expect(st.trigger.at[1]).toBeLessThan(0);                     // under the bore
      if (kind !== 'wrap') { expect(st.support.at[2]).toBeGreaterThan(st.trigger.at[2]); expect(st.butt.at[2]).toBeLessThan(st.strong.at[2]); }
      else expect(st.butt).toBeUndefined();
    }
  });
  it('a guard run forward into a loop is held at its front (a PDW)', () => {
    const b = models.find((m) => m.model === 'pdw'), st = armHandling(b).stations;
    expect(st.support.kind).toBe('loop');
    expect(st.support.at[2]).toBeGreaterThan(st.trigger.at[2] + 2);
  });
  it('sights: an optic\'s window over the bore, a scope at its relief and its power, a bead along the receiver', () => {
    const scoped = armHandling({ item: 'rifle', model: 'sniper' }), mk = armHandling({ item: 'rifle', model: 'marksman' });
    expect(scoped.stations.sight).toMatchObject({ kind: 'scope', relief: SCOPE_RELIEF, zoom: 8 });
    expect(mk.stations.sight.zoom).toBe(SIGHT_ZOOM.scope);
    const holo = armHandling(firstBy((p) => p.optic === 'holo'));
    expect(holo.stations.sight.y).toBeGreaterThan(3);
    const bead = armHandling(firstBy((p, b) => b.item === 'shotgun' && p.optic === 'irons')).stations.sight;
    expect(bead.front - bead.rear).toBeGreaterThan(30);   // the eye runs the receiver's length to the bead, not the bead alone
  });
  it('handling: a magnified sight is slower to the eye and steadier; the sniper the slowest and the steadiest long gun', () => {
    const s = armHandling({ item: 'rifle', model: 'sniper' }).handling, a = armHandling({ item: 'rifle', model: 'assault' }).handling, p = armHandling({ item: 'pistol', model: 'service' }).handling;
    expect(s.aimTime).toBeGreaterThan(a.aimTime); expect(s.sway).toBeLessThan(a.sway); expect(p.aimTime).toBeLessThan(a.aimTime);
    expect(s.kg).toBeGreaterThan(a.kg); expect(s.estimate).toBe(true);
  });
  it('the arm as boxes: its parts, the bore\'s dark left out; a knife is not shouldered', () => {
    const boxes = armBoxes({ item: 'rifle', model: 'assault' });
    expect(boxes.length).toBeGreaterThan(8);
    for (const [lo, hi] of boxes) for (let i = 0; i < 3; i++) expect(hi[i]).toBeGreaterThanOrEqual(lo[i]);
    expect(() => armHandling({ item: 'knife' })).toThrow(/blade/);
  });
});
