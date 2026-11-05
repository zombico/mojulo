/**
 * THE BROADCAST AS A MANA-UI THEME — one production for a sport: the menus around the play (the title, the pause, the
 * team select, the results after the board) wear the coverage's look, and their side chips the coverage's kits. The
 * package (broadcast-package.js broadcastData: the card, the colours already kept apart in OKLab and under CVD, the
 * metals, the ink chosen by WCAG) becomes a theme of mana-ui's closed words (control/lib/mana-ui/theme.js):
 *
 *   glass (its lower stop) → panel, the ink on the glass → ink, the rim's lit stop → line (no rim: a glass edge), the
 *   accent metal's lit stop → accent (no metal: the ink), the referee's amber → accent2, the sides' bases → sides;
 *   rim 0 → no frame, cel or a heavy rim → heavy, else a rule; a slant → a cut corner, a large radius → round, a small
 *   one → soft; the table's grain → a textured plate, a two-stop glass → a gradient, a thin glass → flat; a slam (back)
 *   → snap, the other eases → ease; a slant's focus fills, cel glows, the rest a marker; the face → the nearest stack
 *   (condensed sans → system, a slab's Impact → display, rounded → rounded, a book face → serif); caps → upper case
 *
 *   manaThemeOfBroadcast(data) → a theme mana-ui reads (readTheme)
 */
import { readTheme } from '../../mana-ui/theme.js';
import { hexRgb, rgbHex } from './broadcast-package.js';

const lit = (stops, at = 0.16) => (Array.isArray(stops) && stops.length ? (stops.find((s) => s[0] >= at) || stops[0])[1] : null);
const mix = (a, b, t) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * t));
const FACE = (face) => (/Impact|Haettenschweiler/.test(face) ? 'display' : /Rounded|Nunito/.test(face) ? 'rounded' : /Palatino|Iowan|Georgia|Antiqua/.test(face) ? 'serif' : 'system');

/** A broadcast package's data (broadcastData) as a mana-ui theme. */
export function manaThemeOfBroadcast(data) {
  if (!data || !data.card || !Array.isArray(data.colors)) throw new Error('manaThemeOfBroadcast takes the broadcast\'s data (broadcast-package.js broadcastData)');
  const C = data.card, panel = C.glass[1], ink = data.glassInk;
  const line = lit(data.metal.rim) ?? mix(C.glass[0], ink, 0.35);
  const theme = {
    name: `The ${data.package} broadcast`,
    tokens: { ink, panel, line, accent: lit(data.metal.accent) ?? ink, accent2: data.tones.warn.base },
    type: { body: FACE(C.face), display: FACE(C.face), mono: 'mono' },
    frame: !C.rim ? 'none' : C.cel || C.rim >= 3 ? 'heavy' : 'rule',
    corner: C.slant > 0 ? 'cut' : C.radius >= 10 ? 'round' : C.radius >= 3 ? 'soft' : 'square',
    plate: C.grain ? 'textured' : C.glass[0] !== C.glass[1] ? 'gradient' : C.glassAlpha < 0.9 ? 'flat' : 'solid',
    focus: C.slant > 0 ? 'fill' : C.cel ? 'glow' : 'marker',
    motion: C.ease === 'back' ? 'snap' : 'ease',
    fills: 'solid',
    case: C.caps === false ? 'none' : 'upper',
    ornaments: [],
    sides: data.colors.map((c) => c.base).slice(0, 8),
  };
  readTheme(theme);
  return theme;
}
