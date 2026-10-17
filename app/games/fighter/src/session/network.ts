// Scene: inside the model. Text is cut into pieces, the pieces become numbers, a giant formula (multiply and add,
// layer after layer) turns them into a score for every piece, the top one is the next piece, and it starts again.
// The last step zooms out: the model is a loop (one piece per pass) inside your harness's loop, and that is why AI
// needs so much compute. A simulation: the tokenizer, the IDs and the scores are made up.
import { h } from '../dom.ts';
import { drawLoops, drawMatmul, drawNetwork } from './network-draw.ts';
import { drawMap } from './network-map.ts';

// A fake dictionary of pieces. Real ones have ~100,000 pieces or more.
const IDS: Record<string, number> = {
  The: 791, ' cap': 2107, ital: 2223, ' of': 315, ' Spain': 18157, ' is': 374, ' Mad': 9671, rid: 1907, ' a': 264,
  ' Barcelona': 27662, ' the': 279, ' located': 7559, ison: 3335, ness: 1757, eira: 30217, '.': 13, ',': 11, ' and': 323,
  ' since': 2533, ' (': 320,
};
// Not every word is one piece: "capital" is cut into two, and so is "Madrid" when the model writes it.
const START = ['The', ' cap', 'ital', ' of', ' Spain', ' is'];
// Each pass: the top five scores. The first one wins and is added to the text.
const PASSES: [string, number][][] = [
  [[' Mad', 0.84], [' a', 0.06], [' Barcelona', 0.04], [' the', 0.03], [' located', 0.02]],
  [['rid', 0.96], ['ison', 0.02], ['ness', 0.01], ['eira', 0.005]],
  [['.', 0.71], [',', 0.15], [' and', 0.06], [' since', 0.04], [' (', 0.02]],
];

const STEPS = [
  { name: 'Pieces', line: 'The model never sees a tool, or even a word. The text is cut into pieces, and a piece is not always a word.' },
  { name: 'Numbers', line: 'Each piece has a number: its place in a dictionary of pieces.' },
  { name: 'Close in meaning', line: 'Training gave each piece a spot on a map. Pieces used the same way end up close.' },
  { name: 'The formula', line: 'The numbers go through one giant formula: multiply and add, layer after layer.' },
  { name: 'Next piece', line: 'Out comes a score for every piece in the dictionary. The top one wins.' },
  { name: 'Again', line: 'Add it to the text and run the formula again. One piece at a time.' },
  { name: 'Loops in loops', line: 'The model is a loop, inside your harness’s loop. That’s why AI needs so much compute.' },
];

const show = (piece: string) => (piece === '\n' ? '↵' : piece.trim());
// A piece with no space before it that starts with a letter carries on the word before it ("cap" + "ital").
const carriesOn = (piece: string, k: number) => k > 0 && /^[a-z]/.test(piece);

export function networkScene(host: HTMLElement): () => void {
  let timers: number[] = [];
  const net = drawNetwork();
  const mm = drawMatmul();
  const loops = drawLoops();
  const map = drawMap();
  const pills = STEPS.map((s, k) => h('button.tk-pill', { type: 'button' }, h('span.tk-num', null, String(k + 1)), s.name) as HTMLButtonElement);
  const line = h('p.tk-line');
  const sentence = h('p.nn-sentence');
  const pieces = h('ol.nn-pieces');
  const bars = h('ol.nn-bars');
  const hook = h('p.nn-hook', null, 'That’s all a model is: a lot of numbers, multiplied, in a loop.');
  const inPanel = h('section.nn-panel.in', null, h('h3.nn-head', null, 'Text in'), pieces);
  const netPanel = h('section.nn-panel.net', null, h('h3.nn-head', null, 'The formula'), net.el, mm.el);
  const outPanel = h('section.nn-panel.out', null, h('h3.nn-head', null, 'Scores out'), bars);
  const flow = h('div.nn-flow', null, inPanel, h('span.nn-arrow', null, '→'), netPanel, h('span.nn-arrow', null, '→'), outPanel);
  let at = 0;

  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'The model.'), ' Numbers in, numbers out.')),
      h('nav.tk-steps', { 'aria-label': 'Steps' }, ...pills),
      h('section.tk-card.nn-card', null, line, sentence, flow, map.el, loops.el, hook),
    ),
  );

  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  function addPiece(piece: string, fresh: boolean): void {
    const cls = `li.nn-piece${fresh ? '.new' : ''}${carriesOn(piece, pieces.childElementCount) ? '.part' : ''}` as const;
    pieces.append(h(cls, null, h('span.nn-text', null, show(piece)), h('span.nn-same', null, 'same word'), h('span.nn-id', null, String(IDS[piece]))));
    sentence.append(h(fresh ? 'span.nn-word.new' : 'span.nn-word', null, piece));
  }

  /** One pass through the formula: pulse, then the scores, then the winner lights up. Calls done() after ~2.6 s. */
  function pass(p: number, done?: () => void): void {
    bars.replaceChildren();
    net.pulse(timers);
    later(1400, () =>
      bars.replaceChildren(
        ...PASSES[p]!.map(([piece, score], k) =>
          h(
            'li.nn-bar',
            { style: `--p: ${Math.round(score * 100)}%` },
            h('span.nn-text', null, show(piece)),
            h('span.nn-pct', null, `${Math.round(score * 100)}%`),
            h('span.nn-id', null, String(IDS[piece] ?? '')),
            k === 0 ? h('span.nn-win', null, 'next') : null,
          ),
        ),
      ),
    );
    later(2000, () => bars.firstElementChild?.classList.add('top'));
    if (done) later(2600, done);
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
    pieces.replaceChildren();
    sentence.replaceChildren();
    bars.replaceChildren();
    net.reset();
    START.forEach((piece) => addPiece(piece, false));
    // The picture builds left to right: parts not reached yet are faint.
    pieces.classList.toggle('ids', k >= 1);
    netPanel.classList.toggle('dim', k < 3);
    outPanel.classList.toggle('dim', k < 4);
    mm.el.classList.toggle('shown', k === 3);
    hook.classList.remove('shown');
    // The map step and the last step swap the pipeline for their own picture.
    sentence.hidden = flow.hidden = k === 2 || k === 6;
    map.el.hidden = k !== 2;
    loops.el.hidden = k !== 6;

    if (k === 0) [...pieces.children].forEach((li, i) => (li as HTMLElement).style.setProperty('--d', `${i * 120}ms`));
    if (k === 2) map.play(timers);
    if (k === 3) {
      net.pulse(timers);
      mm.play(timers);
    }
    if (k === 4) pass(0);
    if (k === 5) {
      // Madrid won the last pass: it joins the text, and the formula runs again, twice.
      addPiece(PASSES[0]![0]![0], true);
      later(500, () => pass(1, () => addPiece(PASSES[1]![0]![0], true)));
      later(3400, () => pass(2, () => addPiece(PASSES[2]![0]![0], true)));
    }
    if (k === 6) {
      loops.play(timers);
      later(3800, () => hook.classList.add('shown'));
    }
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

  return () => {
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey);
  };
}
