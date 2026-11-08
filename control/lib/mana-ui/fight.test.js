import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { IDIOMS, withIdioms } from './idioms.js';
import { FIGHT_IDIOMS, FIGHT_HUD, TRAINING_HUD } from './idioms-fight.js';
import { SAMPLE_STATE } from './samples.js';

// THE FIGHT'S LANGUAGE (idioms-fight.js, docs/mana-ui.md): two sides and one centre, health the frame, the fight never
// covered, a callout a word, the round's ritual at the centre. Each principle tested once, on the idioms that carry it.
const walk = (n, fn) => { if (Array.isArray(n)) return n.forEach((x) => walk(x, fn)); if (!n || typeof n !== 'object') return; fn(n); for (const k in n) walk(n[k], fn); };
const nodes = (id, use) => { const out = []; walk(IDIOMS[id].node, (n) => { if (n.use === use) out.push(n); }); return out; };
const read = (p) => manaUi.readPath(SAMPLE_STATE, p);
const hud = (ids, props = {}) => manaUi.runtime(withIdioms({ hud: { use: 'hud', children: ids.map((id) => ({ use: id, props: { ...IDIOMS[id].example, ...(props[id] ?? {}) } })) }, screens: {} }), { read });

describe('mana-ui: the fight\'s language', () => {
  it('two sides, one centre: the first side\'s parts left to right, the second\'s mirrored, each tag in its side\'s kit', () => {
    for (const id of ['fight-health', 'fight-meters']) {
      const bars = nodes(id, 'bar'), half = bars.length / 2;
      expect(bars.length % 2, id).toBe(0);
      expect(bars.slice(0, half).every((b) => (b.props.dir ?? 'ltr') === 'ltr'), `${id}: the first side fills from the left`).toBe(true);
      expect(bars.slice(half).every((b) => b.props.dir === 'rtl'), `${id}: the second fills from the right`).toBe(true);
    }
    expect(nodes('fight-health', 'badge').map((b) => b.props.side)).toEqual([0, 1]);
    expect(nodes('versus-splash', 'badge').map((b) => b.props.side)).toEqual([0, 1]);
    // (drawn: whose it is is said by its tag and name, not by its colour alone)
    const html = hud(['fight-health']).view();
    expect(html).toContain('P1');
    expect(html).toContain('P2');
  });

  it('the fight is never covered: a side\'s parts sit at its edge, the meters at the foot, only the announcer at the centre', () => {
    const at = (id) => nodes(id, 'region').map((r) => r.props.at);
    for (const id of FIGHT_HUD.filter((x) => x !== 'fight-announcer')) {
      for (const a of at(id)) expect(a === 'center' || !!(a && a.param && IDIOMS[id].example[a.param] === 'center'), `${id} keeps off the centre`).toBe(false);
    }
    expect(at('fight-announcer')).toEqual(['center']);
    // (a side's combo and callouts at either edge, as the game places them)
    const both = hud(['fight-combo', 'fight-callouts'], {}).view();
    expect(both).toContain('data-at="left"');
    const right = hud(['fight-combo'], { 'fight-combo': { at: 'right', hits: { bind: 'fight.p1.combo' }, damage: { bind: 'fight.p1.comboDamage' } } }).view();
    expect(right).toContain('data-at="right"');
  });

  it('a callout is a word passing at its side; the round\'s words are read at the centre, one at a time', () => {
    const [call] = nodes('fight-callouts', 'moments'), [ritual] = nodes('fight-announcer', 'moments');
    expect(call.props.as).toBe('toast');
    expect(ritual.props.as).toBe('banner');
    // (a callout quicker than the ritual: the fight goes on under it)
    expect(call.props.hold).toBeLessThan(ritual.props.hold);
    expect(call.props.read).toBeLessThan(ritual.props.read);
  });

  it('the elements do their talking: the frame says no word but the names, the select shows a fighter\'s figures only when asked', () => {
    const html = hud(['fight-health', 'fight-meters']).view();
    for (const w of ['Round', 'Super', 'Burst', 'Guard']) expect(html, w).not.toContain(`>${w}<`);
    expect(html).not.toMatch(/\d+\/\d+/);
    const sel = (stats) => manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'fighter-select', props: { ...IDIOMS['fighter-select'].example, stats } } } }), { read, act: () => {} }).view();
    expect(sel(false)).not.toContain('Rushdown');
    expect(sel(true)).toContain('Rushdown');
  });

  it('a combo shows only while one runs, and every word the fight says is a word a game can say again', () => {
    const none = hud(['fight-combo'], { 'fight-combo': { at: 'left', hits: 0, damage: 0 } }).view();
    expect(none).not.toContain('data-at="left"');
    // (the fight's words in a language of the game's: the runtime's table reaches them)
    const rt = manaUi.runtime(withIdioms({ hud: { use: 'hud', children: [{ use: 'fight-combo', props: IDIOMS['fight-combo'].example }] }, screens: {}, languages: { ja: { hits: 'ヒット' } }, language: 'ja' }), { read });
    expect(rt.view()).toContain('ヒット');
  });

  it('training lays its readouts over the fight\'s own, and the shelf is whole', () => {
    expect(TRAINING_HUD.every((id) => FIGHT_IDIOMS[id] && FIGHT_IDIOMS[id].kind === 'hud')).toBe(true);
    expect(FIGHT_HUD.every((id) => FIGHT_IDIOMS[id] && FIGHT_IDIOMS[id].kind === 'hud')).toBe(true);
    expect(Object.values(FIGHT_IDIOMS).every((I) => IDIOMS[Object.keys(FIGHT_IDIOMS).find((k) => FIGHT_IDIOMS[k] === I)].shelf === 'fight')).toBe(true);
    // (the elements do their talking: no word heads a readout, the readouts are the figures)
    const html = hud([...TRAINING_HUD]).view();
    for (const w of ['Inputs', 'Frame meter']) expect(html).not.toContain(w);
    expect(html).toContain('mana-feed');
    expect(html).toContain('+1');
  });
});

describe('mana-ui: a table\'s column said in the game\'s language', () => {
  it('a column labelled by a word reads as the word, never as an object', () => {
    const S = JSON.parse(JSON.stringify(SAMPLE_STATE)), at = (p) => manaUi.readPath(S, p);
    const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'command-list', props: IDIOMS['command-list'].example } }, languages: { ja: { frames: 'フレーム' } }, language: 'ja' }), { read: at, act: () => {} });
    expect(rt.view()).not.toMatch(/object Object/i);
    expect(rt.view()).toContain('フレーム');
  });
});
