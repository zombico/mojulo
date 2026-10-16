// THE BUS'S ENTITIES AS MARKERS (II4): the page draws every bus entity (channels/events.js __syncBus); the Godot kernel
// does too (level.gd _sync_markers, since 0.22.0). A level whose keys spawn, move and hide entities is equal on its bus
// in both engines, and Godot's markers stand where its bus puts them, shown while on.
import { describe, it, expect } from 'vitest';
import { busCoverage } from './bus-abi.js';
import { extractBus } from './engine-score.js';
import { playBoth } from './godot-harness.js';
import { mechanicMarks } from './engine-portability.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]] };
export function markerLevel() {
  return {
    faces: [quad],
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: Math.PI / 2 } }],
    events: {
      entities: [{ id: 'boulder', type: 'boulder', on: true, position: [3, 2, 0.5], radius: 0.6, color: '#8a8178' }, { id: 'lamp', on: true, position: [-2, 4, 1] }],
      inputs: [{ on: 'key', key: 'q', emit: { type: 'push' } }, { on: 'key', key: 'e', emit: { type: 'hide' } }, { on: 'key', key: 'r', emit: { type: 'drop', at: [1, 1, 0] } }, { on: 'pick', emit: { type: 'picked' } }],
      reactions: [
        { on: 'push', do: 'move', target: 'boulder', to: [5, 2, 0.5] },
        { on: 'hide', do: 'toggle', target: 'lamp', to: false },
        { on: 'drop', do: 'spawn', type: 'crate', at: 'event.at' },
      ],
    },
  };
}
const frames = () => Array.from({ length: 30 }, (_, i) => (i === 5 ? { keys: ['q'] } : i === 10 ? { keys: ['e'] } : i === 15 ? { keys: ['r'] } : {}));

describe('the bus\'s entities as markers', () => {
  it('the row is built; pushes, crops and supplies follow it', () => {
    expect(busCoverage(markerLevel().events).godot.built).toEqual(expect.arrayContaining(['effect:entities', 'effect:logic']));
    expect(busCoverage(markerLevel().events).godot.partial).toEqual(['fact:aim']);
    for (const k of ['push', 'crops']) expect(mechanicMarks('godot')[k].godot, k).not.toBe('absent');
    expect(extractBus(markerLevel()).inputs.map((i) => i.on)).toEqual(['key', 'key', 'key', 'pick']);
  });

  it.skipIf(!GODOT)('a headless Godot draws them where its bus puts them, the bus equal to the web\'s (MOJULO_GODOT)', () => {
    const { web, godot } = playBoth(markerLevel(), frames(), { godot: GODOT });
    expect(godot.error).toBe(null);
    const bus = (keys) => keys.map((k) => k.split('|')[0]);
    expect(bus(godot.keys)).toEqual(bus(web.keys));
    // the markers as drawn, against the web's last bus state
    const last = JSON.parse(web.keys.at(-1).split('|')[0]);
    const q = (v) => Math.floor(v / 0.05 + 0.5);
    const want = last.entities.map((e) => `${e.id}:${e.on === false ? 'off' : 'on'}:${e.position.map(q).join(',')}`).sort().join(' ');
    const drawn = godot.text.split('\n').find((l) => l.startsWith('[mojulo-markers] ')).slice('[mojulo-markers] '.length);
    expect(drawn).toBe(want);
    expect(want).toMatch(/boulder:on:100,40,10/);
    expect(want).toMatch(/lamp:off:/);
    // a spawn with no template is hidden (event-bus spawnEntity: on = !!template.on), the web's and Godot's alike: the
    // twin's ambiguity, pinned in level-equivalence.test.js
    expect(want).toMatch(/crate-\w+:off:20,20,0/);
  }, 300000);

  const PLANTS = [
    { name: 'shown whatever its on', from: 'm.visible = not (e.get("on") is bool and e["on"] == false)', to: 'm.visible = true' },
    { name: 'placed once, never moved', from: '		var p: Array = e.get("position", [0, 0, 0])\n		m.position = to_yup(p) * bus_units', to: '		var p: Array = e.get("position", [0, 0, 0])\n		if m.position == Vector3.ZERO: m.position = to_yup(p) * bus_units' },
    { name: 'the frame not turned', from: '		m.position = to_yup(p) * bus_units\n		m.visible', to: '		m.position = Vector3(p[0], p[1], p[2]) * bus_units\n		m.visible' },
  ];
  it.skipIf(!GODOT)('every planted bug in the markers is caught (MOJULO_GODOT)', () => {
    for (const p of PLANTS) {
      const { web, godot } = playBoth(markerLevel(), frames(), { godot: GODOT, mutate: [{ file: 'level.gd', from: p.from, to: p.to }] });
      const last = JSON.parse(web.keys.at(-1).split('|')[0]), q = (v) => Math.floor(v / 0.05 + 0.5);
      const want = last.entities.map((e) => `${e.id}:${e.on === false ? 'off' : 'on'}:${e.position.map(q).join(',')}`).sort().join(' ');
      const drawn = (godot.text.split('\n').find((l) => l.startsWith('[mojulo-markers] ')) || '').slice('[mojulo-markers] '.length);
      expect(drawn, p.name).not.toBe(want);
    }
  }, 600000);
});
