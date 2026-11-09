/**
 * THE GUIDE AS A MANA-UI THEME — the bridge from playscape's UI direction to the game UI runtime's style layer
 * (control/lib/mana-ui/theme.js). A world's guide (direction.js rollGuide: its tokens from the world's tone or a
 * flavor's tint, the register's dials, the face, the stylized border) becomes a mana-ui theme of closed words, so the
 * screens mana-ui draws wear the world's look; nothing in the guide is restyled by taste on the way.
 *
 *   guide.tokens        ink, panel, line, accent, accent2 → the theme's tokens (bg is the world's, not a window's)
 *   guide.font          the face (system | mono | serif | display) → type.body; type.display from the type dial
 *   guide.dials         frame → frame (material: heavy), plate → plate, motion → motion (mechanical: stepped),
 *                       sound → cues (cues: full, a sound effect on every state change; silent: none);
 *                       the register's stop → corner and case (modern rounds and keeps case, the console's square and
 *                       capitalised)
 *   guide.border        a flavor's elements → ornaments (brackets, ticks, scanlines, dotgrid, stitch, hazard, glow), and
 *                       the rest to the words they mean: soft → a soft corner, notch → a cut one, double → a double rule,
 *                       gradient → a gradient plate; brackets focus as brackets, a glow glows, a console's stop keeps
 *                       the classic ▶ and the rest ring their focus
 *   juice               the game's juice register (scene/juice-style.js: anime | western), when the host has one: an
 *                       anime game's menus snap where the dial would ease, lean a little and slam between screens; a
 *                       western one's wipe and keep the dial's motion. Without one, the dial's motion and no cover
 *   faces               the font shelf's keys (image-outcomes/fonts): its vendored faces inlined as the theme's own
 *                       (`{ body?: '<key>', display?: '<key>' }`), a key not vendored adding nothing
 *
 *   manaThemeOfGuide(guide, { faces?, juice? })  → a theme mana-ui reads (readTheme)
 *   shelfFaces(key)                      → the key's faces as mana-ui theme faces [{ family, src, weight, style }]
 */
import { readTheme } from '../../../mana-ui/theme.js';
import { FONT_SHELF, fontFaceCss } from '../../image-outcomes/fonts/font-shelf.js';

const FRAME = { none: 'none', hairline: 'hairline', rule: 'rule', bevel: 'bevel', material: 'heavy' };
const PLATE = { clear: 'clear', flat: 'flat', solid: 'solid', textured: 'textured' };
const MOTION = { ease: 'ease', snap: 'snap', stepped: 'stepped', mechanical: 'stepped' };
const FACE = { system: 'system', mono: 'mono', serif: 'serif', display: 'display' };
const ORNAMENTS = ['brackets', 'ticks', 'scanlines', 'dotgrid', 'stitch', 'hazard', 'glow'];
const STOP_CORNER = { modern: 'round', clean: 'soft', framed: 'soft', console: 'square', immersive: 'square' };

/** The font shelf's vendored files for a key, as theme faces (none when the key's files are not vendored). */
export function shelfFaces(key) {
  if (!FONT_SHELF[key]) throw new Error(`no face '${key}' on the font shelf (${Object.keys(FONT_SHELF).join(', ')})`);
  const css = fontFaceCss(key), out = [];
  for (const m of css.matchAll(/font-family:'([^']+)';font-style:(normal|italic);font-weight:(\d+);[^}]*src:url\((data:[^)]+)\)/g)) {
    out.push({ family: m[1], style: m[2], weight: Number(m[3]), src: m[4] });
  }
  return out;
}

/** A world's UI guide as a mana-ui theme. */
const JUICE = ['anime', 'western'];

export function manaThemeOfGuide(guide, { faces = {}, juice } = {}) {
  if (!guide || typeof guide !== 'object' || !guide.tokens || !guide.dials) throw new Error('manaThemeOfGuide takes a UI guide (direction.js: { tokens, dials, font, border?, stop })');
  if (juice !== undefined && !JUICE.includes(juice)) throw new Error(`juice is the game's juice register: ${JUICE.join(' | ')}`);
  const t = guide.tokens, d = guide.dials, els = (guide.border && guide.border.elements) || [];
  const theme = {
    name: guide.border && guide.border.flavor ? `The world's ${guide.border.flavor} guide` : 'The world\'s guide',
    tokens: { ink: t.ink, panel: t.panel, line: t.line, accent: t.accent, accent2: t.accent2 },
    type: { body: FACE[guide.font] || 'system', display: d.type === 'display' || d.type === 'period' ? FACE[guide.font] || 'display' : FACE[guide.font] || 'system', mono: 'mono' },
    frame: els.includes('double') ? 'double' : FRAME[d.frame] || 'hairline',
    corner: els.includes('notch') ? 'cut' : els.includes('soft') ? 'soft' : STOP_CORNER[guide.stop] || 'soft',
    plate: els.includes('gradient') ? 'gradient' : PLATE[d.plate] || 'solid',
    // the console stops keep the classic ▶ cursor; the modern ones a ring
    focus: els.includes('brackets') ? 'bracket' : els.includes('glow') ? 'glow' : guide.stop === 'console' || guide.stop === 'immersive' ? 'marker' : 'ring',
    // an anime game's menus snap where the dial would only ease (a stepped or mechanical dial stays its own)
    motion: juice === 'anime' && (MOTION[d.motion] || 'ease') === 'ease' ? 'snap' : MOTION[d.motion] || 'ease',
    slant: juice === 'anime' ? 'light' : 'none',
    transition: juice === 'anime' ? 'slam' : juice === 'western' ? 'wipe' : 'none',
    fills: 'solid',
    case: guide.stop === 'console' || guide.stop === 'immersive' ? 'upper' : 'none',
    // the register's sound dial: a cue on every state change, or none
    cues: d.sound === 'cues' ? 'full' : 'silent',
    ornaments: els.filter((e) => ORNAMENTS.includes(e)),
  };
  // fonts you own, from the shelf: the families they bring name the body and the display
  const own = [];
  for (const role of ['body', 'display']) {
    if (faces[role] === undefined) continue;
    const got = shelfFaces(faces[role]);
    if (got.length) { own.push(...got); theme.type[role] = got[0].family; }
  }
  if (own.length) theme.faces = [...new Map(own.map((f) => [`${f.family}|${f.weight}|${f.style}`, f])).values()];
  readTheme(theme);
  return theme;
}
