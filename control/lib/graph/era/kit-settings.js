/**
 * kit-settings — where each stage kit stands, in the playscape setting words (../playscape/setting.js). A stage's
 * world setting starts here and a recipe's own `setting` overrides it axis by axis: the crypt kit is a grounded
 * medieval burial place until the ask says a lich lies in it (`"setting": { "fiction": "fantasy" }`).
 * An axis a kit leaves out stays open: a mountain trail could be any century.
 */
export const STAGE_KIT_SETTINGS = Object.freeze({
  'gothic-stone': { era: 'medieval', place: 'funerary', fiction: 'grounded' },
  catacomb: { era: 'ancient', place: 'funerary', fiction: 'grounded' },
  'gothic-nave': { era: 'medieval', place: 'sacred', fiction: 'grounded' },
  'island-plaza': { era: 'modern', place: 'civic', fiction: 'grounded' },
  'research-lab': { era: 'future', place: 'industrial', fiction: 'sci-fi' },
  'trail-valley': { place: 'wild', fiction: 'grounded' },
  'jungle-trail': { place: 'wild', fiction: 'grounded' },
  'isekai-meadow': { place: 'wild', fiction: 'fantasy' },
  'isekai-bamboo': { place: 'wild', fiction: 'fantasy' },
  'isekai-sakura': { place: 'wild', fiction: 'fantasy' },
});

/** A stage recipe's world setting: its kit's, overridden axis by axis by the recipe's own `setting`. */
export function stageSetting(manifest) {
  return { ...(STAGE_KIT_SETTINGS[manifest?.kit] || {}), ...(manifest?.setting || {}) };
}
