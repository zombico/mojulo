// The movers (movers.js): a family's house to empty (era/programs.js `house`: two storeys over a basement, furnished as a
// home is, stocking.js HOME_STOCK), every piece of it a thing to lift (worlds/controllable/heave.js); its walk-in's door a
// level whose stage lifts its props and loads them at its front door on its own floor; the move counted on the bus to the
// truck's load, paid once into the bag.
import { describe, it, expect } from 'vitest';
import { withProgram } from '../era/programs.js';
import { assembleStageScene } from '../era/stage.js';
import { roleOf, homeRole } from '../era/stocking.js';
import { interiorStage } from './levels.js';
import { withBuildingLevel } from '../structure/level.js';
import { WALKINS } from '../geocity/walkins.js';
import { MOVERS, moversMechanics } from './movers.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const W = WALKINS.house;
const house = (seed = 3) => assembleStageScene(withProgram({ kind: 'stage', kit: W.kit, compose: { ...W.compose }, program: { use: 'house', seed, basement: true } }), {});
const roomOf = (a) => a.id.split('/')[0];

describe('a house to empty', () => {
  const P = house(), props = (P.anchors ?? []).filter((a) => a.kind === 'prop');
  const kinds = (pred) => new Set(props.filter((a) => pred(roomOf(a))).map((a) => a.id.split('/').pop().replace(/@\d+/g, '').replace(/-\d+$/, '')));
  it('stands on three floors, its way in a storey up over a basement', () => {
    const z = [...new Set(props.map((a) => Math.round((a.box?.min?.[2] ?? 0) * 10) / 10))].sort((a, b) => a - b);
    expect(z.length).toBeGreaterThanOrEqual(3);
  });
  it('is furnished as a home: a kitchen\'s fridge, a living room\'s sofa, bedrooms upstairs, boxes in the basement; nothing in its hall', () => {
    // (a kitchen-diner: whichever of the two bays the seed names, it keeps the fridge)
    for (const seed of [1, 5]) { const Q = house(seed); expect((Q.anchors ?? []).some((a) => a.kind === 'prop' && /^(kitchen|dining)-1/.test(roomOf(a)) && /\/fridge-/.test(a.id))).toBe(true); }
    expect(kinds((r) => roleOf(r) === 'living')).toContain('sofa');
    expect(kinds((r) => roleOf(r) === 'master')).toContain('bed');
    expect(kinds((r) => roleOf(r) === 'store')).toContain('moving-box');
    expect(props.filter((a) => roleOf(roomOf(a)) === 'lobby' && !/\/(find|prize|sign)/.test(a.id))).toEqual([]);
    // (upstairs, every room a bedroom, whatever its bay is called)
    const ground = 4.2;
    expect(homeRole({ id: 'kitchen-201', z0: ground + 3.5 }, ground)).toBe('bedroom');
    expect(homeRole({ id: 'kitchen-101', z0: ground }, ground)).toBe('kitchen');
    expect(homeRole({ id: 'store-001', z0: 0 }, ground)).toBe('store');
  });
  it('stands each piece as a solid with its own collider: each a thing the runtime can lift', () => {
    const solid = props.filter((a) => a.solid);
    expect(solid.length).toBeGreaterThan(40);
    const boxes = new Set((P.colliders ?? []).map((c) => c.of));
    expect(solid.every((a) => boxes.has(a.id))).toBe(true);
  });
});

describe('the house\'s door', () => {
  const m = withBuildingLevel(interiorStage({ use: W.program, seed: 5, kit: W.kit, compose: { ...W.compose }, scale: 1.5, exit: false, name: W.name, basement: true, movers: { ...W.movers } }), 'house-ref');
  it('lifts the stage\'s props, loaded at its front door on the floor the door is on, the walker coming in there', () => {
    expect(m.heave.pieces).toBe('props');
    const D = m.game.mechanics.find((x) => x.kind === 'door'), walker = m.entities.find((e) => e.pilotable);
    expect(m.heave.drop.at[2]).toBeGreaterThan(3);
    expect(m.heave.drop.at[2]).toBe(D.at[2]);
    expect(walker.transform.pos[2]).toBeGreaterThan(m.heave.drop.at[2]);
    // (clear of the door's own zone: a piece carried in never walks the mover out)
    expect(Math.abs(m.heave.drop.at[1] - D.at[1])).toBeGreaterThan(D.half[1] + m.heave.drop.half[1] - 0.2);
  });
  it('carries the move, counted to the truck\'s load, and the bag it pays into', () => {
    expect(m.game.mechanics.find((x) => x.kind === 'movers')).toMatchObject({ load: W.movers.load, reward: [{ item: 'coin', n: 90 }] });
    expect(m.game.mechanics.some((x) => x.kind === 'bag')).toBe(true);
  });
});

describe('the move, on the bus', () => {
  const B = buildBus(), ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
  const play = (n, load = 3) => {
    const c = composeMechanics([...moversMechanics({ load }), { kind: 'reach-exit', at: [999, 999, 0] }], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    for (let k = 0; k < n; k++) pump([{ type: 'heave:load', piece: `p${k}`, n: k + 1 }]);
    return s;
  };
  it('counts each piece loaded; the truck full at its load pays once into the bag', () => {
    const s = play(2);
    expect(s.vars['loaded-movers']).toBe(2);
    expect(s.vars['held:bag:coin'] ?? 0).toBe(0);
    const t = play(5);
    expect(t.vars['loaded-movers']).toBe(5);
    expect(t.vars['flag-full-movers']).toBe(1);
    expect(t.vars['held:bag:coin']).toBe(MOVERS.reward[0].n);
  });
});
