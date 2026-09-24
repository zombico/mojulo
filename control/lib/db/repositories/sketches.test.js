// Isolate to SQLite in a temp file (not :memory:) — the derivation-guard cases
// close and reopen the SAME database to prove the backfill re-runs.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import {
  SketchRepository,
  backfillSketchDerivedColumns,
  deriveSketchColumns,
} from '@/lib/db/repositories/sketches';
import { BUCKETS, classifyBucket } from '@/lib/graph/sketch/sketch-manifest';

let dir;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-sketches-repo-'));
});
afterAll(async () => {
  closeDb();
  await fs.rm(dir, { recursive: true, force: true });
});

let n = 0;
beforeEach(() => {
  closeDb();
  process.env.SQLITE_PATH = path.join(dir, `case-${n++}.db`);
  getDb();
});

// One row per branch of classifyBucket / sketchRenderMode, plus an override and
// an unparseable manifest: the corpus the SQL path must agree with the JS path on.
const FIXTURES = [
  ['sk_world', 'Snow valley arena', {
    kind: 'controllable', seed: 7, faces: Array.from({ length: 200 }, () => ({ corners: [{ x: 0, y: 0, z: 0 }] })),
    giBake: { adapter: 'inline-faces', bakedAt: 1 }, game: { id: 'g' },
  }],
  ['sk_city', 'City 1', { kind: 'fractal-city', seed: 3, audio: { bed: 'wind' } }],
  ['sk_bench', 'Bracket', { kind: 'workbench', units: 'mm', seed: 0 }],
  ['sk_fig', 'Wizard — hooded cape study', { kind: 'figure' }],
  ['sk_turn', 'Still life', { kind: 'css3d-turntable' }],
  ['sk_flow', 'Flow', { nodes: [], edges: [], viewBox: { width: 100, height: 80 } }],
  ['sk_beats', 'Loop', { kind: 'beats-composition' }],
  ['sk_voice', 'Register', { kind: 'voice-register', bank: 'jp-female', axes: { confidence: 0.5 } }],
  ['sk_game', 'Arcade', { kind: 'game', levels: [] }],
  ['sk_poly', 'Vajra', { kind: 'manji-tree', dimensions: '3d', lathes: [{ profile: [] }] }],
  ['sk_manji2d', 'Tree', { kind: 'manji-tree', dimensions: '2d' }],
  ['sk_pinned', 'Pinned tree', { kind: 'manji-tree', dimensions: '2d' }, { bucket: 'diagram' }],
];

function seed() {
  for (const [ref, title, manifest, extra = {}] of FIXTURES) {
    SketchRepository.create({ ref, title, manifest, ...extra });
  }
  // A row whose manifest never parses — rowToSketch reads it as manifest:null,
  // bucket 'diagram'. Inserted raw with the columns left NULL, as a row written
  // by pre-column code would be.
  getDb().prepare(
    `INSERT INTO sketches (ref, title, manifest_json, created_at) VALUES ('sk_broken', 'Broken', 'not json{', unixepoch())`,
  ).run();
}

const parse = (json) => { try { return JSON.parse(json); } catch { return null; } };

/** The OLD read: every row, parsed and classified in JS. */
function jsFiltered(bucket) {
  return getDb().prepare('SELECT * FROM sketches ORDER BY created_at DESC, id DESC').all()
    .filter((r) => (r.bucket || classifyBucket(parse(r.manifest_json))) === bucket)
    .map((r) => r.ref);
}

