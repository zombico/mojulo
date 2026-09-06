// Round-trip legibility eval — expressiveness.plan.md E5 (astra-3d-analysis proposal 6).
//
// The claim under measurement: a mojulo recipe is LEGIBLE — an agent that sees only
// the rendered views and the vocab card can re-mint something close. With E1 the vocab
// is a grammar (expr / domain ops / a code program), so the score is per IDIOM: which
// parts of the card teach, which do not.
//
// Mechanics (the body-routing-eval pattern): each fixture is minted, shot from three
// yaws as faces-scaffold PNGs (sharp, no browser), and handed to one headless
// `claude -p` subprocess (the operator's own logged-in CLI, model pinned via
// MOJULO_ROUNDTRIP_EVAL_MODEL, default sonnet) with the workbench + code cards. The
// model may READ the PNGs (its only tool) and must reply with a JSON mint_solid call.
// The reply is minted beside the original and scored two ways:
//   • geometry: bounding-box IoU + a face-count ratio → `geom` in [0, 1] (kernel truth);
//   • diff_sketches similarity (the mark-level diff; often 0 for solids — reported, not gated).
// LLM-in-the-loop: slow and billed, so DOUBLY gated — MOJULO_ROUNDTRIP_EVAL=1 to run;
// auto-skips without the claude CLI. Directional harness, not CI: a report JSON lands in
// the OS tmpdir; the in-test floor is a regression net only.
//
// The per-mint LEDGER (E5's second number) rides on every mint result as
// `stats.ledger` — recipe bytes (the proxy for tokens the agent had to write), kernel
// wall-clock, faces, closure — and is copied into the report per fixture, so "structure
// carried, not re-derived" is a number beside Astra's 30–90k tokens per pagoda.

import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { ROUNDTRIP_FIXTURE } from './roundtrip-eval.fixture.js';

const enabled = process.env.MOJULO_ROUNDTRIP_EVAL === '1';
const cliPresent = (() => {
  try { execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 15000 }); return true; } catch { return false; }
})();
const MODEL = process.env.MOJULO_ROUNDTRIP_EVAL_MODEL || 'sonnet';
const CONCURRENCY = 3;
const GEOM_FLOOR = 0.4;   // regression net only — the report is the deliverable
const ONLY = process.env.MOJULO_ROUNDTRIP_EVAL_ONLY ? new Set(process.env.MOJULO_ROUNDTRIP_EVAL_ONLY.split(',')) : null;

let tmp, mintSolidHandler, diffSketchesHandler, SketchRepository, lowerObjectFaces, WORKBENCH_LIGHT, renderFacesScaffoldSvg, getSolidVocabCatalog, sharp;

const yawFaces = (faces, deg) => {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x * c - y * s, x * s + y * c, z]) }));
};
const boundsOf = (faces) => {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i += 1) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  return { mn, mx };
};
// bounding-box IoU × face-count ratio — the kernel's own view of "how close"
export function geomScore(aFaces, bFaces) {
  if (!aFaces.length || !bFaces.length) return 0;
  const a = boundsOf(aFaces), b = boundsOf(bFaces);
  let inter = 1, va = 1, vb = 1;
  for (let i = 0; i < 3; i += 1) {
    inter *= Math.max(0, Math.min(a.mx[i], b.mx[i]) - Math.max(a.mn[i], b.mn[i]));
    va *= a.mx[i] - a.mn[i]; vb *= b.mx[i] - b.mn[i];
  }
  const iou = inter / (va + vb - inter || 1);
  const ratio = Math.min(aFaces.length, bFaces.length) / Math.max(aFaces.length, bFaces.length);
  return Math.round(Math.sqrt(iou * ratio) * 1000) / 1000;
}

function ask(prompt, cwd) {
  return new Promise((resolve, reject) => {
    execFile('claude', ['-p', prompt, '--model', MODEL, '--allowedTools', 'Read', '--output-format', 'text'], { cwd, timeout: 240000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`claude -p failed: ${err.message}\n${stderr}`));
      resolve(String(stdout));
    });
  });
}
const parseSpec = (reply) => {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON object in reply');
  return JSON.parse(m[0]);
};

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); } }));
  return out;
}

