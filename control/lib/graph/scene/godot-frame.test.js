// ONE FRAME (kernel/level.gd _frame): the order a frame runs in, the page's (scene/channels/events.js then the world's
// step, game/level-sim.js), for live play and the harness alike. A menu the bus opens freezes the world from the very
// next world step: the page reads its menus after the bus (interact-channel.js __syncMenus) and its stepControllable
// steps no world while one is up. Played in both engines by the same held input, the pilot stops where the menu opened
// and the keys are equal frame by frame.
import { describe, it, expect } from 'vitest';
import { playBoth } from './godot-harness.js';
import { playScript } from '../game/level-equivalence.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = (z) => ({ corners: [[-30, -30, z], [30, -30, z], [30, 30, z], [-30, 30, z]] });

// a walker heading +x into a zone at x = 4 that opens a read menu
export function menuLevel() {
  return {
    faces: [quad(0)],
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', speed: 3, eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } }],
    events: {
      vars: { 'ui-menu-sign': 0 },
      sources: [{ type: 'zone', zone: 'sign', at: [4, 0, 0], radius: 0.6, planar: true, watch: 'hero' }],
      reactions: [{ on: 'enter', match: { zone: 'sign' }, do: 'set', var: 'ui-menu-sign', to: 1 }],
      menus: [{ id: 'sign', var: 'ui-menu-sign', kind: 'read', pages: ['a sign'] }],
    },
  };
}
const held = (n) => Array.from({ length: n }, () => ({ forward: 1 }));

describe('the frame', () => {
  it('on the web, the pilot stands from the frame its bus opens the menu, held input or not', () => {
    const run = playScript(menuLevel(), held(60));
    const x = run.keys.map((k) => Number(k.split('|')[1].split(':')[1].split(',')[0]));
    const opened = run.keys.findIndex((k) => JSON.parse(k.split('|')[0]).vars['ui-menu-sign'] === 1);
    expect(opened).toBeGreaterThan(0);
    expect(x[opened - 1]).toBeGreaterThan(x[opened - 2]);   // walking up to it
    expect(x[opened]).toBe(x[opened - 1]);                   // the world step after the bus that opened it: frozen
    expect(x.at(-1)).toBe(x[opened]);                        // and frozen on, forward still held
  });

  it.skipIf(!GODOT)('a headless Godot freezes in the same frame as the web: the pilot\'s key equal frame by frame (MOJULO_GODOT)', () => {
    const { godot, compare } = playBoth(menuLevel(), held(60), { godot: GODOT });
    expect(godot.error).toBe(null);
    expect(compare.first).toBe(null);
    expect(compare.equal).toBe(true);
  }, 300000);
});
