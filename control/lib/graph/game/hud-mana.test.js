// a level's HUD rows on mana-ui (hud-mana.js): each row lowered to the part that means it, read by the runtime's own
// reader; the page's host (scene/channels/mana-hud.js) carries them and parses
import { describe, it, expect } from 'vitest';
import { hudToMana, levelHud, readRadarLook } from './hud-mana.js';
import { manaUi } from '../../mana-ui/index.js';
import { manaHudScript } from '../scene/channels/mana-hud.js';

const ROWS = [
  { var: 'score', label: 'score' },
  { var: 'coins', label: 'coins', as: 'counter', slot: 'top-right' },
  { var: 'hp', as: 'bar', max: 'hpMax', slot: 'bottom-left', id: 'hp' },
  { var: 'time', as: 'clock', slot: 'top', when: [1] },
  { on: 'goal.*', text: 'GOAL {score}' },
  { on: 'hit', as: 'toast', text: '-{event.damage}' },
  { var: 'score', as: 'toast' },
  { text: 'WASD to move', ttl: 5 },
];
const uses = (n, out = []) => { out.push(n.use); (n.children ?? []).forEach((c) => uses(c, out)); return out; };
const find = (n, use) => (n.use === use ? n : (n.children ?? []).map((c) => find(c, use)).find(Boolean));

describe('a level\'s rows on mana-ui', () => {
  const L = hudToMana(ROWS);
  it('is a spec the runtime reads', () => { expect(() => manaUi.readSpec(L.spec)).not.toThrow(); });
  it('lowers each row to the part that means it', () => {
    const u = uses(L.spec.hud);
    for (const part of ['stat', 'counter', 'bar', 'timer', 'moments', 'feed', 'text']) expect(u).toContain(part);
    expect(find(L.spec.hud, 'counter').props.icon).toBe('coin');
    const region = L.spec.hud.children.find((r) => r.props.at === 'bottom-left');
    expect(find(region, 'bar').props.variant).toBe('hp');
  });
  it('binds vars by key, a bar\'s max a var too', () => {
    expect(Object.values(L.feed.rows.vars).sort()).toEqual(['coins', 'hp', 'hpMax', 'score', 'time']);
  });
  it('gates a part by its id, its phases and its ttl', () => {
    expect(L.feed.rows.gates).toEqual([{ k: 'r2', id: 'hp' }, { k: 'r3', when: [1] }, { k: 'r7', ttl: 5 }]);
  });
  it('a banner is a moment, a toast a line of its slot', () => {
    expect(L.feed.rows.banners).toEqual([{ on: 'goal.*', text: 'GOAL {score}' }]);
    expect(L.feed.rows.toasts.map((t) => t.on ?? `var:${t.var}`)).toEqual(['hit', 'var:score']);
    expect(L.feed.rows.lines).toHaveLength(1);
  });
  it('the pilot\'s gauges lead, its health once only', () => {
    const own = (l) => JSON.stringify(l.spec).split('hero.hp"').length - 1;
    expect(own(L)).toBe(0);                                   // a row is already the health
    expect(own(hudToMana([{ var: 'score' }]))).toBe(1);
    expect(JSON.stringify(hudToMana(ROWS, { hero: false }))).not.toContain('hero.');
  });
  it('no rows: the pilot\'s parts alone, each standing only where the page has the thing', () => {
    const E = hudToMana([]);
    expect(() => manaUi.readSpec(E.spec)).not.toThrow();
    const C = E.spec.hud.children;
    // (the screen's edge and the damage ring under the places; the pilot's strip, its gun, the radar, the wheel)
    expect(C.map((c) => c.use)).toEqual(['peril', 'threat', 'region', 'region', 'region', 'region']);
    expect(C.slice(3).map((c) => c.when && c.when.bind)).toEqual(['gun.on', 'radar.on', 'wheel.open']);
    expect(C[2].props).toMatchObject({ at: 'bottom-left', variant: 'scrim', rest: { bind: 'hero.rest' } });
    expect(hudToMana([], { hero: false }).spec.hud.children).toEqual([]);
  });
  it('draws as a game: the health a strip in cells with no label, the corners on a scrim, the rest bare', () => {
    const E = hudToMana([{ var: 'hp', label: 'HP' }, { var: 'down', label: 'Down', as: 'counter', slot: 'top-left' }, { text: 'W walk', slot: 'bottom', ttl: 9 }]), J = JSON.stringify(E.spec);
    // (the level's health row is the strip: its var, the highest it has stood as its max)
    expect(J).not.toContain('"label":"HP"');
    expect(J).toContain('"segments":4,"size":"large","figures":false');
    expect(E.feed.hpVar).toBe('v0');
    const at = (slot) => E.spec.hud.children.filter((c) => c.props && c.props.at === slot).map((c) => c.props.variant);
    expect(at('top-left')).toEqual(['scrim']);
    expect(at('bottom')).toEqual(['bare']);
  });
});

