import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { manaUi } from './kernel.js';
import { buildManaSnapshot, manaSnapshotSource } from './snapshot.js';

// The snapshot's copy, on the smallest view that shows it: the root copied inside its mount's classes (the sheet's
// scope), the sheet it was drawn under, everything held still, and what was moving baked at its instant. Whether the
// browser draws the copy as it draws the view is the transfer gate's (snapshot.chrome.test.js).

function view() {
  const dom = new JSDOM('<!doctype html><html><body><div class="moj-rpg"></div></body></html>', { url: 'http://localhost/' });
  const doc = dom.window.document, el = doc.querySelector('.moj-rpg');
  const rt = manaUi.runtime({ start: 'a', screens: { a: { use: 'screen', children: [{ use: 'list', props: { rows: ['One', 'Two'] } }] } } }, { read: () => undefined, act() {} });
  manaUi.mount(el, rt);
  // (the snapshot as a page runs it, in the page's own scope)
  const S = new Function('XMLSerializer', 'Image', `return ${manaSnapshotSource()};`)(dom.window.XMLSerializer, dom.window.Image);
  return { doc, root: el.querySelector('.mana-root'), S };
}

describe('mana-ui: the snapshot', () => {
  it('copies the root inside its mount\'s classes, the sheet beside it, and holds the copy still', () => {
    const { root, S } = view();
    const svg = S.svgOf(root, '.moj-rpg .mana-root{color:red}', { w: 640, h: 360 });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="640" height="360" viewBox="0 0 640 360"><foreignObject/);
    expect(svg).toContain('<div xmlns="http://www.w3.org/1999/xhtml" class="moj-rpg"');
    expect(svg).toContain('.moj-rpg .mana-root{color:red}');
    expect(svg).toContain('animation:none!important;transition:none!important');
    expect(svg).toMatch(/class="mana-root"[^>]*data-snap-root=""/);
    expect(svg).toContain('>Two<');
    // (the view itself is left as it was)
    expect(root.hasAttribute('data-snap-root')).toBe(false);
  });
  it('a crop draws one box of the view at its own size', () => {
    const { root, S } = view();
    expect(S.svgOf(root, '', { w: 640, h: 360, crop: { x: 100, y: 50, w: 80.5, h: 40 } })).toMatch(/width="81" height="40" viewBox="100 50 80.5 40"><foreignObject x="0" y="0" width="640" height="360">/);
  });
  it('what moves is baked at its instant: the properties its keyframes name, as the computed style holds them now', () => {
    const { doc, root, S } = view();
    const row = root.querySelectorAll('.mana-row')[1], index = [root, ...root.querySelectorAll('*')].indexOf(row);
    // (jsdom has no Web Animations: one animation and one transition stood in for, as the browser reports them)
    root.getAnimations = () => [
      { effect: { target: row, pseudoElement: null, getKeyframes: () => [{ offset: 0, opacity: '0', transform: 'translateY(10px)' }, { offset: 1, easing: 'ease' }] } },
      { transitionProperty: 'background-color', effect: { target: row, pseudoElement: '::after' } },
    ];
    doc.defaultView.getComputedStyle = (el, pseudo) => ({ getPropertyValue: (p) => ({ opacity: '0.5', transform: 'matrix(1, 0, 0, 1, 0, 5)', 'background-color': pseudo ? 'rgb(1, 2, 3)' : '' })[p] || '' });
    const { rules, marks } = S.frozenRules(root);
    expect([...marks]).toEqual([index]);
    expect(rules).toEqual([`[data-snap="${index}"]{opacity:0.5!important;transform:matrix(1, 0, 0, 1, 0, 5)!important}`, `[data-snap="${index}"]::after{background-color:rgb(1, 2, 3)!important}`]);
    const svg = S.svgOf(root, '', { w: 10, h: 10 });
    expect(svg).toContain(`data-snap="${index}"`);
    expect(svg).toContain(`[data-snap="${index}"]::after{background-color:rgb(1, 2, 3)!important}`);
  });
  it('is self-contained: the page runs the module\'s own code', () => {
    expect(() => new Function(`return ${manaSnapshotSource()};`)).not.toThrow();
    expect(Object.keys(buildManaSnapshot())).toEqual(['svgOf', 'frozenRules', 'imageOf', 'STILL']);
  });
});
