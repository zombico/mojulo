/**
 * THE RPG's UI ON MANA-UI — what a party battle, the party menu and a shop show, as a mana-ui spec (data: screens and a
 * HUD of components, control/lib/mana-ui/), and the sheet they are drawn in. The page's RPG channel
 * (scene/channels/rpg-channel.js) is the host: it reads the battle kernel's state to the spec through bindings and
 * answers the effects the spec emits; mana-ui owns the screen's state (each list's row, the open tab, the stack: a
 * command, then a skill, then a target, one back apart) and the look (the theme: the world's guide, else the console
 * preset); the controls layer's mana-host drives it from the menu scheme. Nothing here names a key or a colour.
 *
 *   THE HUD (while a fight is up): a bar over each fighter's head, a member's and a foe's (HP, MP, statuses, the one
 *     picking marked, the target in focus marked), up on the player's turn and, while a round plays, over one whose
 *     numbers just moved (the host says which: battle.heads); the numbers where blows land (each its own, rising once);
 *     the message line. No foes' box and no turn order.
 *   THE SCREENS (one up at a time; back steps out of each):
 *     rpg-cmd · rpg-skill · rpg-item · rpg-target   the member's commands, then what it chose, then whom; back from the
 *                                                   commands is the member before (`undo`); the window beside the
 *                                                   member's bar while it is on the screen (battle.beside), else in a
 *                                                   corner (battle.cmdAt)
 *     rpg-watch                                     a round playing out: accept skips ahead (`next`), a long film cut
 *     rpg-party · rpg-equip                         the party menu (Status, Class, Equip, Skills, Item, Formation in tabs), a
 *                                                   slot's choices
 *     rpg-shop                                      a shop's tabs (Buy, Sell, Stay), the party and the gold beside them
 *
 *   EFFECTS the host answers (never the bus's: the host says on the bus what came of them): { emit: command | skill |
 *   item | target, id }, { emit: undo }, { emit: next }, { emit: class, member, cls }, { emit: slot, member, slot },
 *   { emit: equip, item }, { emit: learn, member, skill }, { emit: use, member, item },
 *   { emit: swap, member, with }, { emit: deal, kind: buy | sell | stay, item }
 *
 *   RPG_SCREENS              the screen ids
 *   rpgUiSpec()              → the spec (readSpec reads it): its screens, its HUD, its lens (the screen round a figure)
 *   rpgUiTheme(cfg)          → the theme a fight is dressed in: the world's guide lowered (cfg.theme), else 'console'
 *   rpgUiCss(theme)          → the sheet: mana-ui's, the theme over it, and the channel's own few rules (the flash, the
 *                            window's jolt, the level's HUD stepping aside during a fight)
 */
import { manaUi } from '../../../mana-ui/kernel.js';
import { manaCss, lensCss } from '../../../mana-ui/css.js';
import { themeCss, readTheme } from '../../../mana-ui/theme.js';

export const RPG_SCOPE = '.moj-rpg .mana-root';
export const RPG_SCREENS = Object.freeze(['rpg-watch', 'rpg-cmd', 'rpg-skill', 'rpg-item', 'rpg-target', 'rpg-party', 'rpg-equip', 'rpg-shop']);

const B = (path) => ({ bind: path });
const I = (field) => ({ item: field });
const K = (path) => ({ pick: path });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const row = (children, align = 'apart') => ({ use: 'stack', props: { dir: 'row', gap: 'tight', align }, children });
const col = (children, gap = 'tight') => ({ use: 'stack', props: { gap }, children });
// (the target in focus, while one is being chosen: the row whose own id the picked target's `aim` names)
const aimed = { use: 'stack', when: B('battle.aiming'), children: [{ use: 'badge', props: { value: '▼', variant: 'strong' }, when: K({ format: 'targets.aim.{id}' }) }] };
// a list's row: its words, what it costs or holds beside them
const line = row([row([txt(I('label')), { use: 'text', props: { value: I('small'), role: 'caption' }, when: I('small') }], 'start'), txt(I('right'), 'numeral')]);
const legend = (rows) => ({ use: 'legend', props: { rows } });

