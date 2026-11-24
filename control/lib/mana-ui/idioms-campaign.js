/**
 * THE ACTION CAMPAIGN — the screens and HUD parts a campaign of missions shares (a space combat sim's tour, a squad's
 * war): the tour of missions, the briefing told one step at a time over a map the game draws behind it, the place the
 * mission is fought named widest first, the roster of who is in it, and the debrief that moves the tour on. Each is a def
 * over the components (data); the map behind the briefing is the game's (a holo table, a plan), never this shelf's.
 *
 *   place-banner     the place along the top, widest first (a system, a cluster, a station, a moon), the part the
 *                    briefing is on said strongest, the design's state beside it
 *   flight-roster    who is in the mission, by side: each group's name, its craft and its count, the ones the step is
 *                    about lit and the rest quiet (right)
 *   briefing-steps   the briefing, one step at a time over the game's map: which step of how many, its title and its
 *                    line, back, next and launch (launch once the last step is reached), and the steps so far to jump to
 *   campaign-tour    the tour: its missions in order, each flown, open or locked, the one in focus beside it (its place,
 *                    its brief, its record)
 *   mission-debrief  the mission over: the outcome, the place, each goal met or failed, the figures, a medal stamped
 *                    on, then on with the tour
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const row = (children, align = 'start', gap = 'tight') => ({ use: 'stack', props: { dir: 'row', gap, align }, children });
const col = (children, gap = 'tight') => ({ use: 'stack', props: { gap }, children });
const thenList = (rows, row, more = {}) => ({ use: 'list', props: { rows, row, ...more }, on: { accept: I('then') } });

export const CAMPAIGN_IDIOMS = {
  'place-banner': {
    kind: 'hud', about: 'where the mission is, widest first along the top (a system, a cluster, a station, a moon), the part the briefing is on said strongest and the ones it has not reached quiet; the design\'s state (a draft, approved) beside it',
    reads: 'parts: [{ name, first?, now?, ahead? }], state', emits: '—',
    params: ['parts', 'state'],
    node: { use: 'region', props: { at: 'top', variant: 'scrim' }, children: [row([
      { use: 'each', props: { dir: 'row', rows: P('parts'), row: row([
        { use: 'text', props: { value: '|', role: 'caption' }, unless: I('first') },
        { use: 'text', props: { value: I('name'), role: 'heading' }, when: I('now') },
        { use: 'text', props: { value: I('name'), role: 'caption' }, when: I('ahead') },
        { use: 'stack', unless: I('now'), children: [{ use: 'text', props: { value: I('name'), role: 'label' }, unless: I('ahead') }] },
      ], 'center') } },
      { use: 'badge', props: { value: P('state'), variant: 'muted' }, when: P('state') },
    ], 'center', 'normal')] },
    example: { parts: { bind: 'campaign.place' }, state: { bind: 'campaign.state' } },
  },
  'flight-roster': {
    kind: 'hud', about: 'who is in the mission, by side: each group\'s name, its craft and how many, the ones the briefing\'s step is about lit and the rest quiet (right)',
    reads: 'title, rows: [{ name, craft, count, side (0 yours, 1 theirs, 2 neither), lit? }]', emits: '—',
    params: ['title', 'rows'],
    node: { use: 'region', props: { at: 'right' }, children: [col([
      txt(P('title'), 'label'),
      { use: 'each', props: { rows: P('rows'), row: row([
        { use: 'badge', props: { value: I('count'), side: I('side'), variant: 'strong' } },
        col([
          { use: 'text', props: { value: I('name'), role: 'heading' }, when: I('lit') },
          { use: 'text', props: { value: I('name'), role: 'caption' }, unless: I('lit') },
          { use: 'text', props: { value: I('craft'), role: 'caption' }, when: I('lit') },
        ]),
      ], 'center') } },
    ])] },
    example: { title: 'Flight groups', rows: { bind: 'campaign.roster' } },
  },
  'briefing-steps': {
    kind: 'screen', about: 'the briefing told one step at a time over the game\'s map (drawn behind it, never by it): which step of how many, its title and the officer\'s line, back and next, launch once the last step is reached; below, the steps so far, any one jumped back to; the screen\'s own back steps back',
    reads: 'kicker, title, say, step, count, ready, go (the launch button\'s words), steps: [{ title, mark, then }]; prev, next, launch, back: what each does', emits: 'prev, next, launch, back, and the picked step\'s then',
    params: ['kicker', 'title', 'say', 'step', 'count', 'ready', 'go', 'steps', 'prev', 'next', 'launch', 'back'],
    node: { use: 'screen', props: { layer: 'overlay', place: 'left' }, on: { back: P('back') }, children: [{ use: 'window', children: [col([
      row([txt(P('kicker'), 'caption'), { use: 'pips', props: { value: P('step'), max: P('count') } }], 'apart'),
      txt(P('title'), 'title'),
      txt(P('say')),
      // (next first: the cursor rests on going on, and accept moves through the briefing)
      row([
        { use: 'button', props: { label: { word: 'continue' } }, unless: P('ready'), on: { accept: P('next') } },
        { use: 'button', props: { label: P('go') }, when: P('ready'), on: { accept: P('launch') } },
        { use: 'button', props: { label: { word: 'back' } }, on: { accept: P('prev') } },
      ], 'start', 'normal'),
      { use: 'divider' },
      thenList(P('steps'), row([txt(I('mark'), 'caption'), txt(I('title'), 'label')], 'center')),
    ], 'normal')] }] },
    example: { kicker: { bind: 'campaign.brief.kicker' }, title: { bind: 'campaign.brief.title' }, say: { bind: 'campaign.brief.say' }, step: { bind: 'campaign.brief.step' }, count: { bind: 'campaign.brief.count' }, ready: { bind: 'campaign.brief.ready' }, go: { bind: 'campaign.brief.go' }, steps: { bind: 'campaign.brief.steps' }, prev: { emit: 'brief:prev' }, next: { emit: 'brief:next' }, launch: { emit: 'brief:launch' }, back: { back: true } },
  },
  'campaign-tour': {
    kind: 'screen', about: 'the tour of duty: its missions in order, each flown (its medal), open or locked (said, never hidden), the one in focus beside it with its place, its brief and its record',
    reads: 'title, record (its label), missions: [{ name, place, brief, state, record, then, disabled? }]', emits: 'the picked mission\'s then',
    params: ['title', 'record', 'missions'],
    node: { use: 'screen', props: { title: P('title'), place: 'full' }, children: [{ use: 'split', children: [
      { use: 'window', children: [{ use: 'list', id: 'tour', props: { rows: P('missions'), row: row([txt(I('name'), 'heading'), { use: 'badge', props: { value: I('state') } }], 'apart') }, on: { accept: I('then') } }] },
      { use: 'window', children: [col([txt({ pick: 'tour.name' }, 'title'), txt({ pick: 'tour.place' }, 'caption'), txt({ pick: 'tour.brief' }), { use: 'stat', props: { label: P('record'), value: { pick: 'tour.record' } } }], 'normal')] },
    ] }, { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } }] },
    example: { title: 'Tour of duty', record: 'Record', missions: { bind: 'campaign.missions' } },
  },
  'mission-debrief': {
    kind: 'screen', about: 'the mission over, in sequence: the outcome slams in, where it was, each goal met or failed, the figures counting up, a medal stamped on, then on with the tour (the next mission, again, the tour)',
    reads: 'outcome, place, goals: [{ text, met }], stats: [{ label, value }], medal, items: [{ label, then }]', emits: 'each item\'s then',
    params: ['outcome', 'place', 'goals', 'stats', 'medal', 'items'],
    node: { use: 'screen', props: { layer: 'modal', place: 'center' }, children: [col([
      { use: 'banner', props: { value: P('outcome') } },
      txt(P('place'), 'caption'),
      { use: 'window', children: [col([
        { use: 'each', props: { rows: P('goals'), row: row([{ use: 'text', props: { value: '✓' }, when: I('met') }, { use: 'text', props: { value: '✕' }, unless: I('met') }, txt(I('text'), 'label')]) } },
        { use: 'divider' },
        { use: 'each', props: { rows: P('stats'), row: { use: 'stat', props: { label: I('label'), value: I('value'), count: true } } } },
        row([txt({ word: 'rank' }, 'heading'), { use: 'badge', props: { value: P('medal'), variant: 'stamp' } }], 'apart'),
      ])] },
      { use: 'window', props: { variant: 'ghost' }, children: [thenList(P('items'), txt(I('label'), 'heading'), { variant: 'menu' })] },
    ], 'loose')] },
    example: { outcome: { bind: 'campaign.debrief.outcome' }, place: { bind: 'campaign.debrief.place' }, goals: { bind: 'campaign.debrief.goals' }, stats: { bind: 'campaign.debrief.stats' }, medal: { bind: 'campaign.debrief.medal' }, items: [{ label: 'Next mission', then: { emit: 'next' } }, { label: 'Fly it again', then: { emit: 'again' } }, { label: 'The tour', then: { emit: 'tour' } }] },
  },
};
