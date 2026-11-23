/**
 * THE WARDROBE — what a party member looks like in the armour it wears. One figure is minted per member per LOOK, each
 * the member's own body and dress under the armour's (the hero door's `adorn`: an armour build, armor/styles.js), so the
 * page can show the member in what it has on (a level's figure swapped to the look's, as a livery's is). The armour
 * slot alone sets the look: it is what changes the outline; weapons are held (each member's battle figure holds its
 * class's), and a cloth armour (a robe, a gi) leaves the member's own outfit as it is.
 *
 *   battles.wardrobe: true | { <armour item>: { adorn } | null } | false   the presets, or the book's own over them (null:
 *                    that armour changes nothing); absent or false, no looks are minted
 *   WARDROBE         the presets: each armour item of the presets (playscape/rpg/presets.js GEAR_PRESETS) → { adorn }
 *   wardrobeOf(G)    → { <armour item>: { adorn } } the book's looks, or null
 *   wardrobeLooks(G, cfg) → [{ member, item, adorn }] each member's look for each armour its class may wear (`cfg`: the
 *                    battles' read play.rpg, its party and gear)
 *   lookKey(member, item) → the run's step key for it (hero-look-<item>, cast-<member>-look-<item>)
 *
 * A new armour's look is a row. Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// (leather armour a laced jerkin, armor/leather.js; chain mail a hauberk of rings with its coif, armor/mail.js)
export const WARDROBE = Object.freeze({
  'leather-armor': Object.freeze({ adorn: Object.freeze({ type: 'armor', style: 'jerkin' }) }),
  'chain-mail': Object.freeze({ adorn: Object.freeze({ type: 'armor', style: 'hauberk' }) }),
});

/** The book's wardrobe read: true (the presets), its own table over them, or false. Throws teaching. */
export function readWardrobe(v, err) {
  if (v === undefined || v === false || v === true) return;
  if (!isObj(v)) throw err('.wardrobe is true (the presets), { <armour item>: { adorn } | null } (its own over them) or false: what each member looks like in the armour it wears');
  for (const [k, w] of Object.entries(v)) {
    if (w === null) continue;
    if (!isObj(w) || Object.keys(w).some((x) => x !== 'adorn') || !isObj(w.adorn)) throw err(`.wardrobe.${k} is { adorn: <an armour build { type: 'armor', style, dials? }> } or null`);
  }
}

/** The book's looks by armour item, or null (none asked). */
export function wardrobeOf(G) {
  const v = G.battles?.wardrobe;
  if (!v) return null;
  const table = { ...WARDROBE, ...(isObj(v) ? v : {}) };
  return Object.fromEntries(Object.entries(table).filter(([, w]) => w).map(([k, w]) => [k, { adorn: structuredClone(w.adorn) }]));
}

/** Each party member's look for each armour of the wardrobe its class may wear. */
export function wardrobeLooks(G, cfg) {
  const W = wardrobeOf(G);
  if (!W || !cfg) return [];
  const out = [];
  for (const p of cfg.party) for (const [item, w] of Object.entries(W)) {
    const g = cfg.gear[item];
    if (!g || g.slot !== 'armor') continue;
    // (a member that may change class may wear what any of its classes may)
    const classes = p.classes ?? [p.cls];
    if (g.classes && !classes.some((c) => g.classes.includes(c))) continue;
    out.push({ member: p.id, item, adorn: w.adorn });
  }
  return out;
}

export const lookKey = (member, item) => (member === 'hero' ? `hero-look-${item}` : `cast-${member}-look-${item}`);
