/**
 * A PALETTE ON A KIT — the stock kits are the starting point: a palette recolours a base kit (a written kit, or a look
 * the world composed from words) and keeps everything else it is — its ramp lengths and tile windows, its grammar, its
 * flora, its air. It goes through the land tunnel's own domain (gameworld/tunnel-land.js): the base taken apart into
 * facets, the swatches swapped, the look built, the look laws read and the tunnel's own tweaks applied until they
 * hold, and the result registered as a look (era/style/looks.js) under an id its content decides — so a world, a
 * stage and a sheet name it as they name any kit.
 *
 *   paletteLook(spec, { base, name }) → { id, base, contract, laws, tweaks }
 *   ensureLooks(chain)                  the looks a stored stage names, composed again where this process lacks them
 *
 * Pure but for the look registry, which is content-addressed: the same spec on the same base registers the same look.
 */
import { landDomain, composeLook } from '../gameworld/tunnel-land.js';
import { registerLook, lookOf } from '../era/style/looks.js';
import { solvePalette, fingerprint } from './solve.js';
import { landSwatches, lightOf } from './adapters.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 3).join('-') || 'palette';
const PASSES = 4;

export function paletteLook(spec, { base = 'isekai-meadow', name } = {}) {
  const K = solvePalette(spec), D = landDomain();
  let c;
  try { c = D.start(K.spec.seed ?? 1, base); } catch (err) { throw new Error(`palette: ${err.message.replace(/^tunnel: land: /, '')}; a palette recolours a kit with land ramps`); }
  c = clone(c);
  c.swatches = landSwatches(K, c.swatches);
  c.facets.sky.light = lightOf(K, c.facets.sky.light);
  c.hazeFromFar = true;
  // the tunnel's laws, and its own fixes for what fails (a ramp sorted, a shade lifted, the far layers laid again)
  let L = D.build(c), laws = D.laws(L);
  const tweaks = [];
  for (let i = 0; i < PASSES && laws.some((l) => !l.ok); i += 1) {
    const t = D.tweak(c, { laws: laws.filter((l) => !l.ok) });
    c = t.candidate; tweaks.push(...t.changed);
    L = D.build(c); laws = D.laws(L);
  }
  const id = `${slug(name ?? K.spec.intent ?? 'palette')}-${fingerprint([c.base, K.id, L.card, L.swatches]).slice(0, 6)}`;
  const principles = [...(L.card.principles ?? []), `Recoloured by the palette ${K.id}: ${K.read.scheme} (${K.read.says}), a ${K.read.key} key${K.spec.intent ? `, read from "${K.spec.intent}"` : ''}.`];
  const look = registerLook({ id, base: c.base, read: K.spec.intent ?? `palette ${K.id}`, card: { ...L.card, principles }, swatches: L.swatches });
  return { id: look.id, base: c.base, contract: K, laws: laws.map(({ law, ok, value }) => ({ law, ok, value })), tweaks };
}

/**
 * The looks a stored stage is drawn in, composed again where they are missing: the registry is the process's own, so
 * a stage minted from a palette world carries the chain that makes its kit (`manifest.looks`, base first). Each must
 * come back under the id it was stored with, or the stage says so rather than draw in some other colours.
 */
export function ensureLooks(chain) {
  if (!Array.isArray(chain)) return;
  for (const r of chain) {
    if (!r || typeof r.id !== 'string' || lookOf(r.id)) continue;
    const got = r.palette !== undefined ? paletteLook(r.palette, { base: r.base, name: r.name }).id : composeLook(r.look, { seed: r.seed, base: r.base, name: r.name }).id;
    if (got !== r.id) throw new Error(`looks: '${r.id}' composes as '${got}' now: the look it was drawn in has changed`);
  }
}
