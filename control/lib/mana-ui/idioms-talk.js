/**
 * TALK — the ways a game shows people talking, as presenters: one script (a scene's lines and choices, said by the
 * host), drawn as the game asks. Each presenter is a HUD part: it reads what is said now and emits nothing; the host
 * owns the clock (the words typed on so far), the input and the answer.
 *
 *   talk-box   the box at the foot of the screen: the speaker's nameplate (the window's title: a heading, or a tab across
 *              its edge under a `breakout: tab` theme), a face's place beside the words when there is a face, the line
 *              as typed so far, ▼ once it is whole, the choices numbered with the one in hand marked, and the legend
 *
 * The state it reads: show, who, face (a face's name: its place is drawn only when given), text, more (the line is whole
 * and waits for a press), choices: [{ n, say, mark }] (mark: ▶ on the one in hand, ▷ on the others), legend: [{ action |
 * actions, label }].
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const row = (children, gap = 'tight') => ({ use: 'stack', props: { dir: 'row', gap, align: 'start' }, children });
const col = (children, gap = 'tight') => ({ use: 'stack', props: { gap }, children });

export const TALK_IDIOMS = {
  'talk-box': {
    kind: 'hud', about: 'someone speaks at the foot of the screen: their nameplate, their face, the line typed on, ▼ once it is whole, the answers numbered with the one in hand marked, and what the buttons do (bottom)',
    reads: 'show, who, face?, text, more, choices: [{ n, say, mark }], legend: [{ action | actions, label }]', emits: '—',
    params: ['show', 'who', 'face', 'text', 'more', 'choices', 'legend'],
    node: { use: 'region', props: { at: 'bottom', variant: 'bare' }, when: P('show'), children: [
      { use: 'window', props: { title: P('who') }, children: [col([
        row([
          { use: 'portrait', props: { name: P('face'), size: 'l', caption: false }, when: P('face') },
          col([
            txt(P('text')),
            { use: 'each', props: { rows: P('choices'), row: row([txt(I('mark'), 'label'), txt(I('n'), 'label'), txt(I('say'))]) } },
          ], 'normal'),
        ], 'loose'),
        // (the foot: ▼ once the line is whole, then what the buttons do, at the window's right)
        { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'end' }, children: [{ ...txt('▼', 'label'), when: P('more') }, { use: 'legend', props: { rows: P('legend') } }] },
      ], 'normal')] },
    ] },
    example: { show: { bind: 'speech.show' }, who: { bind: 'speech.who' }, face: { bind: 'speech.face' }, text: { bind: 'speech.text' }, more: { bind: 'speech.more' }, choices: { bind: 'speech.choices' }, legend: { bind: 'speech.legend' } },
  },
};
