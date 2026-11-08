// The game UI runtime's wireframe board (control/lib/mana-ui/board.js), written as one page to open in a browser: every
// idiom live on the sample state, driven by the controls layer (keys and pads, through the control schemes), its
// legends in the glyphs of the device in hand, and heard: the UI's sounds (beats/ui-sounds.js) in the set the chosen
// look names, played as the live frame is driven. The eyes and ears gate's page; it loads nothing from anywhere.
//
//   node scripts/mana-board.mjs <out.html> [--theme <preset | card>] [--cards] [--silent]
//
// --cards lays the theme cards (playscape/ui/theme-cards/) beside the presets in the board's switcher, so a card a model
// wrote is seen over every idiom (a card from `world` over the greybox's stand-in).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
const cwd = process.env.INIT_CWD || process.cwd();
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const out = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--theme'));
if (!out) { console.error('usage: node scripts/mana-board.mjs <out.html> [--theme <preset | card>] [--cards] [--silent]'); process.exit(2); }

const { manaUiBoard, THEME_IDS, THEMES } = await import('@/lib/mana-ui/index.js');
const { cardThemes, THEME_CARD_IDS } = await import('@/lib/graph/playscape/ui/theme-cards/loader.js');
const { manaControls, manaGlyphs, manaHostSource } = await import('@/lib/graph/controls/mana-controls.js');
const { padLayoutSource } = await import('@/lib/graph/scene/channels/interact-channel.js');
const { uiSoundAudio } = await import('@/lib/graph/beats/ui-sounds.js');

const theme = flag('--theme') || 'greybox', cards = args.includes('--cards') || THEME_CARD_IDS.includes(theme);
if (!THEME_IDS.includes(theme) && !THEME_CARD_IDS.includes(theme)) { console.error(`--theme is a preset (${THEME_IDS.join(', ')}) or a card (${THEME_CARD_IDS.join(', ')})`); process.exit(2); }
const C = manaControls();
const page = manaUiBoard({
  theme,
  themes: cards ? { ...THEMES, ...cardThemes() } : THEMES,
  host: { source: manaHostSource(), controls: { keys: C.keys, pad: C.pad, padLayoutSource: padLayoutSource() } },
  glyphs: manaGlyphs(),
  audio: args.includes('--silent') ? null : uiSoundAudio(),
});
const file = path.resolve(cwd, out);
writeFileSync(file, page);
console.log(`${file} (${Math.round(page.length / 1024)} KB): click a frame to drive it; switch the look at the top`);
