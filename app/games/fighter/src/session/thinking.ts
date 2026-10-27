// Scene: System 1 and System 2 thinking (from psychology: Stanovich & West named them, Kahneman made them famous).
// It sits after the two games, so the room can put a name on what they just watched. The presenter says the rest.
// One card in two halves. Each has a small drawing: one straight jump to the answer, or a path taken step by step.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';
import { svg } from './svg.ts';

/** A line from start to answer: straight for System 1, in steps for System 2. */
function path(points: string, stops: number[][]): SVGElement {
  const el = svg('svg', { viewBox: '0 0 260 80', class: 'ts-path', 'aria-hidden': 'true' });
  el.append(svg('polyline', { points, class: 'ts-line' }));
  for (const [x, y] of stops) el.append(svg('circle', { cx: x!, cy: y!, r: 6, class: 'ts-stop' }));
  return el;
}

const half = (cls: string, n: string, how: string, drawing: SVGElement) =>
  h(`section.ts-half.${cls}`, null, h('p.ts-label', null, 'System'), h('p.ts-num', null, n), h('p.ts-how', null, how), drawing);

export function thinkingScene(host: HTMLElement): Mounted {
  const fast = path('14,40 246,40', [[14, 40], [246, 40]]);
  const slow = path('14,64 72,64 72,40 130,40 130,16 188,16 188,40 246,40', [[14, 64], [72, 40], [130, 16], [188, 40], [246, 40]]);
  host.replaceChildren(
    h('div.tool-scene', null, h('section.ts-card', null, half('one', '1', 'intuition · answers at once', fast), half('two', '2', 'reasoning · thinks first', slow))),
  );
  return { stop: () => {} };
}
