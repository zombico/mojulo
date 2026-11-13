/**
 * PAGE PACK — a World page made smaller without losing a byte of what it draws. The page (scene-three.js) is one
 * document whose module script holds everything the level is, most of it numbers written as text; nothing in it is cut.
 * It is compressed (gzip, which every browser inflates itself: `DecompressionStream`, no library) and the page carries
 * a few lines that inflate it and run it as the module it was. The page is the same page: the same script, run once.
 *
 *   packPage(html, { level? })          → the page as ONE file: its script gzipped and written into the document as
 *                                         base64, inflated on load. For a file a person opens or sends
 *   bundlePage(html, { partBytes?, name?, level? }) → { 'index.html': string, files: { '<name>-0.bin': Buffer, … },
 *                                         manifest }: the page as a small document and its script gzipped in parts beside
 *                                         it (binary, so no base64's third), each part at most `partBytes`: for a host
 *                                         that limits a file's size (an artifact's page and its supporting files). The
 *                                         document fetches its parts by their relative names, in order
 *   unpackPage(html)                    → the page as it was (packPage's inverse; Node), for a test and a reader
 *   PAGE_PACK                           its numbers: the gzip level, a part's default size
 *
 * A page with no module script, or one already packed, is returned as it is. Deterministic: the same page in, the same
 * bytes out (gzip writes no clock).
 */
import zlib from 'node:zlib';

export const PAGE_PACK = Object.freeze({ level: 9, partBytes: 12 * 1024 * 1024, mark: 'data-moj-pack' });

const OPEN = '<script type="module">', CLOSE = '</script>';

// the page's module script: the last one in the document (the importmap is its own script, before it)
function splitPage(html) {
  if (typeof html !== 'string') throw new Error('page-pack: the page is a string of HTML');
  const a = html.lastIndexOf(OPEN);
  if (a < 0 || html.includes(PAGE_PACK.mark)) return null;
  const b = html.indexOf(CLOSE, a);
  if (b < 0) return null;
  return { head: html.slice(0, a), src: html.slice(a + OPEN.length, b), tail: html.slice(b + CLOSE.length) };
}

// the lines that run an inflated script as the module it was: a blob the document imports (its bare imports resolve
// through the page's own import map, as the script's did)
const RUN = 'const __u = URL.createObjectURL(new Blob([__t], { type: "text/javascript" })); await import(__u); URL.revokeObjectURL(__u);';
const INFLATE = (stream) => `const __t = await new Response(${stream}.pipeThrough(new DecompressionStream("gzip"))).text();`;
const FAIL = 'document.body.insertAdjacentHTML("beforeend", "<p style=\\"font:14px system-ui;padding:16px\\">This page could not be opened: " + String(e && e.message || e) + "</p>");';

export function packPage(html, { level = PAGE_PACK.level } = {}) {
  const P = splitPage(html);
  if (!P) return html;
  const z = zlib.gzipSync(Buffer.from(P.src, 'utf8'), { level }).toString('base64');
  const loader = `<script type="module" ${PAGE_PACK.mark}="1">try { const __r = await fetch("data:application/octet-stream;base64,${z}"); ${INFLATE('__r.body')} ${RUN} } catch (e) { ${FAIL} throw e; }${CLOSE}`;
  return P.head + loader + P.tail;
}

export function bundlePage(html, { partBytes = PAGE_PACK.partBytes, name = 'world', level = PAGE_PACK.level } = {}) {
  if (!(Number.isInteger(partBytes) && partBytes >= 64 * 1024)) throw new Error('page-pack: partBytes is a whole number of bytes, 65536 or more');
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) throw new Error('page-pack: name is letters, digits and hyphens');
  const P = splitPage(html);
  if (!P) return { 'index.html': html, files: {}, manifest: { parts: [], bytes: Buffer.byteLength(html) } };
  const z = zlib.gzipSync(Buffer.from(P.src, 'utf8'), { level }), files = {}, parts = [];
  for (let o = 0, k = 0; o < z.length; o += partBytes, k++) { const id = `${name}-${k}.bin`; files[id] = z.subarray(o, Math.min(z.length, o + partBytes)); parts.push(id); }
  // (the parts fetched together, joined in order as one stream, inflated)
  const loader = `<script type="module" ${PAGE_PACK.mark}="1">try { const __p = ${JSON.stringify(parts)}; const __b = await Promise.all(__p.map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ": " + r.status); return r.arrayBuffer(); })); ${INFLATE('new Blob(__b).stream()')} ${RUN} } catch (e) { ${FAIL} throw e; }${CLOSE}`;
  const index = P.head + loader + P.tail;
  return { 'index.html': index, files, manifest: { parts, bytes: Buffer.byteLength(index) + z.length, script: z.length, was: Buffer.byteLength(html) } };
}

export function unpackPage(html) {
  const m = typeof html === 'string' ? /fetch\("data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)"\)/.exec(html) : null;
  if (!m || !html.includes(PAGE_PACK.mark)) return html;
  const a = html.lastIndexOf(`<script type="module" ${PAGE_PACK.mark}="1">`), b = html.indexOf(CLOSE, a);
  return html.slice(0, a) + OPEN + zlib.gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8') + CLOSE + html.slice(b + CLOSE.length);
}
