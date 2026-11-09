### The gen-7 sky hides the painted cloud cards outdoors too

- **Fixed: big flat clouds over a gen-7 landscape.** The gen-7 sky (`channels/form-sky.js`) replaces what the stage
  painted for the sky, its cloud cards among them, and finds them by their group name. A textured mesh was given its
  group name only when the indoor form render, a sway, the grass, the tone curve, a preview, the view cone or an arena
  clip was on the page, so on an outdoor gen-7 page (the form land, or the gen-7 sky over a geocity) the painted cloud
  cards kept no name, stayed up, and covered the sky's own clouds with large flat shapes. Those pages now name their
  textured meshes as the others do (`scene-three.js`), and the cards go with the rest of the painted sky. A page
  without the form land or the gen-7 sky emits the same bytes as before.
