### Fantasy character dressing

Fantasy clothing on a hero, then armour: the breaks mended, one cloth law (a material's rigidity read at rest, in
motion and in the drawing), the flow wired into the clips, and a fantasy wardrobe on every body.

Built so far: the mends (phase 1).

- **A robe's skirt no longer tears down its centre on the World page.** The rig preview moved each bone's triangles
  rigidly with its bone, and a triangle rides the bone its corners vote for; a skirt's centre seam (its corners half on
  each thigh) voted for one leg and the other in turn, so the page showed a sawtooth slit front and back at rest (the
  idle clip a hero with no stand opens on) and tore it open from the waist to the hem in a stride; a cloak's hem, a
  realistic skirt's lower half and every joint cracked the same way. A corner the skin shares between bones is now placed
  by its weights, as the skinned GLB places it, then taken into its bone mesh's frame (`rig-preview.js` `rpBlend`; the
  ink a part wears follows its moved corners), so two triangles meeting at a corner meet in every frame. The recipe, the
  pack and the GLB are as they were: the mesh never had the seam. A bank whose parts carry no skin emits the channel
  byte for byte as before.
- **The realistic body wears the ranger's kit and a mantle.** A fold ring the cloth's folds insert between two rings
  (`body-relational-folds.js`) mixed its neighbours' weights without holding them to four, so where the kit's belt or a
  mantle moved a fold onto rings weighing different bones a ring carried five and the rig gate refused the hero
  (`top_body blend at st29f1 must be ≤ 4 …`). It is held to the four strongest and made whole, as every other mixed
  ring is; a mix of four or fewer is as it was, so no minted hero moves.
- **A piece the outfit already wears is said and left off, never refused.** A `belt` piece over a card that wears one
  (the adventurer's) was `adorn (belt).id: 'belt' twice` at the rig gate. The card's is kept, as a kit's belt keeps over
  an outfit's, and the readout says `the belt is not worn: the outfit already wears a belt …`.
- **A piece built on a creature's landmarks says so plainly.** The medallion (a necklace hung from a creature's neck
  chain) is still not worn on a hero, whose neck is a loft it does not read; the readout now says so in those words
  (`the medallion is not worn: its medallion hangs on a creature's landmarks … so it is left off`).
