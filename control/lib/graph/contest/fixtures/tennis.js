/**
 * A TEST FIXTURE, not a game in the book: singles tennis written out in the contest kernel's data, named by its
 * principles. A game is four points won by two, called 0 15 30 40 with deuce and advantage; a set six games by two;
 * the match two sets. The serve goes diagonally into the receiver's service box, the deuce court first and the ad
 * court next, two faults lose the point, a serve off the cord into the box is a let; the serve changes hands every
 * game. A rally lets the ball bounce once a side and be touched once; reaching over is the point.
 *
 * The court is the singles court: 8.23 m across, 23.77 m long, the net at y = 0, side a's end at y < 0. Regions are
 * written for side a and mirrored half-turn for side b, so the service box on a's right is diagonal from b's right.
 *
 *   tennis({ sets? }) → spec
 */
const HALF_W = 8.23 / 2, HALF_L = 23.77 / 2, SERVICE = 6.4;

export function tennis({ sets = 2 } = {}) {
  return {
    shape: 'match',
    title: 'Singles tennis',
    players: 1,
    court: {
      frame: [8.23, 23.77],
      mirror: 'half-turn',
      regions: {
        half: { rect: [-HALF_W, -HALF_L, HALF_W, 0] },
        'service-right': { rect: [0, -SERVICE, HALF_W, 0] },
        'service-left': { rect: [-HALF_W, -SERVICE, 0, 0] },
        backcourt: { rect: [-HALF_W, -HALF_L, HALF_W, -SERVICE] },
      },
    },
    scoring: {
      points: 'rally',
      ladder: [
        { unit: 'game', to: 4, by: 2, names: ['0', '15', '30', '40'] },
        { unit: 'set', to: 6, by: 2 },
        { unit: 'match', to: sets },
      ],
    },
    serve: { into: ['service-right', 'service-left'], faults: 2, let: true, rotate: 'game' },
    rally: { in: 'half', bounces: 1, touches: 1 },
    fouls: { 'foot-fault': 'fault', 'net-touch': 'point' },
  };
}
