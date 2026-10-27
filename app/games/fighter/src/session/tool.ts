// Scene: how a model that only continues text ends up calling tools. Three tabs, one per Space: the base model, the
// chat template it learned in fine-tuning (SFT), and a tool call. What your code does with the call is the loop slide.
// Each turn is a coloured band with its raw text inside, and who wrote it on the right. The model's text types in.
// A callout (a short note under a piece of text) points at the one or two things to notice.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';
import { MARKS, QUESTIONS, steps, TOKENS, type Line } from './tool-script.ts';

const TOKEN_MS = 110;
const HIT = /(⟦[^⟧]*⟧)/;

/**
 * Text with special tokens dimmed, and ⟦text|note⟧ turned into the text with its callout. The note goes under the
 * text, or to its right (`side`) when another line follows and would be covered.
 */
function render(text: string, side = false): (Node | string)[] {
  return text.split(HIT).flatMap((piece, k) => {
    if (k % 2 === 0)
      return piece.split(MARKS).flatMap((p, i, all) => {
        if (i % 2) return [h('span.tk-mark', null, p)];
        // The word right after <|im_start|> is who speaks: bold, so the turns read at a glance.
        const role = all[i - 1] === '<|im_start|>' ? p.match(/^(system|user|assistant)([\s\S]*)$/) : null;
        return role ? [h('span.tk-role', null, role[1]!), role[2]!] : [p];
      });
    // Split at the last "|": the text itself can hold some, as in <|im_end|>.
    const body = piece.slice(1, -1);
    const cut = body.lastIndexOf('|');
    return [h(`span.tk-hit${side ? '.side' : ''}`, { 'data-note': body.slice(cut + 1) }, ...render(body.slice(0, cut)))];
  });
}

export function toolScene(host: HTMLElement): Mounted {
  let at = 0;
  let q = 0;
  let timer = 0;
  const names = steps(QUESTIONS[0]!).map((s) => s.name);
  // The steps are tabs: click one to jump there. Space goes to the next.
  const pills = names.map((name, k) => h('button.tk-pill', { type: 'button' }, h('span.tk-num', null, String(k + 1)), name) as HTMLButtonElement);
  const asks = QUESTIONS.map((x) => h('button.seg', { type: 'button' }, x.ask.replace('What is ', '').replace('?', '')) as HTMLButtonElement);
  const asksBox = h('div.segs.tk-asks', null, h('span.tk-asks-label', null, 'Ask'), ...asks);
  const line = h('p.tk-line');
  const doc = h('div.tk-doc');
  const after = h('p.tk-after');

  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'Just text.'), ' From a text predictor to tool calls.')),
      h('nav.tk-steps', { 'aria-label': 'Steps' }, ...pills),
      h('section.tk-card', null, h('div.tk-head', null, line, asksBox), doc, after),
    ),
  );

  /** Writes the lines in order: given ones at once, the model's token by token. */
  function write(todo: { el: HTMLElement; line: Line; side: boolean }[], ms: number, done: () => void): void {
    const [next, ...rest] = todo;
    if (!next) return done();
    const { el, line: l, side } = next;
    if (l.by === 'given') {
      el.append(...render(l.text, side));
      return write(rest, ms, done);
    }
    el.classList.add('typing');
    const tokens = l.text.match(TOKENS) ?? [];
    const type = (i: number) => {
      if (i >= tokens.length) {
        el.classList.remove('typing');
        timer = window.setTimeout(() => write(rest, ms, done), ms * 3);
        return;
      }
      el.append(...render(tokens[i]!, side));
      timer = window.setTimeout(() => type(i + 1), ms);
    };
    timer = window.setTimeout(() => type(0), ms * 4);
  }

  function show(k: number): void {
    clearTimeout(timer);
    at = k;
    const s = steps(QUESTIONS[q]!)[k]!;
    pills.forEach((p, i) => {
      p.classList.toggle('done', i < k);
      p.classList.toggle('on', i === k);
      if (i === k) p.setAttribute('aria-current', 'step');
      else p.removeAttribute('aria-current');
    });
    asksBox.hidden = !s.asks;
    asks.forEach((b, i) => b.setAttribute('aria-pressed', String(i === q)));
    line.textContent = s.line;
    // Draw every band empty first, so nothing moves while the text fills in.
    const todo: { el: HTMLElement; line: Line; side: boolean }[] = [];
    doc.replaceChildren(
      ...s.bands.map((b) => {
        const lines = b.lines.map((l, i) => {
          const el = h('div.tk-ln');
          todo.push({ el, line: l, side: i < b.lines.length - 1 });
          return el;
        });
        const hasHit = b.lines.at(-1)!.text.includes('⟦'); // a note under the last line needs room
        return h(`div.tk-band.k-${b.kind}${hasHit ? '.has-hit' : ''}`, null, h('div.tk-band-text', null, ...lines), h('span.tk-who', null, b.label));
      }),
    );
    // Once the model has written its part, the line that says what happens next (if the step has one).
    after.textContent = '';
    after.classList.remove('shown');
    write(todo, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : TOKEN_MS, () => {
      after.textContent = s.after ?? '';
      after.classList.toggle('shown', !!s.after);
    });
  }

  pills.forEach((p, k) => p.addEventListener('click', () => show(k)));
  asks.forEach((b, i) =>
    b.addEventListener('click', () => {
      q = i;
      show(at);
      b.blur();
    }),
  );
  show(0);
  return {
    stop: () => clearTimeout(timer),
    // The arrow keys: the next or previous tab. False at either end, so the app moves to another slide.
    step: (by) => {
      const k = at + by;
      if (k < 0 || k > names.length - 1) return false;
      show(k);
      return true;
    },
  };
}
