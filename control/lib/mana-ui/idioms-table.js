/**
 * THE TABLE'S IDIOMS — a board game's own language (shelf `table`): what sits round the board while it is played. The
 * board, its cells and its pieces are the game's world, picked through the controls layer; these are the parts over
 * it, drawn by the same components, sheet and theme as every other screen.
 *
 * Its principles:
 *   1. The board is never covered. The seats ride its top edge, the hand its foot, the log a side; a question takes
 *      the centre only while it is being asked.
 *   2. Whose turn it is is a shape and a place (the seat alight, a bar at its edge), never a colour alone; a seat's
 *      kit is a chip beside its name.
 *   3. One question at a time: a promotion, a discard, a bid, a target. Back leaves it only where the game lets a
 *      choice be put off (`cancel`).
 *   4. The hand is at the foot, in reach: what can be played now has an edge alight, what is picked is lifted, what
 *      is spent lies on its side, what is hidden is a back and a count.
 *   5. History is kept, never in the way: the log shows its end and counts the rest.
 *   6. What cannot be done says why, where it is.
 *
 *   in play   seat-plates (coverage: a covered table's seats are its broadcast's), card-hand, card-row (a market, a
 *             supply, a tableau), action-bar (the prompt and what can be done now), game-log
 *   asked     choice-prompt (one question, a few answers), trade-offer (what you give for what you get)
 *   after     table-results (the places by points, ties sharing a place)
 *
 * The pause over a table is the front's `pause-menu` (resume, a new game, undo, the level, the rules).
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const region = (at, children, extra = {}) => ({ use: 'region', props: { at }, children, ...extra });
const row = (children, align = 'center', gap = 'tight') => ({ use: 'stack', props: { dir: 'row', gap, align }, children });
const col = (children, align) => ({ use: 'stack', props: { gap: 'tight', ...(align ? { align } : {}) }, children });
const screen = (props, children, extra = {}) => ({ use: 'screen', props, children, ...extra });
const card = (more = {}) => ({ use: 'card', props: { name: I('name'), cost: I('cost'), text: I('text'), tags: I('tags'), power: I('power'), guard: I('guard'), count: I('count'), side: I('side'), state: I('state'), face: I('face'), ...more }, on: { accept: I('then') } });

export const TABLE_IDIOMS = {
  'seat-plates': {
    kind: 'hud', coverage: true, about: 'the seats along the board\'s top edge: each its kit\'s chip and name, a note (what it has taken, who plays it), its score and its clock; the seat to play alight',
    reads: 'seats: [{ name, side, turn?, note?, score?, clock? }] (a score that rose pops; the seat whose turn it is carries turn: true)', emits: '—',
    params: ['seats'],
    node: region('top', [{ use: 'each', props: { dir: 'row', rows: P('seats'), row: row([{ use: 'badge', props: { value: I('name'), side: I('side'), turn: I('turn') } }, txt(I('note'), 'caption'), txt(I('score'), 'numeral'), txt(I('clock'), 'label')], 'center', 'normal') } }]),
    example: { seats: { bind: 'table.seats' } },
  },
  'card-hand': {
    kind: 'hud', about: 'your hand along the foot: each card\'s face, what can be played now an edge alight; a tap plays it',
    reads: 'cards: [{ id, name, cost?, text?, tags?, power?, guard?, count?, side?, state?: playable | picked | spent, then? }]', emits: 'a card\'s then',
    params: ['cards'],
    node: region('bottom', [{ use: 'each', props: { dir: 'row', rows: P('cards'), row: card() } }]),
    example: { cards: { bind: 'table.hand' } },
  },
  'card-row': {
    kind: 'hud', about: 'cards laid out to be taken or read: a market, a supply\'s piles with their counts, a tableau, another seat\'s cards face down; at the place the game names',
    reads: 'title, cards: [{ id, name, cost?, text?, count?, face?: down, state?, then? }], at (a screen place)', emits: 'a card\'s then',
    params: ['title', 'cards', 'at'],
    node: { use: 'region', props: { at: P('at') }, children: [col([txt(P('title'), 'heading'), { use: 'each', props: { dir: 'row', rows: P('cards'), row: card({ size: 's' }) } }])] },
    example: { title: 'Market', cards: { bind: 'table.market' }, at: 'left' },
  },
  'action-bar': {
    kind: 'hud', about: 'what the game asks of you now and what can be done about it: the prompt, then each action on its key (roll, build, end the turn); one that cannot be done says why',
    reads: 'prompt, actions: [{ name, key?, count?, active?, disabled?, why?, then }]', emits: 'an action\'s then',
    params: ['prompt', 'actions'],
    node: region('bottom-right', [col([txt(P('prompt'), 'heading'), { use: 'each', props: { dir: 'row', rows: P('actions'), row: col([{ use: 'slot', props: { name: I('name'), key: I('key'), count: I('count'), active: I('active'), disabled: I('disabled'), why: I('why') }, on: { accept: I('then') } }, txt(I('name'), 'caption')], 'center') } }])]),
    example: { prompt: { bind: 'table.prompt' }, actions: { bind: 'table.actions' } },
  },
  'game-log': {
    kind: 'hud', about: 'the game so far, kept: every move numbered, its seat\'s chip beside it, the newest last and the rest counted',
    reads: 'rows: [{ text, side? }], visible', emits: '—',
    params: ['rows', 'visible'],
    node: region('right', [col([txt({ word: 'log' }, 'heading'), { use: 'log', props: { rows: P('rows'), numbered: true, visible: P('visible') } }])]),
    example: { rows: { bind: 'table.log' }, visible: 6 },
  },
  'choice-prompt': {
    kind: 'screen', about: 'one question and its answers (promote to which piece, discard which, bid how much, aim at whom): the answers in a grid; back leaves only where the game lets the choice be put off',
    reads: 'title, ask, choices: [{ id, label, disabled?, why?, then }], columns, cancel (what back does; none: back does nothing)', emits: 'the answer\'s then; cancel on back',
    params: ['title', 'ask', 'choices', 'columns', 'cancel'],
    node: screen({ layer: 'modal', place: 'center' }, [{ use: 'window', props: { title: P('title') }, children: [{ use: 'stack', children: [txt(P('ask')), { use: 'grid', id: 'choice', props: { cells: P('choices'), columns: P('columns') }, on: { accept: I('then') } }] }] }], { on: { back: [P('cancel')] } }),
    example: { title: 'Promotion', ask: 'The pawn reaches the last rank.', choices: { bind: 'table.choices' }, columns: 4 },
  },
  'trade-offer': {
    kind: 'screen', about: 'an offer across the table: what you give and what you get, each a count you turn, and the offer itself, which says why when it cannot be made',
    reads: 'title, give, get: [{ label, var, max }] (each row bound to the var it sets), invalid, why, then', emits: '{ set: <var>, to } as a count turns; then on the offer',
    params: ['title', 'give', 'get', 'invalid', 'why', 'then'],
    node: screen({ title: P('title'), layer: 'modal', place: 'center' }, [{ use: 'window', children: [{ use: 'stack', children: [
      row([
        col([txt({ word: 'give' }, 'heading'), { use: 'each', props: { rows: P('give'), row: { use: 'slider', props: { label: I('label'), value: { bind: I('var') }, max: I('max') } } } }]),
        col([txt({ word: 'get' }, 'heading'), { use: 'each', props: { rows: P('get'), row: { use: 'slider', props: { label: I('label'), value: { bind: I('var') }, max: I('max') } } } }]),
      ], 'start', 'loose'),
      { use: 'button', props: { label: { word: 'offer' }, disabled: P('invalid'), why: P('why') }, on: { accept: P('then') } },
    ] }] }]),
    example: { title: 'Trade', give: { bind: 'table.trade.give' }, get: { bind: 'table.trade.get' }, invalid: { bind: 'table.trade.invalid' }, why: { bind: 'table.trade.why' }, then: { emit: 'offer' } },
  },
  'table-results': {
    kind: 'screen', about: 'the game\'s end: the outcome and why, then the places by points (ties share a place), each seat in its kit, yours marked; then what next',
    reads: 'outcome, why, places: [{ id, place, name, score, side, self? }], items: [{ label, then }]', emits: 'each item\'s then',
    params: ['outcome', 'why', 'places', 'items'],
    node: screen({ layer: 'modal', place: 'center' }, [{ use: 'stack', props: { align: 'center', gap: 'loose' }, children: [
      { use: 'banner', props: { value: P('outcome'), sub: P('why') } },
      { use: 'window', children: [{ use: 'table', props: { columns: [{ key: 'place', label: { word: 'rank' } }, { key: 'name', label: { word: 'players' } }, { key: 'score', label: { word: 'score' }, align: 'right' }], rows: P('places') } }] },
      { use: 'window', props: { variant: 'ghost' }, children: [{ use: 'list', props: { rows: P('items'), variant: 'menu' }, on: { accept: I('then') } }] },
    ] }]),
    example: { outcome: { bind: 'table.results.outcome' }, why: { bind: 'table.results.why' }, places: { bind: 'table.results.places' }, items: [{ label: 'See the board', then: { close: true } }, { label: 'Play again', then: { emit: 'again' } }] },
  },
};
