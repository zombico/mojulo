/**
 * A TEST FIXTURE, not a game in the book: a goal game on a clock in the contest kernel's data, named by its
 * principle. Two periods; a goal is a point of the one unit, which the clock decides (the most at the end wins, a tie
 * is a draw, or overtime when the game names it); after a goal the conceding side kicks off; a foul is a free restart
 * for the other side. The pitch is one shared region; each side's players have a role with a home region.
 *
 *   periods({ periods?, seconds?, overtime? }) → spec
 */
export function periods({ periods = 2, seconds = 60, overtime } = {}) {
  return {
    shape: 'match',
    title: 'Two periods',
    players: 2,
    roles: { keeper: { home: 'box' }, striker: { home: 'pitch' } },
    court: {
      frame: [40, 60],
      mirror: 'reflect',
      regions: {
        pitch: { rect: [-20, -30, 20, 30], shared: true },
        box: { rect: [-9, -30, 9, -24] },
      },
    },
    scoring: { ladder: [{ unit: 'goal' }] },
    clock: { periods, seconds, ...(overtime ? { overtime } : {}) },
    fouls: { contact: 'free', dissent: 'warn' },
  };
}
