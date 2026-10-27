// The loop slide's script. The agent is an LLM with a body: tools to act, and your code running it in a loop.
// One Hanoi game, round by round, with the same three tools as hanoi_tools.py.
// Scripted, not live: the page makes no API calls. Boards list each tower bottom to top, as the model reads them.

export interface Round {
  say: string; // what the model writes before its tool call
  tool: string | null; // null: no tool call, so the loop stops
  disk?: number;
  board?: string; // the board after the move
}

/** The tools: plain functions in your code. The LLM only picks one by name and gives the disk; your code runs it. */
export const TOOLS = [{ name: 'move_to_A' }, { name: 'move_to_B' }, { name: 'move_to_C' }];

export const ROUNDS: Round[] = [
  { say: 'Disk 1 to C first, so disk 2 can go to B.', tool: 'move_to_C', disk: 1, board: 'A: 3 2 · B: – · C: 1' },
  { say: 'Disk 2 to the empty tower B.', tool: 'move_to_B', disk: 2, board: 'A: 3 · B: 2 · C: 1' },
  { say: 'Disk 1 onto disk 2, so C is free.', tool: 'move_to_B', disk: 1, board: 'A: 3 · B: 2 1 · C: –' },
  { say: 'Disk 3 can go to C now.', tool: 'move_to_C', disk: 3, board: 'A: – · B: 2 1 · C: 3' },
  { say: 'Disk 1 to A, so disk 2 can get out.', tool: 'move_to_A', disk: 1, board: 'A: 1 · B: 2 · C: 3' },
  { say: 'Disk 2 onto disk 3.', tool: 'move_to_C', disk: 2, board: 'A: 1 · B: – · C: 3 2' },
  { say: 'Disk 1 on top, and it is done.', tool: 'move_to_C', disk: 1, board: 'A: – · B: – · C: 3 2 1' },
  { say: 'All disks are on C. Solved.', tool: null },
];

/** One click of "Next step": a round and where in the loop it is. */
export type Stage = 'send' | 'reply' | 'run' | 'remember' | 'stop';
export interface Step {
  round: number;
  stage: Stage;
}

// Four steps a round; the last round has no tool call, so it stops after the reply.
export const STEPS: Step[] = ROUNDS.flatMap((r, round): Step[] =>
  r.tool ? (['send', 'reply', 'run', 'remember'] as const).map((stage) => ({ round, stage })) : [{ round, stage: 'send' }, { round, stage: 'reply' }, { round, stage: 'stop' }],
);

export const call = (r: Round) => `${r.tool}(disk: ${r.disk})`;

/** The whole agent in code. `stage` lights the line in step with the circle. */
export const CODE: { line: string; stage?: Stage }[] = [
  { line: 'context = [task]' },
  { line: 'while True:' },
  { line: '    reply = llm(context, tools)', stage: 'send' },
  { line: '    if not reply.tool_call: break', stage: 'reply' },
  { line: '    result = run(reply.tool_call)', stage: 'run' },
  { line: '    context += [reply, result]', stage: 'remember' },
];

/** The sentence under the slide: what just happened, in plain words. */
export function caption(s: Step): string {
  const r = ROUNDS[s.round]!;
  if (s.stage === 'send') return s.round === 0 ? 'Your code sends the context to the LLM.' : `Round ${s.round + 1}: your code sends the whole context again.`;
  if (s.stage === 'reply') return r.tool ? `The LLM picks a tool and a disk: ${call(r)}.` : `The LLM replies with no tool call: “${r.say}”`;
  if (s.stage === 'run') return `Your code checks the rules and runs the function ${r.tool}. The body acts.`;
  if (s.stage === 'remember') return 'Your code adds the reply and the result to the context. Then round again.';
  return 'No tool call, so the loop stops. Brain + body solved it: that’s an agent.';
}
