### A modern European old town, walked as a game

- **A modern European old town, a geotown pattern** (`geotown/pattern.js` `old-town`). Its streets are narrow setts
  lanes with flagged walks and no verge. Its town houses are rendered terraces three to five storeys high, built to the
  walk party wall to party wall. Its main street has shops on the ground floor, and the blocks behind hold gardens and
  courts. Each house has its own render (ochre, cream, terracotta, rose, stone, grey-blue under slate), its own
  shutters, and wrought balconies on some. It comes with one streetscape, `old-centre`, and two neighbourhoods:
  `old-centre` (terraced lanes round a main street of shops) and `market-street`. Where it does not differ it keeps
  the suburb's own: its fences, sites, furniture and houseplants. The suburb, `bay-and-gable`, is unchanged byte for
  byte (its design and scene hashed before and after) and stays the default.
- **The old-town house style** (`era/arch-style.js` `old-town`): lime render over an ashlar ground storey, tall
  shuttered casements in stone surrounds, a shallow clay-tiled hip behind a deep cornice, setts and flags.
- **A pattern's street furniture can be European.** `furniture.lamps: 'lantern'` lights every street with a lantern on
  a cast-iron post (no wooden pole, no arm, no wires). `furniture.paint: 'none'` leaves the lanes unpainted, with no
  yellow centre line. Neither is set for the suburb.
- **A square, a new site** (`geotown/sites.js` `square`, the segment letter `Q`). It is a paved piazza laid in the
  pattern's `piazza` finish. Its church stands on its own lot across the far side with its door to the square: a
  `church` row in the gothic-parish style, from a site plot that can now name its kind and where it stands (a school's
  lot still stands at its site's front corner, byte for byte). It has a stone fountain in its middle and café tables
  under parasols along its flanks, each parasol coloured from the pattern's awning colours. A square is not a playing
  field to the spacing law. The old town's third neighbourhood, `square`, sets the church and its piazza among the
  terraces. The new `piazza` surface enters a town's ledger only where one lies, so a town without a square keeps its
  ledger's bytes.
