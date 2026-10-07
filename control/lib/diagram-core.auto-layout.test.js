process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// Auto layout: a flow whose stations carry no position is placed by the kernel
// (lowerDiagramKinds → expandAutoLayout), the same for mint_diagram and
// create_sketch. A manifest that places any station never reaches the pass.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from '@/lib/mcp/tools/sketches';
import { mintDiagram } from '@/lib/mcp/tools/diagram';
import { expandAutoLayout, lowerDiagramKinds, validateDiagramManifest } from '@/lib/diagram-core';

beforeEach(() => {
  closeDb();
});

const st = (id, extra = {}) => ({ id, kind: 'mcp_tool', label: id, ...extra });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const byId = (m) => Object.fromEntries(m.stations.map((s) => [s.id, s]));

const PIPELINE = {
  title: 'Pipeline',
  stations: [st('upload'), st('parse', { items: ['csv', 'json'] }), st('validate'), st('store', { kind: 'db_row' }), st('notify')],
  edges: [
    { from: 'upload', to: 'parse' }, { from: 'parse', to: 'validate' }, { from: 'validate', to: 'store' },
    { from: 'upload', to: 'store', label: 'fast path' }, { from: 'validate', to: 'notify' },
  ],
};

describe('expandAutoLayout', () => {
  it('places unpositioned stations in rank columns, fits a viewBox, and validates', () => {
    const out = expandAutoLayout(PIPELINE);
    const s = byId(out);
    expect(s.upload.x).toBeLessThan(s.parse.x);
    expect(s.parse.x).toBeLessThan(s.validate.x);
    expect(s.validate.x).toBeLessThan(s.store.x);   // longest path wins: store sits after validate, not after upload
    expect(s.store.x).toBe(s.notify.x);             // same rank, stacked across the flow
    const boxes = out.stations;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
    for (const b of boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(out.viewBox.width);
      expect(b.y + b.h).toBeLessThanOrEqual(out.viewBox.height);
    }
    expect(s.parse.h).toBeGreaterThan(s.upload.h);  // items grow the box
    expect(validateDiagramManifest(out)).toEqual({ ok: true, errors: [] });
  });

  it('is deterministic', () => {
    expect(JSON.stringify(expandAutoLayout(PIPELINE))).toBe(JSON.stringify(expandAutoLayout(structuredClone(PIPELINE))));
  });

  it('routes a rank-skipping edge around the box in its way, and leaves authored routing alone', () => {
    const out = expandAutoLayout({
      ...PIPELINE,
      stations: [st('a'), st('b'), st('c')],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }, { from: 'a', to: 'c', curvature: 2, label: 'mine' }],
    });
    expect(out.edges[0].via).toBeUndefined();
    expect(out.edges[1].via).toBeUndefined();
    expect(['top', 'bottom']).toContain(out.edges[2].via);
    // its lane runs past b, not just past its endpoints
    const b = byId(out).b;
    if (out.edges[2].via === 'bottom') expect(out.edges[2].channel).toBeGreaterThan(b.y + b.h);
    else expect(out.edges[2].channel).toBeLessThan(b.y);
    expect(out.edges[3]).toEqual({ from: 'a', to: 'c', curvature: 2, label: 'mine' });
  });

  it('lays out a cycle (the back edge does not set a rank) and routes the back edge', () => {
    const out = expandAutoLayout({
      title: 'Loop', stations: [st('draft'), st('review'), st('ship')],
      edges: [{ from: 'draft', to: 'review' }, { from: 'review', to: 'draft', label: 'changes' }, { from: 'review', to: 'ship' }],
    });
    const s = byId(out);
    expect(s.draft.x).toBeLessThan(s.review.x);
    expect(s.review.x).toBeLessThan(s.ship.x);
    expect(['top', 'bottom']).toContain(out.edges[1].via);
  });

  it("direction 'TB' makes ranks rows and routes on the left / right", () => {
    const out = expandAutoLayout({ ...PIPELINE, layout: { direction: 'TB' } });
    const s = byId(out);
    expect(s.upload.y).toBeLessThan(s.parse.y);
    expect(s.store.y).toBe(s.notify.y);
    const fast = out.edges.find((e) => e.label === 'fast path');
    expect(['left', 'right']).toContain(fast.via);
    expect(() => expandAutoLayout({ ...PIPELINE, layout: { direction: 'diagonal' } })).toThrow(/layout\.direction/);
  });

  it('keeps a labeled lane and its pill on the canvas, shifting the boxes when needed', () => {
    // a TB diagram whose skip edges go both ways round a wide middle rank, one with a long label
    const out = expandAutoLayout({
      title: 'Wide', layout: { direction: 'TB' },
      stations: [st('top'), st('m1', { label: 'a fairly wide middle box' }), st('m2', { label: 'another wide middle box' }), st('end')],
      edges: [{ from: 'top', to: 'm1' }, { from: 'top', to: 'm2' }, { from: 'm1', to: 'end' }, { from: 'm2', to: 'end' },
        { from: 'top', to: 'end', label: 'a long label on the bypass lane' }, { from: 'top', to: 'end', label: 'and its twin on the other side' }],
    });
    for (const e of out.edges.filter((x) => x.channel !== undefined)) {
      const half = (e.label.length * 0.62 * 11 + 18) / 2;
      expect(e.channel - half).toBeGreaterThanOrEqual(0);
      expect(e.channel + half).toBeLessThanOrEqual(out.viewBox.width);
    }
    expect(validateDiagramManifest(out).ok).toBe(true);
    expect(validateDiagramManifest({ ...out, edges: [{ from: 'top', to: 'end', via: 'left', channel: 'x' }] }).errors.join()).toMatch(/channel must be a finite number/);
  });

  it('keeps a station\'s own w/h, and only grows a given viewBox', () => {
    const out = expandAutoLayout({ ...PIPELINE, viewBox: { width: 2000, height: 40 }, stations: PIPELINE.stations.map((s) => (s.id === 'upload' ? { ...s, w: 300, h: 90 } : s)) });
    expect(byId(out).upload).toMatchObject({ w: 300, h: 90 });
    expect(out.viewBox.width).toBe(2000);
    expect(out.viewBox.height).toBeGreaterThan(40);
  });

  it('never touches a manifest that places any station, or a swimlane diagram', () => {
    const placed = { ...PIPELINE, stations: PIPELINE.stations.map((s, i) => (i === 0 ? { ...s, x: 10, y: 10, w: 100, h: 40 } : s)) };
    expect(expandAutoLayout(placed)).toBe(placed);
    const celled = { ...PIPELINE, stations: PIPELINE.stations.map((s, i) => (i === 0 ? { ...s, cell: { col: 0, row: 0 } } : s)) };
    expect(expandAutoLayout(celled)).toBe(celled);
    const laned = { ...PIPELINE, lanes: [{ id: 'l', label: 'L' }], stations: PIPELINE.stations.map((s) => ({ ...s, lane: 'l' })) };
    expect(expandAutoLayout(laned)).toBe(laned);
    // a partial placement still refuses, now naming the auto-place option
    const { errors } = validateDiagramManifest({ ...placed, viewBox: { width: 800, height: 400 } });
    expect(errors.join('\n')).toMatch(/omit x\/y\/w\/h on EVERY station to auto-place/);
  });

  it('runs inside lowerDiagramKinds', () => {
    expect(lowerDiagramKinds(PIPELINE).viewBox).toBeTruthy();
  });
});

