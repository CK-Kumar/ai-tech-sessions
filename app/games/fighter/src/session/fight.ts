// Scene: two AI fighters, names hidden until "Reveal". Each side shows its "brain": a clock for how long the current
// answer is taking, and what it answered. Uses Opper's engine and renderer; every move goes through our server.py.
import { Match } from '../../shared/match.ts';
import { modelInfo } from '../../shared/models.ts';
import type { Decision, FighterMeta } from '../../shared/replay.ts';
import { modelAdapter } from '../api.ts';
import { h } from '../dom.ts';
import { Stage } from '../stage.ts';
import { SIDES } from '../theme.ts';

/** The game drops any answer slower than this and the fighter blocks instead. */
const DEADLINE_MS = 2000;

const HOW: Record<string, string> = {
  'openai/gpt-6-luna-decisions': 'Decisions API: one probability per move, no text',
  'openai/gpt-6-luna-text': 'Responses API: thinks, then writes its move as text',
};
const how = (id: string) => HOW[id] ?? (id.startsWith('typesafe/jev') ? 'Decision model: one probability per move' : '');

interface Brain {
  el: HTMLElement;
  who: HTMLElement;
  how: HTMLElement;
  clock: HTMLElement;
  answer: HTMLElement;
  inTime: HTMLElement;
  late: HTMLElement;
  counts: { inTime: number; late: number };
  lastMs: number;
}

function brain(side: 'a' | 'b', label: string): Brain {
  const b = {
    who: h('p.who', null, label),
    how: h('p.how'),
    clock: h('p.clock', null, '0.00 s'),
    answer: h('div.answer'),
    inTime: h('b', null, '0'),
    late: h('b', null, '0'),
  };
  b.answer.append(h('p.waiting', null, 'Waiting for the first move'));
  const el = h(
    `section.brain.${side}`,
    null,
    b.who,
    b.how,
    h('div.clock-box', null, b.clock, h('p.clock-note', null, 'to answer')),
    h('div.mind', null, b.answer, h('p.tally', null, h('span', null, b.inTime, ' in time'), h('span', null, b.late, ' too late'))),
  );
  return { el, ...b, counts: { inTime: 0, late: 0 }, lastMs: 0 };
}

/** low_kick_sweep → low kick sweep */
const pretty = (move: string) => move.replaceAll('_', ' ');

function showClock(b: Brain, ms: number): void {
  b.clock.textContent = `${(ms / 1000).toFixed(2)} s`;
  b.clock.classList.toggle('late', ms >= DEADLINE_MS);
}

function showDecision(b: Brain, d: Decision): void {
  b.lastMs = d.latencyMs;
  const late = d.fallback !== null;
  if (late) b.counts.late++;
  else b.counts.inTime++;
  b.inTime.textContent = String(b.counts.inTime);
  b.late.textContent = String(b.counts.late);
  const probs = d.answer?.probabilities;
  if (late) {
    b.answer.replaceChildren(h('p.wrote.late', null, 'Too late, so it blocks'));
  } else if (probs) {
    const top = Object.entries(probs).sort((x, y) => y[1]! - x[1]!).slice(0, 3);
    b.answer.replaceChildren(
      ...top.map(([move, p]) => {
        const pct = `${Math.round(p! * 100)}%`;
        const row = h('div.prob', null, h('span', null, pretty(move)), h('span.pct', null, pct));
        row.style.setProperty('--p', pct);
        return row;
      }),
    );
  } else {
    b.answer.replaceChildren(h('p.wrote', null, 'Wrote ', h('q', null, d.move)));
  }
}

/** Mounts the scene in `host`; returns a function that stops the fight and frees the canvas. */
export function fightScene(host: HTMLElement, left: string, right: string): () => void {
  const ids = [left, right] as const;
  // Hidden names first: the room should see two fighters before it knows they are AI.
  const meta = ids.map((id, k): FighterMeta => ({ model: id, label: k === 0 ? 'Fighter A' : 'Fighter B', kind: modelInfo(id).kind, color: SIDES[k]!.deep, via: 'server' })) as [FighterMeta, FighterMeta];
  const brains = [brain('a', meta[0].label), brain('b', meta[1].label)] as const;
  const arena = h('div.arena');
  const start = h('button.btn', { type: 'button' }, 'Start fight') as HTMLButtonElement;
  const reveal = h('button.btn.quiet', { type: 'button' }, 'Reveal fighters') as HTMLButtonElement;
  // "Answer within 2 seconds" would give away that they're AI, so the title changes on Reveal.
  const title = h('p.scene-title', null, h('b', null, 'Two fighters.'), ' Who wins?');
  const inside = h('button.btn.quiet', { type: 'button' }, 'Show how they decide') as HTMLButtonElement;
  // The brains stay hidden (their space kept, so nothing jumps) until "Show how they decide".
  const brainsRow = h('div.brains.layer', null, brains[0].el, brains[1].el);
  host.replaceChildren(
    h(
      'div.fight',
      null,
      h('header.bar-top', null, title, h('div.controls', null, start, reveal, inside)),
      arena,
      brainsRow,
    ),
  );

  const stage = new Stage(arena, meta);
  let match: Match | null = null;

  stage.onFrame = () => {
    for (const i of [0, 1] as const) {
      const p = match?.pending[i];
      // While a question is out, the clock runs; otherwise it holds the last answer's time.
      showClock(brains[i], p && !p.settled ? performance.now() - p.askedAt : brains[i].lastMs);
    }
  };

  reveal.addEventListener('click', () => {
    ids.forEach((id, k) => {
      meta[k]!.label = modelInfo(id).label; // the renderer reads this every frame, so the canvas updates too
      brains[k]!.who.textContent = meta[k]!.label;
      brains[k]!.how.textContent = how(id);
    });
    title.replaceChildren(h('b', null, 'Real time.'), ' Answer within 2 seconds, or block.');
    reveal.disabled = true;
  });

  inside.addEventListener('click', () => {
    brainsRow.classList.add('shown');
    inside.disabled = true;
  });

  start.addEventListener('click', async () => {
    match?.stop();
    brains.forEach((b) => {
      b.counts = { inTime: 0, late: 0 };
      b.lastMs = 0;
      b.answer.replaceChildren(h('p.waiting', null, 'Waiting for the first move'));
    });
    match = new Match({
      seed: Math.floor(Math.random() * 2 ** 31),
      mode: 'realtime',
      track: 'raw',
      deadlineMs: DEADLINE_MS,
      adapters: [modelAdapter(left, {}), modelAdapter(right, {})],
      fighters: meta,
    });
    match.onTick((st, events) => stage.tick(st, events));
    match.onDecision((d) => showDecision(brains[d.fighter], d));
    stage.tick(match.state);
    start.textContent = 'Restart fight';
    await match.warmUp();
    await match.run();
  });

  // A match that never runs, just to draw the two fighters standing before the start.
  stage.tick(new Match({ seed: 1, mode: 'realtime', deadlineMs: DEADLINE_MS, adapters: [modelAdapter(left, {}), modelAdapter(right, {})], fighters: meta }).state);

  return () => {
    match?.stop();
    stage.destroy();
  };
}
