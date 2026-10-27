/**
 * THE COMIC HERO PACK'S ITEM CARDS: what a hero holds or carries, each a card of the hero door's own `gear` words
 * (solid-vocab/layered.md hero-gear: `gear: { right?, left?, back?, hip? }`, each slot an equipment item's build words,
 * equipment/expand.js: the sword family, the staff, the bow, the shield, the firearms). A card names one slot and the
 * build that fills it; it never invents an item, so the gear is placed and held by its class as the door holds any (a
 * blade through the fist, a staff near upright, a shield along the forearm, a pistol holstered at the right thigh, a long
 * gun slung on the back muzzle down) on either body: the gear rides its bone, and both bodies are rigged. A card may name
 * the SWING word that suits it (the door's swing gestures: `chop`, `rising`, `plant`, `bash` …), which `memberOrders`
 * stands the hero in only when asked (`swing`).
 * A signature comic item with no builder is in ITEM_GAPS, said and never approximated.
 *
 *   ITEMS                        { <id>: { reads, family: 'shield' | 'blade' | 'staff' | 'bow' | 'sidearm' | 'longGun',
 *                                  eras: [era ids], slot: 'right' | 'left' | 'back' | 'hip', build: { item, style?, parts? },
 *                                  swing? } }
 *   ITEM_IDS, ITEM_GAPS
 *   withItems(spec, ids, body)   → the spec with those cards' gear in their slots (over any gear it had in another slot);
 *                                  two cards naming one slot are refused by name; no ids ⇒ the spec itself
 *   swingOf(ids)                 → the swing word the first card naming one suits, or null
 */
const BODIES = Object.freeze(['tiered', 'realistic']);
const card = (reads, family, eras, slot, build, swing = null) => ({ reads, family, eras, slot, build, ...(swing ? { swing } : {}) });

export const ITEMS = Object.freeze({
  // ── SHIELDS (on the left forearm, face outward) ──
  emblemShield: card('the emblem shield: a round shield banded in rings round a boss, carried on the forearm; the soldier hero, the sentinel', 'shield', ['silver', 'modern', 'movie'], 'left',
    { item: 'shield', style: 'celestial', parts: { outline: 'round', device: 'bands' } }, 'bash'),
  heaterShield: card('the heater shield: a heater with a chevron on its face; the crusader, the knight errant', 'shield', ['silver'], 'left',
    { item: 'shield', style: 'historical' }, 'bash'),
  // ── BLADES (through the fist; on the back hilt up over the right shoulder; at the left hip hilt forward) ──
  heroSword: card('the sword: a straight double-edged blade, a bar guard; the warrior, the crusader', 'blade', ['silver', 'modern'], 'right',
    { item: 'sword', style: 'historical' }, 'chop'),
  katana: card('the katana: a curved single-edged blade, a round guard, a long corded grip; the ronin, the swordswoman', 'blade', ['modern', 'movie'], 'right',
    { item: 'sword', style: 'eastern' }, 'rising'),
  slungKatana: card('the slung katana: the curved blade across the back, its hilt over the right shoulder; the ninja', 'blade', ['modern', 'movie'], 'back',
    { item: 'sword', style: 'eastern' }),
  combatKnife: card('the combat knife: a dagger at the left hip, hilt forward; the mercenary, the commando', 'blade', ['modern', 'movie'], 'hip',
    { item: 'dagger', style: 'historical' }),
  // ── STAVES (in the right hand, near upright, the heel above the floor) ──
  boStaff: card('the bo staff: a plain turned staff; the acrobat, the martial artist', 'staff', ['silver', 'modern'], 'right',
    { item: 'staff', style: 'historical' }, 'plant'),
  sceptre: card('the sceptre: a tall staff crowned by a crescent round a stone; the ruler, the sorcerer supreme', 'staff', ['silver', 'modern'], 'right',
    { item: 'staff', style: 'celestial' }, 'plant'),
  // ── BOWS (the riser in the left hand) ──
  recurveBow: card('the recurve bow: a recurved bow held at the riser; the archer', 'bow', ['silver', 'modern', 'movie'], 'left',
    { item: 'bow', style: 'historical', parts: { limb: 'recurve' } }),
  // ── SIDEARMS (a pistol: holstered at the right thigh, or at low ready in the hand) ──
  holster: card('the holstered sidearm: a service pistol at the right thigh, muzzle down; the detective, the soldier', 'sidearm', ['modern', 'movie'], 'hip',
    { item: 'pistol', style: 'service' }),
  rayHolster: card('the holstered ray pistol: a smooth sidearm with a lit band at the right thigh; the space hero', 'sidearm', ['silver', 'modern'], 'hip',
    { item: 'pistol', style: 'future' }),
  drawnPistol: card('the drawn sidearm: a service pistol at low ready; the gunslinger, the vigilante', 'sidearm', ['modern', 'movie'], 'right',
    { item: 'pistol', style: 'service' }),
  rayPistol: card('the ray pistol: a smooth sidearm with a lit band, at low ready; the space hero, the marksman', 'sidearm', ['silver', 'modern'], 'right',
    { item: 'pistol', style: 'future' }),
  // ── LONG GUNS (the film's: at low ready, or slung on the back muzzle down; a long gun has no hip) ──
  carbine: card('the carbine: at low ready in the hands; the commando', 'longGun', ['movie'], 'right',
    { item: 'carbine', style: 'service' }),
  slungCarbine: card('the slung carbine: across the back, muzzle down; the soldier between fights', 'longGun', ['movie'], 'back',
    { item: 'carbine', style: 'service' }),
  shotgun: card('the shotgun: at low ready; the monster hunter, the street enforcer', 'longGun', ['movie'], 'right',
    { item: 'shotgun', style: 'service' }),
});
export const ITEM_IDS = Object.freeze(Object.keys(ITEMS));

