/**
 * THE SWATCHES — every colour an outdoor kit may use, recorded once, here. The style cards read their ramps from this
 * table, and the outdoor master index (era/out-made.js, drawn by era/out-index-html.js) shows it: changing a stop here
 * changes the kit.
 *
 * A ramp is a row of stops, darkest to lightest (sRGB 0–255), its darkest stop a cool colour, never black.
 *   land  the ground, the plants, the far layers and the sky: the ramps the builder paints from today
 *   made  the things people build (posts, fences, signs, bridges, steps, laid stone): timber, rope, paint, and the
 *         stone a kit dresses (a kit with locked rock ramps names that ramp instead of repeating it), and moss for
 *         the caps on a kit with no grass ramp
 *   accent  one colour a kit allows a single small use of (a blaze, a lacquered cap): a stop of `made.paint`
 *
 * A kit drawn from tinted textures (nature-trail, jungle) has no land ramps yet: its ground is a texture times a tint,
 * recorded on its card; its made ramps and accent live here all the same.
 */
export const SWATCHES = Object.freeze({
  'isekai-meadow': {
    land: {
      grass: [[38, 92, 88], [62, 132, 70], [112, 176, 56], [164, 210, 70], [214, 236, 128]],
      soil: [[104, 96, 110], [156, 128, 98], [206, 172, 120], [234, 212, 160]],
      rock: [[78, 92, 132], [108, 122, 156], [142, 148, 170], [180, 178, 176], [214, 206, 190], [238, 230, 212]],
      foliage: [[30, 78, 82], [52, 118, 66], [96, 164, 58], [156, 204, 78], [206, 232, 132]],
      bark: [[64, 58, 78], [112, 90, 82], [156, 128, 104]],
      far: [[104, 168, 166], [112, 164, 210], [160, 200, 232], [196, 222, 242]],
      sky: [[40, 108, 220], [120, 176, 236], [186, 222, 244]],
      cloud: [[132, 168, 216], [178, 204, 236], [222, 234, 248], [255, 255, 255]],
    },
    made: {
      timber: [[86, 70, 92], [134, 102, 90], [184, 142, 104], [222, 186, 138], [244, 220, 178]],
      stone: 'rock',
      rope: [[104, 94, 104], [164, 142, 112], [212, 192, 146], [240, 226, 188]],
      paint: [[112, 50, 80], [184, 70, 66], [228, 112, 78], [248, 170, 122]],
    },
    accent: ['paint', 1],
  },
  'isekai-bamboo': {
    land: {
      grass: [[34, 88, 92], [56, 124, 86], [98, 164, 76], [148, 198, 88], [200, 228, 140]],
      soil: [[96, 92, 104], [146, 124, 100], [196, 168, 124], [228, 210, 168]],
      rock: [[72, 92, 120], [102, 122, 144], [138, 150, 160], [176, 182, 176], [212, 210, 194], [236, 232, 214]],
      foliage: [[28, 76, 80], [46, 112, 78], [84, 154, 84], [140, 196, 100], [196, 228, 146]],
      culm: [[44, 90, 82], [68, 126, 90], [106, 162, 98], [156, 198, 116], [210, 228, 158]],
      bark: [[64, 58, 78], [112, 90, 82], [156, 128, 104]],
      far: [[86, 150, 138], [112, 168, 190], [156, 198, 224], [194, 222, 240]],
      sky: [[48, 118, 214], [128, 184, 234], [190, 224, 242]],
      cloud: [[136, 172, 214], [182, 208, 234], [224, 236, 248], [255, 255, 255]],
    },
    made: {
      timber: [[74, 84, 74], [126, 126, 90], [182, 170, 116], [222, 210, 158], [242, 234, 196]],
      stone: 'rock',
      rope: [[92, 92, 92], [150, 138, 106], [202, 188, 142], [236, 226, 188]],
      paint: [[30, 72, 92], [44, 112, 120], [80, 158, 146], [146, 204, 178]],
    },
    accent: ['paint', 2],
  },
  'isekai-sakura': {
    land: {
      grass: [[44, 96, 96], [72, 140, 84], [124, 184, 70], [176, 214, 86], [222, 238, 150]],
      soil: [[110, 96, 112], [162, 132, 106], [212, 178, 132], [238, 218, 176]],
      rock: [[86, 92, 132], [116, 120, 154], [150, 150, 170], [186, 180, 180], [218, 210, 198], [240, 234, 220]],
      foliage: [[30, 78, 82], [52, 118, 66], [96, 164, 58], [156, 204, 78], [206, 232, 132]],
      blossom: [[168, 124, 184], [218, 150, 194], [242, 182, 210], [252, 212, 228], [255, 238, 244]],
      bark: [[44, 34, 54], [72, 54, 70], [106, 82, 92], [150, 122, 126]],
      far: [[150, 156, 200], [168, 180, 220], [186, 204, 236], [206, 222, 244]],
      sky: [[64, 128, 222], [140, 188, 238], [204, 228, 246]],
      cloud: [[150, 170, 220], [196, 210, 238], [232, 238, 250], [255, 255, 255]],
    },
    made: {
      timber: [[64, 50, 70], [112, 84, 88], [160, 122, 108], [206, 170, 142], [236, 210, 184]],
      stone: 'rock',
      rope: [[110, 98, 112], [170, 148, 120], [216, 196, 154], [242, 228, 196]],
      paint: [[104, 36, 64], [178, 56, 58], [224, 86, 64], [246, 142, 106]],
    },
    accent: ['paint', 2],
  },
  'nature-trail': {
    land: null,
    made: {
      timber: [[52, 50, 54], [92, 80, 66], [138, 116, 88], [182, 158, 120], [214, 194, 158]],
      stone: [[70, 74, 82], [118, 110, 98], [162, 148, 124], [200, 188, 162], [226, 218, 198]],
      rope: [[74, 70, 70], [128, 116, 92], [178, 162, 126], [214, 202, 168]],
      paint: [[96, 30, 34], [184, 50, 42], [214, 92, 70], [236, 150, 120]],
      moss: [[48, 62, 52], [82, 100, 62], [124, 138, 76], [168, 174, 104]],
    },
    accent: ['paint', 1],
  },
  'jungle-mgs3': {
    land: null,
    made: {
      timber: [[46, 48, 40], [82, 78, 58], [122, 112, 82], [164, 150, 112], [196, 184, 144]],
      stone: [[50, 58, 50], [86, 90, 74], [124, 124, 100], [160, 158, 128], [190, 186, 156]],
      rope: [[62, 58, 46], [108, 98, 70], [154, 140, 102], [192, 180, 140]],
      paint: [[58, 38, 32], [110, 62, 40], [156, 92, 56], [190, 130, 86]],
      moss: [[36, 50, 36], [62, 84, 50], [96, 118, 66], [136, 152, 92]],
    },
    accent: ['paint', 1],
  },
  'alien-night': {
    land: {
      grass: [[24, 18, 50], [38, 26, 84], [70, 40, 124], [110, 70, 160], [196, 120, 200]],
      soil: [[40, 24, 48], [86, 48, 70], [138, 84, 92], [190, 140, 128]],
      rock: [[30, 26, 62], [56, 48, 98], [92, 82, 138], [134, 124, 178], [184, 176, 214], [228, 224, 246]],
      foliage: [[70, 20, 90], [150, 40, 150], [226, 90, 190], [250, 160, 220], [255, 226, 246]],
      bark: [[26, 22, 46], [44, 38, 70], [74, 64, 104]],
      far: [[26, 20, 56], [40, 30, 80], [60, 44, 108], [88, 66, 140]],
      sky: [[22, 16, 54], [40, 26, 84], [96, 52, 128]],
      cloud: [[40, 30, 80], [70, 56, 120], [110, 96, 160], [160, 150, 200]],
      glow: [[30, 90, 110], [60, 170, 180], [120, 240, 226], [210, 255, 246]],
    },
    made: {
      timber: [[30, 28, 52], [60, 56, 92], [100, 96, 136], [150, 146, 186], [204, 200, 232]],
      stone: 'rock',
      rope: [[40, 30, 60], [80, 64, 100], [130, 112, 150], [180, 166, 200]],
      paint: 'glow',
    },
    accent: ['glow', 2],
  },
  // a spring garden: the meadow's land, and a blossom ramp so its flower beds bloom in two colours
  'isekai-garden': {
    land: {
      grass: [[38, 92, 88], [62, 132, 70], [112, 176, 56], [164, 210, 70], [214, 236, 128]],
      soil: [[104, 96, 110], [156, 128, 98], [206, 172, 120], [234, 212, 160]],
      rock: [[78, 92, 132], [108, 122, 156], [142, 148, 170], [180, 178, 176], [214, 206, 190], [238, 230, 212]],
      foliage: [[30, 78, 82], [52, 118, 66], [96, 164, 58], [156, 204, 78], [206, 232, 132]],
      bark: [[64, 58, 78], [112, 90, 82], [156, 128, 104]],
      far: [[104, 168, 166], [112, 164, 210], [160, 200, 232], [196, 222, 242]],
      sky: [[40, 108, 220], [120, 176, 236], [186, 222, 244]],
      cloud: [[132, 168, 216], [178, 204, 236], [222, 234, 248], [255, 255, 255]],
      blossom: [[168, 96, 150], [214, 128, 170], [240, 168, 196], [252, 206, 222], [255, 236, 242]],
    },
    made: {
      timber: [[86, 70, 92], [134, 102, 90], [184, 142, 104], [222, 186, 138], [244, 220, 178]],
      stone: 'rock',
      rope: [[104, 94, 104], [164, 142, 112], [212, 192, 146], [240, 226, 188]],
      paint: [[112, 50, 80], [184, 70, 66], [228, 112, 78], [248, 170, 122]],
    },
    accent: ['paint', 1],
  },
});

export const SWATCH_KITS = Object.freeze(Object.keys(SWATCHES));

/** A kit's made ramp by name: a ramp, or the name of one of its land ramps. */
export function madeRamp(kitId, name) {
  const K = SWATCHES[kitId];
  if (!K) throw new Error(`swatches: no swatches for kit '${kitId}' (${SWATCH_KITS.join(', ')})`);
  const r = K.made[name] ?? K.land?.[name];
  if (r === undefined) throw new Error(`swatches: kit '${kitId}' has no ramp '${name}' (made: ${Object.keys(K.made).join(', ')}${K.land ? `; land: ${Object.keys(K.land).join(', ')}` : ''})`);
  return typeof r === 'string' ? madeRamp(kitId, r) : r;
}

/** The kit's one accent colour, as [r, g, b]. */
export const accentOf = (kitId) => { const [ramp, stop] = SWATCHES[kitId].accent; return madeRamp(kitId, ramp)[stop]; };

export const hexOfRgb = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
