/**
 * A TEST FIXTURE, not a game in the book: a sprint final in the contest kernel's data. Lanes, the set, a gun that
 * fires on the kernel's seeded delay, a press before it a disqualifying false start, the clock from the gun to each
 * runner's finish, placings by time. The distance is the level's; the kernel measures time.
 *
 *   sprint({ lanes?, falseStart? }) → spec
 */
export function sprint({ lanes = 4, falseStart = 'disqualify' } = {}) {
  return {
    shape: 'meet',
    title: 'Sprint',
    event: { kind: 'sprint', lanes, measure: 'time', falseStart },
  };
}
