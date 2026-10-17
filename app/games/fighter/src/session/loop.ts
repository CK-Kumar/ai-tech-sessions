// Scene: what an agent is. Four parts in a circle: the context (memory), the model (the brain), the harness (your
// code) and the tools. Next to it, the code that is the whole agent. Space runs one loop: a pulse goes round and the
// matching code line lights, and the tool it calls lights in the list. Hanoi and Fight run the same loop with
// different tools. Simulated: no API calls.
import { h } from '../dom.ts';
import { svg } from './svg.ts';
import { GAMES, type Game } from './loop-games.ts';

const NODES = [
  { title: 'Context', who: 'the memory' },
  { title: 'Model', who: 'the brain' },
  { title: 'Harness', who: 'your code' },
  { title: 'Tools', who: 'move_disk' },
];
const ARC_LABELS = ['reads it all', 'writes a tool call', 'runs it, checks rules', 'result comes back'];

// The circle: context on the left, then clockwise model (top), harness (right), tools (bottom).
const C = 250;
const R = 165;
const NODE_R = 58;
const angle = (k: number) => ((180 + 90 * k) * Math.PI) / 180;
const point = (a: number, r = R) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
const PULSE_MS = 380;

function drawAgent() {
  const el = svg('svg', { viewBox: '-70 0 640 500', class: 'loop-svg', role: 'img', 'aria-label': 'An agent: context, model, harness and tools in a loop' });
  const defs = svg('defs', {});
  const marker = svg('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 7, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: 16, markerHeight: 16, orient: 'auto-start-reverse' });
  marker.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrow-head' }));
  defs.append(marker);
  el.append(defs, svg('text', { x: C, y: C - 4, class: 'agent-word' }, 'the agent'), svg('text', { x: C, y: C + 22, class: 'agent-sub' }, 'all four together'));
  const arcs = ARC_LABELS.map((label, k) => {
    const [x0, y0] = point(angle(k) + 0.42);
    const [x1, y1] = point(angle(k + 1) - 0.42);
    const arc = svg('path', { d: `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`, class: 'loop-arc', 'marker-end': 'url(#arrow)' });
    const [lx, ly] = point(angle(k) + Math.PI / 4, R + 46);
    el.append(arc, svg('text', { x: lx, y: ly, class: 'arc-label', 'text-anchor': lx > C + 5 ? 'start' : lx < C - 5 ? 'end' : 'middle' }, label));
    return arc;
  });
  const titles: SVGElement[] = [];
  const whos: SVGElement[] = [];
  const nodes = NODES.map((n, k) => {
    const [x, y] = point(angle(k));
    const g = svg('g', { class: `loop-node${k === 1 ? ' model' : ''}`, transform: `translate(${x} ${y})` });
    const title = svg('text', { class: 'node-title', y: -4 }, n.title);
    const who = svg('text', { class: 'node-who', y: 20 }, n.who);
    g.append(svg('circle', { r: NODE_R }), title, who);
    el.append(g);
    titles.push(title);
    whos.push(who);
    return g;
  });
  return { el, arcs, nodes, titles, whos };
}

export function loopScene(host: HTMLElement): () => void {
  let game: Game = GAMES[0]!;
  let turn = 0;
  let busy = false;
  let timers: number[] = [];
  let rows: HTMLElement[] = [];
  let toolRows: HTMLElement[] = [];

  const agent = drawAgent();
  const code = h('div.code-annot', { 'aria-label': 'The agent in code' });
  const toolList = h('ul.tool-list');
  const tools = h('section.tools-card', null, h('h2.tools-title', null, 'Tools'), h('p.tools-lead', null, 'What the agent can do. The model picks one, your code runs it.'), toolList);
  const run = h('button.btn', { type: 'button' }, 'Run one loop') as HTMLButtonElement;
  const segs = GAMES.map((g) => h('button.seg', { type: 'button', 'aria-pressed': 'false' }, g.label) as HTMLButtonElement);

  host.replaceChildren(
    h(
      'div.loop',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'The agent.'), ' Four parts, one loop.'), h('div.controls', null, h('div.segs', null, ...segs), run)),
      h('div.loop-main', null, agent.el, h('div.loop-right', null, code, tools)),
    ),
  );

  function light(node: number | null, line: number | null): void {
    agent.nodes.forEach((n, i) => n.classList.toggle('on', i === node));
    // The arc that leads into the lit part glows too.
    agent.arcs.forEach((a, i) => a.classList.toggle('on', node !== null && (i + 1) % 4 === node));
    rows.forEach((r, i) => r.classList.toggle('on', i === line));
    // The while line stays lit for the whole loop: we are inside it.
    rows[1]!.classList.toggle('looping', node !== null);
  }

  function start(g: Game): void {
    timers.forEach(clearTimeout);
    timers = [];
    game = g;
    turn = 0;
    busy = false;
    segs.forEach((s, k) => s.setAttribute('aria-pressed', String(GAMES[k] === g)));
    agent.titles[0]!.textContent = g.memory.title;
    agent.whos[0]!.textContent = g.memory.who;
    agent.whos[3]!.textContent = g.toolsWho;
    rows = g.code.map((c, k) => h(k === 2 ? 'div.code-row.model' : 'div.code-row', null, h('code.code-line', null, c.line), h('span.code-note', null, c.note)));
    code.replaceChildren(...rows);
    toolRows = g.tools.map((t) => h('li.tool', null, h('code.tool-name', null, t.name), h('span.tool-text', null, t.text)));
    toolList.replaceChildren(...toolRows);
    toolList.classList.toggle('many', g.tools.length > 4);
    run.disabled = false;
    run.textContent = 'Run one loop';
    light(null, null);
  }

  function runLoop(): void {
    if (busy || turn >= game.turns.length) return;
    busy = true;
    const t = game.turns[turn]!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // With a tool call: model → harness checks → tool runs → result back. Without one: model → harness, and stop.
    const steps: [number, number][] = t.call ? [[1, 2], [2, 3], [3, 4], [0, game.appendLine]] : [[1, 2], [2, 3], [2, game.noneLine]];
    const at = (k: number) => (reduce ? 0 : k * PULSE_MS);
    toolRows.forEach((r) => r.classList.remove('on'));
    steps.forEach(([node, line], k) => timers.push(window.setTimeout(() => light(node, line), at(k))));
    // The called tool lights when the pulse reaches Tools.
    const called = toolRows[game.tools.findIndex((x) => x.name.startsWith(t.tool ?? '\0'))];
    if (called) timers.push(window.setTimeout(() => called.classList.add('on'), at(2)));
    timers.push(
      window.setTimeout(
        () => {
          turn++;
          busy = false;
          if (turn >= game.turns.length) {
            run.disabled = true;
            run.textContent = game.id === 'hanoi' ? 'Solved' : '…until a knockout';
          }
        },
        at(steps.length - 1) + 80,
      ),
    );
  }

  run.addEventListener('click', runLoop);
  segs.forEach((s, k) => s.addEventListener('click', () => start(GAMES[k]!)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      runLoop();
    }
  };
  window.addEventListener('keydown', onKey);
  start(game);

  return () => {
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey);
  };
}
