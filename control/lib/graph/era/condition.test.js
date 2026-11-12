// A room's condition (era/condition.js): one word for its state of repair sets its debris, its grime and whether anyone
// sweeps, together. One small ashlar crypt (a kit that answers the debris question) and the first crypt (one that does
// not) are enough to hold the word to what it does.
import { describe, it, expect } from 'vitest';
import { CONDITIONS, readCondition, withCondition } from './condition.js';
import { assembleStageScene, planStage, STAGE_KITS } from './stage.js';

const ROOM = (over = {}) => ({ kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 12, h: 8 }], ...over });
const debris = (P) => (P.repeats || []).filter((r) => r.group.startsWith('skandart:'));

describe('a room\'s condition', () => {
  it('climbs from kept to ruined, each step more come down and longer stood; a word for a step is that step; a word it does not know teaches the ladder', () => {
    const steps = Object.values(CONDITIONS).map((C) => C.dials);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].skandart).toBeGreaterThanOrEqual(steps[i - 1].skandart);
      expect(steps[i].grime).toBeGreaterThan(steps[i - 1].grime);
    }
    // (the words people say: derelict and ruined, and theirs)
    expect(readCondition({ condition: 'abandoned' }).id).toBe('derelict');
    expect(readCondition({ condition: 'Crumbling' }).id).toBe('ruined');
    expect(readCondition({ condition: 'ruined' }).said).toBe('ruined');
    const words = Object.values(CONDITIONS).flatMap((C) => C.words);
    expect(new Set(words).size).toBe(words.length);
    expect(readCondition({})).toBe(null);
    expect(() => readCondition({ condition: 'haunted' })).toThrow(/kept \| worn \| neglected \| derelict \| ruined/);
  });

  it('fills the dials the recipe left unset, and the recipe\'s own stand over the word\'s; a kit with no debris question takes the grime and says what it could not', () => {
    const ash = STAGE_KITS['gothic-ashlar'], stone = STAGE_KITS['gothic-stone'];
    const D = withCondition({ condition: 'derelict' }, ash);
    expect(D).toMatchObject({ grime: 0.85, skandart: { amount: 0.7, swept: false }, _condition: { id: 'derelict', applied: { grime: 0.85, skandart: 0.7 } } });
    expect(withCondition({ condition: 'derelict', grime: 0.2, skandart: 0.3 }, ash)).toMatchObject({ grime: 0.2, skandart: 0.3, _condition: { applied: {} } });
    // (a kit with no card answers by what it is made of; one made of nothing that sheds takes the grime and says so)
    expect(withCondition({ condition: 'ruined' }, stone)).toMatchObject({ grime: 1, skandart: { amount: 1 }, _condition: { applied: { skandart: 1 } } });
    expect(withCondition({ condition: 'ruined' }, { tiles: { floor: { key: 'carpet' } } })).toMatchObject({ grime: 1, _condition: { unanswered: ['skandart'] } });
    // (a kept room is one where nothing has come down: no heap, and none of the kit's fallen stone)
    expect(withCondition({ condition: 'kept' }, ash).skandart).toEqual({ amount: 0 });
  });

  it('builds a derelict room: its heaps, its grime, its low webs left where nobody sweeps; a worn room has less and is swept; the room says what it was asked', () => {
    const derelict = assembleStageScene(ROOM({ condition: 'derelict' }), {}), worn = assembleStageScene(ROOM({ condition: 'worn' }), {});
    expect(derelict.condition).toMatchObject({ id: 'derelict', applied: { grime: 0.85, skandart: 0.7 } });
    const pieces = (P) => debris(P).reduce((a, r) => a + r.transforms.length * r.template.length, 0);
    expect(pieces(derelict)).toBeGreaterThan(pieces(worn));
    const low = (P) => P.faces.filter((f) => f.texture === 'card:cobweb' && Math.min(...f.corners.map((c) => c[2])) < 2).length;
    expect(low(derelict)).toBeGreaterThan(0);
    expect(low(worn)).toBe(0);
    // (the same as asking for the dials by hand)
    expect(JSON.stringify(derelict.faces)).toBe(JSON.stringify(assembleStageScene(ROOM({ grime: 0.85, skandart: { amount: 0.7, swept: false } }), {}).faces));
    const kept = assembleStageScene(ROOM({ condition: 'kept' }), {});
    expect(debris(kept)).toEqual([]);
    expect(kept.faces.some((f) => f.group === 'stage:rubble')).toBe(false);
    expect(kept.anchors.filter((a) => ['stones', 'boulder', 'debris'].includes(a.form))).toEqual([]);
    // (asked nothing, a room carries no condition)
    expect(assembleStageScene(ROOM(), {}).condition).toBeUndefined();
    expect(planStage(ROOM({ condition: 'ruined', kit: 'gothic-stone' })).condition).toMatchObject({ id: 'ruined', applied: { skandart: 1 } });
  }, 120_000);
});
