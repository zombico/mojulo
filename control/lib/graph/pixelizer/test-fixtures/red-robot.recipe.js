/**
 * red-robot — the P0 spike artifact: a 16x16 megaman-class red robot,
 * standing in place, turning left and right. One authored sprite,
 * facing W (gaze-left pupils are the asymmetry that makes the turn
 * read); the E frame is pure grammar — the E-W reflect resolved from
 * the placement's facing track. Zero pixel data for the second frame.
 *
 * Palette budget: 3 colors + transparent (the NES sprite rule).
 * '.' transparent · '1' outline · '2' armor red · '3' face light
 */
export const RED_ROBOT_RECIPE = {
  kind: 'pixel-map',
  size: [24, 20],
  background: '#1a1a24',
  sprites: {
    'red-robot': {
      size: [16, 16],
      palette: ['#101018', '#d82818', '#f8d0a0'],
      cells: [
        '.....111111.....',
        '...1122222211...',
        '..122222222221..',
        '..122111111221..',
        '..123333333321..',
        '..123133313321..',
        '..123133313321..',
        '..123331133321..',
        '....13333331....',
        '...122222221....',
        '..121222222121..',
        '..121222222121..',
        '..111222222111..',
        '....122..122....',
        '...1222..1222...',
        '...1111..1111...',
      ],
    },
  },
  placements: [{ id: 'hero', sprite: 'red-robot', cell: [4, 3], facing: 'W' }],
  animation: {
    fps: 2,
    tracks: [{ target: 'hero', prop: 'facing', values: ['W', 'E'] }],
  },
};
