/**
 * MANA-UI's THEMES — the style layer over the greybox. A theme is closed words and colours, read and checked, and
 * written as CSS that sets the sheet's `--mana-*` variables plus a few rules of its own (a focus that fills or glows, a
 * cut corner, ornaments on the windows). It never reaches into the structure: what a screen holds, where and how it is
 * moved through are the components'; how it looks is the theme's. A node still carries no look (the kernel refuses
 * one); the theme is context, set once for a game.
 *
 *   theme: '<preset>' | { from?: '<preset>' | <a theme> (a child theme), tokens?, type?, faces?, frame?, corner?, plate?, focus?, motion?, fills?,
 *                         scale?, case?, ornaments? }
 *     tokens    colours (hex): ink, panel, line, accent (the four a theme needs) and mid, soft, paper, wash, accent2,
 *               harm, hp, mp, xp, stamina, shield, boss (derived from those four when left out)
 *     type      { body, display, mono }: a stack (system, serif, mono, display, rounded) or a family the theme brings
 *     faces     FONTS YOU OWN: [{ family, src: 'data:font/<ttf|otf|woff|woff2>;base64,…', weight?, style? }], inlined
 *               as @font-face so the page stays self-contained (a host maps its own shelf onto this: no URL, no CDN)
 *     frame     none | hairline | rule | double | bevel | heavy        the edge a window sits in
 *     corner    square | soft | round | cut
 *     plate     clear | flat | solid | gradient | textured            what a window sits on
 *     focus     marker | ring | lift | fill | glow | bracket | bar      how the focus shows with keys or a pad: the ▶ of a
 *                                                                    console RPG (the default: a shape), a ring round it,
 *                                                                    a lift off the page, a fill, a glow, corner brackets,
 *                                                                    or a highlight bar; with a finger or a mouse there is
 *                                                                    no cursor, what is tapped is selected
 *     motion    none | ease | snap | stepped                           how a state change moves, and how a value that
 *                                                                    changed, a screen's entrance and a moment move
 *                                                                    (MOTIONS): none fades only, ease glides, snap
 *                                                                    overshoots, stepped moves in frames
 *     fills     pattern | solid                                        bar kinds by pattern (values first) or by colour
 *     scale     compact | normal | large                               the type scale
 *     distance  desk | couch | hand                                    how far the player sits (DISTANCES): every length is
 *                                                                    in units of 1px at a 1080p reference, scaled by the
 *                                                                    stage's height and the distance (the 10-foot couch
 *                                                                    sets type ~1.44× the desk's: XAG 101's 26 px against
 *                                                                    18 px at 1080p); hand is a phone, in CSS px
 *     halo      outline | glow | shadow | plate | none                 how text with no window behind it holds over the
 *                                                                    world (a ghost window, a screen's own title, a banner)
 *     slant     none | light | hard                                    the diagonal energy most schools share: tabs, bars,
 *                                                                    banners, keys and buttons lean (skewed, never a
 *                                                                    window: what a screen holds stays square)
 *     transition none | fade | blur | wipe | slam | iris | shutter | stepped   how one screen gives way to the next: a cover drawn
 *                                                                    over the stage as a screen opens or leaves (none: the
 *                                                                    screen fades; fade: a dip to black; blur: the stage
 *                                                                    blurred through and back; less motion, less flash:
 *                                                                    none)
 *     backdrop  none | dim | blur | frost                              what a pause (a modal screen) does to what it covers:
 *                                                                    dims it, blurs it, or frosts it (blurred, lifted and
 *                                                                    its colour kept), under its scrim
 *   LAYERS: a game's UI sits on a thing that sits on a thing (LAYER_WORDS):
 *     material  none | parchment | paper | grid | crt | halftone | metal | glass   the plate's surface, wherever a plate
 *                                                                    is (a window, a toast, a HUD part): fibre and burnt
 *                                                                    edges, blueprint lines, phosphor, a brushed sheen, glass
 *     backing   none | offset | stack | torn | plinth                  what a window sits on: a slab offset in the accent, two
 *                                                                    slabs at an angle, a torn sheet, a riveted plinth
 *     crest     none | victorian | tech | ribbon                       an ornament riding over a window's top edge: a
 *                                                                    cresting of scrolls, a hatched tab, a ribbon
 *     breakout  none | tab | echo | full                               words breaking out of the box: a window's heading a
 *                                                                    tab across its edge; a title echoed huge and hollow
 *                                                                    behind itself; both
 *     overlay   none | scanlines | crt | grid | vignette | grain       a filter over the whole stage while the UI is up
 *     stage     none | band | burst | shards | stripes | rings         one more layer: a shape behind everything a screen
 *                                                                    holds (over its scrim and its key art), sweeping in
 *     sounds    glass | console | chip | terminal | paper | party      which of the UI sound library's sets the page plays
 *               | hydraulic | clack | crypt | jackpot                  (beats/ui-sounds.js: one interval plan, each set a
 *                                                                    voice; the last four the heavy ones);
 *                                                                    how many it hears is `cues`
 *     cues      silent | ticks | full                                  the UI's sounds as effects ({ sound: <cue> }): none,
 *                                                                    the cursor's (move, accept, back), or every state
 *                                                                    change; read by the page, played by the host
 *     case      upper | none                                           titles and headings
 *     ornaments [brackets | ticks | scanlines | dotgrid | stitch | hazard | glow]   drawn on and around the windows
 *     hud       panel | bare                                           how the in-game HUD sits on the play: each part on
 *                                                                    its own plate (panel), or on the scene itself, its
 *                                                                    words outlined and its meters slim and framed (bare:
 *                                                                    an action game's, never a card)
 *     sides     the kits of the sides (a team, a seat, a lane) as hex, 1 to 8, cycled: the chip a row with `side` draws,
 *               keylined in the ink where the kit would sink into the panel (under 3:1)
 *               (a host with its own colour science hands its kits here: the broadcast's, already kept apart); left
 *               out, the accent, the second accent, then the Okabe–Ito set
 *
 *   THEMES · THEME_IDS     the presets: greybox (the default), modern, console, terminal, storybook, arcade, adventure
 *   gameHudCss(t)          → the in-game HUD's sheet for a theme's `hud` (scene/channels/events.js lays it over its own:
 *                            the HUD's classes, until the HUD moves onto mana-ui; the pilot's hp at the bottom left);
 *                            a panel HUD, none
 *   THEME_WORDS            each closed word set
 *   readTheme(t)           → the theme, every field filled (throws, teaching)
 *   themeCss(t, scope?)    → CSS laid after the sheet (manaCss) under the same scope
 *   themeAdvice(t)         → [{ law, at, advice }]: contrast measured (WCAG), never refused
 *   contrast(a, b)         → the WCAG contrast ratio of two hex colours
 */