// ── the battle's HUD ──
const HEAD = col([
  aimed,
  { use: 'badge', props: { value: '▼', turn: true }, when: I('turn') },
  { use: 'statuses', props: { rows: I('statuses') }, when: I('statuses') },
  { use: 'bar', props: { value: I('hp'), max: I('hpMax'), variant: 'hp' }, unless: I('foe') },
  // (a foe's HP the same bar, its numbers kept back, where the book shows foes' HP: rules.foeHp 'bar')
  { use: 'bar', props: { value: I('hp'), max: I('hpMax'), variant: 'hp', numbers: false }, when: I('foeBar') },
  { use: 'bar', props: { value: I('mp'), max: I('mpMax'), variant: 'mp' }, when: I('mpMax') },
]);
// (no foes' box and no turn order: each fighter's bar over their own head says it, a foe's as a member's)
const HUD = { use: 'hud', when: B('battle.on'), children: [
  // (up whenever the numbers are: the host keeps them to the player's turn, and to news while a round plays)
  { use: 'anchors', when: B('battle.numbers'), props: { rows: B('battle.heads'), row: HEAD } },
  { use: 'anchors', when: B('battle.numbers'), props: { rows: B('battle.pops'), pass: true, row: row([txt(I('value'), I('role')), { use: 'text', props: { value: I('kind'), role: 'caption' }, when: I('kind') }], 'center') } },
  { use: 'region', props: { at: 'top' }, when: B('battle.told'), children: [txt(B('battle.message'), 'heading')] },
] };

// ── the screens ──
// a member's list: its commands, then a skill or an item, then a target: BESIDE the member's own bar while it is on the
// screen (battle.beside, the host's place for it, kept clear of the screen's bottom), so the one acting is seen whole;
// else in the corner the view leaves clear
const pick = (rows, verb, extra = {}) => {
  const win = { use: 'window', props: { title: B('battle.title') }, children: [
    { use: 'list', ...(verb === 'target' ? { id: 'targets' } : {}), props: { rows, empty: '—', row: line }, on: { accept: { emit: verb, id: I('id') } } },
  ] };
  return { use: 'screen', props: { layer: 'overlay', place: 'full' }, ...extra, children: [
    // (bare: no anchor's plate round the window, held in a stack so the window keeps its own)
    { use: 'anchors', when: B('battle.beside'), props: { variant: 'bare', rows: B('battle.besideAt'), row: col([win]) } },
    { use: 'region', unless: B('battle.beside'), props: { at: B('battle.cmdAt') }, children: [win] },
  ] };
};
const SCREENS = {
  // (a round playing: nothing to pick; accept skips ahead, or cuts a long film short)
  'rpg-watch': { use: 'screen', props: { layer: 'overlay', place: 'full' }, on: { back: [] }, children: [
    { use: 'region', props: { at: 'bottom-right' }, children: [{ use: 'button', props: { label: B('battle.next') }, on: { accept: { emit: 'next' } } }] },
  ] },
  'rpg-cmd': pick(B('battle.commands'), 'command', { on: { back: { emit: 'undo' } } }),
  'rpg-skill': pick(B('battle.skills'), 'skill'),
  'rpg-item': pick(B('battle.items'), 'item'),
  'rpg-target': pick(B('battle.targets'), 'target'),
  'rpg-party': { use: 'screen', props: { title: 'Party', layer: 'modal', place: 'center' }, children: [
    { use: 'split', children: [
      { use: 'window', children: [
        { use: 'list', id: 'members', props: { rows: B('party.members'), row: col([row([txt(I('name'), 'heading'), txt({ format: 'Lv {level}' }, 'numeral')]), { use: 'bar', props: { label: 'HP', value: I('hp'), max: I('hpMax'), variant: 'hp' } }]) } },
        { use: 'counter', props: { label: 'Gold', value: B('party.gold'), icon: 'gold' } },
      ] },
      { use: 'window', children: [{ use: 'tabs', children: [
        { use: 'tab', props: { label: 'Status' }, children: [col([
          txt(K('members.title'), 'heading'),
          { use: 'each', props: { rows: K('members.stats'), row: { use: 'stat', props: { label: I('label'), value: I('value'), max: I('max') } } } },
          { use: 'divider', props: { label: 'Skills' } }, txt(K('members.skills'), 'caption'),
          { use: 'divider', props: { label: 'Worn' } }, txt(K('members.worn'), 'caption'),
        ])] },
        { use: 'tab', props: { label: 'Class' }, children: [{ use: 'list', props: { rows: K('members.classes'), row: line }, on: { accept: { emit: 'class', member: K('members.id'), cls: I('id') } } }] },
        { use: 'tab', props: { label: 'Equip' }, children: [{ use: 'list', props: { rows: K('members.slots'), row: line }, on: { accept: [{ emit: 'slot', member: K('members.id'), slot: I('id') }, { open: 'rpg-equip' }] } }] },
        { use: 'tab', props: { label: 'Skills' }, children: [col([txt(K('members.points'), 'label'), { use: 'list', props: { rows: K('members.tree'), empty: 'No skills on this class', row: line }, on: { accept: { emit: 'learn', member: K('members.id'), skill: I('id') } } }])] },
        // (a battle item from the bag, on the member in focus, or on all the party: `all`)
        { use: 'tab', props: { label: 'Item' }, children: [{ use: 'list', props: { rows: K('members.items'), empty: 'Nothing to use', row: line }, on: { accept: { emit: 'use', member: K('members.id'), item: I('id') } } }] },
        // (the member in focus traded for the one picked: the order fought in, the first of it fighting)
        { use: 'tab', props: { label: 'Formation' }, children: [{ use: 'list', props: { rows: K('members.formation'), row: line }, on: { accept: { emit: 'swap', member: K('members.id'), with: I('id') } } }] },
      ] }] },
    ] },
    { use: 'text', props: { value: B('party.said'), role: 'caption' }, when: B('party.said') },
    legend([{ actions: ['tabPrev', 'tabNext'], label: 'tabs' }, { actions: ['left', 'right'], label: 'list / detail' }, { action: 'back', label: 'close' }]),
  ] },
  'rpg-equip': { use: 'screen', props: { title: B('party.slot'), layer: 'modal', place: 'center' }, children: [
    { use: 'window', children: [{ use: 'list', props: { rows: B('party.choices'), row: line }, on: { accept: [{ emit: 'equip', item: I('id') }, { back: true }] } }] },
    legend([{ action: 'accept', label: 'wear' }, { action: 'back', label: 'back' }]),
  ] },
  'rpg-shop': { use: 'screen', props: { title: B('shop.name'), layer: 'modal', place: 'center' }, children: [
    { use: 'split', children: [
      { use: 'window', children: [
        { use: 'each', props: { rows: B('shop.party'), row: col([row([txt(I('name'), 'heading'), txt({ format: 'Lv {level}' }, 'numeral')]), { use: 'bar', props: { label: 'HP', value: I('hp'), max: I('hpMax'), variant: 'hp' } }]) } },
        { use: 'counter', props: { label: 'Gold', value: B('shop.gold'), icon: 'gold' } },
      ] },
      { use: 'window', children: [{ use: 'tabs', props: { pages: B('shop.tabs'), page: { use: 'list', props: { rows: I('rows'), empty: I('empty'), row: line }, on: { accept: { emit: 'deal', kind: I('kind'), item: I('id') } } } } }] },
    ] },
    { use: 'text', props: { value: B('shop.said'), role: 'caption' }, when: B('shop.said') },
    legend([{ actions: ['tabPrev', 'tabNext'], label: 'tabs' }, { action: 'back', label: 'leave' }]),
  ] },
};

