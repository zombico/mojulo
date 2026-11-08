import { describe, it, expect } from 'vitest';
import { ladderOf, cellAtoms, nearestNeighbour, depictedGate, STRUCTURE } from './ladder.js';
import { MATTER } from '../rupa/matter.js';
import { solveClassical } from './classical/solve.js';
import { planClassicalWorld, assembleClassicalScene } from './classical/world.js';
import { placeScience } from './setting.js';

// The ladder of scales under a body: one case per procedure (a depicted cubic cell for each lattice the drawing holds,
// an explained network, a soil's grain read from rupa, a gap where the table has nothing), the step rule, the drawn
// cell's gate, the page's section and inset, the place rung in a world, and the absent-channel rule.

const STATUS = ['simulated', 'depicted', 'explained'];
// one matter per lattice the drawing holds, picked from the table
const byLattice = (lattice) => Object.keys(STRUCTURE).find((id) => STRUCTURE[id].some((r) => r.cell?.lattice === lattice));
const solidWithout = () => Object.keys(MATTER).find((id) => !STRUCTURE[id] && !MATTER[id].grain && !['liquid', 'gas'].includes(MATTER[id].family));
const dropOf = (matter, dress) => ({
  kind: 'classical-view',
  model: { bodies: [{ id: 'ball', matter, radius: '5 cm', at: [0, 0, 1] }], laws: [{ law: 'gravity-uniform' }, { law: 'plane' }], duration: 1 },
  ...(dress ? { dress } : {}),
});

describe('science worlds: the ladder of scales', () => {
  it('runs from the simulated body down to an explained nucleus, every rung saying what it is and where its numbers come from', () => {
    const rungs = ladderOf(MATTER[byLattice('bcc')], 0.05);
    expect(rungs[0]).toMatchObject({ id: 'body', status: 'simulated', size: 0.1 });
    expect(rungs.at(-1).id).toBe('nucleus');
    for (const r of rungs) {
      expect(STATUS).toContain(r.status);
      expect(r.what.length).toBeGreaterThan(10);
      expect(r.source).toBeTruthy();
      if (r.status === 'explained') expect(r.why).toBeTruthy();
    }
    // top down: no rung is larger than the body
    expect(rungs.slice(1).every((r) => r.size < rungs[0].size)).toBe(true);
  });

  it('gives a rung under a thousandth of the one above its own place, and says so', () => {
    const rungs = ladderOf(MATTER[byLattice('fcc')], 0.05);
    const nucleus = rungs.find((r) => r.id === 'nucleus'), atom = rungs.find((r) => r.id === 'atom');
    expect(nucleus.step.of).toBe('atom');
    expect(nucleus.step.power).toBe(Math.round(Math.log10(nucleus.size / atom.size)));
    expect(nucleus.ownRung).toMatch(/rung of its own/);
    expect(atom.ownRung).toBeUndefined();
  });

  it('draws a cubic cell from its lattice constant, and its gate measures the drawing against the source', () => {
    for (const lattice of ['bcc', 'fcc']) {
      const cell = ladderOf(MATTER[byLattice(lattice)], 0.05).find((r) => r.status === 'depicted').cell;
      const per = 1e9;
      const atoms = cellAtoms(cell).map((p) => p.map((c) => c * per));
      const g = depictedGate({ label: 'cell', cell, atoms, edge: cell.a * per, per });
      expect(g.ok).toBe(true);
      expect(g.value.measured.nn).toBeCloseTo(nearestNeighbour(cell), 15);
      // a drawing off its source fails the gate
      const off = depictedGate({ label: 'cell', cell, atoms: atoms.map((p) => p.map((c) => c * 1.01)), edge: cell.a * per, per });
      expect(off.ok).toBe(false);
    }
  });

  it('explains what cannot be drawn honestly: a network that never repeats has no cell', () => {
    const rungs = ladderOf(MATTER.glass, 0.05);
    expect(rungs.some((r) => r.status === 'depicted')).toBe(false);
    expect(rungs.find((r) => r.id === 'network').why).toMatch(/no cell/);
  });

  it('reads a soil\'s grain from rupa\'s own table, and ends on a gap where nothing below is sourced', () => {
    const soil = Object.keys(MATTER).find((id) => MATTER[id].grain);
    expect(ladderOf(MATTER[soil], 0.05)[1]).toMatchObject({ id: 'grain', size: MATTER[soil].grain });
    const rungs = ladderOf(MATTER[solidWithout()], 0.05);
    expect(rungs.at(-1)).toMatchObject({ id: 'gap', gap: true });
    expect(rungs.length).toBe(2);
  });

  it('rides the matter readout, and adds nothing to a model that names no matter', () => {
    const r = solveClassical({ model: dropOf('steel').model });
    expect(r.matter.bodies.ball.ladder.map((x) => x.id)).toEqual(ladderOf(MATTER.steel, 0.05).map((x) => x.id));
    const bare = assembleClassicalScene({ kind: 'classical-view', model: { bodies: [{ id: 'ball', mass: 1, radius: 0.05, at: [0, 0, 1] }], laws: [{ law: 'gravity-uniform' }, { law: 'plane' }], duration: 1 } });
    expect(bare.science.honesty.sections.some((s) => s.head.startsWith('The ladder'))).toBe(false);
    expect(JSON.stringify(bare)).not.toContain('ladder');
  });

  it('lists the ladder on the page and, asked, draws the depicted cell beside the demo with its gate and its liberties', () => {
    const listed = assembleClassicalScene(dropOf('steel'));
    const section = listed.science.honesty.sections.find((s) => s.head.startsWith('The ladder'));
    expect(section.items.length).toBe(ladderOf(MATTER.steel, 0.05).length);
    expect(listed.planets.length).toBe(1);

    const plan = planClassicalWorld(dropOf('steel', { ladder: 'ball' }));
    const g = plan.drawnGates.find((x) => x.id === 'ladder-depicted');
    expect(g.ok).toBe(true);
    expect(plan.planets.length).toBe(1 + cellAtoms({ lattice: 'bcc', a: 1 }).length);
    expect(plan.drawn.some((l) => /larger than the demo/.test(l.what))).toBe(true);
    expect(plan.drawn.some((l) => /nuclei are not drawn/.test(l.what))).toBe(true);
  });

  it('refuses a ladder for a body with no matter, or one whose ladder has nothing to draw', () => {
    expect(() => planClassicalWorld({ ...dropOf('steel', { ladder: 'nobody' }) })).toThrow(/dress\.ladder/);
    const bare = dropOf('steel', { ladder: 'ball' });
    bare.model.bodies[0] = { id: 'ball', mass: 1, radius: 0.05, at: [0, 0, 1] };
    expect(() => planClassicalWorld(bare)).toThrow(/names no matter/);
    expect(() => planClassicalWorld(dropOf('glass', { ladder: 'ball' }))).toThrow(/no depicted rung/);
  });

  it('puts the place above the body when the demo stands 1:1 in a world', () => {
    const floor = { corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], fill: '#556' };
    const payload = { faces: [floor], cameras: [] };
    placeScience(payload, { kind: 'classical', model: { bodies: [{ id: 'ball', matter: 'steel', radius: '5 cm', at: [0, 0, 1] }], laws: [{ law: 'gravity-uniform' }], duration: 0.5 }, at: [0, 0, 0], ground: 'from-world' });
    const section = payload.science.honesty.sections.find((s) => s.head.startsWith('The ladder'));
    expect(section.items[0].text).toBe('place: simulated');
    expect(section.items[0].note).toMatch(/plane law/);
    expect(section.items[1].text).toMatch(/^body: simulated/);
  });
});
