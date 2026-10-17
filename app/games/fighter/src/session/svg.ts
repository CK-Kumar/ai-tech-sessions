const NS = 'http://www.w3.org/2000/svg';

/** Tiny SVG helper: svg('circle', { r: 10 }), with optional text inside. */
export function svg(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text) el.textContent = text;
  return el;
}
