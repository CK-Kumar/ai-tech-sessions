// Scene: two AI fighters, a fast one (System 1) and a thinking one (System 2). Each side shows its "brain": a clock
// for how long the current answer is taking, and what it answered. Uses Opper's engine and renderer; every move goes
// through our server.py.
import { Match } from '../../shared/match.ts';
import { modelInfo } from '../../shared/models.ts';
import type { Decision, FighterMeta } from '../../shared/replay.ts';
import { modelAdapter } from '../api.ts';
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';
import { control, PAUSE, PLAY, RESTART, STOP } from './controls.ts';
import { Stage } from '../stage.ts';
import { SIDES } from '../theme.ts';

/** The game drops any answer slower than this and the fighter blocks instead. */
const DEADLINE_MS = 2000;
/** server.py keeps the thinking model's last thought here (the game itself only sees the move). */
const THINKING = 'http://localhost:8787/thinking';

/** What the room reads under each fighter's name. */
const ABOUT: Record<string, { name: string; maker: string; how: string }> = {
  'typesafe/jev-1.14.0': { name: 'Jev 1.14', maker: 'by TypeSafe', how: 'System 1 · answers at once' },
  'anthropic/claude-haiku-5-5': { name: 'Claude Haiku 5.5', maker: 'by Anthropic', how: 'System 2 · thinks first' },
};
const about = (id: string) => ABOUT[id] ?? { name: modelInfo(id).label, maker: '', how: '' };
const thinks = (id: string) => id.startsWith('anthropic/');

interface Live {
  thinking: string;
  move: string;
  ms: number;
  busy: boolean;
}

interface Brain {
  el: HTMLElement;
  clock: HTMLElement;
  answer: HTMLElement;
  thought: HTMLElement;
  inTime: HTMLElement;
  late: HTMLElement;
  counts: { inTime: number; late: number };
  lastMs: number;
}

function brain(side: 'a' | 'b', id: string): Brain {
  const b = {
    clock: h('p.clock', null, '0.00 s'),
    answer: h('div.answer'),
    // The fast model has no thought to show: saying so is the contrast.
    thought: h('p.thought', null, thinks(id) ? '' : 'No thinking step. It answers straight away.'),
    inTime: h('b', null, '0'),
    late: h('b', null, '0'),
  };
  b.answer.append(h('p.waiting', null, 'Waiting for the first move'));
  const el = h(
    `section.brain.${side}`,
    null,
    h('p.who', null, about(id).name),
    h('p.maker', null, about(id).maker),
    h('p.how', null, about(id).how),
    h('div.clock-box', null, b.clock, h('p.clock-note', null, 'to answer')),
    h('div.mind', null, b.answer, h('p.tally', null, h('span', null, b.inTime, ' in time'), h('span', null, b.late, ' too late'))),
    b.thought,
  );
  return { el, ...b, counts: { inTime: 0, late: 0 }, lastMs: 0 };
}

/** low_kick_sweep → low kick sweep */
const pretty = (move: string) => move.replaceAll('_', ' ');

function showClock(b: Brain, ms: number): void {
  b.clock.textContent = `${(ms / 1000).toFixed(2)} s`;
  b.clock.classList.toggle('late', ms >= DEADLINE_MS);
}

function showDecision(b: Brain, d: Decision): void {
  b.lastMs = d.latencyMs;
  const late = d.fallback !== null;
  if (late) b.counts.late++;
  else b.counts.inTime++;
  b.inTime.textContent = String(b.counts.inTime);
  b.late.textContent = String(b.counts.late);
  const probs = d.answer?.probabilities;
  if (late) {
    b.answer.replaceChildren(h('p.wrote.late', null, 'Too late, so it blocks'));
  } else if (probs) {
    const top = Object.entries(probs).sort((x, y) => y[1]! - x[1]!).slice(0, 3);
    b.answer.replaceChildren(
      ...top.map(([move, p]) => {
        const pct = `${Math.round(p! * 100)}%`;
        const row = h('div.prob', null, h('span', null, pretty(move)), h('span.pct', null, pct));
        row.style.setProperty('--p', pct);
        return row;
      }),
    );
  } else {
    b.answer.replaceChildren(h('p.wrote', null, 'Wrote ', h('q', null, pretty(d.move))));
  }
}

