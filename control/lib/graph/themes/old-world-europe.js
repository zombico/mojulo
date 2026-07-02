/**
 * old-world-europe — an EARTH-family reflavor that leans on the city's locale-gated classes.
 *
 * europe locale → a stone church + Dutch-row townhouse bias; townhouses + a tram line turned
 * on; daytime temperate. Same city generator, visibly a different place: canal-house rows and
 * a church instead of a generic downtown.
 */
export default {
  id: 'old-world-europe',
  family: 'earth',
  label: 'Old-world Europe',
  description: 'Canal-house rows, a stone church, and a tram line; temperate daytime. Uses the europe locale gates.',
  slots: {
    context: { locale: 'europe', climate: 'temperate', time: 'day' },
    asset: {
      elements: { townhouses: true, religiousPlaces: true, streetcars: true },
    },
  },
};
