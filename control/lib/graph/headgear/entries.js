// headgear/entries — the HEADGEAR CARD for the solid vocabulary, generated from the library (cards.js, helmets.js) at
// load (solid-vocab/loader.js), never hand-written: every word the hero door's `headgear` takes, by family, what it is,
// and the bodies it is fitted to. Found by search, read by id ('headgear').
import { HEADGEAR_WORDS, headgearOf } from './wear.js';

export function headgearCard() {
  const byFamily = {};
  for (const w of HEADGEAR_WORDS) { const H = headgearOf(w); (byFamily[H.tradition ? 'helmet by tradition' : H.family] ||= []).push(H); }
  const realistic = HEADGEAR_WORDS.filter((w) => headgearOf(w).fits.includes('realistic'));
  const lines = ['# Headgear', '',
    "Masks, cowls, eyegear, mouthpieces, helmets, respirators and visors, each a word a hero wears: `headgear: '<word>'` on the hero's spec (create_character as 'hero', or update_character { spec: { headgear } } to swap it; null takes it off). The word is kept on the hero and lowered on every read, so a swap re-dresses it in place. A card's colours sit beneath the hero's palette: name a group (Helmet, HelmetVisor, HelmetTrim, Mask, MaskLens, EyeLens, EyeGlow …) in `palette` to recolour it. A helmet drops the hair.", '',
    `Every word fits the game body (form: 'tiered'); the realistic body (form: 'realistic') wears ${realistic.join(' and ')} alone. A helmet by tradition is worn as an outfit build's language head, so it needs an outfit build (outfit: { type: 'outfit', style }); its cover, band, net and mount stay the outfit's (outfit.language.head).`, ''];
  for (const [f, list] of Object.entries(byFamily)) {
    lines.push(`## ${f}`, '');
    for (const H of list) lines.push(`- \`${H.word}\` — ${H.reads}${H.fits.includes('realistic') ? ' (both bodies)' : ''}`);
    lines.push('');
  }
  return {
    id: 'headgear', name: 'Headgear: masks, cowls, eyegear and helmets a hero wears by word', family: 'figure', entry: 'create_character', generated: true,
    summary: `Every headgear word the hero door takes, by family (${Object.keys(byFamily).join(', ')}), and the bodies each fits.`,
    when: '"give him a helmet", "a masked vigilante", "a cowl with bat ears", "goggles", "a gas mask", "a ninja mask", "a visor", "a space helmet", "a gladiator helmet", "a skull mask", "which masks / helmets are there"',
    body: lines.join('\n').trim(),
  };
}
