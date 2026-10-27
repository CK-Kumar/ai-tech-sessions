// Scene: what an agent is. An LLM with a body (tools to act), run in a loop by your code: send the context, the LLM
// picks a tool, your code runs it and adds the result to the context, round again until no tool call.
// The picture (for everyone) and the loop as code (for the technical people) light up together, step by step.
// Scripted: no API calls.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';
import { control, PAUSE, PLAY, RESTART } from './controls.ts';
import { drawLoop, runPulse } from './loop-draw.ts';
import { call, caption, CLICKS, CODE, ROUNDS, STEPS, type Round, type Stage } from './loop-script.ts';

const PLAY_MS = 1400;
const SHOWN_CARDS = 5; // the context stack shows the newest few; the rest is a "+N earlier" pill
/** The arc the dot runs along at each stage: 0 context → LLM, 1 LLM → tools, 2 tools → context. */
const ARC: Partial<Record<Stage, number>> = { send: 0, reply: 1, remember: 2 };
/** The stations lit at each stage: 0 context, 1 LLM, 2 tools. */
const LIT: Record<Stage, number[]> = { send: [0, 1], reply: [1, 2], run: [2], remember: [0], stop: [1] };

interface Card {
  kind: 'task' | 'llm' | 'result';
  who: string;
  text: string;
}

/** What one round writes into the context: the LLM's pick, then the tool's result. */
const written = (r: Round): Card[] =>
  r.tool ? [{ kind: 'llm', who: 'LLM', text: call(r) }, { kind: 'result', who: 'Result', text: r.board! }] : [{ kind: 'llm', who: 'LLM', text: `“${r.say}”` }];

