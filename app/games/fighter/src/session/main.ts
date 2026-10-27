// The session app: one scene on screen at a time, the Zenova logo small in the top left.
// → / Space: the next step inside a scene, then the next scene. ←: back the same way. ↑ / ↓: skip to the next or
// previous scene. There is no menu, so the room never sees what comes next.
// ?left=<model id>&right=<model id> picks the fighters (default: Jev, fast, against Claude Haiku, thinking).
import { h } from '../dom.ts';
import { fightScene } from './fight.ts';
import { hanoiScene } from './hanoi.ts';
import { loopScene } from './loop.ts';
import { networkScene } from './network.ts';
import { whyScene } from './why.ts';
import { endScene } from './end.ts';
import { toolScene } from './tool.ts';

/** What a scene gives back: how to stop it, and (if it has steps inside) how to move one step. */
export interface Mounted {
  stop: () => void;
  /** Moves one step (+1 or -1). Returns false at the first or last step, so the app moves to another scene. */
  step?: (by: 1 | -1) => boolean;
}

type Mount = (host: HTMLElement) => Mounted;

interface Scene {
  id: string;
  mount: Mount;
}

const params = new URLSearchParams(location.search);
const left = params.get('left') ?? 'typesafe/jev-1.14.0';
const right = params.get('right') ?? 'anthropic/claude-haiku-5-5';

const SCENES: Scene[] = [
  { id: 'fight', mount: (host) => fightScene(host, left, right) },
  { id: 'hanoi', mount: hanoiScene },
  { id: 'loop', mount: loopScene },
  { id: 'tool', mount: toolScene },
  { id: 'model', mount: networkScene },
  { id: 'why', mount: whyScene },
  { id: 'end', mount: endScene },
];

const app = document.getElementById('app')!;
const stage = h('section.scene');
const logo = h('p.logo', null, h('span.logo-mark', null, '✳ zenova'), h('span.logo-sub', null, 'AI & Tech session'));
app.replaceChildren(h('div.app', null, logo, stage));

let current: Mounted = { stop: () => {} };
const indexOfHash = () => Math.max(0, SCENES.findIndex((s) => `#${s.id}` === location.hash));

function show(): void {
  current.stop();
  current = SCENES[indexOfHash()]!.mount(stage);
}

function step(by: number): void {
  const k = Math.min(SCENES.length - 1, Math.max(0, indexOfHash() + by));
  location.hash = SCENES[k]!.id;
}

window.addEventListener('hashchange', show);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  // Space is the presenter's clicker, but a focused button already reacts to Space itself: leave that alone.
  const forward = e.key === 'ArrowRight' || (e.key === ' ' && !(e.target instanceof HTMLButtonElement));
  const back = e.key === 'ArrowLeft';
  if (forward || back) {
    e.preventDefault();
    const by = forward ? 1 : -1;
    // The scene takes the step if it can; at its first or last step, move to the next or previous scene.
    if (!current.step?.(by)) step(by);
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    step(e.key === 'ArrowUp' ? 1 : -1);
  }
});
show();
