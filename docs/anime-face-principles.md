# The anime face's principles

The anime head (`control/lib/graph/polygonizer/anime-form.js`, its sculpt in `anime-sculpt.js`, its form and styles in
`anime-looks.js` and `anime-styles.js`, its drawings in `anime-drawings.js`) is held to a few principles. Each is built
into the construction where it can be, so a drawing, a style or an operator's word cannot break it by accident; a word
that takes one off is the operator's call. A principle a test holds names the test.

1. **The brow never covers the eye.** Over each eye the brow's bottom stays above the top of its lash band, as the widest
   lid any drawing draws would set it, by sculpt `browClear` of the opening (the head's form wears 0.05). Clearing the
   widest lid, not the lid drawn, keeps a lid's drawing from moving the brow, so the 7G layers still add exactly. Past
   the eye's corners the brow is free. One exception, by design: a drawing whose socket slides the brow (`socket.rise`,
   the squint's squeeze, hero laws 20) brings the brow down with the eye, and clears the lid as it draws it instead; the
   brow still never covers the eye, and the rig's correctives keep every pair's sum exact. Held by `anime-drawings.test.js` (the principles) and swept over every brow, every
   lid, both bases and every style in `anime-drawings.deep.test.js`.
2. **The socket follows the brow.** The eye's recess (sculpt `orbit`) rises from its apex to the middle of the brow as it
   sits at rest, so the brow sits on the socket's rim whatever a style sets its gap to; and as the brow acts (each brow
   drawing, the brow's channel, its lift as the eye shuts) the rim warps with it, faded in above the widest lid's lash
   band so the eye, its lenses and its lash band never move with a brow. Where the warped rim meets the rings a lid's
   drawing moves, the 7G rig carries a corrective per brow over each lid, so a drawn face stays the exact build of its
   drawings. Under hero laws 20 each brow drawing also carries its OWN socket (`anime-sockets.js`, a base table for every
   head): the ridge forward or back over the eye, the socket's upper plane deeper or shallower, its inner end bunched
   (a scowl) or eased (worry), its outer end hooded or lifted, in the same band and moving the brow block whole. Each lid
   drawing that narrows the eye from below (the squint, the smiling eye) carries the socket's lower half: the cheek
   pushed up under the eye, below its lower outline at rest only, so the white and the lenses never move with it. A
   socket is part of its drawing's build, so its target carries it and it snaps with the drawing: animating the brows
   and the lids animates the socket, frame by frame. Held by `anime-sockets.test.js`, and swept in
   `anime-drawings.deep.test.js`.
3. **No line where the form carries it.** The pyramid nose draws no nose line (its shade side's plane is the line); the
   lips are flat (`flatLips`), the mouth drawn on the face, not raised as lips.
4. **The profile reads by its blocks.** The brow, the socket and the cheekbone break the face into planes; the nose points
   up at its tip and stands out past the face, so a side view reads without a line.
5. **No deformation.** Every drawing keeps the head's topology and folds no face, from every angle (the drawings' tests);
   the mouth never leaves its opening.
6. **Drawings snap.** A take is read as drawings held on twos, keyed STEP (`face-acting/anime-read.js`): a brow or a mouth
   changes from one drawing to the next without morphing through the ones between, as the timing of anime draws it.
7. **Casts are lit alike.** A head cast (`anime-styles.js`: Shonen High, the default, and its siblings) is a figure's
   scale and theme, sculpted as an action figure is, the head first and the body after it; never a kind of game. Every
   cast is read in clay under the same light, so any game can field any cast and no game type tags a face. A cast's
   default face is advised nothing by its own bands (`anime-styles.deep.test.js`).