describe('derived columns are stamped and healed', () => {
  it('deriveSketchColumns mirrors rowToSketch', () => {
    expect(deriveSketchColumns({ kind: 'controllable' })).toEqual({ kind: 'controllable', bucketDerived: 'world' });
    expect(deriveSketchColumns('not json{')).toEqual({ kind: null, bucketDerived: 'diagram' });
    expect(deriveSketchColumns({ nodes: [] })).toEqual({ kind: null, bucketDerived: 'diagram' });
  });

  it('create stamps kind + bucket_derived; update re-stamps them', () => {
    seed();
    const raw = (ref) => getDb().prepare('SELECT kind, bucket_derived, bucket FROM sketches WHERE ref = ?').get(ref);
    expect(raw('sk_world')).toEqual({ kind: 'controllable', bucket_derived: 'world', bucket: null });
    expect(raw('sk_poly')).toEqual({ kind: 'manji-tree', bucket_derived: 'object', bucket: null });
    expect(raw('sk_pinned')).toEqual({ kind: 'manji-tree', bucket_derived: 'illustration', bucket: 'diagram' });

    SketchRepository.update({ ref: 'sk_flow', manifest: { kind: 'controllable', faces: [] } });
    expect(raw('sk_flow')).toEqual({ kind: 'controllable', bucket_derived: 'world', bucket: null });
    expect(SketchRepository.list({ bucket: 'world' }).map((s) => s.ref)).toContain('sk_flow');
    expect(SketchRepository.list({ bucket: 'diagram' }).map((s) => s.ref)).not.toContain('sk_flow');
  });

  it('a NULL row (written before the columns existed) is filled on the next connection', () => {
    seed();
    // The raw insert above left sk_broken NULL; the repository has not been
    // asked anything since, so it is still NULL until a repository call runs.
    expect(getDb().prepare('SELECT bucket_derived FROM sketches WHERE ref = ?').get('sk_broken').bucket_derived).toBeNull();
    closeDb();
    getDb();
    SketchRepository.bucketCounts();   // any repository read heals the connection
    expect(getDb().prepare('SELECT kind, bucket_derived FROM sketches WHERE ref = ?').get('sk_broken'))
      .toEqual({ kind: null, bucket_derived: 'diagram' });
  });

  it('a stale derivation signature re-derives every row', () => {
    seed();
    SketchRepository.bucketCounts();
    const db = getDb();
    const stored = db.prepare("SELECT value FROM app_settings WHERE key = 'sketches.derivation'").get()?.value;
    expect(stored).toMatch(/^[0-9a-f]{16}$/);
    db.prepare("UPDATE sketches SET bucket_derived = 'bogus', kind = 'bogus'").run();
    db.prepare("UPDATE app_settings SET value = 'stale' WHERE key = 'sketches.derivation'").run();
    closeDb();
    getDb();
    expect(SketchRepository.list({ bucket: 'bogus' })).toEqual([]);
    expect(SketchRepository.bucketCounts().buckets.bogus).toBeUndefined();
    expect(getDb().prepare("SELECT value FROM app_settings WHERE key = 'sketches.derivation'").get().value).toBe(stored);
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM sketches WHERE kind = 'bogus'").get().n).toBe(0);
  });

  it('backfillSketchDerivedColumns reports how many rows it touched', () => {
    seed();
    const db = getDb();
    db.prepare('UPDATE sketches SET bucket_derived = NULL WHERE ref IN (?, ?)').run('sk_city', 'sk_bench');
    expect(backfillSketchDerivedColumns(db)).toBe(3);   // the two + sk_broken
    expect(backfillSketchDerivedColumns(db, { all: true })).toBe(FIXTURES.length + 1);
  });
});

