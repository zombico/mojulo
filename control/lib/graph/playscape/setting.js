/**
 * setting — the one vocabulary every playscape shelf tags its entries with, so shelves that never share code can
 * still be composed into one world without a sofa turning up in a lich's crypt.
 *
 * A SETTING is a value on up to three axes. A world has one value per axis (or none: unconstrained on it). A shelf
 * entry lists the values it belongs in, per axis (an axis it omits fits any world). The shelves keep their own tags
 * beside their own rows (glyph-forms.js, glyph-sfx.js, props.js, …); this module owns only the words and the rule.
 *
 *   fitSetting(entry, world) → { fits, misses: [{ axis, world, entry }] }
 *   admit(entries, world, { named }) → what the builder may draw from, and what was named off-setting
 *
 * The rule is the playscape's taste gate. Drawing on its own, the builder takes only entries that fit; nothing that
 * misses ever arrives unasked. An entry the recipe NAMES is kept whatever its setting (the operator really wants it)
 * and stamped with what it misses. Like every gate here it advises and stamps; it never refuses a named thing.
 */

export const SETTING_AXES = Object.freeze({
  // when the things in it were made
  era: Object.freeze(['ancient', 'medieval', 'early-modern', 'modern', 'future']),
  // what the place is for
  place: Object.freeze(['funerary', 'sacred', 'domestic', 'civic', 'industrial', 'wild', 'arcade']),
  // what is real in it: grounded (nothing that could not be), fantasy (magic), sci-fi (invented technology), toy
  // (the bright game-UI language: stars and hearts that float)
  fiction: Object.freeze(['grounded', 'fantasy', 'sci-fi', 'toy']),
});
export const AXIS_IDS = Object.freeze(Object.keys(SETTING_AXES));

/** A world setting's faults: each axis a single known value. */
export function settingErrors(world, where = 'setting') {
  if (!world || typeof world !== 'object' || Array.isArray(world)) return [`${where} must be { ${AXIS_IDS.join('?, ')}? }`];
  const errors = [];
  for (const [axis, v] of Object.entries(world)) {
    if (!SETTING_AXES[axis]) errors.push(`${where}.${axis} is not an axis (${AXIS_IDS.join(', ')})`);
    else if (!SETTING_AXES[axis].includes(v)) errors.push(`${where}.${axis} '${v}' is not one of ${SETTING_AXES[axis].join(', ')}`);
  }
  return errors;
}

/** An entry's tag faults: each axis a non-empty list of known values. */
export function tagErrors(tags, where = 'tags') {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return [`${where} must be { ${AXIS_IDS.join('?, ')}? } of lists`];
  const errors = [];
  for (const [axis, vs] of Object.entries(tags)) {
    if (!SETTING_AXES[axis]) errors.push(`${where}.${axis} is not an axis (${AXIS_IDS.join(', ')})`);
    else if (!Array.isArray(vs) || vs.length === 0) errors.push(`${where}.${axis} must be a non-empty list`);
    else for (const v of vs) if (!SETTING_AXES[axis].includes(v)) errors.push(`${where}.${axis} '${v}' is not one of ${SETTING_AXES[axis].join(', ')}`);
  }
  return errors;
}

/** Does an entry (its `setting` tags) belong in a world? Every axis both state must agree. */
export function fitSetting(tags, world) {
  const misses = [];
  for (const axis of AXIS_IDS) {
    const w = world?.[axis], t = tags?.[axis];
    if (w === undefined || t === undefined) continue;
    if (!t.includes(w)) misses.push({ axis, world: w, entry: t });
  }
  return { fits: misses.length === 0, misses };
}

const missText = (m) => m.map((x) => `${x.axis} ${x.world} (it belongs in ${x.entry.join(' / ')})`).join('; ');

/**
 * Sort a shelf's entries ({ id, setting? }) for a world. `admitted` is what the builder may draw from on its own;
 * `kept` the entries the recipe named although they miss (each with its misses, for the readout); `left` what stays
 * on the shelf. `named` is a list of entry ids the recipe asked for by name.
 */
export function admit(entries, world, { named = [] } = {}) {
  const want = new Set(named);
  const admitted = [], kept = [], left = [];
  for (const e of entries) {
    const { fits, misses } = fitSetting(e.setting, world);
    if (fits) admitted.push(e);
    else if (want.has(e.id)) kept.push({ ...e, misses, note: `named off-setting: misses ${missText(misses)}` });
    else left.push({ id: e.id, misses });
  }
  return { admitted, kept, left };
}
