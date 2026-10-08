import { describe, it, expect } from 'vitest';
import { readFloormap, floormapAnchors, floormapFaces, footprint, regionAt } from './floormap.js';
import { floormapCameras, cutsOf, fitPoints, COVER } from './floormap-cameras.js';
import { floormapAdvice, project } from './floormap-laws.js';
import { floormapBoardHtml, floormapPieceIds } from './floormap-board-html.js';
import { bakeFloor, walkable, components, cellOf } from '../playscape/walkmesh/bake.js';

const MANOR = {
  kind: 'floormap', title: 'Manor east wing', seed: 3,
  regions: [
    { id: 'hall', rect: [0, 0, 9, 7] },
    { id: 'library', rect: [1, 7, 7, 6] },
    { id: 'gallery', strip: { path: [[9, 3.5], [21, 3.5], [21, 13]], width: 2.6 } },
    { id: 'garden', poly: [[17, 13], [26, 13], [28, 18], [23, 24], [15, 21]] },
  ],
  links: [{ from: 'hall', to: 'library', as: 'door' }, { from: 'hall', to: 'gallery', as: 'door', width: 1.6 }, { from: 'gallery', to: 'garden', as: 'open' }],
  edges: [
    { region: 'gallery', side: 'n', span: [11, 19], as: 'rail' },
    { region: 'garden', side: 'all', as: 'foliage' },
    { region: 'garden', side: 'n', span: [21, 26], as: 'water' },
    { region: 'garden', side: 'e', span: [14, 19], as: 'exit', id: 'gate', to: { map: 'grounds', door: 'gate' } },
  ],
  items: [
    { id: 'start', kind: 'spawn', at: [4.5, 1.2], face: 90 },
    { id: 'pillar-w', kind: 'stand', at: [3, 4], r: 0.4, h: 4 },
    { id: 'pillar-e', kind: 'stand', at: [6, 4], r: 0.4, h: 4 },
    { id: 'typewriter', kind: 'hotspot', at: [1, 6.2], verb: 'use' },
    { id: 'desk', kind: 'block', at: [5.5, 10], size: [1.8, 0.9], h: 0.8 },
    { id: 'shelf', kind: 'block', at: [1.5, 10], size: [0.6, 4], h: 2.4 },
    { id: 'crest-key', kind: 'pickup', at: [6.1, 10], item: 'crest key' },
    { id: 'statue', kind: 'stand', at: [21, 17.5], r: 0.7, h: 2.6 },
    { id: 'yew', kind: 'stand', at: [25, 16], r: 0.9, h: 5 },
  ],
  cameras: 'auto',
};
const read = (over = {}) => readFloormap({ ...MANOR, ...over });
const solve = (m = MANOR) => { const fm = readFloormap(m), cams = floormapCameras(fm, m.cameras), cuts = cutsOf(fm, cams); return { fm, cams, cuts, adv: floormapAdvice(fm, cams, cuts) }; };
const len = (p) => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);

describe('reading a floormap', () => {
  it('turns each shape into a counter-clockwise floor; a strip keeps one leg per segment', () => {
    const fm = read({ regions: [...MANOR.regions, { id: 'pool', disc: { at: [30, 5], r: 2, sides: 12 } }] });
    const pool = fm.regions.find((r) => r.id === 'pool');
    expect(pool.poly).toHaveLength(12);
    expect(fm.regions.find((r) => r.id === 'gallery').legs).toHaveLength(2);
    expect(regionAt(fm, [21, 8]).id).toBe('gallery');
    expect(regionAt(fm, [40, 40])).toBeNull();
  });
  it('refuses a malformed shape with a sentence', () => {
    expect(() => read({ regions: [{ id: 'a', rect: [0, 0, 1, 1], poly: [[0, 0], [1, 0], [0, 1]] }] })).toThrow(/one shape/);
    expect(() => read({ regions: [{ id: 'a' }] })).toThrow(/one shape/);
    expect(() => read({ links: [{ from: 'hall', to: 'nowhere' }] })).toThrow(/not a region/);
    expect(() => read({ edges: [{ region: 'hall', side: 'up', as: 'wall' }] })).toThrow(/n, e, s, w or all/);
    expect(() => read({ items: [{ id: 'x', kind: 'hotspot', at: [1, 1], verb: 'lick' }] })).toThrow(/examine, use/);
    expect(() => read({ edges: [{ region: 'hall', side: 'w', as: 'exit', id: 'out' }] })).toThrow(/\{ map, door \}/);
  });
});

