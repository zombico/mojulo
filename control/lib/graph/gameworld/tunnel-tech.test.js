import { describe, it, expect } from 'vitest';
import { tunnelTech, techDomain, composeThing, TECH_TRAITS } from './tunnel-tech.js';
import { buildBlock, blockLaws, readBlock, FUNCTION_IDS } from '../era/blocks.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';
import { techIndexHtml } from './tech-html.js';

const INTENTS = ['a tracked ore hauler', 'a solar power station', 'a wind turbine relay beacon', 'a portable scanner', 'an automated fabricator', 'a heavy crane loader',
  'a hydroponic greenhouse', 'a fuel tank', 'a survey rover with a dish', 'a shelter pod', 'a tall comms tower beacon', 'a busy industrial refinery with storage'];

describe('the civilization tunnel: technology', () => {
  it('every function has words, and a thing tunnelled for it reads as doing it', () => {
    const named = new Set(Object.values(TECH_TRAITS).filter((t) => t.fn).map((t) => t.fn));
    expect([...named].sort()).toEqual([...FUNCTION_IDS].sort());
    for (const f of FUNCTION_IDS) {
      const word = Object.values(TECH_TRAITS).find((t) => t.fn === f).words[0];
      const r = tunnelTech(`a ${word}`, { seed: 2 });
      expect(r.plan.block.functions, f).toContain(f);
      expect(blockLaws(r.plan.block, r.built.b).find((l) => l.law === 'functions-read').ok, f).toBe(true);
    }
  }, 30000);

  it('a dozen intents hold every trait and law, over seeds; the plan is a block a library can keep', () => {
    for (const i of INTENTS) for (const seed of [1, 3, 7]) {
      const r = tunnelTech(i, { seed });
      expect(r.complete, `${i} ${seed}: ${JSON.stringify(r.passes.at(-1))}`).toBe(true);
      expect(readBlock(r.plan.block, STARTER_BLOCKS)).toBe(r.plan.block);
    }
    expect(JSON.stringify(tunnelTech('a tracked ore hauler', { seed: 4 }))).toBe(JSON.stringify(tunnelTech('a tracked ore hauler', { seed: 4 })));
  }, 60000);

  it('modifiers change how it looks doing it: track or wheels, wings or a rotor, a tool or an installation, an arm and its cycle', () => {
    const prims = (i) => tunnelTech(i).plan.block.parts.map((p) => p.prim);
    expect(prims('a tracked hauler')).toContain('track');
    expect(prims('a wheeled hauler')).toContain('wheel');
    expect(prims('a wind generator')).toContain('fin');
    expect(prims('a solar generator')).toContain('panel');
    expect(tunnelTech('a small scanner').plan.block.tier).toBe('tool');
    expect(tunnelTech('a scanner station').plan.block.tier).toBe('installation');
    const a = tunnelTech('an automated fabricator').plan.block;
    expect(a).toMatchObject({ tier: 'automation', cycle: 'swing' });
    // the same grammar at another scale: a tool's body is a quarter of a machine's
    const box = (i) => buildBlock(tunnelTech(i).plan.block).box.size[0];
    expect(box('a small scanner')).toBeLessThan(box('a scanner') / 2);
  });

  it('a lost signature is thickened, not the whole thing: the tweak names the piece', () => {
    const D = techDomain(), c = { ...D.start(1, { id: 'thin', read: 'a thin hauler' }), functions: ['move'], running: 'track', thick: { 'track-l': 0.5 } };
    const b = D.build(c, 1), lost = D.laws(b).find((l) => l.law === 'reads-at-ring');
    expect(lost.ok).toBe(false);
    const t = D.tweak(c, { traits: [], laws: [lost] }, 1, 1);
    expect(t.changed).toEqual(['track-l × 0.63 (reads at its ring)']);
    expect(composeThing(t.candidate).parts.find((p) => p.id === 'track-l').r).toBeGreaterThan(composeThing(c).parts.find((p) => p.id === 'track-l').r);
  });

  it('the tech index is the same page every time', () => {
    const a = techIndexHtml({ seed: 1 });
    expect(a).toBe(techIndexHtml({ seed: 1 }));
    expect(a).toContain('TECHNOLOGY INDEX');
    for (const f of FUNCTION_IDS) expect(a).toContain(`id="fn-${f}"`);
  }, 60000);
});
