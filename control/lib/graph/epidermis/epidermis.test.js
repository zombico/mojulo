/**
 * epidermis — the cube's concepts on one relational head: the brows grow deterministically from their seed, lie on
 * the skin (never inside it, each hair its own length), hang on the brow bridge's strings with the fold and ride the
 * brow pad's action, and a shape word changes them;
 * the lashes root on the lid margins, never enter the skin or the globe, and ride the lid (a shut lid's hang).
 */
import { describe, expect, it } from 'vitest';

import { readEpidermis, growEpidermis, browLine, BROW_SHAPES, LASH_SHAPES } from './epidermis.js';
import { relationalHead } from '../polygonizer/head-relational.js';

const head = relationalHead({ sex: 'male' });
const grown = growEpidermis(head, readEpidermis('default'));
const mm = (d) => (d / head.landmarks.H) * 230;
const of = (g, groom) => g.strands.filter((s) => s.groom === groom);
const rootZ = (g) => of(g, 'brow').reduce((m, s) => m + s.pts[0].z, 0) / of(g, 'brow').length;
const lengthMm = (s) => { let L = 0; for (let i = 1; i < s.pts.length; i++) L += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y, s.pts[i].z - s.pts[i - 1].z); return mm(L); };
// the chord's elevation, root to tip (degrees)
const tipElev = (s) => { const a = s.pts[0], b = s.pts.at(-1); return (Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)) * 180) / Math.PI; };
const mean = (xs) => xs.reduce((m, x) => m + x, 0) / xs.length;

describe('the epidermis cube', () => {
  it('reads a preset, and a shape word with numbers over it', () => {
    expect(readEpidermis('default').hair.brows.arch).toBe(BROW_SHAPES.natural.arch);
    const c = readEpidermis({ hair: { brows: { shape: 'arched', density: 0.5 } } });
    expect(c.hair.brows.arch).toBe(BROW_SHAPES.arched.arch);
    expect(c.hair.brows.density).toBe(0.5);
    expect(() => readEpidermis({ hair: { brows: { shape: 'unibrow' } } })).toThrow();
    expect(readEpidermis({ hair: { lashes: { shape: 'curled' } } }).hair.lashes.curl).toBe(LASH_SHAPES.curled.curl);
    expect(readEpidermis({ hair: { lashes: false } }).hair.lashes).toBeNull();
  });
  it('grows the same brows from the same seed, and others from another', () => {
    expect(growEpidermis(head, readEpidermis('default'))).toEqual(grown);
    const other = growEpidermis(head, readEpidermis({ hair: { brows: { seed: 7 } } }));
    expect(other.strands[0].pts[0]).not.toEqual(grown.strands[0].pts[0]);
  });
  it('lays every hair on the skin, never in it, at its own length', () => {
    expect(grown.counts.brows).toBeGreaterThan(200);
    for (const s of grown.strands) {
      for (const p of s.pts) expect(head.field(p)).toBeGreaterThan(-1e-6);
      expect(lengthMm(s)).toBeLessThan(13);
    }
  });
  it('roots the lashes on the lid margins, outside the globe, the upper longer than the lower', () => {
    expect(grown.counts.lashes).toBeGreaterThan(250);
    const globes = head.relational.eyeRigs.map((r) => r.globe), V = head.relational.V;
    for (const s of [...of(grown, 'lash'), ...of(grown, 'lashLow')]) {
      expect(mm(Math.abs(head.field(s.pts[0])))).toBeLessThan(0.05);   // the root on the lid's skin
      for (const p of s.pts) for (const g of globes) expect(g({ x: p.x / V, y: p.y / V, z: p.z / V })).toBeGreaterThan(0);
      expect(lengthMm(s)).toBeLessThan(LASH_SHAPES.natural.length * 1.16);
    }
    expect(mean(of(grown, 'lash').map(lengthMm))).toBeGreaterThan(mean(of(grown, 'lashLow').map(lengthMm)));
    // the upper curl up, the lower down
    expect(mean(of(grown, 'lash').map(tipElev))).toBeGreaterThan(0);
    expect(mean(of(grown, 'lashLow').map(tipElev))).toBeLessThan(0);
  });
  it('rides the lid: a shut lid\'s lashes hang, clear of the skin', () => {
    const shutHead = relationalHead({ sex: 'male', eyes: 'closed' });
    const shut = growEpidermis(shutHead, readEpidermis({ hair: { brows: false } }));
    expect(shut.counts.brows).toBeUndefined();
    expect(mean(of(shut, 'lash').map(tipElev))).toBeLessThan(mean(of(grown, 'lash').map(tipElev)) - 20);
    for (const s of shut.strands) for (const p of s.pts) expect(shutHead.field(p)).toBeGreaterThan(-1e-6);
  });
  it('rides the brow pad: a raised brow carries its hairs up', () => {
    const raised = growEpidermis(relationalHead({ sex: 'male', actions: { browRaise: 1 } }), readEpidermis('default'));
    expect(mm(rootZ(raised) - rootZ(grown))).toBeGreaterThan(3);
    expect(raised.counts.brows).toBe(grown.counts.brows);   // the same hairs, carried
  });
  it('hangs the brow on the bridge\'s strings with the fold: head and tail on the strings, the peak over the arc\'s', () => {
    const brow = readEpidermis('default').hair.brows, P = head.relational.points;
    for (const h of [head, relationalHead({ sex: 'male', actions: { browLower: 1 } })]) {
      const side = h.relational.bridge.sides.R, L = browLine(P, 'R', brow, side);
      expect(L.spine(0)).toEqual({ x: side.head.x, z: side.head.z });
      expect(L.spine(1).z).toBeCloseTo(side.tail.z, 9);
      expect(L.spine(L.uK).z - side.arc.K.z).toBeCloseTo(0.005 + 0.025 * brow.arch, 9);
    }
    // a pulled string carries the brow's head and the fold's foot alike
    const low = relationalHead({ sex: 'male', actions: { browLower: 1 } }).relational.bridge.sides.R, rest = head.relational.bridge.sides.R;
    expect(low.head.z - rest.head.z).toBeCloseTo(low.arc.Fm.z - rest.arc.Fm.z, 9);
    expect(low.head.z).toBeLessThan(rest.head.z);
  });
});
