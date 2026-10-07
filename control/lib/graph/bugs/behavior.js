/**
 * BUG BEHAVIORS — the four behavior words the animals answer to (relax, alert, eat, sleep: fauna/behavior/), done the
 * arthropod's way, chosen by what the bug is built with (its parts, not a table): a loop each, posed on the bug
 * skeleton (gait.js poseBones), packed as a clip beside the gaits. Pure and deterministic.
 *
 *  relax   GROOM: standing, the antennae sweeping slow, the abdomen pumping (an insect breathes by it).
 *  alert   THREAT by its weapons: CLAWS UP (a chela held high and gaping: lobster, crab, scorpion, the scorpion's sting
 *          arched over its back), STRIKE-READY (a mantis's raptorial forelegs raised, the body lifted), FORELEGS UP
 *          (a spider's front pair raised off the ground), WINGS UP (a winged bug's wings half raised), else STILT (the
 *          body raised high on straightened legs, the antennae thrust forward).
 *  eat     by its mouth: CHEW (mandibles working, the head bobbing), SIP (a proboscis dabbing), CLAW-FEED (a chela
 *          carrying food to the mouth, the mandibles working).
 *  sleep   TUCK: the body lowered toward the ground, the antennae laid back, still but for a slow breath.
 * Sources: Hölldobler & Wilson 1990 (antennal grooming); Wigglesworth 1972 (abdominal pumping); Atema & Voigt 1995
 * (lobster agonistic display); Polis 1990 (scorpion defence posture); Kaiser et al. 2014 (insect sleep postures).
 */
import { I3, mm, rotX, rotY, rotZ } from '../fauna/vec.js';

const TAU = 2 * Math.PI, DEG = Math.PI / 180;
export const BUG_BEHAVIORS = ['relax', 'alert', 'eat', 'sleep'];

/** what a bug's parts let it do: the strategy per behavior word and the line the readout says */
export function bugRepertoire(ctx) {
  const ids = new Set(ctx.K.bones.map((b) => b.id)), raised = ctx.legs.filter((l) => !l.ground && l.side === 'R');
  const chela = ctx.K.legs.some((l) => l.chela), meta = ids.has('metasoma0'), wings = ctx.K.bones.some((b) => b.role === 'wing');
  const raptor = raised.length > 0 && !chela, mouth = ctx.K.bones.find((b) => b.role === 'mouth')?.id;
  const spider = ctx.ground.length === 4 && !chela && !meta;
  const alert = chela || meta ? 'claws-up' : raptor ? 'strike-ready' : spider ? 'forelegs-up' : wings ? 'wings-up' : 'stilt';
  const eat = chela ? 'claw-feed' : mouth === 'proboscis' ? 'sip' : 'chew';
  return {
    relax: { strategy: 'groom', line: 'stands grooming: the antennae sweeping, the abdomen pumping' },
    alert: { strategy: alert, line: { 'claws-up': meta ? 'claws up and gaping, the sting arched over its back' : 'claws raised high and gaping', 'strike-ready': 'the raptorial forelegs raised to strike', 'forelegs-up': 'the front legs raised off the ground', 'wings-up': 'the wings half raised, ready to fly', stilt: 'up on straightened legs, the antennae thrust forward' }[alert] },
    eat: { strategy: eat, line: { 'claw-feed': 'carries food to its mouth in its claws', sip: 'dabs and sips with its proboscis', chew: 'chews, the mandibles working' }[eat] },
    sleep: { strategy: 'tuck', line: 'rests low, the antennae laid back' },
  };
}