describe('SQL-filtered reads equal the old JS-filtered reads', () => {
  it('list({ bucket }) for every bucket', () => {
    seed();
    for (const bucket of BUCKETS) {
      const rows = SketchRepository.list({ bucket });
      expect(rows.map((s) => s.ref)).toEqual(jsFiltered(bucket));
      for (const s of rows) expect(s.bucket).toBe(bucket);
    }
    // Every row lands in exactly one bucket.
    const seen = BUCKETS.flatMap((b) => SketchRepository.list({ bucket: b }).map((s) => s.ref));
    expect(seen.sort()).toEqual([...FIXTURES.map((f) => f[0]), 'sk_broken'].sort());
  });

  it('the pinned row follows its override, the broken row lands in diagram', () => {
    seed();
    expect(SketchRepository.list({ bucket: 'diagram' }).map((s) => s.ref).sort()).toEqual(['sk_broken', 'sk_flow', 'sk_pinned']);
    const pinned = SketchRepository.getByRef('sk_pinned');
    expect(pinned.bucket).toBe('diagram');
    expect(pinned.bucketOverride).toBe('diagram');
    expect(SketchRepository.getByRef('sk_broken')).toMatchObject({ manifest: null, bucket: 'diagram' });
  });

  it('bucketCounts tallies buckets and kinds off the columns', () => {
    seed();
    const tallies = SketchRepository.bucketCounts();
    const expectedBuckets = {};
    for (const b of BUCKETS) {
      const n = jsFiltered(b).length;
      if (n) expectedBuckets[b] = n;
    }
    expect(tallies.buckets).toEqual(expectedBuckets);
    expect(tallies.total).toBe(FIXTURES.length + 1);
    expect(tallies.kinds).toEqual({
      controllable: 1, 'fractal-city': 1, workbench: 1, figure: 1, 'css3d-turntable': 1,
      'beats-composition': 1, 'voice-register': 1, game: 1, 'manji-tree': 3,
    });
  });

  it('newestByBucket heads match list({ bucket }) and its tallies match bucketCounts', () => {
    seed();
    const { byBucket, tallies } = SketchRepository.newestByBucket({ perBucket: 100 });
    expect(tallies).toEqual(SketchRepository.bucketCounts());
    for (const [bucket, rows] of Object.entries(byBucket)) {
      expect(rows.map((r) => r.ref)).toEqual(jsFiltered(bucket));
      for (const r of rows) {
        expect(r.manifest).toBeUndefined();
        expect(r.bucket).toBe(bucket);
      }
    }
    const one = SketchRepository.newestByBucket({ perBucket: 1 });
    expect(one.byBucket.world).toHaveLength(1);
    expect(one.tallies).toEqual(tallies);
  });
});

describe('listSummary — the manifest stays home', () => {
  it('world rows ship facts, render mode and no manifest', () => {
    seed();
    const rows = SketchRepository.listSummary({ bucket: 'world' });
    expect(rows.map((r) => r.ref)).toEqual(jsFiltered('world'));
    const world = rows.find((r) => r.ref === 'sk_world');
    expect(world.manifest).toBeUndefined();
    expect(world).toMatchObject({
      kind: 'controllable', renderMode: 'world', bucket: 'world', bucketOverride: null, folderRef: null,
      facts: { seed: 7, giBake: true, giAdapter: 'inline-faces', game: true, audio: false },
    });
    expect(rows.find((r) => r.ref === 'sk_city').facts).toEqual({ seed: 3, giBake: false, giAdapter: null, game: false, audio: true });
    // The whole world shelf, serialized, is a fraction of the recipes it stands for.
    const wire = Buffer.byteLength(JSON.stringify(rows));
    const stored = getDb().prepare(`SELECT SUM(length(manifest_json)) AS b FROM sketches WHERE COALESCE(bucket, bucket_derived) = 'world'`).get().b;
    expect(wire).toBeLessThan(stored / 10);
  });

  it('settles the manji-tree render mode from the recipe without shipping it', () => {
    seed();
    const object = SketchRepository.listSummary({ bucket: 'object' });
    expect(object.find((r) => r.ref === 'sk_poly')).toMatchObject({ renderMode: 'world', kind: 'manji-tree' });
    expect(object.find((r) => r.ref === 'sk_poly').manifest).toBeUndefined();
    const ill = SketchRepository.listSummary({ bucket: 'illustration' });
    expect(ill.find((r) => r.ref === 'sk_manji2d')).toMatchObject({ renderMode: 'svg' });
    expect(ill.find((r) => r.ref === 'sk_manji2d').manifest).toBeUndefined();
    expect(ill.find((r) => r.ref === 'sk_bench')).toBeUndefined();   // object, not illustration
    expect(ill.find((r) => r.ref === 'sk_fig').facts.seed).toBeNull();
  });

  it('diagram-mode and voice rows keep their manifest; a pinned svg row does not', () => {
    seed();
    const diagram = SketchRepository.listSummary({ bucket: 'diagram' });
    const flow = diagram.find((r) => r.ref === 'sk_flow');
    expect(flow).toMatchObject({ kind: null, renderMode: 'diagram', bucket: 'diagram' });
    expect(flow.manifest).toEqual(FIXTURES.find((f) => f[0] === 'sk_flow')[2]);
    const pinned = diagram.find((r) => r.ref === 'sk_pinned');
    expect(pinned).toMatchObject({ renderMode: 'svg', bucket: 'diagram', bucketOverride: 'diagram' });
    expect(pinned.manifest).toBeUndefined();
    const broken = diagram.find((r) => r.ref === 'sk_broken');
    expect(broken).toMatchObject({ kind: null, renderMode: 'diagram', manifest: null });
    expect(broken.facts).toEqual({ seed: null, giBake: false, giAdapter: null, game: false, audio: false });

    const voice = SketchRepository.listSummary({ bucket: 'voice' });
    expect(voice).toHaveLength(1);
    expect(voice[0].manifest).toMatchObject({ bank: 'jp-female' });
    expect(voice[0].renderMode).toBe('voice');
  });

  it('the unscoped read keeps list()\'s scope and order', () => {
    seed();
    SketchRepository.update({ ref: 'sk_city', folderRef: 'fld_x' });
    const full = SketchRepository.list({ rootLimit: 3 });
    const slim = SketchRepository.listSummary({ rootLimit: 3 });
    expect(slim.map((r) => r.ref)).toEqual(full.map((s) => s.ref));
    expect(slim.find((r) => r.ref === 'sk_city').folderRef).toBe('fld_x');
    for (const s of full) {
      const r = slim.find((x) => x.ref === s.ref);
      expect(r.bucket).toBe(s.bucket);
      expect(r.createdAt).toBe(s.createdAt);
    }
  });

  it('hydrateSummaries keeps a folded row\'s extra fields', () => {
    seed();
    const { byBucket } = SketchRepository.newestByBucket({ perBucket: 10 });
    const face = { ...byBucket.world[0], stack: 3, siblings: byBucket.world };
    const [hydrated] = SketchRepository.hydrateSummaries([face]);
    expect(hydrated.stack).toBe(3);
    expect(hydrated.facts).toBeDefined();
    expect(hydrated.manifest).toBeUndefined();
    expect(SketchRepository.hydrateSummaries([])).toEqual([]);
  });
});

