// Scene: Claude Sonnet 5.5 solves the Tower of Hanoi through our agent loop (server.py → claude_agent.py). Each move
// arrives as a message: the disk slides over and the tool call it made shows under the board. "Show its thinking"
// reveals, per move, what it said before the call and any thinking summary.
import { h } from '../dom.ts';
import { svg } from './svg.ts';

const SERVER = 'http://localhost:8787/hanoi';
const DISKS = 4;
const AGENT = 'claude';
const MODEL = 'claude-sonnet-5-5';

// The board, in SVG units.
const W = 1200;
const BASE = 400; // the floor line
const DISK_H = 40;
const PEG_X: Record<string, number> = { A: 200, B: 600, C: 1000 };
const LIFT = 70; // how high a disk rises before it slides over
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
  tool_call: { name: string; arguments: Record<string, string> };
}
interface DoneEvent {
  type: 'done';
  solved: boolean;
  moves: number;
  seconds: number;
}

const diskWidth = (size: number) => 120 + ((size - 1) * 240) / (DISKS - 1);

function drawBoard(): { el: SVGElement; disks: Map<number, SVGElement> } {
  const el = svg('svg', { viewBox: `0 110 ${W} 370`, class: 'hanoi-board', role: 'img', 'aria-label': 'Tower of Hanoi board' });
  el.append(svg('line', { x1: 40, y1: BASE, x2: W - 40, y2: BASE, class: 'floor' }));
  for (const [peg, x] of Object.entries(PEG_X)) {
    el.append(svg('line', { x1: x, y1: BASE, x2: x, y2: BASE - 220, class: 'peg' }));
    const label = svg('text', { x, y: BASE + 56, class: 'peg-label' });
    label.textContent = peg;
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
  for (const [peg, stack] of Object.entries(board)) stack.forEach((size, i) => at.set(size, [PEG_X[peg]!, BASE - i * DISK_H]));
  return at;
}

const place = (g: SVGElement, [x, y]: [number, number]) => g.setAttribute('transform', `translate(${x} ${y})`);

export function hanoiScene(host: HTMLElement): () => void {
  const { el: boardEl, disks } = drawBoard();
  const startBoard: Board = { A: Array.from({ length: DISKS }, (_, i) => DISKS - i), B: [], C: [] };
  const now = positions(startBoard);
  disks.forEach((g, size) => place(g, now.get(size)!));

  const start = h('button.btn', { type: 'button' }, 'Start') as HTMLButtonElement;
  const reveal = h('button.btn.quiet', { type: 'button' }, 'Show its thinking') as HTMLButtonElement;
  const count = h('b.big-count', null, '0');
  const status = h('p.hanoi-status', null, 'Ready');
  // The exact call the model made, as it sent it.
  const lastCall = h('code.call', null, 'no tool call yet');
  const illegal = h('b', null, '0');
  const timeline = h('ol.thought-list');
  const layer = h('div.thinking.layer', null, h('p.who', null, 'Claude Sonnet 5.5'), h('p.how', null, 'What it said before each tool call, and any thinking it showed'), timeline);

  host.replaceChildren(
    h(
      'div.hanoi',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'Tower of Hanoi.'), ' All disks to C. One at a time, never big on small.'), h('div.controls', null, start, reveal)),
      boardEl,
      h(
        'div.hanoi-low',
        null,
        h('div.score', null, h('p.count-line', null, count, h('span', null, ` moves, best possible is ${2 ** DISKS - 1}`)), h('p.tally', null, h('span', null, illegal, ' illegal'), status), h('p.last-call', null, h('span', null, 'Last tool call'), lastCall)),
        layer,
      ),
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
    const args = Object.entries(e.tool_call.arguments).map(([k, v]) => `${k}: "${v}"`).join(', ');
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
        ),
        h('span.t-cost', null, `${e.tokens} tokens`, h('br'), `${(e.ms / 1000).toFixed(1)} s`),
      ),
    );
    timeline.scrollTop = timeline.scrollHeight;
  }

  start.addEventListener('click', () => {
    source?.close();
    // Back to the start: all disks on A, empty counters and timeline.
    positions(startBoard).forEach((at, size) => {
      now.set(size, at);
      place(disks.get(size)!, at);
    });
    count.textContent = '0';
    illegal.textContent = '0';
    timeline.replaceChildren();
    start.disabled = true;
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
        start.disabled = false;
        start.textContent = 'Play again';
      }
    };
    source.onerror = () => {
      source?.close();
      status.textContent = "Couldn't reach server.py. Is it running?";
      start.disabled = false;
    };
  });

  reveal.addEventListener('click', () => {
    layer.classList.add('shown');
    reveal.disabled = true;
  });

  return () => {
    source?.close();
    timers.forEach(clearTimeout);
    timers = [];
  };
}
