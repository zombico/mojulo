/**
 * THE BEAST'S STYLE ON ITS BODY: an ooze's colours, glow and materials over the tiered body (no geometry: the plan's
 * palette, `emissive`, `surfaces`). The oozes' MARKS are not painted here: the fauna's run × t windows are a
 * quadruped's frame (its t from the spine down to the belly, its run from the rump to the chest) and read inside out on
 * an upright body; they are pending until a biped's own pattern solver paints them (./ooze.js `pending`).
 *
 *   beastTone(plan, hero)    → the plan with its coat toned by its oozes' colour layers (darkened, greyed, saturated,
 *                              tinted), before the head is dressed in the coat's colour; nothing else moves
 *   beastStyle(plan, hero)   → the plan with its crest's and claws' tone, glow and material, its eyes' glow, its oozes'
 *                              recoloured groups and surfaces; the last pass
 *
 * Absent an ooze, both return the plan as given. Pure.
 */
import { beastCard } from './tiered.js';
import { colorWords, pushTone, COLOR_WORDS } from '../mutagen/push.js';

const HEX = /^#[0-9a-f]{6}$/i;

// the coat's groups a tone reaches: the bare body's, or a lower coat's own
const coatGroups = (card) => card.coat ?? ['Skin', 'Top', 'Bottom', 'Shoes', 'Hair', 'Brow'];

export function beastTone(plan, hero) {
  const card = beastCard(hero), P = card?.ooze?.push;
  if (!P || !(P.coat || P.desaturate || P.saturate || P.tints?.length) || !plan.palette) return plan;
  const palette = { ...plan.palette };
  for (const g of coatGroups(card)) if (HEX.test(palette[g] ?? '')) palette[g] = pushTone(palette[g], P);
  return { ...plan, palette };
}

export function beastStyle(plan, hero) {
  const card = beastCard(hero); if (!card) return plan;
  const L = card.ooze; if (!L) return plan;
  const palette = { ...(plan.palette ?? {}) }, emissive = new Set(plan.emissive ?? []), surfaces = { ...(plan.surfaces ?? {}) };
  let heads = null;
  {
    // THE CREST in its own group (./detail.js reads it), its tone the hackles' or the motif's, its glow and its material
    if (L.spines && card.ridge === 'spines') {
      palette.Spines = L.spines.color ?? palette.Claws ?? card.claw;
      if (L.spines.glow) emissive.add('Spines');
      if (L.spines.material) surfaces.Spines = L.spines.material;
    }
    if (L.claw) { if (L.claw.glow) emissive.add('Claws'); if (L.claw.material) surfaces.Claws = L.claw.material; }
    if (L.eyes?.glow) for (const g of ['Iris', 'Pupil']) emissive.add(g);
    for (const [g, m] of Object.entries(L.surfaces)) surfaces[g] = m;
    // (a group recoloured where the body or its head has it: the colour words against the coat)
    const W = colorWords(palette[coatGroups(card)[0]] ?? palette.Skin ?? '#8a7a6a');
    for (const [g, v] of Object.entries(L.groups)) {
      const cur = (heads ?? plan.heads)?.[0], hp = cur?.plan, onHead = !!hp?.palette?.[g], onBody = g in palette; if (!onHead && !onBody) continue;
      const c = COLOR_WORDS.includes(v.color) ? W[v.color] : v.color;
      if (onBody) palette[g] = c;
      if (onHead) heads = [{ ...cur, plan: { ...hp, palette: { ...hp.palette, [g]: c } } }, ...(heads ?? plan.heads).slice(1)];
      if (v.material) surfaces[g] = v.material;
      if (v.glow) emissive.add(g);
    }
  }
  return { ...plan, palette, ...(heads ? { heads } : {}), ...(emissive.size ? { emissive: [...emissive] } : {}), ...(Object.keys(surfaces).length ? { surfaces } : {}) };
}
