// The program a generated stack is built to. The laws: the open core is named for what shares it; a house that asks
// for more bedrooms than its footprint builds says so in Open and in next, with the field that fixes it; the stair
// schedule says the width built.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { openConcerns, nextSteps } from './open.js';
import { structureBookHtml } from './book-html.js';

const ASK3 = { kind: 'floorplan', title: 'p', seed: 5, storeys: 2, tier: { base: 'house', beds: 3, core: ['L', 'K', 'D'] }, windows: true };

describe('the program', () => {
  it('names the open core for the zones that share it', () => {
    const r = readStructure(ASK3);
    expect(r.rooms.find((x) => x.glyph === 'L').name).toBe('living / kitchen / dining');
    expect(r.program.core).toEqual(['L', 'K', 'D']);
    const cottage = readStructure({ kind: 'floorplan', title: 'c', seed: 11, storeys: 2, tier: 'cottage', windows: true });
    expect(cottage.rooms.find((x) => x.glyph === 'L').name).toBe('living / kitchen');
    expect(readStructure({ kind: 'floorplan', title: 'f', seed: 3, windows: true }).program).toBeUndefined();   // not a generated stack
  });

  it('says when fewer bedrooms are built than asked, with the field that fixes it', () => {
    const r = readStructure(ASK3);
    expect(r.program.beds).toEqual({ asked: 3, built: 2 });
    const step = openConcerns(ASK3, r).find((c) => c.id === 'program');
    expect(step).toMatchObject({ outcome: 'layout', tab: 'Rooms', field: expect.stringMatching(/^tier\.study: false/) });
    expect(nextSteps(ASK3, r).map((s) => s.id)).toContain('program');
    const kept = { ...ASK3, tier: { ...ASK3.tier, study: false } };
    expect(readStructure(kept).program.beds.built).toBe(3);
    expect(openConcerns(kept, readStructure(kept)).some((c) => c.id === 'program')).toBe(false);
    // a drawn program (no tier given) is the draw's, fitted at mint: no step
    const drawn = { kind: 'floorplan', title: 'd', seed: 5, storeys: 2, windows: true };
    expect(openConcerns(drawn, readStructure(drawn)).some((c) => c.id === 'program')).toBe(false);
  });

  it('the stair schedule says the width built, its risers and going', () => {
    const r = readStructure(ASK3);
    expect(r.elements.stairs[0].width).toBeCloseTo(3.5, 1);   // the default flight, 42 in
    const html = structureBookHtml(ASK3, { ref: 'sk_p' });
    expect(html).toMatch(/L1 → L2 · 3'-6&quot; wide · \d+ risers of [\d.]+ in · going [\d.]+ in/);
    const wide = { ...ASK3, stairs: [{ from: 0, to: 1, width: 4 }] };
    expect(readStructure(wide).elements.stairs[0].width).toBeCloseTo(4, 1);
  });

  it('the Walk tab offers what a house can do: walk and film, not a game level', () => {
    const html = structureBookHtml(ASK3, { ref: 'sk_p' });
    expect(html).toContain("forge_motion({ subject: { world_ref: 'sk_p' }");
    expect(html).not.toContain('create_game(');
  });
});
