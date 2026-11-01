### Geocube water: the ground it keeps

- **The substrate reads the water** (`era/substrate.js`, the water from `era/out-water.js`): a lake's, a pool's or a
  river's shallows (up to 0.6 m under its level) are wet ground, deeper water and the sea are no land at all, the shore
  the water lays as sand (a lake's ring, a beach, a river's shingle) is sand, and a fresh water's bank low over it
  (0.9 m, within its reach) is wet. Before, only a crossing's stream wet the ground, and a lake, a coast or a river read
  as soil, so a biocube's swarms and a sandstone strand never found their shores. A stage with no water reads as
  before, cell for cell. The water reports `level(x, y)`: the fresh water whose bank holds a point.
- **The flora page counts the water** (`docs/flora-gaps.md`, `levelShares` in `era/substrate-flora.js`): each cube
  preset is read dry and by each water a word lays (lake, coast, river), and a level is half of each. Sand and wet
  ground, 0% of a level before, are now 3.4% each (6.7% and 6.9% of a waterside level), so the wet-ground and
  sand-ground wants rank on the ground they would cover instead of the 2% floor.
