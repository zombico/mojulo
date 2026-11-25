import { describe, it, expect } from 'vitest';
import { warlordsOfMarsStart, OPERATIONS, WARLORDS_OF_MARS } from './warlords-of-mars.js';
import { readOperation, operationMechanics, OPERATION } from './frame-goal.js';
import { readGameworld } from './world.js';
import { runSteps } from './runner.js';
import { composeGameworld } from './compose.js';
import { pitchStart } from './pitch-start.js';
import { frameField } from '../assault-frame/field.js';
import { ACES } from '../assault-frame/aces.js';
import { MTS } from '../assault-frame/mts.js';
import { assembleFrame } from '../assault-frame/assemble.js';
import { nearestRails } from './rails.js';
import { gameStore } from './levels.js';
import { HANGAR_SLICE, PARTS_SLICE, garageOwned } from '../assault-frame/hangar.js';

// WARLORDS OF MARS (warlords-of-mars.js): an assault frame's operations on Mars, on the level path Wolf Squadron and Rebel
// Storm laid. One case per concept: the starter reads, a level is a frame's (its pilot, its groups, its tasks), words reach
// it from both doors, and an operation's tasks lower onto the objectives.
const W = () => ({ id: 'wom', name: 'Warlords of Mars', ...warlordsOfMarsStart({}).world });
const first = OPERATIONS[0].id;

