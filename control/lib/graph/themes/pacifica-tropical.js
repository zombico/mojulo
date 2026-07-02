/**
 * pacifica-tropical — an EARTH-family reflavor toward a tropical Pacific/SE-Asian city.
 *
 * tropical climate → coconut palms swap in among the street trees; southeast-asia locale →
 * a Buddhist temple as the locale-gated class; daytime. Demonstrates the climate + locale
 * context slots producing a distinctly different biome from the same generator.
 */
export default {
  id: 'pacifica-tropical',
  family: 'earth',
  label: 'Pacifica (tropical)',
  description: 'A tropical Pacific city — coconut palms and a Buddhist temple, bright daytime. Uses climate:tropical + the southeast-asia locale.',
  slots: {
    context: { locale: 'southeast-asia', climate: 'tropical', time: 'day' },
    asset: {
      elements: { cityTrees: true, religiousPlaces: true },
    },
  },
};
