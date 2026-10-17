// The session app: a side menu of scenes, one scene on screen at a time.
// Scenes unlock as you reach them, so the menu never spoils what comes next.
// → / ← move between scenes · M hides the menu (for the TV) · R locks everything again · U unlocks all (rehearsal).
// ?left=<model id>&right=<model id> picks the fighters (default: the same Luna, called two ways).
import { h } from '../dom.ts';
import { fightScene } from './fight.ts';
import { hanoiScene } from './hanoi.ts';
import { loopScene } from './loop.ts';
import { networkScene } from './network.ts';
import { whyScene } from './why.ts';
import { endScene } from './end.ts';
import { toolScene } from './tool.ts';

type Mount = (host: HTMLElement) => () => void;

interface Scene {
  id: string;
  group: string;
  title: string;
  mount: Mount;
}

const params = new URLSearchParams(location.search);
const left = params.get('left') ?? 'openai/gpt-6-luna-decisions';
const right = params.get('right') ?? 'openai/gpt-6-luna-text';

const SCENES: Scene[] = [
  { id: 'fight', group: 'Watch', title: 'Fight', mount: (host) => fightScene(host, left, right) },
  { id: 'hanoi', group: 'Watch', title: 'Hanoi', mount: hanoiScene },
  { id: 'loop', group: 'Look inside', title: 'The loop', mount: loopScene },
  { id: 'tool', group: 'Look inside', title: 'The tool', mount: toolScene },
  { id: 'model', group: 'Look inside', title: 'The model', mount: networkScene },
  { id: 'why', group: 'What next', title: 'Why this?', mount: whyScene },
  { id: 'end', group: 'What next', title: 'The end', mount: endScene },
];

// How far the talk has got. Kept across reloads, so a refresh mid-talk doesn't re-lock the menu.
const STORE = 'session.reached';
function loadReached(): number {
  try {
    return Number(localStorage.getItem(STORE)) || 0;
  } catch {
    return 0;
  }
}
function saveReached(n: number): void {
  try {
    localStorage.setItem(STORE, String(n));
  } catch {
    // storage blocked: the menu just forgets on reload
  }
}
let reached = loadReached();

const app = document.getElementById('app')!;
const stage = h('section.scene');
const links = SCENES.map((s) => h('a.menu-link', { href: `#${s.id}` }));
const groups = [...new Set(SCENES.map((s) => s.group))].map((g) =>
  h('div.menu-group', null, h('p.menu-head', null, g), ...links.filter((_, k) => SCENES[k]!.group === g)),
);
const menu = h('nav.menu', { 'aria-label': 'Scenes' }, h('p.menu-title', null, h('span.menu-mark', null, '✳ zenova'), h('span.menu-sub', null, 'AI & Tech session')), ...groups, h('p.menu-keys', null, '← → to move, M to hide'));
app.replaceChildren(h('div.app', null, menu, stage));

/** A locked scene shows only its number: the room sees how long the journey is, not what's in it. */
function drawMenu(current: number): void {
  links.forEach((a, k) => {
    const open = k <= reached;
    a.replaceChildren(h('span.menu-num', null, String(k + 1)), open ? SCENES[k]!.title : '···');
    a.classList.toggle('locked', !open);
    if (k === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

let cleanup = () => {};
const indexOfHash = () => SCENES.findIndex((s) => `#${s.id}` === location.hash);

function show(): void {
  let k = Math.max(0, indexOfHash());
  // A typed address can't jump past what has been unlocked.
  if (k > reached) {
    location.hash = SCENES[reached]!.id;
    return;
  }
  cleanup();
  cleanup = SCENES[k]!.mount(stage);
  drawMenu(k);
}

function step(by: number): void {
  const k = Math.min(SCENES.length - 1, Math.max(0, Math.max(0, indexOfHash()) + by));
  if (k > reached) {
    reached = k;
    saveReached(reached);
  }
  location.hash = SCENES[k]!.id;
}

window.addEventListener('hashchange', show);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'm' || e.key === 'M') app.firstElementChild!.classList.toggle('menu-hidden');
  else if (e.key === 'r' || e.key === 'R') {
    reached = 0;
    saveReached(0);
    location.hash = SCENES[0]!.id;
    show();
  } else if (e.key === 'u' || e.key === 'U') {
    reached = SCENES.length - 1;
    saveReached(reached);
    drawMenu(Math.max(0, indexOfHash()));
  }
});
show();
