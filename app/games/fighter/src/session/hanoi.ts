// Scene: Claude Sonnet 5.5 solves the Tower of Hanoi through our agent loop (server.py → claude_agent.py). Each move
// arrives as a message: the disk slides over, the left panel shows the tool call it made, and the right panel what it
// said and thought before each call. Same layout as the Fight slide: panel | board | panel, buttons underneath.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';
import { control, PLAY, RESTART, STOP } from './controls.ts';
import { svg } from './svg.ts';

const SERVER = 'http://localhost:8787/hanoi';
// 3 disks: 7 moves, solved in well under a minute, so the room doesn't wait.
const DISKS = 3;
const AGENT = 'claude';
const MODEL = 'claude-sonnet-5-5';
/** The tools in hanoi_tools.py: one per tower. The model picks the tool (where to) and the disk (which one). */
const TOOLS = ['move_to_A', 'move_to_B', 'move_to_C'];

// The board, in SVG units.
const W = 960;
const BASE = 400; // the floor line
const DISK_H = 48;
const TOWER_X: Record<string, number> = { A: 170, B: 480, C: 790 };
const TOWER_H = DISKS * DISK_H + 70;
const LIFT = 50; // how high a disk rises before it slides over
const STEP_MS = 160;

type Board = Record<'A' | 'B' | 'C', number[]>;

interface MoveEvent {
  type: 'move';
  move: string;
  ok: boolean;
  board: Board;
  moves: number;
  illegal: number;
  thinking: string;
  said: string;
  tokens: number;
  ms: number;
  tool_call: { name: string; arguments: Record<string, unknown> };
}
interface DoneEvent {
  type: 'done';
  solved: boolean;
  moves: number;
  seconds: number;
}

const diskWidth = (size: number) => 100 + ((size - 1) * 180) / (DISKS - 1);

function drawBoard(): { el: SVGElement; disks: Map<number, SVGElement> } {
  const el = svg('svg', { viewBox: `0 ${BASE - TOWER_H - 10} ${W} ${TOWER_H + 80}`, class: 'hanoi-board', role: 'img', 'aria-label': 'Tower of Hanoi board' });
  el.append(svg('line', { x1: 40, y1: BASE, x2: W - 40, y2: BASE, class: 'floor' }));
  for (const [tower, x] of Object.entries(TOWER_X)) {
    el.append(svg('line', { x1: x, y1: BASE, x2: x, y2: BASE - TOWER_H, class: 'tower' }));
    const label = svg('text', { x, y: BASE + 56, class: 'tower-label' });
    label.textContent = tower;
    el.append(label);
  }
  const disks = new Map<number, SVGElement>();
  for (let size = DISKS; size >= 1; size--) {
    const w = diskWidth(size);
    const g = svg('g', { class: 'disk' });
    // Bigger disks are deeper in colour, so size reads at a glance from the back of the room.
    const r = svg('rect', { x: -w / 2, y: -DISK_H - 2, width: w, height: DISK_H - 4, rx: 14, style: `fill: color-mix(in srgb, var(--blue-deep) ${((size - 1) / (DISKS - 1)) * 100}%, var(--periwinkle))` });
    g.append(r);
    disks.set(size, g);
    el.append(g);
  }
  return { el, disks };
}

/** Where each disk should sit for a board. */
function positions(board: Board): Map<number, [number, number]> {
  const at = new Map<number, [number, number]>();
  for (const [tower, stack] of Object.entries(board)) stack.forEach((size, i) => at.set(size, [TOWER_X[tower]!, BASE - i * DISK_H]));
  return at;
}

const place = (g: SVGElement, [x, y]: [number, number]) => g.setAttribute('transform', `translate(${x} ${y})`);