export function loopScene(host: HTMLElement): Mounted {
  const d = drawLoop();

  // Beside the picture: the loop as code, the line doing the work lit in step with the circle.
  const loopLines = CODE.map((c) => h('code.code-line', null, c.line));
  const codeCard = h('div.code-view', null, h('p.code-head', null, 'The loop: the whole agent'), ...loopLines);
  // Under it, one tool: a plain three-line function. Its name follows the tool the LLM picks this round.
  const toolName = h('span', null, 'move_to_C');
  const toolTower = h('span', null, 'C');
  const toolCard = h(
    'div.code-view.tool-example',
    null,
    h('p.code-head', null, 'A tool is just a function'),
    h('code.code-line', null, h('span.kw', null, 'def '), toolName, '(disk):'),
    h('code.code-line', null, '    move(disk, to="', toolTower, '")'),
    h('code.code-line', null, '    ', h('span.kw', null, 'return'), ' board'),
  );

  const say = h('p.loop-caption');
  const play = control('quiet', PLAY, 'Play');
  const reset = control('quiet', RESTART, 'Start over');
  host.replaceChildren(h('div.loop', null, h('p.scene-title.loop-title', null, h('b', null, 'LLM + harness = agent.'), ' The brain, plus a body to act.'), h('div.loop-card', null, d.el), h('div.loop-right', null, codeCard, toolCard), say, h('div.controls-row', null, play.el, reset.el)));

  let click = -1; // the press of Next on screen (-1 = the start)
  let timer = 0; // Play
  let stopPulse = () => {};

  /** Draws step `i` from scratch (-1 = before the first step), so any step can be shown on its own. */
  function show(i: number, animate: boolean, said?: string): void {
    const s = STEPS[i];
    const r = s ? ROUNDS[s.round]! : null;
    const done = s?.stage === 'reply' && !r?.tool; // a reply with no tool call: nothing goes to the tools
    const picked = s && r?.tool && (s.stage === 'reply' || s.stage === 'run') ? r.tool : null;

    // The circle: lit stations, lit arc, and the dot running along it.
    d.nodes.forEach((n, k) => n.classList.toggle('on', !!s && (done ? k === 1 : LIT[s.stage].includes(k))));
    const arc = s && !done ? ARC[s.stage] : undefined;
    d.arcs.forEach((a, k) => a.classList.toggle('on', k === arc));
    stopPulse();
    if (animate && arc !== undefined) stopPulse = runPulse(d, arc);
    d.round.textContent = !s ? 'ready' : s.stage === 'stop' ? 'solved ✓' : `round ${s.round + 1}`;

    // The LLM's bubble: what it says when it replies, otherwise who it is.
    const speaking = s?.stage === 'reply' && r;
    d.bubble.classList.toggle('speaking', !!speaking);
    d.bubble.replaceChildren(
      ...(speaking ? [h('p.bubble-say', null, `“${r.say}”`), r.tool ? h('code.call', null, call(r)) : ''] : [h('p.llm-name', null, 'Claude Sonnet 5.5'), h('p.llm-note', null, 'not your code')]),
    );

    // The tools: the one it picked lights up, then runs.
    d.chips.forEach((chip, name) => {
      chip.classList.toggle('on', name === picked);
      chip.classList.toggle('run', name === picked && s?.stage === 'run');
    });

    // The context: the task, then every round already written in. Newest on top.
    const cards: Card[] = [{ kind: 'task', who: 'Task', text: 'all disks to C' }];
    ROUNDS.forEach((round, k) => {
      if (STEPS.findIndex((st) => st.round === k && (st.stage === 'remember' || st.stage === 'stop')) <= i) cards.push(...written(round));
    });
    const grew = animate && (s?.stage === 'remember' || s?.stage === 'stop');
    // Sending: all of it lights up, because all of it goes to the LLM again, every round.
    d.stack.classList.toggle('sending', s?.stage === 'send');
    const newest = cards.slice(-SHOWN_CARDS).reverse();
    d.stack.replaceChildren(
      ...newest.map((c, k) => h(`li.ctx-card.${c.kind}${grew && k < (s?.stage === 'stop' ? 1 : 2) ? '.new' : ''}`, null, h('b', null, c.who), ' ', c.text)),
      ...(cards.length > SHOWN_CARDS ? [h('li.ctx-more', null, `+ ${cards.length - SHOWN_CARDS} earlier`)] : []),
    );

    // The code: the line doing the work. The last round stops at "break".
    const line = s?.stage === 'stop' || done ? 'reply' : s?.stage;
    loopLines.forEach((el, k) => el.classList.toggle('on', !!line && CODE[k]!.stage === line));
    const tool = r?.tool ?? 'move_to_C';
    toolName.textContent = tool;
    toolTower.textContent = tool.slice(-1);
    toolCard.classList.toggle('run', s?.stage === 'run');

    say.textContent = said ?? (s ? caption(s) : 'The context starts with only the task.');
    // No Next button: the clicker (→ or Space) moves on.
    if (i >= STEPS.length - 1) stopPlaying();
  }

  function stopPlaying(): void {
    clearTimeout(timer);
    timer = 0;
    play.set(PLAY, 'Play');
  }

  /** Shows press `k` (-1 = the start). */
  function go(k: number, animate: boolean): void {
    click = k;
    const c = CLICKS[k];
    if (!c) return show(-1, false);
    show(c.step, animate, c.say);
  }

  /** Play: one press after another. */
  function playNext(): void {
    go(click + 1, true);
    if (click >= CLICKS.length - 1) return stopPlaying();
    timer = window.setTimeout(playNext, PLAY_MS);
  }

  play.el.addEventListener('click', () => {
    if (timer) return stopPlaying();
    if (click >= CLICKS.length - 1) go(-1, false);
    play.set(PAUSE, 'Pause');
    playNext();
  });
  reset.el.addEventListener('click', () => {
    stopPlaying();
    go(-1, false);
  });
  go(-1, false);
  return {
    stop: () => {
      stopPlaying();
      stopPulse();
    },
    // The arrow keys: one press forward or back. False at either end, so the app moves to the next or previous slide.
    step: (by) => {
      const k = click + by;
      if (k < -1 || k > CLICKS.length - 1) return false;
      stopPlaying();
      go(k, by > 0);
      return true;
    },
  };
}
