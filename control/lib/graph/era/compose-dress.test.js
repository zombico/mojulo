// The dressing (compose-dress.js, compose-lay.js): a set piece at each focus its role names and clusters by role, clear
// of every keep-out; laid once into the recipe as the default and patched by id; each thing named on its faces, a collider
// and an anchor, so breakability takes it by the degree the words name; a stage not composed carries none of it.
import { describe, expect, it } from 'vitest';
import { PIECES, PIECE_SETS, SET_PIECES, layProps, keepOuts, footprintOf } from './compose-dress.js';
import { resolveCompose, DESTRUCTION_WORDS } from './compose.js';
import { resolveProps } from './compose-lay.js';
import { planStage, assembleStageScene } from './stage.js';
import { breakablesOf, DEGREES } from '../playscape/destruct/breakability.js';
import { applyManifestPatch } from '../../mcp/tools/manifest-patch.js';

const SUITE = { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
const composed = (compose, extra = {}) => ({ ...SUITE, compose, ...extra });

describe('the dressing laid', () => {
  it('a set piece where each role names one, the register\'s great object; clusters of its dressing\'s pieces; nothing in a keep-out', () => {
    const plan = planStage(composed('a hangar')), items = plan.props, reg = plan.compose.axes.dressing;
    const great = items.find((x) => x.id === `tall/focus/${SET_PIECES['great-object'][reg]}`);
    expect(great).toBeDefined();
    expect(items.some((x) => x.id === 'low/focus/sign' && x.wall)).toBe(true);
    for (const x of items.filter((y) => !y.set)) expect(PIECE_SETS[reg]).toContain(x.kind);
    const keep = keepOuts(plan);
    for (const x of items.filter((y) => !y.set && !y.wall)) {
      const f = footprintOf(x);
      for (const k of keep.filter((q) => q.room === x.room && q.kind !== 'sight')) expect(f.max[0] <= k.min[0] || f.min[0] >= k.max[0] || f.max[1] <= k.min[1] || f.min[1] >= k.max[1], x.id).toBe(true);
    }
    expect(plan.compose.dress.every((l) => l.ok)).toBe(true);
    // the same plan lays the same things
    expect(layProps(plan)).toEqual(items);
  });

  it('a passage left clear; a set piece a doorway\'s approach takes moves to the nearest clear place', () => {
    const plan = planStage(composed({ words: 'a hangar', roles: { tall: 'passage' } }));
    expect(plan.props.filter((x) => x.room === 'tall')).toEqual([]);
    // (a second way out at the hall's far end, where its focus stands)
    const P = planStage(composed('a hangar', { ways: [{ room: 'low', side: '-y' }, { room: 'tall', side: '+y' }] })), g = P.props.find((x) => x.id.startsWith('tall/focus/'));
    expect(g).toBeDefined();
    const f = footprintOf(g);
    for (const k of keepOuts(P).filter((q) => q.room === 'tall' && q.kind === 'door')) expect(f.max[0] <= k.min[0] || f.min[0] >= k.max[0] || f.max[1] <= k.min[1] || f.min[1] >= k.max[1]).toBe(true);
  });
});

describe('the default, the operator\'s to change', () => {
  it('laid into the recipe at authoring; a list there kept; \'reroll\' lays again; false none', () => {
    const M = resolveProps(resolveCompose(composed('a hangar')));
    expect(M.props.length).toBeGreaterThan(0);
    const mine = [M.props[0]];
    expect(resolveProps({ ...M, props: mine }).props).toBe(mine);
    expect(resolveProps({ ...M, props: 'reroll' }).props).toEqual(M.props);
    expect(resolveProps({ ...M, props: false }).props).toBe(false);
    expect(planStage({ ...M, props: false }).props).toEqual([]);
  });

  it('patched by id: one removed, the rest where they stood; one set unbreakable; one added', () => {
    const M = resolveProps(resolveCompose(composed('a hangar'))), [a, b] = M.props.filter((x) => !x.set);
    const N = applyManifestPatch(M, [{ op: 'remove', id: a.id }, { op: 'set', id: b.id, breakable: false }, { op: 'add', into: 'props', entry: { id: 'tall/mine/drum-1', kind: 'drum', room: 'tall', at: [2, 20], facing: '+x' } }]).manifest;
    expect(N.props.map((x) => x.id)).toEqual([...M.props.filter((x) => x.id !== a.id).map((x) => x.id), 'tall/mine/drum-1']);
    for (const x of N.props.filter((y) => y.id !== b.id && y.id !== 'tall/mine/drum-1')) expect(x).toEqual(M.props.find((y) => y.id === x.id));
    expect(() => planStage({ ...N, props: [...N.props, { id: 'x', kind: 'piano', room: 'tall', at: [0, 0], facing: '+x' }] })).toThrow(/props\[\d+\] is/);
  });
});

describe('things in the world, breakable by the degree the words name', () => {
  it('each named on its faces, a collider and an anchor; the degree takes its classes; an item\'s own word wins', () => {
    const S = assembleStageScene(composed('a hangar'), {}), props = S.anchors.filter((a) => a.kind === 'prop');
    expect(props.length).toBe(planStage(composed('a hangar')).props.length);
    for (const a of props.filter((x) => PIECES[planStage(composed('a hangar')).props.find((y) => y.id === x.id).kind].solid !== false)) {
      expect(a.box, a.id).toBeDefined();
      expect(S.colliders.some((c) => c.of === a.id), a.id).toBe(true);
    }
    // (each degree takes only the classes it names; the set piece only the world's)
    for (const [deg, classes] of Object.entries(DEGREES).filter(([d]) => d !== 'none')) {
      for (const t of breakablesOf(S, deg)?.things ?? []) expect(classes).toContain(t.class);
    }
    expect((breakablesOf(S, 'objects')?.things ?? []).some((t) => t.class === 'set-piece')).toBe(false);
    expect(breakablesOf(S, 'world').things.some((t) => t.class === 'set-piece')).toBe(true);
    const crate = props.find((a) => a.form === 'crate'), off = { ...composed('a hangar'), props: planStage(composed('a hangar')).props.map((x) => (x.id === crate.id ? { ...x, breakable: false } : x)) };
    expect(breakablesOf(assembleStageScene(off, {}), 'objects').things.some((t) => t.id === crate.id)).toBe(false);
  });

  it('the words name the degree, the most they let break; a pin wins; the recipe\'s own is kept', () => {
    const [deg, words] = Object.entries(DESTRUCTION_WORDS).at(-1);
    expect(resolveCompose(composed(`a hangar, ${words[0]}`)).destruction).toBe(deg);
    expect(resolveCompose(composed({ words: `a hangar, ${words[0]}`, destruction: 'objects' })).destruction).toBe('objects');
    expect(resolveCompose(composed(`a hangar, ${words[0]}`, { destruction: 'none' })).destruction).toBe('none');
    expect(resolveCompose(composed('a hangar')).destruction).toBeUndefined();
  });

  it('a stage not composed carries none of it', () => {
    const S = assembleStageScene(SUITE, {});
    expect(S.anchors.some((a) => a.kind === 'prop')).toBe(false);
    expect('props' in planStage(SUITE)).toBe(false);
  });
});
