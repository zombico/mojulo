/**
 * A TEST FIXTURE, not a game in the book: indoor volleyball in the contest kernel's data, named by its principles.
 * Six a side; the ball may not bounce, a side may touch it three times before it crosses and no player twice in a
 * row; every rally scores (rally scoring); a set is twenty-five points won by two, the match three sets; the side
 * that wins a rally it did not serve takes the serve and rotates its server (side-out). The serve goes anywhere in
 * the other side's court. The court is 9 by 18 m, the net at y = 0.
 *
 *   volleyball({ sets? }) → spec
 */
export function volleyball({ sets = 3 } = {}) {
  return {
    shape: 'match',
    title: 'Volleyball',
    players: 6,
    court: {
      frame: [9, 18],
      mirror: 'half-turn',
      regions: {
        half: { rect: [-4.5, -9, 4.5, 0] },
        front: { rect: [-4.5, -3, 4.5, 0] },
        back: { rect: [-4.5, -9, 4.5, -3] },
      },
    },
    scoring: {
      points: 'rally',
      ladder: [
        { unit: 'set', to: 25, by: 2 },
        { unit: 'match', to: sets },
      ],
    },
    serve: { into: 'half', faults: 1, let: false, rotate: 'side-out' },
    rally: { in: 'half', bounces: 0, touches: 3, sameTwice: false },
    fouls: { 'net-touch': 'point', 'foot-fault': 'fault' },
  };
}
