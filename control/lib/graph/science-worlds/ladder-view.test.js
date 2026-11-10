import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { planLadder, assembleLadderScene } from './ladder-view.js';

// A ladder of scales as one page: the card's worked examples (each solves and holds), a body's matter ladder expanded,
// a lower rung feeding the one above, the gates that read the ladder itself (cited, ordered), the page's crumbs, and the
// refusals.

const CARD = 'lib/graph/views/view-vocab/ladder.md';
const examples = () => [...readFileSync(CARD, 'utf8').split('## Worked examples')[1].matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
const gateOf = (p, id) => p.gates.find((g) => g.id === id);
const drop = { id: 'drop', simulated: { kind: 'classical', model: {
  bodies: [{ id: 'ball', matter: 'steel', radius: '5 cm', at: [0, 0, 1] }], laws: [{ law: 'gravity-uniform' }, { law: 'plane' }], duration: 1,
} } };
const said = (id, size, source = 'Krane, Introductory Nuclear Physics, 1988') => ({ id, explained: { text: 'a sentence', source, ...(size ? { size } : {}) } });

describe('science worlds: a ladder of scales on one page', () => {
  it('runs every worked example on its card with every gate holding', () => {
    const ex = examples();
    expect(ex.length).toBeGreaterThan(1);
    for (const params of ex) {
      const p = planLadder({ kind: 'ladder-view', ...params });
      expect(p.gates.filter((g) => !g.ok).map((g) => g.id)).toEqual([]);
    }
  });

  it('expands a body into its matter ladder, top down, each rung saying what it is, the cell drawn and held to its lattice', () => {
    const p = planLadder({ kind: 'ladder-view', rungs: [drop, { below: { rung: 'drop', body: 'ball' } }] });
    expect(p.rungs.map((r) => r.status)).toEqual(['simulated', 'explained', 'depicted', 'explained', 'explained']);
    expect(p.rungs.at(-1).id).toBe('ball-nucleus');
    expect(gateOf(p, 'ball-cell/ladder-depicted').ok).toBe(true);
    expect(gateOf(p, 'ladder-ordered').ok).toBe(true);
    expect(gateOf(p, 'drop/energy-never-gained')).toBeDefined();
    // every step down is a power of ten from the rung above it
    expect(p.rungs.slice(1).every((r) => Number.isInteger(r.step?.power) && r.step.power <= 0)).toBe(true);
  });

  it('feeds a lower rung\'s measurement up, and refuses one read from above', () => {
    const [, gel] = examples();
    const p = planLadder({ kind: 'ladder-view', ...gel });
    expect(gateOf(p, 'jar/handoff-held').ok).toBe(true);
    expect(p.rungs[0].solved.gel.bodies.bead.held).not.toBeNull();
    const upside = { ...gel, rungs: [gel.rungs[1], gel.rungs[0], gel.rungs[2]] };
    expect(() => planLadder({ kind: 'ladder-view', ...upside })).toThrow(/data flows up/);
  });

  it('advises an explained rung that names no work and year, and a rung no smaller than the one above', () => {
    const p = planLadder({ kind: 'ladder-view', rungs: [drop, said('a', '1 mm', 'common knowledge'), said('b', '1 m')] });
    expect(gateOf(p, 'ladder-cited').ok).toBe(false);
    expect(gateOf(p, 'ladder-cited').value.uncited).toEqual(['a']);
    expect(gateOf(p, 'ladder-ordered').value.unordered).toEqual(['b']);
  });

  it('draws one case per rung with a crumb each, opens where asked, and shows the readout on its own rung only', () => {
    const page = assembleLadderScene({ kind: 'ladder-view', rungs: [drop, said('n', '9 fm')], open: 'n' });
    const L = page.science.ladder;
    expect(L.crumbs.map((c) => c.label)).toEqual(['drop', 'n']);
    expect(L.crumbs[1].cam).toBe(0);
    expect(L.crumbs[0].readout).toBe(true);
    expect(page.cameras[0].name).toBe('n');
    expect(page.chrome).toBe(false);
    expect(page.science.honesty.sections[0].head).toMatch(/^The ladder/);
    expect(page.title).toBe('drop · down to n');
  });

  it('refuses a picture only a shader can draw, a below with no body of matter, and a repeated id', () => {
    const light = { id: 'l', simulated: { kind: 'relativistic', model: { system: 'light' } } };
    expect(() => planLadder({ kind: 'ladder-view', rungs: [light] })).toThrow(/ladder's case/);
    expect(() => planLadder({ kind: 'ladder-view', rungs: [drop, { below: { rung: 'drop', body: 'nobody' } }] })).toThrow(/made of a matter/);
    expect(() => planLadder({ kind: 'ladder-view', rungs: [drop, drop] })).toThrow(/used twice/);
  });
});
