// Scene: what comes next. The three topics of our AI & Tech sessions (use, build, trust), and a line that says the
// sessions are not only about AI: any tech or clever algorithm is welcome, and we always ask if AI is needed at all.
import { h } from '../dom.ts';
import type { Mounted } from './main.ts';

const PILLARS = [
  {
    word: 'Use',
    line: 'Agentic tools, used like a pro.',
    tools: ['Claude Code', 'Codex', 'Cursor', 'Gemini CLI', 'ChatGPT'],
    topics: ['context & prompts', 'skills & MCP', 'background agents'],
  },
  { word: 'Build', line: 'Our own harness, inside Zenova.', topics: ['LLM, classic ML, or plain code?', 'RAG', 'agent loops', 'harness engineering', 'guardrails', 'evals', 'open-weight models', 'inference engineering & cost'] },
  { word: 'Trust', line: 'Where AI fails, and how to stay safe.', topics: ['hallucinations', 'prompt injection', 'agent permissions', 'data privacy', 'bias', 'EU AI Act', 'AI literacy'] },
];

export function whyScene(host: HTMLElement): Mounted {
  host.replaceChildren(
    h(
      'div.tool-scene',
      null,
      h('header.bar-top', null, h('p.scene-title', null, h('b', null, 'What’s next?'), ' Use it, build with it, trust it.')),
      h(
        'section.tk-card.why-card',
        null,
        h('p.tk-line', null, 'Our AI & Tech sessions will cover three things.'),
        h(
          'div.why-pillars',
          null,
          ...PILLARS.map((p, k) =>
            h(
              'section.why-pillar',
              { style: `--k: ${k}` },
              h('p.why-num', null, String(k + 1)),
              h('h3.why-word', null, p.word),
              h('p.why-sub', null, p.line),
              // The tools themselves, as dark chips: the toolbox we will learn to use.
              p.tools ? h('ul.why-chips.tools', null, ...p.tools.map((t) => h('li', null, t))) : null,
              h('ul.why-chips', null, ...p.topics.map((t) => h('li', null, t))),
            ),
          ),
        ),
        // For the engineers who don't work with AI: the sessions are theirs too.
        h('p.why-ask-line', null, h('b', null, 'These sessions aren’t only about AI.'), ' Any cool tech, any clever algorithm: sometimes it beats a model.', h('br'), h('span.why-first', null, 'First question, always: do we really need AI?')),
      ),
    ),
  );
  return { stop: () => {} };
}