describe('edges', () => {
  it('a door link cuts one opening of its width in the wall the two regions share, built once', () => {
    const fm = read(), doors = fm.pieces.filter((p) => p.kind === 'door');
    expect(doors.map((d) => [d.region, d.with, +len(d).toFixed(3)])).toEqual([['hall', 'gallery', 1.6], ['hall', 'library', 1.2]]);
    expect(fm.pieces.filter((p) => p.region === 'library' && p.with === 'hall')).toEqual([]);
  });
  it('an open join leaves no edge; rules land where their side and span say, later rules over earlier', () => {
    const fm = read(), kinds = (r) => fm.pieces.filter((p) => p.region === r).map((p) => p.kind);
    expect(kinds('gallery')).toContain('open');
    const rail = fm.pieces.find((p) => p.kind === 'rail');
    expect([rail.a[0], rail.b[0]].sort((a, b) => a - b)).toEqual([11, 19].map((x) => expect.closeTo(x, 3)));
    expect(kinds('garden')).toEqual(expect.arrayContaining(['foliage', 'water', 'exit']));
  });
  it('two touching regions with no link are walled from each other', () => {
    const fm = read({ links: MANOR.links.filter((l) => l.to !== 'library') });
    expect(fm.pieces.some((p) => p.region === 'hall' && p.with === 'library' && p.kind === 'wall')).toBe(true);
  });
});

describe('outcomes', () => {
  it('anchors: every item, a doorway per door, one door anchor per exit', () => {
    const { anchors, rooms } = floormapAnchors(read());
    expect(rooms.map((r) => r.id)).toEqual(['hall', 'library', 'gallery', 'garden']);
    expect(anchors.filter((a) => a.kind === 'doorway').map((a) => a.id)).toEqual(['doorway-hall-gallery', 'doorway-hall-library']);
    expect(anchors.filter((a) => a.kind === 'door')).toEqual([expect.objectContaining({ id: 'gate', to: { map: 'grounds', door: 'gate' } })]);
    expect(anchors.find((a) => a.id === 'pillar-w').foot).toHaveLength(8);
  });
  it('the greybox bakes to the walkmesh floor: walkable but for the stands and blocks, the spawn joined to the garden', () => {
    const faces = floormapFaces(read()), bake = bakeFloor({ faces });
    expect(walkable(bake, [4.5, 1.2])).toBe(true);
    expect(walkable(bake, [3, 4])).toBe(false);
    expect(walkable(bake, [5.5, 10])).toBe(false);
    expect(walkable(bake, [22, 18])).toBe(true);
    const { label } = components(bake), at = (p) => label[cellOf(bake, p)];
    expect(at([4.5, 1.2])).toBe(at([22, 18]));
    expect(at([4.5, 1.2])).toBe(at([5, 12]));
    const wall = faces.find((f) => f.kind === 'wall' && f.of === 'hall' && f.corners.every((c) => c[1] === 0));
    expect(wall.normal).toEqual([0, 1, 0]);   // the hall's south wall faces into the hall
    expect(faces.filter((f) => f.kind === 'lintel')).toHaveLength(2);
  });
  it('a footprint is the item\'s ground: a stand\'s octagon, a block\'s turned box', () => {
    expect(footprint({ kind: 'block', at: [0, 0], size: [2, 1], rot: 90 }).map((p) => p.map((v) => +v.toFixed(6)))).toEqual([[0.5, -1], [0.5, 1], [-0.5, 1], [-0.5, -1]]);
    expect(footprint({ kind: 'hotspot', at: [0, 0] })).toBeNull();
  });
});

