### A frame's lessons: its controls taught as it is played

- An operation can teach (`goal.operation.lessons: [{ teach: [<word>…], at?: <task> }]`): the frame's controls one at
  a time on the guide's line, each kept up until the pilot does it or its patience runs out. The words are the frame's
  (`FRAME_LESSONS`: move, look, boost, quick boost, jump, climb, assault boost, energy, lock, each hand and shoulder,
  kick), each done by the frame's own state: a boost held, a quick boost, the climb, a slot's rounds gone, the sight
  locked. A group can wait for its task (`at`), so a training level teaches its movement as it starts and its weapons as
  its drones come.
- The guide channel reads them on any geocube level that carries `lessons`; a guide without a frame's lessons is as it
  was, byte for byte.
