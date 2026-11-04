// A construction shelf machine as the doors draw it: its words read and refused, its faces on the grid at a pose, its
// figure centred on its spot. One machine with a tool its mount takes, chosen in code; one built in sections.
import { describe, it, expect } from 'vitest';
import { CON_ARCHETYPES, CON_MOUNTS } from './index.js';
import { conFigure, conInstanceFaces, readConSpec } from './con-figure.js';

const MOUNTED = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].mount);
const TOOL = Object.keys(CON_MOUNTS[CON_ARCHETYPES[MOUNTED].mount.family].tools).find((t) => t !== 'bucket');
const POSE = Object.keys(CON_ARCHETYPES[MOUNTED].poses).find((p) => p !== 'rest');
const SECTIONS = Object.keys(CON_ARCHETYPES).find((k) => CON_ARCHETYPES[k].sections);

describe('a site machine\'s words', () => {
  it('takes its pose, its tool, its carrier, its height and its palette, and refuses what it does not take', () => {
    expect(readConSpec({ archetype: MOUNTED, pose: POSE, tool: TOOL, palette: 'rusted' })).toMatchObject({ archetype: MOUNTED });
    expect(() => readConSpec({ archetype: 'hovercrane' })).toThrow(/archetype is one of/);
    expect(() => readConSpec({ archetype: MOUNTED, colour: 'red' })).toThrow(/not a construction machine's word/);
    expect(() => readConSpec({ archetype: MOUNTED, pose: 'cartwheel' })).toThrow(/is one of/);
    expect(() => readConSpec({ archetype: MOUNTED, palette: 'tartan' })).toThrow(/palette is one of/);
    expect(() => readConSpec({ archetype: MOUNTED, height: 40 })).toThrow(/its height is its own/);
  });
});

describe('a site machine drawn', () => {
  it('lowers its faces at its pose, its tool on, and reads out its joints and its laws', () => {
    const a = conInstanceFaces({ archetype: MOUNTED }), b = conInstanceFaces({ archetype: MOUNTED, pose: POSE, tool: TOOL });
    expect(a.faces.length).toBeGreaterThan(0);
    expect(b.stats).toMatchObject({ archetype: MOUNTED, pose: POSE, composed: `${MOUNTED}+${TOOL}` });
    expect(b.stats.joints).not.toEqual(a.stats.joints);
  });
  it('stands its figure centred on its spot, its footprint its own, a tower crane at the height it is built to', () => {
    const F = conFigure({ archetype: MOUNTED });
    expect(F.construction.footprint.L).toBeGreaterThan(F.construction.footprint.W);
    const S = conFigure({ archetype: SECTIONS, height: 20 }), T = conFigure({ archetype: SECTIONS });
    expect(S.construction.footprint.H).toBeLessThan(T.construction.footprint.H);
    expect(conInstanceFaces({ archetype: SECTIONS, height: 20 }).stats.height).toBeLessThan(conInstanceFaces({ archetype: SECTIONS }).stats.height);
  });
});
