// The loop slide's picture, the one place the room looks. The LLM sits outside the harness box (your code); inside it,
// one circle runs through the context and the tools. Each station carries its own detail, so there are no side cards:
// the context grows as a stack of cards, the tools are three function chips, the LLM's reply is a speech bubble.
import { h } from '../dom.ts';
import { svg } from './svg.ts';
import { TOOLS } from './loop-script.ts';

const CX = 520;
const CY = 365;
const R = 190;
const NODE = 62;
// Where each station sits on the circle, in degrees clockwise from the right: context, LLM (top), tools.
const AT = [150, 270, 390];
const GAP = (Math.asin((NODE + 10) / R) * 180) / Math.PI; // so an arc starts and ends just outside the circles
const PULSE_MS = 700;

const NODES = [
  { title: 'Context', sub: 'the memory', cls: 'context' },
  { title: 'LLM', sub: 'the brain', cls: 'llm' },
  { title: 'Tools', sub: 'the hands', cls: 'tools' },
];
const ARC_LABELS = ['sends context', 'picks a tool', 'result added'];

const point = (deg: number, r = R): [number, number] => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];

/** HTML inside the SVG, so it scales with the picture. */
function box(x: number, y: number, width: number, height: number, el: HTMLElement): SVGElement {
  const fo = svg('foreignObject', { x, y, width, height });
  fo.append(el);
  return fo;
}

export interface Diagram {
  el: SVGElement;
  nodes: SVGElement[]; // context, LLM, tools
  arcs: SVGPathElement[]; // context → LLM, LLM → tools, tools → context
  round: SVGElement; // the text in the middle: "round 3"
  stack: HTMLElement; // the context, as cards
  chips: Map<string, HTMLElement>; // the tools, by name
  bubble: HTMLElement; // next to the LLM: who it is, or what it just said
  pulse: SVGElement;
}

export function drawLoop(): Diagram {
  const el = svg('svg', { viewBox: '0 96 1040 552', class: 'loop-svg', role: 'img', 'aria-label': 'An agent: the LLM, and your code looping through context and tools' });
  const marker = svg('marker', { id: 'loop-arrow', viewBox: '0 0 10 10', refX: 7, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: 18, markerHeight: 18, orient: 'auto' });
  marker.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrow-head' }));
  const defs = svg('defs', {});
  defs.append(marker);
  // The harness box sits below the LLM: everything inside it is your code, the LLM is not.
  el.append(defs, svg('rect', { x: 10, y: 262, width: 1020, height: 376, rx: 32, class: 'harness-box' }), svg('text', { x: 1004, y: 618, class: 'harness-label' }, 'Harness = the body (your code)'));

  // The stations are 120° apart, so arc k runs from station k to 120° further on, the next station.
  const arcs = ARC_LABELS.map((label, k) => {
    const [x0, y0] = point(AT[k]! + GAP);
    const [x1, y1] = point(AT[k]! + 120 - GAP);
    const arc = svg('path', { d: `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`, class: 'loop-arc', 'marker-end': 'url(#loop-arrow)' }) as SVGPathElement;
    const [lx, ly] = point(AT[k]! + 60, R - 54);
    el.append(arc, svg('text', { x: lx, y: ly, class: 'arc-label' }, label));
    return arc;
  });

  const nodes = NODES.map((n, k) => {
    const [x, y] = point(AT[k]!);
    const g = svg('g', { class: `loop-node ${n.cls}`, transform: `translate(${x} ${y})` });
    g.append(svg('circle', { r: NODE }), svg('text', { y: -2, class: 'node-title' }, n.title), svg('text', { y: 22, class: 'node-who' }, n.sub));
    el.append(g);
    return g;
  });

  // Each station's detail, beside it.
  const stack = h('ol.ctx-stack');
  const chips = new Map(TOOLS.map((t) => [t.name, h('li.tool-chip', null, h('code', null, `${t.name}(disk)`))]));
  const bubble = h('div.bubble');
  const [llmX, llmY] = point(AT[1]!);
  const [toolsX, toolsY] = point(AT[2]!);
  el.append(
    box(28, 300, 262, 300, stack),
    box(toolsX + NODE + 20, toolsY - 92, 250, 190, h('div.tool-box', null, h('p.tool-box-head', null, 'tools = functions'), h('ul.tool-chips', null, ...chips.values()))),
    box(llmX + NODE + 24, llmY - 70, 430, 150, bubble),
  );

  const round = svg('text', { x: CX, y: CY + 34, class: 'agent-sub' }, 'ready');
  const pulse = svg('circle', { r: 11, class: 'pulse' });
  el.append(svg('text', { x: CX, y: CY, class: 'agent-word' }, 'agent'), round, pulse);
  return { el, nodes, arcs, round, stack, chips, bubble, pulse };
}

/** Sends the dot along arc `k`, start to end. Returns a function that stops it. */
export function runPulse(d: Diagram, k: number): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const arc = d.arcs[k]!;
  const length = arc.getTotalLength();
  const start = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / PULSE_MS);
    const p = arc.getPointAtLength(length * t);
    d.pulse.setAttribute('cx', String(p.x));
    d.pulse.setAttribute('cy', String(p.y));
    d.pulse.classList.toggle('on', t < 1);
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    d.pulse.classList.remove('on');
  };
}
