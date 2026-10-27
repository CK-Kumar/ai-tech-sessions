// The model scene's two pictures: the network (neurons in columns, joined by lines) and one matrix multiplication,
// worked out step by step. They light up together: each row of the matrix is one neuron of the first layer.
// All numbers are made up: this shows the idea, not a real model.
import { h } from '../dom.ts';
import { svg } from './svg.ts';

// ---------- the network ----------

const COLS = [3, 5, 5, 5, 4]; // neurons per column: the numbers in, three layers, the scores
const W = 600;
const H = 300;
const STEP_MS = 260;
const colX = (c: number) => 46 + (c * (W - 92)) / (COLS.length - 1);
const nodeY = (c: number, i: number) => H / 2 - 14 + (i - (COLS[c]! - 1) / 2) * 52;

export function drawNetwork() {
  const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'net-svg', role: 'img', 'aria-label': 'A neural network: numbers flow from left to right through layers of neurons' });
  // Each line is one number of the model (a weight). edges[c][j] = the lines going into neuron j of column c.
  const edges: SVGElement[][][] = COLS.map((n) => Array.from({ length: n }, () => []));
  for (let c = 1; c < COLS.length; c++) {
    for (let i = 0; i < COLS[c - 1]!; i++) {
      for (let j = 0; j < COLS[c]!; j++) {
        const line = svg('line', { x1: colX(c - 1), y1: nodeY(c - 1, i), x2: colX(c), y2: nodeY(c, j), class: 'net-edge' });
        edges[c]![j]!.push(line);
        el.append(line);
      }
    }
  }
  const nodes = COLS.map((n, c) =>
    Array.from({ length: n }, (_, i) => {
      const node = svg('circle', { cx: colX(c), cy: nodeY(c, i), r: 17, class: 'net-node' });
      el.append(node);
      return node;
    }),
  );
  // The middle columns stand for many more layers than we can draw.
  el.append(
    svg('rect', { x: colX(1) - 34, y: 6, width: colX(3) - colX(1) + 68, height: H - 46, rx: 22, class: 'net-layers' }),
    svg('text', { x: (colX(1) + colX(3)) / 2, y: H - 10, class: 'net-label' }, 'neurons: real models have billions'),
    svg('text', { x: colX(0), y: H - 10, class: 'net-label' }, 'numbers in'),
    svg('text', { x: colX(4), y: H - 10, class: 'net-label' }, 'scores'),
  );
  const allEdges = () => edges.flat(2);

  /** One pass: the neurons light up column by column, left to right, each a different shade. Takes about 1.4 s. */
  function pulse(timers: number[]): void {
    COLS.forEach((_, c) =>
      timers.push(
        window.setTimeout(() => {
          allEdges().forEach((e) => e.classList.remove('on'));
          edges[c]!.flat().forEach((e) => e.classList.add('on'));
          // A shade per neuron: each one holds a number, brighter = bigger. Every pass the numbers are different.
          nodes[c]!.forEach((n) => {
            n.classList.add('on');
            n.style.fillOpacity = (0.2 + Math.random() * 0.8).toFixed(2);
          });
        }, c * STEP_MS),
      ),
    );
    timers.push(window.setTimeout(() => allEdges().forEach((e) => e.classList.remove('on')), COLS.length * STEP_MS + 200));
  }

  /** Lights one neuron of the first layer and the lines coming into it: what one row of the matrix computes. */
  function focus(j: number | null): void {
    allEdges().forEach((e) => e.classList.remove('focus'));
    nodes.flat().forEach((n) => n.classList.remove('focus'));
    if (j === null) return;
    edges[1]![j]!.forEach((e) => e.classList.add('focus'));
    nodes[1]![j]!.classList.add('focus');
    nodes[0]!.forEach((n) => n.classList.add('focus'));
  }

  function reset(): void {
    allEdges().forEach((e) => e.classList.remove('on'));
    nodes.flat().forEach((n) => n.classList.remove('on'));
    focus(null);
  }

  return { el, pulse, focus, reset };
}

// ---------- one matrix multiplication ----------

const WEIGHTS = [
  [0.2, -1.0, 0.5],
  [0.8, 0.4, -0.3], // chosen so every result has one decimal: 0.7 and 0.4
];
const INPUT = [1.0, 0.5, 2.0];
const fmt = (x: number) => (x < 0 ? `−${Math.abs(x).toFixed(1)}` : x.toFixed(1));
const ROW_MS = 1700;

/** `onRow(r)` is called as row r is worked out (null at the end), so the network can light the same neuron. */
export function drawMatmul(onRow: (r: number | null) => void) {
  const cells = WEIGHTS.map((row) => row.map((x) => h('span.mm-cell', null, fmt(x))));
  const outs = WEIGHTS.map(() => h('span.mm-cell.out', null, '?'));
  const ins = INPUT.map((x) => h('span.mm-cell.in', null, fmt(x)));
  const sum = h('p.mm-sum');
  const block = (cls: string, label: string, ...items: HTMLElement[]) => h('div.mm-block', null, h(`div.mm-grid.${cls}`, null, ...items), h('span.mm-label', null, label));
  const el = h(
    'div.matmul',
    null,
    h('p.mm-head', null, 'One layer = one matrix multiplication'),
    h('div.mm-row', null, block('w', 'weights (the model)', ...cells.flat()), h('span.mm-op', null, '×'), block('v', 'numbers in', ...ins), h('span.mm-op', null, '='), block('v', 'neurons', ...outs)),
    sum,
  );

  function clear(): void {
    outs.forEach((o) => (o.textContent = '?'));
    cells.flat().forEach((c) => c.classList.remove('on'));
    ins.forEach((c) => c.classList.remove('on'));
    sum.textContent = '';
  }

  /** Works out each neuron's number: its row of weights times the numbers in, added up. */
  function play(timers: number[]): void {
    clear();
    WEIGHTS.forEach((row, r) => {
      timers.push(
        window.setTimeout(() => {
          onRow(r);
          cells.forEach((cr, k) => cr.forEach((c) => c.classList.toggle('on', k === r)));
          ins.forEach((c) => c.classList.add('on'));
          const total = row.reduce((s, w, k) => s + w * INPUT[k]!, 0);
          sum.textContent = `${row.map((w, k) => `${fmt(w)}×${fmt(INPUT[k]!)}`).join(' + ')} = ${fmt(total)}`;
          timers.push(window.setTimeout(() => (outs[r]!.textContent = fmt(total)), ROW_MS / 2));
        }, r * ROW_MS),
      );
    });
    timers.push(window.setTimeout(() => onRow(null), WEIGHTS.length * ROW_MS));
  }

  return { el, play, clear };
}

/** How long play() takes, so the next thing can wait for it. */
export const MATMUL_MS = WEIGHTS.length * ROW_MS;
