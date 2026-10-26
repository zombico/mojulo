/**
 * A TEST FIXTURE, not a game in the book: the long jump in the contest kernel's data. Each athlete three attempts,
 * a jump measured from the board, a take-off past the foul line a foul (no mark), the best counted, placings by the
 * best. The gun is the pit's "go": the runway is open once every athlete is set.
 *
 *   longJump({ athletes?, attempts? }) → spec
 */
export function longJump({ athletes = 3, attempts = 3 } = {}) {
  return {
    shape: 'meet',
    title: 'Long jump',
    event: { kind: 'longJump', lanes: athletes, measure: 'distance', attempts },
  };
}
