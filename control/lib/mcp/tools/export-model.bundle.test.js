// remote-worker exports P2–P4 — `format: 'bundle'` (the one file every host door accepts),
// the opt-in `cdn: true` on the html leg, and the `fits` + `handoff` every written export carries. The
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
import { exportModelHandler, COURIER_ZIP_READER } from './sketch-model-export.js';
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
    // the page is `world.html` on disk and in the zip: the default self-contained build
    for (const e of zip.getEntries()) {
      expect(e.getData().equals(readFileSync(path.join(a.dir, e.entryName)))).toBe(true);
    }
    const readme = zip.readAsText('README.md');
    expect(readme).toMatch(/## Bundle/);
    expect(readme).toMatch(/No `model\.stl`: `fractal-city` prints as a miniature/);
    expect(readme).toMatch(/world\.html/);
    // no loopback address anywhere in the page the zip carries
    expect(zip.readAsText('world.html')).not.toMatch(/127\.0\.0\.1|localhost/);
    // The zip is a download the operator unzips and opens from disk. Its page must carry its own
    // three.js whatever the handler's default is — `bundleExport` passes `cdn: false` for this
    // line. No network reference of any kind.
    expect(zip.readAsText('world.html')).toMatch(/"three": ?"data:text\/javascript;base64,/);
    expect(zip.readAsText('world.html')).not.toMatch(/jsdelivr|https?:\/\//);
    // and the README inside the zip names the page by the name the zip actually uses
    expect(readme).not.toMatch(/world\.(offline|cdn)\.html/);
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

  // muse-carpet P5: Meta Muse's Library shows only .html, so the courier is also the export's folder
  // page. The reader it embeds is run here on the zip it embeds: every file must come out byte for byte.
  it("the courier is the export's folder page: one Save per file, unpacked by the page's own reader byte for byte", async () => {
    SketchRepository.create({ ref: 'sk_bundle_folder', title: 'folder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const r = await exportModelHandler({ ref: 'sk_bundle_folder', format: 'bundle' });
    expect(r.ok).toBe(true);
    const courier = readFileSync(r.courier.path, 'utf8');
    expect(courier).toContain('<code>outcomes/sk_bundle_folder/</code>');
    for (const f of r.files) expect(courier).toContain(`data-save="${f.name}"`);
    expect(courier).toContain('data-save="sk_bundle_folder.zip"');
    expect(courier).toContain(COURIER_ZIP_READER);
    // an in-app viewer may block downloads and even scripts: the notice is static HTML, hidden only on file://
    expect(courier).toMatch(/<p class="local" id="local">If Save does nothing here, .*download this page, open the copy on your device/);
    expect(courier).toContain("if (location.protocol === 'file:') document.getElementById('local').hidden = true;");
    expect(courier).not.toMatch(/https?:\/\/|127\.0\.0\.1|localhost/);
    const b64 = /<script id="zip" type="application\/octet-stream">([^<]+)<\/script>/.exec(courier)[1];
    const z = new Uint8Array(Buffer.from(b64, 'base64'));
    const { zipEntries, zipRead } = new Function(`${COURIER_ZIP_READER}\nreturn { zipEntries, zipRead };`)();
    const entries = zipEntries(z);
    expect(Object.keys(entries).sort()).toEqual(r.files.map((f) => f.name));
    for (const f of r.files) {
      const got = await zipRead(z, entries[f.name]);
      expect(Buffer.from(got).equals(readFileSync(path.join(r.dir, f.name))), f.name).toBe(true);
    }
  }, 120_000);

  // the courier on Claude's Artifact door: the viewer's downloads prompt saves only its allowlist (no glb, no stl), so
  // those rows point at the zip instead of failing; the static notice (for viewers that block downloads) names no
  // vendor and is hidden where the downloads capability runs
  it("the courier's per-file Save follows the viewer's downloads allowlist, and its notice names no vendor", async () => {
    const r = await exportModelHandler({ ref: 'sk_bundle_folder', format: 'bundle' });
    const courier = readFileSync(r.courier.path, 'utf8');
    expect(courier).not.toMatch(/Meta|Muse/);
    expect(r.courier.note).not.toMatch(/Meta|Muse|Claude|Artifact tool/);   // no host resolved: the generic note
    const src = [...courier.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
    const page = (claude) => {
      const el = (id) => ({ id, hidden: false, textContent: '', className: '' }), byId = { local: el('local'), status: el('status'), zip: el('zip') };
      const rows = r.files.map((f) => ({ name: f.name, disabled: false, textContent: 'Save', title: '', getAttribute: () => f.name }));
      const document = { getElementById: (id) => byId[id], querySelectorAll: () => rows, addEventListener: () => {} };
      new Function('window', 'document', 'location', src)(claude ? { claude } : {}, document, { protocol: 'https:' });
      return { local: byId.local.hidden, rows: Object.fromEntries(rows.map((b) => [b.name, b.disabled ? b.textContent : 'Save'])) };
    };
    const hosted = page({ use: async () => ({ save: async () => {} }) });
    expect(hosted.local).toBe(true);
    expect(hosted.rows).toEqual({ 'README.md': 'Save', 'model.glb': 'In the zip', 'model.stl': 'In the zip', 'recipe.json': 'Save', 'world.html': 'Save' });
    const plain = page(null);
    expect(plain.local).toBe(false);
    expect(Object.values(plain.rows).every((v) => v === 'Save')).toBe(true);
  }, 120_000);

  it('MOJULO_HOST=muse: the zip rides the courier page, the one type the Library shows', async () => {
    process.env.MOJULO_HOST = 'muse';
    const r = await exportModelHandler({ ref: 'sk_bundle_folder', format: 'bundle' }, { mcpSessionId: 'cli' });
    expect(r.handoff.host).toBe('muse');
    expect(r.handoff.door).toBe('drop-folder');
    expect(r.handoff.next).toMatch(/^copy sk_bundle_folder\.courier\.html into ~\/workspace\/your_files\/; it lands in the operator's Library as one page/);
    expect(r.courier.note).toMatch(/Here: copy it into ~\/workspace\/your_files\/, and it lands in the operator's Library\.$/);
    const glb = await exportModelHandler({ ref: 'sk_bundle_folder', format: 'glb' }, { mcpSessionId: 'cli' });
    expect(glb.handoff.next).toMatch(/shows only \.html files, so model\.glb would not surface there/);
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
    expect(zip.courier.note).toMatch(/Here: publish it with your Artifact tool declaring capabilities \{ downloads: true \}; that viewer saves no model\.glb on its own, so the page offers it inside the zip\.$/);
    expect(zip.courier.note).not.toMatch(/Muse|Library|your_files/);
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

describe('export_model format:html — the self-contained build is the default, the CDN build opt-in', () => {
  it('cdn:true loads three from the pinned jsdelivr path, drops the ~1 MB of data: modules, and says file:// is out', async () => {
    const page = await exportModelHandler({ ref: CITY.ref, format: 'html' });
    const cdn = await exportModelHandler({ ref: CITY.ref, format: 'html', cdn: true });
    expect(page.cdn).toBe(false);
    expect(cdn.ok).toBe(true);
    expect(cdn.cdn).toBe(true);
    // its own file: the default page stays on disk untouched beside the CDN build
    expect(cdn.path).toBe(path.join(page.dir, 'world.cdn.html'));
    expect(cdn.download_url).toBe(`/outcomes/${CITY.ref}/world.cdn.html`);
    expect(cdn.handoff.next).toMatch(/world\.cdn\.html/);
    expect(readFileSync(page.path, 'utf8')).toMatch(/data:text\/javascript;base64/);
    expect(cdn.note).toMatch(/cdn\.jsdelivr\.net/);
    expect(cdn.note).toMatch(/will NOT open from file:\/\//);
    const html = readFileSync(cdn.path, 'utf8');
    expect(html).toMatch(/"three": ?"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.min\.js"/);
    expect(html).not.toMatch(/data:text\/javascript;base64/);
    expect(html).not.toMatch(/127\.0\.0\.1|localhost/);
    expect(page.bytes - cdn.bytes).toBeGreaterThan(900_000);
    // the CDN build is deterministic and the default build is unaffected by it
    const again = await exportModelHandler({ ref: CITY.ref, format: 'html', cdn: true });
    expect(again.bytes).toBe(cdn.bytes);
    // the html-only guard fires on an EXPLICIT flag only, never on the default of a mesh leg
    await expect(exportModelHandler({ ref: CITY.ref, format: 'glb', cdn: true })).rejects.toThrow(/`cdn` applies to/);
    await expect(exportModelHandler({ ref: CITY.ref, format: 'glb', cdn: false })).rejects.toThrow(/`cdn` applies to/);
    expect((await exportModelHandler({ ref: CITY.ref, format: 'glb' })).ok).toBe(true);
  }, 180_000);
});
