/**
 * depiction — what a scene shows and how it is drawn, said the way an encyclopedia entry says it.
 *
 * Two questions, kept apart:
 *  - PERIOD: when and where the scene is set (a culture's span, the year it is read at, its place), or none;
 *  - DEPICTION: how it is drawn — an ERA (the hardware budget: `sixth-gen`) and a LOOK over it (a style card,
 *    a reference title).
 * Any period can be drawn in any depiction. The caption says both in one line:
 *
 *     New Kingdom Thebes · New Kingdom, c. 1550–1070 BCE (read at c. 1250 BCE) · Thebes, Upper Egypt
 *       — drawn sixth-gen, to the thebes style card
 *
 * Read from the cards, never guessed: no years say `no period`; `place: null` says the place is invented; a card
 * silent about its place says `place not recorded`. Pure: the same manifest gives the same text.
 */
import { HISTORIC_CULTURES } from './historic/historic-city.js';
import { REGION_CULTURES } from './historic/historic-region.js';
import { FARM_CULTURES } from './historic/farmstead.js';
import { WORKS_CULTURES } from './historic/workshops.js';
import { HISTORIC_STYLES } from './historic/style/index.js';
import { SIXTH_GEN } from './era/sixth-gen.js';

const LAND = { sumer: 'sumer', thebes: 'egypt' };

/** A year as the caption says it: 1250 BCE, 212 BCE, 1066 CE. */
export function fmtYear(y) { return y < 0 ? `${-y} BCE` : `${y} CE`; }

/** A span: both ends in one era share its word (c. 1550–1070 BCE); across the turn each end keeps its own. */
export function fmtSpan([a, b]) {
  return (a < 0) === (b < 0) ? `c. ${Math.abs(a)}–${Math.abs(b)} ${a < 0 ? 'BCE' : 'CE'}` : `c. ${fmtYear(a)}–${fmtYear(b)}`;
}

/** A historic culture's PERIOD: `{ name, years, readAt }`, or null for a card without years. */
export function periodOf(card) {
  if (!card || !Array.isArray(card.years)) return null;
  return { name: card.period || null, years: card.years, readAt: Number.isFinite(card.readAt) ? card.readAt : null };
}

/** The period in words: "New Kingdom, c. 1550–1070 BCE (read at c. 1250 BCE)", or "no period". */
export function periodText(p) {
  if (!p) return 'no period';
  const span = fmtSpan(p.years), at = p.readAt === null ? '' : ` (read at c. ${fmtYear(p.readAt)})`;
  return `${p.name ? `${p.name}, ` : ''}${span}${at}`;
}

/** What a historic scene shows: the town is the culture; its land, farm and works are their own cards' subjects. */
function historicSubject(culture, scene) {
  if (scene === 'region') return REGION_CULTURES[culture]?.label;
  if (scene === 'farm') return FARM_CULTURES[LAND[culture]]?.label;
  if (scene === 'works') return WORKS_CULTURES[LAND[culture]]?.label;
  return HISTORIC_CULTURES[culture].label;
}

/**
 * The infobox of a historic manifest (`{ kind: 'historic', culture, scene }`): subject, period, place,
 * depiction and the caption. An unknown culture returns null (the kind itself refuses it).
 */
export function describeHistoric(m = {}) {
  const card = HISTORIC_CULTURES[m.culture];
  if (!card) return null;
  const scene = m.scene ?? 'city';
  const subject = historicSubject(m.culture, scene) || card.label;
  const period = periodOf(card);
  // `place: null` says the town is invented; a card that says nothing about its place is not guessed at
  const place = card.place === null ? 'invented' : typeof card.place === 'string' ? card.place : 'place not recorded';
  const style = HISTORIC_STYLES[m.culture] ? m.culture : null;
  const depiction = { era: SIXTH_GEN.id, look: style ? { style } : null };
  const drawn = `drawn ${depiction.era}${style ? `, to the ${style} style card` : ''}`;
  const caption = `${subject} · ${periodText(period)} · ${place === 'invented' ? 'invented place' : place} — ${drawn}`;
  return { subject, period, place, depiction, caption };
}
