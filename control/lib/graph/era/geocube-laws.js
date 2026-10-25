/**
 * A CUBE'S AVOID LIST — the mistakes a style names, each checked by a law. A style's prompt says what it is (the cube's
 * `why`) and then what it must not become; here each of those lines names the law that measures it:
 *
 *   avoid: [{ line: 'Noisy realistic textures.', law: 'quiet-surfaces' }, …]
 *
 * A law is one of the color theorist's (color-theorist/solve.js PALETTE_LAWS, read off the contract the cube's colours
 * were solved from) or one of the cube's own below (measured on the cube itself). The readout is written on each line
 * when the cube is read, `{ line, law, ok, value }`: advice, the machine gate; it never refuses (the eyes gate stays the
 * operator's). A palette law on a cube with no solved palette is unmeasured (`ok: null`): its colours are its own.
 *
 *   CUBE_LAWS                  the cube's own laws: { <law>: { want, test(cube) → { ok, value } } }
 *   readAvoid(avoid, no)       the list as written, checked (every law exists)
 *   measureAvoid(cube, checks) the list with its readout; `checks` the solved contract's, or null
 */
import { PALETTE_LAWS } from '../color-theorist/solve.js';
import { registerInkLaw } from './colour-register.js';

// the noise a quiet surface keeps under: a block's own shift (`vary`) and the speckle in every texel (`grain`), on the
// 0–255 scale the tile generators take them (the cube's stock stone is 28 and 11; a quiet one about half)
export const QUIET = Object.freeze({ vary: 14, grain: 8 });

export const CUBE_LAWS = Object.freeze({
  'quiet-surfaces': {
    want: `the surfaces are quiet: each tile's block shift (vary) at most ${QUIET.vary} and its speckle (grain) at most ${QUIET.grain}`,
    test: (cube) => {
      const loud = [], open = [];
      for (const [k, s] of Object.entries(cube.surfaces)) {
        if (s.vary === undefined && s.grain === undefined) { open.push(k); continue; }
        if ((s.vary ?? 0) > QUIET.vary || (s.grain ?? 0) > QUIET.grain) loud.push(`${k} (vary ${s.vary ?? 0}, grain ${s.grain ?? 0})`);
      }
      return { ok: !loud.length, value: `${loud.length ? `loud: ${loud.join(', ')}` : 'all quiet'}${open.length ? ` · its generator's own: ${open.join(', ')}` : ''}` };
    },
  },
  // the register's inks (colour-register.js): under every colour the world is painted in, the creases in the shade's hue
  'register-ink': {
    want: 'the register\'s inks sit under the darkest stop of every ramp, and the creases\' ink keeps to the shade\'s hue',
    test: (cube) => registerInkLaw(cube),
  },
});

// (read when asked, not at load: the solver reaches this module through the stage, so it may not be loaded yet)
const lawIds = () => [...PALETTE_LAWS.map((l) => l.law), ...Object.keys(CUBE_LAWS)];

/** `avoid` as written: one line each, and a law that exists. A line already measured keeps its readout. */
export function readAvoid(avoid, no) {
  if (!Array.isArray(avoid) || !avoid.length) no('avoid is [{ line, law }]: the mistakes the style names, each with the law that checks it');
  avoid.forEach((a, i) => {
    const at = `avoid[${i}]`;
    if (a === null || typeof a !== 'object' || Array.isArray(a)) no(`${at} is { line, law }`);
    for (const k of Object.keys(a)) if (!['line', 'law', 'ok', 'value'].includes(k)) no(`${at}.${k} is not part of an avoid line (line, law)`);
    if (typeof a.line !== 'string' || !a.line.length || a.line.length > 200) no(`${at}.line is the mistake, one line (200 characters at most)`);
    const ids = lawIds();
    if (!ids.includes(a.law)) no(`${at}.law '${a.law}' is not a law (${ids.join(', ')})`);
  });
}

/** Each line with its readout: a cube law measured on the cube, a palette law read off the solved contract's checks
 * (`checks`), or kept as it was measured when the cube was solved (a cube read again). */
export function measureAvoid(cube, checks) {
  return cube.avoid.map(({ line, law, ok: was, value: wasValue }) => {
    if (CUBE_LAWS[law]) return { line, law, ...CUBE_LAWS[law].test(cube) };
    const c = checks?.find((x) => x.law === law);
    if (c) return { line, law, ok: c.ok, value: c.value };
    if (was !== undefined && checks === null && cube.palette?.id) return { line, law, ok: was, value: wasValue };
    const why = checks ? `its palette ${cube.palette.id} does not read ${law}` : cube.palette?.id ? 'unmeasured: written after the palette was solved' : 'unmeasured: the cube\'s colours are its own, not solved';
    return { line, law, ok: null, value: why };
  });
}
