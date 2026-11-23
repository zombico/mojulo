/**
 * THE VIEW'S HTML — the page every view route is drawn in, and the little it is drawn with. Plain HTML strings, one
 * stylesheet, no script but what a page asks for; low fidelity on purpose (layout and plain styling, no design pass).
 *
 *   esc(s)                         → text made safe for HTML
 *   page({ title, active, body })  → a whole document: the nav (games first), the title, the body
 *   badge(state, text)             → a gate's state as a chip: pass | fail | open | skip
 *   NAV                            → the view's sections, in the order the work is
 */

export const NAV = Object.freeze([
  ['games', 'Games', '/'],
  ['levels', 'Levels', '/levels'],
  ['characters', 'Characters', '/characters'],
  ['objects', 'Objects', '/objects'],
]);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const CSS = `
:root { --bg: #fbfbfa; --ink: #1d1f22; --dim: #6a6f76; --line: #e2e3e5; --card: #ffffff;
  --pass: #1f7a3d; --fail: #b3261e; --open: #8a6d00; --skip: #6a6f76; }
@media (prefers-color-scheme: dark) { :root { --bg: #15171a; --ink: #e8e9eb; --dim: #9aa0a6; --line: #2a2d31; --card: #1c1f23;
  --pass: #6fd08c; --fail: #ff8a80; --open: #e6c15a; --skip: #9aa0a6; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
header { display: flex; gap: 20px; align-items: baseline; padding: 14px 20px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
header b { font-size: 16px; }
nav a { margin-right: 14px; color: var(--dim); text-decoration: none; }
nav a.on { color: var(--ink); font-weight: 600; }
main { max-width: 1100px; margin: 0 auto; padding: 20px; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 10px; }
.sub { color: var(--dim); margin: 0 0 16px; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
.card a.t { font-weight: 600; color: var(--ink); text-decoration: none; }
table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--dim); font-weight: 500; font-size: 13px; }
a { color: inherit; }
.b { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 10px; border: 1px solid currentColor; margin: 0 4px 4px 0; white-space: nowrap; }
.b-pass { color: var(--pass); } .b-fail { color: var(--fail); } .b-open { color: var(--open); } .b-skip { color: var(--skip); }
.why { color: var(--dim); font-size: 13px; }
iframe { width: 100%; height: 62vh; border: 1px solid var(--line); border-radius: 8px; background: #000; }
form.eyes { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
form.eyes input[type=text] { flex: 1; min-width: 200px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--ink); }
button { padding: 6px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--ink); cursor: pointer; }
.empty { color: var(--dim); }
@media (max-width: 600px) { main { padding: 14px 16px; } th:nth-child(n+4), td:nth-child(n+4) { display: none; } }
`;

export function page({ title, active = null, body = '' }) {
  const nav = NAV.map(([id, label, href]) => `<a href="${href}"${id === active ? ' class="on"' : ''}>${label}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · mojulo</title><style>${CSS}</style></head>
<body><header><b>mojulo</b><nav>${nav}</nav></header><main>${body}</main></body></html>`;
}

export const badge = (state, text) => `<span class="b b-${esc(state)}">${esc(text)}</span>`;
