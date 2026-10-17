// The two pictures of the model scene: the network (columns of nodes joined by lines), and one small matrix
// multiplication, worked out step by step. All numbers are made up: this shows the idea, not a real model.
import { h } from '../dom.ts';
import { svg } from './svg.ts';

// ---------- the network ----------

const COLS = [5, 7, 7, 7, 6]; // nodes per column: the inputs, three layers, the scores
const W = 600;
const H = 290;
const STEP_MS = 260;
const colX = (c: number) => 40 + (c * (W - 80)) / (COLS.length - 1);
const nodeY = (c: number, i: number) => H / 2 - 12 + (i - (COLS[c]! - 1) / 2) * 36;

export function drawNetwork() {
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'net-svg', role: 'img', 'aria-label': 'A neural network: numbers flow from left to right through layers' });
  // Each line is one number of the model (a weight). edges[c] = the lines going into column c.
  const edges: SVGElement[][] = COLS.map(() => []);
  for (let c = 1; c < COLS.length; c++) {
    for (let i = 0; i < COLS[c - 1]!; i++) {
      for (let j = 0; j < COLS[c]!; j++) {
        const line = svg('line', { x1: colX(c - 1), y1: nodeY(c - 1, i), x2: colX(c), y2: nodeY(c, j), class: 'net-edge' });
        edges[c]!.push(line);
        el.append(line);
      }
    }
  }
  const nodes = COLS.map((n, c) =>
    Array.from({ length: n }, (_, i) => {
      const node = svg('circle', { cx: colX(c), cy: nodeY(c, i), r: 11, class: 'net-node' });
      el.append(node);
      return node;
    }),
  );
  // The middle columns stand for many more layers than we can draw.
  el.append(
    svg('rect', { x: colX(1) - 26, y: 14, width: colX(3) - colX(1) + 52, height: H - 52, rx: 18, class: 'net-layers' }),
    svg('text', { x: (colX(1) + colX(3)) / 2, y: H - 12, class: 'net-label' }, 'layers: real models have dozens'),
    svg('text', { x: colX(0), y: H - 12, class: 'net-label' }, 'in'),
    svg('text', { x: colX(4), y: H - 12, class: 'net-label' }, 'scores'),
  );

  /** One pass: the numbers light up column by column, left to right. Takes about 1.4 s. */
  function pulse(timers: number[]): void {
    COLS.forEach((_, c) =>
      timers.push(
        window.setTimeout(() => {
          edges.forEach((col, k) => col.forEach((e) => e.classList.toggle('on', k === c)));
          // A random shade per node: each one holds a number, and every pass the numbers are different.
          nodes[c]!.forEach((n) => {
            n.classList.add('on');
            n.style.fillOpacity = (0.2 + Math.random() * 0.8).toFixed(2);
          });
        }, c * STEP_MS),
      ),
    );
    timers.push(window.setTimeout(() => edges.forEach((col) => col.forEach((e) => e.classList.remove('on'))), COLS.length * STEP_MS + 200));
  }

  function reset(): void {
    edges.forEach((col) => col.forEach((e) => e.classList.remove('on')));
    nodes.forEach((col) => col.forEach((n) => n.classList.remove('on')));
  }

  return { el, pulse, reset };
}

// ---------- one matrix multiplication ----------

const WEIGHTS = [
  [0.2, -1.0, 0.5],
  [0.8, 0.4, -0.3], // chosen so every result has one decimal: 0.7 and 0.4
];
const INPUT = [1.0, 0.5, 2.0];
const fmt = (x: number) => (x < 0 ? `−${Math.abs(x).toFixed(1)}` : x.toFixed(1));
const ROW_MS = 1500;

export function drawMatmul() {
  const cells = WEIGHTS.map((row) => row.map((x) => h('span.mm-cell', null, fmt(x))));
  const outs = WEIGHTS.map(() => h('span.mm-cell.out', null, '?'));
  const ins = INPUT.map((x) => h('span.mm-cell.in', null, fmt(x)));
  const sum = h('p.mm-sum');
  const block = (cls: string, label: string, ...items: HTMLElement[]) => h('div.mm-block', null, h(`div.mm-grid.${cls}`, null, ...items), h('span.mm-label', null, label));
  const el = h(
    'div.matmul',
    null,
    h(
      'div.mm-row',
      null,
      block('w', 'weights: the model', ...cells.flat()),
      h('span.mm-op', null, '×'),
      block('v', 'numbers in', ...ins),
      h('span.mm-op', null, '='),
      block('v', 'numbers out', ...outs),
    ),
    sum,
  );

  /** Works out each output number: one row of weights times the inputs, added up. */
  function play(timers: number[]): void {
    outs.forEach((o) => (o.textContent = '?'));
    sum.textContent = '';
    WEIGHTS.forEach((row, r) => {
      timers.push(
        window.setTimeout(() => {
          cells.forEach((cr, k) => cr.forEach((c) => c.classList.toggle('on', k === r)));
          ins.forEach((c) => c.classList.add('on'));
          const total = row.reduce((s, w, k) => s + w * INPUT[k]!, 0);
          sum.textContent = `${row.map((w, k) => `${fmt(w)} × ${fmt(INPUT[k]!)}`).join('  +  ')}  =  ${fmt(total)}`;
          timers.push(window.setTimeout(() => (outs[r]!.textContent = fmt(total)), ROW_MS / 2));
        }, 500 + r * ROW_MS),
      );
    });
  }

  return { el, play };
}

// ---------- loops in loops ----------

const TOTAL = 15 * 40 * 1_000_000_000;

/** Three loops, one inside the other, then what they multiply out to. Rough round numbers, to show the scale. */
export function drawLoops() {
  const box = (cls: string, title: string, note: string, ...inside: HTMLElement[]) =>
    h(`div.lp-box.${cls}`, null, h('p.lp-title', null, h('span.lp-icon', null, '↻'), title), h('p.lp-note', null, note), ...inside);
  const inner = box('formula', 'Each piece: the whole formula', '≈ 1,000,000,000 multiply-and-adds, in a small model');
  const middle = box('model', 'Each reply: the model, one piece at a time', '≈ 40 pieces for one tool call', inner);
  const outer = box('harness', 'Your harness: until the job is done', '15 tool calls for 4 disks', middle);
  const total = h('b.lp-total', null, '0');
  const sum = h('p.lp-sum', null, '15 × 40 × 1,000,000,000 = ', total, ' multiplications, to move 4 disks');
  const el = h('div.loops', null, outer, sum);

  /** The boxes appear from the outside in, then the total counts up. Takes about 3.5 s. */
  function play(timers: number[]): void {
    const parts = [outer, middle, inner, sum];
    parts.forEach((p) => p.classList.remove('shown'));
    total.textContent = '0';
    parts.forEach((p, k) => timers.push(window.setTimeout(() => p.classList.add('shown'), k * 700)));
    const STEPS = 30;
    for (let i = 1; i <= STEPS; i++) {
      timers.push(window.setTimeout(() => (total.textContent = Math.round((TOTAL * i) / STEPS).toLocaleString('en')), 2100 + i * 40));
    }
  }

  return { el, play };
}