// ── the lens: the screen round a figure, a juice's `lens` step (playscape/rpg/juice.js), mounted apart beside the
// world's canvas (rpg-channel.js), its strikes where the channel projects the figures; each row names its own kind ──
const LENS = { use: 'lens', children: [{ use: 'strike', props: { rows: B('battle.strikes'), kind: 'ring', seconds: 0.5 } }] };

let SPEC = null;
/** The RPG's screens, HUD and lens as a mana-ui spec (read once: it is the same for every world). */
export function rpgUiSpec() {
  if (!SPEC) { SPEC = { screens: SCREENS, hud: HUD, lens: LENS }; manaUi.readSpec(SPEC); }
  return SPEC;
}

/** The theme a world's fights wear: its UI guide as lowered with the battles (cfg.theme), else the console RPG. */
export function rpgUiTheme(cfg) {
  return readTheme(cfg && cfg.theme !== undefined ? cfg.theme : 'console');
}

/** Where the lens is mounted (its host, rpg-channel.js): its rules are scoped under it. */
export const LENS_SCOPE = '.moj-rpg-lens';

// the channel's own rules: the window's jolt (a juice step), the flash over the field, the level's HUD aside in a fight
const OWN_CSS = [
  '.moj-rpg{position:fixed;inset:0;pointer-events:none;z-index:31}',
  '.moj-rpg.jolt{animation:moj-rpg-jolt .28s linear}',
  '@keyframes moj-rpg-jolt{0%,100%{transform:translateX(0)}20%{transform:translateX(calc(var(--k,1) * -6px))}40%{transform:translateX(calc(var(--k,1) * 5px))}60%{transform:translateX(calc(var(--k,1) * -3px))}80%{transform:translateX(calc(var(--k,1) * 2px))}}',
  '.moj-rpg-flash{position:fixed;inset:0;pointer-events:none;z-index:32;opacity:0}',
  'body.moj-in-battle .moj-hud{display:none}',
  // (the lens's host: over the canvas, never raised, so its regions filter the world beneath)
  `${LENS_SCOPE}{position:absolute;inset:0;pointer-events:none}`,
].join('\n');

/** The RPG's sheet: mana-ui's under the channel's scope, the theme over it, the channel's own few rules. */
export function rpgUiCss(theme) {
  return `${manaCss(RPG_SCOPE)}\n${themeCss(theme, RPG_SCOPE)}\n${lensCss(`${LENS_SCOPE} .mana-lens`)}\n${OWN_CSS}`;
}
