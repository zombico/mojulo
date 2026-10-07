/**
 * PRESETS — what the little grammar says (plan.js): two forms, three ways up, a plan's sides, stacked. Each is only a
 * `tiers` list; none needs code of its own. A recipe names one (`preset`) and may override its words.
 */
export const LOCAL_MERU_PRESETS = Object.freeze({
  // the base unit: a mound, a stair spiralling round it, a watchtower on the summit climbed by a ladder
  'mountain-lookout': { about: 'a mound climbed by its spiral, a watchtower on the summit', tiers: [{ form: 'mound' }, { form: 'tower' }] },
  // a mound on a mound: the lower spiral lands on a wide terrace, the upper one leaves from where it landed
  'terraced-mountain': { about: 'two mounds stacked, a terrace between them, a lookout on the top', tiers: [
    { form: 'mound', height: 8, foot: 16, summit: 9 },
    { form: 'mound', height: 7, foot: 6.8, summit: 3.5, up: { turns: 1 } },
    { form: 'tower', side: 2.6, deck: 5 },
  ] },
  // square terraces stepping in, a ramp half round each, a shrine on the top
  ziggurat: { about: 'square terraces stepping in, a ramp half round each, a shrine on top', tiers: [
    { form: 'mound', sides: 4, height: 5, foot: 15, summit: 11, profile: 1, up: { turns: 0.5 } },
    { form: 'mound', sides: 4, height: 5, foot: 8.5, summit: 6, profile: 1, up: { turns: 0.5 } },
    { form: 'mound', sides: 4, height: 3, foot: 3.6, summit: 2.6, profile: 1, up: { turns: 0.5, width: 1.2 } },
    { form: 'tower', side: 2.2, deck: 2.4 },
  ] },
  // a square mound, one straight stair up its face, a shrine on the top
  'temple-pyramid': { about: 'a square mound, one straight stair up its face, a shrine on top', tiers: [
    { form: 'mound', sides: 4, height: 10, foot: 14, summit: 3.5, profile: 1, up: { via: 'stair' } },
    { form: 'tower', side: 2.4, deck: 3 },
  ] },
  // a tower on a tower: the lower deck open, the upper climbed from it
  'stacked-lookout': { about: 'a tower on a tower: the lower deck open, the upper climbed from it', tiers: [
    { form: 'tower', side: 4.4, deck: 5 },
    { form: 'tower', side: 1.8, deck: 4 },
  ] },
});
export const LOCAL_MERU_PRESET_IDS = Object.freeze(Object.keys(LOCAL_MERU_PRESETS));
