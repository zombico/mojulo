import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from './scene-three.js';
import { buildSim } from './physics-sim.js';

const physics = {
  gravity: [0, 0, -9.8],
  bodies: [
    { id: 'ball', collider: 'sphere', position: [0, 0, 5], radius: 0.5, restitution: 0.6, color: '#ff7a59' },
    { id: 'ground', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0 },
  ],
};

const baseFace = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#445566' };

describe('emitThreeWorld physics channel', () => {
  it('emits the physics block only when bodies are present', () => {
    const without = emitThreeWorld({ faces: [baseFace] });
    expect(without).not.toContain('const PHYSICS =');
    const withPhys = emitThreeWorld({ faces: [baseFace], physics });
    expect(withPhys).toContain('const PHYSICS =');
    expect(withPhys).toContain('stepPhysics = (t) =>');
    expect(withPhys).toContain('window.__mojSim');
  });

  it('wires stepPhysics into the per-frame step', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics });
    expect(html).toContain('stepPhysics(t)');
  });

  it('serializes the manifest physics verbatim into PHYSICS', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics });
    expect(html).toContain(JSON.stringify(physics));
  });

  it('emits the integrator source inline (single source of truth, no drift)', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics });
    // the emitted browser integrator is literally buildSim's source.
    expect(html).toContain(buildSim.toString());
  });

  it('the emitted integrator source is itself valid, runnable JS', () => {
    // Reconstruct what the browser evaluates: (buildSim source)() → a sim API, then run a step.
    // eslint-disable-next-line no-new-func
    const sim = new Function(`return (${buildSim.toString()})();`)();
    const state = sim.createState(physics);
    sim.step(state, 1 / 120);
    expect(state.bodies[0].position[2]).toBeLessThan(5); // the ball fell
    expect(typeof sim.step).toBe('function');
  });
});

const actions = [
  { on: 'pointer', target: 'ball', do: 'impulse', dir: 'camera', gain: 6 },
  { on: 'key', key: ' ', target: 'ball', do: 'impulse', dir: 'up', gain: 8 },
];

describe('emitThreeWorld actions channel', () => {
  it('emits the actions block only with physics + a valid action', () => {
    const noPhys = emitThreeWorld({ faces: [baseFace], actions });
    expect(noPhys).not.toContain('const ACTIONS =');           // gated on physics
    const both = emitThreeWorld({ faces: [baseFace], physics, actions });
    expect(both).toContain('const ACTIONS =');
    expect(both).toContain('window.__mojActions');
  });

  it('scales the impulse by inverse mass (mass is first-class)', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics, actions });
    expect(html).toContain('body.invMass');   // Δv = J·invMass
  });

  it('drops malformed actions', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics, actions: [{ foo: 1 }, ...actions] });
    // only the two well-formed actions survive the filter.
    expect(html).toContain(JSON.stringify(actions));
  });

  it('wires spawn + grab verbs and exposes the spawn helper', () => {
    const verbs = [
      { on: 'pointer', do: 'spawn', template: { collider: 'sphere', radius: 0.5, color: '#9cc4ff' }, height: 9 },
      { do: 'grab', target: 'ball' },
    ];
    const html = emitThreeWorld({ faces: [baseFace], physics, actions: verbs });
    expect(html).toContain('window.__mojSim.spawn');
    expect(html).toContain('__wireGrab');
    expect(html).toContain('window.__mojGrab');
  });
});

describe('emitThreeWorld emitters (autonomous behaviour)', () => {
  const withEmitters = {
    ...physics,
    emitters: [{ template: { collider: 'sphere', radius: 0.4, color: '#7ee2a6' }, at: [0, 0, 10], velocity: [1, 0, 0], rate: 4, max: 12 }],
  };
  it('serializes emitters and steps them in the loop', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics: withEmitters });
    expect(html).toContain('PHYSICS.emitters');
    expect(html).toContain('__stepEmitters');
    expect(html).toContain(JSON.stringify(withEmitters));
  });
});

describe('emitThreeWorld force rules + spin', () => {
  it('carries forces into the serialized physics and syncs orientation', () => {
    const withForces = { ...physics, forces: [{ kind: 'attractor', position: [0, 0, 3], strength: 40 }, { kind: 'drag', coefficient: 0.2 }] };
    const html = emitThreeWorld({ faces: [baseFace], physics: withForces });
    expect(html).toContain(JSON.stringify(withForces.forces));
    expect(html).toContain('m.quaternion.set');   // spin synced to the mesh
  });
});