export function hanoiScene(host: HTMLElement): Mounted {
  const { el: boardEl, disks } = drawBoard();
  const startBoard: Board = { A: Array.from({ length: DISKS }, (_, i) => DISKS - i), B: [], C: [] };
  const now = positions(startBoard);
  disks.forEach((g, size) => place(g, now.get(size)!));

  const start = control('primary', PLAY, 'Start');
  const stop = control('quiet', STOP, 'Stop');
  stop.el.disabled = true;
  const count = h('b.big-count', null, '0');
  const status = h('p.hanoi-status', null, 'Ready');
  // The exact call the model made, as it sent it.
  const lastCall = h('code.call', null, 'no tool call yet');
  const illegal = h('b', null, '0');
  const toolEls = new Map(TOOLS.map((name) => [name, h('li.tool-pill', null, h('code', null, `${name}(disk)`))]));
  const timeline = h('ol.thought-list', null, h('li.t-empty', null, 'Each move shows up here: the call, and what it thought first.'));

  host.replaceChildren(
    h(
      'div.hanoi',
      null,
      h(
        'section.panel',
        null,
        h('p.who', null, 'Claude Sonnet 5.5'),
        h('p.maker', null, 'by Anthropic'),
        h('p.how', null, 'Agent loop · tool calls'),
        h('p.count-line', null, count, h('span', null, ` / ${2 ** DISKS - 1} moves`)),
        h('p.tally', null, h('span', null, illegal, ' illegal'), status),
        h('div.tools-box', null, h('span', null, 'Tools it can call'), h('ul.hanoi-tools', null, ...toolEls.values())),
        h('p.last-call', null, h('span', null, 'Last tool call'), lastCall),
      ),
      h('div.board-card', null, h('p.board-rule', null, h('b', null, 'Goal: '), 'all disks to C. One at a time, never big on small.'), boardEl),
      h('section.panel.timeline-panel', null, h('p.panel-head', null, 'Its thinking'), timeline),
      h('div.controls-row', null, start.el, stop.el),
    ),
  );

  let source: EventSource | null = null;
  let timers: number[] = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Lift the disk, slide it over, set it down: the way a hand would move it. */
  function animate(g: SVGElement, from: [number, number], to: [number, number]): void {
    if (reduce) return place(g, to);
    const top = BASE - DISKS * DISK_H - LIFT;
    place(g, [from[0], top]);
    timers.push(window.setTimeout(() => place(g, [to[0], top]), STEP_MS));
    timers.push(window.setTimeout(() => place(g, to), STEP_MS * 2));
  }

  function onMove(e: MoveEvent): void {
    const next = positions(e.board);
    disks.forEach((g, size) => {
      const [a, b] = [now.get(size)!, next.get(size)!];
      if (a[0] !== b[0] || a[1] !== b[1]) animate(g, a, b);
      now.set(size, b);
    });
    count.textContent = String(e.moves);
    illegal.textContent = String(e.illegal);
    status.textContent = e.ok ? `Last: ${e.move.replace('→', ' to ')}` : `Tried ${e.move}: illegal, board unchanged`;
    // The tool it chose lights up: blue when the move worked, red when the harness refused it.
    toolEls.forEach((el, name) => {
      el.classList.toggle('used', name === e.tool_call.name);
      el.classList.toggle('bad', name === e.tool_call.name && !e.ok);
    });
    const args = Object.entries(e.tool_call.arguments).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
    const call = `${e.tool_call.name}(${args})`;
    lastCall.textContent = call;
    // One row per move: the call it made, then what it said and any thinking summary, then its cost.
    timeline.append(
      h(
        'li',
        { class: e.ok ? '' : 'bad' },
        h('span.t-num', null, String(e.moves + e.illegal)),
        h(
          'div.t-body',
          null,
          h('code.call', null, call),
          e.said ? h('p.t-said', null, `“${e.said}”`) : null,
          e.thinking ? h('p.t-thought', null, h('b', null, 'Thinking: '), e.thinking) : null,
          h('p.t-cost', null, `${e.tokens} tokens · ${(e.ms / 1000).toFixed(1)} s`),
        ),
      ),
    );
    timeline.scrollTop = timeline.scrollHeight;
  }

  /** Back to buttons-at-rest: Start offers another game, Stop has nothing to stop. */
  function idle(label: string): void {
    start.el.disabled = false;
    start.set(RESTART, label);
    stop.el.disabled = true;
  }

  start.el.addEventListener('click', () => {
    source?.close();
    // Back to the start: all disks on A, empty counters and timeline.
    positions(startBoard).forEach((at, size) => {
      now.set(size, at);
      place(disks.get(size)!, at);
    });
    count.textContent = '0';
    illegal.textContent = '0';
    timeline.replaceChildren();
    toolEls.forEach((el) => el.classList.remove('used', 'bad'));
    lastCall.textContent = 'no tool call yet';
    start.el.disabled = true;
    stop.el.disabled = false;
    status.textContent = 'Thinking about the first move';
    source = new EventSource(`${SERVER}?agent=${AGENT}&disks=${DISKS}&model=${MODEL}&effort=medium`);
    source.onmessage = (msg) => {
      const e = JSON.parse(msg.data) as MoveEvent | DoneEvent | { type: string };
      if (e.type === 'move') onMove(e as MoveEvent);
      if (e.type === 'done') {
        const d = e as DoneEvent;
        // Close it ourselves: an EventSource whose stream ends reconnects, which would start a new game.
        source?.close();
        status.textContent = d.solved ? `Solved in ${d.seconds} s` : `Not solved after ${d.moves} moves`;
        idle('Play again');
      }
    };
    source.onerror = () => {
      source?.close();
      status.textContent = "Couldn't reach server.py. Is it running?";
      idle('Try again');
    };
  });

  // Closing the stream is enough: server.py notices the page left and stops the loop.
  stop.el.addEventListener('click', () => {
    source?.close();
    status.textContent = 'Stopped';
    idle('Start again');
  });

  return {
    stop: () => {
      source?.close();
      timers.forEach(clearTimeout);
      timers = [];
    },
  };
}
