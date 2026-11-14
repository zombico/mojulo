// a level's HUD rows on mana-ui (hud-mana.js): each row lowered to the part that means it, read by the runtime's own
// reader; the page's host (scene/channels/mana-hud.js) carries them and parses
import { describe, it, expect } from 'vitest';
import { hudToMana, levelHud } from './hud-mana.js';
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
  it('no rows: the pilot\'s gauges alone', () => {
    const E = hudToMana([]);
    expect(() => manaUi.readSpec(E.spec)).not.toThrow();
    expect(E.spec.hud.children).toHaveLength(1);
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
  it('none ⇒ not a byte', () => { expect(manaHudScript(null, { rows: ROWS })).toBe(''); });
});
