// A folder of an outcome that has no index.html of its own, drawn as a page: its folders, then its files with their
// sizes, each a link (a page opens, anything else is taken). The words on it are the folder's own names. Pure: the
// route reads the disk and hands the entries in.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const href = (ref, parts) => `/outcomes/${[ref, ...parts].map(encodeURIComponent).join('/')}`;

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u += 1; }
  return `${v.toFixed(1)} ${units[u]}`;
}

/**
 * `ref` the outcome, `sub` the path inside it ([] at its top), `entries` [{ name, dir: boolean, bytes? }].
 */
export function folderListingHtml({ ref, sub = [], entries = [] }) {
  const dirs = entries.filter((e) => e.dir).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter((e) => !e.dir).sort((a, b) => a.name.localeCompare(b.name));
  const crumbs = [[ref, []], ...sub.map((s, i) => [s, sub.slice(0, i + 1)])]
    .map(([name, parts], i, all) => (i === all.length - 1 ? `<b>${esc(name)}</b>` : `<a href="${href(ref, parts)}/">${esc(name)}</a>`))
    .join(' / ');
  const row = (e) => {
    const link = href(ref, [...sub, e.name]);
    if (e.dir) return `<li class="dir"><a href="${link}/">${esc(e.name)}/</a></li>`;
    const page = /\.html?$/i.test(e.name);
    return `<li><a href="${link}"${page ? ' target="_blank" rel="noreferrer"' : ' download'}>${esc(e.name)}</a><span>${esc(formatSize(e.bytes))}</span></li>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc([ref, ...sub].join('/'))}</title>
<style>
:root{color-scheme:dark;--bg:#0b0d10;--ink:#e6e8eb;--muted:#7d8590;--rail:#22272e;--live:#5eead4}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
main{max-width:880px;margin:0 auto;padding:24px 16px}
nav{color:var(--muted);margin-bottom:16px}nav a{color:var(--muted)}nav b{color:var(--ink);font-weight:600}
ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--rail)}
li{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid var(--rail)}
li span{color:var(--muted);white-space:nowrap}a{color:var(--ink);text-decoration:none;overflow-wrap:anywhere}a:hover{color:var(--live)}
li.dir a{color:var(--live)}
</style></head>
<body><main><nav>${crumbs}</nav><ul>${[...dirs, ...files].map(row).join('')}</ul></main></body></html>
`;
}
