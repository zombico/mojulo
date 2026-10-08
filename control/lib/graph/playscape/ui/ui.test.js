/**
 * Playscape UI, step 0: parts lower exactly onto today's HUD rows, the register's dials read off one slider, a
 * direction is proposed, approved item by item and rerolled one item at a time, the page draws greybox until it is
 * settled, the board is assembled from tracked pieces, and the play drawer's cards come from the registries.
 */
import { describe, it, expect } from 'vitest';
import { normalizeHud } from '../../game/hud-widgets.js';
import { compose, lowerIdioms } from '../../worlds/game-idioms.js';
import { PARTS, PART_IDS, UI_STATES, readPart, lowerParts } from './parts.js';
import { REGISTER_STOPS, DIAL_IDS, DIALS, readRegister, stopOf, dialsAt, validatePins, registerCss, cleanDials, fontOfType } from './register.js';
import { motionSheet, rollMotion, MOTION_IDS, UI_MOTIONS } from './motion.js';
import { resolvePlayUi, lowerPlay, uiSettled, uiPending, UI_ITEMS, GREYBOX_TOKENS, phasesOf } from './direction.js';
import { uiAdvice } from './laws.js';
import { uiBoardHtml, uiSheetHtml, boardPieceIds } from './board-html.js';
import { playCards, playIndex, playRung, PLAY_RUNGS } from './cards.js';
import { eventsChannelScript } from '../../scene/channels/events.js';
import { readBorder, readPixel, borderCss, BORDER_FLAVORS, FLAVOR_IDS } from './borders.js';

const seeded = () => 4242;
const WORLD = (play, extra = {}) => ({ kind: 'controllable', title: 'Test', ...extra, play });

