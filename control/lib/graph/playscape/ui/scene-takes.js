/**
 * SCENE TAKES — what each actor of a page's scripts plays: its face's take and its body's act on the script's clock
 * (actor/act.js sceneActOf: the read the actor's scene gave it, its listening, its nods, its gaze set where its partners
 * stand), keyed by the clip its script's lines name (scene-script.js takeClip: scene:<id>:<k>). The page's figures carry
 * them (worlds/world-kinds.js, the layered kind's `takes`: the act a one-shot clip on the figure's own rig, the take the
 * realistic face's track of the same name), and the page plays them at the line's phase (scene-runner.js view: take.u).
 *
 * The scripts are blocked on the same stage the page lowers them on (scene-script.js scriptStage), so the takes keep the
 * clock the lines were cut at. Who plays is a figure: an entity's `body.figure`; the first entity wearing a figure
 * plays its takes (a figure two characters share in one script plays the first's).
 *
 *   sceneTakes(manifest, { anchors, player }) → { <figure>: { <clip>: { perform, act } } } | null (no script on the page)
 *     perform  the face's take (face-acting/perform.js, as a hero's `perform` entry): { beats, seconds, seed, intensity? }
 *     act      the body's act (as a hero's `acts` entry): { seconds, body, style?, seed, walks?, root }
 *
 *   takesAdvice({ bytes, seconds, actors }) → null, or the advice for a page whose takes run over their budget (advised,
 *     never refused): TAKE_BUDGET bytes a scene-second an actor, TAKES_PAGE bytes a page
 *
 * Pure and deterministic.
 */
import { hasScripts, withScripts, scriptStage } from './scene-script.js';
import { sceneActOf } from '../../actor/act.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Each figure's takes on the page's scripts (see the header). */
export function sceneTakes(manifest, { anchors = [], player = null } = {}) {
  const play = manifest?.play;
  if (!hasScripts(play)) return null;
  const figureOf = Object.fromEntries((Array.isArray(manifest.entities) ? manifest.entities : []).filter((e) => isObj(e) && typeof e.id === 'string' && isObj(e.body) && typeof e.body.figure === 'string').map((e) => [e.id, e.body.figure]));
  const out = {};
  withScripts(play, scriptStage(manifest, play, anchors, player), {
    onScript: (clip, L) => {
      for (const w of L.cast) {
        const fig = figureOf[w];
        if (!fig || out[fig]?.[clip]) continue;
        const A = sceneActOf(L.scene.actors[w], { take: clip });
        (out[fig] ||= {})[clip] = { perform: A.perform[clip], act: A.acts[clip] };
      }
    },
  });
  return Object.keys(out).length ? out : null;
}

/** What a take costs the page, as measured on a realistic hero and a plain one (scene-takes.live.test.js pins it): the
 * bytes a scene-second an actor (its act at TAKE_KEYS, its face at TAKE_FACE_FPS), and a page's for all its takes */
export const TAKE_BUDGET = 20000, TAKES_PAGE = 2_000_000;

/** The advice for takes over their budget (see the header). */
export function takesAdvice({ bytes, seconds, actors }) {
  const per = seconds > 0 && actors > 0 ? bytes / seconds / actors : 0;
  if (bytes > TAKES_PAGE) return `the scenes' takes add ${Math.round(bytes / 1000)} kB to the page (over ${TAKES_PAGE / 1000} kB): shorten the scripts, or split a long one with a choice or a shot between`;
  if (per > TAKE_BUDGET) return `a take costs ${Math.round(per / 1000)} kB a scene-second an actor (over ${TAKE_BUDGET / 1000} kB)`;
  return null;
}

