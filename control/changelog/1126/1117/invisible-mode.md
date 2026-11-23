### Invisible mode: walk a level unseen

A designer's walk, never a game's: a pilot whose rule carries `ghost` (`true` or `{ on }`) is seen by no guard while it
is on (`worlds/controllable/ghost.js`), so a level's layout and its watchers are read on foot without setting them off.
The guards walk their rounds, look round, call to each other, see a fallen teammate and wake a sleeper as they would.
On the page, I toggles it, and a badge at the top says which it is (`scene/channels/controllable/ghost-view.js`).

- It wraps the step just outside the patrol, so both the patrol's sighting and the mind's fail while it is on, and the
  alert's calm and hot sets, the alarm and the knockout's waking all read the guards' own sight. A guard toggled back
  to seeing sees at once.
- Emitted only into a page whose pilot carries `ghost`; every other page keeps every byte.
- The facilities spike's page (`scripts/spikes/mission/facilities.mjs`) starts invisible (`--seen` to start seen) and
  stands a sentry in each ground corridor beside the hall's guard; a chicane's corridor, with no straight line down it,
  is walked along its longest clear stretch.