describe('auto layout through both mint doors', () => {
  it('mint_diagram and create_sketch store the same placed manifest', async () => {
    const kernel = mintDiagram({ title: 'Pipeline', manifest: PIPELINE, ref: 'al_kernel' });
    const studio = await createSketchHandler({ title: 'Pipeline', manifest: PIPELINE, ref: 'al_studio' });
    expect(kernel.ok).toBe(true);
    expect(studio.ok).toBe(true);
    const k = SketchRepository.getByRef('al_kernel').manifest;
    const c = SketchRepository.getByRef('al_studio').manifest;
    expect(c).toEqual(k);
    expect(k.stations.every((s) => Number.isFinite(s.x) && Number.isFinite(s.w))).toBe(true);
  });

  it('update_sketch places a revised flow the same way', async () => {
    await createSketchHandler({ title: 'Pipeline', manifest: PIPELINE, ref: 'al_upd' });
    const revised = { ...PIPELINE, stations: [...PIPELINE.stations, st('audit')], edges: [...PIPELINE.edges, { from: 'store', to: 'audit' }] };
    await updateSketchHandler({ ref: 'al_upd', manifest: revised });
    const stored = SketchRepository.getByRef('al_upd').manifest;
    expect(stored).toEqual(expandAutoLayout(revised));
  });
});
