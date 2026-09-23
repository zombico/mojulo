// remote-worker exports P2–P4 — `format: 'bundle'` (the one file every host door accepts),
// `cdn: true` on the html leg, and the `fits` + `handoff` every written export carries. The
// seed-91 city is the same fixture export-model.html.test.js pins.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, afterEach } from 'vitest';
import AdmZip from 'adm-zip';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-bundle-outcomes-'));

import { composeWorld } from './compose-world.js';
import { exportModelHandler } from './sketch-model-export.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';

const CITY = {
  base: 'city', seed: 91, ref: 'sk_bundle_city',
  overrides: {
    context: { depth: 3, density: 0.82, baseScale: 0.7, locale: 'north-america', time: 'day' },
    region: { x: 0, y: 0, w: 36, d: 36 },
  },
};
const CYLINDER = { id: 'body', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };

describe('export_model format:bundle', () => {
  afterEach(() => { _resetClientBindingsForTests(); delete process.env.MOJULO_HOST; delete process.env.MOJULO_SURFACE; });

  it('zips page + mesh + recipe + README deterministically; a maquette kind ships no STL', async () => {
    composeWorld(CITY);
    const a = await exportModelHandler({ ref: CITY.ref, format: 'bundle' });
    expect(a.ok).toBe(true);
    expect(a.format).toBe('bundle');
    expect(a.kind).toBe('fractal-city');
    expect(a.path).toBe(path.join(process.env.MOJULO_OUTCOMES_DIR, CITY.ref, 'sk_bundle_city.zip'));
    expect(a.download_url).toBe('/outcomes/sk_bundle_city/sk_bundle_city.zip');
    expect(a.files.map((f) => f.name)).toEqual(['README.md', 'model.glb', 'recipe.json', 'world.html']);
    expect(a).not.toHaveProperty('print');
    const zipBytes = readFileSync(a.path);
    expect(zipBytes.length).toBe(a.bytes);
    // the archive lists exactly the entries, sorted, and their bytes match the folder
    const zip = new AdmZip(zipBytes);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toEqual(['README.md', 'model.glb', 'recipe.json', 'world.html']);
    // cdn-default: inside the zip the page is plain `world.html`; on DISK the bundle wrote it
    // as `world.offline.html` (it asked for `cdn: false`), so the entry maps back to that name.
    const onDisk = (name) => (name === 'world.html' ? 'world.offline.html' : name);
    for (const e of zip.getEntries()) {
      expect(e.getData().equals(readFileSync(path.join(a.dir, onDisk(e.entryName))))).toBe(true);
    }
    const readme = zip.readAsText('README.md');
    expect(readme).toMatch(/## Bundle/);
    expect(readme).toMatch(/No `model\.stl`: `fractal-city` prints as a miniature/);
    expect(readme).toMatch(/world\.html/);
    // no loopback address anywhere in the page the zip carries
    expect(zip.readAsText('world.html')).not.toMatch(/127\.0\.0\.1|localhost/);
    // cdn-default, THE trap: the handler's default flipped to the CDN build, but the zip is a
    // download the operator unzips and opens from disk. Its page must carry its own three.js —
    // `bundleExport` passes `cdn: false` for this line. No network reference of any kind.
    expect(zip.readAsText('world.html')).toMatch(/"three": ?"data:text\/javascript;base64,/);
    expect(zip.readAsText('world.html')).not.toMatch(/jsdelivr|https?:\/\//);
    // and the README inside the zip names the page by the name the zip actually uses
    expect(readme).not.toMatch(/world\.offline\.html/);
    // the courier page: the zip embedded in one page with a Save button, for the host whose file
    // door is a page; not itself in the zip
    expect(a.courier.path).toBe(path.join(a.dir, 'sk_bundle_city.courier.html'));
    expect(a.courier.download_url).toBe('/outcomes/sk_bundle_city/sk_bundle_city.courier.html');
    const courier = readFileSync(a.courier.path, 'utf8');
    expect(Buffer.byteLength(courier)).toBe(a.courier.bytes);
    expect(courier).toContain(zipBytes.toString('base64'));
    expect(courier).toMatch(/window\.claude\.use\('downloads'\)/);
    expect(courier).toMatch(/Save sk_bundle_city\.zip/);
    expect(courier).not.toMatch(/https?:\/\/|127\.0\.0\.1|localhost/);
    // deterministic: the same row zips to the same bytes, and the courier follows
    const b = await exportModelHandler({ ref: CITY.ref, format: 'bundle' });
    expect(readFileSync(b.path).equals(zipBytes)).toBe(true);
    expect(readFileSync(b.courier.path, 'utf8')).toBe(courier);
    // every written export says the next move; with no host known it is the generic sentence
    expect(a.fits).toEqual({ fits: true, budget: null, over_by: 0 });
    expect(a.handoff.host).toBeNull();
    expect(a.handoff.next).toBe(`the file is at ${a.path}`);
    expect(a.handoff.caveats).toEqual(['/outcomes/sk_bundle_city/sk_bundle_city.zip is reachable only from the machine mojulo runs on']);
    expect(a._structured).toBe(true); // the whole body rides as structuredContent
  }, 180_000);

  it('a literal kind ships model.stl and its print advisories in the README', async () => {
    SketchRepository.create({ ref: 'sk_bundle_cyl', title: 'cyl', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const r = await exportModelHandler({ ref: 'sk_bundle_cyl', format: 'bundle' });
    expect(r.ok).toBe(true);
    expect(r.files.map((f) => f.name)).toEqual(['README.md', 'model.glb', 'model.stl', 'recipe.json', 'world.html']);
    expect(r.print.size_mm).toEqual([40, 40, 60]);
    expect(Array.isArray(r.print.advisories)).toBe(true);
    const readme = new AdmZip(readFileSync(r.path)).readAsText('README.md');
    expect(readme).toMatch(/`model\.stl` is the print file at literal scale \(40 × 40 × 60 mm\)/);
  }, 120_000);

  it('ineligible kinds answer the same { ok:false, eligible:false } as every leg', async () => {
    SketchRepository.create({ ref: 'sk_bundle_flat', title: 'flat', manifest: { kind: 'flow', nodes: [], edges: [] } });
    const r = await exportModelHandler({ ref: 'sk_bundle_flat', format: 'bundle' });
    expect(r.ok).toBe(false);
    expect(r.eligible).toBe(false);
    expect(existsSync(path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_bundle_flat', 'sk_bundle_flat.zip'))).toBe(false);
  });

  it('the handoff names this host\'s door: claude-code box → Artifact tool for the page, the zip for the mesh', async () => {
    rememberClientInfo('bundle-s1', { name: 'claude-code', version: '2' });
    process.env.MOJULO_SURFACE = 'box';
    const ctx = { mcpSessionId: 'bundle-s1' };
    const page = await exportModelHandler({ ref: CITY.ref, format: 'html' }, ctx);
    expect(page.handoff.host).toBe('claude-code');
    expect(page.handoff.surface).toBe('box');
    expect(page.handoff.door).toBe('artifact');
    expect(page.handoff.next).toMatch(/publish world\.html \(.* MiB\) with your Artifact tool/);
    expect(page.fits).toEqual({ fits: true, budget: 16 * 1024 * 1024, over_by: 0, against: 'Claude Code on the web page limit' });
    const glb = await exportModelHandler({ ref: CITY.ref, format: 'glb' }, ctx);
    expect(glb.handoff.door).toBe('artifact-download');
    expect(glb.handoff.caveats[0]).toMatch(/\.glb is not on this host's download allowlist/);
    const zip = await exportModelHandler({ ref: CITY.ref, format: 'bundle' }, ctx);
    expect(zip.handoff.caveats.some((c) => /allowlist/.test(c))).toBe(false);
    expect(zip.handoff.next).toMatch(/^publish sk_bundle_city\.courier\.html with your Artifact tool declaring capabilities \{ downloads: true \}/);
    expect(zip.handoff.caveats).toEqual([expect.stringMatching(/reclaimed when the session ends/)]);
    // write:false writes nothing and so says nothing about doors
    const dry = await exportModelHandler({ ref: CITY.ref, format: 'glb', write: false }, ctx);
    expect(dry).not.toHaveProperty('handoff');
  }, 180_000);

  it('MOJULO_HOST picks the door for a CLI call that never sent initialize (Grok chat)', async () => {
    process.env.MOJULO_HOST = 'grok-chat';
    const r = await exportModelHandler({ ref: CITY.ref, format: 'glb' }, { mcpSessionId: 'cli' });
    expect(r.handoff.host).toBe('grok-chat');
    expect(r.handoff.surface).toBe('box');
    expect(r.handoff.next).toMatch(/hand model\.glb \(.*\) back as a file card, ≤ 25\.0 MiB/);
    expect(r.fits.against).toBe("Grok chat's sandbox file limit");
  }, 120_000);
});

describe('export_model format:html — the CDN build is the default', () => {
  it('loads three from the pinned jsdelivr path, drops the ~1 MB of data: modules, and says file:// is out', async () => {
    const offline = await exportModelHandler({ ref: CITY.ref, format: 'html', cdn: false });
    const cdn = await exportModelHandler({ ref: CITY.ref, format: 'html' });
    expect(cdn.ok).toBe(true);
    expect(cdn.cdn).toBe(true);
    // its own file: the offline build stays on disk untouched beside the default page
    expect(cdn.path).toBe(path.join(offline.dir, 'world.html'));
    expect(cdn.download_url).toBe(`/outcomes/${CITY.ref}/world.html`);
    expect(cdn.handoff.next).toMatch(/world\.html/);
    expect(readFileSync(offline.path, 'utf8')).toMatch(/data:text\/javascript;base64/);
    expect(cdn.note).toMatch(/cdn\.jsdelivr\.net/);
    expect(cdn.note).toMatch(/will NOT open from file:\/\//);
    const html = readFileSync(cdn.path, 'utf8');
    expect(html).toMatch(/"three": ?"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.min\.js"/);
    expect(html).not.toMatch(/data:text\/javascript;base64/);
    expect(html).not.toMatch(/127\.0\.0\.1|localhost/);
    expect(offline.bytes - cdn.bytes).toBeGreaterThan(900_000);
    // the default is deterministic and the offline build is unaffected by it
    const again = await exportModelHandler({ ref: CITY.ref, format: 'html' });
    expect(again.bytes).toBe(cdn.bytes);
    // `cdn` now defaults true, so the html-only guard must fire on an EXPLICIT flag only —
    // otherwise the default would throw on every mesh leg.
    await expect(exportModelHandler({ ref: CITY.ref, format: 'glb', cdn: true })).rejects.toThrow(/`cdn` applies to/);
    await expect(exportModelHandler({ ref: CITY.ref, format: 'glb', cdn: false })).rejects.toThrow(/`cdn` applies to/);
    expect((await exportModelHandler({ ref: CITY.ref, format: 'glb' })).ok).toBe(true);
  }, 180_000);
});
