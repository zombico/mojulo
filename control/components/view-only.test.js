import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The dashboard is view only: the operator's agent drives, the page shows. No page or
// component sends anything but a GET, opens a form, or hands the operator something to
// paste. The API routes stay (the agent's tools and the pages' GETs use them); this reads
// the pages and components, not app/api.
//
// The exceptions are the operator's own chrome, kept on purpose: signing in and out, and
// Settings (keys and language). /pose-lab is a developer harness reached only by URL.
const ROOT = path.resolve(__dirname, '..');
const EXEMPT = new Set([
  'app/login/page.jsx',
  'app/settings/settings-body.jsx',
  'app/pose-lab/page.jsx',
]);
// Sign-out rides the shell's strip and AuthNav: that one call is allowed anywhere.
const SIGN_OUT = /fetch\('\/api\/auth\/logout', \{ method: 'POST' \}\)/g;

const WRITES = [
  [/method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i, 'a fetch that writes'],
  [/\bmethod\s*[,}]|method:\s*[a-zA-Z_$]/, 'a fetch whose method is computed'],
  [/clipboard/, 'the clipboard'],
  [/<form\b|onSubmit=/, 'a form'],
  [/window\.(prompt|confirm)\(/, 'a prompt or confirm dialog'],
  [/sendBeacon\(/, 'a beacon'],
];

function sources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (rel === 'app/api' || name === 'node_modules') continue;
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\.js$/.test(name)) out.push(rel);
  }
  return out;
}

describe('the dashboard is view only', () => {
  const files = [...sources(path.join(ROOT, 'app')), ...sources(path.join(ROOT, 'components'))];

  it('reads pages and components, not the API', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.startsWith('app/api/'))).toBe(false);
  });

  it('no page or component writes, opens a form or touches the clipboard', () => {
    const found = [];
    for (const file of files) {
      if (EXEMPT.has(file)) continue;
      const text = readFileSync(path.join(ROOT, file), 'utf8').replace(SIGN_OUT, '');
      for (const [pattern, what] of WRITES) if (pattern.test(text)) found.push(`${file}: ${what}`);
    }
    expect(found).toEqual([]);
  });

  it('every exemption still exists, so the list cannot rot', () => {
    for (const file of EXEMPT) expect(files, file).toContain(file);
  });
});
