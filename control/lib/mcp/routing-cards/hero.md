---
{
  "id": "hero",
  "name": "Create a hero (a human character as a rigged mesh: low-poly, boxy or round, with a face and hair)",
  "summary": "A human character as a layered solid on the vajra rest skeleton: rings along the figure's joints in one art-style register, a palette by group, a head whose face and hair are data on the detail core, a rig with idle / walk / wave. Silhouette, colour, face, hair — adornments come later.",
  "when": "\"a hero for my game\", \"a low-poly / pixel / boxy person I can rig\", \"a stylised human character as a mesh, not a picture\", \"a character with a face and a hairstyle I can keep editing\", \"a chibi / heroic / stout version of the same character\", \"a person that plays a walk cycle and exports skinned\", \"make her shoulders broader / his legs longer\", \"a stockier version of the same hero\", \"tune the body proportions by percent\", \"give him a broader jaw / larger eyes / a longer face\", \"change her hairstyle or expression\", \"give him an undercut / a ponytail / a longer bob\", \"dress my hero: a quilted jerkin, a belt, a pauldron\", \"add armor and accessories to my character\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'layered', via: 'hero', spec: { cast: 'male' | 'female', register, tune, face, hair, expression, detail, adorn } })`: a TUNE and a FACE as percentages of the cast / the fitted head (`shoulders`, `legs`, `head` …, moves `athletic` / `long-legs`; `jawWidth`, `eyeSize` …, moves `broad-jaw` / `large-eyes`; lists compose). Hair: a library word (`buzz` … `ponytail`, `braid`) with `length`, `volume` … Dress, last: `detail: 'clothed'` (folds, a quilted jerkin, patches, cuffs), `adorn: 'ranger'` (belt, baldric, bracer, one pauldron; every signature must read). Iterate by word: `update_sketch` patching `/hero/tune/<control>`, `/hero/face/<control>`, `/hero/hair/…`, `/hero/detail`, `/hero/adorn`; live dials `/dials/<name>`; never re-mint. Loop: `create-hero` catalyst; manual: `get_solid_vocab({ id: 'layered' })`. A person as a picture is kind `figure` (card `human-figure`); a creature is card `creature`. Family: `get_creative_toolset({ form: 'object' })`.