export const FACE_STACKS = Object.freeze({
  system: 'system-ui,-apple-system,"Segoe UI",sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  mono: 'ui-monospace,Menlo,Consolas,monospace',
  display: 'Impact,"Arial Black",system-ui,sans-serif',
  rounded: 'ui-rounded,"SF Pro Rounded","Nunito",system-ui,sans-serif',
});
export const THEME_WORDS = Object.freeze({
  frame: ['none', 'hairline', 'rule', 'double', 'bevel', 'heavy'],
  corner: ['square', 'soft', 'round', 'cut'],
  plate: ['clear', 'flat', 'solid', 'gradient', 'textured'],
  focus: ['marker', 'ring', 'lift', 'fill', 'glow', 'bracket', 'bar'],
  motion: ['none', 'ease', 'snap', 'stepped'],
  fills: ['pattern', 'solid'],
  scale: ['compact', 'normal', 'large'],
  case: ['upper', 'none'],
  distance: ['desk', 'couch', 'hand'],
  halo: ['outline', 'glow', 'shadow', 'plate', 'none'],
  cues: ['silent', 'ticks', 'full'],
  slant: ['none', 'light', 'hard'],
  transition: ['none', 'fade', 'blur', 'wipe', 'slam', 'iris', 'shutter', 'stepped'],
  backdrop: ['none', 'dim', 'blur', 'frost'],
  material: ['none', 'parchment', 'paper', 'grid', 'crt', 'halftone', 'metal', 'glass'],
  backing: ['none', 'offset', 'stack', 'torn', 'plinth'],
  crest: ['none', 'victorian', 'tech', 'ribbon'],
  breakout: ['none', 'tab', 'echo', 'full'],
  overlay: ['none', 'scanlines', 'crt', 'grid', 'vignette', 'grain'],
  stage: ['none', 'band', 'burst', 'shards', 'stripes', 'rings'],
  sounds: ['console', 'glass', 'chip', 'terminal', 'paper', 'party', 'hydraulic', 'clack', 'crypt', 'jackpot'],
  ornaments: ['brackets', 'ticks', 'scanlines', 'dotgrid', 'stitch', 'hazard', 'glow'],
  hud: ['panel', 'bare'],
});
const NEEDED = ['ink', 'panel', 'line', 'accent'];
const TOKENS = [...NEEDED, 'mid', 'soft', 'paper', 'wash', 'accent2', 'harm', 'hp', 'mp', 'xp', 'stamina', 'shield', 'boss'];
const KEYS = ['from', 'name', 'tokens', 'type', 'faces', 'frame', 'corner', 'plate', 'focus', 'motion', 'fills', 'scale', 'case', 'distance', 'halo', 'cues', 'slant', 'transition', 'backdrop', 'material', 'backing', 'crest', 'breakout', 'overlay', 'stage', 'sounds', 'ornaments', 'hud', 'sides'];
export const LAYER_WORDS = Object.freeze(['material', 'backing', 'crest', 'breakout', 'overlay', 'stage']);
// how far the player sits: the unit (1px at a 1080p reference, or a phone's CSS px), the distance's factor over the desk,
// and the floor no text goes under in CSS px. XAG 101's body minimum at 1080p is 26 px on a console and 18 px on a PC
// (to verify against the primary page before a test pins it): the couch is the desk's ×26/18
export const DISTANCES = Object.freeze({
  desk: { u: 'calc(100cqh / 1080)', k: '1', min: '11px' },
  couch: { u: 'calc(100cqh / 1080)', k: '1.444', min: '11px' },
  hand: { u: '.75px', k: '1', min: '13px' },
});
// the text-shadow a halo word writes (in the panel's colour, so it reads over any scene); plate is drawn by a rule
const H = 'var(--mana-panel)';
// the lean (a skew, as the sheet's --mana-slant)
export const SLANTS = Object.freeze({ none: '0deg', light: '-8deg', hard: '-14deg' });
// a transition: the cover's animation (css.js TRANSITION_KEYFRAMES) and its timing; stepped is the wipe in frames
export const TRANSITIONS = Object.freeze({
  none: { tx: 'none', 'tx-ease': 'ease-in-out' },
  fade: { tx: 'mana-tx-fade', 'tx-ease': 'ease-in-out' },
  blur: { tx: 'mana-tx-blur', 'tx-ease': 'ease-in-out' },
  wipe: { tx: 'mana-tx-wipe', 'tx-ease': 'cubic-bezier(.7,0,.3,1)' },
  slam: { tx: 'mana-tx-slam', 'tx-ease': 'cubic-bezier(.8,0,.2,1)' },
  iris: { tx: 'mana-tx-iris', 'tx-ease': 'cubic-bezier(.6,0,.4,1)' },
  shutter: { tx: 'mana-tx-shutter', 'tx-ease': 'cubic-bezier(.7,0,.3,1)' },
  stepped: { tx: 'mana-tx-wipe', 'tx-ease': 'steps(6,end)' },
});
// what a pause does to what it covers (a backdrop-filter, as the sheet's --mana-veil)
export const VEILS = Object.freeze({ none: 'none', dim: 'brightness(.62) saturate(.8)', blur: 'blur(8px) brightness(.8) saturate(.85)', frost: 'blur(18px) saturate(1.35) brightness(1.06)' });
export const HALOS = Object.freeze({
  outline: `-1px -1px 0 ${H},1px -1px 0 ${H},-1px 1px 0 ${H},1px 1px 0 ${H},0 0 3px ${H}`,
  glow: `0 0 4px ${H},0 0 10px ${H},0 0 2px ${H}`,
  shadow: `2px 2px 0 ${H},0 0 2px ${H}`,
  plate: 'none',
  none: 'none',
});
// the colour-blind-safe categorical set, for the sides a theme does not name
const OKABE_ITO = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#999999'];

