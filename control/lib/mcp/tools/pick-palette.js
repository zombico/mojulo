/**
 * pick_palette — the color theorist's door (lib/graph/color-theorist/): a palette solved for what a world is trying
 * to be. The agent reads the world's words into three axes (heat, weight, activity), a scheme and a key; the solver
 * owns value, chroma, the ramps and the checks. Nothing is stored: the answer is the spec to pass on — a gameworld's
 * `style.palette` (design_game), `create_game`'s `palette`, `create_cover`'s `palette` — and what it solves to, every
 * time the same.
 */
import { registerTool } from '@/lib/mcp/server';
import { readPaletteSpec, solvePalette, PALETTE_SCHEME_IDS, PALETTE_KEYS, PALETTE_ROLES } from '@/lib/graph/color-theorist/solve.js';
import { coverPalette } from '@/lib/graph/color-theorist/adapters.js';
import { freshPaletteSeed } from '@/lib/graph/color-theorist/stamp.js';

const SPEC_FIELDS = ['seed', 'intent', 'heat', 'weight', 'activity', 'scheme', 'key', 'hue', 'hues', 'lock'];

export function pickPaletteHandler(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`pick_palette takes { ${SPEC_FIELDS.join('?, ')}?, variants? }`);
  const { variants = 1, ...rest } = input;
  if (!(Number.isInteger(variants) && variants >= 1 && variants <= 6)) throw new Error('pick_palette: variants is 1 to 6 (palettes from consecutive seeds, to choose between)');
  const spec = readPaletteSpec(rest, 'pick_palette');
  if (spec === false || spec === 'auto') throw new Error('pick_palette takes a spec object');
  const seed = spec.seed ?? freshPaletteSeed();
  const palettes = Array.from({ length: variants }, (_, i) => {
    const K = solvePalette({ ...spec, seed: seed + i }), failing = K.checks.filter((c) => !c.ok);
    return {
      palette: K.spec, id: K.id, read: K.read, roles: K.roles, light: K.light, shadow: K.shadow, fog: K.fog, ui: K.ui, cover: coverPalette(K),
      checks: `${K.checks.length - failing.length} of ${K.checks.length} laws hold`,
      ...(failing.length ? { failing: failing.map(({ law, want, value }) => ({ law, want, value })) } : {}),
    };
  });
  return {
    ok: true,
    palettes,
    use: 'Pass a `palette` (the spec) on: design_game world.style.palette (recolours the land from its kit or look, and skins the game\'s HUD), create_game palette, create_cover palette, design_interior palette (the room\'s 60-30-10, its card\'s forms kept), a room stage\'s art: { palette: { from: spec } }. Change what it read (heat, weight, activity, scheme, key, hue, hues, lock) or the seed to move it; the same spec always solves the same.',
  };
}

export function registerPickPaletteTools() {
  registerTool({
    name: 'pick_palette',
    description:
      "Solve a colour palette for what a world, game or cover is trying to be, by colour theory instead of a stock kit: value first (the key), a chroma budget, hue relations by scheme, ramps with warm light and cool shadow, then checked (sky brightest, a unique accent, reads in grey, HUD contrast, colour-blind eyes, no clichés, not a stock kit). Read the words into heat (cool −1…warm 1), weight (light −1…heavy 1), activity (calm −1…active 1); the rest is rolled from the seed. Returns each palette's spec (pass it as `palette` to design_game's world.style, create_game, create_cover, design_interior, or a stage's art.palette.from), role ramps, HUD tokens and checks. Stores nothing.",
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'The words the palette is read from (recorded on it; the axes are yours to read).' },
        heat: { type: 'number', description: 'Cool (−1) to warm (1).' },
        weight: { type: 'number', description: 'Light and airy (−1) to dark and heavy (1); sets the key when `key` is left out.' },
        activity: { type: 'number', description: 'Calm and muted (−1) to active and saturated (1): the chroma ceiling.' },
        scheme: { type: 'string', enum: PALETTE_SCHEME_IDS, description: 'How the hues relate (mono-accent: a near-grey world and one accent; duotone: two hues only).' },
        key: { type: 'string', enum: Object.keys(PALETTE_KEYS), description: 'Where the values sit (from weight when left out).' },
        hue: { description: "The world's own hue: OKLCH degrees, a '#hex', or a colour word (rust, ochre, teal, violet, …)." },
        hues: { type: 'object', description: `A hue per role (${PALETTE_ROLES.filter((r) => r !== 'far').join(', ')}).` },
        lock: { type: 'object', description: "A role's middle stop kept exactly: { <role>: '#hex' }." },
        seed: { type: 'integer', description: 'The dice for what the spec leaves open (rolled when left out; returned in the spec).' },
        variants: { type: 'integer', description: 'How many palettes to choose between, from consecutive seeds (1–6, default 1).' },
      },
    },
    handler: pickPaletteHandler,
  });
}
