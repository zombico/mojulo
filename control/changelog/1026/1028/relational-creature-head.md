### The relational creature head: a beast's head the seventh generation's way

Every beast-kin wore a head from the creature library, built for the creature biped: a skull lofted from seven rows of
seven slots, flat-shaded at its facets (it splits at the light's 35° crease), sized for the biped's neck. Measured
against the tiered person's head, it had more triangles (2,464 on the wolf-kin, 1,176 on the person) and less shape: they
went to its eyes, teeth and lids. This theme builds its successor on the realistic hero's head's construction
(`head-relational.js`): points placed by relations, masses as vajras between them, one skin over them.

- **The head** (`creature-heads/relational.js` `relationalCreatureHead`; `CREATURE_RELATIONS`, a preset per skull in
  `CREATURE_HEADS`). In the relational head's frame and units (V, the head's height; the field in STAND units at a
  1.8 m figure). Its relations name a skull's measures:
  - the vault's length and breadth (`craniumLength`, `cephalic`), the crown, the brow;
  - the stop; the muzzle's length, breadth, depth, taper and drop, the nose's pad and the whisker pads;
  - the mouth's line, the gape, the jaw's depth, the chin; the cheek arch's breadth and mass;
  - the eyes' size, set (to the side … ahead), height, pupil (round | slit) and iris; the ears' size, width, set, tilt
    and point.

  The muzzle is two masses meeting at the mouth, as a real one is: the upper (the maxilla and the upper lip, its
  underside the mouth's line) and the lower jaw (narrower, its chin set back, its top on that line), so a mouth can read.
  The ears are blades: a cone squashed through its own facing. The skin is the masses' soft union in two layers: the
  body's masses melted three nearest at a time at a wide blend, then each small feature (the nose, the whisker pads, the
  chin) joined at its own narrow one. A sum over every mass (`−k log Σ e^(−d/k)`, the human head's superposition, which it
  answers by solving its beads deeper) swelled the cat's muzzle a seventh of the head forward where eight masses overlap
  and drowned every feature; a blend picked per nearest pair cracked where the pair changed. The eyes, the nose's pad and
  the mouth's line are SEATED on the skin: each marched out from inside to where the skin crosses, then set (a globe in a
  socket that hugs it as lids do; the pad standing proud; the groove along the surface, never a chord under it).
