import { describe, it, expect } from 'vitest';
import { frameMapData, frameMapSvg } from './frame-map.js';
import { warlordsOfMarsStart } from './warlords-of-mars.js';
import { readGameworld } from './world.js';
import { MASSIF_FORMS } from '../assault-frame/field.js';

// THE OPERATION MAP (frame-map.js): a frame level's plate in the game book, the field from above as its radar and its
// beacons tell it. One case per concept: the map draws the operation where the level lays it (every group's members, each
// reach task's beacon, the drop inside the field's square); a level on a massif field names its form and is drawn on its
// own ground; a level that is not a frame's has no operation map.
const W = () => ({ id: 'wom', name: 'Warlords of Mars', ...warlordsOfMarsStart({}).world });

describe('the operation map', () => {
  it('draws the operation where the level lays it: its groups, its beacons, the drop in the field\'s square', () => {
    const G = readGameworld(W()), id = G.ids.find((i) => G.levels[i].goal.operation.tasks.some((t) => t.reach)), D = frameMapData(G, id);
    const op = G.levels[id].goal.operation;
    expect(D.groups.map((g) => g.id)).toEqual(op.groups.map((g) => g.id));
    D.groups.forEach((g, k) => expect(g.members.length).toBe(op.groups[k].count ?? 1));
    expect(D.beacons.length).toBe(op.tasks.filter((t) => t.reach).length);
    const [x0, y0, x1, y1] = D.field.bound;
    expect(D.spawn[0] >= x0 && D.spawn[0] <= x1 && D.spawn[1] >= y0 && D.spawn[1] <= y1).toBe(true);
    const svg = frameMapSvg(G, id, { px: 200 });
    expect(svg).toMatch(/^<svg[^>]*data-map="frame-operation"/);
    expect((svg.match(/data-beacon=/g) ?? []).length).toBe(D.beacons.length);
    expect(svg).toContain('data:image/png;base64,');
  });

  it('draws a level on a massif field on its own ground, its form a field\'s and not a flight map\'s', () => {
    const w = W(), id = Object.keys(w.levels)[0], form = Object.keys(MASSIF_FORMS)[0];
    w.levels = { [id]: { ...w.levels[id], airspace: { ...w.levels[id].airspace, map: { ...w.levels[id].airspace.map, form }, ground: { geocube: MASSIF_FORMS[form] } } } };
    const G = readGameworld(w), D = frameMapData(G, id);
    // (its ground the massif's: rock standing tens of metres over the floor somewhere in its square)
    const [cx, cy] = D.field.centre;
    let top = -Infinity;
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) top = Math.max(top, D.heightAt(cx + i * 60, cy + j * 60));
    expect(top).toBeGreaterThan(40);
    // (a flight over the same map is refused its field's form: a flight map knows only its own)
    const { frame: _f, ...flown } = w.levels[id].airspace, { goal: _g, ...level } = w.levels[id];
    expect(() => readGameworld({ ...w, levels: { [id]: { ...level, airspace: flown } } })).toThrow(/map.form/);
  });

  it('is a frame level\'s alone', () => {
    const w = W(), id = Object.keys(w.levels)[0], { frame: _f, ...flown } = w.levels[id].airspace, { goal: _g, ...level } = w.levels[id];
    const G = readGameworld({ ...w, levels: { [id]: { ...level, airspace: flown } } });
    expect(() => frameMapData(G, id)).toThrow(/not a frame's/);
  });
});
