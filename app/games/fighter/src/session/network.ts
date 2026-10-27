// Scene: inside the model. One picture, top to bottom, that never changes shape; four tabs fill it in:
// the text is cut into pieces, each piece is a number, the formula turns the numbers into a score for every piece,
// and the winner goes on the end of the text, round again. A simulation: the pieces, IDs and scores are made up.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';
import { drawMatmul, drawNetwork, MATMUL_MS } from './network-draw.ts';

// A fake dictionary of pieces. Real ones have ~100,000 pieces or more.
const IDS: Record<string, number> = {
  The: 791, ' cap': 2107, ital: 2223, ' of': 315, ' Spain': 18157, ' is': 374, ' Mad': 9671, rid: 1907, ' a': 264,
  ' Barcelona': 27662, ' the': 279, ' located': 7559, ison: 3335, ness: 1757, eira: 30217, '.': 13, ',': 11, ' and': 323,
  ' since': 2533, ' (': 320,
};
// Not every word is one piece: "capital" is cut into two, and so is "Madrid" when the model writes it.
const START = ['The', ' cap', 'ital', ' of', ' Spain', ' is'];
// Each run of the formula: the top scores. The first one wins and goes on the end of the text.
const RUNS: [string, number][][] = [
  [[' Mad', 0.84], [' a', 0.06], [' Barcelona', 0.04], [' the', 0.03], [' located', 0.02]],
  [['rid', 0.96], ['ison', 0.02], ['ness', 0.01], ['eira', 0.005]],
  [['.', 0.71], [',', 0.15], [' and', 0.06], [' since', 0.04], [' (', 0.02]],
];

const STEPS = [
  { name: 'Pieces', line: 'Text is cut into pieces.' },
  { name: 'Numbers', line: 'Each piece is a number.' },
  { name: 'The formula', line: 'Numbers in. A score for every piece out.' },
  { name: 'One piece at a time', line: 'The winner goes on the end. Run it again.' },
];
const HOOK = 'That’s all a model is: numbers, multiplied, in a loop.';

const show = (piece: string) => piece.trim();
// A piece with no space before it that starts with a letter carries on the word before it ("cap" + "ital").
const carriesOn = (piece: string) => /^[a-z]/.test(piece);
const pct = (score: number) => `${Math.round(score * 100)}%`;
/** A short note under an element (the same callout as the tool slide). */
function callout(el: Element | null | undefined, note: string): void {
  if (!(el instanceof HTMLElement)) return;
  el.classList.add('tk-hit');
  el.dataset.note = note;
}