- **The first two skulls**: the wolf (a long, deep, tapering muzzle off a clear stop, oblique eyes, tall pointed ears
  high on the vault) and the cat (a round vault, a short broad muzzle under a shallow stop, full whisker pads and a small
  chin, wide cheeks, big forward eyes with slit pupils and the iris filling them, broad ears to the top's sides).

- **Worn on the tiered neck** (`beast.head: { relational: 'wolf' | 'felid', relations? }`; `creature-heads/worn.js`
  `creatureHeadOn`, the plan's half in `beast/head.js` `creatureHeadPlan`). Opt-in: a kin still wears its library head by
  default, so no pin moves.
  - **The fit**: the head's STAND units times the figure's height (an ooze's head growth on it). The nape's foot sits
    down the neck's top ring, so the neck runs into the back of the skull. The neck leans 24° under it, and the head is
    raised until the ring below the top stands clear, so the neck keeps two rings.
  - **The skin**: netted as ONE SKIN on the realistic hero's route (`hero-one-skin.js` `oneSkinHead`), joined smoothly
    to the neck's column and sealed point for point to the neck's highest ring that stands clear of it. Its lips are cut
    along the mouth's line, from the front back along the muzzle's sides to the corners, and turned in along the skin's
    own facing. The nose's pad is painted.
  - **The new options** (each default the human head's, which stays byte for byte): how far back the cut reaches, which
    way the lips turn in, which rim is the seam's (the one nearest the ring: a slanted ring's low side
    held a pinch's hole lower than its middle) and where a globe's edges are found (along each slot, so a slit pupil is
    ringed as the lens it now is).
  - **The bind**: the jaw bone carries the lower lip, the chin and the throat ahead of the ramus; the crown stays the
    head's. The rig's jaw is hinged at the condyle with its tip at the chin; its head top is on the crown.
  - **The eyes and the ears**: the globes are their own parts in rounded sockets (the lid's rim a fold the net resolves).
    The ears are their own closed parts netted from their blades, their inner faces painted. The face's colours come from
    the kin's library head, toned to its coat.
  - **The coat's cover on the head**: the skin and the ears take the cover's tile by a box chart (`coverChart`, a mesh
    part's way: `beast/cover.js`), so the fur runs onto the head with no seam at the neck.
  - **Teeth and gums** (`creature-heads/dentition.js`). The arch is the mouth's line carried in by the lip's thickness.
    Along it the teeth are placed by a relation, `dentition` (canid | felid; `fang` the canines' length): incisors, the
    canine, premolars, the carnassial, a molar, each a small cone (a chisel, a round fang, a blade) rooted in a ringed gum.
    The upper row and gum are the head's, the lower the jaw's, so they part as the jaw opens. The gum lines sit a little
    past the mouth's line, so parted, the crowns stand clear of the lips. Shut, all of it lies inside the skin: a tooth
    that would stand out of it is moved in, then shortened, until it fits. The mouth's seated line, which the arch is
    built from, had two points seated on the wrong side of a narrow muzzle (their march started past its far side), and
    the groove kinked there; each march now starts no further over than the midline. hero-live gained a Mouth view.
  - **The mouth's lining** (`creature-heads/mouth.js`), in place of the one skin's closed bag. The bag's band between
    its head half and its jaw half stretched into a flat wall across the wolf's long side opening. The lining is an upper
    shell (the cheek walls and the palate, the head's) and a lower one (the cheek walls and the floor, the jaw's), open
    along the lips and joined only at the back by the throat, which stretches facing the eye as a throat does. A thin
    veil down the midline, from the palate to the floor, closes the view through from one side's opening to the other's
    (a long gape's two openings line up); edge on from the front, it never hides the teeth. The teeth and the gums stand
    inside the lining, so the whole row shows when the mouth opens. (Its first build bound the floor to the head: a point
    id carrying a dot is read as a station and a slot, so its jaw blend never applied.)
  - **A beast's head opens its jaw in a clip** (the door's `jaw` key), the library head's too: both carried the jaw bone,
    and the door refused the key on them.

  Not yet: the other kin as presets, the sheet's head and the lexicon on relations, and the expression actions. The
  coat's pattern atlas does not reach the head yet (it charts ringed parts; the head is a mesh). The head has no tongue. The cat's mouth is a straight line (its cleft under the nose is a lip
  relation to come). A head costs some seconds to net, so worn heads are kept by what a build reads.

Machine gate (`creature-heads/relational.test.js`): one closed skin; a relation moves what it names (the muzzle the
nose's tip, the cephalic the vault's sides); no swelling past the beads; the eyes and the nose seated (a globe breaks the
skin, the pad stands proud and paints); the skulls told apart by their relations; deterministic. Eyes: the wolf and the
cat surface-netted in clay from six sides (the operator's to judge). Worn (`creature-heads/worn.test.js`): the word swaps
the library head for the skin, its globes, a mouth and its ears, and without it the kin keeps its skull; the skin is
sealed to each point of the neck's last ring; the jaw bone carries the chin and the lower lip, never the crown or the
upper lip, and the rig's jaw tip is the chin; the cover runs onto the skin and the ears, not the eyes or the nose's pad;
the word is refused by name; the teeth and the gums are a row on each bone, every point inside the shut skin, the canines
the longest pair, the felid's rows shorter; the mouth's lining lies inside the shut skin and no face of it joins a head
point to a jaw point but the throat's. Eyes: the wolf-kin and the cat-kin through hero-live, the library heads beside them, at
rest and with the jaw open (the operator's to judge).
