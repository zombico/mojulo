// The lab's debris (era/skandart.js on the research-lab kit): a lab sheds no stone, so its card answers with what the
// draughts carry to its walls and, where its roof came down, the slab under the hole. Its condition reaches its own
// story of decay: ruined brings the roof down. One small lab holds the concept.
import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry } from './stage.js';
import { skandartTemplates, skandartStamps, skandartLaws, skandartRead } from './skandart.js';
import { DEBRIS } from './debris-shelf.js';

const LAB = (over = {}) => ({ kind: 'stage', kit: 'research-lab', rooms: [{ id: 'a', x: 0, y: 0, w: 14, d: 19, h: 9 }], ...over });
const debris = (P) => (P.repeats || []).filter((r) => r.group.startsWith('skandart:'));

describe('the lab\'s debris', () => {
  it('ruined brings the roof down: its decay set by the word, a collapse heaped under the hole, the old pile left only its fallen lamps', () => {
    const P = assembleStageScene(LAB({ condition: 'ruined' }), {});
    expect(P.condition.applied.decay).toMatchObject({ collapse: 1, abandon: 1 });
    const collapse = debris(P).find((r) => r.group === 'skandart:collapse');
    expect(collapse.transforms).toHaveLength(1);
    // (under the hole the decay cut, era/lab.js)
    const g = buildStageGeometry(planStage(LAB({ condition: 'ruined' }))), [x0, y0, x1, y1] = g.labs.find((L) => L.hole).hole.rect, [cx, cy] = collapse.transforms[0].pos;
    expect(cx > x0 && cx < x1 && cy > y0 && cy < y1).toBe(true);
    // (the deck's concrete and sheets are the heap's now; the old pile keeps only what fell from the bay, its troffers)
    expect(P.faces.some((f) => f.group === 'stage:debris')).toBe(false);
    expect(assembleStageScene(LAB({ decay: { collapse: 1 } }), {}).faces.some((f) => f.group === 'stage:debris')).toBe(true);
    // (derelict leaves the roof up: abandoned, dark and leaking, no collapse)
    const D = assembleStageScene(LAB({ condition: 'derelict' }), {});
    expect(D.condition.applied.decay.collapse).toBeUndefined();
    expect(debris(D).some((r) => r.group === 'skandart:collapse')).toBe(false);
  }, 300_000);

  it('drifts lie in the lab\'s own bays, clear of its columns; a collapse is slab in pieces over a low bed; its laws hold', () => {
    const plan = planStage(LAB({ condition: 'ruined' })), geom = buildStageGeometry(plan), read = skandartRead();
    const T = skandartTemplates(plan, plan.skandart.amount, read), S = skandartStamps(plan, geom);
    expect(skandartLaws(plan, T, S, read).filter((r) => !r.ok)).toEqual([]);
    // (each wall foot's drift stands in one of the bays the lab laid, era/lab.js, its columns between them)
    const own = geom.bays.filter((b) => b.a !== undefined && !b.portal);
    for (const s of S.filter((q) => q.tpl.startsWith('foot'))) {
      const inBay = own.some((b) => { const u = (s.at[0] - b.F.o[0]) * b.F.U[0] + (s.at[1] - b.F.o[1]) * b.F.U[1], off = (s.at[0] - b.F.o[0]) * b.F.N[0] + (s.at[1] - b.F.o[1]) * b.F.N[1];
        return Math.abs(off) < 1e-6 && u > b.a && u < b.b; });
      expect(inBay, `${s.tpl} at ${s.at}`).toBe(true);
    }
    // (the lab's things: what lies is carried past the body; the collapse more slab than fines)
    const ids = new Set(Object.values(T).flatMap((t) => (t.pieces || []).map((q) => q.id)));
    for (const id of ['board', 'paper', 'slab-chunk', 'deck-sheet']) expect(ids.has(id), id).toBe(true);
    expect(T.collapse.body.H).toBeLessThanOrEqual(plan.kit.skandart.heights.cone[1]);
    expect(T.collapse.pieces.filter((q) => q.id === 'slab-chunk').length).toBeGreaterThan(10);
    const far = Math.max(...T['foot-0a'].pieces.filter((q) => DEBRIS[q.id].how === 'lies').map((q) => q.y));
    expect(far).toBeGreaterThan(T['foot-0a'].body.toe);
  }, 300_000);
});