export function networkScene(host: HTMLElement): Mounted {
  let timers: number[] = [];
  let at = 0;
  const net = drawNetwork();
  const mm = drawMatmul((r) => net.focus(r)); // each row of the matrix lights its neuron in the network
  const pills = STEPS.map((s, k) => h('button.tk-pill', { type: 'button' }, h('span.tk-num', null, String(k + 1)), s.name) as HTMLButtonElement);
  const line = h('p.tk-line');
  const text = h('p.nn-text-row');
  const pieces = h('div.nn-pieces');
  const run = h('span.nn-run');
  const scores = h('ol.nn-scores');
  // One row per stage, a label on the left. Rows not reached yet stay hidden but keep their space, so nothing moves.
  const row = (label: string, ...body: Node[]) => h('div.nn-row', null, h('span.nn-label', null, label), h('div.nn-body', null, ...body));
  const rows = [
    row('Text', text),
    row('Pieces', pieces),
    row(
      'The model',
      h('div.nn-model', null, net.el, h('div.nn-formula', null, mm.el, run)),
    ),
    row('Scores', scores),
  ];
  const back = h('div.nn-back', null, h('span', null, 'the winner goes on the end'));

  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'The model.'), ' Numbers in, numbers out.')),
      h('nav.tk-steps', { 'aria-label': 'Steps' }, ...pills),
      h('section.tk-card.nn-card', null, line, h('div.nn-pipe', null, h('div.nn-rows', null, ...rows), back)),
    ),
  );

  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  /** The pieces as chips, grouped by word; the text row is the same pieces, read as a sentence. */
  function draw(list: string[], fresh: number, note: string | null): void {
    const words: HTMLElement[] = [];
    list.forEach((piece, k) => {
      const chip = h(`span.nn-chip${k >= fresh ? '.new' : ''}`, { style: `--d: ${k * 90}ms` }, h('span.nn-piece', null, show(piece)), h('span.nn-id', null, String(IDS[piece])));
      if (k > 0 && carriesOn(piece)) words.at(-1)!.append(chip);
      else words.push(h('span.nn-word', null, chip));
    });
    // The callout goes on the first word cut into two pieces ("capital").
    if (note) callout(words.find((w) => w.childElementCount > 1), note);
    pieces.replaceChildren(...words);
    text.replaceChildren(...list.map((piece, k) => h(k >= fresh ? 'span.nn-new' : 'span', null, piece)), h('span.nn-cursor', null, '▍'));
  }

  function drawScores(r: number, note: string | null): void {
    scores.replaceChildren(
      ...RUNS[r]!.map(([piece, score]) => h('li.nn-score', { style: `--p: ${pct(score)}` }, h('span.nn-piece', null, show(piece)), h('span.nn-pct', null, pct(score)))),
    );
    later(500, () => {
      const top = scores.firstElementChild as HTMLElement | null;
      top?.classList.add('top');
      if (note) callout(top, note);
    });
  }

  function go(k: number): void {
    timers.forEach(clearTimeout);
    timers = [];
    at = k;
    pills.forEach((p, i) => {
      p.classList.toggle('done', i < k);
      p.classList.toggle('on', i === k);
      if (i === k) p.setAttribute('aria-current', 'step');
      else p.removeAttribute('aria-current');
    });
    line.textContent = STEPS[k]!.line;
    line.classList.remove('nn-hook');
    // Tabs 1–2 show the text and its pieces; from tab 3 on, the model and the scores too.
    const lastRow = k < 2 ? 1 : 3;
    rows.forEach((r, i) => r.classList.toggle('shown', i <= lastRow));
    pieces.classList.toggle('ids', k >= 1);
    back.classList.toggle('shown', k === 3);
    net.reset();
    mm.clear();
    scores.replaceChildren();
    run.textContent = '';
    const list = [...START];
    draw(list, list.length, k === 0 ? 'not always a whole word' : null);
    if (k === 1) callout(pieces.querySelector('.nn-chip'), 'its place in a list of ~100,000 pieces');

    if (k === 2) {
      // The numbers flow through, then one layer worked out as a matrix, then the scores.
      net.pulse(timers);
      later(1600, () => mm.play(timers));
      later(1600 + MATMUL_MS + 300, () => drawScores(0, 'top score wins'));
    }
    if (k === 3) {
      // Each run: the winner joins the text, the formula runs again, a new winner.
      mm.play(timers);
      drawScores(0, null);
      run.textContent = 'run 1';
      RUNS.forEach((r, i) =>
        later(1200 + i * 3000, () => {
          list.push(r[0]![0]);
          draw(list, START.length, null); // everything after the start is the model's: blue
          if (i === RUNS.length - 1) {
            scores.replaceChildren();
            run.textContent = '';
            line.textContent = HOOK;
            line.classList.add('nn-hook');
            return;
          }
          run.textContent = `run ${i + 2}`;
          net.pulse(timers);
          later(1500, () => drawScores(i + 1, null));
        }),
      );
    }
  }

  pills.forEach((p, k) => p.addEventListener('click', () => go(k)));
  go(0);
  return {
    stop: () => timers.forEach(clearTimeout),
    // The arrow keys: the next or previous tab. False at either end, so the app moves to another slide.
    step: (by) => {
      const k = at + by;
      if (k < 0 || k > STEPS.length - 1) return false;
      go(k);
      return true;
    },
  };
}