export const THEMES = Object.freeze({
  greybox: { name: 'Greybox', tokens: { ink: '#111111', panel: '#fafafa', line: '#111111', accent: '#111111', mid: '#6b6b6b', soft: '#bdbdbd', paper: '#fafafa', wash: '#ececec', accent2: '#111111', harm: '#111111', hp: '#111111', mp: '#111111', xp: '#111111', stamina: '#111111', shield: '#111111', boss: '#111111' }, type: { body: 'system', display: 'system', mono: 'mono' }, frame: 'hairline', corner: 'square', plate: 'solid', focus: 'marker', motion: 'none', fills: 'pattern', scale: 'normal', case: 'upper', distance: 'desk', halo: 'outline', cues: 'silent', slant: 'none', transition: 'none', backdrop: 'none', material: 'none', backing: 'none', crest: 'none', breakout: 'none', overlay: 'none', stage: 'none', sounds: 'console', ornaments: [], sides: ['#111111', '#8a8a8a', '#4a4a4a', '#b5b5b5', '#2a2a2a', '#6b6b6b', '#9e9e9e', '#3c3c3c'], hud: 'panel' },
  // clean glass: a cool translucent plate under a bright edge, soft corners, a light lean, a highlight bar (FFXIV's clear
  // blue, a modern console's system menus), not a dashboard's dark card
  modern: { name: 'Modern', tokens: { ink: '#f2f6ff', panel: '#16305a', line: '#9cc4ff', accent: '#7cc8ff', accent2: '#ffd27a', harm: '#ff6a5c' }, type: { body: 'system', display: 'system', mono: 'mono' }, frame: 'hairline', corner: 'soft', plate: 'gradient', focus: 'bar', motion: 'ease', fills: 'solid', scale: 'normal', case: 'none', distance: 'desk', halo: 'glow', cues: 'ticks', slant: 'light', transition: 'wipe', backdrop: 'frost', material: 'glass', backing: 'none', crest: 'none', breakout: 'none', overlay: 'none', stage: 'rings', sounds: 'glass', ornaments: ['glow'], hud: 'panel' },
  console: { name: 'Console RPG', tokens: { ink: '#ffffff', panel: '#1b2a7c', line: '#eef1ff', accent: '#ffe07a', accent2: '#8fb0ff', harm: '#ff6b6b' }, type: { body: 'system', display: 'system', mono: 'mono' }, frame: 'double', corner: 'soft', plate: 'gradient', focus: 'marker', motion: 'snap', fills: 'solid', scale: 'normal', case: 'none', distance: 'desk', halo: 'shadow', cues: 'full', slant: 'none', transition: 'wipe', backdrop: 'dim', material: 'metal', backing: 'plinth', crest: 'none', breakout: 'tab', overlay: 'none', stage: 'none', sounds: 'console', ornaments: [], hud: 'panel' },
  terminal: { name: 'Terminal', tokens: { ink: '#c8f5d0', panel: '#06140c', line: '#3c8a52', accent: '#7dff9a', accent2: '#e8d36a', harm: '#ff7a5a' }, type: { body: 'mono', display: 'mono', mono: 'mono' }, frame: 'hairline', corner: 'square', plate: 'solid', focus: 'bracket', motion: 'snap', fills: 'pattern', scale: 'normal', case: 'upper', distance: 'desk', halo: 'glow', cues: 'full', slant: 'none', transition: 'shutter', backdrop: 'dim', material: 'grid', backing: 'none', crest: 'tech', breakout: 'none', overlay: 'crt', stage: 'none', sounds: 'terminal', ornaments: ['brackets', 'scanlines'], hud: 'panel' },
  storybook: { name: 'Storybook', tokens: { ink: '#3a2a20', panel: '#fff4e2', line: '#b98a5a', accent: '#a8471f', accent2: '#5f7f2e', harm: '#b3261e', hp: '#5f7f2e', mp: '#2f5d8a' }, type: { body: 'serif', display: 'serif', mono: 'mono' }, frame: 'rule', corner: 'soft', plate: 'textured', focus: 'lift', motion: 'ease', fills: 'solid', scale: 'normal', case: 'none', distance: 'desk', halo: 'plate', cues: 'ticks', slant: 'none', transition: 'iris', backdrop: 'blur', material: 'parchment', backing: 'torn', crest: 'victorian', breakout: 'none', overlay: 'vignette', stage: 'none', sounds: 'paper', ornaments: ['stitch'], hud: 'panel' },
  // an action adventure's: the HUD on the scene itself (no cards), its words outlined, its meters slim and framed, the
  // menus dark glass with a gilt rule and a cut corner (glass blurring what it covers, the words outlined over it)
  adventure: { name: 'Adventure', tokens: { ink: '#fbf6e9', panel: '#16130e', line: '#e8d9b0', accent: '#f2c75c', accent2: '#8fd3c8', harm: '#e0533f', hp: '#e0533f', stamina: '#86c94f', mp: '#5aa6e8' }, type: { body: 'system', display: 'serif', mono: 'mono' }, frame: 'hairline', corner: 'cut', plate: 'gradient', focus: 'bracket', motion: 'ease', fills: 'solid', scale: 'normal', case: 'upper', ornaments: [], distance: 'desk', halo: 'outline', cues: 'full', slant: 'none', transition: 'fade', backdrop: 'blur', material: 'glass', backing: 'none', crest: 'none', breakout: 'none', overlay: 'none', stage: 'none', sounds: 'glass', hud: 'bare' },
  arcade: { name: 'Arcade', tokens: { ink: '#ffffff', panel: '#0b0b10', line: '#ffffff', accent: '#ff2e88', accent2: '#00e5ff', harm: '#ff3b30', xp: '#ffe600' }, type: { body: 'system', display: 'display', mono: 'mono' }, frame: 'heavy', corner: 'cut', plate: 'solid', focus: 'glow', motion: 'stepped', fills: 'solid', scale: 'large', case: 'upper', distance: 'desk', halo: 'shadow', cues: 'full', slant: 'hard', transition: 'slam', backdrop: 'blur', material: 'halftone', backing: 'stack', crest: 'none', breakout: 'full', overlay: 'scanlines', stage: 'burst', sounds: 'chip', ornaments: ['hazard'], hud: 'panel' },
  // THE PARTY LANGUAGE (docs/mana-ui.md): everything leans at one angle; planes stack (the plate on a slab on a slab, each
  // a little off); words break out of their boxes; two colours punch against one neutral, in blocks; print texture, never
  // a soft blur; hard shadows and cut corners; motion slams; a stage shape behind it all. Its variations keep every
  // principle and change the dials: the colours, the face, the angle, the texture, the stage, the voice
  rebel: { name: 'Rebel', tokens: { ink: '#ffffff', panel: '#121212', line: '#ffffff', accent: '#e3192d', accent2: '#ffffff', harm: '#ff4a4a' }, type: { body: 'system', display: 'display', mono: 'mono' }, frame: 'heavy', corner: 'cut', plate: 'solid', focus: 'bar', motion: 'snap', fills: 'solid', scale: 'large', case: 'upper', distance: 'desk', halo: 'shadow', cues: 'full', slant: 'hard', transition: 'slam', backdrop: 'blur', material: 'halftone', backing: 'stack', crest: 'none', breakout: 'full', overlay: 'none', stage: 'band', sounds: 'party', ornaments: [], hud: 'panel' },
  idol: { name: 'Idol', tokens: { ink: '#2a1240', panel: '#fff3fb', line: '#ff5fb3', accent: '#ff3f9f', accent2: '#13b8f0', harm: '#e5304a' }, type: { body: 'rounded', display: 'rounded', mono: 'mono' }, frame: 'rule', corner: 'round', plate: 'gradient', focus: 'bar', motion: 'snap', fills: 'solid', scale: 'large', case: 'upper', distance: 'desk', halo: 'glow', cues: 'full', slant: 'light', transition: 'iris', backdrop: 'frost', material: 'halftone', backing: 'offset', crest: 'ribbon', breakout: 'tab', overlay: 'none', stage: 'burst', sounds: 'glass', ornaments: [], hud: 'panel' },
  street: { name: 'Street', tokens: { ink: '#111111', panel: '#ffd400', line: '#111111', accent: '#111111', accent2: '#ff3d00', harm: '#c40000' }, type: { body: 'system', display: 'display', mono: 'mono' }, frame: 'heavy', corner: 'cut', plate: 'solid', focus: 'fill', motion: 'stepped', fills: 'solid', scale: 'large', case: 'upper', distance: 'desk', halo: 'none', cues: 'full', slant: 'hard', transition: 'wipe', backdrop: 'dim', material: 'halftone', backing: 'offset', crest: 'none', breakout: 'full', overlay: 'grain', stage: 'shards', sounds: 'chip', ornaments: [], hud: 'panel' },
  mecha: { name: 'Mecha', tokens: { ink: '#e8f1f2', panel: '#1b2329', line: '#ff7a00', accent: '#ff7a00', accent2: '#25d0c4', harm: '#ff3b30' }, type: { body: 'system', display: 'display', mono: 'mono' }, frame: 'rule', corner: 'cut', plate: 'solid', focus: 'bracket', motion: 'stepped', fills: 'solid', scale: 'normal', case: 'upper', distance: 'desk', halo: 'glow', cues: 'full', slant: 'light', transition: 'shutter', backdrop: 'blur', material: 'metal', backing: 'plinth', crest: 'tech', breakout: 'tab', overlay: 'grid', stage: 'stripes', sounds: 'hydraulic', ornaments: ['hazard', 'ticks'], hud: 'panel' },
  // the party at the casino: gold on purple, a sunburst, coins and a riser into a boom when it pays
  jackpot: { name: 'Jackpot', tokens: { ink: '#fff6d8', panel: '#2a0f4a', line: '#ffcc33', accent: '#ffcc33', accent2: '#ff3d8b', harm: '#ff5a5a' }, type: { body: 'rounded', display: 'display', mono: 'mono' }, frame: 'heavy', corner: 'round', plate: 'gradient', focus: 'glow', motion: 'snap', fills: 'solid', scale: 'large', case: 'upper', distance: 'desk', halo: 'glow', cues: 'full', slant: 'light', transition: 'iris', backdrop: 'blur', material: 'halftone', backing: 'stack', crest: 'ribbon', breakout: 'full', overlay: 'none', stage: 'burst', sounds: 'jackpot', ornaments: ['glow'], hud: 'panel' },
  // GRIM: the restraint of a dark fantasy's menus. Aged gold on black, a serif, thin rules, nothing that leans or slams:
  // weight comes from the dark, the vignette and the sound (stone, iron, a toll; a door that shuts like a door)
  grim: { name: 'Grim', tokens: { ink: '#ddd5c3', panel: '#0e0d0b', line: '#5e5544', accent: '#c9a560', accent2: '#8a7a5a', harm: '#b8402e' }, type: { body: 'serif', display: 'serif', mono: 'mono' }, frame: 'hairline', corner: 'square', plate: 'flat', focus: 'bar', motion: 'ease', fills: 'solid', scale: 'normal', case: 'upper', distance: 'desk', halo: 'glow', cues: 'full', slant: 'none', transition: 'fade', backdrop: 'blur', material: 'paper', backing: 'none', crest: 'none', breakout: 'none', overlay: 'vignette', stage: 'none', sounds: 'crypt', ornaments: [], hud: 'panel' },
  // TACTICIAN: a serious game's paper and ink, a period strategy game's; its pieces knock like hardwood
  tactician: { name: 'Tactician', tokens: { ink: '#1f1b15', panel: '#ebe3cf', line: '#3d3427', accent: '#8f2e1c', accent2: '#2f5a4a', harm: '#a3261a' }, type: { body: 'serif', display: 'serif', mono: 'mono' }, frame: 'rule', corner: 'square', plate: 'textured', focus: 'marker', motion: 'ease', fills: 'pattern', scale: 'normal', case: 'none', distance: 'desk', halo: 'plate', cues: 'full', slant: 'none', transition: 'wipe', backdrop: 'dim', material: 'paper', backing: 'offset', crest: 'none', breakout: 'tab', overlay: 'none', stage: 'none', sounds: 'clack', ornaments: ['ticks'], hud: 'panel' },
});
export const THEME_IDS = Object.keys(THEMES);
// presets that share a design language: its principles held, its dials varied
export const THEME_FAMILIES = Object.freeze({ party: ['arcade', 'rebel', 'idol', 'street', 'mecha', 'jackpot'], calm: ['modern', 'console', 'storybook', 'tactician'], grave: ['grim'], machine: ['terminal'] });

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const rgb = (h) => { let x = h.slice(1); if (x.length === 3) x = [...x].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const hex = (c) => `#${c.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('')}`;
/** a toward b by t (0..1) */
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((n, i) => n + (B[i] - n) * t)); };
const alpha = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
const lum = (h) => { const [r, g, b] = rgb(h).map((n) => { const c = n / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** The WCAG contrast ratio of two hex colours. */
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,48}$/;
const FONT_SRC = /^data:(font\/(ttf|otf|woff2?)|application\/(x-font-ttf|font-woff2?|x-font-otf));base64,[A-Za-z0-9+/=]+$/;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** A theme read: a preset name, or words over a preset (`from`, the greybox when left out). Throws, teaching. */
export function readTheme(t) {
  if (t === undefined || t === null) t = 'greybox';
  if (typeof t === 'string') { if (!THEMES[t]) throw new Error(`theme '${t}' is one of: ${THEME_IDS.join(', ')}, or { from?, tokens?, … }`); t = { from: t }; }
  if (!isObj(t)) throw new Error('a theme is a preset name or { from?, tokens?, type?, faces?, frame?, corner?, plate?, focus?, motion?, fills?, scale?, case?, ornaments? }');
  for (const k in t) if (!KEYS.includes(k)) throw new Error(`theme.${k}: a theme says ${KEYS.join(', ')} (a look is words, never CSS)`);
  // a theme over a preset, or over another theme (a child theme: a card's parent, the world's look), read first
  let base, from;
  if (isObj(t.from)) { base = readTheme(t.from); from = base.from; }
  else {
    from = t.from === undefined ? 'greybox' : t.from;
    if (!THEMES[from]) throw new Error(`theme.from '${from}' is one of: ${THEME_IDS.join(', ')}, or a theme of its own ({ from?, … })`);
    base = THEMES[from];
  }
  const out = { name: typeof t.name === 'string' ? t.name : base.name, from };
  for (const k of Object.keys(THEME_WORDS)) {
    const x = t[k] === undefined ? base[k] : t[k];
    if (k === 'ornaments') {
      if (!Array.isArray(x) || x.some((o) => !THEME_WORDS.ornaments.includes(o))) throw new Error(`theme.ornaments is a list of: ${THEME_WORDS.ornaments.join(', ')}`);
      out.ornaments = [...new Set(x)];
    } else if (!THEME_WORDS[k].includes(x)) throw new Error(`theme.${k} is one of: ${THEME_WORDS[k].join(', ')}`);
    else out[k] = x;
  }
  // tokens: a theme's own over its preset's (a theme from another preset keeps that preset's colours it does not name)
  if (t.tokens !== undefined && !isObj(t.tokens)) throw new Error(`theme.tokens is { ${TOKENS.join(', ')} } (hex colours)`);
  // new core colours re-derive the rest (a dark theme over the greybox keeps none of its light greys)
  const own = isObj(t.tokens) ? t.tokens : {}, core = NEEDED.some((n) => own[n] !== undefined);
  const tok = core ? { ...Object.fromEntries(NEEDED.map((n) => [n, base.tokens[n]])), ...own } : { ...base.tokens, ...own };
  for (const k in tok) {
    if (!TOKENS.includes(k)) throw new Error(`theme.tokens.${k}: the tokens are ${TOKENS.join(', ')}`);
    if (typeof tok[k] !== 'string' || !HEX.test(tok[k])) throw new Error(`theme.tokens.${k} is a hex colour (#rgb or #rrggbb)`);
  }
  for (const k of NEEDED) if (!tok[k]) throw new Error(`theme.tokens.${k} is needed`);
  out.tokens = derive(tok);
  // new core colours re-derive the sides too (a theme over the greybox keeps none of its grey kits)
  const sides = t.sides !== undefined ? t.sides : core ? undefined : base.sides;
  if (sides !== undefined && (!Array.isArray(sides) || !sides.length || sides.length > 8 || sides.some((x) => typeof x !== 'string' || !HEX.test(x)))) throw new Error('theme.sides is 1 to 8 hex colours, the kits of the sides in order');
  const kits = sides || [out.tokens.accent, out.tokens.accent2, ...OKABE_ITO];
  out.sides = Array.from({ length: 8 }, (_, i) => kits[i % kits.length]);
  // faces you own, then the type that names them
  const faces = t.faces === undefined ? base.faces || [] : t.faces;
  if (!Array.isArray(faces)) throw new Error('theme.faces is [{ family, src: data:font/…;base64,…, weight?, style? }]');
  out.faces = faces.map((x, i) => {
    if (!isObj(x) || typeof x.family !== 'string' || !FAMILY.test(x.family)) throw new Error(`theme.faces[${i}].family is a name (letters, digits, spaces, hyphens)`);
    if (typeof x.src !== 'string' || !FONT_SRC.test(x.src)) throw new Error(`theme.faces[${i}].src is the font's bytes as a data: URL (font/ttf, otf, woff or woff2, base64): a page loads nothing from anywhere`);
    const weight = x.weight === undefined ? 400 : x.weight, style = x.style === undefined ? 'normal' : x.style;
    if (![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(weight)) throw new Error(`theme.faces[${i}].weight is 100…900 in hundreds`);
    if (!['normal', 'italic'].includes(style)) throw new Error(`theme.faces[${i}].style is normal or italic`);
    return { family: x.family, src: x.src, weight, style };
  });
  const families = new Set(out.faces.map((x) => x.family));
  const type = { ...base.type, ...(isObj(t.type) ? t.type : {}) };
  for (const k of ['body', 'display', 'mono']) if (!FACE_STACKS[type[k]] && !families.has(type[k])) throw new Error(`theme.type.${k} '${type[k]}' is a stack (${Object.keys(FACE_STACKS).join(', ')}) or a family in theme.faces`);
  out.type = { body: type.body, display: type.display, mono: type.mono };
  return out;
}
// the tokens a theme leaves out, from the four it gives
function derive(t) {
  const o = { ...t };
  o.mid = o.mid || mix(o.ink, o.panel, 0.4);
  o.soft = o.soft || mix(o.ink, o.panel, 0.72);
  o.paper = o.paper || mix(o.panel, o.ink, 0.06);
  o.wash = o.wash || mix(o.panel, o.accent, 0.2);
  o.accent2 = o.accent2 || o.accent;
  o.harm = o.harm || '#e5484d';
  o.hp = o.hp || '#46b36a';
  o.mp = o.mp || '#4f7cff';
  o.xp = o.xp || '#e6c229';
  o.stamina = o.stamina || '#e59a1f';
  o.shield = o.shield || '#8da4ef';
  o.boss = o.boss || o.harm;
  return o;
}

// ── writing ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const FRAMES = { none: ['0px', 'solid'], hairline: ['1px', 'solid'], rule: ['2px', 'solid'], double: ['4px', 'double'], bevel: ['3px', 'outset'], heavy: ['3px', 'solid'] };
// the rule an inner part is drawn with (a cell, a track, a key, a slot, a badge): a heavy frame's parts are heavier too
const RULES = { none: '1px', hairline: '1px', rule: '1px', double: '2px', bevel: '2px', heavy: '2px' };
const RADII = { square: '0px', soft: '5px', round: '12px', cut: '0px' };
const MOTION = { none: 'background-color 0s', snap: 'background-color 0s', ease: 'background-color .18s cubic-bezier(.2,.7,.2,1),border-color .18s,box-shadow .18s,color .18s', stepped: 'background-color .15s steps(3),border-color .15s steps(3),box-shadow .15s steps(3)' };
// how a change, an entrance and a moment move (the broadcast's motion cards, as words): none fades and travels nowhere;
// ease glides; snap overshoots and slams (a back curve); stepped moves in frames
export const MOTIONS = Object.freeze({
  // snap: how far the item the cursor lands on travels in from the way it went; nudge: how far the focus stands out
  // lead: how long the frame has before its rows fill it (the frame builds, the rows fill it, the cursor lands); out: an
  // exit's curve, accelerating away (never an overshoot: what leaves does not bounce)
  none: { dur: '160ms', ease: 'ease-out', travel: '0px', pop: '1', stagger: '0ms', glide: '0ms', loop: 'paused', sheen: '0', snap: '0px', nudge: '0px', lead: '0ms', out: 'ease-in' },
  ease: { dur: '220ms', ease: 'cubic-bezier(.2,.7,.2,1)', travel: '10px', pop: '1.12', stagger: '40ms', glide: '320ms', loop: 'running', sheen: '.35', snap: 'calc(10 * var(--mana-du))', nudge: 'calc(6 * var(--mana-du))', lead: '90ms', out: 'cubic-bezier(.5,0,.75,0)' },
  snap: { dur: '200ms', ease: 'cubic-bezier(.34,1.56,.64,1)', travel: '14px', pop: '1.25', stagger: '30ms', glide: '180ms', loop: 'running', sheen: '.5', snap: 'calc(18 * var(--mana-du))', nudge: 'calc(14 * var(--mana-du))', lead: '70ms', out: 'cubic-bezier(.6,0,.9,.2)' },
  stepped: { dur: '240ms', ease: 'steps(4,end)', travel: '12px', pop: '1.2', stagger: '60ms', glide: '300ms', loop: 'running', sheen: '.5', snap: 'calc(14 * var(--mana-du))', nudge: 'calc(9 * var(--mana-du))', lead: '120ms', out: 'steps(3,end)' },
});
const SCALE = { compact: '0.9', normal: '1', large: '1.12' };
const corners = (c, len, w) => ['top left', 'top right', 'bottom left', 'bottom right'].flatMap((at) => [`linear-gradient(${c},${c}) ${at}/${len}px ${w}px no-repeat`, `linear-gradient(${c},${c}) ${at}/${w}px ${len}px no-repeat`]).join(',');
const stack = (k) => FACE_STACKS[k] || `'${k}',system-ui,sans-serif`;

// ── layers ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// an image drawn in the page: an SVG as a data: URL (nothing loaded from anywhere)
const svg = (body, w, h) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;
// noise of a colour: fibre (a high frequency), mottling (a low one); its seed fixed, so the same theme draws the same page
const noise = (freq, octaves, c, a, size, seed) => { const [r, g, b] = rgb(c).map((n) => (n / 255).toFixed(3)); return `${svg(`<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${a} 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`, size, size)} 0 0/${size}px ${size}px`; };
const du = (n) => `calc(${n} * var(--mana-du))`;
const light = (c) => lum(c) > 0.4;
// RESTRAINT WHERE THE WORDS ARE: a material's texture is loud at a window's rim and quiet under its words. The plate
// every surface wears (a window, a toast, a HUD part, a prompt) carries the texture at the reading amplitude (FIELD);
// a window's rim (its grain, themeCss) carries it whole, fading out before the words begin (RIM)
export const FIELD = 0.2;
const RIM = 28;
// a material's texture at an amplitude (1 whole, FIELD under the words): the layers over a plate's base
function textureOf(T, k, a) {
  const m = T.material, A = (x) => +(x * a).toFixed(3);
  if (m === 'parchment') {
    const burn = light(k.panel) ? '#5a3816' : '#000000';
    return [noise(0.85, 3, burn, A(0.32), 180, 7), noise(0.022, 2, burn, A(0.26), 420, 3), `radial-gradient(ellipse at 50% 45%,transparent 55%,${alpha(burn, A(0.34))} 100%)`];
  }
  if (m === 'paper') return [noise(0.9, 2, light(k.panel) ? '#000000' : '#ffffff', A(0.12), 160, 11)];
  if (m === 'grid') return [`linear-gradient(${alpha(k.line, A(0.28))} 1px,transparent 1px) 0 0/${du(120)} ${du(120)}`, `linear-gradient(90deg,${alpha(k.line, A(0.28))} 1px,transparent 1px) 0 0/${du(120)} ${du(120)}`, `linear-gradient(${alpha(k.line, A(0.12))} 1px,transparent 1px) 0 0/${du(24)} ${du(24)}`, `linear-gradient(90deg,${alpha(k.line, A(0.12))} 1px,transparent 1px) 0 0/${du(24)} ${du(24)}`];
  if (m === 'crt') return [`repeating-linear-gradient(0deg,${alpha('#000000', A(0.2))} 0 1px,transparent 1px 3px)`, `radial-gradient(ellipse at 50% 40%,${alpha(k.accent, A(0.12))},transparent 70%)`, `radial-gradient(ellipse at center,transparent 60%,${alpha('#000000', A(0.35))} 100%)`];
  if (m === 'halftone') return [`radial-gradient(${alpha(k.ink, A(0.11))} 28%,transparent 31%) 0 0/7px 7px`, `linear-gradient(160deg,transparent 40%,${alpha(k.accent, A(0.12))})`];
  if (m === 'metal') return [`linear-gradient(180deg,${alpha('#ffffff', A(0.16))},transparent 22%,transparent 78%,${alpha('#000000', A(0.22))})`, `repeating-linear-gradient(90deg,${alpha('#ffffff', A(0.035))} 0 1px,${alpha('#000000', A(0.035))} 1px 3px)`];
  if (m === 'glass') return [`linear-gradient(170deg,${alpha('#ffffff', A(0.2))},transparent 38%)`];
  return [];
}
// a plate's surface: its texture at the reading amplitude over its base (parchment lays a sheet of its own; glass is a
// thin plate, the scene behind blurred, but thick enough under words that a bright scene does not wash them out)
function materialOf(T, k, base) {
  const m = T.material;
  if (m === 'none') return base;
  const under = m === 'parchment' ? mix(k.panel, light(k.panel) ? '#ecd9ac' : '#4a341b', 0.45) : m === 'glass' ? alpha(k.panel, 0.76) : base;
  return [...textureOf(T, k, FIELD), under].join(',');
}
// the rim: where the whole texture shows, fading to nothing before a window's words begin (a mask of the four edges)
const RIM_MASK = `linear-gradient(90deg,#000,transparent ${du(RIM)},transparent calc(100% - ${du(RIM)}),#000),linear-gradient(#000,transparent ${du(RIM)},transparent calc(100% - ${du(RIM)}),#000)`;
// words on a fill take whichever of the ink and the panel reads on it
const readOn = (k, bg) => (contrast(k.ink, bg) >= contrast(k.panel, bg) ? k.ink : k.panel);
// a torn sheet's edge: a fixed jag (no dice), the same on every page
const JAG = [0, 1.6, 0.5, 2.3, 1.1, 0.2, 1.9, 0.8, 2.6, 0.4, 1.4, 2.1, 0.7, 1.8, 0.3, 2.4, 1.2, 0.6, 2, 0.9];
const torn = () => {
  const n = 20, edge = (i) => JAG[i % JAG.length];
  const pts = [
    ...Array.from({ length: n + 1 }, (_, i) => `${(i * 100) / n}% ${edge(i)}%`),
    ...Array.from({ length: n + 1 }, (_, i) => `${100 - edge(i + 3)}% ${(i * 100) / n}%`),
    ...Array.from({ length: n + 1 }, (_, i) => `${100 - (i * 100) / n}% ${100 - edge(i + 7)}%`),
    ...Array.from({ length: n + 1 }, (_, i) => `${edge(i + 11)}% ${100 - (i * 100) / n}%`),
  ];
  return `polygon(${pts.join(',')})`;
};
function backingOf(T, k) {
  const b = T.backing;
  if (b === 'offset') return `background:${k.accent};translate:${du(10)} ${du(10)};border-radius:var(--mana-radius)`;
  // two slabs at an angle: the accent, and the shade behind it (Persona's panels on panels)
  if (b === 'stack') return `inset:${du(-6)} ${du(-12)};background:${k.accent};rotate:-2.2deg;box-shadow:${du(16)} ${du(14)} 0 #000000`;
  if (b === 'torn') return `inset:${du(-14)};background:${noise(0.8, 3, '#000000', 0.25, 160, 5)},${mix(k.panel, k.ink, 0.3)};clip-path:${torn()};rotate:.6deg`;
  if (b === 'plinth') {
    const rivet = (at) => `radial-gradient(circle at ${at},${mix(k.line, '#ffffff', 0.3)} 0 ${du(3)},${alpha('#000000', 0.5)} ${du(3.5)},transparent ${du(4.5)})`;
    return `inset:${du(-10)};border:1px solid ${k.line};border-radius:calc(var(--mana-radius) + 4px);background:${['10px 10px', 'calc(100% - 10px) 10px', '10px calc(100% - 10px)', 'calc(100% - 10px) calc(100% - 10px)'].map(rivet).join(',')},linear-gradient(180deg,${mix(k.panel, '#000000', 0.3)},${mix(k.panel, '#000000', 0.6)})`;
  }
  return null;
}
function crestOf(T, k) {
  const c = T.crest;
  if (c === 'victorian') {
    // a cresting of scrolls, mirrored about a leaf: the line's colour, the leaf the accent's
    const half = `<g id='h' fill='none' stroke='${k.line}' stroke-width='2' stroke-linecap='round'><path d='M116 40C98 40 86 30 70 30C56 30 50 38 40 38C30 38 26 30 32 25C38 20 46 26 42 31'/><path d='M70 30C74 20 88 14 100 18C108 21 106 30 99 29C94 28 95 22 100 23'/><path d='M40 38C28 44 14 44 4 40'/><circle cx='56' cy='22' r='2.2' fill='${k.line}' stroke='none'/></g>`;
    const art = svg(`${half}<use href='#h' transform='matrix(-1 0 0 1 240 0)'/><path d='M120 4C128 15 128 26 120 36C112 26 112 15 120 4Z' fill='${k.accent}'/><circle cx='120' cy='42' r='3' fill='${k.accent}'/>`, 240, 48);
    return `left:50%;top:${du(-40)};width:${du(260)};height:${du(52)};translate:-50% 0;background:${art} center/contain no-repeat`;
  }
  if (c === 'tech') return `left:${du(22)};top:${du(-13)};width:${du(160)};height:${du(13)};background:repeating-linear-gradient(-45deg,${k.accent} 0 4px,transparent 4px 8px),${alpha(k.line, 0.35)};clip-path:polygon(0 100%,8% 0,92% 0,100% 100%)`;
  if (c === 'ribbon') {
    const fold = mix(k.accent, '#000000', 0.4), art = svg(`<polygon points='0,12 34,12 26,24 34,36 0,36' fill='${fold}'/><polygon points='280,12 246,12 254,24 246,36 280,36' fill='${fold}'/><polygon points='24,30 34,36 34,30' fill='${mix(fold, '#000000', 0.4)}'/><polygon points='256,30 246,36 246,30' fill='${mix(fold, '#000000', 0.4)}'/><rect x='24' y='4' width='232' height='26' fill='${k.accent}'/>`, 280, 40);
    return `left:50%;top:${du(-26)};width:${du(300)};height:${du(43)};translate:-50% 0;background:${art} center/contain no-repeat`;
  }
  return null;
}
// the stage: a shape behind everything a screen holds, in the theme's colours
const STAGES = (k) => ({
  none: 'none',
  band: [`linear-gradient(-14deg,transparent 0 53.5%,${alpha('#000000', 0.85)} 53.5% 59%,transparent 59%)`, `linear-gradient(-14deg,transparent 0 33%,${k.accent} 33% 53%,transparent 53%)`].join(','),
  burst: `repeating-conic-gradient(from 0deg at 14% 86%,${alpha(k.accent, 0.24)} 0 5deg,transparent 5deg 14deg)`,
  shards: [`linear-gradient(118deg,transparent 0 62%,${k.accent2} 62% 64.5%,transparent 64.5%)`, `linear-gradient(118deg,transparent 0 66%,${alpha(k.accent, 0.92)} 66% 82%,transparent 82%)`, `linear-gradient(-32deg,transparent 0 78%,${alpha('#000000', 0.55)} 78%)`].join(','),
  stripes: `repeating-linear-gradient(-14deg,${alpha(k.accent, 0.14)} 0 ${du(20)},transparent ${du(20)} ${du(60)})`,
  rings: `repeating-radial-gradient(circle at 82% 28%,${alpha(k.accent, 0.16)} 0 ${du(4)},transparent ${du(4)} ${du(44)})`,
});
const OVERLAYS = (k) => ({
  none: 'none',
  scanlines: `repeating-linear-gradient(0deg,${alpha('#000000', 0.14)} 0 1px,transparent 1px 3px)`,
  crt: [`repeating-linear-gradient(0deg,${alpha('#000000', 0.16)} 0 1px,transparent 1px 3px)`, `repeating-linear-gradient(90deg,${alpha('#ff0000', 0.035)} 0 1px,${alpha('#00ff00', 0.035)} 1px 2px,${alpha('#0000ff', 0.035)} 2px 3px)`, `radial-gradient(ellipse at center,transparent 58%,${alpha('#000000', 0.5)} 100%)`].join(','),
  grid: [`linear-gradient(${alpha(k.line, 0.1)} 1px,transparent 1px) 0 0/${du(60)} ${du(60)}`, `linear-gradient(90deg,${alpha(k.line, 0.1)} 1px,transparent 1px) 0 0/${du(60)} ${du(60)}`].join(','),
  vignette: `radial-gradient(ellipse at center,transparent 55%,${alpha('#000000', 0.45)} 100%)`,
  grain: noise(0.95, 2, '#808080', 0.16, 220, 13),
});

/** The theme as CSS, laid after the sheet under the same scope. */
export function themeCss(theme, scope = '.mana-root') {
  const T = readTheme(theme), s = scope, k = T.tokens, win = `${s} .mana-window:not([data-variant=ghost]),${s} .mana-place>.mana-region:not(:has(>:is(.mana-reticle,.mana-banner,.mana-touchpad)))`;
  const plate = { clear: 'transparent', flat: alpha(k.panel, 0.86), solid: k.panel, gradient: `linear-gradient(180deg,${mix(k.panel, '#ffffff', 0.1)} 0%,${k.panel} 55%,${mix(k.panel, '#000000', 0.25)} 100%)`, textured: `repeating-linear-gradient(0deg,${k.panel} 0 2px,${mix(k.panel, k.ink, 0.05)} 2px 3px)` }[T.plate];
  const plateOf = materialOf(T, k, plate);
  // words on the accent (a filled focus, a heading tab, a learned node) and on the highlight bar's blend take the ink that reads
  const onAccent = readOn(k, k.accent), onBar = readOn(k, mix(k.panel, k.accent, 0.42));
  const vars = { ...Object.fromEntries(Object.entries(k)), plain: k.accent, scrim: alpha(k.panel, 0.66), 'focus-ink': T.focus === 'fill' ? onAccent : k.ink,
    ...Object.fromEntries(T.sides.map((c, i) => [`side-${i}`, c])),
    font: stack(T.type.body), display: stack(T.type.display), mono: stack(T.type.mono), scale: SCALE[T.scale], case: T.case === 'upper' ? 'uppercase' : 'none',
    radius: RADII[T.corner], 'frame-w': FRAMES[T.frame][0], 'frame-s': FRAMES[T.frame][1], plate: plateOf, motion: MOTION[T.motion], ...MOTIONS[T.motion],
    ...DISTANCES[T.distance], halo: HALOS[T.halo], slant: SLANTS[T.slant], 'slant-words': SLANTS[T.slant === 'hard' ? 'light' : T.slant], ...TRANSITIONS[T.transition], veil: VEILS[T.backdrop], 'rule-w': RULES[T.frame],
    overlay: OVERLAYS(k)[T.overlay], stage: STAGES(k)[T.stage],
    // the ▶ is the sheet's own focus; any other focus word takes it (and the room it keeps at an item's left) away
    cursor: T.focus === 'marker' ? '"\\25B6"' : 'none', mark: T.focus === 'marker' ? '1' : '0',
    // a side whose kit would sink into the panel is keylined in the ink
    ...Object.fromEntries(T.sides.map((c, i) => [`side-${i}-key`, contrast(c, k.panel) < 3 ? k.ink : 'transparent'])) };
  const out = [
    ...T.faces.map((x) => `@font-face{font-family:'${x.family}';font-style:${x.style};font-weight:${x.weight};font-display:block;src:url(${x.src})}`),
    `${s}{${Object.entries(vars).map(([n, x]) => `--mana-${n}:${x}`).join(';')}}`,
    `${s} .mana-node[data-state=learned]{background:${k.accent};color:${onAccent};border-color:${k.accent}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]{background:${mix(k.accent, k.panel, 0.2)};color:${readOn(k, mix(k.accent, k.panel, 0.2))};border-color:${k.ink}}`,
    `${s} .mana-node[data-state=learned][data-st=focus]::before{color:${readOn(k, mix(k.accent, k.panel, 0.2))}}`,
    `${s} .mana-awareness[data-state=suspicious] b,${s} .mana-awareness[data-state=searching] b{border-color:${k.accent2};color:${k.accent2}}`,
  ];
  // A WINDOW IN LAYERS: the plate moves into the window's layers, so a backing can sit under it and a crest over its
  // edge, and what the window holds may reach past its box (a breakout tab, a crest) by as much as the clip allows
  const framed = `${s} .mana-window:not([data-variant=ghost])`, back = backingOf(T, k), crest = crestOf(T, k), tab = T.breakout === 'tab' || T.breakout === 'full';
  // the rim: the material's whole texture and the ornaments that pattern a window, under its words and fading out before
  // they begin (the window isolated, so the rim sits over its plate and under what it holds)
  const rim = [];
  if (T.ornaments.includes('ticks')) rim.push(corners(k.line, 4, 4));
  if (T.ornaments.includes('hazard')) rim.push(`repeating-linear-gradient(-45deg,${k.accent2} 0 6px,transparent 6px 12px) top/100% 5px no-repeat`);
  if (T.ornaments.includes('scanlines')) rim.push(`repeating-linear-gradient(0deg,${alpha('#000000', 0.22)} 0 1px,transparent 1px 3px)`);
  if (T.ornaments.includes('dotgrid')) rim.push(`radial-gradient(${alpha(k.line, 0.5)} 1px,transparent 1.2px) 0 0/10px 10px`);
  rim.push(...textureOf(T, k, 1));
  const layered = !!(back || crest);
  const CUT = 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)';
  if (layered) {
    out.push(`${framed}{background:transparent;border-color:transparent;isolation:isolate}`, `${framed}>.mana-layers{display:block}`);
    if (back) out.push(`${framed}>.mana-layers::before{${back}}`);
    // a crest rides over the edge: the window keeps room above it, so what sits over the window does not cover it
    if (crest) out.push(`${framed}>.mana-layers>b{${crest}}`, `${s} .mana-window:not([data-variant=ghost]):not(.mana-window *){margin-top:${du(T.crest === 'tech' ? 14 : 34)}}`);
  }
  // a window that takes the size of what it holds lets its layers and its tab past its box; one filling a pane keeps its
  // clip, its layers past it only where the browser takes a clip margin (overflow-clip-margin takes no calc())
  if (layered || tab) out.push(`${framed}{overflow:visible}`, `${s} :is(.mana-screen[data-place=full],.mana-split,.mana-each) .mana-window:not([data-variant=ghost]){overflow:clip;overflow-clip-margin:72px}`);
  if (T.corner === 'cut') out.push(layered ? `${framed}>.mana-layers::after,${framed}::after,${s} .mana-place>.mana-region:not(:has(>:is(.mana-reticle,.mana-banner,.mana-touchpad))),${s} .mana-button{clip-path:${CUT}}` : `${win},${s} .mana-button{clip-path:${CUT}}`);
  // a window's heading as a tab across its top edge, leaning with the theme, on the accent (a sub-panel's stays put)
  if (tab) out.push(`${framed}>.mana-heading{position:absolute;top:0;left:${du(-12)};z-index:2;margin:0;padding:${du(5)} ${du(20)};translate:0 -55%;transform:skewX(var(--mana-slant-words));background:${k.accent};color:${onAccent};text-shadow:none;box-shadow:${du(5)} ${du(5)} 0 ${alpha('#000000', 0.45)}}`,
    `${framed}:has(>.mana-heading){padding-top:${du(34)}}`,
    `${s} .mana-window .mana-window>.mana-heading{position:static;translate:none;transform:none;padding:0;background:none;color:inherit;box-shadow:none}`);
  // the echo: the words again, behind themselves (attr() read on the element itself, never through a variable, which
  // would read it on the root)
  if (T.breakout === 'echo' || T.breakout === 'full') out.push(`${s} :is(.mana-screen>.mana-title,.mana-text[data-role=display])::before{content:attr(data-echo)}`);
  // glass: the scene behind a plate blurred
  if (T.material === 'glass') out.push(`${framed},${s} .mana-place>.mana-region,${s} .mana-toast{backdrop-filter:blur(10px) saturate(1.4);-webkit-backdrop-filter:blur(10px) saturate(1.4)}`);
  if (T.focus === 'ring') out.push(`${s} [data-st=focus]{outline:2px solid ${k.accent};outline-offset:-2px}`);
  // a highlight bar: a solid block at the leading edge, the accent fading off behind the words, moved on the frame
  if (T.focus === 'bar') out.push(`${s} [data-st=focus]{outline:none;border-color:transparent;color:${onBar};background:linear-gradient(90deg,${k.accent} 0 calc(7 * var(--mana-du)),${alpha(k.accent, 0.42)} calc(7 * var(--mana-du)),${alpha(k.accent, 0.12)} 78%,transparent)}`);
  if (T.focus === 'lift') out.push(`${s} [data-st=focus]{outline:none;background:${k.panel};border-color:${k.line};box-shadow:0 6px 16px ${alpha(k.ink, 0.22)},0 0 0 1px ${k.accent};transform:translateY(-1px)}`);
  if (T.focus === 'fill') out.push(`${s} [data-st=focus]{outline:none;background:${k.accent};border-color:${k.accent};color:${onAccent}}`, `${s} [data-st=focus]::before{color:${onAccent}}`, `${s} [data-st=focus] .mana-label,${s} [data-st=focus] .mana-mark,${s} [data-st=focus] .mana-text,${s} [data-st=focus] .mana-num{color:${onAccent}}`);
  if (T.focus === 'glow') out.push(`${s} [data-st=focus]{outline:none;box-shadow:0 0 0 1px ${k.accent},0 0 14px ${alpha(k.accent, 0.75)}}`);
  if (T.focus === 'bracket') out.push(`${s} [data-st=focus]{outline:none;border-color:transparent;background:${corners(k.accent, 8, 2)},${k.wash}}`);
  if (T.fills === 'solid') out.push(...['mp', 'xp', 'stamina', 'shield'].map((x) => `${s} .mana-bar[data-variant=${x}] .mana-track i{background:${k[x]}}`));
  // ornaments: brackets before, the rest layered after
  // ornaments dress a window that has a plate; a ghost window (words over the world) wears none
  if (T.ornaments.includes('brackets')) out.push(`${framed}::before{content:"";position:absolute;inset:3px;pointer-events:none;background:${corners(k.accent, 12, 2)}}`);
  if (rim.length) out.push(`${framed}{isolation:isolate}`, `${framed}::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:var(--mana-radius);background:${rim.join(',')};-webkit-mask:${RIM_MASK};mask:${RIM_MASK}}`,
    // a sub-panel is all words: it wears the quiet plate alone
    `${s} .mana-window .mana-window::after{content:none}`);
  // words to read over a stage with no window behind them (a ghost window, a screen's own stack of rows, a bar, a
  // caption) sit on a band of the panel fading away from them: the stage performs around the words, not under them
  // (a halo of plate already gives a ghost window its plate)
  const bare = [T.halo === 'plate' ? null : '.mana-window[data-variant=ghost]', '.mana-screen>.mana-stack:has(>:is(.mana-bar,.mana-loader,.mana-list,.mana-text[data-role=caption]))'].filter(Boolean).join(',');
  if (T.stage !== 'none') out.push(`${s} .mana-screen :is(${bare}){background:linear-gradient(90deg,${alpha(k.panel, 0.9)},${alpha(k.panel, 0.8)} calc(100% - ${du(90)}),${alpha(k.panel, 0)});padding:${du(12)} ${du(90)} ${du(12)} ${du(26)};margin:${du(-12)} ${du(-90)} ${du(-12)} ${du(-26)}}`);
  // a button standing on the screen itself, over a stage, is filled with the panel (its word is read, not the stripes)
  if (T.stage !== 'none') out.push(`${s} .mana-screen>.mana-button:not([data-st=focus]){background:${alpha(k.panel, 0.9)}}`);
  // a window with no plate keeps its words' halo: nothing else stands between them and the world
  if (T.plate === 'clear') out.push(`${framed}{text-shadow:var(--mana-halo)}`);
  if (T.ornaments.includes('stitch')) out.push(`${win}{outline:1px dashed ${k.line};outline-offset:-6px}`);
  // a blur-through draws nothing of its own: it blurs the stage under it
  if (T.transition === 'blur') out.push(`${s} .mana-transition{background:transparent}`);
  // a slam is two bands, the accent before the shade, cut on the diagonal
  if (T.transition === 'slam') out.push(`${s} .mana-transition{background:linear-gradient(105deg,transparent 0 18%,${k.accent} 18% 46%,#000000 46% 82%,transparent 82%)}`);
  // a plate behind text that has no window: the ghost windows and a screen's own title sit on the panel, the halo off
  if (T.halo === 'plate') out.push(`${s} .mana-window[data-variant=ghost]{background:${alpha(k.panel, 0.82)};padding:calc(9 * var(--mana-du)) calc(15 * var(--mana-du))}`, `${s} .mana-screen>.mana-title{width:fit-content;background:${alpha(k.panel, 0.82)};padding:0 calc(15 * var(--mana-du))}`);
  if (T.ornaments.includes('glow')) out.push(`${win}{box-shadow:0 0 0 1px ${alpha(k.accent, 0.5)},0 0 18px ${alpha(k.accent, 0.35)}}`);
  return out.join('\n');
}

/** What a theme's colours will read like, measured (WCAG contrast); advice only, never a refusal. */
export function themeAdvice(theme) {
  const T = readTheme(theme), k = T.tokens, out = [];
  const need = (law, a, b, min, at, what) => { const r = contrast(a, b); if (r < min) out.push({ law, at, advice: `${what}: ${r.toFixed(2)}:1 where ${min}:1 reads; move the two apart in lightness` }); };
  need('ink-reads', k.ink, k.panel, 4.5, 'tokens.ink / panel', 'text on a window');
  need('mid-reads', k.mid, k.panel, 3, 'tokens.mid / panel', 'labels and captions on a window');
  if (T.focus === 'fill') need('focus-reads', readOn(k, k.accent), k.accent, 4.5, 'tokens.accent / ink, panel', 'text on a filled focus');
  else need('focus-shows', k.accent, k.panel, 3, 'tokens.accent / panel', 'the focus against a window');
  if (T.focus === 'bar') need('focus-reads', readOn(k, mix(k.panel, k.accent, 0.42)), mix(k.panel, k.accent, 0.42), 4.5, 'tokens.accent / ink, panel', 'text on the highlight bar');
  if (T.breakout === 'tab' || T.breakout === 'full') need('tab-reads', readOn(k, k.accent), k.accent, 4.5, 'tokens.accent / ink, panel', 'a heading on its tab');
  if (T.frame !== 'none') need('frame-shows', k.line, k.panel, 1.5, 'tokens.line / panel', 'a window\'s edge');
  need('harm-shows', k.harm, k.panel, 3, 'tokens.harm / panel', 'a low bar and an alerted enemy');
  T.sides.slice(0, 2).forEach((c, i) => need('side-shows', c, k.panel, 1.5, `sides[${i}] / panel`, `side ${i + 1}'s chip against a window`));
  // a material that changes the sheet: its words are measured on the sheet it lays, not the panel it names
  if (T.material === 'parchment') need('ink-reads', k.ink, mix(k.panel, light(k.panel) ? '#ecd9ac' : '#4a341b', 0.45), 4.5, 'material: parchment / ink', 'text on the parchment');
  if (T.material === 'glass' && T.halo === 'none') out.push({ law: 'glass-reads', at: 'material / halo', advice: 'glass shows the scene behind its words: a bright scene washes them out; keep a halo' });
  if (T.fills === 'solid') out.push({ law: 'values-apart', at: 'fills', advice: 'solid fills tell hp, mp, xp and stamina apart by colour alone; keep their labels, or fills: pattern' });
  return out;
}

/** The in-game HUD's sheet for a theme's `hud` (the HUD page's classes, scene/channels/events.js, laid over its own until
 * the HUD moves onto mana-ui): a BARE HUD's parts sit on the scene itself, no plate and no card: their words outlined
 * against any ground, its meters slim, framed in a hairline of the theme's line with cut ends, their numbers left to the
 * status page, the banners and toasts in the display face. A panel HUD adds nothing. */
export function gameHudCss(t) {
  const T = readTheme(t);
  if (T.hud !== 'bare') return '';
  const k = T.tokens, face = (f) => FACE_STACKS[f] ?? `"${f}",serif`, disp = face(T.type.display), body = face(T.type.body);
  const ol = '0 1px 2px rgba(0,0,0,.9),0 0 8px rgba(0,0,0,.55)';
  return [
    `.moj-w{background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:2px 0;color:${k.ink};text-shadow:${ol}}`,
    `.moj-w-text .moj-lbl,.moj-w-legend{font:600 12px/1.3 ${body};letter-spacing:1.5px;text-transform:uppercase;opacity:.85}`,
    `.moj-w-bar{min-width:0;width:min(280px,34vw);gap:8px}`,
    `.moj-w-bar .moj-lbl{font:700 11px/1 ${disp};letter-spacing:2px;color:${k.ink};opacity:.9}`,
    '.moj-w-bar .moj-val{display:none}',
    `.moj-w-bar .moj-track{height:9px;border-radius:0;background:rgba(0,0,0,.55);box-shadow:0 0 0 1px ${alpha(k.line, 0.75)},0 2px 6px rgba(0,0,0,.45);clip-path:polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)}`,
    '.moj-w-bar .moj-fill{background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 55%),currentColor}',
    '.moj-w-counter{min-width:0;padding:0}',
    `.moj-w-counter .moj-val{font:700 26px/1 ${disp}}`,
    `.moj-w-banner{font:700 30px/1.2 ${disp};letter-spacing:8px;padding:6px 0}`,
    `.moj-w-toast{font:700 20px/1.2 ${disp};letter-spacing:2px}`,
    // (the pilot's own meters, the controllable channel's: its hp down at the bottom left, a slim framed meter with no card
    // and no numbers; its stamina a slim framed gauge under the hero; the HUD's own bottom left column above the hp)
    '.moj-c-hp{background:none!important;border:0!important;padding:0!important;left:18px!important;right:auto!important;top:auto!important;bottom:18px!important;width:min(260px,34vw)!important}',
    `.moj-c-hp .moj-c-lbl{font:700 11px/1 ${disp}!important;letter-spacing:2px!important;color:${k.ink}!important;text-shadow:${ol}!important}`,
    '.moj-c-hp .moj-c-num{display:none}',
    `.moj-c-track,.moj-c-gauge{border-radius:0!important;background:rgba(0,0,0,.55)!important;box-shadow:0 0 0 1px ${alpha(k.line, 0.75)},0 2px 6px rgba(0,0,0,.45)!important;clip-path:polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)}`,
    '.moj-c-track{height:9px!important}.moj-c-gauge{height:6px!important;width:min(200px,28vw)!important;bottom:22px!important}',
    '.moj-c-fill{opacity:1!important;background-image:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 55%)!important}',
    `.moj-c-cap{font:700 10px/1 ${disp}!important;letter-spacing:3px!important;bottom:34px!important}`,
    '.moj-hud-bottom-left{bottom:52px!important}',
  ].join('');
}
