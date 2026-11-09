/**
 * MANA-UI's BRAWLER SHELF — a beat-'em-up's own readouts, its practice room's first: what a brawler is learned by, SPACE
 * and CROWDS, never a fighting game's frames. Each is a composition of the components, reading what the game hands it.
 *
 *   line-marks    at each body's feet: how far across the street it stands from you, lined up (a blow lands) or not
 *   token-marks   over the heads of the crowd that may close in now (the attack tokens): who swings next
 *   chain-beats   the chain's blows as marks, each lit as it lands; how the last one ended (the finisher, or dropped and why)
 *   clinch-meter  holding a body: the hold's time running out, the knees left, from behind (the suplex)
 *   press-log     each press and its verdict, newest at the foot: taken (how many frames late) or dropped, and why
 *
 * The fight's `input-display` and `command-list` are shared (a brawler's buttons and its move list run through them);
 * the rest of the fight's shelf is the fight's.
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role, tone) => ({ use: 'text', props: { value, ...(role ? { role } : {}), ...(tone ? { tone } : {}) } });
const region = (at, children, variant) => ({ use: 'region', props: { at, ...(variant ? { variant } : {}) }, children });
const row = (children, align = 'center', gap = 'tight') => ({ use: 'stack', props: { dir: 'row', gap, align }, children });
const col = (children, align, gap = 'tight') => ({ use: 'stack', props: { gap, ...(align ? { align } : {}) }, children });
const b = (path) => ({ bind: `brawl.${path}` });

export const BRAWL_IDIOMS = {
  'line-marks': {
    kind: 'hud', about: 'at each body\'s feet, how far across the street it stands from you and whether a blow can land: lined up or off the line (the line a blow must share, the brawler\'s first lesson)',
    reads: 'marks: [{ id, x, y, text, kind }] (x, y its feet on the screen, 0 to 1; kind: lined | off)', emits: '—',
    params: ['marks'],
    node: { use: 'anchors', props: { variant: 'bare', rows: P('marks'), row: txt(I('text'), 'caption', I('kind')) } },
    example: { marks: b('practice.marks') },
  },
  'token-marks': {
    kind: 'hud', about: 'over the heads of the crowd that may close in now (the attack tokens): the next to swing, marked; the rest are waiting their turn on the ring',
    reads: 'heads: [{ id, x, y }] (x, y over its head on the screen, 0 to 1)', emits: '—',
    params: ['heads'],
    node: { use: 'anchors', props: { variant: 'bare', rows: P('heads'), row: txt('!', 'numeral', 'crit') } },
    example: { heads: b('practice.heads') },
  },
  'chain-beats': {
    kind: 'hud', about: 'the chain\'s blows as marks, each lit as it lands, and how the last chain ended: the finisher, or dropped and why (it missed, too late, reeling)',
    reads: 'beats: [{ value, variant }] (strong a blow landed, muted one still to come), ended: words', emits: '—',
    params: ['beats', 'ended'],
    node: region('left', [col([
      row([{ use: 'each', props: { dir: 'row', rows: P('beats'), row: { use: 'badge', props: { value: I('value'), variant: I('variant') } } } }], 'start'),
      txt(P('ended'), 'caption'),
    ], 'start')]),
    example: { beats: b('practice.beats'), ended: b('practice.ended') },
  },
  'clinch-meter': {
    kind: 'hud', about: 'holding a body: the hold\'s time running out before it breaks free, the knees left, and when it was taken from behind, the suplex',
    reads: 'left, of (frames), knees, behind (words, empty when not)', emits: '—',
    params: ['left', 'of', 'knees', 'behind', 'holding'],
    node: { ...region('top', [col([
      { use: 'bar', props: { value: P('left'), max: P('of'), variant: 'stamina', figures: false } },
      row([{ use: 'pips', props: { value: P('knees'), max: 3 } }, txt(P('behind'), 'label')], 'center'),
    ], 'center')]), when: P('holding') },
    example: { left: b('practice.clinch.left'), of: b('practice.clinch.of'), knees: b('practice.clinch.knees'), behind: b('practice.clinch.behind'), holding: b('practice.clinch.holding') },
  },
  'press-log': {
    kind: 'hud', about: 'each press and its verdict, the newest at the foot: taken (frames late) or dropped, and why, so a missed chain or a lost press says what went wrong',
    reads: 'presses: [{ press, verdict, kind }] (kind: taken | dropped)', emits: '—',
    params: ['presses'],
    node: region('right', [{ use: 'each', props: { rows: P('presses'), row: row([{ use: 'badge', props: { value: I('press') } }, txt(I('verdict'), 'caption', I('kind'))], 'start') } }], 'bare'),
    example: { presses: b('practice.presses') },
  },
};

/** The practice room's HUD parts. */
export const BRAWL_PRACTICE_HUD = Object.freeze(['line-marks', 'token-marks', 'chain-beats', 'clinch-meter', 'press-log']);
