// The pill buttons under a scene's board (Start, Pause, Stop), shared by the Fight, Hanoi and Loop slides.
import { h } from '../dom.ts';

/** Icon shapes on a 16×16 grid. */
export const PLAY = 'M4.5 2.8v10.4L13 8z';
export const PAUSE = 'M4 2.5h3v11H4zM9 2.5h3v11H9z';
export const NEXT = 'M3 2.8v10.4L10.5 8zM11.5 3h2v10h-2z';
export const STOP = 'M3.5 3.5h9v9h-9z';
export const RESTART = 'M8 2.5a5.5 5.5 0 1 0 5.4 6.5h-1.9A3.7 3.7 0 1 1 8 4.3V6.5l3.5-3-3.5-3z';

/** A pill button with an icon; `set` swaps both, e.g. Pause → Resume. */
export function control(kind: string, path: string, text: string) {
  const icon = h('span.ctl-icon');
  const label = h('span', null, text);
  const set = (p: string, t: string) => {
    icon.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${p}" fill="currentColor"/></svg>`;
    label.textContent = t;
  };
  set(path, text);
  const el = h(`button.ctl.${kind}`, { type: 'button' }, icon, label) as HTMLButtonElement;
  return { el, set };
}
