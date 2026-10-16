/**
 * The ROTHENBURG style card: how a Franconian free imperial city c. 1500 should LOOK, as principles, the kit's numbers
 * and the light and sky the page reads. Its houses speak the inventory's `fachwerk` and `steinhaus` (../inventory/
 * styles.js); this card holds what those languages leave to the town: its colours, its wall, its sky.
 */
export const ROTHENBURG_STYLE = Object.freeze({
  id: 'rothenburg',
  principles: Object.freeze([
    'Roofs are the town: steep, red, plain-tiled, most gables turned to the street, so a lane reads as a row of gable ends.',
    'Stone below, timber above: a rubble-stone ground storey, rendered framed storeys over it, the frame dark against pale render.',
    'Stone means standing: the wall and its towers, the gates, the church, the town hall and the council\'s houses are stone, everything else is framed.',
    'The town hall\'s tower and the church\'s towers are the only things over the roofs, and both stand on the market place or a street off it.',
    'The sky is a place: a pale summer haze over the plateau, bluer overhead.',
  ]),
  values: Object.freeze([]),
  kit: Object.freeze({
    roof: { pitch: [50, 60], covering: 'plain-tile' },
    wall: { height: 8, towerHeight: 17, gateHeight: 24, walk: 'roofed' },
  }),
  palette: Object.freeze({
    render: '#e3d5b6', timber: '#4e3a2b', tile: '#a14d33', stone: '#bcae92', wallStone: '#ad9f84', grass: '#8d9160', earth: '#9b8d73', river: '#5d7c78', sky: '#cdd9df',
  }),
  light: { shade: { color: '#5a6478', alpha: 0.38, soft: 0.35 }, ao: { radius: 6, alpha: 0.3 }, palm: { alpha: 0.5, reach: 0.4 } },
  sky: { preset: 'day', sunElev: 0.75, palette: { highlight: [232, 226, 210], shadow: [52, 96, 150] }, sun: false, horizonY: 0.5 },
});
