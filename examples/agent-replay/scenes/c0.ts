// Example chapter C0 "Watch the agents work" (examples/agent-replay): replays a real, scrubbed agent session
// (agent_session.ts, written by tools/session_import.py) with agent_replay_kit.ts. The prompt types with the voice,
// rises to the top, and the replay window opens on "orchestrator" and ends with the narration: the session's own
// compressed clock is stretched onto those two word cues, so a re-voiced line keeps the replay in sync.
// Ink plate; the signal layer carries only what is live: the caret, running spinners, the active card, the main lane.
import { ShotScene, W, rgba, tw, ease, lerp, F, font, type SC } from './_shots';
import { K } from './_devices';
import { drawPrompt, drawChat, drawFanout, replayKicker, RT } from './agent_replay_kit';
import session from './agent_session';

const L = (n: number) => `C0-L${n}`;
const CHAT = { x: 100, y: 176, w: 930, h: 716 };
const FAN = { x: 1090, y: 176, w: 730, h: 716 };

export default class C0 extends ShotScene {
  build() {
    const q = this.q;
    const t0 = q.s(L(1)), tEnd = q.end(L(3));
    const tA = q.w(L(2), 'orchestrator') - 0.15; // replay window opens
    const tB = tEnd - 0.25; // and closes with the last word
    const tUp = q.s(L(2)) - 0.1; // the prompt rises
    this.shots = [{
      t0: t0 - 0.5, t1: tEnd + 1, paper: 0, drift: () => 0.35,
      cam: [K(t0 - 0.5, W / 2, 540, 1.04), K(tA, W / 2, 540, 1), K(tEnd + 1, W / 2, 536, 1.02)],
      draw: (o: SC) => {
        const t = o.t, c = o.c, s = o.s;
        // prompt: centre → top strip
        const u = tw(t, tUp, tUp + 0.7, ease.inOutCubic);
        const size = lerp(RT.prompt + 8, 30, u);
        const w = lerp(1000, CHAT.w, u), x = lerp(W / 2 - 500, CHAT.x, u), y = lerp(480, 62, u);
        drawPrompt(c, s, session.prompt || q.typed(L(1), t), session.prompt ? q.spoken(L(1), t + 0.15) : 1, x, y, w, tw(t, t0 - 0.4, t0), t, size);
        // the replay
        const aP = tw(t, tA - 0.1, tA + 0.45, ease.outCubic);
        drawFanout(c, s, session, t, tA, tB, FAN, aP);
        drawChat(c, s, session, t, tA, tB, CHAT, tw(t, tA + 0.2, tA + 0.7, ease.outCubic));
        // kicker: what this is, how much it was sped up
        c.save(); c.globalAlpha *= aP;
        c.font = font(F.mono(500), RT.kicker); c.textAlign = 'right'; c.fillStyle = rgba('ash', 1);
        c.fillText(replayKicker(session, tA, tB), FAN.x + FAN.w, 118);
        c.restore();
      },
    }];
  }
}
