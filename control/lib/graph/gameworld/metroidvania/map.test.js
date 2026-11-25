// THE BOX'S MAP (hud.js boxMapOf, boxMapView): read as a metroidvania's map is, revealed a screen at a time. The
// concepts: a square a room cell, joined inside its room and walled between rooms with doors through; nothing shown but
// what is walked; a door seen from either side; a gate until its opener is held, a relic until taken, a boss until it
// falls; the page runs the view's own source; the minimap rides the HUD, on her.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { boxMapOf, boxMapView, boxHudSpec, BOX_MAP } from './hud.js';
import { boxOf } from './scene.js';
import { vampireSonata } from './vampire-sonata.js';

const B = boxOf({ kind: 'geocube', show: 'metroidvania', metroidvania: { ...vampireSonata(), theme: undefined }, stature: 1.69 });
const map = boxMapOf({ layout: B.layout, screen: B.greybox.screen, held: B.held });
const L = B.layout, cols = L.box[0], cell = (c, r) => r * cols + c;

describe('the box\'s map', () => {
  it('lays a square a room cell, joined inside its room, walled between rooms, the doors through the walls', () => {
    expect(map.cells.length).toBe(L.rooms.reduce((n, r) => n + r.cells.length, 0));
    for (const J of map.joins) expect(map.cells.find((C) => C.i === J.a).room).toBe(map.cells.find((C) => C.i === J.b).room);
    expect(map.joins.length).toBe(map.cells.length - L.rooms.length + L.rooms.filter((r) => r.rect[2] > 1 && r.rect[3] > 1).reduce((n, r) => n + (r.rect[2] - 1) * (r.rect[3] - 1), 0));
    expect(map.doors.length).toBe(L.doors.length);
    for (const C of map.cells) expect(C.w).toBeCloseTo(map.u * (1 - 2 * BOX_MAP.gap), 2);
    // (each gate carries what opens it: its held gate's token, a sill the power's)
    const gates = map.doors.filter((D) => D.gate);
    expect(gates.length).toBe(L.doors.filter((d) => d.gate).length);
    for (const D of gates) expect(D.opens).toMatch(/^(gate|key|boss):/);
    for (const R of map.relics) expect(map.cells.some((C) => C.i === R.cell)).toBe(true);
  });

  it('shows nothing but what is walked, revealed a screen at a time', () => {
    expect(boxMapView(map, {}).shapes).toEqual([]);
    const first = L.rooms.find((r) => r.id === L.entry.room).cells[0], at = cell(...first);
    const V = boxMapView(map, { seen: { [at]: 1 }, here: at });
    expect(V.shapes.filter((s) => s.kind === 'park').length).toBe(1);
    expect(V.shapes.filter((s) => s.kind === 'building').length).toBe(0);
    expect(V.shapes.filter((s) => s.kind === 'walk').length).toBe(map.doors.filter((D) => D.a === at || D.b === at).length);
    expect(V.markers.find((m) => m.you)).toMatchObject({ x: V.focus.x, y: V.focus.y });
    expect(V.rooms).toBe(1);
    // (a room's two screens joined once both are walked)
    const wide = L.rooms.find((r) => r.cells.length > 1), [a, b] = wide.cells.map((p) => cell(...p));
    const one = boxMapView(map, { seen: { [a]: 1 } }), both = boxMapView(map, { seen: { [a]: 1, [b]: 1 } });
    const J = map.joins.filter((j) => [a, b].includes(j.a) && [a, b].includes(j.b)).length;
    expect(both.shapes.filter((s) => s.kind === 'building').length - one.shapes.filter((s) => s.kind === 'building').length).toBe(1 + J);
  });

  it('marks a gate until its opener is held, a relic until taken, a boss until it falls, a save once found', () => {
    const seen = Object.fromEntries(map.cells.map((C) => [C.i, 1])), all = boxMapView(map, { seen });
    const locks = all.markers.filter((m) => m.icon === 'lock'), items = all.markers.filter((m) => m.kind === 'item');
    expect(locks.length).toBe(map.doors.filter((D) => D.gate).length);
    // (every prize but a secret's: that one waits for its wall to break)
    expect(items.length).toBe(map.relics.filter((R) => !R.secret).length);
    expect(boxMapView(map, { seen, broken: Object.fromEntries(map.relics.filter((R) => R.secret).map((R) => [R.secret, 1])) }).markers.filter((m) => m.kind === 'item').length).toBe(map.relics.length);
    expect(all.markers.filter((m) => m.kind === 'foe').length).toBe(L.rooms.filter((r) => r.boss).length);
    expect(all.markers.filter((m) => m.kind === 'goal').length).toBe(L.rooms.filter((r) => r.save).length);
    expect(all.rooms).toBe(L.rooms.length);
    const held = Object.fromEntries(map.doors.filter((D) => D.gate).map((D) => [D.opens, 1])), taken = Object.fromEntries(map.relics.map((R) => [R.id, 1]));
    const felled = Object.fromEntries(L.rooms.filter((r) => r.boss).map((r) => ['boss-' + r.id, 1]));
    const done = boxMapView(map, { seen, held, taken, felled });
    expect(done.markers.filter((m) => m.icon === 'lock' || m.kind === 'item' || m.kind === 'foe')).toEqual([]);
  });

  it('is the page\'s own source: the view run from its text is the view', () => {
    const run = new Function(`return (${boxMapView.toString()})`)(), S = { seen: { [map.cells[0].i]: 1, [map.cells[1].i]: 1 }, here: map.cells[1].i };
    expect(run(map, S)).toEqual(boxMapView(map, S));
    expect(boxMapView(map, S)).toEqual(boxMapView(map, S));
  });

  it('rides the HUD as a minimap on her, the boss under it, and the pause\'s whole map', () => {
    const S = boxHudSpec(), json = JSON.stringify(S);
    expect(() => manaUi.readSpec(S)).not.toThrow();
    const right = S.hud.children.find((c) => c.props.at === 'top-right'), mini = right.children[0].children[0];
    expect(mini).toMatchObject({ use: 'map', props: { size: 'corner', focus: { bind: 'bx.focus' }, zoom: { bind: 'bx.zoom' } } });
    expect(right.children[0].children[1].when).toEqual({ bind: 'bx.bossOn' });
    expect(json).toContain('"size":"panel"');
    expect(map.zoom).toBeCloseTo(Math.max(...L.box) / BOX_MAP.mini, 3);
  });
});
