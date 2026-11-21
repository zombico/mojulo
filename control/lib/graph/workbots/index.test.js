// The worker bots (workbots/): a toy world's worker bots in their own low-poly language. The concepts: a bot is a few
// big primitives (a low face count), in its card's colours by role; it has a FACE, two lit eyes and a mouth on a light
// plate, turned toward the side camera; its parts ride their bones (the body, the head, each arm), so a wreck takes it
// apart; it stands on the ground; its words are read and refused; the same card, the same bot.
import { describe, it, expect } from 'vitest';
import { WORKBOTS, WORKBOT_IDS, readWorkbotSpec, workbotFaces, workbotFigure, workbotHeight, workbotVents } from './index.js';

const [id] = WORKBOT_IDS;
describe('the worker bots', () => {
  it('a few big primitives, in its card\'s colours, standing on the ground', () => {
    const { buckets, height } = workbotFaces({ card: id }), all = [...buckets.values()].flat();
    expect(all.length).toBeLessThan(900);   // (a few big primitives: a mech frame of the mecha shelf is thousands)
    expect(Math.min(...all.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(0, 6);
    expect(height).toBeCloseTo(workbotHeight({ card: id }), 6);
    expect(all.some((f) => f.fill === WORKBOTS[id].palette.paint)).toBe(true);
  });
  it('a FACE: two lit eyes and a mouth on a light plate, turned toward the side camera', () => {
    const P = WORKBOTS[id].palette, head = workbotFaces({ card: id }).buckets.get('head');
    const eyes = head.filter((f) => f.fill === P.eye && f.corners.length > 4);
    expect(eyes).toHaveLength(2);
    // (the eyes' discs face out of the head's front, turned toward the side the side camera sees: its -x)
    for (const e of eyes) expect(e.normal[0]).toBeLessThan(-0.3);
    // (the mouth: its dark bars, each a box's six faces, in the mouth's colour lit or shaded)
    const C = WORKBOTS[id].parts.find((p) => p.kind === 'face'), lum = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255; };
    const dark = head.filter((f) => lum(f.fill) <= lum(P.mouth) + 0.01);
    expect(dark.length).toBeGreaterThanOrEqual(6 * (C.mouth.kind === 'grille' ? C.mouth.bars : 1));
    expect(lum(P.plate)).toBeGreaterThan(0.7);
  });
  it('its round head (a half sphere each side) and its vents, where its steam leaves', () => {
    const C = WORKBOTS[id], caps = C.parts.filter((p) => p.kind === 'cap' && p.bone === 'head');
    expect(new Set(caps.map((p) => p.side))).toEqual(new Set([1, -1]));
    const V = workbotVents({ card: id });
    expect(V.length).toBe(C.parts.filter((p) => p.vent).length);
    // (each at its pipe's end, pointing up and back out of it)
    for (const v of V) { expect(v.dir[2]).toBeGreaterThan(0.3); expect(v.dir[1]).toBeLessThan(0); expect(v.at[2]).toBeGreaterThan(workbotHeight({ card: id }) * 0.6); }
  });
  it('a CEL body, as every body on the map is: its lit and shade bakes on the same corners, its eyes its signal', () => {
    const F = workbotFigure({ card: id });
    expect(F.toon).toBe(true);
    for (const p of F.parts) { expect(p.colS).toBeDefined(); expect(p.colS.length).toBe(p.col.length); expect(p.colS).not.toBe(p.col); }
    expect(F.parts.filter((p) => p.sigM)).toHaveLength(1);
    expect(F.parts[F.bones.findIndex((b) => b.id === 'head')].sigM).toBeDefined();
  });
  it('its parts ride their bones: the body, the head, each arm', () => {
    const F = workbotFigure({ card: id });
    expect(F.rig).toBe(true);
    expect(F.bones.map((b) => b.id)).toEqual(['root', 'head', 'armR', 'armL']);
    expect(F.parts.every(Boolean)).toBe(true);
    expect(F.workbot).toMatchObject({ card: id });
  });
  it('its words are read and refused', () => {
    expect(readWorkbotSpec({ card: id })).toEqual({ card: id });
    expect(() => readWorkbotSpec({ card: 'nobody' })).toThrow(/card/);
    expect(() => readWorkbotSpec({ card: id, size: 2 })).toThrow(/not a worker bot/);
    expect(() => readWorkbotSpec({ card: id, palette: { glow: '#ffffff' } })).toThrow(/palette/);
    const tinted = workbotFaces({ card: id, palette: { paint: '#3a7bd5' } }).buckets.get('root');
    expect(tinted.some((f) => f.fill === '#3a7bd5')).toBe(true);
  });
  it('the same card, the same bot', () => {
    expect(JSON.stringify(workbotFigure({ card: id }))).toBe(JSON.stringify(workbotFigure({ card: id })));
  });
});
