/**
 * Which faces of a character grow fur (the stuffy finish, scripts/blender-bake.mjs --fur).
 *
 * Fur is a Blender-side finish: the recipe never changes. The driver exports the character as one glTF node per
 * palette group, `fur:<Group>` or `bare:<Group>`, and Blender grows particle hair on the `fur:` nodes only. An
 * unshaded face carries its palette group's colour exactly, so the colour names the group. Pure, no Blender.
 */

// The groups a plush keeps smooth: eyes, mouth, nose, claws, hooves and horns, the button and embroidered features.
// A pattern, because a hero names them Sclera / Iris / Lid, the anime head Ink / Shine, an animal Limbus / Catchlight /
// LidRim / NosePad.
export const FUR_SKIP_DEFAULT = /^(Sclera|Iris|Pupil|Limbus|Catchlight|Cornea|Ink|Shine|Highlight|Lash(es)?|Lids?|Lid[A-Z]\w*|Brow|Lips?|Mouth|Teeth|Tongue|Palate|Gums?|Nose|NosePad|Nostrils?|Claws?|Hoof|Hooves|Horns?|Pads?|Beak)$/;

/** A skip test from a comma list of group names, or the default pattern. */
export function furSkip(names) {
  const named = names ? new Set(String(names).split(',').map((g) => g.trim()).filter(Boolean)) : null;
  return (g) => (named ? named.has(g) : FUR_SKIP_DEFAULT.test(g));
}

/**
 * Tag a payload's faces for the fur export. Drops the studio floor; every other face becomes group `fur:<G>` or
 * `bare:<G>` (`Other` when its colour is in no palette group). Two groups may share a colour (a hero's Hair and
 * Brow): the colour goes to a furred group when one claims it. Returns the tagged faces and the furred palette.
 */
export function tagFurFaces(faces, palette, skip = furSkip()) {
  const groupOf = new Map();
  for (const [g, hex] of Object.entries(palette || {})) {
    const k = String(hex).toLowerCase();
    if (!groupOf.has(k) || (skip(groupOf.get(k)) && !skip(g))) groupOf.set(k, g);
  }
  const tagged = (faces || []).filter((f) => !f.studio).map((f) => {
    const g = groupOf.get(String(f.fill || '').toLowerCase()) || 'Other';
    return { ...f, group: `${skip(g) ? 'bare' : 'fur'}:${g}`, node: undefined };
  });
  const furred = Object.fromEntries(Object.entries(palette || {}).filter(([g]) => !skip(g)));
  return { faces: tagged, palette: furred, anyFur: tagged.some((f) => f.group.startsWith('fur:')) };
}