describe('parts lower exactly onto the HUD rows the idioms make', () => {
  it('a readout, banner, toast and legend normalize to the same widgets as their idioms', () => {
    const idiomRows = compose(...lowerIdioms([
      { kind: 'banner', on: 'game-over', text: 'TIME!' },
      { kind: 'legend', text: 'WASD', slot: 'bottom', ttl: 12 },
      { kind: 'toast', var: 'score', slot: 'top-right' },
    ])).hud;
    const partRows = lowerParts([
      { part: 'banner', bind: { on: 'game-over' }, text: 'TIME!' },
      { part: 'legend', text: 'WASD', at: 'bottom', ttl: 12 },
      { part: 'toast', bind: { var: 'score' }, at: 'top-right' },
    ]);
    expect(normalizeHud(partRows)).toEqual(normalizeHud(idiomRows));
  });

  it('every part example lowers to a valid row', () => {
    for (const id of PART_IDS) expect(normalizeHud(lowerParts([PARTS[id].example])).errors).toEqual([]);
  });

  it('teaches: an unknown part, a bad variant, a missing bind; a region the page does not draw yet is board-only', () => {
    expect(() => readPart({ part: 'gauge' })).toThrow(/parts: readout/);
    expect(() => readPart({ part: 'readout', variant: 'dial', bind: { var: 'x' } })).toThrow(/text, counter, bar, clock/);
    expect(() => readPart({ part: 'readout' })).toThrow(/bind: \{ var/);
    expect(readPart({ part: 'legend', text: 'hi', at: 'left' })).toMatchObject({ page: false, row: null });
    expect(uiAdvice({ parts: [{ part: 'legend', text: 'hi', at: 'left' }] }).map((a) => a.law)).toContain('board-only');
  });
});

describe('the register: one slider, the dials read off it', () => {
  it('stops and numbers both read; the ends are modern and immersive', () => {
    expect(readRegister('console')).toBe(0.75);
    expect(readRegister(0.3)).toBe(0.3);
    expect(() => readRegister('retro')).toThrow(/modern/);
    expect(stopOf(0.3)).toBe('clean');
    expect(dialsAt(REGISTER_STOPS.modern)).toMatchObject({ frame: 'none', surface: 'overlay', motion: 'ease' });
    expect(dialsAt(REGISTER_STOPS.immersive)).toMatchObject({ frame: 'material', surface: 'console', motion: 'mechanical', light: 'lit' });
  });

  it('a pin overrides its dial alone; a bad pin teaches', () => {
    expect(dialsAt(0, { frame: 'bevel' })).toMatchObject({ frame: 'bevel', plate: 'clear' });
    expect(validatePins({ frame: 'gold' })[0]).toMatch(/none, hairline/);
    expect(validatePins({ glow: 'on' })[0]).toMatch(/no such dial/);
  });

  it('every dial has five stops; the period face reads the fiction', () => {
    for (const d of DIAL_IDS) expect(DIALS[d]).toHaveLength(5);
    expect(fontOfType('period', { fiction: 'sci-fi mecha' })).toBe('mono');
    expect(fontOfType('period', { fiction: 'lich crypt' })).toBe('serif');
  });

  it('the dom backend is closed words in, CSS out: an author string never reaches it', () => {
    const css = registerCss({ frame: 'material}body{display:none', plate: 'textured', surface: 'console', layout: 'fixed' });
    expect(css).not.toMatch(/display:none/);
    expect(css).toMatch(/repeating-linear-gradient/);
    expect(css).toMatch(/::before/);
    expect(cleanDials({ frame: 'x', motion: 'stepped' })).toEqual({ motion: 'stepped' });
  });
});

describe('motion: frames on the game clock', () => {
  it('a sheet per dial; rolled frames stay inside their rails', () => {
    expect(motionSheet('stepped').map((m) => m.name)).toEqual(MOTION_IDS);
    expect(motionSheet('stepped')[0].fn).toMatch(/steps/);
    let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const F = rollMotion(R);
    for (const m of MOTION_IDS) { const [lo, hi] = UI_MOTIONS[m].rail; expect(F[m]).toBeGreaterThanOrEqual(lo); expect(F[m]).toBeLessThanOrEqual(hi); }
  });
});

describe('the direction gate: proposed, approved item by item, greybox until settled', () => {
  const parts = [{ part: 'readout', variant: 'bar', bind: { var: 'hp' }, at: 'bottom-left', max: 100 }];

  it("'propose' fills the guide and the motion as numbers, every item proposed, every value sourced", () => {
    const m = resolvePlayUi(WORLD({ parts, ui: 'propose' }), seeded);
    const u = m.play.ui;
    expect(u.seed).toBe(4242);
    expect(Object.keys(u.status)).toEqual(UI_ITEMS);
    expect(Object.values(u.status).every((s) => s === 'proposed')).toBe(true);
    expect(u.guide.sources).toMatchObject({ register: 'default', tokens: 'default' });
    expect(resolvePlayUi(WORLD({ parts, ui: 'propose' }), seeded)).toEqual(m);   // same seed, same direction
  });

  it('the operator\'s words win over the hints; a stage tone colours the tokens', () => {
    const m = resolvePlayUi(WORLD({ parts, ui: { register: 'console', pin: { type: 'period' } } }, { tone: 'noir', play_hints: { register: 'modern', fiction: 'lich crypt' } }), seeded);
    const g = m.play.ui.guide;
    expect(g).toMatchObject({ register: 0.75, stop: 'console', font: 'serif' });
    expect(g.sources).toMatchObject({ register: 'operator', tokens: 'world' });
    expect(g.sources.dials.type).toBe('operator');
    const hinted = resolvePlayUi(WORLD({ parts, ui: 'propose' }, { play_hints: { register: 'framed' } }), seeded).play.ui.guide;
    expect(hinted).toMatchObject({ register: 0.5, sources: { register: 'hints' } });
  });

  it('a reroll redraws only the item sent back; the others keep their numbers and approval', () => {
    const a = resolvePlayUi(WORLD({ parts, ui: 'propose' }), seeded).play.ui;
    const sent = { ...a, motion: 'reroll', status: { ...a.status, guide: 'approved' } };
    const b = resolvePlayUi(WORLD({ parts, ui: sent }), () => 99).play.ui;
    expect(b.guide).toEqual(a.guide);
    expect(b.status.guide).toBe('approved');
    expect(b.status.motion).toBe('proposed');
    expect(() => resolvePlayUi(WORLD({ parts, ui: { ...a, layout: 'reroll' } }), seeded)).toThrow(/edit those/);
  });

  it('the page draws greybox until every item is approved or auto, then the guide', () => {
    const u = resolvePlayUi(WORLD({ parts, ui: 'propose' }, { tone: 'isekai' }), seeded).play.ui;
    expect(lowerPlay(WORLD({ parts, ui: u })).style).toMatchObject(GREYBOX_TOKENS);
    expect(lowerPlay(WORLD({ parts, ui: u })).register).toBeUndefined();
    expect(uiPending(u)).toEqual(UI_ITEMS);
    const ok = { ...u, status: Object.fromEntries(UI_ITEMS.map((k) => [k, 'approved'])) };
    expect(uiSettled(ok)).toBe(true);
    const lowered = lowerPlay(WORLD({ parts, ui: ok }));
    expect(lowered.style.panel).toBe(u.guide.tokens.panel);
    expect(lowered.register).toEqual(u.guide.dials);
    expect(lowered.hud).toEqual(lowerParts(parts));
  });

  it("'auto' is settled at once; absent play lowers to nothing; phases are at most eight", () => {
    expect(uiSettled(resolvePlayUi(WORLD({ parts, ui: 'auto' }), seeded).play.ui)).toBe(true);
    expect(lowerPlay({ kind: 'controllable' })).toBeNull();
    expect(resolvePlayUi({ kind: 'controllable' })).toEqual({ kind: 'controllable' });
    expect(() => phasesOf({ phases: Array.from({ length: 9 }, (_, i) => `p${i}`) })).toThrow(/at most 8/);
  });
});

describe('the laws advise, never refuse', () => {
  it('a standing part in the centre and a crowded corner draw advice', () => {
    const play = { parts: [{ part: 'legend', text: 'hi', at: 'center' }, ...[1, 2, 3, 4].map((i) => ({ part: 'readout', bind: { var: `v${i}` } }))] };
    const laws = uiAdvice(play).map((a) => a.law);
    expect(laws).toContain('centre-is-focus');
    expect(laws).toContain('region-budget');
  });

  it('two pools drawn alike in one region fail the black-and-white test', () => {
    const play = { parts: [{ part: 'readout', variant: 'bar', bind: { var: 'hp' }, at: 'bottom-left', max: 1 }, { part: 'readout', variant: 'bar', bind: { var: 'mana' }, at: 'bottom-left', max: 1 }, { part: 'readout', variant: 'bar', bind: { var: 'surge' }, at: 'bottom-right', max: 1 }] };
    const apart = uiAdvice(play).filter((a) => a.law === 'values-apart');
    expect(apart).toHaveLength(1);
    expect(apart[0].advice).toMatch(/hp and mana/);
  });
});

describe('the board is assembled from tracked pieces', () => {
  const m = resolvePlayUi(WORLD({ parts: [PARTS.readout.example, PARTS.banner.example], phases: ['playing', 'won'], ui: 'propose' }), seeded);

  it('every piece id appears on the page, once', () => {
    const html = uiBoardHtml(m);
    for (const id of boardPieceIds(m)) expect(html.split(`data-piece="${id}"`).length - 1).toBe(1);
    expect(boardPieceIds(m)).toEqual(['ui:guide', 'ui:motion', 'ui:part:readout.bar:hp', 'ui:part:banner.banner:level-complete', 'ui:layout', 'ui:wireframe:playing', 'ui:wireframe:won']);
  });

  it('the reference sheet draws every part × variant in every state, in values and dressed', () => {
    const html = uiSheetHtml({ register: 1 });
    for (const p of PART_IDS) for (const v of PARTS[p].variants) expect(html).toContain(`data-piece="ui:part:${p}.${v}"`);
    expect(html.match(/class="pu-stage/g).length).toBe(PART_IDS.reduce((n, p) => n + PARTS[p].variants.length, 0) * UI_STATES.length * 2);
  });

  it('author words are escaped', () => {
    const evil = resolvePlayUi(WORLD({ parts: [{ part: 'banner', bind: { on: 'x' }, text: '<script>x</script>' }], ui: 'propose' }), seeded);
    expect(uiBoardHtml(evil)).not.toContain('<script>x</script>');
  });
});

describe('the page lays the register over its own sheet only when a settled direction brings one', () => {
  const hud = lowerParts([PARTS.readout.example]);
  it('absent register: the script is byte-identical to a hud-only world', () => {
    expect(eventsChannelScript({ hud })).toBe(eventsChannelScript({ hud, register: undefined }));
  });
  it('a register adds its dials\' sheet', () => {
    expect(eventsChannelScript({ hud, register: dialsAt(1) })).toMatch(/4px ridge/);
    expect(eventsChannelScript({ hud })).not.toMatch(/4px ridge/);
  });
});

describe('the play drawer\'s cards come from the registries', () => {
  it('a card per part, the contract cards, the ladder, a rung read', () => {
    const cards = playCards();
    for (const p of PART_IDS) expect(cards.has(`ui-part-${p}`)).toBe(true);
    for (const id of ['play-guide', 'ui-board', 'ui-register', 'ui-motion', 'ui-layout']) expect(cards.has(id)).toBe(true);
    expect(playIndex().ladder.map((r) => r.name)).toEqual(PLAY_RUNGS.map((r) => r.name));
    expect(playRung(2)).toMatchObject({ admits: ['board', 'click', 'level'], built: false });
    expect(playRung(9)).toBeNull();
  });
});

describe('stylized borders: elements composed, flavors as named sets, pixelated as its own tuning', () => {
  const parts = [{ part: 'readout', variant: 'bar', bind: { var: 'hp' }, max: 1 }];

  it('every flavor reads, and composes only elements that fit together', () => {
    for (const f of FLAVOR_IDS) expect(readBorder(f).elements).toEqual(BORDER_FLAVORS[f].elements);
    expect(() => readBorder('anime')).toThrow(/covert, futurepunk/);
    expect(() => readBorder({ elements: ['soft', 'glow', 'stitch'] })).not.toThrow();
    expect(() => readBorder({ elements: ['notch', 'brackets'] })).toThrow(/cuts the corners/);
    expect(() => readBorder({ elements: ['brackets', 'sparkles'] })).toThrow(/drawn from/);
    expect(readPixel(true)).toBe(3);
    expect(() => readPixel(5)).toThrow(/0, 2, 3, 4/);
  });

  it('a flavor sets the face, its dials and a tint, each sourced; the operator\'s pins and tint: false win', () => {
    const g = resolvePlayUi(WORLD({ parts, ui: { border: 'mech-cockpit' } }, { tone: 'noir' }), seeded).play.ui.guide;
    expect(g).toMatchObject({ font: 'display', border: { flavor: 'mech-cockpit' }, dials: { motion: 'stepped' } });
    expect(g.sources).toMatchObject({ tokens: 'flavor', font: 'flavor', border: 'operator' });
    expect(g.sources.dials.motion).toBe('flavor');
    const pinned = resolvePlayUi(WORLD({ parts, ui: { border: { flavor: 'mech-cockpit', tint: false }, pin: { motion: 'snap' } } }, { tone: 'noir' }), seeded).play.ui.guide;
    expect(pinned.dials.motion).toBe('snap');
    expect(pinned.sources.tokens).toBe('world');
  });

  it('pixelated gives the mono face and reaches the page with the border once settled', () => {
    const u = resolvePlayUi(WORLD({ parts, ui: { border: 'covert', pixel: 3 } }), seeded).play.ui;
    expect(u.guide).toMatchObject({ pixel: 3, font: 'mono', sources: { font: 'pixel', pixel: 'operator' } });
    const ok = { ...u, status: Object.fromEntries(UI_ITEMS.map((k) => [k, 'approved'])) };
    const reg = lowerPlay(WORLD({ parts, ui: ok })).register;
    expect(reg).toMatchObject({ border: ['brackets', 'scanlines', 'ticks'], pixel: 3 });
    const page = eventsChannelScript({ hud: lowerParts(parts), register: reg });
    expect(page).toMatch(/font-smoothing:none/);
    expect(page).toMatch(/::before/);
  });

  it('the border sheet is closed words in, CSS out', () => {
    const css = borderCss({ elements: ['ticks', 'x}body{display:none'], pixel: 7 });
    expect(css).not.toMatch(/display:none/);
    expect(css).not.toMatch(/font-smoothing/);
  });
});

describe('shared status, flows and pace: designed on the board first', () => {
  it('owner and audience: each makes one part many; an each part enemies see must mark mine from theirs', () => {
    const plate = { part: 'nameplate', variant: 'name-bar', bind: { var: 'name', of: 'each:player' }, bar: 'hp' };
    expect(readPart(plate)).toMatchObject({ region: 'over', of: 'each:player', audience: 'all', page: false, row: null });
    expect(uiAdvice({ parts: [plate] }).map((a) => a.law)).toEqual(expect.arrayContaining(['owners-apart', 'board-only']));
    expect(uiAdvice({ parts: [{ ...plate, mark: { ally: 'chevron', enemy: 'diamond' } }] }).map((a) => a.law)).not.toContain('owners-apart');
    expect(() => readPart({ part: 'nameplate', bind: { var: 'name' } })).toThrow(/one per entity/);
    expect(() => readPart({ part: 'readout', bind: { var: 'hp', of: 'everyone' } })).toThrow(/each:<tag>/);
    expect(readPart({ part: 'readout', bind: { var: 'score', of: 'team' } })).toMatchObject({ audience: 'team', page: false });
    expect(readPart({ part: 'readout', bind: { var: 'round', of: 'all' } }).page).toBe(true);
  });

  it('flows teach their own fields, and lowering leaves board-only parts out', () => {
    expect(() => readPart({ part: 'forecast', bind: { var: 'food' } })).toThrow(/rate/);
    expect(() => readPart({ part: 'allocator', bind: { var: 'workers' }, into: ['farms'] })).toThrow(/into/);
    expect(() => readPart({ part: 'ledger' })).toThrow(/rows/);
    for (const id of ['ledger', 'forecast', 'trend', 'alerts', 'allocator', 'queue', 'nameplate', 'scoreboard']) expect(lowerParts([PARTS[id].example])).toEqual([]);
  });

  it('pace scales the budgets: a corner of four readouts is over at a glance, fine when studied', () => {
    const play = { parts: [1, 2, 3, 4].map((i) => ({ part: 'readout', bind: { var: `v${i}` } })) };
    const at = (pace) => uiAdvice(play, { guide: { pace } }).filter((a) => a.law === 'region-budget').length;
    expect(at('glance')).toBe(1);
    expect(at('study')).toBe(0);
    expect(resolvePlayUi(WORLD({ parts: [], ui: { pace: 'study' } }), seeded).play.ui.guide).toMatchObject({ pace: 'study', sources: { pace: 'operator' } });
    expect(() => resolvePlayUi(WORLD({ parts: [], ui: { pace: 'slow' } }), seeded)).toThrow(/glance, scan, study/);
  });

  it('a shared world draws a wireframe per phase per view', () => {
    const m = resolvePlayUi(WORLD({ phases: ['fighting'], parts: [PARTS.nameplate.example, PARTS.readout.example], ui: 'propose' }), seeded);
    expect(boardPieceIds(m).filter((id) => id.startsWith('ui:wireframe'))).toEqual(['ui:wireframe:fighting:player', 'ui:wireframe:fighting:spectator']);
    expect(uiBoardHtml(m)).toContain('spectator&#39;s view'.replace('&#39;', "'"));
  });
});

describe('the shooter\'s idioms as parts that read systems', () => {
  it('system parts bind their system by default; readouts may read a system field', () => {
    expect(readPart({ part: 'ammo', variant: 'pips' })).toMatchObject({ from: 'weapon', page: false, row: null });
    expect(readPart({ part: 'feed' })).toMatchObject({ from: 'match', of: 'all', audience: 'all' });
    expect(readPart(PARTS.lock.example)).toMatchObject({ region: 'over', of: 'target', audience: 'self' });
    expect(readPart({ part: 'readout', variant: 'bar', bind: { from: 'body', field: 'hp' } })).toMatchObject({ binds: 'body.hp', page: false });
    expect(() => readPart({ part: 'readout', bind: { from: 'body', field: 'mana' } })).toThrow(/publishes hp/);
    expect(() => readPart({ part: 'ammo', bind: { from: 'lock' } })).toThrow(/weapon/);
    expect(() => readPart({ part: 'reticle', layers: ['halo'] })).toThrow(/core, assist/);
  });

  it('the reticle stands in the centre by right; a reticle without a hitmarker reads hits by colour alone', () => {
    const laws = uiAdvice({ parts: [{ part: 'reticle', at: 'center' }] }).map((a) => a.law);
    expect(laws).not.toContain('centre-is-focus');
    expect(laws).toContain('hit-reads');
    expect(uiAdvice({ parts: [{ part: 'reticle' }, { part: 'hitmarker' }] }).map((a) => a.law)).not.toContain('hit-reads');
  });
});
