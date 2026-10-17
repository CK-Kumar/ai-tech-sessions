// Scene: how a model that only continues text ends up calling tools. Four steps, one per Space:
// pre-training (it continues text), SFT (it learned the chat format), tool calling (it writes tool calls as text),
// harness (your code reads that text and runs the real function). The model's part types in, one token at a time.
// The format is Qwen's (<|im_start|>…), shortened. Claude and GPT do the same; their exact format is private.
import { h } from '../dom.ts';

interface Step {
  name: string;
  line: string;
  given: string; // the text the model is given
  writes: string; // what the model writes, typed in token by token
  harness?: boolean; // show what your code does with it
}

const TOOL_CALL = '<tool_call>{"name": "move_disk", "arguments": {"from_peg": "A", "to_peg": "B"}}</tool_call><|im_end|>';

const STEPS: Step[] = [
  {
    name: 'Pre-training',
    line: 'A base model read the internet. It only continues text.',
    given: 'What is the capital of Spain?',
    writes: '\nWhat is the capital of France?\nWhat is the capital of Italy?\nWhat is the capital of',
  },
  {
    name: 'After SFT',
    line: 'Then trained on thousands of chats in this format. Now it answers, and stops.',
    given: '<|im_start|>user\nWhat is the capital of Spain?<|im_end|>\n<|im_start|>assistant\n',
    writes: 'Madrid.<|im_end|>',
  },
  {
    name: 'Tool calling',
    line: 'Trained on tool calls too. It still only writes text.',
    given: '<|im_start|>system\n<tools>move_disk(from_peg, to_peg)</tools><|im_end|>\n<|im_start|>user\nMove all disks to peg C.<|im_end|>\n<|im_start|>assistant\n',
    writes: TOOL_CALL,
  },
  {
    name: 'The harness',
    line: 'Your code reads that text, runs the real function, and writes the result back.',
    given: '<|im_start|>assistant\n' + TOOL_CALL,
    writes: '\n<|im_start|>user\n<tool_response>Done: A→B</tool_response><|im_end|>\n<|im_start|>assistant\n',
    harness: true,
  },
];

const TOKEN_MS = 110;
// Roughly how a tokenizer cuts: special tokens and tags whole, then words, spaces and punctuation.
const TOKENS = /<\|im_(?:start|end)\|>|<\/?(?:tools|tool_call|tool_response)>|\s+|\w+|[^\w\s]/g;
const MARKS = /(<\|im_(?:start|end)\|>|<\/?(?:tools|tool_call|tool_response)>)/;

/** Text with its markers (<|im_start|>, <tool_call>…) in their own colour, so the structure shows. */
function marked(text: string): (HTMLElement | string)[] {
  return text.split(MARKS).map((piece, k) => (k % 2 ? h('span.tk-mark', null, piece) : piece));
}

export function toolScene(host: HTMLElement): () => void {
  let at = -1;
  let timer = 0;
  // The steps are tabs: click one to jump there. Space goes to the next.
  const pills = STEPS.map((s, k) => h('button.tk-pill', { type: 'button' }, h('span.tk-num', null, String(k + 1)), s.name) as HTMLButtonElement);
  const line = h('p.tk-line');
  const given = h('span.tk-given');
  const writes = h('span.tk-writes');
  const cursor = h('span.tk-cursor', null, '▍');
  const harness = h(
    'ol.tk-harness',
    null,
    h('li', null, 'Find ', h('code', null, '<tool_call>…</tool_call>'), ' in the text'),
    h('li', null, 'Run the real function: ', h('code', null, 'move_disk("A", "B")')),
    h('li', null, 'Write the result back, and let the model continue'),
  );

  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'Just text.'), ' From a text predictor to tool calls.')),
      h('nav.tk-steps', { 'aria-label': 'Steps' }, ...pills),
      h('section.tk-card', null, line, h('pre.tk-text', null, given, writes, cursor), harness),
    ),
  );

  function show(k: number): void {
    clearTimeout(timer);
    at = k;
    const s = STEPS[k]!;
    pills.forEach((p, i) => {
      p.classList.toggle('done', i < k);
      p.classList.toggle('on', i === k);
      if (i === k) p.setAttribute('aria-current', 'step');
      else p.removeAttribute('aria-current');
    });
    line.textContent = s.line;
    given.replaceChildren(...marked(s.given));
    writes.replaceChildren();
    writes.classList.toggle('code', !!s.harness);
    harness.classList.toggle('shown', !!s.harness);
    // In the harness step it is your code that writes, so it waits until the three steps are on screen.
    const tokens = s.writes.match(TOKENS) ?? [];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = 0;
    const type = () => {
      if (i >= tokens.length) return;
      const t = tokens[i++]!;
      writes.append(...marked(t));
      timer = window.setTimeout(type, reduce ? 0 : TOKEN_MS);
    };
    timer = window.setTimeout(type, s.harness ? 900 : 400);
  }

  const step = () => {
    if (at < STEPS.length - 1) show(at + 1);
  };
  pills.forEach((p, k) => p.addEventListener('click', () => show(k)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      step();
    }
  };
  window.addEventListener('keydown', onKey);
  show(0);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('keydown', onKey);
  };
}
