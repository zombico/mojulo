// Prepared states: one exhibit's versions, by ref, switched in one page that keeps the camera; and the framed state's
// half (the pose sync), which a page carries only when it is asked for.
import { describe, it, expect } from 'vitest';
import { statesManifest, statesHtml, defaultControl, isStatesKind, STATES_LIMITS } from './states.js';
import { auditStates } from './audit.js';
import { syncScript } from '../scene/channels/sync.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const store = {
  sk_a: { ref: 'sk_a', manifest: { kind: 'hydro-view', head: 30 } },
  sk_b: { ref: 'sk_b', manifest: { kind: 'hydro-view', head: 60 } },
  sk_c: { ref: 'sk_c', manifest: { kind: 'cellular-view' } },
  sk_chart: { ref: 'sk_chart', manifest: { stations: [] } },
};
const get = (r) => store[r] ?? null;
const two = [{ ref: 'sk_a', label: '30 m', caption: 'Low.' }, { ref: 'sk_b', label: '60 m' }];

describe('a states recipe', () => {
  it('keeps its states, the axis and a control that suits the count', () => {
    const m = statesManifest({ kind: 'exhibit-states', title: 'Head', label: 'Water level', states: two }, get);
    expect(m).toEqual({ kind: 'exhibit-states', title: 'Head', label: 'Water level', control: 'toggle', states: [{ ref: 'sk_a', label: '30 m', caption: 'Low.' }, { ref: 'sk_b', label: '60 m' }] });
    expect(defaultControl(3)).toBe('toggle');
    expect(defaultControl(4)).toBe('slider');
    expect(statesManifest({ kind: 'exhibit-states', control: 'carousel', states: two, start: 1, kiosk: true }, get)).toMatchObject({ control: 'carousel', start: 1, kiosk: true });
    expect(isStatesKind('exhibit-states')).toBe(true);
  });

  it('refuses what is not a state, saying why', () => {
    const at = (m) => () => statesManifest({ kind: 'exhibit-states', ...m }, get);
    expect(at({ states: [two[0]] })).toThrow(/states is two prepared states or more/);
    expect(at({ states: [two[0], { ref: 'sk_nope', label: 'x' }] })).toThrow(/states\[1\]\.ref names no sketch 'sk_nope'/);
    expect(at({ states: [two[0], { ref: 'sk_chart', label: 'x' }] })).toThrow(/'sk_chart' is a sketch, not an exhibit or a world/);
    expect(at({ states: [two[0], { ref: 'sk_b', label: '30 m' }] })).toThrow(/repeats '30 m': each state is told apart by its label/);
    expect(at({ states: two, control: 'dial' })).toThrow(/control is one of slider, toggle, carousel/);
    expect(at({ states: two, start: 2 })).toThrow(/start is a state's index, 0 to 1/);
    expect(at({ states: Array.from({ length: STATES_LIMITS.states + 1 }, (_, i) => ({ ref: 'sk_a', label: String(i) })) })).toThrow(/at most 8/);
  });
});

describe('the states page', () => {
  it('is one self-contained document, its states framed with ?sync=1 by the src it is given', () => {
    const html = statesHtml({ title: 'Head <m>', label: 'Water level', control: 'slider', states: two }, { src: (s) => `states/${s.ref}.html` });
    expect(html).toContain('"src":"states/sk_a.html"');
    expect(html).toContain("'sync=1'");
    expect(html).toContain('Head &lt;m&gt;');
    expect(html).toContain('CONTROL = "slider"');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//);
    expect(statesHtml({ title: 'Head <m>', label: 'Water level', control: 'slider', states: two }, { src: (s) => `states/${s.ref}.html` })).toBe(html);
  });
});

describe('the framed state: the pose sync', () => {
  const base = { faces: [{ group: 'dam', color: '#888', poly: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }], cameras: [{ name: 'side', pos: [0, -8, 3], target: [0, 0, 0], vfov: 45 }] };
  it('is not a byte of a page that does not ask for it, and talks only to its own parent when it does', () => {
    const plain = emitThreeWorld(base);
    expect(emitThreeWorld({ ...base, sync: false })).toBe(plain);
    expect(plain).not.toContain('pose-ready');
    const html = emitThreeWorld({ ...base, sync: true });
    expect(html).toContain(syncScript().trim().split('\n')[0]);
    expect(html).toMatch(/a framed STATE[\s\S]*#wrap\{width:100vw;height:100vh/);
    const js = syncScript();
    expect(js).toMatch(/e\.source !== window\.parent/);
    for (const m of ['pose-get', 'pose-set', 'pose-ready', 'frame-touch', 'frame-key']) expect(js).toContain(`'${m}'`);
  });
});

describe('the states audit', () => {
  it('asks for the axis, a caption a state, one exhibit throughout, and a control that suits the count', () => {
    const a = auditStates({ states: [{ label: 'a', caption: 'x', kind: 'hydro-view' }, { label: 'b', kind: 'cellular-view' }], control: 'slider' });
    expect(a.findings.map((f) => `${f.level}:${f.code}`)).toEqual(['advice:no-axis', 'advice:no-caption', 'warn:mixed-kinds', 'advice:two-on-a-slider']);
    const crowd = auditStates({ label: 'x', control: 'toggle', states: Array.from({ length: 5 }, (_, i) => ({ label: String(i), caption: 'c', kind: 'k' })) });
    expect(crowd.findings.map((f) => f.code)).toEqual(['crowded-toggle']);
  });
});
