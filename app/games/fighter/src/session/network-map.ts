// The map of meaning for the model scene: each piece is a list of numbers, here just two, so it is a spot on a map.
// Before training the spots are random; training moves them until pieces used the same way sit close.
// Made up by hand: real models use thousands of numbers per piece, not two.
import { h } from '../dom.ts';
import { svg } from './svg.ts';

const W = 600;
const H = 300;

// at: the two numbers after training. from: a random spot before training.
const POINTS = [
  { text: 'Madrid', at: [0.14, 0.26], from: [0.72, 0.82] },
  { text: 'Barcelona', at: [0.3, 0.18], from: [0.16, 0.76] },
  { text: 'Paris', at: [0.24, 0.36], from: [0.9, 0.3] },
  { text: 'Spain', at: [0.16, 0.74], from: [0.46, 0.14] },
  { text: 'France', at: [0.32, 0.82], from: [0.6, 0.5] },
  { text: 'cat', at: [0.74, 0.2], from: [0.32, 0.56] },
  { text: 'dog', at: [0.88, 0.28], from: [0.1, 0.22] },
  { text: '<tool_call>', at: [0.7, 0.66], from: [0.86, 0.9] },
  { text: 'move_disk', at: [0.86, 0.74], from: [0.5, 0.92] },
  { text: 'from_peg', at: [0.72, 0.86], from: [0.28, 0.4] },
];
const GROUPS = [
  { text: 'cities', at: [0.22, 0.06] },
  { text: 'countries', at: [0.24, 0.98] },
  { text: 'animals', at: [0.81, 0.06] },
  { text: 'tool calls', at: [0.79, 0.98] },
];

const place = ([x, y]: number[]) => `translate(${30 + x! * (W - 60)}px, ${20 + y! * (H - 40)}px)`;
const nums = ([x, y]: number[]) => `[${x!.toFixed(2)}, ${y!.toFixed(2)}]`;

export function drawMap() {
  const map = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'map-svg', role: 'img', 'aria-label': 'Pieces as spots on a map: similar pieces sit close together' });
  const dots = POINTS.map((p) => {
    const g = svg('g', { class: 'map-dot' });
    g.append(svg('circle', { r: 7 }), svg('text', { x: 12, y: 5 }, p.text));
    map.append(g);
    return g;
  });
  // Madrid is the piece we follow: it is the answer the model gives later in this scene.
  dots[0]!.classList.add('on');
  const groups = GROUPS.map((g) => {
    const t = svg('text', { class: 'map-group' }, g.text);
    t.style.transform = place(g.at);
    map.append(t);
    return t;
  });
  const readout = h('p.map-readout');
  const el = h('div.map', null, map, readout);

  function set(trained: boolean): void {
    dots.forEach((d, k) => (d.style.transform = place(trained ? POINTS[k]!.at : POINTS[k]!.from)));
    groups.forEach((g) => g.classList.toggle('shown', trained));
    // Madrid's two numbers are its spot: the readout shows them change.
    const madrid = POINTS[0]!;
    readout.replaceChildren(
      h('span', null, trained ? 'After training: ' : 'Before training: '),
      h('b', null, `Madrid = ${nums(trained ? madrid.at : madrid.from)}`),
    );
  }

  /** Start random, then let training move every piece to its place. */
  function play(timers: number[]): void {
    el.classList.add('still');
    set(false);
    // One frame without the transition, so the dots jump to the random spots instead of gliding there.
    timers.push(window.setTimeout(() => el.classList.remove('still'), 50));
    timers.push(window.setTimeout(() => set(true), 900));
  }

  return { el, play };
}
