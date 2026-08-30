process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-mint-golden-'));

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler } from './sketches.js';
import { cityBlockoutFixture, mangaSignalPageFixture } from '@/lib/graph/image-outcomes/fixtures';

/**
 * MINT GOLDENS — the safety net for the create_sketch de-monolith.
 *
 * `mintSketch` is where authored input becomes stored truth, and it is not one
 * pipeline but THREE branches (motion-comic / image-outcomes / the default
 * recipe→diagram→expansion pipeline). Splitting that file is only safe if the
 * stored manifest for every kind comes out BYTE-IDENTICAL afterwards, and no
 * existing suite asserted that: sketches.test.js covers preload, diff, packets,
 * and binds, but never pins what a mint actually stores.
 *
 * So each case mints a fixed manifest at a fixed ref and snapshots a digest of
 * the stored result. The digest is a hash, deliberately: the point is not to
 * read these values but to make ANY drift fail loudly, in the specific kind that
 * drifted. The `shape` line beside it is what makes a failure legible — it says
 * whether the change was structural (a lost expansion) or cosmetic.
 *
 * Determinism is already a substrate invariant (seeded dice only, never
 * Math.random), so these are stable by construction. A snapshot that will not
 * reproduce is a real bug in the kind, not a flaky test.
 *
 * Fixture shapes are lifted from lib/diagram-core.binding.test.js, which already
 * proves them valid through both mint paths. They are duplicated rather than
 * imported on purpose — a safety net that breaks when another test is edited is
 * not a safety net.
 */

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = canonical(value[k]);
      return acc;
    }, {});
  }
  return value;
};

const digest = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex').slice(0, 16);

function shapeOf(manifest) {
  return {
    kind: manifest.kind ?? null,
    keys: Object.keys(manifest).sort().join(','),
    stations: manifest.stations?.length ?? null,
    edges: manifest.edges?.length ?? null,
    marks: manifest.marks?.length ?? null,
  };
}

async function mintGolden(ref, title, manifest) {
  const res = await createSketchHandler({ title, manifest, ref });
  expect(res.ok).toBe(true);
  const stored = SketchRepository.getByRef(ref);
  expect(stored, `sketch '${ref}' was not stored`).toBeTruthy();
  return { digest: digest(stored.manifest), shape: shapeOf(stored.manifest) };
}

beforeEach(() => {
  closeDb();
});

// ── the default pipeline: recipe lowering → diagram lowering → grid/boundary/
// constellation/Rendrant expansion → floorplan grading → validate ─────────────

const FLOWCHART = {
  title: 'Flow',
  viewBox: { width: 400, height: 200 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', x: 20, y: 60, w: 120, h: 80 },
    { id: 'b', kind: 'mcp_tool', label: 'B', x: 260, y: 60, w: 120, h: 80 },
  ],
  edges: [{ from: 'a', to: 'b', label: 'writes' }],
};

const CHART = {
  title: 'Bars',
  viewBox: { width: 300, height: 200 },
  marks: [
    { kind: 'rect', x: 20, y: 100, w: 40, h: 80 },
    { kind: 'rect', x: 80, y: 60, w: 40, h: 120 },
    { kind: 'rect', x: 140, y: 40, w: 40, h: 140 },
  ],
};

