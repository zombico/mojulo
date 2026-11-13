/**
 * Page pack (scene/page-pack.js): a World page made smaller with nothing cut. Claims under test: the one-file form
 * unpacks to the very page it was; the parts hold the same script, in order, each within its size; a page with no
 * module script, or one already packed, is left as it is; the same page packs to the same bytes.
 */
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { packPage, bundlePage, unpackPage, PAGE_PACK } from './page-pack.js';

// (a small page shaped as the emitter's: an import map, then the module script, whose body repeats so it compresses)
const body = `import * as THREE from 'three';\n${'const a = "AAAAAAAABBBBBBBBCCCCCCCC";\n'.repeat(4000)}window.ok = true;\n`;
const page = `<!doctype html><html><head><script type="importmap">{"imports":{"three":"x"}}</script></head><body><script type="module">${body}</script><p>after</p></body></html>`;

describe('page pack', () => {
  it('the one-file form is smaller and unpacks to the page it was', () => {
    const packed = packPage(page);
    expect(packed.length).toBeLessThan(page.length / 4);
    expect(packed).toContain(PAGE_PACK.mark);
    expect(packed).toContain('DecompressionStream("gzip")');
    expect(packed).toContain('<script type="importmap">');
    expect(unpackPage(packed)).toBe(page);
    expect(packPage(page)).toBe(packed);
  });
  it('the parts hold the same script in order, each within its size, beside a small document', () => {
    const B = bundlePage(page.replace(body, body + 'x'.repeat(10)), { partBytes: 64 * 1024, name: 'level-1' });
    const big = bundlePage(`<script type="module">${Array.from({ length: 60000 }, (_, i) => `v${(i * 2654435761) >>> 0}`).join(';')}</script>`, { partBytes: 64 * 1024 });
    expect(big.manifest.parts.length).toBeGreaterThan(1);
    for (const id of big.manifest.parts) expect(big.files[id].length).toBeLessThanOrEqual(64 * 1024);
    expect(zlib.gunzipSync(Buffer.concat(big.manifest.parts.map((id) => big.files[id]))).toString('utf8')).toMatch(/^v0;v2654435761;/);
    expect(B.manifest.parts).toEqual(['level-1-0.bin']);
    expect(B['index.html']).toContain('["level-1-0.bin"]');
    expect(B['index.html']).not.toContain('AAAAAAAABBBBBBBB');
    expect(() => bundlePage(page, { partBytes: 10 })).toThrow(/partBytes/);
    expect(() => bundlePage(page, { name: '../x' })).toThrow(/name/);
  });
  it('the text form holds the script as it is, in parts that each end on a whole character', () => {
    const src = 'const s = "é→日本語";\n'.repeat(9000), B = bundlePage(`<script type="module">${src}</script>`, { partBytes: 64 * 1024, form: 'text', name: 'w' });
    expect(B.manifest.parts.length).toBeGreaterThan(1);
    expect(B.manifest.parts[0]).toBe('w-0.txt');
    for (const id of B.manifest.parts) { expect(B.files[id].length).toBeLessThanOrEqual(64 * 1024); expect(B.files[id].toString('utf8')).not.toContain('\ufffd'); }
    expect(Buffer.concat(B.manifest.parts.map((id) => B.files[id])).toString('utf8')).toBe(src);
    expect(B['index.html']).not.toContain('DecompressionStream');
    expect(() => bundlePage(page, { form: 'zip' })).toThrow(/form/);
  });
  it('a page with no module script, or one already packed, is left as it is', () => {
    expect(packPage('<p>none</p>')).toBe('<p>none</p>');
    const packed = packPage(page);
    expect(packPage(packed)).toBe(packed);
    expect(bundlePage(packed).manifest.parts).toEqual([]);
    expect(unpackPage(page)).toBe(page);
  });
});