describe('the host carries a level\'s rows', () => {
  it('lowers `rows: events` at emit and parses', () => {
    const js = manaHudScript(levelHud('console'), { game: true, rows: ROWS });
    expect(js).toContain('GOAL {score}');
    expect(js).toContain('.moj-c-hp');
    expect(() => new Function(js)).not.toThrow();
  });
  it('a card\'s name is the theme it is; a phone is held in the hand', () => {
    expect(typeof levelHud('toybox').theme).toBe('object');
    expect(levelHud('console', { screen: 'phone' }).theme).toEqual({ from: 'console', distance: 'hand' });
  });
  it('draws the pilot\'s parts in place of the page\'s own: the radar, the wheel, the damage ring and the weapon panel put away', () => {
    const js = manaHudScript(levelHud('console'), { game: true, rows: ROWS });
    expect(js).toContain('#__radar,#__wc,#__damageRing,div:has(>#__wepIcon)');
    for (const fn of ['__hRadar = ', '__hThings = ', '__hBearing = ']) expect(js).toContain(fn);
    expect(js).toContain('function pilot(W, me, V)');
    // (a level of a course, its own HUD and no pilot's parts, carries none of it)
    const course = manaHudScript({ spec: { hud: { use: 'hud', children: [] } }, theme: 'console', feed: {} });
    expect(course).not.toContain('function pilot(');
    expect(course).not.toContain('#__radar');
  });
  it('none ⇒ not a byte', () => { expect(manaHudScript(null, { rows: ROWS })).toBe(''); });
  it('a level steered by a virtual pad: its legend says the thumbs while the pad is up, the keys otherwise', () => {
    const rows = [{ kind: 'legend', slot: 'bottom', text: 'W A S D move' }];
    const plain = JSON.stringify(hudToMana(rows).spec), touch = JSON.stringify(hudToMana(rows, { touch: true }).spec);
    expect(plain).not.toContain('touch.');
    expect(touch).toContain('"unless":{"bind":"touch.on"}');
    expect(touch).toContain('"value":{"bind":"touch.hint"}');
    expect(touch).toContain('W A S D move');
  });
  it('a button row is a button in its slot whose press is its event', () => {
    const { spec } = hudToMana([{ press: 'whistle', label: 'whistle' }, { press: 'map', label: 'map', slot: 'top-right', id: 'map' }]);
    const at = (slot) => JSON.stringify(spec.hud.children.find((r) => r.props.at === slot));
    expect(at('bottom-right')).toContain('{"use":"button","props":{"label":"whistle"},"on":{"accept":{"emit":"whistle"}}}');
    expect(at('top-right')).toMatch(/"on":\{"accept":\{"emit":"map"\}\},"when":\{"bind":"on\.r1"\}/);
  });
});

describe('a level\'s radar look', () => {
  const mini = (spec) => JSON.stringify(spec).match(/"use":"minimap","props":\{"shape":"(\w+)"/)[1];
  it('square, large and of the pilot\'s floor when the level asks; the round scope as it was when it does not', () => {
    expect(mini(hudToMana([], {}).spec)).toBe('round');
    expect(mini(hudToMana([], { radar: { shape: 'square' } }).spec)).toBe('square');
    expect(levelHud('console', { radar: { shape: 'square', size: 'large', floor: true } }).radar).toEqual({ shape: 'square', size: 'large', floor: true });
    expect(levelHud('console')).not.toHaveProperty('radar');
    expect(() => readRadarLook({ shape: 'hex' })).toThrow(/shape is one of/);
    expect(() => readRadarLook({ zoom: 2 })).toThrow(/not one of/);
  });
  it('the page draws one floor and sizes the scope only when asked; a level that asks nothing keeps every byte', () => {
    const plain = manaHudScript(levelHud('console'), { rows: [] }), asked = manaHudScript(levelHud('console', { radar: { shape: 'square', size: 'large', floor: true } }), { rows: [] });
    expect(plain).not.toContain('__hFloorSvg');
    expect(plain).not.toContain('260 * var(--mana-du)');
    expect(asked).toContain('__hFloorSvg');
    expect(asked).toContain('260 * var(--mana-du)');
    expect(asked).toContain('[data-shape=square][data-scope=yes]');
  });
});