describe('Warlords of Mars', () => {
  it('starts as its operations, each a field on Mars with the pilot\'s frame and an operation goal', () => {
    const G = readGameworld(W());
    expect(G.ids).toEqual(OPERATIONS.map((o) => o.id));
    for (const id of G.ids) {
      expect(G.levels[id].airspace.frame.build).toBe(WARLORDS_OF_MARS.frame);
      expect(G.levels[id].airspace.ground.geocube).toBe('mars');
      expect(G.levels[id].goal.operation).toBeTruthy();
    }
  });

  it('lays a level whose pilot is a frame and whose foes are its groups, a later task\'s asleep', () => {
    const steps = runSteps({ ...W(), levels: { [first]: W().levels[first] }, start: first }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest;
    const P = m.entities.find((e) => e.pilotable);
    expect(P.rule.type).toBe('frame');
    expect(Object.keys(P.rule.slots)).toEqual(['armR', 'armL', 'backR', 'backL']);
    expect(m.figures[P.body.figure].assault.build).toBe(WARLORDS_OF_MARS.frame);
    const foes = m.entities.filter((e) => e.team === 'foes');
    const op = readOperation(OPERATIONS[0].groups && { groups: OPERATIONS[0].groups, tasks: OPERATIONS[0].tasks });
    expect(foes.length).toBe(op.groups.reduce((a, g) => a + g.count, 0));
    expect(foes.filter((e) => e.dormant).length).toBe(op.groups.filter((g) => op.tasks.slice(1).some((t) => t.down?.includes(g.id))).reduce((a, g) => a + g.count, 0));
    expect(m.game.mechanics.map((x) => x.kind)).toEqual(expect.arrayContaining(['objectives', 'fail-on-death']));
    // (it stands the save's build, the hangar's: the level consumes the slice, the game's store keeps it)
    expect(m.game.consumes).toEqual(expect.arrayContaining([{ slice: HANGAR_SLICE }, { slice: PARTS_SLICE }]));
    expect(gameStore(W(), null).slices).toEqual(expect.arrayContaining([{ name: HANGAR_SLICE, kind: 'flags' }, { name: PARTS_SLICE, kind: 'inventory' }]));
    // (fitted in its hangar before it goes out: the parts it starts with its stock's, the build it fits kept)
    expect(P.rule.garage.owned).toEqual(garageOwned(WARLORDS_OF_MARS.frame));
    expect(m.game.produces.events).toEqual(expect.arrayContaining([{ type: 'setFlag', slice: HANGAR_SLICE }]));
    // (its win adds its reward to the garage: each part granted to the save's parts as it is won)
    expect(m.game.wins).toEqual(OPERATIONS[0].reward.map((item) => ({ type: 'grant', slice: PARTS_SLICE, item, count: 1 })));
    expect(m.game.produces.events).toEqual(expect.arrayContaining([{ type: 'grant', slice: PARTS_SLICE }]));
    // (told on the holo table before the drop: the briefing channel's data on the level, campaign/operation-brief.js)
    expect(m.briefing.data.things.some((t) => t.pilot)).toBe(true);
    expect(m.briefing.data.steps.length).toBeGreaterThan(1);
    // (fought on Mars's own land in the seventh generation, assault-frame/field.js: pure terrain, no trail, no flight map;
    // the frame and every foe stood on the land's height, inside the field's bound)
    expect(m).toMatchObject({ kind: 'geocube', show: 'land', cube: { from: 'mars', era: 'gen-7', outside: { island: { walk: 'none', open: true } } } });
    expect(m.map).toBeUndefined();
    const F = frameField(m.cube), [x0, y0, x1, y1] = P.rule.bound;
    for (const e of [P, ...foes]) {
      const [x, y, z] = e.transform.pos;
      expect(Math.abs(z - F.heightAt(x, y))).toBeLessThan(0.01);
      expect(x >= x0 && x <= x1 && y >= y0 && y <= y1).toBe(true);
    }
  });

  it('the Gnat Screen stands its drones in the air over the land, quick fliers that weave in close', () => {
    const id = 'gnat-screen', steps = runSteps({ ...W(), levels: { [id]: W().levels[id] }, start: id }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest, F = frameField(m.cube);
    const gnats = m.entities.filter((e) => e.id.startsWith('screen-'));
    expect(gnats.length).toBe(8);
    for (const g of gnats) {
      const [x, y, z] = g.transform.pos;
      expect(z - F.heightAt(x, y)).toBeCloseTo(OPERATION.units.gnat.air, 0);
      expect(g.rule).toMatchObject({ type: 'ai', space: true, standoff: OPERATION.units.gnat.standoff });
    }
    expect(m.figures['unit-gnat']).toEqual({ unit: { kind: 'gnat', form: true } });
  });

  it('Long Guns stands its carriers with a launcher and no gun, hanging back behind the tanks', () => {
    const id = 'long-guns', steps = runSteps({ ...W(), levels: { [id]: W().levels[id] }, start: id }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest;
    const H = m.entities.filter((e) => e.id.startsWith('carriers-')), T = m.entities.filter((e) => e.id.startsWith('screen-'));
    expect(H.length).toBe(3);
    for (const h of H) { expect(h.rule.missiles).toMatchObject({ impact: OPERATION.units.hammer.missiles.impact }); expect(h.weapon).toBeUndefined(); }
    const mid = (L) => L.reduce((a, e) => a + e.transform.pos[1], 0) / L.length;
    expect(mid(H)).toBeGreaterThan(mid(T) + 80);
  });

  it('the Shield Line stands its walkers behind their shields, raised again after a break', () => {
    const id = 'shield-line', steps = runSteps({ ...W(), levels: { [id]: W().levels[id] }, start: id }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest;
    const B = m.entities.filter((e) => e.id.startsWith('line-'));
    expect(B.length).toBe(3);
    for (const b of B) { expect(b.body.shield).toEqual(OPERATION.units.bastion.shield); expect(b.rule.shieldRaise).toBe(OPERATION.units.bastion.shieldRaise); }
  });

  it('the Jackal Pack stands MTs: smaller frames off their shelf, less armour, the heavy one held till the pack is down', () => {
    const id = 'jackal-pack', steps = runSteps({ ...W(), levels: { [id]: W().levels[id] }, start: id }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest;
    const J = m.entities.filter((e) => e.id.startsWith('pack-')), R = m.entities.find((e) => e.id === 'rhino'), T = MTS.jackal;
    expect(J.length).toBe(3);
    expect(J[0].rule.type).toBe('frame');
    expect(J[0].body.hp).toBe(Math.round(assembleFrame(T.build).ap * T.ap));
    expect(m.figures[J[0].body.figure].assault).toMatchObject({ scale: T.scale, palette: T.palette });
    expect(J[0].rule.eyeH).toBeCloseTo((assembleFrame(T.build).move.height + 2) * T.scale, 1);
    expect(R.dormant).toBe(true);
    expect(R.rule.slots.backR.handling).toBe('brace');
    expect(() => readOperation({ groups: [{ id: 'a', kind: 'tank', mt: 'jackal', at: [0, 0] }], tasks: [{ down: 'a' }] })).toThrow(/mt is a frame's/);
  });

  it('the path ladders up to an ace: its own build and paint, more armour, its phases on its mind, its reserve held back', () => {
    const id = 'vermilion', steps = runSteps({ ...W(), levels: { [id]: W().levels[id] }, start: id }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest;
    const ace = m.entities.find((e) => e.ace), V = ACES[id];
    expect(ace.ace).toEqual({ id, name: V.name });
    expect(ace.rule.mind.phases.map((p) => p.style)).toEqual(V.phases.map((p) => p.style));
    expect(ace.body.hp).toBe(Math.round(assembleFrame(V.build).ap * V.ap));
    expect(m.figures[ace.body.figure].assault.palette).toBe(V.palette);
    const reserve = m.entities.filter((e) => e.id.startsWith('reserve-'));
    expect(reserve.length).toBeGreaterThan(0);
    expect(reserve.every((e) => e.dormant)).toBe(true);
    expect(() => readOperation({ groups: [{ id: 'a', kind: 'tank', ace: id, at: [0, 0] }], tasks: [{ down: 'a' }] })).toThrow(/ace is a frame's/);
  });

  it('an operation\'s tasks lower onto the objectives: its downs as clears of their groups, a reach on the ground', () => {
    const op = readOperation({ groups: [{ id: 'a', kind: 'turret', count: 2, at: [0, 0.2] }, { id: 'b', kind: 'frame', at: [0, 0.6] }], tasks: [{ down: 'a' }, { down: 'b' }, { reach: [0.3, 0.5] }] });
    const ends = { spawn: [0, -300, 0], ground: () => 12, frame: { half: 600 } };
    const [O] = operationMechanics(op, ends);
    expect(O.tasks.map((t) => t.kind)).toEqual(['clear', 'clear', 'reach']);
    expect(O.tasks[0].foes).toEqual(['a-1', 'a-2']);
    expect(O.tasks[1].foes).toEqual(['b']);
    expect(O.tasks[2].at).toEqual([180, 300, 12]);
    expect(() => readOperation({ groups: [{ id: 'a', kind: 'dragon', at: [0, 0] }], tasks: [{ down: 'a' }] })).toThrow(/kind is one of turret, tank, walker, .*frame/);
  });

  it('is reached from words by both doors: the producer\'s rail and the sentence door\'s starter', () => {
    expect(nearestRails('an armored core style mech game')[0].id).toBe('warlords-of-mars');
    const C = composeGameworld({ prompt: 'an armored core style mech game', seed: 1 });
    expect(C.rail).toEqual({ from: 'warlords-of-mars', size: 'designed' });
    expect(C.intent).toEqual({ from: 'mech-action' });
    const L = pitchStart({ id: 'w', rail: { from: 'warlords-of-mars', size: 'designed', locked: true } });
    expect(L.laid.by).toBe('warlords-of-mars');
    expect(L.laid.levels).toEqual(OPERATIONS.map((o) => o.id));
  });
});
