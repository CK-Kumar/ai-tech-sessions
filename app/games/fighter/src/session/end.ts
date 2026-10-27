// The last scene: the knowledge-sharing title slide, like the cover of the Zenova deck, with its photo.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';

export function endScene(host: HTMLElement): Mounted {
  host.replaceChildren(
    h(
      'div.end',
      null,
      h(
        'section.end-cover',
        null,
        h(
          'div.end-left',
          null,
          h('p.end-mark', null, '✳ zenova'),
          h('div', null, h('span.end-pill', null, 'Tech'), h('h1.end-title', null, 'AI & Tech:', h('br'), 'Knowledge Sharing')),
        ),
        h('img.end-photo', { src: 'session/cover.jpg', alt: 'Someone coding at a desk with two monitors' }),
      ),
    ),
  );
  return { stop: () => {} };
}
