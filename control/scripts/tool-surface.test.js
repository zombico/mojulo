import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import { parseArgs, buildPage, hillclimbMd, samePage } from './tool-surface.mjs';

// The tool-surface board and the hill-climb page are generated from the tree. A change to the tools, the packs or the
// cosmos registry that is not regenerated fails here: `npm run tool-surface`, then commit the pages with the change.
describe('the tool-surface pages are current', () => {
  const opts = parseArgs([]);
  it('docs/tool-surface/index.html', () => {
    expect(samePage(buildPage(opts), readFileSync(opts.out, 'utf8')), 'stale: npm run tool-surface').toBe(true);
  });
  it('docs/tool-surface/hillclimb.md', () => {
    expect(samePage(hillclimbMd(opts), readFileSync(opts.md, 'utf8')), 'stale: npm run tool-surface').toBe(true);
  });
  it('the head stamp alone does not make a page stale; anything else does', () => {
    const md = hillclimbMd(opts);
    expect(samePage(md, md.replace(/^Built from \S+ on \S+ \([^)]*\)\./m, 'Built from 0000000 on other (2000-01-01).'))).toBe(true);
    expect(samePage(md, md.replace('| 500 random worlds |', '| 499 random worlds |'))).toBe(false);
    const page = buildPage(opts);
    expect(samePage(page, page.replace(/"head":\{[^}]*\}/, '"head":{"sha":"0","branch":"x","date":""}'))).toBe(true);
  });
});