/** a behavior's pose at phase t ∈ [0, 1): the pose spec gait.js poseBones reads */
export function behaviorPose(ctx, word, t) {
  const R = bugRepertoire(ctx)[word]; if (!R) throw new Error(`no bug behavior '${word}' (the behaviors: ${BUG_BEHAVIORS.join(', ')})`);
  const local = {}, feet = {}, by = ctx.by, H = ctx.hipH, s = (id) => (id.endsWith('L') ? -1 : 1);
  const plant = (dz = 0, except = []) => { for (const l of ctx.legs) if (l.ground && !except.includes(l.pair)) feet[l.key] = l.rest.foot; return dz; };
  const antennae = (yaw, pitch) => { for (const id of ['antenna0R', 'antenna0L']) if (by[id]) local[id] = mm(rotZ(s(id) * yaw), rotX(pitch)); };
  const tails = ctx.K.bones.filter((b) => /^tail\d+$/.test(b.id));
  const pump = (amp) => { for (const b of tails) local[b.id] = rotX(amp * Math.sin(TAU * t) / Math.max(1, tails.length)); };
  let T = [0, 0, 0], Rr = I3;
  switch (R.strategy) {
    case 'groom': plant(); antennae(14 * DEG * Math.sin(TAU * t), 6 * DEG * Math.sin(TAU * t + 1)); pump(6 * DEG); break;
    case 'stilt': plant(); T = [0, 0, 0.35 * H]; Rr = rotX(6 * DEG); antennae(-6 * DEG, 12 * DEG + 3 * DEG * Math.sin(TAU * t)); break;
    case 'wings-up': {
      plant(); antennae(0, 10 * DEG); const a = (30 + 4 * Math.sin(TAU * t)) * DEG;
      for (const b of ctx.K.bones) if (b.role === 'wing') local[b.id] = rotY(-s(b.id) * a);
      for (const b of ctx.K.bones) if (b.role === 'elytron') local[b.id] = mm(rotZ(s(b.id) * 15 * DEG), rotX(-25 * DEG));
      break; }
    case 'forelegs-up': {
      const front = ctx.ground[0]; plant(0, [front]); T = [0, 0, 0.1 * H]; Rr = rotX(10 * DEG);
      for (const side of ['R', 'L']) { const id = `leg${front}Femur${side}`; if (by[id]) local[id] = rotX((45 + 6 * Math.sin(TAU * t)) * DEG); const c = `leg${front}Coxa${side}`; if (by[c]) local[c] = rotZ(-s(c) * 15 * DEG); }
      break; }
    case 'strike-ready': {
      plant(); T = [0, 0, 0.15 * H]; Rr = rotX(12 * DEG);
      for (const l of ctx.legs.filter((x) => !x.ground)) { local[l.ids[1]] = rotX((35 + 5 * Math.sin(TAU * t)) * DEG); local[l.ids[2]] = rotX(25 * DEG); }
      antennae(0, 15 * DEG); break; }
    case 'claws-up': {
      plant(); T = [0, 0, 0.12 * H];
      for (const l of ctx.legs.filter((x) => !x.ground)) {
        local[l.ids[0]] = rotX((30 + 6 * Math.sin(TAU * t)) * DEG);
        const dac = `leg${l.pair}Dactyl${l.side}`; if (by[dac]) local[dac] = rotX(18 * DEG * (0.5 + 0.5 * Math.sin(TAU * t)));
      }
      // the scorpion's sting: its tail arched higher over the back, quivering
      for (const b of ctx.K.bones) if (/^metasoma\d+$/.test(b.id)) local[b.id] = rotX((-9 - 2 * Math.sin(TAU * t)) * DEG);
      break; }
    case 'chew': case 'claw-feed': case 'sip': {
      plant();
      if (by.head) local.head = rotX((R.strategy === 'sip' ? 10 : 4) * DEG * Math.sin(TAU * t));
      for (const id of ['mandibleR', 'mandibleL', 'fangR', 'fangL']) if (by[id]) local[id] = rotZ(s(id) * 14 * DEG * (0.5 + 0.5 * Math.sin(2 * TAU * t)));
      if (by.proboscis) local.proboscis = rotX(-12 * DEG * (0.5 + 0.5 * Math.sin(TAU * t)));
      if (R.strategy === 'claw-feed') for (const l of ctx.legs.filter((x) => !x.ground)) {
        // the claw swings in toward the mouth and back
        local[l.ids[0]] = mm(rotZ(s(l.ids[0]) * 25 * DEG * (0.5 + 0.5 * Math.sin(TAU * t))), rotX(10 * DEG));
        const dac = `leg${l.pair}Dactyl${l.side}`; if (by[dac]) local[dac] = rotX(-10 * DEG * Math.sin(TAU * t));
      }
      break; }
    case 'tuck': {
      plant(); T = [0, 0, -0.45 * H]; antennae(0, -20 * DEG); pump(2 * DEG);
      for (const b of ctx.K.bones) if (/^antenna1[RL]$/.test(b.id)) local[b.id] = rotX(-15 * DEG);
      break; }
    default: throw new Error(`bug behavior: strategy '${R.strategy}' is not posed`);
  }
  return { root: { R: Rr, T }, local, feet };
}

/** a behavior loop's duration, seconds (a breath, a chew), a little slower on a bigger bug */
export function behaviorSeconds(ctx, word) {
  const base = { relax: 3, alert: 2, eat: 1.2, sleep: 4 }[word] ?? 3;
  return Math.round(base * Math.max(0.7, Math.min(1.6, Math.sqrt(ctx.L / 0.05))) * 1e4) / 1e4;
}
