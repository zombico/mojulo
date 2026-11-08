/**
 * THE FIGHT — a fighting game's UI, its own language grown from the shared templates (the live fight's bars, meters and
 * combo, idioms-live.js; the moments, the selects, the pause and the results, idioms-front.js and idioms-hud.js), drawn by
 * the same components, sheet and themes as every other screen. Its principles (docs/mana-ui.md, the fight's language):
 *
 *   1. TWO SIDES, ONE CENTRE. Everything mirrors across the centre line: the first fighter's parts on the left, the
 *      second's on the right, its bars filling from the right; each side keyed to its kit (the theme's sides 0 and 1)
 *      and to its tag and name (never a colour alone). The select too: each seat's fighter at its own edge, the roster
 *      between them.
 *   2. HEALTH IS THE FRAME. The two bars own the top edge, meeting at the clock between them, read by their length
 *      (never a number); the guard a thin line under each, the name at its outer end, the rounds won as dots by the
 *      clock, the chip of the last combo hatched.
 *   3. THE FIGHT IS NEVER COVERED. The middle of the screen is the fighters': a side's callouts and combo sit at its own
 *      edge, the meters along the foot; the announcer takes the centre only between exchanges (a round's start, a KO).
 *   4. A CALLOUT IS A WORD. Counter, punish, reversal, parry, a spark: one display word slammed in at its side, weighed (a
 *      spark outweighs a counter), held a moment on the fight's clock, its line the damage; never a sentence.
 *   5. THE RITUAL. A round's words (round n, final round, fight, K.O., time, draw, perfect, a winner) are moments at the
 *      centre, decisive, one at a time, each read before the next.
 *   6. METERS IN STOCKS. The super in segments, a stock a segment; the guard a shield that can be crushed; a burst a mark.
 *   7. THE HIT-STOP HOLDS IT. The game holds the runtime through a hit-stop (rt.hold), so a bar's fall and a callout's
 *      entrance freeze with the blow and land with it.
 *   8. QUIET. The fight's parts sit bare over the round (a bare region: no plate across the screen, each word on its
 *      halo, each bar its own frame); its looks (the theme cards of the family `fight`) never lean, stack, break out
 *      or slam: a fighting game's, never a party game's. The elements do their talking: the frame says no word but
 *      the names, training's readouts carry no headings, a stock is its numeral.
 *   9. PICKED BY THEIR LOOK. The versus screens give each fighter its art at full height at its own side; the select
 *      shows a fighter's style and figures only when the game asks (`stats`).
 *
 * Every word it says is the runtime's (WORDS) or the game's, so a fight ships in every language its game does.
 *
 *   HUD     fight-health (the top frame: tags, portraits, names, rounds, the bars and their chip, the clock and the round),
 *           fight-meters (the foot: super stocks, the guard, the burst, mirrored), fight-combo (a side's combo: hits and
 *           damage, at its edge), fight-callouts (a side's callouts, at its edge), fight-announcer (the round's words at
 *           the centre), input-display (the inputs as they come, training), frame-meter (the frames of the last move,
 *           startup, active and recovery as marks, training), training-stats (the last combo's figures, training)
 *   SCREENS versus-splash (the two fighters face off: portraits, names, tags, the arena; any button goes on),
 *           fighter-select (side against side: each seat's fighter at its own edge, the roster between them),
 *           fight-pause (over the held fight: resume, the command list, training's settings, select, quit; who paused),
 *           command-list (a fighter's moves by kind: each its input and its frame data), training-settings (the dummy,
 *           its guard, counter hits, the boxes, the frame meter, a reset), fight-results (the winner's line and figures,
 *           counting up, then a rematch or what next)
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const W = (key) => ({ word: key });
const txt = (value, role, tone) => ({ use: 'text', props: { value, ...(role ? { role } : {}), ...(tone ? { tone } : {}) } });
const region = (at, children, extra = {}, variant) => ({ use: 'region', props: { at, ...(variant ? { variant } : {}) }, children, ...extra });
const row = (children, align = 'center', gap = 'tight', fill = false) => ({ use: 'stack', props: { dir: 'row', gap, align, ...(fill ? { fill } : {}) }, children });
const col = (children, align, gap = 'tight') => ({ use: 'stack', props: { gap, ...(align ? { align } : {}) }, children });
const screen = (props, children) => ({ use: 'screen', props, children });
const thenList = (rows, more = {}) => ({ use: 'list', props: { rows, ...more }, on: { accept: I('then') } });
const LEGEND_WORD = { pick: 'select', back: 'back', resume: 'resume', change: 'change', tabs: 'tabs' };
const legend = (...rows) => ({ use: 'legend', props: { rows: rows.map(([action, label]) => { const w = W(LEGEND_WORD[label] || label); return Array.isArray(action) ? { actions: action, label: w } : { action, label: w }; }) } });

// a side's tag, its chip in its kit (the theme's side), and its name: whose it is is said, never a colour alone
const tag = (value, side) => ({ use: 'badge', props: { value, variant: 'strong', side } });
// the two fighters' halves of the top frame, mirrored: the bar (read by its length, never a number) running from the
// clock out to its edge, the guard a thin line under it, then the tag and name at the outer end and the rounds won as
// dots at the inner end, by the clock
const healthHalf = (n, rtl) => {
  const k = (f) => P(`p${n}${f}`), dir = rtl ? { dir: 'rtl' } : {};
  const who = row([tag(k('tag'), n - 1), txt(k('name'), 'heading')], rtl ? 'end' : 'start');
  const won = { use: 'pips', props: { value: k('rounds'), max: P('toWin') } };
  return { ...col([
    { use: 'bar', props: { value: k('hp'), max: k('max'), ghost: k('ghost'), variant: 'hp', size: 'large', figures: false, ...dir } },
    { use: 'bar', props: { value: k('guard'), max: P('guardMax'), variant: 'shield', size: 'thin', figures: false, ...dir }, when: P('guardMax') },
    row(rtl ? [won, who] : [who, won], 'apart', 'tight'),
  ]), props: { gap: 'tight', fill: true } };
};
// a side's super along the foot, from its corner: the stocks as segments and their count, the burst a mark beside it
const meterHalf = (n, rtl) => {
  const k = (f) => P(`p${n}${f}`), dir = rtl ? { dir: 'rtl' } : {};
  const sup = { use: 'bar', props: { value: k('super'), max: P('stocks'), segments: P('stocks'), variant: 'xp', figures: false, ...dir } };
  const stocks = txt(k('super'), 'display'), burst = { use: 'pips', props: { value: k('burst'), max: 1, shape: 'diamond' } };
  return row(rtl ? [burst, sup, stocks] : [stocks, sup, burst], rtl ? 'end' : 'start', 'tight');
};
// a side of the select, at its own edge (the first fighter's on the left, the second's on the right): the seat's tag in
// its kit, the fighter its cursor is on large, its name, style and figures; the second side mirrored
const selectSide = (seat, rtl) => {
  const on = (f) => ({ pick: `roster@${seat}.${f}` }), dir = rtl ? { dir: 'rtl' } : {};
  return col([
    { use: 'portrait', props: { name: on('name'), size: 'xl', caption: false } },
    row(rtl ? [txt(on('name'), 'title'), tag(P(`p${seat}tag`), seat - 1)] : [tag(P(`p${seat}tag`), seat - 1), txt(on('name'), 'title')], rtl ? 'end' : 'start'),
    // (who they are by their look first: the style and the figures only when the game shows them)
    { ...col([txt(on('style'), 'label'), { use: 'each', props: { rows: on('stats'), row: { use: 'bar', props: { label: I('label'), value: I('value'), max: I('max'), segments: I('max'), figures: false, ...dir } } } }], rtl ? 'end' : 'start'), when: P('stats') },
  ], rtl ? 'end' : 'start');
};
const f = (path) => ({ bind: `fight.${path}` });

export const FIGHT_IDIOMS = {
  // ── in the fight ──────────────────────────────────────────────────────────────────────────────────────────────────
  'fight-health': {
    kind: 'hud', about: 'the top frame: the two bars meeting at the clock (the second filling from the right, the chip of the last combo hatched, read by length, no numbers), a guard line under each, each fighter\'s tag in its kit and name at its outer end, the rounds it has won as dots by the clock; no words but the names',
    reads: 'p1, p2: { tag, name, hp, hpMax, ghost, guard, rounds }, time, toWin, guardMax (none: no guard line)', emits: '—',
    params: ['p1tag', 'p1name', 'p1hp', 'p1max', 'p1ghost', 'p1guard', 'p1rounds', 'p2tag', 'p2name', 'p2hp', 'p2max', 'p2ghost', 'p2guard', 'p2rounds', 'time', 'toWin', 'guardMax'],
    node: region('top', [row([
      healthHalf(1, false),
      // (the clock the medallion between the bars: a display numeral, the round under it)
      col([txt(P('time'), 'display')], 'center'),
      healthHalf(2, true),
    ], 'center', 'loose', true)], {}, 'bare'),
    example: { p1tag: f('p1.tag'), p1name: f('p1.name'), p1hp: f('p1.hp'), p1max: f('p1.hpMax'), p1ghost: f('p1.ghost'), p1guard: f('p1.guard'), p1rounds: f('p1.rounds'), p2tag: f('p2.tag'), p2name: f('p2.name'), p2hp: f('p2.hp'), p2max: f('p2.hpMax'), p2ghost: f('p2.ghost'), p2guard: f('p2.guard'), p2rounds: f('p2.rounds'), time: f('time'), toWin: f('toWin'), guardMax: f('guardMax') },
  },
  'fight-meters': {
    kind: 'hud', about: 'the foot of the screen: each fighter\'s super from its own corner in stocks (a stock a segment) and its burst, mirrored',
    reads: 'p1, p2: { super, burst }, stocks', emits: '—',
    params: ['p1super', 'p1burst', 'p2super', 'p2burst', 'stocks'],
    node: region('bottom', [row([meterHalf(1, false), meterHalf(2, true)], 'apart', 'loose', true)], {}, 'bare'),
    example: { p1super: f('p1.super'), p1burst: f('p1.burst'), p2super: f('p2.super'), p2burst: f('p2.burst'), stocks: f('stocks') },
  },
  'fight-combo': {
    kind: 'hud', about: 'a side\'s combo while it runs, at that side\'s edge (left for the first fighter, right for the second): the hits as a display numeral, the damage under it; each hit pops it',
    reads: 'at: left | right, hits, damage', emits: '—',
    params: ['at', 'hits', 'damage'],
    node: region(P('at'), [col([row([txt(P('hits'), 'display'), txt(W('hits'), 'label')], 'end'), txt(P('damage'), 'heading', 'hit')], 'center')], { when: P('hits') }, 'bare'),
    example: { at: 'left', hits: f('p1.combo'), damage: f('p1.comboDamage') },
  },
  'fight-callouts': {
    kind: 'hud', about: 'a side\'s callouts at its edge: counter, punish, reversal, parry, a guard crushed, a spark; one word at a time by weight (a spark outweighs a counter), slammed in, held a moment on the fight\'s clock, its line the damage',
    reads: 'at: left | right, calls: [{ id, text, sub?, weight?, tier? }] (the game appends; host.now its clock, held through a hit-stop)', emits: '—',
    params: ['at', 'calls'],
    node: region(P('at'), [{ use: 'moments', props: { rows: P('calls'), as: 'toast', hold: 1.1, read: 0.35 } }]),
    example: { at: 'left', calls: f('p1.calls') },
  },
  'fight-announcer': {
    kind: 'hud', about: 'the round\'s words at the centre, between exchanges: round n, final round, fight, K.O., time, draw, perfect, the winner; decisive, one at a time, each read before the next',
    reads: 'calls: [{ id, text, sub?, weight }] (the game appends; its clock)', emits: '—',
    params: ['calls'],
    node: region('center', [{ use: 'moments', props: { rows: P('calls'), as: 'banner', hold: 1.4, read: 0.7 } }]),
    example: { calls: f('announcer') },
  },
  'input-display': {
    kind: 'hud', about: 'training: the inputs as they come (a direction and its buttons, the frames it was held), the newest on top, a repeat merged (×3)',
    reads: 'inputs: [{ text }] (newest first)', emits: '—',
    params: ['inputs'],
    node: region('left', [{ use: 'feed', props: { rows: P('inputs'), max: 12 } }]),
    example: { inputs: f('training.inputs') },
  },
  'frame-meter': {
    kind: 'hud', about: 'training: the frames of the last exchange, each a mark: startup, active and recovery told by their shape (muted, strong, plain), the advantage at its end',
    reads: 'frames: [{ value, variant }] (variant: muted startup | strong active | plain recovery), advantage', emits: '—',
    params: ['frames', 'advantage'],
    node: region('bottom', [row([txt(P('advantage'), 'heading'), { use: 'each', props: { dir: 'row', rows: P('frames'), row: { use: 'badge', props: { value: I('value'), variant: I('variant') } } } }], 'center')]),
    example: { frames: f('training.frames'), advantage: f('training.advantage') },
  },
  'training-stats': {
    kind: 'hud', about: 'training: the last combo\'s figures (damage, hits, the most it could have done), what changed flashing',
    reads: 'stats: [{ label, value }]', emits: '—',
    params: ['stats'],
    node: region('right', [{ use: 'each', props: { rows: P('stats'), row: { use: 'stat', props: { label: I('label'), value: I('value') } } } }]),
    example: { stats: f('training.stats') },
  },

  // ── around the fight ──────────────────────────────────────────────────────────────────────────────────────────────
  'versus-splash': {
    kind: 'screen', about: 'the two fighters face off before the fight: each one\'s art at full height at its own side with its tag and name, the vs between them, where they fight; any face button goes on (or it goes on its own)',
    reads: 'p1, p2: { tag, name }, arena, prompt, then', emits: 'then',
    params: ['p1tag', 'p1name', 'p2tag', 'p2name', 'arena', 'prompt', 'then'],
    node: screen({ layer: 'overlay', place: 'full', press: 'any', legend: 'auto' }, [
      { use: 'image', props: { label: W('keyArtPlace'), ratio: 'backdrop' } },
      { use: 'stack', props: { align: 'center', gap: 'loose' }, children: [
        row([
          col([{ use: 'portrait', props: { name: P('p1name'), size: 'xl', caption: false } }, row([tag(P('p1tag'), 0), txt(P('p1name'), 'title')], 'start')], 'start'),
          txt(W('vs'), 'display'),
          col([{ use: 'portrait', props: { name: P('p2name'), size: 'xl', caption: false } }, row([txt(P('p2name'), 'title'), tag(P('p2tag'), 1)], 'end')], 'end'),
        ], 'apart', 'loose', true),
        txt(P('arena'), 'heading'),
        { use: 'button', props: { label: P('prompt') }, on: { accept: P('then') } },
      ] },
    ]),
    example: { p1tag: f('p1.tag'), p1name: f('p1.name'), p2tag: f('p2.tag'), p2name: f('p2.name'), arena: f('arena'), prompt: 'Fight', then: { emit: 'fight:go' } },
  },
  'fighter-select': {
    kind: 'screen', about: 'pick fighters, side against side: the first seat\'s fighter at full height at the left edge, the second\'s at the right (mirrored), each with its tag and name (its style and figures only with `stats`); the roster a grid of faces between them, each couch seat its own cursor; a random pick',
    reads: 'roster: [{ id, name, style, stats: [{ label, value, max }] }], seats, p1tag, p2tag, stats (show each side\'s style and figures; off: a fighter is picked by their look)', emits: '{ emit: pick, seat, id } as a seat accepts; fighter:random',
    params: ['title', 'roster', 'seats', 'p1tag', 'p2tag', 'stats'],
    node: screen({ title: P('title'), place: 'full', seats: P('seats') }, [
      row([
        selectSide(1, false),
        col([
          { use: 'grid', id: 'roster', props: { cells: P('roster'), columns: 4, cell: { use: 'portrait', props: { name: I('name'), caption: false } } }, on: { accept: { emit: 'pick', seat: { seat: true }, id: I('id') } } },
          { use: 'button', props: { label: W('random') }, on: { accept: { emit: 'fighter:random', seat: { seat: true } } } },
        ], 'center'),
        selectSide(2, true),
      ], 'apart', 'loose', true),
      legend(['accept', 'pick'], ['back', 'back']),
    ]),
    example: { title: 'Choose your fighter', roster: f('roster'), seats: 2, p1tag: f('p1.tag'), p2tag: f('p2.tag'), stats: false },
  },
  'fight-pause': {
    kind: 'screen', about: 'the pause over the held fight: who paused (in their kit), resume first, then the command list, training\'s settings, the controls, character select, quit; only the seat that paused moves it',
    reads: 'pausedBy: { tag, side }, items: [{ label, then, disabled? }]', emits: 'each item\'s then (back resumes)',
    params: ['title', 'pausedTag', 'pausedSide', 'items'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [col([
      row([tag(P('pausedTag'), P('pausedSide'))], 'center'),
      { use: 'list', id: 'pause', props: { rows: P('items'), variant: 'menu' }, on: { accept: I('then') } },
    ])] }, legend(['accept', 'pick'], ['back', 'resume'])]),
    example: { title: 'Paused', pausedTag: f('pausedBy.tag'), pausedSide: f('pausedBy.side'), items: [{ label: 'Resume', then: { close: true } }, { label: 'Command list', then: { open: 'moves' } }, { label: 'Training settings', then: { open: 'training' } }, { label: 'Character select', then: { emit: 'select' } }, { label: 'Quit', then: { emit: 'quit' } }] },
  },
  'command-list': {
    kind: 'screen', about: 'a fighter\'s moves by kind (tabs: normals, specials, supers, throws): each its name and its input, beside the one in focus\'s frame data (startup, active, recovery, on hit, on block, damage) and what it is for',
    reads: 'kinds: [{ label, moves: [{ name, input, about, data: [{ what, value }] }] }]', emits: '—',
    params: ['title', 'kinds'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [{ use: 'tabs', props: { pages: P('kinds'), page: { use: 'split', children: [
      { use: 'window', children: [{ use: 'list', id: 'moves', props: { rows: I('moves'), row: row([txt(I('name'), 'heading'), { use: 'badge', props: { value: I('input') } }], 'apart') } }] },
      { use: 'window', props: { title: W('frameData') }, children: [col([
        txt({ pick: 'moves.name' }, 'title'), { use: 'badge', props: { value: { pick: 'moves.input' }, variant: 'strong' } }, txt({ pick: 'moves.about' }),
        { use: 'table', props: { columns: [{ key: 'what', label: '' }, { key: 'value', label: W('frames'), align: 'right' }], rows: { pick: 'moves.data' } } },
      ])] },
    ] } } }, legend(['tabNext', 'tabs'], ['back', 'back'])]),
    example: { title: 'Command list', kinds: f('moves') },
  },
  'training-settings': {
    kind: 'screen', about: 'training\'s settings: what the dummy does, how it guards, counter hits, the boxes shown, the frame meter; each a field bound to the var it sets; the positions reset',
    reads: 'fields: [{ kind, label, var, options? }]', emits: '{ set: <var>, to } on each change; training:reset',
    params: ['title', 'fields'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [col([
      { use: 'each', props: { rows: P('fields'), row: { use: 'field', props: { kind: I('kind'), label: I('label'), value: { bind: I('var') }, options: I('options') } } } },
      { use: 'button', props: { label: W('resetPosition') }, on: { accept: { emit: 'training:reset' } } },
    ])] }]),
    example: { title: 'Training', fields: f('training.settings') },
  },
  'fight-results': {
    kind: 'screen', about: 'the end of a match: the winner slams in as a banner, beside their portrait their line; the match\'s figures count up one after another; then a rematch, character select or quit',
    reads: 'outcome, winner: { name, tag, side, quote }, stats: [{ label, value }], items: [{ label, then }]', emits: 'each item\'s then',
    params: ['outcome', 'winner', 'winnerTag', 'winnerSide', 'quote', 'stats', 'items'],
    node: screen({ layer: 'modal', place: 'center' }, [{ use: 'stack', props: { align: 'center', gap: 'loose' }, children: [
      { use: 'banner', props: { value: P('outcome') } },
      row([{ use: 'portrait', props: { name: P('winner'), size: 'xl', caption: false } }, col([tag(P('winnerTag'), P('winnerSide')), txt(P('quote')),
        { use: 'window', children: [{ use: 'each', props: { rows: P('stats'), row: { use: 'stat', props: { label: I('label'), value: I('value'), count: true } } } }] },
        { use: 'window', props: { variant: 'ghost' }, children: [thenList(P('items'), { variant: 'menu' })] }], 'start', 'loose')], 'center', 'loose'),
    ] }]),
    example: { outcome: f('results.outcome'), winner: f('results.winner'), winnerTag: f('results.tag'), winnerSide: f('results.side'), quote: f('results.quote'), stats: f('results.stats'), items: [{ label: 'Rematch', then: { emit: 'rematch' } }, { label: 'Character select', then: { emit: 'select' } }, { label: 'Quit', then: { emit: 'quit' } }] },
  },
};

/** The fight's HUD in the order a fight stacks it: the frame, the foot, each side's combo and callouts, the announcer. */
export const FIGHT_HUD = Object.freeze(['fight-health', 'fight-meters', 'fight-combo', 'fight-callouts', 'fight-announcer']);
/** Training adds its readouts over the fight's own. */
export const TRAINING_HUD = Object.freeze(['input-display', 'frame-meter', 'training-stats']);
