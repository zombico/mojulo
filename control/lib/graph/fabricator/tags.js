// fabricator/tags — the intents a need carries that its geometry cannot tell: how it will be used, opened, made.
//
// A closed vocabulary, like the fauna habits: each tag is read by some strategy (a test holds that), so a tag is
// never decoration. Load, host material, access and shaft size are not tags; they are measured (./capabilities.js).
export const TAGS = Object.freeze({
  serviceable:   'taken apart and put back many times',
  'tool-free':   'assembled and opened by hand, no tools',
  'flat-pack':   'panels shipped flat and put together by the buyer',
  hidden:        'no hardware shows from outside',
  waterproof:    'keeps water and dust out',
  'print-only':  'nothing bought: every piece comes off the printer',
  precise:       'positions repeat to a tenth of a millimetre or better',
  quiet:         'runs without gear whine',
  'high-ratio':  'a large speed reduction, 20:1 or more, in one stage',
});

/** The tags of a need, validated: unknown tags are reported, not silently dropped. → { tags: Set, unknown: [] } */
export function tagsOf(need) {
  const list = need.tags || [];
  return { tags: new Set(list.filter((t) => TAGS[t])), unknown: list.filter((t) => !TAGS[t]) };
}
