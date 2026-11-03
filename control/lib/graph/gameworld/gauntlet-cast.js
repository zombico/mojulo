/**
 * A WAVE GAUNTLET'S CAST (gauntlet.js): its foes stood dormant on the level's last stage, where gauntletPlacements puts
 * them, each as every hostile is (foes.js standFoe: its class, its figure, its hp), asleep until the wave-gauntlet
 * mechanic's spawn wakes it; and the pilot made hittable, as a stage with foes makes it (hostileCast's).
 *
 *   gauntletCast(G, level, ends, { refs, hero }) → { figures, entities, pilot } | null   (refs: the foes' made figures)
 */
import { standFoe, bestiaryOf, stompOf, targetRimOf } from './foes.js';
import { PERSON } from './quick.js';
import { gauntletPlacements } from './gauntlet.js';

export function gauntletCast(G, level, ends, { refs = {}, hero = true } = {}) {
  const E = G.levels[level]?.goal?.gauntlet;
  if (!E) return null;
  const B = bestiaryOf(G), figures = {}, entities = [], part = { figures, entities }, ctx = { rim: targetRimOf(G), sheets: {} };
  for (const wave of gauntletPlacements(E, ends).waves) for (const p of wave) standFoe(G, part, { ...p, entry: B[p.eid] }, { ref: refs[p.eid] ?? null, more: { dormant: true, modeRefs: refs }, ctx });
  const pilot = { ...(hero ? { rule: { stomp: stompOf(G) } } : {}), body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } } };
  return { figures, entities, pilot };
}