describe('cameras', () => {
  it('auto: a shot per region, one per corridor leg, the same every time', () => {
    const a = solve(), b = solve();
    expect(a.cams.map((c) => `${c.id}:${c.shot}`)).toEqual(['hall:corner', 'library:corner', 'gallery-1:wide', 'gallery-2:wide', 'garden:corner']);
    expect(JSON.stringify(a.cams.map((c) => c.framing))).toBe(JSON.stringify(b.cams.map((c) => c.framing)));
  });
  it('each shot holds its figures and covers its floor', () => {
    const { fm, cams } = solve();
    for (const c of cams) {
      const z = fm.regions.find((r) => r.id === c.zone.region).z, { must } = fitPoints(c.zone.poly, c.basis.position, z);
      expect(c.fit.cover).toBeGreaterThanOrEqual(COVER - 0.01);
      for (const P of must) { const p = project(c.basis, P).px; expect(p[0]).toBeGreaterThan(0); expect(p[0]).toBeLessThan(1280); expect(p[1]).toBeGreaterThan(0); expect(p[1]).toBeLessThan(720); }
    }
  });
  it('named cameras split their region in order; a bad shot is refused', () => {
    const { cams } = solve({ ...MANOR, cameras: [{ id: 'a', zone: 'hall' }, { id: 'b', zone: 'hall', shot: 'low' }, { id: 'c', zone: 'library' }, { id: 'd', zone: 'gallery' }, { id: 'e', zone: 'garden', shot: 'overhead' }] });
    expect(cams.filter((c) => c.zone.region === 'hall')).toHaveLength(2);
    expect(() => floormapCameras(read(), [{ id: 'a', zone: 'hall', shot: 'dutch' }])).toThrow(/corner, wide/);
  });
  it('the cuts join neighbouring zones, and the solve keeps the figure\'s screen direction across them', () => {
    const { cuts } = solve();
    expect(cuts.map((c) => `${c.from}>${c.to}`)).toEqual(['hall>library', 'hall>gallery-1', 'gallery-1>gallery-2', 'gallery-2>garden']);
    expect(cuts.some((c) => c.flips)).toBe(false);
  });
});

describe('the laws', () => {
  it('the manor holds every law', () => {
    expect(solve().adv).toEqual([]);
  });
  it('overlaps, far links, rules that land nowhere, lost regions, items off the floor, a stand against a wall', () => {
    const { adv } = solve({ ...MANOR,
      regions: [...MANOR.regions, { id: 'attic', rect: [40, 40, 4, 4] }, { id: 'nook', rect: [2, 2, 2, 2] }],
      links: [...MANOR.links, { from: 'attic', to: 'garden', as: 'door' }],
      edges: [...MANOR.edges, { region: 'hall', side: 'n', span: [20, 30], as: 'rail' }],
      items: [...MANOR.items, { id: 'lost', kind: 'pickup', at: [60, 60] }, { id: 'post', kind: 'stand', at: [8.7, 0.3], r: 0.25 }] });
    expect(adv.map((a) => a.law)).toEqual(expect.arrayContaining(['regions-apart', 'links-touch', 'rule-lands', 'reachable', 'items-on-floor', 'stand-hides']));
  });
});

describe('the board', () => {
  it('assembles its pieces, escapes, and is the same twice', () => {
    const m = { ...MANOR, title: 'Manor <b>' }, html = floormapBoardHtml(m);
    for (const id of floormapPieceIds(m)) expect(html).toContain(`data-piece="${id}"`);
    expect(html).not.toContain('<b>');
    expect(html).toContain('every law holds');
    expect(floormapBoardHtml(m)).toBe(html);
  });
});