describe('last-touched recency (sketches.updated_at)', () => {
  // unixepoch() is whole seconds, so a same-second edit ties with the mint;
  // back-date every row's timestamps so the edit stands out.
  function backdate() {
    getDb().prepare('UPDATE sketches SET created_at = created_at - 3600, updated_at = created_at - 3600').run();
  }

  it('a mint reads as touched when minted, and rows carry updatedAt beside createdAt', () => {
    seed();
    const row = SketchRepository.getByRef('sk_bench');
    expect(row.updatedAt).toBe(row.createdAt);
    const [light] = SketchRepository.newestByBucket({ perBucket: 100 }).byBucket.object;
    expect(light.updatedAt).toBe(light.createdAt);
  });

  it('a recipe edit or retitle touches the row and lifts it to the front of recent()', () => {
    seed();
    backdate();
    const before = SketchRepository.recent({ limit: 5 }).map((s) => s.ref);
    expect(before[0]).not.toBe('sk_bench');
    SketchRepository.update({ ref: 'sk_bench', manifest: { kind: 'workbench', units: 'mm', seed: 1 } });
    const bench = SketchRepository.getByRef('sk_bench');
    expect(bench.updatedAt).toBeGreaterThan(bench.createdAt);
    expect(SketchRepository.recent({ limit: 5 })[0].ref).toBe('sk_bench');
    expect(SketchRepository.newestByBucket({ perBucket: 100 }).byBucket.object[0].ref).toBe('sk_bench');

    SketchRepository.update({ ref: 'sk_flow', title: 'Flow, renamed' });
    expect(SketchRepository.recent({ limit: 5 })[0].ref).toBe('sk_flow');
  });

  it('filing (a folder move or a bucket pin) is not a touch', () => {
    seed();
    backdate();
    const first = SketchRepository.recent({ limit: 1 })[0].ref;
    SketchRepository.update({ ref: 'sk_bench', folderRef: null, bucket: 'object' });
    SketchRepository.moveMany({ refs: ['sk_bench'], folderRef: null });
    const bench = SketchRepository.getByRef('sk_bench');
    expect(bench.updatedAt).toBe(bench.createdAt);
    expect(SketchRepository.recent({ limit: 1 })[0].ref).toBe(first);
  });
});
