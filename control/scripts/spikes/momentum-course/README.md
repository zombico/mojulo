# Spike: the momentum course (obstacle-course primitives for the pinball feel)

A level designer for a momentum hero has nothing to size its obstacles by. A platformer's course is sized in SPACE,
by its hero's reach (`gameworld/feel/reach.js`). This spike finds what a momentum hero's is sized by, on the rule the
game ships, seen from behind the hero. Not product code: nothing here is imported by the product.

```bash
cd control
node scripts/spikes/momentum-course/lab.mjs [feel]    # the hero measured: speed, the jump's window, a mistake, steering
node scripts/spikes/momentum-course/bot.mjs [feel]    # courses laid by rhythm and played by the reaction bot (a few minutes)
```

- `lab.mjs`: the numbers a course is sized by.
- `course.mjs`: three primitives on a three-lane way (a hurdle and a block to jump, posts that leave one lane open),
  a course laid from them by rhythm and a seed, and the reaction bot.
- `bot.mjs`: the sweeps below.

THE REACTION BOT knows how to play (the right ask for each primitive, the lead a jump wants, how to stop a sideways
slide on a lane). What it lacks is what a player lacks: it SEES a thing only inside `sight` metres ahead, and ACTS on
it only `react` seconds after it first saw it. Stopped by a thing, it backs off for a run-up and comes again.

## Found, 2026-11-13 (`commuter-rail-runner`, the one template on the pinball base; machine gate only)

The hero: 12 m/s (20 on the boost); a running jump 7.1 m long and 0.63 s; a mistake costs 2.4 s to be at speed again.

1. **A window is a thing of time.** A hurdle's jump window is 4.7 m at top speed and 8.3 m on the boost: 24 and 25
   frames. A primitive is written in frames and seconds; metres come from the speed at that place.
2. **Each ask has a NEED, measured:** a hurdle's jump 0.51 s before it at the earliest (0.12 at the latest), a block's
   0.44 (0.17); a lane change 0.68 s for one lane and 1.12 s for two. Steering has momentum too: pushed toward a lane
   and let go, the hero overshoots it by 2 m; a player must push back in time.
3. **Sight = (need + reaction) x speed, and it holds.** A course whose neediest ask wants 1.12 s predicts 18 m of
   sight for a 0.4 s reaction; played, it is clean from exactly 18 m, and with 18 m the slowest reaction that runs it
   clean is 0.4 s. Jumps alone are clean from 7 m (0.18 + 0.4 s).
4. **Reaction time alone decides nothing when the sight is long.** Seen 30 m ahead (2.5 s), a player reacting in
   0.15 s and one in 0.8 s run the same. It is the sight that has a cliff: under 8 m nothing runs clean, and a hit
   costs so much that runs take twice as long.
5. **One rhythm for every ask is wrong.** An ask every 1.2 s: 7 of 12 courses clean (two-lane changes do not fit).
   Every 1.6 s: all clean, in 23 s. The FAIR layout, each ask given its own need plus a rest of 0.6 s: all clean, in
   18 s. A rest of 0.3 s is too little (10 of 12).
6. **A stopped hero is not stuck:** a 3 m run-up clears a block. So a jump across the whole way is fair with room
   behind it.

## Limits

- The bot is the same on every run: no slips, no late presses of its own. It finds what is possible for a reaction
  and a sight, not what is comfortable.
- Its back-off is unreliable for a slow, short-sighted player (0.8 s, 8 m: it backs off again and again), so the
  "finished" counts under 8 m of sight are the bot's as much as the course's.
- Flat ground, three primitives. No gap, ramp, crest, boost pad or bumper; the runtime carries no bumper, ricochet,
  wall slide or dash for this feel yet.
- One feel template. The numbers are its own; the method is what carries.