// signature comic items the equipment library has no builder for: each says what is missing and the nearest card
export const ITEM_GAPS = Object.freeze({
  hammer: 'no hammer head: the staff\'s `mace` head is a club on a staff\'s length, not a short-hafted hammer',
  throwingDisc: 'no thrown item: the round shield is held on the forearm (emblemShield); a throw is a game\'s motion, not a held build',
  grapplingGun: 'no launcher: the firearms are the pistol, the carbine and the shotgun',
  escrimaBatons: 'no short stick: the staff is a staff\'s length (boStaff)',
  whip: 'no flexible held item: a held build is rigid on its bone',
  spear: 'no spearhead or trident head on the staff (boStaff, sceptre are the staves)',
});

export function withItems(spec, ids, body) {
  const list = ids == null ? [] : Array.isArray(ids) ? ids : [ids];
  if (!list.length) return spec;
  if (!BODIES.includes(body)) throw new Error(`comic-hero: no body '${body}' (known: ${BODIES.join(', ')})`);
  for (const id of list) if (!ITEMS[id]) throw new Error(`comic-hero: no item card '${id}' (known: ${ITEM_IDS.join(', ')})`);
  const gear = { ...(spec.gear || {}) }, by = {};
  for (const id of list) {
    const C = ITEMS[id];
    if (by[C.slot]) throw new Error(`comic-hero: items '${by[C.slot]}' and '${id}' both fill the ${C.slot} slot (one item a slot)`);
    by[C.slot] = id;
    gear[C.slot] = { ...C.build, ...(C.build.parts ? { parts: { ...C.build.parts } } : {}) };
  }
  return { ...spec, gear };
}

/** the swing word the first card that names one suits (a shield's `bash`, a staff's `plant` …), or null */
export const swingOf = (ids) => (Array.isArray(ids) ? ids : [ids]).map((id) => ITEMS[id]?.swing).find(Boolean) ?? null;
