/**
 * THE SPORTS — the contests the court plays (match-sim.js), each a game nobody owns written out in the contest
 * kernel's data (contest-kernel.js) with the play's own dials: the ball (ball-card.js BALLS), how many a side, the
 * strokes (hit.js HIT_VERBS), the net, where a serve is struck from and where the receiver stands. A published game
 * asked for by name is written out from the rules the person explains; these are the rules everyone knows.
 *
 *   SPORTS { tennis }          { words, spec(sets?), ball, players, strokes: { fore, back, serve }, net: { height, posts },
 *                                 serve: { behind, aside }, receive: { behind, aside }, home: { behind } } (metres from
 *                                 the baseline and the centre line)
 *   sportOf(id)                one, or throws naming the sports
 *   tennis({ sets? })          singles tennis: a game four points by two named 0 15 30 40 (deuce and advantage), a set six
 *                              games by two, the match best of three; the serve diagonally into the receiver's box, the
 *                              deuce court first, two faults the point, a let off the cord; one bounce a side, one touch
 *
 * The court is the singles court: 8.23 m across, 23.77 m long, the net at y = 0, side a's end at y < 0. Regions are
 * written for side a and mirrored half-turn for side b, so the box on a's right is diagonal from b's right.
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

export const SPORTS = Object.freeze({
  tennis: Object.freeze({
    words: 'singles tennis: serve into the box, one bounce, 15 30 40, six games a set',
    spec: tennis, ball: 'tennis', players: 1,
    strokes: Object.freeze({ fore: 'forehand', back: 'backhand', serve: 'serve' }),
    net: Object.freeze({ height: 0.914, posts: 1.07, beyond: 0.914 }),
    // where the server stands (behind the baseline, aside the centre mark toward the deuce or ad court), where the
    // receiver waits (diagonal), and each player's home between points
    serve: Object.freeze({ behind: 0.4, aside: 1.0, hand: 2.8 }),   // the ball struck at the top of the reach
    receive: Object.freeze({ behind: 1.0, aside: 1.6 }),
    home: Object.freeze({ behind: 1.0 }),
  }),
});
export const SPORT_IDS = Object.freeze(Object.keys(SPORTS));

export function sportOf(id) {
  const s = SPORTS[id];
  if (!s) throw new Error(`contest: sport '${id}' is one of ${SPORT_IDS.join(', ')}`);
  return s;
}
