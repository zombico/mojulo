import { describe, it, expect, beforeAll } from 'vitest';
import { manualPlan, manualPages, hardwareGlyph } from './manual.js';
import { hardwarePart } from './hardware.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

const bookcase = {
  id: 'bookcase', unit: 'mm',
  members: [
    { id: 'side-l', box: { min: [0, 0, 0], max: [18, 300, 1800] }, material: 'mfc' },
    { id: 'side-r', box: { min: [782, 0, 0], max: [800, 300, 1800] }, material: 'mfc' },
    { id: 'top', box: { min: [18, 0, 1782], max: [782, 300, 1800] }, material: 'mfc' },
    { id: 'bottom', box: { min: [18, 0, 60], max: [782, 300, 78] }, material: 'mfc' },
    { id: 'plinth', box: { min: [18, 20, 0], max: [782, 38, 60] }, material: 'mfc' },
    { id: 'shelf', box: { min: [18, 0, 900], max: [782, 280, 918] }, material: 'mfc' },
    { id: 'shelf-a', box: { min: [19, 0, 480], max: [781, 278, 498] }, material: 'mfc' },
    { id: 'back', box: { min: [12, 282, 72], max: [788, 285, 1788] }, material: 'hardboard', grain: 'z' },
  ],
  joints: [
    ...['top', 'bottom', 'shelf', 'plinth'].flatMap((a) => [{ type: 'cam-lock', a, b: 'side-l' }, { type: 'cam-lock', a, b: 'side-r' }]),
    { type: 'shelf-pin', a: 'shelf-a', b: 'side-l' }, { type: 'shelf-pin', a: 'shelf-a', b: 'side-r' },
    ...['side-l', 'side-r', 'top', 'bottom'].map((b) => ({ type: 'groove', a: 'back', b })),
  ],
};

describe('construction/manual — a frame writes its own instructions', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('plans fit steps, then the parts in the order they seat, then fixing it to the wall', () => {
    const plan = manualPlan(bookcase);
    expect(plan.steps.map((s) => s.kind)).toEqual(['fit', 'fit', 'fit', 'fit', 'join', 'join', 'join', 'join', 'anchor']);
    expect(plan.steps[0]).toMatchObject({ hosts: ['side-l', 'side-r'], times: 2 });
    expect(plan.steps.filter((s) => s.kind === 'join').map((s) => s.adds)).toEqual([['top', 'bottom', 'plinth'], ['shelf', 'back'], ['side-r'], ['shelf-a']]);
    // every cam is turned once, on the step its joint closes
    expect(plan.steps.reduce((n, s) => n + s.turns.length, 0)).toBe(14);
  });
  it('puts every part and every fitting in exactly one step, and counts the inventory from them', () => {
    const plan = manualPlan(bookcase);
    const members = [plan.steps.find((s) => s.kind === 'join').base[0], ...plan.steps.flatMap((s) => s.adds || [])];
    expect(members.slice().sort()).toEqual(bookcase.members.map((m) => m.id).sort());
    const pieces = plan.steps.flatMap((s) => (s.kind === 'fit' ? s.hosts.flatMap((h) => plan.low.parts.filter((p) => p.pre === h).map((p) => p.id)) : s.pieces));
    expect(new Set(pieces).size).toBe(pieces.length);
    expect(pieces.slice().sort()).toEqual(plan.low.parts.filter((p) => p.code).map((p) => p.id).sort());
    const bom = Object.fromEntries(plan.low.report.furniture.hardware.map((h) => [h.code, h.count]));
    expect(Object.fromEntries(plan.hardware.map((h) => [h.code, h.count]))).toEqual(bom);
    expect(plan.hardware.map((h) => h.letter)).toEqual(['A', 'B', 'C', 'D']);
    // identical parts share a number: the two sides, the top and bottom
    expect(plan.parts.map((p) => [p.n, p.count])).toEqual([[1, 2], [2, 2], [3, 1], [4, 1], [5, 1], [6, 1]]);
  });
  it('draws A4 pages in black ink on white, wordless, the same every time', () => {
    const a = manualPages(bookcase), b = manualPages(bookcase);
    expect(a.pages.map((p) => p.svg)).toEqual(b.pages.map((p) => p.svg));
    expect(a.pages.map((p) => p.name)).toEqual(['cover', 'inventory', ...a.plan.steps.map((s) => `step-0${s.n}`)]);
    for (const p of a.pages) {
      expect(p.svg).toMatch(/^<svg [^>]*width="210mm" height="297mm" viewBox="0 0 210 297"/);
      const colours = [...p.svg.matchAll(/(?:stroke|fill)="([^"]+)"/g)].map((m) => m[1]);
      expect(colours.every((c) => c === '#000' || c === '#fff' || c === 'none' || c.startsWith('url('))).toBe(true);
      const words = [...p.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
      // numerals, letters, counts, sizes and units only; the title is the frame's id
      expect(words.filter((w) => w !== 'BOOKCASE' && /[a-z]{3,}/.test(w.replace(/mm|kg/g, '')))).toEqual([]);
    }
  });
  it('draws each fitting at true scale on the inventory', () => {
    const P = hardwarePart('wood-4x30');
    const d = hardwareGlyph(P, 0, 0);
    const xs = [...d.matchAll(/([ML]|^|L)(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => +m[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30, 1);
    const inv = manualPages(bookcase).pages.find((p) => p.name === 'inventory').svg;
    expect(inv).toMatch(/10 mm · 1:1/);
    expect(inv).toMatch(/<line x1="18" y1="\d+" x2="28"/);                   // the check bar is 10 units = 10 mm
  });
  it('builds a manual for a timber bent too, its pegs going in with their joints', () => {
    const kigumi = {
      id: 'kigumi', unit: 'cm', species: 'hinoki',
      members: [
        { id: 'post-l', from: [0, 0, 0], to: [0, 0, 282], stock: '4sun' }, { id: 'post-r', from: [300, 0, 0], to: [300, 0, 282], stock: '4sun' },
        { id: 'hari-a', from: [-30, 0, 282], to: [150, 0, 282], stock: [12, 24], species: 'sugi' }, { id: 'hari-b', from: [150, 0, 282], to: [330, 0, 282], stock: [12, 24], species: 'sugi' },
        { id: 'nuki', from: [-15, 0, 150], to: [315, 0, 150], stock: 'nuki' },
      ],
      joints: [
        { type: 'hozo', a: 'post-l', b: 'hari-a', pin: true }, { type: 'hozo', a: 'post-r', b: 'hari-b', pin: true }, { type: 'kanawa-tsugi', a: 'hari-a', b: 'hari-b' },
        { type: 'nuki', a: 'nuki', b: 'post-l', drive: 'from' }, { type: 'nuki', a: 'nuki', b: 'post-r', drive: 'to' },
      ],
    };
    const plan = manualPlan(kigumi);
    expect(plan.steps.map((s) => s.adds)).toEqual([['hari-b'], ['hari-a'], ['nuki']]);
    expect(plan.steps.flatMap((s) => s.pieces).length).toBe(5);                // two komisen, the shachi key, two kusabi
    expect(manualPages(kigumi).pages).toHaveLength(5);
  });
});