const GRIDDED = {
  title: 'Grid',
  viewBox: { width: 400, height: 300 },
  grid: { cols: 2, rows: 2 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', cell: { col: 0, row: 0 } },
    { id: 'b', kind: 'db_row', label: 'B', cell: { col: 1, row: 1 } },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

const TYPED = {
  title: 'Typed',
  viewBox: { width: 420, height: 300 },
  stations: [
    { id: 'p', kind: 'db_row', label: 'P', x: 40, y: 40, w: 120, h: 60 },
    { id: 'c', kind: 'db_row', label: 'C', x: 40, y: 200, w: 120, h: 60 },
  ],
  edges: [
    { from: 'c', to: 'p', head: 'triangle-open', label: 'is-a' },
    { from: 'p', to: 'p', head: 'arrow', label: 'self' },
    { from: 'p', to: 'c', head: 'crowsfoot-many', tail: 'crowsfoot-one', dashed: true },
  ],
  marks: [{ kind: 'line', x1: 240, y1: 40, x2: 380, y2: 40, stroke: '#1a2230', head: 'diamond-filled', tail: 'dot' }],
};

const SEQUENCE = {
  kind: 'sequence',
  title: 'Seq',
  actors: [
    { id: 'a', label: 'Agent' },
    { id: 'm', label: 'mint' },
    { id: 'd', label: 'db' },
  ],
  messages: [
    { from: 'a', to: 'm', label: 'call', activate: true },
    { from: 'm', to: 'd', label: 'insert' },
    { from: 'd', to: 'm', label: 'ref', kind: 'return' },
    { from: 'm', to: 'a', label: 'ok', kind: 'return' },
  ],
};

const GANTT = {
  kind: 'gantt',
  title: 'G',
  scale: { start: 0, end: 4, unit: 'wk' },
  tasks: [
    { label: 'A', start: 0, end: 2 },
    { label: 'B', start: 1, end: 4 },
  ],
};

const SWIMLANE = {
  title: 'SW',
  lanes: [
    { id: 'u', label: 'User' },
    { id: 's', label: 'System' },
  ],
  stations: [
    { id: 'a', kind: 'input', label: 'Ask', lane: 'u', col: 0 },
    { id: 'b', kind: 'mcp_tool', label: 'Do', lane: 's', col: 1 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

const ERD = {
  title: 'ERD',
  viewBox: { width: 500, height: 220 },
  stations: [
    { id: 'user', kind: 'db_row', label: 'User', divider: true, items: ['id: pk', 'email'], x: 40, y: 60, w: 150, h: 90 },
    { id: 'order', kind: 'db_row', label: 'Order', divider: true, items: ['id: pk', 'user_id: fk'], x: 300, y: 60, w: 150, h: 90 },
  ],
  edges: [{ from: 'user', to: 'order', head: 'crowsfoot-many', tail: 'crowsfoot-one', fromLabel: '1', toLabel: '0..*' }],
};

const BOUNDARY = {
  title: 'C4',
  viewBox: { width: 500, height: 300 },
  stations: [
    { id: 'a', kind: 'mcp_tool', label: 'A', x: 60, y: 60, w: 120, h: 50 },
    { id: 'b', kind: 'db_row', label: 'B', x: 60, y: 160, w: 120, h: 50 },
    { id: 'out', kind: 'input', label: 'Out', x: 320, y: 110, w: 120, h: 50 },
  ],
  edges: [{ from: 'out', to: 'a' }],
  boundaries: [{ label: 'Plane', contains: ['a', 'b'] }],
};

// Seeded generator — proves the dice stay reproducible across the split, and is
// the only case that also exercises improveFloorplanManifest's grading.
const FLOORPLAN = {
  kind: 'floorplan',
  title: 'house',
  viewBox: { width: 1120, height: 760 },
  seed: 7,
  width: 44,
  height: 30,
  windows: true,
};

// Rendrant / neo-Rembrandt shading expansion — the heaviest transform in the
// default branch, and the one most likely to drift silently.
const P0_STICKER = {
  title: 'P0 sticker egg',
  viewBox: { width: 480, height: 420 },
  scene: {
    light: { direction: [-0.58, -0.82], warmth: 0.6 },
    ground: { y: 340 },
    palette: 'warm-low-key',
  },
  marks: [
    {
      kind: 'polygon',
      closed: true,
      role: 'egg-body',
      z: 10,
      points: Array.from({ length: 24 }, (_, i) => {
        const t = (i / 24) * Math.PI * 2;
        return [240 + Math.cos(t) * 72, 220 + Math.sin(t) * 104];
      }),
      fill: '#c7a36f',
      shade: { algorithm: 'convex-value-stack', intensity: 0.9 },
      highlights: { algorithm: 'simple-highlight', intensity: 0.4 },
    },
  ],
};

const BLOB_STICKER = {
  title: 'Blob figure',
  viewBox: { width: 360, height: 360 },
  scene: {
    view: { direction: [-1, -1], baseZ: 10, blobZStep: 1 },
    light: { direction: [-0.58, -0.82] },
    palette: 'warm-low-key',
  },
  marks: [
    { kind: 'blob', role: 'head', anchor: [120, 110], rx: 42, ry: 50, shade: { algorithm: 'form-light-stack', intensity: 0.9 }, highlights: { algorithm: 'form-light-stack', intensity: 0.4 } },
    { kind: 'blob', role: 'torso', anchor: [175, 210], rx: 62, ry: 84, shade: { algorithm: 'form-light-stack', intensity: 0.85 }, highlights: { algorithm: 'form-light-stack', intensity: 0.35 } },
  ],
};

const DEFAULT_BRANCH = [
  ['flowchart', FLOWCHART],
  ['chart', CHART],
  ['grid-cell-placement', GRIDDED],
  ['typed-edges', TYPED],
  ['sequence', SEQUENCE],
  ['gantt', GANTT],
  ['swimlane', SWIMLANE],
  ['erd', ERD],
  ['containment-boundary', BOUNDARY],
  ['floorplan-seeded', FLOORPLAN],
  ['sticker-polygon', P0_STICKER],
  ['sticker-blob', BLOB_STICKER],
];

describe('mint goldens — the default pipeline branch', () => {
  for (const [name, manifest] of DEFAULT_BRANCH) {
    it(`stores ${name} identically`, async () => {
      expect(await mintGolden(`gold_${name.replace(/-/g, '_')}`, name, manifest)).toMatchSnapshot();
    });
  }

  it('is reproducible: minting the same manifest twice stores the same bytes', async () => {
    const a = await mintGolden('gold_repro_a', 'repro', FLOORPLAN);
    const b = await mintGolden('gold_repro_b', 'repro', FLOORPLAN);
    expect(a.digest).toBe(b.digest);
  });
});

// ── the image-outcomes branch: normalize + resolve, no diagram pipeline ───────

describe('mint goldens — the image-outcomes branch', () => {
  it('stores a city blockout identically', async () => {
    expect(await mintGolden('gold_city_blockout', 'city', cityBlockoutFixture())).toMatchSnapshot();
  });

  it('stores a manga signal page identically', async () => {
    expect(await mintGolden('gold_manga_page', 'manga', mangaSignalPageFixture())).toMatchSnapshot();
  });
});
