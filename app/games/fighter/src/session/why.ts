// Scene: why we did all this. Every AI tool we use is built the same way; so the sessions will dig into three topics;
// and sometimes the answer is not AI at all: plain code solves Hanoi better than the model did.
import { h } from '../dom.ts';

const TOOLS = [
  { name: 'Claude Code', model: 'Claude', loop: 'your terminal session', tools: 'read files, run commands, edit code' },
  { name: 'ChatGPT', model: 'GPT', loop: 'the chat', tools: 'search the web, run code, read files' },
  { name: 'Zenova', model: '?', loop: '?', tools: '?' },
];

const TOPICS = [
  { title: 'Harness → productivity', text: 'How Claude Code and friends work inside, so we get more out of them every day.' },
  { title: 'System 1 & 2 + the harness → our product', text: 'A fast answer or deep thinking, and the harness around it. Like the fight and Hanoi: what Zenova needs, where.' },
  { title: 'AI safety & literacy', text: 'Where models fail, what not to trust, and how to use them well.' },
];

const STEPS = [
  { name: 'Everything runs on this', line: 'Every AI tool we use is the same thing: a model, in a loop, with tools.' },
  { name: 'Three topics', line: 'So in these sessions, we’ll dig into three things.' },
  { name: 'AI, or tech?', line: 'Sometimes a good algorithm or plain tech is enough. Knowing which is the skill.' },
];

// The recursive solution from the loop scene, in Python: the whole of Hanoi, no model needed.
const SOLVE = `def solve(n, src="A", dst="C", via="B"):
    if n == 0:
        return []
    return (solve(n-1, src, via, dst)
            + [(src, dst)]
            + solve(n-1, via, dst, src))`;

function table(): HTMLElement {
  const row = (cells: string[], cls = '') => h(`div.why-row${cls}`, null, ...cells.map((c) => h('span', null, c)));
  return h(
    'div.why-table',
    null,
    row(['', 'Model', 'Loop (the harness)', 'Tools'], '.head'),
    ...TOOLS.map((t, k) => row([t.name, t.model, t.loop, t.tools], k === TOOLS.length - 1 ? '.ours' : '')),
    h('p.why-note', null, 'The last row is ours to build.'),
  );
}

function topics(): HTMLElement {
  return h('div.why-topics', null, ...TOPICS.map((t, k) => h('section.why-topic', { style: `--k: ${k}` }, h('h3', null, t.title), h('p', null, '→ ', t.text))));
}

/** Hanoi, solved twice: by Claude through our harness (real runs: 30.8 s and 29.5 s), and by 3 lines of code. */
function aiOrNot(): HTMLElement {
  const stat = (label: string, value: string) => h('div.why-stat', null, h('span', null, label), h('b', null, value));
  return h(
    'div.why-vs',
    null,
    h('section.why-side.ai', null, h('h3', null, 'Claude, thinking'), stat('moves', '15'), stat('time', '≈ 30 s'), stat('model calls', '15')),
    h(
      'section.why-side.code',
      null,
      h('h3', null, 'Plain code'),
      h('pre.why-code', null, SOLVE),
      stat('moves', '15'),
      stat('time', '< 1 ms'),
      stat('model calls', '0'),
    ),
  );
}

export function whyScene(host: HTMLElement): () => void {
  let at = 0;
  const pills = STEPS.map((s, k) => h('button.tk-pill', { type: 'button' }, h('span.tk-num', null, String(k + 1)), s.name) as HTMLButtonElement);
  const line = h('p.tk-line');
  const views = [table(), topics(), aiOrNot()];
  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'Why this?'), ' Everything we use runs on it.')),
      h('nav.tk-steps', { 'aria-label': 'Steps' }, ...pills),
      h('section.tk-card.why-card', null, line, ...views),
    ),
  );

  function go(k: number): void {
    at = k;
    pills.forEach((p, i) => {
      p.classList.toggle('done', i < k);
      p.classList.toggle('on', i === k);
      if (i === k) p.setAttribute('aria-current', 'step');
      else p.removeAttribute('aria-current');
    });
    line.textContent = STEPS[k]!.line;
    views.forEach((v, i) => (v.hidden = i !== k));
  }

  pills.forEach((p, k) => p.addEventListener('click', () => go(k)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      if (at < STEPS.length - 1) go(at + 1);
    }
  };
  window.addEventListener('keydown', onKey);
  go(0);
  return () => window.removeEventListener('keydown', onKey);
}
