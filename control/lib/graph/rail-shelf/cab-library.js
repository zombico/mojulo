/** The cab cards: small, replayable designs (an archetype, a livery, a few numbers), composed by preset. Generic. */
import { compileCabSurface } from './cab-surface.js';

const card = (title, brief, surface) => Object.freeze({ title, brief: Object.freeze(brief), surface: Object.freeze(surface) });
export const CAB_LIBRARY = Object.freeze({
  metroCab: card('Metro cab car', { archetype: 'metro' }, { livery: 'silver' }),
  tramFront: card('Streetcar front module', { archetype: 'tram' }, { livery: 'crimson' }),
  regionalCab: card('Regional unit cab car', { archetype: 'regional' }, { livery: 'white' }),
  highSpeedNose: card('High-speed power car', { archetype: 'highSpeed' }, { livery: 'white' }),
  boxCabLoco: card('Box-cab electric locomotive', { archetype: 'boxCab' }, { livery: 'green' }),
});
export function composeCab({ preset = 'metroCab', seed = 1, brief = {}, surface = {} } = {}) {
  const entry = Object.hasOwn(CAB_LIBRARY, preset) ? CAB_LIBRARY[preset] : null;
  if (!entry) throw new Error(`rail-cab: unknown preset ${preset} (known: ${Object.keys(CAB_LIBRARY).join(', ')})`);
  const b = { ...entry.brief, ...brief, seed }, s = { ...entry.surface, ...surface };
  return { ...compileCabSurface(b, s), composition: { preset, seed, brief: b, surface: s } };
}
