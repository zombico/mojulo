// The dungeon's page in a world's book (wcd-page.js): the rings plate, the critical path, each layer and the
// principles' verdicts; a world with no dungeon has no page.
import { describe, expect, it } from 'vitest';
import { gameworldBibleHtml, esc } from './bible-html.js';
import { readGameworld, MEADOWMARK } from './index.js';
import { wcdPage } from './wcd-page.js';

const WCD = { core: 'core', spaces: { gate: { kind: 'outer', depth: 0 }, yard: { kind: 'outer', depth: 1, built: false }, core: { kind: 'inner', depth: 2 } },
  doors: [{ from: 'gate', to: 'yard', via: 'door', gate: { clearance: 1 } }, { from: 'yard', to: 'core', via: 'stair', gate: { power: 'grapple' } }, { from: 'core', to: 'gate', via: 'door', oneWay: true }] };

describe("the dungeon's page", () => {
  it('draws its layers, its path, its gates and its laws', () => {
    const html = wcdPage(readGameworld({ ...MEADOWMARK, wcd: WCD }), esc);
    expect(html).toContain('id="wcd"');
    expect(html).toContain('gate › yard › core');
    for (const t of ['door · CL-1', 'stair · grapple', 'door · open', 'yard · unbuilt']) expect(html).toContain(t);
    expect(html).toContain('marker-end="url(#wcd-arrow)"');
    expect((html.match(/st-approved/g) ?? []).length).toBe(readGameworld({ ...MEADOWMARK, wcd: WCD }).wcd.laws.filter((l) => l.holds).length);
  });

  it('is in the book, its tab beside the map; no dungeon, no page', () => {
    const book = gameworldBibleHtml({ ...MEADOWMARK, wcd: WCD });
    expect(book).toContain('<a href="#wcd">');
    expect(book).toContain('<section class="part" id="wcd">');
    expect(gameworldBibleHtml(MEADOWMARK)).not.toContain('id="wcd"');
  });
});