describe.skipIf(!enabled || !cliPresent)('round-trip legibility — the model sees only the PNGs and the card', () => {
  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'mojulo-roundtrip-'));
    process.env.SQLITE_PATH = join(tmp, 'eval.db');
    process.env.MOJULO_OUTCOMES_DIR = join(tmp, 'outcomes');
    ({ mintSolidHandler } = await import('./mint-solid.js'));
    ({ diffSketchesHandler } = await import('./sketch-diff-tool.js'));
    ({ SketchRepository } = await import('@/lib/db/repositories/sketches'));
    ({ lowerObjectFaces, WORKBENCH_LIGHT } = await import('@/lib/graph/worlds/workbench'));
    ({ renderFacesScaffoldSvg } = await import('@/lib/graph/polygonizer/faces-scaffold-svg'));
    ({ getSolidVocabCatalog } = await import('@/lib/graph/solid-vocab/loader'));
    sharp = (await import('sharp')).default;
  }, 60000);

  it('re-mints from views + card; writes the per-idiom report', async () => {
    const cards = getSolidVocabCatalog();
    const cardText = `${cards.get('workbench').body}\n\n---\n\n${cards.get('code').body}`;
    const rows = ROUNDTRIP_FIXTURE.filter((f) => !ONLY || ONLY.has(f.id));
    const results = await pool(rows, CONCURRENCY, async (fx) => {
      const original = await mintSolidHandler({ kind: fx.kind, title: fx.id, ref: `rt-${fx.id}`, spec: fx.spec });
      const sketch = SketchRepository.getByRef(`rt-${fx.id}`);
      const faces = lowerObjectFaces(sketch.manifest, WORKBENCH_LIGHT);
      const dir = join(tmp, fx.id);
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
      const pngs = [];
      for (const yaw of [0, 90, 180]) {
        const svg = renderFacesScaffoldSvg(yawFaces(faces, yaw), { light: WORKBENCH_LIGHT });
        const file = join(dir, `view-${yaw}.png`);
        writeFileSync(file, await sharp(Buffer.from(svg)).png().toBuffer());
        pngs.push(file);
      }
      const prompt = `You are an agent driving the mojulo MCP server. You have the workbench and code vocabulary cards below. Read the three PNG views of an object (its recipe is hidden from you; units are cm; z is up; the views are yaws of 0°, 90°, 180° about z). Then write the single mint_solid call that would reproduce the object as closely as you can, using ONLY the vocabulary on the cards.

Views (use the Read tool on each):
${pngs.map((p) => `- ${p}`).join('\n')}

<cards>
${cardText}
</cards>

Reply with ONLY one JSON object of the form {"kind": "workbench" | "code", "spec": { ... }} and nothing else.`;
      const t0 = Date.now();
      let reply = '', spec = null, remint = null, error = null;
      try {
        reply = await ask(prompt, tmpdir());
        spec = parseSpec(reply);
        remint = await mintSolidHandler({ kind: spec.kind === 'code' ? 'code' : 'workbench', title: `${fx.id} re-mint`, ref: `rt-${fx.id}-remint`, spec: spec.spec });
      } catch (err) { error = err.message; }
      const wallMs = Date.now() - t0;
      let geom = 0, similarity = null;
      if (remint) {
        const bFaces = lowerObjectFaces(SketchRepository.getByRef(`rt-${fx.id}-remint`).manifest, WORKBENCH_LIGHT);
        geom = geomScore(faces, bFaces);
        try { similarity = (await diffSketchesHandler({ left_ref: `rt-${fx.id}`, right_ref: `rt-${fx.id}-remint`, force: true })).similarity; } catch { similarity = null; }
      }
      return { id: fx.id, idiom: fx.idiom, geom, similarity, error, wall_ms: wallMs, ledger: original.stats.ledger, remint_ledger: remint ? remint.stats.ledger : null, reply_chars: reply.length, spec };
    });
    const report = { model: MODEL, at: new Date().toISOString(), results, mean_geom: results.reduce((s, r) => s + r.geom, 0) / results.length };
    const path = join(tmpdir(), 'mojulo-roundtrip-report.json');
    writeFileSync(path, JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    console.log(`round-trip report → ${path}\n${results.map((r) => `  ${r.id.padEnd(14)} ${r.idiom.padEnd(24)} geom ${r.geom.toFixed(3)}  sim ${r.similarity == null ? '  -  ' : r.similarity.toFixed(3)}  recipe ${r.ledger.recipe_bytes}B / ${r.ledger.wall_ms}ms / ${r.ledger.faces} faces${r.error ? `  ERROR ${r.error.slice(0, 60)}` : ''}`).join('\n')}\n  mean geom ${report.mean_geom.toFixed(3)}`);
    expect(report.mean_geom).toBeGreaterThanOrEqual(GEOM_FLOOR);
  }, 20 * 60 * 1000);
});

describe('round-trip eval — offline pieces', () => {
  it('every fixture mints through mint_solid, closed, with a ledger (no model needed)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mojulo-roundtrip-offline-'));
    process.env.SQLITE_PATH = process.env.SQLITE_PATH || join(dir, 'fixtures.db');
    process.env.MOJULO_OUTCOMES_DIR = process.env.MOJULO_OUTCOMES_DIR || join(dir, 'outcomes');
    const { mintSolidHandler: mint } = await import('./mint-solid.js');
    for (const fx of ROUNDTRIP_FIXTURE) {
      const res = await mint({ kind: fx.kind, title: fx.id, ref: `rt-offline-${fx.id}`, spec: fx.spec });
      expect(res.ok, fx.id).toBe(true);
      expect(res.stats.ledger, fx.id).toMatchObject({ closed: true });
      expect(res.stats.ledger.recipe_bytes, fx.id).toBeGreaterThan(50);
      expect(res.stats.ledger.faces, fx.id).toBeGreaterThan(10);
    }
  }, 120000);
  it('geomScore: identical → 1, disjoint → 0, symmetric', () => {
    const cube = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] }, { corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }];
    const far = cube.map((f) => ({ corners: f.corners.map(([x, y, z]) => [x + 5, y, z]) }));
    expect(geomScore(cube, cube)).toBe(1);
    expect(geomScore(cube, far)).toBe(0);
    const half = [cube[0]];
    expect(geomScore(cube, half)).toBe(geomScore(half, cube));
  });
  it('the fixture spans the idioms the card must teach: monomers, fields, expr, domain ops, one program', () => {
    const idioms = ROUNDTRIP_FIXTURE.map((f) => f.idiom);
    expect(ROUNDTRIP_FIXTURE).toHaveLength(12);
    expect(idioms.filter((i) => /expr/.test(i)).length).toBeGreaterThanOrEqual(2);
    expect(idioms.filter((i) => /repeat|twist/.test(i)).length).toBeGreaterThanOrEqual(3);
    expect(ROUNDTRIP_FIXTURE.filter((f) => f.kind === 'code')).toHaveLength(1);
    expect(new Set(ROUNDTRIP_FIXTURE.map((f) => f.id)).size).toBe(12);
  });
});
