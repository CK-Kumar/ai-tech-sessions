// The first scene: "eureka" as a dictionary entry, beside Archimedes in his bath and Newton under the apple.
// Nothing is explained on screen; the presenter says the rest.
// Illustrations: Freepik (free licence: the credit is in CREDITS.md). Their own backgrounds were removed, so they
// sit on the Zenova circles.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';

export function eurekaScene(host: HTMLElement): Mounted {
  const dot = () => h('span.ek-dot', null, '·');
  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h(
        'section.tk-card.ek-card',
        null,
        h(
          'div.ek-entry',
          null,
          h('h1.ek-word', null, 'eu', dot(), 're', dot(), 'ka'),
          h('p.ek-say', null, '/jʊˈriːkə/', h('i', null, 'interjection')),
          h('div.ek-bar'),
          h('p.ek-from', null, 'from Greek ', h('span.ek-greek', null, 'εὕρηκα'), ' (heúrēka)'),
          h('p.ek-means', null, '“I have found it.”'),
        ),
        h(
          'div.ek-pics',
          null,
          h(
            'figure.ek-pic.ek-archimedes',
            null,
            h('img', { src: 'session/archimedes.webp', alt: 'Archimedes in his bath, shouting Eureka' }),
            h('figcaption', null, 'Archimedes', h('span', null, 'about 250 BC')),
          ),
          h(
            'figure.ek-pic.ek-newton',
            null,
            h('img', { src: 'session/newton.webp', alt: 'Isaac Newton, an apple falling beside him' }),
            h('figcaption', null, 'Isaac Newton', h('span', null, '1666')),
          ),
        ),
      ),
    ),
  );
  return { stop: () => {} };
}
