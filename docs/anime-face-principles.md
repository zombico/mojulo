# The anime face's principles

The anime head (`control/lib/graph/polygonizer/anime-form.js`, its sculpt in `anime-sculpt.js`, its form and styles in
`anime-looks.js` and `anime-styles.js`, its drawings in `anime-drawings.js`) is held to a few principles. Each is built
into the construction where it can be, so a drawing, a style or an operator's word cannot break it by accident; a word
that takes one off is the operator's call. A principle a test holds names the test.

1. **The brow never covers the eye.** Over each eye the brow's bottom stays above the top of its lash band, as the widest
   lid any drawing draws would set it, by sculpt `browClear` of the opening (the head's form wears 0.05). Clearing the
   widest lid, not the lid drawn, keeps a lid's drawing from moving the brow, so the 7G layers still add exactly. Past
   the eye's corners the brow is free. Held by `anime-drawings.test.js` (the principles) and swept over every brow, every
   lid, both bases and every style in `anime-drawings.deep.test.js`.
2. **The socket follows the brow.** The eye's recess (sculpt `orbit`) rises from its apex to the middle of the brow as it
   sits at rest, so the brow sits on the socket's rim whatever a style sets its gap to; and as the brow acts (each brow
   drawing, the brow's channel, its lift as the eye shuts) the rim warps with it, faded in above the widest lid's lash
   band so the eye, its lenses and its lash band never move with a brow. Where the warped rim meets the rings a lid's
   drawing moves, the 7G rig carries a corrective per brow over each lid, so a drawn face stays the exact build of its
   drawings.
3. **No line where the form carries it.** The pyramid nose draws no nose line (its shade side's plane is the line); the
   lips are flat (`flatLips`), the mouth drawn on the face, not raised as lips.
4. **The profile reads by its blocks.** The brow, the socket and the cheekbone break the face into planes; the nose points
   up at its tip and stands out past the face, so a side view reads without a line.
5. **No deformation.** Every drawing keeps the head's topology and folds no face, from every angle (the drawings' tests);
   the mouth never leaves its opening.
6. **Drawings snap.** A take is read as drawings held on twos, keyed STEP (`face-acting/anime-read.js`): a brow or a mouth
   changes from one drawing to the next without morphing through the ones between, as the timing of anime draws it.
