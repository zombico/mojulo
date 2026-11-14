// THE FRAME AS STATE: a spec branches on the frame it is drawn in ({ frame: <word> } in a when / unless), the runtime
// says it (a mount measures its own box), and a row says what it does when it runs out of width (`fit`).
import { describe, it, expect } from 'vitest';
import { manaUi, manaCss } from './index.js';

const spec = { screens: {}, hud: { use: 'hud', children: [
  { use: 'region', props: { at: 'top-left' }, unless: { frame: 'portrait' }, children: [{ use: 'text', props: { value: 'wide' } }] },
  { use: 'region', props: { at: 'top' }, when: { frame: 'portrait' }, children: [{ use: 'stack', props: { dir: 'row', fit: 'wrap' }, children: [{ use: 'text', props: { value: 'tall' } }, { use: 'text', props: { value: 'held' }, when: { frame: 'hand' } }] }] },
] } };
const rt = (host = {}) => manaUi.runtime(spec, { read: () => undefined, act() {}, ...host });

describe('the frame a view is drawn in', () => {
  it('unsaid is a desk: wide, not held', () => {
    const r = rt();
    expect(r.frame()).toMatchObject({ w: 1920, h: 1080, landscape: true, portrait: false, narrow: false, hand: false });
    expect(r.view()).toContain('wide');
    expect(r.view()).not.toContain('tall');
  });
  it('a host says its own; a spec is laid by it', () => {
    const r = rt({ frame: { w: 390, h: 844, hand: true } });
    expect(r.frame()).toMatchObject({ portrait: true, narrow: true, hand: true });
    expect(r.view()).toContain('tall');
    expect(r.view()).toContain('held');
    expect(r.view()).not.toContain('wide');
  });
  it('a frame that changes is laid again; one that does not is not', () => {
    const r = rt(), a = r.view(), n = r.state().renders;
    r.frame({ w: 1920, h: 1080 });
    expect(r.state().renders).toBe(n);
    r.frame({ w: 400, h: 800 });
    expect(r.view()).not.toBe(a);
    expect(r.frame().hand).toBe(false);                    // (what was not said is kept)
  });
  it('every frame word reads', () => { const r = rt(); for (const k of manaUi.FRAME_WORDS) expect(r.frame()[k]).not.toBeUndefined(); });
});

describe('a row that runs out of width', () => {
  it('says what it does: wrap, or stack in a narrow frame; unsaid, nothing is written', () => {
    expect(rt({ frame: { w: 390, h: 844 } }).view()).toContain('data-fit="wrap"');
    const plain = manaUi.runtime({ screens: {}, hud: { use: 'hud', children: [{ use: 'region', props: { at: 'top' }, children: [{ use: 'stack', props: { dir: 'row' }, children: [] }] }] } }, { read() {}, act() {} });
    expect(plain.view()).not.toContain('data-fit');
    expect(manaCss()).toContain('[data-fit=wrap]{flex-wrap:wrap}');
    expect(manaCss()).toContain('[data-dir=row][data-fit=stack]{flex-direction:column');
    expect(() => manaUi.readSpec({ screens: {}, hud: { use: 'hud', children: [{ use: 'region', props: { at: 'top' }, children: [{ use: 'stack', props: { fit: 'squeeze' }, children: [] }] }] } })).toThrow(/fit/);
  });
});