/** The move it chose and how long that took come first, so a long thought cut at three lines never hides them. */
function showThought(b: Brain, live: Live): void {
  if (live.busy && !live.thinking) {
    b.thought.replaceChildren(h('span.thinking-now', null, 'Thinking…'));
    return;
  }
  const verdict = live.move ? h(`span.verdict${live.ms >= DEADLINE_MS ? '.late' : ''}`, null, `${pretty(live.move)} after ${(live.ms / 1000).toFixed(1)} s: `) : null;
  b.thought.replaceChildren(verdict ?? '', h('q', null, live.thinking.trim()));
}

/** Mounts the scene in `host`; returns a function that stops the fight and frees the canvas. */
export function fightScene(host: HTMLElement, left: string, right: string): Mounted {
  const ids = [left, right] as const;
  const meta = ids.map((id, k): FighterMeta => ({ model: id, label: about(id).name, kind: modelInfo(id).kind, color: SIDES[k]!.deep, via: 'server' })) as [FighterMeta, FighterMeta];
  const brains = [brain('a', left), brain('b', right)] as const;
  const arena = h('div.arena');
  const start = control('primary', PLAY, 'Start fight');
  const pause = control('quiet', PAUSE, 'Pause');
  const stop = control('quiet', STOP, 'Stop');
  pause.el.disabled = stop.el.disabled = true;
  host.replaceChildren(
    h(
      'div.fight',
      null,
      brains[0].el,
      arena,
      brains[1].el,
      h('div.controls-row', null, start.el, pause.el, stop.el),
    ),
  );

  const stage = new Stage(arena, meta);
  stage.sound = false;
  let match: Match | null = null;

  stage.onFrame = () => {
    for (const i of [0, 1] as const) {
      const p = match?.pending[i];
      // While a question is out, the clock runs; otherwise it holds the last answer's time.
      showClock(brains[i], p && !p.settled ? performance.now() - p.askedAt : brains[i].lastMs);
    }
  };

  // The game only gets the move; the thought comes from server.py, read a few times a second while the fight runs.
  const thinker = ids.findIndex(thinks);
  const poll = setInterval(async () => {
    if (thinker < 0 || !match || match.held) return;
    try {
      const live = (await (await fetch(THINKING)).json()) as Live;
      showThought(brains[thinker]!, live);
    } catch {
      // server.py not running: the panel keeps its last thought
    }
  }, 300);

  pause.el.addEventListener('click', () => {
    if (!match) return;
    match.held = !match.held;
    stage.paused = match.held;
    if (match.held) pause.set(PLAY, 'Resume');
    else pause.set(PAUSE, 'Pause');
  });

  stop.el.addEventListener('click', () => {
    match?.stop();
    match = null;
    stage.paused = false;
    start.set(PLAY, 'Start fight');
    pause.set(PAUSE, 'Pause');
    pause.el.disabled = stop.el.disabled = true;
  });

  start.el.addEventListener('click', async () => {
    match?.stop();
    brains.forEach((b) => {
      b.counts = { inTime: 0, late: 0 };
      b.lastMs = 0;
      b.answer.replaceChildren(h('p.waiting', null, 'Waiting for the first move'));
    });
    if (thinker >= 0) brains[thinker]!.thought.replaceChildren();
    match = new Match({
      seed: Math.floor(Math.random() * 2 ** 31),
      mode: 'realtime',
      track: 'raw',
      deadlineMs: DEADLINE_MS,
      adapters: [modelAdapter(left, {}), modelAdapter(right, {})],
      fighters: meta,
    });
    match.onTick((st, events) => stage.tick(st, events));
    match.onDecision((d) => showDecision(brains[d.fighter], d));
    stage.tick(match.state);
    start.set(RESTART, 'Restart');
    stage.paused = false;
    pause.set(PAUSE, 'Pause');
    pause.el.disabled = stop.el.disabled = false;
    await match.warmUp();
    await match.run();
  });

  // A match that never runs, just to draw the two fighters standing before the start.
  stage.tick(new Match({ seed: 1, mode: 'realtime', deadlineMs: DEADLINE_MS, adapters: [modelAdapter(left, {}), modelAdapter(right, {})], fighters: meta }).state);

  return {
    stop: () => {
      clearInterval(poll);
      match?.stop();
      stage.destroy();
    },
  };
}
